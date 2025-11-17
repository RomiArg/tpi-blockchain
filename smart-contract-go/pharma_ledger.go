package main

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
	// "github.com/hyperledger/fabric-protos-go/ledger/queryresult"
)

// --- Estructuras de Datos ---
type Estado int

const (
	CREADO Estado = iota
	EN_TRANSITO_LAB_A_LOGISTICA
	ALMACENADO_LOGISTICA
	EN_TRANSITO_LOGISTICA_A_SALUD
	RECIBIDO_SALUD
	DESPACHADO_PACIENTE
)

func (e Estado) String() string {
	return [...]string{
		"CREADO",
		"EN_TRANSITO_LAB_A_LOGISTICA",
		"ALMACENADO_LOGISTICA",
		"EN_TRANSITO_LOGISTICA_A_SALUD",
		"RECIBIDO_SALUD",
		"DESPACHADO_PACIENTE",
	}[e]
}

// RegistroHistorial define la estructura del historial
type RegistroHistorial struct {
	Timestamp string `json:"timestamp"`
	Actor     string `json:"actor"`
	Accion    string `json:"accion"`
	Ubicacion string `json:"ubicacion"`
}

// Medicamento define la estructura principal del activo
type Medicamento struct {
	DocType             string              `json:"docType"`
	AssetID             string              `json:"assetID"`
	NombreComercial     string              `json:"nombreComercial"`
	Lote                string              `json:"lote"`
	FechaFabricacion    string              `json:"fechaFabricacion"`
	FechaVencimiento    string              `json:"fechaVencimiento"`
	EstadoActual        Estado              `json:"estadoActual"`
	PropietarioActual   string              `json:"propietarioActual"`
	HistorialDeCustodia []RegistroHistorial `json:"historialDeCustodia"`
}

// --- Smart Contract ---

// PharmaLedger define el struct del contrato
type PharmaLedger struct {
	contractapi.Contract
}

// getMSPID obtiene el MSPID del cliente que invoca
func (s *PharmaLedger) getMSPID(ctx contractapi.TransactionContextInterface) (string, error) {
	mspid, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return "", fmt.Errorf("Error al obtener MSPID: %v", err)
	}
	return mspid, nil
}

// getMedicamento obtiene y deserializa un activo del ledger
func (s *PharmaLedger) getMedicamento(ctx contractapi.TransactionContextInterface, assetID string) (*Medicamento, error) {
	medicamentoBytes, err := ctx.GetStub().GetState(assetID)
	if err != nil {
		return nil, fmt.Errorf("Error al leer el activo %s: %v", assetID, err)
	}
	if medicamentoBytes == nil {
		return nil, fmt.Errorf("El activo %s no existe", assetID)
	}

	var medicamento Medicamento
	err = json.Unmarshal(medicamentoBytes, &medicamento)
	if err != nil {
		return nil, fmt.Errorf("Error al deserializar el activo %s: %v", assetID, err)
	}
	return &medicamento, nil
}

// agregarHistorial añade un nuevo registro al historial de custodia
func (s *PharmaLedger) agregarHistorial(ctx contractapi.TransactionContextInterface, medicamento *Medicamento, actorMSPID string, accion string, ubicacion string) error {
	txTimestamp, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return fmt.Errorf("Error al obtener timestamp: %v", err)
	}

	txTime := time.Unix(txTimestamp.GetSeconds(), int64(txTimestamp.GetNanos())).Format(time.RFC3339)

	registro := RegistroHistorial{
		Timestamp: txTime,
		Actor:     actorMSPID,
		Accion:    accion,
		Ubicacion: ubicacion,
	}
	medicamento.HistorialDeCustodia = append(medicamento.HistorialDeCustodia, registro)
	return nil
}

