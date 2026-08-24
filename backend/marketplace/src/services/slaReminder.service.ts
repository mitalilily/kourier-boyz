import mongoose from 'mongoose'
import Order, { type IOrder, type IOrderSellerShipment } from '../models/Order'
import SLAAuditLog from '../models/SLAAuditLog'
import SLATracking, {
  type ISLATracking,
  type ResolvedReason,
  type SLAType,
} from '../models/SLATracking'
import User from '../models/User'
import { sendEmailViaSMTP } from './email.service'

const MAX_REMINDERS = 3
const MIN_HOURS_BETWEEN_REMINDERS = 24 // Minimum hours between reminders (24 hours)
const MIN_BREACH_DURATION_MINUTES = 1 // Minimum breach duration in minutes before sending email (1 minute)

/**
 * Check if order/shipment is still in SLA-eligible status
 */
export function isSLAEligibleStatus(
  orderStatus: string,
  slaType: SLAType,
  shipmentStatus?: string,
): boolean {
  // If order is cancelled or refunded, not eligible
  if (orderStatus === 'cancelled' || orderStatus === 'refunded') {
    return false
  }

  // For AWB SLA: eligible if order is not cancelled/refunded and AWB not generated
  if (slaType === 'AWB') {
    // Check if shipment has AWB
    // If shipment status is shipped/in_transit/out_for_delivery/delivered, AWB is generated
    if (
      shipmentStatus &&
      ['shipped', 'in_transit', 'out_for_delivery', 'delivered'].includes(shipmentStatus)
    ) {
      return false // AWB already generated
    }
    return true
  }

  // For DISPATCH SLA: eligible if AWB is generated but not dispatched
  if (slaType === 'DISPATCH') {
    // If shipment is shipped/in_transit/out_for_delivery/delivered, dispatch is complete
    if (
      shipmentStatus &&
      ['shipped', 'in_transit', 'out_for_delivery', 'delivered'].includes(shipmentStatus)
    ) {
      return false // Already dispatched
    }
    // Check if AWB exists (required for dispatch SLA)
    // This will be checked when creating SLA tracking
    return true
  }

  return false
}

/**
 * Determine resolved reason based on order/shipment status
 */
export function getResolvedReason(
  orderStatus: string,
  slaType: SLAType,
  shipmentStatus?: string,
): ResolvedReason | null {
  if (orderStatus === 'cancelled') {
    return 'CANCELLED'
  }

  if (slaType === 'AWB') {
    // AWB SLA resolved when AWB is generated (shipment status indicates shipping started)
    if (
      shipmentStatus &&
      ['shipped', 'in_transit', 'out_for_delivery', 'delivered'].includes(shipmentStatus)
    ) {
      return 'AWB_GENERATED'
    }
  }

  if (slaType === 'DISPATCH') {
    // Dispatch SLA resolved when shipment is dispatched
    if (
      shipmentStatus &&
      ['shipped', 'in_transit', 'out_for_delivery', 'delivered'].includes(shipmentStatus)
    ) {
      return 'DISPATCHED'
    }
  }

  return null
}

/**
 * Validate if reminder can be sent
 * @param slaTracking - SLA tracking record
 * @param checkInterval - Whether to check minimum interval between reminders
 * @param isManual - Whether this is a manual reminder (admin can bypass max limit)
 */
