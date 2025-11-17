import { Estado } from "./estado";

export interface Medicamento {
    assetID: string;
    nombreComercial: string;
    lote: string;
    fechaFabricacion: string;
    fechaVencimiento: string;
    estadoActual: Estado;
    propietarioActualID: string; // <-- (MODIFICADO) Ej: "Admin@org1.example.com"
    propietarioActualMSPID: string; // <-- (NUEVO) Ej: "Org1MSP"
    historialDeCustodia: any[];
    docType?: string;
}
