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
import PageHeader from 'components/Admin/PageHeader'
import ManualRequestDetailsModal from 'components/Admin/ManualRequestDetailsModal'
import Card from 'components/Card/Card'
import CardBody from 'components/Card/CardBody'
import { useEffect, useState } from 'react'
import { FiEdit3, FiRefreshCw } from 'react-icons/fi'
import { fetchAdminInternationalShipments, updateAdminInternationalShipment } from 'services/international.service'

const statuses = ['requested', 'reviewing', 'booked', 'in_transit', 'delivered', 'cancelled']
const statusColor = { requested: 'orange', reviewing: 'blue', booked: 'green', in_transit: 'blue', delivered: 'green', cancelled: 'red' }
const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN')
}

export default function InternationalShipments() {
  const [shipments, setShipments] = useState([])
  const [filters, setFilters] = useState({ status: '', search: '' })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(null)
  const [detailShipment, setDetailShipment] = useState(null)
  const [editForm, setEditForm] = useState({ status: 'requested', awbNumber: '', bookedDate: '', adminNotes: '' })
  const { isOpen, onOpen, onClose } = useDisclosure()
  const detailDisclosure = useDisclosure()
  const toast = useToast()

  const loadShipments = async () => {
    setLoading(true)
    try {
      const data = await fetchAdminInternationalShipments(1, 25, filters)
      setShipments(data.shipments || [])
    } catch (error) {
      toast({ title: 'Failed to load international shipments', description: error.response?.data?.message || error.message, status: 'error', duration: 3000, isClosable: true })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadShipments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openEdit = (shipment) => {
    setSelected(shipment)
    setEditForm({
      status: shipment.status || 'requested',
      awbNumber: shipment.awbNumber || '',
      bookedDate: shipment.bookedDate ? String(shipment.bookedDate).slice(0, 10) : '',
      adminNotes: shipment.adminNotes || '',
    })
    onOpen()
  }

  const openDetails = (shipment) => {
    setDetailShipment(shipment)
    detailDisclosure.onOpen()
  }

  const closeDetails = () => {
    detailDisclosure.onClose()
    setDetailShipment(null)
  }

  const detailSections = detailShipment
    ? [
        {
          title: 'Request',
          fields: [
            { label: 'Request ID', value: detailShipment.shipmentNumber },
            { label: 'Status', value: String(detailShipment.status || '').replace(/_/g, ' ') },
            { label: 'AWB', value: detailShipment.awbNumber },
            { label: 'Created', value: formatDate(detailShipment.createdAt) },
            { label: 'Booked', value: formatDate(detailShipment.bookedDate) },
            { label: 'Updated', value: formatDate(detailShipment.updatedAt) },
          ],
        },
        {
          title: 'Customer and Consignee',
          fields: [
            { label: 'Consignee Name', value: detailShipment.consigneeName },
            { label: 'Phone', value: detailShipment.consigneePhone },
            { label: 'Alternate Phone', value: detailShipment.consigneeAlternatePhone },
            { label: 'Email', value: detailShipment.consigneeEmail },
            { label: 'GSTIN', value: detailShipment.consigneeGstin },
            { label: 'User Email', value: detailShipment.userEmail },
          ],
        },
        {
          title: 'Destination',
          fields: [
            { label: 'Address Line 1', value: detailShipment.addressLine1 },
            { label: 'Address Line 2', value: detailShipment.addressLine2 },
            { label: 'Landmark', value: detailShipment.landmark },
            { label: 'City', value: detailShipment.destinationCity },
            { label: 'State', value: detailShipment.destinationState },
            { label: 'Pincode', value: detailShipment.destinationPincode },
            { label: 'Country', value: detailShipment.destinationCountry },
          ],
        },
        {
          title: 'Shipment',
          fields: [
            { label: 'Pickup ID', value: detailShipment.pickupId },
            { label: 'Payment Method', value: detailShipment.paymentMethod },
            { label: 'ROV', value: detailShipment.rov },
            { label: 'Item Type', value: detailShipment.itemType },
            { label: 'Item Category', value: detailShipment.itemCategory },
            { label: 'Shipping Mode', value: detailShipment.shippingMode },
            { label: 'Order Value', value: detailShipment.orderValue },
            { label: 'Applicable Weight', value: detailShipment.applicableWeight ? `${detailShipment.applicableWeight} kg` : null },
          ],
        },
        {
          title: 'Invoice and Reference',
          fields: [
            { label: 'Invoice Number', value: detailShipment.invoiceNumber },
            { label: 'Order Date', value: formatDate(detailShipment.orderDate) },
            { label: 'Eway Bill No', value: detailShipment.ewayBillNo },
            { label: 'Customer Reference No', value: detailShipment.customerReferenceNo },
            { label: 'Seller Name', value: detailShipment.sellerName },
            { label: 'Admin Notes', value: detailShipment.adminNotes },
          ],
        },
        { title: 'Products', raw: detailShipment.products },
        { title: 'Packages', raw: detailShipment.packages },
        { title: 'Rate Quote', raw: detailShipment.rateQuote },
        { title: 'Captured Form Data', raw: detailShipment.formData },
      ]
    : []

  const saveShipment = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await updateAdminInternationalShipment(selected.id, { ...editForm, bookedDate: editForm.bookedDate || null })
      toast({ title: 'International shipment updated', description: 'Client panel will show the AWB/status/date.', status: 'success', duration: 2500, isClosable: true })
      onClose()
      await loadShipments()
    } catch (error) {
      toast({ title: 'Update failed', description: error.response?.data?.message || error.message, status: 'error', duration: 3000, isClosable: true })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box pt={{ base: '120px', md: '75px' }}>
      <PageHeader
        eyebrow="Manual Operations"
        title="International Shipments"
        description="Manual queue for international shipment requests. Add AWB, mark booked, and publish booking date back to the client panel."
        meta={[{ label: 'Loaded shipments', value: shipments.length }]}
        actions={<Button leftIcon={<FiRefreshCw />} onClick={loadShipments} isLoading={loading} size="sm" borderRadius="14px">Refresh</Button>}
      />
      <Card mt={6}>
        <CardBody display="block">
          <Flex gap={3} mb={4} flexWrap="wrap">
            <Input maxW="320px" placeholder="Search shipment, AWB, consignee..." value={filters.search} onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))} />
            <Select maxW="220px" placeholder="All statuses" value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
              {statuses.map((status) => <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>)}
            </Select>
            <Button onClick={loadShipments} isLoading={loading}>Apply</Button>
          </Flex>
          <Box overflowX="auto">
            <Table variant="simple" size="sm">
              <Thead><Tr><Th>Shipment</Th><Th>Client</Th><Th>Destination</Th><Th>Mode</Th><Th>Weight</Th><Th>AWB</Th><Th>Status</Th><Th>Booked</Th><Th>Action</Th></Tr></Thead>
              <Tbody>
                {shipments.length ? shipments.map((shipment) => (
                  <Tr key={shipment.id}>
                    <Td>
                      <Button
                        variant="link"
                        colorScheme="blue"
                        fontWeight="800"
                        onClick={() => openDetails(shipment)}
                        h="auto"
                        minW={0}
                        p={0}
                      >
                        {shipment.shipmentNumber}
                      </Button>
                      <Text fontSize="xs" color="gray.500">{formatDate(shipment.createdAt)}</Text>
                    </Td>
                    <Td><Text fontWeight="600">{shipment.consigneeName}</Text><Text fontSize="xs" color="gray.500">{shipment.consigneePhone}</Text><Text fontSize="xs" color="gray.500">{shipment.userEmail}</Text></Td>
                    <Td>{shipment.destinationCity}, {shipment.destinationCountry}</Td>
                    <Td>{shipment.shippingMode || '—'}</Td>
                    <Td>{shipment.applicableWeight || '—'} kg</Td>
                    <Td>{shipment.awbNumber || '—'}</Td>
                    <Td><Badge colorScheme={statusColor[shipment.status] || 'gray'}>{String(shipment.status || '').replace(/_/g, ' ')}</Badge></Td>
                    <Td>{formatDate(shipment.bookedDate)}</Td>
                    <Td><Button size="xs" leftIcon={<FiEdit3 />} onClick={() => openEdit(shipment)}>Update</Button></Td>
                  </Tr>
                )) : <Tr><Td colSpan={9} textAlign="center" py={8}>{loading ? 'Loading international shipments...' : 'No international shipments found'}</Td></Tr>}
              </Tbody>
            </Table>
          </Box>
        </CardBody>
      </Card>

      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Update International Shipment</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <HStack spacing={4} align="start">
              <FormControl><FormLabel>Status</FormLabel><Select value={editForm.status} onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value }))}>{statuses.map((status) => <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>)}</Select></FormControl>
              <FormControl><FormLabel>Booked Date</FormLabel><Input type="date" value={editForm.bookedDate} onChange={(e) => setEditForm((prev) => ({ ...prev, bookedDate: e.target.value }))} /></FormControl>
            </HStack>
            <FormControl mt={4}><FormLabel>AWB Number</FormLabel><Input value={editForm.awbNumber} onChange={(e) => setEditForm((prev) => ({ ...prev, awbNumber: e.target.value }))} placeholder="Enter manual AWB" /></FormControl>
            <FormControl mt={4}><FormLabel>Admin Notes</FormLabel><Textarea value={editForm.adminNotes} onChange={(e) => setEditForm((prev) => ({ ...prev, adminNotes: e.target.value }))} /></FormControl>
          </ModalBody>
          <ModalFooter><Button variant="ghost" mr={3} onClick={onClose}>Cancel</Button><Button colorScheme="blue" onClick={saveShipment} isLoading={saving}>Save</Button></ModalFooter>
        </ModalContent>
      </Modal>
      <ManualRequestDetailsModal
        isOpen={detailDisclosure.isOpen}
        onClose={closeDetails}
        title={detailShipment?.shipmentNumber || 'International request'}
        subtitle="International shipment request details"
        sections={detailSections}
      />
    </Box>
  )
}