export async function canSendReminder(
  slaTracking: ISLATracking,
  checkInterval: boolean = true,
  isManual: boolean = false,
): Promise<{
  canSend: boolean
  reason?: string
}> {
  // Check if SLA is resolved
  if (slaTracking.status === 'RESOLVED') {
    return { canSend: false, reason: 'SLA is already resolved' }
  }

  // Check reminder count (only for automatic reminders)
  // Manual reminders (admin) can bypass the 3-reminder limit
  if (!isManual && slaTracking.reminderCount >= MAX_REMINDERS) {
    return { canSend: false, reason: 'Maximum automatic reminders (3) already sent' }
  }

  // Check minimum interval between reminders (only for automatic reminders)
  if (checkInterval && slaTracking.reminderSentAt.length > 0) {
    const lastReminderTime = slaTracking.reminderSentAt[slaTracking.reminderSentAt.length - 1]
    const now = new Date()
    const hoursSinceLastReminder = (now.getTime() - lastReminderTime.getTime()) / (1000 * 60 * 60)

    if (hoursSinceLastReminder < MIN_HOURS_BETWEEN_REMINDERS) {
      const remainingHours = Math.ceil(MIN_HOURS_BETWEEN_REMINDERS - hoursSinceLastReminder)
      return {
        canSend: false,
        reason: `Minimum ${MIN_HOURS_BETWEEN_REMINDERS} hours required between reminders. Next reminder can be sent in ${remainingHours} hours.`,
      }
    }
  }

  // Check if order/shipment is still in SLA-eligible status
  const order = await Order.findById(slaTracking.orderId).lean()
  if (!order) {
    return { canSend: false, reason: 'Order not found' }
  }

  // Find seller shipment
  let sellerShipment: IOrderSellerShipment | undefined
  if (slaTracking.sellerShipmentId) {
    sellerShipment = order.sellerShipments.find(
      (s) => s._id?.toString() === slaTracking.sellerShipmentId?.toString(),
    )
  } else {
    // Find by seller ID
    sellerShipment = order.sellerShipments.find(
      (s) => s.seller.toString() === slaTracking.sellerId.toString(),
    )
  }

  const isEligible = isSLAEligibleStatus(order.status, slaTracking.slaType, sellerShipment?.status)

  if (!isEligible) {
    return { canSend: false, reason: 'Order/shipment is no longer in SLA-eligible status' }
  }

  return { canSend: true }
}

/**
 * Create or update SLA tracking record
 */
export async function createOrUpdateSLATracking(
  order: IOrder,
  sellerShipment: IOrderSellerShipment,
  slaType: SLAType,
  startTime: Date,
  dueTime: Date,
): Promise<ISLATracking> {
  // Check if SLA tracking already exists
  const existing = await SLATracking.findOne({
    orderId: order._id,
    sellerId: sellerShipment.seller,
    slaType,
    status: 'ACTIVE',
  })

  if (existing) {
    // Update existing record
    existing.startTime = startTime
    existing.dueTime = dueTime
    existing.currentOrderStatus = order.status
    existing.currentShipmentStatus = sellerShipment.status
    existing.orderNumber = order.orderNumber
    existing.sellerShipmentId = sellerShipment._id as mongoose.Types.ObjectId
    await existing.save()
    return existing
  }

  // Create new SLA tracking
  const seller = await User.findById(sellerShipment.seller).lean()
  const slaTracking = await SLATracking.create({
    orderId: order._id,
    sellerShipmentId: sellerShipment._id,
    sellerId: sellerShipment.seller,
    slaType,
    status: 'ACTIVE',
    startTime,
    dueTime,
    orderNumber: order.orderNumber,
    sellerName: seller?.businessName || seller?.name,
    currentOrderStatus: order.status,
    currentShipmentStatus: sellerShipment.status,
  })

  // Log SLA_STARTED event
  await SLAAuditLog.create({
    slaTrackingId: slaTracking._id,
    orderId: order._id,
    sellerId: sellerShipment.seller,
    slaType,
    eventType: 'SLA_STARTED',
    triggerReason: `SLA tracking started for ${slaType} type`,
    actor: 'SYSTEM',
    orderNumber: order.orderNumber,
    sellerName: seller?.businessName || seller?.name,
  })

  return slaTracking
}

/**
 * Mark SLA as breached
 */
export async function markSLABreached(
  slaTracking: ISLATracking,
  breachedAt: Date = new Date(),
): Promise<void> {
  if (slaTracking.breachedAt) {
    return // Already marked as breached
  }

  slaTracking.breachedAt = breachedAt
  await slaTracking.save()

  // Log SLA_BREACHED event
  await SLAAuditLog.create({
    slaTrackingId: slaTracking._id,
    orderId: slaTracking.orderId,
    sellerId: slaTracking.sellerId,
    slaType: slaTracking.slaType,
    eventType: 'SLA_BREACHED',
    triggerReason: `SLA deadline exceeded at ${breachedAt.toISOString()}`,
    actor: 'SYSTEM',
    orderNumber: slaTracking.orderNumber,
    sellerName: slaTracking.sellerName,
  })
}

