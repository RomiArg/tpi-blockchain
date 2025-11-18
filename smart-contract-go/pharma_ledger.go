package main

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// PharmaLedger define el contrato inteligente
type PharmaLedger struct {
	contractapi.Contract
}


const (
	CREADO                         = "CREADO"
	EN_TRANSITO_LAB_A_LOGISTICA    = "EN_TRANSITO_LAB_A_LOGISTICA"
	ALMACENADO_LOGISTICA           = "ALMACENADO_LOGISTICA"
	EN_TRANSITO_LOGISTICA_A_SALUD  = "EN_TRANSITO_LOGISTICA_A_SALUD"
	RECIBIDO_SALUD                 = "RECIBIDO_SALUD"
	DESPACHADO_A_PACIENTE          = "DESPACHADO_A_PACIENTE"
)


type RegistroHistorial struct {
	Timestamp string `json:"timestamp"`
	Actor     string `json:"actor"` // ID de usuario (ej. Admin@org1.example.com)
	Accion    string `json:"accion"`
	Ubicacion string `json:"ubicacion"`
}


type Medicamento struct {
	AssetID                string              `json:"assetID"`
	NombreComercial        string              `json:"nombreComercial"`
	Lote                   string              `json:"lote"`
	FechaFabricacion       string              `json:"fechaFabricacion"`
	FechaVencimiento       string              `json:"fechaVencimiento"`
	PropietarioActualID    string              `json:"propietarioActualID"`    // Ej: "Admin@org1.example.com"
	PropietarioActualMSPID string              `json:"propietarioActualMSPID"` // Ej: "Org1MSP"
	EstadoActual           string              `json:"estadoActual"`
	UbicacionActual        string              `json:"ubicacionActual"`
	PacienteID             string              `json:"pacienteID"`
	HistorialDeCustodia    []RegistroHistorial `json:"historialDeCustodia"` 
	DocType                string              `json:"docType,omitempty"`     
	Timestamp              time.Time           `json:"timestamp"`
}


type Actor struct {
	ID    string
	MSPID string
}

func (s *PharmaLedger) getActor(ctx contractapi.TransactionContextInterface) (*Actor, error) {

	// 1. Obtener el certificado X.509 completo del cliente que llama
	cert, err := ctx.GetClientIdentity().GetX509Certificate()
	if err != nil {
		return nil, fmt.Errorf("fallo al obtener el certificado X509 del cliente: %v", err)
	}

	// 2. Extraer el "Common Name" (CN) del certificado.
	// Para los certificados de cryptogen, esto será "Admin@org1.example.com" o "User1@org1.example.com"
	actorID := cert.Subject.CommonName
	
	// 3. Obtener el MSPID
	actorMSPID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return nil, fmt.Errorf("fallo al obtener el MSPID del cliente: %v", err)
	}

	return &Actor{ID: actorID, MSPID: actorMSPID}, nil
}


