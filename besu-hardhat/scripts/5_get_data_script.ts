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
  // Load deployment info
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  const deploymentFile = path.join(deploymentsDir, "DSS_Storage.json");
  
  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`Deployment file not found: ${deploymentFile}. Please run 'npm run deploy' first.`);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));

  // Connect to contract
  const DSS_StorageFactory = await ethers.getContractFactory("DSS_Storage");
  const instance = DSS_StorageFactory.attach(deployment.address) as DSS_Storage;

  const geohash = "s2fd125";
  const minHeight = 100;
  const maxHeight = 200;
  const startTime = Date.now(); // Agora
  const endTime = startTime + (48 * 60 * 60 * 1000); // 48 horas à frente

  console.log(`Buscando dados para o geohash ${geohash} com altura entre ${minHeight}-${maxHeight} e tempo entre ${startTime} e ${endTime}`);

  // Chamada da função getOIRsByGeohash
  const result = await instance.getOIRsByGeohash(toBytes32(geohash), minHeight, maxHeight, startTime, endTime);

  console.log("Dados recuperados com sucesso:");
  console.log("URLs:", result.urls);
  console.log("EntityNumbers:", result.entityNumbers.map((num: any) => num.toNumber ? num.toNumber() : num));
  console.log("IDs:", result.ids.map((id: any) => id.toString ? id.toString() : id));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

