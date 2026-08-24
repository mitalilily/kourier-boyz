# Buyer SMS Flows - Complete Documentation

This document provides a comprehensive A-to-Z overview of all SMS/text message flows used in buyer (customer) journeys on the Kourier Boyz platform.

## SMS Provider Configuration

- **Provider**: Sigmo / TrustSignal
- **API Endpoint**: `https://api.trustsignal.io/v1/sms`
- **Sender ID**: `KOURIER_BOYZS` (configurable via `SMS_SENDER_ID`)
- **Route**: `transactional` (configurable via `SMS_ROUTE`)
- **Entity ID**: `1501495490000031994`

---

## 1. Account Registration & Phone Verification

### 1.1 Initial Registration OTP
**Flow**: User registers with email and phone number

**Trigger**: `POST /api/auth/register` (customer registration)

**SMS Details**:
- **Template ID**: `1507163272041260154`
- **Template Content**: `"Hi {#var#}, Your One Time Password for account creation is {#var#}. Team KOURIER_BOYZ"`
- **Message Format**: `Hi {name}, Your One Time Password for account creation is {OTP}. Team KOURIER_BOYZ`
- **OTP Validity**: 10 minutes
- **Code Location**: `backend/src/controllers/authController.ts` (lines 287-302)

**User Journey**:
1. User fills registration form with email, password, name, and phone
2. System generates 6-digit OTP
3. SMS sent immediately after account creation
4. User must verify phone to complete registration
5. If SMS fails, registration is rolled back

**Frontend Integration**:
- Registration page: `frontend/src/pages/Register.tsx`
- Phone verification UI: `frontend/src/pages/VerifyEmail.tsx`

---

### 1.2 Resend Phone Verification OTP
**Flow**: User requests to resend phone verification code

**Trigger**: `POST /api/auth/resend-phone-verification`

**SMS Details**:
- **Template ID**: `1507163272041260154` (same as registration)
- **Message Format**: `Hi {name}, Your One Time Password for account creation is {OTP}. Team KOURIER_BOYZ`
- **OTP Validity**: 10 minutes
- **Code Location**: `backend/src/controllers/authController.ts` (lines 620-648)

**User Journey**:
1. User clicks "Resend OTP" if they didn't receive the code
2. New 6-digit OTP generated
3. SMS sent to registered phone number
4. User enters OTP to verify phone

---

### 1.3 Phone Verification During Checkout
**Flow**: User verifies phone number during checkout process

**Trigger**: `POST /api/auth/profile/send-otp` (via `sendUpdateOTP`)

**SMS Details**:
- **Template ID**: Not specified (uses default)
- **Message Format**: OTP sent via console log (actual SMS implementation may vary)
- **OTP Validity**: 10 minutes
- **Code Location**: `backend/src/controllers/authController.ts` (lines 750-860)

**User Journey**:
1. User proceeds to checkout
2. If phone not verified, `PhoneVerificationStep` component appears
3. User enters/confirms phone number
4. OTP sent via SMS
5. User enters OTP to verify
6. Phone added to profile and verified
7. Checkout continues

**Frontend Integration**:
- Checkout page: `frontend/src/pages/CheckoutPage.tsx`
- Review page: `frontend/src/pages/ReviewPage.tsx`
- Phone verification component: `frontend/src/components/checkout/PhoneVerificationStep.tsx`

---

## 2. Login & Authentication

### 2.1 Phone-Based Login OTP
**Flow**: User logs in using phone number instead of email

**Trigger**: `POST /api/auth/login-otp` (send OTP)
**Verify**: `POST /api/auth/verify-login-otp` (verify OTP)

**SMS Details**:
- **Template ID**: Not specified (uses default)
- **Message Format**: OTP logged to console (actual SMS may be implemented)
- **OTP Validity**: 5 minutes
- **Code Location**: `backend/src/controllers/authController.ts` (lines 1850-1939)

**User Journey**:
1. User enters phone number on login page
2. System sends 6-digit OTP via SMS
3. User enters OTP
4. System verifies OTP and logs user in
5. JWT tokens issued

**Frontend Integration**:
- Login page: `frontend/src/pages/Login.tsx`

---

### 2.2 Two-Factor Authentication (2FA) SMS
**Flow**: User with 2FA enabled logs in - receives SMS code

**Trigger**: `POST /api/auth/two-factor/send-code`
**Verify**: `POST /api/auth/two-factor/verify` (with `smsCode` parameter)

**SMS Details**:
- **Template ID**: Not specified (uses default)
- **Message Format**: 6-digit code logged to console
- **Code Validity**: 5 minutes
- **Resend Cooldown**: 60 seconds
- **Code Location**: `backend/src/controllers/authController.ts` (lines 1290-1350, 1420-1446)

