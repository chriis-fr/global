import { defineConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-mocha-ethers"; // includes hardhat-ethers
import * as dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  solidity: "0.8.28",
  paths: {
    sources: "./src/app/contracts",
    artifacts: "./artifacts",
    cache: "./cache",
  },
  networks: {
    alfajores: {
      type: "http",
      url: "https://alfajores-forno.celo-testnet.org",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 44787,
    },
    celo: {
      type: "http",
      url: "https://forno.celo.org",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 42220,
    },
  },
});
