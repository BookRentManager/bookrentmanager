import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { format } from 'date-fns';

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1a1a1a',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#2c3e50',
    paddingBottom: 10,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 15,
    backgroundColor: '#ffffff',
    padding: 10,
  },
  logo: {
    width: 100,
    height: 50,
    objectFit: 'contain',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 5,
  },
  documentTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
    color: '#2c3e50',
  },
  invoiceNumber: {
    fontSize: 11,
    textAlign: 'center',
    color: '#666666',
  },
  section: {
    marginBottom: 15,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#2c3e50',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 15,
    gap: 20,
  },
  column: {
    flex: 1,
  },
  label: {
    fontSize: 9,
    color: '#666666',
    marginBottom: 3,
  },
  value: {
    fontSize: 10,
    color: '#1a1a1a',
    marginBottom: 8,
  },
  table: {
    marginTop: 10,
    marginBottom: 15,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 8,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#e5e7eb',
    padding: 8,
  },
  tableColDescription: {
    width: '50%',
    fontSize: 9,
  },
  tableColQuantity: {
    width: '15%',
    fontSize: 9,
    textAlign: 'center',
  },
  tableColPrice: {
    width: '17.5%',
    fontSize: 9,
    textAlign: 'right',
  },
  tableColAmount: {
    width: '17.5%',
    fontSize: 9,
    textAlign: 'right',
  },
  totalsContainer: {
    marginTop: 10,
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '40%',
    marginBottom: 5,
    paddingHorizontal: 10,
  },
  totalLabel: {
    fontSize: 10,
    color: '#666666',
  },
  totalValue: {
    fontSize: 10,
    color: '#1a1a1a',
    fontWeight: 'medium',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '40%',
    marginTop: 5,
    paddingTop: 8,
    paddingHorizontal: 10,
    borderTopWidth: 2,
    borderTopColor: '#2c3e50',
  },
  grandTotalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  grandTotalValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  notes: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  notesHeader: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#2c3e50',
  },
  notesText: {
    fontSize: 9,
    color: '#666666',
    lineHeight: 1.4,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 8,
    color: '#999999',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 10,
  },
  companyInfo: {
    fontSize: 8,
    color: '#666666',
    lineHeight: 1.4,
  },
});

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

interface TaxInvoicePDFProps {
  invoice: {
    invoice_number: string;
    invoice_date: string;
    client_name: string;
    client_email?: string | null;
    billing_address?: string | null;
    line_items: LineItem[];
    subtotal: number;
    vat_rate: number;
    vat_amount: number;
    total_amount: number;
    currency: string;
    notes?: string | null;
    bookings?: {
      reference_code?: string;
      car_model?: string;
    };
    rental_description?: string;
    rental_start_date?: string;
    rental_end_date?: string;
    delivery_location?: string;
    collection_location?: string;
  };
  appSettings?: {
    company_name?: string;
    company_email?: string;
    company_phone?: string;
    company_address?: string;
    logo_url?: string;
  };
}

const formatCurrency = (amount: number, currency: string) => {
  return `${currency} ${amount.toFixed(2)}`;
};

const formatDate = (dateStr: string) => {
  return format(new Date(dateStr), 'dd/MM/yyyy');
};

