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