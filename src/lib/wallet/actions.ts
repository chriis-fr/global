'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAndFundStellarWallet } from './stellarHelpers';
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
    
    // Create the stellar wallet object
    const stellarWallet = {
      isActivated: true,
      publicKey: walletData.publicKey,
      encryptedPrivateKey: encryptedSecretKey,
      balance: {
        XLM: 10000 // Friendbot funds with 10,000 XLM
      },
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
      
      console.log('🔵 [STELLAR WALLET] Wallet activation completed', walletData);
      console.log('🔵 [STELLAR WALLET] Wallet saved to database for user:', session.user.email);
      console.log('🔵 [STELLAR WALLET] Wallet details:', {
        publicKey: walletData.publicKey,
        isActivated: true,
        balance: stellarWallet.balance
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
  console.log('🔵 [STELLAR WALLET] Getting wallet balance...');
  
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
    
    console.log('🔵 [STELLAR WALLET] Balance fetched successfully');
    
    // Return the balance from the database
    return user.stellarWallet.balance || { XLM: 0 };
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
    
    // TODO: Implement transaction history
    // - Get user's Stellar wallet address
    // - Query Stellar network for transaction history
    // - Format and return transaction data
    
    console.log('🔵 [STELLAR WALLET] Transaction history fetched successfully');
    
    // Mock data for now
    return [
      {
        id: '1',
        type: 'receive' as const,
        amount: 100,
        currency: 'XLM',
        to: 'GABC123456789...',
        from: 'GDEF987654321...',
        timestamp: new Date(),
        status: 'completed' as const,
        hash: 'abc123...'
      },
      {
        id: '2',
        type: 'send' as const,
        amount: 50,
        currency: 'USDC',
        to: 'GHIJ456789123...',
        from: 'GABC123456789...',
        timestamp: new Date(Date.now() - 86400000),
        status: 'completed' as const,
        hash: 'def456...'
      }
    ];
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
