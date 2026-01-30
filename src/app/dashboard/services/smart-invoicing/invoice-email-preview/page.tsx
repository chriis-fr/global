'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail } from 'lucide-react';

// Sample data used in the email (same shape as real send)
const SAMPLE = {
  clientName: 'John Doe',
  recipientName: 'John Doe',
  companyName: 'Acme Corp',
  invoiceNumber: 'INV-2024-001',
  invoiceAmount: 1250.0,
  currency: 'USD',
  dueDate: 'Feb 15, 2025',
  paymentMethods: ['Bank Transfer', 'Card'],
  invoiceUrl: 'https://app.example.com/invoice/INV-2024-001',
};

// Refined B2B copy – clear, tight, skimmable
const DEFAULT_COPY = {
  subjectLine: `New Invoice #${SAMPLE.invoiceNumber} from ${SAMPLE.companyName}`,
  headerTitle: 'Invoice',
  headerSubtitle: `Invoice from ${SAMPLE.companyName}`,
  lineAccount: 'This invoice has been added to your account.',
  linePdf: 'A PDF copy is attached for your records.',
  noteContact: `For questions regarding this invoice, please contact ${SAMPLE.companyName}.`,
  footerAuto: 'This is an automated message from Chains ERP-Global',
  footerNoReply: 'Please do not reply to this email',
  intendedFor: '', // unused – kept for legacy form field, not shown in refined email
};

