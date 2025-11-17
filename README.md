# TPI-BLOCKCHAIN
Este proyecto es parte del trabajo práctico integrador para la materia ***Desarrollo en tecnologías Blockchain***.

## Estructura
El proyecto cuenta con 4 carpetas:
- **smart-contract:** contiene la lógica del smart-contract `PharmaLedger`.
- **api:** contiene los endpoints que permiten la comunicación del **smart-contract** con el **front**.
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

### 2. Configurar Docker Desktop

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

Crea el archivo `.env`. En Windows puedes usar:

```bash
copy .env.example .env
```

¡CRÍTICO! Edita el archivo `.env` y define la variable `CRYPTO_PATH_ORG1`. Debe ser la ruta absoluta a la carpeta de organizaciones en tu máquina.

Ejemplo para Windows:

```bash
CRYPTO_PATH_ORG1=C:\Users\stefa\Downloads\TPI\tpi-blockchain\fabric-samples\test-network\organizations\peerOrganizations\org1.example.com
```

(El resto de variables como `CHANNEL_NAME` y `CHAINCODE_NAME` ya son correctas).

### Paso 2: Levantar la Red Fabric y Desplegar (Terminal 2 - como Administrador)

Ahora sí, levantamos la red con todos nuestros arreglos.

Abre una nueva terminal (Git Bash o PowerShell) como Administrador.

Ve al directorio de la `test-network`:

```bash
cd tpi-blockchain/fabric-samples/test-network
```

Limpia ejecuciones anteriores (si las hay):

```bash
./network.sh down
```

Levanta la red (con CouchDB para poder ver los datos):

```bash
./network.sh up createChannel -s couchdb
```

Despliega TU chaincode (`pharma-ledger`). Este comando usa:

- La ruta relativa correcta (`../../smart-contract`).
- La política de Endorsement OR. Esto es fundamental para que la API (que solo habla con un peer) pueda validar transacciones.

```bash
./network.sh deployCC -ccn pharma-ledger -ccp ../../smart-contract -ccl typescript -ccep "OR('Org1MSP.peer','Org2MSP.peer')" -cci InitLedger

```

Espera a que termine. Deberías ver:

```text
========== Chaincode successfully deployed ==========
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

### Paso 4: Levantar el Frontend (Terminal 3)

Abre una tercera terminal.

Ve a la raíz de tu proyecto Angular:

```bash
cd tpi-blockchain/front
```

Instala las dependencias (si no lo hiciste):

```bash
npm install
```

Inicia el servidor de desarrollo de Angular:

```bash
ng serve
```
