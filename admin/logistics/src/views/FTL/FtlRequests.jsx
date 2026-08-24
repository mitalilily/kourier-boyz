import {
  Badge,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Table,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tr,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import Card from 'components/Card/Card'
import CardBody from 'components/Card/CardBody'
import ManualRequestDetailsModal from 'components/Admin/ManualRequestDetailsModal'
import PageHeader from 'components/Admin/PageHeader'
import { useEffect, useState } from 'react'
import { FiEdit3, FiRefreshCw } from 'react-icons/fi'
import { fetchAdminFtlRequests, updateAdminFtlRequest } from 'services/ftl.service'

const statuses = [
  'requested',
  'reviewing',
  'quote_shared',
  'processed',
  'in_transit',
  'delivered',
  'cancelled',
]

const statusColor = {
  requested: 'orange',
  reviewing: 'blue',
  quote_shared: 'purple',
  processed: 'cyan',
  in_transit: 'blue',
  delivered: 'green',
  cancelled: 'red',
}

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN')
}

export default function FtlRequests() {
  const [requests, setRequests] = useState([])
  const [page] = useState(1)
  const [filters, setFilters] = useState({ status: '', search: '' })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(null)
  const [detailRequest, setDetailRequest] = useState(null)
  const [editForm, setEditForm] = useState({
    status: 'requested',
    awbNumber: '',
    processedDate: '',
    adminNotes: '',
  })
  const { isOpen, onOpen, onClose } = useDisclosure()
  const detailDisclosure = useDisclosure()
  const toast = useToast()

  const loadRequests = async () => {
    setLoading(true)
    try {
      const data = await fetchAdminFtlRequests(page, 25, filters)
      setRequests(data.requests || [])
    } catch (error) {
      toast({
        title: 'Failed to load FTL requests',
        description: error.response?.data?.message || error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const openEdit = (request) => {
    setSelected(request)
    setEditForm({
      status: request.status || 'requested',
      awbNumber: request.awbNumber || '',
      processedDate: request.processedDate ? String(request.processedDate).slice(0, 10) : '',
      adminNotes: request.adminNotes || '',
    })
    onOpen()
  }

  const openDetails = (request) => {
    setDetailRequest(request)
    detailDisclosure.onOpen()
  }

  const closeDetails = () => {
    detailDisclosure.onClose()
    setDetailRequest(null)
  }

  const detailSections = detailRequest
    ? [
        {
          title: 'Request',
          fields: [
            { label: 'Request ID', value: detailRequest.requestNumber },
            { label: 'Status', value: String(detailRequest.status || '').replace(/_/g, ' ') },
            { label: 'AWB', value: detailRequest.awbNumber },
            { label: 'Created', value: formatDate(detailRequest.createdAt) },
            { label: 'Processed', value: formatDate(detailRequest.processedDate) },
            { label: 'Updated', value: formatDate(detailRequest.updatedAt) },
          ],
        },
        {
          title: 'Customer',
          fields: [
            { label: 'Name', value: detailRequest.customerName },
            { label: 'Phone', value: detailRequest.customerPhone },
            { label: 'Email', value: detailRequest.customerEmail },
            { label: 'Company', value: detailRequest.companyName || detailRequest.profileCompanyName },
            { label: 'User Email', value: detailRequest.userEmail },
          ],
        },
        {
          title: 'Pickup',
          fields: [
            { label: 'Address', value: detailRequest.originAddress },
            { label: 'City', value: detailRequest.originCity },
            { label: 'State', value: detailRequest.originState },
            { label: 'Pincode', value: detailRequest.originPincode },
            { label: 'Country', value: detailRequest.originCountry },
          ],
        },
        {
          title: 'Delivery',
          fields: [
            { label: 'Address', value: detailRequest.destinationAddress },
            { label: 'City', value: detailRequest.destinationCity },
            { label: 'State', value: detailRequest.destinationState },
            { label: 'Pincode', value: detailRequest.destinationPincode },
            { label: 'Country', value: detailRequest.destinationCountry },
          ],
        },
        {
          title: 'Cargo',
          fields: [
            { label: 'Vehicle Type', value: detailRequest.vehicleType },
            { label: 'Material Type', value: detailRequest.materialType },
            { label: 'Weight', value: detailRequest.weightKg ? `${detailRequest.weightKg} kg` : null },
            { label: 'Truck Count', value: detailRequest.truckCount },
            { label: 'Preferred Pickup Date', value: formatDate(detailRequest.loadingDate) },
            { label: 'Notes', value: detailRequest.notes },
          ],
        },
        {
          title: 'Processing',
          fields: [{ label: 'Admin Notes', value: detailRequest.adminNotes }],
        },
        {
          title: 'Captured Form Data',
          raw: detailRequest.formData,
        },
      ]
    : []

  const saveRequest = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await updateAdminFtlRequest(selected.id, {
        ...editForm,
        processedDate: editForm.processedDate || null,
      })
      toast({
        title: 'FTL request updated',
        description: 'Client table will now show the latest AWB/status/date.',
        status: 'success',
        duration: 2500,
        isClosable: true,
      })
      onClose()
      await loadRequests()
    } catch (error) {
      toast({
        title: 'Update failed',
        description: error.response?.data?.message || error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box pt={{ base: '120px', md: '75px' }}>
      <PageHeader
        eyebrow="Manual Operations"
        title="FTL Requests"
        description="Review client full-truck-load requests and publish AWB, status, and processing date back to the client panel."
        meta={[{ label: 'Loaded requests', value: requests.length }]}
        actions={
          <Button leftIcon={<FiRefreshCw />} onClick={loadRequests} isLoading={loading} size="sm" borderRadius="14px">
            Refresh
          </Button>
        }
      />

      <Card mt={6}>
        <CardBody display="block">
          <Flex gap={3} mb={4} flexWrap="wrap">
            <Input
              maxW="300px"
              placeholder="Search request, AWB, customer..."
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            />
            <Select
              maxW="220px"
              placeholder="All statuses"
              value={filters.status}
              onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
            <Button onClick={loadRequests} isLoading={loading}>Apply</Button>
          </Flex>

          <Box overflowX="auto">
            <Table variant="simple" size="sm">
              <Thead>
                <Tr>
                  <Th>Request</Th>
                  <Th>Client</Th>
                  <Th>Route</Th>
                  <Th>Vehicle / Material</Th>
                  <Th>AWB</Th>
                  <Th>Status</Th>
                  <Th>Processed</Th>
                  <Th>Action</Th>
                </Tr>
              </Thead>
              <Tbody>
                {requests.length ? requests.map((request) => (
                  <Tr key={request.id}>
                    <Td>
                      <Button
                        variant="link"
                        colorScheme="blue"
                        fontWeight="800"
                        onClick={() => openDetails(request)}
                        h="auto"
                        minW={0}
                        p={0}
                      >
                        {request.requestNumber}
                      </Button>
                      <Text fontSize="xs" color="gray.500">{formatDate(request.createdAt)}</Text>
                    </Td>
                    <Td>
                      <Text fontWeight="600">{request.customerName}</Text>
                      <Text fontSize="xs" color="gray.500">{request.customerPhone}</Text>
                      <Text fontSize="xs" color="gray.500">{request.userEmail}</Text>
                    </Td>
                    <Td>{request.originCity} → {request.destinationCity}</Td>
                    <Td>
                      <Text>{request.vehicleType}</Text>
                      <Text fontSize="xs" color="gray.500">{request.materialType}</Text>
                    </Td>
                    <Td>{request.awbNumber || '—'}</Td>
                    <Td>
                      <Badge colorScheme={statusColor[request.status] || 'gray'}>
                        {String(request.status || '').replace(/_/g, ' ')}
                      </Badge>
                    </Td>
                    <Td>{formatDate(request.processedDate)}</Td>
                    <Td>
                      <Button size="xs" leftIcon={<FiEdit3 />} onClick={() => openEdit(request)}>
                        Update
                      </Button>
                    </Td>
                  </Tr>
                )) : (
                  <Tr>
                    <Td colSpan={8} textAlign="center" py={8}>
                      {loading ? 'Loading FTL requests...' : 'No FTL requests found'}
                    </Td>
                  </Tr>
                )}
              </Tbody>
            </Table>
          </Box>
        </CardBody>
      </Card>

      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Update FTL Request</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <HStack spacing={4} align="start">
              <FormControl>
                <FormLabel>Status</FormLabel>
                <Select value={editForm.status} onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value }))}>
                  {statuses.map((status) => (
                    <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
                  ))}
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Processed Date</FormLabel>
                <Input type="date" value={editForm.processedDate} onChange={(e) => setEditForm((prev) => ({ ...prev, processedDate: e.target.value }))} />
              </FormControl>
            </HStack>
            <FormControl mt={4}>
              <FormLabel>AWB Number</FormLabel>
              <Input value={editForm.awbNumber} onChange={(e) => setEditForm((prev) => ({ ...prev, awbNumber: e.target.value }))} placeholder="Enter manual AWB" />
            </FormControl>
            <FormControl mt={4}>
              <FormLabel>Admin Notes</FormLabel>
              <Textarea value={editForm.adminNotes} onChange={(e) => setEditForm((prev) => ({ ...prev, adminNotes: e.target.value }))} placeholder="Internal/client-facing processing notes" />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>Cancel</Button>
            <Button colorScheme="blue" onClick={saveRequest} isLoading={saving}>Save</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <ManualRequestDetailsModal
        isOpen={detailDisclosure.isOpen}
        onClose={closeDetails}
        title={detailRequest?.requestNumber || 'FTL request'}
        subtitle="Full truck load request details"
        sections={detailSections}
      />
    </Box>
  )
}
