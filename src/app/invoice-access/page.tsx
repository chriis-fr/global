'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession, signIn } from '@/lib/auth-client';
import { motion } from 'framer-motion';
import { 
  Receipt, 
  AlertCircle,
  Loader2,
  ArrowRight,
  Shield
} from 'lucide-react';

interface Invoice {
  _id: string;
  invoiceNumber: string;
  invoiceName?: string;
  issueDate: string;
  dueDate: string;
  companyDetails: {
    name: string;
    email: string;
    phone?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
    };
  };
  clientDetails: {
    name: string;
    email: string;
    phone?: string;
    companyName?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
    };
  };
  currency: string;
  paymentMethod: 'fiat' | 'crypto';
  paymentNetwork?: string;
  paymentAddress?: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    tax: number;
    amount: number;
  }>;
  subtotal: number;
  totalTax: number;
  totalAmount: number;
  memo?: string;
  status: 'draft' | 'sent' | 'pending' | 'paid' | 'overdue';
  createdAt: string;
  updatedAt: string;
}

interface TokenValidationData {
  token: string;
  invoice: Invoice;
  recipientEmail: string;
  isRegistered: boolean;
  requiresSignup: boolean;
}

function InvoiceAccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  
  const [tokenData, setTokenData] = useState<TokenValidationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const token = searchParams?.get('token');

  // Redirect to dedicated pay-invoice page so users can pay without signing up
  useEffect(() => {
    if (token) {
      router.replace(`/pay-invoice?token=${token}`);
    }
  }, [token, router]);

  const markTokenAsUsed = useCallback(async () => {
    try {
      await fetch('/api/invoice-access/mark-used', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          token,
          userId: session?.user?.id 
        }),
      });
    } catch {
    }
  }, [token, session?.user?.id]);

  const createPayableForRegisteredUser = useCallback(async () => {
    if (!tokenData) return;
    
    try {
      // Create payable for the registered user
      const response = await fetch('/api/invoice-access/process-signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: session?.user?.id,
          token: token
        }),
      });

      const data = await response.json();
      if (data.success) {
        // Mark token as used and redirect to app
        await markTokenAsUsed();
        router.push('/dashboard/services/payables');
      } else {
        // Still redirect to payables page
        router.push('/dashboard/services/payables');
      }
    } catch {
      // Fallback: redirect to payables page
      router.push('/dashboard/services/payables');
    }
  }, [tokenData, session, router, markTokenAsUsed, token]);

  const validateToken = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/invoice-access/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (data.success) {
        setTokenData(data.data);
      } else {
        setError(data.message || 'Invalid or expired access link');
      }
    } catch {
      setError('Failed to validate access link');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      validateToken();
    } else {
      setError('Invalid access link');
      setLoading(false);
    }
  }, [token, validateToken]);

  // Handle authenticated user redirect - moved to top to avoid hooks order issue
  useEffect(() => {
    if (session?.user?.email === tokenData?.recipientEmail && tokenData) {
      // Create payable for registered user and redirect to app
      createPayableForRegisteredUser();
    }
  }, [session, tokenData, createPayableForRegisteredUser]);

  const handleSignIn = async () => {
    if (!tokenData?.recipientEmail) return;
    
    try {
      await signIn('credentials', {
        email: tokenData.recipientEmail,
        callbackUrl: `/invoice-access?token=${token}`,
        redirect: true
      });
    } catch {
    }
  };

  const handleSignUp = () => {
    // Redirect to signup page with token
    const signupUrl = `/auth?invoiceToken=${token}&email=${encodeURIComponent(tokenData?.recipientEmail || '')}`;
    router.push(signupUrl);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Validating access link...</p>
        </div>
      </div>
    );
  }

  if (error || !tokenData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-6">
            {error || 'This access link is invalid or has expired.'}
          </p>
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }


  // If user is authenticated and this is their invoice, show redirect message
  if (session?.user?.email === tokenData?.recipientEmail) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  // Show authentication/account creation flow for unauthenticated users
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center space-x-4">
            <Shield className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Secure Invoice Access</h1>
              <p className="text-gray-600">Invoice #{tokenData?.invoice?.invoiceNumber} from {tokenData?.invoice?.companyDetails?.name}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Authentication Flow */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-8"
        >
          <div className="text-center mb-8">
            <Receipt className="h-16 w-16 text-blue-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Your Invoice</h2>
            <p className="text-gray-600">
              This secure link was sent to <strong>{tokenData?.recipientEmail}</strong>
            </p>
          </div>

          <div className="space-y-6">
            {tokenData?.isRegistered ? (
              <div>
                <p className="text-gray-600 mb-4">
                  You already have an account with this email address. Please sign in to access your invoice.
                </p>
                <button
                  onClick={handleSignIn}
                  className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <span>Sign In to Access Invoice</span>
                  <ArrowRight className="ml-2 h-4 w-4" />
                </button>
              </div>
            ) : (
              <div>
                <p className="text-gray-600 mb-4">
                  Create a free account to access and pay this invoice online.
                </p>
                <button
                  onClick={handleSignUp}
                  className="w-full flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <span>Create Account & Access Invoice</span>
                  <ArrowRight className="ml-2 h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500 text-center">
              By continuing, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function InvoiceAccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <InvoiceAccessContent />
    </Suspense>
  );
}
