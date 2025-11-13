import React from "https://esm.sh/react@18.2.0";
import {
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Document,
} from "https://esm.sh/@react-pdf/renderer@3.1.14";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  logo: {
    width: 120,
    height: 60,
    marginBottom: 10,
  },
  companyName: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  companyInfo: {
    fontSize: 9,
    color: "#666",
    marginBottom: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
  },
  invoiceNumber: {
    fontSize: 10,
    color: "#666",
  },
  section: {
    marginBottom: 20,
  },
  sectionWithMargin: {
    marginBottom: 20,
    marginTop: 30,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#000",
  },
  text: {
    fontSize: 10,
    marginBottom: 4,
  },
  label: {
    fontSize: 9,
    fontWeight: "bold",
    marginBottom: 2,
  },
  table: {
    marginBottom: 20,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    paddingVertical: 8,
  },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    paddingVertical: 8,
    backgroundColor: "#f5f5f5",
  },
  tableCol: {
    fontSize: 10,
  },
  tableColHeader: {
    fontSize: 10,
    fontWeight: "bold",
  },
  descriptionCol: {
    flex: 6,
    paddingRight: 8,
  },
  descriptionColHeader: {
    flex: 6,
    paddingRight: 8,
    fontSize: 10,
    fontWeight: "bold",
  },
  amountCol: {
    flex: 4,
    textAlign: "right",
  },
  amountColHeader: {
    flex: 4,
    textAlign: "right",
    fontSize: 10,
    fontWeight: "bold",
  },
  totalsSection: {
    marginLeft: "auto",
    marginBottom: 20,
  },
  totalRow: {
    flexDirection: "row",
    width: 250,
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  grandTotalRow: {
    flexDirection: "row",
    width: 250,
    justifyContent: "space-between",
    paddingVertical: 4,
    borderTopWidth: 2,
    borderTopColor: "#000",
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 10,
  },
  totalValue: {
    fontSize: 10,
    fontWeight: "bold",
  },
  footer: {
    marginTop: 40,
    fontSize: 8,
    color: "#666",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    paddingTop: 10,
  },
  bookingDetailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  bookingDetailItem: {
    flex: 1,
    marginBottom: 6,
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
  companyLogoUrl,
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
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB');
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
        <View style={styles.headerLeft}>
          {companyLogoUrl && (
            <Image src={companyLogoUrl} style={styles.logo} />
          )}
          <Text style={styles.companyName}>{companyName}</Text>
          {companyAddress && <Text style={styles.companyInfo}>{companyAddress}</Text>}
          {companyEmail && <Text style={styles.companyInfo}>{companyEmail}</Text>}
          {companyPhone && <Text style={styles.companyInfo}>{companyPhone}</Text>}
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.title}>TAX INVOICE</Text>
          <Text style={styles.invoiceNumber}>Invoice #: {invoiceNumber}</Text>
          <Text style={styles.invoiceNumber}>Date: {formatDate(invoiceDate)}</Text>
        </View>
      </View>

      {/* Bill To Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bill To</Text>
        <Text style={styles.text}>{clientName}</Text>
        {billingAddress && <Text style={styles.text}>{billingAddress}</Text>}
        {clientEmail && <Text style={styles.text}>{clientEmail}</Text>}
      </View>

      {/* Booking Details Section (if available) */}
      {(bookingReference || rentalDescription || deliveryLocation || collectionLocation) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Booking Details</Text>
          <View style={styles.bookingDetailsGrid}>
            {bookingReference && (
              <View style={styles.bookingDetailItem}>
                <Text style={styles.label}>Booking Reference:</Text>
                <Text style={styles.text}>{bookingReference}</Text>
              </View>
            )}
            {rentalDescription && (
              <View style={styles.bookingDetailItem}>
                <Text style={styles.label}>Vehicle & Duration:</Text>
                <Text style={styles.text}>{rentalDescription}</Text>
              </View>
            )}
            {(rentalStartDate && rentalEndDate) && (
              <View style={styles.bookingDetailItem}>
                <Text style={styles.label}>Rental Period:</Text>
                <Text style={styles.text}>
                  {formatDate(rentalStartDate)} - {formatDate(rentalEndDate)}
                </Text>
              </View>
            )}
            {deliveryLocation && (
              <View style={styles.bookingDetailItem}>
                <Text style={styles.label}>Delivery Location:</Text>
                <Text style={styles.text}>{deliveryLocation}</Text>
              </View>
            )}
            {collectionLocation && (
              <View style={styles.bookingDetailItem}>
                <Text style={styles.label}>Collection Location:</Text>
                <Text style={styles.text}>{collectionLocation}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Line Items Table */}
      <View style={styles.table}>
        <View style={styles.tableHeaderRow}>
          <Text style={styles.descriptionColHeader}>Description</Text>
          <Text style={styles.amountColHeader}>Amount</Text>
        </View>
        {lineItems.map((item: LineItem, index: number) => (
          <View key={index} style={styles.tableRow}>
            <Text style={styles.descriptionCol}>
              {item.description}
              {item.quantity > 1 && ` (Qty: ${item.quantity} × ${formatCurrency(item.unit_price)})`}
            </Text>
            <Text style={styles.amountCol}>{formatCurrency(item.amount)}</Text>
          </View>
        ))}
      </View>

      {/* Totals Section */}
      <View style={styles.totalsSection}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal (Net):</Text>
          <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>VAT ({vatRate}%):</Text>
          <Text style={styles.totalValue}>{formatCurrency(vatAmount)}</Text>
        </View>
        <View style={styles.grandTotalRow}>
          <Text style={styles.totalValue}>Total (incl. VAT):</Text>
          <Text style={styles.totalValue}>{formatCurrency(totalAmount)}</Text>
        </View>
      </View>

      {/* Notes */}
      {notes && (
        <View style={styles.sectionWithMargin}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.text}>{notes}</Text>
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Text>Thank you for your business.</Text>
        <Text>{companyName} - {companyEmail}</Text>
      </View>
      </Page>
    </Document>
  );
};
