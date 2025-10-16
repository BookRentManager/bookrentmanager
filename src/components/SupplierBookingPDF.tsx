import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { format } from 'date-fns';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  logo: {
    width: 80,
    height: 80,
    objectFit: 'contain',
  },
  companyInfo: {
    fontSize: 9,
    color: '#666',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 20,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000',
    backgroundColor: '#f0f0f0',
    padding: 5,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  label: {
    width: '40%',
    fontWeight: 'bold',
    color: '#333',
  },
  value: {
    width: '60%',
    color: '#000',
  },
  footer: {
    marginTop: 30,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
    fontSize: 8,
    color: '#666',
    textAlign: 'center',
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
  const additionalServices = (booking.additional_services as Array<{name: string, price: number}>) || [];
  
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            {appSettings?.logo_url && (
              <Image src={appSettings.logo_url} style={styles.logo} />
            )}
            {appSettings && (
              <View style={styles.companyInfo}>
                <Text>{appSettings.company_name}</Text>
                {appSettings.company_address && <Text>{appSettings.company_address}</Text>}
                {appSettings.company_email && <Text>{appSettings.company_email}</Text>}
                {appSettings.company_phone && <Text>{appSettings.company_phone}</Text>}
              </View>
            )}
          </View>
          <View>
            <Text style={styles.title}>Supplier Booking Form</Text>
            <Text style={styles.subtitle}>Ref: {booking.reference_code}</Text>
          </View>
        </View>

        {/* Booking Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Booking Information</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Reference Code:</Text>
            <Text style={styles.value}>{booking.reference_code}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Status:</Text>
            <Text style={styles.value}>{booking.status}</Text>
          </View>
          {booking.booking_date && (
            <View style={styles.row}>
              <Text style={styles.label}>Booking Date:</Text>
              <Text style={styles.value}>{format(new Date(booking.booking_date), 'dd/MM/yyyy')}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Delivery:</Text>
            <Text style={styles.value}>{format(new Date(booking.delivery_datetime), 'dd/MM/yyyy HH:mm')}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Collection:</Text>
            <Text style={styles.value}>{format(new Date(booking.collection_datetime), 'dd/MM/yyyy HH:mm')}</Text>
          </View>
        </View>

        {/* Vehicle Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle Information</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Model:</Text>
            <Text style={styles.value}>{booking.car_model}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Plate:</Text>
            <Text style={styles.value}>{booking.car_plate}</Text>
          </View>
          {booking.km_included && (
            <View style={styles.row}>
              <Text style={styles.label}>KM Included:</Text>
              <Text style={styles.value}>{booking.km_included} km</Text>
            </View>
          )}
          {booking.extra_km_cost && (
            <View style={styles.row}>
              <Text style={styles.label}>Extra KM Cost:</Text>
              <Text style={styles.value}>€{Number(booking.extra_km_cost).toFixed(2)}/km</Text>
            </View>
          )}
        </View>

        {/* Additional Services */}
        {additionalServices.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Services</Text>
            {additionalServices.map((service, index) => (
              <View key={index} style={styles.row}>
                <Text style={styles.label}>{service.name}:</Text>
                <Text style={styles.value}>€{Number(service.price).toFixed(2)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Delivery Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Location:</Text>
            <Text style={styles.value}>{booking.delivery_location}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Date & Time:</Text>
            <Text style={styles.value}>{format(new Date(booking.delivery_datetime), 'dd/MM/yyyy HH:mm')}</Text>
          </View>
          {booking.delivery_info && (
            <View style={styles.row}>
              <Text style={styles.label}>Notes:</Text>
              <Text style={styles.value}>{booking.delivery_info}</Text>
            </View>
          )}
        </View>

        {/* Collection Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Collection</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Location:</Text>
            <Text style={styles.value}>{booking.collection_location}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Date & Time:</Text>
            <Text style={styles.value}>{format(new Date(booking.collection_datetime), 'dd/MM/yyyy HH:mm')}</Text>
          </View>
          {booking.collection_info && (
            <View style={styles.row}>
              <Text style={styles.label}>Notes:</Text>
              <Text style={styles.value}>{booking.collection_info}</Text>
            </View>
          )}
        </View>

        {/* Payment Information - ONLY SUPPLIER PRICE */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Information</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Supplier Price:</Text>
            <Text style={styles.value}>€{Number(booking.supplier_price).toFixed(2)}</Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          This document is for supplier use only.
        </Text>
      </Page>
    </Document>
  );
};