**User Journey**:
1. User enters email/password
2. If 2FA enabled, system checks if phone is verified
3. User selects "SMS" as 2FA method
4. System sends 6-digit SMS code
5. User enters SMS code
6. System verifies and completes login

**Requirements**:
- User must have verified phone number
- 2FA must be enabled on account
- Phone verification required: `user.phone && user.isPhoneVerified`

**Frontend Integration**:
- Login page with 2FA: `frontend/src/pages/Login.tsx` (lines 55-456)
- Shows SMS option only if `canUseSms: true`

---

## 3. Password Reset

### 3.1 Password Reset Code via SMS
**Flow**: User requests password reset - receives code via SMS (in addition to email)

**Trigger**: `POST /api/auth/forgot-password`

**SMS Details**:
- **Template ID**: Not specified (uses default)
- **Message Format**: 6-digit reset code logged to console
- **Code Validity**: 10 minutes
- **Code Location**: `backend/src/controllers/authController.ts` (lines 1942-2003)

**User Journey**:
1. User clicks "Forgot Password"
2. User enters email address
3. System validates email and phone are verified
4. System generates 6-digit reset code
5. **Email sent** with reset link
6. **SMS sent** with reset code (if phone exists)
7. User uses code from email or SMS to reset password

**Note**: Currently SMS is logged but may not be fully implemented. Email is primary method.

---

## 4. Order Management

### 4.1 Order Confirmation SMS
**Flow**: Buyer places order - receives confirmation SMS

**Trigger**: Order creation in `POST /api/orders` (after successful payment)

**SMS Details**:
- **Template ID**: `1507163272005565259`
- **Template Content**: `"Hi {#var#}, Thanks for placing your order no. {#var#}, will update you about tracking details. Team KOURIER_BOYZ"`
- **Message Format**: `Hi {buyerName}, Thanks for placing your order no. {orderNumber}, will update you about tracking details. Team KOURIER_BOYZ`
- **Code Location**: `backend/src/controllers/order.controller.ts` (lines 1014-1022)

**User Journey**:
1. User completes checkout and payment
2. Order created successfully
3. SMS sent immediately to buyer's phone
4. Email confirmation also sent

**Timing**: Sent immediately after order creation

---

### 4.2 Order Shipped Notification SMS
**Flow**: Order status changes to "shipped" - buyer receives SMS

**Trigger**: Order status update via `notifyOrderShipped` function

**SMS Details**:
- **Template ID**: Not specified (uses default)
- **Message Format**: 
  - If tracking link available: `Your order {orderNumber} has been shipped! Track it here: {trackingLink} - Kourier Boyz`
  - If AWB available: `Your order {orderNumber} is on the way. AWB: {awb}. Track at kourierboyz.com/track.`
  - Otherwise: `Your order {orderNumber} has been shipped! You will receive tracking details soon. - Kourier Boyz`
- **Code Location**: `backend/src/utils/orderStatus.ts` (lines 268-285)

**User Journey**:
1. Seller marks order as shipped
2. System updates order status
3. SMS sent to buyer with tracking information
4. Email notification also sent

**Timing**: Sent when order status changes to "shipped"

---

### 4.3 Shipment Confirmation via Kourier Boyz Logistics Webhook
**Flow**: Kourier Boyz Logistics confirms shipment and the buyer receives an SMS.

**Trigger**: Kourier Boyz Logistics webhook event `shipped` or `booked`

**SMS Details**:
- **Template ID**: `1507163272018834682`
- **Template Content**: `"Hi {#var#}. Your Kourier Boyz order {#var#} is on the way. Tracking ID: {#var#}."`
- **Message Format**: `Hi {buyerName}. Your Kourier Boyz order {orderNumber} is on the way. Tracking ID: {trackingId}.`
- **Code Location**: `backend/src/controllers/webhook.controller.ts` (lines 240-252)

**User Journey**:
1. Kourier Boyz Logistics processes shipment
2. Webhook received with tracking details
3. SMS sent to buyer with tracking ID
4. Order status updated in system

**Timing**: Sent when Kourier Boyz Logistics confirms shipment

---

### 4.4 Out for Delivery SMS
**Flow**: Order status changes to "out for delivery" - buyer receives SMS

**Trigger**: Kourier Boyz Logistics webhook event `out_for_delivery`

**SMS Details**:
- **Template ID**: Not specified (uses default)
- **Message Format**: `Hi {buyerName}, your order {orderNumber} is out for delivery today.`
- **Code Location**: `backend/src/controllers/webhook.controller.ts` (lines 264-289)

**User Journey**:
1. Courier partner picks up order for delivery
2. Kourier Boyz Logistics webhook updates status to "out_for_delivery"
3. SMS sent to buyer
4. Email notification also sent

**Timing**: Sent when order is out for delivery

---

### 4.5 Order Delivered SMS
**Flow**: Order marked as delivered - buyer receives confirmation SMS

