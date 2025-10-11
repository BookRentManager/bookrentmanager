# Magnolia CMS Webhook Integration Instructions

## Overview
This document provides the technical specifications for integrating Magnolia CMS with the Webapp's booking system via webhook.

---

## 1. Webhook Endpoint

**Method:** `POST`  
**URL:** `https://lbvaghmqwhsawvxyiemw.supabase.co/functions/v1/magnolia-webhook`

---

## 2. Required Headers

| Header Name | Value | Description |
|------------|-------|-------------|
| `Content-Type` | `application/json` | Payload format |
| `x-webhook-secret` | `[SECRET_KEY]` | Authentication token (to be provided separately via secure channel) |

**Important:** The `x-webhook-secret` value will be provided to you separately via a secure communication channel. This value must be included in every webhook request for authentication.

---

## 3. Payload Structure

### Required Fields

The webhook must send a JSON object with the following **required** fields:

| Field Name | Type | Description | Example |
|-----------|------|-------------|---------|
| `booking_id` | string | Unique booking reference code | `"KR-20251012-001"` |
| `client_name` | string | Full name of the client | `"John Smith"` |
| `car_model` | string | Vehicle model | `"Urus"` |
| `pickup_location` | string | Pickup/delivery location | `"Zurich, Switzerland"` |
| `delivery_location` | string | Return/collection location | `"Milan, Italy"` |
| `pickup_date` | string (ISO 8601) | Pickup date and time | `"2025-10-12T10:00:00Z"` |
| `return_date` | string (ISO 8601) | Return date and time | `"2025-10-14T18:00:00Z"` |
| `price_total` | string | Total rental price (numeric) | `"5400"` |

### Optional Fields

| Field Name | Type | Description | Example |
|-----------|------|-------------|---------|
| `email` | string | Client email address | `"john.smith@email.com"` |
| `phone` | string | Client phone number | `"+41 79 123 4567"` |
| `car_brand` | string | Vehicle brand/manufacturer | `"Lamborghini"` |
| `car_plate` | string | Vehicle license plate | `"ZH-12345"` |
| `flight_number` | string | Client's flight number | `"LX1635"` |
| `special_requests` | string | Additional client requests | `"Need baby seat"` |
| `currency` | string | Currency code (ISO 4217) | `"EUR"` (default: `"EUR"`) |
| `supplier_price` | string | Cost from supplier (numeric) | `"4000"` |
| `vat_rate` | string | VAT/tax rate percentage | `"8.1"` |
| `security_deposit` | string | Security deposit amount | `"2000"` |
| `km_included` | string | Included kilometers | `"500"` |
| `extra_km_cost` | string | Cost per extra kilometer | `"0.50"` |
| `created_at` | string (ISO 8601) | Form submission timestamp | `"2025-10-11T09:45:00Z"` |
| `form_source` | string | Source identifier | `"Magnolia Booking Form"` |

### Example Payload (Simple Format)

```json
{
  "booking_id": "KR-20251012-001",
  "client_name": "John Smith",
  "email": "john.smith@email.com",
  "phone": "+41 79 123 4567",
  "car_brand": "Lamborghini",
  "car_model": "Urus",
  "car_plate": "ZH-12345",
  "pickup_location": "Zurich, Switzerland",
  "delivery_location": "Milan, Italy",
  "pickup_date": "2025-10-12T10:00:00Z",
  "return_date": "2025-10-14T18:00:00Z",
  "flight_number": "LX1635",
  "special_requests": "Need baby seat and extra luggage space",
  "price_total": "5400",
  "currency": "EUR",
  "supplier_price": "4000",
  "vat_rate": "8.1",
  "security_deposit": "2000",
  "km_included": "500",
  "extra_km_cost": "0.50",
  "created_at": "2025-10-11T09:45:00Z",
  "form_source": "Magnolia Booking Form"
}
```

### Alternative Payload Format (With Metadata Wrapper)

For enhanced traceability and duplicate prevention, you may optionally wrap the booking data:

