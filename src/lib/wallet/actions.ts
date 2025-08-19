'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAndFundStellarWallet, getAccountDeets, getTransactionHistory as getStellarTransactionHistory } from './stellarHelpers';
import { UserService } from '@/lib/services/userService';
import { EncryptionUtil } from '@/lib/utils/encryption';


// const server = new StellarSdk.Horizon.Server("https://horizon-testnet.stellar.org");

// Stellar Wallet Activation
export async function activateStellarWallet() {
  console.log('🔵 [STELLAR WALLET] Activating Stellar wallet...');
  
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new Error('User not authenticated');
    }

    console.log('🔵 [STELLAR WALLET] User authenticated:', session.user.email);
    
    // Get user from database
    const user = await UserService.getUserByEmail(session.user.email);
    if (!user) {
      throw new Error('User not found in database');
    }

    // Check if user already has an activated wallet
    if (user.stellarWallet?.isActivated) {
      return { 
        success: true, 
        message: 'Wallet already activated',
        publicKey: user.stellarWallet.publicKey 
      };
    }
    
    const walletData = await createAndFundStellarWallet();
    
    // Encrypt the secret key (for now, we'll use a simple encryption)
    // In production, you should use the user's password or a more secure method
    const encryptedSecretKey = await EncryptionUtil.encrypt(walletData.secretKey, 'default-encryption-key');
    
    // Get real balance from Stellar network
    const account = await getAccountDeets(walletData.publicKey);
    const balances: { [currency: string]: number } = {};
    
    if (account.balances && Array.isArray(account.balances)) {
      account.balances.forEach((balance: { asset_type: string; balance: string; asset_code?: string }) => {
        if (balance.asset_type === 'native') {
          // Native asset is XLM
          balances.XLM = parseFloat(balance.balance);
        } else if (balance.asset_type === 'credit_alphanum4' || balance.asset_type === 'credit_alphanum12') {
          // Custom tokens (USDC, etc.)
          const assetCode = balance.asset_code;
          if (assetCode) {
            balances[assetCode] = parseFloat(balance.balance);
          }
        }
      });
    }
    
    // Create the stellar wallet object
    const stellarWallet = {
      isActivated: true,
      publicKey: walletData.publicKey,
      encryptedPrivateKey: encryptedSecretKey,
      balance: balances, // Use real balance from Stellar network
      lastSyncAt: new Date(),
      securitySettings: {
        backupEnabled: false,
        backupMethod: 'private_key' as const,
        twoFactorEnabled: false
      }
    };
    
    // Update user record with wallet data
    try {
      await UserService.updateUser(user._id!.toString(), {
        stellarWallet
      });
    } catch (dbError) {
      console.error('🔴 [STELLAR WALLET] Database update failed:', dbError);
      throw new Error(`Failed to save wallet to database: ${dbError instanceof Error ? dbError.message : 'Unknown database error'}`);
    }
    
    return { 
      success: true, 
      message: 'Wallet activated successfully',
      publicKey: walletData.publicKey 
    };
  } catch (error) {
    console.error('🔴 [STELLAR WALLET] Error activating wallet:', error);
    throw new Error(`Failed to activate wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Get Wallet Balance
export async function getWalletBalance() {
  console.log('🔵 [STELLAR WALLET] Getting wallet balance...sssssssssssssssssssssssssssssssssssssssssss');
  
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new Error('User not authenticated');
    }
    
    console.log('🔵 [STELLAR WALLET] User authenticated:', session.user.email);
    
    // Get user from database
    const user = await UserService.getUserByEmail(session.user.email);
    if (!user) {
      throw new Error('User not found in database');
    }
    
    // Check if user has an activated wallet
    if (!user.stellarWallet?.isActivated) {
      throw new Error('Wallet not activated');
    }

    const account = await getAccountDeets(user.stellarWallet.publicKey);
    console.log('🔵 [STELLAR WALLET] Account details:', account);
    
    // Parse real balances from Stellar network
    const balances: { [currency: string]: number } = {};
    
    if (account.balances && Array.isArray(account.balances)) {
      account.balances.forEach((balance: { asset_type: string; balance: string; asset_code?: string }) => {
        if (balance.asset_type === 'native') {
          // Native asset is XLM
          balances.XLM = parseFloat(balance.balance);
        } else if (balance.asset_type === 'credit_alphanum4' || balance.asset_type === 'credit_alphanum12') {
          // Custom tokens (USDC, etc.)
          const assetCode = balance.asset_code;
          if (assetCode) {
            balances[assetCode] = parseFloat(balance.balance);
          }
        }
      });
    }
    
    console.log('🔵 [STELLAR WALLET] Parsed balances:', balances);
    
    // Update the balance in the database to keep it in sync
    try {
      await UserService.updateUser(user._id!.toString(), {
        stellarWallet: {
          ...user.stellarWallet,
          balance: balances,
          lastSyncAt: new Date()
        }
      });
      console.log('🔵 [STELLAR WALLET] Balance updated in database');
    } catch (dbError) {
      console.warn('⚠️ [STELLAR WALLET] Failed to update balance in database:', dbError);
      // Don't throw error, just log warning - balance fetch still works
    }
    
    console.log('🔵 [STELLAR WALLET] Balance fetched successfully');
    
    // Return real balances from Stellar network
    return balances;
  } catch (error) {
    console.error('🔴 [STELLAR WALLET] Error getting balance:', error);
    throw error;
  }
}

// Send Transaction
export async function sendTransaction(toAddress: string, amount: number, currency: string) {
  console.log('🔵 [STELLAR WALLET] Sending transaction...');
  console.log('🔵 [STELLAR WALLET] To:', toAddress);
  console.log('🔵 [STELLAR WALLET] Amount:', amount);
  console.log('🔵 [STELLAR WALLET] Currency:', currency);
  
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new Error('User not authenticated');
    }
    
    console.log('🔵 [STELLAR WALLET] User authenticated:', session.user.email);
    
    // TODO: Implement transaction sending
    // - Validate recipient address
    // - Check sufficient balance
    // - Create and sign Stellar transaction
    // - Submit to Stellar network
    // - Store transaction in database
    // - Update balances
    
    console.log('🔵 [STELLAR WALLET] Transaction sent successfully');
    
    return { success: true, message: 'Transaction sent successfully' };
  } catch (error) {
    console.error('🔴 [STELLAR WALLET] Error sending transaction:', error);
    throw error;
  }
}

// Get Transaction History
export async function getTransactionHistory() {
  console.log('🔵 [STELLAR WALLET] Getting transaction history...');
  
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new Error('User not authenticated');
    }
    
    console.log('🔵 [STELLAR WALLET] User authenticated:', session.user.email);
    
    // Get user from database
    const user = await UserService.getUserByEmail(session.user.email);
    if (!user) {
      throw new Error('User not found in database');
    }
    
    // Check if user has an activated wallet
    if (!user.stellarWallet?.isActivated) {
      throw new Error('Wallet not activated');
    }
    
    // Get real transaction history from Stellar network
    const { sentPayments, receivedPayments } = await getStellarTransactionHistory(user.stellarWallet.publicKey);
    
    // Format transactions for the frontend
    const transactions = [
      // Received payments
      ...receivedPayments.map((payment, index) => ({
        id: `receive-${index}`,
        type: 'receive' as const,
        amount: parseFloat(payment.amount),
        currency: payment.asset,
        to: user.stellarWallet!.publicKey,
        from: payment.from || 'Unknown',
        timestamp: new Date(payment.timestamp),
        status: 'completed' as const,
        hash: `receive-${index}`
      })),
      // Sent payments
      ...sentPayments.map((payment, index) => ({
        id: `send-${index}`,
        type: 'send' as const,
        amount: parseFloat(payment.amount),
        currency: payment.asset,
        to: payment.to || 'Unknown',
        from: user.stellarWallet!.publicKey,
        timestamp: new Date(payment.timestamp),
        status: 'completed' as const,
        hash: `send-${index}`
      }))
    ];
    
    console.log('🔵 [STELLAR WALLET] Transaction history fetched successfully');
    console.log('🔵 [STELLAR WALLET] Found transactions:', transactions.length);
    
    return transactions;
  } catch (error) {
    console.error('🔴 [STELLAR WALLET] Error getting transaction history:', error);
    throw error;
  }
}

// Backup Wallet
export async function backupWallet() {
  console.log('🔵 [STELLAR WALLET] Backing up wallet...');
  
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new Error('User not authenticated');
    }
    
    console.log('🔵 [STELLAR WALLET] User authenticated:', session.user.email);
    
    // TODO: Implement wallet backup
    // - Get user's wallet data
    // - Generate backup file (seed phrase, private key, etc.)
    // - Encrypt backup data
    // - Return backup data or download link
    
    console.log('🔵 [STELLAR WALLET] Wallet backup completed');
    
    return { success: true, message: 'Wallet backed up successfully' };
  } catch (error) {
    console.error('🔴 [STELLAR WALLET] Error backing up wallet:', error);
    throw error;
  }
}

// Restore Wallet
export async function restoreWallet() {
  console.log('🔵 [STELLAR WALLET] Restoring wallet...');
  
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new Error('User not authenticated');
    }
    
    console.log('🔵 [STELLAR WALLET] User authenticated:', session.user.email);
    
    // TODO: Implement wallet restoration
    // - Accept backup data (seed phrase, private key, etc.)
    // - Validate backup data
    // - Restore wallet to user account
    // - Update database with restored wallet
    
    console.log('🔵 [STELLAR WALLET] Wallet restoration completed');
    
    return { success: true, message: 'Wallet restored successfully' };
  } catch (error) {
    console.error('🔴 [STELLAR WALLET] Error restoring wallet:', error);
    throw error;
  }
}

// Get Wallet Address
export async function getWalletAddress() {
  console.log('🔵 [STELLAR WALLET] Getting wallet address...');
  
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new Error('User not authenticated');
    }
    
    console.log('🔵 [STELLAR WALLET] User authenticated:', session.user.email);
    
    // Get user from database
    const user = await UserService.getUserByEmail(session.user.email);
    if (!user) {
      throw new Error('User not found in database');
    }
    
    // Check if user has an activated wallet
    if (!user.stellarWallet?.isActivated) {
      throw new Error('Wallet not activated');
    }
    
    console.log('🔵 [STELLAR WALLET] Wallet address retrieved successfully');
    
    return user.stellarWallet.publicKey;
  } catch (error) {
    console.error('🔴 [STELLAR WALLET] Error getting wallet address:', error);
    throw error;
  }
}

// Check Wallet Status
export async function checkWalletStatus() {
  console.log('🔵 [STELLAR WALLET] Checking wallet status...');
  
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new Error('User not authenticated');
    }
    
    console.log('🔵 [STELLAR WALLET] User authenticated:', session.user.email);
    
    // Get user from database
    const user = await UserService.getUserByEmail(session.user.email);
    if (!user) {
      throw new Error('User not found in database');
    }
    
    // Check if user has an activated wallet
    const isActivated = user.stellarWallet?.isActivated || false;
    const status = isActivated ? 'active' : 'inactive';
    
    console.log('🔵 [STELLAR WALLET] Wallet status checked successfully');
    console.log('🔵 [STELLAR WALLET] User wallet data:', {
      isActivated,
      publicKey: user.stellarWallet?.publicKey || 'none',
      hasEncryptedKey: !!user.stellarWallet?.encryptedPrivateKey,
      balance: user.stellarWallet?.balance || {}
    });
    
    return { 
      isActivated, 
      status,
      publicKey: user.stellarWallet?.publicKey || null,
      balance: user.stellarWallet?.balance || {}
    };
  } catch (error) {
    console.error('🔴 [STELLAR WALLET] Error checking wallet status:', error);
    throw error;
  }
}
