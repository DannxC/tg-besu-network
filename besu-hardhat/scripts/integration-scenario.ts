import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

// ========================================
// CORES ANSI PARA LOGS COLORIDOS
// ========================================
const COLORS = {
  RESET: '\x1b[0m',
  BRIGHT: '\x1b[1m',
  DIM: '\x1b[2m',
  
  // Cores para membros
  MEMBER1: '\x1b[36m', // Ciano
  MEMBER2: '\x1b[35m', // Magenta
  
  // Cores para tipos de log
  INFO: '\x1b[34m',    // Azul
  SUCCESS: '\x1b[32m', // Verde
  WARNING: '\x1b[33m', // Amarelo
  ERROR: '\x1b[31m',   // Vermelho
  
  // Cores para dados
  DATA: '\x1b[37m',    // Branco
  HIGHLIGHT: '\x1b[93m' // Amarelo claro
};

/**
 * Helper para printar logs coloridos dos membros
 */
function memberLog(memberNumber: 1 | 2, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
  const memberColor = memberNumber === 1 ? COLORS.MEMBER1 : COLORS.MEMBER2;
  const memberLabel = `MEMBRO ${memberNumber}`;
  
  let typeIcon = '';
  let typeColor = COLORS.INFO;
  
  switch (type) {
    case 'success':
      typeIcon = '✅';
      typeColor = COLORS.SUCCESS;
      break;
    case 'warning':
      typeIcon = '⚠️ ';
      typeColor = COLORS.WARNING;
      break;
    case 'error':
      typeIcon = '❌';
      typeColor = COLORS.ERROR;
      break;
    default:
      typeIcon = '💬';
      typeColor = COLORS.INFO;
  }
  
  console.log(`${memberColor}${COLORS.BRIGHT}[${memberLabel}]${COLORS.RESET} ${typeIcon} ${typeColor}${message}${COLORS.RESET}`);
}

/**
 * Helper para printar separadores visuais
 */
function separator(title?: string) {
  console.log(`\n${COLORS.HIGHLIGHT}${'━'.repeat(60)}${COLORS.RESET}`);
  if (title) {
    console.log(`${COLORS.BRIGHT}${COLORS.HIGHLIGHT}  ${title}${COLORS.RESET}`);
    console.log(`${COLORS.HIGHLIGHT}${'━'.repeat(60)}${COLORS.RESET}\n`);
  }
}

/**
 * Helper para printar dados técnicos
 */
function logData(label: string, value: any) {
  console.log(`${COLORS.DIM}  ${label}:${COLORS.RESET} ${COLORS.DATA}${value}${COLORS.RESET}`);
}

/**
 * Carregar contratos deployados
 */
async function loadContracts() {
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  
  // Carregar GeohashConverter
  const geohashPath = path.join(deploymentsDir, 'GeohashConverter.json');
  if (!fs.existsSync(geohashPath)) {
    throw new Error('GeohashConverter não encontrado! Execute: npm run deploy');
  }
  const geohashDeployment = JSON.parse(fs.readFileSync(geohashPath, 'utf8'));
  
  // Carregar DSS_Storage
  const dssPath = path.join(deploymentsDir, 'DSS_Storage.json');
  if (!fs.existsSync(dssPath)) {
    throw new Error('DSS_Storage não encontrado! Execute: npm run deploy');
  }
  const dssDeployment = JSON.parse(fs.readFileSync(dssPath, 'utf8'));
  
  // Conectar aos contratos
  const GeohashConverter = await ethers.getContractFactory('GeohashConverter');
  const geohashConverter = GeohashConverter.attach(geohashDeployment.address);
  
  const DSS_Storage = await ethers.getContractFactory('DSS_Storage');
  const dssStorage = DSS_Storage.attach(dssDeployment.address);
  
  return { geohashConverter, dssStorage };
}

/**
 * Converter lat/lon para formato int256 do contrato
 */
function latLonToInt256(value: number): bigint {
  return BigInt(Math.round(value * 1e18));
}

/**
 * Converter int256 do contrato para lat/lon
 */
function int256ToLatLon(value: bigint): number {
  return Number(value) / 1e18;
}

/**
 * Formatar bytes32 para hex legível
 */
