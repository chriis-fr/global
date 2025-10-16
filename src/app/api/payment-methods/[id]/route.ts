import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { paymentMethodService } from '@/lib/services/paymentMethodService';
import { UserService } from '@/lib/services/userService';
import { UpdatePaymentMethodInput } from '@/models/PaymentMethod';
import { ObjectId } from 'mongodb';

// GET /api/payment-methods/[id] - Get a specific payment method
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const methodId = new ObjectId(id);

    // Get user and organization info
    const user = await UserService.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    let organizationId: ObjectId | undefined;
    let userId: ObjectId | undefined;

    if (user.organizationId) {
      organizationId = user.organizationId;
    } else {
      userId = user._id;
    }

    const paymentMethod = await paymentMethodService.getPaymentMethodById(
      methodId,
      organizationId,
      userId
    );

    if (!paymentMethod) {
      return NextResponse.json({ success: false, error: 'Payment method not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: paymentMethod
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch payment method' },
      { status: 500 }
    );
  }
}

// PUT /api/payment-methods/[id] - Update a payment method
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const methodId = new ObjectId(id);
    const body = await request.json();
    const input: UpdatePaymentMethodInput = body;

    // Get user and organization info
    const user = await UserService.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    let organizationId: ObjectId | undefined;
    let userId: ObjectId | undefined;

    if (user.organizationId) {
      organizationId = user.organizationId;
    } else {
      userId = user._id;
    }

    const paymentMethod = await paymentMethodService.updatePaymentMethod(
      methodId,
      input,
      organizationId,
      userId
    );

    if (!paymentMethod) {
      return NextResponse.json({ success: false, error: 'Payment method not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: paymentMethod
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to update payment method' },
      { status: 500 }
    );
  }
}

// DELETE /api/payment-methods/[id] - Delete a payment method
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const methodId = new ObjectId(id);

    // Get user and organization info
    const user = await UserService.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    let organizationId: ObjectId | undefined;
    let userId: ObjectId | undefined;

    if (user.organizationId) {
      organizationId = user.organizationId;
    } else {
      userId = user._id;
    }

    const deleted = await paymentMethodService.deletePaymentMethod(
      methodId,
      organizationId,
      userId
    );

    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Payment method not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Payment method deleted successfully'
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to delete payment method' },
      { status: 500 }
    );
  }
} 