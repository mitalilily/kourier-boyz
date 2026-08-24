import axios from 'axios'
import { getDelhiveryCredentials } from './delhiveryCredentials.service'
import { ShadowfaxService } from './couriers/shadowfax.service'

interface WeightProof {
  proofImages: string[] // URLs to weight proof images
  proofPdf?: string // URL to PDF slip
  metadata: {
    timestamp?: string
    location?: string
    operator?: string
    source?: string
  }
}

const SHADOWFAX_WEIGHT_PROOF_KEYS = new Set([
  'weight_slip_url',
  'weight_proof_url',
  'weight_image_url',
  'weight_images',
  'weight_document_url',
  'weight_document_urls',
  'weight_slip',
  'weight_proof',
  'weight_docs',
  'weight_documents',
  'weight_attachment_url',
  'weighing_slip_url',
  'weighing_proof_url',
  'scan_document_url',
])

const SHADOWFAX_POD_KEYS = new Set(['pod_url', 'pod_urls', 'pod_document', 'pod_document_url'])

const isLikelyUrl = (value: string) => /^https?:\/\//i.test(value)

const collectUrlValues = (value: any): string[] => {
  if (!value) return []
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return isLikelyUrl(trimmed) ? [trimmed] : []
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectUrlValues(item))
  }
  if (typeof value === 'object') {
    return ['url', 'href', 'link', 'document_url', 'file_url', 'image_url']
      .filter((key) => key in value)
      .flatMap((key) => collectUrlValues(value[key]))
  }
  return []
}

const collectShadowfaxUrlsByKeys = (
  node: any,
  keys: Set<string>,
  seen = new WeakSet<object>(),
): string[] => {
  if (!node || typeof node !== 'object') return []
  if (seen.has(node)) return []
  seen.add(node)

  if (Array.isArray(node)) {
    return node.flatMap((item) => collectShadowfaxUrlsByKeys(item, keys, seen))
  }

  const urls: string[] = []
  for (const [key, value] of Object.entries(node)) {
    const normalizedKey = key.toLowerCase()
    if (keys.has(normalizedKey)) {
      urls.push(...collectUrlValues(value))
    }
    if (value && typeof value === 'object') {
      urls.push(...collectShadowfaxUrlsByKeys(value, keys, seen))
    }
  }

  return urls
}

const collectShadowfaxTypedDocumentUrls = (node: any, seen = new WeakSet<object>()): string[] => {
  if (!node || typeof node !== 'object') return []
  if (seen.has(node)) return []
  seen.add(node)

  if (Array.isArray(node)) {
    return node.flatMap((item) => collectShadowfaxTypedDocumentUrls(item, seen))
  }

  const urls: string[] = []
  const typeText = String(
    (node as any).type ||
      (node as any).document_type ||
      (node as any).proof_type ||
      (node as any).name ||
      '',
  ).toLowerCase()
  if (typeText.includes('weight') || typeText.includes('weigh')) {
    urls.push(
      ...collectUrlValues(
        (node as any).url ||
          (node as any).document_url ||
          (node as any).file_url ||
          (node as any).image_url,
      ),
    )
  }

  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') {
      urls.push(...collectShadowfaxTypedDocumentUrls(value, seen))
    }
  }

  return urls
}

const uniqueUrls = (urls: string[]) => Array.from(new Set(urls.filter(Boolean)))

const extractShadowfaxProofArtifacts = (payload: any) => {
  const weightUrls = uniqueUrls([
    ...collectShadowfaxUrlsByKeys(payload, SHADOWFAX_WEIGHT_PROOF_KEYS),
    ...collectShadowfaxTypedDocumentUrls(payload),
  ])
  const podUrls = uniqueUrls(collectShadowfaxUrlsByKeys(payload, SHADOWFAX_POD_KEYS))
  const proofUrls = weightUrls.length > 0 ? weightUrls : podUrls

  const metadata = {
    timestamp:
      payload?.timestamp ||
      payload?.event_time ||
      payload?.updated_at ||
      payload?.scan_time ||
      undefined,
    location: payload?.current_location || payload?.location || payload?.hub_name || undefined,
    operator: payload?.operator || payload?.updated_by || undefined,
    source: weightUrls.length > 0 ? 'shadowfax_weight_proof' : proofUrls.length > 0 ? 'shadowfax_pod_fallback' : 'shadowfax',
  }

  return {
    proofUrls,
    usedPodFallback: weightUrls.length === 0 && proofUrls.length > 0,
    metadata,
  }
}

/**
 * Fetch weight proof from courier partner (when available)
 *
 * IMPORTANT: Most courier APIs don't provide dedicated weight proof endpoints.
 * This function attempts to extract proof URLs from tracking/shipment data where available.
 * For most couriers, proof must be extracted from webhook payloads or manually uploaded.
 */
export async function fetchWeightProofFromCourier(
  courierPartner: string,
  awbNumber: string,
): Promise<WeightProof | null> {
  try {
    if (courierPartner?.toLowerCase() === 'delhivery') {
      return await fetchDelhiveryProof(awbNumber)
    }
    if (courierPartner?.toLowerCase() === 'shadowfax') {
      return await fetchShadowfaxProof(awbNumber)
    }
    console.log(`No proof fetcher implemented for courier: ${courierPartner}`)
    return null
  } catch (error) {
    console.error(`Error fetching proof from ${courierPartner}:`, error)
    return null
  }
}

/**
 * Fetch proof from Delhivery API (if POD images available)
 * Note: Delhivery doesn't provide a dedicated weight proof API
 */
