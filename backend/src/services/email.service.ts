import nodemailer from 'nodemailer'

// SMTP Configuration
const getTransporter = () => {
  // Check if SMTP is configured
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('⚠️ SMTP not configured. Emails will be logged to console.')
    return null
  }

  const portNum = Number(process.env.SMTP_PORT) || 587
  const isSecure = portNum === 465
  const isTLS = portNum === 587

  const transportOptions: any = {
    host: process.env.SMTP_HOST,
    port: portNum,
    secure: isSecure, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    // Optimized for Render.com and cloud deployments
    connectionTimeout: 30000, // 30 seconds connection timeout
    socketTimeout: 30000, // 30 seconds socket timeout
    greetingTimeout: 30000, // 30 seconds greeting timeout
    pool: false, // Don't use connection pooling (can cause issues on Render.com)
    maxConnections: 1, // Single connection for Render.com compatibility
    maxMessages: 1, // Send one message per connection
  }

  // Add TLS options for port 587
  if (isTLS) {
    transportOptions.requireTLS = true
  }

  // TLS configuration for Render.com compatibility
  transportOptions.tls = {
    rejectUnauthorized: false, // Don't fail on invalid certificates
    minVersion: 'TLSv1.2', // Use modern TLS version for Render.com compatibility
  }

  return nodemailer.createTransport(transportOptions)
}

interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  from?: string
  replyTo?: string
}

interface SendBulkEmailOptions {
  recipients: Array<{ email: string; name?: string; unsubscribeToken?: string }>
  subject: string
  html: string
  from?: string
  replyTo?: string
  // For personalization - {{name}} will be replaced with recipient's name
  personalize?: boolean
  // Frontend URL for unsubscribe links
  frontendUrl?: string
}

/**
 * Send a single email
 */
