import { ethers } from "hardhat";
import { expect } from "chai";
import { Signer, Event } from "ethers";
import type { DSS_Storage, GeohashConverter } from "../typechain-types";

// ========================================
// CORES ANSI PARA LOGS COLORIDOS
// ========================================
const COLORS = {
  RESET: '\x1b[0m',
  BRIGHT: '\x1b[1m',
  DIM: '\x1b[2m',
  
  USS1: '\x1b[36m',     // Ciano para USS1 (Member1)
  USS2: '\x1b[35m',     // Magenta para USS2 (Member2)
  
  SUCCESS: '\x1b[32m',  // Verde
  WARNING: '\x1b[33m',  // Amarelo
  ERROR: '\x1b[31m',    // Vermelho
  INFO: '\x1b[34m',     // Azul
  
  DATA: '\x1b[37m',     // Branco
  HIGHLIGHT: '\x1b[93m' // Amarelo claro
};

/**
 * Helper for USS logs with highlights
 */
function ussLog(ussNumber: 1 | 2, message: string) {
  const ussColor = ussNumber === 1 ? COLORS.USS1 : COLORS.USS2;
  const ussLabel = `USS${ussNumber}`;
  
  // Add highlights to important parts
  const highlighted = message
    .replace(/(\d+ evento\(s\))/g, `${COLORS.BRIGHT}${COLORS.SUCCESS}$1${COLORS.RESET}`)
    .replace(/(\d+ OIR\(s\))/g, `${COLORS.BRIGHT}${COLORS.WARNING}$1${COLORS.RESET}`)
    .replace(/(0x\.\.\.\w+)/g, `${COLORS.HIGHLIGHT}$1${COLORS.RESET}`)
    .replace(/(\d+-\d+m)/g, `${COLORS.BRIGHT}${COLORS.INFO}$1${COLORS.RESET}`)
    .replace(/(https?:\/\/[^\s)]+)/g, `${COLORS.DIM}$1${COLORS.RESET}`)
    .replace(/(Preferência.*?=.*?\d+)/g, `${COLORS.BRIGHT}${COLORS.WARNING}$1${COLORS.RESET}`)
    .replace(/(Tenho precedência!)/g, `${COLORS.SUCCESS}${COLORS.BRIGHT}$1${COLORS.RESET}`)
    .replace(/(tem precedência!)/g, `${COLORS.ERROR}${COLORS.BRIGHT}$1${COLORS.RESET}`)
    .replace(/(Preciso remover)/g, `${COLORS.ERROR}$1${COLORS.RESET}`)
    .replace(/(✅)/g, `${COLORS.SUCCESS}${COLORS.BRIGHT}$1${COLORS.RESET}`)
    .replace(/(🚨)/g, `${COLORS.ERROR}${COLORS.BRIGHT}$1${COLORS.RESET}`)
    .replace(/(⚠️)/g, `${COLORS.WARNING}${COLORS.BRIGHT}$1${COLORS.RESET}`)
    .replace(/(\[P\d+\([^)]+\)[^\]]*\])/g, `${COLORS.INFO}$1${COLORS.RESET}`);
  
  console.log(`${ussColor}${COLORS.BRIGHT}[${ussLabel}]${COLORS.RESET} ${highlighted}`);
}

/**
 * Format timestamp to DD/MM/YYYY - HH:MM
 */