function formatBytes32(bytes32: any): string {
  const hex = bytes32.toString ? bytes32.toString() : String(bytes32);
  if (hex.length <= 18) return hex;
  return hex.slice(0, 10) + '...' + hex.slice(-8);
}

// ========================================
// CENÁRIO DE INTEGRAÇÃO
// ========================================
async function main() {
  separator('🎬 CENÁRIO DE INTEGRAÇÃO - DSS OIR');
  
  console.log(`${COLORS.INFO}📋 Descrição do cenário:${COLORS.RESET}`);
  console.log(`${COLORS.DIM}   Membros criarão rotas 4D (lat, lon, tempo, altura) e registrarão`);
  console.log(`   suas OIRs (Operational Intent References) no DSS.${COLORS.RESET}\n`);
  
  // ========================================
  // SETUP INICIAL
  // ========================================
  separator('⚙️  SETUP INICIAL');
  
  console.log('🔌 Conectando aos contratos...');
  const { geohashConverter, dssStorage } = await loadContracts();
  
  const precision = await geohashConverter.geohashMaxPrecision();
  logData('GeohashConverter', await geohashConverter.address);
  logData('DSS_Storage', await dssStorage.address);
  logData('Precision', precision.toString());
  
  console.log('\n👥 Obtendo contas dos membros...');
  const [, member1, member2] = await ethers.getSigners();
  logData('Membro 1', member1.address);
  logData('Membro 2', member2.address);
  
  // ========================================
  // CENÁRIO 1: MEMBRO 1 - TRIÂNGULO BÁSICO
  // ========================================
  separator('📍 CENÁRIO 1: MEMBRO 1 CRIA ROTA TRIANGULAR');
  
  memberLog(1, 'Vou criar uma rota triangular sobre uma área urbana', 'info');
  
  // Definir triângulo (coordenadas fictícias)
  const triangle = {
    vertices: [
      { lat: -23.5505, lon: -46.6333 }, // São Paulo - Ponto 1
      { lat: -23.5605, lon: -46.6233 }, // Ponto 2
      { lat: -23.5455, lon: -46.6183 }, // Ponto 3
    ],
    altitude: { min: 100, max: 300 }, // metros
    time: {
      start: Math.floor(Date.now() / 1000), // agora
      end: Math.floor(Date.now() / 1000) + 3600 // +1 hora
    }
  };
  
  memberLog(1, 'Coordenadas do meu triângulo:', 'info');
  triangle.vertices.forEach((v, i) => {
    logData(`  Vértice ${i + 1}`, `(${v.lat.toFixed(4)}°, ${v.lon.toFixed(4)}°)`);
  });
  logData('  Altitude', `${triangle.altitude.min}m - ${triangle.altitude.max}m`);
  logData('  Tempo', `${triangle.time.start} → ${triangle.time.end} (1h)`);
  
  memberLog(1, 'Convertendo coordenadas para o formato do contrato...', 'info');
  const latitudes = triangle.vertices.map(v => latLonToInt256(v.lat));
  const longitudes = triangle.vertices.map(v => latLonToInt256(v.lon));
  
  memberLog(1, 'Chamando GeohashConverter.processPolygon()...', 'info');
  console.log(`${COLORS.DIM}  (Isso pode levar alguns segundos...)${COLORS.RESET}`);
  
  const tx = await geohashConverter.connect(member1).processPolygon(
    latitudes,
    longitudes,
    precision,
    false // sem debug
  );
  
  memberLog(1, 'Aguardando confirmação da transação...', 'info');
  const receipt = await tx.wait();
  const gasUsed = receipt.gasUsed.toString();
  logData('  Gas usado', parseInt(gasUsed).toLocaleString());
  logData('  Block', receipt.blockNumber);
  
  memberLog(1, 'Processando resultado...', 'success');
  
  // Chamar a função com callStatic para obter o retorno sem enviar transação
  const result = await geohashConverter.connect(member1).callStatic.processPolygon(
    latitudes,
    longitudes,
    precision,
    false
  );
  
  // O retorno é uma tupla, pegar apenas o array de geohashes (primeiro elemento)
  const geohashes = result[0] || result;
  
  memberLog(1, `Recebi ${geohashes.length} geohashes do contrato!`, 'success');
  console.log(`${COLORS.DIM}  Primeiros 5 geohashes:${COLORS.RESET}`);
  geohashes.slice(0, 5).forEach((gh: string, i: number) => {
    logData(`    [${i}]`, formatBytes32(gh));
  });
  if (geohashes.length > 5) {
    console.log(`${COLORS.DIM}    ... (${geohashes.length - 5} mais)${COLORS.RESET}`);
  }
  
  memberLog(1, 'Agora vou registrar minha OIR no DSS_Storage', 'info');
  
  // Primeiro, permitir que member1 possa adicionar OIRs
  memberLog(1, 'Obtendo permissão para adicionar OIRs...', 'info');
  const [deployer] = await ethers.getSigners();
  const allowTx = await dssStorage.connect(deployer).allowUser(member1.address);
  await allowTx.wait();
  memberLog(1, 'Permissão concedida!', 'success');
  
  // Criar dados da OIR
  const oirId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`FLIGHT-001-${Date.now()}`));
  const oirUrl = 'https://uss.example.com/oir/flight-001';
  const entityNumber = 1;
  
  memberLog(1, 'Criando OIR com os seguintes dados:', 'info');
  logData('  ID', formatBytes32(oirId));
  logData('  Geohashes', `${geohashes.length} células`);
  logData('  Altitude', `${triangle.altitude.min}m - ${triangle.altitude.max}m`);
  logData('  Tempo', `${triangle.time.start} → ${triangle.time.end}`);
  logData('  Entity', entityNumber);
  logData('  URL', oirUrl);
  
  memberLog(1, 'Chamando DSS_Storage.upsertOIR()...', 'info');
  
  const upsertTx = await dssStorage.connect(member1).upsertOIR(
    geohashes,                  // _geohashes
    triangle.altitude.min,      // _minHeight
    triangle.altitude.max,      // _maxHeight
    triangle.time.start,        // _startTime
    triangle.time.end,          // _endTime
    oirUrl,                     // _url
    entityNumber,               // _entity
    oirId                       // _id
  );
  
  memberLog(1, 'Aguardando confirmação...', 'info');
  const upsertReceipt = await upsertTx.wait();
  logData('  Gas usado', parseInt(upsertReceipt.gasUsed.toString()).toLocaleString());
  logData('  Block', upsertReceipt.blockNumber);
  
  memberLog(1, `OIR criada com sucesso! ID: ${formatBytes32(oirId)}`, 'success');
  
  // Verificar OIR armazenada
  memberLog(1, 'Verificando minha OIR no contrato...', 'info');
  const storedOir = await dssStorage.idToData(oirId);
  
  console.log(`\n${COLORS.SUCCESS}📊 OIR Armazenada:${COLORS.RESET}`);
  logData('  ID', formatBytes32(storedOir.id));
  logData('  Created By', storedOir.createdBy);
  logData('  Last Updated By', storedOir.lastUpdatedBy);
  logData('  Geohashes', `${geohashes.length} células`);
  logData('  Altitude', `${storedOir.minHeight} - ${storedOir.maxHeight}m`);
  logData('  Tempo', `${storedOir.startTime} → ${storedOir.endTime}`);
  logData('  Entity', storedOir.entityNumber);
  logData('  URL', storedOir.url);
  
  memberLog(1, 'Pronto! Minha rota está registrada no DSS! 🎉', 'success');
  
  // ========================================
  // FINALIZAÇÃO
  // ========================================
  separator('✅ CENÁRIO 1 COMPLETO');
  
  console.log(`${COLORS.SUCCESS}🎉 Cenário executado com sucesso!${COLORS.RESET}\n`);
  console.log(`${COLORS.INFO}📝 Resumo:${COLORS.RESET}`);
  console.log(`${COLORS.DIM}   • Membro 1 criou um triângulo com 3 vértices`);
  console.log(`   • GeohashConverter processou e retornou ${geohashes.length} geohashes`);
  console.log(`   • OIR registrada no DSS com ID ${formatBytes32(oirId)}`);
  console.log(`   • ${geohashes.length} células geoespaciais cobertas`);
  console.log(`   • Rota ativa e pronta para operação${COLORS.RESET}\n`);
}

// ========================================
// EXECUÇÃO
// ========================================
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(`\n${COLORS.ERROR}${COLORS.BRIGHT}❌ ERRO:${COLORS.RESET}`, error);
    process.exit(1);
  });

