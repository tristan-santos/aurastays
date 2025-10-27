# EmailJS Configuration Guide

## Overview

This project uses multiple EmailJS configurations to handle different types of emails for guests and hosts.

## Environment Variables

All EmailJS credentials are stored in the `.env` file (not committed to Git).

### Guest Configuration

Used for sending emails to guests (invoices, verification):

- `VITE_EMAILJS_GUEST_PUBLIC_KEY` - Guest public key: `nQD0ZU2iCXUeLVfl_`
- `VITE_EMAILJS_GUEST_SERVICE_ID` - Guest service: `service_4lomzam`
- `VITE_EMAILJS_GUEST_INVOICE_TEMPLATE_ID` - Invoice template: `template_oisprxq`

### Host Configuration

Used for sending emails to hosts (booking confirmations, payouts):

- `VITE_EMAILJS_HOST_PUBLIC_KEY` - Host public key: `a4lWJRKQBrMrfk4Of`
- `VITE_EMAILJS_HOST_SERVICE_ID` - Host service: `service_6v439zx`
- `VITE_EMAILJS_HOST_BOOKING_TEMPLATE_ID` - Booking confirmation template (to be created)
- `VITE_EMAILJS_HOST_PAYOUT_TEMPLATE_ID` - Payout notification template (to be created)

### Verification Configuration

- `VITE_EMAILJS_VERIFICATION_TEMPLATE_ID` - Email verification: `template_lug7c18`

---

## Email Types

### 1. Guest Invoice Email

**When**: After successful payment/booking
**Template**: `template_oisprxq`
**Service**: `service_4lomzam` (Guest)
**File**: `src/pages/PropertyDetails.jsx`

**Template Variables**:

```javascript
{
  guestName: "John Doe",
  orderNumber: "ABC12345",
  propertyName: "Beachfront Villa",
  date: "Jan 10, 2024 to Jan 15, 2024",
  checkInDate: "2024-01-10",
  checkOutDate: "2024-01-15",
  numberOfNights: 5,
  numberOfGuests: 4,
  price: "25000.00",
  cleaningFee: "2000.00",
  serviceFee: "2700.00",
  guestFee: "400.00",
  total: "30100.00",
  email: "guest@example.com",
  paymentId: "PAYPAL-123456",
  paymentDate: "October 26, 2025",
  paymentMethod: "PayPal"
}
```

---

### 2. Verification Email

**When**: User signs up
**Template**: `template_lug7c18`
**Service**: `service_4lomzam` (Guest)
**File**: `src/utils/emailService.js`

**Template Variables**:

```javascript
{
  name: "John Doe",
  email: "user@example.com",
  verification_link: "https://...",
  from_name: "AuraStays",
  message: "Welcome to AuraStays! We're excited to have you join our community."
}
```

---

### 3. Host Booking Confirmation ✅ IMPLEMENTED

**When**: Guest completes a booking
**Template**: `VITE_EMAILJS_HOST_BOOKING_TEMPLATE_ID` (create in EmailJS)
**Service**: `service_6v439zx` (Host)
**Files**:

- `src/utils/hostEmailService.js` (email service)
- `src/pages/PropertyDetails.jsx` (calls the service)

**Template Variables**:

```javascript
{
  hostEmail: "host@example.com",        // Host's email address
  hostName: "Jane Host",                 // Host's name
  guestName: "John Guest",               // Guest's name
  propertyName: "Beachfront Villa",      // Property title
  checkInDate: "January 10, 2024",       // Formatted check-in date
  checkOutDate: "January 15, 2024",      // Formatted check-out date
  numberOfGuests: 4,                     // Number of guests
  numberOfNights: 5,                     // Number of nights
  totalAmount: "₱30,100",                // Total amount (formatted)
  bookingId: "ABC12345"                  // Booking ID (8 chars)
}
```

**EmailJS Template Example**:

```
Subject: New Booking Confirmation - {{propertyName}}

Dear {{hostName}},

Great news! You have a new booking for {{propertyName}}.

Booking Details:
- Guest: {{guestName}}
- Check-in: {{checkInDate}}
- Check-out: {{checkOutDate}}
- Nights: {{numberOfNights}}
- Guests: {{numberOfGuests}}
- Total Amount: ₱{{totalAmount}}
- Booking ID: {{bookingId}}
- Booking Date: {{bookingDate}}

Please prepare your property for the guest's arrival.

Best regards,
AuraStays Team
```

---

### 4. Host Payout Notification (To Be Created)

**When**: Admin approves payout
**Template**: Create `template_host_payout_here`
**Service**: `service_6v439zx` (Host)
**File**: `src/utils/hostEmailService.js`

**Template Variables** (suggested):

```javascript
{
  to_email: "host@example.com",
  hostName: "Jane Host",
  payoutAmount: "25000.00",
  payoutDate: "2025-10-30",
  payoutMethod: "PayPal",
  payoutId: "PO123456",
  processedDate: "October 26, 2025"
}
```

**EmailJS Template Example**:

```
Subject: Payout Processed - ₱{{payoutAmount}}

Dear {{hostName}},

Your payout has been processed successfully!

Payout Details:
- Amount: ₱{{payoutAmount}}
- Method: {{payoutMethod}}
- Payout Date: {{payoutDate}}
- Payout ID: {{payoutId}}
- Processed On: {{processedDate}}

The funds should arrive in your account within 3-5 business days.

Best regards,
AuraStays Team
```

