# E-Wallet and Bookings System Guide

## Overview

This document describes the comprehensive E-Wallet and Bookings management system implemented in AuraStays.

---

## Features Implemented

### ✅ 1. E-Wallet System

- **Wallet Balance Display**: Shows current wallet balance in the dashboard
- **PayPal Top-Up**: Users can recharge their wallet using PayPal (minimum ₱100)
- **Transaction History**: Complete log of all wallet transactions
- **Payment Method Selection**: Choose between PayPal or Wallet when booking

### ✅ 2. Bookings Management

- **Upcoming Trips**: View all future bookings with countdown
- **Previous Bookings**: Access history of past stays
- **Booking Details**: Complete information including dates, guests, nights, and total amount
- **Status Tracking**: Visual status badges (Pending, Confirmed, Cancelled, Completed)

### ✅ 3. Dual Payment System

- **PayPal Payment**: Full payment through PayPal (existing functionality)
- **Wallet Payment**: Pay directly from wallet balance with real-time validation
- **Insufficient Balance Detection**: Clear feedback when wallet balance is insufficient

---

## Components Created

### 1. `src/components/Wallet.jsx`

**Purpose**: Manages user's e-wallet functionality

**Features:**

- Display current wallet balance
- Top-up functionality with PayPal integration
- Transaction history viewer
- Wallet transaction recording

**Props**: None (uses AuthContext for current user)

**State:**

- `walletBalance`: Current wallet balance
- `showTopUpModal`: Top-up modal visibility
- `showTransactionsModal`: Transaction history modal visibility
- `topUpAmount`: Amount to top up
- `transactions`: List of wallet transactions
- `isProcessing`: Payment processing state
- `isPayPalLoaded`: PayPal SDK loading state

**Functions:**

- `fetchWalletBalance()`: Fetches user's current wallet balance from Firebase
- `topUpWallet(amount, paymentId)`: Processes wallet top-up and records transaction
- `fetchTransactions()`: Retrieves transaction history
- `handleViewTransactions()`: Opens transaction history modal

---

### 2. `src/components/Bookings.jsx`

**Purpose**: Displays user's bookings (upcoming and previous)

**Features:**

- Tabbed interface (Upcoming / Previous)
- Booking cards with complete details
- Days-until-checkin countdown
- Direct navigation to property details
- Empty states with call-to-action

**Props**: None (uses AuthContext for current user)

**State:**

- `upcomingTrips`: Array of future bookings
- `previousBookings`: Array of past bookings
- `activeTab`: Currently active tab ('upcoming' or 'previous')
- `isLoading`: Data loading state

**Functions:**

- `fetchBookings()`: Fetches all user bookings from Firebase
- `getStatusBadge(status)`: Returns styled status badge
- `formatDate(dateString)`: Formats dates for display
- `getDaysUntil(dateString)`: Calculates days until check-in
- `handleViewProperty(propertyId)`: Navigates to property details

---

## Modified Files

### 1. `src/pages/dashboardGuest.jsx`

**Changes:**

- Imported `Wallet` and `Bookings` components
- Added components to dashboard layout after promotional banner
- Updated `fetchUserStats()` to fetch wallet balance from `walletBalance` field

### 2. `src/pages/PropertyDetails.jsx`

**Changes:**

- Added payment method selection state (`paymentMethod`)
- Added wallet balance state (`walletBalance`)
- Added `fetchWalletBalance()` function
- Added `handleWalletPayment()` function for wallet payments
- Modified booking UI to include payment method selection
- Wallet payment validation and processing
- Real-time balance checking

**New States:**

```javascript
const [paymentMethod, setPaymentMethod] = useState("paypal") // 'paypal' or 'wallet'
const [walletBalance, setWalletBalance] = useState(0)
```

**New Functions:**

- `fetchWalletBalance()`: Fetches and sets user's wallet balance
- `handleWalletPayment()`: Processes payment using wallet balance with full validation

---

## CSS Files Created

### 1. `src/css/Wallet.css`

**Styles for:**

- Wallet widget with gradient background
- Top-up modal and form
- Quick amount buttons
- Transaction history modal
- Transaction item cards with icons
- Responsive design for mobile

**Key Classes:**

- `.wallet-widget`: Main wallet container
- `.wallet-balance`: Large balance display
- `.wallet-btn`: Action buttons (Top Up, History)
- `.payment-method-btn`: Payment method selection buttons
- `.transaction-item`: Individual transaction display
- `.txn-icon`: Transaction type icons with colors

### 2. `src/css/Bookings.css`

**Styles for:**

