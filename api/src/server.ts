'use strict';
import express, { Request, Response } from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import * as grpc from '@grpc/grpc-js';
import { connect, Contract, GrpcClient, Identity, Signer, signers } from '@hyperledger/fabric-gateway';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

// Cargar variables de entorno desde .env
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const app = express();
app.use(cors());
app.use(express.json());
const port = 3000;

// --- Constantes de Fabric ---
const channelName = process.env.CHANNEL_NAME || 'mychannel';
const chaincodeName = process.env.CHAINCODE_NAME || 'pharma-ledger';

const contracts = new Map<string, Contract>();
const roleIdentities = new Map<string, string>(); // Almacena el ID (ej. "Admin@org1...") por Rol

// --- Interfaces de Body ---
interface CrearMedicamentoBody {
    assetID: string;
    nombreComercial: string;
    lote: string;
    fechaFabricacion: string;
    fechaVencimiento: string;
}

interface TransaccionActorBody {
    actorRole: string; // El frontend debe enviar 'Laboratorio', 'Logistica', etc.
    nuevoPropietarioRole?: string; // El rol del nuevo propietario
    ubicacion?: string;
    idPaciente?: string;
}

async function loadRole(role: string, mspId: string, certPath: string, keyPath: string, tlsPath: string, peerEndpoint: string, peerAlias: string): Promise<void> {

    // El Keystore es un directorio, necesitamos encontrar el archivo _sk
    const keyFiles = await fs.readdir(keyPath);
    const keyFile = keyFiles.find(file => file.endsWith('_sk'));
    if (!keyFile) {
        throw new Error(`No se encontró archivo _sk en: ${keyPath}`);
    }
    const fullKeyPath = path.resolve(keyPath, keyFile);

    // Conectar al peer
    const client = await newGrpcClient(peerEndpoint, tlsPath, peerAlias);
    const gateway = connect({
        client: client,
        identity: await newIdentity(certPath, mspId),
        signer: await newSigner(fullKeyPath),
    });
    const network = gateway.getNetwork(channelName);
    const contract = network.getContract(chaincodeName);

    contracts.set(role, contract); // Guardamos el contrato por Rol (ej. "Laboratorio")
    console.log(`✅ Conexión como Rol [${role}] establecida.`);
}

/**
 * (MODIFICADO) Inicializa AMBAS conexiones de Fabric
 */
async function initializeFabric(): Promise<void> {
    try {
        console.log('Inicializando 4 conexiones de roles...');

        await loadRole(
            'Laboratorio',
            process.env.ROLE_LABORATORIO_MSPID!,
            process.env.ROLE_LABORATORIO_CERT_PATH!,
            process.env.ROLE_LABORATORIO_KEY_PATH!,
            process.env.ROLE_LABORATORIO_TLS_PATH!,
            process.env.PEER_ENDPOINT_ORG1!,
            process.env.PEER_HOST_ALIAS_ORG1!
        );

        await loadRole(
            'Regulador',
            process.env.ROLE_REGULADOR_MSPID!,
            process.env.ROLE_REGULADOR_CERT_PATH!,
            process.env.ROLE_REGULADOR_KEY_PATH!,
            process.env.ROLE_REGULADOR_TLS_PATH!,
            process.env.PEER_ENDPOINT_ORG1!,
            process.env.PEER_HOST_ALIAS_ORG1!
        );

        await loadRole(
            'Logistica',
            process.env.ROLE_LOGISTICA_MSPID!,
            process.env.ROLE_LOGISTICA_CERT_PATH!,
            process.env.ROLE_LOGISTICA_KEY_PATH!,
            process.env.ROLE_LOGISTICA_TLS_PATH!,
            process.env.PEER_ENDPOINT_ORG2!,
            process.env.PEER_HOST_ALIAS_ORG2!
        );

        await loadRole(
            'Salud',
            process.env.ROLE_SALUD_MSPID!,
            process.env.ROLE_SALUD_CERT_PATH!,
            process.env.ROLE_SALUD_KEY_PATH!,
            process.env.ROLE_SALUD_TLS_PATH!,
            process.env.PEER_ENDPOINT_ORG2!,
            process.env.PEER_HOST_ALIAS_ORG2!
        );

        // Mapeamos ID de usuario por Rol (para pasarlo al chaincode)
        roleIdentities.set('Laboratorio', process.env.ROLE_LABORATORIO_ID!);
        roleIdentities.set('Regulador', process.env.ROLE_REGULADOR_ID!);
        roleIdentities.set('Logistica', process.env.ROLE_LOGISTICA_ID!);
        roleIdentities.set('Salud', process.env.ROLE_SALUD_ID!);

        // Verificamos InitLedger (usando el rol Laboratorio)
        const contractLaboratorio = contracts.get('Laboratorio');
        if (!contractLaboratorio) throw new Error('Falló la carga del rol Laboratorio');

        console.log('Verificando datos iniciales (seeding)...');
        await contractLaboratorio.evaluateTransaction('ConsultarActivo', 'MED-1001');
        console.log('✅ Datos iniciales ya existen.');

    } catch (error: any) {
        if (error.message.includes('no existe')) {
            console.log('Datos iniciales no encontrados. Ejecutando InitLedger...');
            await contracts.get('Laboratorio')!.submitTransaction('InitLedger');
            console.log('✅ Datos iniciales creados (InitLedger).');
        } else {
            console.error('******** FALLÓ LA INICIALIZACIÓN DE FABRIC:');
            console.error(error);
            process.exit(1);
        }
    }
}

