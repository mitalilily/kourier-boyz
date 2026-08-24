import { Box, Button, Portal, useColorModeValue, useOutsideClick } from '@chakra-ui/react'
import { forwardRef, useEffect, useRef, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'

const CustomDatePicker = forwardRef(({ selectedDate, onChange, minDate, maxDate }, ref) => {
  const [showCalendar, setShowCalendar] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 })

  const buttonRef = useRef(null)
  const calendarRef = useRef(null)

  useOutsideClick({
    ref: calendarRef,
    handler: () => setShowCalendar(false),
  })

  useEffect(() => {
    if (showCalendar && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      })
    }
  }, [showCalendar])

  const bgColor = useColorModeValue('white', 'gray.700')
  const borderColor = useColorModeValue('gray.200', 'gray.600')

  return (
    <Box ref={ref}>
      <Button
        ref={buttonRef}
        onClick={() => setShowCalendar(!showCalendar)}
        variant="outline"
        w="full"
        justifyContent="flex-start"
        borderColor={borderColor}
        bg={bgColor}
      >
        {selectedDate ? selectedDate.toLocaleDateString() : 'Select date'}
      </Button>

      {showCalendar && (
        <Portal>
          <Box
            ref={calendarRef}
            position="absolute"
            zIndex="popover"
            bg={bgColor}
            border="1px solid"
            borderColor={borderColor}
            boxShadow="lg"
            rounded="md"
            p={2}
            style={{
              top: `${position.top}px`,
              left: `${position.left}px`,
              width: `370px`,
            }}
          >
            <DayPicker
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                onChange(date)
                setShowCalendar(false)
              }}
              disabled={{
                ...(minDate && { before: new Date(minDate) }),
                ...(maxDate && { after: new Date(maxDate) }),
              }}
            />
          </Box>
        </Portal>
      )}
    </Box>
  )
})

CustomDatePicker.displayName = 'CustomDatePicker'
export default CustomDatePicker
