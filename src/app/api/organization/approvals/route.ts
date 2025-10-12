import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ApprovalService } from '@/lib/services/approvalService';
import { RBACService } from '@/lib/services/rbacService';
import { getDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

// Sync payable to financial ledger
async function syncPayableToLedger(payableId: string, status: string) {
  try {
    const db = await getDatabase();
    
    // Get the payable
    const payable = await db.collection('payables').findOne({
      _id: new ObjectId(payableId)
    });
    
    if (!payable) {
      console.log('⚠️ [Ledger Sync] Payable not found:', payableId);
      return;
    }
    
    // Check if ledger entry already exists
    let ledgerEntry = await db.collection('financial_ledger').findOne({
      relatedPayableId: new ObjectId(payableId)
    });
    
    if (ledgerEntry) {
      // Update existing ledger entry
      await db.collection('financial_ledger').updateOne(
        { _id: ledgerEntry._id },
        {
          $set: {
            status: status,
            updatedAt: new Date()
          }
        }
      );
      console.log('✅ [Ledger Sync] Updated existing ledger entry for payable:', payableId);
    } else {
      // Create new ledger entry
      const ledgerEntryData = {
        entryId: `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
        type: 'payable',
        status: status,
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
        relatedPayableId: new ObjectId(payableId),
        relatedInvoiceId: payable.relatedInvoiceId ? new ObjectId(payable.relatedInvoiceId) : null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await db.collection('financial_ledger').insertOne(ledgerEntryData);
      
      // Update payable with ledger entry ID
      await db.collection('payables').updateOne(
        { _id: new ObjectId(payableId) },
        {
          $set: {
            ledgerEntryId: result.insertedId,
            ledgerStatus: 'synced'
          }
        }
      );
      
      console.log('✅ [Ledger Sync] Created new ledger entry for payable:', payableId);
    }
  } catch (error) {
    console.error('❌ [Ledger Sync] Error syncing payable to ledger:', error);
    throw error;
  }
}

// GET /api/organization/approvals - Get pending approvals for user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const db = await getDatabase();
    const user = await db.collection('users').findOne({
      email: session.user.email
    });

    if (!user || !user.organizationId) {
      return NextResponse.json(
        { success: false, message: 'User not found or not in organization' },
        { status: 404 }
      );
    }

    // Check if user can approve bills
    const organization = await db.collection('organizations').findOne({
      _id: user.organizationId
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, message: 'Organization not found' },
        { status: 404 }
      );
    }

    const member = organization.members.find((m: any) => m.userId.toString() === user._id?.toString());
    if (!member) {
      return NextResponse.json(
        { success: false, message: 'User not found in organization' },
        { status: 404 }
      );
    }

    // Check permissions
    if (!RBACService.canApproveBills(member)) {
      return NextResponse.json(
        { success: false, message: 'Insufficient permissions to view approvals' },
        { status: 403 }
      );
    }

    // Get pending approvals for this user
    const pendingApprovals = await ApprovalService.getPendingApprovals(user._id!.toString());
    
      // Pending approvals retrieved

    // Enrich with payable details (since we're using payables, not bills)
    const enrichedApprovals = await Promise.all(
      pendingApprovals.map(async (approval) => {
        // First try to find in payables collection
        let payable = await db.collection('payables').findOne({
          _id: new ObjectId(approval.billId)
        });

        // If not found in payables, try bills collection for backward compatibility
        if (!payable) {
          payable = await db.collection('bills').findOne({
            _id: new ObjectId(approval.billId)
          });
        }

        return {
          ...approval,
          bill: payable ? {
            _id: payable._id,
            vendor: payable.vendorName || payable.vendor,
            amount: payable.total || payable.amount,
            currency: payable.currency,
            description: payable.payableName || payable.description,
            category: payable.category || 'Invoice Payment',
            dueDate: payable.dueDate,
            createdAt: payable.createdAt
          } : null
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: enrichedApprovals,
      message: 'Pending approvals retrieved successfully'
    });

  } catch (error) {
    console.error('Error getting pending approvals:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to get pending approvals',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/organization/approvals - Process approval decision
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { workflowId, decision, comments } = body;

    if (!workflowId || !decision) {
      return NextResponse.json(
        { success: false, message: 'Workflow ID and decision are required' },
        { status: 400 }
      );
    }

    if (!['approved', 'rejected'].includes(decision)) {
      return NextResponse.json(
        { success: false, message: 'Decision must be either "approved" or "rejected"' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    const user = await db.collection('users').findOne({
      email: session.user.email
    });

    if (!user || !user.organizationId) {
      return NextResponse.json(
        { success: false, message: 'User not found or not in organization' },
        { status: 404 }
      );
    }

    // Check if user can approve bills
    const organization = await db.collection('organizations').findOne({
      _id: user.organizationId
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, message: 'Organization not found' },
        { status: 404 }
      );
    }

    const member = organization.members.find((m: any) => m.userId.toString() === user._id?.toString());
    if (!member) {
      return NextResponse.json(
        { success: false, message: 'User not found in organization' },
        { status: 404 }
      );
    }

    // Check permissions
    if (!RBACService.canApproveBills(member)) {
      return NextResponse.json(
        { success: false, message: 'Insufficient permissions to approve bills' },
        { status: 403 }
      );
    }

    // Process the approval decision
    const success = await ApprovalService.processApprovalDecision(
      workflowId,
      user._id!.toString(),
      decision,
      comments
    );

    if (success) {
      // Get the workflow to check its final status
      const workflow = await ApprovalService.getApprovalWorkflow(workflowId);
      if (workflow) {
        // Update payable status based on workflow status
        const payableStatus = workflow.status === 'approved' ? 'approved' : 
                             workflow.status === 'rejected' ? 'rejected' : 
                             'pending_approval';
        
        console.log('🔍 [Approval] Attempting to update payable:', {
          workflowId,
          workflowBillId: workflow.billId,
          workflowBillIdType: typeof workflow.billId,
          payableStatus
        });

        let payableUpdate = { modifiedCount: 0 };
        
        if (workflow.billId) {
          payableUpdate = await db.collection('payables').updateOne(
            { _id: new ObjectId(workflow.billId) },
            { 
              $set: { 
                status: payableStatus,
                approvalStatus: payableStatus,
                updatedAt: new Date()
              }
            }
          );
        } else {
          console.log('⚠️ [Approval] Workflow has null billId, cannot update payable directly');
          
          // Try to find payable by workflow ID
          const payable = await db.collection('payables').findOne({
            approvalWorkflowId: workflow._id
          });
          
          if (payable) {
            console.log('✅ [Approval] Found payable by workflow ID, updating:', payable._id);
            payableUpdate = await db.collection('payables').updateOne(
              { _id: payable._id },
              { 
                $set: { 
                  status: payableStatus,
                  approvalStatus: payableStatus,
                  updatedAt: new Date()
                }
              }
            );
            
            // Also update the workflow with the correct billId
            await db.collection('approval_workflows').updateOne(
              { _id: new ObjectId(workflowId) },
              { 
                $set: { 
                  billId: payable._id,
                  updatedAt: new Date()
                }
              }
            );
          }
        }

        console.log('✅ [Approval] Payable status updated:', {
          workflowId,
          billId: workflow.billId,
          workflowStatus: workflow.status,
          payableStatus,
          updated: payableUpdate.modifiedCount > 0
        });

        // Clear any cached data to ensure UI updates
        if (payableUpdate.modifiedCount > 0) {
          console.log('🔄 [Approval] Payable updated, cache should be invalidated');
          
          // Sync to financial ledger if payable status changed
          if (workflow.status === 'approved' || workflow.status === 'rejected') {
            try {
              await syncPayableToLedger(workflow.billId, payableStatus);
            } catch (ledgerError) {
              console.error('❌ [Approval] Failed to sync payable to ledger:', ledgerError);
            }
          }
          
          // Two-way sync: if payable is paid, mark related invoice as paid
          if (payableStatus === 'paid') {
            try {
              let payable;
              if (workflow.billId) {
                payable = await db.collection('payables').findOne({
                  _id: new ObjectId(workflow.billId)
                });
              } else {
                payable = await db.collection('payables').findOne({
                  approvalWorkflowId: workflow._id
                });
              }
              
              if (payable && payable.relatedInvoiceId) {
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
                  console.log('✅ [Approval] Marked related invoice as paid:', {
                    invoiceId: payable.relatedInvoiceId,
                    payableId: payable._id
                  });
                }
              }
            } catch (syncError) {
              console.error('❌ [Approval] Failed to sync invoice to paid status:', syncError);
            }
          }
        }

        // If workflow is approved or rejected, sync with related invoice
        if (workflow.status === 'approved' || workflow.status === 'rejected') {
          let payable;
          
          if (workflow.billId) {
            payable = await db.collection('payables').findOne({
              _id: new ObjectId(workflow.billId)
            });
          } else {
            // Find payable by workflow ID
            payable = await db.collection('payables').findOne({
              approvalWorkflowId: workflow._id
            });
          }

          if (payable && payable.relatedInvoiceId) {
            try {
              const { syncInvoiceStatusWithPayable } = await import('@/lib/actions/payableStatusSync');
              await syncInvoiceStatusWithPayable(payable._id.toString(), workflow.status, comments);
              console.log('✅ [Approval] Invoice status synced for payable:', workflow.status);
            } catch (syncError) {
              console.error('Failed to sync invoice status:', syncError);
            }
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: `Bill ${decision} successfully`
      });
    } else {
      return NextResponse.json(
        { success: false, message: 'Failed to process approval decision' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error processing approval decision:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to process approval decision',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
