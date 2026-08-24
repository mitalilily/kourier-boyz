import { Button, Checkbox, FormControl, FormLabel, HStack, Input, Select, Stack } from '@chakra-ui/react'
import { useCreatePlan, useUpdatePlan } from 'hooks/usePlans'
import { useEffect, useState } from 'react'

const PlanForm = ({ plan, onClose }) => {
  const createPlan = useCreatePlan()
  const updatePlan = useUpdatePlan()
  const [form, setForm] = useState({ name: '', description: '', business_type: 'b2c', is_active: true })

  useEffect(() => {
    setForm(plan ? {
      name: plan.name || '',
      description: plan.description || '',
      business_type: plan.business_type || 'b2c',
      is_active: Boolean(plan.is_active),
    } : { name: '', description: '', business_type: 'b2c', is_active: true })
  }, [plan])

  const handleSubmit = () => {
    const action = plan
      ? updatePlan.mutate.bind(updatePlan, { id: plan.id, data: form })
      : createPlan.mutate.bind(createPlan, form)
    action({ onSuccess: onClose })
  }

  return (
    <Stack spacing={5}>
      <FormControl isRequired>
        <FormLabel>Name</FormLabel>
        <Input placeholder="Enter Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </FormControl>
      <FormControl isRequired>
        <FormLabel>Type</FormLabel>
        <Select value={form.business_type} onChange={(e) => setForm({ ...form, business_type: e.target.value })} isDisabled={Boolean(plan)}>
          <option value="b2c">B2C</option>
          <option value="b2b">B2B</option>
          <option value="international">International</option>
        </Select>
      </FormControl>
      <Checkbox isChecked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })}>Status</Checkbox>
      <HStack justify="flex-end" pt={3}>
        <Button variant="ghost" onClick={onClose}>Close</Button>
        <Button colorScheme="brand" onClick={handleSubmit} isDisabled={!form.name.trim()} isLoading={createPlan.isPending || updatePlan.isPending}>Save</Button>
      </HStack>
    </Stack>
  )
}

export default PlanForm
