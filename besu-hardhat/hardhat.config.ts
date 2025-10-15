import * as dotenv from "dotenv";
dotenv.config();

import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";

const { RPC_URL, CHAIN_ID, MEMBER1_PK } = process.env;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 } }
  },
  networks: {
    besu: {
      type: "http" as const,
      url: RPC_URL || "http://127.0.0.1:8545",
      chainId: CHAIN_ID ? parseInt(CHAIN_ID) : 1337,
      // Em Besu dev normalmente gasPrice=0. Se der "underpriced", mude para 1 gwei (1000000000).
      gasPrice: 0,
      accounts: MEMBER1_PK ? [MEMBER1_PK] : []
    }
  }
};

export default config;
