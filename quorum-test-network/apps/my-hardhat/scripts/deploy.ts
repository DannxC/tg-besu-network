import { network } from "hardhat";

async function main() {
  console.log("🔌 Conectando à rede Besu...");
  const connection = await network.connect();
  console.log(`✅ Conectado à rede: ${connection.networkName}`);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { ethers } = connection as any;
  console.log("📦 Plugin ethers carregado:", !!ethers);
  
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const balance = await ethers.provider.getBalance(deployer);
  
  console.log("\n📋 Informações do Deployer:");
  console.log("  Address:", deployerAddress);
  console.log("  Balance:", balance.toString(), "wei");

  console.log("\n🚀 Iniciando deploy do contrato SimpleStorage...");
  const SimpleStorage = await ethers.getContractFactory("SimpleStorage", deployer);
  
  const initialValue = 100n;
  console.log(`  Valor inicial: ${initialValue}`);
  
  const contract = await SimpleStorage.deploy(initialValue, { gasPrice: 0n });
  console.log("⏳ Aguardando confirmação...");
  await contract.waitForDeployment();

  const addr = await contract.getAddress();
  const txHash = contract.deploymentTransaction()?.hash;
  
  console.log("\n✅ Deploy concluído com sucesso!");
  console.log("  Contract address:", addr);
  console.log("  Deployment tx:", txHash);
  console.log("\n💡 Para interagir com o contrato, execute:");
  console.log(`  export SIMPLE_STORAGE_ADDR=${addr}`);
  console.log("  npm run interact");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
