'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.Estado = void 0;
var Estado;
(function (Estado) {
    Estado[Estado["CREADO"] = 0] = "CREADO";
    Estado[Estado["EN_TRANSITO_LAB_A_LOGISTICA"] = 1] = "EN_TRANSITO_LAB_A_LOGISTICA";
    Estado[Estado["ALMACENADO_LOGISTICA"] = 2] = "ALMACENADO_LOGISTICA";
    Estado[Estado["EN_TRANSITO_LOGISTICA_A_SALUD"] = 3] = "EN_TRANSITO_LOGISTICA_A_SALUD";
    Estado[Estado["RECIBIDO_SALUD"] = 4] = "RECIBIDO_SALUD";
    Estado[Estado["DESPACHADO_PACIENTE"] = 5] = "DESPACHADO_PACIENTE";
})(Estado || (exports.Estado = Estado = {}));
//# sourceMappingURL=medicamento.js.map