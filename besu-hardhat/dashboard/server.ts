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

  // API endpoint: Salvar canvas como imagem
  if (req.url === '/api/save-canvas' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const { imageData, filename } = JSON.parse(body);
        
        // Validar dados recebidos
        if (!imageData || !filename) {
          throw new Error('imageData ou filename ausente');
        }
        
        // Remover o prefixo "data:image/jpeg;base64," ou "data:image/png;base64,"
        const base64Data = imageData.replace(/^data:image\/(jpeg|png);base64,/, '');
        
        // Validar se é base64 válido
        if (!base64Data || base64Data.length === 0) {
          throw new Error('Dados base64 inválidos');
        }
        
        // Criar buffer da imagem
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Validar tamanho mínimo
        if (buffer.length < 1000) {
          throw new Error(`Buffer muito pequeno: ${buffer.length} bytes`);
        }
        
        // Validar assinatura JPEG (FF D8 FF) ou PNG (89 50 4E 47)
        const jpegSignature = Buffer.from([0xFF, 0xD8, 0xFF]);
        const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
        const isJPEG = buffer.slice(0, 3).equals(jpegSignature);
        const isPNG = buffer.slice(0, 4).equals(pngSignature);
        
        if (!isJPEG && !isPNG) {
          throw new Error('Arquivo não é um JPEG ou PNG válido');
        }
        
        // Caminho para salvar
        const imagesDir = path.join(__dirname, 'images');
        const filePath = path.join(imagesDir, filename);
        
        // Garantir que o diretório existe
        if (!fs.existsSync(imagesDir)) {
          fs.mkdirSync(imagesDir, { recursive: true });
        }
        
        // Salvar arquivo
        fs.writeFileSync(filePath, buffer);
        
        // Verificar se arquivo foi salvo corretamente
        const stats = fs.statSync(filePath);
        
        console.log(`✅ Imagem salva: ${filename} (${(stats.size / 1024).toFixed(2)} KB)`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          path: `dashboard/images/${filename}`,
          message: `Imagem salva em: ${filePath}`,
          size: stats.size,
          sizeKB: (stats.size / 1024).toFixed(2)
        }));
      } catch (error) {
        console.error('❌ Erro ao salvar imagem:', (error as Error).message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false,
          error: 'Failed to save image', 
          details: (error as Error).message 
        }));
      }
    });
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
