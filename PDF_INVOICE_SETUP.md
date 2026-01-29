# PDF-to-Invoice Feature - Setup Guide

## Phase 1 MVP Implementation Complete! 🎉

This document explains how to set up and test the PDF-to-Invoice feature.

## What's Been Implemented

### ✅ Backend
1. **Data Models**: `PdfUpload`, `InvoiceDraft`, `PdfTemplate`
2. **Server Actions**: Upload, parse, get draft, update mappings, convert to invoice
3. **API Route**: `/api/pdf-invoice/parse` (calls Python service)
4. **Database Collections**: `pdfUploads`, `invoiceDrafts`

### ✅ Frontend
1. **Upload Page**: `/dashboard/services/smart-invoicing/pdf-upload`
2. **Mapping Page**: `/dashboard/services/smart-invoicing/pdf-map/[draftId]`
3. **Draft Editor**: `/dashboard/services/smart-invoicing/pdf-drafts/[draftId]`
4. **Dashboard Link**: Added "Upload PDF Invoice" button to smart invoicing page

### ✅ Python Service
1. **FastAPI Service**: `python-service/main.py`
2. **PDF Parsing**: Uses `pdfplumber` to extract text and fields

## Setup Instructions

### 1. Install Python Dependencies

```bash
cd python-service
pip install -r requirements.txt
```

### 2. Start Python Service

```bash
# Option 1: Using Python directly
python main.py

# Option 2: Using uvicorn
uvicorn main:app --reload --port 8000
```

The service will run on `http://localhost:8000`

### 3. Configure Environment Variables

Add to your `.env.local` file:

```env
# Python Service URL (default: http://localhost:8000)
PDF_PARSING_SERVICE_URL=http://localhost:8000
```

### 4. Start Next.js App

```bash
npm run dev
```

## Testing the Feature

### Step 1: Upload PDF
1. Navigate to `/dashboard/services/smart-invoicing`
2. Click "Upload PDF Invoice" button
3. Select a PDF file (max 10MB)
4. Click "Upload & Parse"

### Step 2: Map Fields
1. After upload, you'll be redirected to the mapping page
2. For each extracted field, select which invoice field it should map to
3. Click "Save Mappings & Continue"

### Step 3: Edit Draft
1. Review the invoice data
2. Edit any fields as needed
3. Click "Convert to Invoice"

### Step 4: View Invoice
1. You'll be redirected to the invoice detail page
2. The invoice is now created and ready to send!

## File Structure

```
src/
├── models/
│   ├── PdfUpload.ts
│   ├── InvoiceDraft.ts
│   └── PdfTemplate.ts
├── lib/
│   └── actions/
│       └── pdf-invoice.ts (server actions)
├── app/
│   ├── api/
│   │   └── pdf-invoice/
│   │       └── parse/
│   │           └── route.ts
│   └── dashboard/
│       └── services/
│           └── smart-invoicing/
│               ├── pdf-upload/
│               │   └── page.tsx
│               ├── pdf-map/
│               │   └── [draftId]/
│               │       └── page.tsx
│               └── pdf-drafts/
│                   └── [draftId]/
│                       └── page.tsx

python-service/
├── main.py
├── requirements.txt
└── README.md
```

## Current Limitations (MVP)

1. **Basic Field Extraction**: Only extracts text lines and tables
2. **Manual Mapping**: User must manually map each field
3. **Simple Invoice Data**: Only basic invoice fields are mapped
4. **No AI**: No AI assistance for field classification (Phase 3)
5. **No Templates**: Template system not implemented (Phase 2)
6. **No Bulk Upload**: Single PDF only (Phase 2)

## Next Steps (Future Phases)

- **Phase 2**: Template system, bulk uploads
- **Phase 3**: AI assistance, carousel preview
- **Enhancements**: Better field extraction, OCR support, multi-language

## Troubleshooting

### Python Service Not Starting
- Check if port 8000 is available
- Verify Python 3.11+ is installed
- Check if all dependencies are installed

### PDF Not Parsing
- Verify Python service is running
- Check PDF file is valid (not corrupted)
- Check server logs for errors

### Fields Not Extracting
- PDF might be image-based (needs OCR - not implemented yet)
- PDF might have complex layout
- Try a simpler PDF first

## Support

If you encounter any issues:
1. Check browser console for errors
2. Check server logs
3. Check Python service logs
4. Verify environment variables are set correctly

---

**Ready to test!** Start the Python service and Next.js app, then try uploading a PDF invoice! 🚀