/**
 * Resolve SLA tracking
 */
export async function resolveSLATracking(
  slaTracking: ISLATracking,
  resolvedReason: ResolvedReason,
  resolvedAt: Date = new Date(),
): Promise<void> {
  if (slaTracking.status === 'RESOLVED') {
    return // Already resolved
  }

  slaTracking.status = 'RESOLVED'
  slaTracking.resolvedAt = resolvedAt
  slaTracking.resolvedReason = resolvedReason

  // Update current status
  const order = await Order.findById(slaTracking.orderId).lean()
  if (order) {
    slaTracking.currentOrderStatus = order.status
    const sellerShipment = order.sellerShipments.find(
      (s) => s.seller.toString() === slaTracking.sellerId.toString(),
    )
    if (sellerShipment) {
      slaTracking.currentShipmentStatus = sellerShipment.status
    }
  }

  await slaTracking.save()

  // Log SLA_RESOLVED event
  await SLAAuditLog.create({
    slaTrackingId: slaTracking._id,
    orderId: slaTracking.orderId,
    sellerId: slaTracking.sellerId,
    slaType: slaTracking.slaType,
    eventType: 'SLA_RESOLVED',
    resolvedReason,
    triggerReason: `SLA resolved: ${resolvedReason}`,
    actor: 'SYSTEM',
    orderNumber: slaTracking.orderNumber,
    sellerName: slaTracking.sellerName,
  })
}

/**
 * Generate reminder email content with proper statuses and action buttons
 */
