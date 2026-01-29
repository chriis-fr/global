# PDF-to-Invoice Feature Implementation Plan

**Current implementation (MVP):** PDF parsing is done in Node.js only (`src/lib/services/pdfParser.ts`). The upload flow uses `uploadAndParsePdf` (server action); PDFs are parsed in-memory and never stored. No Python service, no `pdfUploads` collection, no `/api/pdf-invoice/parse` route. See `PDF_INVOICE_SETUP.md` for setup.

---

## Executive Summary

This document outlines a comprehensive, production-ready implementation plan for adding PDF-to-Invoice functionality to the Global Finance invoicing platform. The solution prioritizes **low latency**, **low cost**, **high control**, and **enterprise-grade UX** while maintaining complete separation from existing invoice creation logic.

---

## 1. Architecture Overview

### Core Principle
**Deterministic first, AI second, user override always**

### High-Level Flow
```
PDF Upload
   ↓
PDF Parsing Layer (Python microservice - deterministic)
   ↓
Field Candidates Extraction (structured JSON)
   ↓
Mapping Engine (user + optional AI-assisted)
   ↓
Invoice Draft Objects (editable, not final invoices)
   ↓
Preview / Carousel Editor (human-in-the-loop validation)
   ↓
Convert to Invoice / Bulk Actions
```

---

## 2. Technical Architecture

### 2.1 Component Layers

#### **Layer 1: PDF Parsing Service (Python Microservice)**
- **Technology**: Python 3.11+ with FastAPI
- **Libraries**: 
  - `pdfplumber` - Text + coordinate extraction
  - `pypdf` - Metadata & basic text
  - `tabula-py` or `camelot-py` - Table extraction
  - `pytesseract` - OCR fallback (only if needed)
- **Output**: Structured JSON with field candidates
- **Deployment**: Standalone FastAPI service (can run on same server or separate)

#### **Layer 2: Field Extraction & Classification**
- **Deterministic Rules**: Regex patterns, spatial heuristics, table detection
- **AI Assistance** (Optional): Groq API for low-confidence fields only
- **Output**: Normalized field candidates with confidence scores

#### **Layer 3: Mapping Engine**
- **User-defined mappings**: Save templates per PDF structure
- **Auto-mapping**: System suggestions based on field names/patterns
- **AI-suggested**: Groq API for unknown templates (opt-in)

#### **Layer 4: Draft Management**
- **Draft Status**: Separate from final invoices (`status: "pdf_draft"`)
- **Editable**: All fields can be modified before conversion
- **Bulk Operations**: Process multiple PDFs simultaneously

#### **Layer 5: Preview & Editing UI**
- **Carousel View**: Horizontal stepper for multiple drafts
- **Side-by-side**: PDF preview + editable invoice form
- **Validation**: Real-time field validation
- **Confidence Indicators**: Visual cues for auto-filled fields

---

## 3. Data Models

### 3.1 New MongoDB Collections

#### **Collection: `pdfTemplates`**
```typescript
interface PdfTemplate {
  _id: ObjectId;
  userId: ObjectId; // or organizationId
  organizationId?: ObjectId;
  name: string; // User-friendly template name
  fingerprint: string; // PDF structure fingerprint (hash)
  mappings: {
    [pdfFieldHash: string]: {
      invoiceField: string; // e.g., "invoiceNumber", "total", "clientName"
      confidence: number;
      source: "regex" | "table" | "layout" | "ai" | "user";
    };
  };
  createdAt: Date;
  updatedAt: Date;
}
```

#### **Collection: `invoiceDrafts`**
```typescript
interface InvoiceDraft {
  _id: ObjectId;
  userId: ObjectId;
  organizationId?: ObjectId;
  sourcePdfId: string; // Reference to uploaded PDF
  sourcePdfUrl: string; // URL to stored PDF
  templateId?: ObjectId; // Reference to PdfTemplate if matched
  status: "extracting" | "mapping" | "ready" | "converted" | "error";
  
  // Extracted field candidates (raw)
  extractedFields: Array<{
    key: string; // e.g., "field_1", "field_2"
    value: string;
    confidence: number;
    source: "regex" | "table" | "layout" | "ocr";
    position: {
      page: number;
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;
  
  // Mapped invoice data (editable)
  invoiceData: Partial<CreateInvoiceInput>; // Uses existing Invoice model structure
  
  // Metadata
  extractionMetadata: {
    extractionMethod: string;
    extractionTime: number;
    aiUsed: boolean;
  };
  
  createdAt: Date;
  updatedAt: Date;
}
```

