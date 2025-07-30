'use client';
import Link from 'next/link';
import { Home } from 'lucide-react';

export default function DashboardFloatingButton() {
  return (
    <Link
      href="/dashboard"
      className="fixed bottom-6 right-6 z-50 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-all duration-200 hover:scale-110 hover:shadow-xl"
      aria-label="Go to dashboard"
    >
      <Home className="h-6 w-6" />
    </Link>
  );
} 