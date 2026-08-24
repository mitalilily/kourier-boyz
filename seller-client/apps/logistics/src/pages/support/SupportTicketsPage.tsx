import { Box, Button, Skeleton, Stack, Typography } from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { FiMail, FiPlus } from 'react-icons/fi'
import { useLocation, useNavigate } from 'react-router-dom'
import type { SupportTicketPrefill } from '../../api/support.api'
import { FilterBar, type FilterField } from '../../components/FilterBar'
import CustomDrawer from '../../components/UI/drawer/CustomDrawer'
import ListPageLayout from '../../components/UI/layout/ListPageLayout'
import CustomDialog from '../../components/UI/modal/CustomModal'
import TableSkeleton from '../../components/UI/table/TableSkeleton'
import { SupportTicketForm } from '../../components/support/SupportTicketForm'
import SupportTicketList from '../../components/support/SupportTicketList'
import TicketStatusSummaryCard from '../../components/support/TicketStatusSummaryCard'
import { useMyTickets } from '../../hooks/User/useSupport'

const supportTicketFilterFields: FilterField[] = [
  {
    name: 'sortBy',
    label: 'Sort By',
    type: 'select',
    options: [
      { label: 'Latest First', value: 'latest' },
      { label: 'Oldest First', value: 'oldest' },
      { label: 'Due Soon', value: 'dueSoon' },
      { label: 'Due Latest', value: 'dueLatest' },
    ],
    placeholder: 'Select sort order',
  },
  {
    name: 'subject',
    label: 'Subject',
    type: 'text',
    placeholder: 'Search by subject',
  },
  {
    name: 'awbNumber',
    label: 'AWB Number',
    type: 'text',
    placeholder: 'Search by AWB',
    isAdvanced: true,
  },
  {
    name: 'category',
    label: 'Category',
    type: 'select',
    options: [
      { label: 'All', value: '' },
      { label: 'Shipment Issues', value: 'shipment_issues' },
      { label: 'AWB & Label Issues', value: 'awb_issues' },
      { label: 'Payments & Refunds', value: 'payment_refund' },
      { label: 'Courier Partner Issues', value: 'courier_partner' },
      { label: 'Returns & RTOs', value: 'returns_rto' },
      { label: 'KYC & Onboarding', value: 'kyc_onboarding' },
      { label: 'Platform Issues', value: 'platform_issue' },
      { label: 'Other / General Query', value: 'other' },
    ],
    placeholder: 'Select category',
  },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { label: 'All', value: '' },
      { label: 'Open', value: 'open' },
      { label: 'In Progress', value: 'in_progress' },
      { label: 'Resolved', value: 'resolved' },
      { label: 'Closed', value: 'closed' },
    ],
    placeholder: 'Select status',
    isAdvanced: true,
  },
  {
    name: 'subcategory',
    label: 'Subcategory',
    type: 'text',
    isAdvanced: true,
    placeholder: 'Search by subcategory',
  },
]

const initialFilterValues = {
  sortBy: 'latest',
  subject: '',
  awbNumber: '',
  category: '',
  status: '',
  subcategory: '',
}

