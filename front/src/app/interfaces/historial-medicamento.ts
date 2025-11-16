import { Medicamento } from "./medicamento";

export interface HistorialMedicamento {
    txId: string;
    timestamp: string;
    valor: Medicamento;
    isDelete: boolean;
}