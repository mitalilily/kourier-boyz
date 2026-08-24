import archiver = require('archiver')
import axios from 'axios'
import { PDFDocument } from 'pdf-lib'
import { Response } from 'express'
import { and, eq, inArray } from 'drizzle-orm'
import { Readable } from 'stream'
import { db } from '../client'
import { b2b_orders } from '../schema/b2bOrders'
import { b2c_orders } from '../schema/b2cOrders'
import { b2bOrderListSelect, b2cOrderListSelect } from './orderListSelects'
import { getOrderLabelReference } from '../../utils/orderLabels'
import { presignDownload, presignUpload } from './upload.service'
import { generateLabelForOrder } from './generateCustomLabelService'
import { DelhiveryService } from './couriers/delhivery.service'

export type BulkDocumentType = 'label' | 'invoice' | 'manifest'

export const MAX_BULK_DOCUMENT_DOWNLOAD_LIMIT = 100
export const MAX_BULK_LABEL_DOWNLOAD_LIMIT = 50

type OrderRow = {
  id: string
  type: 'b2c' | 'b2b'
  order_number?: string | null
  awb_number?: string | null
  integration_type?: string | null
  courier_partner?: string | null
  label?: string | null
  invoice_link?: string | null
  manifest?: string | null
  provider_reference?: string | null
  provider_request_id?: string | null
  provider_meta?: Record<string, any> | null
  user_id?: string | null
}

type PreparedDocumentEntry = {
  fileName: string
  orderLabel: string
  downloadUrl: string
}

type FullOrderRow = Record<string, any>

const createHttpError = (message: string, statusCode: number) =>
  Object.assign(new Error(message), { statusCode })

const normalizeDocumentReference = (value?: string | null) => {
  const text = String(value || '').trim()
  return text || null
}

const sanitizeFileNameSegment = (value: string) =>
  value
    .trim()
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

const isHttpUrl = (value?: string | null) => typeof value === 'string' && /^https?:\/\//i.test(value)

const getFileExtension = (value?: string | null) => {
  if (!value) return '.pdf'

  const path = isHttpUrl(value)
    ? (() => {
        try {
          return new URL(value).pathname
        } catch {
          return value
        }
      })()
    : value

  const match = path.match(/\.[a-z0-9]+$/i)
  return match?.[0] || '.pdf'
}

const getDocumentReference = (order: OrderRow, type: BulkDocumentType) => {
  if (type === 'label') {
    return normalizeDocumentReference(getOrderLabelReference(order))
  }

  if (type === 'manifest') {
    return normalizeDocumentReference(order.manifest)
  }

  return normalizeDocumentReference(order.invoice_link)
}

const isDelhiveryB2BOrder = (order: OrderRow) =>
  order.type === 'b2b' &&
  (String(order.integration_type || '').trim().toLowerCase() === 'delhivery' ||
    String(order.courier_partner || '').trim().toLowerCase().includes('delhivery'))

const resolveDelhiveryLtlLrn = (order: OrderRow) =>
  String(
    order.provider_reference ||
      order.provider_meta?.lrn ||
      order.provider_meta?.manifest_status?.lrn ||
      order.manifest ||
      '',
  ).trim()