function generateReminderEmail(
  orderNumber: string,
  slaType: SLAType,
  dueTime: Date,
  breachDuration: number,
  currentOrderStatus: string | undefined,
  currentShipmentStatus: string | undefined,
  sellerPanelUrl: string,
  orderId: string,
  customMessage?: string,
): string {
  // Determine what action is needed based on SLA type and current status
  let actionRequired = ''
  let statusInfo = ''
  let actionButtonText = ''
  let actionButtonUrl = ''

  if (slaType === 'AWB') {
    if (currentShipmentStatus === 'pending' || currentShipmentStatus === 'processing') {
      actionRequired = 'Mark order as "Ready to Ship" and generate AWB number'
      statusInfo = `Current Status: ${currentOrderStatus || 'Pending'} → Ready to Ship`
      actionButtonText = 'Update Order Status'
      actionButtonUrl = `${sellerPanelUrl}/orders/${orderId}`
    } else if (currentShipmentStatus === 'ready_to_ship') {
      actionRequired = 'Generate AWB number for the shipment'
      statusInfo = `Current Status: Ready to Ship (AWB pending)`
      actionButtonText = 'Generate AWB'
      actionButtonUrl = `${sellerPanelUrl}/orders/${orderId}`
    } else {
      actionRequired = 'Update order status and generate AWB'
      statusInfo = `Current Status: ${currentOrderStatus || 'N/A'}`
      actionButtonText = 'View Order'
      actionButtonUrl = `${sellerPanelUrl}/orders/${orderId}`
    }
  } else {
    // DISPATCH
    if (currentShipmentStatus === 'ready_to_ship') {
      actionRequired = 'Request pickup or mark shipment as dispatched'
      statusInfo = `Current Status: Ready to Ship (Pickup pending)`
      actionButtonText = 'Request Pickup'
      actionButtonUrl = `${sellerPanelUrl}/orders/${orderId}`
    } else {
      actionRequired = 'Complete shipment dispatch/pickup'
      statusInfo = `Current Status: ${currentShipmentStatus || 'N/A'}`
      actionButtonText = 'Update Shipment'
      actionButtonUrl = `${sellerPanelUrl}/orders/${orderId}`
    }
  }

  const breachHours = Math.floor(breachDuration)
  const breachMinutes = Math.floor((breachDuration - breachHours) * 60)

  // Ensure minimum display of 0h 1m to avoid showing 0h 0m (safety check)
  const displayHours = breachHours
  const displayMinutes = breachHours === 0 && breachMinutes === 0 ? 1 : breachMinutes

  const slaTypeName = slaType === 'AWB' ? 'AWB Generation' : 'Dispatch/Pickup'

  const emailContent = `
    <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <!-- Header Alert -->
      <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
        <div style="font-size: 32px; margin-bottom: 8px;">⚠️</div>
        <h1 style="margin: 0; font-size: 24px; font-weight: 600;">SLA Breach Alert</h1>
        <p style="margin: 8px 0 0 0; opacity: 0.95; font-size: 14px;">Action Required: ${slaTypeName}</p>
      </div>

      <!-- Main Content -->
      <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none;">
        <!-- Order Info Card -->
        <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #e5e7eb;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div>
              <div style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Order Number</div>
              <div style="color: #111827; font-size: 20px; font-weight: 600;">${orderNumber}</div>
            </div>
            <div style="background: #fee2e2; color: #991b1b; padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 600;">
              BREACHED
            </div>
          </div>
          <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 16px;">
            <div style="color: #6b7280; font-size: 13px; margin-bottom: 8px;"><strong>Status:</strong> ${statusInfo}</div>
            <div style="color: #6b7280; font-size: 13px;"><strong>Action Required:</strong> ${actionRequired}</div>
          </div>
        </div>

        <!-- SLA Details -->
        <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin-bottom: 24px; border-radius: 4px;">
          <h3 style="margin: 0 0 16px 0; color: #991b1b; font-size: 16px; font-weight: 600;">SLA Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 140px;">SLA Type:</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500;">${slaTypeName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Due Time:</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px;">${dueTime.toLocaleString(
                'en-IN',
                { dateStyle: 'medium', timeStyle: 'short' },
              )}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Breach Duration:</td>
              <td style="padding: 8px 0; color: #dc2626; font-size: 14px; font-weight: 600;">${displayHours}h ${displayMinutes}m</td>
            </tr>
          </table>
        </div>

        ${
          customMessage
            ? `
        <!-- Custom Message -->
        <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
          <div style="color: #1e40af; font-size: 13px; font-weight: 600; margin-bottom: 8px;">Additional Message from Admin:</div>
          <div style="color: #1e3a8a; font-size: 14px; line-height: 1.6;">${customMessage}</div>
        </div>
        `
            : ''
        }

        <!-- Action Buttons -->
        <div style="text-align: center; margin: 32px 0;">
          <a href="${actionButtonUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3); transition: all 0.2s;">
            ${actionButtonText}
          </a>
        </div>
        <div style="text-align: center; margin-top: 16px;">
          <a href="${sellerPanelUrl}/orders" style="color: #2563eb; text-decoration: none; font-size: 14px;">View All Orders →</a>
        </div>

        <!-- Important Notice -->
        <div style="background: #fffbeb; border: 1px solid #fcd34d; padding: 16px; margin-top: 24px; border-radius: 6px;">
          <div style="color: #92400e; font-size: 13px; line-height: 1.6;">
            <strong>⚠️ Important:</strong> Please take immediate action to resolve this SLA breach. Continued delays may impact your seller performance rating and account standing.
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div style="background: #f9fafb; padding: 20px; text-align: center; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="margin: 0; color: #6b7280; font-size: 12px;">
          This is an automated reminder. If you have already taken action, please ignore this email.
        </p>
        <p style="margin: 8px 0 0 0; color: #9ca3af; font-size: 11px;">
          Need help? Contact support at <a href="mailto:support@kourierboyz.com" style="color: #2563eb;">support@kourierboyz.com</a>
        </p>
      </div>
    </div>
  `

  return emailContent
}

/**
 * Send reminder email to seller
 */
