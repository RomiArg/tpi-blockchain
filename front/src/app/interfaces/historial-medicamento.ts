import { Medicamento } from "./medicamento";

export interface HistorialMedicamento {
    txId: string;
    timestamp: string;
    medicamento: Medicamento;
    isDelete: boolean;
}