/**
 * (NUEVO) Helper para seleccionar el contrato (identidad) correcto.
 * Esta es la "magia" que soluciona tu problema.
 */
function getContractForRole(role: string): Contract {
    const contract = contracts.get(role);
    if (!contract) {
        throw new Error(`Rol desconocido: ${role}. No se puede seleccionar contrato.`);
    }
    console.log(`[LOG API] Usando identidad del Rol [${role}]`);
    return contract;
}


// --- Endpoints de la API (Modificados) ---

// Las consultas (GET) pueden usar cualquier contrato (usamos Org1 por simplicidad)
app.get('/api/medicamentos', async (req: Request, res: Response) => {
    try {
        console.log('[LOG API] Recibida petición GET /api/medicamentos (todos)');
        // Cualquiera puede consultar, usamos Laboratorio por defecto
        const contract = getContractForRole('Laboratorio');
        const resultBytes = await contract.evaluateTransaction('ConsultarTodosLosMedicamentos');
        const resultJson = JSON.parse(Buffer.from(resultBytes).toString());
        res.status(200).json(resultJson);

    } catch (error) {
        console.error(`Error al consultar medicamentos: ${error}`);
        res.status(500).json({ error: (error as Error).message });
    }
});

app.get('/api/medicamentos/:id', async (req: Request, res: Response) => {
    try {
        console.log(`[LOG API] Recibida petición GET /api/medicamentos/${req.params.id}`);
        const contract = getContractForRole('Laboratorio');
        const resultBytes = await contract.evaluateTransaction('ConsultarActivo', req.params.id);
        const resultJson = JSON.parse(Buffer.from(resultBytes).toString());
        res.status(200).json(resultJson);
    } catch (error) {
        console.error(`Error al consultar activo: ${error}`);
        res.status(404).json({ error: (error as Error).message });
    }
});

app.get('/api/medicamentos/:id/historial', async (req: Request, res: Response) => {
    try {
        console.log(`[LOG API] Recibida petición GET /api/medicamentos/${req.params.id}/historial`);
        const contract = getContractForRole('Laboratorio');
        const resultBytes = await contract.evaluateTransaction('ConsultarHistorial', req.params.id);
        const resultJson = JSON.parse(Buffer.from(resultBytes).toString());
        res.status(200).json(resultJson);
    } catch (error) {
        console.error(`Error al consultar historial: ${error}`);
        res.status(500).json({ error: (error as Error).message });
    }
});

// --- Endpoints de Transacción (MODIFICADOS para ser dinámicos) ---

app.post('/api/medicamentos', async (req: Request, res: Response) => {
    try {
        const { assetID, nombreComercial, lote, fechaFabricacion, fechaVencimiento } = req.body as CrearMedicamentoBody;
        console.log('[LOG API] Recibida petición POST /api/medicamentos', req.body);
        if (!assetID || !nombreComercial || !lote || !fechaFabricacion || !fechaVencimiento) {
            return res.status(400).json({ error: 'Faltan campos obligatorios' });
        }
        // CrearMedicamento SIEMPRE es Org1 (Laboratorio)
        // Usamos contractOrg1 directamente
        const contract = getContractForRole('Laboratorio');
        await contract.submitTransaction(
            'CrearMedicamento',
            assetID,
            nombreComercial,
            lote,
            fechaFabricacion,
            fechaVencimiento
        );
        res.status(201).json({ status: 'ok', assetID: assetID });
    } catch (error) {
        console.error(`Error al crear medicamento: ${error}`);
        res.status(500).json({ error: (error as Error).message });
    }
});


