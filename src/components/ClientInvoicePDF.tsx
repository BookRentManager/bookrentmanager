import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { format } from 'date-fns';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  logo: {
    width: 120,
    height: 60,
    objectFit: 'contain',
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  companyName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  invoiceNumber: {
    fontSize: 12,
    color: '#666',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    fontSize: 10,
    color: '#666',
    width: '40%',
  },
  value: {
    fontSize: 10,
    width: '60%',
  },
  table: {
    marginTop: 20,
    marginBottom: 20,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 8,
  },
  tableHeader: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 10,
  },
  tableCol: {
    fontSize: 10,
  },
  tableColHeader: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  descriptionCol: {
    width: '60%',
    paddingRight: 8,
  },
  amountCol: {
    width: '40%',
    textAlign: 'right',
  },
  totalSection: {
    marginTop: 20,
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    width: '50%',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  totalLabel: {
    fontSize: 10,
    color: '#666',
  },
  totalValue: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  grandTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    borderTopWidth: 2,
    borderTopColor: '#000',
    paddingTop: 8,
    marginTop: 8,
  },
  notes: {
    marginTop: 30,
    fontSize: 9,
    color: '#666',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#999',
    textAlign: 'center',
  },
});

interface ClientInvoicePDFProps {
  invoice: {
    invoice_number: string;
    client_name: string;
    billing_address: string | null;
    description: string | null;
    subtotal: number;
    vat_rate: number;
    vat_amount: number;
    total_amount: number;
    issue_date: string;
    notes: string | null;
    payment_status: string;
  };
  booking?: {
    reference_code: string;
    car_model: string;
    car_plate: string;
    delivery_datetime: string;
    collection_datetime: string;
  };
  companySettings?: {
    logo_url: string | null;
    company_name: string;
    company_address: string | null;
    company_email: string | null;
    company_phone: string | null;
  };
}

export const ClientInvoicePDF = ({ invoice, booking, companySettings }: ClientInvoicePDFProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {companySettings?.logo_url && (
            <Image src={companySettings.logo_url} style={styles.logo} />
          )}
          <Text style={styles.companyName}>{companySettings?.company_name || 'KingRent'}</Text>
          {companySettings?.company_address && (
            <Text style={styles.invoiceNumber}>{companySettings.company_address}</Text>
          )}
          {companySettings?.company_email && (
            <Text style={styles.invoiceNumber}>{companySettings.company_email}</Text>
          )}
          {companySettings?.company_phone && (
            <Text style={styles.invoiceNumber}>{companySettings.company_phone}</Text>
          )}
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.title}>PROFORMA INVOICE</Text>
          <Text style={styles.invoiceNumber}>Proforma No: {invoice.invoice_number}</Text>
          <Text style={styles.invoiceNumber}>Date: {format(new Date(invoice.issue_date), 'dd/MM/yyyy')}</Text>
          <Text style={styles.invoiceNumber}>Status: {invoice.payment_status === 'to_pay' ? 'To Be Paid' : invoice.payment_status === 'paid' ? 'Paid' : invoice.payment_status}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bill To</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Client Name:</Text>
          <Text style={styles.value}>{invoice.client_name}</Text>
        </View>
        {invoice.billing_address && (
          <View style={styles.row}>
            <Text style={styles.label}>Billing Address:</Text>
            <Text style={styles.value}>{invoice.billing_address}</Text>
          </View>
        )}
      </View>

      {booking && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Booking Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Booking Reference:</Text>
            <Text style={styles.value}>{booking.reference_code}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Vehicle:</Text>
            <Text style={styles.value}>{booking.car_model} ({booking.car_plate})</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Rental Period:</Text>
            <Text style={styles.value}>
              {format(new Date(booking.delivery_datetime), 'dd/MM/yyyy')} - {format(new Date(booking.collection_datetime), 'dd/MM/yyyy')}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeader]}>
          <Text style={[styles.tableColHeader, styles.descriptionCol]}>Description</Text>
          <Text style={[styles.tableColHeader, styles.amountCol]}>Amount (EUR)</Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={[styles.tableCol, styles.descriptionCol]}>
            {invoice.description || `Car Rental Service${booking ? ` - ${booking.car_model}` : ''}`}
          </Text>
          <Text style={[styles.tableCol, styles.amountCol]}>
            €{invoice.subtotal.toFixed(2)}
          </Text>
        </View>
      </View>

      <View style={styles.totalSection}>
        <View style={styles.totalRow}>
          <Text style={[styles.totalValue, styles.grandTotal]}>Total: €{invoice.total_amount.toFixed(2)}</Text>
        </View>
      </View>

      {invoice.notes && (
        <View style={styles.notes}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text>{invoice.notes}</Text>
        </View>
      )}

      <Text style={styles.footer}>
        Thank you for your business!
      </Text>
    </Page>
  </Document>
);