async function fetchDelhiveryProof(awb: string): Promise<WeightProof | null> {
  try {
    const credentials = await getDelhiveryCredentials()
    const apiKey = credentials.apiKey
    const apiUrl = credentials.apiBase

    if (!apiKey) {
      console.warn('Delhivery API key not configured in courier_credentials table')
      return null
    }

    // Get tracking data from Delhivery
    const response = await axios.get(`${apiUrl}/api/v1/packages/json/`, {
      params: {
        waybill: awb,
        verbose: 3,
      },
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    })

    if (!response.data || !response.data.ShipmentData) {
      console.log('Delhivery tracking data not available for AWB:', awb)
      return null
    }

    const proofImages: string[] = []
    const shipmentData = response.data.ShipmentData[0]

    // Delhivery provides POD images in ShipmentData
    if (shipmentData?.PODDocument) {
      proofImages.push(shipmentData.PODDocument)
    }

    // Check scans for any document URLs
    if (Array.isArray(shipmentData?.Scans)) {
      shipmentData.Scans.forEach((scan: any) => {
        if (scan.ScanDetail?.document_url) {
          proofImages.push(scan.ScanDetail.document_url)
        }
      })
    }

    if (proofImages.length === 0) {
      console.log('No proof images found in Delhivery tracking data')
      return null
    }

    return {
      proofImages,
      metadata: {
        timestamp: shipmentData?.ScanDetail?.ScanDateTime,
        location: shipmentData?.ScanDetail?.ScannedLocation,
        source: 'delhivery_tracking',
      },
    }
  } catch (error: any) {
    console.error('Delhivery proof fetch error:', error.message)
    return null
  }
}

async function fetchShadowfaxProof(awb: string): Promise<WeightProof | null> {
  try {
    const shadowfax = new ShadowfaxService()
    const reverse = String(awb).toUpperCase().startsWith('R')

    try {
      const trackingResponse = reverse
        ? await shadowfax.trackReverseShipment(awb)
        : await shadowfax.trackShipment(awb)
      const trackingArtifacts = extractShadowfaxProofArtifacts(trackingResponse?.data || trackingResponse)
      if (trackingArtifacts.proofUrls.length > 0) {
        return {
          proofImages: trackingArtifacts.proofUrls,
          metadata: trackingArtifacts.metadata,
        }
      }
    } catch (trackingError: any) {
      console.warn('Shadowfax tracking proof fetch fallback to POD:', trackingError?.message || trackingError)
    }

    const podResponse = await shadowfax.getPodDetails([awb], reverse)
    const podArtifacts = extractShadowfaxProofArtifacts(podResponse?.data || podResponse)
    if (podArtifacts.proofUrls.length === 0) {
      return null
    }

    return {
      proofImages: podArtifacts.proofUrls,
      metadata: podArtifacts.metadata,
    }
  } catch (error: any) {
    console.error('Shadowfax proof fetch error:', error?.message || error)
    return null
  }
}

/**
 * Fetch proof with retry logic (best effort)
 */
export async function fetchWeightProofWithRetry(
  courierPartner: string,
  awbNumber: string,
  maxRetries: number = 2,
): Promise<WeightProof | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const proof = await fetchWeightProofFromCourier(courierPartner, awbNumber)
      if (proof && proof.proofImages.length > 0) {
        return proof
      }

      // If no proof found on first attempt, wait before retry
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
      }
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error)
      if (attempt === maxRetries) {
        return null
      }
    }
  }

  return null
}

/**
 * Extract weight proof URL from webhook payload
 * Most courier webhooks directly provide weight slip URLs
 * This is the PRIMARY method for getting weight proofs
 */
export function extractWeightProofFromWebhook(
  payload: any,
  courierPartner: string,
): {
  weightSlipUrl?: string
  weightImages?: string[]
  metadata?: Record<string, any>
} {
  const result: any = {}

  try {
    switch (courierPartner?.toLowerCase()) {
      case 'delhivery':
        // Extract from Delhivery webhook payload
        if (payload.Shipment?.PODDocument) {
          result.weightSlipUrl = payload.Shipment.PODDocument
        }
        if (payload.Shipment?.ScanDetail) {
          result.metadata = {
            scannedAt: payload.Shipment.ScanDetail.ScanDateTime,
            location: payload.Shipment.ScanDetail.ScannedLocation,
          }
          if (payload.Shipment.ScanDetail.document_url) {
            result.weightSlipUrl = payload.Shipment.ScanDetail.document_url
          }
        }
        // Check Scans array
        if (payload.Shipment?.Scans && Array.isArray(payload.Shipment.Scans)) {
          const docUrls = payload.Shipment.Scans.map((s: any) => s.ScanDetail?.document_url).filter(
            (url: any) => url,
          )
          if (docUrls.length > 0) {
            result.weightImages = docUrls
          }
        }
        break
      case 'shadowfax':
        {
          const artifacts = extractShadowfaxProofArtifacts(payload)
          if (artifacts.proofUrls.length > 0) {
            result.weightSlipUrl = artifacts.proofUrls[0]
            if (artifacts.proofUrls.length > 1) {
              result.weightImages = artifacts.proofUrls
            }
          }
          result.metadata = {
            scannedAt: artifacts.metadata.timestamp,
            location: artifacts.metadata.location,
            operator: artifacts.metadata.operator,
            source: artifacts.metadata.source,
          }
        }
        break

    }
  } catch (error) {
    console.error('Error extracting weight proof from webhook:', error)
  }

  return result
}
