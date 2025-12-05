import Safe,
{
    PredictedSafeProps,
    SafeAccountConfig,
    SafeDeploymentConfig,
    EthSafeTransaction,
} from "@safe-global/protocol-kit";
import SafeApiKit from "@safe-global/api-kit";
import {
    createPublicClient,
    createWalletClient,
    http,
    parseUnits,
    encodeFunctionData,
    type Hex,
} from "viem";
import { DEFAULT_CHAIN, getChainById, getSafeTransactionServiceUrl } from "../chains";
import { waitForTransactionReceipt } from "viem/actions";
import ProtocolKit from "@safe-global/protocol-kit";



const DEPLOYER_PRIVATE_KEY = process.env.SAFE_DEPLOYER_PRIVATE_KEY as Hex | undefined;
if (!DEPLOYER_PRIVATE_KEY) {
    // Important: we allow some functions to run without a deployer key (e.g., when interacting with already-deployed safes),
    // but deployment/redeploy functions require this value.
    // Throwing would be strict; keep optional if you only need existing safe interactions.
    // throw new Error("set SAFE_DEPLOYER_PRIVATE_KEY in env");
}

/**
 * Get Safe Transaction Service URL for a chain
 * Defaults to the default chain (CELO) if no chainId provided
 */
export function getSafeTransactionServiceUrlForChain(chainId?: string): string {
    const targetChainId = chainId || DEFAULT_CHAIN.id;
    const serviceUrl = getSafeTransactionServiceUrl(targetChainId);
    if (!serviceUrl) {
        throw new Error(`Safe Transaction Service URL not configured for chain: ${targetChainId}`);
    }
    return serviceUrl;
}

/**
 * Get Safe info from the blockchain using Safe API Kit
 * This is used to import existing Safe wallets
 */
export async function getSafeInfoFromChain(
    safeAddress: string,
    chainId?: string
): Promise<{
    safeAddress: string;
    owners: string[];
    threshold: number;
    version?: string;
    modules?: string[];
    nonce?: number;
}> {
    const targetChainId = chainId || DEFAULT_CHAIN.id;
    const chainConfig = getChainById(targetChainId);
    if (!chainConfig) {
        throw new Error(`Chain not found or not enabled: ${targetChainId}`);
    }

    const safeApiKit = new SafeApiKit({
        txServiceUrl: getSafeTransactionServiceUrlForChain(targetChainId),
        chainId: BigInt(chainConfig.chain.id),
    });

    const safeInfo = await safeApiKit.getSafeInfo(safeAddress);
    
    if (!safeInfo) {
        throw new Error("Safe wallet not found on the specified chain");
    }

    return {
        safeAddress: safeAddress.toLowerCase(),
        owners: safeInfo.owners.map((addr: string) => addr.toLowerCase()),
        threshold: safeInfo.threshold,
        version: safeInfo.version,
        modules: safeInfo.modules || [],
        nonce: typeof safeInfo.nonce === 'string' ? parseInt(safeInfo.nonce, 10) : safeInfo.nonce,
    };
}

/**
 * Get public client for a specific chain
 * Defaults to the default chain (CELO) if no chainId provided
 */
export function getPublicClient(chainId?: string) {
    const chainConfig = chainId ? getChainById(chainId) : DEFAULT_CHAIN;
    if (!chainConfig) {
        throw new Error(`Chain not found or not enabled: ${chainId}`);
    }
    
    return createPublicClient({
        chain: chainConfig.chain,
        transport: http(chainConfig.chain.rpcUrls.default.http[0]),
    });
}

/**
 * Get wallet client for signing using an EOA private key (server-side only)
 * Defaults to the default chain (CELO) if no chainId provided
 */
export function getWalletClient(privateKey: Hex, chainId?: string) {
    const chainConfig = chainId ? getChainById(chainId) : DEFAULT_CHAIN;
    if (!chainConfig) {
        throw new Error(`Chain not found or not enabled: ${chainId}`);
    }
    
    // createWalletClient accepts a transport that can sign when provided account: privateKey
    // In viem, you can pass the privateKey as the account to sign with server-side flows.
    return createWalletClient({
        chain: chainConfig.chain,
        transport: http(chainConfig.chain.rpcUrls.default.http[0]),
        account: privateKey,
    });
}

// -----------------------------
//  PROTOCOL KIT: INIT / PREDICT / DEPLOY
// -----------------------------

/**
 * Initialize Protocol Kit for a given signer (private key string) and provider (rpc url).
 * - signer: private key (Hex) or EIP-1193 signer; ProtocolKit allows raw private key here.
 * - provider: RPC URL string (CELO default used below)
 *
 * Returns a `protocolKit` instance that exposes methods:
 * - getAddress(): predicted safe address (based on owners + salt)
 * - createSafeDeploymentTransaction(): returns the tx to broadcast to deploy the safe
 * - createTransaction(): to create Safe transactions for proposal and signing
 * - connect(): re-init ProtocolKit pointing to deployed safe
 */