function formatTimestamp(ms: number): string {
  const date = new Date(ms);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${day}/${month}/${year} - ${hours}:${minutes}`;
}

/**
 * Calculate duration between two timestamps
 */
function getDuration(startMs: number, endMs: number): string {
  const diffMs = endMs - startMs;
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  if (hours > 0) return `${hours}h${minutes > 0 ? minutes + 'm' : ''}`;
  return `${minutes}m`;
}

/**
 * Convert lat/lon to int256
 */
function latLonToInt256(value: number): bigint {
  return BigInt(Math.round(value * 1e18));
}

/**
 * Format bytes32 and addresses (shows only last 6 digits)
 */
function formatBytes32(bytes32: any): string {
  const hex = bytes32.toString ? bytes32.toString() : String(bytes32);
  if (hex.length <= 10) return hex;
  // Format: 0x...last6 (ex: 0x...00006a)
  return '0x...' + hex.slice(-6);
}

/**
 * Format address (shows only last 6 digits)
 */
function formatAddress(address: string): string {
  if (address.length <= 10) return address;
  return '0x...' + address.slice(-6);
}

/**
 * Helper to simulate P2P communication (fictitious)
 */
function simulateP2PRequest(toUss: 1 | 2): { preference: number, details: string } {
  // Simulate response based on USS
  return toUss === 1 
    ? { preference: 7, details: "Commercial delivery drone - High priority" }
    : { preference: 5, details: "Recreational drone - Standard priority" };
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe("🎬 COMPLETE TEST SCENARIO - USS1 vs USS2", function() {
  let dssStorage: DSS_Storage;
  let geohashConverter: GeohashConverter;
  let deployer: Signer;
  let uss1: Signer; // Member1
  let uss2: Signer; // Member2
  let uss1Address: string;
  let uss2Address: string;

  const precision = 4; // Precision for geohash

  // ========================================
  // 0. CONTRACT DEPLOYMENT
  // ========================================
  before(async function() {
    this.timeout(60000); // 60s timeout for deploy
    
    console.log("\n" + "=".repeat(80));
    console.log("🚀 CONTRACT DEPLOYMENT (Fresh Instances)");
    console.log("=".repeat(80));
    
    const signers = await ethers.getSigners();
    deployer = signers[0];
    uss1 = signers[1]; // Member1 = USS1
    uss2 = signers[2]; // Member2 = USS2
    
    uss1Address = await uss1.getAddress();
    uss2Address = await uss2.getAddress();
    
    console.log(`${COLORS.DIM}Deployer: ${COLORS.HIGHLIGHT}${formatAddress(await deployer.getAddress())}${COLORS.RESET}`);
    console.log(`${COLORS.USS1}USS1 (Member1): ${COLORS.HIGHLIGHT}${formatAddress(uss1Address)}${COLORS.RESET}`);
    console.log(`${COLORS.USS2}USS2 (Member2): ${COLORS.HIGHLIGHT}${formatAddress(uss2Address)}${COLORS.RESET}`);
    
    console.log("\n🔨 Deploying DSS_Storage...");
    const DSS_StorageFactory = await ethers.getContractFactory("DSS_Storage");
    dssStorage = (await DSS_StorageFactory.deploy()) as DSS_Storage;
    await dssStorage.deployed();
    console.log(`${COLORS.SUCCESS}✅ DSS_Storage deployed: ${COLORS.HIGHLIGHT}${formatAddress(dssStorage.address)}${COLORS.RESET}`);
    
    console.log("\n🔨 Deploying GeohashConverter...");
    const GeohashConverterFactory = await ethers.getContractFactory("GeohashConverter");
    geohashConverter = (await GeohashConverterFactory.deploy(precision)) as GeohashConverter;
    await geohashConverter.deployed();
    console.log(`${COLORS.SUCCESS}✅ GeohashConverter deployed: ${COLORS.HIGHLIGHT}${formatAddress(geohashConverter.address)}${COLORS.RESET} ${COLORS.DIM}(precision: ${precision})${COLORS.RESET}`);
    
    console.log("\n🔐 Setting up permissions...");
    const allowTx1 = await dssStorage.connect(deployer).allowUser(uss1Address);
    await allowTx1.wait();
    console.log(`${COLORS.SUCCESS}✅ USS1 allowed${COLORS.RESET}`);
    
    const allowTx2 = await dssStorage.connect(deployer).allowUser(uss2Address);
    await allowTx2.wait();
    console.log(`${COLORS.SUCCESS}✅ USS2 allowed${COLORS.RESET}`);
    
    // Verify permissions
    const uss1Allowed = await dssStorage.allowedUsers(uss1Address);
    const uss2Allowed = await dssStorage.allowedUsers(uss2Address);
    console.log(`${COLORS.DIM}Verification: USS1=${uss1Allowed}, USS2=${uss2Allowed}${COLORS.RESET}`);
    
    console.log("=".repeat(80) + "\n");
  });

  // ========================================
  // MAIN SCENARIO
  // ========================================
  it("🎭 Should execute complete conflict and resolution scenario between USS1 and USS2", async function() {
    this.timeout(120000); // 120s timeout for complete scenario
    
    console.log("\n" + "=".repeat(80));
    console.log("🎬 STARTING TEST SCENARIO");
    console.log("=".repeat(80) + "\n");
    
    // ========================================
    // USS2 CREATES TRIANGLE
    // ========================================
    const triangleVertices = [
      { lat: 5.000000, lon: 5.000000 },  // P1
      { lat: 5.050000, lon: 5.000000 },  // P2
      { lat: 5.000000, lon: 5.050000 },  // P3
    ];
    
    const uss2Altitude = { min: 100, max: 200 };
    const uss2TimeStart = Date.now();
    const uss2TimeEnd = uss2TimeStart + 7200_000; // +2 horas
    
    const pointsStr = triangleVertices.map((v, i) => 
      `P${i+1}(${v.lat.toFixed(2)}°,${v.lon.toFixed(2)}°)`
    ).join(', ');
    const timeStr = `${formatTimestamp(uss2TimeStart)} → ${formatTimestamp(uss2TimeEnd)} (${getDuration(uss2TimeStart, uss2TimeEnd)})`;
    
    ussLog(2, `Creating triangular route (OIR2):`);
    ussLog(2, `  Points: [${pointsStr}]`);
    ussLog(2, `  Altitude: ${uss2Altitude.min}-${uss2Altitude.max}m; Time: ${timeStr}`);
    
    // USS2 converts to geohash
    ussLog(2, `Accessing GeohashConverter...`);
    
    const triangleLats = triangleVertices.map(v => latLonToInt256(v.lat));
    const triangleLons = triangleVertices.map(v => latLonToInt256(v.lon));
    
    const triangleResult = await geohashConverter.connect(uss2).callStatic.processPolygon(
      triangleLats,
      triangleLons,
      precision,
      false
    );
    
    const triangleGeohashes = triangleResult[0] || triangleResult;
    const geohashesStr = triangleGeohashes.map((gh: string) => formatBytes32(gh)).join(', ');
    
    ussLog(2, `Got ${triangleGeohashes.length} geohash(es): [${geohashesStr}]`);
    
    // USS2 searches for conflicts
    ussLog(2, `Searching existing OIRs in geohash ${formatBytes32(triangleGeohashes[0])}...`);
    
    const searchResult = await dssStorage.getOIRsByGeohash(
      triangleGeohashes[0],
      uss2Altitude.min,
      uss2Altitude.max,
      uss2TimeStart,
      uss2TimeEnd
    );
    
    ussLog(2, `Found: ${searchResult.ids.length} OIR(s) (no conflicts)`);
    expect(searchResult.ids.length).to.equal(0, "Should not have OIRs in this geohash yet");
    
    // USS2 registers OIR2
    const oir2Id = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`USS2-OIR-${Date.now()}`));
    const oir2Url = 'https://uss2.example.com/oir/recreational-001';
    
    ussLog(2, `Registering OIR2 in DSS_Storage (ID: ${formatBytes32(oir2Id)}, URL: ${oir2Url})...`);
    
    const uss2UpsertTx = await dssStorage.connect(uss2).upsertOIR(
      triangleGeohashes,
      uss2Altitude.min,
      uss2Altitude.max,
      uss2TimeStart,
      uss2TimeEnd,
      oir2Url,
      2, // entity
      oir2Id
    );
    
    await uss2UpsertTx.wait();
    ussLog(2, `✅ OIR2 registered successfully`);
    
    // Verify it was stored
    const storedOir2 = await dssStorage.idToData(oir2Id);
    expect(storedOir2.createdBy).to.equal(uss2Address);
    expect(storedOir2.url).to.equal(oir2Url);
    
    // USS2 starts event polling
    ussLog(2, `Starting DataAdded event polling on geohash ${formatBytes32(triangleGeohashes[0])} (interval: 5s)...`);
    
    const uss2LastKnownOirCount = 1;
    let uss2LastBlockChecked = await ethers.provider.getBlockNumber();
    
    // Simulate 2 initial USS2 polls
    for (let i = 1; i <= 2; i++) {
      await sleep(5000);
      
      // Check DataAdded events since last check
      const currentBlock = await ethers.provider.getBlockNumber();
      const filter = dssStorage.filters.DataAdded(null, triangleGeohashes[0], null);
      const events = await dssStorage.queryFilter(filter, uss2LastBlockChecked, currentBlock);
      
      // Count current OIRs
      const currentOirs = await dssStorage.getOIRsByGeohash(
        triangleGeohashes[0],
        uss2Altitude.min,
        uss2Altitude.max,
        uss2TimeStart,
        uss2TimeEnd
      );
      
      ussLog(2, `Polling #${i}: Checking geohash ${formatBytes32(triangleGeohashes[0])} → ${events.length} new DataAdded event(s), ${currentOirs.ids.length} OIR(s) total`);
      uss2LastBlockChecked = currentBlock;
      expect(currentOirs.ids.length).to.equal(uss2LastKnownOirCount);
    }
    
    // USS1 enters the scene
    console.log("");
    
    const squareVertices = [
      { lat: 4.980000, lon: 4.980000 },
      { lat: 5.020000, lon: 4.980000 },
      { lat: 5.020000, lon: 5.020000 },
      { lat: 4.980000, lon: 5.020000 },
    ];
    
    const uss1Altitude = { min: 150, max: 250 };
    const uss1TimeStart = Date.now();
    const uss1TimeEnd = uss1TimeStart + 3600_000; // +1 hora
    
    const squarePointsStr = squareVertices.map((v, i) => 
      `P${i+1}(${v.lat.toFixed(2)}°,${v.lon.toFixed(2)}°)`
    ).join(', ');
    const uss1TimeStr = `${formatTimestamp(uss1TimeStart)} → ${formatTimestamp(uss1TimeEnd)} (${getDuration(uss1TimeStart, uss1TimeEnd)})`;
    
    ussLog(1, `Creating square route (OIR1):`);
    ussLog(1, `  Points: [${squarePointsStr}]`);
    ussLog(1, `  Altitude: ${uss1Altitude.min}-${uss1Altitude.max}m; Time: ${uss1TimeStr}`);
    
    // USS1 converts to geohash
    ussLog(1, `Accessing GeohashConverter...`);
    
    const squareLats = squareVertices.map(v => latLonToInt256(v.lat));
    const squareLons = squareVertices.map(v => latLonToInt256(v.lon));
    
    const squareResult = await geohashConverter.connect(uss1).callStatic.processPolygon(
      squareLats,
      squareLons,
      precision,
      false
    );
    
    const squareGeohashes = squareResult[0] || squareResult;
    const squareGeohashesStr = squareGeohashes.slice(0, 2).map((gh: string) => formatBytes32(gh)).join(', ');
    const moreCount = squareGeohashes.length > 2 ? ` (+${squareGeohashes.length - 2} more)` : '';
    
    ussLog(1, `Got ${squareGeohashes.length} geohash(es): [${squareGeohashesStr}${moreCount}]`);
    
    // Search for conflicts
    ussLog(1, `Searching conflicting OIRs in geohash ${formatBytes32(squareGeohashes[0])}...`);
    
    const conflictSearch = await dssStorage.getOIRsByGeohash(
      squareGeohashes[0],
      uss1Altitude.min,
      uss1Altitude.max,
      uss1TimeStart,
      uss1TimeEnd
    );
    
    ussLog(1, `⚠️  Found: ${conflictSearch.ids.length} conflicting OIR(s) → [${conflictSearch.ids.map(id => formatBytes32(id)).join(', ')}]`);
    expect(conflictSearch.ids.length).to.be.greaterThan(0, "Should find USS2's OIR2");
    
    // USS1 makes P2P communication with USS2
    ussLog(1, `Requesting P2P details of conflicting OIR (${conflictSearch.urls[0]})...`);
    
    const uss2Details = simulateP2PRequest(2);
    
    ussLog(1, `Received: USS2 Preference = ${uss2Details.preference}, My preference = 7 → I have precedence!`);
    
    expect(uss2Details.preference).to.equal(5);
    expect(7).to.be.greaterThan(uss2Details.preference, "USS1 should have higher preference");
    
    // USS1 registers OIR1
    const oir1Id = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`USS1-OIR-${Date.now()}`));
    const oir1Url = 'https://uss1.example.com/oir/delivery-001';
    
    ussLog(1, `Registering OIR1 in DSS_Storage (ID: ${formatBytes32(oir1Id)}, URL: ${oir1Url})...`);
    
    const uss1UpsertTx = await dssStorage.connect(uss1).upsertOIR(
      squareGeohashes,
      uss1Altitude.min,
      uss1Altitude.max,
      uss1TimeStart,
      uss1TimeEnd,
      oir1Url,
      1,
      oir1Id
    );
    
    await uss1UpsertTx.wait();
    ussLog(1, `✅ OIR1 registered successfully`);
    
    const storedOir1 = await dssStorage.idToData(oir1Id);
    expect(storedOir1.createdBy).to.equal(uss1Address);
    expect(storedOir1.url).to.equal(oir1Url);
    
    const uss1Receipt = await uss1UpsertTx.wait();
    const uss1Events = uss1Receipt.events?.filter((e: Event) => e.event === "DataAdded");
    expect(uss1Events?.length).to.be.greaterThan(0, "Should have emitted DataAdded events");
    
    ussLog(1, `Starting DataAdded event polling on geohash ${formatBytes32(squareGeohashes[0])}...`);
    console.log("");
    
    // USS2 detects new DataAdded event
    await sleep(5000);
    
    const currentBlock = await ethers.provider.getBlockNumber();
    const filter = dssStorage.filters.DataAdded(null, triangleGeohashes[0], null);
    const newEvents = await dssStorage.queryFilter(filter, uss2LastBlockChecked, currentBlock);
    
    const currentOirs = await dssStorage.getOIRsByGeohash(
      triangleGeohashes[0],
      uss2Altitude.min,
      uss2Altitude.max,
      uss2TimeStart,
      uss2TimeEnd
    );
    
    ussLog(2, `Polling #3: Checking geohash ${formatBytes32(triangleGeohashes[0])} → 🚨 ${newEvents.length} new DataAdded event(s)! Analyzing OIRs: ${currentOirs.ids.length} total (${currentOirs.ids.length - uss2LastKnownOirCount} new)`);
    expect(currentOirs.ids.length).to.be.greaterThan(uss2LastKnownOirCount, "Should have at least 2 OIRs (USS2 + USS1)");
    
    // USS2 analyzes details of new OIRs from event
    const newOirsSearch = await dssStorage.getOIRsByGeohash(
      triangleGeohashes[0],
      uss2Altitude.min,
      uss2Altitude.max,
      uss2TimeStart,
      uss2TimeEnd
    );
    
    const newOirs = newOirsSearch.ids.filter((id: string) => id !== oir2Id);
    ussLog(2, `Detailing OIRs from event: ${newOirs.length} new OIR(s) → [${newOirs.map(id => formatBytes32(id)).join(', ')}]`);
    
    expect(newOirs.length).to.be.greaterThan(0, "Should find USS1's OIR1");
    
    // USS2 makes P2P communication with USS1
    const idx = newOirsSearch.ids.indexOf(newOirs[0]);
    ussLog(2, `Requesting P2P details of new OIR (${newOirsSearch.urls[idx]})...`);
    
    const uss1Details = simulateP2PRequest(1);
    
    ussLog(2, `Received: USS1 Preference = ${uss1Details.preference}, My preference = 5 → USS1 has precedence! I need to remove OIR2.`);
    
    expect(uss1Details.preference).to.equal(7);
    expect(uss1Details.preference).to.be.greaterThan(5, "USS1 should have higher preference than USS2");
    
    // USS2 deletes OIR2
    ussLog(2, `Deleting OIR2 (ID: ${formatBytes32(oir2Id)})...`);
    
    const deleteTx = await dssStorage.connect(uss2).deleteOIR([oir2Id]);
    await deleteTx.wait();
    
    ussLog(2, `✅ OIR2 deleted. Stopping polling.`);
    
    const deletedOir2 = await dssStorage.idToData(oir2Id);
    expect(deletedOir2.id).to.equal(ethers.constants.HashZero, "OIR2 should have been deleted");
    
    const stillExistsOir1 = await dssStorage.idToData(oir1Id);
    expect(stillExistsOir1.createdBy).to.equal(uss1Address, "OIR1 should still exist");
    
    // Finalization
    console.log("\n" + "=".repeat(80));
    console.log(`${COLORS.SUCCESS}${COLORS.BRIGHT}✅ SCENARIO COMPLETED SUCCESSFULLY${COLORS.RESET}`);
    console.log("=".repeat(80));
    console.log(`${COLORS.INFO}📊 Final Result:${COLORS.RESET} ${COLORS.USS1}OIR1 (USS1)${COLORS.RESET} = ${COLORS.SUCCESS}${COLORS.BRIGHT}ACTIVE${COLORS.RESET} | ${COLORS.USS2}OIR2 (USS2)${COLORS.RESET} = ${COLORS.ERROR}DELETED${COLORS.RESET}`);
    console.log("=".repeat(80) + "\n");
  });
});

