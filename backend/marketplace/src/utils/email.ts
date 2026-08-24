import crypto from 'crypto'
import nodemailer from 'nodemailer'

// Generate random token
export const generateToken = (): string => {
  return crypto.randomBytes(32).toString('hex')
}

// Helper to safely get URLs - returns null if not configured (no localhost fallback)
const getSellerPanelUrl = (): string | null => {
  return process.env.SELLER_PANEL_URL || null
}

const getFrontendUrl = (): string | null => {
  return process.env.FRONTEND_URL || null
}

const getAdminPanelUrl = (): string | null => {
  return process.env.ADMIN_PANEL_URL || null
}

// Cached Nodemailer transporter (created on first use when SMTP env vars are present)
let transporter: nodemailer.Transporter | null = null

const getTransporter = () => {
  const host = process.env.SMTP_HOST?.trim()
  const port = process.env.SMTP_PORT || '587'
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.replace(/\s+/g, '')

  if (!host || !user || !pass) {
    // Fallback: no SMTP configured, keep logging only
    console.warn(
      '⚠️ SMTP is not fully configured (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS). Emails will be logged to console only.',
    )
    return null
  }

  if (!process.env.SMTP_PORT) {
    console.warn('⚠️ SMTP_PORT not set. Defaulting to 587.')
  }

  if (!transporter) {
    const portNum = Number(port)
    const isSecure = portNum === 465
    const isTLS = portNum === 587

    const transportOptions: any = {
      host,
      port: portNum,
      secure: isSecure, // true for 465, false for other ports
      auth: {
        user,
        pass,
      },
      connectionTimeout: 30000, // 30 seconds connection timeout
      socketTimeout: 30000, // 30 seconds socket timeout
      greetingTimeout: 30000, // 30 seconds greeting timeout
    }

    // Add TLS options for port 587
    if (isTLS) {
      transportOptions.requireTLS = true
    }

    // Additional options for better connection handling (optimized for Render.com)
    transportOptions.pool = false // Don't use connection pooling (can cause issues on some hosts like Render)
    transportOptions.maxConnections = 1 // Single connection for Render.com compatibility
    transportOptions.maxMessages = 1 // Send one message per connection
    transportOptions.tls = {
      // Do not fail on invalid certificates (some SMTP servers have self-signed certs)
      rejectUnauthorized: false,
      // Additional TLS options for Render.com network compatibility
      minVersion: 'TLSv1.2',
    }

    transporter = nodemailer.createTransport(transportOptions)

    // Log SMTP configuration (without sensitive data)
    console.log(`📧 SMTP configured: ${host}:${port} (secure: ${isSecure}, TLS: ${isTLS})`)
  }

  return transporter
}

// Send email using configured SMTP; always logs to console as well for debugging
export const sendEmail = async (to: string, subject: string, html: string) => {
  // Always log for debugging/traceability

  try {
    const smtpTransporter = getTransporter()

    // If SMTP is not configured, we already logged the email above; treat as soft-success
    if (!smtpTransporter) {
      console.log('\n📧 ============ EMAIL (SMTP NOT CONFIGURED) ============')
      console.log(`To: ${to}`)
      console.log(`Subject: ${subject}`)
      console.log(`Body:\n${html.substring(0, 500)}...`)
      console.log('========================================================\n')
      return { success: false, skipped: true, reason: 'SMTP not configured' }
    }

    // Use Promise.race to add a timeout wrapper
    const emailPromise = smtpTransporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@kourierboyz.com',
      to,
      subject,
      html,
    })

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Email sending timeout after 45 seconds'))
      }, 45000) // 45 seconds total timeout
    })

    await Promise.race([emailPromise, timeoutPromise])

    return { success: true }
  } catch (err: any) {
    const errorMessage = err?.message || 'Unknown error'
    const errorCode = err?.code || 'UNKNOWN'
    const smtpHost = process.env.SMTP_HOST || 'not configured'
    const smtpPort = process.env.SMTP_PORT || 'not configured'

    // Provide more detailed error information
    if (errorCode === 'ETIMEDOUT' || errorMessage.includes('timeout')) {
      console.error(`❌ SMTP Connection Timeout:`, {
        host: smtpHost,
        port: smtpPort,
        error: errorMessage,
        suggestion:
          'Check if SMTP server is reachable, firewall allows outbound connections, and credentials are correct',
      })
    } else if (errorCode === 'ECONNREFUSED') {
      console.error(`❌ SMTP Connection Refused:`, {
        host: smtpHost,
        port: smtpPort,
        error: errorMessage,
        suggestion: 'SMTP server is not accepting connections. Check host and port.',
      })
    } else {
      console.error(`❌ Failed to send email via SMTP:`, {
        host: smtpHost,
        port: smtpPort,
        error: errorMessage,
        code: errorCode,
      })
    }

    // Do not throw – callers shouldn't break just because email failed
    return { success: false, error: err }
  }
}

