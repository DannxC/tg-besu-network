import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("🔌 Connecting to Besu network...");
  
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const balance = await deployer.getBalance();
  
  const networkName = process.env.HARDHAT_NETWORK || "besu";
  
  console.log("✅ Connected to network:", networkName, `(chainId: ${network.chainId})`);
  console.log("\n📋 Deployer Information:");
  console.log("  Address:", deployer.address);
  console.log("  Balance:", ethers.utils.formatEther(balance), "ETH");

  // ========================================
  // Deploy DSS_Storage
  // ========================================
  console.log("\n🚀 Starting DSS_Storage contract deployment...");
  
  const DSS_Storage = await ethers.getContractFactory("DSS_Storage");
  const dssContract = await DSS_Storage.deploy();
  
  console.log("⏳ Waiting for confirmation...");
  await dssContract.deployed();
  
  const dssReceipt = await dssContract.deployTransaction.wait();

  console.log("\n✅ DSS_Storage deployed!");
  console.log("  Contract address:", dssContract.address);
  console.log("  Deployment tx:", dssContract.deployTransaction.hash);
  console.log("  Block:", dssReceipt.blockNumber);
  console.log("  Gas used:", dssReceipt.gasUsed.toString());

  // ========================================
  // Deploy GeohashConverter
  // ========================================
  console.log("\n🚀 Starting GeohashConverter contract deployment...");
  console.log("⚙️  Setting precision = 4 (area ~124512.23 km² per geohash)");
  
  const GeohashConverter = await ethers.getContractFactory("GeohashConverter");
  const geohashContract = await GeohashConverter.deploy(4); // Precision 4
  
  console.log("⏳ Waiting for confirmation...");
  await geohashContract.deployed();
  
  const geohashReceipt = await geohashContract.deployTransaction.wait();

  console.log("\n✅ GeohashConverter deployed!");
  console.log("  Contract address:", geohashContract.address);
  console.log("  Deployment tx:", geohashContract.deployTransaction.hash);
  console.log("  Block:", geohashReceipt.blockNumber);
  console.log("  Gas used:", geohashReceipt.gasUsed.toString());
  
  // ========================================
  // Save deployments
  // ========================================
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  // DSS_Storage deployment
  const dssDeploymentFile = path.join(deploymentsDir, "DSS_Storage.json");
  const dssDeploymentData = {
    address: dssContract.address,
    txHash: dssContract.deployTransaction.hash,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    blockNumber: dssReceipt.blockNumber,
    gasUsed: dssReceipt.gasUsed.toString(),
    network: networkName,
    chainId: network.chainId,
    owner: deployer.address
  };
  fs.writeFileSync(dssDeploymentFile, JSON.stringify(dssDeploymentData, null, 2));

  // GeohashConverter deployment
  const geohashDeploymentFile = path.join(deploymentsDir, "GeohashConverter.json");
  const geohashDeploymentData = {
    address: geohashContract.address,
    txHash: geohashContract.deployTransaction.hash,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    blockNumber: geohashReceipt.blockNumber,
    gasUsed: geohashReceipt.gasUsed.toString(),
    network: networkName,
    chainId: network.chainId,
    precision: 4
  };
  fs.writeFileSync(geohashDeploymentFile, JSON.stringify(geohashDeploymentData, null, 2));
  
  console.log("\n📝 Deployment info saved to:");
  console.log("  - DSS_Storage:", dssDeploymentFile);
  console.log("  - GeohashConverter:", geohashDeploymentFile);
  
  console.log("\n💡 Summary:");
  console.log("  Initial owner:", deployer.address);
  console.log("  DSS_Storage:", dssContract.address);
  console.log("  GeohashConverter:", geohashContract.address, "(precision: 4)");
  console.log("\n💡 To test:");
  console.log("  npm run test:dss");
  console.log("  npm run dashboard (interactive visual tester)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