#### **Collection: `pdfUploads`**
```typescript
interface PdfUpload {
  _id: ObjectId;
  userId: ObjectId;
  organizationId?: ObjectId;
  filename: string;
  originalName: string;
  filePath: string; // Path to stored PDF
  fileSize: number;
  contentType: string;
  fingerprint: string; // PDF structure hash
  status: "uploaded" | "processing" | "completed" | "error";
  errorMessage?: string;
  createdAt: Date;
}
```

---

## 4. Implementation Phases

### **Phase 1: MVP - Single PDF Upload & Manual Mapping** (Week 1-2)

#### Backend:
1. **PDF Upload API** (`/api/pdf-invoice/upload`)
   - Accept PDF file via FormData
   - Store in `public/uploads/pdf-invoices/`
   - Create `pdfUploads` record
   - Return upload ID

2. **PDF Parsing API** (`/api/pdf-invoice/parse`)
   - Call Python microservice (or in-process Python script)
   - Receive structured field candidates
   - Store in `invoiceDrafts` collection
   - Return draft ID + extracted fields

3. **Draft Management APIs**
   - `GET /api/pdf-invoice/drafts` - List all drafts
   - `GET /api/pdf-invoice/drafts/[id]` - Get single draft
   - `PUT /api/pdf-invoice/drafts/[id]` - Update draft invoice data
   - `POST /api/pdf-invoice/drafts/[id]/convert` - Convert draft to invoice

#### Frontend:
1. **Upload Page** (`/dashboard/services/smart-invoicing/pdf-upload`)
   - File upload component
   - Progress indicator
   - Error handling

2. **Mapping Page** (`/dashboard/services/smart-invoicing/pdf-map/[draftId]`)
   - Left panel: Extracted fields from PDF
   - Right panel: Invoice form fields
   - Drag-and-drop or dropdown mapping
   - Preview extracted values
   - Save mapping as template (optional)

3. **Draft Editor** (`/dashboard/services/smart-invoicing/pdf-drafts/[draftId]`)
   - Full invoice form (reuse existing component)
   - Pre-filled with mapped data
   - All fields editable
   - Convert to invoice button

#### Python Service (MVP):
- Simple FastAPI endpoint
- Basic pdfplumber extraction
- Return JSON with text blocks + coordinates
- No AI required for MVP

---

### **Phase 2: Template System & Bulk Upload** (Week 3)

#### Backend:
1. **Template Management APIs**
   - `POST /api/pdf-invoice/templates` - Save mapping template
   - `GET /api/pdf-invoice/templates` - List user templates
   - `PUT /api/pdf-invoice/templates/[id]` - Update template
   - `DELETE /api/pdf-invoice/templates/[id]` - Delete template

2. **Bulk Upload API** (`/api/pdf-invoice/bulk-upload`)
   - Accept multiple PDFs
   - Process in parallel (queue-based)
   - Group by template fingerprint
   - Auto-apply templates

#### Frontend:
1. **Template Management UI**
   - List saved templates
   - Edit/delete templates
   - Template preview

2. **Bulk Upload UI**
   - Multi-file upload
   - Progress tracking per file
   - Batch processing status

---

### **Phase 3: Carousel Preview & AI Assistance** (Week 4)

#### Backend:
1. **AI Integration** (Groq API)
   - Optional field classification
   - Low-confidence field suggestions
   - Template matching suggestions

2. **Carousel API**
   - `GET /api/pdf-invoice/drafts/batch/[batchId]` - Get all drafts in batch
   - Bulk convert endpoint

#### Frontend:
1. **Carousel Preview Page** (`/dashboard/services/smart-invoicing/pdf-review`)
   - Horizontal carousel/stepper
   - Each slide = one draft
   - Side-by-side PDF preview + editable form
   - Navigation: Previous/Next
   - Bulk actions: Convert all, Delete selected

2. **AI Suggestions UI**
   - Confidence indicators (⚠️ for low confidence)
   - "Use AI suggestion" buttons
   - AI processing status

---

## 5. File Structure

