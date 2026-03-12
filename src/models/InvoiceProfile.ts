import { ObjectId } from 'mongodb';

export interface InvoiceProfileAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface InvoiceProfileBusinessInfo {
  name: string;
  email: string;
  phone?: string;
  website?: string;
  taxId?: string;
  address: InvoiceProfileAddress;
  logo?: string;
}

export interface InvoiceProfileSettings {
  defaultCurrency?: string;
  paymentTerms?: number;
  showWithholdingTaxOnInvoices?: boolean;
  withholdingTaxRatePercent?: number;
}

export interface InvoiceProfile {
  _id?: ObjectId;
  /** Human friendly name, e.g. "Main entity" or "Kenya branch" */
  name: string;
  businessInfo: InvoiceProfileBusinessInfo;
  invoiceSettings?: InvoiceProfileSettings;
  /** Owning organization – profiles are only available for organizations */
  organizationId: ObjectId;
  /** Creator (for audit trail) */
  createdBy: ObjectId;
  isDefault?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