// InitLedger carga los datos iniciales
func (s *PharmaLedger) InitLedger(ctx contractapi.TransactionContextInterface) error {
	log.Println("============= INICIANDO: Carga de datos iniciales (InitLedger) =============")

	txTimestamp, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return fmt.Errorf("Error al obtener timestamp: %v", err)
	}

	txTime := time.Unix(txTimestamp.GetSeconds(), int64(txTimestamp.GetNanos())).Format(time.RFC3339)

	medicamentosIniciales := []Medicamento{
		{
			AssetID:             "MED-1001",
			NombreComercial:     "DrogaOncologica-A",
			Lote:                "LOTE-001",
			FechaFabricacion:    "2025-01-10T10:00:00Z",
			FechaVencimiento:    "2026-01-10T10:00:00Z",
			EstadoActual:        CREADO,
			PropietarioActual:   "Org1MSP",
			HistorialDeCustodia: []RegistroHistorial{
				{
					Timestamp: txTime,
					Actor:     "Org1MSP",
					Accion:    "CREADO",
					Ubicacion: "Planta de Producción",
				},
			},
			DocType: "Medicamento",
		},
		{
			AssetID:             "MED-1002",
			NombreComercial:     "DrogaInmunologica-B",
			Lote:                "LOTE-002",
			FechaFabricacion:    "2025-02-15T10:00:00Z",
			FechaVencimiento:    "2026-02-15T10:00:00Z",
			EstadoActual:        CREADO,
			PropietarioActual:   "Org1MSP",
			HistorialDeCustodia: []RegistroHistorial{
				{
					Timestamp: txTime,
					Actor:     "Org1MSP",
					Accion:    "CREADO",
					Ubicacion: "Planta de Producción",
				},
			},
			DocType: "Medicamento",
		},
	}

	for _, med := range medicamentosIniciales {
		medicamentoJSON, err := json.Marshal(med)
		if err != nil {
			return fmt.Errorf("Error al serializar medicamento %s: %v", med.AssetID, err)
		}
		err = ctx.GetStub().PutState(med.AssetID, medicamentoJSON)
		if err != nil {
			return fmt.Errorf("Error al guardar activo %s: %v", med.AssetID, err)
		}
		log.Printf("Activo %s inicializado", med.AssetID)
	}

	log.Println("============= COMPLETADO: Carga de datos iniciales =============")
	return nil
}

// CrearMedicamento crea un nuevo activo
func (s *PharmaLedger) CrearMedicamento(ctx contractapi.TransactionContextInterface, assetID string, nombreComercial string, lote string, fechaFabricacionStr string, fechaVencimientoStr string) error {
	actorMSPID, err := s.getMSPID(ctx)
	if err != nil { return err }

	if actorMSPID != "Org1MSP" {
		return fmt.Errorf("Transacción no autorizada: solo OrgLaboratorio (Org1MSP) puede crear medicamentos")
	}

	assetExists, err := ctx.GetStub().GetState(assetID)
	if err != nil {
		return fmt.Errorf("Error al verificar existencia de %s: %v", assetID, err)
	}
	if assetExists != nil {
		return fmt.Errorf("Error: el assetID '%s' ya existe", assetID)
	}

	_, err = time.Parse(time.RFC3339, fechaFabricacionStr)
	if err != nil {
		return fmt.Errorf("Formato de fechaFabricacion inválido: %v", err)
	}
	_, err = time.Parse(time.RFC3339, fechaVencimientoStr)
	if err != nil {
		return fmt.Errorf("Formato de fechaVencimiento inválido: %v", err)
	}

	medicamento := Medicamento{
		DocType:             "Medicamento",
		AssetID:             assetID,
		NombreComercial:     nombreComercial,
		Lote:                lote,
		FechaFabricacion:    fechaFabricacionStr,
		FechaVencimiento:    fechaVencimientoStr,
		EstadoActual:        CREADO,
		PropietarioActual:   actorMSPID,
		HistorialDeCustodia: []RegistroHistorial{},
	}

	err = s.agregarHistorial(ctx, &medicamento, actorMSPID, "CREADO", "Planta de Producción")
	if err != nil { return err }

	medicamentoJSON, err := json.Marshal(medicamento)
	if err != nil {
		return fmt.Errorf("Error al serializar medicamento: %v", err)
	}

	return ctx.GetStub().PutState(assetID, medicamentoJSON)
}

