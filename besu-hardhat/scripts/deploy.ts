import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("🔌 Conectando à rede Besu...");
  
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const balance = await deployer.getBalance();
  
  console.log("✅ Conectado à rede:", network.name || `chainId ${network.chainId}`);
  console.log("\n📋 Informações do Deployer:");
  console.log("  Address:", deployer.address);
  console.log("  Balance:", ethers.utils.formatEther(balance), "ETH");

  console.log("\n🚀 Iniciando deploy do contrato SimpleStorage...");
  const initialValue = 100;
  console.log("  Valor inicial:", initialValue);
  
  const SimpleStorage = await ethers.getContractFactory("SimpleStorage");
  const contract = await SimpleStorage.deploy(initialValue);
  
  console.log("⏳ Aguardando confirmação...");
  await contract.deployed();
  
  // Pegar o receipt para obter o blockNumber
  const receipt = await contract.deployTransaction.wait();

  console.log("\n✅ Deploy concluído com sucesso!");
  console.log("  Contract address:", contract.address);
  console.log("  Deployment tx:", contract.deployTransaction.hash);
  console.log("  Block:", receipt.blockNumber);
  
  // Salvar endereço do contrato em arquivo
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  const deploymentFile = path.join(deploymentsDir, "SimpleStorage.json");
  const deploymentData = {
    address: contract.address,
    txHash: contract.deployTransaction.hash,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    blockNumber: receipt.blockNumber,
    network: network.name || `chainId-${network.chainId}`,
    constructorArgs: [initialValue]
  };
  
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));
  console.log("\n📝 Deployment info salvo em:", deploymentFile);
  
  console.log("\n💡 Para interagir com o contrato, execute:");
  console.log("  npm run interact");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
