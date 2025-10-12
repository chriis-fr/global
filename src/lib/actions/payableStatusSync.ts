'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

/**
 * Sync invoice status when payable is marked as paid
 * This ensures the sender's invoice reflects the payment status
 */
export async function syncInvoiceWhenPayablePaid(
  payableId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return { success: false, message: 'Unauthorized' };
    }

    const db = await connectToDatabase();
    
    // Get the payable
    const payable = await db.collection('payables').findOne({
      _id: new ObjectId(payableId)
    });

    if (!payable) {
      return { success: false, message: 'Payable not found' };
    }

    // Check if payable is paid and has a related invoice
    if (payable.status === 'paid' && payable.relatedInvoiceId) {
      // Update the related invoice to paid status
      const invoiceUpdate = await db.collection('invoices').updateOne(
        { _id: new ObjectId(payable.relatedInvoiceId) },
        {
          $set: {
            status: 'paid',
            paidAt: new Date(),
            updatedAt: new Date()
          }
        }
      );

      if (invoiceUpdate.modifiedCount > 0) {
        console.log('✅ [PayableStatusSync] Invoice marked as paid:', {
          invoiceId: payable.relatedInvoiceId,
          payableId: payable._id,
          payableNumber: payable.payableNumber || 'N/A'
        });
        
        return { 
          success: true, 
          message: 'Invoice status updated to paid' 
        };
      } else {
        return { 
          success: false, 
          message: 'Invoice was already marked as paid' 
        };
      }
    } else {
      return { 
        success: false, 
        message: 'Payable is not paid or has no related invoice' 
      };
    }

  } catch (error) {
    console.error('❌ [PayableStatusSync] Error syncing invoice status:', error);
    return { 
      success: false, 
      message: 'Failed to sync invoice status' 
    };
  }
}

/**
 * Sync payable status when invoice is marked as paid
 * This ensures the recipient's payable reflects the payment status
 */
export async function syncPayableWhenInvoicePaid(
  invoiceId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return { success: false, message: 'Unauthorized' };
    }

    const db = await connectToDatabase();
    
    // Get the invoice
    const invoice = await db.collection('invoices').findOne({
      _id: new ObjectId(invoiceId)
    });

    if (!invoice) {
      return { success: false, message: 'Invoice not found' };
    }

    // Check if invoice is paid
    if (invoice.status === 'paid') {
      // Find the related payable
      const payable = await db.collection('payables').findOne({
        relatedInvoiceId: new ObjectId(invoiceId)
      });

      if (payable && payable.status !== 'paid') {
        // Update the payable to paid status
        const payableUpdate = await db.collection('payables').updateOne(
          { _id: payable._id },
          {
            $set: {
              status: 'paid',
              paymentDate: new Date(),
              updatedAt: new Date()
            }
          }
        );

        if (payableUpdate.modifiedCount > 0) {
          console.log('✅ [PayableStatusSync] Payable marked as paid:', {
            payableId: payable._id,
            invoiceId: invoice._id,
            payableNumber: payable.payableNumber || 'N/A'
          });
          
          return { 
            success: true, 
            message: 'Payable status updated to paid' 
          };
        } else {
          return { 
            success: false, 
            message: 'Payable was already marked as paid' 
          };
        }
      } else {
        return { 
          success: false, 
          message: 'No related payable found or already paid' 
        };
      }
    } else {
      return { 
        success: false, 
        message: 'Invoice is not marked as paid' 
      };
    }

  } catch (error) {
    console.error('❌ [PayableStatusSync] Error syncing payable status:', error);
    return { 
      success: false, 
      message: 'Failed to sync payable status' 
    };
  }
}