// Transferir cambia la propiedad y el estado
func (s *PharmaLedger) Transferir(ctx contractapi.TransactionContextInterface, assetID string, nuevoPropietarioMSPID string) error {
	medicamento, err := s.getMedicamento(ctx, assetID)
	if err != nil { return err }

	actorMSPID, err := s.getMSPID(ctx)
	if err != nil { return err }

	if actorMSPID != medicamento.PropietarioActual {
		return fmt.Errorf("Transacción no autorizada: solo el propietario actual (%s) puede transferir", medicamento.PropietarioActual)
	}

	var accion string
	var ubicacion = "En Tránsito"

	switch medicamento.EstadoActual {
	case CREADO:
		medicamento.EstadoActual = EN_TRANSITO_LAB_A_LOGISTICA
		accion = "TRANSFERIDO_A_LOGISTICA"
	case ALMACENADO_LOGISTICA:
		medicamento.EstadoActual = EN_TRANSITO_LOGISTICA_A_SALUD
		accion = "TRANSFERIDO_A_SALUD"
	default:
		return fmt.Errorf("Error de estado: no se puede transferir un activo en estado '%s'", medicamento.EstadoActual.String())
	}

	medicamento.PropietarioActual = nuevoPropietarioMSPID
	err = s.agregarHistorial(ctx, medicamento, actorMSPID, accion, ubicacion)
	if err != nil { return err }

	medicamentoJSON, err := json.Marshal(medicamento)
	if err != nil { return err }

	return ctx.GetStub().PutState(assetID, medicamentoJSON)
}

func (s *PharmaLedger) Recibir(ctx contractapi.TransactionContextInterface, assetID string, ubicacion string) error {
	medicamento, err := s.getMedicamento(ctx, assetID)
	if err != nil { return err }

	actorMSPID, err := s.getMSPID(ctx)
	if err != nil { return err }

	if actorMSPID != medicamento.PropietarioActual {
		return fmt.Errorf("Transacción no autorizada: solo el nuevo propietario (%s) puede recibir", medicamento.PropietarioActual)
	}

	var accion string

	switch medicamento.EstadoActual {
	case EN_TRANSITO_LAB_A_LOGISTICA:
		medicamento.EstadoActual = ALMACENADO_LOGISTICA
		accion = "RECIBIDO_LOGISTICA"
	case EN_TRANSITO_LOGISTICA_A_SALUD:
		medicamento.EstadoActual = RECIBIDO_SALUD
		accion = "RECIBIDO_SALUD"
	default:
		return fmt.Errorf("Error de estado: no se puede recibir un activo en estado '%s'", medicamento.EstadoActual.String())
	}

	err = s.agregarHistorial(ctx, medicamento, actorMSPID, accion, ubicacion)
	if err != nil { return err }

	medicamentoJSON, err := json.Marshal(medicamento)
	if err != nil { return err }

	return ctx.GetStub().PutState(assetID, medicamentoJSON)
}

// DespacharAPaciente marca el final de la cadena de custodia
func (s *PharmaLedger) DespacharAPaciente(ctx contractapi.TransactionContextInterface, assetID string, idPaciente string) error {
	medicamento, err := s.getMedicamento(ctx, assetID)
	if err != nil { return err }

	actorMSPID, err := s.getMSPID(ctx)
	if err != nil { return err }

	if actorMSPID != "Org2MSP" {
		return fmt.Errorf("Transacción no autorizada: solo OrgSalud (Org2MSP) puede despachar")
	}

	if medicamento.EstadoActual != RECIBIDO_SALUD {
		return fmt.Errorf("Error de estado: solo se puede despachar un activo en 'RECIBIDO_SALUD'")
	}

	fechaVencimiento, err := time.Parse(time.RFC3339, medicamento.FechaVencimiento)
	if err != nil {
		return fmt.Errorf("Error al parsear fecha de vencimiento: %v", err)
	}

	if time.Now().After(fechaVencimiento) {
		return fmt.Errorf("Error: el medicamento está vencido (%s)", medicamento.FechaVencimiento)
	}

	medicamento.EstadoActual = DESPACHADO_PACIENTE
	medicamento.PropietarioActual = "PACIENTE"
	accion := fmt.Sprintf("DESPACHADO_PACIENTE (ID: %s)", idPaciente)

	err = s.agregarHistorial(ctx, medicamento, actorMSPID, accion, "Farmacia Hospital")
	if err != nil { return err }

	medicamentoJSON, err := json.Marshal(medicamento)
	if err != nil { return err }

	return ctx.GetStub().PutState(assetID, medicamentoJSON)
}

