import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import type { DSS_Storage } from "../typechain-types";

async function main() {
  console.log("🔌 Conectando à rede Besu...\n");

  // Load deployment info
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  const deploymentFile = path.join(deploymentsDir, "DSS_Storage.json");
  
  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`❌ Arquivo de deployment não encontrado: ${deploymentFile}\n   Execute 'npm run deploy' primeiro.`);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  const [signer] = await ethers.getSigners();

  console.log(`📄 Contrato DSS_Storage: ${deployment.address}`);
  console.log(`👤 Usando conta: ${signer.address}\n`);

  // Connect to contract
  const DSS_StorageFactory = await ethers.getContractFactory("DSS_Storage");
  const instance = DSS_StorageFactory.attach(deployment.address) as DSS_Storage;

  // Usar geohash válido para precisão 4 (Z-order encoded)
  // Shift left 248 bits para alinhar à esquerda no bytes32
  const geohash = ethers.BigNumber.from(0x10).shl(248).toHexString();
  const minHeight = 100;
  const maxHeight = 200;
  const startTime = Date.now(); // Agora
  const endTime = startTime + (48 * 60 * 60 * 1000); // 48 horas à frente

  console.log(`🔍 Buscando dados para o geohash 0x10 (precisão 4)`);
  console.log(`   Altura: ${minHeight}-${maxHeight}m`);
  console.log(`   Período: ${new Date(startTime).toLocaleString()} → ${new Date(endTime).toLocaleString()}\n`);

  // Chamada da função getOIRsByGeohash
  const result = await instance.getOIRsByGeohash(geohash, minHeight, maxHeight, startTime, endTime);

  console.log("✅ Busca concluída!\n");
  console.log(`📊 Total de registros encontrados: ${result.urls.length}\n`);

  if (result.urls.length > 0) {
    console.log("═══════════════════════════════════════════════════════");
    console.log("📋 Dados recuperados:");
    console.log("═══════════════════════════════════════════════════════\n");
    
    for (let i = 0; i < result.urls.length; i++) {
      console.log(`Registro #${i + 1}:`);
      console.log(`   URL: ${result.urls[i]}`);
      console.log(`   Entity: ${result.entityNumbers[i]}`);
      console.log(`   ID: ${result.ids[i]}`);
      console.log("");
    }
  } else {
    console.log("ℹ️  Nenhum registro encontrado para os critérios especificados.");
  }

  console.log("🎉 Script concluído com sucesso!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