```
src/
├── app/
│   ├── api/
│   │   └── pdf-invoice/
│   │       ├── upload/
│   │       │   └── route.ts
│   │       ├── parse/
│   │       │   └── route.ts
│   │       ├── drafts/
│   │       │   ├── route.ts
│   │       │   └── [id]/
│   │       │       ├── route.ts
│   │       │       └── convert/
│   │       │           └── route.ts
│   │       ├── templates/
│   │       │   ├── route.ts
│   │       │   └── [id]/
│   │       │       └── route.ts
│   │       └── bulk-upload/
│   │           └── route.ts
│   └── dashboard/
│       └── services/
│           └── smart-invoicing/
│               ├── pdf-upload/
│               │   └── page.tsx
│               ├── pdf-map/
│               │   └── [draftId]/
│               │       └── page.tsx
│               ├── pdf-drafts/
│               │   ├── page.tsx (list)
│   │   │       └── [draftId]/
│   │   │           └── page.tsx (edit)
│   │   └── pdf-review/
│   │       └── page.tsx (carousel)
├── lib/
│   ├── services/
│   │   ├── pdfParsingService.ts (TypeScript wrapper for Python service)
│   │   ├── pdfMappingService.ts
│   │   ├── invoiceDraftService.ts
│   │   └── pdfTemplateService.ts
│   └── utils/
│       └── pdfFingerprint.ts
├── models/
│   ├── PdfTemplate.ts
│   ├── InvoiceDraft.ts
│   └── PdfUpload.ts
└── components/
    └── pdf-invoice/
        ├── PdfUploader.tsx
        ├── FieldMapper.tsx
        ├── DraftEditor.tsx
        ├── CarouselPreview.tsx
        └── TemplateManager.tsx

python-service/ (separate directory)
├── main.py (FastAPI app)
├── parsers/
│   ├── pdf_parser.py
│   ├── field_extractor.py
│   └── table_detector.py
├── requirements.txt
└── README.md
```

---

## 6. API Endpoints Specification

### 6.1 Upload PDF
```
POST /api/pdf-invoice/upload
Content-Type: multipart/form-data

Body:
- file: File (PDF)

Response:
{
  success: boolean;
  data: {
    uploadId: string;
    filename: string;
    fileSize: number;
  };
}
```

### 6.2 Parse PDF
```
POST /api/pdf-invoice/parse
Content-Type: application/json

Body:
{
  uploadId: string;
  useAI?: boolean; // Optional AI assistance
}

Response:
{
  success: boolean;
  data: {
    draftId: string;
    extractedFields: Array<{
      key: string;
      value: string;
      confidence: number;
      source: string;
      position: {...};
    }>;
  };
}
```

### 6.3 Get Draft
```
GET /api/pdf-invoice/drafts/[id]

Response:
{
  success: boolean;
  data: InvoiceDraft;
}
```

### 6.4 Update Draft Mapping
```
PUT /api/pdf-invoice/drafts/[id]/mapping
Content-Type: application/json

Body:
{
  mappings: {
    [pdfFieldKey: string]: string; // invoice field name
  };
  saveAsTemplate?: boolean;
  templateName?: string;
}

Response:
{
  success: boolean;
  data: {
    draftId: string;
    invoiceData: Partial<CreateInvoiceInput>;
    templateId?: string; // If saved as template
  };
}
```

### 6.5 Convert Draft to Invoice
```
POST /api/pdf-invoice/drafts/[id]/convert
Content-Type: application/json

Body:
{
  // Optional overrides for invoice data
  invoiceData?: Partial<CreateInvoiceInput>;
}

Response:
{
  success: boolean;
  data: {
    invoiceId: string;
    invoiceNumber: string;
  };
}
```

---

## 7. Python Microservice Details

### 7.1 FastAPI Service Structure

```python
# main.py
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import pdfplumber
import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Your Next.js app
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/parse")
async def parse_pdf(file: UploadFile = File(...)):
    # Read PDF
    pdf_bytes = await file.read()
    
    # Extract fields using pdfplumber
    extracted_fields = extract_fields_from_pdf(pdf_bytes)
    
    return {
        "success": True,
        "fields": extracted_fields
    }

def extract_fields_from_pdf(pdf_bytes):
    # Implementation using pdfplumber
    # Returns structured JSON with field candidates
    pass
```

### 7.2 Field Extraction Strategy

1. **Text Extraction**: Use pdfplumber to get all text with coordinates
2. **Pattern Matching**: Regex for common fields (invoice number, dates, amounts)
3. **Table Detection**: Identify line items tables
4. **Spatial Analysis**: Use coordinates to identify header/footer regions
5. **OCR Fallback**: Only if PDF is image-based

---

## 8. Integration Points with Existing System

### 8.1 Reuse Existing Components
- ✅ Invoice form component (`CreateInvoicePage`)
- ✅ Invoice model (`Invoice.ts`)
- ✅ Invoice creation API (`/api/invoices`)
- ✅ File upload utilities (similar to logo upload)

### 8.2 New Additions (No Breaking Changes)
- ✅ New routes under `/api/pdf-invoice/*`
- ✅ New pages under `/dashboard/services/smart-invoicing/pdf-*`
- ✅ New collections in MongoDB
- ✅ New services in `lib/services/`

### 8.3 Database Integration
- Uses existing `connectToDatabase()` utility
- New collections: `pdfTemplates`, `invoiceDrafts`, `pdfUploads`
- No modifications to existing `invoices` collection

---

## 9. Performance & Latency Strategy

