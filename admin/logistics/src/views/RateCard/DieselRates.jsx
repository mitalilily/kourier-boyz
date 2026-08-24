import { DeleteIcon, EditIcon } from '@chakra-ui/icons'
import {
  Box, Button, Checkbox, Flex, FormControl, FormLabel, Heading, HStack, IconButton,
  Input, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader,
  ModalOverlay, Spinner, Switch, Table, TableContainer, Tbody, Td, Text, Textarea,
  Th, Thead, Tr, useDisclosure, useToast,
} from '@chakra-ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { b2bAdminService } from 'services/b2bAdmin.service'

const EMPTY_FORM = { dieselRate: '', effectiveDate: '', remarks: '', isActive: true }

const DieselRates = () => {
  const [form, setForm] = useState(EMPTY_FORM)
  const [selected, setSelected] = useState(null)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { data = [], isLoading } = useQuery({ queryKey: ['diesel-rates'], queryFn: b2bAdminService.getDieselRates })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['diesel-rates'] })

  const mutation = useMutation({
    mutationFn: (payload) => selected ? b2bAdminService.updateDieselRate(selected.id, payload) : b2bAdminService.createDieselRate(payload),
    onSuccess: () => { refresh(); onClose(); toast({ title: 'Diesel rate saved', status: 'success' }) },
    onError: (error) => toast({ title: 'Unable to save diesel rate', description: error.response?.data?.error || error.message, status: 'error' }),
  })
  const remove = useMutation({ mutationFn: b2bAdminService.deleteDieselRate, onSuccess: refresh })

  const openForm = (record = null) => {
    setSelected(record)
    setForm(record ? { dieselRate: record.dieselRate, effectiveDate: record.effectiveDate, remarks: record.remarks || '', isActive: record.isActive } : EMPTY_FORM)
    onOpen()
  }

  return (
    <Box pt={{ base: '110px', md: '86px' }}>
      <Flex justify="space-between" align="center" mb={6}>
        <Box><Heading size="md">Diesel Rates</Heading><Text mt={2} fontSize="sm"><Text as="span" color="brand.500">Dashboard</Text> &nbsp;›&nbsp; Diesel Rates</Text></Box>
        <Button colorScheme="brand" onClick={() => openForm()}>Add Diesel Rate</Button>
      </Flex>
      <Box bg="white" border="1px solid" borderColor="gray.100" borderRadius="6px" p={4}>
        {isLoading ? <Spinner color="brand.500" /> : <TableContainer border="1px solid" borderColor="gray.100"><Table variant="simple"><Thead><Tr><Th>#</Th><Th>Diesel Rate</Th><Th>Effective Date</Th><Th>Status</Th><Th>Remarks</Th><Th>Action</Th></Tr></Thead>
          <Tbody>{data.map((record, index) => <Tr key={record.id}><Td>{index + 1}</Td><Td>{Number(record.dieselRate).toFixed(2)}</Td><Td>{record.effectiveDate}</Td><Td><Switch colorScheme="green" isChecked={record.isActive} onChange={(event) => b2bAdminService.updateDieselRate(record.id, { isActive: event.target.checked }).then(refresh)} /></Td><Td>{record.remarks || '-'}</Td><Td><HStack><IconButton aria-label="Edit" icon={<EditIcon />} size="sm" colorScheme="orange" onClick={() => openForm(record)} /><IconButton aria-label="Delete" icon={<DeleteIcon />} size="sm" colorScheme="red" onClick={() => remove.mutate(record.id)} /></HStack></Td></Tr>)}{!data.length && <Tr><Td colSpan={6} textAlign="center" py={6}>No diesel rates found.</Td></Tr>}</Tbody>
        </Table></TableContainer>}
      </Box>
      <Modal isOpen={isOpen} onClose={onClose} size="md" isCentered><ModalOverlay /><ModalContent borderRadius="8px"><ModalHeader>{selected ? 'Edit' : 'Add'} Diesel Rate</ModalHeader><ModalCloseButton /><ModalBody borderTop="1px solid" borderColor="gray.100" pt={5}>
        <FormControl isRequired><FormLabel>Diesel Rate</FormLabel><Input type="number" min="0" step="0.01" value={form.dieselRate} onChange={(event) => setForm({ ...form, dieselRate: event.target.value })} /></FormControl>
        <FormControl isRequired mt={4}><FormLabel>Effective Date</FormLabel><Input type="date" value={form.effectiveDate} onChange={(event) => setForm({ ...form, effectiveDate: event.target.value })} /></FormControl>
        <FormControl mt={4}><FormLabel>Remarks</FormLabel><Textarea minH="80px" value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} /></FormControl>
        <Checkbox mt={4} colorScheme="brand" isChecked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })}>Active</Checkbox>
      </ModalBody><ModalFooter borderTop="1px solid" borderColor="gray.100"><Button colorScheme="brand" isLoading={mutation.isPending} onClick={() => mutation.mutate(form)}>Save</Button></ModalFooter></ModalContent></Modal>
    </Box>
  )
}

export default DieselRates