export async function initProtocolKit({
    signerPrivateKey,
    provider,
    predictedSafe,
    chainId,
}: {
    signerPrivateKey: Hex;
    provider?: string;
    predictedSafe?: PredictedSafeProps;
    chainId?: string;
}) {
    // Use provided provider or get from chain config
    const chainConfig = chainId ? getChainById(chainId) : DEFAULT_CHAIN;
    if (!chainConfig) {
        throw new Error(`Chain not found or not enabled: ${chainId}`);
    }
    
    const rpcUrl = provider || chainConfig.chain.rpcUrls.default.http[0];
    // Protocol Kit's Safe.init accepts: { provider, signer, predictedSafe? }
    // signer can be the private key string on server

    if (predictedSafe) {
        return await Safe.init({
            provider: rpcUrl,
            signer: signerPrivateKey,
            predictedSafe,
        } as Parameters<typeof Safe.init>[0] & { predictedSafe: PredictedSafeProps });
    }

    return await Safe.init({
        provider: rpcUrl,
        signer: signerPrivateKey,
    } as Parameters<typeof Safe.init>[0]);
}

/**
 * Given a safeAccountConfig (owners & threshold), create PredictedSafeProps
 * Example owners: ['0xAa...', '0xBb...']; threshold: 2
 */

export function makePredictedSafeProps({
    owners,
    threshold,
    saltNonce,
}: {
    owners: string[];
    threshold: number;
    saltNonce?: bigint;
}): PredictedSafeProps {
    const safeAccountConfig: SafeAccountConfig = {
        owners,
        threshold,
    };

    const safeDeploymentConfig: SafeDeploymentConfig = {
        saltNonce: (saltNonce ?? BigInt(Date.now())).toString(),
    };

    return {
        safeAccountConfig,
        safeDeploymentConfig,
    };
}

/**
 * Predict the Safe address for a given owners/threshold using the protocol kit
 * - Returns the predicted safe address (0x...)
 */

export async function predictSafeAddress({
    owners,
    threshold,
    signerPrivateKey,
}: {
    owners: string[];
    threshold: number;
    signerPrivateKey: Hex;
}) {
    const predictedSafe = makePredictedSafeProps({ owners, threshold });
    const pk = await initProtocolKit({ signerPrivateKey, predictedSafe });
    const predicted = await pk.getAddress();
    return predicted;
}


/**
 * Create deployment transaction (unsigned) for the predicted Safe
 * - returns the object with { to, value, data } to broadcast via an external signer
 */

export async function createSafeDeploymentTx({
    owners,
    threshold,
    signerPrivateKey,
}: {
    owners: string[];
    threshold: number;
    signerPrivateKey: Hex;
}) {
    const predictedSafe = makePredictedSafeProps({ owners, threshold });
    const pk = await initProtocolKit({ signerPrivateKey, predictedSafe });
    const deploymentTx = await pk.createSafeDeploymentTransaction()
    // deploymentTx: { to, value, data } - data is the contract deployment bytecode with init params
    return deploymentTx;
}

/**
 * Broadcast the deployment transaction to chain using protocolKit's external signer helper.
 * - deployerPrivateKey must be present (server-side)
 * - returns the tx hash and receipt
 */

export async function broadcastSafeDeployment({
    owners,
    threshold,
    deployerPrivateKey,
}: {
    owners: string[];
    threshold: number;
    deployerPrivateKey: Hex;
}) {
    if (!deployerPrivateKey) throw new Error("Missing deployer private key for broadcasting deployment");
    const predictedSafe = makePredictedSafeProps({ owners, threshold });
    const pk = await initProtocolKit({ signerPrivateKey: deployerPrivateKey, predictedSafe });

    const deploymentTx = await pk.createSafeDeploymentTransaction();


    // protocolKit.getSafeProvider().getExternalSigner() returns a signer wrapper with:
    // - sendTransaction({to, value, data, chain})
    // - waitForTransactionReceipt({ hash })

    const externalSigner = await pk.getSafeProvider().getExternalSigner();

    if (!externalSigner) {
        throw new Error("Failed to get external signer from protocol kit");
    }

    const chainConfig = DEFAULT_CHAIN; // Use default chain for deployment
    
    const txHash = await externalSigner.sendTransaction({
        to: deploymentTx.to,
        value: BigInt(deploymentTx.value),
        data: deploymentTx.data as `0x${string}`,
        chain: chainConfig.chain,
    });

    if (!txHash) {
        throw new Error("Transaction hash is undefined - deployment transaction failed");
    }

    const receipt = await waitForTransactionReceipt(
        getWalletClient(deployerPrivateKey, DEFAULT_CHAIN.id), 
        { hash: txHash }
    );

    // Reconnect protocolKit to the new safe address
    const newPk = await pk.connect({ safeAddress: await pk.getAddress() });
    return {
        txHash,
        receipt,
        safeAddress: await pk.getAddress(),
        protocolKit: newPk,
    };
}

