import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("InvoiceManagerModule", (m) => {
  // Deploy contract with initial fee settings
  const invoiceManager = m.contract("app/contracts/InvoiceManager.sol:InvoiceManager", [
    150, // 1.5% fee
    1000, // fee threshold in smallest unit (1 CELO = 1e18)
    "0x45f4Ea5EAF4c933dcEA631CFDF2Cf7D93CdA761F" // replace with your wallet for fees
  ]);

  return { invoiceManager };
});
