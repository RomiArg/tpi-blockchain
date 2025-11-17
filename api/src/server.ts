'use strict';

import * as dotenv from 'dotenv';
import path from 'path';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { connect, Contract, Identity, Signer, signers } from '@hyperledger/fabric-gateway';
import { Client as GrpcClient, credentials as grpcCredentials } from '@grpc/grpc-js';
import crypto from 'crypto';
import { promises as fs } from 'fs';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });


const app = express();
app.use(cors());
app.use(express.json());
const port = 3000;


const channelName = process.env.CHANNEL_NAME || 'mychannel';
const chaincodeName = process.env.CHAINCODE_NAME || 'pharma-ledger';
const mspId = process.env.MSP_ID || 'Org1MSP';
const peerEndpoint = process.env.PEER_ENDPOINT || 'localhost:7051';
const peerHostAlias = process.env.PEER_HOST_ALIAS || 'peer0.org1.example.com';

const cryptoPathOrg1 = process.env.CRYPTO_PATH_ORG1;
if (!cryptoPathOrg1) {
    console.error('Error: La variable CRYPTO_PATH_ORG1 no está definida en .env');
    process.exit(1);
}

const projectRoot = path.resolve(__dirname, '..', '..');
const cryptoPath = path.resolve(projectRoot, cryptoPathOrg1);

const keyDirectoryPath = path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'keystore');
const certDirectoryPath = path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'signcerts');
const tlsCertPath = path.resolve(cryptoPath, 'peers', 'peer0.org1.example.com', 'tls', 'ca.crt');

let contract: Contract;

console.log('*************************************************');
console.log('DEBUG: Usando esta identidad:', certDirectoryPath);
console.log('*************************************************');

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

        const network = gateway.getNetwork(channelName);
        
        contract = network.getContract(chaincodeName);

        console.log('✅ Conexión con Fabric establecida y contrato "pharma-ledger" listo.');

        try {
            console.log('Verificando datos iniciales (seeding)...');
            await contract.evaluateTransaction('ConsultarActivo', 'MED-1001');
            await contract.evaluateTransaction('ConsultarActivo', 'MED-1001');
            console.log('✅ Datos iniciales ya existen.');

        } catch (error: any) {
            if (error.message.includes('no existe')) {
                console.log('Datos iniciales no encontrados. Ejecutando InitLedger...');
                await contract.submitTransaction('InitLedger');
                console.log('✅ Datos iniciales creados (InitLedger).');
            } else {

                console.error('Error al verificar datos iniciales:', error.message);
            }
        }

    } catch (error) {
        console.error('******** FALLÓ LA INICIALIZACIÓN DE FABRIC:');
        console.error(error);
        process.exit(1);
    }
}

// --- Endpoints de la API ---
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

async function newSigner(): Promise<Signer> {
    const files = await fs.readdir(keyDirectoryPath);
    const keyPath = path.resolve(keyDirectoryPath, files[0]);
    const privateKeyPem = await fs.readFile(keyPath);
    const privateKey = crypto.createPrivateKey(privateKeyPem);

    return signers.newPrivateKeySigner(privateKey);
}
