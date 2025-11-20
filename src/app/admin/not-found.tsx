'use client';

import { useRouter } from 'next/navigation';
import { Home, ArrowLeft, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function AdminNotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-red-100 p-4">
            <AlertCircle className="h-12 w-12 text-red-600" />
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-2">404</h1>
        <h2 className="text-xl font-semibold text-gray-700 mb-4">Admin Page Not Found</h2>
        
        <p className="text-gray-600 mb-8">
          The admin page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        
        <div className="space-y-3">
          <button
            onClick={() => router.push('/admin')}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Admin Dashboard
          </button>
          
          <Link
            href="/"
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            <Home className="h-5 w-5" />
            Go to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}

