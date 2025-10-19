import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { format } from 'date-fns';

const styles = StyleSheet.create({
  page: {
    padding: 16,
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#1a1a1a',
  },
  header: {
    marginBottom: 6,
    borderBottomWidth: 1.5,
    borderBottomColor: '#2c3e50',
    paddingBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
  },
  badgeColumn: {
    alignItems: 'flex-end',
    maxWidth: '50%',
  },
  logo: {
    width: 140,
    height: 60,
    objectFit: 'contain',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 6,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 4,
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
    fontSize: 9.5,
    textAlign: 'center',
    color: '#666666',
    marginBottom: 8,
  },
  companyInfo: {
    textAlign: 'right',
    fontSize: 7.5,
    color: '#666666',
    lineHeight: 1.3,
    marginTop: 5,
  },
  badge: {
    backgroundColor: '#c9a85f',
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
    marginBottom: 4,
    gap: 8,
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
    padding: 4,
    backgroundColor: '#ffffff',
  },
  sectionHeader: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 2,
    color: '#2c3e50',
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 2,
    paddingBottom: 2,
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
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
    paddingBottom: 1,
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
    padding: 4,
    marginTop: 0,
  },
  paymentHeader: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    color: '#2c3e50',
    textAlign: 'center',
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
    paddingBottom: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0e0e0',
  },
  paymentLabel: {
    fontSize: 8.5,
    color: '#666666',
  },
  paymentValue: {
    fontSize: 8.5,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
    paddingTop: 5,
    borderTopWidth: 2,
    borderTopColor: '#2c3e50',
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#2c3e50',
    textTransform: 'uppercase',
  },
  totalValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  footer: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 4,
    textAlign: 'center',
    fontSize: 7.5,
    color: '#999999',
    fontStyle: 'italic',
  },
  companyInfoLine: {
    textAlign: 'right',
    fontSize: 7.5,
    color: '#666666',
    lineHeight: 1.2,
    marginTop: 1,
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
          {/* Centered Logo */}
          {appSettings?.logo_url && (
            <View style={styles.logoContainer}>
              <Image src={appSettings.logo_url} style={styles.logo} />
            </View>
          )}
          
          {/* Centered Title & Reference */}
          <View style={styles.titleContainer}>
            <Text style={styles.documentTitle}>BOOKING CONFIRMATION</Text>
            <Text style={styles.referenceCode}>Reference: {booking.reference_code}</Text>
          </View>
          
      {/* Right-aligned Badge & Company Info */}
      <View style={styles.badgeRow}>
        <View style={styles.badgeColumn}>
          <Text style={styles.badge}>CLIENT COPY</Text>
          {appSettings && (
            <View style={{ marginTop: 3 }}>
              {/* Company Name + Street */}
              <Text style={styles.companyInfoLine}>
                {appSettings.company_name}
                {appSettings.company_address && 
                  `, ${appSettings.company_address.split(',')[0]}`}
              </Text>
              
              {/* City/Postal Code */}
              {appSettings.company_address?.split(',')[1] && (
                <Text style={styles.companyInfoLine}>
                  {appSettings.company_address.split(',')[1].trim()}
                </Text>
              )}
              
              {/* Country */}
              {appSettings.company_address?.split(',')[2] && (
                <Text style={styles.companyInfoLine}>
                  {appSettings.company_address.split(',')[2].trim()}
                </Text>
              )}
              
              {/* VAT Number */}
              <Text style={styles.companyInfoLine}>CHE 273.528.456 IVA</Text>
            </View>
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
                <Text style={styles.fieldLabel}>Delivery</Text>
                <Text style={styles.fieldValue}>
                  {format(new Date(booking.delivery_datetime), 'dd/MM/yyyy HH:mm')}
                </Text>
              </View>
              <View style={[styles.fieldRow, { borderBottomWidth: 0 }]}>
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
              {booking.company_name && (
                <View style={[styles.fieldRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.fieldLabel}>Company</Text>
                  <Text style={styles.fieldValue}>{booking.company_name}</Text>
                </View>
              )}
              {!booking.company_name && booking.client_phone && (
                <View style={[styles.fieldRow, { borderBottomWidth: 0, marginBottom: 0 }]} />
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
                  <View style={[styles.fieldRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.fieldLabel}>Company</Text>
                    <Text style={styles.fieldValue}>{booking.guest_company_name}</Text>
                  </View>
                )}
                {!booking.guest_company_name && booking.guest_phone && (
                  <View style={[styles.fieldRow, { borderBottomWidth: 0, marginBottom: 0 }]} />
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
                  <View style={[styles.fieldRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.fieldLabel}>Country</Text>
                    <Text style={styles.fieldValue}>{booking.guest_country}</Text>
                  </View>
                )}
                {!booking.guest_country && booking.guest_billing_address && (
                  <View style={[styles.fieldRow, { borderBottomWidth: 0, marginBottom: 0 }]} />
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
              {booking.security_deposit_amount && (
                <>
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Security Deposit</Text>
                    <Text style={styles.fieldValue}>€{booking.security_deposit_amount.toFixed(2)}</Text>
                  </View>
                  <View style={{ marginTop: 3, padding: 4, backgroundColor: '#f0f9ff', borderRadius: 3, borderWidth: 0.5, borderColor: '#3b82f6' }}>
                    <Text style={{ fontSize: 7, color: '#1e40af', lineHeight: 1.3, textAlign: 'justify' }}>
                      The security deposit is pre-authorized on your credit card and will be released at the end of the rental period unless there are additional charges such as extra kilometers, fuel balance, traffic fines, or self-damages below the covered excess amount.
                    </Text>
                  </View>
                </>
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
                <View style={[styles.fieldRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.fieldLabel}>Notes</Text>
                  <Text style={styles.fieldValue}>{booking.delivery_info}</Text>
                </View>
              )}
              {!booking.delivery_info && (
                <View style={[styles.fieldRow, { borderBottomWidth: 0, marginBottom: 0 }]} />
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
                <View style={[styles.fieldRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.fieldLabel}>Notes</Text>
                  <Text style={styles.fieldValue}>{booking.collection_info}</Text>
                </View>
              )}
              {!booking.collection_info && (
                <View style={[styles.fieldRow, { borderBottomWidth: 0, marginBottom: 0 }]} />
              )}
            </View>
          </View>
        </View>

        <View style={styles.twoColumnRow}>
          <View style={styles.columnLeft}>
            <View style={styles.paymentCard}>
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
                {booking.tc_signature_data && (
                  <View style={{ marginTop: 8, padding: 6, backgroundColor: '#f0fdf4', borderRadius: 4, border: '1 solid #10b981' }}>
                    <Text style={[styles.paymentLabel, { marginBottom: 4, textAlign: 'center', fontSize: 7 }]}>Digital Signature:</Text>
                    <Image 
                      src={booking.tc_signature_data} 
                      style={{ width: 180, height: 70, objectFit: 'contain', marginTop: 6, alignSelf: 'center' }}
                    />
                  </View>
                )}
              </View>
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