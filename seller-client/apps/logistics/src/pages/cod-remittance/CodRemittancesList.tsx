import { alpha, Box, Chip, Grid, Paper, Stack, Typography } from '@mui/material'
import moment from 'moment'
import { useState } from 'react'
import {
  MdAccessTime,
  MdAccountBalanceWallet,
  MdCheckCircle,
  MdDownload,
  MdHourglassEmpty,
  MdTrendingUp,
} from 'react-icons/md'
import { FilterBar, type FilterField } from '../../components/FilterBar'
import AWBLink from '../../components/UI/AWBLink'
import ListPageLayout from '../../components/UI/layout/ListPageLayout'
import DataTable, { type Column } from '../../components/UI/table/DataTable'
import {
  handleCodRemittancesExport,
  useCodRemittances,
  useCodStats,
} from '../../hooks/useCodRemittance'

const BRAND_SURFACE = '#16181D'
const BRAND_PRIMARY = '#B78115'
const BRAND_ORANGE = '#555D61'

interface SummaryCardProps {
  title: string
  value: number
  helper: string
  icon: React.ReactNode
  tone: 'dark' | 'primary' | 'wine' | 'light'
}

function SummaryCard({ title, value, helper, icon, tone }: SummaryCardProps) {
  const toneStyles = {
    dark: {
      background: BRAND_SURFACE,
      border: '1px solid rgba(255,255,255,0.06)',
      titleColor: '#D8DEE8',
      valueColor: '#FFFFFF',
      helperColor: '#C7D0DD',
      iconBg: 'rgba(255,255,255,0.08)',
      iconColor: '#FFFFFF',
    },
    primary: {
      background: '#FFFFFF',
      border: `1px solid ${alpha(BRAND_PRIMARY, 0.14)}`,
      titleColor: '#4B5563',
      valueColor: BRAND_PRIMARY,
      helperColor: '#6B7280',
      iconBg: alpha(BRAND_PRIMARY, 0.08),
      iconColor: BRAND_PRIMARY,
    },
    wine: {
      background: '#FFFFFF',
      border: `1px solid ${alpha(BRAND_ORANGE, 0.16)}`,
      titleColor: '#4B5563',
      valueColor: BRAND_ORANGE,
      helperColor: '#6B7280',
      iconBg: alpha(BRAND_ORANGE, 0.1),
      iconColor: BRAND_ORANGE,
    },
    light: {
      background: '#F8FAFC',
      border: '1px solid rgba(15, 23, 42, 0.08)',
      titleColor: '#4B5563',
      valueColor: '#111827',
      helperColor: '#6B7280',
      iconBg: '#FFFFFF',
      iconColor: '#111827',
    },
  }[tone]

  return (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        p: 2.2,
        borderRadius: 0,
        background: toneStyles.background,
        border: toneStyles.border,
        boxShadow: 'none',
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: '0.78rem',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: toneStyles.titleColor,
            }}
          >
            {title}
          </Typography>
          <Typography
            sx={{
              mt: 1.1,
              fontSize: { xs: '1.55rem', md: '1.9rem' },
              fontWeight: 800,
              lineHeight: 1.05,
              color: toneStyles.valueColor,
            }}
          >
            ₹{Number(value || 0).toLocaleString('en-IN')}
          </Typography>
          <Typography sx={{ mt: 1.1, fontSize: '0.84rem', color: toneStyles.helperColor }}>
            {helper}
          </Typography>
        </Box>

        <Box
          sx={{
            width: 44,
            height: 44,
            flexShrink: 0,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 0,
            bgcolor: toneStyles.iconBg,
            color: toneStyles.iconColor,
            border: `1px solid ${alpha('#111827', tone === 'dark' ? 0.04 : 0.08)}`,
          }}
        >
          {icon}
        </Box>
      </Stack>
    </Paper>
  )
}

