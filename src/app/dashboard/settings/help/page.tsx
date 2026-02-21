'use client';

import { Mail, Calendar, Linkedin, Copy, Check, ExternalLink } from 'lucide-react';
import { useState } from 'react';

const SUPPORT_EMAIL = 'info@chains-erp.com';
const LINKEDIN_URL = 'https://linkedin.com/company/chainserp';
const CALENDLY_URL = 'https://calendly.com/caspianodhis/30min';

export default function HelpSupportPage() {
  const [copied, setCopied] = useState(false);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.location.href = `mailto:${SUPPORT_EMAIL}`;
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Help & Support</h1>
        <p className="text-blue-200/90 text-sm md:text-base">
          Live support — email us, book a call, or connect on LinkedIn.
        </p>
      </div>

      <div className="space-y-4">
        {/* Email */}
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="flex items-center justify-between gap-4 p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 hover:bg-white/15 hover:border-white/20 transition-colors group"
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400 group-hover:bg-blue-500/30 transition-colors">
              <Mail className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-white">Email</p>
              <p className="text-sm text-blue-200 truncate">{SUPPORT_EMAIL}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              copyEmail();
            }}
            className="shrink-0 p-2 rounded-lg text-blue-300 hover:bg-white/10 hover:text-white transition-colors"
            title="Copy email"
          >
            {copied ? <Check className="h-5 w-5 text-green-400" /> : <Copy className="h-5 w-5" />}
          </button>
        </a>

        {/* Book a support call */}
        <a
          href={CALENDLY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-4 p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 hover:bg-white/15 hover:border-white/20 transition-colors group"
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400 group-hover:bg-blue-500/30 transition-colors">
              <Calendar className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-white">Book a support call</p>
              <p className="text-sm text-blue-200">Schedule a time that works for you</p>
            </div>
          </div>
          <ExternalLink className="h-5 w-5 shrink-0 text-blue-300 group-hover:text-white transition-colors" />
        </a>

        {/* LinkedIn */}
        <a
          href={LINKEDIN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-4 p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 hover:bg-white/15 hover:border-white/20 transition-colors group"
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400 group-hover:bg-blue-500/30 transition-colors">
              <Linkedin className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-white">LinkedIn</p>
              <p className="text-sm text-blue-200 truncate">linkedin.com/company/chainserp</p>
            </div>
          </div>
          <ExternalLink className="h-5 w-5 shrink-0 text-blue-300 group-hover:text-white transition-colors" />
        </a>
      </div>

      <p className="mt-6 text-xs text-blue-300/70">
        We typically respond within 5 hours. For urgent issues, book a support call.
      </p>
    </div>
  );
}
