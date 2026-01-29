'use client';

import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Svg,
  Path,
} from '@react-pdf/renderer';
import { getCurrencyByCode } from '@/data/currencies';
import { countries } from '@/data/countries';

// Data shape compatible with create page formData (subset used for PDF)
export interface InvoicePdfData {
  invoiceName: string;
  issueDate: string;
  dueDate: string;
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  companyTaxNumber?: string;
  companyLogo?: string;
  clientName: string;
  clientCompany?: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  currency: string;
  paymentMethod: string;
  paymentNetwork?: string;
  paymentAddress?: string;
  bankName?: string;
  accountNumber?: string;
  routingNumber?: string;
  swiftCode?: string;
  accountName?: string;
  branchAddress?: string;
  fiatPaymentSubtype?: string;
  paymentPhoneNumber?: string;
  paybillNumber?: string;
  mpesaAccountNumber?: string;
  tillNumber?: string;
  businessName?: string;
  items: Array<{
    id?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    tax: number;
    amount: number;
  }>;
  subtotal: number;
  totalTax: number;
  total: number;
  withholdingTaxEnabled?: boolean;
  withholdingTaxAmount?: number;
  withholdingTaxRatePercent?: number;
  memo?: string;
}

// Register Helvetica (built-in) - no external font needed for reliability
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    padding: 40,
    color: '#111827',
  },
  header: {
    flexDirection: 'row',          // horizontal layout
    justifyContent: 'space-between', // space between left/middle/right
    alignItems: 'flex-start',       // align everything to the top
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 24,
    marginBottom: 24,
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: '#111827',
  },
  
headerMiddle: {
  // Remove flex so it doesn't push the logo
  marginRight: 8, // small spacing to logo
},
  dateRow: {
    marginBottom: 4,
    color: '#6B7280',
    fontSize: 10,
  },
  invoiceNumberRow: {
    marginTop: 2,
    color: '#6B7280',
    fontSize: 10,
  },
  logoWrap: {
    width: 80,
    height: 80,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
  },
  logo: {
    width: 80,
    height: 80,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: '#111827',
    marginBottom: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  sectionTitleInRow: {
    fontSize: 12,
    fontWeight: 600,
    color: '#111827',
    marginBottom: 0,
  },
  iconWrap: {
    width: 16,
    height: 16,
  },
  block: {
    marginBottom: 8,
    color: '#6B7280',
    fontSize: 10,
    lineHeight: 1.4,
  },
  blockBold: {
    fontWeight: 700,
    color: '#111827',
    marginBottom: 4,
  },
  twoCol: {
    flexDirection: 'row',
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 24,
  },
  col: {
    flex: 1,
    paddingRight: 24,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 8,
    marginBottom: 8,
    backgroundColor: '#F9FAFB',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#F3F4F6',
    paddingVertical: 8,
  },
  colDesc: { flex: 2, paddingRight: 8 },
  colNum: { width: 50, textAlign: 'right', paddingRight: 8 },
  colPrice: { width: 70, textAlign: 'right', paddingRight: 8 },
  colDiscount: { width: 55, textAlign: 'right', paddingRight: 8 },
  colTax: { width: 45, textAlign: 'right', paddingRight: 8 },
  colAmount: { width: 70, textAlign: 'right' },
  totalsWrap: {
    marginTop: 24,
    alignItems: 'flex-end',
  },
  totalsBox: {
    width: 220,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    color: '#6B7280',
    fontSize: 10,
  },
  totalRowFinal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    fontSize: 12,
    fontWeight: 700,
    color: '#111827',
  },
  paymentSection: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  paymentTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: '#111827',
    marginBottom: 8,
  },
  paymentText: {
    fontSize: 10,
    color: '#6B7280',
    marginBottom: 4,
  },
  memoSection: {
    marginTop: 24,
    paddingTop: 24,
  },
  memoText: {
    fontSize: 10,
    color: '#374151',
    lineHeight: 1.5,
  },
  footer: {
    marginTop: 32,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    textAlign: 'center',
    fontSize: 9,
    color: '#9CA3AF',
  },
  watermark: {
    position: 'absolute',
    top: 320,
    left: 120,
    right: 120,
    textAlign: 'center',
    opacity: 0.12,
  },
  watermarkMain: {
    fontSize: 24,
    color: '#6B7280',
    marginBottom: 8,
  },
  watermarkInvoice: {
    fontSize: 14,
    color: '#6B7280',
  },
});

function formatDate(dateString: string): string {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return dateString;
  }
}

function getCountryName(code: string): string {
  if (!code) return '';
  const c = countries.find((x) => x.code === code);
  return c?.name ?? code;
}

export interface InvoicePdfDocumentProps {
  data: InvoicePdfData;
  invoiceNumber?: string;
}

