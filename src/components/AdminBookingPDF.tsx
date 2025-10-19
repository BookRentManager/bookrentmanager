import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { format } from 'date-fns';

const styles = StyleSheet.create({
  page: {
    padding: 25,
    fontFamily: 'Helvetica',
    fontSize: 7,
    color: '#1a1a1a',
  },
  header: {
    marginBottom: 15,
    borderBottomWidth: 1.5,
    borderBottomColor: '#2c3e50',
    paddingBottom: 10,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  logo: {
    width: 70,
    height: 30,
    objectFit: 'contain',
  },
  documentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
    color: '#2c3e50',
    letterSpacing: 0.5,
  },
  referenceCode: {
    fontSize: 9,
    textAlign: 'center',
    color: '#666666',
    marginBottom: 6,
  },
  companyInfo: {
    textAlign: 'center',
    fontSize: 7,
    color: '#666666',
    lineHeight: 1.3,
    marginTop: 5,
  },
  badge: {
    backgroundColor: '#c9a85f',
    color: '#ffffff',
    padding: '2 8',
    fontSize: 7,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 4,
    alignSelf: 'center',
  },
  twoColumnRow: {
    flexDirection: 'row',
    marginBottom: 8,
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
    padding: 8,
    backgroundColor: '#ffffff',
  },
  sectionHeader: {
    fontSize: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 3,
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
    fontSize: 7,
    color: '#666666',
  },
  fieldValue: {
    width: '60%',
    fontSize: 7,
    color: '#1a1a1a',
    fontWeight: 'medium',
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
    fontSize: 8,
    color: '#1a1a1a',
  },
  servicePrice: {
    fontSize: 8,
    color: '#666666',
    fontWeight: 'medium',
  },
  paymentCard: {
    borderWidth: 1,
    borderColor: '#2c3e50',
    borderRadius: 4,
    backgroundColor: '#f8f9fa',
    padding: 8,
    marginTop: 0,
  },
  paymentHeader: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    color: '#2c3e50',
    textAlign: 'center',
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    paddingBottom: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0e0e0',
  },
  paymentLabel: {
    fontSize: 8,
    color: '#666666',
  },
  paymentValue: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  highlightRow: {
    backgroundColor: '#fff8e6',
    padding: 6,
    marginVertical: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 3,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#2c3e50',
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
    fontSize: 7,
    color: '#999999',
    fontStyle: 'italic',
  },
});

interface AdminBookingPDFProps {
  booking: any;
  appSettings?: {
    logo_url: string | null;
    company_name: string;
    company_address: string | null;
    company_email: string | null;
    company_phone: string | null;
  };
}

