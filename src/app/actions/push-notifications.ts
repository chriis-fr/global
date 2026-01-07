'use server'

import webpush from 'web-push'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDatabase } from '@/lib/database'

// Initialize VAPID details
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:notifications@chains-erp.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

export async function subscribeUser(sub: {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' }
    }

    const db = await getDatabase()
    
    // Store subscription in database with user email
    await db.collection('push_subscriptions').updateOne(
      { 
        userId: session.user.email,
        endpoint: sub.endpoint 
      },
      {
        $set: {
          userId: session.user.email,
          subscription: sub,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      },
      { upsert: true }
    )

    return { success: true }
  } catch (error) {
    console.error('Error subscribing user:', error)
    return { success: false, error: 'Failed to subscribe' }
  }
}

export async function unsubscribeUser() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return { success: false, error: 'Unauthorized' }
    }

    const db = await getDatabase()
    
    // Remove subscription from database
    await db.collection('push_subscriptions').deleteMany({
      userId: session.user.email
    })

    return { success: true }
  } catch (error) {
    console.error('Error unsubscribing user:', error)
    return { success: false, error: 'Failed to unsubscribe' }
  }
}

export async function sendNotification(message: string, userId?: string) {
  try {
    const db = await getDatabase()
    
    // If userId is provided, send to that specific user
    // Otherwise, send to the current user
    let targetEmail: string | undefined = userId
    
    if (!targetEmail) {
      const session = await getServerSession(authOptions)
      if (!session?.user?.email) {
        throw new Error('Unauthorized')
      }
      targetEmail = session.user.email
    }

    // Get subscription from database
    const subscriptionDoc = await db.collection('push_subscriptions').findOne({
      userId: targetEmail
    })

    if (!subscriptionDoc || !subscriptionDoc.subscription) {
      throw new Error('No subscription available')
    }

    const subscription = subscriptionDoc.subscription as {
      endpoint: string;
      keys: {
        p256dh: string;
        auth: string;
      };
    }

    try {
      await webpush.sendNotification(
        subscription,
        JSON.stringify({
          title: 'Chains ERP',
          body: message,
          icon: '/chains.PNG',
          badge: '/chains.PNG',
        })
      )
      return { success: true }
    } catch (error: unknown) {
      // If subscription is invalid, remove it from database
      const errorObj = error as { statusCode?: number };
      if (errorObj.statusCode === 410 || errorObj.statusCode === 404) {
        await db.collection('push_subscriptions').deleteOne({
          userId: targetEmail
        })
      }
      throw error
    }
  } catch (error) {
    console.error('Error sending push notification:', error)
    return { success: false, error: 'Failed to send notification' }
  }
}

