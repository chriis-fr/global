'use client';
import { useState, useEffect, useRef, useCallback, memo, startTransition } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { 
  FileText, 
  Menu, 
  X, 
  User, 
  Building2, 
  Bell,
  HelpCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  ImageIcon,
  CheckCircle,
  Receipt
} from 'lucide-react';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import Image from 'next/image';
import { useSubscription } from '@/lib/contexts/SubscriptionContext';
import { usePermissions } from '@/lib/contexts/PermissionContext';
import { useOnboardingStore } from '@/lib/stores/onboardingStore';

const SERVICE_LINKS = [
  {
    key: 'smartInvoicing',
    label: 'Smart Invoicing',
    icon: FileText,
    href: '/dashboard/services/smart-invoicing',
  },
  {
    key: 'accountsPayable',
    label: 'Pay',
    icon: Receipt,
    href: '/dashboard/services/payables',
  },
  // Add more services as they become ready
];

const ADMIN_LINKS = [
  {
    key: 'approvals',
    label: 'Pending Approvals',
    icon: CheckCircle,
    href: '/dashboard/approvals',
  },
];

const SETTINGS_LINKS = [
  {
    key: 'profile',
    label: 'Profile Settings',
    icon: User,
    href: '/dashboard/settings/profile',
  },
  {
    key: 'organization',
    label: 'Organization',
    icon: Building2,
    href: '/dashboard/settings/organization',
  },
  {
    key: 'logos',
    label: 'Logo Management',
    icon: ImageIcon,
    href: '/dashboard/settings/logos',
  },
  {
    key: 'payment-methods',
    label: 'Payment Methods',
    icon: CreditCard,
    href: '/dashboard/settings/payment-methods',
  },
  {
    key: 'notifications',
    label: 'Notifications',
    icon: Bell,
    href: '/dashboard/settings/notifications',
  },
  {
    key: 'help',
    label: 'Help & Support',
    icon: HelpCircle,
    href: '/dashboard/settings/help',
  },
];