func (s *PharmaLedger) InitLedger(ctx contractapi.TransactionContextInterface) error {
	log.Println("--- InitLedger INVOCADO ---")

	txTimestamp, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return fmt.Errorf("Error al obtener timestamp: %v", err)
	}

	txTime := time.Unix(txTimestamp.GetSeconds(), int64(txTimestamp.GetNanos())).Format(time.RFC3339)

	actorID := "Admin@org1.example.com"
	actorMSPID := "Org1MSP"

	medicamentosIniciales := []Medicamento{
		{
			AssetID:                "MED-1001",
			NombreComercial:        "DrogaOncologica-A",
			Lote:                   "LOTE-001",
			FechaFabricacion:       "2025-01-10T10:00:00Z",
			FechaVencimiento:       "2026-01-10T10:00:00Z",
			EstadoActual:           CREADO,
			PropietarioActualID:    actorID,
			PropietarioActualMSPID: actorMSPID,
			UbicacionActual:        "Planta de Producción",
			PacienteID:             "",                     
			HistorialDeCustodia: []RegistroHistorial{
				{
					Timestamp: txTime,
					Actor:     actorID, // (Corregido)
					Accion:    "CREADO",
					Ubicacion: "Planta de Producción",
				},
			},
			DocType: "Medicamento",
		},
		{
			AssetID:                "MED-1002",
			NombreComercial:        "DrogaInmunologica-B",
			Lote:                   "LOTE-002",
			FechaFabricacion:       "2025-02-15T10:00:00Z",
			FechaVencimiento:       "2026-02-15T10:00:00Z",
			EstadoActual:           CREADO,
			PropietarioActualID:    actorID,
			PropietarioActualMSPID: actorMSPID,
			UbicacionActual:        "Planta de Producción",
			PacienteID:             "",                   
			HistorialDeCustodia: []RegistroHistorial{
				{
					Timestamp: txTime,
					Actor:     actorID,
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


func (s *PharmaLedger) agregarHistorial(ctx contractapi.TransactionContextInterface, medicamento *Medicamento, actorID string, accion string, ubicacion string) error {
	txTimestamp, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return fmt.Errorf("Error al obtener timestamp: %v", err)
	}

	txTime := time.Unix(txTimestamp.GetSeconds(), int64(txTimestamp.GetNanos())).Format(time.RFC3339)

	registro := RegistroHistorial{
		Timestamp: txTime,
		Actor:     actorID, // (Corregido)
		Accion:    accion,
		Ubicacion: ubicacion,
	}
	medicamento.HistorialDeCustodia = append(medicamento.HistorialDeCustodia, registro)
	return nil
}

// --- FUNCIONES DE LÓGICA DE NEGOCIO ---


func (s *PharmaLedger) getMedicamento(ctx contractapi.TransactionContextInterface, assetID string) (*Medicamento, error) {
	medicamentoJSON, err := ctx.GetStub().GetState(assetID)
	if err != nil {
		return nil, fmt.Errorf("fallo al leer el activo %s: %v", assetID, err)
	}
	if medicamentoJSON == nil {
		return nil, fmt.Errorf("el medicamento con ID %s no existe", assetID)
	}

	var medicamento Medicamento
	err = json.Unmarshal(medicamentoJSON, &medicamento)
	if err != nil {
		return nil, err
	}
	return &medicamento, nil
}

// assetExists: Comprueba si un activo ya existe en el ledger
func (s *PharmaLedger) assetExists(ctx contractapi.TransactionContextInterface, assetID string) (bool, error) {
	medicamentoJSON, err := ctx.GetStub().GetState(assetID)
	if err != nil {
		return false, fmt.Errorf("fallo al leer del ledger: %v", err)
	}
	return medicamentoJSON != nil, nil
}

// CrearMedicamento: Crea un nuevo activo de medicamento
func (s *PharmaLedger) CrearMedicamento(ctx contractapi.TransactionContextInterface, assetID, nombreComercial, lote, fechaFabricacion, fechaVencimiento string) error {

	actor, err := s.getActor(ctx)
	if err != nil {
		return err
	}
	fmt.Printf("[LOG] CrearMedicamento: Llamado por ID [%s], MSPID [%s]\n", actor.ID, actor.MSPID)

	existe, err := s.assetExists(ctx, assetID)
	if err != nil {
		return err
	}
	if existe {
		return fmt.Errorf("el medicamento con ID %s ya existe", assetID)
	}

	// Validación de Rol (Laboratorio)
	if actor.ID != "Admin@org1.example.com" {
		return fmt.Errorf("transacción no autorizada: solo el Admin de Org1 (Laboratorio) puede crear medicamentos. Actor: %s", actor.ID)
	}

	medicamento := Medicamento{
		AssetID:                assetID,
		NombreComercial:        nombreComercial,
		Lote:                   lote,
		FechaFabricacion:       fechaFabricacion,
		FechaVencimiento:       fechaVencimiento,
		PropietarioActualID:    actor.ID,
		PropietarioActualMSPID: actor.MSPID,
		EstadoActual:           CREADO,
		UbicacionActual:        "Planta de Laboratorio",
		PacienteID:             "",                      
		HistorialDeCustodia:    []RegistroHistorial{}, // Inicializa vacío
		DocType:                "Medicamento",
		Timestamp:              time.Now(), // Este timestamp es del shim, no del tx
	}

	// Agrega el primer registro al historial
	err = s.agregarHistorial(ctx, &medicamento, actor.ID, "CREADO", "Planta de Laboratorio")
	if err != nil {
		return err
	}

	medJSON, err := json.Marshal(medicamento)
	if err != nil {
		return err
	}

	fmt.Printf("[LOG] CrearMedicamento: Éxito. Guardando estado para [%s]\n", assetID)
	return ctx.GetStub().PutState(assetID, medJSON)
}

// Transferir: Transfiere la propiedad de un medicamento
func (s *PharmaLedger) Transferir(ctx contractapi.TransactionContextInterface, assetID string, nuevoPropietarioID string, nuevoPropietarioMSPID string) error {

	actor, err := s.getActor(ctx)
	if err != nil {
		return err
	}
	fmt.Printf("[LOG] Transferir: Llamado por [%s] para transferir AssetID [%s] a [%s]\n", actor.ID, assetID, nuevoPropietarioID)

	medicamento, err := s.getMedicamento(ctx, assetID)
	if err != nil {
		return err
	}

	// Validación: Solo el propietario (ID) actual puede transferir
	if actor.ID != medicamento.PropietarioActualID {
		return fmt.Errorf("transacción no autorizada: solo el propietario actual (%s) puede transferir. Actor: %s", medicamento.PropietarioActualID, actor.ID)
	}

	var accion string
	var ubicacion string

	// Lógica de Máquina de Estados
	switch medicamento.EstadoActual {
	case CREADO:
		// Laboratorio (Admin@org1) -> Logística (Admin@org2)
		if nuevoPropietarioID != "Admin@org2.example.com" {
			return fmt.Errorf("transferencia inválida: desde CREADO solo se puede transferir a Logistica (Admin@org2)")
		}
		medicamento.EstadoActual = EN_TRANSITO_LAB_A_LOGISTICA
		accion = "TRANSFERIDO_A_LOGISTICA"
		ubicacion = "En Tránsito (Laboratorio a Logística)"
	case ALMACENADO_LOGISTICA:
		// Logística (Admin@org2) -> Salud (User1@org2)
		if nuevoPropietarioID != "User1@org2.example.com" {
			return fmt.Errorf("transferencia inválida: desde ALMACENADO_LOGISTICA solo se puede transferir a Salud (User1@org2)")
		}
		medicamento.EstadoActual = EN_TRANSITO_LOGISTICA_A_SALUD
		accion = "TRANSFERIDO_A_SALUD"
		ubicacion = "En Tránsito (Logística a Salud)"
	default:
		return fmt.Errorf("estado inválido: no se puede transferir un activo en estado '%s'", medicamento.EstadoActual)
	}

	medicamento.PropietarioActualID = nuevoPropietarioID
	medicamento.PropietarioActualMSPID = nuevoPropietarioMSPID
	medicamento.UbicacionActual = ubicacion
	medicamento.Timestamp = time.Now()

	// Agrega al historial
	err = s.agregarHistorial(ctx, medicamento, actor.ID, accion, ubicacion)
	if err != nil {
		return err
	}

	medJSON, err := json.Marshal(medicamento)
	if err != nil {
		return err
	}

	fmt.Printf("[LOG] Transferir: Éxito. Nuevo propietario de [%s] es [%s]\n", assetID, nuevoPropietarioID)
	return ctx.GetStub().PutState(assetID, medJSON)
}

// Recibir: Confirma la recepción de un medicamento
func (s *PharmaLedger) Recibir(ctx contractapi.TransactionContextInterface, assetID string, ubicacion string) error {

	actor, err := s.getActor(ctx)
	if err != nil {
		return err
	}
	fmt.Printf("[LOG] Recibir: Llamado por [%s] para recibir AssetID [%s]\n", actor.ID, assetID)

	medicamento, err := s.getMedicamento(ctx, assetID)
	if err != nil {
		return err
	}

	// Validación: Solo el ID propietario puede recibir
	if actor.ID != medicamento.PropietarioActualID {
		fmt.Printf("[ERROR] Recibir: Fallo de autorización. Actor: [%s], Propietario requerido: [%s]\n", actor.ID, medicamento.PropietarioActualID)
		return fmt.Errorf("transacción no autorizada: solo el nuevo propietario (%s) puede recibir. Actor: %s", medicamento.PropietarioActualID, actor.ID)
	}

	var accion string

	// Lógica de Máquina de Estados
	switch medicamento.EstadoActual {
	case EN_TRANSITO_LAB_A_LOGISTICA:
		// Recibe Logística (Admin@org2)
		if actor.ID != "Admin@org2.example.com" {
			return fmt.Errorf("actor inválido para recibir: se esperaba Logistica (Admin@org2)")
		}
		medicamento.EstadoActual = ALMACENADO_LOGISTICA
		accion = "RECIBIDO_LOGISTICA"
	case EN_TRANSITO_LOGISTICA_A_SALUD:
		// Recibe Salud (User1@org2)
		if actor.ID != "User1@org2.example.com" {
			return fmt.Errorf("actor inválido para recibir: se esperaba Salud (User1@org2)")
		}
		medicamento.EstadoActual = RECIBIDO_SALUD
		accion = "RECIBIDO_SALUD"
	default:
		return fmt.Errorf("estado inválido: no se puede recibir un activo en estado '%s'", medicamento.EstadoActual)
	}

	medicamento.UbicacionActual = ubicacion
	medicamento.Timestamp = time.Now()

	// Agrega al historial
	err = s.agregarHistorial(ctx, medicamento, actor.ID, accion, ubicacion)
	if err != nil {
		return err
	}

	medJSON, err := json.Marshal(medicamento)
	if err != nil {
		return err
	}

	fmt.Printf("[LOG] Recibir: Éxito. AssetID [%s] recibido por [%s]\n", assetID, actor.ID)
	return ctx.GetStub().PutState(assetID, medJSON)
}

// DespacharAPaciente: Marca el medicamento como entregado
// src/pharma_ledger.go

func (s *PharmaLedger) DespacharAPaciente(ctx contractapi.TransactionContextInterface, assetID string, pacienteID string) error {

	actor, err := s.getActor(ctx)
	if err != nil {
		return err
	}
	fmt.Printf("[LOG] Despachar: Llamado por [%s] para despachar AssetID [%s]\n", actor.ID, assetID)

	// Validación FINA: Solo Salud (User1@org2.example.com) puede despachar
	if actor.ID != "User1@org2.example.com" {
		return fmt.Errorf("transacción no autorizada: solo Salud (User1@org2.example.com) puede despachar a pacientes. Actor: %s", actor.ID)
	}

	medicamento, err := s.getMedicamento(ctx, assetID)
	if err != nil {
		return err
	}
	
	// Validación FINA: El activo debe estar en posesión de Salud
	if medicamento.PropietarioActualID != "User1@org2.example.com" || medicamento.EstadoActual != RECIBIDO_SALUD {
		return fmt.Errorf("estado inválido: solo se puede despachar un activo en estado 'RECIBIDO_SALUD' y propiedad de Salud")
	}
	
	// Cambiamos el estado Y el propietario
	medicamento.EstadoActual = DESPACHADO_A_PACIENTE
	medicamento.PacienteID = pacienteID
	medicamento.UbicacionActual = "Entregado a Paciente"
	medicamento.PropietarioActualID = pacienteID 
	medicamento.PropietarioActualMSPID = "PACIENTE_FINAL"
	medicamento.Timestamp = time.Now()


	// Agrega al historial
	err = s.agregarHistorial(ctx, medicamento, actor.ID, "DESPACHADO_A_PACIENTE", "Entregado a Paciente")
	if err != nil {
		return err
	}

	medJSON, err := json.Marshal(medicamento)
	if err != nil {
		return err
	}

	fmt.Printf("[LOG] DespacharAPaciente: Éxito. AssetID [%s] entregado a [%s]\n", assetID, pacienteID)
	return ctx.GetStub().PutState(assetID, medJSON)
}

// --- Funciones de Consulta (Lectura) ---

// ConsultarActivo: Obtiene el estado actual de un medicamento
func (s *PharmaLedger) ConsultarActivo(ctx contractapi.TransactionContextInterface, assetID string) (*Medicamento, error) {
	fmt.Printf("[LOG] ConsultarActivo: Consultando AssetID [%s]\n", assetID)
	medicamentoJSON, err := ctx.GetStub().GetState(assetID)
	if err != nil {
		return nil, fmt.Errorf("fallo al leer el activo %s del ledger: %v", assetID, err)
	}
	if medicamentoJSON == nil {
		return nil, fmt.Errorf("el medicamento con ID %s no existe", assetID)
	}

	var medicamento Medicamento
	err = json.Unmarshal(medicamentoJSON, &medicamento)
	if err != nil {
		return nil, err
	}
	return &medicamento, nil
}

// ConsultarTodosLosMedicamentos: Devuelve todos los medicamentos
func (s *PharmaLedger) ConsultarTodosLosMedicamentos(ctx contractapi.TransactionContextInterface) ([]*Medicamento, error) {
	fmt.Println("[LOG] ConsultarTodosLosMedicamentos: Obteniendo todos los activos...")
	resultsIterator, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var medicamentos []*Medicamento
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var medicamento Medicamento
		err = json.Unmarshal(queryResponse.Value, &medicamento)
		if err != nil {
			return nil, err
		}
		medicamentos = append(medicamentos, &medicamento)
	}
	fmt.Printf("[LOG] ConsultarTodosLosMedicamentos: Encontrados [%d] activos\n", len(medicamentos))
	return medicamentos, nil
}

// ConsultarHistorial: Devuelve el historial de un activo
type HistorialActivo struct {
	TxID      string       `json:"txId"`
	Timestamp time.Time    `json:"timestamp"`
	Medicamento *Medicamento `json:"medicamento"`
}

func (s *PharmaLedger) ConsultarHistorial(ctx contractapi.TransactionContextInterface, assetID string) ([]*HistorialActivo, error) {
	fmt.Printf("[LOG] ConsultarHistorial: Obteniendo historial para AssetID [%s]\n", assetID)
	resultsIterator, err := ctx.GetStub().GetHistoryForKey(assetID)
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var historial []*HistorialActivo
	for resultsIterator.HasNext() {
		response, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var medicamento Medicamento
		// Omitir transacciones borradas (IsDelete)
		if !response.IsDelete {
			err = json.Unmarshal(response.Value, &medicamento)
			if err != nil {
				return nil, err
			}
			
			registro := &HistorialActivo{
				TxID:      response.TxId,
				Timestamp: response.Timestamp.AsTime(),
				Medicamento: &medicamento,
			}
			historial = append(historial, registro)
		}
	}
	fmt.Printf("[LOG] ConsultarHistorial: Encontradas [%d] entradas de historial para [%s]\n", len(historial), assetID)
	return historial, nil
}


func main() {
	chaincode, err := contractapi.NewChaincode(&PharmaLedger{})
	if err != nil {
		log.Panicf("Error creando el chaincode PharmaLedger: %v", err)
	}

	if err := chaincode.Start(); err != nil {
		log.Panicf("Error iniciando el chaincode PharmaLedger: %v", err)
	}
}