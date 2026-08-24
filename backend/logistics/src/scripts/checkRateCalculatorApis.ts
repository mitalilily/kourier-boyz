/* eslint-disable @typescript-eslint/no-var-requires */
import assert from 'node:assert/strict'

type MockReq = {
  body?: Record<string, any>
  query?: Record<string, any>
  user?: { sub?: string }
  userId?: string
}

type MockRes = {
  statusCode: number
  body: any
  status: (code: number) => MockRes
  json: (payload: any) => MockRes
}

const createRes = (): MockRes => {
  const res = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(payload: any) {
      this.body = payload
      return this
    },
  }
  return res
}

const run = async () => {
  const shiprocketService = require('../models/services/shiprocket.service')
  const b2bAdminService = require('../models/services/b2bAdmin.service')
  const {
    computeB2CRateCardCharge,
    computeEffectiveB2CCodCharge,
  } = require('../models/services/b2cRateCard.service')
  const {
    resolveDelhiveryRateCardShippingMode,
    resolveDelhiveryShippingMode,
  } = require('../utils/delhiveryCourier')
  const { db } = require('../models/client')
  const { couriers: couriersTable } = require('../models/schema/couriers')
  const { plans: plansTable } = require('../models/schema/plans')
  const {
    shippingRates: shippingRatesTable,
    shippingRateSlabs: shippingRateSlabsTable,
  } = require('../models/schema/shippingRates')
  const { userPlans: userPlansTable } = require('../models/schema/userPlans')
  const { locations: locationsTable } = require('../models/schema/locations')
  const { zones: zonesTable } = require('../models/schema/zones')
  const {
    courierPriorityProfiles: courierPriorityProfilesTable,
  } = require('../models/schema/courierPriority')
  const {
    courier_credentials: courierCredentialsTable,
  } = require('../models/schema/courierCredentials')
  const { ShadowfaxService } = require('../models/services/couriers/shadowfax.service')

  const originalFetchB2C = shiprocketService.fetchAvailableCouriersWithRates
  const originalFetchB2B = shiprocketService.fetchAvailableCouriersWithRatesB2B
  const originalFetchAdmin = shiprocketService.fetchAvailableCouriersWithRatesAdmin
  const originalCalculateB2BRate = b2bAdminService.calculateB2BRate
  const originalDbSelect = db.select

  let b2cCall: any = null
  let b2bCall: any = null
  let adminCall: any = null
  let calcCall: any = null

  const installB2CFallbackDbMock = () => {
    const fallbackRateRows = [
      {
        id: 'rate-delhivery-air-legacy',
        plan_id: 'plan-test',
        business_type: 'b2c',
        courier_id: 1,
        courier_name: 'Delhivery Legacy Imported Surface Name',
        service_provider: null,
        zone_id: 'zone-test',
        type: 'forward',
        mode: 'surface',
        cod_charges: 34,
        cod_percent: 2,
        other_charges: 0,
        min_weight: 0.25,
        rate: 45,
        last_updated: null,
      },
      {
        id: 'rate-amazon-enabled',
        plan_id: 'plan-test',
        business_type: 'b2c',
        courier_id: 66,
        courier_name: 'Amazon Shipping',
        service_provider: 'amazon',
        zone_id: 'zone-test',
        type: 'forward',
        mode: 'surface',
        cod_charges: 42.5,
        cod_percent: 2,
        other_charges: 0,
        min_weight: 0.25,
        rate: 85,
        last_updated: null,
      },
      {
        id: 'rate-ekart-disabled',
        plan_id: 'plan-test',
        business_type: 'b2c',
        courier_id: 25,
        courier_name: 'Ekart Disabled',
        service_provider: 'ekart',
        zone_id: 'zone-test',
        type: 'forward',
        mode: 'surface',
        cod_charges: 42.5,
        cod_percent: 2,
        other_charges: 0,
        min_weight: 0.25,
        rate: 79,
        last_updated: null,
      },
      {
        id: 'rate-shadowfax-non-b2c',
        plan_id: 'plan-test',
        business_type: 'b2c',
        courier_id: 88,
        courier_name: 'Shadowfax Non B2C',
        service_provider: 'shadowfax',
        zone_id: 'zone-test',
        type: 'forward',
        mode: 'surface',
        cod_charges: 42.5,
        cod_percent: 2,
        other_charges: 0,
        min_weight: 0.25,
        rate: 70,
        last_updated: null,
      },
    ]
    const fallbackSlabs = [
      {
        id: 'slab-delhivery-025',
        shipping_rate_id: 'rate-delhivery-air-legacy',
        weight_from: 0,
        weight_to: 0.25,
        rate: 45,
        extra_rate: null,
        extra_weight_unit: null,
      },
      {
        id: 'slab-delhivery-050',
        shipping_rate_id: 'rate-delhivery-air-legacy',
        weight_from: 0.25,
        weight_to: 0.5,
        rate: 51,
        extra_rate: null,
        extra_weight_unit: null,
      },
      ...fallbackRateRows
        .filter((rate: any) => rate.id !== 'rate-delhivery-air-legacy')
        .map((rate: any) => ({
          id: `slab-${rate.id}`,
          shipping_rate_id: rate.id,
          weight_from: 0,
          weight_to: 0.25,
          rate: rate.rate,
          extra_rate: null,
          extra_weight_unit: null,
        })),
    ]
    const enabledB2CCouriers = [
      { id: 99, name: 'Delhivery Air', serviceProvider: 'delhivery' },
      { id: 66, name: 'Amazon Shipping', serviceProvider: 'amazon' },
    ]

    const rowsForTable = (table: any, selectedKeys: string[]) => {
      if (table === userPlansTable) return [{ planId: 'plan-test' }]
      if (table === plansTable) return [{ id: 'plan-test' }]
      if (table === couriersTable) return enabledB2CCouriers
      if (table === shippingRateSlabsTable) return fallbackSlabs
      if (table === shippingRatesTable) {
        if (selectedKeys.length === 1 && selectedKeys[0] === 'planId') {
          return [{ planId: 'plan-test' }]
        }
        return fallbackRateRows
      }
      return []
    }

    db.select = (selection?: Record<string, unknown>) => {
      const selectedKeys = selection ? Object.keys(selection) : []
      const builder: any = {
        table: null,
        from(table: any) {
          this.table = table
          return this
        },
        where() {
          return this
        },
        limit() {
          return Promise.resolve(rowsForTable(this.table, selectedKeys))
        },
        orderBy() {
          return Promise.resolve(rowsForTable(this.table, selectedKeys))
        },
        then(resolve: any, reject: any) {
          return Promise.resolve(rowsForTable(this.table, selectedKeys)).then(resolve, reject)
        },
      }
      return builder
    }
  }

  const installShadowfaxLocalFallbackDbMock = () => {
    const shadowfaxCourier = {
      id: 3002,
      name: 'Shadowfax Warehouse',
      serviceProvider: 'shadowfax',
      isEnabled: true,
      businessType: ['b2c'],
      createdAt: null,
    }
    const shadowfaxRateRows = [
      {
        id: 'rate-shadowfax-warehouse-forward',
        plan_id: 'plan-shadowfax',
        business_type: 'b2c',
        courier_id: 3002,
        courier_name: 'Shadowfax Warehouse',
        service_provider: 'shadowfax',
        zone_id: 'zone-roi',
        type: 'forward',
        mode: 'surface',
        cod_charges: 0,
        cod_percent: 0,
        other_charges: 5,
        min_weight: 0.5,
        rate: 75,
        last_updated: null,
      },
    ]
    const shadowfaxSlabs = [
      {
        id: 'slab-shadowfax-warehouse-050',
        shipping_rate_id: 'rate-shadowfax-warehouse-forward',
        weight_from: 0,
        weight_to: 0.5,
        rate: 75,
        extra_rate: null,
        extra_weight_unit: null,
      },
    ]
    const zoneRows = [{ id: 'zone-roi', code: 'ROI', name: 'Rest of India' }]

    const rowsForTable = (table: any, selectedKeys: string[]) => {
      if (table === userPlansTable) return [{ planId: 'plan-shadowfax' }]
      if (table === plansTable) return [{ id: 'plan-shadowfax' }]
      if (table === couriersTable) return [shadowfaxCourier]
      if (table === locationsTable) return []
      if (table === zonesTable) return zoneRows
      if (table === shippingRateSlabsTable) return shadowfaxSlabs
      if (table === shippingRatesTable) {
        if (selectedKeys.length === 1 && selectedKeys[0] === 'planId') {
          return [{ planId: 'plan-shadowfax' }]
        }
        return shadowfaxRateRows
      }
      if (table === courierPriorityProfilesTable) return []
      if (table === courierCredentialsTable) return []
      return []
    }

    db.select = (selection?: Record<string, unknown>) => {
      const selectedKeys = selection ? Object.keys(selection) : []
      const builder: any = {
        table: null,
        from(table: any) {
          this.table = table
          return this
        },
        where() {
          return this
        },
        limit() {
          return Promise.resolve(rowsForTable(this.table, selectedKeys))
        },
        orderBy() {
          return Promise.resolve(rowsForTable(this.table, selectedKeys))
        },
        then(resolve: any, reject: any) {
          return Promise.resolve(rowsForTable(this.table, selectedKeys)).then(resolve, reject)
        },
      }
      return builder
    }
  }

  const summarizeCourierCard = (card: any) => ({
    id: card?.id,
    provider: card?.serviceProvider || card?.integration_type,
    rate: card?.rate,
    freight_charges: card?.freight_charges,
    cod_charges: card?.cod_charges,
    total_charges: card?.total_charges,
    forward_rate: card?.localRates?.forward?.rate,
    forward_cod: card?.localRates?.forward?.cod_charges,
    chargeable_weight: card?.chargeable_weight,
    max_slab_weight: card?.max_slab_weight,
  })

  try {
    const baseRateCard = {
      shippingRateId: 'rate-card-test',
      courier_id: 991,
      courier_name: 'Xpressbees Test',
      service_provider: 'xpressbees',
      zone_id: 'zone-test',
      type: 'forward',
      mode: 'surface',
      cod_charges: 0,
      cod_percent: 0,
      other_charges: 0,
      min_weight: 0.25,
      base_rate: 11,
      slabs: [
        {
          weight_from: 0,
          weight_to: 0.25,
          rate: 11,
          extra_rate: null,
          extra_weight_unit: null,
        },
      ],
    }

    const exactQuarterKg = computeB2CRateCardCharge({
      actual_weight_g: 250,
      length_cm: 1,
      width_cm: 1,
      height_cm: 1,
      rateCard: baseRateCard,
    })
    assert.equal(exactQuarterKg.freight, 11)
    assert.equal(exactQuarterKg.chargeable_weight, 250)
    assert.equal(exactQuarterKg.max_slab_weight, 0.25)
    assert.equal(
      resolveDelhiveryShippingMode({
        courierId: 1,
        mode: 'surface',
        courierName: 'Delhivery Surface',
      }),
      'Express',
    )
    assert.equal(
      resolveDelhiveryShippingMode({
        courierId: 92,
        mode: 'surface',
        courierName: 'Delhivery Surface',
      }),
      'Express',
    )
    assert.equal(
      resolveDelhiveryShippingMode({
        courierId: 93,
        mode: 'air',
        courierName: 'Delhivery Air',
      }),
      'Surface',
    )
    assert.equal(
      resolveDelhiveryRateCardShippingMode({
        courierId: 1,
        mode: 'surface',
        courierName: 'Delhivery Surface',
      }),
      'Express',
    )
    assert.equal(
      resolveDelhiveryRateCardShippingMode({
        courierId: 100,
        mode: 'surface',
        courierName: 'Delhivery Air',
      }),
      'Express',
    )
    assert.equal(
      resolveDelhiveryRateCardShippingMode({
        courierId: 99,
        mode: 'surface',
        courierName: 'Delhivery Surface',
      }),
      'Surface',
    )
    assert.equal(
      resolveDelhiveryRateCardShippingMode({
        courierId: 99,
        mode: 'surface',
        courierName: 'Delhivery Air',
      }),
      'Express',
    )

    assert.equal(
      computeEffectiveB2CCodCharge({
        cod_charges: 34,
        cod_percent: 2,
        order_amount: 500,
      }),
      34,
    )
    assert.equal(
      computeEffectiveB2CCodCharge({
        cod_charges: 34,
        cod_percent: 2,
        order_amount: 5000,
      }),
      100,
    )

    const nextAvailableHalfKg = computeB2CRateCardCharge({
      actual_weight_g: 250,
      length_cm: 1,
      width_cm: 1,
      height_cm: 1,
      rateCard: {
        ...baseRateCard,
        min_weight: 0.5,
        slabs: [{ ...baseRateCard.slabs[0], weight_to: 0.5, rate: 15 }],
      },
    })
    assert.equal(nextAvailableHalfKg.freight, 15)
    assert.equal(nextAvailableHalfKg.chargeable_weight, 250)
    assert.equal(nextAvailableHalfKg.max_slab_weight, 0.5)

    const belowMinimumWeight = computeB2CRateCardCharge({
      actual_weight_g: 100,
      length_cm: 1,
      width_cm: 1,
      height_cm: 1,
      rateCard: baseRateCard,
    })
    assert.equal(belowMinimumWeight.freight, 11)
    assert.equal(belowMinimumWeight.chargeable_weight, 250)
    assert.equal(belowMinimumWeight.max_slab_weight, 0.25)

    const smallestAvailableSlab = computeB2CRateCardCharge({
      actual_weight_g: 250,
      length_cm: 1,
      width_cm: 1,
      height_cm: 1,
      rateCard: {
        ...baseRateCard,
        min_weight: 1,
        slabs: [
          { ...baseRateCard.slabs[0], weight_to: 1, rate: 40 },
          { ...baseRateCard.slabs[0], weight_to: 0.5, rate: 15 },
          { ...baseRateCard.slabs[0], weight_to: 0.25, rate: 11 },
        ],
      },
    })
    assert.equal(smallestAvailableSlab.freight, 11)
    assert.equal(smallestAvailableSlab.chargeable_weight, 250)
    assert.equal(smallestAvailableSlab.max_slab_weight, 0.25)

    const delhiveryExactQuarterSlab = computeB2CRateCardCharge({
      actual_weight_g: 250,
      length_cm: 1,
      width_cm: 1,
      height_cm: 1,
      rateCard: {
        ...baseRateCard,
        courier_id: 100,
        courier_name: 'Delhivery Surface',
        service_provider: 'delhivery',
        min_weight: 0.25,
        slabs: [
          { ...baseRateCard.slabs[0], weight_from: 0, weight_to: 0.25, rate: 45 },
          { ...baseRateCard.slabs[0], weight_from: 0.25, weight_to: 0.5, rate: 51 },
        ],
      },
    })
    assert.equal(delhiveryExactQuarterSlab.freight, 45)
    assert.equal(delhiveryExactQuarterSlab.chargeable_weight, 250)
    assert.equal(delhiveryExactQuarterSlab.max_slab_weight, 0.25)

    const delhiveryNextHalfKgSlab = computeB2CRateCardCharge({
      actual_weight_g: 251,
      length_cm: 1,
      width_cm: 1,
      height_cm: 1,
      rateCard: {
        ...baseRateCard,
        courier_id: 100,
        courier_name: 'Delhivery Surface',
        service_provider: 'delhivery',
        min_weight: 0.25,
        slabs: [
          { ...baseRateCard.slabs[0], weight_from: 0, weight_to: 0.25, rate: 45 },
          { ...baseRateCard.slabs[0], weight_from: 0.25, weight_to: 0.5, rate: 51 },
        ],
      },
    })
    assert.equal(delhiveryNextHalfKgSlab.freight, 51)
    assert.equal(delhiveryNextHalfKgSlab.chargeable_weight, 251)
    assert.equal(delhiveryNextHalfKgSlab.max_slab_weight, 0.5)

    const delhiveryAdditionalFromQuarterSlab = computeB2CRateCardCharge({
      actual_weight_g: 251,
      length_cm: 1,
      width_cm: 1,
      height_cm: 1,
      rateCard: {
        ...baseRateCard,
        courier_id: 100,
        courier_name: 'Delhivery Surface',
        service_provider: 'delhivery',
        min_weight: 0.25,
        slabs: [
          {
            ...baseRateCard.slabs[0],
            weight_from: 0,
            weight_to: 0.25,
            rate: 45,
            extra_rate: 1,
            extra_weight_unit: 0.001,
          },
          { ...baseRateCard.slabs[0], weight_from: 0.25, weight_to: 0.5, rate: 99 },
        ],
      },
    })
    assert.equal(delhiveryAdditionalFromQuarterSlab.freight, 46)
    assert.equal(delhiveryAdditionalFromQuarterSlab.chargeable_weight, 251)
    assert.equal(delhiveryAdditionalFromQuarterSlab.max_slab_weight, 0.25)
    assert.equal(delhiveryAdditionalFromQuarterSlab.matched_by, 'last_slab_extra')

    const sixHundredGramShipment = computeB2CRateCardCharge({
      actual_weight_g: 600,
      length_cm: 1,
      width_cm: 1,
      height_cm: 1,
      rateCard: {
        ...baseRateCard,
        min_weight: 0.25,
        slabs: [
          { ...baseRateCard.slabs[0], weight_from: 0, weight_to: 0.25, rate: 45 },
          { ...baseRateCard.slabs[0], weight_from: 0.25, weight_to: 0.5, rate: 51 },
          { ...baseRateCard.slabs[0], weight_from: 0.5, weight_to: 1, rate: 70 },
        ],
      },
    })
    assert.equal(sixHundredGramShipment.freight, 70)
    assert.equal(sixHundredGramShipment.chargeable_weight, 600)
    assert.equal(sixHundredGramShipment.max_slab_weight, 1)

    const additionalSlab = computeB2CRateCardCharge({
      actual_weight_g: 1250,
      length_cm: 1,
      width_cm: 1,
      height_cm: 1,
      rateCard: {
        ...baseRateCard,
        min_weight: 0.5,
        slabs: [
          {
            ...baseRateCard.slabs[0],
            weight_to: 0.5,
            rate: 10,
            extra_rate: 5,
            extra_weight_unit: 0.5,
          },
        ],
      },
    })
    assert.equal(additionalSlab.freight, 20)
    assert.equal(additionalSlab.chargeable_weight, 1250)
    assert.equal(additionalSlab.matched_by, 'last_slab_extra')

    const previousBoundaryAdditional = computeB2CRateCardCharge({
      actual_weight_g: 300,
      length_cm: 1,
      width_cm: 1,
      height_cm: 1,
      rateCard: {
        ...baseRateCard,
        slabs: [
          {
            ...baseRateCard.slabs[0],
            extra_rate: 4,
            extra_weight_unit: 0.25,
          },
          {
            ...baseRateCard.slabs[0],
            weight_to: 0.5,
            rate: 99,
          },
        ],
      },
    })
    assert.equal(previousBoundaryAdditional.freight, 15)
    assert.equal(previousBoundaryAdditional.chargeable_weight, 300)
    assert.equal(previousBoundaryAdditional.max_slab_weight, 0.25)
    assert.equal(previousBoundaryAdditional.matched_by, 'last_slab_extra')

    shiprocketService.fetchAvailableCouriersWithRates = async (params: any, userId: string) => {
      b2cCall = { params, userId }
      return [{ id: 1, name: 'Mock B2C', rate: 100, edd: '2 Days' }]
    }

    shiprocketService.fetchAvailableCouriersWithRatesB2B = async (params: any, userId: string) => {
      b2bCall = { params, userId }
      return [{ id: 2, name: 'Mock B2B', rate: 200, edd: '3 Days' }]
    }

    shiprocketService.fetchAvailableCouriersWithRatesAdmin = async (
      params: any,
      planId: string,
    ) => {
      adminCall = { params, planId }
      return [{ id: 3, name: 'Mock Admin', rate: 250, edd: '4 Days' }]
    }

    b2bAdminService.calculateB2BRate = async (params: any) => {
      calcCall = params
      return {
        rate: 321,
        charges: { total: 321, baseFreight: 300, overheads: [] },
        origin: { zoneCode: 'A' },
        destination: { zoneCode: 'B' },
      }
    }

    const { fetchAvailableCouriersToUser } = require('../controllers/courierIntegration.controller')
    const { fetchAvailableCouriersForAdmin } = require('../controllers/admin/courier.controller')
    const { calculateRateController } = require('../controllers/admin/b2b/b2bAdmin.controller')
    const { getShippingRatesController } = require('../controllers/externalApi/shipping.controller')

    {
      const req: MockReq = { body: { destination: 110001 }, user: { sub: 'user-1' } }
      const res = createRes()
      await fetchAvailableCouriersToUser(req as any, res as any)
      assert.equal(res.statusCode, 400)
      assert.equal(res.body?.success, false)
    }

    {
      const req: MockReq = {
        body: {
          origin: 400001,
          destination: 560001,
          payment_type: 'cod',
          order_amount: 1500,
          shipment_type: 'b2c',
          weight: 750,
          length: 10,
          breadth: 10,
          height: 10,
          context: 'rate_calculator',
        },
        user: { sub: 'user-1' },
      }
      const res = createRes()
      await fetchAvailableCouriersToUser(req as any, res as any)
      assert.equal(res.statusCode, 200)
      assert.equal(res.body?.success, true)
      assert.equal(res.body?.data?.[0]?.name, 'Mock B2C')
      assert.equal(b2cCall?.userId, 'user-1')
      assert.equal(b2cCall?.params?.isCalculator, true)
    }

    {
      const parityCards = [
        {
          id: 99,
          serviceProvider: 'delhivery',
          integration_type: 'delhivery',
          rate: 45,
          freight_charges: 45,
          cod_charges: 34,
          total_charges: 79,
          chargeable_weight: 250,
          max_slab_weight: 0.25,
          localRates: {
            forward: {
              rate: 45,
              cod_charges: 34,
              chargeable_weight: 250,
              max_slab_weight: 0.25,
            },
          },
        },
        {
          id: 66,
          serviceProvider: 'amazon',
          integration_type: 'amazon',
          rate: 85,
          freight_charges: 85,
          cod_charges: 42.5,
          total_charges: 127.5,
          chargeable_weight: 250,
          max_slab_weight: 0.25,
          localRates: {
            forward: {
              rate: 85,
              cod_charges: 42.5,
              chargeable_weight: 250,
              max_slab_weight: 0.25,
            },
          },
        },
      ]
      shiprocketService.fetchAvailableCouriersWithRates = async (params: any, userId: string) => {
        b2cCall = { params, userId }
        return parityCards
      }

      const basePayload = {
        origin: 400001,
        destination: 560001,
        payment_type: 'cod',
        order_amount: 500,
        shipment_type: 'b2c',
        weight: 250,
        length: 1,
        breadth: 1,
        height: 1,
      }
      const calculatorRes = createRes()
      await fetchAvailableCouriersToUser(
        { body: { ...basePayload, context: 'rate_calculator' }, user: { sub: 'user-1' } } as any,
        calculatorRes as any,
      )
      const selectionRes = createRes()
      await fetchAvailableCouriersToUser(
        {
          body: { ...basePayload, context: 'shipment_courier_selection', isCalculator: true },
          user: { sub: 'user-1' },
        } as any,
        selectionRes as any,
      )

      assert.equal(calculatorRes.statusCode, 200)
      assert.equal(selectionRes.statusCode, 200)
      assert.deepEqual(calculatorRes.body?.data, selectionRes.body?.data)
      assert.deepEqual(
        calculatorRes.body?.data?.map(summarizeCourierCard),
        [
          {
            id: 99,
            provider: 'delhivery',
            rate: 45,
            freight_charges: 45,
            cod_charges: 34,
            total_charges: 79,
            forward_rate: 45,
            forward_cod: 34,
            chargeable_weight: 250,
            max_slab_weight: 0.25,
          },
          {
            id: 66,
            provider: 'amazon',
            rate: 85,
            freight_charges: 85,
            cod_charges: 42.5,
            total_charges: 127.5,
            forward_rate: 85,
            forward_cod: 42.5,
            chargeable_weight: 250,
            max_slab_weight: 0.25,
          },
        ],
      )
    }

    {
      shiprocketService.fetchAvailableCouriersWithRates = async () => {
        throw new Error('force strict local pipeline failure')
      }
      installB2CFallbackDbMock()

      const basePayload = {
        origin: 400001,
        destination: 560001,
        payment_type: 'cod',
        order_amount: 500,
        shipment_type: 'b2c',
        weight: 250,
        length: 1,
        breadth: 1,
        height: 1,
      }
      const calculatorReq: MockReq = {
        body: { ...basePayload, context: 'rate_calculator' },
        user: { sub: 'user-1' },
      }
      const calculatorRes = createRes()
      await fetchAvailableCouriersToUser(calculatorReq as any, calculatorRes as any)
      assert.equal(calculatorRes.statusCode, 200)
      assert.equal(calculatorRes.body?.success, true)

      const selectionReq: MockReq = {
        body: { ...basePayload, context: 'shipment_courier_selection', isCalculator: true },
        user: { sub: 'user-1' },
      }
      const selectionRes = createRes()
      await fetchAvailableCouriersToUser(selectionReq as any, selectionRes as any)
      assert.equal(selectionRes.statusCode, 200)
      assert.equal(selectionRes.body?.success, true)

      assert.deepEqual(calculatorRes.body?.data || [], [])
      assert.deepEqual(selectionRes.body?.data || [], [])

      shiprocketService.fetchAvailableCouriersWithRates = async (params: any, userId: string) => {
        b2cCall = { params, userId }
        return [{ id: 1, name: 'Mock B2C', rate: 100, edd: '2 Days' }]
      }
      db.select = originalDbSelect
    }

    {
      const originalShadowfaxCheck = ShadowfaxService.prototype.checkForwardServiceability
      const activeB2CFetchMock = shiprocketService.fetchAvailableCouriersWithRates
      installShadowfaxLocalFallbackDbMock()
      shiprocketService.fetchAvailableCouriersWithRates = originalFetchB2C
      ShadowfaxService.prototype.checkForwardServiceability = async () => ({
        serviceable: true,
        services: ['Regular', 'Surface'],
        codAvailable: true,
        prepaidAvailable: true,
        tat: null,
        mode: 'warehouse',
        service: 'regular',
        raw: { selected: 'warehouse', selectedService: 'regular' },
      })

      try {
        const cards = await shiprocketService.fetchAvailableCouriersWithRates(
          {
            origin: 400001,
            destination: 110001,
            payment_type: 'prepaid',
            order_amount: 500,
            shipment_type: 'b2c',
            weight: 500,
            length: 10,
            breadth: 10,
            height: 10,
            context: 'shipment_courier_selection',
            shadowfax_forward_mode: 'warehouse',
          },
          'user-shadowfax',
        )

        assert.equal(cards.length, 1)
        assert.equal(cards[0]?.id, 3002)
        assert.equal(cards[0]?.integration_type, 'shadowfax')
        assert.equal(cards[0]?.localRates?.forward?.rate, 75)
        assert.equal(cards[0]?.localRates?.forward?.other_charges, 5)
        assert.equal(cards[0]?.shipping_mode, 'surface')
        assert.equal(cards[0]?.service_mode, 'regular')
        assert.equal(cards[0]?.provider_serviceability?.mode, 'warehouse')
        assert.equal(cards[0]?.provider_serviceability?.shipping_mode, 'surface')
        assert.equal(cards[0]?.provider_serviceability?.service_mode, 'regular')
        assert.equal(cards[0]?.booking_available, true)
        assert.equal(cards[0]?.can_book, true)
      } finally {
        ShadowfaxService.prototype.checkForwardServiceability = originalShadowfaxCheck
        shiprocketService.fetchAvailableCouriersWithRates = activeB2CFetchMock
        db.select = originalDbSelect
      }
    }

    {
      const req: MockReq = {
        body: {
          origin: 400001,
          destination: 560001,
          payment_type: 'prepaid',
          shipment_type: 'b2b',
          weight: 5000,
          length: 30,
          breadth: 20,
          height: 10,
          freight_mode: 'fod',
          rov_type: 'courier',
          numberOfBoxes: 3,
        },
        user: { sub: 'user-2' },
      }
      const res = createRes()
      await fetchAvailableCouriersToUser(req as any, res as any)
      assert.equal(res.statusCode, 200)
      assert.equal(res.body?.success, true)
      assert.equal(res.body?.data?.[0]?.name, 'Mock B2B')
      assert.equal(b2bCall?.params?.shipment_type, 'b2b')
      assert.equal(b2bCall?.params?.freight_mode, 'fod')
      assert.equal(b2bCall?.params?.rov_type, 'courier')
      assert.equal(b2bCall?.params?.pieceCount, 3)
      assert.equal(b2bCall?.userId, 'user-2')
    }

    {
      const req: MockReq = { body: { destination: 560001 }, userId: 'api-user' }
      const res = createRes()
      await getShippingRatesController(req as any, res as any)
      assert.equal(res.statusCode, 200)
      assert.equal(res.body?.success, true)
      assert.ok(Array.isArray(res.body?.data?.rates))
      assert.equal(res.body?.data?.rates?.[0]?.courier_name, 'Mock B2C')
    }

    {
      const req: MockReq = {
        body: {
          origin: 400001,
          destination: 560001,
          payment_type: 'cod',
          order_amount: 1200,
          weight: 1000,
          length: 12,
          breadth: 10,
          height: 8,
          context: 'rate_calculator',
        },
      }
      const res = createRes()
      await fetchAvailableCouriersForAdmin(req as any, res as any)
      assert.equal(res.statusCode, 200)
      assert.equal(res.body?.success, true)
      assert.equal(res.body?.data?.[0]?.name, 'Mock Admin')
      assert.equal(adminCall?.params?.isCalculator, true)
    }

    {
      const req: MockReq = {
        body: {
          originPincode: '400001',
          destinationPincode: '560001',
          weightKg: 12.5,
          paymentMode: 'COD',
          invoiceValue: 2500,
          courierId: 7,
          serviceProvider: 'delhivery',
          freightMode: 'fop',
          rovType: 'courier',
          pieceCount: 2,
          deliveryTime: 'before 11:00',
          planId: 'plan-1',
        },
      }
      const res = createRes()
      await calculateRateController(req as any, res as any)
      assert.equal(res.statusCode, 200)
      assert.equal(res.body?.success, true)
      assert.equal(res.body?.data?.rate, 321)
      assert.equal(calcCall?.originPincode, '400001')
      assert.equal(calcCall?.destinationPincode, '560001')
      assert.equal(calcCall?.courierScope?.courierId, 7)
      assert.equal(calcCall?.courierScope?.serviceProvider, 'delhivery')
      assert.equal(calcCall?.freightMode, 'fop')
      assert.equal(calcCall?.rovType, 'courier')
      assert.equal(calcCall?.pieceCount, 2)
    }

    console.log('PASS: rate calculator API smoke checks passed')
  } finally {
    shiprocketService.fetchAvailableCouriersWithRates = originalFetchB2C
    shiprocketService.fetchAvailableCouriersWithRatesB2B = originalFetchB2B
    shiprocketService.fetchAvailableCouriersWithRatesAdmin = originalFetchAdmin
    b2bAdminService.calculateB2BRate = originalCalculateB2BRate
    db.select = originalDbSelect
  }
}

run().catch((error) => {
  console.error('FAIL: rate calculator API smoke checks failed')
  console.error(error)
  process.exit(1)
})
