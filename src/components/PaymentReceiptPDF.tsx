import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { format } from 'date-fns';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 30,
    borderBottom: '2 solid #333',
    paddingBottom: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  subtitle: {
    fontSize: 10,
    color: '#666',
    marginTop: 5,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  label: {
    width: '40%',
    fontWeight: 'bold',
    color: '#555',
  },
  value: {
    width: '60%',
    color: '#333',
  },
  amountCard: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 4,
    marginTop: 10,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  amountLabel: {
    fontSize: 11,
    color: '#555',
  },
  amountValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#333',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTop: '1 solid #ddd',
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 9,
    color: '#999',
    borderTop: '1 solid #eee',
    paddingTop: 10,
  },
  transactionBox: {
    backgroundColor: '#eff6ff',
    padding: 10,
    borderRadius: 4,
    marginTop: 5,
  },
  transactionText: {
    fontSize: 10,
    color: '#1e40af',
    fontFamily: 'Courier',
  },
  statusBadge: {
    backgroundColor: '#10b981',
    color: '#ffffff',
    padding: '5 10',
    borderRadius: 3,
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginTop: 5,
  },
});

interface PaymentReceiptPDFProps {
  payment: {
    id: string;
    amount: number;
    currency: string;
    paid_at: string;
    method: string;
    type: string;
    postfinance_transaction_id?: string;
    payment_method_type?: string;
    fee_amount?: number;
    total_amount?: number;
  };
  booking: {
    reference_code: string;
    client_name: string;
    client_email?: string;
    car_model: string;
    delivery_datetime: string;
    collection_datetime: string;
    amount_total: number;
    amount_paid: number;
    currency: string;
  };
  appSettings?: {
    company_name?: string;
    company_address?: string;
    company_email?: string;
    company_phone?: string;
  };
}

export const PaymentReceiptPDF = ({ payment, booking, appSettings }: PaymentReceiptPDFProps) => {
  const companyName = appSettings?.company_name || 'BookRentManager';
  const remainingBalance = booking.amount_total - booking.amount_paid;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Payment Receipt</Text>
          <Text style={styles.subtitle}>
            Receipt ID: {payment.id.substring(0, 8).toUpperCase()}
          </Text>
          <Text style={styles.subtitle}>
            Issued: {format(new Date(), 'PPpp')}
          </Text>
        </View>

        {/* Company Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>From</Text>
          <Text style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 3 }}>{companyName}</Text>
          {appSettings?.company_address && (
            <Text style={{ fontSize: 10, color: '#666', marginBottom: 2 }}>
              {appSettings.company_address}
            </Text>
          )}
          {appSettings?.company_email && (
            <Text style={{ fontSize: 10, color: '#666', marginBottom: 2 }}>
              Email: {appSettings.company_email}
            </Text>
          )}
          {appSettings?.company_phone && (
            <Text style={{ fontSize: 10, color: '#666' }}>
              Phone: {appSettings.company_phone}
            </Text>
          )}
        </View>

        {/* Client Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bill To</Text>
          <Text style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 3 }}>
            {booking.client_name}
          </Text>
          {booking.client_email && (
            <Text style={{ fontSize: 10, color: '#666' }}>{booking.client_email}</Text>
          )}
        </View>

        {/* Booking Reference */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Booking Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Booking Reference:</Text>
            <Text style={styles.value}>{booking.reference_code}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Vehicle:</Text>
            <Text style={styles.value}>{booking.car_model}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Delivery Date:</Text>
            <Text style={styles.value}>
              {format(new Date(booking.delivery_datetime), 'PPp')}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Collection Date:</Text>
            <Text style={styles.value}>
              {format(new Date(booking.collection_datetime), 'PPp')}
            </Text>
          </View>
        </View>

        {/* Payment Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Information</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Payment Date:</Text>
            <Text style={styles.value}>{format(new Date(payment.paid_at), 'PPp')}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Payment Method:</Text>
            <Text style={styles.value}>
              {payment.payment_method_type || payment.method.replace(/_/g, ' ').toUpperCase()}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Payment Type:</Text>
            <Text style={styles.value}>{payment.type.replace(/_/g, ' ').toUpperCase()}</Text>
          </View>
          {payment.postfinance_transaction_id && (
            <View>
              <Text style={styles.label}>Transaction ID:</Text>
              <View style={styles.transactionBox}>
                <Text style={styles.transactionText}>{payment.postfinance_transaction_id}</Text>
              </View>
            </View>
          )}
          <View style={styles.statusBadge}>
            <Text>PAID</Text>
          </View>
        </View>

        {/* Payment Amount Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Amount Details</Text>
          <View style={styles.amountCard}>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Payment Amount:</Text>
              <Text style={styles.amountValue}>
                {payment.currency} {payment.amount.toFixed(2)}
              </Text>
            </View>
            {payment.fee_amount !== undefined && payment.fee_amount > 0 && (
              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>Processing Fee:</Text>
                <Text style={styles.amountValue}>
                  {payment.currency} {payment.fee_amount.toFixed(2)}
                </Text>
              </View>
            )}
            {payment.total_amount !== undefined && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Paid:</Text>
                <Text style={styles.totalValue}>
                  {payment.currency} {payment.total_amount.toFixed(2)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Booking Balance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Booking Balance</Text>
          <View style={styles.amountCard}>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Total Booking Amount:</Text>
              <Text style={styles.amountValue}>
                {booking.currency} {booking.amount_total.toFixed(2)}
              </Text>
            </View>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Total Paid:</Text>
              <Text style={styles.amountValue}>
                {booking.currency} {booking.amount_paid.toFixed(2)}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Remaining Balance:</Text>
              <Text style={[styles.totalValue, remainingBalance === 0 && { color: '#10b981' }]}>
                {booking.currency} {remainingBalance.toFixed(2)}
              </Text>
            </View>
          </View>
          {remainingBalance === 0 && (
            <Text style={{ fontSize: 10, color: '#10b981', marginTop: 10, fontWeight: 'bold' }}>
              ✓ Booking fully paid
            </Text>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>This is an automated payment receipt generated by {companyName}</Text>
          <Text style={{ marginTop: 3 }}>
            For any queries, please contact {appSettings?.company_email || 'support'}
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export default PaymentReceiptPDF;
