'use strict';

import * as dotenv from 'dotenv';
import path from 'path';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { connect, Contract, Identity, Signer } from '@hyperledger/fabric-gateway';
import { Client as GrpcClient, credentials as grpcCredentials } from '@grpc/grpc-js';
import crypto from 'crypto';
import { promises as fs } from 'fs';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// --- Configuración de la API ---
const app = express();
app.use(cors());
app.use(express.json());
const port = 3000;

// --- Configuración de Fabric ---
const channelName = process.env.CHANNEL_NAME || 'mychannel';
const chaincodeName = process.env.CHAINCODE_NAME || 'pharma-ledger';
const mspId = process.env.MSP_ID || 'Org1MSP';
const peerEndpoint = process.env.PEER_ENDPOINT || 'localhost:7051';
const peerHostAlias = process.env.PEER_HOST_ALIAS || 'peer0.org1.example.com';

// --- Rutas ---
const cryptoPathOrg1 = process.env.CRYPTO_PATH_ORG1;
if (!cryptoPathOrg1) {
    console.error('Error: La variable CRYPTO_PATH_ORG1 no está definida en .env');
    process.exit(1);
}

// Construimos las rutas absolutas
const projectRoot = path.resolve(__dirname, '..', '..');
const cryptoPath = path.resolve(projectRoot, cryptoPathOrg1);

const keyDirectoryPath = path.resolve(cryptoPath, 'users', 'Admin@org1.example.com', 'msp', 'keystore');
const certDirectoryPath = path.resolve(cryptoPath, 'users', 'Admin@org1.example.com', 'msp', 'signcerts');
const tlsCertPath = path.resolve(cryptoPath, 'tlsca', 'tlsca.org1.example.com-cert.pem');

let contract: Contract;

console.log('*************************************************');
console.log('DEBUG: Usando esta identidad:', certDirectoryPath);
console.log('*************************************************');

interface CrearMedicamentoBody {
    assetID: string;
    nombreComercial: string;
    lote: string;
    fechaFabricacion: string;
    fechaVencimiento: string;
}

async function initializeFabric(): Promise<void> {
    try {
        console.log('Inicializando conexión con Fabric...');
        console.log(`Usando Crypto Path: ${cryptoPath}`);

        const client = await newGrpcClient();
        const gateway = connect({
            client,
            identity: await newIdentity(),
            signer: await newSigner(),
        });

        console.log(`DEBUG: Conectado con MSP ID: [${mspId}]`);
        console.log(`DEBUG: Usando CryptoPath: [${cryptoPath}]`);

        const network = gateway.getNetwork(channelName);
        contract = network.getContract(chaincodeName);

        console.log('✅ Conexión con Fabric establecida y contrato "pharma-ledger" listo.');

        try {
            console.log('Verificando datos iniciales (seeding)...');
            const todosBytes = await contract.evaluateTransaction('ConsultarTodosLosMedicamentos');
            const todos = JSON.parse(Buffer.from(todosBytes).toString());
            if (Array.isArray(todos) && todos.length > 0) {
                console.log('✅ Datos iniciales ya existen (hay elementos en el ledger).');
            } else {
                console.log('⚠ Ledger vacío. No se ejecutará InitLedger desde la API para evitar inconsistencias. Rellene el ledger usando una transacción determinista o desde consola.');
            }
        } catch (error: any) {
            console.warn('No se pudo verificar seed con ConsultarTodosLosMedicamentos:', error && error.message ? error.message : error);
            console.log('No se ejecutará InitLedger automáticamente. Use la API para crear activos o ejecute InitLedger manualmente desde un cliente determinista.');
        }
        /* try {
            // 1. Intenta consultar un activo "semilla"
            console.log('Verificando datos iniciales (seeding)...');
            await contract.evaluateTransaction('ConsultarActivo', 'MED-1001');
            console.log('✅ Datos iniciales ya existen.');

        } catch (error: any) {
            if (error.message.includes('no existe')) {
                console.log('Datos iniciales no encontrados. Ejecutando InitLedger...');
                // Ejecuta InitLedger para poblar la base de datos
                await contract.submitTransaction('InitLedger');
                console.log('✅ Datos iniciales creados (InitLedger ejecutado).');
            } else {
                console.error('Error al verificar datos iniciales:', error.message);
            }
        } */
    } catch (error) {
        console.error('******** FALLÓ LA INICIALIZACIÓN DE FABRIC:');
        console.error(error);
        process.exit(1);
    }
}

