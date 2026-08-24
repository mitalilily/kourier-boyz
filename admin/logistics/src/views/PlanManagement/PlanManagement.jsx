import { AddIcon, ArrowBackIcon } from '@chakra-ui/icons'
import { Box, Button, Flex, Heading, HStack, Text, useDisclosure } from '@chakra-ui/react'
import { RateCardContainer } from 'components/RateCard/RateCardContainer'
import PlanModal from 'components/plans/PlanModal'
import PlanTable from 'components/plans/PlanTable'
import { useDeletePlan, usePlans, useUpdatePlan } from 'hooks/usePlans'
import { useState } from 'react'

const PlanManagement = () => {
  // Deleted rate cards are deactivated by the API so assignments can be moved safely.
  // Only active cards belong in the rate-card management list.
  const { data: plans, isLoading } = usePlans({ status: 'active' })
  const deletePlan = useDeletePlan()
  const updatePlan = useUpdatePlan()
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [editingPlan, setEditingPlan] = useState(null)
  const { isOpen, onOpen, onClose } = useDisclosure()

  const openCreate = () => { setEditingPlan(null); onOpen() }
  const openEdit = (plan) => { setEditingPlan(plan); onOpen() }

  if (selectedPlan) {
    const type = String(selectedPlan.business_type || 'b2c').toUpperCase()
    return (
      <Flex direction="column" pt={{ base: '120px', md: '75px' }} gap={4}>
        <HStack justify="space-between" align="start">
          <Box>
            <Button size="sm" variant="ghost" leftIcon={<ArrowBackIcon />} onClick={() => setSelectedPlan(null)} mb={2}>Rate Card</Button>
            <Heading size="md">Rate Card Rates</Heading>
            <Text color="gray.500" mt={1}>{selectedPlan.name} · {type} courier rates</Text>
          </Box>
        </HStack>
        <Box bg="white" border="1px solid" borderColor="gray.200" borderRadius="6px" p={4}>
          <Flex bg="brand.500" color="white" px={5} py={4} borderRadius="6px" align="center" justify="space-between" mb={4}>
            <HStack><Text fontWeight="700">{selectedPlan.name}</Text><Text fontSize="sm">({selectedPlan.id})</Text><Text fontSize="sm">{type}</Text></HStack>
          </Flex>
          <RateCardContainer forceBusinessType={type} forcePlanId={selectedPlan.id} embedded />
        </Box>
      </Flex>
    )
  }

  return (
    <Flex direction="column" pt={{ base: '120px', md: '75px' }}>
      <Flex bg="white" border="1px solid" borderColor="gray.200" borderRadius="6px" direction="column">
        <Flex px={5} py={4} justify="space-between" align="center" borderBottom="1px solid" borderColor="gray.200">
          <Heading size="md">Rate Card</Heading>
          <Button colorScheme="brand" variant="outline" leftIcon={<AddIcon />} onClick={openCreate}>Add New</Button>
        </Flex>
        <Box p={5}>
          <PlanTable data={plans || []} loading={isLoading} onEdit={openEdit} onDelete={(id) => deletePlan.mutate(id)} onActivate={(plan) => updatePlan.mutate({ id: plan.id, data: { is_active: plan.is_active } })} onSetRate={setSelectedPlan} />
        </Box>
      </Flex>
      <PlanModal isOpen={isOpen} onClose={onClose} plan={editingPlan} />
    </Flex>
  )
}

export default PlanManagement