---

## Usage Examples

### Sending Guest Invoice (Already Implemented)

```javascript
// In PropertyDetails.jsx after successful payment
const response = await emailjs.send(
	import.meta.env.VITE_EMAILJS_GUEST_SERVICE_ID,
	import.meta.env.VITE_EMAILJS_GUEST_INVOICE_TEMPLATE_ID,
	invoiceData
)
```

### Sending Host Booking Confirmation (To Be Implemented)

```javascript
import { sendHostBookingConfirmation } from "@/utils/hostEmailService"

// After guest completes booking
await sendHostBookingConfirmation({
	hostEmail: property.hostEmail,
	hostName: property.hostName,
	guestName: currentUser.displayName,
	propertyName: property.title,
	checkInDate: checkInDate,
	checkOutDate: checkOutDate,
	numberOfGuests: numberOfGuests,
	numberOfNights: calculateNights(),
	totalAmount: prices.total,
	bookingId: bookingId,
})
```

### Sending Host Payout Notification (To Be Implemented)

```javascript
import { sendHostPayoutNotification } from "@/utils/hostEmailService"

// In AdminDashboard.jsx when approving payout
await sendHostPayoutNotification({
	hostEmail: payout.hostEmail,
	hostName: payout.hostName,
	payoutAmount: payout.amount,
	payoutDate: new Date().toISOString().split("T")[0],
	payoutMethod: "PayPal",
	payoutId: payout.id,
})
```

---

## File Structure

```
src/
├── pages/
│   └── PropertyDetails.jsx      # Guest invoice emails
├── utils/
│   ├── emailService.js          # Guest verification emails
│   └── hostEmailService.js      # Host emails (NEW)
└── .env                         # Email credentials (not in Git)
```

---

## Setup Instructions

### 1. Restart Development Server

After updating `.env` file:

```bash
npm run dev
```

### 2. Create Missing Templates in EmailJS

Go to https://dashboard.emailjs.com/admin/templates

**For Host Booking Confirmation:**

1. Click "Create New Template"
2. Set Template ID: `template_host_booking` (or your choice)
3. Add the template content (see example above)
4. Set "To Email": `{{to_email}}`
5. Update `.env`: `VITE_EMAILJS_HOST_BOOKING_TEMPLATE_ID=your_template_id`

**For Host Payout Notification:**

1. Click "Create New Template"
2. Set Template ID: `template_host_payout` (or your choice)
3. Add the template content (see example above)
4. Set "To Email": `{{to_email}}`
5. Update `.env`: `VITE_EMAILJS_HOST_PAYOUT_TEMPLATE_ID=your_template_id`

### 3. Update Environment Variables

After creating templates, update your `.env` file with the actual template IDs.

---

## Testing

### Test Guest Invoice

1. Go to a property
2. Complete a booking with PayPal
3. Check guest's email for invoice

### Test Host Booking Confirmation

```javascript
// In browser console (after creating template)
import { sendHostBookingConfirmation } from "./utils/hostEmailService"
await sendHostBookingConfirmation({
	hostEmail: "your-test-email@gmail.com",
	hostName: "Test Host",
	guestName: "Test Guest",
	propertyName: "Test Property",
	checkInDate: "2025-11-01",
	checkOutDate: "2025-11-05",
	numberOfGuests: 2,
	numberOfNights: 4,
	totalAmount: "10000",
	bookingId: "TEST123",
})
```

---

## Security Notes

✅ **DO:**

- Keep `.env` file out of Git (already in `.gitignore`)
- Use `.env.example` as a template for team members
- Rotate credentials if exposed

❌ **DON'T:**

- Commit `.env` to Git
- Share credentials in Slack/Discord
- Hardcode credentials in source files

---

## Troubleshooting

### Email Not Sending

1. Check browser console for errors
2. Verify service ID and template ID are correct
3. Ensure public key matches the service
4. Check EmailJS dashboard for quota limits
5. Verify `.env` variables are loading (restart dev server)

### Wrong Template Used

- Check that correct service ID matches the public key
- Guest emails use `service_4lomzam`
- Host emails use `service_6v439zx`

### 404 Account Not Found

- Public key is incorrect
- Verify in EmailJS dashboard: Account → Public Key

---

## Setup Instructions for Host Booking Confirmation

### Step 1: Create EmailJS Template

1. Go to [EmailJS Dashboard](https://dashboard.emailjs.com/)
2. Navigate to **Email Templates**
3. Click **Create New Template**
4. Use the template example from section 3 above
5. Save the template and copy the **Template ID**

### Step 2: Update .env File

Add the template ID to your `.env` file:

```env
VITE_EMAILJS_HOST_BOOKING_TEMPLATE_ID=your_template_id_here
```

### Step 3: Restart Development Server

After updating `.env`, restart your Vite dev server:

```bash
npm run dev
```

### Step 4: Reconnect Gmail (if needed)

If you get "Invalid grant" errors:

1. Go to EmailJS → **Email Services**
2. Click on your Host service (`service_6v439zx`)
3. Click **Reconnect** and authorize Gmail again

---

## Future Enhancements

- [x] ✅ Create host booking confirmation template (IMPLEMENTED)
- [ ] Create host payout notification template
- [ ] Add email retry logic
- [ ] Implement email queue for high volume
- [ ] Add email analytics/tracking
- [ ] Create admin notification emails
- [ ] Add booking reminder emails
- [ ] Add review request emails
