# Admin E-Wallet Setup Guide

## Overview

The admin e-wallet system now tracks all platform transactions and routes payments through the admin account. This ensures proper financial oversight and enables withdrawal processing.

## How It Works

### Payment Flow

#### When a Guest Books a Property:

1. **Guest** → Money deducted from guest's wallet
2. **Admin** → Full booking amount added to admin's e-wallet ✅
3. **Host** → Full booking amount added to host's e-wallet ✅

#### When a Guest Withdraws:

1. **Guest** → Money deducted from guest's wallet
2. **Admin** → Money deducted from admin's PayPal balance
3. **PayPal** → Money transferred to guest's PayPal account

### Supported Payment Methods

- ✅ **PayPal Bookings** - Money added to admin & host wallets
- ✅ **Wallet Bookings** - Money added to admin & host wallets
- ✅ **All Payment Methods** - Integrated through the booking system

## Setup Instructions

### Step 1: Create Admin Account

If you haven't created the admin account yet:

1. **Email:** `adminAurastays@aurastays.com`
2. **Password:** `adminAurastays`
3. Sign up normally through the app or use the `src/scripts/createAdmin.js` script

### Step 2: Initialize Admin Wallet

**Option A: Automatic (Recommended)**
The wallet is automatically initialized when you:

- Make your first booking (as a test)
- The system will create the wallet with ₱0 balance

**Option B: Manual Setup**

1. Login as admin
2. Go to Admin Dashboard → E-Wallet tab
3. The system will auto-initialize your wallet

### Step 3: Connect PayPal to Admin Wallet

1. **Login** to Admin Dashboard
2. Navigate to **E-Wallet** tab
3. Click **"Connect PayPal"** button
4. Enter your PayPal email (e.g., `adminAurastays@aurastays.com`)
5. Click **"Connect PayPal"**

✅ Your admin wallet is now fully configured!

## Admin Dashboard Features

### E-Wallet Tab (💰)

Access: Admin Dashboard → E-Wallet

**Features:**

- **Wallet Balance Card** - Shows current balance with stats
- **PayPal Connection** - Connect/disconnect PayPal account
- **Transaction History** - Complete audit trail of all transactions

**Transaction Types:**

- 📥 **Booking Received** - Money from guest bookings
- 📤 **Payout** - Money sent for guest withdrawals
- ➕ **Top Up** - Manual wallet top-ups (if needed)
- 💳 **Payment** - Any payments made

## Testing the System

### Test Booking Flow:

1. **Create a guest account** (or use existing)
2. **Top up guest wallet** (minimum ₱100)
3. **Book a property** using wallet payment
4. **Check admin dashboard** → E-Wallet
   - ✅ Admin balance should increase
   - ✅ Transaction should show "Booking Received"
   - ✅ Host e-wallet should also increase

### Test Withdrawal Flow:

1. **Ensure admin has funds** in wallet
2. **As guest**, go to Profile → E-Wallet
3. **Connect PayPal** (enter test PayPal email)
4. **Withdraw funds** (e.g., ₱500)
5. **Check admin dashboard**
   - ✅ Admin balance should decrease
   - ✅ Transaction shows "Payout"
   - ✅ Guest wallet decreases
   - ✅ Guest receives confirmation

## Important Notes

### ⚠️ Admin Must Have Sufficient Funds

- The admin wallet must have **sufficient balance** for guest withdrawals
- If admin balance is too low, withdrawals will fail
- Money accumulates from bookings automatically

### 💡 Balance Management

- **Bookings add money** to admin wallet
- **Withdrawals remove money** from admin wallet
- **Monitor regularly** to ensure liquidity

### 🔒 Security

- Only users with `isAdmin: true` can access Admin Dashboard
- PayPal email is stored securely in Firestore
- All transactions are logged with timestamps

## Troubleshooting

### "Admin account not found"

**Solution:** Create admin account with email `adminAurastays@aurastays.com`

### Bookings not adding to wallet

**Check:**

1. Admin account exists in Firebase users collection
2. Email is exactly: `adminAurastays@aurastays.com`
3. Check browser console for errors
4. Verify in Firestore → users → (admin doc) → walletBalance field

### Withdrawal fails with "Insufficient admin funds"

**Solution:**

- Check admin wallet balance
- Ensure admin has more funds than withdrawal amount
- Process bookings to add funds to admin wallet

### PayPal connection not working

**Check:**

1. Valid email format with "@"
2. Network connection
3. Firebase permissions
4. Browser console for errors

## Database Structure

### Admin User Document

```javascript
{
  uid: "admin_user_id",
  email: "adminAurastays@aurastays.com",
  displayName: "Admin User",
  userType: "admin",
  isAdmin: true,
  adminLevel: "super",
  walletBalance: 0,  // Automatically updates
  paypalEmail: "adminAurastays@aurastays.com",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Wallet Transaction Document

```javascript
{
  userId: "admin_user_id",
  type: "booking_received", // or "withdrawal_payout"
  amount: 5000,
  propertyTitle: "Beautiful Beach House",
  propertyId: "property_id",
  guestId: "guest_user_id",
  paymentMethod: "paypal", // or "wallet"
  bookingId: "booking_id",
  balanceBefore: 10000,
  balanceAfter: 15000,
  status: "completed",
  createdAt: Timestamp
}
```

## Console Logs

When bookings succeed, you'll see:

```
✅ Added ₱5000 to admin wallet. New balance: ₱15000
✅ Added ₱5000 to host wallet. New balance: ₱8000
```

## Support

If you encounter issues:

1. Check browser console (F12) for errors
2. Verify admin account setup
3. Check Firebase Firestore for data
4. Review transaction logs in E-Wallet tab

---

**Last Updated:** October 2025  
**Version:** 2.0  
**Status:** ✅ Fully Operational
