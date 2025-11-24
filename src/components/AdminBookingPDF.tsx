import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { calculateRentalDays } from '@/lib/utils';

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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerCenter: {
    width: '65%',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  headerRight: {
    width: '35%',
    alignItems: 'flex-end',
  },
  logo: {
    width: 100,
    height: 50,
    objectFit: 'contain',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 0,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 3,
    color: '#2c3e50',
    letterSpacing: 0.5,
  },
  referenceCode: {
    fontSize: 8.5,
    textAlign: 'center',
    color: '#666666',
    marginBottom: 0,
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
    padding: 6,
    marginTop: 0,
  },
  paymentHeader: {
    fontSize: 10,
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
    fontSize: 8.5,
    color: '#666666',
  },
  paymentValue: {
    fontSize: 8.5,
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
    textAlign: 'left',
    fontSize: 8,
    color: '#666666',
    lineHeight: 1.2,
    marginTop: 1,
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
  creatorProfile?: {
    display_name: string | null;
    email: string;
  } | null;
}

export const AdminBookingPDF = ({ booking, appSettings, creatorProfile }: AdminBookingPDFProps) => {
  const additionalServices = (booking.additional_services as Array<{ name: string; price: number }>) || [];
  
  // Calculate rental days
  const rentalCalculation = calculateRentalDays(
    new Date(booking.delivery_datetime),
    new Date(booking.collection_datetime),
    booking.rental_day_hour_tolerance || 1
  );
  
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {/* Center: Logo, Title & Reference */}
          <View style={styles.headerCenter}>
            <View style={styles.logoContainer}>
              <Image 
                src="https://lbvaghmqwhsawvxyiemw.supabase.co/storage/v1/object/public/company-logos/logo-1761150745897.jpg" 
                style={styles.logo} 
              />
            </View>
            <Text style={styles.documentTitle}>BOOKING DETAILS</Text>
            <Text style={styles.referenceCode}>Reference: {booking.reference_code}</Text>
            {creatorProfile && (
              <Text style={[styles.referenceCode, { marginTop: 2, fontSize: 7, color: '#999' }]}>
                Reservation Manager: {creatorProfile.display_name || creatorProfile.email}
              </Text>
            )}
          </View>
          
          {/* Right: Badge & Company Info */}
          <View style={styles.headerRight}>
            <Text style={styles.badge}>ADMIN COPY - CONFIDENTIAL</Text>
            {appSettings && (
              <View style={{ marginTop: 3 }}>
                <Text style={styles.companyInfoLine}>
                  {appSettings.company_name}
                  {appSettings.company_address && 
                    `, ${appSettings.company_address.split(',')[0]}`}
                </Text>
                {appSettings.company_address?.split(',')[1] && (
                  <Text style={styles.companyInfoLine}>
                    {appSettings.company_address.split(',')[1].trim()}
                  </Text>
                )}
                {appSettings.company_address?.split(',')[2] && (
                  <Text style={styles.companyInfoLine}>
                    {appSettings.company_address.split(',')[2].trim()}
                  </Text>
                )}
                <Text style={styles.companyInfoLine}>CHE 273.528.456 IVA</Text>
              </View>
            )}
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
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Collection</Text>
                <Text style={styles.fieldValue}>
                  {format(new Date(booking.collection_datetime), 'dd/MM/yyyy HH:mm')}
                </Text>
              </View>
              <View style={[styles.fieldRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.fieldLabel}>Rental Duration</Text>
                <Text style={styles.fieldValue}>
                  {rentalCalculation.formattedTotal} ({rentalCalculation.formattedDuration})
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
                <View style={[styles.fieldRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.fieldLabel}>Billing Address</Text>
                  <Text style={styles.fieldValue}>{booking.billing_address}</Text>
                </View>
              )}
              {!booking.billing_address && booking.client_phone && (
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

        <View style={additionalServices.length > 0 ? styles.twoColumnRow : { marginBottom: 8 }}>
          {additionalServices.length > 0 ? (
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
                  <View style={[styles.fieldRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.fieldLabel}>Security Deposit</Text>
                    <Text style={styles.fieldValue}>€{booking.security_deposit_amount.toFixed(2)}</Text>
                  </View>
                )}
                {!booking.security_deposit_amount && booking.extra_km_cost && (
                  <View style={[styles.fieldRow, { borderBottomWidth: 0, marginBottom: 0 }]} />
                )}
              </View>
            </View>
          ) : (
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
                <View style={[styles.fieldRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.fieldLabel}>Security Deposit</Text>
                  <Text style={styles.fieldValue}>€{booking.security_deposit_amount.toFixed(2)}</Text>
                </View>
              )}
              {!booking.security_deposit_amount && booking.extra_km_cost && (
                <View style={[styles.fieldRow, { borderBottomWidth: 0, marginBottom: 0 }]} />
              )}
            </View>
          )}

          {additionalServices.length > 0 && (
            <View style={styles.columnRight}>
              <View style={styles.sectionCard}>
                <Text style={styles.sectionHeader}>Additional Services</Text>
                {additionalServices.map((service, index) => (
                  <View 
                    key={index} 
                    style={[
                      styles.serviceRow,
                      index === additionalServices.length - 1 && { borderBottomWidth: 0 }
                    ]}
                  >
                    <Text style={styles.serviceName}>{service.name}</Text>
                    <Text style={styles.servicePrice}>€{service.price.toFixed(2)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
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
              
              <View style={[styles.paymentRow, { backgroundColor: '#fff8e6', paddingHorizontal: 3, paddingVertical: 1 }]}>
                <Text style={styles.paymentLabel}>Supplier Price</Text>
                <Text style={styles.paymentValue}>€{booking.supplier_price?.toFixed(2) || '0.00'}</Text>
              </View>
              
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Base Commission</Text>
                <Text style={styles.paymentValue}>
                  €{((booking.rental_price_gross || 0) - (booking.supplier_price || 0)).toFixed(2)}
                </Text>
              </View>
              
              
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