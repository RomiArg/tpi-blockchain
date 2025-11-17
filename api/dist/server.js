'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const fabric_gateway_1 = require("@hyperledger/fabric-gateway");
const grpc_js_1 = require("@grpc/grpc-js");
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = require("fs");
dotenv.config({ path: path_1.default.resolve(__dirname, '..', '.env') });
// --- Configuración de la API ---
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
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
const projectRoot = path_1.default.resolve(__dirname, '..', '..');
const cryptoPath = path_1.default.resolve(projectRoot, cryptoPathOrg1);
// const keyDirectoryPath = path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'keystore');
// const certDirectoryPath = path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'signcerts');
// const certPath = path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'signcerts', 'cert.pem');
// const tlsCertPath = path.resolve(cryptoPath, 'peers', 'peer0.org1.example.com', 'tls', 'ca.crt');
const keyDirectoryPath = path_1.default.resolve(cryptoPath, 'users', 'Admin@org1.example.com', 'msp', 'keystore');
const certDirectoryPath = path_1.default.resolve(cryptoPath, 'users', 'Admin@org1.example.com', 'msp', 'signcerts');
// const certPath = path.resolve(cryptoPath, 'users', 'Admin@org1.example.com', 'msp', 'signcerts', 'cert.pem');
const tlsCertPath = path_1.default.resolve(cryptoPath, 'peers', 'peer0.org1.example.com', 'tls', 'ca.crt');
let contract;
console.log('*************************************************');
console.log('DEBUG: Usando esta identidad:', certDirectoryPath);
console.log('*************************************************');
async function initializeFabric() {
    try {
        console.log('Inicializando conexión con Fabric...');
        console.log('Inicializando conexión con Fabric...');
        console.log(`Usando Crypto Path: ${cryptoPath}`);
        const client = await newGrpcClient();
        const gateway = (0, fabric_gateway_1.connect)({
            client,
            identity: await newIdentity(),
            signer: await newSigner(),
        });
        console.log(`DEBUG: Conectado con MSP ID: [${mspId}]`);
        console.log(`DEBUG: Usando CryptoPath: [${cryptoPath}]`);
        const network = gateway.getNetwork(channelName);
        contract = network.getContract(chaincodeName, 'PharmaLedger');
        console.log('✅ Conexión con Fabric establecida y contrato "pharma-ledger" listo.');
        try {
            // 1. Intenta consultar un activo "semilla"
            console.log('Verificando datos iniciales (seeding)...');
            await contract.evaluateTransaction('ConsultarActivo', 'MED-1001');
            console.log('✅ Datos iniciales ya existen.');
        }
        catch (error) {
            if (error.message.includes('no existe')) {
                console.log('Datos iniciales no encontrados. Ejecutando InitLedger...');
                // Ejecuta InitLedger para poblar la base de datos
                await contract.submitTransaction('InitLedger');
                console.log('✅ Datos iniciales creados (InitLedger ejecutado).');
            }
            else {
                console.error('Error al verificar datos iniciales:', error.message);
            }
        }
    }
    catch (error) {
        console.error('******** FALLÓ LA INICIALIZACIÓN DE FABRIC:');
        console.error(error);
        process.exit(1);
    }
}
// --- Endpoints de la API ---
// GET /api/medicamentos
app.get('/api/medicamentos', async (req, res) => {
    try {
        console.log('Recibida petición GET /api/medicamentos (todos)');
        const resultBytes = await contract.evaluateTransaction('ConsultarTodosLosMedicamentos');
        const resultJson = JSON.parse(Buffer.from(resultBytes).toString());
        res.json(resultJson);
    }
    catch (error) {
        console.error(`Error al consultar todos los medicamentos: ${error}`);
        res.status(500).json({ error: error.message });
    }
});
// GET /api/medicamentos/:id
app.get('/api/medicamentos/:id', async (req, res) => {
    try {
        const assetID = req.params.id;
        console.log(`Recibida petición GET /api/medicamentos/${assetID}`);
        const resultBytes = await contract.evaluateTransaction('ConsultarActivo', assetID);
        const resultJson = JSON.parse(Buffer.from(resultBytes).toString());
        res.json(resultJson);
    }
    catch (error) {
        console.error(`Error al consultar activo: ${error}`);
        res.status(404).json({ error: error.message });
    }
});
// GET /api/medicamentos/:id/historial
app.get('/api/medicamentos/:id/historial', async (req, res) => {
    try {
        const assetID = req.params.id;
        console.log(`Recibida petición GET /api/medicamentos/${assetID}/historial`);
        const resultBytes = await contract.evaluateTransaction('ConsultarHistorial', assetID);
        const resultJson = JSON.parse(Buffer.from(resultBytes).toString());
        res.json(resultJson);
    }
    catch (error) {
        console.error(`Error al consultar historial: ${error}`);
        res.status(500).json({ error: error.message });
    }
});
// POST /api/medicamentos
app.post('/api/medicamentos', async (req, res) => {
    try {
        const { assetID, nombreComercial, lote, fechaFabricacion, fechaVencimiento } = req.body;
        console.log('Recibida petición POST /api/medicamentos', req.body);
        if (!assetID || !nombreComercial || !lote || !fechaFabricacion || !fechaVencimiento) {
            return res.status(400).json({ error: 'Faltan campos obligatorios' });
        }
        await contract.submitTransaction('CrearMedicamento', assetID, nombreComercial, lote, fechaFabricacion, fechaVencimiento);
        res.status(201).json({ status: 'ok', assetID: assetID });
    }
    catch (error) {
        console.error(`Error al crear medicamento: ${error}`);
        res.status(500).json({ error: error.message });
    }
});
// --- Iniciar Servidor ---
app.listen(port, async () => {
    await initializeFabric();
    console.log(`🚀 Servidor API de PharmaLedger (TS) escuchando en http://localhost:${port}`);
});
// --- Funciones Helper de Conexión ---
async function newGrpcClient() {
    const tlsRootCert = await fs_1.promises.readFile(tlsCertPath);
    const tlsCredentials = grpc_js_1.credentials.createSsl(tlsRootCert);
    return new grpc_js_1.Client(peerEndpoint, tlsCredentials, {
        'grpc.ssl_target_name_override': peerHostAlias,
    });
}
async function newIdentity() {
    const certFiles = await fs_1.promises.readdir(certDirectoryPath);
    const certPath = path_1.default.resolve(certDirectoryPath, certFiles[0]);
    const credentials = await fs_1.promises.readFile(certPath);
    return { mspId, credentials };
}
// La función 'Signer' (firmante) debe ser una función que toma un 'digest' (hash)
// y devuelve una 'signature' (firma).
async function newSigner() {
    const files = await fs_1.promises.readdir(keyDirectoryPath);
    const keyPath = path_1.default.resolve(keyDirectoryPath, files[0]);
    const privateKeyPem = await fs_1.promises.readFile(keyPath);
    const privateKey = crypto_1.default.createPrivateKey(privateKeyPem);
    return async (digest) => {
        const sign = crypto_1.default.createSign('SHA256');
        sign.update(digest);
        const signature = sign.sign(privateKey);
        return signature;
    };
}
