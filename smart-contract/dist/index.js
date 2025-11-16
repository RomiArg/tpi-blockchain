'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.contracts = exports.PharmaLedger = void 0;
const fabric_contract_api_1 = require("fabric-contract-api");
const medicamento_1 = require("./medicamento");
/* // Enumerador de estados
const Estado = {
    CREADO: 0,
    EN_TRANSITO_LAB_A_LOGISTICA: 1,
    ALMACENADO_LOGISTICA: 2,
    EN_TRANSITO_LOGISTICA_A_SALUD: 3,
    RECIBIDO_SALUD: 4,
    DESPACHADO_PACIENTE: 5,
};

// Mapeo de estados a strings para fácil lectura
const estadoStrings = [
    'CREADO',
    'EN_TRANSITO_LAB_A_LOGISTICA',
    'ALMACENADO_LOGISTICA',
    'EN_TRANSITO_LOGISTICA_A_SALUD',
    'RECIBIDO_SALUD',
    'DESPACHADO_PACIENTE',
];

class PharmaLedger extends Contract {

    constructor() {
        // Nombre único del contrato
        super('PharmaLedger');
    }

    // Helper para obtener el MSPID del cliente que invoca la transacción
    // Esto es crucial para la lógica de permisos
    _getMSPID(ctx) {
        return ctx.clientIdentity.getMSPID();
    }

    // Helper para agregar una entrada al historial
    _agregarHistorial(medicamento, actorMSPID, accion, ubicacion) {
        const registro = {
            timestamp: new Date().toISOString(),
            actor: actorMSPID,
            accion: accion,
            ubicacion: ubicacion,
        };
        medicamento.historialDeCustodia.push(registro);
    }

    // Helper para obtener un activo del ledger
    async _getMedicamento(ctx, assetID) {
        const medicamentoJSON = await this.ConsultarActivo(ctx, assetID);
        try {
            return JSON.parse(medicamentoJSON.toString());
        } catch (err) {
            throw new Error(`Error al deserializar el activo: ${err.message}`);
        }
    }

    // (Inicio de Transacciones basadas en el DTE y Modelo Integrado)

    // crearMedicamento: Transacción para "acuñar" un nuevo activo
    async CrearMedicamento(
        ctx,
        assetID,
        nombreComercial,
        lote,
        fechaFabricacionStr,
        fechaVencimientoStr
    ) {
        // 1. Validar permisos (Actor)
        const actorMSPID = this._getMSPID(ctx);

        // NOTA: Para la 'test-network' usamos Org1MSP. En producción, sería "OrgLaboratorioMSP".
        if (actorMSPID !== 'Org1MSP') {
            throw new Error('Transacción no autorizada: solo OrgLaboratorio (Org1MSP) puede crear medicamentos');
        }

        // 2. Validar que no exista (Validación de Estado Previo)
        const assetExists = await ctx.stub.getState(assetID);
        if (assetExists && assetExists.length > 0) {
            throw new Error(`Error: el assetID '${assetID}' ya existe`);
        }

        // Validar fechas (ISO String)
        const fechaFabricacion = new Date(fechaFabricacionStr);
        const fechaVencimiento = new Date(fechaVencimientoStr);
        if (isNaN(fechaFabricacion.getTime()) || isNaN(fechaVencimiento.getTime())) {
            throw new Error('Formato de fecha inválido. Usar ISO 8601 (ej. 2025-11-01T10:00:00Z)');
        }

        // 3. Crear el activo (Modelo de Datos)
        const medicamento = {
            assetID: assetID,
            nombreComercial: nombreComercial,
            lote: lote,
            fechaFabricacion: fechaFabricacion.toISOString(),
            fechaVencimiento: fechaVencimiento.toISOString(),
            estadoActual: Estado.CREADO,
            propietarioActual: actorMSPID, // El creador es el primer propietario
            historialDeCustodia: [],
        };

        this._agregarHistorial(medicamento, actorMSPID, 'CREADO', 'Planta de Producción');

        // 4. Guardar en el Ledger
        await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(medicamento)));
    }

    // transferir: Transacción para cambiar la custodia
    async Transferir(ctx, assetID, nuevoPropietarioMSPID) {
        // 1. Obtener el activo
        const medicamento = await this._getMedicamento(ctx, assetID);

        // 2. Validar permisos (Actor)
        const actorMSPID = this._getMSPID(ctx);

        if (actorMSPID !== medicamento.propietarioActual) { // [cite: 169, 177]
            throw new Error(`Transacción no autorizada: solo el propietario actual (${medicamento.propietarioActual}) puede transferir el activo`);
        }

        // 3. Validar Estado Previo y actualizar
        if (medicamento.estadoActual === Estado.CREADO) { // [cite: 166]
            // Inicia transferencia a Logística
            medicamento.estadoActual = Estado.EN_TRANSITO_LAB_A_LOGISTICA;
            medicamento.propietarioActual = nuevoPropietarioMSPID; // Asigna propiedad a OrgLogistica
            this._agregarHistorial(medicamento, actorMSPID, 'TRANSFERIDO_A_LOGISTICA', 'En Tránsito');

        } else if (medicamento.estadoActual === Estado.ALMACENADO_LOGISTICA) { // [cite: 174]
            // Inicia transferencia a Salud
            medicamento.estadoActual = Estado.EN_TRANSITO_LOGISTICA_A_SALUD;
            medicamento.propietarioActual = nuevoPropietarioMSPID; // Asigna propiedad a OrgSalud
            this._agregarHistorial(medicamento, actorMSPID, 'TRANSFERIDO_A_SALUD', 'En Tránsito');

        } else {
            throw new Error(`Error de estado: no se puede transferir un activo en estado '${estadoStrings[medicamento.estadoActual]}'`);
        }

        // 4. Guardar cambios
        await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(medicamento)));
    }

    // recibir: Transacción para confirmar la recepción
    async Recibir(ctx, assetID, ubicacion) {

        // 1. Obtener el activo
        const medicamento = await this._getMedicamento(ctx, assetID);

        // 2. Validar permisos (Actor)
        const actorMSPID = this._getMSPID(ctx);

        if (actorMSPID !== medicamento.propietarioActual) { // [cite: 173, 181]
            throw new Error(`Transacción no autorizada: solo el nuevo propietario (${medicamento.propietarioActual}) puede recibir el activo`);
        }

        // 3. Validar Estado Previo y actualizar
        if (medicamento.estadoActual === Estado.EN_TRANSITO_LAB_A_LOGISTICA) { // [cite: 170]
            medicamento.estadoActual = Estado.ALMACENADO_LOGISTICA;
            this._agregarHistorial(medicamento, actorMSPID, 'RECIBIDO_LOGISTICA', ubicacion);

        } else if (medicamento.estadoActual === Estado.EN_TRANSITO_LOGISTICA_A_SALUD) { // [cite: 178]
            medicamento.estadoActual = Estado.RECIBIDO_SALUD;
            this._agregarHistorial(medicamento, actorMSPID, 'RECIBIDO_SALUD', ubicacion);

        } else {
            throw new Error(`Error de estado: no se puede recibir un activo en estado '${estadoStrings[medicamento.estadoActual]}'`);
        }

        // 4. Guardar cambios
        await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(medicamento)));
    }

    // despacharAPaciente: Transacción de fin de vida
    async DespacharAPaciente(ctx, assetID, idPaciente) {

        // 1. Obtener el activo
        const medicamento = await this._getMedicamento(ctx, assetID);

        // 2. Validar permisos (Actor)
        const actorMSPID = this._getMSPID(ctx);

        // NOTA: Para la 'test-network' asumimos que OrgSalud es Org2MSP.
        if (actorMSPID !== 'Org2MSP') { // [cite: 184]
            throw new Error('Transacción no autorizada: solo OrgSalud (Org2MSP) puede despachar a pacientes');
        }

        // 3. Validar Estado Previo
        if (medicamento.estadoActual !== Estado.RECIBIDO_SALUD) { // [cite: 185]
            throw new Error("Error de estado: solo se puede despachar un activo en estado 'RECIBIDO_SALUD'");
        }

        // (Validación extra mencionada en DTE: notExpired)
        const fechaVencimiento = new Date(medicamento.fechaVencimiento);
        if (new Date() > fechaVencimiento) {
            throw new Error(`Error: el medicamento está vencido (${medicamento.fechaVencimiento})`);
        }

        // 4. Actualizar estado (estado final)
        medicamento.estadoActual = Estado.DESPACHADO_PACIENTE;
        medicamento.propietarioActual = 'PACIENTE'; // El activo sale de la cadena de custodia
        this._agregarHistorial(medicamento, actorMSPID, `DESPACHADO_PACIENTE (ID: ${idPaciente})`, 'Farmacia Hospital');

        // 5. Guardar cambios
        await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(medicamento)));
    }

    // (Inicio Funciones de Consulta)

    // ConsultarActivo: Obtiene el estado y propietario actual del activo
    async ConsultarActivo(ctx, assetID) {
        const medicamentoJSON = await ctx.stub.getState(assetID);
        if (!medicamentoJSON || medicamentoJSON.length === 0) {
            throw new Error(`El activo ${assetID} no existe`);
        }
        return medicamentoJSON;
    }

    // ConsultarHistorial: Obtiene el historial completo de custodia del activo
    async ConsultarHistorial(ctx, assetID) {
        const iterator = await ctx.stub.getHistoryForKey(assetID);
        const historial = [];

        let result = await iterator.next();
        while (!result.done) {
            if (result.value) {
                const txValue = result.value.value.toString('utf8');
                let valor;
                try {
                    valor = JSON.parse(txValue);
                } catch (err) {
                    valor = txValue; // En caso de que no sea JSON
                }

                const registro = {
                    txId: result.value.txId,
                    timestamp: new Date(result.value.timestamp.seconds.low * 1000).toISOString(),
                    valor: valor,
                    isDelete: result.value.isDelete,
                };
                historial.push(registro);
            }
            result = await iterator.next();
        }
        await iterator.close();
        return JSON.stringify(historial);
    }
}

module.exports.contracts = [PharmaLedger]; */
class PharmaLedger extends fabric_contract_api_1.Contract {
    constructor() {
        // Nombre único del contrato
        super('PharmaLedger');
    }
    // --- Helpers con Tipos ---
    _getMSPID(ctx) {
        return ctx.clientIdentity.getMSPID();
    }
    _agregarHistorial(medicamento, actorMSPID, accion, ubicacion) {
        const registro = {
            timestamp: new Date().toISOString(),
            actor: actorMSPID,
            accion: accion,
            ubicacion: ubicacion,
        };
        medicamento.historialDeCustodia.push(registro);
    }
    async _getMedicamento(ctx, assetID) {
        const medicamentoBytes = await ctx.stub.getState(assetID);
        if (!medicamentoBytes || medicamentoBytes.length === 0) {
            throw new Error(`El activo ${assetID} no existe`);
        }
        try {
            // Deserializa el JSON a nuestra clase Medicamento
            const medicamento = JSON.parse(medicamentoBytes.toString());
            return medicamento;
        }
        catch (err) {
            throw new Error(`Error al deserializar el activo: ${err.message}`);
        }
    }
    // --- Transacciones ---
    async CrearMedicamento(ctx, assetID, nombreComercial, lote, fechaFabricacionStr, fechaVencimientoStr) {
        // 1. Validar permisos (Actor)
        const actorMSPID = this._getMSPID(ctx);
        if (actorMSPID !== 'Org1MSP') { //
            throw new Error('Transacción no autorizada: solo OrgLaboratorio (Org1MSP) puede crear medicamentos');
        }
        // 2. Validar que no exista
        const assetExists = await ctx.stub.getState(assetID);
        if (assetExists && assetExists.length > 0) {
            throw new Error(`Error: el assetID '${assetID}' ya existe`);
        }
        // 3. Crear el activo
        const medicamento = {
            docType: 'Medicamento',
            assetID: assetID,
            nombreComercial: nombreComercial,
            lote: lote,
            fechaFabricacion: new Date(fechaFabricacionStr).toISOString(),
            fechaVencimiento: new Date(fechaVencimientoStr).toISOString(),
            estadoActual: medicamento_1.Estado.CREADO,
            propietarioActual: actorMSPID,
            historialDeCustodia: [],
        };
        this._agregarHistorial(medicamento, actorMSPID, 'CREADO', 'Planta de Producción');
        // 4. Guardar en el Ledger
        await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(medicamento)));
    }
    async Transferir(ctx, assetID, nuevoPropietarioMSPID) {
        const medicamento = await this._getMedicamento(ctx, assetID);
        const actorMSPID = this._getMSPID(ctx);
        if (actorMSPID !== medicamento.propietarioActual) { //
            throw new Error(`Transacción no autorizada: solo el propietario actual (${medicamento.propietarioActual}) puede transferir`);
        }
        // Lógica de Transición de Estados (DTE) [cite: 160]
        if (medicamento.estadoActual === medicamento_1.Estado.CREADO) { //
            medicamento.estadoActual = medicamento_1.Estado.EN_TRANSITO_LAB_A_LOGISTICA;
            medicamento.propietarioActual = nuevoPropietarioMSPID;
            this._agregarHistorial(medicamento, actorMSPID, 'TRANSFERIDO_A_LOGISTICA', 'En Tránsito');
        }
        else if (medicamento.estadoActual === medicamento_1.Estado.ALMACENADO_LOGISTICA) { //
            medicamento.estadoActual = medicamento_1.Estado.EN_TRANSITO_LOGISTICA_A_SALUD;
            medicamento.propietarioActual = nuevoPropietarioMSPID;
            this._agregarHistorial(medicamento, actorMSPID, 'TRANSFERIDO_A_SALUD', 'En Tránsito');
        }
        else {
            throw new Error(`Error de estado: no se puede transferir un activo en estado '${medicamento_1.Estado[medicamento.estadoActual]}'`);
        }
        await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(medicamento)));
    }
    async Recibir(ctx, assetID, ubicacion) {
        const medicamento = await this._getMedicamento(ctx, assetID);
        const actorMSPID = this._getMSPID(ctx);
        if (actorMSPID !== medicamento.propietarioActual) { //
            throw new Error(`Transacción no autorizada: solo el nuevo propietario (${medicamento.propietarioActual}) puede recibir`);
        }
        // Lógica DTE [cite: 170, 178]
        if (medicamento.estadoActual === medicamento_1.Estado.EN_TRANSITO_LAB_A_LOGISTICA) { //
            medicamento.estadoActual = medicamento_1.Estado.ALMACENADO_LOGISTICA;
            this._agregarHistorial(medicamento, actorMSPID, 'RECIBIDO_LOGISTICA', ubicacion);
        }
        else if (medicamento.estadoActual === medicamento_1.Estado.EN_TRANSITO_LOGISTICA_A_SALUD) { //
            medicamento.estadoActual = medicamento_1.Estado.RECIBIDO_SALUD;
            this._agregarHistorial(medicamento, actorMSPID, 'RECIBIDO_SALUD', ubicacion);
        }
        else {
            throw new Error(`Error de estado: no se puede recibir un activo en estado '${medicamento_1.Estado[medicamento.estadoActual]}'`);
        }
        await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(medicamento)));
    }
    async DespacharAPaciente(ctx, assetID, idPaciente) {
        const medicamento = await this._getMedicamento(ctx, assetID);
        const actorMSPID = this._getMSPID(ctx);
        if (actorMSPID !== 'Org2MSP') { //
            throw new Error('Transacción no autorizada: solo OrgSalud (Org2MSP) puede despachar');
        }
        if (medicamento.estadoActual !== medicamento_1.Estado.RECIBIDO_SALUD) { //
            throw new Error("Error de estado: solo se puede despachar un activo en 'RECIBIDO_SALUD'");
        }
        if (new Date() > new Date(medicamento.fechaVencimiento)) {
            throw new Error(`Error: el medicamento está vencido (${medicamento.fechaVencimiento})`);
        }
        medicamento.estadoActual = medicamento_1.Estado.DESPACHADO_PACIENTE;
        medicamento.propietarioActual = 'PACIENTE';
        this._agregarHistorial(medicamento, actorMSPID, `DESPACHADO_PACIENTE (ID: ${idPaciente})`, 'Farmacia Hospital');
        await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(medicamento)));
    }
    // --- Consultas ---
    async ConsultarActivo(ctx, assetID) {
        const medicamentoBytes = await ctx.stub.getState(assetID);
        if (!medicamentoBytes || medicamentoBytes.length === 0) {
            throw new Error(`El activo ${assetID} no existe`);
        }
        return medicamentoBytes.toString();
    }
    async ConsultarHistorial(ctx, assetID) {
        const iterator = await ctx.stub.getHistoryForKey(assetID);
        const historial = [];
        let result = await iterator.next();
        while (!result.done) {
            if (result.value) {
                const txValue = result.value.value.toString('utf8');
                let valor;
                try {
                    valor = JSON.parse(txValue);
                }
                catch (err) {
                    valor = txValue;
                }
                const registro = {
                    txId: result.value.txId,
                    timestamp: new Date(result.value.timestamp.seconds.low * 1000).toISOString(),
                    valor: valor,
                    isDelete: result.value.isDelete,
                };
                historial.push(registro);
            }
            result = await iterator.next();
        }
        await iterator.close();
        return JSON.stringify(historial);
    }
}
exports.PharmaLedger = PharmaLedger;
// Exportar la lista de contratos
exports.contracts = [PharmaLedger];
//# sourceMappingURL=index.js.map