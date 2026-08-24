import {
  Badge,
  Box,
  Button,
  Checkbox,
  Flex,
  FormControl,
  FormLabel,
  Input,
  Spinner,
  Text,
  useToast,
  VStack,
} from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import {
  useBookDelhiveryLtlLastMileAppointment,
  useCancelDelhiveryLtlPickupRequest,
  useCancelDelhiveryLtlShipment,
  useCheckDelhiveryLtlServiceability,
  useCreateDelhiveryLtlClientWarehouse,
  useCreateDelhiveryLtlManifest,
  useCourierCredentials,
  useEstimateDelhiveryLtlFreight,
  useGenerateDelhiveryLtlDocuments,
  useGetDelhiveryLtlFreightCharges,
  useGetDelhiveryLtlGeneratedDocumentStatus,
  useGetDelhiveryLtlLrCopy,
  useGetDelhiveryLtlManifestStatus,
  useGetDelhiveryLtlShippingLabelUrls,
  useGetDelhiveryLtlShipmentUpdateStatus,
  useGetDelhiveryLtlExpectedTat,
  useLoginDelhiveryLtl,
  useLogoutDelhiveryLtl,
  useRequestDelhiveryLtlPasswordReset,
  useTrackDelhiveryLtlShipment,
  useUpdateDelhiveryLtlClientWarehouse,
  useUpdateDelhiveryLtlShipment,
  useUpdateDelhiveryCredentials,
  useUpdateDtdcCredentials,
  useUpdateEkartCredentials,
  useUpdateInnofulfillCredentials,
  useUpdateMovinCredentials,
  useUpdateApptmyzCredentials,
  useUpdateAmazonCredentials,
  useUpdateXpressbeesAwbRange,
  useUpdateXpressbeesCredentials,
} from 'hooks/useCouriers'

