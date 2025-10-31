import http from 'http';
import fs from 'fs';
import path from 'path';
import { ethers } from 'hardhat';

const PORT = 3001;

// MIME types para servir arquivos estáticos
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json'
};

interface ContractInfo {
  address: string;
  precision: number;
  network: string;
  chainId: number;
}

// Estado global do contrato
let contractInfo: ContractInfo | null = null;

async function loadContractInfo(): Promise<ContractInfo> {
  const deploymentPath = path.join(__dirname, '..', 'deployments', 'GeohashConverter.json');
  
  // Verificar se arquivo existe
  if (!fs.existsSync(deploymentPath)) {
    throw new Error('GeohashConverter.json não encontrado! Execute: npm run deploy');
  }

  // Carregar deployment
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  
  // Verificar se contrato existe na rede
  const code = await ethers.provider.getCode(deployment.address);
  if (code === '0x') {
    throw new Error(`Contrato não existe no endereço ${deployment.address}. A rede foi resetada? Execute: npm run deploy`);
  }

  // Carregar contrato
  const GeohashConverter = await ethers.getContractFactory('GeohashConverter');
  const contract = GeohashConverter.attach(deployment.address);
  
  // Verificar precision
  const maxPrecision = await contract.geohashMaxPrecision();
  
  console.log('✅ Contrato carregado com sucesso!');
  console.log('   Address:', deployment.address);
  console.log('   Precision:', maxPrecision.toString());

  contractInfo = {
    address: deployment.address,
    precision: parseInt(maxPrecision.toString()),
    network: deployment.network,
    chainId: deployment.chainId
  };

  return contractInfo;
}

function serveFile(res: http.ServerResponse, filePath: string): void {
  const ext = path.extname(filePath);
  const mimeType = MIME_TYPES[ext] || 'text/plain';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('File not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // API endpoint: informações do contrato
  if (req.url === '/api/contract' && req.method === 'GET') {
    if (!contractInfo) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Contract not loaded' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(contractInfo));
    return;
  }

  // API endpoint: ABI do contrato
  if (req.url === '/api/abi' && req.method === 'GET') {
    try {
      const artifactPath = path.join(__dirname, '../artifacts/contracts/GeohashConverter.sol/GeohashConverter.json');
      const artifactData = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ abi: artifactData.abi }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to load ABI', details: (error as Error).message }));
    }
    return;
  }

  // Servir ethers.js do node_modules
  if (req.url === '/ethers.umd.min.js') {
    serveFile(res, path.join(__dirname, '../node_modules/ethers/dist/ethers.umd.min.js'));
    return;
  }

  // Servir index.html na raiz
  if (req.url === '/' || req.url === '/index.html') {
    serveFile(res, path.join(__dirname, 'index.html'));
    return;
  }

  // Servir arquivos estáticos
  if (req.url) {
    const filePath = path.join(__dirname, req.url);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      serveFile(res, filePath);
      return;
    }
  }

  // 404
  res.writeHead(404);
  res.end('Not found');
});

// Iniciar servidor
async function start() {
  console.log('\n🗺️  GeohashConverter Dashboard\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Carregar e validar contrato
    console.log('📋 Carregando contrato...');
    await loadContractInfo();

    // Iniciar servidor HTTP
    server.listen(PORT, () => {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`\n🌐 Dashboard rodando em: http://localhost:${PORT}`);
      console.log('\n💡 Como usar:');
      console.log('   1. Abra o link acima no navegador');
      console.log('   2. Ajuste a precision no sidebar');
      console.log('   3. Visualize o grid de geohashes\n');
      console.log('⏹️  Pressione Ctrl+C para parar\n');
    });

  } catch (error) {
    console.error('\n❌ Erro ao iniciar dashboard:');
    console.error('   ', (error as Error).message);
    console.error('\n💡 Solução:');
    console.error('   Execute: npm run deploy\n');
    process.exit(1);
  }
}

void start();