function Sidebar() {
  const { data: session } = useSession();
  const { subscription } = useSubscription();
  const { permissions } = usePermissions();
  const { clearOnboarding } = useOnboardingStore();
  const pathname = usePathname();
  // const enabledServices = session?.user?.services || {}; // Temporarily disabled to show all services
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isAutoHidden, setIsAutoHidden] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  
  // Touch gesture state for mobile
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Auto-hide functionality
  useEffect(() => {
    const handleMouseMove = () => {
      if (isAutoHidden) {
        setIsAutoHidden(false);
      }
      
      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Set new timeout (5 seconds of inactivity)
      timeoutRef.current = setTimeout(() => {
        if (!isCollapsed && window.innerWidth >= 1024) {
          setIsAutoHidden(true);
        }
      }, 5000);
    };

    const handleMouseLeave = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Auto-hide after 3 seconds when mouse leaves sidebar area
      timeoutRef.current = setTimeout(() => {
        if (!isCollapsed && window.innerWidth >= 1024) {
          setIsAutoHidden(true);
        }
      }, 3000);
    };

    const handleMouseEnter = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setIsAutoHidden(false);
    };

    // Only add auto-hide functionality on large screens
    if (window.innerWidth >= 1024) {
      document.addEventListener('mousemove', handleMouseMove);
      
      if (sidebarRef.current) {
        sidebarRef.current.addEventListener('mouseleave', handleMouseLeave);
        sidebarRef.current.addEventListener('mouseenter', handleMouseEnter);
      }
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isCollapsed, isAutoHidden]);

  // Listen for custom event to open mobile sidebar
  useEffect(() => {
    const handleOpenMobileSidebar = () => {
      setIsMobileMenuOpen(true);
    };

    window.addEventListener('openMobileSidebar', handleOpenMobileSidebar);
    return () => {
      window.removeEventListener('openMobileSidebar', handleOpenMobileSidebar);
    };
  }, []);

  // Touch gesture handlers for mobile
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && isMobileMenuOpen) {
      // Swipe left to close sidebar
      setIsMobileMenuOpen(false);
    } else if (isRightSwipe && !isMobileMenuOpen) {
      // Swipe right to open sidebar (only from left edge)
      if (touchStart < 50) { // Only trigger if swipe starts from left edge
        setIsMobileMenuOpen(true);
      }
    }
  };

  // Optimized handlers with useCallback and startTransition for mobile performance
  const toggleMobileMenu = useCallback(() => {
    startTransition(() => {
      setIsMobileMenuOpen(prev => !prev);
    });
  }, []);

  const closeMobileMenu = useCallback(() => {
    // Use startTransition to mark this as non-urgent, preventing UI blocking
    startTransition(() => {
      setIsMobileMenuOpen(false);
      setIsSettingsOpen(false); // Also close settings when closing menu
    });
  }, []);

  const toggleSettings = useCallback(() => {
    startTransition(() => {
      setIsSettingsOpen(prev => !prev);
    });
  }, []);

  const toggleCollapse = useCallback(() => {
    startTransition(() => {
      setIsCollapsed(prev => !prev);
      setIsAutoHidden(false);
    });
  }, []);

  const SidebarContent = () => (
    <>
      {/* Fixed Header */}
      <div className="p-6 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Image
                  src="/chainsnobg.png"
                  alt="ChainsERP"
                  width={40}
                  height={40}
                  className="bg-white rounded-lg "
                />
            </div>
            {(!isCollapsed || isAutoHidden) && (
              <span className="text-white text-lg font-bold whitespace-nowrap">Global Finance</span>
            )}
          </Link>
          
          {/* Notifications Bell Icon */}
          <div className="flex items-center space-x-2">
            <Link
              href="/dashboard/notifications"
              className="relative p-2 text-white/70 hover:text-white hover:bg-blue-900/50 rounded-lg transition-colors"
              title="Notifications"
            >
              <Bell className="h-5 w-5" />
            </Link>
            
            {/* Mobile Close Button */}
            <button
              onClick={closeMobileMenu}
              className="lg:hidden p-2 text-white/70 hover:text-white hover:bg-blue-900/50 rounded-lg transition-colors touch-manipulation active:scale-95"
              aria-label="Close menu"
              style={{ touchAction: 'manipulation' }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Navigation Area - Services Only */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
        {/* Dashboard Navigation */}
        <nav className="p-4 space-y-2">
          {/* Services Navigation */}
          <div className="mb-4">
            {(!isCollapsed || isAutoHidden) && (
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 px-2">
                Services
              </h3>
            )}
            {SERVICE_LINKS.filter(link => {
              // Check if service is enabled (services must be enabled during onboarding)
              const isServiceEnabled = session?.user?.services?.[link.key] || false;
              
              // Hide Payables service if user doesn't have access to payables OR service is not enabled
              if (link.key === 'accountsPayable') {
                return (subscription?.canAccessPayables || false) && isServiceEnabled;
              }
              // Hide Smart Invoicing service if user only has payables access (payables-only plans) OR service is not enabled
              if (link.key === 'smartInvoicing') {
                // Show Smart Invoicing for receivables plans, combined plans, or free plan, AND service must be enabled
                const isPayablesOnly = subscription?.plan?.type === 'payables';
                return !isPayablesOnly && isServiceEnabled;
              }
              return isServiceEnabled;
            }).map(link => {
              const active = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.key}
                  href={link.href}
                  onClick={closeMobileMenu}
                  className={`flex items-center px-3 py-3 rounded-lg transition-colors text-sm font-medium group touch-manipulation ${
                    active
                      ? 'bg-blue-600 text-white'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <link.icon className={`h-5 w-5 ${isCollapsed && !isAutoHidden ? 'mx-auto' : 'mr-3'} flex-shrink-0`} />
                  {(!isCollapsed || isAutoHidden) && (
                    <span className="truncate">{link.label}</span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Admin Navigation - Only for users with approval permissions */}
          {permissions.canApproveBills && session?.user?.organizationId && (
            <div className="mb-4">
              {(!isCollapsed || isAutoHidden) && (
                <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 px-2">
                  Admin
                </h3>
              )}
              {ADMIN_LINKS.map(link => {
                const active = pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.key}
                    href={link.href}
                    onClick={closeMobileMenu}
                    className={`flex items-center px-3 py-3 rounded-lg transition-colors text-sm font-medium group touch-manipulation ${
                      active 
                        ? 'bg-blue-800 text-white' 
                        : 'text-white/80 hover:bg-blue-900/50 hover:text-white'
                    }`}
                    style={{ textDecoration: 'none' }}
                    title={isCollapsed && !isAutoHidden ? link.label : undefined}
                  >
                    <link.icon className="h-4 w-4 mr-3 flex-shrink-0" />
                    {(!isCollapsed || isAutoHidden) && (
                      <span className="whitespace-nowrap">{link.label}</span>
                    )}
                    {isCollapsed && !isAutoHidden && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                        {link.label}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </nav>
      </div>

      {/* Fixed Footer - Settings and Profile (Desktop) */}
      <div className="hidden lg:block flex-shrink-0">
        {/* Settings Section */}
        <div className="border-t border-white/10 p-4 space-y-2">
          {/* Settings Header Button */}
          <button
            onClick={toggleSettings}
            className={`flex items-center justify-between w-full px-3 py-3 rounded-lg transition-colors text-sm font-medium group touch-manipulation active:scale-[0.98] ${
              pathname.startsWith('/dashboard/settings') 
                ? 'bg-blue-800 text-white' 
                : 'text-white/80 hover:bg-blue-900/50 hover:text-white'
            }`}
            title={isCollapsed && !isAutoHidden ? 'Settings' : undefined}
            style={{ touchAction: 'manipulation' }}
          >
            <div className="flex items-center">
              <User className="h-4 w-4 mr-3 flex-shrink-0" />
              {(!isCollapsed || isAutoHidden) && (
                <span className="whitespace-nowrap">Settings</span>
              )}
            </div>
            {(!isCollapsed || isAutoHidden) && (
              <ChevronRight 
                className={`h-4 w-4 transition-transform duration-200 ${
                  isSettingsOpen ? 'rotate-90' : ''
                }`} 
              />
            )}
            {isCollapsed && !isAutoHidden && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                Settings
              </div>
            )}
          </button>

          {/* Settings Dropdown */}
          {isSettingsOpen && (!isCollapsed || isAutoHidden) && (
            <div className="ml-4 space-y-1">
              {SETTINGS_LINKS.map(link => {
                const active = pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.key}
                    href={link.href}
                    onClick={closeMobileMenu}
                    className={`flex items-center px-3 py-3 rounded-lg transition-colors text-sm font-medium group relative touch-manipulation ${
                      active 
                        ? 'bg-blue-800 text-white' 
                        : 'text-white/80 hover:bg-blue-900/50 hover:text-white'
                    }`}
                    style={{ textDecoration: 'none' }}
                    title={isCollapsed && !isAutoHidden ? link.label : undefined}
                  >
                    <link.icon className="h-4 w-4 mr-3 flex-shrink-0" />
                    <span className="whitespace-nowrap">{link.label}</span>
                    {isCollapsed && !isAutoHidden && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                        {link.label}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* User Profile */}
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center space-x-3 mb-3">
            <ProfileAvatar
              src={session?.user?.image}
              alt={session?.user?.name || 'User'}
              size="sm"
              type="user"
            />
            {(!isCollapsed || isAutoHidden) && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {session?.user?.name || 'User'}
                </p>
                <p className="text-xs text-white/50 truncate">
                  {session?.user?.email}
                </p>
              </div>
            )}
          </div>
          <button
            onClick={() => {
              clearOnboarding(); // Clear onboarding store on logout
              signOut({ callbackUrl: '/auth' });
              closeMobileMenu();
            }}
            className="flex items-center w-full px-3 py-3 rounded-lg text-sm font-medium text-white/80 hover:bg-blue-900/50 hover:text-white transition-colors group touch-manipulation"
            title={isCollapsed && !isAutoHidden ? 'Sign Out' : undefined}
          >
            <LogOut className="h-4 w-4 mr-3 flex-shrink-0" />
            {(!isCollapsed || isAutoHidden) && (
              <span className="whitespace-nowrap">Sign Out</span>
            )}
            {isCollapsed && !isAutoHidden && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                Sign Out
              </div>
            )}
          </button>
        </div>

        {/* Collapse Toggle Button (Desktop Only) */}
        <div className="hidden lg:block border-t border-white/10 p-2">
          <button
            onClick={toggleCollapse}
            className="w-full flex items-center justify-center p-2 rounded-lg text-white/80 hover:bg-blue-900/50 hover:text-white transition-colors"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </div>

              {/* Mobile Footer - Settings and Profile */}
      <div className="lg:hidden flex-shrink-0 mt-auto">
        {/* Notifications Section (Mobile Only) */}
        <div className="border-t border-white/10 p-4">
          <Link
            href="/dashboard/notifications"
            onClick={closeMobileMenu}
            className={`flex items-center justify-between w-full px-3 py-3 rounded-lg transition-colors text-sm font-medium group touch-manipulation ${
              pathname.startsWith('/dashboard/notifications') 
                ? 'bg-blue-800 text-white' 
                : 'text-white/80 hover:bg-blue-900/50 hover:text-white'
            }`}
            style={{ textDecoration: 'none' }}
          >
            <div className="flex items-center">
              <Bell className="h-4 w-4 mr-3 flex-shrink-0" />
              <span className="whitespace-nowrap">Notifications</span>
            </div>
          </Link>
        </div>
        
        {/* Settings Section */}
        <div className="border-t border-white/10 p-4 space-y-2">
          {/* Settings Header Button */}
          <button
            onClick={toggleSettings}
            className={`flex items-center justify-between w-full px-3 py-3 rounded-lg transition-colors text-sm font-medium group touch-manipulation active:scale-[0.98] ${
              pathname.startsWith('/dashboard/settings') 
                ? 'bg-blue-800 text-white' 
                : 'text-white/80 hover:bg-blue-900/50 hover:text-white'
            }`}
            style={{ touchAction: 'manipulation' }}
          >
            <div className="flex items-center">
              <User className="h-4 w-4 mr-3 flex-shrink-0" />
              <span className="whitespace-nowrap">Settings</span>
            </div>
            <ChevronRight 
              className={`h-4 w-4 transition-transform duration-200 ${
                isSettingsOpen ? 'rotate-90' : ''
              }`} 
            />
          </button>

          {/* Settings Dropdown */}
          {isSettingsOpen && (
            <div className="ml-4 space-y-1">
              {SETTINGS_LINKS.map(link => {
                const active = pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.key}
                    href={link.href}
                    onClick={closeMobileMenu}
                    className={`flex items-center px-3 py-3 rounded-lg transition-colors text-sm font-medium group relative touch-manipulation ${
                      active 
                        ? 'bg-blue-800 text-white' 
                        : 'text-white/80 hover:bg-blue-900/50 hover:text-white'
                    }`}
                    style={{ textDecoration: 'none' }}
                  >
                    <link.icon className="h-4 w-4 mr-3 flex-shrink-0" />
                    <span className="whitespace-nowrap">{link.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* User Profile */}
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center space-x-3 mb-3">
            <ProfileAvatar
              src={session?.user?.image}
              alt={session?.user?.name || 'User'}
              size="sm"
              type="user"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {session?.user?.name || 'User'}
              </p>
              <p className="text-xs text-white/50 truncate">
                {session?.user?.email}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              signOut({ callbackUrl: '/auth' });
              closeMobileMenu();
            }}
            className="flex items-center w-full px-3 py-3 rounded-lg text-sm font-medium text-white/80 hover:bg-blue-900/50 hover:text-white transition-colors group touch-manipulation"
          >
            <LogOut className="h-4 w-4 mr-3 flex-shrink-0" />
            <span className="whitespace-nowrap">Sign Out</span>
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside 
        ref={sidebarRef}
        className={`hidden lg:flex flex-col bg-blue-950 border-r border-white/10 h-screen transition-all duration-300 ease-in-out flex-shrink-0 ${
          isCollapsed && !isAutoHidden ? 'w-16' : 'w-64'
        } ${
          isAutoHidden ? 'w-16' : ''
        }`}
        style={{ willChange: 'width' }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Menu Button */}
      <button
        onClick={toggleMobileMenu}
        className={`lg:hidden fixed top-4 right-4 z-50 p-3 
          rounded-xl text-white transition-all duration-300 ease-out shadow-xl touch-manipulation active:scale-95
          backdrop-blur-xl bg-gradient-to-br from-white/10 to-blue-900/20
          border border-white/20 hover:from-white/20 hover:to-blue-900/30
          hover:shadow-2xl hover:shadow-blue-500/10
          ${isMobileMenuOpen ? 'hidden' : 'block'}`}
        aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
        style={{ touchAction: 'manipulation' }}
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={closeMobileMenu}
          style={{ touchAction: 'manipulation' }}
        />
      )}

      {/* Mobile Sidebar */}
      <aside 
        className={`lg:hidden fixed  left-0 top-0 h-full w-80 sm:w-80 bg-blue-950 border-r border-white/10 z-50 transform transition-transform duration-300 ease-in-out overflow-hidden flex flex-col ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ willChange: 'transform', touchAction: 'pan-y' }}
      >
        <SidebarContent />
      </aside>
    </>
  );
}

// Memoize the component to prevent unnecessary re-renders
export default memo(Sidebar); 