export const sendEmailViaSMTP = async (
  options: SendEmailOptions,
): Promise<{ success: boolean; error?: string }> => {
  const { to, subject, html, from, replyTo } = options
  const transporter = getTransporter()

  const fromAddress = from || process.env.SMTP_FROM || 'noreply@kourierboyz.com'

  if (!transporter) {
    // Fallback to console logging if SMTP not configured
    console.log('\n📧 ============ EMAIL (SMTP NOT CONFIGURED) ============')
    console.log(`From: ${fromAddress}`)
    console.log(`To: ${Array.isArray(to) ? to.join(', ') : to}`)
    console.log(`Subject: ${subject}`)
    console.log(`Body:\n${html.substring(0, 500)}...`)
    console.log('========================================================\n')
    return { success: true }
  }

  try {
    await transporter.sendMail({
      from: fromAddress,
      //   to:"harshitarajpal.dev@gmail.com",
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html,
      replyTo: replyTo || fromAddress,
    })
    return { success: true }
  } catch (error: any) {
    console.error('Failed to send email:', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Send bulk emails with optional personalization
 * Uses batching to avoid overwhelming SMTP server
 */
export const sendBulkEmailViaSMTP = async (
  options: SendBulkEmailOptions,
): Promise<{
  success: boolean
  sent: number
  failed: number
  errors: string[]
}> => {
  const { recipients, subject, html, from, replyTo, personalize = true, frontendUrl } = options
  const transporter = getTransporter()

  const fromAddress = from || process.env.SMTP_FROM || 'noreply@kourierboyz.com'
  const results = { success: true, sent: 0, failed: 0, errors: [] as string[] }
  const baseFrontendUrl = frontendUrl || process.env.FRONTEND_URL || 'http://localhost:5173'

  if (!transporter) {
    // Fallback to console logging if SMTP not configured
    console.log('\n📧 ============ BULK EMAIL (SMTP NOT CONFIGURED) ============')
    console.log(`From: ${fromAddress}`)
    console.log(`Recipients: ${recipients.length}`)
    console.log(`Subject: ${subject}`)
    console.log(`Body:\n${html.substring(0, 500)}...`)
    console.log('==============================================================\n')
    results.sent = recipients.length
    return results
  }

  // Process in batches of 10 to avoid overwhelming SMTP server
  const BATCH_SIZE = 10
  const DELAY_BETWEEN_BATCHES = 1000 // 1 second

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE)

    const promises = batch.map(async (recipient) => {
      try {
        let personalizedHtml = html

        // Replace personalization tokens
        if (personalize) {
          const recipientName = recipient.name || 'Valued Customer'
          const firstName = recipientName.split(' ')[0] || recipientName

          // Generate unsubscribe URL with token if available
          let unsubscribeUrl = `${baseFrontendUrl}/unsubscribe`
          if (recipient.unsubscribeToken) {
            unsubscribeUrl = `${baseFrontendUrl}/unsubscribe?token=${recipient.unsubscribeToken}`
          } else if (recipient.email) {
            // Fallback to email-based unsubscribe if no token
            unsubscribeUrl = `${baseFrontendUrl}/unsubscribe?email=${encodeURIComponent(
              recipient.email,
            )}`
          }

          // Account settings URL for managing preferences
          const accountSettingsUrl = `${baseFrontendUrl}/profile/notifications`

          // Shop URL
          const shopUrl = `${baseFrontendUrl}/shop-by-category`
          const exploreUrl = `${baseFrontendUrl}`

          // Replace old format placeholders (backward compatibility)
          personalizedHtml = html
            .replace(/{{name}}/g, recipientName)
            .replace(/{{email}}/g, recipient.email)
            .replace(/{{unsubscribeUrl}}/g, unsubscribeUrl)
            .replace(/{{accountSettingsUrl}}/g, accountSettingsUrl)

          // Replace new format placeholders
          personalizedHtml = personalizedHtml
            .replace(/\[First Name\]/g, firstName)
            .replace(/\[Full Name\]/g, recipientName)
            .replace(/\[Email\]/g, recipient.email)
            .replace(
              /\[Unsubscribe Link\]/g,
              `<a href="${unsubscribeUrl}" style="color: #6c757d; text-decoration: underline;">Unsubscribe</a>`,
            )
            .replace(
              /\[Shop Now Button\]/g,
              `
              <a href="${shopUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0;">Shop Now</a>
            `,
            )
            .replace(
              /\[Explore Button\]/g,
              `
              <a href="${exploreUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0;">Explore</a>
            `,
            )
        }

        await transporter.sendMail({
          from: fromAddress,
          to: recipient.email,
          subject,
          html: personalizedHtml,
          replyTo: replyTo || fromAddress,
        })

        results.sent++
      } catch (error: any) {
        results.failed++
        results.errors.push(`${recipient.email}: ${error.message}`)
      }
    })

    await Promise.all(promises)

    // Add delay between batches (except for the last batch)
    if (i + BATCH_SIZE < recipients.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES))
    }
  }

  results.success = results.failed === 0

  return results
}

/**
 * Verify SMTP connection
 */
