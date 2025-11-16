export enum Estado {
    CREADO,
    EN_TRANSITO_LAB_A_LOGISTICA,
    ALMACENADO_LOGISTICA,
    EN_TRANSITO_LOGISTICA_A_SALUD,
    RECIBIDO_SALUD,
    DESPACHADO_PACIENTE,
}

export const EstadoMap: Record<number, string> = {
    [Estado.CREADO]: 'Creado en Laboratorio',
    [Estado.EN_TRANSITO_LAB_A_LOGISTICA]: 'En Tránsito (Logística)',
    [Estado.ALMACENADO_LOGISTICA]: 'Almacenado (Logística)',
    [Estado.EN_TRANSITO_LOGISTICA_A_SALUD]: 'En Tránsito (Hospital)',
    [Estado.RECIBIDO_SALUD]: 'Recibido en Hospital',
    [Estado.DESPACHADO_PACIENTE]: 'Despachado a Paciente',
};