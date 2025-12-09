"use server";

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { payInvoicesWithSafe } from './safe-action';
import { getInvoiceById } from '@/lib/db';

/**
 * Pay a payable with a connected wallet (EOA or Safe)
 * This will:
 * 1. Find the related invoice if exists
 * 2. Execute payment based on wallet type
 * 3. Update payable and invoice status
 */
export async function payPayableWithWallet({
    payableId,
    walletType,
    walletAddress,
    chainId,
    proposerPrivateKey, // Required for Safe payments
}: {
    payableId: string;
    walletType: 'safe' | 'metamask' | 'walletconnect' | null;
    walletAddress: string;
    chainId: string;
    proposerPrivateKey?: string;
}) {
    try {
        const session = await getServerSession(authOptions);
        
        if (!session?.user) {
            return { success: false, error: 'Unauthorized' };
        }

        const db = await connectToDatabase();
        const payablesCollection = db.collection('payables');
        const invoicesCollection = db.collection('invoices');

        // Get payable
        const payable = await payablesCollection.findOne({
            _id: new ObjectId(payableId)
        });

        if (!payable) {
            return { success: false, error: 'Payable not found' };
        }

        // Check permissions
        const isOrganization = !!session.user.organizationId;
        let hasPermission = false;

        if (isOrganization) {
            hasPermission = payable.organizationId?.toString() === session.user.organizationId;
        } else {
            hasPermission = payable.issuerId?.toString() === session.user.id || 
                           payable.userId === session.user.email;
        }

        if (!hasPermission) {
            return { success: false, error: 'You do not have permission to pay this payable' };
        }

        // Check payable status
        if (payable.status === 'paid') {
            return { success: false, error: 'Payable is already paid' };
        }

        // Get related invoice if exists
        let invoice = null;
        if (payable.relatedInvoiceId) {
            invoice = await getInvoiceById(payable.relatedInvoiceId.toString());
        }

        // Extract payment details
        const paymentAddress = payable.paymentAddress || payable.paymentMethodDetails?.address;
        const cryptoDetails = payable.paymentMethodDetails?.cryptoDetails || {};
        const invoiceChainId = invoice?.chainId?.toString() || cryptoDetails.chainId?.toString() || chainId;
        const tokenAddress = invoice?.tokenAddress || cryptoDetails.tokenAddress;

        if (!paymentAddress) {
            return { success: false, error: 'Payment address not found' };
        }

        if (!tokenAddress) {
            return { success: false, error: 'Token address not found' };
        }

        // Determine payment method
        const isSafe = walletType === 'safe';
        let txHash: string | undefined;
        let safeTxHash: string | undefined;
        let paymentStatus: 'proposed' | 'paid' = 'paid';

        if (isSafe) {
            // Safe wallet payment
            if (!proposerPrivateKey) {
                return { success: false, error: 'Proposer private key required for Safe payments' };
            }

            if (!invoice) {
                return { success: false, error: 'Safe payments require a related invoice' };
            }

            // Use existing Safe payment action
            if (!invoice._id) {
                return { success: false, error: 'Invoice ID not found' };
            }
            if (!proposerPrivateKey) {
                return { success: false, error: 'Proposer private key is required for Safe payments' };
            }
            // Get company/organization ID from session
            const companyId = session.user.organizationId || session.user.id;
            if (!companyId) {
                return { success: false, error: 'Company ID not found' };
            }
            // Ensure proposerPrivateKey starts with 0x
            const hexKey = proposerPrivateKey.startsWith('0x') 
                ? proposerPrivateKey as `0x${string}`
                : `0x${proposerPrivateKey}` as `0x${string}`;
            try {
                const result = await payInvoicesWithSafe({
                    companyId: companyId.toString(),
                    invoiceIds: [invoice._id.toString()],
                    proposerAddress: walletAddress,
                    proposerPrivateKey: hexKey,
                    chainId: invoiceChainId,
                });

                // payInvoicesWithSafe returns { success: true, txHash, safeAddress, invoiceCount }
                // The txHash is the Safe transaction hash
                safeTxHash = result.txHash;
                paymentStatus = 'proposed'; // Safe transactions are proposed first
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : 'Safe payment failed';
                return { success: false, error: errorMessage };
            }
        } else {
            // EOA payment (MetaMask, WalletConnect)
            // Note: For client-side signing, we would need to receive the txHash from the client
            // For now, we'll mark it as a placeholder that needs client-side implementation
            return { 
                success: false, 
                error: 'EOA payments require client-side wallet signing. Please use the wallet to sign the transaction and send the txHash.' 
            };
        }

        // Update payable status
        const updateData: Record<string, unknown> = {
            status: paymentStatus === 'proposed' ? 'pending' : 'paid',
            paymentStatus: paymentStatus === 'proposed' ? 'processing' : 'completed',
            paymentDate: paymentStatus !== 'proposed' ? new Date() : undefined,
            paymentMethod: 'crypto',
            updatedAt: new Date(),
        };

        if (txHash) {
            updateData.txHash = txHash;
        }
        if (safeTxHash) {
            updateData.safeTxHash = safeTxHash;
        }

        await payablesCollection.updateOne(
            { _id: new ObjectId(payableId) },
            { $set: updateData }
        );

        // Update related invoice if exists
        if (invoice) {
            const invoiceUpdate: Record<string, unknown> = {
                status: paymentStatus,
                updatedAt: new Date(),
            };

            if (txHash) {
                invoiceUpdate.txHash = txHash;
            }
            if (safeTxHash) {
                invoiceUpdate.safeTxHash = safeTxHash;
            }

            await invoicesCollection.updateOne(
                { _id: new ObjectId(invoice._id.toString()) },
                { $set: invoiceUpdate }
            );
        }

        return {
            success: true,
            message: isSafe 
                ? 'Payment proposed successfully. Waiting for other Safe owners to sign.'
                : 'Payment completed successfully',
            txHash: txHash || safeTxHash,
            paymentStatus,
        };

    } catch (error) {
        console.error('[Payable Payment] Error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to process payment'
        };
    }
}

