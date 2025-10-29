import { NextRequest, NextResponse } from 'next/server';

export async function POST() {
  console.log('🧪 [TestWebhook] Testing webhook endpoint');
  
  // Simulate a checkout.session.completed event
  const testEvent = {
    id: 'evt_test_webhook',
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_123',
        mode: 'subscription',
        customer: 'cus_test_123',
        subscription: 'sub_test_123',
        payment_status: 'paid',
        customer_details: {
          email: 'test@example.com'
        }
      }
    }
  };

  console.log('🧪 [TestWebhook] Simulated event:', testEvent);
  
  return NextResponse.json({ 
    success: true, 
    message: 'Test webhook event created',
    event: testEvent
  });
}
