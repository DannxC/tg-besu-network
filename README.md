# Besu Network - Geospatial Data Storage System

Geospatial data storage system based on Hyperledger Besu (private blockchain) with smart contracts in Solidity for efficient indexing and querying using geohashes.

## 📋 Table of Contents

- [Overview](#overview)
- [System Dependencies](#system-dependencies)
- [Project Structure](#project-structure)
- [quorum-test-network](#quorum-test-network)
- [besu-hardhat](#besu-hardhat)

---

## 🔍 Overview

This project consists of two main directories:

### `quorum-test-network/`
Pre-configured Hyperledger Besu blockchain network environment. Contains all the necessary infrastructure to run a private network with multiple validator nodes, RPC node, and monitoring tools (Grafana, Prometheus, Block Explorer).

### `besu-hardhat/`
Hardhat development environment for smart contracts. Contains Solidity contracts (`DSS_Storage` and `GeohashConverter`), deployment and interaction scripts, automated tests, and an interactive dashboard for polygon processing algorithm visualization.

---

## 🛠️ System Dependencies

### Mandatory Requirements

**Operating System:**
- ⚠️ **Linux** (tested and developed on Linux)
- Windows may work, but adaptations might be necessary

**Software:**
- **Docker** (version 20.10+)
- **Docker Compose** (version 1.29+)
- **Node.js** (version 18+)
- **npm** (version 9+)

### Verify Installations

```bash
# Check Docker
docker --version
docker-compose --version

# Check Node.js and npm
node --version
npm --version
```

---

## 📁 Project Structure

```
besu-network/
├── quorum-test-network/     # Besu network infrastructure
│   ├── config/              # Node configurations
│   ├── docker-compose.yml   # Container orchestration
│   └── run.sh               # Script to start the network
│
└── besu-hardhat/            # Contract development
    ├── contracts/           # Solidity contracts
    ├── scripts/             # Deployment/interaction scripts
    ├── tests/               # Automated tests
    ├── dashboard/           # Interactive frontend
    └── deployments/         # Deployed contract addresses
```

---

## 🌐 quorum-test-network

### About

Private Hyperledger Besu blockchain network based on the Quorum Developer Quickstart template. Uses **QBFT** (Quorum Byzantine Fault Tolerance) consensus algorithm.

### Basic Network Configuration

**File:** `config/besu/genesis.json` or `config/besu/QBFTgenesis.json`

```json
{
  "config": {
    "chainId": 1337,
    "qbft": {
      "blockperiodseconds": 1,     // Block time: 1 second
      "epochlength": 30000,
      "requesttimeoutseconds": 4
    },
    "zeroBaseFee": true            // Free gas
  }
}
```

**Main Settings:**
- **Chain ID:** `1337`
- **Block Time:** `1` second (blocks mined every 1s)
- **Gas Price:** `0` (free transactions)
- **Consensus:** QBFT (Byzantine Fault Tolerance)

### Pre-configured Accounts

Account private keys are located at:
- `config/nodes/member1/accountPrivateKey`
- `config/nodes/member2/accountPrivateKey`
- `config/nodes/member3/accountPrivateKey`
- `config/nodes/rpcnode/accountPrivateKey`

**Accounts in `genesis.json`:**
```
0xf0e2db6c8dc6c681bb5d6ad121a107f300e9b2b5 - 1000000000 ETH (member1)
0xca843569e3427144cead5e4d5999a3d0ccf92b8e - 1000000000 ETH (member2)
0x0fbdc686b912d7722dc86510934589e0aaf3b55a - 1000000000 ETH (member3)
```

### How to Run

#### 1. Start the Network

```bash
cd quorum-test-network
./run.sh
```

This will:
- Start Docker containers for Besu nodes
- Configure validators (validator1-4)
- Start network members (member1-3, rpcnode)
- Start monitoring services

#### 2. Verify Active Nodes

```bash
docker ps
```

You should see containers like:
- `rpcnode` - RPC Node (port 8545)
- `member1validator1` - Member1 validator
- `member2validator2` - Member2 validator
- `member3validator3` - Member3 validator
- `validator4` - Additional validator
- `grafana` - Metrics dashboard
- `prometheus` - Metrics collection
- `explorer` - Block explorer

#### 3. Access Services

| Service         | URL                       | Description                          |
|-----------------|---------------------------|--------------------------------------|
| **RPC Node**    | http://localhost:8545     | JSON-RPC endpoint                    |
| **Grafana**     | http://localhost:3000     | Metrics dashboards                   |
| **Prometheus**  | http://localhost:9090     | Metrics system                       |
| **Block Explorer** | http://localhost:25000 | Block explorer                       |

**Grafana Credentials:**
- Username: `admin`
- Password: `admin` (password change will be requested on first access)

#### 4. Stop the Network

```bash
./stop.sh
```

#### 5. Remove All Data

```bash
./remove.sh
```

⚠️ This deletes all blockchain data, logs, and Docker volumes.

### Other Useful Commands

```bash
./list.sh      # List containers and status
./restart.sh   # Restart the network
./resume.sh    # Resume paused network
./attach.sh    # Attach to a node console
```

---

## 🏗️ besu-hardhat

### Install Dependencies

```bash
cd besu-hardhat
npm install
```

### Environment Configuration (.env)

⚠️ **Important:** Before running any commands, you need to configure the `.env` file.

**Create the file:** `besu-hardhat/.env`

```bash
RPC_URL=http://127.0.0.1:8545
CHAIN_ID=1337
MEMBER1_PK=<member1_private_key>
MEMBER2_PK=<member2_private_key>
MEMBER3_PK=<member3_private_key>
```

**Where to find private keys:**

The private keys for the members are located at:
- `../quorum-test-network/config/nodes/member1/accountPrivateKey`
- `../quorum-test-network/config/nodes/member2/accountPrivateKey`
- `../quorum-test-network/config/nodes/member3/accountPrivateKey`

Simply copy the contents of these files (without the `0x` prefix if present) to the corresponding variables in `.env`.

**Example `.env`:**
```bash
RPC_URL=http://127.0.0.1:8545
CHAIN_ID=1337
MEMBER1_PK=8f2a55949038a9610f50fb23b5883af3b4ecb3c3bb792cbcefbd1542c692be63
MEMBER2_PK=c87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3
MEMBER3_PK=ae6ae8e5ccbfb04590405997ee2d52d2b330726137b875053c36d94e974d162f
```

**📝 Note about .env in repository:**

This project **includes the `.env` file in the repository** (not in `.gitignore`) because it contains **test/development credentials only** that are already publicly available in the Besu quickstart configuration. These are NOT production secrets.

⚠️ **If you plan to use this system in production or with sensitive data:**
- **DO NOT commit private keys** to version control
- Create a separate `.env.local` or `.env.production` file
- Add these files to `.gitignore`
- Use environment variables or secret management systems

### Directory Structure

```
besu-hardhat/
├── contracts/               # Solidity contracts
│   ├── DSS_Storage.sol     # OIR (Operation Information Records) data storage
│   └── GeohashConverter.sol # Polygon processing and geohashes
│
├── scripts/                 # Deployment and interaction scripts
│   ├── deploy.ts           # Deploy contracts
│   ├── 4_initial_data.ts   # Insert initial data
│   ├── 5_get_data_script.ts # Query data
│   └── 6_event_listener.ts # Listen to emitted events
│
├── tests/                   # Automated tests
│   ├── network.test.ts     # Test network connectivity
│   ├── dss-storage.test.ts # Test DSS_Storage functionality
│   └── scenario.test.ts    # Complete USS conflict scenario
│
├── dashboard/               # Interactive frontend (GeohashConverter)
│   ├── index.html
│   ├── server.ts
│   └── js/
│
└── deployments/             # Deployed contract addresses
    ├── DSS_Storage.json
    └── GeohashConverter.json
```

---

## 📝 Solidity Contracts

### `DSS_Storage.sol`

Stores and manages **OIRs** (Operation Information Records) - drone operation records with geospatial and temporal information.

**Main features:**
- Add/update/delete OIRs associated with geohashes
- Query OIRs by geohash, altitude, and time interval
- Permission control (only authorized users can modify)
- Events: `DataAdded`, `DataUpdated`, `DataDeleted`

### `GeohashConverter.sol`

Processes geographic polygons and converts them to a set of geohashes (Z-order encoded).

**Main features:**
- Convert lat/lon to geohash and vice versa
- Process polygons using edge rasterization + fill
- CCL (Connected Component Labeling) to identify internal/external regions
- Optimized algorithm for configurable precision (1-16)

---

## 🚀 Deployment and Interaction Scripts

### 1. Compile Contracts

Always compile before deploying:

```bash
npm run compile
```

This generates:
- JSON files in `artifacts/`
- TypeChain types in `typechain-types/`

### 2. Deploy Contracts

```bash
npm run deploy
```

**What it does:**
- Connects to RPC node (http://127.0.0.1:8545)
- Deploys `GeohashConverter` (precision 4)
- Deploys `DSS_Storage`
- Saves addresses and ABIs in `deployments/`

**Generated files:**
- `deployments/DSS_Storage.json` - Contains address and ABI
- `deployments/GeohashConverter.json` - Contains address and ABI

⚠️ **Important:** Scripts 4, 5, 6 and tests use files in `deployments/` to connect to contracts. If you redeploy, they will automatically use the new addresses.

### 3. Script: Insert Initial Data

```bash
npm run scripts:4
```

**File:** `scripts/4_initial_data.ts`

**What it does:**
- Connects to `DSS_Storage` contract (via `deployments/`)
- Inserts initial data in geohashes `0x10` and `0x11` (precision 4)
- Altitude: 90-200m
- Validity: 24 hours from now
- URL: "example1.com", Entity: 1, ID: "1"
- Waits for confirmation and logs transaction details
- Shows emitted events (`DataAdded`)

### 4. Script: Query Data

```bash
npm run scripts:5
```

**File:** `scripts/5_get_data_script.ts`

**What it does:**
- Connects to `DSS_Storage` contract
- Searches for OIRs in geohash `0x10`
- Filter: altitude 100-200m, next 48 hours
- Lists found URLs, EntityNumbers and IDs

### 5. Script: Listen to Events

```bash
npm run scripts:6
```

**File:** `scripts/6_event_listener.ts`

**What it does:**
- Connects to `DSS_Storage` contract
- Searches historical events (last 1000 blocks):
  - `DataAdded` - Data inserted
  - `DataUpdated` - Data updated
  - `DataDeleted` - Data deleted
- Shows details of each event (block, transaction hash, ID, geohash, creator)

---

## 🧪 Automated Tests

### 1. Network Test

```bash
npm run test:network
```

**File:** `tests/network.test.ts`

**What it tests:**
- Connectivity to RPC node (http://127.0.0.1:8545)
- Correct Chain ID (1337)
- Configured accounts (member1, member2, member3)
- Account balances
- Deployed contracts (checks `deployments/`)
- Ability to send transactions

### 2. DSS_Storage Test

```bash
npm run test:dss
```

**File:** `tests/dss-storage.test.ts`

**What it tests (basic functionalities):**
- **Permissions:** Add/remove authorized users
- **Create OIRs:** Insert new records with multiple geohashes
- **Update OIRs:** Modify existing records (URL, altitude, time)
- **Delete OIRs:** Remove records from specific geohashes
- **Query OIRs:** Search by geohash with altitude/time filters
- **Concurrency:** Parallel transactions from different users
- **Edge cases:** Empty geohashes, invalid intervals, denied permissions

~1387 lines of tests covering complex scenarios!

### 3. Complete Scenario Test

```bash
npm run test:scenario
```

**File:** `tests/scenario.test.ts`

**Tested scenario:**

Simulates a conflict between two USSs (UTM Service Suppliers):

1. **USS2** creates a triangular route (OIR2):
   - Points: P1(5.00°, 5.00°), P2(5.05°, 5.00°), P3(5.00°, 5.05°)
   - Altitude: 100-200m, duration: 2 hours

2. **USS1** tries to create a rectangular route (OIR1):
   - Points forming a rectangle that **overlaps** with USS2's triangle
   - Altitude: 50-150m (partially overlaps)
   - Duration: 1 hour

3. **Conflict detection:**
   - The test verifies if USS1 can detect USS2's OIR in shared geohashes
   - Filters by altitude and time to identify overlaps

4. **Expected result:**
   - USS1 finds OIR2 when querying its own geohashes
   - Demonstrates that the system allows detection of spatial and temporal conflicts

This scenario illustrates the practical use of the system for airspace management in UTM (Unmanned Traffic Management).

---

## 🎨 Interactive Dashboard (GeohashConverter)

The `GeohashConverter` contract has complex polygon processing algorithms. To visualize and test these algorithms interactively, we created a web dashboard.

### How to Run

```bash
npm run dashboard
```

The server will be available at: **http://localhost:3001**

### How to Use

1. **Select Polygon:**
   - Click on screen grids to define polygon vertices
   - Each grid represents a precision 4 geohash

2. **Process Polygon:**
   - Click the "Process Polygon" button
   - The frontend makes a request to the RPC node (via Hardhat)
   - Calls the `processPolygon` function of `GeohashConverter.sol`
   - The result is plotted on screen with visual fill

3. **Debug Mode (optional):**

   Activate debug options to visualize parts of the algorithm:

   - **🔳 Bounding Box:** Shows the bounding box used in the algorithm
   - **🔲 Edge Contrast:** Highlights polygon edge rasterization
   - **🏷️ Labels (CCL):** Shows label numbers in each geohash
     - CCL (Connected Component Labeling) identifies connected regions
     - Label equivalence algorithm to differentiate internal/external

**Algorithm summary:**
1. Edge rasterization (Bresenham)
2. Polygon fill (flood fill)
3. CCL to identify connected components
4. Label equivalence resolution

This frontend is purely illustrative and visual - ideal for understanding how `GeohashConverter` works.

---

## 📚 Useful Commands

### besu-hardhat

```bash
# Compile contracts
npm run compile

# Deploy
npm run deploy

# Scripts
npm run scripts:4    # Insert initial data
npm run scripts:5    # Query data
npm run scripts:6    # Listen to events

# Tests
npm run test:network   # Test connectivity
npm run test:dss       # Test DSS_Storage
npm run test:scenario  # Test USS scenario

# Dashboard
npm run dashboard      # Start interactive dashboard (localhost:3001)

# Linting
npm run lint          # Check code
npm run lint:fix      # Auto-fix issues

# Clean build
npm run clean         # Clean artifacts and cache
```

### quorum-test-network

```bash
./run.sh       # Start network
./stop.sh      # Stop network
./remove.sh    # Remove data
./list.sh      # List containers
./restart.sh   # Restart network
./resume.sh    # Resume paused network
./attach.sh    # Attach to node console
```

---

## 🐛 Troubleshooting

### Problem: "Cannot connect to RPC node"

**Solution:**
1. Check if Besu network is running:
   ```bash
   docker ps | grep rpcnode
   ```
2. Test connectivity:
   ```bash
   curl -X POST http://localhost:8545 -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
   ```

### Problem: "Contract not found in deployments/"

**Solution:**
1. Compile and deploy again:
   ```bash
   npm run compile
   npm run deploy
   ```

### Problem: "Docker containers won't start"

**Solution:**
1. Remove old data:
   ```bash
   ./remove.sh
   ```
2. Restart Docker:
   ```bash
   sudo systemctl restart docker
   ```
3. Try again:
   ```bash
   ./run.sh
   ```

### Problem: "Port 8545 already in use"

**Solution:**
1. Identify the process:
   ```bash
   lsof -i :8545
   ```
2. Kill the process or use another port

### Problem: ".env file missing"

**Solution:**
1. Create the `.env` file as described in [Environment Configuration](#environment-configuration-env)
2. Copy private keys from `quorum-test-network/config/nodes/`

---

## 📖 Additional Documentation

- **Hyperledger Besu:** https://besu.hyperledger.org/
- **Hardhat:** https://hardhat.org/
- **Ethers.js:** https://docs.ethers.org/
- **QBFT Consensus:** https://besu.hyperledger.org/stable/private-networks/how-to/configure/consensus/qbft

---

## 📄 License

This project is for educational and research purposes.

---

## 👥 Authors

Developed as part of research on unmanned aerial traffic management (UTM) systems using blockchain.

---

**Last updated:** November 2025
