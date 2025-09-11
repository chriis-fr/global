import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get('invoiceId');
    const payableId = searchParams.get('payableId');

    if (!invoiceId && !payableId) {
      return NextResponse.json({ 
        success: false, 
        message: 'Please provide either invoiceId or payableId' 
      }, { status: 400 });
    }

    const db = await connectToDatabase();
    const invoicesCollection = db.collection('invoices');
    const payablesCollection = db.collection('payables');

    let result: any = {};

    if (invoiceId) {
      // Find invoice and related payables
      const invoice = await invoicesCollection.findOne({ _id: new ObjectId(invoiceId) });
      if (invoice) {
        result.invoice = {
          _id: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          status: invoice.status,
          clientEmail: invoice.clientEmail,
          total: invoice.total || invoice.totalAmount
        };

        // Find related payables
        const relatedPayables = await payablesCollection.find({ 
          relatedInvoiceId: new ObjectId(invoiceId) 
        }).toArray();

        result.relatedPayables = relatedPayables.map(payable => ({
          _id: payable._id,
          payableNumber: payable.payableNumber,
          status: payable.status,
          issuerId: payable.issuerId,
          userId: payable.userId,
          relatedInvoiceId: payable.relatedInvoiceId
        }));
      } else {
        result.invoice = null;
        result.relatedPayables = [];
      }
    }

    if (payableId) {
      // Find payable and related invoice
      const payable = await payablesCollection.findOne({ _id: new ObjectId(payableId) });
      if (payable) {
        result.payable = {
          _id: payable._id,
          payableNumber: payable.payableNumber,
          status: payable.status,
          issuerId: payable.issuerId,
          userId: payable.userId,
          relatedInvoiceId: payable.relatedInvoiceId
        };

        // Find related invoice
        if (payable.relatedInvoiceId) {
          const relatedInvoice = await invoicesCollection.findOne({ 
            _id: payable.relatedInvoiceId 
          });
          
          result.relatedInvoice = relatedInvoice ? {
            _id: relatedInvoice._id,
            invoiceNumber: relatedInvoice.invoiceNumber,
            status: relatedInvoice.status,
            clientEmail: relatedInvoice.clientEmail,
            total: relatedInvoice.total || relatedInvoice.totalAmount
          } : null;
        } else {
          result.relatedInvoice = null;
        }
      } else {
        result.payable = null;
        result.relatedInvoice = null;
      }
    }

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ [Debug API] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch relationship data' },
      { status: 500 }
    );
  }
}
