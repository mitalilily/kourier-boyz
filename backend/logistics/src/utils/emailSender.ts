// utils/emailSender.ts
import dotenv from 'dotenv'
import fs from 'fs'
import nodemailer from 'nodemailer'
import path from 'path'
import {
  formatEmailFromHeader,
  getEmailAuthPassword,
  getEmailAuthUser,
  getEmailEnvelopeFromAddress,
} from './emailIdentity'

// Load correct .env based on NODE_ENV
const env = process.env.NODE_ENV || 'development'
dotenv.config({ path: path.resolve(__dirname, `../../.env.${env}`) })

const EMAIL_FROM = formatEmailFromHeader()
const GOOGLE_SMTP_USER = getEmailAuthUser()
const GOOGLE_SMTP_PASSWORD = getEmailAuthPassword()
const SMTP_HOST = process.env.SMTP_HOST
const SMTP_PORT = Number(process.env.SMTP_PORT || 587)
const SMTP_SECURE = process.env.SMTP_SECURE === 'true'
const BRAND_RED = '#D90416'
const BRAND_WINE = '#7A1C27'
const BRAND_PINK = '#F25565'
const BRAND_INK = '#111827'
const BRAND_MUTED = '#6B7280'
const BRAND_BORDER = '#E5E7EB'
const BRAND_SURFACE = '#F9FAFB'

type AttachmentInput = {
  /** local file path OR Buffer */
  path?: string
  buffer?: Buffer
  filename: string
  mimeType?: string
}

type EmailFrameOptions = {
  eyebrow?: string
  title: string
  intro?: string
  body: string
  outro?: string
  footerNote?: string
}

const renderEmailButton = (label: string, href: string) => `
  <a
    href="${href}"
    style="
      display:inline-block;
      padding:12px 22px;
      background:${BRAND_RED};
      color:#FFFFFF;
      text-decoration:none;
      font-size:14px;
      font-weight:700;
    "
  >
    ${label}
  </a>
`

const renderDataTable = (rows: Array<{ label: string; value: string }>) => `
  <table style="width:100%; border-collapse:collapse; margin-top:18px; border:1px solid ${BRAND_BORDER};">
    ${rows
      .map(
        ({ label, value }) => `
      <tr>
        <td style="width:38%; padding:12px 14px; font-size:13px; font-weight:700; color:${BRAND_INK}; background:${BRAND_SURFACE}; border-bottom:1px solid ${BRAND_BORDER};">
          ${label}
        </td>
        <td style="padding:12px 14px; font-size:13px; color:${BRAND_INK}; border-bottom:1px solid ${BRAND_BORDER};">
          ${value}
        </td>
      </tr>
    `,
      )
      .join('')}
  </table>
`

const renderEmailFrame = ({
  eyebrow = 'Kourier Boyz',
  title,
  intro,
  body,
  outro,
  footerNote = 'This is an automated message from Kourier Boyz.',
}: EmailFrameOptions) => `
  <div style="margin:0; padding:32px 16px; background:#F3F4F6;">
    <div style="max-width:640px; margin:0 auto; background:#FFFFFF; border:1px solid ${BRAND_BORDER};">
      <div style="padding:28px 28px 22px; background:linear-gradient(135deg, ${BRAND_WINE} 0%, ${BRAND_RED} 72%, ${BRAND_PINK} 100%);">
        <div style="font-size:11px; letter-spacing:0.16em; text-transform:uppercase; color:rgba(255,255,255,0.78); font-weight:800; margin-bottom:10px;">
          ${eyebrow}
        </div>
        <div style="font-size:28px; line-height:1.2; font-weight:800; color:#FFFFFF;">
          ${title}
        </div>
      </div>
      <div style="padding:28px;">
        ${
          intro
            ? `<p style="margin:0 0 16px; font-size:14px; line-height:1.75; color:${BRAND_MUTED};">${intro}</p>`
            : ''
        }
        <div style="font-size:14px; line-height:1.75; color:${BRAND_INK};">
          ${body}
        </div>
        ${
          outro
            ? `<p style="margin:20px 0 0; font-size:13px; line-height:1.7; color:${BRAND_MUTED};">${outro}</p>`
            : ''
        }
      </div>
      <div style="padding:16px 28px; border-top:1px solid ${BRAND_BORDER}; background:${BRAND_SURFACE};">
        <div style="font-size:12px; color:${BRAND_MUTED};">${footerNote}</div>
        <div style="font-size:12px; color:#9CA3AF; margin-top:6px;">&copy; ${new Date().getFullYear()} Kourier Boyz</div>
      </div>
    </div>
  </div>
`

