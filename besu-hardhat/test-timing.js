const { ethers } = require("hardhat");

async function main() {
  const [owner] = await ethers.getSigners();
  
  // Deploy simples
  console.log("🚀 Deploying...");
  const start = Date.now();
  
  const Factory = await ethers.getContractFactory("DSS_Storage");
  const contract = await Factory.deploy();
  await contract.deployed();
  
  const deployTime = Date.now() - start;
  console.log(`✅ Deploy: ${deployTime}ms`);
  
  // TX simples
  console.log("\n🔥 Testando TX...");
  const txStart = Date.now();
  
  const tx = await contract.allowUser("0x0000000000000000000000000000000000000001");
  console.log(`  📤 TX enviada: ${Date.now() - txStart}ms`);
  
  const receipt = await tx.wait(1);
  console.log(`  ✅ Confirmada: ${Date.now() - txStart}ms`);
  console.log(`  ⛽ Gas: ${receipt.gasUsed}`);
  console.log(`  📦 Block: ${receipt.blockNumber}`);
}

main().catch(console.error);
