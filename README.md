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
|-- smart-contract-typescript\
|   |-- src\
|   |   |-- index.ts
|   |   |-- medicamento.ts
|-- smart-contract-go/
|   |-- pharma_ledger.go
|   |-- go.mod
|   |-- go.sum
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

¡CRÍTICO! Edita el archivo .env. Este archivo ahora define las rutas a todas las 4 identidades (roles) que usa la aplicación.

Debes definir la ruta base absoluta a tu carpeta fabric-samples.

Instrucción: Busca todas las variables que terminan en _PATH (como ROLE_LABORATORIO_CERT_PATH, ROLE_LABORATORIO_KEY_PATH, etc.) y reemplaza la parte inicial de la ruta por la ruta absoluta correcta y que los nombres de los archivos y directorios .cert dentro de organizations en faabric samples coincidan.

Ejemplo (usando la ruta de wsl /mnt):

```bash
ROLE_LABORATORIO_CERT_PATH=/mnt/c/tpDTB/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/signcerts/Admin@org1.example.com-cert.pem
ROLE_LABORATORIO_KEY_PATH=/mnt/c/tpDTB/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/keystore/
ROLE_LABORATORIO_TLS_PATH=/mnt/c/tpDTB/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt

y asi para todos los roles...
```

### Paso 2: Levantar la Red Fabric y Desplegar (Terminal 2)

#### Smart Contract en Go
Para desplegar el smart contract escrito en Go, debemos seguir pasos similares al de TypeScript, pero con dos diferencias clave:

Necesitamos tener Go (Golang) instalado en nuestro sistema.

El comando de despliegue cambiará los parámetros -ccl (lenguaje) y -ccp (ruta).

A. Configuración Única (Pasos Previos)
Si es la primera vez que despliegas el chaincode de Go, debes realizar estos dos pasos:

1. Instalar Go (Golang)
Asegúrate de tener instalada una versión de Go (preferiblemente 1.20 o superior).

Puedes verificar si lo tienes instalado abriendo una terminal y escribiendo:

```bash
go version
```
Si no aparece nada o da error, deberás descargarlo e instalarlo desde el sitio web oficial de Go.

2. Inicializar el Módulo de Go
El proyecto de Go necesita descargar sus dependencias (la API de Fabric), similar a un npm install.

Ve a la carpeta del chaincode de Go (asumiendo que se llama smart-contract-go y está en la raíz de tpi-blockchain):

```bash
# Desde la raíz del proyecto (tpi-blockchain)
cd smart-contract-go
```

Una vez dentro, ejecuta los siguientes comandos para inicializar el módulo y descargar las dependencias:

```bash
# Inicializa el módulo (puedes cambiar 'example.com/pharma' por lo que quieras)
go mod init example.com/pharma

# Descarga las dependencias de Fabric listadas en el archivo .go
go mod tidy
```

B. Despliegue de la Red
Estos pasos son los que ejecutas cada vez que levantas la red.

Abre una nueva terminal (Git Bash o PowerShell) como Administrador en Windows.

Ve al directorio de la test-network:

```bash
cd tpi-blockchain/fabric-samples/test-network
```

Limpia ejecuciones anteriores (si las hay): En algunos casos en Linux usar los siguientes comandos

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

En algunos casos de Linux es necesario modificar el archivo network.config

```yaml
# default database (-s)
DATABASE="couchdb"
```

Ahora usar este comando para Linux

```bash
./network.sh up createChannel -ca
```

Despliega TU chaincode de Go. Nota los cambios:

- La ruta -ccp apunta a ../../smart-contract-go. Esta ruta es relativa considerando el directorio fabric-samples/test-network.

- El lenguaje -ccl es go.

```bash
./network.sh deployCC -ccn pharma-ledger -ccp ../../smart-contract-go -ccl go -ccep "OR('Org1MSP.peer','Org2MSP.peer')" -cci InitLedger
```

Probar la conexion
¡Esta parte es exactamente igual que con TypeScript! La interfaz del chaincode (pharma-ledger) y sus funciones son las mismas, por lo que los comandos de peer no cambian.

###### Setear Variables de Entorno
En Linux es importante setear las variables de entorno para que funcione el comando peer Se puede usar este comando

```bash
source scripts/envVar.sh && setGlobals 1
```

O estos en el caso que no funcione el anterior

```Bash
export PATH=${PWD}/../bin:$PATH
export FABRIC_CFG_PATH=$PWD/../config/
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051
```

##### Probar conexión

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
```

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
### 📝 Nota sobre la carpeta smart-contract-typescript

Se observará que en el repositorio existe una carpeta llamada smart-contract-typescript.

Este fue un desarrollo inicial para construir el chaincode en TypeScript. Sin embargo, este desarrollo se discontinuó y no está funcional. El proyecto final y funcional se completó utilizando Go (disponible en la carpeta smart-contract-go).

La carpeta de TypeScript se mantiene en el repositorio únicamente a modo de historial o por si se desea retomar en un futuro, pero no debe utilizarse para el despliegue o la operación del proyecto. Todas las instrucciones de este README corresponden a la versión funcional en Go.