// ConsultarActivo devuelve el estado actual de un activo
func (s *PharmaLedger) ConsultarActivo(ctx contractapi.TransactionContextInterface, assetID string) (string, error) {
	medicamentoBytes, err := ctx.GetStub().GetState(assetID)
	if err != nil {
		return "", fmt.Errorf("Error al leer el activo %s: %v", assetID, err)
	}
	if medicamentoBytes == nil {
		return "", fmt.Errorf("El activo %s no existe", assetID)
	}

	return string(medicamentoBytes), nil
}

// ConsultarHistorial devuelve el historial de un activo
type HistorialRegistro struct {
	TxID      string      `json:"txId"`
	Timestamp string      `json:"timestamp"`
	Valor     interface{} `json:"valor"`
	IsDelete  bool        `json:"isDelete"`
}

func (s *PharmaLedger) ConsultarHistorial(ctx contractapi.TransactionContextInterface, assetID string) (string, error) {
	resultsIterator, err := ctx.GetStub().GetHistoryForKey(assetID)
	if err != nil {
		return "", fmt.Errorf("Error al obtener historial: %v", err)
	}
	defer resultsIterator.Close()

	var historial []*HistorialRegistro
	for resultsIterator.HasNext() {
		response, err := resultsIterator.Next()
		if err != nil {
			return "", fmt.Errorf("Error al iterar historial: %v", err)
		}

		var valor interface{}
		if response.Value != nil {
			var med Medicamento
			if json.Unmarshal(response.Value, &med) == nil {
				valor = med
			} else {
				valor = string(response.Value)
			}
		}

		txTime := time.Unix(response.Timestamp.GetSeconds(), int64(response.Timestamp.GetNanos())).Format(time.RFC3339)

		registro := &HistorialRegistro{
			TxID:      response.TxId,
			Timestamp: txTime,
			Valor:     valor,
			IsDelete:  response.IsDelete,
		}
		historial = append(historial, registro)
	}

	historialJSON, err := json.Marshal(historial)
	if err != nil {
		return "", fmt.Errorf("Error al serializar historial: %v", err)
	}
	return string(historialJSON), nil
}


// ConsultarTodosLosMedicamentos devuelve todos los activos con docType 'Medicamento'
func (s *PharmaLedger) ConsultarTodosLosMedicamentos(ctx contractapi.TransactionContextInterface) (string, error) {
	queryString := `{"selector":{"docType":"Medicamento"}}`

	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return "", fmt.Errorf("Error al ejecutar query: %v", err)
	}
	defer resultsIterator.Close()

	var allResults []*Medicamento

	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return "", fmt.Errorf("Error al iterar resultados: %v", err)
		}

		var med Medicamento
		err = json.Unmarshal(queryResponse.Value, &med)
		if err != nil {
			log.Printf("Advertencia: omitiendo resultado no deserializable: %v", err)
			continue
		}
		allResults = append(allResults, &med)
	}

	resultsJSON, err := json.Marshal(allResults)
	if err != nil {
		return "", fmt.Errorf("Error al serializar resultados: %v", err)
	}

	return string(resultsJSON), nil
}

// --- Main ---
// Punto de entrada del Chaincode
func main() {
	chaincode, err := contractapi.NewChaincode(&PharmaLedger{})
	if err != nil {
		log.Panicf("Error creando chaincode PharmaLedger: %v", err)
	}

	if err := chaincode.Start(); err != nil {
		log.Panicf("Error iniciando chaincode PharmaLedger: %v", err)
	}
}