### 9.1 Backend Optimizations
- **Async Processing**: PDF parsing runs in background
- **Queue System**: Use MongoDB or Redis queue for bulk operations
- **Caching**: Template fingerprints cached per user
- **Streaming**: Progressive field extraction (show fields as they're found)

### 9.2 Frontend Optimizations
- **Optimistic UI**: Show draft immediately after upload
- **Progressive Loading**: Load drafts incrementally
- **Debouncing**: Debounce mapping updates
- **Virtual Scrolling**: For long lists of drafts

### 9.3 Cost Optimization
- **AI Only When Needed**: Use Groq only for low-confidence fields
- **Template Reuse**: Avoid re-parsing similar PDFs
- **Batch Processing**: Process multiple PDFs in single AI call

---

## 10. Security Considerations

1. **File Upload Validation**
   - File type validation (PDF only)
   - File size limits (e.g., 10MB max)
   - Virus scanning (optional)

2. **Access Control**
   - User can only access their own drafts
   - Organization-level access control
   - Template sharing permissions

3. **Data Privacy**
   - PDFs stored securely
   - Auto-delete after conversion (optional)
   - Audit logs for PDF processing

---

## 11. Error Handling & Edge Cases

1. **Invalid PDFs**: Return clear error messages
2. **OCR Failures**: Fallback to manual entry
3. **Unparseable Fields**: Mark as "needs manual input"
4. **Template Mismatch**: Allow user to create new template
5. **Network Failures**: Retry logic for Python service calls

---

## 12. Testing Strategy

1. **Unit Tests**: Field extraction logic
2. **Integration Tests**: API endpoints
3. **E2E Tests**: Full flow from upload to invoice creation
4. **Performance Tests**: Bulk upload scenarios
5. **Edge Case Tests**: Malformed PDFs, large files, etc.

---

## 13. Deployment Considerations

### 13.1 Python Service Deployment Options

**Option A: Same Server (Recommended for MVP)**
- Run FastAPI service on different port (e.g., 8000)
- Next.js calls `http://localhost:8000/parse`
- Simple deployment, low latency

**Option B: Separate Microservice**
- Deploy to separate server/container
- Use environment variable for service URL
- Better scalability, more complex deployment

**Option C: Serverless Function**
- Deploy Python code as serverless function
- Higher latency, but auto-scaling

### 13.2 Environment Variables Needed

```env
# Python Service URL
PDF_PARSING_SERVICE_URL=http://localhost:8000

# Groq API (optional)
GROQ_API_KEY=your_groq_api_key

# File Storage
PDF_UPLOAD_DIR=public/uploads/pdf-invoices
MAX_PDF_SIZE=10485760  # 10MB in bytes
```

---

## 14. What We Need from You

### 14.1 Information Required
1. **Groq API Key**: Do you have one? If not, we can start without AI.
2. **Python Service Preference**: Same server or separate?
3. **File Storage**: Current file storage setup (local filesystem or cloud?)
4. **Bulk Processing Limits**: How many PDFs at once?
5. **Template Sharing**: Should templates be shared across organization?

### 14.2 Decisions Needed
1. **AI Usage**: Always use AI, or only for low-confidence fields?
2. **Draft Retention**: How long to keep drafts after conversion?
3. **PDF Storage**: Keep PDFs after conversion or delete?
4. **Billing**: Should PDF processing count toward invoice limits?

---

## 15. Timeline Estimate

- **Phase 1 (MVP)**: 1-2 weeks
- **Phase 2 (Templates & Bulk)**: 1 week
- **Phase 3 (Carousel & AI)**: 1 week
- **Testing & Polish**: 1 week

**Total: 4-5 weeks** for complete implementation

---

## 16. Success Metrics

1. **Latency**: < 5 seconds for single PDF parsing
2. **Accuracy**: > 90% field extraction accuracy
3. **User Satisfaction**: < 2 minutes from upload to invoice creation
4. **Cost**: < $0.01 per PDF processed (with AI)

---

## 17. Future Enhancements

1. **Multi-language Support**: OCR for different languages
2. **Invoice Templates**: Pre-defined invoice templates
3. **Batch Approval**: Approve multiple drafts at once
4. **Export Options**: Export drafts to CSV/Excel
5. **Integration**: Connect with accounting software

---

## Next Steps

1. **Review this plan** and provide feedback
2. **Answer questions** in Section 14
3. **Approve approach** or suggest modifications
4. **Start Phase 1** implementation

---

## Questions?

Please review this plan and let me know:
- ✅ Does this approach align with your vision?
- ✅ Any concerns or modifications needed?
- ✅ Ready to proceed with Phase 1?

Once approved, I'll begin implementation immediately! 🚀
