declare module 'web-push' {
  export interface VapidDetails {
    subject: string;
    publicKey: string;
    privateKey: string;
  }

  export interface PushSubscription {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
    [key: string]: unknown;
  }

  export interface SendResult {
    statusCode: number;
    body: string;
    headers: Record<string, string>;
  }

  export interface WebPush {
    setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
    sendNotification(
      subscription: PushSubscription,
      payload: string | Buffer | null,
      options?: {
        TTL?: number;
        headers?: Record<string, string>;
        vapidDetails?: VapidDetails;
        urgency?: 'very-low' | 'low' | 'normal' | 'high';
        topic?: string;
        [key: string]: unknown;
      }
    ): Promise<SendResult>;
    generateVAPIDKeys(): {
      publicKey: string;
      privateKey: string;
    };
  }

  const webpush: WebPush;
  export default webpush;
}