export const verifySMTPConnection = async (): Promise<{
  success: boolean
  error?: string
}> => {
  const transporter = getTransporter()

  if (!transporter) {
    return { success: false, error: 'SMTP not configured' }
  }

  try {
    await transporter.verify()
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Email templates for promotional emails
 */
export const promotionalEmailTemplates = {
  /**
   * Wrap content in a beautiful email template
   */
  wrapInTemplate: (
    content: string,
    options: {
      previewText?: string
      unsubscribeUrl?: string
      logoUrl?: string
      brandName?: string
      frontendUrl?: string
    } = {},
  ) => {
    const { previewText, unsubscribeUrl, logoUrl, brandName = 'Kourier Boyz', frontendUrl } = options

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${brandName}</title>
  ${
    previewText
      ? `<!--[if !mso]><!--><meta name="x-apple-disable-message-reformatting"><!--<![endif]--><span style="display:none;font-size:0;color:#fff;line-height:0;max-height:0;max-width:0;opacity:0;overflow:hidden;">${previewText}</span>`
      : ''
  }
  <style>
    body { 
      margin: 0; 
      padding: 0; 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
      background-color: #f5f5f5;
    }
    .email-wrapper { 
      max-width: 600px; 
      margin: 0 auto; 
      background-color: #ffffff; 
      border-radius: 12px; 
      overflow: hidden; 
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    }
    .email-header { 
      background-color: #ffffff;
      padding: 32px 24px; 
      text-align: center; 
      border-bottom: 1px solid #e9ecef;
    }
    .email-body { 
      padding: 40px 32px; 
      line-height: 1.7;
      color: #333333;
      font-size: 16px;
    }
    .email-body h1, .email-body h2, .email-body h3 {
      color: #1a1a2e;
      margin-top: 0;
    }
    .email-body p {
      margin: 0 0 16px 0;
      color: #555555;
    }
    .email-body img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      display: block;
    }
    .email-body a {
      color: #667eea;
      text-decoration: none;
    }
    .email-body a:hover {
      text-decoration: underline;
    }
    .email-footer { 
      background-color: #f8f9fa; 
      padding: 32px 24px; 
      text-align: center; 
      font-size: 13px; 
      color: #6c757d;
      border-top: 1px solid #e9ecef;
    }
    .email-footer a { 
      color: #667eea; 
      text-decoration: underline; 
    }
    .email-footer a:hover {
      color: #764ba2;
    }
    @media only screen and (max-width: 600px) {
      .email-wrapper { 
        border-radius: 0;
        box-shadow: none;
      }
      .email-body { 
        padding: 32px 24px; 
        font-size: 15px;
      }
      .email-header {
        padding: 24px 20px;
      }
      .email-footer {
        padding: 24px 20px;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">
        <table role="presentation" class="email-wrapper" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td class="email-header" style="background-color: #ffffff; padding: 32px 24px; text-align: center; border-bottom: 1px solid #e9ecef;">
              ${
                logoUrl
                  ? `<img src="${logoUrl}" alt="${brandName}" height="48" style="height: 48px; width: auto; display: block; margin: 0 auto;">`
                  : `<h1 style="color: #333333; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">${brandName}</h1>`
              }
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td class="email-body" style="padding: 40px 32px; line-height: 1.7; color: #333333; font-size: 16px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td class="email-footer" style="background-color: #f8f9fa; padding: 32px 24px; text-align: center; font-size: 13px; color: #6c757d; border-top: 1px solid #e9ecef;">
              <p style="margin: 0 0 12px 0; color: #6c757d; line-height: 1.6;">
                You're receiving this email because you opted in to promotional updates.<br />
                You can manage your preferences or unsubscribe anytime from your <a href="{{accountSettingsUrl}}" style="color: #667eea; text-decoration: underline;">account settings</a>.
              </p>
              <p style="margin: 0 0 12px 0; color: #6c757d;">
                ${
                  unsubscribeUrl && unsubscribeUrl !== '{{unsubscribeUrl}}'
                    ? `<a href="${unsubscribeUrl}" style="color: #667eea; text-decoration: underline;">Unsubscribe from our emails</a>`
                    : unsubscribeUrl
                    ? `<a href="{{unsubscribeUrl}}" style="color: #667eea; text-decoration: underline;">Unsubscribe from our emails</a>`
                    : ''
                }
              </p>
              <p style="margin: 0; color: #6c757d;">© ${new Date().getFullYear()} ${brandName}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim()
  },

  /**
   * Add featured image to promotional email content
   */
  addFeaturedImageToContent: (content: string, featuredImage?: string): string => {
    if (!featuredImage) {
      return content
    }

    const imageHtml = `
      <div style="margin: 0 0 32px 0; text-align: center;">
        <img 
          src="${featuredImage}" 
          alt="Featured" 
          style="width: 100%; max-width: 100%; height: auto; border-radius: 12px; display: block; margin: 0 auto; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" 
        />
      </div>
    `

    return imageHtml + content
  },

  /**
   * Blog notification email template
   */
  newBlogPost: (
    blogTitle: string,
    blogExcerpt: string,
    blogUrl: string,
    featuredImage?: string,
  ) => {
    return `
      <h2 style="color: #1a1a2e; margin: 0 0 16px 0; font-size: 24px;">New Blog Post 📝</h2>
      ${
        featuredImage
          ? `<img src="${featuredImage}" alt="${blogTitle}" style="width: 100%; max-height: 300px; object-fit: cover; border-radius: 8px; margin-bottom: 16px;">`
          : ''
      }
      <h3 style="color: #333; margin: 0 0 12px 0; font-size: 20px;">${blogTitle}</h3>
      <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">${blogExcerpt}</p>
      <a href="${blogUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">Read More</a>
    `
  },
}
