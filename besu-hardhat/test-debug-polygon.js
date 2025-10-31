const hre = require("hardhat");

async function main() {
  // Dados do erro (15 pontos)
  const latitudes = [
    "0x49cb8e2e465993d0c",
    "0x29877effc791131f2",
    "-0x493901550eef1cc2f4",
    "-0x233b7391ee5009689",
    "-0x4b0b4c7ee9b6eaebf",
    "-0x18904d849f3b2a1a4",
    "0x1d460162f516f0000",
    "-0x9c200756124fffff",
    "-0x25928fcd0c28ed927",
    "0x1688b820474031bbd",
    "0x838fbb702a111bbd",
    "0x33f00806851c131f2",
    "0x206c0719e1b7731f2",
    "0x47f943004b9475340",
    "0x36ccc74ec608b4299"
  ];
  
  const longitudes = [
    "-0x29c5aae9defaa8edbb",
    "-0x91823cf2f060d6d786",
    "-0x56dfcfb1beff8edbb",
    "-0x296cd98bc7981468cc",
    "0x0",
    "0x22e71350510df2879",
    "0x500165183112f2879",
    "-0x1fb5f34318d2103ef",
    "-0x541971c03eb8e2a0",
    "-0x5e292969aa05103ef",
    "-0xb96983fec811305f8",
    "-0xa8c03feac518edbb",
    "0x49c2ac7a8c25e76d6",
    "0x30162747c9acefc10",
    "-0xc482ac6b4b60edbb"
  ];
  
  console.log("Carregando contrato...");
  const contractAddr = "0xfb0707f034433ed00cB9F0Cb4d31c129c60697bA";
  const GeohashConverter = await hre.ethers.getContractFactory("GeohashConverter");
  const contract = GeohashConverter.attach(contractAddr);
  
  console.log("Testando processPolygon com debug=true...");
  
  try {
    // Tentar chamar com debug=false primeiro
    const resultNoDebug = await contract.callStatic.processPolygon(latitudes, longitudes, 4, false);
    console.log("✅ SEM debug funcionou! Geohashes:", resultNoDebug[0].length);
    
    // Agora com debug=true
    const resultDebug = await contract.callStatic.processPolygon(latitudes, longitudes, 4, true);
    console.log("✅ COM debug funcionou! Geohashes:", resultDebug[0].length);
    console.log("   Debug info:", resultDebug[1].length, "itens");
    console.log("   Equivalencies:", resultDebug[2].length);
    
  } catch (error) {
    console.error("❌ ERRO:", error.message);
    
    // Tentar descobrir onde falha
    console.log("\n🔍 Testando bbox...");
    try {
      const bbox = await contract.computeBoundingBox(latitudes, longitudes, 4);
      console.log("✅ BBox OK:", {
        width: bbox.width.toString(),
        height: bbox.height.toString()
      });
    } catch (e) {
      console.error("❌ BBox falhou:", e.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
