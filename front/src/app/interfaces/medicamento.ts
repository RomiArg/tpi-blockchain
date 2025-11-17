import { Estado } from "./estado";

export interface Medicamento {
    assetID: string;
    nombreComercial: string;
    lote: string;
    fechaFabricacion: string;
    fechaVencimiento: string;
    estadoActual: Estado;
    propietarioActualID: string;
    propietarioActualMSPID: string;
    historialDeCustodia: any[];
    docType?: string;
}
