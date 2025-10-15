import { network } from "hardhat";

// passe o endereço que sair do deploy
const ADDRESS = process.env.SIMPLE_STORAGE_ADDR as string;

async function main() {
  if (!ADDRESS) {
    throw new Error("❌ Defina SIMPLE_STORAGE_ADDR no ambiente.\nExemplo: export SIMPLE_STORAGE_ADDR=0x...");
  }

  console.log("🔌 Conectando à rede Besu...");
  const connection = await network.connect();
  console.log(`✅ Conectado à rede: ${connection.networkName}`);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { ethers } = connection as any;
  console.log("📦 Plugin ethers carregado:", !!ethers);
  
  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();
  console.log("👤 Signer:", signerAddress);
  console.log("📄 Contract:", ADDRESS);
  
  const abi = [
    "function get() view returns (uint256)",
    "function set(uint256 x)"
  ];
  const contract = new ethers.Contract(ADDRESS, abi, signer);

  console.log("\n📖 Lendo valor atual...");
  const before = await contract.get();
  console.log("  storedData:", before.toString());

  console.log("\n✍️  Alterando valor para 123...");
  const tx = await contract.set(123n, { gasPrice: 0n });
  console.log("  Tx hash:", tx.hash);
  console.log("⏳ Aguardando confirmação...");
  await tx.wait();
  console.log("✅ Transação confirmada!");

  console.log("\n📖 Lendo novo valor...");
  const after = await contract.get();
  console.log("  storedData:", after.toString());
  
  console.log("\n✨ Interação concluída com sucesso!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
