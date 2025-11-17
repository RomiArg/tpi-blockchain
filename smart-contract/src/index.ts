'use strict';

import { Context, Contract } from 'fabric-contract-api';
import { Medicamento, RegistroHistorial, Estado } from './medicamento';

export class PharmaLedger extends Contract {
    constructor() {
        // Nombre único del contrato
        super('PharmaLedger');
    }

    // --- Helpers con Tipos ---
    private _getMSPID(ctx: Context): string {
        return ctx.clientIdentity.getMSPID();
    }

    private _agregarHistorial(
        ctx: Context,
        medicamento: Medicamento,
        actorMSPID: string,
        accion: string,
        ubicacion: string
    ): void {
        const txTimestamp = new Date(ctx.stub.getTxTimestamp().seconds.low * 1000).toISOString();

        const registro: RegistroHistorial = {
            timestamp: txTimestamp,
            actor: actorMSPID,
            accion: accion,
            ubicacion: ubicacion,
        };
        medicamento.historialDeCustodia.push(registro);
    }

    private async _getMedicamento(ctx: Context, assetID: string): Promise<Medicamento> {
        const medicamentoBytes = await ctx.stub.getState(assetID);
        if (!medicamentoBytes || medicamentoBytes.length === 0) {
            throw new Error(`El activo ${assetID} no existe`);
        }
        try {
            // Deserializa el JSON a nuestra clase Medicamento
            const medicamento: Medicamento = JSON.parse(medicamentoBytes.toString());
            return medicamento;
        } catch (err) {
            throw new Error(`Error al deserializar el activo: ${(err as Error).message}`);
        }
    }

    // --- Transacciones ---

