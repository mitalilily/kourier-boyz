import { Response } from 'express'
import { inArray } from 'drizzle-orm'
import { db } from '../../models/client'
import { b2c_orders, b2b_orders } from '../../schema/schema'
import { generateManifestService } from '../../models/services/shiprocket.service'
import { getMerchantSafeOperationalError } from '../../utils/merchantErrorMessages'

/**
 * Generate manifest for orders
 * POST /api/v1/manifest
 */
export const generateManifestController = async (req: any, res: Response) => {
  try {
    const userId = req.userId // From requireApiKey middleware
    const {
      awbs,
      order_numbers,
      type = 'b2c',
      pickup_date,
      pickup_time,
      pickup_location,
      expected_package_count,
    } = req.body

    // Validate input
    if ((!awbs || !Array.isArray(awbs) || awbs.length === 0) &&
        (!order_numbers || !Array.isArray(order_numbers) || order_numbers.length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'awbs or order_numbers (array) is required',
      })
    }

    if (!['b2c', 'b2b'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid manifest type',
        message: 'type must be either "b2c" or "b2b"',
      })
    }

    // Use awbs if provided, otherwise use order_numbers
    const identifiers = awbs || order_numbers

    const table = type === 'b2c' ? b2c_orders : b2b_orders
    const selectColumns: any = {
      id: table.id,
      awb_number: table.awb_number,
      order_number: table.order_number,
      user_id: table.user_id,
    }
    if (type === 'b2c') {
      selectColumns.integration_type = b2c_orders.integration_type
    }

    // Verify that all orders belong to the user
    const orders = await db
      .select(selectColumns)
      .from(table)
      .where(
        inArray(
          awbs ? table.awb_number : table.order_number,
          identifiers,
        ),
      )

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orders not found',
        message: 'No orders found for the provided identifiers',
      })
    }

    // Check if all orders belong to the user
    const unauthorizedOrders = orders.filter((o) => o.user_id !== userId)
    if (unauthorizedOrders.length > 0) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You do not have access to some of the specified orders',
      })
    }

    // Extract identifiers for manifest generation.
    // Delhivery orders can still be manifested by order_number if a legacy local row has no AWB.
    const awbNumbers = orders.map((o) => o.awb_number).filter(Boolean) as string[]
    const isDelhiveryManifest =
      type === 'b2c' &&
      orders.every(
        (order: any) =>
          String(order.integration_type || 'delhivery')
            .trim()
            .toLowerCase() === 'delhivery',
      )
    const manifestRefs =
      awbNumbers.length > 0
        ? awbNumbers
        : isDelhiveryManifest
          ? (orders.map((o) => o.order_number).filter(Boolean) as string[])
          : []

    if (manifestRefs.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid orders',
        message: isDelhiveryManifest
          ? 'No valid order numbers found for the specified Delhivery orders'
          : 'No valid AWB numbers found for the specified orders',
      })
    }

    // Generate manifest
    const { manifest_id, manifest_url, manifest_key, warnings } = await generateManifestService({
      awbs: manifestRefs,
      type: type as 'b2c' | 'b2b',
      userId,
      pickup_date,
      pickup_time,
      pickup_location,
      expected_package_count,
      requestId: req.requestId,
      source: 'externalApi.generateManifestController',
    })

    res.status(200).json({
      success: true,
      message: 'Manifest generated successfully',
      data: {
        manifest_id,
        manifest_url,
        manifest_key,
        warnings,
        order_count: manifestRefs.length,
        type,
      },
    })
  } catch (error: any) {
    console.error('❌ [Manifest API] Request failed', {
      requestId: req.requestId ?? null,
      source: 'externalApi.generateManifestController',
      userId: req.userId ?? null,
      manifestType: req.body?.type ?? 'b2c',
      awbCount: Array.isArray(req.body?.awbs) ? req.body.awbs.length : 0,
      orderNumberCount: Array.isArray(req.body?.order_numbers) ? req.body.order_numbers.length : 0,
      statusCode: typeof error?.statusCode === 'number' ? error.statusCode : 500,
      errorName: error?.name || null,
      message: error?.message || String(error),
      stack: error?.stack || null,
    })
    res.status(typeof error?.statusCode === 'number' ? error.statusCode : 500).json({
      success: false,
      error: 'Failed to generate manifest',
      message: getMerchantSafeOperationalError(error.message || 'Internal server error'),
    })
  }
}
