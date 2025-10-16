import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/services/userService';
import { CreateUserInput } from '@/models';
import { createDefaultServices } from '@/lib/services/serviceManager';
import bcrypt from 'bcryptjs';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

interface InvoiceData {
  _id: string;
  invoiceNumber: string;
  dueDate: string;
  currency: string;
  paymentMethod: string;
  paymentNetwork?: string;
  paymentAddress?: string;
  subtotal: number;
  totalTax: number;
  totalAmount: number;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    tax: number;
    amount: number;
  }>;
  companyDetails?: {
    name: string;
    email: string;
    phone?: string;
    address?: Record<string, unknown>;
  };
  companyName?: string;
  companyEmail?: string;
  companyPhone?: string;
  companyAddress?: Record<string, unknown>;
  clientDetails?: {
    name: string;
    email: string;
    phone?: string;
    address?: Record<string, unknown>;
  };
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, invoiceNumber, invoiceData } = body;


    // Validate required fields
    if (!email || !invoiceNumber || !invoiceData) {
      return NextResponse.json(
        { success: false, message: 'Email, invoice number, and invoice data are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await UserService.getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { success: false, message: 'Account already exists for this email' },
        { status: 409 }
      );
    }

    // Generate a temporary password
    const temporaryPassword = Math.random().toString(36).slice(-12) + 'A1!';
    const hashedPassword = await bcrypt.hash(temporaryPassword, 12);

    // Extract name from invoice data
    const clientName = invoiceData.clientDetails?.name || 
                      invoiceData.clientDetails?.companyName || 
                      email.split('@')[0];

    // Create user data
    const userData: CreateUserInput = {
      email,
      password: hashedPassword,
      name: clientName,
      role: 'user',
      userType: 'individual', // Default to individual, can be changed later
      phone: invoiceData.clientDetails?.phone,
      industry: 'Other',
      address: invoiceData.clientDetails?.address || {
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'US'
      },
      taxId: '',
      termsAgreement: {
        agreed: true,
        agreedAt: new Date(),
        termsVersion: '1.0'
      },
      walletAddresses: [],
      settings: {
        currencyPreference: invoiceData.currency || 'USD',
        notifications: {
          email: true,
          sms: false,
          push: false,
          inApp: true,
          invoiceCreated: true,
          invoicePaid: true,
          invoiceOverdue: true,
          paymentReceived: true,
          paymentFailed: true,
          systemUpdates: true,
          securityAlerts: true,
          reminders: true,
          approvals: true,
          frequency: 'immediate',
          quietHours: {
            enabled: false,
            start: '22:00',
            end: '08:00',
            timezone: 'UTC'
          }
        }
      },
      services: createDefaultServices(),
      onboarding: {
        completed: false,
        currentStep: 1,
        completedSteps: ['signup'],
        serviceOnboarding: {}
      }
    };

      email: userData.email,
      name: userData.name,
      userType: userData.userType
    });

    // Create the user
    const newUser = await UserService.createUser(userData);

    // Create payable record for the invoice
    await createPayableFromInvoice(newUser._id!.toString(), invoiceData);

    // Return success with temporary password for auto-login
    return NextResponse.json({
      success: true,
      message: 'Account created successfully',
      data: {
        userId: newUser._id,
        email: newUser.email,
        temporaryPassword // This will be used for auto-login
      }
    });

  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to create account',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function createPayableFromInvoice(userId: string, invoiceData: InvoiceData) {
  try {

    const db = await connectToDatabase();
    const payablesCollection = db.collection('payables');

    // Generate payable number
    const payableNumber = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    // Create payable data
    const payableData = {
      payableNumber,
      payableName: `Invoice Payment - ${invoiceData.invoiceNumber}`,
      issueDate: new Date(),
      dueDate: new Date(invoiceData.dueDate),
      companyName: invoiceData.companyDetails?.name || invoiceData.companyName,
      companyEmail: invoiceData.companyDetails?.email || invoiceData.companyEmail,
      companyPhone: invoiceData.companyDetails?.phone || invoiceData.companyPhone,
      companyAddress: invoiceData.companyDetails?.address || invoiceData.companyAddress,
      companyTaxNumber: '',
      vendorName: invoiceData.clientDetails?.name || invoiceData.clientName,
      vendorEmail: invoiceData.clientDetails?.email || invoiceData.clientEmail,
      vendorPhone: invoiceData.clientDetails?.phone || invoiceData.clientPhone,
      vendorAddress: invoiceData.clientDetails?.address || invoiceData.clientAddress,
      currency: invoiceData.currency,
      paymentMethod: invoiceData.paymentMethod,
      paymentNetwork: invoiceData.paymentNetwork,
      paymentAddress: invoiceData.paymentAddress,
      enableMultiCurrency: false,
      payableType: 'regular',
      items: invoiceData.items || [],
      subtotal: invoiceData.subtotal || 0,
      totalTax: invoiceData.totalTax || 0,
      total: invoiceData.totalAmount || 0,
      memo: `Auto-generated payable from invoice ${invoiceData.invoiceNumber}`,
      status: 'pending',
      priority: 'medium',
      category: 'Invoice Payment',
      attachedFiles: [],
      issuerId: new ObjectId(userId),
      organizationId: null, // Individual user
      relatedInvoiceId: new ObjectId(invoiceData._id),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await payablesCollection.insertOne(payableData);

    // Also sync to financial ledger
    try {
      const { LedgerSyncService } = await import('@/lib/services/ledgerSyncService');
      const payableWithId = { _id: result.insertedId, ...payableData };
      await LedgerSyncService.syncPayableToLedger(payableWithId);
    } catch (syncError) {
      // Don't fail the request if sync fails
    }

  } catch (error) {
    // Don't fail the account creation if payable creation fails
  }
}
