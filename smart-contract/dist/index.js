'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.contracts = exports.PharmaLedger = void 0;
const fabric_contract_api_1 = require("fabric-contract-api");
const medicamento_1 = require("./medicamento");
class PharmaLedger extends fabric_contract_api_1.Contract {
    constructor() {
        // Nombre único del contrato
        super('PharmaLedger');
    }
    // --- Helpers con Tipos ---
    _getMSPID(ctx) {
        return ctx.clientIdentity.getMSPID();
    }
    _agregarHistorial(ctx, medicamento, actorMSPID, accion, ubicacion) {
        const txTimestamp = new Date(ctx.stub.getTxTimestamp().seconds.low * 1000).toISOString();
        const registro = {
            timestamp: txTimestamp,
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
    /**
     * InitLedger: Se llama una sola vez al desplegar el chaincode.
     * Carga un conjunto inicial de medicamentos en el ledger.
     */
    async InitLedger(ctx) {
        console.info('============= INICIANDO: Carga de datos iniciales (InitLedger) =============');
        const txTimestamp = new Date(ctx.stub.getTxTimestamp().seconds.low * 1000).toISOString();
        const medicamentosIniciales = [
            {
                assetID: 'MED-1001',
                nombreComercial: 'DrogaOncologica-A',
                lote: 'LOTE-001',
                fechaFabricacion: new Date('2025-01-10T10:00:00Z').toISOString(),
                fechaVencimiento: new Date('2026-01-10T10:00:00Z').toISOString(),
                estadoActual: medicamento_1.Estado.CREADO,
                propietarioActual: 'Org1MSP',
                historialDeCustodia: [
                    {
                        timestamp: txTimestamp, // <-- CORREGIDO
                        actor: 'Org1MSP',
                        accion: 'CREADO',
                        ubicacion: 'Planta de Producción',
                    }
                ],
                docType: 'Medicamento',
            },
            {
                assetID: 'MED-1002',
                nombreComercial: 'DrogaInmunologica-B',
                lote: 'LOTE-002',
                fechaFabricacion: new Date('2025-02-15T10:00:00Z').toISOString(),
                fechaVencimiento: new Date('2026-02-15T10:00:00Z').toISOString(),
                estadoActual: medicamento_1.Estado.CREADO,
                propietarioActual: 'Org1MSP',
                historialDeCustodia: [
                    {
                        timestamp: txTimestamp, // <-- CORREGIDO
                        actor: 'Org1MSP',
                        accion: 'CREADO',
                        ubicacion: 'Planta de Producción',
                    }
                ],
                docType: 'Medicamento',
            },
        ];
        for (const med of medicamentosIniciales) {
            await ctx.stub.putState(med.assetID, Buffer.from(JSON.stringify(med)));
            console.info(`Activo ${med.assetID} inicializado`);
        }
        console.info('============= COMPLETADO: Carga de datos iniciales =============');
    }
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
        this._agregarHistorial(ctx, medicamento, actorMSPID, 'CREADO', 'Planta de Producción');
        // 4. Guardar en el Ledger
        await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(medicamento)));
    }
    async Transferir(ctx, assetID, nuevoPropietarioMSPID) {
        const medicamento = await this._getMedicamento(ctx, assetID);
        const actorMSPID = this._getMSPID(ctx);
        if (actorMSPID !== medicamento.propietarioActual) {
            throw new Error(`Transacción no autorizada: solo el propietario actual (${medicamento.propietarioActual}) puede transferir`);
        }
        // Lógica de Transición de Estados
        if (medicamento.estadoActual === medicamento_1.Estado.CREADO) {
            medicamento.estadoActual = medicamento_1.Estado.EN_TRANSITO_LAB_A_LOGISTICA;
            medicamento.propietarioActual = nuevoPropietarioMSPID;
            this._agregarHistorial(ctx, medicamento, actorMSPID, 'TRANSFERIDO_A_LOGISTICA', 'En Tránsito');
        }
        else if (medicamento.estadoActual === medicamento_1.Estado.ALMACENADO_LOGISTICA) {
            medicamento.estadoActual = medicamento_1.Estado.EN_TRANSITO_LOGISTICA_A_SALUD;
            medicamento.propietarioActual = nuevoPropietarioMSPID;
            this._agregarHistorial(ctx, medicamento, actorMSPID, 'TRANSFERIDO_A_SALUD', 'En Tránsito');
        }
        else {
            throw new Error(`Error de estado: no se puede transferir un activo en estado '${medicamento_1.Estado[medicamento.estadoActual]}'`);
        }
        await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(medicamento)));
    }
    async Recibir(ctx, assetID, ubicacion) {
        const medicamento = await this._getMedicamento(ctx, assetID);
        const actorMSPID = this._getMSPID(ctx);
        if (actorMSPID !== medicamento.propietarioActual) {
            throw new Error(`Transacción no autorizada: solo el nuevo propietario (${medicamento.propietarioActual}) puede recibir`);
        }
        // Lógica DTE
        if (medicamento.estadoActual === medicamento_1.Estado.EN_TRANSITO_LAB_A_LOGISTICA) {
            medicamento.estadoActual = medicamento_1.Estado.ALMACENADO_LOGISTICA;
            this._agregarHistorial(ctx, medicamento, actorMSPID, 'RECIBIDO_LOGISTICA', ubicacion);
        }
        else if (medicamento.estadoActual === medicamento_1.Estado.EN_TRANSITO_LOGISTICA_A_SALUD) {
            medicamento.estadoActual = medicamento_1.Estado.RECIBIDO_SALUD;
            this._agregarHistorial(ctx, medicamento, actorMSPID, 'RECIBIDO_SALUD', ubicacion);
        }
        else {
            throw new Error(`Error de estado: no se puede recibir un activo en estado '${medicamento_1.Estado[medicamento.estadoActual]}'`);
        }
        await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(medicamento)));
    }
    async DespacharAPaciente(ctx, assetID, idPaciente) {
        const medicamento = await this._getMedicamento(ctx, assetID);
        const actorMSPID = this._getMSPID(ctx);
        if (actorMSPID !== 'Org2MSP') {
            throw new Error('Transacción no autorizada: solo OrgSalud (Org2MSP) puede despachar');
        }
        if (medicamento.estadoActual !== medicamento_1.Estado.RECIBIDO_SALUD) {
            throw new Error("Error de estado: solo se puede despachar un activo en 'RECIBIDO_SALUD'");
        }
        if (new Date() > new Date(medicamento.fechaVencimiento)) {
            throw new Error(`Error: el medicamento está vencido (${medicamento.fechaVencimiento})`);
        }
        medicamento.estadoActual = medicamento_1.Estado.DESPACHADO_PACIENTE;
        medicamento.propietarioActual = 'PACIENTE';
        this._agregarHistorial(ctx, medicamento, actorMSPID, `DESPACHADO_PACIENTE (ID: ${idPaciente})`, 'Farmacia Hospital');
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
                const txValue = result.value.value.toString();
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
    /**
     * ConsultarTodosLosMedicamentos: Devuelve todos los activos con docType 'Medicamento'.
     */
    async ConsultarTodosLosMedicamentos(ctx) {
        const queryString = {
            selector: {
                docType: 'Medicamento'
            }
        };
        const iterator = await ctx.stub.getQueryResult(JSON.stringify(queryString));
        const allResults = [];
        let result = await iterator.next();
        while (!result.done) {
            if (result.value) {
                const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
                let record;
                try {
                    record = JSON.parse(strValue);
                }
                catch (err) {
                    console.log(err);
                    record = strValue;
                }
                allResults.push(record);
            }
            result = await iterator.next();
        }
        await iterator.close();
        return JSON.stringify(allResults);
    }
}
exports.PharmaLedger = PharmaLedger;
// Exportar la lista de contratos
exports.contracts = [PharmaLedger];
//# sourceMappingURL=index.js.map