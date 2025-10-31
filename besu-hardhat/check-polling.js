const { ethers } = require("hardhat");

async function main() {
  const provider = ethers.provider;
  
  console.log("📊 Configurações do Provider:");
  console.log("  Network:", await provider.getNetwork());
  console.log("  Polling interval:", provider.pollingInterval, "ms");
  console.log("  Block time estimado:", provider.blockTime || "não configurado");
}

main();
