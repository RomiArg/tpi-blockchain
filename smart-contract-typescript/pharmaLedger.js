'useS-trict';

const { Contract } = require('fabric-contract-api');

// Definición de Estados (Enumerador)
const ESTADOS = {
    CREADO: 'CREADO',
    EN_TRANSITO_LAB_A_LOGISTICA: 'EN_TRANSITO_LAB_A_LOGISTICA',
    ALMACENADO_LOGISTICA: 'ALMACENADO_LOGISTICA',
    EN_TRANSITO_LOGISTICA_A_SALUD: 'EN_TRANSITO_LOGISTICA_A_SALUD',
    RECIBIDO_SALUD: 'RECIBIDO_SALUD',
    DESPACHADO_PACIENTE: 'DESPACHADO_PACIENTE',
};

class PharmaLedger extends Contract {

    constructor() {
        super('PharmaLedgerContract');
    }

    // === Funciones de Transacción ===

    /**
     * crearMedicamento: Transacción para "acuñar" un nuevo activo.
     * Solo puede ser llamada por OrgLaboratorio.
     */
    async crearMedicamento(ctx, assetID, nombreComercial, lote, fechaFabricacion, fechaVencimiento) {

        // 1. Control de Acceso: Solo OrgLaboratorio puede crear
        const mspid = ctx.clientIdentity.getMSPID();
        if (mspid !== 'OrgLaboratorio') {
            throw new Error('Error de permisos: solo OrgLaboratorio puede crear medicamentos');
        }

        // 2. Validación de Estado: El activo no debe existir
        const exists = await this.AssetExists(ctx, assetID);
        if (exists) {
            throw new Error(`El activo ${assetID} ya existe`);
        }

        // 3. Crear el primer registro de historial [cite: 145-150]
        const registroInicial = {
            timestamp: new Date().getTime(), // Usamos timestamp JS
            actor: mspid,
            accion: 'CREADO',
            ubicacion: 'Laboratorio',
        };

        // 4. Crear el activo Medicamento (Modelo de Datos)
        const medicamento = {
            assetID: assetID,
            nombreComercial: nombreComercial,
            lote: lote,
            fechaFabricacion: parseInt(fechaFabricacion, 10),
            fechaVencimiento: parseInt(fechaVencimiento, 10),
            estadoActual: ESTADOS.CREADO,
            propietarioActual: mspid, // Propietario inicial
            historialDeCustodia: [registroInicial],
        };

        // 5. Guardar en el World State
        // Convertimos el objeto JSON a un Buffer para guardarlo
        await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(medicamento)));

        return JSON.stringify(medicamento);
    }

    /**
     * transferir: Transacción para pasar la custodia a otra organización.
     */
    async transferir(ctx, assetID, nuevoPropietarioMSPID) {

        // 1. Obtener el activo
        const medicamento = await this.ConsultarActivo(ctx, assetID);

        // 2. Control de Acceso: Solo el propietario actual puede transferir
        const mspid = ctx.clientIdentity.getMSPID();
        if (mspid !== medicamento.propietarioActual) {
            throw new Error(`Error de permisos: solo el propietario actual (${medicamento.propietarioActual}) puede transferir el activo`);
        }

        // 3. Validación de Estado (Lógica del DTE)
        let nuevoEstado = '';
        let accion = '';

        if (medicamento.estadoActual === ESTADOS.CREADO && nuevoPropietarioMSPID === 'OrgLogistica') {
            nuevoEstado = ESTADOS.EN_TRANSITO_LAB_A_LOGISTICA;
            accion = 'Transferido a Logística';
        } else if (medicamento.estadoActual === ESTADOS.ALMACENADO_LOGISTICA && nuevoPropietarioMSPID === 'OrgSalud') {
            nuevoEstado = ESTADOS.EN_TRANSITO_LOGISTICA_A_SALUD;
            accion = 'Transferido a Centro de Salud';
        } else {
            throw new Error(`Transición de estado inválida: no se puede transferir desde el estado ${medicamento.estadoActual}`);
        }

        // 4. Actualizar el activo
        medicamento.propietarioActual = nuevoPropietarioMSPID;
        medicamento.estadoActual = nuevoEstado;

        // 5. Añadir al historial
        const nuevoRegistro = {
            timestamp: new Date().getTime(),
            actor: mspid,
            accion: accion,
        };
        medicamento.historialDeCustodia.push(nuevoRegistro);

        // 6. Guardar en el World State
        await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(medicamento)));
    }

    /**
     * recibir: Transacción para confirmar la recepción de un activo.
     */
    async recibir(ctx, assetID) {

        // 1. Obtener el activo
        const medicamento = await this.ConsultarActivo(ctx, assetID);

        // 2. Control de Acceso: Solo el nuevo propietario (a quien se le transfirió) puede recibir
        const mspid = ctx.clientIdentity.getMSPID();
        if (mspid !== medicamento.propietarioActual) {
            throw new Error(`Error de permisos: solo el propietario actual (${medicamento.propietarioActual}) puede recibir el activo`);
        }

        // 3. Validación de Estado (Lógica del DTE) [cite: 160]
        let nuevoEstado = '';
        let accion = '';

        if (medicamento.estadoActual === ESTADOS.EN_TRANSITO_LAB_A_LOGISTICA) {
            nuevoEstado = ESTADOS.ALMACENADO_LOGISTICA;
            accion = 'Recibido por Logística';
        } else if (medicamento.estadoActual === ESTADOS.EN_TRANSITO_LOGISTICA_A_SALUD) {
            nuevoEstado = ESTADOS.RECIBIDO_SALUD;
            accion = 'Recibido por Centro de Salud';
        } else {
            throw new Error(`Transición de estado inválida: no se puede recibir en el estado ${medicamento.estadoActual}`);
        }

        // 4. Actualizar el activo
        medicamento.estadoActual = nuevoEstado;

        // 5. Añadir al historial
        const nuevoRegistro = {
            timestamp: new Date().getTime(),
            actor: mspid,
            accion: accion,
        };
        medicamento.historialDeCustodia.push(nuevoRegistro);

        // 6. Guardar en el World State
        await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(medicamento)));
    }

    /**
     * despacharAPaciente: Transacción final, marca el fin del ciclo de vida.
     * [cite: 183-186, 203]
     */
    async despacharAPaciente(ctx, assetID, idPaciente) {
        
        // 1. Obtener el activo
        const medicamento = await this.ConsultarActivo(ctx, assetID);

        // 2. Control de Acceso: Solo OrgSalud puede despachar [cite: 128, 184]
        const mspid = ctx.clientIdentity.getMSPID();
        if (mspid !== 'OrgSalud') {
            throw new Error('Error de permisos: solo OrgSalud puede despachar a pacientes');
        }

        // 3. Validación de Propietario y Estado
        if (mspid !== medicamento.propietarioActual) {
            throw new Error(`Error de permisos: solo el propietario actual (${medicamento.propietarioActual}) puede despachar el activo`);
        }
        if (medicamento.estadoActual !== ESTADOS.RECIBIDO_SALUD) { [cite: 185]
            throw new Error('Transición de estado inválida: solo se puede despachar un activo en estado RECIBIDO_SALUD');
        }

        // 4. Actualizar el activo
        medicamento.estadoActual = ESTADOS.DESPACHADO_PACIENTE;

        // 5. Añadir al historial
        const accion = `Despachado a paciente (ID: ${idPaciente})`;
        const nuevoRegistro = {
            timestamp: new Date().getTime(),
            actor: mspid,
            accion: accion,
        };
        medicamento.historialDeCustodia.push(nuevoRegistro);

        // 6. Guardar en el World State
        await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(medicamento)));
    }

    // === Funciones de Consulta ===

    /**
     * ConsultarActivo: Obtiene el estado y propietario actual del activo (el objeto Medicamento completo).
     * 
     */
    async ConsultarActivo(ctx, assetID) {
        const assetJSON = await ctx.stub.getState(assetID);
        if (!assetJSON || assetJSON.length === 0) {
            throw new Error(`El activo ${assetID} no existe`);
        }
        
        // El resultado de getState es un Buffer, lo convertimos a String y luego a JSON
        return JSON.parse(assetJSON.toString());
    }

    /**
     * ConsultarHistorial: Obtiene el historial completo de custodia del activo.
     * 
     */
    async ConsultarHistorial(ctx, assetID) {
        const medicamento = await this.ConsultarActivo(ctx, assetID);
        // Retorna solo el array del historial
        return JSON.stringify(medicamento.historialDeCustodia);
    }

    // === Funciones Auxiliares ===

    /**
     * AssetExists: Revisa si un activo con el ID dado ya existe en el World State.
     * [cite: 165]
     */
    async AssetExists(ctx, assetID) {
        const assetJSON = await ctx.stub.getState(assetID);
        return !!assetJSON && assetJSON.length > 0;
    }
}

// Exportar la clase del contrato
module.exports.contracts = [PharmaLedger];