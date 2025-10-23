import React from "https://esm.sh/react@18.2.0";
import {
  Document,
  Page,
  Text,
  View,
  Image,
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
  signatureSection: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f0fdf4',
    borderRadius: 4,
    border: '1 solid #10b981',
  },
  signatureImage: {
    width: 250,
    height: 100,
    objectFit: 'contain',
    marginTop: 10,
    marginBottom: 10,
  },
  signatureDetails: {
    marginTop: 10,
    fontSize: 9,
    color: '#666',
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
    alignSelf: 'flex-start',
  },
  paymentMethodsBox: {
    backgroundColor: '#eff6ff',
    padding: 10,
    borderRadius: 4,
    marginTop: 10,
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
  digitalStamp: {
    marginTop: 20,
    borderWidth: 2,
    borderColor: '#2c3e50',
    borderRadius: 4,
    padding: 10,
    backgroundColor: '#f0f9ff',
    alignItems: 'center',
  },
  digitalStampTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  digitalStampDate: {
    fontSize: 10,
    color: '#666666',
    fontStyle: 'italic',
  },
});

interface SignedBookingPDFProps {
  booking: any;
  appSettings?: any;
}

export const SignedBookingPDF = ({ booking, appSettings }: SignedBookingPDFProps) => {
  const companyName = appSettings?.company_name || 'BookRentManager';

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toISOString().replace('T', ' ').substring(0, 16);
  };

  const totalServices = booking.booking_services?.reduce(
    (sum: number, service: any) => sum + (service.service_price * service.quantity),
    0
  ) || 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Booking Confirmation</Text>
          <Text style={styles.subtitle}>
            Booking Reference: {booking.reference_code}
          </Text>
          <Text style={styles.subtitle}>Generated: {formatDate(new Date().toISOString())}</Text>
          <View style={styles.statusBadge}>
            <Text>{booking.status.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Company Information</Text>
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
            <Text style={{ fontSize: 10, color: '#666' }}>Phone: {appSettings.company_phone}</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Client Information</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Name:</Text>
            <Text style={styles.value}>{booking.client_name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Email:</Text>
            <Text style={styles.value}>{booking.client_email}</Text>
          </View>
          {booking.client_phone && (
            <View style={styles.row}>
              <Text style={styles.label}>Phone:</Text>
              <Text style={styles.value}>{booking.client_phone}</Text>
            </View>
          )}
          {booking.billing_address && (
            <View style={styles.row}>
              <Text style={styles.label}>Billing Address:</Text>
              <Text style={styles.value}>{booking.billing_address}</Text>
            </View>
          )}
          {booking.country && (
            <View style={styles.row}>
              <Text style={styles.label}>Country:</Text>
              <Text style={styles.value}>{booking.country}</Text>
            </View>
          )}
          {booking.company_name && (
            <View style={styles.row}>
              <Text style={styles.label}>Company:</Text>
              <Text style={styles.value}>{booking.company_name}</Text>
            </View>
          )}
        </View>

        {booking.guest_name && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Guest Information</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Guest Name:</Text>
              <Text style={styles.value}>{booking.guest_name}</Text>
            </View>
            {booking.guest_phone && (
              <View style={styles.row}>
                <Text style={styles.label}>Guest Phone:</Text>
                <Text style={styles.value}>{booking.guest_phone}</Text>
              </View>
            )}
            {booking.guest_country && (
              <View style={styles.row}>
                <Text style={styles.label}>Guest Country:</Text>
                <Text style={styles.value}>{booking.guest_country}</Text>
              </View>
            )}
            {booking.guest_billing_address && (
              <View style={styles.row}>
                <Text style={styles.label}>Guest Billing Address:</Text>
                <Text style={styles.value}>{booking.guest_billing_address}</Text>
              </View>
            )}
            {booking.guest_company_name && (
              <View style={styles.row}>
                <Text style={styles.label}>Guest Company:</Text>
                <Text style={styles.value}>{booking.guest_company_name}</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rental Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Vehicle:</Text>
            <Text style={styles.value}>{booking.car_model}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Delivery Location:</Text>
            <Text style={styles.value}>{booking.delivery_location}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Delivery Date:</Text>
            <Text style={styles.value}>{formatDate(booking.delivery_datetime)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Collection Location:</Text>
            <Text style={styles.value}>{booking.collection_location}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Collection Date:</Text>
            <Text style={styles.value}>{formatDate(booking.collection_datetime)}</Text>
          </View>
          {booking.suppliers?.name && (
            <View style={styles.row}>
              <Text style={styles.label}>Supplier:</Text>
              <Text style={styles.value}>{booking.suppliers.name}</Text>
            </View>
          )}
        </View>

        {booking.booking_services && booking.booking_services.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Services</Text>
            <View style={styles.serviceTable}>
              <View style={[styles.serviceRow, styles.serviceHeader]}>
                <Text style={styles.serviceCol1}>Service</Text>
                <Text style={styles.serviceCol2}>Qty</Text>
                <Text style={styles.serviceCol3}>Price</Text>
              </View>
              {booking.booking_services.map((service: any, index: number) => (
                <View key={index} style={styles.serviceRow}>
                  <Text style={styles.serviceCol1}>{service.service_name}</Text>
                  <Text style={styles.serviceCol2}>{service.quantity}</Text>
                  <Text style={styles.serviceCol3}>
                    {booking.currency} {(service.service_price * service.quantity).toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Summary</Text>
          <View style={styles.amountCard}>
            <View style={styles.amountRow}>
              <Text>Base Rental Rate:</Text>
              <Text>{booking.currency} {booking.rental_rate?.toFixed(2) || '0.00'}</Text>
            </View>
            {totalServices > 0 && (
              <View style={styles.amountRow}>
                <Text>Additional Services:</Text>
                <Text>{booking.currency} {totalServices.toFixed(2)}</Text>
              </View>
            )}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Amount:</Text>
              <Text style={styles.totalValue}>
                {booking.currency} {booking.amount_total?.toFixed(2) || '0.00'}
              </Text>
            </View>
            <View style={styles.amountRow}>
              <Text>Amount Paid:</Text>
              <Text>{booking.currency} {booking.amount_paid?.toFixed(2) || '0.00'}</Text>
            </View>
            <View style={styles.amountRow}>
              <Text>Remaining Balance:</Text>
              <Text>
                {booking.currency} {((booking.amount_total || 0) - (booking.amount_paid || 0)).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {booking.selected_payment_methods && booking.selected_payment_methods.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Selected Payment Methods</Text>
            <View style={styles.paymentMethodsBox}>
              {booking.selected_payment_methods.map((method: string, index: number) => (
                <Text key={index} style={{ fontSize: 10, marginBottom: 3 }}>
                  • {method}
                </Text>
              ))}
            </View>
          </View>
        )}

        {booking.imported_from_email && !booking.tc_signature_data ? (
          <View style={styles.digitalStamp}>
            <Text style={styles.digitalStampTitle}>✓ SIGNED DIGITALLY</Text>
            <Text style={styles.digitalStampDate}>
              Imported on: {formatDate(booking.email_import_date)}
            </Text>
          </View>
        ) : booking.tc_signature_data ? (
          <View style={styles.signatureSection}>
            <Text style={styles.sectionTitle}>Digital Signature & Acceptance</Text>
            <Image 
              src={booking.tc_signature_data} 
              style={styles.signatureImage}
            />
            <View style={styles.signatureDetails}>
              <Text style={{ marginBottom: 3 }}>Signed by: {booking.client_name}</Text>
              <Text style={{ marginBottom: 3 }}>Date: {formatDate(booking.tc_accepted_at)}</Text>
              {booking.tc_accepted_ip && (
                <Text style={{ marginBottom: 3 }}>IP Address: {booking.tc_accepted_ip}</Text>
              )}
              {booking.tc_version_id && (
                <Text>Terms & Conditions Version: {booking.tc_version_id}</Text>
              )}
            </View>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text>This is an official booking confirmation generated by {companyName}</Text>
          <Text style={{ marginTop: 3 }}>
            For any queries, please contact {appSettings?.company_email || 'support'}
          </Text>
        </View>
      </Page>
    </Document>
  );
};