const isLikelyStorageReference = (value?: string | null) => {
  const text = String(value || '').trim()
  if (!text) return false
  if (/^https?:\/\//i.test(text)) return true
  return text.includes('/') && /\.pdf($|\?)/i.test(text)
}

const getDownloadFileName = (order: OrderRow, type: BulkDocumentType, source?: string | null) => {
  const baseName =
    sanitizeFileNameSegment(String(order.order_number || order.awb_number || `${order.type}-${order.id}`)) ||
    `order-${order.id}`

  return `${baseName}-${type}${getFileExtension(source)}`
}

const getOrderDocumentLabel = (order: OrderRow) =>
  String(order.order_number || order.awb_number || order.id)

const fetchFullOrderForGeneration = async (order: OrderRow): Promise<FullOrderRow | null> => {
  if (order.type === 'b2c') {
    const [row] = await db.select().from(b2c_orders).where(eq(b2c_orders.id, order.id)).limit(1)
    return row || null
  }

  const [row] = await db.select().from(b2b_orders).where(eq(b2b_orders.id, order.id)).limit(1)
  return row || null
}

const updateOrderLabelReference = async (order: OrderRow, labelKey: string) => {
  if (order.type === 'b2c') {
    await db.update(b2c_orders).set({ label: labelKey }).where(eq(b2c_orders.id, order.id))
    return
  }

  await db.update(b2b_orders).set({ label: labelKey }).where(eq(b2b_orders.id, order.id))
}

const updateB2BOrderDocumentReference = async (
  order: OrderRow,
  documentType: BulkDocumentType,
  key: string,
) => {
  if (documentType === 'label') {
    await db.update(b2b_orders).set({ label: key }).where(eq(b2b_orders.id, order.id))
    return
  }

  if (documentType === 'manifest') {
    await db.update(b2b_orders).set({ manifest: key }).where(eq(b2b_orders.id, order.id))
  }
}

const uploadBufferAsOrderDocument = async ({
  buffer,
  contentType,
  fileName,
  folderKey,
  userId,
}: {
  buffer: Buffer
  contentType: string
  fileName: string
  folderKey: string
  userId: string
}) => {
  const { uploadUrl, key } = await presignUpload({
    filename: fileName,
    contentType,
    userId,
    folderKey,
  })
  const finalUploadUrl = Array.isArray(uploadUrl) ? uploadUrl[0] : uploadUrl
  const finalKey = Array.isArray(key) ? key[0] : key
  if (!finalUploadUrl || !finalKey) {
    throw new Error('Failed to prepare document upload')
  }

  await axios.put(finalUploadUrl, buffer, {
    headers: { 'Content-Type': contentType },
    timeout: 120000,
  })

  return finalKey
}

const bufferFromDelhiveryDocumentPayload = (value?: string | null) => {
  const text = String(value || '').trim()
  if (!text) return null

  const dataUrlMatch = text.match(/^data:([^;]+);base64,(.+)$/i)
  if (dataUrlMatch) {
    return {
      contentType: dataUrlMatch[1] || 'application/pdf',
      buffer: Buffer.from(dataUrlMatch[2], 'base64'),
    }
  }

  const compact = text.replace(/\s+/g, '')
  if (compact.length >= 80 && /^[A-Za-z0-9+/=]+$/.test(compact)) {
    return {
      contentType: 'application/pdf',
      buffer: Buffer.from(compact, 'base64'),
    }
  }

  return null
}

type ProviderLabelDocument = {
  buffer: Buffer
  contentType: string
}

const extractProviderLabelDocument = (value: unknown): ProviderLabelDocument | null => {
  const seen = new WeakSet<object>()

  const visit = (input: unknown): ProviderLabelDocument | null => {
    if (input === null || input === undefined) return null

    if (typeof input === 'string') {
      return bufferFromDelhiveryDocumentPayload(input)
    }

    if (Array.isArray(input)) {
      for (const entry of input) {
        const found = visit(entry)
        if (found) return found
      }
      return null
    }

    if (typeof input === 'object') {
      const objectInput = input as object
      if (seen.has(objectInput)) return null
      seen.add(objectInput)

      const record = input as Record<string, unknown>
      for (const key of ['data', 'label', 'image', 'pdf', 'stream', 'base64', 'content']) {
        const found = visit(record[key])
        if (found) return found
      }

      for (const nested of Object.values(record)) {
        const found = visit(nested)
        if (found) return found
      }
    }

    return null
  }

  return visit(value)
}

const resolveDownloadedProviderLabel = ({
  buffer,
  contentType,
}: ProviderLabelDocument): ProviderLabelDocument | null => {
  const normalizedContentType = String(contentType || 'application/pdf').split(';')[0].trim().toLowerCase()
  const trimmedText = buffer.subarray(0, 64).toString('utf8').trim()

  if (normalizedContentType.includes('json') || trimmedText.startsWith('{') || trimmedText.startsWith('[')) {
    try {
      return extractProviderLabelDocument(JSON.parse(buffer.toString('utf8')))
    } catch {
      return null
    }
  }

  return {
    buffer,
    contentType: normalizedContentType || 'application/pdf',
  }
}

const buildMergedPdfFromProviderLabels = async (documents: ProviderLabelDocument[]) => {
  const mergedPdf = await PDFDocument.create()
  let addedPages = 0

  for (const document of documents) {
    const contentType = String(document.contentType || '').toLowerCase()

    try {
      if (contentType.includes('pdf') || document.buffer.subarray(0, 4).toString('latin1') === '%PDF') {
        const sourcePdf = await PDFDocument.load(document.buffer)
        const copiedPages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices())
        for (const page of copiedPages) {
          mergedPdf.addPage(page)
          addedPages += 1
        }
        continue
      }
    } catch {
      // Try image embedding below.
    }

    const isPng = contentType.includes('png') || document.buffer.subarray(0, 8).toString('hex') === '89504e470d0a1a0a'
    const isJpeg =
      contentType.includes('jpeg') ||
      contentType.includes('jpg') ||
      document.buffer.subarray(0, 3).toString('hex') === 'ffd8ff'

    if (isPng || isJpeg) {
      const image = isPng ? await mergedPdf.embedPng(document.buffer) : await mergedPdf.embedJpg(document.buffer)
      const page = mergedPdf.addPage([image.width, image.height])
      page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
      addedPages += 1
    }
  }

  if (!addedPages) {
    throw new Error('Delhivery LTL label payloads could not be converted to PDF')
  }

  return Buffer.from(await mergedPdf.save())
}

