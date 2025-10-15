import "@nomicfoundation/hardhat-ethers";
import type { HardhatEthers } from "@nomicfoundation/hardhat-ethers/dist/src/types.js";

declare module "hardhat/types/network" {
  interface NetworkConnection {
    ethers: HardhatEthers;
  }
}