export default function InvoiceEmailPreviewPage() {
  const [copy, setCopy] = useState(DEFAULT_COPY);
  const [showEditor, setShowEditor] = useState(true);

  const update = (key: keyof typeof copy, value: string) => {
    setCopy((prev) => ({ ...prev, [key]: value }));
  };

  const subjectLine = copy.subjectLine
    .replace(/\$\{invoiceNumber\}/g, SAMPLE.invoiceNumber)
    .replace(/\$\{companyName\}/g, SAMPLE.companyName);
  const headerSubtitle = copy.headerSubtitle.replace(/\$\{companyName\}/g, SAMPLE.companyName);
  const noteContact = copy.noteContact.replace(/\$\{companyName\}/g, SAMPLE.companyName);

  const emailHtml = useMemo(
    () => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; display: flex; align-items: center; gap: 16px; text-align: left;">
          <img src="https://chains-erp.com/chainsnobg.png" alt="Chains ERP-Global Logo" style="max-width: 80px; height: auto; border-radius: 8px; flex-shrink: 0;">
          <div>
            <h1 style="margin: 0; font-size: 28px;">${copy.headerTitle}</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">${headerSubtitle}</p>
          </div>
        </div>

        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 0 0 20px 0; border-left: 4px solid #667eea;">
            <p style="color: #333; margin: 0 0 6px 0; font-size: 15px;"><strong>Invoice #:</strong> ${SAMPLE.invoiceNumber}</p>
            <p style="color: #333; margin: 0 0 6px 0; font-size: 15px;"><strong>Amount Due:</strong> ${SAMPLE.currency} ${SAMPLE.invoiceAmount.toFixed(2)}</p>
            <p style="color: #333; margin: 0 0 6px 0; font-size: 15px;"><strong>Due Date:</strong> ${SAMPLE.dueDate}</p>
            <p style="color: #333; margin: 0; font-size: 15px;"><strong>Payment Methods:</strong> ${SAMPLE.paymentMethods.join(', ')}</p>
          </div>

          <p style="color: #555; font-size: 15px; margin: 0 0 10px 0; line-height: 1.5;">${copy.lineAccount}</p>
          <p style="color: #555; font-size: 15px; margin: 0 0 20px 0; line-height: 1.5;">${copy.linePdf}</p>

          <p style="color: #555; font-size: 14px; margin: 0; line-height: 1.5;">${noteContact}</p>
        </div>

        <div style="text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #dee2e6; color: #6c757d; font-size: 12px;">
          <p style="margin: 0 0 4px 0;">${copy.footerAuto}</p>
          <p style="margin: 0;">${copy.footerNoReply}</p>
        </div>
      </div>
    `,
    [
      copy.headerTitle,
      headerSubtitle,
      copy.lineAccount,
      copy.linePdf,
      noteContact,
      copy.footerAuto,
      copy.footerNoReply,
    ]
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/services/smart-invoicing"
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Smart Invoicing
            </Link>
            <span className="flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
              <Mail className="h-3.5 w-3.5" />
              Email preview – edit copy below, then delete this page when done
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowEditor((e) => !e)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            {showEditor ? 'Hide editor' : 'Show editor'}
          </button>
        </div>
      </div>

      <div className={`mx-auto px-4 py-6 ${showEditor ? 'max-w-7xl' : 'max-w-none'}`}>
        <div className={`grid gap-6 ${showEditor ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
          {/* Editor panel */}
          {showEditor && (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-800">
                  <Mail className="h-5 w-5 text-slate-500" />
                  Edit email copy
                </h2>
                <p className="mb-4 text-sm text-slate-500">
                  Refined B2B copy – skimmable, no platform over-explanation. Use <strong>{'{companyName}'}</strong> for the sender name in the preview.
                </p>

                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-500">Subject line</span>
                    <input
                      type="text"
                      value={copy.subjectLine}
                      onChange={(e) => update('subjectLine', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-500">Header title</span>
                    <input
                      type="text"
                      value={copy.headerTitle}
                      onChange={(e) => update('headerTitle', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-500">Header subtitle</span>
                    <input
                      type="text"
                      value={copy.headerSubtitle}
                      onChange={(e) => update('headerSubtitle', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-500">Line: added to account</span>
                    <input
                      type="text"
                      value={copy.lineAccount}
                      onChange={(e) => update('lineAccount', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-500">Line: PDF</span>
                    <input
                      type="text"
                      value={copy.linePdf}
                      onChange={(e) => update('linePdf', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-500">“Intended for” line (optional – remove if too wordy)</span>
                    <textarea
                      rows={2}
                      value={copy.intendedFor}
                      onChange={(e) => update('intendedFor', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-500">Contact line</span>
                    <input
                      type="text"
                      value={copy.noteContact}
                      onChange={(e) => update('noteContact', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="For questions regarding this invoice, please contact {companyName}."
                    />
                  </label>
                  <div className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-500">Footer</span>
                    <input
                      type="text"
                      value={copy.footerAuto}
                      onChange={(e) => update('footerAuto', e.target.value)}
                      placeholder="Automated message"
                      className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      value={copy.footerNoReply}
                      onChange={(e) => update('footerNoReply', e.target.value)}
                      placeholder="Do not reply"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Email preview frame */}
          <div className={showEditor ? 'lg:sticky lg:top-24' : 'min-h-[calc(100vh-5rem)] w-full'}>
            <div className={`rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden ${!showEditor ? 'h-full min-h-[calc(100vh-5rem)] flex flex-col' : ''}`}>
              <div className="border-b border-slate-200 bg-slate-100 px-4 py-3 flex-shrink-0">
                <p className="text-xs font-medium text-slate-500">How it looks in the inbox</p>
                <p className="mt-1 truncate text-sm font-medium text-slate-800">Subject: {subjectLine}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  From: {SAMPLE.companyName} via Chains ERP-Global
                </p>
              </div>
              <div className={`overflow-auto bg-slate-100 p-4 ${showEditor ? 'max-h-[calc(100vh-12rem)]' : 'flex-1 min-h-[calc(100vh-10rem)] flex items-start justify-center'}`}>
                <div
                  className="mx-auto max-w-[600px] rounded-lg border border-slate-200 bg-white shadow-md"
                  dangerouslySetInnerHTML={{ __html: emailHtml }}
                />
              </div>
            </div>
          </div>
        </div>

        {showEditor && (
          <p className="mt-6 text-center text-xs text-slate-400">
            This page is for editing the invoice email message. When you&apos;re happy with the wording, update{' '}
            <code className="rounded bg-slate-200 px-1 py-0.5">src/lib/services/emailService.ts</code>{' '}
            (sendInvoiceNotification) to match, then you can delete this page.
          </p>
        )}
      </div>
    </div>
  );
}