const materializeDelhiveryB2BDocument = async (
  order: OrderRow,
  documentType: BulkDocumentType,
) => {
  if (!isDelhiveryB2BOrder(order) || documentType === 'invoice') return null

  const fullOrder = await fetchFullOrderForGeneration(order)
  const mergedOrder = { ...order, ...(fullOrder || {}) } as OrderRow
  const userId = String(mergedOrder.user_id || '').trim()
  const lrn = resolveDelhiveryLtlLrn(mergedOrder)
  if (!userId || !lrn) return null

  const delhivery = new DelhiveryService()
  const safeOrderName = sanitizeFileNameSegment(
    String(mergedOrder.order_number || mergedOrder.awb_number || mergedOrder.id),
  )

  let key: string | null = null
  if (documentType === 'label') {
    const labelResult = await delhivery.getLtlShippingLabelUrls({ size: 'a4', lrn })
    if (!labelResult.labelUrls.length) {
      return null
    }

    const labelDocuments: ProviderLabelDocument[] = []
    for (const labelPayload of labelResult.labelUrls) {
      const payload = String(labelPayload || '').trim()
      if (!payload) continue

      if (/^https?:\/\//i.test(payload)) {
        const response = await axios.get<ArrayBuffer>(payload, {
          responseType: 'arraybuffer',
          timeout: 120000,
        })
        const document = resolveDownloadedProviderLabel({
          buffer: Buffer.from(response.data),
          contentType: String(response.headers?.['content-type'] || 'application/pdf'),
        })
        if (document?.buffer?.length) labelDocuments.push(document)
      } else {
        const decoded = bufferFromDelhiveryDocumentPayload(payload)
        if (decoded?.buffer?.length) labelDocuments.push(decoded)
      }
    }

    if (!labelDocuments.length) return null

    const mergedLabelPdf = await buildMergedPdfFromProviderLabels(labelDocuments)
    key = await uploadBufferAsOrderDocument({
      buffer: mergedLabelPdf,
      contentType: 'application/pdf',
      fileName: `${safeOrderName || lrn}-labels.pdf`,
      folderKey: 'labels',
      userId,
    })
  } else if (documentType === 'manifest') {
    const lrCopy = await delhivery.getLtlLrCopy({ lrn })
    const decoded = bufferFromDelhiveryDocumentPayload(lrCopy.pdfBase64 || lrCopy.pdfDataUrl)
    if (!decoded?.buffer?.length) {
      throw new Error('Delhivery LTL did not return an LR copy PDF yet')
    }

    key = await uploadBufferAsOrderDocument({
      buffer: decoded.buffer,
      contentType: decoded.contentType || lrCopy.contentType || 'application/pdf',
      fileName: `${safeOrderName || lrn}-lr-copy.pdf`,
      folderKey: 'manifests',
      userId,
    })
  }

  if (!key) return null
  await updateB2BOrderDocumentReference(mergedOrder, documentType, key)
  const resolved = await presignDownload(key, { checkExists: true })
  const downloadUrl = Array.isArray(resolved) ? resolved[0] : resolved
  if (!downloadUrl) return null

  return {
    fileName: getDownloadFileName(mergedOrder, documentType, key),
    orderLabel: getOrderDocumentLabel(mergedOrder),
    downloadUrl: String(downloadUrl),
  } satisfies PreparedDocumentEntry
}

