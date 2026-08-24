import {
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  Tab,
  TabList,
  Tabs,
  Text,
  useToast,
} from '@chakra-ui/react'
import { IconPlane, IconTruck, IconUpload } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import Papa from 'papaparse'
import { useEffect, useMemo, useState } from 'react'

import CustomModal from 'components/Modal/CustomModal'
import DownloadSampleCSVButton from 'components/CSV/DownloadSampleCSVButton'
import { RateCardEditModal } from 'components/Modal/RateCardEditModal'
import TableFilters from 'components/Tables/TableFilters'
import FileUploader from 'components/upload/FileUploader'
import { GenericTable } from 'views/Dashboard/Tables/components/GenericTable'

import { useImportShippingRates, useShippingRates } from 'hooks/useCouriers'
import { useZones } from 'hooks/useZones'
import { fetchAllCouriersList } from 'services/courier.service'
import { PlansService } from 'services/plan.service'

const RateCard = () => {
  const toast = useToast()
  const { zones } = useZones()
  const { data: courierList = [] } = useQuery({
    queryKey: ['all-couriers', { businessType: 'b2c' }],
    queryFn: () => fetchAllCouriersList({ businessType: 'b2c' }),
  })
  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['plans', { businessType: 'b2c', status: 'active' }],
    queryFn: () => PlansService.getPlans({ businessType: 'b2c', status: 'active' }),
  })

  const { mutate: importRates, isPending: isImporting } = useImportShippingRates()
  const [filters, setFilters] = useState({})
  const { data, isLoading } = useShippingRates(filters)

  const [selectedRate, setSelectedRate] = useState(null)
  const [isModalOpen, setModalOpen] = useState(false)
  const [isImportModalOpen, setImportModalOpen] = useState(false)

  const [selectedPlanIndex, setSelectedPlanIndex] = useState(0)

  // Set default plan filter when plans load
  useEffect(() => {
    if (plans?.length > 0) {
      setFilters((prev) => ({ ...prev, planId: plans[0].id }))
    }
  }, [plans])

  const openEditModal = (row) => {
    setSelectedRate(row)
    setModalOpen(true)
  }

  const openAddModal = () => {
    setSelectedRate(null)
    setModalOpen(true)
  }

  const handleSaveRates = (updated) => {
    console.log('Saving rates:', updated)
    // TODO: call backend mutation
  }

  const handleTabChange = (index) => {
    setSelectedPlanIndex(index)
    const selectedPlanId = plans[index]?.id
    setFilters((prev) => ({ ...prev, planId: selectedPlanId }))
  }

  const handleImportRates = () => setImportModalOpen(true)

  const downloadCSV = (allCouriers, allZones, existingData) => {
    if (!allZones || !allCouriers) return

    const headers = [
      'ID',
      'Courier',
      ...allZones.flatMap((zone) => [`${zone.name} (Forward)`, `${zone.name} (RTO)`]),
      'COD Charges',
      'COD Charges (%)',
      'Other Charges',
    ]

    const normalize = (s) => s?.trim().toLowerCase().replace(/\s+/g, ' ').replace(/_/g, ' ') ?? ''

    const rows = allCouriers.map((courier) => {
      const courierName = courier?.name || courier
      const row =
        existingData?.find((r) => normalize(r.courier_name) === normalize(courierName)) || {}

      const zoneValues = allZones.flatMap((zone) => {
        const zoneRates = row.rates?.[zone.name] || {}
        return [
          zoneRates.forward != null ? `₹${zoneRates.forward}` : '',
          zoneRates.rto != null ? `₹${zoneRates.rto}` : '',
        ]
      })

      return [
        row?.id,
        courierName,
        ...zoneValues,
        row.cod_charges != null ? `₹${row.cod_charges}` : '',
        row.cod_percent != null ? `${row.cod_percent}%` : '',
        row.other_charges != null ? `₹${row.other_charges}` : '',
      ]
    })

    const csv = Papa.unparse({ fields: headers, data: rows })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', 'shipping_rate_card.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const buildFlatRateCardSampleRows = (allZones = []) => {
    const zoneFields = Object.fromEntries(
      allZones.flatMap((zone, index) => [
        [`${zone.name} (Forward)`, index === 0 ? 45 : 55 + index * 8],
        [`${zone.name} (RTO)`, index === 0 ? 35 : 45 + index * 7],
      ]),
    )

    return [
      {
        'Courier ID': 100,
        'Courier Name': 'Delhivery Surface',
        'Service Provider': 'delhivery',
        Mode: 'surface',
        'Min Weight': 0.5,
        ...zoneFields,
        'COD Charges': 35,
        'COD Percent': 2,
        'Other Charges': 0,
      },
    ]
  }

  const buildB2CSlabRateCardSampleRows = (allZones = []) => {
    const firstSlabZoneRates = Object.fromEntries(
      allZones.map((zone, index) => [zone.name, index === 0 ? 45 : 55 + index * 8]),
    )
    const additionalSlabZoneRates = Object.fromEntries(
      allZones.map((zone, index) => [zone.name, index === 0 ? 25 : 30 + index * 5]),
    )

    return [
      {
        'Courier ID': 100,
        Courier: 'Delhivery Surface',
        'Service Provider': 'delhivery',
        Mode: 'surface',
        Slab: '0.5 kg',
        'Slab Type': 'first',
        'Weight (KG)': 0.5,
        ...firstSlabZoneRates,
        'COD Rs': 35,
        'COD %': 2,
        'RTO %': 80,
      },
      {
        'Courier ID': 100,
        Courier: 'Delhivery Surface',
        'Service Provider': 'delhivery',
        Mode: 'surface',
        Slab: '0.5 kg',
        'Slab Type': 'additional',
        'Weight (KG)': 0.5,
        ...additionalSlabZoneRates,
        'COD Rs': '',
        'COD %': '',
        'RTO %': '',
      },
    ]
  }

  const zoneColumns = useMemo(() => {
    if (!zones) return []
    return zones.map((zone) => ({
      key: `${zone.code}_rates`,
      label: `${zone.name} (F | RTO)`,
      width: '190px',
      renderer: (_, row) => {
        const zoneRates = row.rates?.[zone.name] || {}
        return `${zoneRates.forward != null ? `₹${zoneRates.forward}` : 'NA'} | ${
          zoneRates.rto != null ? `₹${zoneRates.rto}` : 'NA'
        }`
      },
    }))
  }, [zones])

  const preZoneColumns = useMemo(
    () => [
      { key: 'id', label: 'ID', width: '50px' },
      {
        key: 'courier_info',
        label: 'Courier Info',
        width: '200px',
        renderer: (_, row) => {
          const serviceProvider = row.service_provider || row.serviceProvider
          return (
            <Box>
              <Text fontWeight="semibold">{row.courier_name || 'N/A'}</Text>
              {serviceProvider && (
                <Text fontSize="xs" color="gray.600" mt={0.5}>
                  Provider:{' '}
                  <Badge colorScheme="green" fontSize="xs">
                    {serviceProvider}
                  </Badge>
                </Text>
              )}
            </Box>
          )
        },
      },
      {
        key: 'mode',
        label: 'Mode',
        width: '100px',
        renderer: (value) => {
          if (!value) return '-'
          const lower = value.toLowerCase()
          if (lower === 'air')
            return (
              <Flex align="center" gap={2}>
                <IconPlane size={28} stroke={1.5} color="blue" />
              </Flex>
            )
          if (lower === 'surface')
            return (
              <Flex align="center" gap={2}>
                <IconTruck size={28} stroke={1.5} color="green" />
              </Flex>
            )
          return value
        },
      },
    ],
    [],
  )

  const postZoneColumns = useMemo(
    () => [
      {
        key: 'cod_charges',
        label: 'COD Charges (Charges | Percent)',
        width: '200px',
        renderer: (_, row) =>
          `${row.cod_charges != null ? `₹${row.cod_charges}` : 'NA'} | ${
            row.cod_percent != null ? `${row.cod_percent}%` : 'NA'
          }`,
      },
      {
        key: 'other_charges',
        label: 'Other Charges',
        width: '120px',
        renderer: (value) => (value ? `₹${value}` : '-'),
      },
    ],
    [],
  )

  const columns = [...preZoneColumns, ...zoneColumns, ...postZoneColumns]

  const filterOptions = useMemo(
    () => [
      {
        key: 'courier_name',
        label: 'Courier',
        type: 'multiselect',
        options:
          courierList?.map((courier) => ({
            label: courier?.name || courier,
            value: courier?.name || courier,
          })) || [],
      },
      {
        key: 'mode',
        label: 'Mode',
        type: 'select',
        options: [
          { label: 'Air', value: 'air' },
          { label: 'Surface', value: 'surface' },
        ],
      },
      {
        key: 'zone',
        label: 'Zone',
        type: 'multiselect',
        options: zones?.map((zone) => ({ label: zone.name, value: zone.code })) || [],
      },
    ],
    [courierList, zones],
  )

  return (
    <Flex direction="column" pt={{ base: '120px', md: '75px' }} gap={4}>
      {/* Plan Tabs */}
      <Tabs
        variant="soft-rounded"
        colorScheme="brand"
        index={selectedPlanIndex}
        onChange={handleTabChange}
        mb={4}
      >
        <TabList>
          {plans?.map((plan) => (
            <Tab key={plan.id}>{plan.name}</Tab>
          ))}
        </TabList>
      </Tabs>

      {/* Filters and actions */}
      <Grid templateColumns="3fr 2fr" width="100%" gap={4} mb={4} alignItems="center">
        <TableFilters filters={filterOptions} values={filters} onApply={setFilters} />
        <Flex justify="flex-end" gap={2}>
          <Button size="sm" colorScheme="green" onClick={openAddModal}>
            Add Rate Card
          </Button>
          <Button
            size="sm"
            colorScheme="pink"
            leftIcon={<IconUpload />}
            onClick={handleImportRates}
          >
            Import Rate Card
          </Button>
          <Button
            size="sm"
            colorScheme="blue"
            onClick={() => downloadCSV(courierList ?? [], zones ?? [], data ?? [])}
          >
            Download CSV
          </Button>
        </Flex>
      </Grid>

      {/* Rate Card Table */}
      <GenericTable
        title="Shipping Rate Card"
        columnKeys={columns.map((c) => c.key)}
        captions={columns.map((c) => c.label)}
        columnWidths={Object.fromEntries(columns.map((c) => [c.key, c.width]))}
        renderers={Object.fromEntries(
          columns.filter((c) => c.renderer).map((c) => [c.key, c.renderer]),
        )}
        data={data ?? []}
        loading={isLoading}
        renderActions={(row) => (
          <Button size="sm" colorScheme="blue" onClick={() => openEditModal(row)}>
            Edit Rates
          </Button>
        )}
        paginated={false}
        totalCount={data?.length}
      />

      {/* Edit Rate Modal */}
      <RateCardEditModal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        data={selectedRate}
        zones={zones}
        businessType="b2c"
        planId={filters.planId}
        couriers={courierList ?? []}
        existingRates={data ?? []}
        onSave={handleSaveRates}
      />

      {/* Import Modal */}
      <CustomModal
        isOpen={isImportModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Import Rates"
        size="xl"
        action={
          <Flex gap={2} flexWrap="wrap" justify="flex-end">
            <DownloadSampleCSVButton
              headers={buildFlatRateCardSampleRows(zones ?? [])}
              filename="rate_card_flat_template.csv"
              buttonText="Flat Sample CSV"
              colorScheme="blue"
              tooltip="Download the simple zone-wise import format"
            />
            <DownloadSampleCSVButton
              headers={buildB2CSlabRateCardSampleRows(zones ?? [])}
              filename="rate_card_b2c_slab_template.csv"
              buttonText="B2C Slab Sample CSV"
              colorScheme="teal"
              tooltip="Download the slab-wise B2C import format"
            />
          </Flex>
        }
      >
        <Box mb={4} p={3} bg="blue.50" borderRadius="md" border="1px solid" borderColor="blue.100">
          <Text fontSize="sm" fontWeight="semibold" color="blue.800">
            Choose a sample format before uploading
          </Text>
          <Text fontSize="xs" color="blue.700" mt={1}>
            Flat CSV updates one row per courier and mode. B2C slab CSV supports first/additional
            slab rows, zone-wise rates, COD charges, and RTO percentage.
          </Text>
        </Box>
        <FileUploader
          maxSizeMb={5}
          folderKey="rates"
          uploadLoading={isImporting}
          onUploaded={(files) => {
            if (!files.length) return
            importRates(files[0], {
              onSuccess: () => {
                toast({
                  title: 'Imported successfully',
                  status: 'success',
                  duration: 3000,
                  isClosable: true,
                })
                setImportModalOpen(false)
              },
              onError: (err) => {
                toast({
                  title: 'Failed to upload rate card',
                  description: err?.message,
                  status: 'error',
                  duration: 4000,
                  isClosable: true,
                })
              },
            })
          }}
        />
      </CustomModal>
    </Flex>
  )
}

export default RateCard
