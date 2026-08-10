/**
 * SMS Templates Configuration
 *
 * This file contains all SMS template IDs and message builders for the Kourier Boyz platform.
 * All SMS templates are DLT-registered and compliant with Indian regulations.
 *
 * Template IDs are provided by Sigmo/TrustSignal SMS provider.
 */

export enum SmsTemplateType {
  // Buyer/Customer Templates
  ACCOUNT_CREATION_OTP = 'ACCOUNT_CREATION_OTP',
  ACCOUNT_WELCOME = 'ACCOUNT_WELCOME',
  LOGIN_OTP = 'LOGIN_OTP',
  PASSWORD_RESET_OTP = 'PASSWORD_RESET_OTP',
  ORDER_CONFIRMATION = 'ORDER_CONFIRMATION',
  ORDER_SHIPPED = 'ORDER_SHIPPED',
  ORDER_SHIPPED_WITH_TRACKING = 'ORDER_SHIPPED_WITH_TRACKING',
  ORDER_SHIPPED_WITH_AWB = 'ORDER_SHIPPED_WITH_AWB',
  ORDER_SHIPPED_NO_TRACKING = 'ORDER_SHIPPED_NO_TRACKING',
  SHIPMENT_CONFIRMATION = 'SHIPMENT_CONFIRMATION',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  ORDER_DELIVERED = 'ORDER_DELIVERED',

  // Seller Templates
  SELLER_NEW_ORDER = 'SELLER_NEW_ORDER',

  // Generic (no template ID)
  GENERIC = 'GENERIC',
}

/**
 * DLT Template IDs mapping
 * These are the registered template IDs with the SMS provider
 *
 * Note: ACCOUNT_CREATION_OTP (1507163272041260154) is used for initial account verification
 * during user registration. This should NOT be sent for guest checkout flows.
 */
const DLT_TEMPLATE_IDS: Record<SmsTemplateType, string | null> = {
  [SmsTemplateType.ACCOUNT_CREATION_OTP]: '1507163272041260154', // Login creation OTP - for initial account verification
  [SmsTemplateType.ACCOUNT_WELCOME]: '1707176646647602735',
  [SmsTemplateType.LOGIN_OTP]: '1707176646654514096', // Login OTP for phone-based 2FA
  [SmsTemplateType.PASSWORD_RESET_OTP]: '1707176646651301634', // Password reset OTP
  [SmsTemplateType.ORDER_CONFIRMATION]: '1507163272005565259',
  [SmsTemplateType.ORDER_SHIPPED]: null, // Uses generic message
  [SmsTemplateType.ORDER_SHIPPED_WITH_TRACKING]: null, // Uses generic message
  [SmsTemplateType.ORDER_SHIPPED_WITH_AWB]: null, // Uses generic message
  [SmsTemplateType.ORDER_SHIPPED_NO_TRACKING]: null, // Uses generic message
  [SmsTemplateType.SHIPMENT_CONFIRMATION]: '1507163272018834682',
  [SmsTemplateType.OUT_FOR_DELIVERY]: null, // Uses generic message
  [SmsTemplateType.ORDER_DELIVERED]: '1507163272034422325',
  [SmsTemplateType.SELLER_NEW_ORDER]: '1507163272063107126',
  [SmsTemplateType.GENERIC]: null,
}

/**
 * Template message formats (for reference and validation)
 */
