'use client';

import Link from 'next/link';
import { Home, AlertCircle } from 'lucide-react';

export default function NotFound() {

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center">
        {/* Animated 404 */}
        <div className="mb-8">
          <h1 className="text-9xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 animate-pulse">
            404
          </h1>
        </div>

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-blue-200 rounded-full blur-xl opacity-50 animate-pulse"></div>
            <div className="relative rounded-full bg-gradient-to-br from-blue-500 to-purple-500 p-6">
              <AlertCircle className="h-16 w-16 text-white" />
            </div>
          </div>
        </div>

        {/* Message */}
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          Page Not Found
        </h2>
        <p className="text-lg text-gray-600 mb-8 max-w-md mx-auto">
          Oops! The page you&apos;re looking for doesn&apos;t exist or has been moved. 
          Let&apos;s get you back on track.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            href="/"
            className="group flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 font-semibold text-lg min-w-[200px]"
          >
            <Home className="h-5 w-5 group-hover:scale-110 transition-transform" />
            Go to Homepage
          </Link>
          
          
        </div>

        {/* Decorative Elements */}
        <div className="mt-12 flex justify-center gap-2">
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
        </div>

        {/* Helpful Links */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500 mb-4">Or try one of these:</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/dashboard"
              className="text-blue-600 hover:text-blue-700 hover:underline text-sm font-medium transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/auth"
              className="text-blue-600 hover:text-blue-700 hover:underline text-sm font-medium transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/pricing"
              className="text-blue-600 hover:text-blue-700 hover:underline text-sm font-medium transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/services"
              className="text-blue-600 hover:text-blue-700 hover:underline text-sm font-medium transition-colors"
            >
              Services
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

