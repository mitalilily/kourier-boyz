import { Box, Button, FormControl, FormLabel, Select, VStack } from '@chakra-ui/react'
import CustomDatePicker from 'components/Input/CustomDatePicker'
import { useUpdateTicket } from 'hooks/useTickets'
import { useState } from 'react'

export const TicketModal = ({ selectedTicket, onClose }) => {
  const [editedStatus, setEditedStatus] = useState(selectedTicket?.status)
  const [editedDueBy, setEditedDueBy] = useState(
    selectedTicket?.dueBy ? new Date(selectedTicket.dueBy) : undefined,
  )

  const { mutate: updateTicket, isPending: isUpdating } = useUpdateTicket(onClose)

  const handleStatusChange = (e) => {
    const newStatus = e.target.value
    setEditedStatus(newStatus)

    if (selectedTicket?.status === 'closed' && newStatus === 'open') {
      setEditedDueBy(undefined)
    }
  }

  const handleUpdate = () => {
    const statusChanged = editedStatus !== selectedTicket?.status
    const dueByChanged =
      editedDueBy instanceof Date &&
      !isNaN(editedDueBy) &&
      (!selectedTicket?.dueBy ||
        new Date(selectedTicket.dueBy).toISOString() !== editedDueBy.toISOString())

    if (!statusChanged && !dueByChanged) return

    const payload = {
      ticketId: selectedTicket?.id,
      data: {},
    }

    if (statusChanged) payload.data.status = editedStatus
    if (dueByChanged) payload.data.dueBy = editedDueBy?.toISOString()

    updateTicket(payload)
  }

  const isDisabledTransition = (toStatus) => {
    const from = selectedTicket?.status

    if (from === 'open') return true
    if (from === 'in_progress') return !['resolved', 'closed'].includes(toStatus)
    if (from === 'resolved') return !['in_progress', 'closed'].includes(toStatus)
    if (from === 'closed') return !['open', 'in_progress'].includes(toStatus)
    return true
  }

  const showDueDatePicker = editedStatus === 'open'

  return (
    <Box px={6} py={4}>
      <VStack spacing={4} align="stretch">
        <FormControl>
          <FormLabel>Status</FormLabel>
          <Select value={editedStatus} onChange={handleStatusChange}>
            <option value="open" disabled={isDisabledTransition('open')}>
              Open
            </option>
            <option value="in_progress" disabled={isDisabledTransition('in_progress')}>
              In Progress
            </option>
            <option value="resolved" disabled={isDisabledTransition('resolved')}>
              Resolved
            </option>
            <option value="closed" disabled={isDisabledTransition('closed')}>
              Closed
            </option>
          </Select>
        </FormControl>

        {showDueDatePicker && (
          <FormControl>
            <FormLabel>Due By</FormLabel>
            <CustomDatePicker
              selectedDate={editedDueBy}
              onChange={setEditedDueBy}
              minDate={new Date()}
            />
          </FormControl>
        )}

        <Button
          mt={2}
          colorScheme="blue"
          onClick={handleUpdate}
          isDisabled={isUpdating}
          isLoading={isUpdating}
        >
          Save
        </Button>
      </VStack>
    </Box>
  )
}
