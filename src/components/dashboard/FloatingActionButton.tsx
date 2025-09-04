'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Plus, 
  FileText, 
  LayoutDashboard, 
  Settings, 
  Users,
  Bell,
  ChevronUp
} from 'lucide-react';

interface QuickAction {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

export default function FloatingActionButton() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const quickActions: QuickAction[] = [
    {
      label: 'Create Invoice',
      href: '/dashboard/services/smart-invoicing/create',
      icon: Plus,
      color: 'bg-green-600 hover:bg-green-700'
    },
    {
      label: 'View Invoices',
      href: '/dashboard/services/smart-invoicing/invoices',
      icon: FileText,
      color: 'bg-blue-600 hover:bg-blue-700'
    },
    {
      label: 'Clients',
      href: '/dashboard/clients',
      icon: Users,
      color: 'bg-purple-600 hover:bg-purple-700'
    },
    {
      label: 'Notifications',
      href: '/dashboard/notifications',
      icon: Bell,
      color: 'bg-orange-600 hover:bg-orange-700'
    },
    {
      label: 'Settings',
      href: '/dashboard/settings/profile',
      icon: Settings,
      color: 'bg-gray-600 hover:bg-gray-700'
    }
  ];

  // Don't show on main dashboard page
  if (pathname === '/dashboard') {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Quick Actions Menu */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 mb-2 space-y-2">
          {quickActions.map((action, index) => (
            <Link
              key={action.href}
              href={action.href}
              className={`flex items-center space-x-3 px-4 py-3 ${action.color} text-white font-medium rounded-lg shadow-lg transition-all duration-200 hover:scale-105 touch-manipulation active:scale-95 min-w-[160px]`}
              onClick={() => setIsOpen(false)}
              style={{
                animationDelay: `${index * 50}ms`,
                animation: 'slideUp 0.2s ease-out forwards'
              }}
            >
              <action.icon className="h-5 w-5" />
              <span className="text-sm font-medium">{action.label}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Main FAB */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-center w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg transition-all duration-300 touch-manipulation active:scale-95 ${
          isOpen ? 'rotate-45' : 'hover:scale-110'
        }`}
        aria-label={isOpen ? 'Close quick actions' : 'Open quick actions'}
      >
        {isOpen ? (
          <ChevronUp className="h-6 w-6" />
        ) : (
          <LayoutDashboard className="h-6 w-6" />
        )}
      </button>

      {/* Overlay to close menu when clicking outside */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[-1]" 
          onClick={() => setIsOpen(false)}
        />
      )}

      <style jsx>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
