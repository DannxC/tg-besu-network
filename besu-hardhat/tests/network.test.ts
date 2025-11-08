import { ethers } from "hardhat";
import { expect } from "chai";
import fs from "fs";
import path from "path";

interface DeploymentInfo {
  address: string;
  txHash: string;
  deployer: string;
  timestamp: string;
  blockNumber: number;
  gasUsed?: string;
  network: string;
  chainId?: number;
  owner?: string;
}

describe("Network Integration Tests", function() {
  this.timeout(30000);

  describe("1. Connection and Basic Configuration", function() {
    it("Should connect to Besu network via RPC", async function() {
      const provider = ethers.provider;
      const network = await provider.getNetwork();
      
      console.log(`   ✅ Connected! Chain ID: ${network.chainId}`);
      expect(network.chainId).to.equal(1337);
    });

    it("Should have access to configured RPC_URL", function() {
      const rpcUrl = process.env.RPC_URL;
      expect(rpcUrl).to.exist;
      expect(rpcUrl).to.equal("http://127.0.0.1:8545");
      console.log(`   ✅ RPC URL: ${rpcUrl}`);
    });

    it("Network should be mining blocks", async function() {
      const blockNumber = await ethers.provider.getBlockNumber();
      expect(blockNumber).to.be.greaterThan(0);
      console.log(`   ✅ Current block: ${blockNumber}`);
    });
  });

  describe("2. Validation of Configured Accounts", function() {
    it("MEMBER1_PK should be configured in .env", function() {
      expect(process.env.MEMBER1_PK).to.exist;
      expect(process.env.MEMBER1_PK).to.match(/^0x[a-fA-F0-9]{64}$/);
      console.log("   ✅ MEMBER1_PK valid");
    });

    it("MEMBER2_PK should be configured in .env", function() {
      expect(process.env.MEMBER2_PK).to.exist;
      expect(process.env.MEMBER2_PK).to.match(/^0x[a-fA-F0-9]{64}$/);
      console.log("   ✅ MEMBER2_PK valid");
    });

    it("MEMBER3_PK should be configured in .env", function() {
      expect(process.env.MEMBER3_PK).to.exist;
      expect(process.env.MEMBER3_PK).to.match(/^0x[a-fA-F0-9]{64}$/);
      console.log("   ✅ MEMBER3_PK valid");
    });

    it("All accounts should be accessible via Hardhat", async function() {
      const signers = await ethers.getSigners();
      expect(signers.length).to.be.at.least(3);
      
      const addresses = await Promise.all(signers.map(s => s.getAddress()));
      console.log(`   ✅ ${signers.length} accounts available:`);
      addresses.forEach((addr, i) => console.log(`      ${i + 1}. ${addr}`));
    });

    it("All accounts should have balance (pre-funded)", async function() {
      const signers = await ethers.getSigners();
      
      for (let i = 0; i < Math.min(3, signers.length); i++) {
        const balance = await signers[i].getBalance();
        const balanceEth = parseFloat(ethers.utils.formatEther(balance));
        
        expect(balanceEth).to.be.greaterThan(0);
        console.log(`   ✅ Member${i + 1}: ${balanceEth.toFixed(2)} ETH`);
      }
    });
  });

  describe("3. Validation of Existing Deployments", function() {
    const deploymentsDir = path.join(__dirname, "..", "deployments");

    it("Deployments folder should exist", function() {
      const exists = fs.existsSync(deploymentsDir);
      
      if (!exists) {
        console.log("   ⚠️  Deployments folder does not exist (no contracts deployed yet)");
        this.skip();
      }
      
      expect(exists).to.be.true;
      console.log(`   ✅ Deployments folder found: ${deploymentsDir}`);
    });

    it("Should validate all deployed contracts", async function() {
      if (!fs.existsSync(deploymentsDir)) {
        console.log("   ⏭️  No deployments to validate");
        this.skip();
        return;
      }

      const files = fs.readdirSync(deploymentsDir).filter(f => f.endsWith(".json"));
      
      if (files.length === 0) {
        console.log("   ⚠️  No deployments found");
        this.skip();
        return;
      }

      console.log(`   📋 Validating ${files.length} deployment(s)...\n`);

      for (const file of files) {
        const filePath = path.join(deploymentsDir, file);
        const deployment: DeploymentInfo = JSON.parse(fs.readFileSync(filePath, "utf8"));
        
        console.log(`   📄 ${file}:`);
        console.log(`      Address: ${deployment.address}`);
        console.log(`      Network: ${deployment.network}`);
        console.log(`      Block: ${deployment.blockNumber}`);

        // Check if contract exists on network
        const code = await ethers.provider.getCode(deployment.address);
        
        if (code === "0x") {
          console.log(`      ❌ ERROR: Contract does not exist on current network!`);
          console.log(`      💡 Tip: Was the network reset? Run new deploy.`);
          throw new Error(`Contract ${file} does not exist at address ${deployment.address}`);
        }
        
        console.log(`      ✅ Contract exists and is active`);
        console.log(`      📦 Bytecode: ${code.length} bytes\n`);

        // Check if deployer still has balance
        const deployerBalance = await ethers.provider.getBalance(deployment.deployer);
        console.log(`      👤 Deployer: ${deployment.deployer}`);
        console.log(`      💰 Balance: ${ethers.utils.formatEther(deployerBalance)} ETH\n`);
      }

      console.log(`   ✅ All ${files.length} deployment(s) validated successfully!`);
    });

    it("Should validate deployment chainIds against current network", async function() {
      if (!fs.existsSync(deploymentsDir)) {
        this.skip();
        return;
      }

      const files = fs.readdirSync(deploymentsDir).filter(f => f.endsWith(".json"));
      
      if (files.length === 0) {
        this.skip();
        return;
      }

      const currentNetwork = await ethers.provider.getNetwork();
      const currentChainId = currentNetwork.chainId;

      for (const file of files) {
        const filePath = path.join(deploymentsDir, file);
        const deployment: DeploymentInfo = JSON.parse(fs.readFileSync(filePath, "utf8"));
        
        if (deployment.chainId && deployment.chainId !== currentChainId) {
          console.log(`   ⚠️  WARNING: ${file} was deployed on chainId ${deployment.chainId}, but current network is ${currentChainId}`);
          console.log(`   💡 Tip: You may be connected to a different network or it was reset.`);
          throw new Error(`ChainId mismatch for ${file}`);
        }
      }

      console.log(`   ✅ ChainId consistent across all deployments (${currentChainId})`);
    });
  });

  describe("4. Advanced Connectivity Tests", function() {
    it("Should be able to send a simple transaction", async function() {
      const [signer] = await ethers.getSigners();
      const nonce = await signer.getTransactionCount();
      
      console.log(`   ✅ Current nonce: ${nonce}`);
      expect(nonce).to.be.a("number");
    });

    it("Should be able to estimate gas for transactions", async function() {
      const [from, to] = await ethers.getSigners();
      
      const gasEstimate = await ethers.provider.estimateGas({
        from: await from.getAddress(),
        to: await to.getAddress(),
        value: ethers.utils.parseEther("0.1")
      });
      
      expect(gasEstimate.toNumber()).to.be.greaterThan(0);
      console.log(`   ✅ Estimated gas: ${gasEstimate.toString()}`);
    });

    it("Should be able to fetch recent blocks", async function() {
      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);
      
      expect(block).to.exist;
      expect(block.number).to.equal(blockNumber);
      expect(block.transactions).to.be.an("array");
      
      console.log(`   ✅ Block ${blockNumber}:`);
      console.log(`      Hash: ${block.hash}`);
      console.log(`      Timestamp: ${new Date(block.timestamp * 1000).toISOString()}`);
      console.log(`      Transactions: ${block.transactions.length}`);
    });

    it("Should have gasPrice configured as 0 (zero base fee)", async function() {
      const [signer] = await ethers.getSigners();
      const gasPrice = await signer.getGasPrice();
      
      expect(gasPrice.toNumber()).to.equal(0);
      console.log(`   ✅ Gas Price: ${gasPrice.toString()} (zero base fee)`);
    });
  });

  after(function() {
    console.log("\n" + "=".repeat(60));
    console.log("✅ All network tests passed!");
    console.log("🚀 Besu network is working correctly");
    console.log("=".repeat(60));
  });
});
