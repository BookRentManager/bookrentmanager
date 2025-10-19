import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { format } from 'date-fns';

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#1a1a1a',
  },
  header: {
    marginBottom: 15,
    borderBottomWidth: 1.5,
    borderBottomColor: '#2c3e50',
    paddingBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 15,
  },
  logoColumn: {
    width: '30%',
    alignItems: 'flex-start',
  },
  infoColumn: {
    width: '65%',
    alignItems: 'flex-end',
  },
  logo: {
    width: 87.5,
    height: 37.5,
    objectFit: 'contain',
  },
  documentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'right',
    marginBottom: 5,
    color: '#2c3e50',
    letterSpacing: 0.5,
  },
  referenceCode: {
    fontSize: 9.5,
    textAlign: 'right',
    color: '#666666',
    marginBottom: 6,
  },
  companyInfo: {
    textAlign: 'right',
    fontSize: 7.5,
    color: '#666666',
    lineHeight: 1.3,
    marginTop: 5,
  },
  badge: {
    backgroundColor: '#2c3e50',
    color: '#ffffff',
    padding: '2 8',
    fontSize: 7.5,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    textAlign: 'right',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  twoColumnRow: {
    flexDirection: 'row',
    marginBottom: 9,
    gap: 10,
  },
  columnLeft: {
    width: '48%',
  },
  columnRight: {
    width: '48%',
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
    padding: 9,
    backgroundColor: '#ffffff',
  },
  sectionHeader: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 4,
    color: '#2c3e50',
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingBottom: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
  },
  fieldLabel: {
    width: '40%',
    fontSize: 8,
    color: '#666666',
  },
  fieldValue: {
    width: '60%',
    fontSize: 8,
    color: '#1a1a1a',
    fontWeight: 'medium',
  },
  largeFieldValue: {
    width: '60%',
    fontSize: 9,
    color: '#1a1a1a',
    fontWeight: 'bold',
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
    paddingBottom: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
  },
  serviceName: {
    fontSize: 8.5,
    color: '#1a1a1a',
  },
  servicePrice: {
    fontSize: 8.5,
    color: '#666666',
    fontWeight: 'medium',
  },
  paymentCard: {
    borderWidth: 1,
    borderColor: '#2c3e50',
    borderRadius: 4,
    backgroundColor: '#f8f9fa',
    padding: 10,
    marginTop: 8,
  },
  paymentHeader: {
    fontSize: 10.5,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    color: '#2c3e50',
    textAlign: 'center',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  totalLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#2c3e50',
    textTransform: 'uppercase',
  },
  totalValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  footer: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 8,
    textAlign: 'center',
    fontSize: 7.5,
    color: '#999999',
    fontStyle: 'italic',
  },
});

interface SupplierBookingPDFProps {
  booking: any;
  appSettings?: {
    logo_url: string | null;
    company_name: string;
    company_address: string | null;
    company_email: string | null;
    company_phone: string | null;
  };
}

export const SupplierBookingPDF = ({ booking, appSettings }: SupplierBookingPDFProps) => {
  const additionalServices = (booking.additional_services as Array<{ name: string; price: number }>) || [];
  
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            {/* Left column: Logo */}
            <View style={styles.logoColumn}>
              {appSettings?.logo_url && (
                <Image src={appSettings.logo_url} style={styles.logo} />
              )}
            </View>
            
            {/* Right column: All text info */}
            <View style={styles.infoColumn}>
              <Text style={styles.documentTitle}>BOOKING ORDER</Text>
              <Text style={styles.referenceCode}>Reference: {booking.reference_code}</Text>
              <Text style={styles.badge}>SUPPLIER COPY</Text>
              {appSettings && (
                <Text style={styles.companyInfo}>
                  {appSettings.company_name}
                  {appSettings.company_email && ` • ${appSettings.company_email}`}
                  {appSettings.company_phone && ` • ${appSettings.company_phone}`}
                </Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.twoColumnRow}>
          <View style={styles.columnLeft}>
            <View style={styles.sectionCard}>
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
                <Text style={styles.fieldLabel}>Supplier</Text>
                <Text style={styles.fieldValue}>{booking.supplier_name || 'N/A'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.columnRight}>
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeader}>Vehicle Information</Text>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Model</Text>
                <Text style={styles.largeFieldValue}>{booking.car_model}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Plate</Text>
                <Text style={styles.largeFieldValue}>{booking.car_plate}</Text>
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
                  <Text style={styles.fieldValue}>€{booking.extra_km_cost}/km</Text>
                </View>
              )}
              {booking.security_deposit_amount && (
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Security Deposit</Text>
                  <Text style={styles.fieldValue}>€{booking.security_deposit_amount.toFixed(2)}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {additionalServices.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeader}>Additional Services</Text>
            {additionalServices.map((service, index) => (
              <View key={index} style={styles.serviceRow}>
                <Text style={styles.serviceName}>{service.name}</Text>
                <Text style={styles.servicePrice}>€{service.price.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.twoColumnRow}>
          <View style={styles.columnLeft}>
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeader}>Delivery</Text>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Location</Text>
                <Text style={styles.largeFieldValue}>{booking.delivery_location}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Date & Time</Text>
                <Text style={styles.largeFieldValue}>
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
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeader}>Collection</Text>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Location</Text>
                <Text style={styles.largeFieldValue}>{booking.collection_location}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Date & Time</Text>
                <Text style={styles.largeFieldValue}>
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

        <View style={styles.paymentCard}>
          <Text style={styles.paymentHeader}>Payment Information</Text>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Supplier Price</Text>
            <Text style={styles.totalValue}>€{booking.supplier_price?.toFixed(2) || '0.00'}</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          Partner Document - Supplier Copy
        </Text>
      </Page>
    </Document>
  );
};