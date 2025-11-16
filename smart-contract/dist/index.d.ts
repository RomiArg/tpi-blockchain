import { Context, Contract } from 'fabric-contract-api';
export declare class PharmaLedger extends Contract {
    constructor();
    private _getMSPID;
    private _agregarHistorial;
    private _getMedicamento;
    /**
     * InitLedger: Se llama una sola vez al desplegar el chaincode.
     * Carga un conjunto inicial de medicamentos en el ledger.
     */
    InitLedger(ctx: Context): Promise<void>;
    CrearMedicamento(ctx: Context, assetID: string, nombreComercial: string, lote: string, fechaFabricacionStr: string, fechaVencimientoStr: string): Promise<void>;
    Transferir(ctx: Context, assetID: string, nuevoPropietarioMSPID: string): Promise<void>;
    Recibir(ctx: Context, assetID: string, ubicacion: string): Promise<void>;
    DespacharAPaciente(ctx: Context, assetID: string, idPaciente: string): Promise<void>;
    ConsultarActivo(ctx: Context, assetID: string): Promise<string>;
    ConsultarHistorial(ctx: Context, assetID: string): Promise<string>;
    /**
     * ConsultarTodosLosMedicamentos: Devuelve todos los activos con docType 'Medicamento'.
     */
    ConsultarTodosLosMedicamentos(ctx: Context): Promise<string>;
}
export declare const contracts: (typeof PharmaLedger)[];
