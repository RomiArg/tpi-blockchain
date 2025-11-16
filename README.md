# TPI-BLOCKCHAIN
Este proyecto es parte del trabajo práctico integrador para la materia ***Desarrollo en tecnologías Blockchain***.
## Estructura
El proyecto cuenta con 4 carpetas:
- **smart-contract:** contiene la lógica del smart-contract `PharmaLedger`.
- **api:** contiene endpoint que permiten la comunicación del **smart-contract** con el **front**.
- **front:** tiene la vista básica para la comunicación efectiva con la **api** y el **smart-contract**.

Tiene la siguiente estructura:
```text
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
## Requisitos previos
### Clonar repositorio fabric-samples
``git clone https://github.com/hyperledger/fabric-samples.git``
### Descarga las Imágenes de Fabric
``cd fabric-samples``
``curl -sSL https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/bootstrap.sh | bash -s``

## Pasos para levantar el proyecto
### Paso 1: Levantar la Red Fabric y Desplegar el Chaincode
#### 1. Ve al directorio de la test-network
``cd fabric-samples/test-network``
#### 2. Limpia ejecuciones anteriores (si las hay)
``./network.sh down``
#### 3. Levanta la red (con Certificate Authorities)
``./network.sh up createChannel -ca``
#### 4. Despliega TU chaincode (pharma-ledger)
`-ccn` es el nombre (chaincodeName en server.js)
`-ccp` es la ruta a TU código (desde la carpeta test-network)
`-ccl` es el lenguaje

``./network.sh deployCC -ccn pharma-ledger -ccp ~tpi-blockchain/smart-contract -ccl javascript``
### Paso 2: Levantar la API Backend (Terminal 1)
#### 1. Ve a la carpeta de tu API
``cd tpi-blockchain/api``
#### 2. Instala las dependencias (Si no lo hiciste)
``npm install``
#### 3. Inicia el servidor
``node server.js``
### Paso 3: Levantar el Frontend (Terminal 2)
#### 1. Ve a la raíz de tu proyecto Angular
``cd tpi-blockchain/front``
#### 2. Instala las dependencias (Si no lo hiciste)
``npm install``
#### 3. Inicia el servidor de desarrollo de Angular
``ng serve``
