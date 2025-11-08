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
  const contract = DSS_StorageFactory.attach(deployment.address) as DSS_Storage;

  // Get current and historical block numbers
  const latestBlock = await ethers.provider.getBlockNumber();
  const blockRange = 1000; // Limitar a 1000 blocos por vez
  const historicalBlock = Math.max(1, latestBlock - blockRange);
  
  console.log(`📊 Bloco atual: ${latestBlock} | Buscando desde: ${historicalBlock} (últimos ${latestBlock - historicalBlock} blocos)\n`);
  console.log("🔍 Buscando eventos do contrato...\n");

  // Query for DataAdded events
  const dataAddedFilter = contract.filters.DataAdded();
  const dataAddedEvents = await contract.queryFilter(dataAddedFilter, historicalBlock, latestBlock);

  // Query for DataUpdated events
  const dataUpdatedFilter = contract.filters.DataUpdated();
  const dataUpdatedEvents = await contract.queryFilter(dataUpdatedFilter, historicalBlock, latestBlock);

  // Query for DataDeleted events
  const dataDeletedFilter = contract.filters.DataDeleted();
  const dataDeletedEvents = await contract.queryFilter(dataDeletedFilter, historicalBlock, latestBlock);

  // Display results
  console.log("═══════════════════════════════════════════════════════");
  console.log(`📥 DataAdded Events: ${dataAddedEvents.length}`);
  console.log("═══════════════════════════════════════════════════════\n");
  
  if (dataAddedEvents.length > 0) {
    for (let i = 0; i < dataAddedEvents.length; i++) {
      const event = dataAddedEvents[i];
      const geohashHex = event.args.geohash;
      const geohashValue = ethers.BigNumber.from(geohashHex).shr(248);
      
      console.log(`   ${i + 1}. DataAdded:`);
      console.log(`      Bloco: ${event.blockNumber}`);
      console.log(`      Transaction: ${event.transactionHash}`);
      console.log(`      ID: ${event.args.id}`);
      console.log(`      Geohash: 0x${geohashValue.toHexString().slice(2).padStart(2, '0')}`);
      console.log(`      Created By: ${event.args.createdBy}`);
      console.log("");
    }
  } else {
    console.log("   Nenhum evento encontrado.\n");
  }

  console.log("═══════════════════════════════════════════════════════");
  console.log(`🔄 DataUpdated Events: ${dataUpdatedEvents.length}`);
  console.log("═══════════════════════════════════════════════════════\n");
  
  if (dataUpdatedEvents.length > 0) {
    for (let i = 0; i < dataUpdatedEvents.length; i++) {
      const event = dataUpdatedEvents[i];
      const geohashHex = event.args.geohash;
      const geohashValue = ethers.BigNumber.from(geohashHex).shr(248);
      
      console.log(`   ${i + 1}. DataUpdated:`);
      console.log(`      Bloco: ${event.blockNumber}`);
      console.log(`      Transaction: ${event.transactionHash}`);
      console.log(`      ID: ${event.args.id}`);
      console.log(`      Geohash: 0x${geohashValue.toHexString().slice(2).padStart(2, '0')}`);
      console.log(`      Updated By: ${event.args.updatedBy}`);
      console.log("");
    }
  } else {
    console.log("   Nenhum evento encontrado.\n");
  }

  console.log("═══════════════════════════════════════════════════════");
  console.log(`🗑️  DataDeleted Events: ${dataDeletedEvents.length}`);
  console.log("═══════════════════════════════════════════════════════\n");
  
  if (dataDeletedEvents.length > 0) {
    for (let i = 0; i < dataDeletedEvents.length; i++) {
      const event = dataDeletedEvents[i];
      const geohashHex = event.args.geohash;
      const geohashValue = ethers.BigNumber.from(geohashHex).shr(248);
      
      console.log(`   ${i + 1}. DataDeleted:`);
      console.log(`      Bloco: ${event.blockNumber}`);
      console.log(`      Transaction: ${event.transactionHash}`);
      console.log(`      ID: ${event.args.id}`);
      console.log(`      Geohash: 0x${geohashValue.toHexString().slice(2).padStart(2, '0')}`);
      console.log(`      Deleted By: ${event.args.deletedBy}`);
      console.log("");
    }
  } else {
    console.log("   Nenhum evento encontrado.\n");
  }

  const totalEvents = dataAddedEvents.length + dataUpdatedEvents.length + dataDeletedEvents.length;
  console.log("═══════════════════════════════════════════════════════");
  console.log(`🎉 Busca concluída!`);
  console.log(`📊 Total de eventos encontrados: ${totalEvents}`);
  console.log(`   📥 Adicionados: ${dataAddedEvents.length}`);
  console.log(`   🔄 Atualizados: ${dataUpdatedEvents.length}`);
  console.log(`   🗑️  Deletados: ${dataDeletedEvents.length}`);
  console.log("═══════════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

