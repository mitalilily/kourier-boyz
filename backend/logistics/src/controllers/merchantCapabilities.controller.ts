import type { Request, Response } from 'express'
import {
  chooseMerchantWorkspace,
  getMerchantCapabilities,
  type MerchantWorkspace,
} from '../models/services/merchantCapabilities.service'

export const getCapabilities = async (req: Request, res: Response) => {
  try {
    const capabilities = await getMerchantCapabilities((req as any).user.sub)
    if (!capabilities) return res.status(404).json({ message: 'Merchant profile not found' })
    return res.json(capabilities)
  } catch (error) {
    console.error('Failed to load merchant capabilities', error)
    return res.status(500).json({ message: 'Could not load merchant workspaces' })
  }
}

export const selectWorkspace = async (req: Request, res: Response) => {
  const workspace = String(req.body?.workspace || '') as MerchantWorkspace
  if (!['shipping', 'marketplace'].includes(workspace)) {
    return res.status(400).json({ message: 'Workspace must be shipping or marketplace' })
  }

  try {
    const capabilities = await chooseMerchantWorkspace((req as any).user.sub, workspace)
    if (!capabilities) return res.status(404).json({ message: 'Merchant profile not found' })
    return res.json(capabilities)
  } catch (error) {
    console.error('Failed to select merchant workspace', error)
    return res.status(500).json({ message: 'Could not select merchant workspace' })
  }
}
