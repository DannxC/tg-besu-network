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

  console.log("Iniciando inserção de dados iniciais...");

  // Exemplo de inserção de dados
  const geohashes = ["s2fd125", "s2fd126"];
  const minHeight = 90;
  const maxHeight = 200;
  const startTime = Date.now(); // agora, em milissegundos
  const endTime = startTime + (24 * 60 * 60 * 1000); // 24 horas a frente, em milissegundos
  const url = "example1.com";
  const entity = 1;
  const id = 1;

  // Convert geohashes and id to bytes32
  const geohashesBytes32 = geohashes.map(gh => toBytes32(gh));
  const idBytes32 = toBytes32(id.toString());

  let result = await instance.upsertOIR(geohashesBytes32, minHeight, maxHeight, startTime, endTime, url, entity, idBytes32);
  console.log(result);

  result = await instance.upsertOIR(geohashesBytes32, minHeight, maxHeight, startTime, endTime, url, entity, idBytes32);
  console.log(result);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

