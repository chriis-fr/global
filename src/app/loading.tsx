'use client'

import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function Loading() {
  return (
    <LoadingSpinner 
      fullScreen={true} 
      message="Loading page..." 
    />
  );
}
