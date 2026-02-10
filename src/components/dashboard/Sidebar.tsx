'use client';
import { useState, useEffect, useRef, useCallback, memo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from '@/lib/auth-client';
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
  Receipt,
  Plus,
  Loader2,
  Plug
} from 'lucide-react';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import Image from 'next/image';
import { useSubscription } from '@/lib/contexts/SubscriptionContext';
import { usePermissions } from '@/lib/contexts/PermissionContext';
import { useOnboardingStore } from '@/lib/stores/onboardingStore';

const SERVICE_LINKS = [
  { key: 'smartInvoicing', label: 'Smart Invoicing', icon: FileText, href: '/dashboard/services/smart-invoicing' },
  { key: 'accountsPayable', label: 'Pay', icon: Receipt, href: '/dashboard/services/payables' },
];

const ADMIN_LINKS = [
  { key: 'approvals', label: 'Pending Approvals', icon: CheckCircle, href: '/dashboard/approvals' },
];

const SETTINGS_LINKS = [
  { key: 'profile', label: 'Profile Settings', icon: User, href: '/dashboard/settings/profile' },
  { key: 'organization', label: 'Organization', icon: Building2, href: '/dashboard/settings/organization' },
  { key: 'logos', label: 'Logo Management', icon: ImageIcon, href: '/dashboard/settings/logos' },
  { key: 'payment-methods', label: 'Payment Methods', icon: CreditCard, href: '/dashboard/settings/payment-methods' },
  { key: 'integrations', label: 'Integrations', icon: Plug, href: '/dashboard/settings/integrations' },
  // { key: 'notifications', label: 'Notifications', icon: Bell, href: '/dashboard/settings/notifications' },
  { key: 'help', label: 'Help & Support', icon: HelpCircle, href: '/dashboard/settings/help' },
];

