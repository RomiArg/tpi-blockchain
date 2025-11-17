# TPI-BLOCKCHAIN
Este proyecto es parte del trabajo práctico integrador para la materia ***Desarrollo en tecnologías Blockchain***.

## Estructura
El proyecto cuenta con 4 carpetas:
- **smart-contract:** contiene la lógica del smart-contract `PharmaLedger`.
- **api:** contiene los endpoints que permiten la comunicación del **smart-contract** con el **front**.
- **front:** tiene la vista básica para la comunicación efectiva con la **api** y el **smart-contract**.

Tiene la siguiente estructura:
```plaintext
tpi-blockchain\
|-- api\
|   |-- src\
|   |   |-- server.ts
|-- front\
|   |-- src\
|   | |-- app\
|-- smart-contract\
|   |-- src\
|   |   |-- index.ts
|   |   |-- medicamento.ts
|-- REAdme.md
|__ modelado.md
```

## Requisitos Previos

- Clonar este repositorio (tpi-blockchain).
- Clonar fabric-samples:

```bash
git clone https://github.com/hyperledger/fabric-samples.git
```

- Descargar Imágenes de Fabric:

```bash
cd fabric-samples
curl -sSL https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/bootstrap.sh | bash -s
```

## 🚨 Configuración Crítica (Solo una vez - ANTES DE EMPEZAR)

Estos pasos son obligatorios para un entorno de desarrollo en Windows y solucionan los errores de permisos y compatibilidad.

### 1. (Windows) Usar Terminal de Administrador

Para todos los pasos que involucren docker o los scripts de network.sh, deberás usar Git Bash o PowerShell ejecutado "Como Administrador".

### 2. (Windows) Configurar Docker Desktop

El chaincode necesita "hablar" con el motor de Docker para construirse.

1. Abre Docker Desktop.
2. Ve a Settings (⚙️) > General.
3. Marca la casilla: **"Expose daemon on tcp://localhost:2375 without TLS"**.
4. Presiona **"Apply & Restart"**.

### 3. (Windows) Arreglar Permisos de Docker

Esto soluciona el error `mkdir C:\Program Files\Git\var: Access is denied` que ocurre al crear los peers.

- Abre el archivo: `fabric-samples/test-network/docker/docker-compose-test-net.yaml`.
- Busca y comenta (añadiendo un `#` al inicio) todas las líneas que contengan `${DOCKER_SOCK}`.
- Deberías encontrarla en 3 sitios (bajo `peer0.org1`, `peer0.org2` y `cli`).

Ejemplo de cómo debe quedar:

```yaml
volumes:
  - ./docker/peercfg:/etc/hyperledger/peercfg
  # La siguiente línea se comenta para evitar el error de permisos en Windows/Git Bash
  # - ${DOCKER_SOCK}:/host/var/run/docker.sock
```

Importante: En ese mismo archivo, bajo el servicio `peer0.org2.example.com`, asegúrate de que el `CORE_VM_ENDPOINT` sea `tcp://host.docker.internal:2375` (igual que el de `peer0.org1`).

Este paso solo es necesario para usuarios de Windows

## Pasos para levantar el proyecto

### Paso 1: Configurar la API (Terminal 1)

Primero, configuramos la API para que tenga sus dependencias y variables de entorno listas.

Abre una terminal (PowerShell o CMD, no necesita ser admin) y ve a la carpeta de la API:

```bash
cd tpi-blockchain/api
```

Instala las dependencias:

```bash
npm install
```

Crea el archivo `.env`. En Windows/Linux puedes usar:

```bash
copy .env.example .env
```

¡CRÍTICO! Edita el archivo `.env` y define la variable `CRYPTO_PATH_ORG1`. Debe ser la ruta absoluta a la carpeta de organizaciones en tu máquina.

Ejemplo para Windows:

```bash
CRYPTO_PATH_ORG1=C:\Users\stefa\Downloads\TPI\tpi-blockchain\fabric-samples\test-network\organizations\peerOrganizations\org1.example.com
```

### Paso 2: Levantar la Red Fabric y Desplegar (Terminal 2)

