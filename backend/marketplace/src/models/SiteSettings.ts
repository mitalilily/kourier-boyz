import mongoose, { type Document, type Model, Schema } from 'mongoose'

export interface BrandingSettings {
  invoiceLogoUrl?: string
  labelLogoUrl?: string
  signatureUrl?: string
  signatureName?: string
  signatureTitle?: string
  companyName?: string
  companyTagline?: string
}

export interface TeamMember {
  _id?: string
  name: string
  role: string
  image?: string
  bio?: string
  socialLinks?: {
    linkedin?: string
    twitter?: string
    email?: string
  }
  order?: number
}

export interface AboutUsSettings {
  title?: string
  content?: string
  heroImage?: string
  mission?: string
  vision?: string
  team?: TeamMember[]
  isPublished?: boolean
}

export interface SocialLink {
  platform:
    | 'facebook'
    | 'twitter'
    | 'instagram'
    | 'youtube'
    | 'linkedin'
    | 'pinterest'
    | 'tiktok'
    | 'snapchat'
  url: string
  order?: number
}

export interface FooterSettings {
  description?: string
  phone?: string
  email?: string
  address?: string
  socialLinks?: SocialLink[]
}

export interface ISiteSettings extends Document {
  branding?: BrandingSettings
  aboutUs?: AboutUsSettings
  footer?: FooterSettings
  updatedBy?: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

interface ISiteSettingsModel extends Model<ISiteSettings> {
  getSingleton(): Promise<ISiteSettings>
}

const SiteSettingsSchema = new Schema<ISiteSettings>(
  {
    branding: {
      invoiceLogoUrl: String,
      labelLogoUrl: String,
      signatureUrl: String,
      signatureName: String,
      signatureTitle: String,
      companyName: String,
      companyTagline: String,
    },
    aboutUs: {
      title: { type: String, default: 'About Us' },
      content: { type: String, default: '' },
      heroImage: String,
      mission: String,
      vision: String,
      isPublished: { type: Boolean, default: false },
    },
    footer: {
      description: String,
      phone: String,
      email: String,
      address: String,
      socialLinks: [
        {
          platform: {
            type: String,
            enum: [
              'facebook',
              'twitter',
              'instagram',
              'youtube',
              'linkedin',
              'pinterest',
              'tiktok',
              'snapchat',
            ],
          },
          url: String,
          order: { type: Number, default: 0 },
        },
      ],
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true },
)

SiteSettingsSchema.statics.getSingleton = async function (): Promise<ISiteSettings> {
  let settings = await this.findOne()
  if (!settings) {
    settings = await this.create({})
  }
  return settings
}

const SiteSettings =
  (mongoose.models.SiteSettings as ISiteSettingsModel) ||
  mongoose.model<ISiteSettings, ISiteSettingsModel>('SiteSettings', SiteSettingsSchema)

export default SiteSettings
