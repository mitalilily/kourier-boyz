import { DeleteIcon, EditIcon } from '@chakra-ui/icons'
import {
  Box, Button, Checkbox, Flex, FormControl, FormLabel, Heading, HStack, IconButton,
  Input, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader,
  ModalOverlay, Select, Spinner, Switch, Table, TableContainer, Tbody, Td, Text,
  Textarea, Th, Thead, Tr, useDisclosure, useToast,
} from '@chakra-ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { b2bAdminService } from 'services/b2bAdmin.service'

const EMPTY_FORM = { name: '', code: '', defaultMode: 'flat', defaultBasis: 'shipment', description: '', isActive: true }
const MODES = [['flat', 'Flat'], ['percentage', 'Percentage'], ['per_kg', 'Per KG'], ['flat_per_kg', 'Flat + Per KG']]
const BASES = [['shipment', 'Shipment'], ['freight', 'Freight'], ['cod_amount', 'COD Amount'], ['declared_value', 'Declared Value'], ['charged_weight', 'Charged Weight'], ['dead_weight', 'Dead Weight'], ['volumetric_weight', 'Volumetric Weight']]

const AdditionalChargeMasters = () => {
  const [form, setForm] = useState(EMPTY_FORM)
  const [selected, setSelected] = useState(null)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { data = [], isLoading } = useQuery({ queryKey: ['additional-charge-masters'], queryFn: b2bAdminService.getAdditionalChargeMasters })

  const mutation = useMutation({
    mutationFn: (payload) => selected ? b2bAdminService.updateAdditionalChargeMaster(selected.id, payload) : b2bAdminService.createAdditionalChargeMaster(payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['additional-charge-masters'] }); onClose(); toast({ title: 'Additional charge saved', status: 'success' }) },
    onError: (error) => toast({ title: 'Unable to save charge', description: error.response?.data?.error || error.message, status: 'error' }),
  })
  const remove = useMutation({ mutationFn: b2bAdminService.deleteAdditionalChargeMaster, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['additional-charge-masters'] }) })

  const openForm = (record = null) => {
    setSelected(record)
    setForm(record ? { name: record.name, code: record.code, defaultMode: record.defaultMode, defaultBasis: record.defaultBasis, description: record.description || '', isActive: record.isActive } : EMPTY_FORM)
    onOpen()
  }

  return (
    <Box pt={{ base: '110px', md: '86px' }}>
      <Flex justify="space-between" align="center" mb={6}>
        <Box><Heading size="md">Additional Charge Masters</Heading><Text mt={2} fontSize="sm"><Text as="span" color="brand.500">Dashboard</Text> &nbsp;›&nbsp; Additional Charge Masters</Text></Box>
        <Button colorScheme="brand" onClick={() => openForm()}>Add Additional Charge Master</Button>
      </Flex>
      <Box bg="white" border="1px solid" borderColor="gray.100" borderRadius="6px" p={4}>
        {isLoading ? <Spinner color="brand.500" /> : (
          <TableContainer border="1px solid" borderColor="gray.100">
            <Table variant="simple"><Thead><Tr><Th>#</Th><Th>Name</Th><Th>Code</Th><Th>Default Mode</Th><Th>Default Basis</Th><Th>Status</Th><Th>Action</Th></Tr></Thead>
              <Tbody>{data.map((record, index) => <Tr key={record.id}>
                <Td>{index + 1}</Td><Td>{record.name}</Td><Td>{record.code}</Td><Td>{MODES.find(([value]) => value === record.defaultMode)?.[1] || record.defaultMode}</Td><Td>{BASES.find(([value]) => value === record.defaultBasis)?.[1] || record.defaultBasis}</Td>
                <Td><Switch colorScheme="green" isChecked={record.isActive} onChange={(event) => b2bAdminService.updateAdditionalChargeMaster(record.id, { isActive: event.target.checked }).then(() => queryClient.invalidateQueries({ queryKey: ['additional-charge-masters'] }))} /></Td>
                <Td><HStack><IconButton aria-label="Edit" icon={<EditIcon />} size="sm" colorScheme="orange" onClick={() => openForm(record)} /><IconButton aria-label="Delete" icon={<DeleteIcon />} size="sm" colorScheme="red" onClick={() => remove.mutate(record.id)} /></HStack></Td>
              </Tr>)}{!data.length && <Tr><Td colSpan={7} textAlign="center" py={6}>No records found.</Td></Tr>}</Tbody>
            </Table>
          </TableContainer>
        )}
      </Box>
      <Modal isOpen={isOpen} onClose={onClose} size="4xl" isCentered><ModalOverlay /><ModalContent borderRadius="8px"><ModalHeader>{selected ? 'Edit' : 'Add'} Additional Charge Master</ModalHeader><ModalCloseButton /><ModalBody borderTop="1px solid" borderColor="gray.100" pt={5}>
        <Flex gap={4} direction={{ base: 'column', md: 'row' }}><FormControl isRequired><FormLabel>Charge Name</FormLabel><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></FormControl><FormControl><FormLabel>Code</FormLabel><Input placeholder="auto if blank" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></FormControl></Flex>
        <Flex gap={4} mt={4} direction={{ base: 'column', md: 'row' }}><FormControl><FormLabel>Default Mode</FormLabel><Select value={form.defaultMode} onChange={(event) => setForm({ ...form, defaultMode: event.target.value })}>{MODES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></FormControl><FormControl><FormLabel>Default Basis</FormLabel><Select value={form.defaultBasis} onChange={(event) => setForm({ ...form, defaultBasis: event.target.value })}>{BASES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></FormControl></Flex>
        <FormControl mt={4}><FormLabel>Description</FormLabel><Textarea minH="80px" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></FormControl>
        <FormControl mt={4}><FormLabel>Status</FormLabel><Checkbox colorScheme="brand" isChecked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })}>Active</Checkbox></FormControl>
      </ModalBody><ModalFooter borderTop="1px solid" borderColor="gray.100"><Button colorScheme="brand" isLoading={mutation.isPending} onClick={() => mutation.mutate(form)}>Save</Button></ModalFooter></ModalContent></Modal>
    </Box>
  )
}

export default AdditionalChargeMasters
