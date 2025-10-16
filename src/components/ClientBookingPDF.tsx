import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { format } from 'date-fns';

const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1a1a1a',
  },
  header: {
    marginBottom: 35,
    borderBottomWidth: 1.5,
    borderBottomColor: '#2c3e50',
    paddingBottom: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  logo: {
    width: 100,
    height: 50,
    objectFit: 'contain',
  },
  documentTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#2c3e50',
    letterSpacing: 1,
  },
  referenceCode: {
    fontSize: 11,
    textAlign: 'center',
    color: '#666666',
    marginBottom: 15,
  },
  companyInfo: {
    textAlign: 'center',
    fontSize: 8,
    color: '#666666',
    lineHeight: 1.5,
  },
  badge: {
    backgroundColor: '#c9a85f',
    color: '#ffffff',
    padding: '4 12',
    fontSize: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 10,
    alignSelf: 'center',
  },
  twoColumnRow: {
    flexDirection: 'row',
    marginBottom: 25,
    gap: 20,
  },
  columnLeft: {
    width: '48%',
  },
  columnRight: {
    width: '48%',
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 6,
    color: '#2c3e50',
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
  },
  fieldLabel: {
    width: '40%',
    fontSize: 9,
    color: '#666666',
  },
  fieldValue: {
    width: '60%',
    fontSize: 9,
    color: '#1a1a1a',
    fontWeight: 'medium',
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
  },
  serviceName: {
    fontSize: 9,
    color: '#1a1a1a',
  },
  servicePrice: {
    fontSize: 9,
    color: '#666666',
    fontWeight: 'medium',
  },
  paymentSection: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#2c3e50',
    padding: 20,
    marginTop: 30,
    marginBottom: 30,
  },
  paymentHeader: {
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 15,
    color: '#2c3e50',
    textAlign: 'center',
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0e0e0',
  },
  paymentLabel: {
    fontSize: 10,
    color: '#666666',
  },
  paymentValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 2,
    borderTopColor: '#2c3e50',
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2c3e50',
    textTransform: 'uppercase',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 50,
    right: 50,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 15,
    textAlign: 'center',
    fontSize: 7,
    color: '#999999',
    fontStyle: 'italic',
  },
});

interface ClientBookingPDFProps {
  booking: any;
  appSettings?: {
    logo_url: string | null;
    company_name: string;
    company_address: string | null;
    company_email: string | null;
    company_phone: string | null;
  };
}