const TEMPLATE_FORMATS: Record<SmsTemplateType, string> = {
  [SmsTemplateType.ACCOUNT_CREATION_OTP]:
    'Hi {#var#}, Your One Time Password for account creation is {#var#}. Team KOURIER_BOYZ', // Template ID: 1507163272041260154
  [SmsTemplateType.ACCOUNT_WELCOME]:
    'Hi {#var#}, Welcome to KOURIER_BOYZ Family. Enjoy Shopping with KOURIER_BOYZ.',
  [SmsTemplateType.LOGIN_OTP]:
    'Hi {#var#}, Your One Time Password for login to your account is {#var#}. Team KOURIER_BOYZ', // Template ID: 1707176646654514096
  [SmsTemplateType.PASSWORD_RESET_OTP]:
    'Hi {#var#}, Your One Time Password for password reset is {#var#}. Team KOURIER_BOYZ', // Template ID: 1707176646651301634
  [SmsTemplateType.ORDER_CONFIRMATION]:
    'Hi {#var#}, Thanks for placing your order no. {#var#}, will update you about tracking details. Team KOURIER_BOYZ',
  [SmsTemplateType.ORDER_SHIPPED]:
    'Your order {orderNumber} has been shipped! Track it here: {trackingLink} - Kourier Boyz',
  [SmsTemplateType.ORDER_SHIPPED_WITH_TRACKING]:
    'Your order {orderNumber} has been shipped! Track it here: {trackingLink} - Kourier Boyz',
  [SmsTemplateType.ORDER_SHIPPED_WITH_AWB]:
    'Your order {orderNumber} has been shipped! AWB: {awb}. Track at tracking.kourierboyz.com - Kourier Boyz',
  [SmsTemplateType.ORDER_SHIPPED_NO_TRACKING]:
    'Your order {orderNumber} has been shipped! You will receive tracking details soon. - Kourier Boyz',
  [SmsTemplateType.SHIPMENT_CONFIRMATION]:
    'Hi {#var#}. Tracking details of your order no. {#var#} has been shipped via Shipmozo with tracking ID {#var#}. Team KOURIER_BOYZ',
  [SmsTemplateType.OUT_FOR_DELIVERY]:
    'Hi {buyerName}, your order {orderNumber} is out for delivery today.',
  [SmsTemplateType.ORDER_DELIVERED]:
    'Hi {#var#}, Your order no. {#var#} has been delivered. Thank you for Shopping with us. Keep Shopping with KOURIER_BOYZ',
  [SmsTemplateType.SELLER_NEW_ORDER]:
    'Dear Seller, you have got a new order no. {#var#}, request to process the same at the earliest and update on portal. Team KOURIER_BOYZ', // {#var#} is batchCode (e.g., B-ABC123)
  [SmsTemplateType.GENERIC]: '',
}

/**
 * SMS Template Configuration
 */
export interface SmsTemplateConfig {
  templateType: SmsTemplateType
  templateId: string | null
  message: string
}

/**
 * Get DLT Template ID for a given template type
 */
export const getTemplateId = (templateType: SmsTemplateType): string | null => {
  return DLT_TEMPLATE_IDS[templateType] || null
}

/**
 * SMS Message Builders
 * These functions build the actual SMS messages with dynamic data
 */

export interface AccountCreationOtpParams {
  name: string
  otp: string
}

export const buildAccountCreationOtpMessage = (params: AccountCreationOtpParams): string => {
  const displayName = params.name || 'Customer'
  return `Hi ${displayName}, Your One Time Password for account creation is ${params.otp}. Team KOURIER_BOYZ`
}

export interface AccountWelcomeParams {
  name: string
}

export const buildAccountWelcomeMessage = (params: AccountWelcomeParams): string => {
  const displayName = params.name || 'Customer'
  return `Hi ${displayName}, Welcome to KOURIER_BOYZ Family. Enjoy Shopping with KOURIER_BOYZ.`
}

export interface LoginOtpParams {
  name: string
  otp: string
}

export const buildLoginOtpMessage = (params: LoginOtpParams): string => {
  const displayName = params.name || 'Customer'
  return `Hi ${displayName}, Your One Time Password for login to your account is ${params.otp}. Team KOURIER_BOYZ`
}

export interface PasswordResetOtpParams {
  name: string
  otp: string
}

export const buildPasswordResetOtpMessage = (params: PasswordResetOtpParams): string => {
  const displayName = params.name || 'Customer'
  return `Hi ${displayName}, Your One Time Password for password reset is ${params.otp}. Team KOURIER_BOYZ`
}

export interface OrderConfirmationParams {
  buyerName: string
  orderNumber: string
}

export const buildOrderConfirmationMessage = (params: OrderConfirmationParams): string => {
  return `Hi ${params.buyerName}, Thanks for placing your order no. ${params.orderNumber}, will update you about tracking details. Team KOURIER_BOYZ`
}