// Create SMTP transporter (Hostinger/custom SMTP if provided, else Gmail service)
const createTransporter = () => {
  if (!GOOGLE_SMTP_PASSWORD) {
    console.warn('Google SMTP password not configured. Email not sent.')
    return null
  }

  if (SMTP_HOST) {
    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: GOOGLE_SMTP_USER,
        pass: GOOGLE_SMTP_PASSWORD,
      },
    })
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GOOGLE_SMTP_USER,
      pass: GOOGLE_SMTP_PASSWORD, // Use App Password for Gmail
    },
  })
}

/**
 * Low-level sendEmail supporting optional attachments
 */
const sendEmail = async (
  to: string,
  subject: string,
  htmlContent: string,
  attachments?: AttachmentInput[],
) => {
  const transporter = createTransporter()
  if (!transporter) {
    console.warn('Email transporter not configured. Email not sent.')
    return
  }

  const mailOptions: any = {
    from: EMAIL_FROM,
    envelope: {
      from: getEmailEnvelopeFromAddress(),
      to,
    },
    to,
    subject,
    html: htmlContent,
  }

  if (attachments && attachments.length) {
    mailOptions.attachments = await Promise.all(
      attachments.map(async (a) => {
        let buffer: Buffer
        if (a.buffer) buffer = a.buffer
        else if (a.path) buffer = fs.readFileSync(a.path)
        else throw new Error('Attachment must have path or buffer')

        return {
          filename: a.filename,
          content: buffer,
          contentType: a.mimeType,
        }
      }),
    )
  }

  try {
    const info = await transporter.sendMail(mailOptions)
    console.log('Email sent successfully:', info.messageId)
  } catch (error) {
    console.error('Error sending email:', error)
    throw error
  }
}

// Login / verification Email for OTP-based auth
export const sendVerificationEmail = async (to: string, token: string) => {
  const html = renderEmailFrame({
    eyebrow: 'Kourier Boyz OTP Verification',
    title: 'Your Kourier Boyz OTP',
    intro:
      'A sign-in request was received for your Kourier Boyz merchant account. Use the OTP below to continue securely.',
    body: `
      <div style="margin:22px 0; padding:20px; background:${BRAND_SURFACE}; border:1px solid ${BRAND_BORDER}; text-align:center;">
        <div style="font-size:11px; letter-spacing:0.16em; text-transform:uppercase; color:${BRAND_MUTED}; font-weight:800; margin-bottom:10px;">
          One-time password
        </div>
        <div style="font-size:30px; letter-spacing:8px; font-weight:800; color:${BRAND_WINE};">
          ${escapeHtml(token)}
        </div>
      </div>
      <p style="margin:0 0 12px;">This code expires in <strong>6 minutes</strong> and can be used only once.</p>
      <p style="margin:0;">If you did not try to sign in, you can ignore this email. Your account remains protected unless this code is entered.</p>
    `,
  })

  await sendEmail(to, 'Kourier Boyz OTP verification', html)
}