const CourierCredentials = () => {
  const toast = useToast()
  const bookDelhiveryLtlLastMileAppointment = useBookDelhiveryLtlLastMileAppointment()
  const cancelDelhiveryLtlPickupRequest = useCancelDelhiveryLtlPickupRequest()
  const cancelDelhiveryLtlShipment = useCancelDelhiveryLtlShipment()
  const checkDelhiveryLtlServiceability = useCheckDelhiveryLtlServiceability()
  const createDelhiveryLtlClientWarehouse = useCreateDelhiveryLtlClientWarehouse()
  const createDelhiveryLtlManifest = useCreateDelhiveryLtlManifest()
  const estimateDelhiveryLtlFreight = useEstimateDelhiveryLtlFreight()
  const generateDelhiveryLtlDocuments = useGenerateDelhiveryLtlDocuments()
  const getDelhiveryLtlFreightCharges = useGetDelhiveryLtlFreightCharges()
  const getDelhiveryLtlGeneratedDocumentStatus = useGetDelhiveryLtlGeneratedDocumentStatus()
  const getDelhiveryLtlLrCopy = useGetDelhiveryLtlLrCopy()
  const getDelhiveryLtlManifestStatus = useGetDelhiveryLtlManifestStatus()
  const getDelhiveryLtlShippingLabelUrls = useGetDelhiveryLtlShippingLabelUrls()
  const getDelhiveryLtlShipmentUpdateStatus = useGetDelhiveryLtlShipmentUpdateStatus()
  const getDelhiveryLtlExpectedTat = useGetDelhiveryLtlExpectedTat()
  const trackDelhiveryLtlShipment = useTrackDelhiveryLtlShipment()
  const { data, isLoading, error } = useCourierCredentials()
  const loginDelhiveryLtl = useLoginDelhiveryLtl()
  const logoutDelhiveryLtl = useLogoutDelhiveryLtl()
  const updateDelhivery = useUpdateDelhiveryCredentials()
  const updateDelhiveryLtlClientWarehouse = useUpdateDelhiveryLtlClientWarehouse()
  const updateDelhiveryLtlShipment = useUpdateDelhiveryLtlShipment()
  const requestDelhiveryLtlPasswordReset = useRequestDelhiveryLtlPasswordReset()
  const updateDtdc = useUpdateDtdcCredentials()
  const updateEkart = useUpdateEkartCredentials()
  const updateInnofulfill = useUpdateInnofulfillCredentials()
  const updateMovin = useUpdateMovinCredentials()
  const updateApptmyz = useUpdateApptmyzCredentials()
  const updateAmazon = useUpdateAmazonCredentials()
  const updateXpressbees = useUpdateXpressbeesCredentials()
  const updateXpressbeesAwbRange = useUpdateXpressbeesAwbRange()

  const [form, setForm] = useState({
    apiBase: '',
    clientName: '',
    apiKey: '',
    ltlApiBase: '',
    ltlUsername: '',
    ltlPassword: '',
  })
  const [delhiveryLtlServiceabilityForm, setDelhiveryLtlServiceabilityForm] = useState({
    pincode: '',
    weight: '',
    result: null,
  })
  const [delhiveryLtlTatForm, setDelhiveryLtlTatForm] = useState({
    originPin: '',
    destinationPin: '',
    result: null,
  })
  const [delhiveryLtlFreightForm, setDelhiveryLtlFreightForm] = useState({
    sourcePin: '',
    consigneePin: '',
    weightG: '',
    invoiceAmount: '',
    paymentMode: 'prepaid',
    codAmount: '',
    freightMode: 'fod',
    chequePayment: false,
    rovInsurance: true,
    lengthCm: '',
    widthCm: '',
    heightCm: '',
    boxCount: '1',
    result: null,
  })
  const [delhiveryLtlFreightChargesForm, setDelhiveryLtlFreightChargesForm] = useState({
    lrns: '',
    result: null,
  })
  const [delhiveryLtlWarehouseForm, setDelhiveryLtlWarehouseForm] = useState({
    payload: '',
    result: null,
  })
  const [delhiveryLtlWarehouseUpdateForm, setDelhiveryLtlWarehouseUpdateForm] = useState({
    payload: '',
    result: null,
  })
  const [delhiveryLtlManifestForm, setDelhiveryLtlManifestForm] = useState({
    payload: '',
    files: [],
    result: null,
  })
  const [delhiveryLtlManifestStatusForm, setDelhiveryLtlManifestStatusForm] = useState({
    jobId: '',
    result: null,
  })
  const [delhiveryLtlShipmentUpdateForm, setDelhiveryLtlShipmentUpdateForm] = useState({
    lrn: '',
    payload: '',
    files: [],
    result: null,
  })
  const [delhiveryLtlShipmentUpdateStatusForm, setDelhiveryLtlShipmentUpdateStatusForm] =
    useState({
      jobId: '',
      result: null,
    })
  const [delhiveryLtlShipmentCancelForm, setDelhiveryLtlShipmentCancelForm] = useState({
    lrn: '',
    result: null,
  })
  const [delhiveryLtlShipmentTrackForm, setDelhiveryLtlShipmentTrackForm] = useState({
    lrn: '',
    allWbns: false,
    result: null,
  })
  const [delhiveryLtlLabelForm, setDelhiveryLtlLabelForm] = useState({
    size: 'std',
    lrn: '',
    result: null,
  })
  const [delhiveryLtlLrCopyForm, setDelhiveryLtlLrCopyForm] = useState({
    lrn: '',
    lrCopyType: '',
    requestId: '',
    result: null,
  })
  const [delhiveryLtlDocumentGenerateForm, setDelhiveryLtlDocumentGenerateForm] = useState({
    docType: 'shipping_label',
    requestId: '',
    payload: '',
    result: null,
  })
  const [delhiveryLtlDocumentStatusForm, setDelhiveryLtlDocumentStatusForm] = useState({
    docType: 'shipping_label',
    jobId: '',
    requestId: '',
    result: null,
  })
  const [delhiveryLtlAppointmentForm, setDelhiveryLtlAppointmentForm] = useState({
    lrn: '',
    date: '',
    appointmentSlot: '12:00 PM-03:00 PM',
    poNumbers: 'NotApplicable',
    appointmentId: '',
    poExpiryDate: '',
    result: null,
  })
  const [delhiveryLtlPickupCancelForm, setDelhiveryLtlPickupCancelForm] = useState({
    pickupId: '',
    requestId: '',
    result: null,
  })
  const [ekartForm, setEkartForm] = useState({
    apiBase: '',
    clientName: '',
    clientId: '',
    username: '',
    password: '',
    webhookSecret: '',
  })
  const [dtdcForm, setDtdcForm] = useState({
    apiBase: 'https://blktracksvc.dtdc.com',
    bookingApiBase: 'https://dtdcapi.shipsy.io',
    cancelApiBase: 'https://dtdcapi.shipsy.io',
    clientName: '',
    username: '',
    password: '',
    customerCode: '',
    serviceTypeId: 'B2C PRIORITY',
    commodityId: '99',
    hubCode: '',
    pickupVendorCode: '',
    apiKey: '',
    trackingToken: '',
  })
  const [movinForm, setMovinForm] = useState({
    apiBase: 'https://apim.iristransport.co.in',
    tenantId: '',
    serverId: '',
    clientId: '',
    clientSecret: '',
    subscriptionKey: '',
    accountNumber: '',
  })
  const [apptmyzForm, setApptmyzForm] = useState({
    apiBase: 'http://103.73.191.220:8080/flipkart',
    clientName: '',
    username: '',
    password: '',
    publicKey: '',
    customerCode: '',
  })
  const [amazonForm, setAmazonForm] = useState({
    apiBase: 'https://sellingpartnerapi-eu.amazon.com',
    lwaClientId: '',
    lwaClientSecret: '',
    refreshToken: '',
    accessToken: '',
    shippingBusinessId: 'AmazonShipping_IN',
    region: 'eu',
    sandbox: false,
    lwaTokenUrl: 'https://api.amazon.com/auth/o2/token',
  })
  const [xpressbeesForm, setXpressbeesForm] = useState({
    apiBase: '',
    username: '',
    password: '',
    apiKey: '',
    authBearer: '',
    secretKey: '',
    xbKey: '',
    xbAccessKey: '',
    businessAccountName: '',
    pickupVendorCode: '',
    businessUnit: 'ECOM',
    businessFlow: 'FORWARD',
    businessService: '',
    businessServices: 'SD,SDD,NDD,AIR,SFC,IntraSDD',
    manifestServiceType: 'SD',
    manifestPickupType: 'Vendor',
    pincodeBusinessUnit: 'eComm',
    pincodeBusinessFlow: 'Forward',
    pickupBusinessService: 'PickUp',
    deliveryBusinessService: 'Delivery',
    serviceabilityVersion: 'v1',
    trackingVersion: 'v1',
    webhookSecret: '',
  })
  const [xpressbeesAwbForm, setXpressbeesAwbForm] = useState({
    startAwb: '',
    endAwb: '',
  })
  const [innofulfillForm, setInnofulfillForm] = useState({
    apiBase: 'https://apis.innofulfill.com',
    username: '',
    password: '',
    apiKey: '',
    tenantId: '',
    userId: '',
    signinType: 'EMAIL',
    webhookSecret: '',
  })

  useEffect(() => {
    if (data?.delhivery) {
      setForm({
        apiBase: data.delhivery.apiBase || '',
        clientName: data.delhivery.clientName || '',
        apiKey: '',
        ltlApiBase: data.delhivery.ltlApiBase || 'https://ltl-clients-api.delhivery.com',
        ltlUsername: data.delhivery.ltlUsername || '',
        ltlPassword: '',
      })
    }
    if (data?.ekart) {
      setEkartForm({
        apiBase: data.ekart.apiBase || '',
        clientName: data.ekart.clientName || '',
        clientId: data.ekart.clientId || '',
        username: data.ekart.username || '',
        password: '',
        webhookSecret: '',
      })
    }
    if (data?.dtdc) {
      setDtdcForm({
        apiBase: data.dtdc.apiBase || 'https://blktracksvc.dtdc.com',
        bookingApiBase: data.dtdc.bookingApiBase || 'https://dtdcapi.shipsy.io',
        cancelApiBase: data.dtdc.cancelApiBase || 'https://dtdcapi.shipsy.io',
        clientName: data.dtdc.clientName || '',
        username: data.dtdc.username || '',
        password: '',
        customerCode: data.dtdc.customerCode || '',
        serviceTypeId: data.dtdc.serviceTypeId || 'B2C PRIORITY',
        commodityId: data.dtdc.commodityId || '99',
        hubCode: data.dtdc.hubCode || '',
        pickupVendorCode: data.dtdc.pickupVendorCode || '',
        apiKey: '',
        trackingToken: '',
      })
    }
    if (data?.movin) {
      setMovinForm({
        apiBase: data.movin.apiBase || 'https://apim.iristransport.co.in',
        tenantId: data.movin.tenantId || '',
        serverId: data.movin.serverId || '',
        clientId: data.movin.clientId || '',
        clientSecret: '',
        subscriptionKey: '',
        accountNumber: data.movin.accountNumber || '',
      })
    }
    if (data?.apptmyz) {
      setApptmyzForm({
        apiBase: data.apptmyz.apiBase || 'http://103.73.191.220:8080/flipkart',
        clientName: data.apptmyz.clientName || '',
        username: data.apptmyz.username || '',
        password: '',
        publicKey: '',
        customerCode: data.apptmyz.customerCode || '',
      })
    }
    if (data?.amazon) {
      setAmazonForm({
        apiBase: data.amazon.apiBase || 'https://sellingpartnerapi-eu.amazon.com',
        lwaClientId: data.amazon.lwaClientId || '',
        lwaClientSecret: '',
        refreshToken: '',
        accessToken: '',
        shippingBusinessId: data.amazon.shippingBusinessId || 'AmazonShipping_IN',
        region: data.amazon.region || 'eu',
        sandbox: Boolean(data.amazon.sandbox),
        lwaTokenUrl: data.amazon.lwaTokenUrl || 'https://api.amazon.com/auth/o2/token',
      })
    }
    if (data?.xpressbees) {
      setXpressbeesForm({
        apiBase: data.xpressbees.apiBase || '',
        username: data.xpressbees.username || '',
        password: '',
        apiKey: '',
        authBearer: '',
        secretKey: '',
        xbKey: '',
        xbAccessKey: '',
        businessAccountName: data.xpressbees.businessAccountName || '',
        pickupVendorCode: data.xpressbees.pickupVendorCode || '',
        businessUnit: data.xpressbees.businessUnit || 'ECOM',
        businessFlow: data.xpressbees.businessFlow || 'FORWARD',
        businessService: data.xpressbees.businessService || '',
        businessServices: data.xpressbees.businessServices || 'SD,SDD,NDD,AIR,SFC,IntraSDD',
        manifestServiceType: data.xpressbees.manifestServiceType || 'SD',
        manifestPickupType: data.xpressbees.manifestPickupType || 'Vendor',
        pincodeBusinessUnit: data.xpressbees.pincodeBusinessUnit || 'eComm',
        pincodeBusinessFlow: data.xpressbees.pincodeBusinessFlow || 'Forward',
        pickupBusinessService: data.xpressbees.pickupBusinessService || 'PickUp',
        deliveryBusinessService: data.xpressbees.deliveryBusinessService || 'Delivery',
        serviceabilityVersion: data.xpressbees.serviceabilityVersion || 'v1',
        trackingVersion: data.xpressbees.trackingVersion || 'v1',
        webhookSecret: '',
      })
    }
    if (data?.innofulfill) {
      setInnofulfillForm({
        apiBase: data.innofulfill.apiBase || 'https://apis.innofulfill.com',
        username: data.innofulfill.username || '',
        password: '',
        apiKey: '',
        tenantId: data.innofulfill.tenantId || '',
        userId: data.innofulfill.userId || '',
        signinType: data.innofulfill.signinType || 'EMAIL',
        webhookSecret: '',
      })
    }
  }, [data])

  const handleSaveDelhivery = () => {
    updateDelhivery.mutate(
      {
        apiBase: form.apiBase,
        clientName: form.clientName,
        ...(form.apiKey ? { apiKey: form.apiKey } : {}),
        ltlApiBase: form.ltlApiBase,
        ltlUsername: form.ltlUsername,
        ...(form.ltlPassword ? { ltlPassword: form.ltlPassword } : {}),
      },
      {
        onSuccess: () => {
          toast({
            title: 'Delhivery credentials updated',
            status: 'success',
          })
          setForm((prev) => ({ ...prev, apiKey: '', ltlPassword: '' }))
        },
        onError: (err) => {
          toast({
            title: 'Failed to update credentials',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  const handleDelhiveryLtlLogin = () => {
    loginDelhiveryLtl.mutate(
      {
        username: form.ltlUsername,
        ...(form.ltlPassword ? { password: form.ltlPassword } : {}),
      },
      {
        onSuccess: (response) => {
          toast({
            title: 'Delhivery LTL token generated',
            description: response?.ltlTokenExpiresAt
              ? `Token cached until ${new Date(response.ltlTokenExpiresAt).toLocaleString()}.`
              : undefined,
            status: 'success',
          })
          setForm((prev) => ({ ...prev, ltlPassword: '' }))
        },
        onError: (err) => {
          toast({
            title: 'Failed to log in to Delhivery LTL',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  const handleRequestDelhiveryLtlPasswordReset = () => {
    requestDelhiveryLtlPasswordReset.mutate(
      {
        username: form.ltlUsername,
      },
      {
        onSuccess: (response) => {
          toast({
            title: 'Delhivery LTL password reset requested',
            description: response?.username
              ? `Password reset was requested for ${response.username}.`
              : undefined,
            status: 'success',
          })
        },
        onError: (err) => {
          toast({
            title: 'Failed to request Delhivery LTL password reset',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  const handleDelhiveryLtlLogout = () => {
    logoutDelhiveryLtl.mutate(undefined, {
      onSuccess: () => {
        toast({
          title: 'Delhivery LTL session logged out',
          status: 'success',
        })
      },
      onError: (err) => {
        toast({
          title: 'Failed to log out of Delhivery LTL',
          description: err?.message,
          status: 'error',
        })
      },
    })
  }

  const handleDelhiveryLtlServiceabilityCheck = () => {
    checkDelhiveryLtlServiceability.mutate(
      {
        pincode: delhiveryLtlServiceabilityForm.pincode,
        ...(delhiveryLtlServiceabilityForm.weight.trim()
          ? { weight: delhiveryLtlServiceabilityForm.weight.trim() }
          : {}),
      },
      {
        onSuccess: (response) => {
          setDelhiveryLtlServiceabilityForm((prev) => ({ ...prev, result: response }))
          toast({
            title: response?.serviceable
              ? 'Delhivery LTL pincode is serviceable'
              : 'Delhivery LTL serviceability fetched',
            status: response?.serviceable ? 'success' : 'info',
          })
        },
        onError: (err) => {
          setDelhiveryLtlServiceabilityForm((prev) => ({ ...prev, result: null }))
          toast({
            title: 'Failed to fetch Delhivery LTL serviceability',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  const handleDelhiveryLtlTatCheck = () => {
    getDelhiveryLtlExpectedTat.mutate(
      {
        origin_pin: delhiveryLtlTatForm.originPin.trim(),
        destination_pin: delhiveryLtlTatForm.destinationPin.trim(),
      },
      {
        onSuccess: (response) => {
          setDelhiveryLtlTatForm((prev) => ({ ...prev, result: response }))
          toast({
            title:
              response?.tatDays !== null && response?.tatDays !== undefined
                ? `Delhivery LTL TAT: ${response.tatDays} day(s)`
                : 'Delhivery LTL expected TAT fetched',
            status: 'success',
          })
        },
        onError: (err) => {
          setDelhiveryLtlTatForm((prev) => ({ ...prev, result: null }))
          toast({
            title: 'Failed to fetch Delhivery LTL expected TAT',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  const handleDelhiveryLtlFreightEstimate = () => {
    estimateDelhiveryLtlFreight.mutate(
      {
        dimensions: [
          {
            length_cm: delhiveryLtlFreightForm.lengthCm.trim(),
            width_cm: delhiveryLtlFreightForm.widthCm.trim(),
            height_cm: delhiveryLtlFreightForm.heightCm.trim(),
            box_count: delhiveryLtlFreightForm.boxCount.trim() || '1',
          },
        ],
        weight_g: delhiveryLtlFreightForm.weightG.trim(),
        cheque_payment: delhiveryLtlFreightForm.chequePayment,
        source_pin: delhiveryLtlFreightForm.sourcePin.trim(),
        consignee_pin: delhiveryLtlFreightForm.consigneePin.trim(),
        payment_mode: delhiveryLtlFreightForm.paymentMode,
        ...(delhiveryLtlFreightForm.paymentMode === 'cod'
          ? { cod_amount: delhiveryLtlFreightForm.codAmount.trim() }
          : {}),
        inv_amount: delhiveryLtlFreightForm.invoiceAmount.trim(),
        freight_mode: delhiveryLtlFreightForm.freightMode.trim(),
        rov_insurance: delhiveryLtlFreightForm.rovInsurance,
      },
      {
        onSuccess: (response) => {
          setDelhiveryLtlFreightForm((prev) => ({ ...prev, result: response }))
          toast({
            title:
              response?.estimatedFreight !== null && response?.estimatedFreight !== undefined
                ? `Delhivery LTL estimate: ${response.estimatedFreight}`
                : 'Delhivery LTL freight estimate fetched',
            status: 'success',
          })
        },
        onError: (err) => {
          setDelhiveryLtlFreightForm((prev) => ({ ...prev, result: null }))
          toast({
            title: 'Failed to fetch Delhivery LTL freight estimate',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  const handleDelhiveryLtlFreightChargesLookup = () => {
    getDelhiveryLtlFreightCharges.mutate(
      {
        lrns: delhiveryLtlFreightChargesForm.lrns.trim(),
      },
      {
        onSuccess: (response) => {
          setDelhiveryLtlFreightChargesForm((prev) => ({ ...prev, result: response }))
          toast({
            title: `Delhivery LTL freight charges fetched for ${response?.lrnCount || 0} LRN(s)`,
            status: 'success',
          })
        },
        onError: (err) => {
          setDelhiveryLtlFreightChargesForm((prev) => ({ ...prev, result: null }))
          toast({
            title: 'Failed to fetch Delhivery LTL freight charges',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  const handleCreateDelhiveryLtlClientWarehouse = () => {
    let payload

    try {
      payload = JSON.parse(delhiveryLtlWarehouseForm.payload)
    } catch (err) {
      toast({
        title: 'Invalid warehouse JSON',
        description: 'Enter a valid JSON payload before creating the Delhivery LTL warehouse.',
        status: 'error',
      })
      return
    }

    createDelhiveryLtlClientWarehouse.mutate(payload, {
      onSuccess: (response) => {
        setDelhiveryLtlWarehouseForm((prev) => ({ ...prev, result: response }))
        toast({
          title: `Delhivery LTL warehouse created${response?.warehouseName ? `: ${response.warehouseName}` : ''}`,
          status: 'success',
        })
      },
      onError: (err) => {
        setDelhiveryLtlWarehouseForm((prev) => ({ ...prev, result: null }))
        toast({
          title: 'Failed to create Delhivery LTL warehouse',
          description: err?.message,
          status: 'error',
        })
      },
    })
  }

  const handleUpdateDelhiveryLtlClientWarehouse = () => {
    let payload

    try {
      payload = JSON.parse(delhiveryLtlWarehouseUpdateForm.payload)
    } catch (err) {
      toast({
        title: 'Invalid warehouse update JSON',
        description: 'Enter a valid JSON payload before updating the Delhivery LTL warehouse.',
        status: 'error',
      })
      return
    }

    updateDelhiveryLtlClientWarehouse.mutate(payload, {
      onSuccess: (response) => {
        setDelhiveryLtlWarehouseUpdateForm((prev) => ({ ...prev, result: response }))
        toast({
          title: `Delhivery LTL warehouse updated${response?.warehouseName ? `: ${response.warehouseName}` : ''}`,
          status: 'success',
        })
      },
      onError: (err) => {
        setDelhiveryLtlWarehouseUpdateForm((prev) => ({ ...prev, result: null }))
        toast({
          title: 'Failed to update Delhivery LTL warehouse',
          description: err?.message,
          status: 'error',
        })
      },
    })
  }

  const handleCreateDelhiveryLtlManifest = () => {
    let payload

    try {
      payload = JSON.parse(delhiveryLtlManifestForm.payload)
    } catch (err) {
      toast({
        title: 'Invalid shipment JSON',
        description: 'Enter a valid JSON payload before creating the Delhivery LTL shipment.',
        status: 'error',
      })
      return
    }

    createDelhiveryLtlManifest.mutate(
      {
        payload,
        files: delhiveryLtlManifestForm.files,
      },
      {
        onSuccess: (response) => {
          setDelhiveryLtlManifestForm((prev) => ({ ...prev, result: response }))
          toast({
            title: response?.jobId
              ? `Delhivery LTL shipment submitted: ${response.jobId}`
              : 'Delhivery LTL shipment submitted',
            status: 'success',
          })
        },
        onError: (err) => {
          setDelhiveryLtlManifestForm((prev) => ({ ...prev, result: null }))
          toast({
            title: 'Failed to create Delhivery LTL shipment',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  const handleGetDelhiveryLtlManifestStatus = () => {
    getDelhiveryLtlManifestStatus.mutate(
      {
        job_id: delhiveryLtlManifestStatusForm.jobId.trim(),
      },
      {
        onSuccess: (response) => {
          setDelhiveryLtlManifestStatusForm((prev) => ({ ...prev, result: response }))
          toast({
            title: response?.lrn
              ? `Delhivery LTL status fetched: ${response.lrn}`
              : 'Delhivery LTL shipment status fetched',
            status: 'success',
          })
        },
        onError: (err) => {
          setDelhiveryLtlManifestStatusForm((prev) => ({ ...prev, result: null }))
          toast({
            title: 'Failed to fetch Delhivery LTL shipment status',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  const handleUpdateDelhiveryLtlShipment = () => {
    let payload

    try {
      payload = JSON.parse(delhiveryLtlShipmentUpdateForm.payload)
    } catch (err) {
      toast({
        title: 'Invalid shipment update JSON',
        description: 'Enter a valid JSON payload before updating the Delhivery LTL shipment.',
        status: 'error',
      })
      return
    }

    updateDelhiveryLtlShipment.mutate(
      {
        lrn: delhiveryLtlShipmentUpdateForm.lrn.trim(),
        payload,
        files: delhiveryLtlShipmentUpdateForm.files,
      },
      {
        onSuccess: (response) => {
          setDelhiveryLtlShipmentUpdateForm((prev) => ({ ...prev, result: response }))
          toast({
            title: `Delhivery LTL shipment updated: ${response?.lrn || delhiveryLtlShipmentUpdateForm.lrn.trim()}`,
            status: 'success',
          })
        },
        onError: (err) => {
          setDelhiveryLtlShipmentUpdateForm((prev) => ({ ...prev, result: null }))
          toast({
            title: 'Failed to update Delhivery LTL shipment',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  const handleGetDelhiveryLtlShipmentUpdateStatus = () => {
    getDelhiveryLtlShipmentUpdateStatus.mutate(
      {
        job_id: delhiveryLtlShipmentUpdateStatusForm.jobId.trim(),
      },
      {
        onSuccess: (response) => {
          setDelhiveryLtlShipmentUpdateStatusForm((prev) => ({ ...prev, result: response }))
          toast({
            title: response?.status
              ? `Delhivery LTL update status: ${response.status}`
              : 'Delhivery LTL shipment update status fetched',
            status: 'success',
          })
        },
        onError: (err) => {
          setDelhiveryLtlShipmentUpdateStatusForm((prev) => ({ ...prev, result: null }))
          toast({
            title: 'Failed to fetch Delhivery LTL shipment update status',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  const handleCancelDelhiveryLtlShipment = () => {
    cancelDelhiveryLtlShipment.mutate(
      {
        lrn: delhiveryLtlShipmentCancelForm.lrn.trim(),
      },
      {
        onSuccess: (response) => {
          setDelhiveryLtlShipmentCancelForm((prev) => ({ ...prev, result: response }))
          toast({
            title: `Delhivery LTL shipment cancelled: ${response?.lrn || delhiveryLtlShipmentCancelForm.lrn.trim()}`,
            status: 'success',
          })
        },
        onError: (err) => {
          setDelhiveryLtlShipmentCancelForm((prev) => ({ ...prev, result: null }))
          toast({
            title: 'Failed to cancel Delhivery LTL shipment',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  const handleTrackDelhiveryLtlShipment = () => {
    trackDelhiveryLtlShipment.mutate(
      {
        lrnum: delhiveryLtlShipmentTrackForm.lrn.trim(),
        ...(delhiveryLtlShipmentTrackForm.allWbns ? { all_wbns: true } : {}),
      },
      {
        onSuccess: (response) => {
          setDelhiveryLtlShipmentTrackForm((prev) => ({ ...prev, result: response }))
          toast({
            title: response?.status
              ? `Delhivery LTL tracking: ${response.status}`
              : 'Delhivery LTL shipment tracking fetched',
            status: 'success',
          })
        },
        onError: (err) => {
          setDelhiveryLtlShipmentTrackForm((prev) => ({ ...prev, result: null }))
          toast({
            title: 'Failed to fetch Delhivery LTL shipment tracking',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  const handleGetDelhiveryLtlShippingLabelUrls = () => {
    getDelhiveryLtlShippingLabelUrls.mutate(
      {
        size: delhiveryLtlLabelForm.size.trim().toLowerCase(),
        lrn: delhiveryLtlLabelForm.lrn.trim(),
      },
      {
        onSuccess: (response) => {
          setDelhiveryLtlLabelForm((prev) => ({ ...prev, result: response }))
          toast({
            title: response?.labelCount
              ? `Delhivery LTL labels fetched: ${response.labelCount}`
              : 'Delhivery LTL label URLs fetched',
            status: 'success',
          })
        },
        onError: (err) => {
          setDelhiveryLtlLabelForm((prev) => ({ ...prev, result: null }))
          toast({
            title: 'Failed to fetch Delhivery LTL shipping label URLs',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  const handleGetDelhiveryLtlLrCopy = () => {
    getDelhiveryLtlLrCopy.mutate(
      {
        lrn: delhiveryLtlLrCopyForm.lrn.trim(),
        lrCopyType: delhiveryLtlLrCopyForm.lrCopyType.trim(),
        requestId: delhiveryLtlLrCopyForm.requestId.trim(),
      },
      {
        onSuccess: (response) => {
          setDelhiveryLtlLrCopyForm((prev) => ({ ...prev, result: response }))
          toast({
            title: `Delhivery LTL LR copy fetched: ${response?.lrn || delhiveryLtlLrCopyForm.lrn.trim()}`,
            status: 'success',
          })
        },
        onError: (err) => {
          setDelhiveryLtlLrCopyForm((prev) => ({ ...prev, result: null }))
          toast({
            title: 'Failed to fetch Delhivery LTL LR copy',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  const handleGenerateDelhiveryLtlDocuments = () => {
    let payload

    try {
      payload = JSON.parse(delhiveryLtlDocumentGenerateForm.payload)
    } catch (err) {
      toast({
        title: 'Invalid document generation JSON',
        description: 'Enter a valid JSON payload before generating Delhivery LTL documents.',
        status: 'error',
      })
      return
    }

    generateDelhiveryLtlDocuments.mutate(
      {
        docType: delhiveryLtlDocumentGenerateForm.docType.trim(),
        requestId: delhiveryLtlDocumentGenerateForm.requestId.trim(),
        payload,
      },
      {
        onSuccess: (response) => {
          setDelhiveryLtlDocumentGenerateForm((prev) => ({ ...prev, result: response }))
          toast({
            title: response?.jobId
              ? `Delhivery LTL document job submitted: ${response.jobId}`
              : 'Delhivery LTL document generation submitted',
            status: 'success',
          })
        },
        onError: (err) => {
          setDelhiveryLtlDocumentGenerateForm((prev) => ({ ...prev, result: null }))
          toast({
            title: 'Failed to generate Delhivery LTL documents',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  const handleGetDelhiveryLtlGeneratedDocumentStatus = () => {
    getDelhiveryLtlGeneratedDocumentStatus.mutate(
      {
        docType: delhiveryLtlDocumentStatusForm.docType.trim(),
        jobId: delhiveryLtlDocumentStatusForm.jobId.trim(),
        requestId: delhiveryLtlDocumentStatusForm.requestId.trim(),
      },
      {
        onSuccess: (response) => {
          setDelhiveryLtlDocumentStatusForm((prev) => ({ ...prev, result: response }))
          toast({
            title: response?.status
              ? `Delhivery LTL document status: ${response.status}`
              : 'Delhivery LTL document status fetched',
            status: 'success',
          })
        },
        onError: (err) => {
          setDelhiveryLtlDocumentStatusForm((prev) => ({ ...prev, result: null }))
          toast({
            title: 'Failed to fetch Delhivery LTL document status',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  const handleBookDelhiveryLtlLastMileAppointment = () => {
    const poNumbers = delhiveryLtlAppointmentForm.poNumbers
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)

    bookDelhiveryLtlLastMileAppointment.mutate(
      {
        lrn: delhiveryLtlAppointmentForm.lrn.trim(),
        date: delhiveryLtlAppointmentForm.date.trim(),
        appointment_slot: delhiveryLtlAppointmentForm.appointmentSlot,
        po_number: poNumbers,
        ...(delhiveryLtlAppointmentForm.appointmentId.trim()
          ? { appointment_id: delhiveryLtlAppointmentForm.appointmentId.trim() }
          : {}),
        po_expiry_date: delhiveryLtlAppointmentForm.poExpiryDate.trim(),
      },
      {
        onSuccess: (response) => {
          setDelhiveryLtlAppointmentForm((prev) => ({ ...prev, result: response }))
          toast({
            title: response?.status
              ? `Delhivery LTL appointment booked: ${response.status}`
              : 'Delhivery LTL appointment booked',
            status: 'success',
          })
        },
        onError: (err) => {
          setDelhiveryLtlAppointmentForm((prev) => ({ ...prev, result: null }))
          toast({
            title: 'Failed to book Delhivery LTL appointment',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  const handleCancelDelhiveryLtlPickupRequest = () => {
    cancelDelhiveryLtlPickupRequest.mutate(
      {
        pickupId: delhiveryLtlPickupCancelForm.pickupId.trim(),
        requestId: delhiveryLtlPickupCancelForm.requestId.trim(),
      },
      {
        onSuccess: (response) => {
          setDelhiveryLtlPickupCancelForm((prev) => ({ ...prev, result: response }))
          toast({
            title: `Delhivery LTL pickup cancelled: ${response?.pickupId || delhiveryLtlPickupCancelForm.pickupId.trim()}`,
            status: 'success',
          })
        },
        onError: (err) => {
          setDelhiveryLtlPickupCancelForm((prev) => ({ ...prev, result: null }))
          toast({
            title: 'Failed to cancel Delhivery LTL pickup request',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  const handleOpenPdfDataUrl = (dataUrl, fileName) => {
    if (!dataUrl) return

    const link = document.createElement('a')
    link.href = dataUrl
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.download = fileName || 'delhivery-ltl-document.pdf'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleCopyWebhookUrl = async (value, label) => {
    if (!value) return

    try {
      await navigator.clipboard.writeText(value)
      toast({ title: `${label} copied`, status: 'success' })
    } catch (err) {
      const textarea = document.createElement('textarea')
      textarea.value = value
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'absolute'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      toast({ title: `${label} copied`, status: 'success' })
    }
  }

  const handleSaveEkart = () => {
    updateEkart.mutate(
      {
        apiBase: ekartForm.apiBase,
        clientName: ekartForm.clientName,
        clientId: ekartForm.clientId,
        username: ekartForm.username,
        ...(ekartForm.password ? { password: ekartForm.password } : {}),
        ...(ekartForm.webhookSecret ? { webhookSecret: ekartForm.webhookSecret } : {}),
      },
      {
        onSuccess: () => {
          toast({ title: 'Ekart credentials updated', status: 'success' })
          setEkartForm((prev) => ({ ...prev, password: '', webhookSecret: '' }))
        },
        onError: (err) => {
          toast({
            title: 'Failed to update Ekart credentials',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  const handleSaveDtdc = () => {
    updateDtdc.mutate(
      {
        apiBase: dtdcForm.apiBase,
        bookingApiBase: dtdcForm.bookingApiBase,
        cancelApiBase: dtdcForm.cancelApiBase,
        clientName: dtdcForm.clientName,
        username: dtdcForm.username,
        customerCode: dtdcForm.customerCode,
        serviceTypeId: dtdcForm.serviceTypeId,
        commodityId: dtdcForm.commodityId,
        hubCode: dtdcForm.hubCode,
        pickupVendorCode: dtdcForm.pickupVendorCode,
        ...(dtdcForm.password ? { password: dtdcForm.password } : {}),
        ...(dtdcForm.apiKey ? { apiKey: dtdcForm.apiKey } : {}),
        ...(dtdcForm.trackingToken ? { trackingToken: dtdcForm.trackingToken } : {}),
      },
      {
        onSuccess: () => {
          toast({ title: 'DTDC credentials updated', status: 'success' })
          setDtdcForm((prev) => ({ ...prev, password: '', apiKey: '', trackingToken: '' }))
        },
        onError: (err) => {
          toast({
            title: 'Failed to update DTDC credentials',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  const handleSaveMovin = () => {
    updateMovin.mutate(
      {
        apiBase: movinForm.apiBase,
        tenantId: movinForm.tenantId,
        serverId: movinForm.serverId,
        clientId: movinForm.clientId,
        accountNumber: movinForm.accountNumber,
        ...(movinForm.clientSecret ? { clientSecret: movinForm.clientSecret } : {}),
        ...(movinForm.subscriptionKey ? { subscriptionKey: movinForm.subscriptionKey } : {}),
      },
      {
        onSuccess: () => {
          toast({ title: 'Movin credentials updated', status: 'success' })
          setMovinForm((prev) => ({
            ...prev,
            clientSecret: '',
            subscriptionKey: '',
          }))
        },
        onError: (err) => {
          toast({
            title: 'Failed to update Movin credentials',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  const handleSaveApptmyz = () => {
    updateApptmyz.mutate(
      {
        apiBase: apptmyzForm.apiBase,
        clientName: apptmyzForm.clientName,
        username: apptmyzForm.username,
        customerCode: apptmyzForm.customerCode,
        ...(apptmyzForm.password ? { password: apptmyzForm.password } : {}),
        ...(apptmyzForm.publicKey ? { publicKey: apptmyzForm.publicKey } : {}),
      },
      {
        onSuccess: () => {
          toast({ title: 'Ekart B2B/LTL credentials updated', status: 'success' })
          setApptmyzForm((prev) => ({
            ...prev,
            password: '',
            publicKey: '',
          }))
        },
        onError: (err) => {
          toast({
            title: 'Failed to update Ekart B2B/LTL credentials',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  const handleSaveAmazon = () => {
    updateAmazon.mutate(
      {
        apiBase: amazonForm.apiBase,
        lwaClientId: amazonForm.lwaClientId,
        shippingBusinessId: amazonForm.shippingBusinessId,
        region: amazonForm.region,
        sandbox: amazonForm.sandbox,
        lwaTokenUrl: amazonForm.lwaTokenUrl,
        ...(amazonForm.lwaClientSecret
          ? { lwaClientSecret: amazonForm.lwaClientSecret }
          : {}),
        ...(amazonForm.refreshToken ? { refreshToken: amazonForm.refreshToken } : {}),
        ...(amazonForm.accessToken ? { accessToken: amazonForm.accessToken } : {}),
      },
      {
        onSuccess: () => {
          toast({ title: 'Amazon Shipping credentials updated', status: 'success' })
          setAmazonForm((prev) => ({
            ...prev,
            lwaClientSecret: '',
            refreshToken: '',
            accessToken: '',
          }))
        },
        onError: (err) => {
          toast({
            title: 'Failed to update Amazon Shipping credentials',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  const handleSaveXpressbees = () => {
    updateXpressbees.mutate(
      {
        apiBase: xpressbeesForm.apiBase,
        username: xpressbeesForm.username,
        ...(xpressbeesForm.password ? { password: xpressbeesForm.password } : {}),
        ...(xpressbeesForm.apiKey ? { apiKey: xpressbeesForm.apiKey } : {}),
        ...(xpressbeesForm.authBearer ? { authBearer: xpressbeesForm.authBearer } : {}),
        ...(xpressbeesForm.secretKey ? { secretKey: xpressbeesForm.secretKey } : {}),
        ...(xpressbeesForm.xbKey ? { xbKey: xpressbeesForm.xbKey } : {}),
        ...(xpressbeesForm.xbAccessKey ? { xbAccessKey: xpressbeesForm.xbAccessKey } : {}),
        businessAccountName: xpressbeesForm.businessAccountName,
        pickupVendorCode: xpressbeesForm.pickupVendorCode,
        businessUnit: xpressbeesForm.businessUnit,
        businessFlow: xpressbeesForm.businessFlow,
        businessService: xpressbeesForm.businessService,
        businessServices: xpressbeesForm.businessServices,
        manifestServiceType: xpressbeesForm.manifestServiceType,
        manifestPickupType: xpressbeesForm.manifestPickupType,
        pincodeBusinessUnit: xpressbeesForm.pincodeBusinessUnit,
        pincodeBusinessFlow: xpressbeesForm.pincodeBusinessFlow,
        pickupBusinessService: xpressbeesForm.pickupBusinessService,
        deliveryBusinessService: xpressbeesForm.deliveryBusinessService,
        serviceabilityVersion: xpressbeesForm.serviceabilityVersion,
        trackingVersion: xpressbeesForm.trackingVersion,
        ...(xpressbeesForm.webhookSecret
          ? { webhookSecret: xpressbeesForm.webhookSecret }
          : {}),
      },
      {
        onSuccess: () => {
          toast({ title: 'Xpressbees credentials updated', status: 'success' })
          setXpressbeesForm((prev) => ({
            ...prev,
            password: '',
            apiKey: '',
            authBearer: '',
            secretKey: '',
            xbKey: '',
            xbAccessKey: '',
            webhookSecret: '',
          }))
        },
        onError: (err) => {
          toast({
            title: 'Failed to update Xpressbees credentials',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  const handleSaveInnofulfill = () => {
    updateInnofulfill.mutate(
      {
        apiBase: innofulfillForm.apiBase,
        username: innofulfillForm.username,
        tenantId: innofulfillForm.tenantId,
        userId: innofulfillForm.userId,
        signinType: innofulfillForm.signinType || 'EMAIL',
        ...(innofulfillForm.password ? { password: innofulfillForm.password } : {}),
        ...(innofulfillForm.apiKey ? { apiKey: innofulfillForm.apiKey } : {}),
        ...(innofulfillForm.webhookSecret
          ? { webhookSecret: innofulfillForm.webhookSecret }
          : {}),
      },
      {
        onSuccess: () => {
          toast({ title: 'Shreemaruti credentials updated', status: 'success' })
          setInnofulfillForm((prev) => ({
            ...prev,
            password: '',
            apiKey: '',
            webhookSecret: '',
          }))
        },
        onError: (err) => {
          toast({
            title: 'Failed to update Shreemaruti credentials',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  const handleSaveXpressbeesAwbRange = () => {
    const startAwb = xpressbeesAwbForm.startAwb.trim()
    const endAwb = xpressbeesAwbForm.endAwb.trim()

    if (!startAwb || !endAwb) {
      toast({
        title: 'AWB range required',
        description: 'Enter both starting and ending AWB numbers.',
        status: 'warning',
      })
      return
    }

    updateXpressbeesAwbRange.mutate(
      { startAwb, endAwb },
      {
        onSuccess: () => {
          toast({ title: 'Xpressbees AWB range updated', status: 'success' })
          setXpressbeesAwbForm({ startAwb: '', endAwb: '' })
        },
        onError: (err) => {
          toast({
            title: 'Failed to update Xpressbees AWB range',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  if (isLoading) return <Spinner size="md" />
  if (error) return <Text color="red.500">Failed to load courier credentials</Text>

  const xpressbeesManualAwb = data?.xpressbees?.manualAwb || {}
  const xpressbeesAwbRange = xpressbeesManualAwb?.range || null
  const xpressbeesAwbStatus = xpressbeesManualAwb?.active
    ? 'Active'
    : xpressbeesManualAwb?.configured
      ? 'Inactive'
      : 'Not configured'
  return (
    <Flex direction="column" pt={{ base: '120px', md: '75px' }} gap={4}>
      <Text fontSize="xl" fontWeight="bold">
        Courier Credentials
      </Text>

      <Flex gap={4} flexWrap="wrap">
        <Box
          borderWidth="1px"
          borderRadius="lg"
          p={5}
          minW="320px"
          flex="1"
          maxW="520px"
          mb={{ base: 4, md: 0 }}
        >
          <VStack spacing={4} align="stretch">
            <Flex justify="space-between" align="center">
              <Text fontWeight="semibold">Delhivery B2C</Text>
              <Badge colorScheme={data?.delhivery?.hasApiKey ? 'green' : 'orange'}>
                {data?.delhivery?.hasApiKey ? 'Configured' : 'Missing API Key'}
              </Badge>
            </Flex>

            <FormControl>
              <FormLabel>API Base URL</FormLabel>
              <Input
                value={form.apiBase}
                onChange={(e) => setForm((prev) => ({ ...prev, apiBase: e.target.value }))}
                placeholder="https://track.delhivery.com"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Client Name</FormLabel>
              <Input
                value={form.clientName}
                onChange={(e) => setForm((prev) => ({ ...prev, clientName: e.target.value }))}
                placeholder="Your Delhivery client name"
              />
            </FormControl>

            <FormControl>
              <FormLabel>API Key</FormLabel>
              <Input
                type="password"
                value={form.apiKey}
                onChange={(e) => setForm((prev) => ({ ...prev, apiKey: e.target.value }))}
                placeholder={data?.delhivery?.apiKeyMasked || 'Enter Delhivery API key'}
              />
              {!!data?.delhivery?.apiKeyMasked && (
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Current key: {data.delhivery.apiKeyMasked}
                </Text>
              )}
            </FormControl>

            <Text fontSize="xs" color="gray.500">
              Standard Delhivery B2C credentials. Leave the API key blank to keep the existing
              secret.
            </Text>

            <Button
              colorScheme="blue"
              onClick={handleSaveDelhivery}
              isLoading={updateDelhivery.isPending}
              alignSelf="flex-start"
            >
              Save Delhivery B2C Credentials
            </Button>
          </VStack>
        </Box>

        <Box
          borderWidth="1px"
          borderRadius="lg"
          p={5}
          minW="320px"
          flex="1"
          maxW="520px"
          mb={{ base: 4, md: 0 }}
        >
          <VStack spacing={4} align="stretch">
            <Flex justify="space-between" align="center">
              <Text fontWeight="semibold">Delhivery B2B (LTL)</Text>
              <Badge colorScheme={data?.delhivery?.ltlUsername ? 'green' : 'orange'}>
                {data?.delhivery?.ltlUsername ? 'Configured' : 'Missing LTL Login'}
              </Badge>
            </Flex>

            <FormControl>
              <FormLabel>LTL API Base URL</FormLabel>
              <Input
                value={form.ltlApiBase}
                onChange={(e) => setForm((prev) => ({ ...prev, ltlApiBase: e.target.value }))}
                placeholder="https://ltl-clients-api.delhivery.com"
              />
            </FormControl>

            <FormControl>
              <FormLabel>LTL Username</FormLabel>
              <Input
                value={form.ltlUsername}
                onChange={(e) => setForm((prev) => ({ ...prev, ltlUsername: e.target.value }))}
                placeholder="Registered Delhivery LTL username"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Used for Delhivery LTL authentication flows like forgot-password and token login.
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>LTL Password</FormLabel>
              <Input
                type="password"
                value={form.ltlPassword}
                onChange={(e) => setForm((prev) => ({ ...prev, ltlPassword: e.target.value }))}
                placeholder={
                  data?.delhivery?.hasLtlPassword
                    ? 'Leave blank to keep the saved LTL password'
                    : 'Enter Delhivery LTL password'
                }
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Leave this blank while saving to keep the current password. Delhivery locks the user
                for 10 minutes after repeated invalid login attempts.
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>LTL Token Status</FormLabel>
              <Input
                value={
                  data?.delhivery?.hasLtlToken
                    ? `${data?.delhivery?.ltlTokenMasked || 'Stored token'}${
                        data?.delhivery?.ltlTokenExpiresAt
                          ? ` (expires ${new Date(data.delhivery.ltlTokenExpiresAt).toLocaleString()})`
                          : ''
                      }`
                    : 'No cached LTL token'
                }
                isReadOnly
                fontSize="sm"
              />
            </FormControl>

            <Box borderWidth="1px" borderRadius="md" p={3} bg="gray.50">
              <Text fontSize="sm" fontWeight="semibold">
                LTL Auth Only
              </Text>
              <Text fontSize="xs" color="gray.600" mt={1}>
                This card now keeps only the fields required to authenticate with Delhivery LTL:
                base URL, username, password, and session actions.
              </Text>
              <Text fontSize="xs" color="gray.600" mt={2}>
                Save credentials first, then generate or clear the cached token from the buttons
                below when needed.
              </Text>
            </Box>

            <Text fontSize="xs" color="gray.500">
              Delhivery B2B / LTL settings. Leave the LTL password blank to keep the existing
              secret, and save after updating the LTL API base or login details.
            </Text>

            <Button
              colorScheme="blue"
              onClick={handleSaveDelhivery}
              isLoading={updateDelhivery.isPending}
              alignSelf="flex-start"
            >
              Save Delhivery B2B Credentials
            </Button>

            <Button
              variant="solid"
              colorScheme="teal"
              onClick={handleDelhiveryLtlLogin}
              isLoading={loginDelhiveryLtl.isPending}
              isDisabled={
                !form.ltlUsername.trim() ||
                (!form.ltlPassword.trim() && !data?.delhivery?.hasLtlPassword)
              }
              alignSelf="flex-start"
            >
              Generate LTL Token
            </Button>

            <Button
              variant="ghost"
              colorScheme="red"
              onClick={handleDelhiveryLtlLogout}
              isLoading={logoutDelhiveryLtl.isPending}
              isDisabled={!data?.delhivery?.hasLtlToken}
              alignSelf="flex-start"
            >
              Logout LTL Session
            </Button>

            <Button
              variant="outline"
              colorScheme="orange"
              onClick={handleRequestDelhiveryLtlPasswordReset}
              isLoading={requestDelhiveryLtlPasswordReset.isPending}
              isDisabled={!form.ltlUsername.trim()}
              alignSelf="flex-start"
            >
              Send LTL Password Reset
            </Button>
          </VStack>
        </Box>

        <Box borderWidth="1px" borderRadius="lg" p={5} minW="320px" flex="1" maxW="520px">
          <VStack spacing={4} align="stretch">
            <Flex justify="space-between" align="center">
              <Text fontWeight="semibold">Amazon Shipping B2C</Text>
              <Badge colorScheme={data?.amazon?.configured ? 'green' : 'orange'}>
                {data?.amazon?.configured ? 'Configured' : 'Missing credentials'}
              </Badge>
            </Flex>

            <FormControl>
              <FormLabel>API Base URL</FormLabel>
              <Input
                value={amazonForm.apiBase}
                onChange={(e) => setAmazonForm((prev) => ({ ...prev, apiBase: e.target.value }))}
                placeholder="https://sellingpartnerapi-eu.amazon.com"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Amazon Selling Partner API host for the account region. India uses the EU endpoint.
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>LWA Client ID</FormLabel>
              <Input
                value={amazonForm.lwaClientId}
                onChange={(e) =>
                  setAmazonForm((prev) => ({ ...prev, lwaClientId: e.target.value }))
                }
                placeholder="amzn1.application-oa2-client..."
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Login With Amazon client ID from the approved Amazon Shipping developer app.
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>LWA Client Secret</FormLabel>
              <Input
                type="password"
                value={amazonForm.lwaClientSecret}
                onChange={(e) =>
                  setAmazonForm((prev) => ({ ...prev, lwaClientSecret: e.target.value }))
                }
                placeholder={
                  data?.amazon?.hasLwaClientSecret
                    ? 'Leave blank to keep existing client secret'
                    : 'LWA client secret'
                }
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Secret for the Amazon developer app. It is used with the refresh token to generate
                live access tokens.
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>Refresh Token</FormLabel>
              <Input
                type="password"
                value={amazonForm.refreshToken}
                onChange={(e) =>
                  setAmazonForm((prev) => ({ ...prev, refreshToken: e.target.value }))
                }
                placeholder={data?.amazon?.refreshTokenMasked || 'Atzr| refresh token'}
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Long-lived LWA refresh token generated after the seller authorizes the Amazon
                Shipping app.
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>Direct Access Token</FormLabel>
              <Input
                type="password"
                value={amazonForm.accessToken}
                onChange={(e) =>
                  setAmazonForm((prev) => ({ ...prev, accessToken: e.target.value }))
                }
                placeholder={data?.amazon?.accessTokenMasked || 'Optional Atza| access token'}
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Optional short-lived fallback token. Prefer refresh token plus client ID and secret.
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>Shipping Business ID</FormLabel>
              <Input
                value={amazonForm.shippingBusinessId}
                onChange={(e) =>
                  setAmazonForm((prev) => ({ ...prev, shippingBusinessId: e.target.value }))
                }
                placeholder="AmazonShipping_IN"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Business ID sent as x-amzn-shipping-business-id. India defaults to
                AmazonShipping_IN.
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>Region</FormLabel>
              <Input
                value={amazonForm.region}
                onChange={(e) => setAmazonForm((prev) => ({ ...prev, region: e.target.value }))}
                placeholder="eu"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Region selector for base URL resolution: eu, na, or fe.
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>LWA Token URL</FormLabel>
              <Input
                value={amazonForm.lwaTokenUrl}
                onChange={(e) =>
                  setAmazonForm((prev) => ({ ...prev, lwaTokenUrl: e.target.value }))
                }
                placeholder="https://api.amazon.com/auth/o2/token"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                OAuth token endpoint. Keep the default unless Amazon gives a region-specific LWA
                URL.
              </Text>
            </FormControl>

            <Checkbox
              isChecked={amazonForm.sandbox}
              onChange={(e) => setAmazonForm((prev) => ({ ...prev, sandbox: e.target.checked }))}
            >
              Use Amazon sandbox
            </Checkbox>
            <Text fontSize="xs" color="gray.500">
              Turn this on only for sandbox credentials. Live B2C booking should use production.
            </Text>

            <Text fontSize="xs" color="gray.500">
              The backend exposes rates, shipment purchase, one-click shipment, tracking,
              documents, cancellation, access points, NDR feedback, and additional-input schema
              endpoints.
            </Text>

            <Button
              colorScheme="blue"
              onClick={handleSaveAmazon}
              isLoading={updateAmazon.isPending}
              alignSelf="flex-start"
            >
              Save Amazon Shipping Credentials
            </Button>
          </VStack>
        </Box>

        <Box borderWidth="1px" borderRadius="lg" p={5} minW="320px" flex="1" maxW="520px">
          <VStack spacing={4} align="stretch">
            <Flex justify="space-between" align="center">
              <Text fontWeight="semibold">Ekart B2B/LTL</Text>
              <Badge
                colorScheme={
                  data?.apptmyz?.apiBase &&
                  data?.apptmyz?.username &&
                  data?.apptmyz?.hasPassword &&
                  data?.apptmyz?.hasPublicKey
                    ? 'green'
                    : 'orange'
                }
              >
                {data?.apptmyz?.apiBase &&
                data?.apptmyz?.username &&
                data?.apptmyz?.hasPassword &&
                data?.apptmyz?.hasPublicKey
                  ? 'Configured'
                  : 'Missing credentials'}
              </Badge>
            </Flex>

            <FormControl>
              <FormLabel>API Base URL</FormLabel>
              <Input
                value={apptmyzForm.apiBase}
                onChange={(e) =>
                  setApptmyzForm((prev) => ({ ...prev, apiBase: e.target.value }))
                }
                placeholder="http://103.73.191.220:8080/flipkart"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Base URL from the Ekart B2B/LTL API PDF. Use sandbox for testing and production once the
                live customer account is approved.
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>Client Name</FormLabel>
              <Input
                value={apptmyzForm.clientName}
                onChange={(e) =>
                  setApptmyzForm((prev) => ({ ...prev, clientName: e.target.value }))
                }
                placeholder="Internal account label"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Internal label for the account, such as the customer or business name. This is for
                Kourier Boyz admin reference.
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>Username</FormLabel>
              <Input
                value={apptmyzForm.username}
                onChange={(e) =>
                  setApptmyzForm((prev) => ({ ...prev, username: e.target.value }))
                }
                placeholder="Customer username from Ekart B2B/LTL"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Customer username created during Ekart B2B/LTL onboarding. The PDF sandbox example uses
                a customer code style username.
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>Password</FormLabel>
              <Input
                type="password"
                value={apptmyzForm.password}
                onChange={(e) =>
                  setApptmyzForm((prev) => ({ ...prev, password: e.target.value }))
                }
                placeholder={
                  data?.apptmyz?.hasPassword
                    ? 'Leave blank to keep existing password'
                    : 'Plain password from Apptmyz'
                }
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Plain customer password. Kourier Boyz encrypts it with the Ekart B2B/LTL RSA public key
                before calling the token API.
              </Text>
              {data?.apptmyz?.hasPassword && (
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Password is already configured.
                </Text>
              )}
            </FormControl>

            <FormControl>
              <FormLabel>RSA Public Key</FormLabel>
              <Input
                type="password"
                value={apptmyzForm.publicKey}
                onChange={(e) =>
                  setApptmyzForm((prev) => ({ ...prev, publicKey: e.target.value }))
                }
                placeholder={
                  data?.apptmyz?.publicKeyMasked ||
                  'Paste the Ekart B2B/LTL public key from the API document'
                }
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Public key used to RSA-encrypt the password for /api/customer/login. The PDF says
                the same key is used for staging and production unless Ekart B2B/LTL changes it.
              </Text>
              {!!data?.apptmyz?.publicKeyMasked && (
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Current public key: {data.apptmyz.publicKeyMasked}
                </Text>
              )}
            </FormControl>

            <FormControl>
              <FormLabel>Customer Code</FormLabel>
              <Input
                value={apptmyzForm.customerCode}
                onChange={(e) =>
                  setApptmyzForm((prev) => ({ ...prev, customerCode: e.target.value }))
                }
                placeholder="Optional bill-to/customer code"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Optional customer or bill-to business code. Use it when Ekart B2B/LTL maps multiple B2B
                codes to one login and asks you to send custCode in pickup requests.
              </Text>
            </FormControl>

            <Text fontSize="xs" color="gray.500">
              Integrated backend endpoints cover login, order create/edit/list, docket generation,
              tracking, cancellation, serviceability, masters, appointments, pickup requests, and
              webhook updates.
            </Text>

            <Button
              colorScheme="blue"
              onClick={handleSaveApptmyz}
              isLoading={updateApptmyz.isPending}
              alignSelf="flex-start"
            >
              Save Ekart B2B/LTL Credentials
            </Button>
          </VStack>
        </Box>

        <Box borderWidth="1px" borderRadius="lg" p={5} minW="320px" flex="1" maxW="520px">
          <VStack spacing={4} align="stretch">
            <Flex justify="space-between" align="center">
              <Text fontWeight="semibold">Movin B2B</Text>
              <Badge
                colorScheme={
                  data?.movin?.apiBase &&
                  data?.movin?.tenantId &&
                  data?.movin?.serverId &&
                  data?.movin?.clientId &&
                  data?.movin?.accountNumber &&
                  data?.movin?.hasClientSecret &&
                  data?.movin?.hasSubscriptionKey
                    ? 'green'
                    : 'orange'
                }
              >
                {data?.movin?.apiBase &&
                data?.movin?.tenantId &&
                data?.movin?.serverId &&
                data?.movin?.clientId &&
                data?.movin?.accountNumber &&
                data?.movin?.hasClientSecret &&
                data?.movin?.hasSubscriptionKey
                  ? 'Configured'
                  : 'Missing credentials'}
              </Badge>
            </Flex>

            <FormControl>
              <FormLabel>API Base URL</FormLabel>
              <Input
                value={movinForm.apiBase}
                onChange={(e) => setMovinForm((prev) => ({ ...prev, apiBase: e.target.value }))}
                placeholder="https://apim.iristransport.co.in"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Movin API gateway URL. Use the sandbox or production API Base URL shared in the
                Movin onboarding document.
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>Tenant ID</FormLabel>
              <Input
                value={movinForm.tenantId}
                onChange={(e) => setMovinForm((prev) => ({ ...prev, tenantId: e.target.value }))}
                placeholder="Azure tenant ID from Movin"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Azure OAuth tenant ID used in the token URL:
                login.microsoftonline.com/tenant-id/oauth2/v2.0/token.
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>Server ID</FormLabel>
              <Input
                value={movinForm.serverId}
                onChange={(e) => setMovinForm((prev) => ({ ...prev, serverId: e.target.value }))}
                placeholder="Server/Application ID from Movin"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Movin server/application ID used to build the OAuth scope as server-id/.default.
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>Client ID</FormLabel>
              <Input
                value={movinForm.clientId}
                onChange={(e) => setMovinForm((prev) => ({ ...prev, clientId: e.target.value }))}
                placeholder="OAuth client ID shared by Movin"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                OAuth client_id provided by Movin during account onboarding.
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>Client Secret</FormLabel>
              <Input
                type="password"
                value={movinForm.clientSecret}
                onChange={(e) =>
                  setMovinForm((prev) => ({ ...prev, clientSecret: e.target.value }))
                }
                placeholder={
                  data?.movin?.hasClientSecret
                    ? 'Leave blank to keep existing client secret'
                    : 'OAuth client secret shared by Movin'
                }
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                OAuth client_secret used with client_credentials token generation. Leave blank to
                keep the saved secret.
              </Text>
              {data?.movin?.hasClientSecret && (
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Client secret already configured on Movin.
                </Text>
              )}
            </FormControl>

            <FormControl>
              <FormLabel>Subscription Key</FormLabel>
              <Input
                type="password"
                value={movinForm.subscriptionKey}
                onChange={(e) =>
                  setMovinForm((prev) => ({ ...prev, subscriptionKey: e.target.value }))
                }
                placeholder={
                  data?.movin?.subscriptionKeyMasked ||
                  'Ocp-Apim-Subscription-Key shared by Movin'
                }
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Movin API subscription key sent to the API gateway for shipment, pickup, tracking,
                label, EPOD, and EPOP requests.
              </Text>
              {!!data?.movin?.subscriptionKeyMasked && (
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Current subscription key: {data.movin.subscriptionKeyMasked}
                </Text>
              )}
            </FormControl>

            <FormControl>
              <FormLabel>Movin Account Number</FormLabel>
              <Input
                value={movinForm.accountNumber}
                onChange={(e) =>
                  setMovinForm((prev) => ({ ...prev, accountNumber: e.target.value }))
                }
                placeholder="Account number shared by Movin"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Customer account number allocated by Movin. It is required in shipment and pickup
                payloads to identify the billing account.
              </Text>
            </FormControl>

            <Text fontSize="xs" color="gray.500">
              Keep the sandbox base URL while testing. Switch to the production base URL only after
              Movin confirms the production credentials and account number.
            </Text>

            <Button
              colorScheme="blue"
              onClick={handleSaveMovin}
              isLoading={updateMovin.isPending}
              alignSelf="flex-start"
            >
              Save Movin Credentials
            </Button>
          </VStack>
        </Box>

        <Box borderWidth="1px" borderRadius="lg" p={5} minW="320px" flex="1" maxW="520px">
          <VStack spacing={4} align="stretch">
            <Flex justify="space-between" align="center">
              <Text fontWeight="semibold">Shreemaruti</Text>
              <Badge
                colorScheme={
                  data?.innofulfill?.hasApiKey ||
                  (data?.innofulfill?.username && data?.innofulfill?.hasPassword)
                    ? 'green'
                    : 'orange'
                }
              >
                {data?.innofulfill?.hasApiKey
                  ? 'API key set'
                  : data?.innofulfill?.username && data?.innofulfill?.hasPassword
                    ? 'Login configured'
                    : 'Missing credentials'}
              </Badge>
            </Flex>

            <FormControl>
              <FormLabel>API Base URL</FormLabel>
              <Input
                value={innofulfillForm.apiBase}
                onChange={(e) =>
                  setInnofulfillForm((prev) => ({ ...prev, apiBase: e.target.value }))
                }
                placeholder="https://apis.innofulfill.com"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Shreemaruti API host. Use the production URL from Shreemaruti unless they provide
                a sandbox or merchant-specific base URL.
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>Username / Email</FormLabel>
              <Input
                value={innofulfillForm.username}
                onChange={(e) =>
                  setInnofulfillForm((prev) => ({ ...prev, username: e.target.value }))
                }
                placeholder="user@example.com"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Login email for the Shreemaruti account. Ask Shreemaruti for the API-enabled
                merchant or admin user email.
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>Password</FormLabel>
              <Input
                type="password"
                value={innofulfillForm.password}
                onChange={(e) =>
                  setInnofulfillForm((prev) => ({ ...prev, password: e.target.value }))
                }
                placeholder="Leave blank to keep existing password"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Password for the Shreemaruti login user. Leave this blank when you only want to
                keep the saved password unchanged.
              </Text>
              {data?.innofulfill?.hasPassword && (
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Login password already configured on Shreemaruti.
                </Text>
              )}
            </FormControl>

            <FormControl>
              <FormLabel>Signin Type</FormLabel>
              <Input
                value={innofulfillForm.signinType}
                onChange={(e) =>
                  setInnofulfillForm((prev) => ({ ...prev, signinType: e.target.value }))
                }
                placeholder="EMAIL"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Authentication mode sent to Shreemaruti login. This integration currently supports
                only EMAIL.
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>API Key</FormLabel>
              <Input
                type="password"
                value={innofulfillForm.apiKey}
                onChange={(e) =>
                  setInnofulfillForm((prev) => ({ ...prev, apiKey: e.target.value }))
                }
                placeholder={data?.innofulfill?.apiKeyMasked || 'Enter Shreemaruti API key'}
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Static key used as the Api-Key header for serviceability, rate, order, document,
                and tracking calls. Ask Shreemaruti support or the dashboard owner for the API key.
              </Text>
              {!!data?.innofulfill?.apiKeyMasked && (
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Current key: {data.innofulfill.apiKeyMasked}
                </Text>
              )}
            </FormControl>

            <FormControl>
              <FormLabel>Tenant ID</FormLabel>
              <Input
                value={innofulfillForm.tenantId}
                onChange={(e) =>
                  setInnofulfillForm((prev) => ({ ...prev, tenantId: e.target.value }))
                }
                placeholder="Tenant ID from login response"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Tenant context for bearer-token calls. Usually appears in the login response or
                Shreemaruti merchant/account settings.
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>User ID</FormLabel>
              <Input
                value={innofulfillForm.userId}
                onChange={(e) =>
                  setInnofulfillForm((prev) => ({ ...prev, userId: e.target.value }))
                }
                placeholder="User ID from login response"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Shreemaruti user identifier returned by login. Required for token refresh and
                shipping-label document generation.
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>Webhook Signature Key</FormLabel>
              <Input
                type="password"
                value={innofulfillForm.webhookSecret}
                onChange={(e) =>
                  setInnofulfillForm((prev) => ({ ...prev, webhookSecret: e.target.value }))
                }
                placeholder="Leave blank to keep existing webhook signature key"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Shared secret used to verify x-webhook-signature on delivery webhooks. Configure
                the same secret in Shreemaruti webhook settings.
              </Text>
              {data?.innofulfill?.hasWebhookSecret && (
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Webhook signature key already configured on Shreemaruti.
                </Text>
              )}
            </FormControl>

            <Text fontSize="xs" color="gray.500">
              Operational calls use either Api-Key authentication or Authorization: Bearer access
              token with TenantId. Access and refresh tokens are generated by Shreemaruti login and
              are not stored here as permanent credentials. Leave password, API key, or webhook
              signature key blank to keep the saved value.
            </Text>

            <Button
              colorScheme="blue"
              onClick={handleSaveInnofulfill}
              isLoading={updateInnofulfill.isPending}
              alignSelf="flex-start"
            >
              Save Shreemaruti Credentials
            </Button>
          </VStack>
        </Box>

        <Box borderWidth="1px" borderRadius="lg" p={5} minW="320px" flex="1" maxW="520px">
          <VStack spacing={4} align="stretch">
            <Flex justify="space-between" align="center">
              <Text fontWeight="semibold">Ekart Logistics</Text>
              <Badge colorScheme={data?.ekart?.hasPassword ? 'green' : 'orange'}>
                {data?.ekart?.hasPassword ? 'Credentials set' : 'Missing password'}
              </Badge>
            </Flex>

            <FormControl>
              <FormLabel>API Base URL</FormLabel>
              <Input
                value={ekartForm.apiBase}
                onChange={(e) => setEkartForm((prev) => ({ ...prev, apiBase: e.target.value }))}
                placeholder="https://app.elite.ekartlogistics.in"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Client Name</FormLabel>
              <Input
                value={ekartForm.clientName}
                onChange={(e) =>
                  setEkartForm((prev) => ({ ...prev, clientName: e.target.value }))
                }
                placeholder="RAM ENTERPRISES"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Client ID</FormLabel>
              <Input
                value={ekartForm.clientId}
                onChange={(e) => setEkartForm((prev) => ({ ...prev, clientId: e.target.value }))}
                placeholder="Your Ekart client ID"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Username</FormLabel>
              <Input
                value={ekartForm.username}
                onChange={(e) => setEkartForm((prev) => ({ ...prev, username: e.target.value }))}
                placeholder="Ekart username"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Password</FormLabel>
              <Input
                type="password"
                value={ekartForm.password}
                onChange={(e) => setEkartForm((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="Enter Ekart password (saved securely)"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Webhook Secret</FormLabel>
              <Input
                type="password"
                value={ekartForm.webhookSecret}
                onChange={(e) =>
                  setEkartForm((prev) => ({ ...prev, webhookSecret: e.target.value }))
                }
                placeholder="Leave blank to keep existing webhook secret"
              />
              {data?.ekart?.hasWebhookSecret && (
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Webhook secret already configured on Ekart.
                </Text>
              )}
            </FormControl>

            <Text fontSize="xs" color="gray.500">
              Ekart requires client ID + username/password for token generation. Leave password blank to keep the saved secret.
            </Text>

            <Button
              colorScheme="blue"
              onClick={handleSaveEkart}
              isLoading={updateEkart.isPending}
              alignSelf="flex-start"
            >
              Save Ekart Credentials
            </Button>
          </VStack>
        </Box>

        <Box borderWidth="1px" borderRadius="lg" p={5} minW="320px" flex="1" maxW="520px">
          <VStack spacing={4} align="stretch">
            <Flex justify="space-between" align="center">
              <Text fontWeight="semibold">DTDC</Text>
              <Badge colorScheme={data?.dtdc?.hasApiKey ? 'green' : 'orange'}>
                {data?.dtdc?.hasApiKey ? 'API key set' : 'Missing API key'}
              </Badge>
            </Flex>

            <FormControl>
              <FormLabel>API Base URL</FormLabel>
              <Input
                value={dtdcForm.apiBase}
                onChange={(e) => setDtdcForm((prev) => ({ ...prev, apiBase: e.target.value }))}
                placeholder="https://blktracksvc.dtdc.com"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Production tracking API base from DTDC. Use staging only while testing.
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>Booking API Base URL</FormLabel>
              <Input
                value={dtdcForm.bookingApiBase}
                onChange={(e) =>
                  setDtdcForm((prev) => ({ ...prev, bookingApiBase: e.target.value }))
                }
                placeholder="https://dtdcapi.shipsy.io"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                DTDC Shipsy softdata booking base URL used to create consignments.
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>Cancellation API Base URL</FormLabel>
              <Input
                value={dtdcForm.cancelApiBase}
                onChange={(e) =>
                  setDtdcForm((prev) => ({ ...prev, cancelApiBase: e.target.value }))
                }
                placeholder="https://dtdcapi.shipsy.io"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Shipsy DTDC cancellation, label, and tracking API server.
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>Client Name</FormLabel>
              <Input
                value={dtdcForm.clientName}
                onChange={(e) =>
                  setDtdcForm((prev) => ({ ...prev, clientName: e.target.value }))
                }
                placeholder="Your DTDC account or client name"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Internal label for the DTDC account these credentials belong to.
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>Username</FormLabel>
              <Input
                value={dtdcForm.username}
                onChange={(e) =>
                  setDtdcForm((prev) => ({ ...prev, username: e.target.value }))
                }
                placeholder="DTDC API username"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Username shared by DTDC for the authenticate endpoint.
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>Password</FormLabel>
              <Input
                type="password"
                value={dtdcForm.password}
                onChange={(e) =>
                  setDtdcForm((prev) => ({ ...prev, password: e.target.value }))
                }
                placeholder="Leave blank to keep existing password"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Password shared by DTDC. It is used only to generate the tracking access token.
              </Text>
              {data?.dtdc?.hasPassword && (
                <Text fontSize="xs" color="gray.500" mt={1}>
                Password already configured on DTDC.
              </Text>
            )}
            </FormControl>

            <FormControl>
              <FormLabel>Customer Code</FormLabel>
              <Input
                value={dtdcForm.customerCode}
                onChange={(e) =>
                  setDtdcForm((prev) => ({ ...prev, customerCode: e.target.value }))
                }
                placeholder="DTDC customer code"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Customer code assigned by DTDC and required in the cancellation payload.
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>Hub Code</FormLabel>
              <Input
                value={dtdcForm.hubCode}
                onChange={(e) =>
                  setDtdcForm((prev) => ({ ...prev, hubCode: e.target.value }))
                }
                placeholder="DTDC/Shipsy pickup hub code"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Pickup hub assigned by DTDC/Shipsy. Add this if bookings fail with Auto
                allocated hub not found.
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>Pickup Vendor Code</FormLabel>
              <Input
                value={dtdcForm.pickupVendorCode}
                onChange={(e) =>
                  setDtdcForm((prev) => ({ ...prev, pickupVendorCode: e.target.value }))
                }
                placeholder="Optional DTDC pickup vendor code"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Vendor or pickup location code shared by DTDC/Shipsy when the account has more
                than one pickup mapping.
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>Service Type ID</FormLabel>
              <Input
                value={dtdcForm.serviceTypeId}
                onChange={(e) =>
                  setDtdcForm((prev) => ({ ...prev, serviceTypeId: e.target.value }))
                }
                placeholder="B2C PRIORITY"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                DTDC service type for softdata booking. Default from the API document is B2C
                PRIORITY.
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>Commodity ID</FormLabel>
              <Input
                value={dtdcForm.commodityId}
                onChange={(e) =>
                  setDtdcForm((prev) => ({ ...prev, commodityId: e.target.value }))
                }
                placeholder="99"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                DTDC commodity ID required in the softdata booking payload.
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>Shipsy API Key</FormLabel>
              <Input
                type="password"
                value={dtdcForm.apiKey}
                onChange={(e) =>
                  setDtdcForm((prev) => ({ ...prev, apiKey: e.target.value }))
                }
                placeholder={data?.dtdc?.apiKeyMasked || 'API key shared by DTDC/Shipsy'}
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Customer integration API key sent as api-key for booking, cancellation, label, and
                Shipsy tracking.
              </Text>
              {!!data?.dtdc?.apiKeyMasked && (
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Current API key: {data.dtdc.apiKeyMasked}
                </Text>
              )}
            </FormControl>

            <FormControl>
              <FormLabel>Legacy Tracking Token</FormLabel>
              <Input
                type="password"
                value={dtdcForm.trackingToken}
                onChange={(e) =>
                  setDtdcForm((prev) => ({ ...prev, trackingToken: e.target.value }))
                }
                placeholder={data?.dtdc?.trackingTokenMasked || 'Optional DTDC tracking token'}
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Token for the older DTDC tracking API fallback. It is sent as X-Access-Token.
              </Text>
              {!!data?.dtdc?.trackingTokenMasked && (
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Current tracking token: {data.dtdc.trackingTokenMasked}
                </Text>
              )}
            </FormControl>

            <Text fontSize="xs" color="gray.500">
              The Shipsy API key is required for live DTDC booking/cancellation. The legacy
              tracking token is only used when the Shipsy tracking endpoint cannot return tracking.
            </Text>

            <Button
              colorScheme="blue"
              onClick={handleSaveDtdc}
              isLoading={updateDtdc.isPending}
              alignSelf="flex-start"
            >
              Save DTDC Credentials
            </Button>
          </VStack>
        </Box>

        <Box borderWidth="1px" borderRadius="lg" p={5} minW="320px" flex="1" maxW="520px">
          <VStack spacing={4} align="stretch">
            <Flex justify="space-between" align="center">
              <Text fontWeight="semibold">Xpressbees</Text>
              <Badge
                colorScheme={
                  data?.xpressbees?.hasApiKey ||
                  (data?.xpressbees?.hasPassword && data?.xpressbees?.hasSecretKey)
                    ? 'green'
                    : 'orange'
                }
              >
                {data?.xpressbees?.hasApiKey
                  ? 'API key set'
                  : data?.xpressbees?.hasPassword && data?.xpressbees?.hasSecretKey
                    ? 'Login configured'
                    : 'Missing token config'}
              </Badge>
            </Flex>

            <Box borderTopWidth="1px" pt={4}>
              <Flex justify="space-between" align="center" gap={3} mb={3}>
                <Text fontWeight="semibold">Manual AWB Range</Text>
                <Badge
                  colorScheme={
                    xpressbeesManualAwb?.active
                      ? 'green'
                      : xpressbeesManualAwb?.configured
                        ? 'orange'
                        : 'gray'
                  }
                >
                  {xpressbeesAwbStatus}
                </Badge>
              </Flex>

              <Flex gap={3} flexWrap="wrap" mb={4}>
                <Box minW="140px" flex="1">
                  <Text fontSize="xs" color="gray.500">
                    Current AWB
                  </Text>
                  <Text fontWeight="semibold" wordBreak="break-all">
                    {xpressbeesAwbRange?.currentAwb || 'Not configured'}
                  </Text>
                </Box>
                <Box minW="140px" flex="1">
                  <Text fontSize="xs" color="gray.500">
                    Range
                  </Text>
                  <Text fontWeight="semibold" wordBreak="break-all">
                    {xpressbeesAwbRange
                      ? `${xpressbeesAwbRange.startAwb} - ${xpressbeesAwbRange.endAwb}`
                      : 'Not configured'}
                  </Text>
                </Box>
                <Box minW="110px">
                  <Text fontSize="xs" color="gray.500">
                    Remaining
                  </Text>
                  <Text fontWeight="semibold">{xpressbeesAwbRange?.remainingCount ?? 0}</Text>
                </Box>
                <Box minW="110px">
                  <Text fontSize="xs" color="gray.500">
                    Used
                  </Text>
                  <Text fontWeight="semibold">{xpressbeesAwbRange?.usedCount ?? 0}</Text>
                </Box>
                <Box minW="110px">
                  <Text fontSize="xs" color="gray.500">
                    Failed
                  </Text>
                  <Text fontWeight="semibold">{xpressbeesAwbRange?.failedCount ?? 0}</Text>
                </Box>
              </Flex>

              <Flex gap={3} direction={{ base: 'column', md: 'row' }}>
                <FormControl>
                  <FormLabel>AWB Starting Number</FormLabel>
                  <Input
                    value={xpressbeesAwbForm.startAwb}
                    onChange={(e) =>
                      setXpressbeesAwbForm((prev) => ({ ...prev, startAwb: e.target.value }))
                    }
                    inputMode="numeric"
                    placeholder="Starting AWB"
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>AWB Ending Number</FormLabel>
                  <Input
                    value={xpressbeesAwbForm.endAwb}
                    onChange={(e) =>
                      setXpressbeesAwbForm((prev) => ({ ...prev, endAwb: e.target.value }))
                    }
                    inputMode="numeric"
                    placeholder="Ending AWB"
                  />
                </FormControl>
              </Flex>

              <Button
                colorScheme="blue"
                variant="outline"
                onClick={handleSaveXpressbeesAwbRange}
                isLoading={updateXpressbeesAwbRange.isPending}
                mt={3}
                alignSelf="flex-start"
              >
                Save Manual AWB Range
              </Button>
            </Box>

            <FormControl>
              <FormLabel>API Base URL</FormLabel>
              <Input
                value={xpressbeesForm.apiBase}
                onChange={(e) =>
                  setXpressbeesForm((prev) => ({ ...prev, apiBase: e.target.value }))
                }
                placeholder="https://shipment.xpressbees.com"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Username / Email</FormLabel>
              <Input
                value={xpressbeesForm.username}
                onChange={(e) =>
                  setXpressbeesForm((prev) => ({ ...prev, username: e.target.value }))
                }
                placeholder="Xpressbees username or email"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Password</FormLabel>
              <Input
                type="password"
                value={xpressbeesForm.password}
                onChange={(e) =>
                  setXpressbeesForm((prev) => ({ ...prev, password: e.target.value }))
                }
                placeholder="Leave blank to keep existing password"
              />
            </FormControl>

            <FormControl>
              <FormLabel>API Key / Token</FormLabel>
              <Input
                type="password"
                value={xpressbeesForm.apiKey}
                onChange={(e) =>
                  setXpressbeesForm((prev) => ({ ...prev, apiKey: e.target.value }))
                }
                placeholder={data?.xpressbees?.apiKeyMasked || 'Enter Xpressbees API key'}
              />
              {!!data?.xpressbees?.apiKeyMasked && (
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Current key: {data.xpressbees.apiKeyMasked}
                </Text>
              )}
            </FormControl>

            <FormControl>
              <FormLabel>Auth Bearer</FormLabel>
              <Input
                type="password"
                value={xpressbeesForm.authBearer}
                onChange={(e) =>
                  setXpressbeesForm((prev) => ({ ...prev, authBearer: e.target.value }))
                }
                placeholder="Leave blank to keep existing auth bearer"
              />
              {data?.xpressbees?.hasAuthBearer && (
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Auth bearer already configured on Xpressbees.
                </Text>
              )}
            </FormControl>

            <FormControl>
              <FormLabel>Secret Key</FormLabel>
              <Input
                type="password"
                value={xpressbeesForm.secretKey}
                onChange={(e) =>
                  setXpressbeesForm((prev) => ({ ...prev, secretKey: e.target.value }))
                }
                placeholder="Leave blank to keep existing secret key"
              />
              {data?.xpressbees?.hasSecretKey && (
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Secret key already configured on Xpressbees.
                </Text>
              )}
            </FormControl>

            <FormControl>
              <FormLabel>XB Key</FormLabel>
              <Input
                type="password"
                value={xpressbeesForm.xbKey}
                onChange={(e) =>
                  setXpressbeesForm((prev) => ({ ...prev, xbKey: e.target.value }))
                }
                placeholder="Leave blank to keep existing XB key"
              />
              {data?.xpressbees?.hasXbKey && (
                <Text fontSize="xs" color="gray.500" mt={1}>
                  XB key already configured on Xpressbees.
                </Text>
              )}
            </FormControl>

            <FormControl>
              <FormLabel>XB Access Key</FormLabel>
              <Input
                type="password"
                value={xpressbeesForm.xbAccessKey}
                onChange={(e) =>
                  setXpressbeesForm((prev) => ({ ...prev, xbAccessKey: e.target.value }))
                }
                placeholder="Leave blank to keep existing XB access key"
              />
              {data?.xpressbees?.hasXbAccessKey && (
                <Text fontSize="xs" color="gray.500" mt={1}>
                  XB access key already configured on Xpressbees.
                </Text>
              )}
            </FormControl>

            <FormControl>
              <FormLabel>Business Account Name</FormLabel>
              <Input
                value={xpressbeesForm.businessAccountName}
                onChange={(e) =>
                  setXpressbeesForm((prev) => ({
                    ...prev,
                    businessAccountName: e.target.value,
                  }))
                }
                placeholder="Required for pre-ship manifest"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Pickup Vendor Code</FormLabel>
              <Input
                value={xpressbeesForm.pickupVendorCode}
                onChange={(e) =>
                  setXpressbeesForm((prev) => ({ ...prev, pickupVendorCode: e.target.value }))
                }
                placeholder="Default pickup vendor code"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Business Unit</FormLabel>
              <Input
                value={xpressbeesForm.businessUnit}
                onChange={(e) =>
                  setXpressbeesForm((prev) => ({ ...prev, businessUnit: e.target.value }))
                }
                placeholder="ECOM"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Business Flow</FormLabel>
              <Input
                value={xpressbeesForm.businessFlow}
                onChange={(e) =>
                  setXpressbeesForm((prev) => ({ ...prev, businessFlow: e.target.value }))
                }
                placeholder="FORWARD"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Business Services</FormLabel>
              <Input
                value={xpressbeesForm.businessServices}
                onChange={(e) =>
                  setXpressbeesForm((prev) => ({ ...prev, businessServices: e.target.value }))
                }
                placeholder="SD,SDD,NDD,AIR,SFC,IntraSDD"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Manifest Service Type</FormLabel>
              <Input
                value={xpressbeesForm.manifestServiceType}
                onChange={(e) =>
                  setXpressbeesForm((prev) => ({
                    ...prev,
                    manifestServiceType: e.target.value,
                  }))
                }
                placeholder="SD, SFC, AIR, SDD, NDD"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Manifest Pickup Type</FormLabel>
              <Input
                value={xpressbeesForm.manifestPickupType}
                onChange={(e) =>
                  setXpressbeesForm((prev) => ({
                    ...prev,
                    manifestPickupType: e.target.value,
                  }))
                }
                placeholder="Vendor"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Pincode Business Unit</FormLabel>
              <Input
                value={xpressbeesForm.pincodeBusinessUnit}
                onChange={(e) =>
                  setXpressbeesForm((prev) => ({
                    ...prev,
                    pincodeBusinessUnit: e.target.value,
                  }))
                }
                placeholder="eComm"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Pincode Business Flow</FormLabel>
              <Input
                value={xpressbeesForm.pincodeBusinessFlow}
                onChange={(e) =>
                  setXpressbeesForm((prev) => ({
                    ...prev,
                    pincodeBusinessFlow: e.target.value,
                  }))
                }
                placeholder="Forward"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Pickup Business Service</FormLabel>
              <Input
                value={xpressbeesForm.pickupBusinessService}
                onChange={(e) =>
                  setXpressbeesForm((prev) => ({
                    ...prev,
                    pickupBusinessService: e.target.value,
                  }))
                }
                placeholder="PickUp"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Delivery Business Service</FormLabel>
              <Input
                value={xpressbeesForm.deliveryBusinessService}
                onChange={(e) =>
                  setXpressbeesForm((prev) => ({
                    ...prev,
                    deliveryBusinessService: e.target.value,
                  }))
                }
                placeholder="Delivery"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Serviceability Version</FormLabel>
              <Input
                value={xpressbeesForm.serviceabilityVersion}
                onChange={(e) =>
                  setXpressbeesForm((prev) => ({
                    ...prev,
                    serviceabilityVersion: e.target.value,
                  }))
                }
                placeholder="v1"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Tracking Version</FormLabel>
              <Input
                value={xpressbeesForm.trackingVersion}
                onChange={(e) =>
                  setXpressbeesForm((prev) => ({ ...prev, trackingVersion: e.target.value }))
                }
                placeholder="v1"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Webhook Secret</FormLabel>
              <Input
                type="password"
                value={xpressbeesForm.webhookSecret}
                onChange={(e) =>
                  setXpressbeesForm((prev) => ({ ...prev, webhookSecret: e.target.value }))
                }
                placeholder="Leave blank to keep existing webhook secret"
              />
              {data?.xpressbees?.hasWebhookSecret && (
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Webhook secret already configured on Xpressbees.
                </Text>
              )}
            </FormControl>

            <Text fontSize="xs" color="gray.500">
              Leave password, token, auth bearer, secret key, XB key, XB access key, or webhook
              secret blank to keep the saved value.
            </Text>

            <Button
              colorScheme="blue"
              onClick={handleSaveXpressbees}
              isLoading={updateXpressbees.isPending}
              alignSelf="flex-start"
            >
              Save Xpressbees Credentials
            </Button>
          </VStack>
        </Box>

      </Flex>
    </Flex>
  )
}

export default CourierCredentials
