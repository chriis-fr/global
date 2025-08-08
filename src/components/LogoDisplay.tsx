'use client';

import { useState } from 'react';
import Image from 'next/image';
import { AlertCircle, Building2 } from 'lucide-react';

interface LogoDisplayProps {
  logoUrl?: string;
  alt?: string;
  size?: number;
  className?: string;
  showFallback?: boolean;
  fallbackIcon?: React.ReactNode;
}

export function LogoDisplay({ 
  logoUrl, 
  alt = 'Logo', 
  size = 64, 
  className = '',
  fallbackIcon
}: LogoDisplayProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleImageError = () => {
    setHasError(true);
    setIsLoading(false);
  };

  const handleImageLoad = () => {
    setHasError(false);
  };

  // If no logo URL is provided, show fallback
  if (!logoUrl) {
    return (
      <div 
        className={`bg-white rounded-lg flex items-center justify-center overflow-hidden border border-gray-200 ${className}`}
        style={{ width: size, height: size }}
      >
        {fallbackIcon || <Building2 className="h-6 w-6 text-gray-400" />}
      </div>
    );
  }

  // If there was an error loading the image, show error state
  if (hasError) {
    return (
      <div 
        className={`bg-white rounded-lg flex items-center justify-center overflow-hidden border border-gray-200 ${className}`}
        style={{ width: size, height: size }}
      >
        <AlertCircle className="h-6 w-6 text-gray-400" />
      </div>
    );
  }

  return (
    <div 
      className={`bg-white rounded-lg flex items-center justify-center overflow-hidden border border-gray-200 ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={logoUrl}
        alt={alt}
        width={size}
        height={size}
        className="object-contain w-full h-full"
        unoptimized={logoUrl.startsWith('data:')}
        onError={handleImageError}
        onLoad={handleImageLoad}
        style={{ backgroundColor: 'white' }}
      />
    </div>
  );
} 