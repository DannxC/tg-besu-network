import "@nomicfoundation/hardhat-ethers";
import type { HardhatEthers } from "@nomicfoundation/hardhat-ethers/types";

declare module "hardhat/types/network" {
  interface NetworkConnection {
    ethers: HardhatEthers;
  }
}

