import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("🔌 Conectando à rede Besu...");
  
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const balance = await deployer.getBalance();
  
  const networkName = process.env.HARDHAT_NETWORK || "besu";
  
  console.log("✅ Conectado à rede:", networkName, `(chainId: ${network.chainId})`);
  console.log("\n📋 Informações do Deployer:");
  console.log("  Address:", deployer.address);
  console.log("  Balance:", ethers.utils.formatEther(balance), "ETH");

  console.log("\n🚀 Iniciando deploy do contrato DSS_Storage...");
  
  const DSS_Storage = await ethers.getContractFactory("DSS_Storage");
  const contract = await DSS_Storage.deploy();
  
  console.log("⏳ Aguardando confirmação...");
  await contract.deployed();
  
  // Pegar o receipt para obter o blockNumber
  const receipt = await contract.deployTransaction.wait();

  console.log("\n✅ Deploy concluído com sucesso!");
  console.log("  Contract address:", contract.address);
  console.log("  Deployment tx:", contract.deployTransaction.hash);
  console.log("  Block:", receipt.blockNumber);
  console.log("  Gas usado:", receipt.gasUsed.toString());
  
  // Salvar endereço do contrato em arquivo
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  const deploymentFile = path.join(deploymentsDir, "DSS_Storage.json");
  const deploymentData = {
    address: contract.address,
    txHash: contract.deployTransaction.hash,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
    network: networkName,
    chainId: network.chainId,
    owner: deployer.address
  };
  
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));
  console.log("\n📝 Deployment info salvo em:", deploymentFile);
  
  console.log("\n💡 Owner inicial:", deployer.address);
  console.log("💡 Para testar o contrato, execute:");
  console.log("  npm run test:dss");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
