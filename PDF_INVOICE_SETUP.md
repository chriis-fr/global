# PDF-to-Invoice Feature - Setup Guide

## Phase 1 MVP (Node.js only)

PDFs are parsed in-memory with the Node.js parser; no Python service and no file storage.

### Backend
- **Data Models**: `InvoiceDraft`, `PdfTemplate`
- **Server Action**: `uploadAndParsePdf(formData, mappingName?)` — parses PDF from request buffer, creates draft; PDF is never saved
- **Database**: `invoiceDrafts` (no `pdfUploads` collection)

### Frontend
- **Upload**: `/dashboard/services/smart-invoicing/pdf-upload` — uses `uploadAndParsePdf`
- **Mapping**: `/dashboard/services/smart-invoicing/pdf-map/[draftId]`
- **Draft**: `/dashboard/services/smart-invoicing/pdf-drafts/[draftId]`
- **Config**: `/dashboard/services/smart-invoicing/pdf-mapping-config` — configure org mappings

### Flow
1. User selects PDF on upload page and chooses mapping (or default).
2. `uploadAndParsePdf` reads file into buffer, runs Node parser, applies org mapping, creates draft.
3. Redirect to Create Invoice (if mapping applied) or to mapping page.
4. User edits and converts draft to invoice.

### Run
```bash
npm run dev
```
No Python service or `PDF_PARSING_SERVICE_URL` needed.

### File structure (relevant)
- `src/lib/services/pdfParser.ts` — Node PDF parser
- `src/lib/actions/pdf-invoice.ts` — `uploadAndParsePdf`, draft/mapping actions
- `src/models/InvoiceDraft.ts` — draft model (`sourcePdfId` / `sourcePdfUrl` optional)
