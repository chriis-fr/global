'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { ChevronDown, Check, AlertCircle } from 'lucide-react';

interface Logo {
  id: string;
  name: string;
  url: string;
  isDefault: boolean;
  createdAt: Date;
}

interface LogoSelectorProps {
  onLogoSelectAction: (logo: Logo) => void;
  selectedLogoId?: string;
  className?: string;
}

export function LogoSelector({ onLogoSelectAction, selectedLogoId, className = '' }: LogoSelectorProps) {
  const [logos, setLogos] = useState<Logo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLogo, setSelectedLogo] = useState<Logo | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  const fetchLogos = useCallback(async () => {
    try {
      const response = await fetch('/api/user/logos');
      const data = await response.json();
      
      if (data.success) {
        const logos = data.logos || [];
        setLogos(logos);
        
        // If there's only one logo, automatically select it
        if (logos.length === 1) {
          const singleLogo = logos[0];
          setSelectedLogo(singleLogo);
          onLogoSelectAction(singleLogo);
        }
        // Set default logo if no logo is selected and there are multiple logos
        else if (!selectedLogoId && logos.length > 0) {
          const defaultLogo = logos.find((logo: Logo) => logo.isDefault) || logos[0];
          setSelectedLogo(defaultLogo);
          onLogoSelectAction(defaultLogo);
        }
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  }, [selectedLogoId, onLogoSelectAction]);

  useEffect(() => {
    fetchLogos();
  }, [fetchLogos]);

  useEffect(() => {
    if (selectedLogoId && logos.length > 0) {
      const logo = logos.find(l => l.id === selectedLogoId);
      if (logo) {
        setSelectedLogo(logo);
      }
    }
  }, [selectedLogoId, logos]);

  const handleLogoSelect = (logo: Logo) => {
    setSelectedLogo(logo);
    onLogoSelectAction(logo);
    setIsOpen(false);
  };

  const handleImageError = (logoId: string) => {
    setImageErrors(prev => new Set(prev).add(logoId));
  };

  const handleImageLoad = (logoId: string) => {
    setImageErrors(prev => {
      const newSet = new Set(prev);
      newSet.delete(logoId);
      return newSet;
    });
  };

  const renderLogoImage = (logo: Logo, size: number = 32) => {
    if (imageErrors.has(logo.id)) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gray-100">
          <AlertCircle className="h-4 w-4 text-gray-400" />
        </div>
      );
    }

    return (
      <Image
        src={logo.url}
        alt={logo.name}
        width={size}
        height={size}
        className="object-contain w-full h-full"
        onError={() => handleImageError(logo.id)}
        onLoad={() => handleImageLoad(logo.id)}
        unoptimized={logo.url.startsWith('data:')}
        style={{ backgroundColor: 'white' }}
      />
    );
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-sm text-gray-600">Loading logos...</span>
      </div>
    );
  }

  if (logos.length === 0) {
    return (
      <div className={`text-center p-4 ${className}`}>
        <p className="text-sm text-gray-500">No logos available</p>
        <p className="text-xs text-gray-400 mt-1">
          Upload logos in Settings → Logo Management
        </p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 border border-gray-300 rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <div className="flex items-center space-x-3">
          {selectedLogo && (
            <div className="w-8 h-8 bg-white rounded flex items-center justify-center overflow-hidden border border-gray-200">
              {renderLogoImage(selectedLogo, 32)}
            </div>
          )}
          <span className="text-sm font-medium text-gray-900">
            {selectedLogo ? selectedLogo.name : 'Select Logo'}
          </span>
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {logos.map((logo) => (
            <button
              key={logo.id}
              onClick={() => handleLogoSelect(logo)}
              className="w-full flex items-center justify-between p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-white rounded flex items-center justify-center overflow-hidden border border-gray-200">
                  {renderLogoImage(logo, 32)}
                </div>
                <div className="text-left">
                  <span className="text-sm font-medium text-gray-900">{logo.name}</span>
                  {logo.isDefault && (
                    <span className="text-xs text-blue-600 block">Default</span>
                  )}
                </div>
              </div>
              {selectedLogo?.id === logo.id && (
                <Check className="h-4 w-4 text-blue-600" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
} 