export const sendPhoneVerificationEmail = async (to: string, token: string, phone: string) => {
  const html = renderEmailFrame({
    eyebrow: 'Kourier Boyz OTP Verification',
    title: 'Your Kourier Boyz OTP',
    intro: `A request was made to verify the contact number <strong>${escapeHtml(phone)}</strong> on your Kourier Boyz merchant profile.`,
    body: `
      <div style="margin:22px 0; padding:20px; background:${BRAND_SURFACE}; border:1px solid ${BRAND_BORDER}; text-align:center;">
        <div style="font-size:11px; letter-spacing:0.16em; text-transform:uppercase; color:${BRAND_MUTED}; font-weight:800; margin-bottom:10px;">
          One-time password
        </div>
        <div style="font-size:30px; letter-spacing:8px; font-weight:800; color:${BRAND_WINE};">
          ${escapeHtml(token)}
        </div>
      </div>
      <p style="margin:0 0 12px;">Enter this code in the profile verification flow to confirm the contact number on your account.</p>
      <p style="margin:0;">This code expires in <strong>6 minutes</strong>. If you did not request phone verification, you can ignore this email and no changes will be applied.</p>
    `,
  })

  await sendEmail(to, 'Kourier Boyz OTP verification', html)
}

// Employee Credentials Email
export const sendEmployeeCredentials = async (
  to: string,
  email: string,
  password: string,
  createdBy: string, // name or email of the seller/admin
) => {
  const html = renderEmailFrame({
    eyebrow: 'Team Access',
    title: 'Your employee account is ready',
    intro: `An account has been created for you by <strong>${escapeHtml(createdBy)}</strong>.`,
    body: `
      <p style="margin:0 0 14px;">Use the credentials below to access Kourier Boyz.</p>
      ${renderDataTable([
        { label: 'Email', value: escapeHtml(email) },
        { label: 'Temporary password', value: escapeHtml(password) },
      ])}
    `,
    outro:
      'After signing in, update your password if required by your administrator. Contact your account owner if you have trouble accessing shipment or billing functions.',
  })

  await sendEmail(to, 'Your Kourier Boyz employee account', html)
}
const escapeHtml = (unsafe: string) =>
  unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

export const sendTempPasswordEmail = async (to: string, tempPassword: string) => {
  const safePassword = escapeHtml(tempPassword)

  const html = renderEmailFrame({
    eyebrow: 'Account Security',
    title: 'Your temporary password',
    intro: 'Your Kourier Boyz password has been reset.',
    body: `
      <div style="margin:22px 0; padding:20px; background:${BRAND_SURFACE}; border:1px solid ${BRAND_BORDER}; text-align:center;">
        <div style="font-size:11px; letter-spacing:0.16em; text-transform:uppercase; color:${BRAND_MUTED}; font-weight:800; margin-bottom:10px;">
          Temporary password
        </div>
        <div style="font-size:24px; font-weight:800; color:${BRAND_WINE}; word-break:break-word;">
          ${safePassword}
        </div>
      </div>
      <p style="margin:0;">Use this password to sign in and change it immediately from your account settings.</p>
    `,
    outro:
      'If you did not request this change, contact support immediately so your merchant account can be secured.',
  })

  await sendEmail(to, 'Your temporary Kourier Boyz password', html)
}

