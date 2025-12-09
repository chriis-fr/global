/**
 * InvoiceManager Smart Contract Integration
 * 
 * Contract Address: 0x2F709bC69EB1715114635793B6536e23639527a2
 * Network: Celo Mainnet (Chain ID: 42220)
 * Verified: https://repo.sourcify.dev/42220/0x2F709bC69EB1715114635793B6536e23639527a2/
 */

import { createPublicClient, http, encodeFunctionData, type Address, type Hex } from "viem";
import { getChainByNumericId, getInvoiceManagerAddressByNumericId } from "../chains";

// Contract address on Celo Mainnet (fallback if not in chain config)
export const INVOICE_MANAGER_ADDRESS = "0x2F709bC69EB1715114635793B6536e23639527a2" as Address;

/**
 * Get InvoiceManager contract address for a chain
 * Falls back to hardcoded address if not in chain config
 */
export function getInvoiceManagerContractAddress(chainId: number = 42220): Address {
    const address = getInvoiceManagerAddressByNumericId(chainId);
    return (address as Address) || INVOICE_MANAGER_ADDRESS;
}

// Contract ABI (minimal - only functions we need)
export const INVOICE_MANAGER_ABI = [
  {
    name: "createInvoice",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "invoiceId", type: "string" },
      { name: "payer", type: "address" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: []
  },
  {
    name: "payInvoice",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "invoiceId", type: "string" }
    ],
    outputs: []
  },
  {
    name: "invoices",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "invoiceId", type: "string" }],
    outputs: [
      { name: "issuer", type: "address" },
      { name: "payer", type: "address" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "paid", type: "bool" }
    ]
  },
  {
    name: "feePercentage",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "feeThreshold",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "feeRecipient",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }]
  },
  {
    name: "InvoiceCreated",
    type: "event",
    inputs: [
      { name: "invoiceId", type: "string", indexed: false },
      { name: "issuer", type: "address", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "token", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false }
    ]
  },
  {
    name: "InvoicePaid",
    type: "event",
    inputs: [
      { name: "invoiceId", type: "string", indexed: false },
      { name: "payer", type: "address", indexed: true },
      { name: "fee", type: "uint256", indexed: false }
    ]
  }
] as const;

/**
 * Get public client for reading contract state
 */
export function getInvoiceManagerClient(chainId: number = 42220) {
  const chainConfig = getChainByNumericId(chainId);
  if (!chainConfig) {
    throw new Error(`Chain ${chainId} not supported`);
  }

  const rpcUrl = Array.isArray(chainConfig.chain.rpcUrls.default.http)
    ? chainConfig.chain.rpcUrls.default.http[0]
    : chainConfig.chain.rpcUrls.default.http;

  return createPublicClient({
    chain: chainConfig.chain,
    transport: http(rpcUrl),
  });
}

/**
 * Read invoice from contract
 */
export async function getInvoiceFromContract(
  invoiceId: string,
  chainId: number = 42220
): Promise<{
  issuer: Address;
  payer: Address;
  token: Address;
  amount: bigint;
  paid: boolean;
} | null> {
  try {
    const client = getInvoiceManagerClient(chainId);
    const contractAddress = getInvoiceManagerContractAddress(chainId);
    
    const result = await client.readContract({
      address: contractAddress,
      abi: INVOICE_MANAGER_ABI,
      functionName: "invoices",
      args: [invoiceId],
    }) as readonly [Address, Address, Address, bigint, boolean];

    const [issuer, payer, token, amount, paid] = result;
    
    return {
      issuer,
      payer,
      token,
      amount,
      paid,
    };
  } catch (error) {
    console.error("Error reading invoice from contract:", error);
    return null;
  }
}

/**
 * Check if invoice is paid on-chain
 */
export async function isInvoicePaidOnChain(
  invoiceId: string,
  chainId: number = 42220
): Promise<boolean> {
  const invoice = await getInvoiceFromContract(invoiceId, chainId);
  return invoice?.paid ?? false;
}

/**
 * Get contract fee configuration
 */
export async function getContractFeeConfig(chainId: number = 42220) {
  try {
    const client = getInvoiceManagerClient(chainId);
    const contractAddress = getInvoiceManagerContractAddress(chainId);
    
    const [feePercentage, feeThreshold, feeRecipient] = await Promise.all([
      client.readContract({
        address: contractAddress,
        abi: INVOICE_MANAGER_ABI,
        functionName: "feePercentage",
      }),
      client.readContract({
        address: contractAddress,
        abi: INVOICE_MANAGER_ABI,
        functionName: "feeThreshold",
      }),
      client.readContract({
        address: contractAddress,
        abi: INVOICE_MANAGER_ABI,
        functionName: "feeRecipient",
      }),
    ]);

    return {
      feePercentage: Number(feePercentage),
      feeThreshold: feeThreshold as bigint,
      feeRecipient: feeRecipient as Address,
    };
  } catch (error) {
    console.error("Error reading fee config from contract:", error);
    return null;
  }
}

/**
 * Encode createInvoice function call
 * Use this to prepare transaction data for client-side signing
 */
export function encodeCreateInvoice(
  invoiceId: string,
  payer: Address,
  token: Address,
  amount: bigint
): Hex {
  return encodeFunctionData({
    abi: INVOICE_MANAGER_ABI,
    functionName: "createInvoice",
    args: [invoiceId, payer, token, amount],
  });
}

/**
 * Encode payInvoice function call
 * Use this to prepare transaction data for client-side signing
 */
export function encodePayInvoice(invoiceId: string): Hex {
  return encodeFunctionData({
    abi: INVOICE_MANAGER_ABI,
    functionName: "payInvoice",
    args: [invoiceId],
  });
}

