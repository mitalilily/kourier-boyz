import { DeleteIcon, EditIcon } from '@chakra-ui/icons'
import {
  Badge,
  Button,
  HStack,
  Spinner,
  Switch,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react'

const PlanTable = ({ data, loading, onEdit, onDelete, onActivate, onSetRate }) => {
  if (loading) return <Spinner color="brand.500" />

  const getTypeColor = (type) => {
    const normalized = String(type || 'b2c').toLowerCase()
    if (normalized === 'b2b') return 'blue'
    if (normalized === 'international') return 'purple'
    return 'orange'
  }

  return (
    <TableContainer border="1px solid" borderColor="gray.200" borderRadius="6px">
      <Table variant="simple">
        <Thead bg="gray.50">
          <Tr>
            <Th>ID</Th>
            <Th>Name</Th>
            <Th>Type</Th>
            <Th>Plan Status</Th>
            <Th>Action</Th>
          </Tr>
        </Thead>
        <Tbody>
          {data.map((plan, index) => (
            <Tr key={plan.id}>
              <Td>{plan.id || index + 1}</Td>
              <Td fontWeight="600">{plan.name}</Td>
              <Td>
                <Badge colorScheme={getTypeColor(plan.business_type)}>
                  {String(plan.business_type || 'b2c').toUpperCase()}
                </Badge>
              </Td>
              <Td>
                <HStack>
                  <Switch
                    colorScheme="green"
                    isChecked={Boolean(plan.is_active)}
                    onChange={(event) => onActivate({ ...plan, is_active: event.target.checked })}
                  />
                  <Text color={plan.is_active ? 'green.600' : 'gray.500'}>
                    {plan.is_active ? 'Active' : 'Inactive'}
                  </Text>
                </HStack>
              </Td>
              <Td>
                <HStack spacing={2}>
                  <Button size="sm" colorScheme="brand" onClick={() => onSetRate(plan)}>
                    Set Rate
                  </Button>
                  <Button size="sm" colorScheme="orange" leftIcon={<EditIcon />} onClick={() => onEdit(plan)}>
                    Edit
                  </Button>
                  <Button size="sm" colorScheme="red" leftIcon={<DeleteIcon />} onClick={() => onDelete(plan.id)}>
                    Delete
                  </Button>
                </HStack>
              </Td>
            </Tr>
          ))}
          {!data.length && (
            <Tr><Td colSpan={5} py={10} textAlign="center" color="gray.500">No rate card plans found.</Td></Tr>
          )}
        </Tbody>
      </Table>
    </TableContainer>
  )
}

export default PlanTable