app.put('/api/medicamentos/:id/transferir', async (req: Request, res: Response) => {
    try {

        const assetID = req.params.id;
        const { nuevoPropietarioRole, actorRole } = req.body as TransaccionActorBody;

        if (!nuevoPropietarioRole || !actorRole) {
            return res.status(400).json({ error: 'Faltan campos: nuevoPropietarioRole o actorRole' });
        }

        // 1. Obtenemos el contrato (identidad) del actor que FIRMA
        const contract = getContractForRole(actorRole);

        // 2. Obtenemos los datos del NUEVO propietario (los pasamos al chaincode)
        const nuevoPropietarioID = roleIdentities.get(nuevoPropietarioRole);
        const nuevoPropietarioMSPID = (nuevoPropietarioRole === 'Laboratorio' || nuevoPropietarioRole === 'Regulador') ? 'Org1MSP' : 'Org2MSP';

        if (!nuevoPropietarioID) {
            return res.status(400).json({ error: 'Rol de nuevo propietario inválido' });
        }

        await contract.submitTransaction(
            'Transferir',
            assetID,
            nuevoPropietarioID, // Ej. "Admin@org2.example.com"
            nuevoPropietarioMSPID // Ej. "Org2MSP"
        );
        res.status(200).json({ status: 'ok', action: 'transferido' });

    } catch (error) {
        console.error(`Error al transferir medicamento: ${error}`);
        res.status(500).json({ error: (error as Error).message });
    }
});

app.put('/api/medicamentos/:id/recibir', async (req: Request, res: Response) => {
    try {
        const assetID = req.params.id;
        const { ubicacion, actorRole } = req.body as TransaccionActorBody;

        if (!ubicacion || !actorRole) {
            return res.status(400).json({ error: 'Faltan campos: ubicacion o actorRole' });
        }

        const contract = getContractForRole(actorRole); // Usa la identidad del rol (ej. Salud)
        await contract.submitTransaction('Recibir', assetID, ubicacion);
        res.status(200).json({ status: 'ok', action: 'recibido' });

    } catch (error) {
        console.error(`Error al recibir medicamento: ${error}`);
        res.status(500).json({ error: (error as Error).message });
    }
});

app.post('/api/medicamentos/:id/despachar', async (req: Request, res: Response) => {
    try {
        const assetID = req.params.id;
        // (MODIFICADO) Obtenemos el actorRole del body
        const { idPaciente, actorRole } = req.body as TransaccionActorBody;

        console.log(`[LOG API] Recibida petición POST /api/medicamentos/${assetID}/despachar`, req.body);
        if (!idPaciente || !actorRole) {
            return res.status(400).json({ error: 'Faltan campos: idPaciente o actorRole' });
        }

        // (MODIFICADO) Seleccionamos el contrato (identidad) correcto
        const contract = getContractForRole(actorRole);

        await contract.submitTransaction(
            'DespacharAPaciente',
            assetID,
            idPaciente
        );

        res.status(200).json({ status: 'ok', action: 'despachado', assetID: assetID, idPaciente: idPaciente });

    } catch (error) {
        console.error(`Error al despachar medicamento: ${error}`);
        res.status(500).json({ error: (error as Error).message });
    }
});


// --- Iniciar Servidor ---
app.listen(port, async () => {
    // (MODIFICADO) Llama a la nueva función de inicialización
    await initializeFabric();
    console.log(`🚀 Servidor API de PharmaLedger (TS) escuchando en http://localhost:${port}`);
});

// --- Funciones de Conexión (MODIFICADAS para ser genéricas) ---
// Estas funciones ya estaban bien porque aceptaban parámetros

// CÓDIGO CORREGIDO
async function newGrpcClient(peerEndpoint: string, tlsCertPath: string, peerHostAlias: string): Promise<grpc.Client> {
    const tlsRootCert = await fs.readFile(tlsCertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    return new grpc.Client(peerEndpoint, tlsCredentials, {
        'grpc.ssl_target_name_override': peerHostAlias,
        'grpc.default_authority': peerHostAlias // <-- AÑADE ESTA LÍNEA
    });
}

async function newIdentity(certPath: string, mspId: string): Promise<Identity> {
    // 'certPath' ahora es el camino *directo* al archivo .pem
    const credentials = await fs.readFile(certPath);
    return { mspId, credentials };
}

async function newSigner(keyFilePath: string): Promise<Signer> {
    const privateKeyPem = await fs.readFile(keyFilePath);
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    return signers.newPrivateKeySigner(privateKey);
}