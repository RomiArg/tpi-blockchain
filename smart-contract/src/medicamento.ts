'use strict';

export enum Estado {
  CREADO,
  EN_TRANSITO_LAB_A_LOGISTICA,
  ALMACENADO_LOGISTICA,
  EN_TRANSITO_LOGISTICA_A_SALUD,
  RECIBIDO_SALUD,
  DESPACHADO_PACIENTE,
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