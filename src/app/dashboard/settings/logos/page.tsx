'use client';

import { useState } from 'react';
import { LogoManager } from '@/components/LogoManager';
import { Image, Settings } from 'lucide-react';
import { LogoDisplay } from '@/components/LogoDisplay';

export default function LogoSettingsPage() {
  const [selectedLogo, setSelectedLogo] = useState<{ id: string; name: string; url: string; isDefault: boolean } | null>(null);

  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-2">
          <Image className="h-8 w-8 text-blue-400" />
          <h1 className="text-2xl md:text-3xl font-bold text-white">Logo Management</h1>
        </div>
        <p className="text-blue-200">
          Upload and manage your logos for use in invoices and other business documents. 
          You can have multiple logos for different occasions and set one as your default.
        </p>
      </div>

      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-white mb-2">Your Logos</h2>
          <p className="text-blue-200 text-sm">
            Click on a logo to select it, or use the actions to manage your logos.
          </p>
        </div>

        <LogoManager 
          onLogoSelectAction={setSelectedLogo}
          selectedLogoId={selectedLogo?.id}
        />

        {selectedLogo && (
          <div className="mt-6 p-4 bg-blue-600/10 border border-blue-500/30 rounded-lg">
            <h3 className="text-blue-300 font-medium mb-2">Selected Logo:</h3>
                                      <div className="flex items-center space-x-3">
              <LogoDisplay
                logoUrl={selectedLogo.url}
                alt={selectedLogo.name || 'Selected logo'}
                size={48}
              />
              <div>
                <p className="text-white font-medium">{selectedLogo.name}</p>
                <p className="text-blue-200 text-sm">
                  {selectedLogo.isDefault ? 'Default Logo' : 'Custom Logo'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Help Section */}
      <div className="mt-8 bg-white/10 backdrop-blur-sm rounded-xl p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Settings className="h-6 w-6 text-blue-400" />
          <h2 className="text-xl font-semibold text-white">How to Use Logos</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-blue-300 font-medium mb-2">For Invoices</h3>
            <ul className="text-blue-200 text-sm space-y-1">
              <li>• Upload your company logos</li>
              <li>• Set one as your default logo</li>
              <li>• Choose different logos for different clients</li>
              <li>• Logos appear in the top-right of invoices</li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-blue-300 font-medium mb-2">Best Practices</h3>
            <ul className="text-blue-200 text-sm space-y-1">
              <li>• Use high-quality PNG or JPG files</li>
              <li>• Keep file sizes under 5MB</li>
              <li>• Use transparent backgrounds when possible</li>
              <li>• Name your logos clearly for easy identification</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
} 