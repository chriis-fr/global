import { createWalletClient, http, createPublicClient, parseUnits, type Account, type Address } from "viem";
import { CELO } from "../chains/celo";

// ERC20 Transfer ABI
const ERC20_ABI = [
    {
        name: "transfer",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "to", type: "address" },
            { name: "amount", type: "uint256" }
        ],
        outputs: [{ name: "", type: "bool" }]
    }
] as const;

export function celoPublicClient() {
    return createPublicClient({
        chain: CELO,
        transport: http()
    });
}

export function celoWalletClient(signer: Account) {
    return createWalletClient({
        chain: CELO,
        transport: http(),
        account: signer
    });
}

export async function sendCeloToken({
    signer,
    tokenAddress,
    amount,
    to,
    decimals
}: {
    signer: Account;
    tokenAddress: Address;
    amount: number | string;
    to: Address;
    decimals: number;
}) {
    const client = celoWalletClient(signer);
    const formattedAmount = parseUnits(amount.toString(), decimals);

    return client.writeContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [to, formattedAmount],
        account: signer
    });
}