const SUPPORT_EMAIL = 'support@kourierboyz.com'
const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=Kourier Boyz%20Support%20Request`

export const SupportTicketsPage = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [filters, setFilters] = useState(initialFilterValues)
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [ticketPrefill, setTicketPrefill] = useState<SupportTicketPrefill | null>(null)
  const [supportEmailOpen, setSupportEmailOpen] = useState(false)

  const routePrefill = useMemo(
    () =>
      (location.state as { ticketPrefill?: SupportTicketPrefill } | null)?.ticketPrefill ?? null,
    [location.state],
  )

  useEffect(() => {
    if (!routePrefill) return

    setTicketPrefill(routePrefill)
    setDrawerOpen(true)
    navigate(location.pathname, { replace: true, state: {} })
  }, [location.pathname, navigate, routePrefill])

  const closeDrawer = () => {
    setDrawerOpen(false)
    setTicketPrefill(null)
  }

  const { data: tickets, isLoading } = useMyTickets({
    page,
    limit: rowsPerPage,
    filters: filters,
  })

  const appliedCount = Object.entries(filters).filter(
    ([key, value]) => key !== 'sortBy' && Boolean(value),
  ).length

  const controls = (
    <Box sx={{ px: 2 }}>
      <FilterBar
        fields={supportTicketFilterFields}
        defaultValues={initialFilterValues}
        onApply={(newFilters) => {
          setFilters(newFilters)
          setPage(0)
        }}
        mode="button"
        buttonLabel="Filters"
        appliedCount={appliedCount}
      />
    </Box>
  )

  const summaryCard = isLoading ? (
    <Skeleton />
  ) : (
    <TicketStatusSummaryCard
      counts={tickets?.statusCounts ?? { closed: 0, in_progress: 0, open: 0, resolved: 0 }}
    />
  )

  const list = (
    <>
      {isLoading ? (
        <TableSkeleton />
      ) : (
        <SupportTicketList
          rows={tickets?.data ?? []}
          currentPage={page}
          rowsPerPage={rowsPerPage}
          totalCount={tickets?.totalCount ?? 0}
          onPageChange={(newPage) => setPage(newPage)}
          onRowsPerPageChange={(rows) => {
            setRowsPerPage(rows)
            setPage(1)
          }}
        />
      )}
    </>
  )

  return (
    <>
      <ListPageLayout
        title="Support Tickets"
        description="Manage your support requests and track resolutions"
        actions={[
          {
            label: 'Create Ticket',
            onClick: () => setDrawerOpen(true),
            icon: <FiPlus />,
            variant: 'contained',
          },
          {
            label: 'Email Support',
            onClick: () => setSupportEmailOpen(true),
            icon: <FiMail />,
            variant: 'outlined',
          },
        ]}
        controls={controls}
      >
        <Box sx={{ px: 2, mb: 2 }}>{summaryCard}</Box>
        {list}
      </ListPageLayout>

      <CustomDrawer
        title="Create Support Ticket"
        open={drawerOpen}
        width={1100}
        onClose={closeDrawer}
        anchor="right"
      >
        <Stack sx={{ color: '#fff', p: 2 }} gap={2}>
          <SupportTicketForm
            onSuccess={() => {
              closeDrawer()
            }}
            onCancel={closeDrawer}
            initialPrefill={ticketPrefill}
          />
        </Stack>
      </CustomDrawer>

      <CustomDialog
        title="Email Support"
        open={supportEmailOpen}
        onClose={() => setSupportEmailOpen(false)}
        maxWidth="xs"
        footer={
          <>
            <Button
              variant="outlined"
              onClick={() => setSupportEmailOpen(false)}
              sx={{ textTransform: 'none', borderRadius: 1.5 }}
            >
              Close
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                window.location.href = SUPPORT_MAILTO
              }}
              sx={{
                textTransform: 'none',
                borderRadius: 1.5,
                bgcolor: '#B78115',
                '&:hover': { bgcolor: '#8F650F' },
              }}
            >
              Open Mail
            </Button>
          </>
        }
      >
        <Stack gap={1.5}>
          <Typography sx={{ fontSize: '0.95rem', color: '#374151', lineHeight: 1.7 }}>
            Our support team will be happy to help you. Please write to us at the email below
            and include your ticket ID, AWB, or order number if available.
          </Typography>
          <Box
            sx={{
              px: 2,
              py: 1.4,
              borderRadius: 2,
              border: '1px solid rgba(254, 101, 2, 0.22)',
              bgcolor: 'rgba(254, 101, 2, 0.06)',
            }}
          >
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 800, color: '#6B7280', mb: 0.4 }}>
              Support email
            </Typography>
            <Typography sx={{ fontSize: '1rem', fontWeight: 900, color: '#17171A' }}>
              {SUPPORT_EMAIL}
            </Typography>
          </Box>
        </Stack>
      </CustomDialog>
    </>
  )
}
