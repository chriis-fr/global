'use client'

import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function DashboardLoading() {
  return (
    <LoadingSpinner 
      fullScreen={true} 
      message="Loading dashboard..." 
    />
  );
}
