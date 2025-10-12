import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const db = await connectToDatabase();
    
    console.log('🔧 [Fix Payables] Starting to fix existing payables...');
    
    // Step 1: Fix workflows with null billId
    const workflowsWithNullBillId = await db.collection('approval_workflows').find({
      billId: null
    }).toArray();
    
    console.log('🔍 [Fix Payables] Found workflows with null billId:', workflowsWithNullBillId.length);
    
    let fixedWorkflows = 0;
    
    for (const workflow of workflowsWithNullBillId) {
      // Try to find a payable that matches this workflow
      const payable = await db.collection('payables').findOne({
        organizationId: workflow.organizationId,
        approvalWorkflowId: workflow._id
      });
      
      if (payable) {
        // Update the workflow with the correct billId
        const result = await db.collection('approval_workflows').updateOne(
          { _id: workflow._id },
          { 
            $set: { 
              billId: payable._id,
              updatedAt: new Date()
            }
          }
        );
        
        if (result.modifiedCount > 0) {
          fixedWorkflows++;
          console.log('✅ [Fix Payables] Fixed workflow:', {
            workflowId: workflow._id,
            payableId: payable._id,
            payableNumber: payable.payableNumber
          });
        }
      } else {
        console.log('⚠️ [Fix Payables] No matching payable found for workflow:', workflow._id);
      }
    }
    
    // Step 2: Update payable statuses based on workflow status
    const allWorkflows = await db.collection('approval_workflows').find({}).toArray();
    
    console.log('🔍 [Fix Payables] Checking all workflows for status updates...');
    
    let updatedPayables = 0;
    
    for (const workflow of allWorkflows) {
      if (workflow.billId) {
        // Determine the correct payable status based on workflow status
        const payableStatus = workflow.status === 'approved' ? 'approved' : 
                             workflow.status === 'rejected' ? 'rejected' : 
                             'pending_approval';
        
        // Update the payable status
        const payableUpdate = await db.collection('payables').updateOne(
          { _id: new ObjectId(workflow.billId) },
          { 
            $set: { 
              status: payableStatus,
              approvalStatus: payableStatus,
              updatedAt: new Date()
            }
          }
        );
        
        if (payableUpdate.modifiedCount > 0) {
          updatedPayables++;
          console.log('✅ [Fix Payables] Updated payable status:', {
            workflowId: workflow._id,
            payableId: workflow.billId,
            workflowStatus: workflow.status,
            payableStatus
          });
        }
      }
    }
    
    // Step 3: Sync invoice statuses for approved/rejected payables
    const approvedRejectedWorkflows = await db.collection('approval_workflows').find({
      status: { $in: ['approved', 'rejected'] },
      billId: { $ne: null }
    }).toArray();
    
    console.log('🔍 [Fix Payables] Syncing invoice statuses for approved/rejected workflows...');
    
    let syncedInvoices = 0;
    
    for (const workflow of approvedRejectedWorkflows) {
      const payable = await db.collection('payables').findOne({
        _id: new ObjectId(workflow.billId)
      });
      
      if (payable && payable.relatedInvoiceId) {
        try {
          // Update invoice status to match payable status
          const invoiceStatus = workflow.status === 'approved' ? 'approved' : 'rejected';
          
          const invoiceUpdate = await db.collection('invoices').updateOne(
            { _id: new ObjectId(payable.relatedInvoiceId) },
            {
              $set: {
                status: invoiceStatus,
                approvalStatus: workflow.status,
                approvedAt: workflow.status === 'approved' ? new Date() : null,
                updatedAt: new Date()
              }
            }
          );
          
          if (invoiceUpdate.modifiedCount > 0) {
            syncedInvoices++;
            console.log('✅ [Fix Payables] Synced invoice status:', {
              invoiceId: payable.relatedInvoiceId,
              status: invoiceStatus
            });
          }
        } catch (error) {
          console.error('❌ [Fix Payables] Failed to sync invoice:', error);
        }
      }
    }
    
    // Step 4: Sync all payables to financial ledger
    console.log('🔍 [Fix Payables] Syncing all payables to financial ledger...');
    
    const allPayables = await db.collection('payables').find({}).toArray();
    let syncedToLedger = 0;
    
    for (const payable of allPayables) {
      try {
        // Check if ledger entry already exists
        const existingLedgerEntry = await db.collection('financial_ledger').findOne({
          relatedPayableId: payable._id
        });
        
        if (!existingLedgerEntry) {
          // Create new ledger entry
          const ledgerEntryData = {
            entryId: `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
            type: 'payable',
            status: payable.status || 'pending',
            amount: payable.total || payable.amount || 0,
            currency: payable.currency || 'USD',
            counterparty: {
              name: payable.vendorName || payable.companyName || 'Unknown',
              email: payable.vendorEmail || payable.companyEmail || '',
              type: 'vendor'
            },
            category: payable.category || 'Invoice Payment',
            priority: payable.priority || 'medium',
            dueDate: payable.dueDate || new Date(),
            description: payable.memo || payable.payableName || 'Payable from invoice',
            organizationId: payable.organizationId,
            ownerId: payable.ownerId || payable.userId,
            ownerType: payable.ownerType || 'individual',
            relatedPayableId: payable._id,
            relatedInvoiceId: payable.relatedInvoiceId ? new ObjectId(payable.relatedInvoiceId) : null,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          const result = await db.collection('financial_ledger').insertOne(ledgerEntryData);
          
          // Update payable with ledger entry ID
          await db.collection('payables').updateOne(
            { _id: payable._id },
            {
              $set: {
                ledgerEntryId: result.insertedId,
                ledgerStatus: 'synced'
              }
            }
          );
          
           syncedToLedger++;
           console.log('✅ [Fix Payables] Synced payable to ledger:', {
             payableId: payable._id,
             payableNumber: payable.payableNumber || 'N/A',
             status: payable.status,
             amount: payable.total || payable.amount || 0
           });
        }
      } catch (error) {
        console.error('❌ [Fix Payables] Failed to sync payable to ledger:', error);
      }
     }
     
     // Step 5: Two-way sync - if payable is paid, mark related invoice as paid
     console.log('🔍 [Fix Payables] Checking for two-way sync (paid payables → paid invoices)...');
     
     const paidPayables = await db.collection('payables').find({
       status: 'paid',
       relatedInvoiceId: { $ne: null }
     }).toArray();
     
     let syncedInvoicesToPaid = 0;
     
     for (const payable of paidPayables) {
       try {
         // Check if invoice is already marked as paid
         const invoice = await db.collection('invoices').findOne({
           _id: new ObjectId(payable.relatedInvoiceId)
         });
         
         if (invoice && invoice.status !== 'paid') {
           // Update invoice to paid status
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
             syncedInvoicesToPaid++;
             console.log('✅ [Fix Payables] Marked related invoice as paid:', {
               invoiceId: payable.relatedInvoiceId,
               payableId: payable._id,
               invoiceNumber: invoice.invoiceNumber || 'N/A'
             });
           }
         }
       } catch (error) {
         console.error('❌ [Fix Payables] Failed to sync invoice to paid status:', error);
       }
     }
     
     return NextResponse.json({
       success: true,
       message: `Fixed ${fixedWorkflows} workflows, updated ${updatedPayables} payables, synced ${syncedInvoices} invoices, synced ${syncedToLedger} payables to ledger, synced ${syncedInvoicesToPaid} invoices to paid status`,
       data: {
         fixedWorkflows,
         updatedPayables,
         syncedInvoices,
         syncedToLedger,
         syncedInvoicesToPaid,
         totalWorkflows: allWorkflows.length,
         workflowsWithNullBillId: workflowsWithNullBillId.length
       }
     });

  } catch (error) {
    console.error('❌ [Fix Payables] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fix payables' },
      { status: 500 }
    );
  }
}
