import React from "https://esm.sh/react@18.2.0";
import {
  Page,
  Text,
  View,
  StyleSheet,
} from "https://esm.sh/@react-pdf/renderer@3.1.14";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
  },
  invoiceNumber: {
    fontSize: 12,
    color: "#666",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#333",
  },
  text: {
    marginBottom: 4,
    lineHeight: 1.4,
  },
  table: {
    marginTop: 20,
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: "#000",
    paddingBottom: 8,
    marginBottom: 8,
    fontWeight: "bold",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  col1: { width: "50%" },
  col2: { width: "15%", textAlign: "right" },
  col3: { width: "20%", textAlign: "right" },
  col4: { width: "15%", textAlign: "right" },
  totalsSection: {
    marginTop: 20,
    alignItems: "flex-end",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 200,
    paddingVertical: 4,
  },
  totalLabel: {
    fontWeight: "bold",
  },
  grandTotal: {
    fontSize: 14,
    fontWeight: "bold",
    borderTopWidth: 2,
    borderTopColor: "#000",
    paddingTop: 8,
    marginTop: 8,
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#666",
    borderTopWidth: 1,
    borderTopColor: "#eee",
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
}: TaxInvoicePDFProps) => {
  const formatCurrency = (amount: number) => {
    return `${currency} ${amount.toFixed(2)}`;
  };

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>TAX INVOICE</Text>
        <Text style={styles.invoiceNumber}>Invoice #{invoiceNumber}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>From:</Text>
        <Text style={styles.text}>{companyName}</Text>
        {companyAddress && <Text style={styles.text}>{companyAddress}</Text>}
        {companyEmail && <Text style={styles.text}>{companyEmail}</Text>}
        {companyPhone && <Text style={styles.text}>{companyPhone}</Text>}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bill To:</Text>
        <Text style={styles.text}>{clientName}</Text>
        {billingAddress && <Text style={styles.text}>{billingAddress}</Text>}
        {clientEmail && <Text style={styles.text}>{clientEmail}</Text>}
      </View>

      <View style={styles.section}>
        <Text style={styles.text}>
          <Text style={{ fontWeight: "bold" }}>Invoice Date: </Text>
          {new Date(invoiceDate).toLocaleDateString()}
        </Text>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={styles.col1}>Description</Text>
          <Text style={styles.col2}>Qty</Text>
          <Text style={styles.col3}>Unit Price</Text>
          <Text style={styles.col4}>Amount</Text>
        </View>
        {lineItems.map((item: LineItem, index: number) => (
          <View key={index} style={styles.tableRow}>
            <Text style={styles.col1}>{item.description}</Text>
            <Text style={styles.col2}>{item.quantity}</Text>
            <Text style={styles.col3}>{formatCurrency(item.unit_price)}</Text>
            <Text style={styles.col4}>{formatCurrency(item.amount)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.totalsSection}>
        <View style={styles.totalRow}>
          <Text>Subtotal:</Text>
          <Text>{formatCurrency(subtotal)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text>VAT ({vatRate}%):</Text>
          <Text>{formatCurrency(vatAmount)}</Text>
        </View>
        <View style={[styles.totalRow, styles.grandTotal]}>
          <Text style={styles.totalLabel}>Total:</Text>
          <Text style={styles.totalLabel}>{formatCurrency(totalAmount)}</Text>
        </View>
      </View>

      {notes && (
        <View style={[styles.section, { marginTop: 30 }]}>
          <Text style={styles.sectionTitle}>Notes:</Text>
          <Text style={styles.text}>{notes}</Text>
        </View>
      )}

      <View style={styles.footer}>
        <Text>Thank you for your business.</Text>
        <Text>{companyName} - {companyEmail}</Text>
      </View>
    </Page>
  );
};
