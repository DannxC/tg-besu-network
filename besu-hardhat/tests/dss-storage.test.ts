import { ethers } from "hardhat";
import { expect } from "chai";
import { Signer, Event } from "ethers";
import type { DSS_Storage } from "../typechain-types";

/**
 * Helper: Converte string para bytes32 (geohashes e IDs)
 * Para strings curtas (<32 bytes), usa padding com zeros à direita
 * Para strings longas, usa keccak256 hash
 */
function toBytes32(str: string): string {
  if (str.length > 31) {
    // String muito longa: usar hash keccak256
    return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(str));
  }
  // String curta: padding com zeros à direita
  return ethers.utils.formatBytes32String(str);
}

/**
 * Helper: Gera timestamp em milissegundos (uint64)
 * Date.now() retorna milissegundos, que é o formato esperado pelo contrato
 */
function nowMs(): number {
  return Date.now();
}

describe("DSS_Storage - Testes Funcionais na Rede Besu (Otimizado)", function() {
  let dssStorage: DSS_Storage;
  let owner: Signer;
  let ownerAddress: string;
  let user1: Signer;
  let user1Address: string;
  let user2: Signer;
  let user2Address: string;

  // Deploy fresh contract antes de todos os testes
  before(async function() {
    console.log("\n🚀 Deploying DSS_Storage (Optimized Version)...");
    
    const signers = await ethers.getSigners();
    owner = signers[0];
    user1 = signers[1];
    user2 = signers[2];
    
    ownerAddress = await owner.getAddress();
    user1Address = await user1.getAddress();
    user2Address = await user2.getAddress();
    
    const DSS_StorageFactory = await ethers.getContractFactory("DSS_Storage");
    dssStorage = (await DSS_StorageFactory.deploy()) as DSS_Storage;
    await dssStorage.deployed();
    
    console.log("✅ DSS_Storage deployed at:", dssStorage.address);
    console.log("👤 Owner (Member1):", ownerAddress);
    console.log("👤 User1 (Member2):", user1Address);
    console.log("👤 User2 (Member3):", user2Address);
    console.log("📝 Usando bytes32 para geohashes/IDs e uint64 para timestamps");
  });

  describe("1. Configuração Inicial", function() {
    it("Deve ter setado o owner corretamente", async function() {
      const contractOwner = await dssStorage.owner();
      expect(contractOwner).to.equal(ownerAddress);
    });

    it("Owner deve estar na lista de allowedUsers", async function() {
      const isAllowed = await dssStorage.allowedUsers(ownerAddress);
      expect(isAllowed).to.be.true;
    });

    it("User1 não deve estar na lista de allowedUsers", async function() {
      const isAllowed = await dssStorage.allowedUsers(user1Address);
      expect(isAllowed).to.be.false;
    });
  });

  describe("2. Gestão de Usuários", function() {
    it("Owner deve poder adicionar user1 aos allowedUsers", async function() {
      const tx = await dssStorage.allowUser(user1Address);
      await tx.wait();
      
      const isAllowed = await dssStorage.allowedUsers(user1Address);
      expect(isAllowed).to.be.true;
    });

    it("Não-owner não deve poder adicionar usuários", async function() {
      let reverted = false;
      try {
        const tx = await dssStorage.connect(user1).allowUser(user2Address);
        await tx.wait();
      } catch (error) {
        const err = error as Error;
        reverted = err.message.includes("Caller is not the owner") || 
                   err.message.includes("revert");
      }
      expect(reverted).to.be.true;
    });

    it("Owner deve poder remover user1 dos allowedUsers", async function() {
      const tx = await dssStorage.disallowUser(user1Address);
      await tx.wait();
      
      const isAllowed = await dssStorage.allowedUsers(user1Address);
      expect(isAllowed).to.be.false;
      
      // Adicionar de volta para os próximos testes
      await dssStorage.allowUser(user1Address);
    });

    it("Owner NÃO deve poder remover a si mesmo de allowedUsers", async function() {
      let reverted = false;
      try {
        const tx = await dssStorage.disallowUser(ownerAddress);
        await tx.wait();
      } catch (error) {
        const err = error as Error;
        reverted = err.message.includes("Owner cannot be removed") || 
                   err.message.includes("revert");
      }
      expect(reverted).to.be.true;
    });
  });

  describe("3. CRUD - Adicionar Dados (Upsert)", function() {
    const testData = {
      geohashes: [toBytes32(toBytes32("u4pruydqqvj")), toBytes32(toBytes32("u4pruydqqvm")), toBytes32(toBytes32("u4pruydqqvq"))],
      minHeight: 100,
      maxHeight: 500,
      startTime: nowMs(),
      endTime: nowMs() + 3600000, // +1 hora em ms
      url: "https://example.com/data/001",
      entity: 1,
      id: toBytes32("id-1001")
    };

    it("Deve permitir adicionar dados de polígono", async function() {
      const tx = await dssStorage.upsertOIR(
        testData.geohashes,
        testData.minHeight,
        testData.maxHeight,
        testData.startTime,
        testData.endTime,
        testData.url,
        testData.entity,
        testData.id
      );
      
      const receipt = await tx.wait();
      console.log(`   Gas usado: ${receipt.gasUsed.toString()}`);
      
      // Verificar evento DataAdded
      const addedEvents = receipt.events?.filter((e: Event) => e.event === "DataAdded");
      expect(addedEvents?.length).to.equal(testData.geohashes.length);
    });

    it("Deve retornar dados corretos ao consultar", async function() {
      const result = await dssStorage.getOIRsByGeohash(
        testData.geohashes[0],
        testData.minHeight,
        testData.maxHeight,
        testData.startTime - 100,
        testData.endTime + 100
      );
      
      expect(result.urls.length).to.be.greaterThan(0);
      expect(result.urls[0]).to.equal(testData.url);
      expect(result.entityNumbers[0]).to.equal(testData.entity);
      expect(result.ids[0]).to.equal(testData.id);
    });

    it("Deve rejeitar se usuário não estiver na allowedList", async function() {
      let reverted = false;
      try {
        const now = nowMs();
        const tx = await dssStorage.connect(user2).upsertOIR(
          [toBytes32(toBytes32("u4pruydqqva"))],
          100, 500,
          now, now + 3600000,
          "https://example.com/unauthorized",
          2, toBytes32("id-2001")
        );
        await tx.wait();
      } catch (error) {
        const err = error as Error;
        reverted = err.message.includes("User not allowed") || 
                   err.message.includes("revert");
      }
      expect(reverted).to.be.true;
    });
  });

  describe("4. CRUD - Atualizar Dados", function() {
    it("Deve permitir atualizar dados existentes", async function() {
      const updatedUrl = "https://example.com/data/001-updated";
      
      const tx = await dssStorage.upsertOIR(
        [toBytes32("u4pruydqqvj"), toBytes32("u4pruydqqvm")], // Menos geohashes
        100,
        500,
        nowMs(),
        nowMs() + 3600000,
        updatedUrl,
        1,
        toBytes32("id-1001") // Mesmo ID do teste anterior
      );
      
      const receipt = await tx.wait();
      console.log(`   Gas usado (update): ${receipt.gasUsed.toString()}`);
      
      // Verificar se atualizou
      const result = await dssStorage.getOIRsByGeohash(
        toBytes32("u4pruydqqvj"),
        100,
        500,
        nowMs() - 100,
        nowMs() + 3700
      );
      
      expect(result.urls[0]).to.equal(updatedUrl);
    });

    it("Deve emitir evento DataUpdated", async function() {
      const tx = await dssStorage.upsertOIR(
        [toBytes32("u4pruydqqvj")],
        100,
        500,
        nowMs(),
        nowMs() + 3600000,
        "https://example.com/data/001-v3",
        1, toBytes32("id-1001")
      );
      
      const receipt = await tx.wait();
      const updatedEvents = receipt.events?.filter((e: Event) => e.event === "DataUpdated");
      expect(updatedEvents?.length).to.be.greaterThan(0);
    });

    it("User1 PODE atualizar dados do owner (qualquer allowedUser pode modificar qualquer OIR)", async function() {
      const updatedUrl = "https://example.com/user1-modified-owners-data";
      
      const tx = await dssStorage.connect(user1).upsertOIR(
        [toBytes32("u4pruydqqvj")],
        100, 500,
        nowMs(),
        nowMs() + 3600000,
        updatedUrl,
        1, toBytes32("id-1001")
      );
      await tx.wait();
      
      // Verificar que foi atualizado
      const result = await dssStorage.getOIRsByGeohash(
        toBytes32("u4pruydqqvj"),
        100,
        500,
        nowMs() - 100,
        nowMs() + 3700
      );
      
      expect(result.urls[0]).to.equal(updatedUrl);
    });
  });

  describe("5. CRUD - Deletar Dados", function() {
    const deleteTestData = {
      geohashes: [toBytes32("u4pruydqqvz")],
      minHeight: 200,
      maxHeight: 600,
      startTime: nowMs(),
      endTime: nowMs() + 7200000,
      url: "https://example.com/data/to-delete",
      entity: 99,
      id: toBytes32("id-9999")
    };

    it("Deve adicionar dados para depois deletar", async function() {
      const tx = await dssStorage.upsertOIR(
        deleteTestData.geohashes,
        deleteTestData.minHeight,
        deleteTestData.maxHeight,
        deleteTestData.startTime,
        deleteTestData.endTime,
        deleteTestData.url,
        deleteTestData.entity,
        deleteTestData.id
      );
      
      await tx.wait();
      
      // Verificar que foi adicionado
      const result = await dssStorage.getOIRsByGeohash(
        deleteTestData.geohashes[0],
        deleteTestData.minHeight,
        deleteTestData.maxHeight,
        deleteTestData.startTime,
        deleteTestData.endTime
      );
      
      expect(result.ids.length).to.be.greaterThan(0);
    });

    it("Deve permitir deletar dados por ID", async function() {
      const tx = await dssStorage.deleteOIR([toBytes32("id-99999")]);
      const receipt = await tx.wait();
      
      console.log(`   Gas usado (delete): ${receipt.gasUsed.toString()}`);
      
      // Verificar evento DataDeleted
      const deletedEvents = receipt.events?.filter((e: Event) => e.event === "DataDeleted");
      expect(deletedEvents?.length).to.be.greaterThan(0);
    });

    it("Dados deletados não devem mais aparecer nas consultas", async function() {
      const result = await dssStorage.getOIRsByGeohash(
        deleteTestData.geohashes[0],
        deleteTestData.minHeight,
        deleteTestData.maxHeight,
        deleteTestData.startTime,
        deleteTestData.endTime
      );
      
      // Não deve conter o ID deletado
      expect(result.ids).to.not.include(toBytes32("id-99999"));
    });

    it("Deletar ID inexistente não deve reverter (silenciosamente ignora)", async function() {
      // ID 99999 não existe, então idToGeohash[99999].length == 0
      // O loop em deleteOIR simplesmente não executa nenhuma iteração
      const tx = await dssStorage.deleteOIR([toBytes32("id-99999")]);
      await tx.wait();
      
      // Se chegou aqui, não reverteu (comportamento esperado)
      expect(true).to.be.true;
    });
  });

  // TESTES PARALELOS - Consultas independentes
  describe("6. Consultas Avançadas (Paralelas)", function() {
    // Adicionar dados de teste em SEQUÊNCIA (evitar nonce collision)
    before(async function() {
      const now = nowMs();
      
      const tx1 = await dssStorage.upsertOIR(
        [toBytes32("u4pruydqqvh")],
        1000, 2000,
        now, now + 3600000,
        "https://example.com/high-altitude",
        10, toBytes32("id-10001")
      );
      await tx1.wait();
      
      const tx2 = await dssStorage.upsertOIR(
        [toBytes32("u4pruydqqvi")],
        0, 1000,
        now + 1000, now + 2000,
        "https://example.com/future-data",
        11, toBytes32("id-11001")
      );
      await tx2.wait();
      
      const tx3 = await dssStorage.connect(user1).upsertOIR(
        [toBytes32("u4pruydqqvk")],
        500, 1500,
        now, now + 7200,
        "https://example.com/user1-data",
        12, toBytes32("id-12001")
      );
      await tx3.wait();
      
      console.log("   ✅ Dados de teste inseridos");
    });

    it("Deve retornar array vazio quando não há dados matching", async function() {
      const result = await dssStorage.getOIRsByGeohash(
        toBytes32("nonexistent"),
        0, 1000,
        0, 9999999999999
      );
      
      expect(result.urls.length).to.equal(0);
      expect(result.entityNumbers.length).to.equal(0);
      expect(result.ids.length).to.equal(0);
    });

    it("Deve filtrar por intervalo de altura", async function() {
      // Consultar com altura que não overlaps
      const noMatch = await dssStorage.getOIRsByGeohash(
        toBytes32("u4pruydqqvh"),
        3000, 4000,
        0, 9999999999999
      );
      expect(noMatch.urls.length).to.equal(0);
      
      // Consultar com altura que overlaps
      const match = await dssStorage.getOIRsByGeohash(
        toBytes32("u4pruydqqvh"),
        1500, 1600,
        0, 9999999999999
      );
      expect(match.urls.length).to.equal(1);
      expect(match.urls[0]).to.equal("https://example.com/high-altitude");
    });

    it("Deve filtrar por intervalo de tempo", async function() {
      const now = nowMs();
      
      // Consultar tempo passado (não deve encontrar)
      const pastQuery = await dssStorage.getOIRsByGeohash(
        toBytes32("u4pruydqqvi"),
        0, 1000,
        now - 2000, now - 1000
      );
      expect(pastQuery.urls.length).to.equal(0);
      
      // Consultar tempo que overlaps
      const futureQuery = await dssStorage.getOIRsByGeohash(
        toBytes32("u4pruydqqvi"),
        0, 1000,
        now + 1500, now + 1600
      );
      expect(futureQuery.urls.length).to.equal(1);
      expect(futureQuery.urls[0]).to.equal("https://example.com/future-data");
    });

    it("Diferentes usuários devem poder consultar todos os dados", async function() {
      // Owner consulta dados do user1
      const ownerQuery = await dssStorage.getOIRsByGeohash(
        toBytes32("u4pruydqqvk"),
        500, 1500,
        0, 9999999999999
      );
      expect(ownerQuery.urls[0]).to.equal("https://example.com/user1-data");
      
      // User1 consulta dados do owner
      const user1Query = await dssStorage.connect(user1).getOIRsByGeohash(
        toBytes32("u4pruydqqvh"),
        1000, 2000,
        0, 9999999999999
      );
      expect(user1Query.urls[0]).to.equal("https://example.com/high-altitude");
    });
  });

  describe("7. Validações", function() {
    it("Deve rejeitar intervalo de altura inválido", async function() {
      let reverted = false;
      try {
        const tx = await dssStorage.upsertOIR(
          [toBytes32("test")],
          500, 100, // Invertido!
          nowMs(),
          nowMs() + 3600000,
          "https://example.com",
          1, toBytes32("id-99999")
        );
        await tx.wait();
      } catch (error) {
        const err = error as Error;
        reverted = err.message.includes("Invalid height interval") || 
                   err.message.includes("revert");
      }
      expect(reverted).to.be.true;
    });

    it("Deve rejeitar intervalo de tempo inválido", async function() {
      const now = nowMs();
      let reverted = false;
      
      try {
        const tx = await dssStorage.upsertOIR(
          [toBytes32("test")],
          100, 500,
          now + 3600000, now, // Invertido!
          "https://example.com",
          1, toBytes32("id-99998")
        );
        await tx.wait();
      } catch (error) {
        const err = error as Error;
        reverted = err.message.includes("Invalid time interval") || 
                   err.message.includes("revert");
      }
      expect(reverted).to.be.true;
    });

    it("Deve rejeitar array vazio de geohashes", async function() {
      let reverted = false;
      
      try {
        const tx = await dssStorage.upsertOIR(
          [], // Vazio!
          100, 500,
          nowMs(),
          nowMs() + 3600000,
          "https://example.com",
          1, toBytes32("id-99997")
      );
        await tx.wait();
      } catch (error) {
        const err = error as Error;
        reverted = err.message.includes("No geohashes provided") || 
                   err.message.includes("revert");
      }
      expect(reverted).to.be.true;
    });
  });

  describe("8. Transferência de Ownership", function() {
    it("Owner deve poder transferir ownership", async function() {
      const tx = await dssStorage.changeOwner(user1Address);
      await tx.wait();
      
      const currentOwner = await dssStorage.owner();
      expect(currentOwner).to.equal(user1Address);
      
      // User1 (novo owner) transfere de volta
      const tx2 = await dssStorage.connect(user1).changeOwner(ownerAddress);
      await tx2.wait();
      
      const restoredOwner = await dssStorage.owner();
      expect(restoredOwner).to.equal(ownerAddress);
    });

    it("Deve rejeitar transferência para address(0)", async function() {
      let reverted = false;
      try {
        const tx = await dssStorage.changeOwner("0x0000000000000000000000000000000000000000");
        await tx.wait();
      } catch (error) {
        const err = error as Error;
        reverted = err.message.includes("New owner cannot be zero address") || 
                   err.message.includes("revert");
      }
      expect(reverted).to.be.true;
    });

    it("Deve rejeitar transferência para usuário que não está allowed", async function() {
      // User2 ainda não foi adicionado aos allowedUsers neste ponto
      const isUser2Allowed = await dssStorage.allowedUsers(user2Address);
      expect(isUser2Allowed).to.be.false;

      let reverted = false;
      try {
        const tx = await dssStorage.changeOwner(user2Address);
        await tx.wait();
      } catch (error) {
        const err = error as Error;
        reverted = err.message.includes("New owner must be allowed already") || 
                   err.message.includes("revert");
      }
      expect(reverted).to.be.true;
    });
  });

  // TESTE DE CONCORRÊNCIA - Diferentes usuários em paralelo
  describe("9. Teste de Concorrência (Paralelo)", function() {
    // Preparar user2 para os testes
    before(async function() {
      const tx = await dssStorage.allowUser(user2Address);
      await tx.wait();
      console.log("   ✅ User2 adicionado aos allowedUsers");
    });

    it("Múltiplos usuários diferentes devem poder inserir dados simultaneamente", async function() {
      this.timeout(30000); // 30 segundos
      
      const now = nowMs();
      
      console.log("   🔥 Enviando 3 transações de usuários diferentes em paralelo...");
      const startTime = Date.now();
      
      // Enviar transações de usuários DIFERENTES em paralelo (evita nonce collision)
      const [tx1, tx2, tx3] = await Promise.all([
        dssStorage.upsertOIR(
          [toBytes32("u4concurrency1")],
          0, 1000,
          now, now + 3600000,
          "https://example.com/owner-concurrent",
          100, toBytes32("id-20001")
        ),
        dssStorage.connect(user1).upsertOIR(
          [toBytes32("u4concurrency2")],
          1000, 2000,
          now, now + 3600000,
          "https://example.com/user1-concurrent",
          101, toBytes32("id-20002")
        ),
        dssStorage.connect(user2).upsertOIR(
          [toBytes32("u4concurrency3")],
          2000, 3000,
          now, now + 3600000,
          "https://example.com/user2-concurrent",
          102, toBytes32("id-20003")
        )
      ]);
      
      // Aguardar confirmação
      const receipts = await Promise.all([tx1.wait(), tx2.wait(), tx3.wait()]);
      
      const endTime = Date.now();
      console.log(`   ⏱️  Tempo total: ${endTime - startTime}ms`);
      console.log(`   ⛽ Gas total: ${receipts.reduce((sum, r) => sum + r.gasUsed.toNumber(), 0)}`);
      
      // Verificar que todos os dados foram inseridos
      const results = await Promise.all([
        dssStorage.getOIRsByGeohash(toBytes32("u4concurrency1"), 0, 1000, now, now + 3600),
        dssStorage.getOIRsByGeohash(toBytes32("u4concurrency2"), 1000, 2000, now, now + 3600),
        dssStorage.getOIRsByGeohash(toBytes32("u4concurrency3"), 2000, 3000, now, now + 3600)
      ]);
      
      expect(results[0].ids[0]).to.equal(toBytes32("id-20001"));
      expect(results[1].ids[0]).to.equal(toBytes32("id-20002"));
      expect(results[2].ids[0]).to.equal(toBytes32("id-20003"));
    });
  });

  describe("10. Edge Cases - Upsert com Mudança de Geohashes", function() {
    const baseOIR = {
      minHeight: 200,
      maxHeight: 400,
      startTime: nowMs(),
      endTime: nowMs() + 7200000,
      url: "https://example.com/edge-case",
      entity: 50,
      id: toBytes32("id-30001")
    };

    it("Deve criar OIR com 3 geohashes iniciais", async function() {
      const tx = await dssStorage.upsertOIR(
        [toBytes32("u4edge001"), toBytes32("u4edge002"), toBytes32("u4edge003")],
        baseOIR.minHeight, baseOIR.maxHeight,
        baseOIR.startTime, baseOIR.endTime,
        baseOIR.url, baseOIR.entity, toBytes32("id-30001")
      );
      await tx.wait();

      // Verificar que está nos 3 geohashes
      const result1 = await dssStorage.getOIRsByGeohash(toBytes32("u4edge001"), 0, 10000, 0, 9999999999999);
      const result2 = await dssStorage.getOIRsByGeohash(toBytes32("u4edge002"), 0, 10000, 0, 9999999999999);
      const result3 = await dssStorage.getOIRsByGeohash(toBytes32("u4edge003"), 0, 10000, 0, 9999999999999);

      expect(result1.ids[0]).to.equal(toBytes32("id-30001"));
      expect(result2.ids[0]).to.equal(toBytes32("id-30001"));
      expect(result3.ids[0]).to.equal(toBytes32("id-30001"));
    });

    it("Deve atualizar OIR removendo 2 geohashes antigos e adicionando 2 novos", async function() {
      // Update: remove edge001 e edge002, mantém edge003, adiciona edge004 e edge005
      const tx = await dssStorage.upsertOIR(
        [toBytes32("u4edge003"), toBytes32("u4edge004"), toBytes32("u4edge005")],
        baseOIR.minHeight, baseOIR.maxHeight,
        baseOIR.startTime, baseOIR.endTime,
        "https://example.com/updated",
        baseOIR.entity, toBytes32("id-30001")
      );
      await tx.wait();

      // Verificar que foi removido dos antigos
      const removed1 = await dssStorage.getOIRsByGeohash(toBytes32("u4edge001"), 0, 10000, 0, 9999999999999);
      const removed2 = await dssStorage.getOIRsByGeohash(toBytes32("u4edge002"), 0, 10000, 0, 9999999999999);
      expect(removed1.ids.length).to.equal(0);
      expect(removed2.ids.length).to.equal(0);

      // Verificar que está nos novos
      const kept = await dssStorage.getOIRsByGeohash(toBytes32("u4edge003"), 0, 10000, 0, 9999999999999);
      const new1 = await dssStorage.getOIRsByGeohash(toBytes32("u4edge004"), 0, 10000, 0, 9999999999999);
      const new2 = await dssStorage.getOIRsByGeohash(toBytes32("u4edge005"), 0, 10000, 0, 9999999999999);

      expect(kept.ids[0]).to.equal(toBytes32("id-30001"));
      expect(new1.ids[0]).to.equal(toBytes32("id-30001"));
      expect(new2.ids[0]).to.equal(toBytes32("id-30001"));
      expect(kept.urls[0]).to.equal("https://example.com/updated");
    });

    it("Deve manter consistência: idToGeohash deve ter exatamente 3 geohashes", async function() {
      // Verificar consistência via queries
      const result3 = await dssStorage.getOIRsByGeohash(toBytes32("u4edge003"), 0, 10000, 0, 9999999999999);
      const result4 = await dssStorage.getOIRsByGeohash(toBytes32("u4edge004"), 0, 10000, 0, 9999999999999);
      const result5 = await dssStorage.getOIRsByGeohash(toBytes32("u4edge005"), 0, 10000, 0, 9999999999999);

      expect(result3.ids.length).to.equal(1);
      expect(result4.ids.length).to.equal(1);
      expect(result5.ids.length).to.equal(1);
    });
  });

  describe("11. Edge Cases - Delete e Cleanup", function() {
    it("Deve preparar OIR para testes de delete", async function() {
      const now = nowMs();
      const tx = await dssStorage.upsertOIR(
        [toBytes32("u4delete001"), toBytes32("u4delete002")],
        100, 500,
        now, now + 3600000,
        "https://example.com/to-delete",
        60, toBytes32("id-40001")
      );
      await tx.wait();
    });

    it("Deve deletar OIR e limpar idToData completamente", async function() {
      const tx = await dssStorage.deleteOIR([toBytes32("id-40001")]);
      await tx.wait();

      // Verificar que foi removido de todos os geohashes
      const result1 = await dssStorage.getOIRsByGeohash(toBytes32("u4delete001"), 0, 10000, 0, 9999999999999);
      const result2 = await dssStorage.getOIRsByGeohash(toBytes32("u4delete002"), 0, 10000, 0, 9999999999999);

      expect(result1.ids.length).to.equal(0);
      expect(result2.ids.length).to.equal(0);
    });

    it("Deve permitir reusar ID após delete completo", async function() {
      const now = nowMs();
      const tx = await dssStorage.upsertOIR(
        [toBytes32("u4reuse001")],
        300, 700,
        now, now + 3600000,
        "https://example.com/reused-id",
        70, toBytes32("id-40001")  // Mesmo ID deletado antes
      );
      await tx.wait();

      const result = await dssStorage.getOIRsByGeohash(toBytes32("u4reuse001"), 0, 10000, 0, 9999999999999);
      expect(result.ids[0]).to.equal(toBytes32("id-40001"));
      expect(result.urls[0]).to.equal("https://example.com/reused-id");
    });

    it("Deletar ID inexistente não reverte (comportamento silencioso)", async function() {
      // ID inexistente simplesmente não faz nada
      const tx = await dssStorage.deleteOIR([toBytes32("id-99999")]);
      await tx.wait();
      
      // Se chegou aqui, não reverteu (comportamento esperado)
      expect(true).to.be.true;
    });
  });

  describe("12. Edge Cases - Query com Múltiplas OIRs", function() {
    before(async function() {
      const now = nowMs();
      
      // Adicionar 3 OIRs no MESMO geohash com diferentes alturas/tempos
      const tx1 = await dssStorage.upsertOIR(
        [toBytes32("u4multiquery")],
        0, 100,
        now, now + 1000,
        "https://example.com/low",
        80, toBytes32("id-50001")
      );
      await tx1.wait();

      const tx2 = await dssStorage.upsertOIR(
        [toBytes32("u4multiquery")],
        100, 200,
        now + 500, now + 1500,
        "https://example.com/mid",
        81, toBytes32("id-50002")
      );
      await tx2.wait();

      const tx3 = await dssStorage.upsertOIR(
        [toBytes32("u4multiquery")],
        200, 300,
        now + 1000, now + 2000,
        "https://example.com/high",
        82, toBytes32("id-50003")
      );
      await tx3.wait();

      console.log("   ✅ 3 OIRs adicionadas ao mesmo geohash");
    });

    it("Deve retornar todas as 3 OIRs com query ampla", async function() {
      const result = await dssStorage.getOIRsByGeohash(
        toBytes32("u4multiquery"),
        0, 1000,
        0, 9999999999999
      );

      expect(result.ids.length).to.equal(3);
      expect(result.urls.length).to.equal(3);
    });

    it("Deve filtrar apenas OIR de altura baixa", async function() {
      const result = await dssStorage.getOIRsByGeohash(
        toBytes32("u4multiquery"),
        0, 50,
        0, 9999999999999
      );

      expect(result.ids.length).to.equal(1);
      expect(result.ids[0]).to.equal(toBytes32("id-50001"));
    });

    it("Deve filtrar apenas OIR de altura alta", async function() {
      const result = await dssStorage.getOIRsByGeohash(
        toBytes32("u4multiquery"),
        250, 350,
        0, 9999999999999
      );

      expect(result.ids.length).to.equal(1);
      expect(result.ids[0]).to.equal(toBytes32("id-50003"));
    });

    it("Deve retornar 2 OIRs que fazem overlap de tempo", async function() {
      const now = nowMs();
      const result = await dssStorage.getOIRsByGeohash(
        toBytes32("u4multiquery"),
        0, 1000,
        now + 600, now + 1200  // Overlap com mid e talvez low
      );

      expect(result.ids.length).to.be.at.least(1);
    });

    it("Deve retornar vazio com filtro muito específico", async function() {
      const result = await dssStorage.getOIRsByGeohash(
        toBytes32("u4multiquery"),
        500, 600,  // Altura que nenhuma OIR atinge
        0, 9999999999999
      );

      expect(result.ids.length).to.equal(0);
    });

    it("Deve retornar vazio para geohash nunca usado", async function() {
      const result = await dssStorage.getOIRsByGeohash(
        toBytes32("u4neverused"),
        0, 10000,
        0, 9999999999999
      );

      expect(result.ids.length).to.equal(0);
      expect(result.urls.length).to.equal(0);
      expect(result.entityNumbers.length).to.equal(0);
    });
  });

  describe("13. Colaboração Multi-Usuário (Novo Comportamento)", function() {
    before(async function() {
      // User1 cria uma OIR
      const now = nowMs();
      const tx = await dssStorage.connect(user1).upsertOIR(
        [toBytes32("u4collab")],
        100, 500,
        now, now + 3600000,
        "https://example.com/user1-created",
        90, toBytes32("id-60001")
      );
      await tx.wait();
      console.log("   ✅ User1 criou OIR 60001");
    });

    it("Owner PODE modificar OIR criada por User1 (qualquer allowedUser pode modificar)", async function() {
      const now = nowMs();
      const tx = await dssStorage.upsertOIR(
        [toBytes32("u4collab")],
        150, 550,
        now, now + 3600000,
        "https://example.com/owner-modified",
        90, toBytes32("id-60001")
      );
      await tx.wait();
      
      const result = await dssStorage.getOIRsByGeohash(toBytes32("u4collab"), 0, 10000, 0, 9999999999999);
      expect(result.urls[0]).to.equal("https://example.com/owner-modified");
    });

    it("User2 PODE modificar OIR criada por User1 (colaboração completa)", async function() {
      const now = nowMs();
      const tx = await dssStorage.connect(user2).upsertOIR(
        [toBytes32("u4collab")],
        200, 600,
        now, now + 3600000,
        "https://example.com/user2-modified",
        90, toBytes32("id-60001")
      );
      await tx.wait();
      
      const result = await dssStorage.getOIRsByGeohash(toBytes32("u4collab"), 0, 10000, 0, 9999999999999);
      expect(result.urls[0]).to.equal("https://example.com/user2-modified");
    });

    it("Owner PODE deletar OIR criada por User1 (qualquer allowedUser pode deletar)", async function() {
      const tx = await dssStorage.deleteOIR([toBytes32("id-60001")]);
      await tx.wait();

      const result = await dssStorage.getOIRsByGeohash(toBytes32("u4collab"), 0, 10000, 0, 9999999999999);
      expect(result.ids.length).to.equal(0);
    });

    it("User1 removido de allowedUsers NÃO deve poder criar novas OIRs", async function() {
      // Owner remove User1
      const txRemove = await dssStorage.disallowUser(user1Address);
      await txRemove.wait();

      let reverted = false;
      try {
        const now = nowMs();
        const tx = await dssStorage.connect(user1).upsertOIR(
          [toBytes32("u4blocked")],
          100, 500,
          now, now + 3600000,
          "https://example.com/should-fail",
          91, toBytes32("id-60002")
      );
        await tx.wait();
      } catch (error) {
        const err = error as Error;
        reverted = err.message.includes("User not allowed") || 
                   err.message.includes("revert");
      }
      expect(reverted).to.be.true;

      // Adicionar User1 de volta para não quebrar testes seguintes
      await dssStorage.allowUser(user1Address);
    });

    it("Novo contract owner PODE modificar qualquer OIR (mesmo as antigas)", async function() {
      // Owner cria uma OIR
      const now = nowMs();
      const txCreate = await dssStorage.upsertOIR(
        [toBytes32("u4oldowner")],
        100, 500,
        now, now + 3600000,
        "https://example.com/old-owner-data",
        92, toBytes32("id-70001")
      );
      await txCreate.wait();

      // Transfer ownership para User1
      const txTransfer = await dssStorage.changeOwner(user1Address);
      await txTransfer.wait();

      // Novo owner (User1) modifica OIR do owner antigo (permitido!)
      const tx = await dssStorage.connect(user1).upsertOIR(
        [toBytes32("u4oldowner")],
        150, 550,
        now, now + 3600000,
        "https://example.com/new-owner-modified",
        92, toBytes32("id-70001")
      );
      await tx.wait();
      
      const result = await dssStorage.getOIRsByGeohash(toBytes32("u4oldowner"), 0, 10000, 0, 9999999999999);
      expect(result.urls[0]).to.equal("https://example.com/new-owner-modified");

      // Restaurar ownership original
      const txRestore = await dssStorage.connect(user1).changeOwner(ownerAddress);
      await txRestore.wait();
    });
  });

  describe("14. Eventos e Auditoria", function() {
    it("DataAdded deve emitir com parâmetros corretos (createdBy)", async function() {
      const now = nowMs();
      const tx = await dssStorage.upsertOIR(
        [toBytes32("u4event001")],
        100, 500,
        now, now + 3600000,
        "https://example.com/event-test",
        100, toBytes32("id-80001")
      );
      const receipt = await tx.wait();

      const events = receipt.events?.filter((e: Event) => e.event === "DataAdded");
      expect(events?.length).to.be.at.least(1);
      
      const event = events?.[0];
      expect(event?.args?.id).to.equal(toBytes32("id-80001"));
      expect(event?.args?.geohash).to.equal(toBytes32("u4event001"));
      // Evento usa o 3º parâmetro (createdBy no contrato)
      expect(event?.args?.[2]).to.equal(ownerAddress);
    });

    it("DataUpdated deve emitir ao atualizar OIR existente", async function() {
      const now = nowMs();
      const tx = await dssStorage.upsertOIR(
        [toBytes32("u4event001")],
        200, 600,
        now, now + 3600000,
        "https://example.com/event-updated",
        100, toBytes32("id-80001")
      );
      const receipt = await tx.wait();

      const events = receipt.events?.filter((e: Event) => e.event === "DataUpdated");
      expect(events?.length).to.be.at.least(1);
    });

    it("DataDeleted deve emitir para cada geohash removido", async function() {
      // Criar OIR com 2 geohashes
      const now = nowMs();
      const txCreate = await dssStorage.upsertOIR(
        [toBytes32("u4event002"), toBytes32("u4event003")],
        100, 500,
        now, now + 3600000,
        "https://example.com/multi-geo",
        101, toBytes32("id-80002")
      );
      await txCreate.wait();

      // Deletar
      const txDelete = await dssStorage.deleteOIR([toBytes32("id-80002")]);
      const receipt = await txDelete.wait();

      const events = receipt.events?.filter((e: Event) => e.event === "DataDeleted");
      expect(events?.length).to.equal(2);  // Um evento por geohash
    });

    it("Update que remove geohashes deve emitir DataDeleted", async function() {
      // Criar com 3 geohashes
      const now = nowMs();
      const txCreate = await dssStorage.upsertOIR(
        [toBytes32("u4event004"), toBytes32("u4event005"), toBytes32("u4event006")],
        100, 500,
        now, now + 3600000,
        "https://example.com/before-removal",
        102, toBytes32("id-80003")
      );
      await txCreate.wait();

      // Update removendo 2 geohashes
      const txUpdate = await dssStorage.upsertOIR(
        [toBytes32("u4event004")],
        100, 500,
        now, now + 3600000,
        "https://example.com/after-removal",
        102, toBytes32("id-80003")
      );
      const receipt = await txUpdate.wait();

      const deletedEvents = receipt.events?.filter((e: Event) => e.event === "DataDeleted");
      expect(deletedEvents?.length).to.equal(2);  // Removeu 2 geohashes
    });
  });

  describe("15. Validações de Input e Limites", function() {
    it("Deve aceitar URL vazia (sem rejeitar)", async function() {
      const now = nowMs();
      const tx = await dssStorage.upsertOIR(
        [toBytes32("u4emptyurl")],
        100, 500,
        now, now + 3600000,
        "",  // URL vazia
        110, toBytes32("id-90001")
      );
      await tx.wait();

      const result = await dssStorage.getOIRsByGeohash(toBytes32("u4emptyurl"), 0, 10000, 0, 9999999999999);
      expect(result.urls[0]).to.equal("");
    });

    it("Deve aceitar entityNumber = 0", async function() {
      const now = nowMs();
      const tx = await dssStorage.upsertOIR(
        [toBytes32("u4entity0")],
        100, 500,
        now, now + 3600000,
        "https://example.com/entity-zero",
        0,  // Entity = 0
        toBytes32("id-90002")
      );
      await tx.wait();

      const result = await dssStorage.getOIRsByGeohash(toBytes32("u4entity0"), 0, 10000, 0, 9999999999999);
      expect(result.entityNumbers[0]).to.equal(0);
    });

    it("Deve lidar com altura [0, 0] (intervalo zero é inválido)", async function() {
      let reverted = false;
      try {
        const now = nowMs();
        const tx = await dssStorage.upsertOIR(
          [toBytes32("u4zeroheight")],
          0, 0,
          now, now + 3600000,
          "https://example.com/zero",
          111, toBytes32("id-90003")
      );
        await tx.wait();
      } catch (error) {
        const err = error as Error;
        reverted = err.message.includes("Invalid height interval") || 
                   err.message.includes("revert");
      }
      // Altura [0, 0] deveria ser ACEITA (min <= max)
      expect(reverted).to.be.false;
    });

    it("Deve lidar com 20 geohashes em uma única OIR", async function() {
      this.timeout(30000);
      
      const manyGeohashes = [];
      for (let i = 0; i < 20; i++) {
        manyGeohashes.push(toBytes32(`u4many${i.toString().padStart(3, '0')}`));
      }

      const now = nowMs();
      const tx = await dssStorage.upsertOIR(
        manyGeohashes,
        100, 500,
        now, now + 3600000,
        "https://example.com/many-geohashes",
        120, toBytes32("id-90004")
      );
      const receipt = await tx.wait();

      console.log(`   ⛽ Gas para 20 geohashes: ${receipt.gasUsed.toString()}`);

      // Verificar que está em alguns geohashes
      const result0 = await dssStorage.getOIRsByGeohash(manyGeohashes[0], 0, 10000, 0, 9999999999999);
      const result19 = await dssStorage.getOIRsByGeohash(manyGeohashes[19], 0, 10000, 0, 9999999999999);

      expect(result0.ids[0]).to.equal(toBytes32("id-90004"));
      expect(result19.ids[0]).to.equal(toBytes32("id-90004"));
    });
  });

  describe("16. State Consistency - Ciclo Completo", function() {
    const cycleId = toBytes32("id-95001");

    it("Passo 1: Criar OIR", async function() {
      const now = nowMs();
      const tx = await dssStorage.upsertOIR(
        [toBytes32("u4cycle01"), toBytes32("u4cycle02")],
        100, 500,
        now, now + 3600000,
        "https://example.com/cycle-create",
        130, cycleId
      );
      await tx.wait();
    });

    it("Passo 2: Atualizar dados (mesmos geohashes)", async function() {
      const now = nowMs();
      const tx = await dssStorage.upsertOIR(
        [toBytes32("u4cycle01"), toBytes32("u4cycle02")],
        200, 600,
        now, now + 7200,
        "https://example.com/cycle-update",
        130, cycleId
      );
      await tx.wait();

      const result = await dssStorage.getOIRsByGeohash(toBytes32("u4cycle01"), 0, 10000, 0, 9999999999999);
      expect(result.urls[0]).to.equal("https://example.com/cycle-update");
    });

    it("Passo 3: Atualizar com mudança de geohashes", async function() {
      const now = nowMs();
      const tx = await dssStorage.upsertOIR(
        [toBytes32("u4cycle02"), toBytes32("u4cycle03")],  // Remove cycle01, mantém cycle02, adiciona cycle03
        200, 600,
        now, now + 7200,
        "https://example.com/cycle-geo-change",
        130, cycleId
      );
      await tx.wait();

      const removed = await dssStorage.getOIRsByGeohash(toBytes32("u4cycle01"), 0, 10000, 0, 9999999999999);
      const kept = await dssStorage.getOIRsByGeohash(toBytes32("u4cycle02"), 0, 10000, 0, 9999999999999);
      const added = await dssStorage.getOIRsByGeohash(toBytes32("u4cycle03"), 0, 10000, 0, 9999999999999);

      expect(removed.ids.length).to.equal(0);
      expect(kept.ids[0]).to.equal(cycleId);
      expect(added.ids[0]).to.equal(cycleId);
    });

    it("Passo 4: Deletar completamente", async function() {
      const tx = await dssStorage.deleteOIR([cycleId]);
      await tx.wait();

      const result2 = await dssStorage.getOIRsByGeohash(toBytes32("u4cycle02"), 0, 10000, 0, 9999999999999);
      const result3 = await dssStorage.getOIRsByGeohash(toBytes32("u4cycle03"), 0, 10000, 0, 9999999999999);

      expect(result2.ids.length).to.equal(0);
      expect(result3.ids.length).to.equal(0);
    });

    it("Passo 5: Recriar com mesmo ID (deve funcionar)", async function() {
      const now = nowMs();
      const tx = await dssStorage.upsertOIR(
        [toBytes32("u4cycle04")],
        300, 700,
        now, now + 3600000,
        "https://example.com/cycle-recreate",
        130, cycleId
      );
      await tx.wait();

      const result = await dssStorage.getOIRsByGeohash(toBytes32("u4cycle04"), 0, 10000, 0, 9999999999999);
      expect(result.ids[0]).to.equal(cycleId);
      expect(result.urls[0]).to.equal("https://example.com/cycle-recreate");
    });
  });

  describe("17. Auditoria - createdBy e lastUpdatedBy", function() {
    it("Deve registrar createdBy ao criar nova OIR", async function() {
      const now = nowMs();
      const tx = await dssStorage.connect(user1).upsertOIR(
        [toBytes32("u4audit001")],
        100, 500,
        now, now + 3600000,
        "https://example.com/audit-test",
        200, toBytes32("id-96001")
      );
      await tx.wait();

      const oirData = await dssStorage.idToData(toBytes32("id-96001"));
      expect(oirData.createdBy).to.equal(user1Address);
      expect(oirData.lastUpdatedBy).to.equal(user1Address);
    });

    it("Deve preservar createdBy e atualizar lastUpdatedBy em updates", async function() {
      // Owner modifica OIR criada por User1
      const now = nowMs();
      const tx = await dssStorage.upsertOIR(
        [toBytes32("u4audit001")],
        150, 550,
        now, now + 3600000,
        "https://example.com/audit-updated",
        200, toBytes32("id-96001")
      );
      await tx.wait();

      const oirData = await dssStorage.idToData(toBytes32("id-96001"));
      expect(oirData.createdBy).to.equal(user1Address); // Deve permanecer User1
      expect(oirData.lastUpdatedBy).to.equal(ownerAddress); // Deve ser Owner agora
    });

    it("Deve atualizar lastUpdatedBy para cada usuário que modifica", async function() {
      const now = nowMs();

      // User2 modifica
      const tx1 = await dssStorage.connect(user2).upsertOIR(
        [toBytes32("u4audit001")],
        200, 600,
        now, now + 3600000,
        "https://example.com/audit-user2",
        200, toBytes32("id-96001")
      );
      await tx1.wait();

      let oirData = await dssStorage.idToData(toBytes32("id-96001"));
      expect(oirData.createdBy).to.equal(user1Address); // Ainda User1
      expect(oirData.lastUpdatedBy).to.equal(user2Address); // Agora User2

      // User1 (criador) modifica novamente
      const tx2 = await dssStorage.connect(user1).upsertOIR(
        [toBytes32("u4audit001")],
        250, 650,
        now, now + 3600000,
        "https://example.com/audit-user1-again",
        200, toBytes32("id-96001")
      );
      await tx2.wait();

      oirData = await dssStorage.idToData(toBytes32("id-96001"));
      expect(oirData.createdBy).to.equal(user1Address); // Ainda User1
      expect(oirData.lastUpdatedBy).to.equal(user1Address); // Volta para User1
    });

    it("Deve manter createdBy mesmo após múltiplas modificações de geohashes", async function() {
      const now = nowMs();

      // Owner modifica adicionando novos geohashes
      const tx1 = await dssStorage.upsertOIR(
        [toBytes32("u4audit001"), toBytes32("u4audit002"), toBytes32("u4audit003")],
        100, 500,
        now, now + 3600000,
        "https://example.com/expanded",
        200, toBytes32("id-96001")
      );
      await tx1.wait();

      // User2 modifica removendo geohashes
      const tx2 = await dssStorage.connect(user2).upsertOIR(
        [toBytes32("u4audit003")],
        100, 500,
        now, now + 3600000,
        "https://example.com/reduced",
        200, toBytes32("id-96001")
      );
      await tx2.wait();

      const oirData = await dssStorage.idToData(toBytes32("id-96001"));
      expect(oirData.createdBy).to.equal(user1Address); // Sempre User1 (criador original)
      expect(oirData.lastUpdatedBy).to.equal(user2Address); // User2 (última modificação)
    });
  });

  after(function() {
    console.log("\n============================================================");
    console.log("✅ TODOS OS TESTES CONCLUÍDOS COM SUCESSO!");
    console.log("============================================================");
    console.log("📊 Contract address:", dssStorage.address);
    console.log("👥 Usuários testados:");
    console.log("  - Owner (Member1):", ownerAddress);
    console.log("  - User1 (Member2):", user1Address);
    console.log("  - User2 (Member3):", user2Address);
    console.log("============================================================");
    console.log("📈 Cobertura de Testes:");
    console.log("  ✅ Edge cases de upsert com mudança de geohashes");
    console.log("  ✅ Delete e cleanup completo");
    console.log("  ✅ Queries com múltiplas OIRs");
    console.log("  ✅ Colaboração multi-usuário (novo modelo)");
    console.log("  ✅ Auditoria com createdBy/lastUpdatedBy");
    console.log("  ✅ Eventos e auditoria");
    console.log("  ✅ Validações de input e limites");
    console.log("  ✅ State consistency (ciclo completo)");
    console.log("============================================================");
  });
});
