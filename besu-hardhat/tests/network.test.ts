/**
 * Teste de conexão com a rede Besu
 * Execute com: npm run test:network
 */

import * as dotenv from "dotenv";
import http from "node:http";
dotenv.config();

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";

// Helper para fazer requisições HTTP com timeout
function httpRequest(url: string, body: object, timeoutMs = 5000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 8545,
      path: urlObj.pathname || "/",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": data.length
      },
      timeout: timeoutMs
    };
    
    const req = http.request(options, (res) => {
      let responseData = "";
      
      res.on("data", (chunk) => {
        responseData += chunk;
      });
      
      res.on("end", () => {
        try {
          resolve(JSON.parse(responseData));
        } catch {
          reject(new Error("Invalid JSON response"));
        }
      });
    });
    
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
    
    req.on("error", (err) => {
      reject(err);
    });
    
    req.write(data);
    req.end();
  });
}

async function testNetwork() {
  console.log("🔍 Testando conexão com a rede Besu...\n");
  console.log("📡 RPC URL:", RPC_URL);
  
  try {
    // Testa conexão básica
    console.log("\n1️⃣  Testando conectividade...");
    const chainIdData = await httpRequest(RPC_URL, {
      jsonrpc: "2.0",
      method: "eth_chainId",
      params: [],
      id: 1
    }) as { result: string };
    
    const chainId = parseInt(chainIdData.result, 16);
    console.log("   ✅ Conectado!");
    console.log("   Chain ID:", chainId);
    
    // Pega número do bloco
    console.log("\n2️⃣  Verificando bloco atual...");
    const blockData = await httpRequest(RPC_URL, {
      jsonrpc: "2.0",
      method: "eth_blockNumber",
      params: [],
      id: 2
    }) as { result: string };
    
    const blockNumber = parseInt(blockData.result, 16);
    console.log("   ✅ Bloco atual:", blockNumber);
    
    // Verifica se a rede está minerando
    if (blockNumber > 0) {
      console.log("   ✅ Rede está ativa e minerando");
    }
    
    // Lista contas
    console.log("\n3️⃣  Verificando contas disponíveis...");
    const accountsData = await httpRequest(RPC_URL, {
      jsonrpc: "2.0",
      method: "eth_accounts",
      params: [],
      id: 3
    }) as { result: string[] };
    
    const accounts = accountsData.result || [];
    console.log("   ✅ Contas encontradas:", accounts.length);
    
    if (accounts.length > 0) {
      console.log("   Primeira conta:", accounts[0]);
    }
    
    // Verifica configuração do .env
    console.log("\n4️⃣  Verificando configuração do .env...");
    const memberPk = process.env.MEMBER1_PK;
    const expectedChainId = process.env.CHAIN_ID ? parseInt(process.env.CHAIN_ID) : 1337;
    
    if (memberPk) {
      console.log("   ✅ MEMBER1_PK configurada");
    } else {
      console.log("   ⚠️  MEMBER1_PK não configurada");
    }
    
    if (chainId === expectedChainId) {
      console.log(`   ✅ Chain ID correto (${chainId})`);
    } else {
      console.log(`   ⚠️  Chain ID diferente: esperado ${expectedChainId}, recebido ${chainId}`);
    }
    
    console.log("\n✅ Todos os testes passaram!");
    console.log("\n💡 Próximos passos:");
    console.log("   npm run compile  # Compila os contratos");
    console.log("   npm run deploy   # Faz deploy na rede Besu");
    
  } catch (error) {
    console.error("\n❌ Erro ao conectar com a rede:");
    if (error instanceof Error) {
      console.error("   Mensagem:", error.message);
      
      if (error.message.includes("ECONNREFUSED")) {
        console.error("\n💡 A porta 8545 não está aceitando conexões.");
      } else if (error.message.includes("ECONNRESET")) {
        console.error("\n💡 A conexão foi resetada. A rede pode estar reiniciando.");
      } else if (error.message.includes("timeout")) {
        console.error("\n💡 Timeout na conexão. A rede pode estar lenta ou sobrecarregada.");
      }
    }
    console.error("\n🔧 Soluções:");
    console.error("   1. Verifique se a rede está rodando: docker ps | grep rpcnode");
    console.error("   2. Reinicie a rede: ./restart.sh");
    console.error("   3. Verifique os logs: docker logs rpcnode");
    process.exit(1);
  }
}

void testNetwork();

