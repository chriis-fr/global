import hre from "hardhat";
import { ethers } from "ethers";

async function main() {
  // Get network name from process args or default
  const networkName = process.env.HARDHAT_NETWORK || "alfajores";
  
  // Use known RPC URLs
  const rpcUrls: Record<string, string> = {
    alfajores: "https://alfajores-forno.celo-testnet.org",
    celo: "https://forno.celo.org",
  };
  
  const rpcUrl = rpcUrls[networkName];
  if (!rpcUrl) {
    throw new Error(`Network ${networkName} not supported. Use 'alfajores' or 'celo'`);
  }
  
  // Create provider and wallet
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider);
  
  console.log("Deploying with:", deployer.address);
  
  // Check balance
  const balance = await provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "CELO");

  // Get fee configuration from environment variables or use defaults
  const feePercentage = process.env.FEE_PERCENTAGE ? parseInt(process.env.FEE_PERCENTAGE) : 150; // 1.5% in basis points
  const feeThreshold = process.env.FEE_THRESHOLD ? ethers.parseEther(process.env.FEE_THRESHOLD) : ethers.parseEther("10"); // 10 CELO default
  const feeRecipient = process.env.FEE_RECIPIENT || deployer.address; // Default to deployer if not set

  console.log("\nDeployment Configuration:");
  console.log("  Fee Percentage:", feePercentage, "basis points (", feePercentage / 100, "%)");
  console.log("  Fee Threshold:", ethers.formatEther(feeThreshold), "CELO");
  console.log("  Fee Recipient:", feeRecipient);
  console.log("");

  // Get contract artifacts (contracts are compiled automatically by Hardhat)
  const contractArtifact = await hre.artifacts.readArtifact("InvoiceManager");
  
  // Deploy InvoiceManager using ethers ContractFactory
  const InvoiceManager = new ethers.ContractFactory(
    contractArtifact.abi,
    contractArtifact.bytecode,
    deployer
  );
  
  console.log("Deploying InvoiceManager...");
  
  const invoiceManager = await InvoiceManager.deploy(
    feePercentage,
    feeThreshold,
    feeRecipient
  );

  await invoiceManager.waitForDeployment();
  const address = await invoiceManager.getAddress();
  
  console.log("\n✅ InvoiceManager deployed successfully!");
  console.log("  Address:", address);
  console.log("\nTo verify the contract, run:");
  console.log(`  npx hardhat verify --network <network> ${address} ${feePercentage} ${feeThreshold} ${feeRecipient}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