export function InvoicePdfDocument({ data, invoiceNumber }: InvoicePdfDocumentProps) {
  const symbol = getCurrencyByCode(data.currency)?.symbol ?? data.currency;
  const hasDiscounts = data.items.some((i) => (i.discount ?? 0) > 0);
  const hasTaxes = data.items.some((i) => (i.tax ?? 0) > 0);
  const withholdingAmount =
    data.withholdingTaxAmount ??
    (data.withholdingTaxEnabled
      ? (data.subtotal + data.totalTax) * ((data.withholdingTaxRatePercent ?? 5) / 100)
      : 0);
  const showWithholding =
    data.withholdingTaxEnabled || (data.withholdingTaxAmount != null && data.withholdingTaxAmount > 0);

  const companyAddr = [
    data.companyAddress?.street,
    [data.companyAddress?.city, data.companyAddress?.state, data.companyAddress?.zipCode].filter(Boolean).join(', '),
    getCountryName(data.companyAddress?.country ?? ''),
  ].filter(Boolean);

  const clientAddr = [
    data.clientAddress?.street,
    [data.clientAddress?.city, data.clientAddress?.state, data.clientAddress?.zipCode].filter(Boolean).join(' '),
    data.clientAddress?.country ? getCountryName(data.clientAddress.country) : '',
  ].filter(Boolean);

  const paymentMethodLabel =
    data.paymentMethod === 'crypto'
      ? 'Cryptocurrency'
      : data.fiatPaymentSubtype === 'phone'
        ? 'Phone Number'
        : data.fiatPaymentSubtype === 'mpesa_paybill'
          ? 'M-Pesa Paybill'
          : data.fiatPaymentSubtype === 'mpesa_till'
            ? 'M-Pesa Till'
            : 'Bank Transfer';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Watermark (fixed, behind content) */}
        <View fixed style={styles.watermark}>
          <Text style={styles.watermarkMain}>DIGITAL INVOICE</Text>
          {invoiceNumber && (
            <Text style={styles.watermarkInvoice}>Invoice: {invoiceNumber}</Text>
          )}
        </View>

        {/* Header */}
       <View style={styles.header}>
  {/* LEFT — Title */}
  <View style={styles.headerLeft}>
    <Text style={styles.title}>{data.invoiceName || 'Invoice'}</Text>
  </View>

  {/* MIDDLE — Dates */}
  <View style={styles.headerMiddle}>
    <Text style={styles.dateRow}>
      Issued on {formatDate(data.issueDate)}
    </Text>
    <Text style={styles.dateRow}>
      Payment due by {formatDate(data.dueDate)}
    </Text>
    {invoiceNumber && (
      <Text style={styles.invoiceNumberRow}>
        Invoice: {invoiceNumber}
      </Text>
    )}
  </View>

  {/* RIGHT — Logo */}
  {data.companyLogo && (
    <View style={styles.logoWrap}>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image src={data.companyLogo} style={styles.logo} />
    </View>
  )}