export const TaxInvoicePDF = ({ invoice, appSettings }: TaxInvoicePDFProps) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          {appSettings?.logo_url ? (
            <Image 
              src={appSettings.logo_url} 
              style={styles.logo}
            />
          ) : (
            <Text style={styles.documentTitle}>Tax Invoice</Text>
          )}
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={styles.documentTitle}>TAX INVOICE</Text>
            <Text style={styles.invoiceNumber}>Invoice #{invoice.invoice_number}</Text>
          </View>
        </View>

        {/* Company and Client Information */}
        <View style={styles.row}>
          <View style={styles.column}>
            <Text style={styles.sectionHeader}>From</Text>
            <Text style={styles.value}>{appSettings?.company_name || 'KingRent'}</Text>
            {appSettings?.company_address && (
              <Text style={styles.companyInfo}>{appSettings.company_address}</Text>
            )}
            {appSettings?.company_email && (
              <Text style={styles.companyInfo}>Email: {appSettings.company_email}</Text>
            )}
            {appSettings?.company_phone && (
              <Text style={styles.companyInfo}>Phone: {appSettings.company_phone}</Text>
            )}
          </View>

          <View style={styles.column}>
            <Text style={styles.sectionHeader}>Bill To</Text>
            <Text style={styles.value}>{invoice.client_name}</Text>
            {invoice.billing_address && (
              <Text style={styles.companyInfo}>{invoice.billing_address}</Text>
            )}
            {invoice.client_email && (
              <Text style={styles.companyInfo}>Email: {invoice.client_email}</Text>
            )}
          </View>

          <View style={styles.column}>
            <Text style={styles.sectionHeader}>Invoice Details</Text>
            <Text style={styles.label}>Invoice Date</Text>
            <Text style={styles.value}>{formatDate(invoice.invoice_date)}</Text>
            {invoice.bookings?.reference_code && (
              <>
                <Text style={styles.label}>Booking Reference</Text>
                <Text style={styles.value}>{invoice.bookings.reference_code}</Text>
              </>
            )}
          </View>
        </View>

        {/* Rental Information (if available) */}
        {(invoice.rental_description || invoice.bookings?.car_model) && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Rental Information</Text>
            {invoice.bookings?.car_model && (
              <>
                <Text style={styles.label}>Vehicle</Text>
                <Text style={styles.value}>{invoice.bookings.car_model}</Text>
              </>
            )}
            {invoice.rental_description && (
              <>
                <Text style={styles.label}>Description</Text>
                <Text style={styles.value}>{invoice.rental_description}</Text>
              </>
            )}
            {(invoice.rental_start_date || invoice.rental_end_date) && (
              <View style={styles.row}>
                {invoice.rental_start_date && (
                  <View style={styles.column}>
                    <Text style={styles.label}>Start Date</Text>
                    <Text style={styles.value}>{formatDate(invoice.rental_start_date)}</Text>
                  </View>
                )}
                {invoice.rental_end_date && (
                  <View style={styles.column}>
                    <Text style={styles.label}>End Date</Text>
                    <Text style={styles.value}>{formatDate(invoice.rental_end_date)}</Text>
                  </View>
                )}
              </View>
            )}
            {(invoice.delivery_location || invoice.collection_location) && (
              <View style={styles.row}>
                {invoice.delivery_location && (
                  <View style={styles.column}>
                    <Text style={styles.label}>Delivery Location</Text>
                    <Text style={styles.value}>{invoice.delivery_location}</Text>
                  </View>
                )}
                {invoice.collection_location && (
                  <View style={styles.column}>
                    <Text style={styles.label}>Collection Location</Text>
                    <Text style={styles.value}>{invoice.collection_location}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Line Items Table */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Items</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableColDescription}>Description</Text>
              <Text style={styles.tableColQuantity}>Quantity</Text>
              <Text style={styles.tableColPrice}>Unit Price</Text>
              <Text style={styles.tableColAmount}>Amount</Text>
            </View>
            {invoice.line_items.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={styles.tableColDescription}>{item.description}</Text>
                <Text style={styles.tableColQuantity}>{item.quantity}</Text>
                <Text style={styles.tableColPrice}>{formatCurrency(item.unit_price, invoice.currency)}</Text>
                <Text style={styles.tableColAmount}>{formatCurrency(item.amount, invoice.currency)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Totals */}
        <View style={styles.totalsContainer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal:</Text>
            <Text style={styles.totalValue}>{formatCurrency(invoice.subtotal, invoice.currency)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>VAT ({invoice.vat_rate}%):</Text>
            <Text style={styles.totalValue}>{formatCurrency(invoice.vat_amount, invoice.currency)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total:</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(invoice.total_amount, invoice.currency)}</Text>
          </View>
        </View>

        {/* Notes */}
        {invoice.notes && (
          <View style={styles.notes}>
            <Text style={styles.notesHeader}>Notes</Text>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Thank you for your business!</Text>
          {appSettings?.company_name && (
            <Text>{appSettings.company_name}</Text>
          )}
        </View>
      </Page>
    </Document>
  );
};