**Trigger**: Kourier Boyz Logistics webhook event `delivered`

**SMS Details**:
- **Template ID**: `1507163272034422325`
- **Template Content**: `"Hi {#var#}, Your order no. {#var#} has been delivered. Thank you for Shopping with us. Keep Shopping with KOURIER_BOYZ"`
- **Message Format**: `Hi {buyerName}, Your order no. {orderNumber} has been delivered. Thank you for Shopping with us. Keep Shopping with KOURIER_BOYZ`
- **Code Location**: `backend/src/controllers/webhook.controller.ts` (lines 291-329)

**User Journey**:
1. Courier delivers order to buyer
2. Kourier Boyz Logistics webhook confirms delivery
3. SMS sent to buyer with delivery confirmation
4. Email notification also sent
5. In-app notification created

**Timing**: Sent when order is marked as delivered

---

## 5. Profile Management

### 5.1 Update Phone Number OTP
**Flow**: User updates phone number in profile - receives OTP for verification

**Trigger**: `POST /api/auth/profile/send-otp` (with phone parameter)

**SMS Details**:
- **Template ID**: Not specified (uses default)
- **Message Format**: OTP logged to console
- **OTP Validity**: 10 minutes
- **Code Location**: `backend/src/controllers/authController.ts` (lines 822-860)

**User Journey**:
1. User goes to profile settings
2. User enters new phone number
3. System checks if phone already exists
4. OTP sent to new phone number
5. User enters OTP to verify
6. Phone number updated in profile

**Frontend Integration**:
- Profile page: `frontend/src/pages/profile/PersonalInfo.tsx`

---

## SMS Template IDs Reference

| Template ID | Purpose | Message Format |
|------------|---------|----------------|
| `1507163272041260154` | Account creation OTP | `Hi {name}, Your One Time Password for account creation is {OTP}. Team KOURIER_BOYZ` |
| `1507163272005565259` | Order confirmation | `Hi {name}, Thanks for placing your order no. {orderNumber}, will update you about tracking details. Team KOURIER_BOYZ` |
| `1507163272018834682` | Shipment confirmation | `Hi {name}. Your Kourier Boyz order {orderNumber} is on the way. Tracking ID: {trackingId}.` |
| `1507163272034422325` | Delivery confirmation | `Hi {name}, Your order no. {orderNumber} has been delivered. Thank you for Shopping with us. Keep Shopping with KOURIER_BOYZ` |
| `1507163272063107126` | Seller new order (not buyer) | `Dear Seller, you have got a new order no. {orderNumber}, request to process the same at the earliest and update on portal. Team KOURIER_BOYZ` |

---

## SMS Implementation Details

### Utility Function
**Location**: `backend/src/utils/sms.ts`

**Function**: `sendSms(to: string, message: string, options?: { templateId?: string })`

**Features**:
- Normalizes phone numbers (strips non-digits)
- Supports DLT template IDs
- Handles API errors gracefully
- Logs all SMS attempts for debugging
- Returns success/failure status

### Error Handling
- If SMS API not configured, SMS is skipped (not an error)
- SMS failures don't block critical operations (order creation, etc.)
- All SMS attempts are logged for debugging

### Phone Number Format
- Phone numbers are normalized to digits only
- Expected format: 10-digit Indian mobile numbers
- Stored in database as string

---

## Buyer Flow Summary

### Complete Buyer Journey with SMS Touchpoints:

1. **Registration** → SMS: Account creation OTP
2. **Phone Verification** → SMS: Verification OTP (if not done during registration)
3. **Login (if 2FA enabled)** → SMS: 2FA code (optional)
4. **Checkout** → SMS: Phone verification OTP (if phone not verified)
5. **Order Placed** → SMS: Order confirmation
6. **Order Shipped** → SMS: Shipment notification with tracking
7. **Out for Delivery** → SMS: Delivery attempt notification
8. **Order Delivered** → SMS: Delivery confirmation
9. **Password Reset** → SMS: Reset code (if phone verified)
10. **Profile Update** → SMS: Phone verification OTP (if updating phone)

---

## Notes

1. **SMS vs Email**: Most critical notifications are sent via both SMS and email
2. **Template Compliance**: All SMS messages use DLT-registered templates where specified
3. **Fallback**: If SMS fails, operations continue (non-blocking)
4. **Logging**: All SMS attempts are logged for debugging and compliance
5. **Phone Verification**: Required for most SMS flows to ensure valid phone numbers

---

## Future Enhancements

Potential areas for improvement:
- Implement actual SMS sending for password reset (currently only logged)
- Add SMS for order cancellation notifications
- Add SMS for refund confirmations
- Add SMS for promotional offers (with opt-in)
- Add SMS for cart abandonment reminders
- Add SMS for review requests after delivery