Ahora sí, levantamos la red con todos nuestros arreglos.

Abre una nueva terminal (Git Bash o PowerShell) como Administrador en Windows.

Ve al directorio de la `test-network`:

```bash
cd tpi-blockchain/fabric-samples/test-network
```

Limpia ejecuciones anteriores (si las hay):
En algunos casos en Linux usar los siguientes comandos
```bash
docker stop $(docker ps -aq) 2>/dev/null || true
docker rm $(docker ps -aq) 2>/dev/null || true
docker system prune -f
docker volume prune -f

docker ps # Para ver que no haya procesos activos
```

```bash
./network.sh down
```

Levanta la red (con CouchDB para poder ver los datos):

```bash
./network.sh up createChannel -s couchdb
```

En algunos casos de Linux es necesario modificar el archivo ``network.config``
```yaml
# default database (-s)
DATABASE="couchdb"
```
Ahora usar este comando para Linux

```bash
./network.sh up createChannel -ca
```

Despliega TU chaincode luego del -ccn (`pharma-ledger`). Este comando usa:

- La ruta relativa correcta luego del -ccp (`../../smart-contract`).
- La política de Endorsement OR. Esto es fundamental para que la API (que solo habla con un peer) pueda validar transacciones.

```bash
./network.sh deployCC -ccn pharma-ledger -ccp ../../smart-contract -ccl typescript -ccep "OR('Org1MSP.peer','Org2MSP.peer')" -cci InitLedger
```

#### Probar la conexion
##### Setear Variables de Entorno
En Linux es importante setear las variables de entorno para que funcione el comando ``peer``
Se puede usar este comando
```bash
source scripts/envVar.sh && setGlobals 1
```
O estos en el caso que no funcione el anterior
```bash
export PATH=${PWD}/../bin:$PATH
export FABRIC_CFG_PATH=$PWD/../config/
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051
```

###### Probar

```bash
peer chaincode query -C mychannel -n pharma-ledger -c '{"Args":["ConsultarTodosLosMedicamentos"]}'
```

```bash
peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer.example.com \
  --tls \
  --cafile $PWD/organizations/ordererOrganizations/example.com/tlsca/tlsca.example.com-cert.pem \
  -C mychannel \
  -n pharma-ledger \
  --peerAddresses localhost:7051 \
  --tlsRootCertFiles $PWD/organizations/peerOrganizations/org1.example.com/tlsca/tlsca.org1.example.com-cert.pem \
  --peerAddresses localhost:9051 \
  --tlsRootCertFiles $PWD/organizations/peerOrganizations/org2.example.com/tlsca/tlsca.org2.example.com-cert.pem \
  -c '{"Args":["CrearMedicamento","MED-3001","TestMed","LOTE-123","2024-01-01","2025-01-01"]}'

### Paso 3: Iniciar la API (Terminal 1)

Vuelve a la primera terminal (la de la API).

Inicia el servidor:

```bash
npm run dev
```

¡Observa la consola! Deberías ver el log de conexión exitoso, seguido de algo como:

```text
...
Verificando datos iniciales (seeding)...
Datos iniciales no encontrados. Ejecutando InitLedger...
✅ Datos iniciales creados (InitLedger).
🚀 Servidor API de PharmaLedger (TS) escuchando en http://localhost:3000
```

¡Si ves esto, la API está conectada y funcionando!

#### Probar endpoint desde la consola
```bash
curl http://localhost:3000/api/medicamentos
```

```bash
curl -X POST http://localhost:3000/api/medicamentos \
  -H "Content-Type: application/json" \
  -d '{
    "assetID": "MED-3002",
    "nombreComercial": "ParacetamolTest",
    "lote": "LOTE-555",
    "fechaFabricacion": "2024-02-01",
    "fechaVencimiento": "2026-02-01"
  }'
```
### Paso 4: Levantar el Frontend (Terminal 3)

Abre una tercera terminal.

Ve a la raíz de tu proyecto Angular:

```bash
cd tpi-blockchain/front
```

Instala las dependencias:

```bash
npm install
```

Inicia el servidor de desarrollo de Angular:

```bash
ng serve
```