function Sidebar() {
  const { data: session } = useSession();
  const { subscription } = useSubscription();
  const { permissions } = usePermissions();
  const { clearOnboarding } = useOnboardingStore();
  const pathname = usePathname();
  const router = useRouter();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isAutoHidden, setIsAutoHidden] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarReady, setSidebarReady] = useState(false);

  const sidebarRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setSidebarReady(true);
  }, []);

  useEffect(() => {
    const update = () => setIsMobile(typeof window !== 'undefined' && window.innerWidth < 1024);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsSettingsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (window.innerWidth < 1024) return;

    const resetTimer = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        if (!isCollapsed) setIsAutoHidden(true);
      }, 5000);
    };

    const onMove = () => {
      setIsAutoHidden(false);
      resetTimer();
    };

    document.addEventListener('mousemove', onMove);
    resetTimer();

    return () => {
      document.removeEventListener('mousemove', onMove);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isCollapsed]);

  useEffect(() => {
    const open = () => setIsMobileMenuOpen(true);
    window.addEventListener('openMobileSidebar', open);
    return () => window.removeEventListener('openMobileSidebar', open);
  }, []);

  // Fetch pending approvals count for green-dot indicator (only when user can approve)
  useEffect(() => {
    if (!session?.user?.organizationId || !permissions.canApproveBills) {
      setPendingApprovalsCount(0);
      return;
    }
    let cancelled = false;
    const fetchCount = async () => {
      try {
        const [orgRes, invRes] = await Promise.all([
          fetch('/api/organization/approvals', { credentials: 'include' }),
          fetch('/api/invoices/pending-approvals', { credentials: 'include' })
        ]);
        if (cancelled) return;
        let count = 0;
        const orgData = await orgRes.json();
        if (orgData.success && Array.isArray(orgData.data)) count += orgData.data.length;
        const invData = await invRes.json();
        if (invData.success && invData.data != null && typeof invData.data.count === 'number') count += invData.data.count;
        if (!cancelled) setPendingApprovalsCount(count);
      } catch {
        if (!cancelled) setPendingApprovalsCount(0);
      }
    };
    fetchCount();
    const interval = setInterval(fetchCount, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [session?.user?.organizationId, permissions.canApproveBills]);

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(v => !v);
    setIsSettingsOpen(false);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
    setIsSettingsOpen(false);
  }, []);

  const toggleSettings = useCallback(() => {
    setIsSettingsOpen(v => !v);
  }, []);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed(v => !v);
    setIsAutoHidden(false);
  }, []);

  const handleMobileNavigation = useCallback((href: string) => {
    router.push(href);
  }, [router]);

  const SidebarContent = () => {
    return (
      <>
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            {isMobile ? (
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleMobileNavigation('/dashboard')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleMobileNavigation('/dashboard');
                  }
                }}
                className="flex items-center space-x-3 hover:opacity-80 cursor-pointer"
              >
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                  <Image src="/chainsnobg.png" alt="ChainsERP" width={40} height={40} priority />
                </div>
                {(!isCollapsed || isAutoHidden) && (
                  <span className="text-white text-lg font-bold">Global Finance</span>
                )}
              </div>
            ) : (
              <Link href="/dashboard" className="flex items-center space-x-2 hover:opacity-80">
                <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center">
                  <Image src="/chainsnobg.png" alt="ChainsERP" width={40} height={40} priority />
                </div>
                {(!isCollapsed || isAutoHidden) && (
                  <span className="text-white text-lg font-bold">Global&nbsp;Finance</span>
                )}
              </Link>
            )}

            <div className="flex items-center space-x-2">
              {isMobile ? (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleMobileNavigation('/dashboard/notifications')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleMobileNavigation('/dashboard/notifications');
                    }
                  }}
                  className="p-2 rounded-lg hover:bg-blue-900/50 cursor-pointer"
                >
                  <Bell className="h-5 w-5 text-white/70" />
                </div>
              ) : (!isCollapsed || isAutoHidden) ? (
                <Link href="/dashboard/notifications" className="p-2 rounded-lg hover:bg-blue-900/50">
                  <Bell className="h-5 w-5 text-white/70" />
                </Link>
              ) : null}

              <button
                onClick={closeMobileMenu}
                className="lg:hidden p-2 rounded-lg hover:bg-blue-900/50"
                type="button"
                style={{ touchAction: 'manipulation' }}
              >
                <X className="h-5 w-5 text-white/70" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Nav */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Services */}
          <div>
            {(!isCollapsed || isAutoHidden) && (
              <div className="flex justify-between items-center mb-2 px-2">
                <h3 className="text-xs text-white/50 uppercase">Services</h3>
                {isMobile ? (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleMobileNavigation('/services')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleMobileNavigation('/services');
                      }
                    }}
                    className="p-1 rounded hover:bg-white/10 cursor-pointer"
                  >
                    <Plus className="h-4 w-4 text-white/50" />
                  </div>
                ) : (
                  <Link href="/services">
                    <Plus className="h-4 w-4 text-white/50" />
                  </Link>
                )}
              </div>
            )}

            {(sidebarReady
              ? SERVICE_LINKS.filter(link => {
                  const isServiceEnabled = session?.user?.services?.[link.key] || false;
                  if (link.key === 'accountsPayable') {
                    return (subscription?.canAccessPayables || false) && isServiceEnabled;
                  }
                  if (link.key === 'smartInvoicing') {
                    const isPayablesOnly = subscription?.plan?.type === 'payables';
                    return !isPayablesOnly && isServiceEnabled;
                  }
                  return isServiceEnabled;
                })
              : []
            ).map(link => {
              const active = pathname.startsWith(link.href);

              const collapsed = isCollapsed && !isAutoHidden;

              if (isMobile) {
                return (
                  <div
                    key={link.key}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleMobileNavigation(link.href)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleMobileNavigation(link.href);
                      }
                    }}
                    className={`flex items-center rounded-lg text-sm font-medium cursor-pointer ${
                      collapsed ? 'p-1.5 justify-center' : 'px-3 py-3'
                    } ${
                      active ? 'bg-blue-600 text-white' : 'text-white/70 hover:bg-white/10'
                    }`}
                    style={{ touchAction: 'manipulation' }}
                  >
                    <link.icon className={`${collapsed ? 'h-11 w-11 shrink-0' : 'h-5 w-5 mr-3'}`} />
                    {(!isCollapsed || isAutoHidden) && link.label}
                  </div>
                );
              }

              return (
                <Link
                  key={link.key}
                  href={link.href}
                  className={`flex items-center rounded-lg text-sm font-medium ${
                    collapsed ? 'p-2 justify-center' : 'px-3 py-3'
                  } ${
                    active ? 'bg-blue-600 text-white' : 'text-white/70 hover:bg-white/10'
                  }`}
                >
                  <link.icon className={`${collapsed ? 'h-11 w-11 shrink-0' : 'h-5 w-5 mr-3'}`} />
                  {(!isCollapsed || isAutoHidden) && link.label}
                </Link>
              );
            })}
          </div>

          {/* Admin */}
          {permissions.canApproveBills && session?.user?.organizationId && (
            <div>
              {(!isCollapsed || isAutoHidden) && (
                <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 px-2">
                  Admin
                </h3>
              )}
              {ADMIN_LINKS.map(link => {
                const active = pathname.startsWith(link.href);

                const isApprovalsLink = link.key === 'approvals';
                const hasPending = pendingApprovalsCount > 0;
                const dotEl = isApprovalsLink && hasPending ? (
                  <span
                    className="ml-auto min-w-[10px] min-h-[10px] w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-blue-950 flex-shrink-0"
                    aria-label={`${pendingApprovalsCount} pending`}
                    title={`${pendingApprovalsCount} pending approval${pendingApprovalsCount !== 1 ? 's' : ''}`}
                  />
                ) : null;

                if (isMobile) {
                  return (
                    <div
                      key={link.key}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleMobileNavigation(link.href)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleMobileNavigation(link.href);
                        }
                      }}
                      className={`flex items-center px-3 py-3 rounded-lg text-sm font-medium cursor-pointer ${
                        active ? 'bg-blue-800 text-white' : 'text-white/80 hover:bg-blue-900/50'
                      }`}
                      style={{ touchAction: 'manipulation' }}
                    >
                      <link.icon className="h-4 w-4 mr-3" />
                      {(!isCollapsed || isAutoHidden) && link.label}
                      {isApprovalsLink && hasPending && (!isCollapsed || isAutoHidden) && (
                        <span className="text-xs font-semibold text-green-400 tabular-nums">{pendingApprovalsCount}</span>
                      )}
                      {dotEl}
                    </div>
                  );
                }

                return (
                  <Link
                    key={link.key}
                    href={link.href}
                    className={`flex items-center px-3 py-3 rounded-lg text-sm font-medium ${
                      active ? 'bg-blue-800 text-white' : 'text-white/80 hover:bg-blue-900/50'
                    }`}
                  >
                    <link.icon className="h-4 w-4 mr-3" />
                    {(!isCollapsed || isAutoHidden) && link.label}
                    {isApprovalsLink && hasPending && (!isCollapsed || isAutoHidden) && (
                      <span className="text-xs font-semibold text-green-400 tabular-nums">{pendingApprovalsCount}</span>
                    )}
                    {dotEl}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer (Always at bottom on mobile) */}
        <div className="border-t border-white/10 p-4 space-y-3 flex-shrink-0">
          <button
            onClick={toggleSettings}
            className="flex w-full items-center justify-between px-3 py-3 rounded-lg hover:bg-blue-900/50"
            type="button"
            style={{ touchAction: 'manipulation' }}
          >
            <span className="flex items-center text-sm font-medium text-white/80">
              <User className="h-5 w-5 mr-3" />
              {(!isCollapsed || isAutoHidden) && 'Settings'}
            </span>
            <ChevronRight  className={`h-4 w-4 text-white transition-transform duration-200 ${isSettingsOpen ? 'rotate-90' : ''}`} />
          </button>

          {isSettingsOpen && (
            <div className="ml-4 space-y-1">
              {SETTINGS_LINKS.map(link => {
                const active = pathname.startsWith(link.href);
                const integrationsDisabled = link.key === 'integrations' && process.env.NODE_ENV !== 'development';

                if (isMobile) {
                  if (integrationsDisabled) {
                    return (
                      <div
                        key={link.key}
                        className="flex items-center px-3 py-3 rounded-lg text-sm font-medium text-white/50 cursor-not-allowed"
                      >
                        <link.icon className="h-5 w-5 mr-3" />
                        {link.label}
                      </div>
                    );
                  }
                  return (
                    <div
                      key={link.key}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleMobileNavigation(link.href)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleMobileNavigation(link.href);
                        }
                      }}
                      className={`flex items-center px-3 py-3 rounded-lg text-sm font-medium cursor-pointer ${
                        active ? 'bg-blue-800 text-white' : 'text-white/80 hover:bg-blue-900/50'
                      }`}
                      style={{ touchAction: 'manipulation' }}
                    >
                      <link.icon className="h-5 w-5 mr-3" />
                      {link.label}
                    </div>
                  );
                }

                if (integrationsDisabled) {
                  return (
                    <span
                      key={link.key}
                      className="flex items-center px-3 py-3 rounded-lg text-sm font-medium text-white/50 cursor-not-allowed"
                    >
                      <link.icon className="h-5 w-5 mr-3" />
                      {link.label}
                    </span>
                  );
                }

                return (
                  <Link
                    key={link.key}
                    href={link.href}
                    className={`flex items-center px-3 py-3 rounded-lg text-sm font-medium ${
                      active ? 'bg-blue-800 text-white' : 'text-white/80 hover:bg-blue-900/50'
                    }`}
                  >
                    <link.icon className="h-5 w-5 mr-3" />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          )}

          <div className="flex items-center space-x-3 mb-3">
            <ProfileAvatar
              src={session?.user?.image}
              alt={session?.user?.name || 'User'}
              size="sm"
              type="user"
              highPriority
              style={{ touchAction: 'manipulation' }}
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
            onClick={async () => {
              if (isSigningOut) return;
              setIsSigningOut(true);
              try {
                clearOnboarding();
                await signOut({ callbackUrl: '/auth' });
              } catch (error) {
                console.error('Error signing out:', error);
                setIsSigningOut(false);
              }
            }}
            disabled={isSigningOut}
            className="flex w-full items-center px-3 py-3 rounded-lg hover:bg-blue-900/50 text-white/80 disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
          >
            {isSigningOut ? (
              <Loader2 className="h-4 w-4 mr-3 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4 mr-3" />
            )}
            {(!isCollapsed || isAutoHidden) && (isSigningOut ? 'Signing Out...' : 'Sign Out')}
          </button>
        </div>
      </>
    );
  };

  return (
    <>
      {/* Desktop */}
      <aside
        ref={sidebarRef}
        className={`hidden lg:flex flex-col h-screen bg-blue-950 border-r border-white/10 transition-all ${
          isCollapsed && !isAutoHidden ? 'w-16' : 'w-64'
        }`}
        style={{ willChange: 'width' }}
      >
        <SidebarContent />

        <div className="hidden lg:block border-t border-white/10 p-2">
          <button
            onClick={toggleCollapse}
            className="w-full flex items-center justify-center p-2 rounded-lg text-white/80 hover:bg-blue-900/50 hover:text-white transition-colors"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            type="button"
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* Mobile button */}
      <button
  onClick={(e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleMobileMenu();
  }}
  type="button"
  className={`lg:hidden top-4 right-4 z-50
    fixed
    p-3
    rounded-2xl
    backdrop-blur-xl
    bg-white/10
    border border-white/20
    shadow-[0_8px_30px_rgba(0,0,0,0.25)]
    transition-all duration-200 ease-out
    active:scale-95
    hover:bg-white/15
    ${
      isMobileMenuOpen ? 'hidden' : 'block'
    }`}
  style={{
    touchAction: 'manipulation',
    WebkitBackdropFilter: 'blur(16px)',
    backdropFilter: 'blur(16px)',
  }}
>
  {/* Subtle glass light reflection */}
  <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/25 via-white/10 to-transparent pointer-events-none" />

  {/* Ultra-fine noise for real glass feel */}
  <span
    className="absolute inset-0 rounded-2xl opacity-[0.04] pointer-events-none"
    style={{
      backgroundImage:
        'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'3\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
    }}
  />

  {/* Icon */}
  <Menu className="relative h-5 w-5 text-white" />
</button>


      {/* Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            closeMobileMenu();
          }}
          style={{ touchAction: 'manipulation', pointerEvents: 'auto' }}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-80 bg-blue-950 z-50 flex flex-col justify-between transform transition-transform lg:hidden ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          willChange: 'transform',
          touchAction: 'manipulation',
          pointerEvents: isMobileMenuOpen ? 'auto' : 'none',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          transform: isMobileMenuOpen
            ? 'translateX(0) translateZ(0)'
            : 'translateX(-100%) translateZ(0)',
          WebkitTransform: isMobileMenuOpen
            ? 'translateX(0) translateZ(0)'
            : 'translateX(-100%) translateZ(0)',
        }}
      >
        <SidebarContent />
      </aside>
    </>
  );
}

export default memo(Sidebar);