const resolveGeneratedLabelDownloadUrl = async (order: OrderRow) => {
  const fullOrder = await fetchFullOrderForGeneration(order)
  if (!fullOrder?.user_id) {
    throw new Error('Order not found for label generation')
  }

  const labelKey = await generateLabelForOrder(fullOrder, String(fullOrder.user_id), db)
  const normalizedLabelKey = String(labelKey || '').trim()
  if (!normalizedLabelKey) {
    throw new Error('Label generation returned an empty label reference')
  }

  await updateOrderLabelReference(order, normalizedLabelKey)

  const resolved = await presignDownload(normalizedLabelKey, { checkExists: true })
  const downloadUrl = Array.isArray(resolved) ? resolved[0] : resolved
  if (!downloadUrl) {
    throw new Error('Generated label could not be downloaded')
  }

  return {
    fileName: getDownloadFileName(order, 'label', normalizedLabelKey),
    orderLabel: getOrderDocumentLabel(order),
    downloadUrl: String(downloadUrl),
  } satisfies PreparedDocumentEntry
}

const getDownloadName = (documentType: BulkDocumentType) => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  if (documentType === 'label') {
    return `kourier-boyz-${documentType}s-${stamp}.pdf`
  }

  return `kourier-boyz-${documentType}s-${stamp}.zip`
}

const fetchOrdersForUser = async (userId: string, orderIds: string[]): Promise<OrderRow[]> => {
  const [b2cRows, b2bRows] = await Promise.all([
    db
      .select(b2cOrderListSelect)
      .from(b2c_orders)
      .where(and(eq(b2c_orders.user_id, userId), inArray(b2c_orders.id, orderIds))),
    db
      .select(b2bOrderListSelect)
      .from(b2b_orders)
      .where(and(eq(b2b_orders.user_id, userId), inArray(b2b_orders.id, orderIds))),
  ])

  const orderMap = new Map<string, OrderRow>()

  for (const row of b2cRows) {
    orderMap.set(String(row.id), {
      ...row,
      id: String(row.id),
      type: 'b2c',
    })
  }

  for (const row of b2bRows) {
    orderMap.set(String(row.id), {
      ...row,
      id: String(row.id),
      type: 'b2b',
    })
  }

  return orderIds
    .map((orderId) => orderMap.get(orderId))
    .filter((row): row is OrderRow => Boolean(row))
}

