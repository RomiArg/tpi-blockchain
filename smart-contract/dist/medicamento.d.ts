export declare enum Estado {
    CREADO = 0,
    EN_TRANSITO_LAB_A_LOGISTICA = 1,
    ALMACENADO_LOGISTICA = 2,
    EN_TRANSITO_LOGISTICA_A_SALUD = 3,
    RECIBIDO_SALUD = 4,
    DESPACHADO_PACIENTE = 5
}
export interface RegistroHistorial {
    timestamp: string;
    actor: string;
    accion: string;
    ubicacion: string;
}
/**
 * Define la estructura de datos principal del activo.
 */
export interface Medicamento {
    assetID: string;
    nombreComercial: string;
    lote: string;
    fechaFabricacion: string;
    fechaVencimiento: string;
    estadoActual: Estado;
    propietarioActual: string;
    historialDeCustodia: RegistroHistorial[];
    docType?: string;
}
