import { ObjectId } from 'mongodb';

export interface PdfTemplate {
  _id?: ObjectId;
  userId: ObjectId;
  organizationId?: ObjectId;
  name: string; // User-friendly template name
  fingerprint?: string; // PDF structure fingerprint (hash) - for Phase 2
  mappings: {
    [pdfFieldHash: string]: {
      invoiceField: string; // e.g., "invoiceNumber", "total", "clientName"
      confidence: number;
      source: 'regex' | 'table' | 'layout' | 'ai' | 'user';
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePdfTemplateInput {
  userId: ObjectId;
  organizationId?: ObjectId;
  name: string;
  mappings: {
    [pdfFieldHash: string]: {
      invoiceField: string;
      confidence: number;
      source: 'regex' | 'table' | 'layout' | 'ai' | 'user';
    };
  };
}
