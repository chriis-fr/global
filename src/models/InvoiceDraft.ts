import { ObjectId } from 'mongodb';
import { CreateInvoiceInput } from './Invoice';
import type { DocumentAST } from './DocumentAST';

export interface ExtractedField {
  key: string; // e.g., "field_1", "field_2"
  value: string;
  confidence: number;
  source: 'regex' | 'table' | 'layout' | 'ocr' | 'manual' | 'pattern' | 'amount';
  position?: {
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  fieldType?: string; // Hint for mapping (e.g., "invoice_number", "total", "date")
  originalLine?: string; // Original line text for context
  tableData?: Record<string, string>; // Structured table data if available
}

export interface InvoiceDraft {
  _id?: ObjectId;
  userId: ObjectId;
  organizationId?: ObjectId;
  sourcePdfId: ObjectId; // Reference to PdfUpload
  sourcePdfUrl: string; // URL to stored PDF
  templateId?: ObjectId; // Reference to PdfTemplate (for Phase 2)
  status: 'extracting' | 'mapping' | 'ready' | 'converted' | 'error';
  
  // Extracted field candidates (raw)
  extractedFields: ExtractedField[];
  
  // Mapped invoice data (editable)
  invoiceData: Partial<CreateInvoiceInput>;
  
  /** Neutral Document AST from parser (for org mapping / configure flow) */
  documentAst?: DocumentAST | null;
  
  // Field mappings (which PDF field maps to which invoice field)
  fieldMappings?: {
    [pdfFieldKey: string]: string; // invoice field name
  };
  
  // Metadata
  extractionMetadata?: {
    extractionMethod: string;
    extractionTime: number;
    aiUsed: boolean;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInvoiceDraftInput {
  userId: ObjectId;
  organizationId?: ObjectId;
  sourcePdfId: ObjectId;
  sourcePdfUrl: string;
  extractedFields: ExtractedField[];
  status: 'extracting' | 'mapping' | 'ready' | 'error';
}
