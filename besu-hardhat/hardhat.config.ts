import "dotenv/config";
import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-ethers";

const { RPC_URL, CHAIN_ID, MEMBER1_PK } = process.env;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 } }
  },
  networks: {
    besu: {
      url: RPC_URL || "http://127.0.0.1:8545",
      chainId: CHAIN_ID ? parseInt(CHAIN_ID) : 1337,
      accounts: MEMBER1_PK ? [MEMBER1_PK] : []
    }
  }
};

export default config;
