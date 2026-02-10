'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href: string;
  isActive?: boolean;
}

export default function Breadcrumb() {
  const pathname = usePathname();
  
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const segments = pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [
      { label: 'Dashboard', href: '/dashboard' }
    ];

    let currentPath = '/dashboard';
    
    // Start from index 1 to skip 'dashboard' segment (already in breadcrumbs)
    segments.slice(1).forEach((segment, index) => {
      currentPath += `/${segment}`;
      
      let label = segment;
      
      // Customize labels for better readability
      switch (segment) {
        case 'services':
          label = 'Services';
          break;
        case 'smart-invoicing':
          label = 'Smart Invoicing';
          break;
        case 'create':
          label = 'Create Invoice';
          break;
        case 'invoices':
          label = 'Invoices';
          break;
        case 'settings':
          label = 'Settings';
          break;
        case 'profile':
          label = 'Profile';
          break;
        case 'organization':
          label = 'Organization';
          break;
        case 'logos':
          label = 'Logo Management';
          break;
        case 'payment-methods':
          label = 'Payment Methods';
          break;
        case 'notifications':
          label = 'Notifications';
          break;
        case 'help':
          label = 'Help & Support';
          break;
        case 'approvals':
          label = 'Pending Approvals';
          break;
        case 'clients':
          label = 'Clients';
          break;
        case 'payables':
          label = 'Payables';
          break;
        default:
          // Capitalize first letter and replace hyphens with spaces
          label = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
      }
      
      // isActive is true for the last segment
      const isActive = index === segments.slice(1).length - 1;
      // /dashboard/settings has no page; link "Settings" to profile as the default settings page
      const href = currentPath === '/dashboard/settings' ? '/dashboard/settings/profile' : currentPath;
      breadcrumbs.push({
        label,
        href,
        isActive
      });
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  // Don't show breadcrumbs on the main dashboard page
  if (pathname === '/dashboard') {
    return null;
  }

  return (
    <nav className="flex items-center space-x-1 text-sm text-white/80 mb-4 px-1" aria-label="Breadcrumb">
      <Link 
        href="/dashboard" 
        className="flex items-center hover:text-blue-300 transition-colors touch-manipulation"
      >
        <Home className="h-4 w-4" />
      </Link>
      
      {breadcrumbs.slice(1).map((breadcrumb, index) => (
        <div key={`${breadcrumb.label}-${index}`} className="flex items-center space-x-1">
          <ChevronRight className="h-4 w-4 text-white/60" />
          {breadcrumb.isActive ? (
            <span className="text-white font-medium">{breadcrumb.label}</span>
          ) : (
            <Link 
              href={breadcrumb.href}
              className="hover:text-blue-300 transition-colors touch-manipulation"
            >
              {breadcrumb.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}
