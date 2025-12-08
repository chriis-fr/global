import "hardhat/types/config";

declare module "hardhat" {
  export const ethers: typeof import("ethers");
}

