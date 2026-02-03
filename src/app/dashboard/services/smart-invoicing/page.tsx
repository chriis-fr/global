'use client';

import { Suspense, useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { motion } from 'framer-motion';
import { 
  Plus, 
  FileText, 
  List,
  Building2,
  Lock,
  Users,
  ArrowRight,
  RotateCcw,
  Upload,
  Settings,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { useSubscription } from '@/lib/contexts/SubscriptionContext';
import { getOrganizationData } from '@/lib/actions/organization';
import InvoiceStatCard from '@/components/smart-invoicing/InvoiceStatCard';
import RecentInvoicesList from '@/components/smart-invoicing/RecentInvoicesList';
import OnboardingStatus from '@/components/smart-invoicing/OnboardingStatus';

export default function SmartInvoicingPage() {
  const statsScrollRef = useRef<HTMLDivElement>(null);
  const actionsScrollRef = useRef<HTMLDivElement>(null);
  const [showStatsScrollIndicator, setShowStatsScrollIndicator] = useState(false);
  const [showActionsScrollIndicator, setShowActionsScrollIndicator] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [orgUserRole, setOrgUserRole] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const checkScrollable = (ref: React.RefObject<HTMLDivElement | null>, setShow: (v: boolean) => void) => {
    if (!ref.current) return;
    const container = ref.current;
    const hasHorizontalScroll = container.scrollWidth > container.clientWidth + 2;
    const isAtEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - 10;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    setShow(isMobile && hasHorizontalScroll && !isAtEnd);
  };

  useEffect(() => {
    const onScrollOrResize = () => {
      checkScrollable(statsScrollRef, setShowStatsScrollIndicator);
      checkScrollable(actionsScrollRef, setShowActionsScrollIndicator);
    };
    const s = statsScrollRef.current;
    const a = actionsScrollRef.current;
    s?.addEventListener('scroll', onScrollOrResize);
    a?.addEventListener('scroll', onScrollOrResize);
    window.addEventListener('resize', onScrollOrResize);
    onScrollOrResize();
    const t1 = setTimeout(onScrollOrResize, 100);
    const t2 = setTimeout(onScrollOrResize, 400);
    const ro = typeof ResizeObserver !== 'undefined' && s && a
      ? new ResizeObserver(onScrollOrResize)
      : null;
    if (ro && s) ro.observe(s);
    if (ro && a) ro.observe(a);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      ro?.disconnect();
      s?.removeEventListener('scroll', onScrollOrResize);
      a?.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, []);
  const router = useRouter();
  const { data: session } = useSession();
  const { subscription } = useSubscription();

  // Fetch org role so only admins/owners see Team Settings (members cannot manage permissions)
  useEffect(() => {
    if (session?.user?.userType === 'business' && session?.user?.organizationId) {
      getOrganizationData().then((result) => {
        if (result.success && result.data?.userRole) {
          setOrgUserRole(result.data.userRole as string);
        }
      }).catch(() => setOrgUserRole(null));
    } else {
      setOrgUserRole(null);
    }
  }, [session?.user?.userType, session?.user?.organizationId]);

  const canSeeTeamSettings = !!(
    session?.user?.userType === 'business' &&
    session?.user?.organizationId &&
    (orgUserRole === 'owner' || orgUserRole === 'admin')
  );

  // Use subscription only after mount to avoid hydration mismatch (server has no subscription/cache)
  const canCreateInvoice = mounted && !!subscription?.canCreateInvoice;

  const handleCreateInvoice = () => {
    // Check if user can create invoice (limit reached)
    if (!canCreateInvoice) {
      // Don't navigate if limit is reached
      return;
    }
    
    router.push('/dashboard/services/smart-invoicing/create');
  };

  const handleManageInvoiceInfo = () => {
    router.push('/dashboard/services/smart-invoicing/onboarding');
  };

  const handleViewInvoices = () => {
    router.push('/dashboard/services/smart-invoicing/invoices');
  };

  const handleManageClients = () => {
    router.push('/dashboard/clients');
  };

  const handleUploadPdf = () => {
    router.push('/dashboard/services/smart-invoicing/pdf-upload');
  };

  const handleConfigurePdfMapping = () => {
    router.push('/dashboard/services/smart-invoicing/pdf-mapping-config');
  };

  const handleRefresh = () => {
    // Clear all caches to force refresh
    localStorage.removeItem('invoice_stat_total');
    localStorage.removeItem('invoice_stat_revenue');
    localStorage.removeItem('invoice_stat_pending');
    localStorage.removeItem('invoice_stat_paid');
    localStorage.removeItem('smart_invoicing_recent_invoices');
    localStorage.removeItem('smart_invoicing_onboarding_status');
    
    // Reload the page to trigger fresh data
    window.location.reload();
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      {/* Header - Always Visible, No Data Dependency */}
      <div className="bg-white/10 backdrop-blur-sm border-b rounded-lg border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
              <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-blue-400 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl font-semibold text-white truncate">Smart Invoicing</h1>
                <p className="text-xs sm:text-sm text-blue-200 hidden sm:block">
                 Create and manage invoices seamlessly
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
              <button
                onClick={handleRefresh}
                className="flex items-center justify-center w-8 h-8 text-blue-300 hover:text-blue-200 hover:bg-white/10 rounded-lg transition-colors"
                title="Refresh data"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
              {/* <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleUploadPdf}
                className="flex items-center space-x-1 sm:space-x-2 bg-indigo-600 text-white px-2 sm:px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm"
              >
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Upload PDF</span>
                <span className="sm:hidden">PDF</span>
              </motion.button> */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleViewInvoices}
                className="flex items-center space-x-1 sm:space-x-2 bg-white/10 backdrop-blur-sm text-white px-2 sm:px-4 py-2 rounded-lg hover:bg-white/20 transition-colors border border-white/20 text-sm"
              >
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">View Invoices</span>
                <span className="sm:hidden">View</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: canCreateInvoice ? 1.05 : 1 }}
                whileTap={{ scale: canCreateInvoice ? 0.95 : 1 }}
                onClick={handleCreateInvoice}
                disabled={!canCreateInvoice}
                className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 rounded-lg transition-colors text-sm ${
                  canCreateInvoice
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-500 text-gray-300 cursor-not-allowed'
                }`}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {!canCreateInvoice ? 'Limit Reached' : 'Create Invoice'}
                </span>
                <span className="sm:hidden">
                  {!canCreateInvoice ? 'Limit' : 'Create'}
                </span>
                {!canCreateInvoice && (
                  <Lock className="h-4 w-4" />
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {/* Onboarding Status - Independent Loading with Suspense */}
      <Suspense fallback={null}>
        <OnboardingStatus />
      </Suspense>

      {/* Stats Cards - Horizontal scroll on mobile (same as dashboard) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 relative">
        <div
          ref={statsScrollRef}
          className="flex md:grid gap-4 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 hide-scrollbar md:grid-cols-2 lg:grid-cols-4 snap-x snap-mandatory md:snap-none"
        >
          <div className="flex-shrink-0 w-[calc(50%-8px)] min-w-[140px] md:w-auto md:min-w-0 h-[112px] md:h-auto md:min-h-0 snap-start overflow-hidden rounded-xl">
            <Suspense fallback={
              <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 animate-pulse h-full flex flex-col justify-center">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="h-4 w-24 bg-white/20 rounded mb-2"></div>
                    <div className="h-7 w-16 bg-white/20 rounded"></div>
                  </div>
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex-shrink-0"></div>
                </div>
              </div>
            }>
              <InvoiceStatCard type="total" />
            </Suspense>
          </div>

          <div className="flex-shrink-0 w-[calc(50%-8px)] min-w-[140px] md:w-auto md:min-w-0 h-[112px] md:h-auto md:min-h-0 snap-start overflow-hidden rounded-xl">
            <Suspense fallback={
              <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 animate-pulse h-full flex flex-col justify-center">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="h-4 w-24 bg-white/20 rounded mb-2"></div>
                    <div className="h-7 w-16 bg-white/20 rounded"></div>
                  </div>
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex-shrink-0"></div>
                </div>
              </div>
            }>
              <InvoiceStatCard type="revenue" />
            </Suspense>
          </div>

          <div className="flex-shrink-0 w-[calc(50%-8px)] min-w-[140px] md:w-auto md:min-w-0 h-[112px] md:h-auto md:min-h-0 snap-start overflow-hidden rounded-xl">
            <Suspense fallback={
              <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 animate-pulse h-full flex flex-col justify-center">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="h-4 w-24 bg-white/20 rounded mb-2"></div>
                    <div className="h-7 w-16 bg-white/20 rounded"></div>
                  </div>
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex-shrink-0"></div>
                </div>
              </div>
            }>
              <InvoiceStatCard type="pending" />
            </Suspense>
          </div>

          <div className="flex-shrink-0 w-[calc(50%-8px)] min-w-[140px] md:w-auto md:min-w-0 h-[112px] md:h-auto md:min-h-0 snap-start overflow-hidden rounded-xl">
            <Suspense fallback={
              <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 animate-pulse h-full flex flex-col justify-center">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="h-4 w-24 bg-white/20 rounded mb-2"></div>
                    <div className="h-7 w-16 bg-white/20 rounded"></div>
                  </div>
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex-shrink-0"></div>
                </div>
              </div>
            }>
              <InvoiceStatCard type="paid" />
            </Suspense>
          </div>
        </div>

        {showStatsScrollIndicator && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2 md:hidden pointer-events-none flex items-center justify-end pr-2 z-20">
            <div className="bg-gradient-to-l from-blue-950 via-blue-950/90 to-transparent w-7 h-14 flex items-center justify-end rounded-l-lg">
              <ChevronRight className="h-5 w-5 text-blue-400/80 animate-pulse" />
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions - Collapsible, hidden by default */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => setQuickActionsOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-3 py-3 px-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/15 transition-colors text-left"
        >
          <span className="text-white font-medium">Quick actions</span>
          <ChevronDown
            className={`h-5 w-5 text-blue-400 flex-shrink-0 transition-transform duration-200 ${quickActionsOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {quickActionsOpen && (
          <div className="relative mt-4">
            <div
              ref={actionsScrollRef}
              className="flex md:grid gap-4 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 hide-scrollbar md:grid-cols-2 lg:grid-cols-4 snap-x snap-mandatory md:snap-none"
            >
              <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={`flex-shrink-0 w-[calc(50%-8px)] min-w-[160px] md:w-auto md:min-w-0 h-[116px] md:h-auto md:min-h-0 snap-start overflow-hidden bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-3 md:p-4 hover:bg-white/15 transition-all duration-200 cursor-pointer flex flex-col justify-between ${
              !canCreateInvoice ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            onClick={canCreateInvoice ? handleCreateInvoice : undefined}
          >
            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1 min-h-0">
              <div className={`w-9 h-9 md:w-10 md:h-10 flex-shrink-0 flex items-center justify-center rounded-lg ${
                canCreateInvoice ? 'bg-blue-500/20' : 'bg-gray-500/20'
              }`}>
                {canCreateInvoice ? (
                  <Plus className="h-5 w-5 text-blue-400" />
                ) : (
                  <Lock className="h-5 w-5 text-gray-400" />
                )}
              </div>
              <div className="flex-1 min-w-0 overflow-hidden">
                <h3 className="text-base font-semibold text-white line-clamp-2 break-words leading-tight">
                  {canCreateInvoice ? 'Create Invoice' : 'Limit Reached'}
                </h3>
                <p className="text-blue-200/90 text-xs line-clamp-2 break-words leading-snug mt-0.5">
                  {canCreateInvoice ? 'Guided walkthrough' : 'Upgrade for more'}
                </p>
              </div>
              {canCreateInvoice && (
                <ArrowRight className="h-4 w-4 text-blue-400 shrink-0 hidden md:block" />
              )}
            </div>
            <div className="h-9 flex-shrink-0" aria-hidden />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex-shrink-0 w-[calc(50%-8px)] min-w-[160px] md:w-auto md:min-w-0 h-[116px] md:h-auto md:min-h-0 snap-start overflow-hidden bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-3 md:p-4 hover:bg-white/15 transition-all duration-200 cursor-pointer flex flex-col justify-between"
            onClick={handleManageInvoiceInfo}
          >
            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1 min-h-0">
              <div className="w-9 h-9 md:w-10 md:h-10 flex-shrink-0 flex items-center justify-center rounded-lg bg-orange-500/20">
                <Building2 className="h-5 w-5 text-orange-400" />
              </div>
              <div className="flex-1 min-w-0 overflow-hidden">
                <h3 className="text-base font-semibold text-white line-clamp-2 break-words leading-tight">Invoice Info</h3>
                <p className="text-blue-200/90 text-xs line-clamp-2 break-words leading-snug mt-0.5">Business details and settings</p>
              </div>
              <ArrowRight className="h-4 w-4 text-blue-400 shrink-0 hidden md:block" />
            </div>
            <div className="h-9 flex-shrink-0" aria-hidden />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex-shrink-0 w-[calc(50%-8px)] min-w-[160px] md:w-auto md:min-w-0 h-[116px] md:h-auto md:min-h-0 snap-start overflow-hidden bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-3 md:p-4 hover:bg-white/15 transition-all duration-200 cursor-pointer flex flex-col justify-between"
            onClick={handleManageClients}
          >
            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1 min-h-0">
              <div className="w-9 h-9 md:w-10 md:h-10 flex-shrink-0 flex items-center justify-center rounded-lg bg-green-500/20">
                <Users className="h-5 w-5 text-green-400" />
              </div>
              <div className="flex-1 min-w-0 overflow-hidden">
                <h3 className="text-base font-semibold text-white line-clamp-2 break-words leading-tight">Clients</h3>
                <p className="text-blue-200/90 text-xs line-clamp-2 break-words leading-snug mt-0.5">Add and organize clients</p>
              </div>
              <ArrowRight className="h-4 w-4 text-blue-400 shrink-0 hidden md:block" />
            </div>
            <div className="h-9 flex-shrink-0" aria-hidden />
          </motion.div>

          {/* PDF Invoicing: one card with two actions inside */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
            className="flex-shrink-0 w-[calc(50%-8px)] min-w-[160px] md:w-auto md:min-w-0 h-[116px] md:h-auto md:min-h-0 snap-start overflow-hidden bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-3 md:p-4 hover:bg-white/15 transition-all duration-200 flex flex-col justify-between"
          >
            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1 min-h-0">
              <div className="w-9 h-9 md:w-10 md:h-10 flex-shrink-0 flex items-center justify-center rounded-lg bg-indigo-500/20">
                <Upload className="h-5 w-5 text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0 overflow-hidden">
                <h3 className="text-base font-semibold text-white line-clamp-2 break-words leading-tight">From PDF</h3>
                <p className="text-blue-200/90 text-xs line-clamp-2 break-words leading-snug mt-0.5">Upload PDF or set mapping</p>
              </div>
            </div>
            <div className="h-9 flex-shrink-0 flex gap-1.5 md:gap-2 min-w-0">
              <button
                type="button"
                onClick={handleUploadPdf}
                className="flex-1 min-w-0 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-medium transition-colors"
              >
                <Upload className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Upload</span>
              </button>
              <button
                type="button"
                onClick={handleConfigurePdfMapping}
                className="flex-1 min-w-0 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-white/10 hover:bg-white/20 text-blue-200 text-xs font-medium border border-white/20 transition-colors"
              >
                <Settings className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Config</span>
              </button>
            </div>
          </motion.div>

          {/* Team Settings - only for admins/owners; members cannot manage permissions */}
          {canSeeTeamSettings && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="flex-shrink-0 w-[calc(50%-8px)] min-w-[160px] md:w-auto md:min-w-0 h-[116px] md:h-auto md:min-h-0 snap-start overflow-hidden bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-3 md:p-4 hover:bg-white/15 transition-all duration-200 cursor-pointer flex flex-col justify-between"
              onClick={() => router.push('/dashboard/settings/organization')}
            >
              <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1 min-h-0">
                <div className="w-9 h-9 md:w-10 md:h-10 flex-shrink-0 flex items-center justify-center rounded-lg bg-purple-500/20">
                  <Users className="h-5 w-5 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0 overflow-hidden">
                  <h3 className="text-base font-semibold text-white line-clamp-2 break-words leading-tight">Team Settings</h3>
                  <p className="text-blue-200/90 text-xs line-clamp-2 break-words leading-snug mt-0.5">Permissions and team</p>
                </div>
                <ArrowRight className="h-4 w-4 text-blue-400 shrink-0 hidden md:block" />
              </div>
              <div className="h-9 flex-shrink-0" aria-hidden />
            </motion.div>
          )}
            </div>

            {showActionsScrollIndicator && (
              <div className="absolute right-0 top-1/2 -translate-y-1/2 md:hidden pointer-events-none flex items-center justify-end pr-2 z-10">
                <div className="bg-gradient-to-l from-blue-950 via-blue-950/90 to-transparent w-7 h-14 flex items-center justify-end rounded-l-lg">
                  <ChevronRight className="h-5 w-5 text-blue-400/80 animate-pulse" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recent Activity - Independent Loading with Suspense */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Suspense fallback={
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
            <div className="h-6 w-32 bg-white/20 rounded mb-4 animate-pulse"></div>
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-white/10 rounded-lg animate-pulse"></div>
              ))}
            </div>
          </div>
        }>
          <RecentInvoicesList />
        </Suspense>
      </div>
    </div>
  );
}
