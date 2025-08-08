import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { paymentMethodService } from '@/lib/services/paymentMethodService';
import { UserService } from '@/lib/services/userService';
import { CreatePaymentMethodInput } from '@/models/PaymentMethod';
import { ObjectId } from 'mongodb';

// GET /api/payment-methods - List payment methods
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'fiat' | 'crypto' | undefined;
    const activeOnly = searchParams.get('activeOnly') !== 'false';

    // Get user and organization info
    const user = await UserService.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    let organizationId: ObjectId | undefined;
    let userId: ObjectId | undefined;

    if (user.organizationId) {
      // User belongs to an organization
      organizationId = user.organizationId;
    } else {
      // Individual user
      userId = user._id;
    }

    const paymentMethods = await paymentMethodService.getPaymentMethods(
      organizationId,
      userId,
      type,
      activeOnly
    );

    return NextResponse.json({
      success: true,
      data: {
        paymentMethods,
        organizationId: organizationId?.toString(),
        userId: userId?.toString()
      }
    });

  } catch (error) {
    console.error('Error fetching payment methods:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch payment methods' },
      { status: 500 }
    );
  }
}

// POST /api/payment-methods - Create a new payment method
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const input: CreatePaymentMethodInput = body;

    // Get user and organization info
    const user = await UserService.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    let organizationId: ObjectId | undefined;
    let userId: ObjectId | undefined;

    if (user.organizationId) {
      // User belongs to an organization
      organizationId = user.organizationId;
    } else {
      // Individual user
      userId = user._id;
    }

    // Validate the payment method
    const validation = paymentMethodService.validatePaymentMethod(input);
    if (!validation.isValid) {
      return NextResponse.json({
        success: false,
        error: 'Invalid payment method',
        details: validation.errors,
        warnings: validation.warnings
      }, { status: 400 });
    }

    const paymentMethod = await paymentMethodService.createPaymentMethod(
      input,
      organizationId,
      userId
    );

    return NextResponse.json({
      success: true,
      data: paymentMethod,
      warnings: validation.warnings
    });

  } catch (error) {
    console.error('Error creating payment method:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create payment method' },
      { status: 500 }
    );
  }
} 