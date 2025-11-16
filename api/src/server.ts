'use strict';

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { connect, Contract, Gateway, Identity, Signer } from '@hyperledger/fabric-gateway';
import { Client as GrpcClient, credentials as grpcCredentials } from '@grpc/grpc-js';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

// --- Configuración de la API ---
const app = express();
app.use(cors());
app.use(express.json());
const port = 3000;

// --- Configuración de Fabric ---
const channelName = 'mychannel';
const chaincodeName = 'pharma-ledger';
const mspId = 'Org1MSP';

// Rutas
const cryptoPath = path.resolve(__dirname, '..', '..', '..', 'fabric-samples/test-network', 'organizations', 'peerOrganizations', 'org1.example.com');
const keyDirectoryPath = path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'keystore');
const certPath = path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'signcerts', 'cert.pem');
const tlsCertPath = path.resolve(cryptoPath, 'peers', 'peer0.org1.example.com', 'tls', 'ca.crt');
const peerEndpoint = 'localhost:7051';
const peerHostAlias = 'peer0.org1.example.com';

let contract: Contract;

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

        const client = await newGrpcClient();
        const gateway = connect({
            client,
            identity: await newIdentity(),
            signer: await newSigner(),
        });

        const network = gateway.getNetwork(channelName);
        contract = network.getContract(chaincodeName);

        console.log('✅ Conexión con Fabric establecida y contrato "pharma-ledger" listo.');

    } catch (error) {
        console.error('******** FALLÓ LA INICIALIZACIÓN DE FABRIC:');
        console.error(error);
        process.exit(1);
    }
}

// --- Endpoints de la API ---

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
    const credentials = await fs.readFile(certPath);
    return { mspId, credentials };
}

// La función 'Signer' (firmante) debe ser una función que toma un 'digest' (hash)
// y devuelve una 'signature' (firma).
async function newSigner(): Promise<Signer> {
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
}