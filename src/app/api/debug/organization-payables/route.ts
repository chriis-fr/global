import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const db = await connectToDatabase();
    
    // Get user
    const user = await db.collection('users').findOne({
      email: session.user.email
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    console.log('🔍 [Debug] User details:', {
      _id: user._id,
      email: user.email,
      organizationId: user.organizationId,
      organizationIdType: typeof user.organizationId
    });

    // Check if user is in organization
    if (!user.organizationId) {
      return NextResponse.json({
        success: true,
        message: 'User is not in organization',
        data: {
          user: {
            _id: user._id,
            email: user.email,
            organizationId: null
          },
          payables: [],
          approvalWorkflows: []
        }
      });
    }

    // Get organization
    const organization = await db.collection('organizations').findOne({
      _id: new ObjectId(user.organizationId)
    });

    console.log('🔍 [Debug] Organization details:', {
      _id: organization?._id,
      name: organization?.name,
      billingEmail: organization?.billingEmail,
      members: organization?.members?.length || 0
    });

    // Find all payables for this organization
    const payables = await db.collection('payables').find({
      $or: [
        { organizationId: user.organizationId },
        { organizationId: new ObjectId(user.organizationId) }
      ]
    }).toArray();

    console.log('🔍 [Debug] Organization payables found:', {
      count: payables.length,
      payables: payables.map(p => ({
        _id: p._id,
        payableNumber: p.payableNumber,
        organizationId: p.organizationId,
        userId: p.userId,
        issuerId: p.issuerId,
        status: p.status,
        total: p.total,
        currency: p.currency
      }))
    });

    // Find all approval workflows for this organization
    const approvalWorkflows = await db.collection('approval_workflows').find({
      organizationId: user.organizationId
    }).toArray();

    console.log('🔍 [Debug] Organization approval workflows found:', {
      count: approvalWorkflows.length,
      workflows: approvalWorkflows.map(w => ({
        _id: w._id,
        billId: w.billId,
        status: w.status,
        currentStep: w.currentStep,
        organizationId: w.organizationId
      }))
    });

    return NextResponse.json({
      success: true,
      message: 'Organization payables debug info',
      data: {
        user: {
          _id: user._id,
          email: user.email,
          organizationId: user.organizationId
        },
        organization: organization ? {
          _id: organization._id,
          name: organization.name,
          billingEmail: organization.billingEmail,
          memberCount: organization.members?.length || 0
        } : null,
        payables: payables.map(p => ({
          _id: p._id,
          payableNumber: p.payableNumber,
          organizationId: p.organizationId,
          userId: p.userId,
          issuerId: p.issuerId,
          status: p.status,
          total: p.total,
          currency: p.currency,
          createdAt: p.createdAt
        })),
        approvalWorkflows: approvalWorkflows.map(w => ({
          _id: w._id,
          billId: w.billId,
          status: w.status,
          currentStep: w.currentStep,
          organizationId: w.organizationId
        }))
      }
    });

  } catch (error) {
    console.error('Error debugging organization payables:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to debug organization payables' },
      { status: 500 }
    );
  }
}