/**
 * Pay payable with EOA wallet (client-side signing)
 * Client signs transaction and sends txHash
 */
export async function payPayableWithEOAHash({
    payableId,
    txHash,
    fromAddress,
    chainId,
}: {
    payableId: string;
    txHash: string;
    fromAddress: string;
    chainId: string;
}) {
    try {
        const session = await getServerSession(authOptions);
        
        if (!session?.user) {
            return { success: false, error: 'Unauthorized' };
        }

        const db = await connectToDatabase();
        const payablesCollection = db.collection('payables');
        const invoicesCollection = db.collection('invoices');

        // Get payable
        const payable = await payablesCollection.findOne({
            _id: new ObjectId(payableId)
        });

        if (!payable) {
            return { success: false, error: 'Payable not found' };
        }

        // Check permissions
        const isOrganization = !!session.user.organizationId;
        let hasPermission = false;

        if (isOrganization) {
            hasPermission = payable.organizationId?.toString() === session.user.organizationId;
        } else {
            hasPermission = payable.issuerId?.toString() === session.user.id || 
                           payable.userId === session.user.email;
        }

        if (!hasPermission) {
            return { success: false, error: 'You do not have permission to pay this payable' };
        }

        // Get payable details for ledger entry
        const payableAmount = payable.total || payable.amount || 0;
        const payableCurrency = payable.currency || 'USD';
        const payableNumber = payable.payableNumber || `PAY-${payableId.slice(-8)}`;
        
        // Determine owner ID (for ledger entry) - reuse isOrganization from above
        const ownerId = isOrganization ? session.user.organizationId : session.user.email;
        
        // Update payable status
        await payablesCollection.updateOne(
            { _id: new ObjectId(payableId) },
            {
                $set: {
                    status: 'paid',
                    paymentStatus: 'completed',
                    paymentDate: new Date(),
                    paymentMethod: 'crypto',
                    txHash: txHash,
                    updatedAt: new Date(),
                }
            }
        );

        // Update related invoice if exists
        if (payable.relatedInvoiceId) {
            await invoicesCollection.updateOne(
                { _id: new ObjectId(payable.relatedInvoiceId) },
                {
                    $set: {
                        status: 'paid',
                        txHash: txHash,
                        updatedAt: new Date(),
                    }
                }
            );
        }

        // Create or update ledger entry for the payment
        const ledgerCollection = db.collection('financial_ledger');
        
        // Check if ledger entry already exists
        const existingLedgerEntry = await ledgerCollection.findOne({
            relatedPayableId: new ObjectId(payableId)
        });

        const ledgerEntryData = {
            entryId: existingLedgerEntry?.entryId || payableNumber,
            type: 'payable' as const,
            status: 'paid' as const,
            amount: payableAmount,
            currency: payableCurrency,
            ownerId: ownerId,
            userId: session.user.email,
            issuerId: isOrganization ? new ObjectId(session.user.organizationId) : new ObjectId(session.user.id),
            organizationId: isOrganization ? new ObjectId(session.user.organizationId) : null,
            relatedPayableId: new ObjectId(payableId),
            relatedInvoiceId: payable.relatedInvoiceId ? new ObjectId(payable.relatedInvoiceId) : null,
            counterparty: {
                name: payable.vendorName || 'Vendor',
                email: payable.vendorEmail,
                type: 'vendor' as const,
            },
            paymentDetails: {
                method: 'crypto',
                network: payable.paymentNetwork || 'Ethereum',
                address: payable.paymentAddress || '',
                txHash: txHash,
                fromAddress: fromAddress,
                chainId: chainId,
            },
            notes: `Payment for ${payableNumber}`,
            createdAt: existingLedgerEntry?.createdAt || payable.createdAt || new Date(),
            updatedAt: new Date(),
        };

        if (existingLedgerEntry) {
            // Update existing ledger entry
            await ledgerCollection.updateOne(
                { _id: existingLedgerEntry._id },
                { $set: ledgerEntryData }
            );
        } else {
            // Create new ledger entry
            await ledgerCollection.insertOne(ledgerEntryData);
        }

        return {
            success: true,
            message: 'Payment completed successfully',
            txHash,
        };

    } catch (error) {
        console.error('[Payable Payment] Error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to process payment'
        };
    }
}

