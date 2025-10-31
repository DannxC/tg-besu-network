const { ethers } = require("hardhat");

async function main() {
  const [owner] = await ethers.getSigners();
  
  const Factory = await ethers.getContractFactory("DSS_Storage");
  const contract = await Factory.deploy();
  await contract.deployed();
  
  console.log("\n🧪 Teste 1: COM .wait()");
  const start1 = Date.now();
  const tx1 = await contract.allowUser("0x0000000000000000000000000000000000000001");
  await tx1.wait(1);
  const isAllowed1 = await contract.allowedUsers("0x0000000000000000000000000000000000000001");
  console.log(`  ✅ User allowed: ${isAllowed1} (tempo: ${Date.now() - start1}ms)`);
  
  console.log("\n🧪 Teste 2: SEM .wait()");
  const start2 = Date.now();
  const tx2 = await contract.allowUser("0x0000000000000000000000000000000000000002");
  // await tx2.wait(1);  // <-- REMOVIDO
  const isAllowed2 = await contract.allowedUsers("0x0000000000000000000000000000000000000002");
  console.log(`  ✅ User allowed: ${isAllowed2} (tempo: ${Date.now() - start2}ms)`);
  
  console.log("\n🧪 Teste 3: Verificar ambos");
  const check1 = await contract.allowedUsers("0x0000000000000000000000000000000000000001");
  const check2 = await contract.allowedUsers("0x0000000000000000000000000000000000000002");
  console.log(`  User1: ${check1}, User2: ${check2}`);
}

main().catch(console.error);
