'use client';
import { useState, useEffect, useRef } from 'react';
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
  ChevronRight
} from 'lucide-react';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import Image from 'next/image';

const SERVICE_LINKS = [
  {
    key: 'smartInvoicing',
    label: 'Smart Invoicing',
    icon: FileText,
    href: '/dashboard/services/smart-invoicing',
  },
  // Add more services as they become ready
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

export default function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  // const enabledServices = session?.user?.services || {}; // Temporarily disabled to show all services
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isAutoHidden, setIsAutoHidden] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

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

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
    setIsAutoHidden(false);
  };

  const SidebarContent = () => (
    <>
      {/* Header */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center space-x-3">
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
            <span className="text-white text-xl font-bold whitespace-nowrap">Global</span>
          )}
        </div>
      </div>

      {/* Services Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        <div className="mb-4">
          {(!isCollapsed || isAutoHidden) && (
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 px-2">
              Services
            </h3>
          )}
          {SERVICE_LINKS.map(link => {
         const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.key}
                href={link.href}
                onClick={closeMobileMenu}
                className={`flex items-center px-3 py-2 rounded-lg transition-colors text-sm font-medium group ${
                  active 
                    ? 'bg-blue-800 text-white' 
                    : 'text-white/70 hover:bg-blue-900/50 hover:text-white'
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
      </nav>

      {/* Settings Section */}
      <div className="border-t border-white/10 p-4 space-y-2">
        {/* Settings Header Button */}
        <button
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className={`flex items-center justify-between w-full px-3 py-2 rounded-lg transition-colors text-sm font-medium group ${
            pathname.startsWith('/dashboard/settings') 
              ? 'bg-blue-800 text-white' 
              : 'text-white/70 hover:bg-blue-900/50 hover:text-white'
          }`}
          title={isCollapsed && !isAutoHidden ? 'Settings' : undefined}
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
                  className={`flex items-center px-3 py-2 rounded-lg transition-colors text-sm font-medium group relative ${
                    active 
                      ? 'bg-blue-800 text-white' 
                      : 'text-white/70 hover:bg-blue-900/50 hover:text-white'
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
            signOut({ callbackUrl: '/auth' });
            closeMobileMenu();
          }}
          className="flex items-center w-full px-3 py-2 rounded-lg text-sm font-medium text-white/70 hover:bg-blue-900/50 hover:text-white transition-colors group"
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
          className="w-full flex items-center justify-center p-2 rounded-lg text-white/70 hover:bg-blue-900/50 hover:text-white transition-colors"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside 
        ref={sidebarRef}
        className={`hidden lg:flex flex-col bg-blue-950 border-r border-white/10 min-h-screen transition-all duration-300 ease-in-out flex-shrink-0 ${
          isCollapsed && !isAutoHidden ? 'w-16' : 'w-64'
        } ${
          isAutoHidden ? 'w-16' : ''
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Menu Button */}
      <button
        onClick={toggleMobileMenu}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-blue-900 rounded-lg text-white hover:bg-blue-800 transition-colors"
      >
        {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={closeMobileMenu}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={`lg:hidden fixed left-0 top-0 h-full w-64 bg-blue-950 border-r border-white/10 z-50 transform transition-transform duration-300 ease-in-out ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <SidebarContent />
      </aside>
    </>
  );
} 