export const AdminBookingPDF = ({ booking, appSettings }: AdminBookingPDFProps) => {
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
          <Text style={styles.documentTitle}>BOOKING DETAILS</Text>
          <Text style={styles.referenceCode}>Reference: {booking.reference_code}</Text>
          <Text style={styles.badge}>ADMIN COPY - CONFIDENTIAL</Text>
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
            <View style={styles.sectionCard}>
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
              {booking.billing_address && (
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Billing Address</Text>
                  <Text style={styles.fieldValue}>{booking.billing_address}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {booking.guest_name && (
          <View style={styles.twoColumnRow}>
            <View style={styles.columnLeft}>
              <View style={styles.sectionCard}>
                <Text style={styles.sectionHeader}>Guest Information</Text>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Name</Text>
                  <Text style={styles.fieldValue}>{booking.guest_name}</Text>
                </View>
                {booking.guest_phone && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Phone</Text>
                    <Text style={styles.fieldValue}>{booking.guest_phone}</Text>
                  </View>
                )}
                {booking.guest_company_name && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Company</Text>
                    <Text style={styles.fieldValue}>{booking.guest_company_name}</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.columnRight}>
              <View style={styles.sectionCard}>
                <Text style={styles.sectionHeader}>Guest Billing</Text>
                {booking.guest_billing_address && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Address</Text>
                    <Text style={styles.fieldValue}>{booking.guest_billing_address}</Text>
                  </View>
                )}
                {booking.guest_country && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Country</Text>
                    <Text style={styles.fieldValue}>{booking.guest_country}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        <View style={styles.twoColumnRow}>
          <View style={styles.columnLeft}>
            <View style={styles.sectionCard}>
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
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeader}>Additional Services</Text>
              {additionalServices.length > 0 ? (
                additionalServices.map((service, index) => (
                  <View key={index} style={styles.serviceRow}>
                    <Text style={styles.serviceName}>{service.name}</Text>
                    <Text style={styles.servicePrice}>€{service.price.toFixed(2)}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.fieldValue}>No additional services</Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.twoColumnRow}>
          <View style={styles.columnLeft}>
            <View style={styles.sectionCard}>
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
            <View style={styles.sectionCard}>
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

        <View style={styles.twoColumnRow}>
          <View style={styles.columnLeft}>
            <View style={styles.paymentCard}>
              <Text style={styles.paymentHeader}>Financial Summary</Text>
              
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Rental Price (Gross)</Text>
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
              
              <View style={[styles.paymentRow, { backgroundColor: '#fff8e6', paddingHorizontal: 4, paddingVertical: 2 }]}>
                <Text style={styles.paymentLabel}>Supplier Price</Text>
                <Text style={styles.paymentValue}>€{booking.supplier_price?.toFixed(2) || '0.00'}</Text>
              </View>
              
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Base Commission</Text>
                <Text style={styles.paymentValue}>
                  €{((booking.rental_price_gross || 0) - (booking.supplier_price || 0)).toFixed(2)}
                </Text>
              </View>
              
              {booking.security_deposit_amount && (
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Security Deposit</Text>
                  <Text style={styles.paymentValue}>€{booking.security_deposit_amount.toFixed(2)}</Text>
                </View>
              )}
              
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>€{booking.amount_total?.toFixed(2) || '0.00'}</Text>
              </View>
              
              {booking.amount_paid && (
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Paid</Text>
                  <Text style={styles.paymentValue}>€{booking.amount_paid.toFixed(2)}</Text>
                </View>
              )}
            </View>
          </View>

          {booking.tc_accepted_at && (
            <View style={styles.columnRight}>
              <View style={styles.paymentCard}>
                <Text style={styles.paymentHeader}>T&C Acceptance</Text>
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Accepted At</Text>
                  <Text style={styles.paymentValue}>{format(new Date(booking.tc_accepted_at), 'dd/MM/yy HH:mm')}</Text>
                </View>
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Client IP</Text>
                  <Text style={styles.paymentValue}>{booking.tc_accepted_ip || 'N/A'}</Text>
                </View>
                {booking.tc_version_id && (
                  <View style={styles.paymentRow}>
                    <Text style={styles.paymentLabel}>Version</Text>
                    <Text style={styles.paymentValue}>{booking.tc_version_id.substring(0, 8)}...</Text>
                  </View>
                )}
                {booking.tc_signature_data && (
                  <View style={{ marginTop: 8, padding: 6, backgroundColor: '#f0fdf4', borderRadius: 4, border: '1 solid #10b981' }}>
                    <Text style={[styles.paymentLabel, { marginBottom: 4, textAlign: 'center', fontSize: 7 }]}>Digital Signature:</Text>
                    <Image 
                      src={booking.tc_signature_data} 
                      style={{ width: 180, height: 70, objectFit: 'contain', alignSelf: 'center' }}
                    />
                    <Text style={{ fontSize: 6, color: '#6b7280', textAlign: 'center', marginTop: 4 }}>
                      Signed by: {booking.client_name}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>

        <Text style={styles.footer}>
          Confidential - For Internal Use Only
        </Text>
      </Page>
    </Document>
  );
};