```json
{
  "webhook_id": "MG-20251011-ABC123",
  "timestamp": "2025-10-11T10:00:00Z",
  "data": {
    "booking_id": "KR-20251012-001",
    "client_name": "John Smith",
    "email": "john.smith@email.com",
    ...
  }
}
```

---

## 4. Authentication & Security

### Webhook Secret Verification

- Every request **must** include the `x-webhook-secret` header
- The secret value will be provided separately via secure communication
- Requests with missing or incorrect secrets will receive a `401 Unauthorized` response
- **Keep the secret secure** and do not expose it in client-side code or logs

### Duplicate Prevention

- The webhook endpoint checks for existing bookings with the same `booking_id`
- If a booking already exists, the endpoint returns a `200 OK` response with the existing booking details
- No duplicate bookings will be created

---

## 5. Expected Responses

### Success Response (200 OK)

When a booking is successfully created:

```json
{
  "message": "Webhook received successfully",
  "booking_id": "uuid-generated-by-system",
  "reference_code": "KR-20251012-001"
}
```

### Duplicate Booking (200 OK)

When a booking with the same reference code already exists:

```json
{
  "message": "Booking already exists",
  "booking_id": "uuid-of-existing-booking",
  "reference_code": "KR-20251012-001"
}
```

### Authentication Error (401 Unauthorized)

```json
{
  "error": "Unauthorized - Invalid webhook secret"
}
```

### Validation Error (400 Bad Request)

When required fields are missing:

```json
{
  "error": "Missing required fields",
  "missing": ["client_name", "car_model"]
}
```

When JSON payload is malformed:

```json
{
  "error": "Invalid JSON payload"
}
```

### Server Error (500 Internal Server Error)

```json
{
  "error": "Internal server error",
  "details": "Error description"
}
```

---

## 6. Trigger Event

The webhook should be triggered automatically when:
- A booking form is submitted by a customer
- A booking is confirmed/approved in the Magnolia CMS

**Important:** Each booking should trigger the webhook **only once** to avoid duplicates.

---

## 7. Date/Time Format Requirements

All date and time fields must use **ISO 8601 format with timezone**:
- Format: `YYYY-MM-DDTHH:mm:ssZ`
- Example: `2025-10-12T10:00:00Z`
- Timezone: UTC is recommended (indicated by `Z` suffix)
- Alternative: Include timezone offset (e.g., `2025-10-12T10:00:00+02:00`)

---

## 8. Testing the Webhook

### Test Request Example (cURL)

```bash
curl -X POST https://lbvaghmqwhsawvxyiemw.supabase.co/functions/v1/magnolia-webhook \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_SECRET_KEY" \
  -d '{
    "booking_id": "TEST-001",
    "client_name": "Test User",
    "car_model": "Test Vehicle",
    "pickup_location": "Test Location A",
    "delivery_location": "Test Location B",
    "pickup_date": "2025-12-01T10:00:00Z",
    "return_date": "2025-12-03T10:00:00Z",
    "price_total": "1000"
  }'
```

### Expected Test Response

```json
{
  "message": "Webhook received successfully",
  "booking_id": "generated-uuid",
  "reference_code": "TEST-001"
}
```

---

## 9. Error Handling & Retry Logic

### Recommended Retry Strategy

If the webhook call fails (network error, timeout, 5xx response):
1. **Retry** up to 3 times with exponential backoff
2. Backoff intervals: 5s, 30s, 5min
3. Log all failures for manual review

### Timeout Configuration

- Recommended timeout: **30 seconds**
- The webhook typically responds within 1-2 seconds

---

## 10. Support & Contact

For technical questions or issues with the webhook integration, please contact:
- **Technical Support:** [Your support email/contact]
- **Webhook Secret Request:** Contact your technical point of contact

---

## 11. Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-10-11 | Initial webhook specification |

---

**End of Document**

*Prepared for Magnolia CMS integration with Webapp — Real-time booking data transfer*