export default function CodRemittancesList() {
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(20)
  const [filters, setFilters] = useState<{
    status?: string
    fromDate?: Date
    toDate?: Date
  }>({})

  // Convert Date objects to ISO strings for API
  const apiFilters = {
    status: filters.status,
    fromDate: filters.fromDate?.toISOString(),
    toDate: filters.toDate?.toISOString(),
  }

  // Use custom hooks
  const { data: stats } = useCodStats()
  const { data, isLoading } = useCodRemittances(page, rowsPerPage, apiFilters)

  const handleExport = async () => {
    try {
      await handleCodRemittancesExport(apiFilters)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  const getStatusColor = (status: string) => {
    return status === 'credited' ? 'success' : 'info'
  }

  const getStatusIcon = (status: string) => {
    return status === 'credited' ? <MdCheckCircle /> : <MdHourglassEmpty />
  }

  const filterFields: FilterField[] = [
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { label: 'All', value: '' },
        { label: 'Processing', value: 'pending' },
        { label: 'Settled', value: 'credited' },
      ],
      placeholder: 'Select status',
    },
    {
      name: 'fromDate',
      label: 'From Date',
      type: 'date',
      placeholder: 'Start date',
    },
    {
      name: 'toDate',
      label: 'To Date',
      type: 'date',
      placeholder: 'End date',
    },
  ]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns: Column<any>[] = [
    {
      id: 'orderNumber',
      label: 'Order Number',
      minWidth: 150,
      render: (_, row) => (
        <Box>
          <Typography variant="body2" fontWeight={600}>
            {row.orderNumber}
          </Typography>
          {row.awbNumber && (
            <Typography variant="caption" color="text.secondary">
              AWB: <AWBLink awb={row.awbNumber} />
            </Typography>
          )}
        </Box>
      ),
    },
    {
      id: 'courierPartner',
      label: 'Courier',
      minWidth: 120,
      render: (val) => <Typography variant="body2">{val || 'N/A'}</Typography>,
    },
    {
      id: 'codAmount',
      label: 'COD Amount',
      minWidth: 120,
      render: (val) => (
        <Typography variant="body2" fontWeight={600}>
          ₹{Number(val).toLocaleString('en-IN')}
        </Typography>
      ),
    },
    {
      id: 'deductions',
      label: 'Deductions',
      minWidth: 120,
      render: (val) => (
        <Typography variant="body2" color="error.main">
          -₹{Number(val).toLocaleString('en-IN')}
        </Typography>
      ),
    },
    {
      id: 'remittableAmount',
      label: 'Remittable',
      minWidth: 130,
      render: (val) => (
        <Typography variant="body2" fontWeight={700} color="success.main">
          ₹{Number(val).toLocaleString('en-IN')}
        </Typography>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      minWidth: 130,
      render: (val) => (
        <Chip label={val} color={getStatusColor(val)} size="small" icon={getStatusIcon(val)} />
      ),
    },
    {
      id: 'collectedAt',
      label: 'Collected',
      minWidth: 120,
      render: (val) => (
        <Typography variant="body2">{val ? moment(val).format('DD MMM YYYY') : 'N/A'}</Typography>
      ),
    },
    {
      id: 'creditedAt',
      label: 'Settled At',
      minWidth: 150,
      render: (val) => (
        <Typography variant="body2">
          {val ? moment(val).format('DD MMM YYYY HH:mm') : '-'}
        </Typography>
      ),
    },
  ]

  const summaryCardsSection = (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <SummaryCard
          title="Remitted Till Date"
          value={stats?.remittedTillDate || 0}
          helper={`${stats?.creditedCount || 0} settled remittances`}
          icon={<MdTrendingUp size={24} />}
          tone="dark"
        />
      </Grid>

      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <SummaryCard
          title="Last Remittance"
          value={stats?.lastRemittance || 0}
          helper="Most recent settlement"
          icon={<MdCheckCircle size={24} />}
          tone="primary"
        />
      </Grid>

      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <SummaryCard
          title="Next Remittance"
          value={stats?.nextRemittance || 0}
          helper={`${stats?.pendingCount || 0} orders pending`}
          icon={<MdAccountBalanceWallet size={24} />}
          tone="wine"
        />
      </Grid>

      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <SummaryCard
          title="Total Remittance Due"
          value={stats?.totalDue || 0}
          helper="Awaiting settlement"
          icon={<MdAccessTime size={24} />}
          tone="light"
        />
      </Grid>
    </Grid>
  )

  const controls = (
    <Box sx={{ px: 2 }}>
      <FilterBar
        fields={filterFields}
        onApply={(appliedFilters) => {
          setFilters(appliedFilters)
          setPage(1)
        }}
        mode="button"
        buttonLabel="Filters"
        defaultValues={{
          status: '',
          fromDate: undefined,
          toDate: undefined,
        }}
        appliedCount={Object.values(filters).filter(Boolean).length}
      />
    </Box>
  )

  const table = (
    <>
      {isLoading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <Typography>Loading remittances...</Typography>
        </Box>
      ) : (
        <DataTable
          rows={data?.remittances || []}
          columns={columns}
          title="All Remittances"
          pagination
          currentPage={page}
          defaultRowsPerPage={rowsPerPage}
          totalCount={data?.totalCount || 0}
          onPageChange={(newPage) => setPage(newPage)}
          onRowsPerPageChange={(newRowsPerPage) => {
            setRowsPerPage(newRowsPerPage)
            setPage(1)
          }}
        />
      )}
    </>
  )

  return (
    <ListPageLayout
      title="COD Remittance"
      description="Track your Cash on Delivery settlements"
      actions={[
        {
          label: 'Export CSV',
          onClick: handleExport,
          icon: <MdDownload />,
          variant: 'contained',
        },
      ]}
      controls={controls}
    >
      <Box sx={{ px: 2 }}>{summaryCardsSection}</Box>
      {table}
    </ListPageLayout>
  )
}
