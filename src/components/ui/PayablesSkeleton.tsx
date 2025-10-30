'use client';

export default function PayablesSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 bg-white/20 rounded-lg w-48 mb-2 animate-pulse"></div>
          <div className="h-4 bg-white/20 rounded w-64 animate-pulse"></div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="h-10 bg-white/20 rounded-lg w-32 animate-pulse"></div>
          <div className="h-10 bg-white/20 rounded-lg w-10 animate-pulse"></div>
        </div>
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="h-4 bg-white/20 rounded w-20 mb-2"></div>
                <div className="h-6 bg-white/20 rounded w-24 mb-1"></div>
                <div className="h-3 bg-white/20 rounded w-32"></div>
              </div>
              <div className="p-3 bg-white/20 rounded-lg">
                <div className="h-5 w-5 bg-white/20 rounded"></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs Skeleton */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
        <div className="flex space-x-1 mb-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-10 bg-white/20 rounded-lg w-32 animate-pulse"></div>
          ))}
        </div>

        {/* Table Header Skeleton */}
        <div className="grid grid-cols-12 gap-4 mb-4 p-4 bg-white/5 rounded-lg">
          <div className="col-span-3 h-4 bg-white/20 rounded animate-pulse"></div>
          <div className="col-span-2 h-4 bg-white/20 rounded animate-pulse"></div>
          <div className="col-span-2 h-4 bg-white/20 rounded animate-pulse"></div>
          <div className="col-span-2 h-4 bg-white/20 rounded animate-pulse"></div>
          <div className="col-span-2 h-4 bg-white/20 rounded animate-pulse"></div>
          <div className="col-span-1 h-4 bg-white/20 rounded animate-pulse"></div>
        </div>

        {/* Table Rows Skeleton */}
        {[...Array(5)].map((_, i) => (
          <div key={i} className="grid grid-cols-12 gap-4 mb-3 p-4 bg-white/5 rounded-lg animate-pulse">
            <div className="col-span-3">
              <div className="h-4 bg-white/20 rounded w-32 mb-1"></div>
              <div className="h-3 bg-white/20 rounded w-24"></div>
            </div>
            <div className="col-span-2">
              <div className="h-4 bg-white/20 rounded w-20"></div>
            </div>
            <div className="col-span-2">
              <div className="h-4 bg-white/20 rounded w-16"></div>
            </div>
            <div className="col-span-2">
              <div className="h-4 bg-white/20 rounded w-20"></div>
            </div>
            <div className="col-span-2">
              <div className="h-6 bg-white/20 rounded w-16"></div>
            </div>
            <div className="col-span-1 flex justify-end">
              <div className="h-8 w-8 bg-white/20 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
