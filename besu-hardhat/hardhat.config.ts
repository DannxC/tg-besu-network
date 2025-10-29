import "dotenv/config";
import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-ethers";
import "@typechain/hardhat";

const { RPC_URL, CHAIN_ID, MEMBER1_PK, MEMBER2_PK, MEMBER3_PK } = process.env;

const accounts = [MEMBER1_PK, MEMBER2_PK, MEMBER3_PK].filter((pk): pk is string => !!pk);

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: { 
      optimizer: { enabled: true, runs: 200 },
      viaIR: true
    }
  },
  networks: {
    besu: {
      url: RPC_URL || "http://127.0.0.1:8545",
      chainId: CHAIN_ID ? parseInt(CHAIN_ID) : 1337,
      gasPrice: 0,
      accounts: accounts
    }
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v5",
  }
};

export default config;
