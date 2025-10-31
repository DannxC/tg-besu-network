const { ethers } = require("hardhat");

async function main() {
  const [owner] = await ethers.getSigners();
  
  const Factory = await ethers.getContractFactory("DSS_Storage");
  const contract = await Factory.deploy();
  await contract.deployed();
  
  console.log("🔥 Teste SEM .wait():");
  const start = Date.now();
  
  // Enviar TX sem wait
  const tx1 = await contract.allowUser("0x0000000000000000000000000000000000000001");
  console.log(`  TX1 enviada: ${Date.now() - start}ms`);
  
  const tx2 = await contract.allowUser("0x0000000000000000000000000000000000000002");
  console.log(`  TX2 enviada: ${Date.now() - start}ms`);
  
  const tx3 = await contract.allowUser("0x0000000000000000000000000000000000000003");
  console.log(`  TX3 enviada: ${Date.now() - start}ms`);
  
  // Aguardar todas em paralelo
  await Promise.all([tx1.wait(1), tx2.wait(1), tx3.wait(1)]);
  console.log(`  ✅ Todas confirmadas: ${Date.now() - start}ms`);
}

main().catch(console.error);