export interface OrderShippedParams {
  orderNumber: string
  trackingLink?: string
  awb?: string
}

export const buildOrderShippedMessage = (params: OrderShippedParams): string => {
  if (params.trackingLink) {
    return `Your order ${params.orderNumber} has been shipped! Track it here: ${params.trackingLink} - Kourier Boyz`
  }
  if (params.awb) {
    return `Your order ${params.orderNumber} has been shipped! AWB: ${params.awb}. Track at tracking.kourierboyz.com - Kourier Boyz`
  }
  return `Your order ${params.orderNumber} has been shipped! You will receive tracking details soon. - Kourier Boyz`
}

export interface ShipmentConfirmationParams {
  buyerName: string
  orderNumber: string
  trackingId: string
}

export const buildShipmentConfirmationMessage = (params: ShipmentConfirmationParams): string => {
  return `Hi ${params.buyerName}. Tracking details of your order no. ${params.orderNumber} has been shipped via Shipmozo with tracking ID ${params.trackingId}. Team KOURIER_BOYZ`
}

export interface OutForDeliveryParams {
  buyerName: string
  orderNumber: string
}

export const buildOutForDeliveryMessage = (params: OutForDeliveryParams): string => {
  return `Hi ${params.buyerName}, your order ${params.orderNumber} is out for delivery today.`
}

export interface OrderDeliveredParams {
  buyerName: string
  orderNumber: string
}

export const buildOrderDeliveredMessage = (params: OrderDeliveredParams): string => {
  return `Hi ${params.buyerName}, Your order no. ${params.orderNumber} has been delivered. Thank you for Shopping with us. Keep Shopping with KOURIER_BOYZ`
}

export interface SellerNewOrderParams {
  batchCode: string
}

export const buildSellerNewOrderMessage = (params: SellerNewOrderParams): string => {
  return `Dear Seller, you have got a new order no. ${params.batchCode}, request to process the same at the earliest and update on portal. Team KOURIER_BOYZ`
}

/**
 * Get complete SMS template configuration
 * This is the main function to use when sending SMS
 */
export const getSmsTemplate = (
  templateType: SmsTemplateType,
  messageParams: any,
): SmsTemplateConfig => {
  let message = ''

  switch (templateType) {
    case SmsTemplateType.ACCOUNT_CREATION_OTP:
      message = buildAccountCreationOtpMessage(messageParams)
      break
    case SmsTemplateType.ACCOUNT_WELCOME:
      message = buildAccountWelcomeMessage(messageParams)
      break
    case SmsTemplateType.LOGIN_OTP:
      message = buildLoginOtpMessage(messageParams)
      break
    case SmsTemplateType.PASSWORD_RESET_OTP:
      message = buildPasswordResetOtpMessage(messageParams)
      break
    case SmsTemplateType.ORDER_CONFIRMATION:
      message = buildOrderConfirmationMessage(messageParams)
      break
    case SmsTemplateType.ORDER_SHIPPED:
    case SmsTemplateType.ORDER_SHIPPED_WITH_TRACKING:
    case SmsTemplateType.ORDER_SHIPPED_WITH_AWB:
    case SmsTemplateType.ORDER_SHIPPED_NO_TRACKING:
      message = buildOrderShippedMessage(messageParams)
      break
    case SmsTemplateType.SHIPMENT_CONFIRMATION:
      message = buildShipmentConfirmationMessage(messageParams)
      break
    case SmsTemplateType.OUT_FOR_DELIVERY:
      message = buildOutForDeliveryMessage(messageParams)
      break
    case SmsTemplateType.ORDER_DELIVERED:
      message = buildOrderDeliveredMessage(messageParams)
      break
    case SmsTemplateType.SELLER_NEW_ORDER:
      message = buildSellerNewOrderMessage(messageParams)
      break
    default:
      message = messageParams.message || ''
  }

  return {
    templateType,
    templateId: getTemplateId(templateType),
    message,
  }
}

/**
 * Export template formats for reference
 */
export { DLT_TEMPLATE_IDS, TEMPLATE_FORMATS }
