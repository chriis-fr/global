'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Wallet, 
  Plus, 
  Send, 
  Download, 
  Upload, 
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  Shield,
  Activity,
  CreditCard,
  Star
} from 'lucide-react';
import Link from 'next/link';
import { activateStellarWallet, getWalletBalance, sendTransaction, getTransactionHistory, backupWallet, restoreWallet, checkWalletStatus, getWalletAddress } from './index';

interface WalletData {
  isActivated: boolean;
  address: string;
  balance: {
    [currency: string]: number;
  };
  lastSyncAt: Date;
}

interface Transaction {
  id: string;
  type: 'send' | 'receive';
  amount: number;
  currency: string;
  to: string;
  from: string;
  timestamp: Date;
  status: 'pending' | 'completed' | 'failed';
  hash?: string;
}

export default function WalletPage() {
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendForm, setSendForm] = useState({
    to: '',
    amount: '',
    currency: 'XLM'
  });

  useEffect(() => {
    loadWalletData();
  }, []);

  const loadWalletData = async () => {
    try {
      // Check wallet status first
      const walletStatus = await checkWalletStatus();
      
      if (walletStatus.isActivated) {
        const balance = await getWalletBalance();
        const history = await getTransactionHistory();
        const address = await getWalletAddress();
        
        setWalletData({
          isActivated: true,
          address: address,
          balance: balance,
          lastSyncAt: new Date()
        });
        setTransactions(history);
      } else {
        // Wallet not activated - set to null to show activation screen
        setWalletData(null);
        setTransactions([]);
      }
    } catch (error) {
      console.error('Error loading wallet data:', error);
      // On error, assume wallet is not activated
      setWalletData(null);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleActivateWallet = async () => {
    try {
      await activateStellarWallet();
      await loadWalletData();
    } catch (error) {
      console.error('Error activating wallet:', error);
    }
  };

  const handleSendTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await sendTransaction(sendForm.to, parseFloat(sendForm.amount), sendForm.currency);
      setShowSendModal(false);
      setSendForm({ to: '', amount: '', currency: 'XLM' });
      await loadWalletData();
    } catch (error) {
      console.error('Error sending transaction:', error);
    }
  };

  const handleBackupWallet = async () => {
    try {
      await backupWallet();
    } catch (error) {
      console.error('Error backing up wallet:', error);
    }
  };

  const handleRestoreWallet = async () => {
    try {
      await restoreWallet();
      await loadWalletData();
    } catch (error) {
      console.error('Error restoring wallet:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Stellar Wallet</h1>
            <p className="text-blue-200">Manage your Stellar wallet and transactions</p>
          </div>
        </div>
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
              <div className="h-4 bg-white/20 rounded mb-4"></div>
              <div className="h-8 bg-white/20 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Stellar Wallet</h1>
          <p className="text-blue-200">Manage your Stellar wallet and transactions</p>
        </div>
        <div className="flex items-center space-x-3">
          <motion.button
            onClick={loadWalletData}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="h-5 w-5" />
            <span>Refresh</span>
          </motion.button>
        </div>
      </div>

      {/* Wallet Status */}
      {!walletData?.isActivated ? (
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center">
          <Wallet className="h-16 w-16 text-blue-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Wallet Not Activated</h3>
          <p className="text-blue-200 mb-6">Activate your Stellar wallet to start managing your assets</p>
          <button 
            onClick={handleActivateWallet}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Activate Wallet
          </button>
        </div>
      ) : (
        <>
          {/* Wallet Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Balance Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/10"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Balance</h3>
                <Wallet className="h-6 w-6 text-blue-400" />
              </div>
              <div className="space-y-3">
                {Object.entries(walletData.balance).map(([currency, amount]) => (
                  <div key={currency} className="flex justify-between items-center">
                    <span className="text-blue-200">{currency}</span>
                    <span className="text-white font-semibold">{amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-xs text-blue-200">
                  Last updated: {walletData.lastSyncAt.toLocaleString()}
                </p>
              </div>
            </motion.div>

            {/* Wallet Address */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/10"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Wallet Address</h3>
                <button
                  onClick={() => copyToClipboard(walletData.address)}
                  className="p-2 text-blue-400 hover:text-blue-300 transition-colors"
                  title="Copy address"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-sm font-mono text-white break-all">{walletData.address}</p>
              </div>
            </motion.div>

            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/10"
            >
              <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={() => setShowSendModal(true)}
                  className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Send className="h-4 w-4" />
                  <span>Send</span>
                </button>
                <button
                  onClick={handleBackupWallet}
                  className="w-full flex items-center justify-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  <span>Backup</span>
                </button>
              </div>
            </motion.div>
          </div>

          {/* Recent Transactions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/10"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Recent Transactions</h3>
              <Activity className="h-6 w-6 text-blue-400" />
            </div>
            
            {transactions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-blue-200">No transactions yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className={`p-2 rounded-lg ${
                        tx.type === 'receive' ? 'bg-green-500/20' : 'bg-red-500/20'
                      }`}>
                        {tx.type === 'receive' ? (
                          <Download className="h-4 w-4 text-green-400" />
                        ) : (
                          <Upload className="h-4 w-4 text-red-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-white font-medium">
                          {tx.type === 'receive' ? 'Received' : 'Sent'}
                        </p>
                        <p className="text-blue-200 text-sm">
                          {tx.type === 'receive' ? `From: ${tx.from}` : `To: ${tx.to}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${
                        tx.type === 'receive' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {tx.type === 'receive' ? '+' : '-'}{tx.amount} {tx.currency}
                      </p>
                      <p className="text-blue-200 text-sm">
                        {tx.timestamp.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </>
      )}

      {/* Send Transaction Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Send Transaction</h2>
              <button
                onClick={() => setShowSendModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendTransaction} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Address</label>
                <input
                  type="text"
                  value={sendForm.to}
                  onChange={(e) => setSendForm(prev => ({ ...prev, to: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Stellar address"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input
                  type="number"
                  step="0.000001"
                  value={sendForm.amount}
                  onChange={(e) => setSendForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.000000"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                <select
                  value={sendForm.currency}
                  onChange={(e) => setSendForm(prev => ({ ...prev, currency: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="XLM">XLM</option>
                  <option value="USDC">USDC</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSendModal(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Dashboard Button */}
      <Link
        href="/dashboard"
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 hover:scale-110"
      >
        <CreditCard className="h-6 w-6" />
      </Link>
    </div>
  );
}