</View>


        {/* From / To */}
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <View style={styles.sectionTitleRow}>
              <Svg width={16} height={16} viewBox="0 0 24 24" style={styles.iconWrap}>
                <Path d="M12 2L2 7v10c0 5.55 3.84 9.74 9 11 5.16-1.26 9-5.45 9-11V7l-10-5z" fill="#6B7280" />
              </Svg>
              <Text style={styles.sectionTitleInRow}>From</Text>
            </View>
            <Text style={styles.blockBold}>{data.companyName || '—'}</Text>
            <Text style={styles.block}>{companyAddr.join('\n')}</Text>
            {data.companyTaxNumber ? (
              <Text style={styles.block}>Tax ID: {data.companyTaxNumber}</Text>
            ) : null}
            <Text style={styles.block}>{data.companyEmail}</Text>
            <Text style={styles.block}>{data.companyPhone}</Text>
          </View>
          <View style={styles.col}>
            <View style={styles.sectionTitleRow}>
              <Svg width={16} height={16} viewBox="0 0 24 24" style={styles.iconWrap}>
                <Path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="#6B7280" />
              </Svg>
              <Text style={styles.sectionTitleInRow}>To</Text>
            </View>
            <Text style={styles.blockBold}>
              {data.clientCompany || data.clientName || '—'}
            </Text>
            {data.clientCompany ? (
              <Text style={styles.block}>Contact: {data.clientName}</Text>
            ) : null}
            <Text style={styles.block}>{clientAddr.join('\n')}</Text>
            <Text style={styles.block}>{data.clientEmail}</Text>
            <Text style={styles.block}>{data.clientPhone}</Text>
          </View>
        </View>

        {/* Items table */}
        <View style={styles.sectionTitle}>
          <Text>Invoice Items</Text>
        </View>
        <View style={styles.tableHeader}>
          <Text style={styles.colDesc}>Description</Text>
          <Text style={styles.colNum}>Qty</Text>
          <Text style={styles.colPrice}>Unit Price</Text>
          {hasDiscounts && <Text style={styles.colDiscount}>Discount</Text>}
          {hasTaxes && <Text style={styles.colTax}>Tax</Text>}
          <Text style={styles.colAmount}>Amount</Text>
        </View>
        {data.items.map((item, i) => (
          <View key={item.id ?? i} style={styles.tableRow}>
            <Text style={styles.colDesc}>{item.description || '—'}</Text>
            <Text style={styles.colNum}>{item.quantity}</Text>
            <Text style={styles.colPrice}>
              {symbol}{(item.unitPrice ?? 0).toFixed(2)}
            </Text>
            {hasDiscounts && (
              <Text style={styles.colDiscount}>
                {(item.discount ?? 0) > 0 ? `${symbol}${(item.discount ?? 0).toFixed(2)}` : '—'}
              </Text>
            )}
            {hasTaxes && (
              <Text style={styles.colTax}>
                {(item.tax ?? 0) > 0 ? `${symbol}${(item.tax ?? 0).toFixed(2)}` : '—'}
              </Text>
            )}
            <Text style={styles.colAmount}>
              {symbol}{(item.amount ?? 0).toFixed(2)}
            </Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsWrap}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text>Subtotal:</Text>
              <Text>{symbol}{(data.subtotal ?? 0).toFixed(2)}</Text>
            </View>
            {(data.totalTax ?? 0) > 0 && (
              <View style={styles.totalRow}>
                <Text>Tax:</Text>
                <Text>{symbol}{(data.totalTax ?? 0).toFixed(2)}</Text>
              </View>
            )}
            {showWithholding && (
              <View style={styles.totalRow}>
                <Text>Withholding ({data.withholdingTaxRatePercent ?? 5}%):</Text>
                <Text>-{symbol}{withholdingAmount.toFixed(2)}</Text>
              </View>
            )}
            <View style={styles.totalRowFinal}>
              <Text>Total:</Text>
              <Text>{symbol}{(data.total ?? 0).toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Payment */}
        <View style={styles.paymentSection}>
          <Text style={styles.paymentTitle}>Payment Information</Text>
          <Text style={styles.paymentText}>{paymentMethodLabel}</Text>
          {data.paymentMethod === 'crypto' && data.paymentNetwork && (
            <Text style={styles.paymentText}>Network: {data.paymentNetwork}</Text>
          )}
          {data.paymentMethod === 'crypto' && data.paymentAddress && (
            <Text style={styles.paymentText}>Address: {data.paymentAddress}</Text>
          )}
          {data.paymentMethod !== 'crypto' && data.bankName && (
            <Text style={styles.paymentText}>Bank: {data.bankName}</Text>
          )}
          {data.paymentMethod !== 'crypto' && data.accountNumber && (
            <Text style={styles.paymentText}>Account: {data.accountNumber}</Text>
          )}
          {data.routingNumber && (
            <Text style={styles.paymentText}>Routing: {data.routingNumber}</Text>
          )}
          {data.swiftCode && (
            <Text style={styles.paymentText}>SWIFT: {data.swiftCode}</Text>
          )}
          {data.accountName && (
            <Text style={styles.paymentText}>Account Name: {data.accountName}</Text>
          )}
          {data.fiatPaymentSubtype === 'phone' && data.paymentPhoneNumber && (
            <Text style={styles.paymentText}>Phone: {data.paymentPhoneNumber}</Text>
          )}
          {data.fiatPaymentSubtype === 'mpesa_paybill' && data.paybillNumber && (
            <Text style={styles.paymentText}>Paybill: {data.paybillNumber}</Text>
          )}
          {data.fiatPaymentSubtype === 'mpesa_paybill' && data.mpesaAccountNumber && (
            <Text style={styles.paymentText}>Account: {data.mpesaAccountNumber}</Text>
          )}
          {data.fiatPaymentSubtype === 'mpesa_till' && data.tillNumber && (
            <Text style={styles.paymentText}>Till: {data.tillNumber}</Text>
          )}
          {data.businessName && (
            <Text style={styles.paymentText}>Business: {data.businessName}</Text>
          )}
          <Text style={[styles.paymentText, { marginTop: 8 }]}>
            Currency: {data.currency} ({symbol})
          </Text>
        </View>

        {data.memo ? (
          <View style={styles.memoSection}>
            <Text style={styles.paymentTitle}>Memo</Text>
            <Text style={styles.memoText}>{data.memo}</Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text>Generated by Chains ERP for {data.companyName || 'Company'}</Text>
          <Text style={{ marginTop: 4 }}>
            Invoice: {invoiceNumber || 'N/A'} | Date: {formatDate(data.issueDate)}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export default InvoicePdfDocument;