const prepareArchiveEntries = async ({
  documentType,
  orders,
}: {
  documentType: BulkDocumentType
  orders: OrderRow[]
}) => {
  const preparedEntries: PreparedDocumentEntry[] = []
  const missingOrders: string[] = []
  let deduplicatedCount = 0
  const seenReferences = new Set<string>()

  for (const order of orders) {
    const reference = getDocumentReference(order, documentType)
    if (!reference) {
      let providerDocument: PreparedDocumentEntry | null = null
      try {
        providerDocument = await materializeDelhiveryB2BDocument(order, documentType)
      } catch {
        providerDocument = null
      }
      if (providerDocument) {
        preparedEntries.push(providerDocument)
        continue
      }

      if (documentType === 'label') {
        try {
          preparedEntries.push(await resolveGeneratedLabelDownloadUrl(order))
          continue
        } catch {
          missingOrders.push(getOrderDocumentLabel(order))
          continue
        }
      }

      missingOrders.push(getOrderDocumentLabel(order))
      continue
    }

    if (isDelhiveryB2BOrder(order) && !isLikelyStorageReference(reference)) {
      try {
        const providerDocument = await materializeDelhiveryB2BDocument(order, documentType)
        if (providerDocument) {
          preparedEntries.push(providerDocument)
          continue
        }
      } catch {
        if (documentType !== 'label') {
          missingOrders.push(getOrderDocumentLabel(order))
          continue
        }
      }

      if (documentType === 'label') {
        try {
          preparedEntries.push(await resolveGeneratedLabelDownloadUrl(order))
          continue
        } catch {
          missingOrders.push(getOrderDocumentLabel(order))
          continue
        }
      }
    }

    if (seenReferences.has(reference)) {
      deduplicatedCount += 1
      continue
    }

    seenReferences.add(reference)

    try {
      const resolved = await presignDownload(reference, { checkExists: true })
      const downloadUrl = Array.isArray(resolved) ? resolved[0] : resolved
      if (!downloadUrl) {
        if (documentType === 'label') {
          preparedEntries.push(await resolveGeneratedLabelDownloadUrl(order))
          continue
        }

        missingOrders.push(getOrderDocumentLabel(order))
        continue
      }

      preparedEntries.push({
        fileName: getDownloadFileName(order, documentType, reference),
        orderLabel: getOrderDocumentLabel(order),
        downloadUrl: String(downloadUrl),
      })
    } catch {
      if (documentType === 'label') {
        try {
          preparedEntries.push(await resolveGeneratedLabelDownloadUrl(order))
          continue
        } catch {
          missingOrders.push(getOrderDocumentLabel(order))
          continue
        }
      }

      missingOrders.push(getOrderDocumentLabel(order))
    }
  }

  return { preparedEntries, missingOrders, deduplicatedCount }
}

