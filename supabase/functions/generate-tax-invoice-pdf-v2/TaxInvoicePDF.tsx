import React from "https://esm.sh/react@18.2.0";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "https://esm.sh/@react-pdf/renderer@3.1.14";

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
  serviceTable: {
    marginTop: 10,
  },
  serviceRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #eee',
    paddingVertical: 5,
  },
  serviceHeader: {
    backgroundColor: '#f8f9fa',
    fontWeight: 'bold',
    paddingVertical: 8,
  },
  serviceCol1: { width: '50%', paddingHorizontal: 5 },
  serviceCol2: { width: '20%', paddingHorizontal: 5, textAlign: 'right' },
  serviceCol3: { width: '30%', paddingHorizontal: 5, textAlign: 'right' },
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
});

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

interface TaxInvoicePDFProps {
  invoiceNumber: string;
  invoiceDate: string;
  clientName: string;
  clientEmail?: string;
  billingAddress?: string;
  lineItems: LineItem[];
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  currency: string;
  notes?: string;
  companyName: string;
  companyEmail?: string;
  companyPhone?: string;
  companyAddress?: string;
  companyLogoUrl?: string;
  bookingReference?: string;
  rentalDescription?: string;
  deliveryLocation?: string;
  collectionLocation?: string;
  rentalStartDate?: string;
  rentalEndDate?: string;
}

export const TaxInvoicePDF = ({
  invoiceNumber,
  invoiceDate,
  clientName,
  clientEmail,
  billingAddress,
  lineItems,
  subtotal,
  vatRate,
  vatAmount,
  totalAmount,
  currency,
  notes,
  companyName,
  companyEmail,
  companyPhone,
  companyAddress,
  bookingReference,
  rentalDescription,
  deliveryLocation,
  collectionLocation,
  rentalStartDate,
  rentalEndDate,
}: TaxInvoicePDFProps) => {
  const formatCurrency = (amount: number) => {
    return `${currency} ${amount.toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>TAX INVOICE</Text>
          <Text style={styles.subtitle}>Invoice #{invoiceNumber}</Text>
          <Text style={styles.subtitle}>Date: {formatDate(invoiceDate)}</Text>
        </View>

        {/* Company Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>From</Text>
          <Text style={{ fontWeight: 'bold', marginBottom: 3 }}>{companyName}</Text>
          {companyAddress && <Text style={{ fontSize: 10, marginBottom: 2 }}>{companyAddress}</Text>}
          {companyEmail && <Text style={{ fontSize: 10, marginBottom: 2 }}>{companyEmail}</Text>}
          {companyPhone && <Text style={{ fontSize: 10, marginBottom: 2 }}>{companyPhone}</Text>}
        </View>

        {/* Client Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bill To</Text>
          <Text style={{ fontWeight: 'bold', marginBottom: 3 }}>{clientName}</Text>
          {clientEmail && <Text style={{ fontSize: 10, marginBottom: 2 }}>{clientEmail}</Text>}
          {billingAddress && <Text style={{ fontSize: 10, marginBottom: 2 }}>{billingAddress}</Text>}
        </View>

        {/* Booking Details (if available) */}
        {(bookingReference || rentalDescription) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Booking Details</Text>
            {bookingReference && (
              <View style={styles.row}>
                <Text style={styles.label}>Booking Reference:</Text>
                <Text style={styles.value}>{bookingReference}</Text>
              </View>
            )}
            {rentalDescription && (
              <View style={styles.row}>
                <Text style={styles.label}>Description:</Text>
                <Text style={styles.value}>{rentalDescription}</Text>
              </View>
            )}
            {deliveryLocation && (
              <View style={styles.row}>
                <Text style={styles.label}>Delivery Location:</Text>
                <Text style={styles.value}>{deliveryLocation}</Text>
              </View>
            )}
            {collectionLocation && (
              <View style={styles.row}>
                <Text style={styles.label}>Collection Location:</Text>
                <Text style={styles.value}>{collectionLocation}</Text>
              </View>
            )}
            {rentalStartDate && rentalEndDate && (
              <View style={styles.row}>
                <Text style={styles.label}>Rental Period:</Text>
                <Text style={styles.value}>
                  {formatDate(rentalStartDate)} - {formatDate(rentalEndDate)}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Line Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items</Text>
          <View style={styles.serviceTable}>
            <View style={[styles.serviceRow, styles.serviceHeader]}>
              <Text style={styles.serviceCol1}>Description</Text>
              <Text style={styles.serviceCol2}>Qty</Text>
              <Text style={styles.serviceCol3}>Amount</Text>
            </View>
            {lineItems.map((item: LineItem, index: number) => (
              <View key={index} style={styles.serviceRow}>
                <Text style={styles.serviceCol1}>{item.description}</Text>
                <Text style={styles.serviceCol2}>{item.quantity}</Text>
                <Text style={styles.serviceCol3}>{formatCurrency(item.amount)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Totals */}
        <View style={styles.amountCard}>
          <View style={styles.amountRow}>
            <Text>Subtotal:</Text>
            <Text>{formatCurrency(subtotal)}</Text>
          </View>
          <View style={styles.amountRow}>
            <Text>VAT ({vatRate}%):</Text>
            <Text>{formatCurrency(vatAmount)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Amount:</Text>
            <Text style={styles.totalValue}>{formatCurrency(totalAmount)}</Text>
          </View>
        </View>

        {/* Notes */}
        {notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={{ fontSize: 10, color: '#666' }}>{notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Thank you for your business!</Text>
          <Text style={{ marginTop: 5 }}>
            This is a computer-generated invoice and does not require a signature.
          </Text>
        </View>
      </Page>
    </Document>
  );
};
