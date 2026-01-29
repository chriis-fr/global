import { ObjectId } from 'mongodb';

export interface PdfUpload {
  _id?: ObjectId;
  userId: ObjectId;
  organizationId?: ObjectId;
  filename: string;
  originalName: string;
  filePath: string; // Path to stored PDF
  fileSize: number;
  contentType: string;
  fingerprint?: string; // PDF structure hash (optional for MVP)
  status: 'uploaded' | 'processing' | 'completed' | 'error';
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePdfUploadInput {
  userId: ObjectId;
  organizationId?: ObjectId;
  filename: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  contentType: string;
}
