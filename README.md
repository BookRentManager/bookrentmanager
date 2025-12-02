# BookRentManager - Luxury Car Rental Management System

A professional back-office web application for managing luxury car rentals, fines, supplier invoices, and financial reporting.

## Features

✅ **Complete Authentication System**
- Email/password authentication with auto-confirmed signups
- Role-based access control (admin, staff, read-only)
- Secure session management

✅ **Booking Management**
- Comprehensive booking tracking with client details
- Vehicle information and delivery/collection management
- Real-time financial calculations
- Payment tracking (deposit, balance, full)
- Status management (confirmed, to_be_confirmed, cancelled)

✅ **Financial Tracking**
- Automated commission calculations
- Revenue and expense tracking
- Financial status indicators (profit, breakeven, loss)
- Multi-currency support (EUR default)

✅ **Fines Module**
- Traffic fine tracking and management
- Link fines to bookings or vehicles
- Payment status monitoring
- Unpaid fines dashboard alerts

✅ **Supplier Invoices**
- Invoice management with payment tracking
- Upload capability for invoices and payment proofs
- Pending invoice monitoring
- Supplier relationship tracking

✅ **Dashboard & Reports**
- Real-time KPI metrics
- Revenue and commission analytics
- Pending items tracking
- Quick actions and shortcuts

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Tailwind CSS + shadcn/ui components
- **State Management**: React Query + Zustand
- **Forms & Validation**: React Hook Form + Zod
- **Backend**: Lovable Cloud (Supabase)
- **Database**: PostgreSQL with Row Level Security
- **Authentication**: Supabase Auth

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Lovable Cloud (automatically provisioned)

### Installation

1. Clone the repository:
```bash
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:8080](http://localhost:8080)

## Test Credentials

The system comes with pre-seeded data and test accounts:

### Admin Account
- Email: `admin@kingrent.com`
- Password: `password123`
- Access: Full system access, all CRUD operations

### Staff Account
- Email: `staff@kingrent.com`
- Password: `password123`
- Access: Bookings, fines, invoices management, reports viewing

## Database Schema

### Core Tables

- **bookings**: Rental reservations with client, vehicle, and financial data
- **payments**: Customer payment records linked to bookings
- **fines**: Traffic fines associated with bookings or vehicles
- **supplier_invoices**: Supplier billing and payment tracking
- **expenses**: Additional costs per booking (transfer, fuel, cleaning, etc.)
- **user_roles**: Role-based access control
- **audit_logs**: Complete audit trail of all actions

### Calculated Views

- **booking_financials**: Real-time financial calculations including net commission, payment status, and profit/loss indicators

## Seed Data

The application includes 12 bookings across various Swiss cities with:
- 8 payments (mix of deposits, balances, and full payments)
- 6 fines (3 unpaid, 3 paid)
- 8 supplier invoices (5 to pay, 3 paid)
- 10 expenses across different categories

## Security

✅ Row Level Security (RLS) enabled on all tables  
✅ Secure authentication with email verification  
✅ Role-based permissions (admin, staff, read-only)  
✅ Input validation using Zod schemas  
✅ Audit logging for all critical operations  
✅ User roles stored separately (prevents privilege escalation)  

## Development

### Build for Production

```bash
npm run build
```

### Run Linter

```bash
npm run lint
```

### Type Checking

```bash
npm run typecheck
```

## Deployment

Deploy easily via Lovable:

1. Click the "Publish" button in the Lovable interface
2. Your app will be deployed with a lovable.app subdomain
3. Connect a custom domain in Project > Settings > Domains

## Future Enhancements (Phase 2)

- [ ] Magnolia integration via webhooks
- [ ] Document OCR for auto-filling fine/invoice data
- [ ] Email/Slack notifications and reminders
- [ ] Stripe payment integration for customer payments
- [ ] Deposit guarantee module
- [ ] Damage tracking with photo uploads
- [ ] Advanced reporting and CSV exports
- [ ] Multi-language support (i18n)

## Project Structure

```
src/
├── components/
│   ├── layout/          # AppLayout, AppSidebar
│   └── ui/              # shadcn/ui components
├── lib/
│   ├── auth.tsx         # Authentication context & hooks
│   └── utils.ts         # Utility functions
├── pages/
│   ├── Auth.tsx         # Login/signup page
│   ├── Dashboard.tsx    # Main dashboard
│   ├── Bookings.tsx     # Bookings management
│   ├── Fines.tsx        # Fines tracking
│   ├── Invoices.tsx     # Supplier invoices
│   ├── Reports.tsx      # Financial reports
│   └── Settings.tsx     # App settings
└── integrations/
    └── supabase/        # Auto-generated Supabase client
```

## Support

For issues or questions:
- Visit [Lovable Docs](https://docs.lovable.dev/)
- Join [Lovable Discord](https://discord.com/channels/1119885301872070706)

## License

Private project - All rights reserved

---

**Built with ❤️ using [Lovable](https://lovable.dev)**