- Bookings container and tabs
- Booking cards grid
- Status badges (confirmed, pending, cancelled, completed)
- Days-until countdown badge
- Empty states
- Loading spinner

**Key Classes:**

- `.bookings-container`: Main bookings wrapper
- `.booking-card`: Individual booking display
- `.status-badge`: Status indicator with variants
- `.days-until`: Countdown badge
- `.info-item`: Booking detail items
- `.empty-state`: No bookings message

---

## Firebase Database Structure

### User Document (`users/{userId}`)

```javascript
{
  walletBalance: 0,  // Number - Current wallet balance in PHP
  // ... existing fields
}
```

### Wallet Transactions Collection (`walletTransactions`)

```javascript
{
  userId: "user123",              // User ID
  type: "top_up" | "payment" | "refund",  // Transaction type
  amount: 1000,                   // Amount in PHP
  paymentMethod: "paypal",        // Payment method used
  paymentId: "PAYPAL-123",        // Payment reference ID
  propertyTitle: "Villa Name",    // (for payments) Property name
  propertyId: "prop123",          // (for payments) Property ID
  balanceBefore: 5000,            // Balance before transaction
  balanceAfter: 6000,             // Balance after transaction
  status: "completed",            // Transaction status
  createdAt: timestamp           // Creation timestamp
}
```

### Bookings Collection (`bookings`)

```javascript
{
  propertyId: "prop123",
  propertyTitle: "Luxury Villa",
  hostId: "host123",
  guestId: "guest123",
  guestName: "John Doe",
  guestEmail: "john@example.com",
  checkInDate: "2025-01-15",
  checkOutDate: "2025-01-20",
  numberOfGuests: 4,
  numberOfNights: 5,
  pricing: {
    basePrice: 5000,
    subtotal: 25000,
    cleaningFee: 500,
    serviceFee: 800,
    guestFee: 400,
    total: 26700
  },
  payment: {
    method: "wallet" | "paypal",  // Payment method used
    paymentId: "WALLET-123",       // Payment reference
    fullPaymentPaid: true,
    paymentDate: "2025-01-10",
    paymentDetails: {},            // PayPal payment details (if PayPal)
    currency: "PHP",
    amountPaid: 26700
  },
  bookedDates: ["2025-01-15", "2025-01-16", ...],
  status: "pending" | "confirmed" | "completed" | "cancelled",
  createdAt: timestamp
}
```

---

## User Flow

### Top-Up Wallet Flow

1. User clicks "Top Up" in Wallet widget
2. Modal opens with amount input
3. User enters amount (min ₱100) or clicks quick amount button
4. PayPal button appears
5. User completes PayPal payment
6. Wallet balance updated in Firebase
7. Transaction recorded in `walletTransactions`
8. Success message shown
9. Modal closes

### Booking with Wallet Flow

1. User selects property and dates
2. User selects "E-Wallet" payment method
3. Wallet balance displayed with current amount
4. System validates sufficient balance
5. User clicks "Pay with E-Wallet"
6. Confirmation dialog appears
7. User confirms payment
8. Wallet balance deducted
9. Booking created with `method: "wallet"`
10. Transaction recorded in `walletTransactions`
11. Guest invoice email sent
12. Host confirmation email sent
13. Redirect to dashboard

### View Bookings Flow

1. User opens dashboard
2. Bookings component loads automatically
3. Fetches all user bookings
4. Separates into Upcoming and Previous
5. User switches tabs to view different bookings
6. User clicks "View Property" to see property details

---

## Payment Method Selection UI

```javascript
// Payment Method Selection
<div className="payment-method-selection">
	<label>Choose Payment Method:</label>
	<div className="payment-methods">
		<button
			className={`payment-method-btn ${
				paymentMethod === "paypal" ? "active" : ""
			}`}
		>
			💳 PayPal
		</button>
		<button
			className={`payment-method-btn ${
				paymentMethod === "wallet" ? "active" : ""
			}`}
		>
			💰 E-Wallet
			<span className="wallet-balance-hint">
				₱{walletBalance.toLocaleString()}
			</span>
		</button>
	</div>
</div>
```

---

## Validation and Error Handling

### Wallet Payment Validations:

1. ✅ User is logged in
2. ✅ Check-in and check-out dates selected
3. ✅ Check-out date is after check-in date
4. ✅ Number of guests doesn't exceed property capacity
5. ✅ Selected dates are available (not already booked)
6. ✅ Wallet balance is sufficient for total amount
7. ✅ User confirms payment

### Error Messages:

