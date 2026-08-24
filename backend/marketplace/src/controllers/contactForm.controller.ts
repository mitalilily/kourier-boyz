import { Request, Response } from 'express'
import ContactForm from '../models/ContactForm'
import { io } from '../server'
import { emailTemplates, sendEmail } from '../utils/email'

// Public: Submit contact form (simple standard contact form)
export const submitContactForm = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId // Get customerId if user is logged in
    const { name, email, phone, subject, message, category } = req.body as {
      name: string
      email: string
      phone?: string
      subject: string
      message: string
      category?: string
    }

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'Name, email, subject, and message are required' })
    }

    const contactForm = await ContactForm.create({
      name,
      email,
      phone,
      subject,
      message,
      category: (category as any) || 'general',
      customerId: userId || undefined,
      // No orderId - this is a simple contact form
      status: 'new',
    })

    // Notify admins
    io.to('super-admin').emit('contactForm:new', {
      id: contactForm._id,
      name: contactForm.name,
      email: contactForm.email,
      subject: contactForm.subject,
      category: contactForm.category,
    })

    res
      .status(201)
      .json({
        message: 'Your message has been received. We will get back to you soon!',
        id: contactForm._id,
      })
  } catch (err) {
    console.error('Error submitting contact form:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Admin: Get all contact forms
export const getAllContactForms = async (req: Request, res: Response) => {
  try {
    const { status, category } = req.query as { status?: string; category?: string }
    const query: any = {}

    if (status) query.status = status
    if (category) query.category = category

    const forms = await ContactForm.find(query)
      .populate('customerId', 'name email')
      .populate('respondedBy', 'name email')
      .sort({ createdAt: -1 })

    res.json(forms)
  } catch (err) {
    console.error('Error getting contact forms:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Admin: Get single contact form
export const getContactForm = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const form = await ContactForm.findById(id)
      .populate('customerId', 'name email')
      .populate('respondedBy', 'name email')

    if (!form) {
      return res.status(404).json({ error: 'Contact form not found' })
    }

    res.json(form)
  } catch (err) {
    console.error('Error getting contact form:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Admin: Update contact form status
export const updateContactFormStatus = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) return res.status(401).json({ error: 'Not authenticated' })

    const { id } = req.params
    const { status } = req.body as { status: string }

    const form = await ContactForm.findById(id)
    if (!form) {
      return res.status(404).json({ error: 'Contact form not found' })
    }

    form.status = status as any
    await form.save()

    const populatedForm = await ContactForm.findById(form._id)
      .populate('respondedBy', 'name email')

    res.json(populatedForm)
  } catch (err) {
    console.error('Error updating contact form status:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Admin: Respond to contact form
export const respondToContactForm = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) return res.status(401).json({ error: 'Not authenticated' })

    const { id } = req.params
    const { response } = req.body as { response: string }

    if (!response || response.trim().length === 0) {
      return res.status(400).json({ error: 'Response is required' })
    }

    const form = await ContactForm.findById(id)
    if (!form) {
      return res.status(404).json({ error: 'Contact form not found' })
    }

    form.response = response.trim()
    form.respondedBy = userId as any
    form.respondedAt = new Date()
    form.status = 'resolved'

    await form.save()

    const populatedForm = await ContactForm.findById(form._id)
      .populate('respondedBy', 'name email')

    // Send email notification to customer with admin response
    try {
      const customerEmail = form.email
      if (customerEmail) {
        const customerName = form.name || 'there'
        const subjectLine = `Re: ${form.subject}`
        const html = emailTemplates.contactFormResponse(
          customerName,
          form.subject,
          form.message,
          form.response || '',
          undefined, // No orderId
          form.category,
        )
        void sendEmail(customerEmail, subjectLine, html)
      }
    } catch (emailErr) {
      // Log but don't fail the main request if email sending fails
      // eslint-disable-next-line no-console
      console.error('Error sending contact form response email:', emailErr)
    }

    res.json(populatedForm)
  } catch (err) {
    console.error('Error responding to contact form:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Customer: Get their own contact forms (if authenticated)
export const getMyContactForms = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) return res.status(401).json({ error: 'Not authenticated' })

    // Get user's email to find their contact forms
    const User = (await import('../models/User')).default
    const user = await User.findById(userId)
    if (!user || !user.email) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Find forms by customerId (preferred) or email (for older forms)
    const forms = await ContactForm.find({
      $or: [{ customerId: userId }, { email: user.email }],
    })
      .populate('customerId', 'name email')
      .populate('respondedBy', 'name email')
      .sort({ createdAt: -1 })

    res.json(forms)
  } catch (err) {
    console.error('Error getting my contact forms:', err)
    res.status(500).json({ error: 'Server error' })
  }
}