// --- Endpoints de la API ---
// GET /api/medicamentos
app.get('/api/medicamentos', async (req: Request, res: Response) => {
    try {
        console.log('Recibida petición GET /api/medicamentos (todos)');
        const resultBytes = await contract.evaluateTransaction('ConsultarTodosLosMedicamentos');
        const resultJson = JSON.parse(Buffer.from(resultBytes).toString());
        res.json(resultJson);
    } catch (error) {
        console.error(`Error al consultar todos los medicamentos: ${error}`);
        res.status(500).json({ error: (error as Error).message });
    }
});

// GET /api/medicamentos/:id
app.get('/api/medicamentos/:id', async (req: Request, res: Response) => {
    try {
        const assetID = req.params.id;
        console.log(`Recibida petición GET /api/medicamentos/${assetID}`);
        const resultBytes = await contract.evaluateTransaction('ConsultarActivo', assetID);
        const resultJson = JSON.parse(Buffer.from(resultBytes).toString());
        res.json(resultJson);
    } catch (error) {
        console.error(`Error al consultar activo: ${error}`);
        res.status(404).json({ error: (error as Error).message });
    }
});

// GET /api/medicamentos/:id/historial
app.get('/api/medicamentos/:id/historial', async (req: Request, res: Response) => {
    try {
        const assetID = req.params.id;
        console.log(`Recibida petición GET /api/medicamentos/${assetID}/historial`);
        const resultBytes = await contract.evaluateTransaction('ConsultarHistorial', assetID);
        const resultJson = JSON.parse(Buffer.from(resultBytes).toString());
        res.json(resultJson);
    } catch (error) {
        console.error(`Error al consultar historial: ${error}`);
        res.status(500).json({ error: (error as Error).message });
    }
});

// POST /api/medicamentos
app.post('/api/medicamentos', async (req: Request, res: Response) => {
    try {
        const {
            assetID,
            nombreComercial,
            lote,
            fechaFabricacion,
            fechaVencimiento
        } = req.body as CrearMedicamentoBody;

        console.log('Recibida petición POST /api/medicamentos', req.body);
        if (!assetID || !nombreComercial || !lote || !fechaFabricacion || !fechaVencimiento) {
            return res.status(400).json({ error: 'Faltan campos obligatorios' });
        }

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

// --- Iniciar Servidor ---
app.listen(port, async () => {
    await initializeFabric();
    console.log(`🚀 Servidor API de PharmaLedger (TS) escuchando en http://localhost:${port}`);
});

// --- Funciones Helper de Conexión ---

async function newGrpcClient(): Promise<GrpcClient> {
    const tlsRootCert = await fs.readFile(tlsCertPath);
    const tlsCredentials = grpcCredentials.createSsl(tlsRootCert);

    return new GrpcClient(peerEndpoint, tlsCredentials, {
        'grpc.ssl_target_name_override': peerHostAlias,
    });
}

async function newIdentity(): Promise<Identity> {
    const certFiles = await fs.readdir(certDirectoryPath);
    const certPath = path.resolve(certDirectoryPath, certFiles[0]);
    const credentials = await fs.readFile(certPath);
    return { mspId, credentials };
}

// La función 'Signer' (firmante) debe ser una función que toma un 'digest' (hash)
// y devuelve una 'signature' (firma).
/* async function newSigner(): Promise<Signer> {
    const files = await fs.readdir(keyDirectoryPath);
    const keyPath = path.resolve(keyDirectoryPath, files[0]);
    const privateKeyPem = await fs.readFile(keyPath);
    const privateKey = crypto.createPrivateKey(privateKeyPem);

    return async (digest: Uint8Array): Promise<Uint8Array> => {
        const sign = crypto.createSign('SHA256');
        sign.update(digest);
        const signature = sign.sign(privateKey);
        return signature;
    };
} */
async function newSigner(): Promise<Signer> {
    const files = await fs.readdir(keyDirectoryPath);
    const keyPath = path.resolve(keyDirectoryPath, files[0]);
    const privateKeyPem = await fs.readFile(keyPath, 'utf8');
    const privateKey = crypto.createPrivateKey(privateKeyPem);

    return async (digest: Uint8Array): Promise<Uint8Array> => {
        // digest ya es el hash; usar crypto.sign con null para firmar el digest directamente
        const signature = crypto.sign(null as any, Buffer.from(digest), privateKey);
        return Uint8Array.from(signature);
    };
}