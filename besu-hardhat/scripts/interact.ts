import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("🔌 Conectando à rede Besu...");
  
  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log("✅ Conectado à rede:", network.name || `chainId ${network.chainId}`);
  console.log("👤 Signer:", signer.address);
  
  // Carregar endereço do contrato deployado
  const deploymentFile = path.join(__dirname, "..", "deployments", "SimpleStorage.json");
  
  if (!fs.existsSync(deploymentFile)) {
    throw new Error("❌ Contrato não encontrado!\n  Execute 'npm run deploy' primeiro.");
  }
  
  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf-8"));
  const contractAddress = deployment.address;
  
  console.log("📄 Contract:", contractAddress);
  console.log("   Deployed by:", deployment.deployer);
  console.log("   Deployed at:", new Date(deployment.timestamp).toLocaleString());
  
  const SimpleStorage = await ethers.getContractAt("SimpleStorage", contractAddress);

  console.log("\n📖 Lendo valor atual...");
  const before = await SimpleStorage.get();
  console.log("  storedData:", before.toString());

  console.log("\n✍️  Alterando valor para 123...");
  const tx = await SimpleStorage.set(123);
  console.log("  Tx hash:", tx.hash);
  console.log("⏳ Aguardando confirmação...");
  const receipt = await tx.wait();
  console.log("✅ Transação confirmada!");
  console.log("  Block:", receipt.blockNumber);
  console.log("  Gas usado:", receipt.gasUsed.toString());

  console.log("\n📖 Lendo novo valor...");
  const after = await SimpleStorage.get();
  console.log("  storedData:", after.toString());
  
  console.log("\n✨ Interação concluída com sucesso!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