export async function sendReminderEmail(
  slaTracking: ISLATracking,
  reminderType: 'AUTO' | 'MANUAL',
  sentBy: 'SYSTEM' | string,
  customMessage?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Parallel queries for better performance
    const [seller, order] = await Promise.all([
      User.findById(slaTracking.sellerId).select('email storeEmail supportEmail').lean(),
      Order.findById(slaTracking.orderId).select('status sellerShipments').lean(),
    ])

    if (!seller) {
      return { success: false, error: 'Seller not found' }
    }

    const sellerEmail = seller.email || seller.storeEmail || seller.supportEmail
    if (!sellerEmail) {
      return { success: false, error: 'Seller email not found' }
    }

    if (!order) {
      return { success: false, error: 'Order not found' }
    }

    // Find seller shipment to get current status (use cached if available)
    const sellerShipment = order.sellerShipments.find(
      (s) => s.seller.toString() === slaTracking.sellerId.toString(),
    )

    // Calculate breach duration
    const now = new Date()
    const breachDuration = (now.getTime() - slaTracking.dueTime.getTime()) / (1000 * 60 * 60)

    // Get seller panel URL (cache in variable)
    const sellerPanelUrl =
      process.env.SELLER_PANEL_URL || process.env.FRONTEND_URL || 'http://localhost:5175'

    // Use cached status from SLA tracking if available, otherwise use order/shipment
    const currentOrderStatus = slaTracking.currentOrderStatus || order.status
    const currentShipmentStatus = slaTracking.currentShipmentStatus || sellerShipment?.status

    // Generate email content with proper statuses and action buttons
    const emailContent = generateReminderEmail(
      slaTracking.orderNumber || 'N/A',
      slaTracking.slaType,
      slaTracking.dueTime,
      breachDuration,
      currentOrderStatus,
      currentShipmentStatus,
      sellerPanelUrl,
      slaTracking.orderId.toString(),
      customMessage,
    )

    // Use a simpler wrapper since we're already creating a full HTML email
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>SLA Reminder - ${slaTracking.orderNumber}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        ${emailContent}
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim()

    // Send email
    const result = await sendEmailViaSMTP({
      to: sellerEmail,
      subject: `SLA Reminder: ${slaTracking.slaType} - Order ${slaTracking.orderNumber}`,
      html,
    })

    return result
  } catch (error: any) {
    console.error('Error sending reminder email:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Send reminder (auto or manual)
 */
export async function sendReminder(
  slaTrackingId: mongoose.Types.ObjectId,
  reminderType: 'AUTO' | 'MANUAL',
  sentBy: 'SYSTEM' | string,
  customMessage?: string,
): Promise<{ success: boolean; error?: string }> {
  const slaTracking = await SLATracking.findById(slaTrackingId)
  if (!slaTracking) {
    return { success: false, error: 'SLA tracking not found' }
  }

  // Validate before sending
  // Manual reminders (admin) can bypass both interval check and max limit
  // Automatic reminders must respect both interval and max limit (3)
  const checkInterval = reminderType === 'AUTO'
  const isManual = reminderType === 'MANUAL'
  const validation = await canSendReminder(slaTracking, checkInterval, isManual)
  if (!validation.canSend) {
    return { success: false, error: validation.reason }
  }

  // Prepare update data
  const now = new Date()
  const updateData = {
    $inc: { reminderCount: 1 },
    $push: {
      reminderSentAt: now,
      reminders: {
        sentAt: now,
        type: reminderType,
        sentBy,
        message: customMessage,
      },
    },
    $set: {
      lastReminderSentBy: sentBy,
      lastReminderType: reminderType,
    },
  }

  // Parallel: Send email and prepare audit log (don't wait for email to complete before updating DB)
  const emailPromise = sendReminderEmail(slaTracking, reminderType, sentBy, customMessage)

  // Update SLA tracking immediately
  await SLATracking.findByIdAndUpdate(slaTrackingId, updateData)

  // Create audit log (parallel with email)
  const auditLogPromise = SLAAuditLog.create({
    slaTrackingId: slaTracking._id,
    orderId: slaTracking.orderId,
    sellerId: slaTracking.sellerId,
    slaType: slaTracking.slaType,
    eventType: 'SLA_REMINDER_SENT',
    reminderType,
    reminderCount: slaTracking.reminderCount + 1,
    triggerReason: `${reminderType} reminder sent`,
    actor: sentBy,
    orderNumber: slaTracking.orderNumber,
    sellerName: slaTracking.sellerName,
  })

  // Wait for email to complete
  const emailResult = await emailPromise

  // Don't wait for audit log (fire and forget for better performance)
  auditLogPromise.catch((err) => {
    console.error('Failed to create SLA audit log:', err)
  })

  if (!emailResult.success) {
    return emailResult
  }

  return { success: true }
}

/**
 * Process automatic reminders (called by scheduler)
 */
export async function processAutomaticReminders(): Promise<{
  processed: number
  sent: number
  skipped: number
  errors: string[]
}> {
  const now = new Date()
  const results = {
    processed: 0,
    sent: 0,
    skipped: 0,
    errors: [] as string[],
  }

  // Find all active SLA records that are breached and haven't reached max reminders
  const breachedSLAs = await SLATracking.find({
    status: 'ACTIVE',
    dueTime: { $lt: now },
    reminderCount: { $lt: MAX_REMINDERS },
  }).lean()

  for (const sla of breachedSLAs) {
    results.processed++

    try {
      // Validate if reminder can be sent
      const slaTracking = await SLATracking.findById(sla._id)
      if (!slaTracking) {
        continue
      }

      // Mark as breached if not already
      if (!slaTracking.breachedAt) {
        await markSLABreached(slaTracking, now)
      }

      // Calculate breach duration in minutes
      const breachDurationMinutes = (now.getTime() - slaTracking.dueTime.getTime()) / (1000 * 60)

      // Skip if breach duration is less than minimum threshold (to avoid sending emails for 0h 0m breaches)
      if (breachDurationMinutes < MIN_BREACH_DURATION_MINUTES) {
        results.skipped++
        continue
      }

      // For automatic reminders, check interval and max limit
      const validation = await canSendReminder(slaTracking, true, false)
      if (!validation.canSend) {
        results.skipped++
        continue
      }

      // Send reminder
      const result = await sendReminder(
        slaTracking._id as mongoose.Types.ObjectId,
        'AUTO',
        'SYSTEM',
      )
      if (result.success) {
        results.sent++
      } else {
        results.skipped++
        results.errors.push(`SLA ${sla._id}: ${result.error}`)
      }
    } catch (error: any) {
      results.skipped++
      results.errors.push(`SLA ${sla._id}: ${error.message}`)
    }
  }

  return results
}

/**
 * Check and resolve SLAs that are no longer eligible
 */
export async function checkAndResolveSLAs(): Promise<{
  checked: number
  resolved: number
  errors: string[]
}> {
  const results = {
    checked: 0,
    resolved: 0,
    errors: [] as string[],
  }

  // Find all active SLA records
  const activeSLAs = await SLATracking.find({
    status: 'ACTIVE',
  }).lean()

  for (const sla of activeSLAs) {
    results.checked++

    try {
      const order = await Order.findById(sla.orderId).lean()
      if (!order) {
        // Order not found, resolve as cancelled
        const slaTracking = await SLATracking.findById(sla._id)
        if (slaTracking) {
          await resolveSLATracking(slaTracking, 'CANCELLED')
          results.resolved++
        }
        continue
      }

      // Find seller shipment
      let sellerShipment: IOrderSellerShipment | undefined
      if (sla.sellerShipmentId) {
        sellerShipment = order.sellerShipments.find(
          (s) => s._id?.toString() === sla.sellerShipmentId?.toString(),
        )
      } else {
        sellerShipment = order.sellerShipments.find(
          (s) => s.seller.toString() === sla.sellerId.toString(),
        )
      }

      // Check if still eligible
      const isEligible = isSLAEligibleStatus(order.status, sla.slaType, sellerShipment?.status)

      if (!isEligible) {
        // Resolve SLA
        const slaTracking = await SLATracking.findById(sla._id)
        if (slaTracking) {
          const resolvedReason = getResolvedReason(
            order.status,
            sla.slaType,
            sellerShipment?.status,
          )
          if (resolvedReason) {
            await resolveSLATracking(slaTracking, resolvedReason)
            results.resolved++
          }
        }
      }
    } catch (error: any) {
      results.errors.push(`SLA ${sla._id}: ${error.message}`)
    }
  }

  return results
}
