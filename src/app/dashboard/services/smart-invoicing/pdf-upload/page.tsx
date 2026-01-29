'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { uploadAndParsePdf, getOrgPdfMappingList } from '@/lib/actions/pdf-invoice';
import { Upload, FileText, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

export default function PdfUploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [mappingNames, setMappingNames] = useState<string[]>([]);
  const [defaultMappingName, setDefaultMappingName] = useState<string | null>(null);
  const [selectedMappingName, setSelectedMappingName] = useState<string>('');

  useEffect(() => {
    getOrgPdfMappingList().then((res) => {
      if (res.success && res.data) {
        setMappingNames(res.data.names);
        setDefaultMappingName(res.data.defaultName);
        setSelectedMappingName(res.data.defaultName ?? res.data.names[0] ?? '');
      }
    });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        setError('Please select a PDF file');
        return;
      }
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    setUploading(true);
    setParsing(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Parse PDF in memory — file is never saved to disk
      const result = await uploadAndParsePdf(formData, selectedMappingName || undefined);

      if (!result.success) {
        setError(result.error || 'Failed to parse PDF');
        return;
      }

      setDraftId(result.data!.draftId);
      const status = result.data!.status ?? 'mapping';
      setSuccess(
        status === 'ready'
          ? 'PDF parsed and mapped. Opening Create Invoice with items pre-filled…'
          : `PDF parsed successfully! Found ${result.data!.extractedFields.length} fields.`
      );

      // Redirect: if mapping was applied (ready), go straight to create page with draft pre-filled; otherwise to mapping page
      setTimeout(() => {
        if (status === 'ready') {
          router.push(`/dashboard/services/smart-invoicing/create?fromPdfDraft=${result.data!.draftId}`);
        } else {
          router.push(`/dashboard/services/smart-invoicing/pdf-map/${result.data!.draftId}`);
        }
      }, status === 'ready' ? 800 : 1500);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setUploading(false);
      setParsing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Upload PDF Invoice</h1>
          <p className="text-blue-200">Upload a PDF invoice to extract and create an invoice automatically</p>
        </div>

        {/* Upload Card */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl p-6 sm:p-8 shadow-lg">
          {/* Mapping selector */}
          {mappingNames.length > 0 && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-white mb-2">
                Use mapping
              </label>
              <select
                value={selectedMappingName}
                onChange={(e) => setSelectedMappingName(e.target.value)}
                className="w-full max-w-xs px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {mappingNames.map((name) => (
                  <option key={name} value={name} className="bg-gray-800 text-white">
                    {name}
                    {name === defaultMappingName ? ' (default)' : ''}
                  </option>
                ))}
              </select>
              <p className="text-blue-200/90 text-xs mt-1">
                Choose which saved mapping to apply to this PDF. Configure in Smart Invoicing → Config.
              </p>
            </div>
          )}

          {/* File Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-white mb-2">
              Select PDF File
            </label>
            <div className="mt-2">
              <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-blue-300 rounded-lg cursor-pointer bg-white/5 hover:bg-white/10 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {file ? (
                    <>
                      <FileText className="w-12 h-12 text-blue-400 mb-4" />
                      <p className="mb-2 text-sm text-white font-semibold">{file.name}</p>
                      <p className="text-xs text-blue-200">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-blue-400 mb-4" />
                      <p className="mb-2 text-sm text-white">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-blue-200">PDF files only (MAX. 10MB)</p>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  disabled={uploading || parsing}
                />
              </label>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-4 p-4 bg-green-500/20 border border-green-500/50 rounded-lg flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
              <p className="text-green-200 text-sm">{success}</p>
            </div>
          )}

          {/* Upload Button */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="px-4 py-2 text-white hover:text-blue-200 transition-colors"
              disabled={uploading || parsing}
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!file || uploading || parsing}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 min-w-[140px] justify-center"
            >
              {uploading || parsing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{parsing ? 'Parsing...' : 'Uploading...'}</span>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  <span>Upload & Parse</span>
                </>
              )}
            </button>
          </div>

          {/* Status Info */}
          {(uploading || parsing) && (
            <div className="mt-4 p-4 bg-blue-500/20 border border-blue-500/50 rounded-lg">
              <div className="flex items-center space-x-2 text-blue-200 text-sm">
                {uploading && (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading PDF file...</span>
                  </>
                )}
                {parsing && (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Extracting fields from PDF...</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-3">How it works:</h3>
          <ol className="list-decimal list-inside space-y-2 text-blue-200 text-sm">
            <li>Upload a PDF invoice file</li>
            <li>Our system will extract text and fields from the PDF</li>
            <li>Map the extracted fields to invoice fields</li>
            <li>Review and edit the invoice draft</li>
            <li>Convert to a final invoice</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