    /**
     * InitLedger: Se llama una sola vez al desplegar el chaincode.
     * Carga un conjunto inicial de medicamentos en el ledger.
     */
    public async InitLedger(ctx: Context): Promise<void> {
        console.info('============= INICIANDO: Carga de datos iniciales (InitLedger) =============');

        const txTimestamp = new Date(ctx.stub.getTxTimestamp().seconds.low * 1000).toISOString();

        const medicamentosIniciales: Medicamento[] = [
            {
                assetID: 'MED-1001',
                nombreComercial: 'DrogaOncologica-A',
                lote: 'LOTE-001',
                fechaFabricacion: new Date('2025-01-10T10:00:00Z').toISOString(),
                fechaVencimiento: new Date('2026-01-10T10:00:00Z').toISOString(),
                estadoActual: Estado.CREADO,
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
                estadoActual: Estado.CREADO,
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

    public async CrearMedicamento(
        ctx: Context,
        assetID: string,
        nombreComercial: string,
        lote: string,
        fechaFabricacionStr: string,
        fechaVencimientoStr: string
    ): Promise<void> {

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
        const medicamento: Medicamento = {
            docType: 'Medicamento',
            assetID: assetID,
            nombreComercial: nombreComercial,
            lote: lote,
            fechaFabricacion: new Date(fechaFabricacionStr).toISOString(),
            fechaVencimiento: new Date(fechaVencimientoStr).toISOString(),
            estadoActual: Estado.CREADO,
            propietarioActual: actorMSPID,
            historialDeCustodia: [],
        };

        this._agregarHistorial(ctx, medicamento, actorMSPID, 'CREADO', 'Planta de Producción');

        // 4. Guardar en el Ledger
        await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(medicamento)));
    }

    public async Transferir(ctx: Context, assetID: string, nuevoPropietarioMSPID: string): Promise<void> {
        const medicamento = await this._getMedicamento(ctx, assetID);
        const actorMSPID = this._getMSPID(ctx);

        if (actorMSPID !== medicamento.propietarioActual) {
            throw new Error(`Transacción no autorizada: solo el propietario actual (${medicamento.propietarioActual}) puede transferir`);
        }

        // Lógica de Transición de Estados
        if (medicamento.estadoActual === Estado.CREADO) {
            medicamento.estadoActual = Estado.EN_TRANSITO_LAB_A_LOGISTICA;
            medicamento.propietarioActual = nuevoPropietarioMSPID;
            this._agregarHistorial(ctx, medicamento, actorMSPID, 'TRANSFERIDO_A_LOGISTICA', 'En Tránsito');

        } else if (medicamento.estadoActual === Estado.ALMACENADO_LOGISTICA) {
            medicamento.estadoActual = Estado.EN_TRANSITO_LOGISTICA_A_SALUD;
            medicamento.propietarioActual = nuevoPropietarioMSPID;
            this._agregarHistorial(ctx, medicamento, actorMSPID, 'TRANSFERIDO_A_SALUD', 'En Tránsito');
        } else {
            throw new Error(`Error de estado: no se puede transferir un activo en estado '${Estado[medicamento.estadoActual]}'`);
        }

        await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(medicamento)));
    }

    public async Recibir(ctx: Context, assetID: string, ubicacion: string): Promise<void> {
        const medicamento = await this._getMedicamento(ctx, assetID);
        const actorMSPID = this._getMSPID(ctx);

        if (actorMSPID !== medicamento.propietarioActual) {
            throw new Error(`Transacción no autorizada: solo el nuevo propietario (${medicamento.propietarioActual}) puede recibir`);
        }

        // Lógica DTE
        if (medicamento.estadoActual === Estado.EN_TRANSITO_LAB_A_LOGISTICA) {
            medicamento.estadoActual = Estado.ALMACENADO_LOGISTICA;
            this._agregarHistorial(ctx, medicamento, actorMSPID, 'RECIBIDO_LOGISTICA', ubicacion);

        } else if (medicamento.estadoActual === Estado.EN_TRANSITO_LOGISTICA_A_SALUD) {
            medicamento.estadoActual = Estado.RECIBIDO_SALUD;
            this._agregarHistorial(ctx, medicamento, actorMSPID, 'RECIBIDO_SALUD', ubicacion);
        } else {
            throw new Error(`Error de estado: no se puede recibir un activo en estado '${Estado[medicamento.estadoActual]}'`);
        }

        await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(medicamento)));
    }

    public async DespacharAPaciente(ctx: Context, assetID: string, idPaciente: string): Promise<void> {

        const medicamento = await this._getMedicamento(ctx, assetID);
        const actorMSPID = this._getMSPID(ctx);

        if (actorMSPID !== 'Org2MSP') {
            throw new Error('Transacción no autorizada: solo OrgSalud (Org2MSP) puede despachar');
        }

        if (medicamento.estadoActual !== Estado.RECIBIDO_SALUD) {
            throw new Error("Error de estado: solo se puede despachar un activo en 'RECIBIDO_SALUD'");
        }

        if (new Date() > new Date(medicamento.fechaVencimiento)) {
            throw new Error(`Error: el medicamento está vencido (${medicamento.fechaVencimiento})`);
        }

        medicamento.estadoActual = Estado.DESPACHADO_PACIENTE;
        medicamento.propietarioActual = 'PACIENTE';
        this._agregarHistorial(ctx, medicamento, actorMSPID, `DESPACHADO_PACIENTE (ID: ${idPaciente})`, 'Farmacia Hospital');

        await ctx.stub.putState(assetID, Buffer.from(JSON.stringify(medicamento)));
    }

    // --- Consultas ---
    public async ConsultarActivo(ctx: Context, assetID: string): Promise<string> {
        const medicamentoBytes = await ctx.stub.getState(assetID);
        if (!medicamentoBytes || medicamentoBytes.length === 0) {
            throw new Error(`El activo ${assetID} no existe`);
        }
        return medicamentoBytes.toString();
    }

    public async ConsultarHistorial(ctx: Context, assetID: string): Promise<string> {
        const iterator = await ctx.stub.getHistoryForKey(assetID);
        const historial = [];

        let result = await iterator.next();
        while (!result.done) {
            if (result.value) {
                console.log('Historial raw:', result.value);
                const txValue = result.value.value.toString();
                let valor: any;
                try {
                    valor = JSON.parse(txValue);
                } catch (err) {
                    valor = txValue;
                }

                const ts =
                    result.value.timestamp &&
                        typeof result.value.timestamp.seconds === 'number'
                        ? new Date(result.value.timestamp.seconds * 1000).toISOString()
                        : null;

                const registro = {
                    txId: result.value.txId,
                    timestamp: ts,
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
    public async ConsultarTodosLosMedicamentos(ctx: Context): Promise<string> {
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
                } catch (err) {
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

// Exportar la lista de contratos
export const contracts = [PharmaLedger];