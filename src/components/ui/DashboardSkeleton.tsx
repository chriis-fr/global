'use client';

interface DashboardSkeletonProps {
  showHeader?: boolean;
  showFinancialOverview?: boolean;
  showQuickActions?: boolean;
  showRecentActivity?: boolean;
}

export default function DashboardSkeleton({
  showHeader = true,
  showFinancialOverview = true,
  showQuickActions = true,
  showRecentActivity = true
}: DashboardSkeletonProps) {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      {showHeader && (
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 bg-white/20 rounded-lg w-48 mb-2 animate-pulse"></div>
            <div className="h-4 bg-white/20 rounded w-64 animate-pulse"></div>
          </div>
          <div className="text-right">
            <div className="h-4 bg-white/20 rounded w-24 mb-1 animate-pulse"></div>
            <div className="h-4 bg-white/20 rounded w-20 animate-pulse"></div>
          </div>
        </div>
      )}

      {/* Financial Overview Skeleton - 3 cards */}
      {showFinancialOverview && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="h-4 bg-white/20 rounded w-24 mb-2"></div>
                  <div className="h-8 bg-white/20 rounded w-32 mb-2"></div>
                  <div className="h-3 bg-white/20 rounded w-40"></div>
                </div>
                <div className="p-3 bg-white/20 rounded-lg">
                  <div className="h-6 w-6 bg-white/20 rounded"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Actions & Alerts Skeleton - 2 cards */}
      {showQuickActions && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Quick Actions Skeleton */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 animate-pulse">
            <div className="h-6 bg-white/20 rounded w-32 mb-4"></div>
            <div className="flex flex-col space-y-3">
              <div className="flex items-center space-x-3 px-4 py-3 bg-white/20 rounded-lg">
                <div className="h-5 w-5 bg-white/20 rounded"></div>
                <div className="h-4 bg-white/20 rounded w-24"></div>
              </div>
              <div className="flex items-center space-x-3 px-4 py-3 bg-white/20 rounded-lg">
                <div className="h-5 w-5 bg-white/20 rounded"></div>
                <div className="h-4 bg-white/20 rounded w-28"></div>
              </div>
            </div>
          </div>

          {/* Status Skeleton */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 animate-pulse">
            <div className="h-6 bg-white/20 rounded w-20 mb-4"></div>
            <div className="space-y-3">
              <div className="flex items-center space-x-3 p-3 bg-white/20 border border-white/20 rounded-lg">
                <div className="h-5 w-5 bg-white/20 rounded"></div>
                <div className="flex-1">
                  <div className="h-4 bg-white/20 rounded w-32 mb-1"></div>
                  <div className="h-3 bg-white/20 rounded w-40"></div>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/20 border border-white/20 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="h-5 w-5 bg-white/20 rounded"></div>
                  <div>
                    <div className="h-4 bg-white/20 rounded w-24 mb-1"></div>
                    <div className="h-3 bg-white/20 rounded w-32"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity Skeleton */}
      {showRecentActivity && (
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 animate-pulse">
          <div className="flex items-center justify-between mb-6">
            <div className="h-6 bg-white/20 rounded w-40"></div>
            <div className="h-4 bg-white/20 rounded w-16"></div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-4 p-3 rounded-lg bg-white/5">
              <div className="p-2 bg-white/20 rounded-lg">
                <div className="h-4 w-4 bg-white/20 rounded"></div>
              </div>
              <div className="flex-1">
                <div className="h-4 bg-white/20 rounded w-48 mb-1"></div>
                <div className="h-3 bg-white/20 rounded w-32"></div>
              </div>
              <div className="h-4 bg-white/20 rounded w-12"></div>
            </div>
            
            <div className="flex items-center space-x-4 p-3 rounded-lg bg-white/5">
              <div className="p-2 bg-white/20 rounded-lg">
                <div className="h-4 w-4 bg-white/20 rounded"></div>
              </div>
              <div className="flex-1">
                <div className="h-4 bg-white/20 rounded w-32 mb-1"></div>
                <div className="h-3 bg-white/20 rounded w-40"></div>
              </div>
              <div className="h-4 bg-white/20 rounded w-16"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