export const sendInvoiceReadyEmail = async (opts: {
  to: string
  sellerName?: string
  invoiceNo: string
  periodStart: string // e.g. '01 Sep 2025'
  periodEnd: string
  totalAmount: string | number
  pdfUrl?: string // optional public url or local path
  csvUrl?: string // optional public url or local path
  attachFiles?: boolean // default false for production
  preferSignedUrls?: boolean // if true, treat pdfUrl/csvUrl as download links
}) => {
  const {
    to,
    sellerName,
    invoiceNo,
    periodStart,
    periodEnd,
    totalAmount,
    pdfUrl,
    csvUrl,
    attachFiles = false,
    preferSignedUrls = false,
  } = opts

  const safeSeller = sellerName ? sellerName : 'Seller'

  const html = renderEmailFrame({
    eyebrow: 'Billing',
    title: `Invoice ready: ${escapeHtml(invoiceNo)}`,
    intro: `Hello ${escapeHtml(safeSeller)}, your invoice has been generated for the billing period below.`,
    body: `
      ${renderDataTable([
        { label: 'Invoice number', value: escapeHtml(invoiceNo) },
        { label: 'Billing period', value: `${escapeHtml(periodStart)} &mdash; ${escapeHtml(periodEnd)}` },
        { label: 'Amount (GST inclusive)', value: `&#8377;${Number(totalAmount).toFixed(2)}` },
      ])}
      <div style="margin-top:18px;">
        ${
          preferSignedUrls && (pdfUrl || csvUrl)
            ? `
              <p style="margin:0 0 10px;">Download your invoice files:</p>
              ${pdfUrl ? `<div style="margin-bottom:8px;">${renderEmailButton('Download PDF invoice', pdfUrl)}</div>` : ''}
              ${csvUrl ? `<div>${renderEmailButton('Download CSV breakdown', csvUrl)}</div>` : ''}
            `
            : '<p style="margin:0;">Invoice files are attached to this email when attachments are enabled for your environment.</p>'
        }
      </div>
    `,
    outro:
      'If you have a billing question or want to dispute an invoice item, please contact support from your merchant dashboard.',
  })

  // If attachFiles true and pdfUrl/csvUrl point to local files, attach them
  let attachments: AttachmentInput[] | undefined = undefined
  if (attachFiles) {
    attachments = []
    if (pdfUrl && !preferSignedUrls) {
      if (fs.existsSync(pdfUrl)) {
        attachments.push({ path: pdfUrl, filename: `${invoiceNo}.pdf` })
      }
    }
    if (csvUrl && !preferSignedUrls) {
      if (fs.existsSync(csvUrl)) {
        attachments.push({ path: csvUrl, filename: `${invoiceNo}.csv` })
      }
    }
  }

  await sendEmail(to, `Your Invoice ${invoiceNo} is ready`, html, attachments)
}

export const sendInvoiceReminderEmail = async (opts: {
  to: string
  invoiceNo: string
  amount: number | string
  pdfUrl?: string
  csvUrl?: string
}) => {
  const { to, invoiceNo, amount, pdfUrl, csvUrl } = opts

  const html = renderEmailFrame({
    eyebrow: 'Billing Reminder',
    title: `Payment reminder: ${escapeHtml(invoiceNo)}`,
    intro: 'This invoice is still pending payment.',
    body: `
      ${renderDataTable([
        { label: 'Invoice number', value: escapeHtml(invoiceNo) },
        { label: 'Outstanding amount', value: `&#8377;${Number(amount).toFixed(2)}` },
      ])}
      ${
        pdfUrl || csvUrl
          ? `
            <div style="margin-top:18px;">
              ${pdfUrl ? `<div style="margin-bottom:8px;">${renderEmailButton('Download PDF invoice', pdfUrl)}</div>` : ''}
              ${csvUrl ? `<div>${renderEmailButton('Download CSV breakdown', csvUrl)}</div>` : ''}
            </div>
          `
          : ''
      }
    `,
    outro:
      'If payment has already been completed, you can ignore this reminder. For assistance, contact support through your Kourier Boyz account.',
  })

  await sendEmail(to, `Payment Reminder: Invoice ${invoiceNo}`, html)
}

export const sendKycStatusEmail = async (opts: {
  to: string
  userName?: string
  status: 'verified' | 'rejected'
  reason?: string
}) => {
  const { to, userName, status, reason } = opts
  const safeName = userName || 'Merchant'
  const isApproved = status === 'verified'
  const subject = isApproved ? 'Your KYC has been approved' : 'Your KYC has been rejected'

  const html = renderEmailFrame({
    eyebrow: 'Account Verification',
    title: isApproved ? 'KYC approved' : 'KYC requires attention',
    intro: `Hello ${escapeHtml(safeName)}, your KYC review status has been updated.`,
    body: `
      ${renderDataTable([
        { label: 'Status', value: isApproved ? 'Approved' : 'Rejected' },
        ...(reason && !isApproved ? [{ label: 'Review note', value: escapeHtml(reason) }] : []),
      ])}
    `,
    outro: isApproved
      ? 'Your account is now cleared for the verification steps tied to merchant operations.'
      : 'Please review the note above and update your documents from the dashboard if another submission is required.',
  })

  await sendEmail(to, subject, html)
}
