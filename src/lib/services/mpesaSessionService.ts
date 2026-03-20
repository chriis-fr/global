import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/database';
import { MpesaStkSession, MpesaStkStatus } from '@/models/MpesaStkSession';
import { PaymentEvent, PaymentEventType } from '@/models/PaymentEvent';

export class MpesaSessionService {
  private async getCollections() {
    const db = await connectToDatabase();
    const sessions = db.collection<MpesaStkSession>('mpesa_stk_sessions');
    const events = db.collection<PaymentEvent>('payment_events');
    return { sessions, events };
  }

  async createSession(params: {
    organizationId?: string;
    waiterUserId?: string;
    phoneNumber: string;
    amount: number;
    tableRef?: string;
    reference?: string;
    merchantRequestId?: string;
    checkoutRequestId?: string;
  }): Promise<MpesaStkSession> {
    const { sessions, events } = await this.getCollections();

    const now = new Date();
    const doc: MpesaStkSession = {
      organizationId: params.organizationId
        ? new ObjectId(params.organizationId)
        : undefined,
      waiterUserId: params.waiterUserId ? new ObjectId(params.waiterUserId) : undefined,
      phoneNumber: params.phoneNumber,
      amount: params.amount,
      status: 'pending',
      merchantRequestId: params.merchantRequestId,
      checkoutRequestId: params.checkoutRequestId,
      tableRef: params.tableRef,
      reference: params.reference,
      createdAt: now,
      updatedAt: now,
    };

    const result = await sessions.insertOne(doc);

    // Fire-and-forget event log (no await errors thrown)
    events
      .insertOne({
        organizationId: doc.organizationId,
        userId: doc.waiterUserId,
        type: 'MPESA_STK_REQUESTED',
        referenceId: result.insertedId.toString(),
        data: {
          phoneNumber: doc.phoneNumber,
          amount: doc.amount,
          tableRef: doc.tableRef,
        },
        createdAt: now,
      })
      .catch(() => {});

    return { ...doc, _id: result.insertedId };
  }

  async updateSessionStatusByCheckoutId(params: {
    checkoutRequestId: string;
    status: MpesaStkStatus;
    mpesaReceiptNumber?: string;
    confirmedAmount?: number;
    resultCode?: string;
    resultDescription?: string;
    transactionDate?: Date;
  }): Promise<MpesaStkSession | null> {
    const { sessions, events } = await this.getCollections();

    const now = new Date();
    const update: Partial<MpesaStkSession> = {
      status: params.status,
      updatedAt: now,
    };

    if (params.mpesaReceiptNumber) {
      update.mpesaReceiptNumber = params.mpesaReceiptNumber;
    }
    if (params.confirmedAmount != null) {
      update.confirmedAmount = params.confirmedAmount;
    }
    if (params.resultCode) {
      update.resultCode = params.resultCode;
    }
    if (params.resultDescription) {
      update.resultDescription = params.resultDescription;
    }
    if (params.transactionDate) {
      update.transactionDate = params.transactionDate;
    }
    if (params.status !== 'pending') {
      update.completedAt = now;
    }

    const result = await sessions.findOneAndUpdate(
      { checkoutRequestId: params.checkoutRequestId },
      { $set: update },
      { returnDocument: 'after' }
    );

    if (!result) {
      return null;
    }
    const doc = result as unknown as MpesaStkSession;

    const eventType: PaymentEventType =
      params.status === 'success'
        ? 'MPESA_STK_COMPLETED'
        : params.status === 'failed'
        ? 'MPESA_STK_FAILED'
        : 'MPESA_STK_REQUESTED';

    events
      .insertOne({
        organizationId: doc.organizationId,
        userId: doc.waiterUserId,
        type: eventType,
        referenceId: doc._id?.toString(),
        data: {
          phoneNumber: doc.phoneNumber,
          amount: doc.amount,
          mpesaReceiptNumber: doc.mpesaReceiptNumber,
          resultCode: doc.resultCode,
          resultDescription: doc.resultDescription,
        },
        createdAt: now,
      })
      .catch(() => {});

    return doc;
  }

  /**
   * Called by the C2B confirmation callback.
   * Matches by mpesaReceiptNumber (= TransID in the C2B payload) and stamps the customer name.
   */
  async updateSessionCustomerName(params: {
    mpesaReceiptNumber: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
  }): Promise<void> {
    const { sessions } = await this.getCollections();
    const update: Partial<MpesaStkSession> = { updatedAt: new Date() };
    if (params.firstName)  update.customerFirstName  = params.firstName;
    if (params.middleName) update.customerMiddleName = params.middleName;
    if (params.lastName)   update.customerLastName   = params.lastName;

    await sessions.updateOne(
      { mpesaReceiptNumber: params.mpesaReceiptNumber },
      { $set: update }
    );
  }

  async getSessionByCheckoutId(checkoutRequestId: string): Promise<(MpesaStkSession & { _id: import('mongodb').ObjectId }) | null> {
    const { sessions } = await this.getCollections();
    return sessions.findOne({ checkoutRequestId }) as Promise<(MpesaStkSession & { _id: import('mongodb').ObjectId }) | null>;
  }

  async getRecentSessionsForUser(params: {
    waiterUserId: string;
    limit?: number;
  }): Promise<MpesaStkSession[]> {
    const { sessions } = await this.getCollections();
    const limit = params.limit ?? 10;
    return sessions
      .find({ waiterUserId: new ObjectId(params.waiterUserId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }
}

export const mpesaSessionService = new MpesaSessionService();