// Email templates
export const emailTemplates = {
  verifyEmail: (name: string, verificationUrl: string, userType: string = 'seller') => {
    const platform = userType === 'customer' ? 'Kourier Boyz' : 'Kourier Boyz Seller Hub'
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #2563eb; margin-bottom: 20px;">Verify Your Kourier Boyz Email 📧</h1>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Hi ${name},
        </p>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Thanks for registering on ${platform}! Please verify your email address by clicking the button below:
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            Verify Email
          </a>
        </div>
        <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
          Or copy and paste this link in your browser:<br/>
          <a href="${verificationUrl}" style="color: #2563eb; word-break: break-all;">${verificationUrl}</a>
        </p>
        <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          This link will expire in 24 hours. If you didn't create an account, please ignore this email.
        </p>
      </div>
    </div>
  `
  },

  resetPassword: (name: string, resetUrl: string) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #2563eb; margin-bottom: 20px;">Reset Your Password 🔒</h1>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Hi ${name},
        </p>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          We received a request to reset your password. Click the button below to create a new password:
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            Reset Password
          </a>
        </div>
        <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
          Or copy and paste this link in your browser:<br/>
          <a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a>
        </p>
        <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.
        </p>
      </div>
    </div>
  `,

  accountApproved: (name: string, loginUrl: string) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #10b981; margin-bottom: 20px;">Account Approved! 🎉</h1>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Hi ${name},
        </p>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Great news! Your seller account has been approved by our admin team. You can now start selling on our platform.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" 
             style="background-color: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            Login to Dashboard
          </a>
        </div>
        <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          Welcome to our seller community! 🚀
        </p>
      </div>
    </div>
  `,

  accountRejected: (name: string, reason: string) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #ef4444; margin-bottom: 20px;">Account Registration Update</h1>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Hi ${name},
        </p>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Thank you for your interest in becoming a seller on our platform. Unfortunately, we are unable to approve your account at this time.
        </p>
        ${
          reason
            ? `<p style="font-size: 14px; color: #6b7280; background-color: #fee2e2; padding: 15px; border-radius: 6px; margin-bottom: 20px;"><strong>Reason:</strong> ${reason}</p>`
            : ''
        }
        <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          If you believe this is a mistake or have any questions, please contact our support team.
        </p>
      </div>
    </div>
  `,

  sellerApproval: (name: string) => {
    const sellerPanelUrl = getSellerPanelUrl()
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #10b981; margin-bottom: 20px;">🎉 KYC Approved - Welcome to Seller Hub!</h1>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Hi ${name},
        </p>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Congratulations! Your KYC application has been approved by our admin team. You can now access the full seller dashboard and start selling on our platform.
        </p>
        ${
          sellerPanelUrl
            ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${sellerPanelUrl}/login" 
             style="background-color: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            Login to Dashboard
          </a>
        </div>
        `
            : ''
        }
        <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          Welcome to our seller community! Start uploading your products and reach millions of customers. 🚀
        </p>
      </div>
    </div>
  `
  },

  sellerRejection: (name: string, reason: string) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #ef4444; margin-bottom: 20px;">KYC Application Update</h1>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Hi ${name},
        </p>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Thank you for your interest in becoming a seller on our platform. After reviewing your KYC application, we are unable to approve your account at this time.
        </p>
        <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; color: #991b1b;"><strong>Reason for rejection:</strong></p>
          <p style="margin: 10px 0 0 0; color: #7f1d1d;">${reason}</p>
        </div>
        <p style="font-size: 14px; color: #374151; margin: 20px 0;">
          You can update your information and reapply by logging into your account and resubmitting your KYC details.
        </p>
        ${(() => {
          const sellerPanelUrl = getSellerPanelUrl()
          return sellerPanelUrl
            ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${sellerPanelUrl}/login" 
             style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            Login to Resubmit
          </a>
        </div>
        `
            : ''
        })()}
        <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          If you have any questions or believe this is a mistake, please contact our support team.
        </p>
      </div>
    </div>
  `,

  adminPasswordReset: (name: string, newPassword: string, loginUrl: string | null) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #2563eb; margin-bottom: 20px;">Your Password Was Reset 🔐</h1>
        <p style="font-size: 16px; color: #374151; margin-bottom: 16px;">
          Hi ${name},
        </p>
        <p style="font-size: 15px; color: #4b5563; margin-bottom: 16px;">
          An administrator just reset your account password. You can log in immediately with the temporary password below. 
          For security, please sign in and change it from your profile settings as soon as possible.
        </p>
        <div style="background-color: #f3f4f6; border-radius: 6px; padding: 16px; margin-bottom: 24px; font-family: 'Courier New', monospace; font-size: 16px; color: #111827;">
          ${newPassword}
        </div>
        ${
          loginUrl
            ? `
        <div style="text-align: center; margin-bottom: 24px;">
          <a href="${loginUrl}"
             style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            Go to Login
          </a>
        </div>
        `
            : ''
        }
        <p style="font-size: 14px; color: #6b7280;">
          If you did not request this change, please contact support immediately.
        </p>
      </div>
    </div>
  `,

  adminUserCreated: (name: string, email: string, password: string, loginUrl: string | null) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #2563eb; margin-bottom: 20px;">Welcome to Kourier Boyz Admin Panel 👋</h1>
        <p style="font-size: 16px; color: #374151; margin-bottom: 16px;">
          Hi ${name},
        </p>
        <p style="font-size: 15px; color: #4b5563; margin-bottom: 16px;">
          Your admin account has been created successfully! You can now access the Kourier Boyz Admin Panel using the credentials below.
        </p>
        <div style="background-color: #f3f4f6; border-radius: 6px; padding: 20px; margin-bottom: 24px;">
          <p style="font-size: 14px; color: #6b7280; margin-bottom: 8px; font-weight: 600;">Email:</p>
          <p style="font-size: 16px; color: #111827; margin-bottom: 16px; font-family: 'Courier New', monospace;">${email}</p>
          <p style="font-size: 14px; color: #6b7280; margin-bottom: 8px; font-weight: 600;">Temporary Password:</p>
          <div style="background-color: #ffffff; border: 1px solid #d1d5db; border-radius: 4px; padding: 12px; font-family: 'Courier New', monospace; font-size: 16px; color: #111827;">
            ${password}
          </div>
        </div>
        ${
          loginUrl
            ? `
        <div style="text-align: center; margin-bottom: 24px;">
          <a href="${loginUrl}"
             style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            Go to Admin Panel
          </a>
        </div>
        `
            : ''
        }
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin-bottom: 24px; border-radius: 4px;">
          <p style="font-size: 14px; color: #92400e; margin: 0;">
            <strong>⚠️ Security Notice:</strong> For your security, please change your password immediately after your first login.
          </p>
        </div>
        <p style="font-size: 14px; color: #6b7280; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          If you did not expect this email, please contact your system administrator immediately.
        </p>
      </div>
    </div>
  `,

  // Buyer: Order placed / confirmation
  orderPlacedBuyer: (
    name: string,
    options: {
      orderNumber: string
      itemsSummary: string
      totalAmount: number
      paymentMethod: string
      shippingAddress?: {
        name: string
        phone: string
        addressLine1: string
        addressLine2?: string
        city: string
        state: string
        postalCode: string
        country: string
      }
    },
  ) => {
    const { orderNumber, itemsSummary, totalAmount, paymentMethod, shippingAddress } = options
    const addressLines: string[] = []
    if (shippingAddress) {
      addressLines.push(shippingAddress.name)
      addressLines.push(shippingAddress.phone)
      addressLines.push(shippingAddress.addressLine1)
      if (shippingAddress.addressLine2) addressLines.push(shippingAddress.addressLine2)
      addressLines.push(
        `${shippingAddress.city}, ${shippingAddress.state} - ${shippingAddress.postalCode}`,
      )
      addressLines.push(shippingAddress.country)
    }

    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #2563eb; margin-bottom: 16px;">Your Order is Confirmed 🎉</h1>
        <p style="font-size: 16px; color: #374151; margin-bottom: 12px;">
          Hi ${name},
        </p>
        <p style="font-size: 15px; color: #4b5563; margin-bottom: 16px;">
          Thanks for shopping on Kourier Boyz! Your order <strong>${orderNumber}</strong> has been placed successfully.
        </p>
        <div style="background-color: #f3f4f6; border-radius: 6px; padding: 14px 16px; margin-bottom: 18px;">
          <p style="margin: 0; font-size: 14px; color: #111827;">
            <strong>Order summary:</strong><br/>
            ${itemsSummary}
          </p>
        </div>
        <p style="font-size: 14px; color: #111827; margin: 0 0 8px 0%;">
          <strong>Order total:</strong> ₹${totalAmount.toFixed(2)}
        </p>
        <p style="font-size: 14px; color: #111827; margin: 0 0 16px 0;">
          <strong>Payment method:</strong> ${paymentMethod.toUpperCase()}
        </p>
        ${
          addressLines.length
            ? `<div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e5e7eb;">
                 <p style="font-size: 14px; color: #111827; margin: 0 0 4px 0;"><strong>Shipping to:</strong></p>
                 <p style="font-size: 13px; color: #4b5563; margin: 0; line-height: 1.5;">
                   ${addressLines.join('<br/>')}
                 </p>
               </div>`
            : ''
        }
        <p style="font-size: 13px; color: #6b7280; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 14px;">
          We’ll send you updates as your order is packed, shipped, and delivered.
        </p>
      </div>
    </div>
  `
  },

  // Buyer: Generic order status update
  orderStatusUpdateBuyer: (
    name: string,
    options: {
      orderNumber: string
      statusLabel: string
      message?: string
      trackingLink?: string
    },
  ) => {
    const { orderNumber, statusLabel, message, trackingLink } = options
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #2563eb; margin-bottom: 16px;">Order Update 📦</h1>
        <p style="font-size: 16px; color: #374151; margin-bottom: 12px;">
          Hi ${name},
        </p>
        <p style="font-size: 15px; color: #4b5563; margin-bottom: 12px;">
          Your order <strong>${orderNumber}</strong> is now <strong>${statusLabel}</strong>.
        </p>
        ${
          message
            ? `<p style="font-size: 14px; color: #4b5563; margin-bottom: 12px;">${message}</p>`
            : ''
        }
        ${
          trackingLink
            ? `<p style="font-size: 14px; color: #4b5563; margin-bottom: 16px;">
                 You can track your shipment here:<br/>
                 <a href="${trackingLink}" style="color: #2563eb; word-break: break-all;">${trackingLink}</a>
               </p>`
            : ''
        }
        <p style="font-size: 13px; color: #6b7280; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 14px;">
          Thank you for shopping with Kourier Boyz.
        </p>
      </div>
    </div>
  `
  },

  // Buyer: Order shipped with tracking link
  orderShipped: (
    name: string,
    options: {
      orderNumber: string
      trackingLink: string
      awb?: string
      courier?: string
      estimatedDelivery?: string
    },
  ) => {
    const { orderNumber, trackingLink, awb, courier, estimatedDelivery } = options
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #10b981; margin-bottom: 16px;">🚚 Your Order Has Been Shipped!</h1>
        <p style="font-size: 16px; color: #374151; margin-bottom: 12px;">
          Hi ${name},
        </p>
        <p style="font-size: 15px; color: #4b5563; margin-bottom: 16px;">
          Great news! Your order <strong>${orderNumber}</strong> has been shipped and is on its way to you.
        </p>
        ${
          awb
            ? `<div style="background-color: #f3f4f6; border-radius: 6px; padding: 14px 16px; margin-bottom: 16px;">
                 <p style="margin: 0 0 4px 0; font-size: 13px; color: #6b7280;">AWB Number:</p>
                 <p style="margin: 0; font-size: 16px; font-weight: bold; color: #111827; font-family: monospace;">${awb}</p>
               </div>`
            : ''
        }
        ${
          courier
            ? `<p style="font-size: 14px; color: #4b5563; margin-bottom: 8px;">
                 <strong>Courier:</strong> ${courier}
               </p>`
            : ''
        }
        ${
          estimatedDelivery
            ? `<p style="font-size: 14px; color: #4b5563; margin-bottom: 16px;">
                 <strong>Estimated Delivery:</strong> ${estimatedDelivery}
               </p>`
            : ''
        }
        <div style="text-align: center; margin: 24px 0;">
          <a href="${trackingLink}" 
             style="background-color: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
            Track Your Order
          </a>
        </div>
        <p style="font-size: 13px; color: #6b7280; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 14px;">
          You can also copy this tracking link: <br/>
          <a href="${trackingLink}" style="color: #2563eb; word-break: break-all; font-size: 12px;">${trackingLink}</a>
        </p>
        <p style="font-size: 13px; color: #6b7280; margin-top: 16px;">
          We'll notify you when your order is out for delivery. Thank you for shopping with Kourier Boyz! 🎉
        </p>
      </div>
    </div>
  `
  },

  // Seller: New order notification
  sellerNewOrder: (
    sellerName: string,
    options: {
      orderNumber: string
      itemsSummary: string
      totalAmount: number
      paymentMethod: string
      paymentStatus: string
      buyerName?: string
      shippingAddress?: {
        name: string
        phone: string
        addressLine1: string
        addressLine2?: string
        city: string
        state: string
        postalCode: string
        country: string
      }
    },
  ) => {
    const {
      orderNumber,
      itemsSummary,
      totalAmount,
      paymentMethod,
      paymentStatus,
      buyerName,
      shippingAddress,
    } = options
    const addressLines: string[] = []
    if (shippingAddress) {
      addressLines.push(shippingAddress.name)
      addressLines.push(shippingAddress.phone)
      addressLines.push(shippingAddress.addressLine1)
      if (shippingAddress.addressLine2) addressLines.push(shippingAddress.addressLine2)
      addressLines.push(
        `${shippingAddress.city}, ${shippingAddress.state} - ${shippingAddress.postalCode}`,
      )
      addressLines.push(shippingAddress.country)
    }

    return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; background-color: #0f172a;">
      <div style="background-color: #ffffff; border-radius: 10px; padding: 24px 28px; box-shadow: 0 10px 25px rgba(15,23,42,0.5); border: 1px solid #e5e7eb;">
        <h1 style="color: #111827; margin-bottom: 6px; font-size: 22px;">New Order Received 🔔</h1>
        <p style="font-size: 13px; color: #6b7280; margin-top: 0; margin-bottom: 16px;">
          Sent from Kourier Boyz Seller Hub
        </p>
        <p style="font-size: 15px; color: #111827; margin-bottom: 10px;">
          Hi ${sellerName},
        </p>
        <p style="font-size: 14px; color: #4b5563; margin-bottom: 14px;">
          You’ve received a new order <strong>${orderNumber}</strong>${
      buyerName ? ` from <strong>${buyerName}</strong>` : ''
    }. Please review and start processing.
        </p>
        <div style="background-color: #f9fafb; border-radius: 8px; padding: 14px 16px; margin-bottom: 16px;">
          <p style="margin: 0 0 4px 0; font-size: 13px; color: #111827;"><strong>Items:</strong></p>
          <p style="margin: 0; font-size: 13px; color: #374151; line-height: 1.5;">
            ${itemsSummary}
          </p>
        </div>
        <p style="font-size: 13px; color: #111827; margin: 0 0 4px 0;">
          <strong>Order value:</strong> ₹${totalAmount.toFixed(2)}
        </p>
        <p style="font-size: 13px; color: #111827; margin: 0 0 4px 0;">
          <strong>Payment method:</strong> ${paymentMethod.toUpperCase()} (${paymentStatus})
        </p>
        ${
          addressLines.length
            ? `<div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #e5e7eb;">
                 <p style="font-size: 13px; color: #111827; margin: 0 0 4px 0;"><strong>Ship to:</strong></p>
                 <p style="font-size: 12px; color: #4b5563; margin: 0; line-height: 1.5;">
                   ${addressLines.join('<br/>')}
                 </p>
               </div>`
            : ''
        }
        <p style="font-size: 12px; color: #6b7280; margin-top: 18px; border-top: 1px solid #e5e7eb; padding-top: 10px;">
          Tip: Pack and confirm pickup quickly to improve your on-time shipping metrics.
        </p>
      </div>
    </div>
  `
  },

  // Seller: Shipping label & invoice ready (AWB generated)
  sellerAwbGenerated: (
    sellerName: string,
    options: {
      orderNumber: string
      awb?: string
      labelUrl?: string
      invoiceUrl?: string
      trackingLink?: string
    },
  ) => {
    const { orderNumber, awb, labelUrl, invoiceUrl, trackingLink } = options
    return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; background-color: #0f172a;">
      <div style="background-color: #ffffff; border-radius: 10px; padding: 24px 28px; box-shadow: 0 10px 25px rgba(15,23,42,0.5); border: 1px solid #e5e7eb;">
        <h1 style="color: #111827; margin-bottom: 8px; font-size: 20px;">Shipping Label Ready 🚚</h1>
        <p style="font-size: 14px; color: #4b5563; margin-top: 0; margin-bottom: 14px;">
          Hi ${sellerName}, your shipment for order <strong>${orderNumber}</strong> is ready. Please print the label and invoice, then attach them to the package.
        </p>
        ${
          awb
            ? `<p style="font-size: 13px; color: #111827; margin: 0 0 8px 0;">
                 <strong>AWB:</strong> ${awb}
               </p>`
            : ''
        }
        ${
          trackingLink
            ? `<p style="font-size: 13px; color: #111827; margin: 0 0 8px 0;">
                 <strong>Tracking link:</strong>
                 <a href="${trackingLink}" style="color: #2563eb; word-break: break-all;">${trackingLink}</a>
               </p>`
            : ''
        }
        <div style="margin-top: 12px;">
          ${
            labelUrl
              ? `<p style="font-size: 13px; color: #111827; margin: 0 0 6px 0;">
                   <a href="${labelUrl}" style="color: #2563eb; font-weight: 600;">Download Shipping Label (PDF)</a>
                 </p>`
              : ''
          }
          ${
            invoiceUrl
              ? `<p style="font-size: 13px; color: #111827; margin: 0;">
                   <a href="${invoiceUrl}" style="color: #2563eb; font-weight: 600;">Download Invoice (Customer Copy)</a>
                 </p>`
              : ''
          }
        </div>
        <p style="font-size: 12px; color: #6b7280; margin-top: 18px; border-top: 1px solid #e5e7eb; padding-top: 10px;">
          Make sure the label is clearly visible and not folded or covered with tape.
        </p>
      </div>
    </div>
  `
  },

  // Seller: Shipment status / pickup / delivery updates
  sellerShipmentStatusUpdate: (
    sellerName: string,
    options: {
      orderNumber: string
      statusLabel: string
      message?: string
      trackingLink?: string
    },
  ) => {
    const { orderNumber, statusLabel, message, trackingLink } = options
    return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; background-color: #0f172a;">
      <div style="background-color: #ffffff; border-radius: 10px; padding: 24px 28px; box-shadow: 0 10px 25px rgba(15,23,42,0.5); border: 1px solid #e5e7eb;">
        <h1 style="color: #111827; margin-bottom: 8px; font-size: 20px;">Shipment Update 🚚</h1>
        <p style="font-size: 14px; color: #4b5563; margin-top: 0; margin-bottom: 12px;">
          Hi ${sellerName}, the shipment for order <strong>${orderNumber}</strong> is now <strong>${statusLabel}</strong>.
        </p>
        ${
          message
            ? `<p style="font-size: 13px; color: #4b5563; margin-bottom: 10px;">${message}</p>`
            : ''
        }
        ${
          trackingLink
            ? `<p style="font-size: 13px; color: #111827; margin: 0 0 8px 0;">
                 <strong>Tracking link:</strong>
                 <a href="${trackingLink}" style="color: #2563eb; word-break: break-all;">${trackingLink}</a>
               </p>`
            : ''
        }
        <p style="font-size: 12px; color: #6b7280; margin-top: 18px; border-top: 1px solid #e5e7eb; padding-top: 10px;">
          You can also view this shipment in your Kourier Boyz Seller Hub → Orders.
        </p>
      </div>
    </div>
  `
  },

  // Customer: Response to contact form / support request
  contactFormResponse: (
    name: string,
    subject: string,
    originalMessage: string,
    response: string,
    orderId?: string, // Kept for backward compatibility but not used
    category?: string,
  ) => {
    const safeSubject = subject || 'Support request'
    const safeCategory = category || 'General'

    return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: #ffffff; border-radius: 10px; padding: 24px 28px; box-shadow: 0 10px 25px rgba(15,23,42,0.1); border: 1px solid #e5e7eb;">
        <h1 style="color: #111827; margin-bottom: 8px; font-size: 20px;">Thank you for contacting us</h1>
        <p style="font-size: 14px; color: #6b7280; margin-top: 0; margin-bottom: 16px;">
          Hi ${name},
        </p>
        <p style="font-size: 14px; color: #4b5563; margin-bottom: 10px;">
          Thank you for reaching out to us. We've reviewed your inquiry and our support team has provided a response below.
        </p>
        <div style="background-color: #f3f4f6; border-radius: 8px; padding: 14px 16px; margin-bottom: 16px;">
          <p style="margin: 0 0 6px 0; font-size: 13px; color: #111827;"><strong>Subject:</strong> ${safeSubject}</p>
          <p style="margin: 0; font-size: 13px; color: #374151;"><strong>Category:</strong> ${safeCategory}</p>
        </div>
        <div style="margin-bottom: 18px;">
          <p style="font-size: 13px; color: #6b7280; margin: 0 0 4px 0;">Your message:</p>
          <div style="background-color: #f9fafb; border-radius: 6px; padding: 10px 12px; font-size: 13px; color: #111827; white-space: pre-wrap;">
            ${originalMessage}
          </div>
        </div>
        <div style="margin-bottom: 12px;">
          <p style="font-size: 13px; color: #6b7280; margin: 0 0 4px 0;">Our response:</p>
          <div style="background-color: #ecfdf5; border-radius: 6px; padding: 10px 12px; font-size: 13px; color: #064e3b; white-space: pre-wrap;">
            ${response}
          </div>
        </div>
      </div>
    </div>
  `
  },

  deviceVerificationPasswordChange: (
    name: string,
    verificationUrl: string,
    ipAddress?: string,
    userAgent?: string,
  ) => {
    // Extract browser info from user agent for display
    let deviceInfo = 'your device'
    if (userAgent) {
      if (userAgent.includes('Chrome')) deviceInfo = 'Chrome browser'
      else if (userAgent.includes('Firefox')) deviceInfo = 'Firefox browser'
      else if (userAgent.includes('Safari')) deviceInfo = 'Safari browser'
      else if (userAgent.includes('Edge')) deviceInfo = 'Edge browser'
    }

    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #f59e0b; margin-bottom: 20px;">🔒 Verify Device for Password Change</h1>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Hi ${name},
        </p>
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
          <p style="margin: 0; color: #92400e; font-weight: 600;">
            A password change request was initiated from an unrecognized device.
          </p>
        </div>
        <p style="font-size: 16px; color: #374151; margin-bottom: 16px;">
          For your security, we need to verify this request before allowing your password to be changed.
        </p>
        <div style="background-color: #f3f4f6; border-radius: 6px; padding: 14px 16px; margin-bottom: 20px;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #111827;">
            <strong>Device:</strong> ${deviceInfo}
          </p>
          ${
            ipAddress
              ? `<p style="margin: 0; font-size: 14px; color: #111827;"><strong>Location:</strong> ${ipAddress}</p>`
              : ''
          }
        </div>
        <p style="font-size: 15px; color: #374151; margin-bottom: 20px;">
          Click the button below to verify this device and complete your password change:
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background-color: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            Verify Device & Change Password
          </a>
        </div>
        <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
          Or copy and paste this link in your browser:<br/>
          <a href="${verificationUrl}" style="color: #f59e0b; word-break: break-all;">${verificationUrl}</a>
        </p>
        <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          <strong>⚠️ Security Notice:</strong> If you didn't initiate this password change request, please ignore this email and contact support immediately. This verification link will expire in 1 hour.
        </p>
      </div>
    </div>
    `
  },

  // Seller: Settlement Generated
  sellerSettlementGenerated: (
    sellerName: string,
    options: {
      period: string
      netPayout: number
      settlementUrl: string
    },
  ) => {
    const { period, netPayout, settlementUrl } = options
    const isPositive = netPayout > 0
    const isNegative = netPayout < 0
    const amountColor = isPositive ? '#10b981' : isNegative ? '#ef4444' : '#6b7280'

    return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: #ffffff; border-radius: 10px; padding: 24px 28px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); border: 1px solid #e5e7eb;">
        <h1 style="color: #111827; margin-bottom: 8px; font-size: 22px;">Your Settlement is Ready 💰</h1>
        <p style="font-size: 14px; color: #6b7280; margin-top: 0; margin-bottom: 16px;">
          Hi ${sellerName},
        </p>
        <p style="font-size: 15px; color: #4b5563; margin-bottom: 16px;">
          Your settlement for <strong>${period}</strong> has been generated.
        </p>
        <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; margin-bottom: 20px; border-left: 4px solid ${amountColor};">
          <p style="margin: 0; font-size: 14px; color: #111827;">
            <strong>Net settlement amount:</strong>
          </p>
          <p style="margin: 8px 0 0 0; font-size: 24px; font-weight: bold; color: ${amountColor};">
            ₹${Math.abs(netPayout).toFixed(2)}
          </p>
        </div>
        <p style="font-size: 14px; color: #4b5563; margin-bottom: 20px;">
          This amount includes orders, refunds, returns, and adjustments during the period.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${settlementUrl}" 
             style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            View Settlement Details
          </a>
        </div>
        <p style="font-size: 12px; color: #6b7280; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 14px;">
          You can view detailed breakdown and download invoices from your Seller Hub.
        </p>
      </div>
    </div>
    `
  },

  // Seller: Settlement Paid / Payout Completed
  sellerSettlementPaid: (
    sellerName: string,
    options: {
      payoutAmount: number
      period: string
      payoutDate: string
      payoutReference?: string
      settlementUrl: string
    },
  ) => {
    const { payoutAmount, period, payoutDate, payoutReference, settlementUrl } = options
    const formattedDate = new Date(payoutDate).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })

    return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: #ffffff; border-radius: 10px; padding: 24px 28px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); border: 1px solid #e5e7eb;">
        <h1 style="color: #10b981; margin-bottom: 8px; font-size: 22px;">Payment Processed ✅</h1>
        <p style="font-size: 14px; color: #6b7280; margin-top: 0; margin-bottom: 16px;">
          Hi ${sellerName},
        </p>
        <div style="background-color: #ecfdf5; border-radius: 8px; padding: 16px; margin-bottom: 20px; border-left: 4px solid #10b981;">
          <p style="margin: 0; font-size: 24px; font-weight: bold; color: #10b981;">
            ₹${payoutAmount.toFixed(2)}
          </p>
          <p style="margin: 8px 0 0 0; font-size: 14px; color: #4b5563;">
            has been transferred to your registered bank account
          </p>
        </div>
        <div style="background-color: #f3f4f6; border-radius: 6px; padding: 14px; margin-bottom: 20px;">
          <p style="margin: 0 0 6px 0; font-size: 13px; color: #111827;">
            <strong>Settlement period:</strong> ${period}
          </p>
          <p style="margin: 0; font-size: 13px; color: #111827;">
            <strong>Payout date:</strong> ${formattedDate}
          </p>
          ${
            payoutReference
              ? `<p style="margin: 8px 0 0 0; font-size: 13px; color: #111827;">
                   <strong>Bank reference:</strong> ${payoutReference}
                 </p>`
              : ''
          }
        </div>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${settlementUrl}" 
             style="background-color: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            View Settlement Invoice
          </a>
        </div>
        <p style="font-size: 12px; color: #6b7280; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 14px;">
          The funds should reflect in your account within 1-2 business days, depending on your bank.
        </p>
      </div>
    </div>
    `
  },

  // Seller: Settlement Skipped (Negative Balance)
  sellerSettlementSkipped: (
    sellerName: string,
    options: {
      balance: number
      ledgerUrl: string
    },
  ) => {
    const { balance, ledgerUrl } = options
    const absBalance = Math.abs(balance)

    return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: #ffffff; border-radius: 10px; padding: 24px 28px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); border: 1px solid #e5e7eb;">
        <h1 style="color: #f59e0b; margin-bottom: 8px; font-size: 22px;">Settlement Update 📊</h1>
        <p style="font-size: 14px; color: #6b7280; margin-top: 0; margin-bottom: 16px;">
          Hi ${sellerName},
        </p>
        <p style="font-size: 15px; color: #4b5563; margin-bottom: 16px;">
          No payout was made for your recent settlement due to a negative balance.
        </p>
        <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
          <p style="margin: 0; font-size: 14px; color: #111827;">
            <strong>Current balance:</strong>
          </p>
          <p style="margin: 8px 0 0 0; font-size: 24px; font-weight: bold; color: #92400e;">
            ₹${absBalance.toFixed(2)}
          </p>
        </div>
        <p style="font-size: 14px; color: #4b5563; margin-bottom: 12px;">
          This can happen due to:
        </p>
        <ul style="font-size: 14px; color: #4b5563; margin: 0 0 20px 0; padding-left: 20px;">
          <li>Refunds processed after previous payouts</li>
          <li>Returns received for orders already settled</li>
          <li>Adjustments applied to your account</li>
        </ul>
        <p style="font-size: 14px; color: #4b5563; margin-bottom: 20px;">
          <strong>The balance will be automatically adjusted in your next settlement.</strong>
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${ledgerUrl}" 
             style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            View Ledger Details
          </a>
        </div>
        <p style="font-size: 12px; color: #6b7280; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 14px;">
          If you have questions about your balance, please contact our support team.
        </p>
      </div>
    </div>
    `
  },

  // Seller: Large Adjustment / Refund Applied
  sellerLargeAdjustment: (
    sellerName: string,
    options: {
      amount: number
      adjustmentType: 'credit' | 'debit' | 'refund'
      description?: string
      ledgerUrl: string
    },
  ) => {
    const { amount, adjustmentType, description, ledgerUrl } = options
    const isCredit = adjustmentType === 'credit'
    const typeLabel = isCredit ? 'Credit' : adjustmentType === 'refund' ? 'Refund' : 'Debit'
    const color = isCredit ? '#10b981' : '#ef4444'

    return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: #ffffff; border-radius: 10px; padding: 24px 28px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); border: 1px solid #e5e7eb;">
        <h1 style="color: #111827; margin-bottom: 8px; font-size: 22px;">Large Adjustment Applied ⚠️</h1>
        <p style="font-size: 14px; color: #6b7280; margin-top: 0; margin-bottom: 16px;">
          Hi ${sellerName},
        </p>
        <p style="font-size: 15px; color: #4b5563; margin-bottom: 16px;">
          A financial adjustment of <strong>₹${amount.toFixed(
            2,
          )}</strong> has been applied to your account.
        </p>
        <div style="background-color: ${
          isCredit ? '#ecfdf5' : '#fee2e2'
        }; border-radius: 8px; padding: 16px; margin-bottom: 20px; border-left: 4px solid ${color};">
          <p style="margin: 0; font-size: 14px; color: #111827;">
            <strong>Adjustment type:</strong> ${typeLabel}
          </p>
          <p style="margin: 8px 0 0 0; font-size: 24px; font-weight: bold; color: ${color};">
            ₹${amount.toFixed(2)}
          </p>
          ${
            description
              ? `<p style="margin: 8px 0 0 0; font-size: 13px; color: #4b5563;">${description}</p>`
              : ''
          }
        </div>
        <p style="font-size: 14px; color: #4b5563; margin-bottom: 20px;">
          This will affect your upcoming settlement.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${ledgerUrl}" 
             style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            View Ledger
          </a>
        </div>
        <p style="font-size: 12px; color: #6b7280; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 14px;">
          If you have questions about this adjustment, please contact our support team.
        </p>
      </div>
    </div>
    `
  },

  // Seller: Monthly Financial Summary
  sellerMonthlySummary: (
    sellerName: string,
    options: {
      month: string
      totalSettlements: number
      totalRefundsReturns: number
      totalAdjustments: number
      summaryUrl: string
    },
  ) => {
    const { month, totalSettlements, totalRefundsReturns, totalAdjustments, summaryUrl } = options

    return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: #ffffff; border-radius: 10px; padding: 24px 28px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); border: 1px solid #e5e7eb;">
        <h1 style="color: #111827; margin-bottom: 8px; font-size: 22px;">Monthly Settlement Summary 📈</h1>
        <p style="font-size: 14px; color: #6b7280; margin-top: 0; margin-bottom: 16px;">
          Hi ${sellerName},
        </p>
        <p style="font-size: 15px; color: #4b5563; margin-bottom: 20px;">
          Here's your financial summary for <strong>${month}</strong>:
        </p>
        <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
            <span style="font-size: 14px; color: #111827;">Total settlements paid:</span>
            <span style="font-size: 14px; font-weight: bold; color: #10b981;">₹${totalSettlements.toFixed(
              2,
            )}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
            <span style="font-size: 14px; color: #111827;">Refunds & returns:</span>
            <span style="font-size: 14px; font-weight: bold; color: #ef4444;">₹${totalRefundsReturns.toFixed(
              2,
            )}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="font-size: 14px; color: #111827;">Adjustments:</span>
            <span style="font-size: 14px; font-weight: bold; color: #6b7280;">₹${totalAdjustments.toFixed(
              2,
            )}</span>
          </div>
        </div>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${summaryUrl}" 
             style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            View Full Breakdown
          </a>
        </div>
        <p style="font-size: 12px; color: #6b7280; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 14px;">
          Thank you for being part of our seller community! 🚀
        </p>
      </div>
    </div>
    `
  },

  // Ticket: New message notification
  ticketMessageNotification: (
    recipientName: string,
    ticketNumber: string,
    subject: string,
    senderName: string,
    message: string,
    ticketUrl: string | null,
    ticketType: 'customer' | 'seller' = 'seller',
  ) => {
    const platform = ticketType === 'seller' ? 'Seller Hub' : 'Kourier Boyz'
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #2563eb; margin-bottom: 20px;">New Message on Support Ticket</h1>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Hi ${recipientName},
        </p>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          You have received a new message on your support ticket.
        </p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;"><strong>Ticket:</strong> ${ticketNumber}</p>
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;"><strong>Subject:</strong> ${subject}</p>
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;"><strong>From:</strong> ${senderName}</p>
          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #d1d5db;">
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;"><strong>Message:</strong></p>
            <p style="margin: 0; font-size: 14px; color: #374151; white-space: pre-wrap;">${message}</p>
          </div>
        </div>
        ${
          ticketUrl
            ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${ticketUrl}" 
             style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            View Ticket
          </a>
        </div>
        `
            : ''
        }
        <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          Our support team typically responds within 24-48 hours during business days.
        </p>
      </div>
    </div>
    `
  },

  deactivationRequested: (name: string, businessName: string = '') => {
    const businessText = businessName ? ` for ${businessName}` : ''
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #f59e0b; margin-bottom: 20px;">Deactivation Request Received</h1>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Hi ${name},
        </p>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          We have received your account deactivation request${businessText}. Our admin team will review your request and notify you of the decision.
        </p>
        <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          During the review period, your products have been unlisted and new orders are blocked. You can still access your account to view invoices and settlement information.
        </p>
      </div>
    </div>
    `
  },

  deactivationApproved: (name: string, businessName: string = '') => {
    const businessText = businessName ? ` for ${businessName}` : ''
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #ef4444; margin-bottom: 20px;">Account Deactivation Approved</h1>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Hi ${name},
        </p>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Your account deactivation request${businessText} has been approved by our admin team. Your seller account is now deactivated.
        </p>
        <p style="font-size: 14px; color: #6b7280; background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <strong>What this means:</strong><br/>
          • All products are unlisted from the marketplace<br/>
          • New orders cannot be placed<br/>
          • You can still view invoices and settlement information<br/>
          • To reactivate, please contact admin support
        </p>
        <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          Thank you for being part of our seller community. If you have any questions, please contact our support team.
        </p>
      </div>
    </div>
    `
  },

  deactivationRejected: (name: string, reason: string, businessName: string = '') => {
    const businessText = businessName ? ` for ${businessName}` : ''
    const sellerPanelUrl = getSellerPanelUrl()
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #10b981; margin-bottom: 20px;">Deactivation Request Update</h1>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Hi ${name},
        </p>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Your account deactivation request${businessText} has been reviewed by our admin team.
        </p>
        <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; color: #991b1b;"><strong>Reason for rejection:</strong></p>
          <p style="margin: 10px 0 0 0; color: #7f1d1d;">${reason}</p>
        </div>
        <p style="font-size: 14px; color: #374151; margin: 20px 0;">
          Your account status has been reverted to active. You can continue using the seller panel. Note that your store status remains inactive - you'll need to manually re-enable it from your settings.
        </p>
        ${
          sellerPanelUrl
            ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${sellerPanelUrl}/profile" 
             style="background-color: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            Go to Profile
          </a>
        </div>
        `
            : ''
        }
        <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          If you have any questions, please contact our support team.
        </p>
      </div>
    </div>
    `
  },

  sellerReactivated: (name: string, businessName: string = '') => {
    const businessText = businessName ? ` for ${businessName}` : ''
    const sellerPanelUrl = getSellerPanelUrl()
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #10b981; margin-bottom: 20px;">Account Reactivated</h1>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Hi ${name},
        </p>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Your seller account${businessText} has been reactivated by our admin team. You can now access the seller panel again.
        </p>
        <p style="font-size: 14px; color: #6b7280; background-color: #f0fdf4; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <strong>Note:</strong> Your store status remains inactive. Please re-enable it from your profile settings to start receiving orders again.
        </p>
        ${
          sellerPanelUrl
            ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${sellerPanelUrl}/profile" 
             style="background-color: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            Go to Profile
          </a>
        </div>
        `
            : ''
        }
        <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          Welcome back! If you need any assistance, please contact our support team.
        </p>
      </div>
    </div>
    `
  },

  buyerDeactivationRequest: (name: string) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #f59e0b; margin-bottom: 20px;">Account Deactivation Request Received</h1>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Hi ${name},
        </p>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          We have received your request to deactivate your buyer account on Kourier Boyz.
        </p>
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; color: #92400e; font-weight: 600;">Please note:</p>
          <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #92400e;">
            <li>You will not be able to log in after deactivation</li>
            <li>Your order history and invoices will remain accessible for record-keeping</li>
            <li>Refunds and returns will still be processed if applicable</li>
          </ul>
        </div>
        <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          Your account will be deactivated immediately after confirmation. If you did not request this, please contact support immediately.
        </p>
      </div>
    </div>
  `,

  buyerDeactivationConfirmed: (email: string) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #ef4444; margin-bottom: 20px;">Account Deactivated</h1>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Your buyer account (${email}) has been successfully deactivated.
        </p>
        <p style="font-size: 14px; color: #6b7280; background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <strong>What this means:</strong><br/>
          • You will not be able to log in to your account<br/>
          • Your order history and invoices remain preserved for record-keeping<br/>
          • Refunds and returns will still be processed if applicable<br/>
          • Support tickets related to your orders will still be handled
        </p>
        <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          If you wish to reactivate your account in the future, please contact our support team. We're sorry to see you go and hope to serve you again in the future.
        </p>
      </div>
    </div>
  `,

  certificateExpiredSeller: (
    sellerName: string,
    certificateType: string,
    affectedProductCount: number,
    certificatesUrl: string,
  ) => {
    const certificateLabel = certificateType
      .split('_')
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ')

    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #ef4444; margin-bottom: 20px;">⚠️ Certificate Expired</h1>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Hi ${sellerName},
        </p>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Your <strong>${certificateLabel}</strong> certificate has expired.
        </p>
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; color: #991b1b; font-weight: 600;">Important:</p>
          <p style="margin: 10px 0 0 0; color: #991b1b;">
            ${affectedProductCount} of your live product(s) ${
      affectedProductCount === 1 ? 'has' : 'have'
    } been moved to pending approval status. These products will remain unavailable until you upload a renewed certificate and it is approved by our admin team.
          </p>
        </div>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          <strong>What you need to do:</strong>
        </p>
        <ol style="font-size: 14px; color: #374151; margin-bottom: 20px; padding-left: 20px;">
          <li>Upload your renewed ${certificateLabel} certificate</li>
          <li>Wait for admin approval</li>
          <li>Your products will be automatically reactivated once the certificate is approved</li>
        </ol>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${certificatesUrl}" 
             style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            Upload Certificate
          </a>
        </div>
        <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          If you have any questions or need assistance, please contact our support team.
        </p>
      </div>
    </div>
  `
  },

  certificateExpiredAdmin: (
    sellerName: string,
    sellerEmail: string,
    certificateType: string,
    affectedProductCount: number,
    productsUrl: string,
  ) => {
    const certificateLabel = certificateType
      .split('_')
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ')

    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #f59e0b; margin-bottom: 20px;">⚠️ Certificate Expired - Action Required</h1>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          A seller's certificate has expired and requires your attention.
        </p>
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; color: #92400e; font-weight: 600;">Details:</p>
          <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #92400e;">
            <li><strong>Seller:</strong> ${sellerName} (${sellerEmail})</li>
            <li><strong>Certificate:</strong> ${certificateLabel}</li>
            <li><strong>Affected Products:</strong> ${affectedProductCount} product(s) moved to pending approval</li>
          </ul>
        </div>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          The affected products have been automatically moved to <strong>pending approval</strong> status. They will remain unavailable until:
        </p>
        <ol style="font-size: 14px; color: #374151; margin-bottom: 20px; padding-left: 20px;">
          <li>The seller uploads a renewed certificate</li>
          <li>You approve the new certificate</li>
        </ol>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${productsUrl}" 
             style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            Review Products
          </a>
        </div>
        <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          Please monitor the seller's certificate uploads and approve them promptly to restore their products.
        </p>
      </div>
    </div>
  `
  },

  couponCreated: (
    sellerName: string,
    couponCode: string,
    couponDetails: string,
    dashboardUrl: string | null,
  ) => {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #10b981; margin-bottom: 20px;">🎉 New Coupon Created</h1>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Hi ${sellerName},
        </p>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          A new coupon has been created by the admin that may affect your products:
        </p>
        <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; color: #166534; font-weight: 600;">Coupon Details:</p>
          <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #166534;">
            <li><strong>Code:</strong> ${couponCode}</li>
            ${couponDetails}
          </ul>
        </div>
        <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
          This coupon may impact your product sales. Please review your pricing and inventory accordingly.
        </p>
        ${
          dashboardUrl
            ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${dashboardUrl}" 
             style="background-color: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            View Dashboard
          </a>
        </div>
        `
            : ''
        }
      </div>
    </div>
  `
  },

  couponUpdated: (
    sellerName: string,
    couponCode: string,
    couponDetails: string,
    dashboardUrl: string | null,
  ) => {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #2563eb; margin-bottom: 20px;">📝 Coupon Updated</h1>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Hi ${sellerName},
        </p>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          An admin has updated a coupon that may affect your products:
        </p>
        <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; color: #1e40af; font-weight: 600;">Updated Coupon Details:</p>
          <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #1e40af;">
            <li><strong>Code:</strong> ${couponCode}</li>
            ${couponDetails}
          </ul>
        </div>
        <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
          Please review the changes and adjust your strategy if needed.
        </p>
        ${
          dashboardUrl
            ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${dashboardUrl}" 
             style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            View Dashboard
          </a>
        </div>
        `
            : ''
        }
      </div>
    </div>
  `
  },

  couponDeleted: (sellerName: string, couponCode: string, dashboardUrl: string | null) => {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #ef4444; margin-bottom: 20px;">🗑️ Coupon Deleted</h1>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Hi ${sellerName},
        </p>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          An admin has deleted a coupon that may have affected your products:
        </p>
        <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; color: #991b1b; font-weight: 600;">Deleted Coupon:</p>
          <p style="margin: 10px 0 0 0; color: #991b1b;"><strong>Code:</strong> ${couponCode}</p>
        </div>
        <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
          This coupon is no longer available for use. Customers will not be able to apply it to their orders.
        </p>
        ${
          dashboardUrl
            ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${dashboardUrl}" 
             style="background-color: #ef4444; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            View Dashboard
          </a>
        </div>
        `
            : ''
        }
      </div>
    </div>
  `
  },

  certificateApprovedWithProduct: (
    sellerName: string,
    productName: string,
    certificateLabels: string,
    productUrl: string | null,
  ) => {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #10b981; margin-bottom: 20px;">✅ Certificates Approved</h1>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Hi ${sellerName},
        </p>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Great news! Your product <strong>${productName}</strong> has been approved by our admin team.
        </p>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          The following certificate(s) have been automatically approved:
        </p>
        <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; color: #166534; font-weight: 600;">Approved Certificates:</p>
          <p style="margin: 10px 0 0 0; color: #166534;">${certificateLabels}</p>
        </div>
        <p style="font-size: 14px; color: #374151; margin-bottom: 20px;">
          Future products using these approved certificates will be automatically approved and activated.
        </p>
        ${
          productUrl
            ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${productUrl}" 
             style="background-color: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            View Product
          </a>
        </div>
        `
            : ''
        }
        <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          Thank you for being part of our seller community!
        </p>
      </div>
    </div>
  `
  },

  sellerCouponStatusChanged: (
    sellerName: string,
    couponCode: string,
    status: string,
    reason: string,
    dashboardUrl: string | null,
  ) => {
    const isActive = status === 'active'
    const statusLabel = isActive ? 'Activated' : 'Paused'
    const statusColor = isActive ? '#10b981' : '#f59e0b'
    const bgColor = isActive ? '#f0fdf4' : '#fef3c7'
    const borderColor = isActive ? '#10b981' : '#f59e0b'
    const textColor = isActive ? '#166534' : '#92400e'
    const buttonColor = isActive ? '#10b981' : '#f59e0b'
    const emoji = isActive ? '✅' : '⏸️'

    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: ${statusColor}; margin-bottom: 20px;">${emoji} Coupon ${statusLabel}</h1>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Hi ${sellerName},
        </p>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          An admin has ${status === 'active' ? 'activated' : 'paused'} your coupon:
        </p>
        <div style="background-color: ${bgColor}; border-left: 4px solid ${borderColor}; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; color: ${textColor}; font-weight: 600;">Coupon Details:</p>
          <ul style="margin: 10px 0 0 0; padding-left: 20px; color: ${textColor};">
            <li><strong>Code:</strong> ${couponCode}</li>
            <li><strong>Status:</strong> ${statusLabel}</li>
            ${reason ? `<li><strong>Reason:</strong> ${reason}</li>` : ''}
          </ul>
        </div>
        <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
          ${
            isActive
              ? 'Your coupon is now active and customers can use it for their orders.'
              : 'Your coupon has been paused and is temporarily unavailable to customers.'
          }
        </p>
        ${
          dashboardUrl
            ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${dashboardUrl}" 
             style="background-color: ${buttonColor}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            View Coupons
          </a>
        </div>
        `
            : ''
        }
      </div>
    </div>
  `
  },

  // Brand Approval Notifications
  brandRequestSubmitted: (
    sellerName: string,
    sellerEmail: string,
    brandName: string,
    brandType: string,
    adminDashboardUrl: string | null,
  ) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #2563eb; margin-bottom: 20px;">📋 New Brand Approval Request</h1>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          A new brand approval request has been submitted and requires your review.
        </p>
        <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; color: #1e40af; font-weight: 600;">Brand Details:</p>
          <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #1e40af;">
            <li><strong>Brand Name:</strong> ${brandName}</li>
            <li><strong>Brand Type:</strong> ${
              brandType === 'OWN' ? 'Own Brand' : 'Other Brand'
            }</li>
            <li><strong>Seller:</strong> ${sellerName}</li>
            <li><strong>Seller Email:</strong> ${sellerEmail}</li>
          </ul>
        </div>
        <p style="font-size: 14px; color: #374151; margin-bottom: 20px;">
          Please review the brand request and uploaded documents in the admin dashboard.
        </p>
        ${
          adminDashboardUrl
            ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${adminDashboardUrl}" 
             style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            Review Brand Request
          </a>
        </div>
        `
            : ''
        }
      </div>
    </div>
  `,

  brandApproved: (sellerName: string, brandName: string, dashboardUrl: string | null) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #10b981; margin-bottom: 20px;">✅ Brand Approved!</h1>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Hi ${sellerName},
        </p>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Great news! Your brand <strong>"${brandName}"</strong> has been approved by our admin team.
        </p>
        <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; color: #166534; font-weight: 600;">What's Next?</p>
          <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #166534;">
            <li>You can now use this brand when creating products</li>
            <li>Products created with this brand will be eligible for listing</li>
            <li>Make sure your KYC is also approved to list products</li>
          </ul>
        </div>
        ${
          dashboardUrl
            ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${dashboardUrl}" 
             style="background-color: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            View Brands
          </a>
        </div>
        `
            : ''
        }
        <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          Thank you for being part of our seller community! 🚀
        </p>
      </div>
    </div>
  `,

  brandRejected: (
    sellerName: string,
    brandName: string,
    rejectionReason: string,
    dashboardUrl: string | null,
  ) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #ef4444; margin-bottom: 20px;">❌ Brand Request Rejected</h1>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Hi ${sellerName},
        </p>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Unfortunately, your brand request for <strong>"${brandName}"</strong> has been rejected by our admin team.
        </p>
        ${
          rejectionReason
            ? `
        <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; color: #991b1b; font-weight: 600;">Rejection Reason:</p>
          <p style="margin: 10px 0 0 0; color: #991b1b;">${rejectionReason}</p>
        </div>
        `
            : ''
        }
        <p style="font-size: 14px; color: #374151; margin-bottom: 20px;">
          You can submit a new brand request with corrected information or additional documents.
        </p>
        ${
          dashboardUrl
            ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${dashboardUrl}" 
             style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            View Brands
          </a>
        </div>
        `
            : ''
        }
        <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          If you have any questions, please contact our support team.
        </p>
      </div>
    </div>
  `,

  brandNeedsMoreDocs: (
    sellerName: string,
    brandName: string,
    rejectionReason: string,
    dashboardUrl: string | null,
  ) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #f59e0b; margin-bottom: 20px;">📄 Additional Documents Required</h1>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Hi ${sellerName},
        </p>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Your brand request for <strong>"${brandName}"</strong> requires additional documents for review.
        </p>
        ${
          rejectionReason
            ? `
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; color: #92400e; font-weight: 600;">Admin Notes:</p>
          <p style="margin: 10px 0 0 0; color: #92400e;">${rejectionReason}</p>
        </div>
        `
            : ''
        }
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; color: #92400e; font-weight: 600;">Action Required:</p>
          <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #92400e;">
            <li>Please upload the requested documents</li>
            <li>Ensure all documents are clear and valid</li>
            <li>Your brand will be reviewed again once documents are submitted</li>
          </ul>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${dashboardUrl}" 
             style="background-color: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            Upload Documents
          </a>
        </div>
        <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          If you have any questions about required documents, please contact our support team.
        </p>
      </div>
    </div>
  `,

  brandRevoked: (
    sellerName: string,
    brandName: string,
    rejectionReason: string,
    dashboardUrl: string | null,
  ) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #ef4444; margin-bottom: 20px;">⚠️ Brand Revoked</h1>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Hi ${sellerName},
        </p>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Your brand <strong>"${brandName}"</strong> has been revoked by our admin team.
        </p>
        ${
          rejectionReason
            ? `
        <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; color: #991b1b; font-weight: 600;">Reason:</p>
          <p style="margin: 10px 0 0 0; color: #991b1b;">${rejectionReason}</p>
        </div>
        `
            : ''
        }
        <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; color: #991b1b; font-weight: 600;">Important:</p>
          <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #991b1b;">
            <li>All active products under this brand have been disabled</li>
            <li>You cannot create new products with this brand</li>
            <li>You can submit a new brand request if needed</li>
          </ul>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${dashboardUrl}" 
             style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            View Brands
          </a>
        </div>
        <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          If you have any questions, please contact our support team.
        </p>
      </div>
    </div>
  `,

  paymentIntentExpired: (name: string, options: { razorpayOrderId: string; total: number }) => {
    const { razorpayOrderId, total } = options
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #f59e0b; margin-bottom: 20px;">⏰ Payment Session Expired</h1>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Hi ${name},
        </p>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Your payment session for order <strong>${razorpayOrderId}</strong> has expired. The payment window was open for 30 minutes, but no payment was completed.
        </p>
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; color: #92400e; font-weight: 600;">Order Total: ₹${total.toFixed(
            2,
          )}</p>
        </div>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Don't worry! Your items are still in your cart. You can complete your purchase by going through the checkout process again.
        </p>
        ${(() => {
          const frontendUrl = getFrontendUrl()
          return frontendUrl
            ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${frontendUrl}/checkout/review" 
             style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            Complete Your Purchase
          </a>
        </div>
        `
            : ''
        })()}
        <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          If you have any questions or need assistance, please contact our support team.
        </p>
      </div>
    </div>
  `
  },

  adminAlert: (options: {
    title: string
    message: string
    severity?: 'info' | 'warning' | 'critical'
    actionUrl?: string
  }) => {
    const { title, message, severity = 'info', actionUrl } = options
    const colorMap = {
      info: '#2563eb',
      warning: '#f59e0b',
      critical: '#ef4444',
    }
    const bgColorMap = {
      info: '#dbeafe',
      warning: '#fef3c7',
      critical: '#fee2e2',
    }
    const color = colorMap[severity]
    const bgColor = bgColorMap[severity]

    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: ${color}; margin-bottom: 20px;">${
      severity === 'critical' ? '🚨' : severity === 'warning' ? '⚠️' : 'ℹ️'
    } ${title}</h1>
        <div style="background-color: ${bgColor}; border-left: 4px solid ${color}; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; color: #374151; font-size: 16px; line-height: 1.6;">
            ${message}
          </p>
        </div>
        ${
          actionUrl
            ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${actionUrl}" 
             style="background-color: ${color}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            View Details
          </a>
        </div>
        `
            : ''
        }
        <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          This is an automated alert from the Kourier Boyz system. Please take appropriate action.
        </p>
      </div>
    </div>
  `
  },

  categoryExtensionApproved: (
    sellerName: string,
    brandName: string,
    categoryName: string,
    dashboardUrl: string | null,
  ) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #10b981; margin-bottom: 20px;">✅ Category Approved!</h1>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Hi ${sellerName},
        </p>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Great news! Your request to sell <strong>"${brandName}"</strong> products in the <strong>"${categoryName}"</strong> category has been approved.
        </p>
        <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; color: #166534; font-weight: 600;">What's Next?</p>
          <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #166534;">
            <li>You can now list unlimited products under ${brandName} in ${categoryName}</li>
            <li>Products that were waiting for approval have been automatically unblocked</li>
            <li>No further approval is needed for this brand + category combination</li>
          </ul>
        </div>
        ${
          dashboardUrl
            ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${dashboardUrl}" 
             style="background-color: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            View Products
          </a>
        </div>
        `
            : ''
        }
        <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          Thank you for being part of our seller community! 🚀
        </p>
      </div>
    </div>
  `,

  categoryExtensionRejected: (
    sellerName: string,
    brandName: string,
    categoryName: string,
    rejectionReason: string,
    dashboardUrl: string | null,
  ) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #ef4444; margin-bottom: 20px;">❌ Category Request Rejected</h1>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Hi ${sellerName},
        </p>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Unfortunately, your request to sell <strong>"${brandName}"</strong> products in the <strong>"${categoryName}"</strong> category has been rejected.
        </p>
        ${
          rejectionReason
            ? `
        <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; color: #991b1b; font-weight: 600;">Rejection Reason:</p>
          <p style="margin: 10px 0 0 0; color: #991b1b;">${rejectionReason}</p>
        </div>
        `
            : ''
        }
        <p style="font-size: 14px; color: #374151; margin-bottom: 20px;">
          Products in this category will remain blocked. You can request approval again with additional information if needed.
        </p>
        ${
          dashboardUrl
            ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${dashboardUrl}" 
             style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            View Products
          </a>
        </div>
        `
            : ''
        }
        <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          If you have any questions, please contact our support team.
        </p>
      </div>
    </div>
  `,

  categoryExtensionNeedsMoreDocs: (
    sellerName: string,
    brandName: string,
    categoryName: string,
    rejectionReason: string,
    dashboardUrl: string | null,
  ) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #f59e0b; margin-bottom: 20px;">📄 Additional Information Required</h1>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Hi ${sellerName},
        </p>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Your request to sell <strong>"${brandName}"</strong> products in the <strong>"${categoryName}"</strong> category requires additional information for review.
        </p>
        ${
          rejectionReason
            ? `
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; color: #92400e; font-weight: 600;">Admin Notes:</p>
          <p style="margin: 10px 0 0 0; color: #92400e;">${rejectionReason}</p>
        </div>
        `
            : ''
        }
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; color: #92400e; font-weight: 600;">Action Required:</p>
          <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #92400e;">
            <li>Please provide the requested information</li>
            <li>Your request will be reviewed again once submitted</li>
            <li>Products in this category will remain blocked until approved</li>
          </ul>
        </div>
        ${
          dashboardUrl
            ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${dashboardUrl}" 
             style="background-color: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            View Products
          </a>
        </div>
        `
            : ''
        }
        <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          If you have any questions, please contact our support team.
        </p>
      </div>
    </div>
  `,

  brandCategoriesAdded: (
    sellerName: string,
    brandName: string,
    categoryNames: string[],
    dashboardUrl: string | null,
  ) => {
    const listHtml =
      categoryNames.length > 0
        ? `<ul style="margin: 10px 0 0 0; padding-left: 20px; color: #166534;">${categoryNames.map((c) => `<li>${c}</li>`).join('')}</ul>`
        : ''
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #10b981; margin-bottom: 20px;">✅ Categories Added to Your Brand</h1>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Hi ${sellerName},
        </p>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Admin has assigned additional categories to your brand <strong>"${brandName}"</strong>. You can now list products in these categories:
        </p>
        <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; border-radius: 6px; margin: 20px 0;">
          ${listHtml}
        </div>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
          Products that were waiting for category approval in these categories have been automatically unblocked for review.
        </p>
        ${
          dashboardUrl
            ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${dashboardUrl}"
             style="background-color: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            View Products
          </a>
        </div>
        `
            : ''
        }
        <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          Thank you for being part of our seller community!
        </p>
      </div>
    </div>
  `
  },
}
