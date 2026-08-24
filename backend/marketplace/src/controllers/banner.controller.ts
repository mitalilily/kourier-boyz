import { Request, Response } from 'express'
import Banner from '../models/Banner'
import { deleteFromR2, uploadToR2 } from '../utils/r2Upload'

export const getBanners = async (req: Request, res: Response) => {
  try {
    const { position, active } = req.query

    const query: any = {}

    if (position) {
      query.position = position
    }

    if (active !== undefined) {
      query.active = active === 'true'
    }

    // Filter by date if exists
    const now = new Date()
    query.$or = [
      { startDate: { $exists: false }, endDate: { $exists: false } },
      { startDate: { $lte: now }, endDate: { $gte: now } },
      { startDate: { $lte: now }, endDate: { $exists: false } },
      { startDate: { $exists: false }, endDate: { $gte: now } },
    ]

    const banners = await Banner.find(query).sort({ order: 1, createdAt: -1 })

    res.json({ banners })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export const createBanner = async (req: Request, res: Response) => {
  try {
    const { title, subtitle, link, linkText, position, active, order, startDate, endDate } =
      req.body

    // Upload image to R2
    const imageFile = (req as any).file
    if (!imageFile) {
      return res.status(400).json({ error: 'Image is required' })
    }

    const imageUrl = await uploadToR2(
      imageFile.buffer,
      imageFile.originalname,
      imageFile.mimetype,
      'banners',
    )

    // Calculate order based on position if not provided
    let bannerOrder = order
    if (bannerOrder === undefined || bannerOrder === null || bannerOrder === '') {
      const maxOrderBanner = await Banner.findOne({ position }).sort({ order: -1 })
      bannerOrder = maxOrderBanner ? maxOrderBanner.order + 1 : 0
    }

    const banner = await Banner.create({
      title,
      subtitle,
      image: imageUrl,
      link,
      linkText: linkText || 'Shop Now',
      position,
      active: active !== 'false',
      order: bannerOrder,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    })

    res.json(banner)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export const updateBanner = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { title, subtitle, link, linkText, position, active, order, startDate, endDate } =
      req.body

    const banner = await Banner.findById(id)
    if (!banner) {
      return res.status(404).json({ error: 'Banner not found' })
    }

    const updateData: any = {
      title,
      subtitle,
      link,
      linkText,
      position,
      active,
      order,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    }

    // Upload new image if provided
    const imageFile = (req as any).file
    if (imageFile) {
      // Delete old image
      await deleteFromR2(banner.image)

      const imageUrl = await uploadToR2(
        imageFile.buffer,
        imageFile.originalname,
        imageFile.mimetype,
        'banners',
      )
      updateData.image = imageUrl
    }

    const updatedBanner = await Banner.findByIdAndUpdate(id, updateData, { new: true })
    res.json(updatedBanner)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export const deleteBanner = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const banner = await Banner.findById(id)
    if (!banner) {
      return res.status(404).json({ error: 'Banner not found' })
    }

    // Delete image from R2
    await deleteFromR2(banner.image)

    await Banner.findByIdAndDelete(id)
    res.json({ message: 'Banner deleted successfully' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Bulk update banner orders
export const updateBannerOrders = async (req: Request, res: Response) => {
  try {
    const { orders } = req.body

    if (!Array.isArray(orders)) {
      return res.status(400).json({ error: 'Orders must be an array' })
    }

    // Update each banner's order
    const updatePromises = orders.map(({ id, order }: { id: string; order: number }) =>
      Banner.findByIdAndUpdate(id, { order }, { new: true }),
    )

    await Promise.all(updatePromises)

    res.json({ message: 'Banner orders updated successfully' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}
