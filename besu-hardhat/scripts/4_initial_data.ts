import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import type { DSS_Storage } from "../typechain-types";

/**
 * Helper: Converts string to bytes32
 */
function toBytes32(str: string): string {
  if (str.length > 31) {
    return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(str));
  }
  return ethers.utils.formatBytes32String(str);
}

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

  console.log("Iniciando inserção de dados iniciais...");

  // Exemplo de inserção de dados com geohashes válidos para precisão 4
  // Para precisão 4: cada geohash é um número de 8 bits (2 bits × 4 = 8 bits)
  // Valores válidos: 0x00 até 0xFF (0 a 255)
  // Geohashes armazenados como bytes32 alinhados à esquerda (bits significativos no início)
  // Para isso, shiftamos o valor 248 bits para a esquerda (256 - 8 = 248)
  const geohash1 = ethers.BigNumber.from(0x10).shl(248).toHexString(); // 0x10 nos primeiros 8 bits
  const geohash2 = ethers.BigNumber.from(0x11).shl(248).toHexString(); // 0x11 nos primeiros 8 bits
  
  const minHeight = 90;
  const maxHeight = 200;
  const startTime = Date.now(); // agora, em milissegundos
  const endTime = startTime + (24 * 60 * 60 * 1000); // 24 horas a frente, em milissegundos
  const url = "example1.com";
  const entity = 1;
  const id = toBytes32("1");

  console.log(`📍 Geohashes: 0x10, 0x11 (precisão 4 - Z-order encoded)`);
  console.log(`📏 Altitude: ${minHeight}-${maxHeight}m`);
  console.log(`⏰ Período: ${new Date(startTime).toLocaleString()} → ${new Date(endTime).toLocaleString()}`);
  console.log(`🔗 URL: ${url} | Entity: ${entity} | ID: ${id}\n`);

  console.log("📤 Enviando transação...");
  const tx = await instance.upsertOIR([geohash1, geohash2], minHeight, maxHeight, startTime, endTime, url, entity, id);
  
  console.log("⏳ Aguardando confirmação...");
  const receipt = await tx.wait();
  
  console.log("\n✅ Transação confirmada!");
  console.log(`   De: ${receipt.from}`);
  console.log(`   Para: ${receipt.to}`);
  console.log(`   Bloco: ${receipt.blockNumber}`);
  console.log(`   Hash: ${receipt.transactionHash}`);
  console.log(`   Gas usado: ${receipt.gasUsed.toString()}`);
  console.log(`   Gas efetivo: ${receipt.effectiveGasPrice.toString()}`);
  console.log(`   Status: ${receipt.status === 1 ? "✅ Sucesso" : "❌ Falhou"}`);
  console.log(`   Confirmações: ${receipt.confirmations}`);
  
  if (receipt.events && receipt.events.length > 0) {
    console.log(`\n📢 Eventos emitidos: ${receipt.events.length}`);
    for (let i = 0; i < receipt.events.length; i++) {
      const event = receipt.events[i];
      if (event.event === "DataAdded") {
        const geohashValue = ethers.BigNumber.from(event.args?.geohash || "0x00").shr(248);
        console.log(`   ${i + 1}. DataAdded:`);
        console.log(`      ID: ${event.args?.id}`);
        console.log(`      Geohash: 0x${geohashValue.toHexString().slice(2).padStart(2, '0')}`);
        console.log(`      Created By: ${event.args?.createdBy}`);
      } else if (event.event === "DataUpdated") {
        const geohashValue = ethers.BigNumber.from(event.args?.geohash || "0x00").shr(248);
        console.log(`   ${i + 1}. DataUpdated:`);
        console.log(`      ID: ${event.args?.id}`);
        console.log(`      Geohash: 0x${geohashValue.toHexString().slice(2).padStart(2, '0')}`);
        console.log(`      Updated By: ${event.args?.updatedBy}`);
      } else {
        console.log(`   ${i + 1}. ${event.event || "Evento desconhecido"}`);
      }
    }
  }

  console.log("\n🎉 Dados iniciais inseridos com sucesso!");
  console.log(`   2 geohashes (0x10, 0x11) associados ao ID: ${id}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

