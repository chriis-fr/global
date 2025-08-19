import * as StellarSdk from "@stellar/stellar-sdk";

const server = new StellarSdk.Horizon.Server("https://horizon-testnet.stellar.org");

export const createAndFundStellarWallet = async () => {
    try {
        const pair = StellarSdk.Keypair.random();
        const publicKey = pair.publicKey(); // Extract the public key
        const secretKey = pair.secret(); // Extract the secret key

        // Use node-fetch compatible approach for server environment
        const response = await fetch(
            `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );
        
        if (!response.ok) {
            throw new Error(`Friendbot request failed: ${response.status}`);
        }
        
        await response.json();
        console.log('Stellar wallet created and funded successfully', publicKey, '🟢', response, secretKey);

        return {publicKey, secretKey};
    } catch (error){
        console.error('Error creating and funding Stellar wallet:', error);
        throw error;
    }
}

export const getAccountDeets = async (publicKey: string) => {
    try{
        const account = server.loadAccount(publicKey)
        return account;
    } catch(error){
        console.error("Error loading account", error)
        throw error
    }
}

export const getTransactionHistory = async (publicKey: string) => {
    try{
        const response = await fetch(`https://horizon-testnet.stellar.org/accounts/${publicKey}/operations`)
        const data = await response.json()
        
        // Define types for the operation and payment objects
        interface StellarOperation {
            type: string;
            amount: string;
            asset_type: string;
            asset_code?: string;
            asset_issuer?: string;
            from?: string;
            to?: string;
            created_at: string;
        }

        interface PaymentRecord {
            type: string;
            amount: string;
            asset: string;
            from?: string;
            to?: string;
            timestamp: string;
        }
        
        const payments: PaymentRecord[] = data._embedded.records.map((op: StellarOperation) => ({
            type: op.type,
            amount: op.amount,
            asset: op.asset_type === "native" ? "XLM" : `${op.asset_code}:${op.asset_issuer}`,
            from: op.from,
            to: op.to,
            timestamp: op.created_at,
        }));

        const sentPayments = payments.filter((payment: PaymentRecord) => payment.from === publicKey);
        const receivedPayments = payments.filter((payment: PaymentRecord) => payment.to === publicKey);

        return { sentPayments, receivedPayments };
    }catch(error){
        console.error("Error fetching account history", error)
        throw error
    }
}