export const ClientBookingPDF = ({ booking, appSettings }: ClientBookingPDFProps) => {
  const additionalServices = (booking.additional_services as Array<{ name: string; price: number }>) || [];
  
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {appSettings?.logo_url && (
            <View style={styles.logoContainer}>
              <Image src={appSettings.logo_url} style={styles.logo} />
            </View>
          )}
          <Text style={styles.documentTitle}>BOOKING CONFIRMATION</Text>
          <Text style={styles.referenceCode}>Reference: {booking.reference_code}</Text>
          <Text style={styles.badge}>CLIENT COPY</Text>
          {appSettings && (
            <Text style={styles.companyInfo}>
              {appSettings.company_name}
              {appSettings.company_address && ` • ${appSettings.company_address}`}
              {appSettings.company_email && ` • ${appSettings.company_email}`}
              {appSettings.company_phone && ` • ${appSettings.company_phone}`}
            </Text>
          )}
        </View>

        <View style={styles.twoColumnRow}>
          <View style={styles.columnLeft}>
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Booking Information</Text>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Status</Text>
                <Text style={styles.fieldValue}>{booking.status}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Booking Date</Text>
                <Text style={styles.fieldValue}>
                  {format(new Date(booking.booking_date), 'dd/MM/yyyy')}
                </Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Delivery</Text>
                <Text style={styles.fieldValue}>
                  {format(new Date(booking.delivery_datetime), 'dd/MM/yyyy HH:mm')}
                </Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Collection</Text>
                <Text style={styles.fieldValue}>
                  {format(new Date(booking.collection_datetime), 'dd/MM/yyyy HH:mm')}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.columnRight}>
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Client Information</Text>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Name</Text>
                <Text style={styles.fieldValue}>{booking.client_name}</Text>
              </View>
              {booking.client_email && (
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Email</Text>
                  <Text style={styles.fieldValue}>{booking.client_email}</Text>
                </View>
              )}
              {booking.client_phone && (
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Phone</Text>
                  <Text style={styles.fieldValue}>{booking.client_phone}</Text>
                </View>
              )}
              {booking.company_name && (
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Company</Text>
                  <Text style={styles.fieldValue}>{booking.company_name}</Text>
                </View>
              )}
              {booking.billing_address && (
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Billing Address</Text>
                  <Text style={styles.fieldValue}>{booking.billing_address}</Text>
                </View>
              )}
              {booking.country && (
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Country</Text>
                  <Text style={styles.fieldValue}>{booking.country}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.twoColumnRow}>
          <View style={styles.columnLeft}>
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Vehicle Information</Text>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Model</Text>
                <Text style={styles.fieldValue}>{booking.car_model}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Plate</Text>
                <Text style={styles.fieldValue}>{booking.car_plate}</Text>
              </View>
              {booking.km_included && (
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>KM Included</Text>
                  <Text style={styles.fieldValue}>{booking.km_included} km</Text>
                </View>
              )}
              {booking.extra_km_cost && (
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Extra KM Cost</Text>
                  <Text style={styles.fieldValue}>€{booking.extra_km_cost.toFixed(2)}/km</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.columnRight}>
            {additionalServices.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionHeader}>Additional Services</Text>
                {additionalServices.map((service, index) => (
                  <View key={index} style={styles.serviceRow}>
                    <Text style={styles.serviceName}>{service.name}</Text>
                    <Text style={styles.servicePrice}>€{service.price.toFixed(2)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={styles.twoColumnRow}>
          <View style={styles.columnLeft}>
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Delivery</Text>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Location</Text>
                <Text style={styles.fieldValue}>{booking.delivery_location}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Date & Time</Text>
                <Text style={styles.fieldValue}>
                  {format(new Date(booking.delivery_datetime), 'dd/MM/yyyy HH:mm')}
                </Text>
              </View>
              {booking.delivery_info && (
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Notes</Text>
                  <Text style={styles.fieldValue}>{booking.delivery_info}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.columnRight}>
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Collection</Text>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Location</Text>
                <Text style={styles.fieldValue}>{booking.collection_location}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Date & Time</Text>
                <Text style={styles.fieldValue}>
                  {format(new Date(booking.collection_datetime), 'dd/MM/yyyy HH:mm')}
                </Text>
              </View>
              {booking.collection_info && (
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Notes</Text>
                  <Text style={styles.fieldValue}>{booking.collection_info}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.paymentSection}>
          <Text style={styles.paymentHeader}>Payment Information</Text>
          
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Rental Price</Text>
            <Text style={styles.paymentValue}>€{booking.rental_price_gross?.toFixed(2) || '0.00'}</Text>
          </View>
          
          {booking.vat_rate && (
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>VAT ({booking.vat_rate}%)</Text>
              <Text style={styles.paymentValue}>
                €{((booking.rental_price_gross * booking.vat_rate) / 100).toFixed(2)}
              </Text>
            </View>
          )}
          
          {booking.security_deposit_amount && (
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Security Deposit</Text>
              <Text style={styles.paymentValue}>€{booking.security_deposit_amount.toFixed(2)}</Text>
            </View>
          )}
          
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>€{booking.amount_total?.toFixed(2) || '0.00'}</Text>
          </View>
          
          {booking.amount_paid && (
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Amount Paid</Text>
              <Text style={styles.paymentValue}>€{booking.amount_paid.toFixed(2)}</Text>
            </View>
          )}
        </View>

        <Text style={styles.footer}>
          Thank you for choosing our premium services
        </Text>
      </Page>
    </Document>
  );
};
