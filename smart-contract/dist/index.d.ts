import { Context, Contract } from 'fabric-contract-api';
export declare class PharmaLedger extends Contract {
    constructor();
    private _getMSPID;
    private _agregarHistorial;
    private _getMedicamento;
    CrearMedicamento(ctx: Context, assetID: string, nombreComercial: string, lote: string, fechaFabricacionStr: string, fechaVencimientoStr: string): Promise<void>;
    Transferir(ctx: Context, assetID: string, nuevoPropietarioMSPID: string): Promise<void>;
    Recibir(ctx: Context, assetID: string, ubicacion: string): Promise<void>;
    DespacharAPaciente(ctx: Context, assetID: string, idPaciente: string): Promise<void>;
    ConsultarActivo(ctx: Context, assetID: string): Promise<string>;
    ConsultarHistorial(ctx: Context, assetID: string): Promise<string>;
}
export declare const contracts: (typeof PharmaLedger)[];