const applyDownloadHeaders = ({
  response,
  downloadName,
  requestedCount,
  documentCount,
  missingCount,
  deduplicatedCount,
  contentType,
}: {
  response: Response
  downloadName: string
  requestedCount: number
  documentCount: number
  missingCount: number
  deduplicatedCount: number
  contentType: string
}) => {
  response.setHeader('Content-Type', contentType)
  response.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`)
  response.setHeader('X-Kourier-Boyz-Archive-Name', downloadName)
  response.setHeader('X-Kourier-Boyz-Requested-Count', String(requestedCount))
  response.setHeader('X-Kourier-Boyz-Document-Count', String(documentCount))
  response.setHeader('X-Kourier-Boyz-Missing-Count', String(missingCount))
  response.setHeader('X-Kourier-Boyz-Deduplicated-Count', String(deduplicatedCount))
}

const streamMergedLabelPdf = async ({
  response,
  preparedEntries,
  requestedCount,
  missingOrders,
  deduplicatedCount,
}: {
  response: Response
  preparedEntries: PreparedDocumentEntry[]
  requestedCount: number
  missingOrders: string[]
  deduplicatedCount: number
}) => {
  const mergedPdf = await PDFDocument.create()
  let mergedDocumentCount = 0

  for (const entry of preparedEntries) {
    try {
      const fileResponse = await axios.get<ArrayBuffer>(entry.downloadUrl, {
        responseType: 'arraybuffer',
        timeout: 120000,
      })

      const sourcePdf = await PDFDocument.load(fileResponse.data)
      const copiedPages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices())
      for (const page of copiedPages) {
        mergedPdf.addPage(page)
      }
      mergedDocumentCount += 1
    } catch {
      missingOrders.push(entry.orderLabel)
    }
  }

  if (!mergedDocumentCount) {
    throw createHttpError('No label PDFs are available yet for the selected orders.', 404)
  }

  const downloadName = getDownloadName('label')
  applyDownloadHeaders({
    response,
    downloadName,
    requestedCount,
    documentCount: mergedDocumentCount,
    missingCount: missingOrders.length,
    deduplicatedCount,
    contentType: 'application/pdf',
  })

  const mergedPdfBytes = await mergedPdf.save()
  response.end(Buffer.from(mergedPdfBytes))
}

const streamBulkOrderDocumentsZip = async ({
  response,
  documentType,
  preparedEntries,
  requestedCount,
  missingOrders,
  deduplicatedCount,
}: {
  response: Response
  documentType: BulkDocumentType
  preparedEntries: PreparedDocumentEntry[]
  requestedCount: number
  missingOrders: string[]
  deduplicatedCount: number
}) => {
  const downloadName = getDownloadName(documentType)
  applyDownloadHeaders({
    response,
    downloadName,
    requestedCount,
    documentCount: preparedEntries.length,
    missingCount: missingOrders.length,
    deduplicatedCount,
    contentType: 'application/zip',
  })

  const archive = new archiver.ZipArchive({ zlib: { level: 9 } })

  await new Promise<void>(async (resolve, reject) => {
    let settled = false
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      callback()
    }

    archive.on('warning', (error: Error) => {
      if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
        finish(() => reject(error))
      }
    })

    archive.on('error', (error: Error) => {
      finish(() => reject(error))
    })

    response.on('close', () => {
      finish(resolve)
    })

    response.on('error', (error) => {
      finish(() => reject(error))
    })

    archive.pipe(response)

    try {
      for (const entry of preparedEntries) {
        const fileResponse = await axios.get(entry.downloadUrl, {
          responseType: 'stream',
          timeout: 120000,
        })

        archive.append(fileResponse.data as Readable, { name: entry.fileName })
      }

      archive.append(
        JSON.stringify(
          {
            requestedCount,
            includedCount: preparedEntries.length,
            missingCount: missingOrders.length,
            deduplicatedCount,
            missingOrders,
          },
          null,
          2,
        ),
        { name: '_download-summary.json' },
      )

      await archive.finalize()
    } catch (error) {
      finish(() => reject(error))
    }
  })
}

export const streamBulkOrderDocumentsDownload = async ({
  response,
  userId,
  orderIds,
  documentType,
}: {
  response: Response
  userId: string
  orderIds: string[]
  documentType: BulkDocumentType
}) => {
  const normalizedOrderIds = Array.from(
    new Set(orderIds.map((orderId) => String(orderId || '').trim()).filter(Boolean)),
  )

  if (!normalizedOrderIds.length) {
    throw createHttpError('Select at least one order to download documents.', 400)
  }

  const downloadLimit =
    documentType === 'label' ? MAX_BULK_LABEL_DOWNLOAD_LIMIT : MAX_BULK_DOCUMENT_DOWNLOAD_LIMIT

  if (normalizedOrderIds.length > downloadLimit) {
    throw createHttpError(
      documentType === 'label'
        ? `You can download up to ${MAX_BULK_LABEL_DOWNLOAD_LIMIT} labels in one PDF.`
        : `You can download up to ${MAX_BULK_DOCUMENT_DOWNLOAD_LIMIT} orders in one ZIP.`,
      400,
    )
  }

  const orders = await fetchOrdersForUser(userId, normalizedOrderIds)
  if (!orders.length) {
    throw createHttpError('No matching orders were found for this account.', 404)
  }

  const { preparedEntries, missingOrders, deduplicatedCount } = await prepareArchiveEntries({
    documentType,
    orders,
  })

  if (!preparedEntries.length) {
    throw createHttpError(
      documentType === 'label'
        ? 'No label PDFs are available yet for the selected orders.'
        : `No ${documentType} files are available yet for the selected orders.`,
      404,
    )
  }

  if (documentType === 'label') {
    await streamMergedLabelPdf({
      response,
      preparedEntries,
      requestedCount: normalizedOrderIds.length,
      missingOrders,
      deduplicatedCount,
    })
    return
  }

  await streamBulkOrderDocumentsZip({
    response,
    documentType,
    preparedEntries,
    requestedCount: normalizedOrderIds.length,
    missingOrders,
    deduplicatedCount,
  })
}
