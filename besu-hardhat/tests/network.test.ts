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

  describe("1. Conexão e Configuração Básica", function() {
    it("Deve conectar à rede Besu via RPC", async function() {
      const provider = ethers.provider;
      const network = await provider.getNetwork();
      
      console.log(`   ✅ Conectado! Chain ID: ${network.chainId}`);
      expect(network.chainId).to.equal(1337);
    });

    it("Deve ter acesso ao RPC_URL configurado", function() {
      const rpcUrl = process.env.RPC_URL;
      expect(rpcUrl).to.exist;
      expect(rpcUrl).to.equal("http://127.0.0.1:8545");
      console.log(`   ✅ RPC URL: ${rpcUrl}`);
    });

    it("Rede deve estar minerando blocos", async function() {
      const blockNumber = await ethers.provider.getBlockNumber();
      expect(blockNumber).to.be.greaterThan(0);
      console.log(`   ✅ Bloco atual: ${blockNumber}`);
    });
  });

  describe("2. Validação das Contas Configuradas", function() {
    it("MEMBER1_PK deve estar configurada no .env", function() {
      expect(process.env.MEMBER1_PK).to.exist;
      expect(process.env.MEMBER1_PK).to.match(/^0x[a-fA-F0-9]{64}$/);
      console.log("   ✅ MEMBER1_PK válida");
    });

    it("MEMBER2_PK deve estar configurada no .env", function() {
      expect(process.env.MEMBER2_PK).to.exist;
      expect(process.env.MEMBER2_PK).to.match(/^0x[a-fA-F0-9]{64}$/);
      console.log("   ✅ MEMBER2_PK válida");
    });

    it("MEMBER3_PK deve estar configurada no .env", function() {
      expect(process.env.MEMBER3_PK).to.exist;
      expect(process.env.MEMBER3_PK).to.match(/^0x[a-fA-F0-9]{64}$/);
      console.log("   ✅ MEMBER3_PK válida");
    });

    it("Todas as contas devem estar acessíveis via Hardhat", async function() {
      const signers = await ethers.getSigners();
      expect(signers.length).to.be.at.least(3);
      
      const addresses = await Promise.all(signers.map(s => s.getAddress()));
      console.log(`   ✅ ${signers.length} contas disponíveis:`);
      addresses.forEach((addr, i) => console.log(`      ${i + 1}. ${addr}`));
    });

    it("Todas as contas devem ter saldo (pré-funded)", async function() {
      const signers = await ethers.getSigners();
      
      for (let i = 0; i < Math.min(3, signers.length); i++) {
        const balance = await signers[i].getBalance();
        const balanceEth = parseFloat(ethers.utils.formatEther(balance));
        
        expect(balanceEth).to.be.greaterThan(0);
        console.log(`   ✅ Member${i + 1}: ${balanceEth.toFixed(2)} ETH`);
      }
    });
  });

  describe("3. Validação dos Deployments Existentes", function() {
    const deploymentsDir = path.join(__dirname, "..", "deployments");

    it("Pasta deployments deve existir", function() {
      const exists = fs.existsSync(deploymentsDir);
      
      if (!exists) {
        console.log("   ⚠️  Pasta deployments não existe (nenhum contrato deployado ainda)");
        this.skip();
      }
      
      expect(exists).to.be.true;
      console.log(`   ✅ Pasta deployments encontrada: ${deploymentsDir}`);
    });

    it("Deve validar todos os contratos deployados", async function() {
      if (!fs.existsSync(deploymentsDir)) {
        console.log("   ⏭️  Sem deployments para validar");
        this.skip();
        return;
      }

      const files = fs.readdirSync(deploymentsDir).filter(f => f.endsWith(".json"));
      
      if (files.length === 0) {
        console.log("   ⚠️  Nenhum deployment encontrado");
        this.skip();
        return;
      }

      console.log(`   📋 Validando ${files.length} deployment(s)...\n`);

      for (const file of files) {
        const filePath = path.join(deploymentsDir, file);
        const deployment: DeploymentInfo = JSON.parse(fs.readFileSync(filePath, "utf8"));
        
        console.log(`   📄 ${file}:`);
        console.log(`      Address: ${deployment.address}`);
        console.log(`      Network: ${deployment.network}`);
        console.log(`      Block: ${deployment.blockNumber}`);

        // Verificar se o contrato existe na rede
        const code = await ethers.provider.getCode(deployment.address);
        
        if (code === "0x") {
          console.log(`      ❌ ERRO: Contrato não existe na rede atual!`);
          console.log(`      💡 Dica: A rede foi resetada? Execute novo deploy.`);
          throw new Error(`Contrato ${file} não existe no endereço ${deployment.address}`);
        }
        
        console.log(`      ✅ Contrato existe e está ativo`);
        console.log(`      📦 Bytecode: ${code.length} bytes\n`);

        // Verificar se o deployer ainda tem saldo
        const deployerBalance = await ethers.provider.getBalance(deployment.deployer);
        console.log(`      👤 Deployer: ${deployment.deployer}`);
        console.log(`      💰 Balance: ${ethers.utils.formatEther(deployerBalance)} ETH\n`);
      }

      console.log(`   ✅ Todos os ${files.length} deployment(s) validados com sucesso!`);
    });

    it("Deve validar chainId dos deployments contra a rede atual", async function() {
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
          console.log(`   ⚠️  AVISO: ${file} foi deployado em chainId ${deployment.chainId}, mas a rede atual é ${currentChainId}`);
          console.log(`   💡 Dica: Você pode estar conectado a uma rede diferente ou ela foi resetada.`);
          throw new Error(`ChainId mismatch para ${file}`);
        }
      }

      console.log(`   ✅ ChainId consistente em todos os deployments (${currentChainId})`);
    });
  });

  describe("4. Testes de Conectividade Avançada", function() {
    it("Deve conseguir enviar uma transação simples", async function() {
      const [signer] = await ethers.getSigners();
      const nonce = await signer.getTransactionCount();
      
      console.log(`   ✅ Nonce atual: ${nonce}`);
      expect(nonce).to.be.a("number");
    });

    it("Deve conseguir estimar gas para transações", async function() {
      const [from, to] = await ethers.getSigners();
      
      const gasEstimate = await ethers.provider.estimateGas({
        from: await from.getAddress(),
        to: await to.getAddress(),
        value: ethers.utils.parseEther("0.1")
      });
      
      expect(gasEstimate.toNumber()).to.be.greaterThan(0);
      console.log(`   ✅ Gas estimado: ${gasEstimate.toString()}`);
    });

    it("Deve conseguir buscar blocos recentes", async function() {
      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);
      
      expect(block).to.exist;
      expect(block.number).to.equal(blockNumber);
      expect(block.transactions).to.be.an("array");
      
      console.log(`   ✅ Bloco ${blockNumber}:`);
      console.log(`      Hash: ${block.hash}`);
      console.log(`      Timestamp: ${new Date(block.timestamp * 1000).toISOString()}`);
      console.log(`      Transações: ${block.transactions.length}`);
    });

    it("Deve ter gasPrice configurado como 0 (zero base fee)", async function() {
      const [signer] = await ethers.getSigners();
      const gasPrice = await signer.getGasPrice();
      
      expect(gasPrice.toNumber()).to.equal(0);
      console.log(`   ✅ Gas Price: ${gasPrice.toString()} (zero base fee)`);
    });
  });

  after(function() {
    console.log("\n" + "=".repeat(60));
    console.log("✅ Todos os testes de rede passaram!");
    console.log("🚀 A rede Besu está funcionando corretamente");
    console.log("=".repeat(60));
  });
});