// -----------------------------
//  SAFE INTERACTION: CREATE / PROPOSE / SIGN / EXECUTE TRANSACTIONS
// -----------------------------

/**
 * Init Protocol Kit connected to an EXISTING deployed Safe.
 * - safeAddress: deployed safe address (0x...)
 * - signerPrivateKey: the owner's private key (server-side) used to sign proposals
 */

export async function initProtocolKitForDeployedSafe({
    safeAddress,
    signerPrivateKey,
    chainId,
}: {
    safeAddress: string;
    signerPrivateKey: Hex;
    chainId?: string;
}) {
    const pk = await initProtocolKit({ 
        signerPrivateKey, 
        chainId,
    });

    const connected = await pk.connect({ safeAddress });
    return connected;
}

/**
 * Create a Safe transaction (batch supported)
 * - transactions: array of { to, value, data } (value as string or bigint)
 * - options: optional gas params, nonce, etc.
 * Returns a SafeTransaction object ready to be signed/proposed.
 */

export async function createSafeTx({
    protocolKit,
    transactions,
    options,
}: {
    protocolKit: ProtocolKit;
    transactions: Array<{ to: string, value?: string | bigint, data?: `0x${string}` }>;
    options?: Record<string, unknown>;
}) {

    const safeTx = await protocolKit.createTransaction({
        transactions: transactions.map((tx) => ({
            to: tx.to,
            value: tx.value ? BigInt(tx.value).toString() : '0',
            data: tx.data || '0x',
        })),
        options: options ?? {},
    });
    return safeTx;
}


/**
 * Propose a Safe transaction to the Safe Transaction Service using SafeApiKit.
 * This stores the multisig transaction in the service and distributes it to other owners.
 * - protocolKit: connected ProtocolKit instance for the safe (must be connected to safe)
 * - apiKit: optional SafeApiKit instance (we'll create one if not provided)
 * - signerAddress: address of the proposer (the owner proposing tx)
 */

export async function proposeSafeTx({
    protocolKit,
    safeAddress,
    signerAddress,
    safeTx,
}: {
    protocolKit: ProtocolKit;
    safeAddress: string;
    signerAddress: string;
    safeTx: EthSafeTransaction;
}) {

    const txHash = await protocolKit.getTransactionHash(safeTx);


    // Sign the hash by the local signer in protocolKit
    // (server side signer used during initProtocolKitForDeployedSafe)

    const signature = await protocolKit.signHash(txHash);

    // Get chain config - use default if not specified
    const chainConfig = DEFAULT_CHAIN; // For now, use default. Can be made dynamic later
    
    const safeTxServiceUrl = getSafeTransactionServiceUrlForChain(chainConfig.id);
    
    const apiKit = new SafeApiKit({
        txServiceUrl: safeTxServiceUrl,
        chainId: BigInt(chainConfig.chain.id),
    });

    await apiKit.proposeTransaction({
        safeAddress,
        safeTransactionData: safeTx.data,
        safeTxHash: txHash,
        senderAddress: signerAddress,
        senderSignature: signature.data,
    })

    return { txHash, signature };
}

/**
 * Execute a Safe transaction (once enough confirmations are present)
 * - protocolKit: connected kit
 * - safeTx: object returned by createSafeTx
 */

export async function executeSafeTx({
    protocolKit,
    safeTx,
}: {
    protocolKit: ProtocolKit;
    safeTx: EthSafeTransaction;
}) {

    const execResult = await protocolKit.executeTransaction(safeTx);
    return execResult;
}


// -----------------------------
//  UTILS: create ERC20 transfer tx data for viem / Safe
// -----------------------------

export const ERC20_TRANSFER_ABI = [
    {
        name: "transfer",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "to", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        outputs: [{ name: "", type: "bool" }],
    },
] as const;


/**
 * Encode ERC20 transfer function call data
 * - Returns hex-encoded calldata for ERC20 transfer
 */
export function encodeERC20Transfer(
    tokenAddress: string,
    to: string,
    amount: string | number,
    decimals: number
): `0x${string}` {
    const scaled = parseUnits(amount.toString(), decimals);
    
    // Encode the transfer function call using viem's encodeFunctionData
    const data = encodeFunctionData({
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [to as `0x${string}`, scaled],
    });
    
    return data;
}

/**
 * Build contract data for transfer (0x...)
 * - used to feed into Safe createTransaction or to send directly via viem walletClient.writeContract
 * @deprecated Use encodeERC20Transfer instead
 */
export function buildERC20TransferData({ to, amount, decimals }: { to: string, amount: string | number, decimals: number }) {
    const scaled = parseUnits(amount.toString(), decimals);
    // Protocol Kit uses data as hex bytes; use viem's encodeAbiParameters or client helpers on server before calling
    // For simplicity, we return a minimal data string built by a public client helper or you can rely on viem to writeContract directly.
    // We'll not encode here to keep simple; in server action we will call createTransaction with "data" set from viem's encoding utilities.
    return { to, scaled }
}