- "Please login to make a booking"
- "Please select check-in and check-out dates"
- "Check-out date must be after check-in date"
- "This property can accommodate a maximum of X guests"
- "Selected dates are not available"
- "Insufficient wallet balance. You need ₱X but have ₱Y"
- "Payment failed. Please try again."

---

## Transaction Types

### 1. Top-Up

```javascript
{
  type: "top_up",
  amount: 1000,
  paymentMethod: "paypal",
  paymentId: "PAYPAL-123456"
}
```

### 2. Payment

```javascript
{
  type: "payment",
  amount: 26700,
  propertyTitle: "Luxury Villa",
  propertyId: "prop123"
}
```

### 3. Refund (Future Implementation)

```javascript
{
  type: "refund",
  amount: 26700,
  propertyTitle: "Luxury Villa",
  propertyId: "prop123"
}
```

---

## Responsive Design

### Wallet Component

- **Desktop**: Full-width gradient card with inline buttons
- **Tablet**: Stacked buttons, maintained gradient
- **Mobile**: Full-width buttons, vertical layout

### Bookings Component

- **Desktop**: 3-column grid of booking cards
- **Tablet**: 2-column grid
- **Mobile**: Single column, stacked layout

### Payment Method Selection

- **All Devices**: 2-column grid for payment methods
- **Mobile**: Slightly reduced padding and font sizes

---

## Environment Variables Required

No new environment variables required. Uses existing:

- `VITE_PAYPAL_CLIENT_ID`: PayPal Client ID (for top-up)

---

## Testing Checklist

### E-Wallet Testing:

- [ ] Display wallet balance on dashboard
- [ ] Open top-up modal
- [ ] Enter custom amount
- [ ] Click quick amount buttons
- [ ] Validate minimum amount (₱100)
- [ ] Complete PayPal payment
- [ ] Verify balance updated
- [ ] Check transaction recorded in Firebase
- [ ] View transaction history
- [ ] Verify transaction details correct

### Bookings Testing:

- [ ] View upcoming trips
- [ ] View previous bookings
- [ ] Switch between tabs
- [ ] Verify booking details correct
- [ ] Check days-until countdown
- [ ] Verify status badges
- [ ] Click "View Property" button
- [ ] Test empty states

### Wallet Payment Testing:

- [ ] Select wallet payment method
- [ ] Verify wallet balance displayed
- [ ] Try booking with sufficient balance
- [ ] Try booking with insufficient balance
- [ ] Verify error message when insufficient
- [ ] Complete wallet payment
- [ ] Verify balance deducted
- [ ] Check booking created correctly
- [ ] Verify transaction recorded
- [ ] Check emails sent (guest and host)

---

## Future Enhancements

### Potential Improvements:

1. **Auto Top-Up**: Automatic top-up when balance is low
2. **Partial Wallet Payment**: Use wallet + PayPal for insufficient balance
3. **Wallet Transfer**: Transfer funds to other users
4. **Loyalty Points**: Earn points for wallet transactions
5. **Transaction Export**: Download transaction history as CSV/PDF
6. **Refund Management**: Automated refund processing to wallet
7. **Wallet Notifications**: Email notifications for transactions
8. **Currency Conversion**: Support multiple currencies
9. **Scheduled Payments**: Set up recurring payments
10. **Gift Cards**: Purchase and redeem gift cards

---

## Troubleshooting

### Wallet Balance Not Updating:

1. Check Firebase user document has `walletBalance` field
2. Verify `fetchWalletBalance()` is called after top-up
3. Check browser console for errors
4. Ensure user is logged in

### PayPal Top-Up Not Working:

1. Verify `VITE_PAYPAL_CLIENT_ID` in `.env`
2. Check PayPal sandbox account has funds
3. Verify PayPal SDK loaded (check Network tab)
4. Check browser console for PayPal errors
5. Ensure minimum amount is ₱100

### Bookings Not Showing:

1. Verify bookings collection exists in Firebase
2. Check booking documents have `guestId` field
3. Verify dates are in correct format (YYYY-MM-DD)
4. Check browser console for Firebase errors
5. Ensure user is logged in

### Wallet Payment Failing:

1. Verify wallet balance is sufficient
2. Check dates are valid and available
3. Verify wallet transaction collection permissions
4. Check browser console for errors
5. Ensure Firebase rules allow writes

---

## Support

For issues or questions:

1. Check browser console for errors
2. Verify Firebase collections and documents
3. Check network tab for failed requests
4. Review error messages in toast notifications
5. Verify environment variables are loaded

---

**Last Updated**: October 27, 2025
**Version**: 1.0.0
**Status**: ✅ Fully Implemented
