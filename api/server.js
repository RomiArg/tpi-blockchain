'use strict';

const express = require('express');
const cors = require('cors');
const { connect: connectV1 } = require('@hyperledger/fabric-gateway'); // Solo importamos 'connect'
const grpc = require('@grpc/grpc-js'); // Importamos el paquete gRPC que acabamos de instalar
const GrpcClient = grpc.Client; // ¡Esto ahora funcionará!
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

// --- Configuración de la API ---
const app = express();
app.use(cors()); // Permite peticiones de otros orígenes (Angular)
app.use(express.json()); // Permite parsear JSON en el body
const port = 3000; // Puerto donde correrá tu API

// --- Configuración de Fabric (de app.js) ---
const channelName = 'mychannel';
const chaincodeName = 'pharma-ledger';
const mspId = 'Org1MSP';

// Rutas a los materiales
const cryptoPath = path.resolve(__dirname, '..', '..', 'tpi-blockchain/fabric-samples/test-network', 'organizations', 'peerOrganizations', 'org1.example.com');
const keyDirectoryPath = path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'keystore');
const certPath = path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'signcerts', 'cert.pem');
const tlsCertPath = path.resolve(cryptoPath, 'peers', 'peer0.org1.example.com', 'tls', 'ca.crt');
const peerEndpoint = 'localhost:7051';
const peerHostAlias = 'peer0.org1.example.com';

let contract; // Variable global para el contrato

/**
 * Conecta al Gateway de Fabric y prepara el contrato
 */
async function initializeFabric() {
    try {
        console.log('Inicializando conexión con Fabric...');

        // --- Conexión usando el nuevo gRPC Gateway (de app.js) ---
        const client = await newGrpcClient();
        const gateway = connectV1({
            client,
            identity: await newIdentity(),
            signer: await newSigner(),
            // Opciones de cliente gRPC
            clientTlsCredentials: {
                rootCert: await fs.readFile(tlsCertPath),
            },
            evaluateOptions: () => ({ deadline: Date.now() + 5000 }), // 5s
            endorseOptions: () => ({ deadline: Date.now() + 15000 }), // 15s
            submitOptions: () => ({ deadline: Date.now() + 5000 }), // 5s
            commitStatusOptions: () => ({ deadline: Date.now() + 60000 }), // 1m
        });

        const network = gateway.getNetwork(channelName);
        contract = network.getContract(chaincodeName);

        console.log('✅ Conexión con Fabric establecida y contrato "pharma-ledger" listo.');
        return contract;

    } catch (error) {
        console.error('******** FALLÓ LA INICIALIZACIÓN DE FABRIC:');
        console.error(error);
        process.exit(1);
    }
}

// --- Endpoints de la API ---

// GET /api/medicamentos/:id (ConsultarActivo)
app.get('/api/medicamentos/:id', async (req, res) => {
    try {
        const assetID = req.params.id;
        console.log(`Recibida petición GET /api/medicamentos/${assetID}`);

        const resultBytes = await contract.evaluateTransaction('ConsultarActivo', assetID);
        const resultJson = JSON.parse(Buffer.from(resultBytes).toString());

        res.json(resultJson);

    } catch (error) {
        console.error(`Error al consultar activo: ${error}`);
        res.status(404).json({ error: error.message });
    }
});

// GET /api/medicamentos/:id/historial (ConsultarHistorial)
app.get('/api/medicamentos/:id/historial', async (req, res) => {
    try {
        const assetID = req.params.id;
        console.log(`Recibida petición GET /api/medicamentos/${assetID}/historial`);

        const resultBytes = await contract.evaluateTransaction('ConsultarHistorial', assetID);
        const resultJson = JSON.parse(Buffer.from(resultBytes).toString());

        res.json(resultJson);

    } catch (error) {
        console.error(`Error al consultar historial: ${error}`);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/medicamentos (CrearMedicamento)
app.post('/api/medicamentos', async (req, res) => {
    try {
        const { assetID, nombreComercial, lote, fechaFabricacion, fechaVencimiento } = req.body;
        console.log('Recibida petición POST /api/medicamentos', req.body);

        // Validar input
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
        res.status(500).json({ error: error.message });
    }
});

// --- Iniciar Servidor ---
app.listen(port, async () => {
    await initializeFabric();
    console.log(`🚀 Servidor API de PharmaLedger escuchando en http://localhost:${port}`);
});

// --- Funciones Helper de Conexión ---
async function newGrpcClient() {
    const tlsRootCert = await fs.readFile(tlsCertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    return new GrpcClient(peerEndpoint, tlsCredentials, {
        'grpc.ssl_target_name_override': peerHostAlias,
    });
}

async function newIdentity() {
    const credentials = await fs.readFile(certPath);
    return { mspId, credentials };
}

/* async function newSigner() {
    const files = await fs.readdir(keyDirectoryPath);
    const keyPath = path.resolve(keyDirectoryPath, files[0]);
    const privateKeyPem = await fs.readFile(keyPath);
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    return crypto.createSign(null).update(Buffer.alloc(0)).sign.bind(undefined, privateKey);
} */
async function newSigner() {
    const files = await fs.readdir(keyDirectoryPath);
    const keyPath = path.resolve(keyDirectoryPath, files[0]);
    const privateKeyPem = await fs.readFile(keyPath);
    const privateKey = crypto.createPrivateKey(privateKeyPem);

    // Devuelve una FUNCIÓN que el gateway usará para firmar
    return (digest) => {
        // Usa crypto.sign(null, ...) para firmar el digest (hash)
        // que nos pasa el gateway, sin volver a hashearlo.
        return crypto.sign(null, digest, privateKey);
    };
}