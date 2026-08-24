import { ChevronDownIcon } from '@chakra-ui/icons'
import {
  Box,
  Button,
  Checkbox,
  CheckboxGroup,
  Input,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Text,
} from '@chakra-ui/react'
import { useMemo, useState } from 'react'

export const MultiSelect = ({ label, options, value = [], onChange }) => {
  const [search, setSearch] = useState('')

  const handleCheckboxChange = (optionValue) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue))
    } else {
      onChange([...value, optionValue])
    }
  }

  // Filter options based on search input
  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options
    return options.filter((opt) => opt.label.toLowerCase().includes(search.trim().toLowerCase()))
  }, [search, options])

  return (
    <Box>
      <Text mb="1" fontWeight="medium">
        {label}
      </Text>
      <Menu closeOnSelect={false}>
        <MenuButton as={Button} rightIcon={<ChevronDownIcon />} variant="outline" width="100%">
          {value.length ? `${value.length} selected` : 'Select options'}
        </MenuButton>
        <MenuList zIndex={999} maxH="250px" overflowY="auto" minW="250px">
          {/* Search input */}
          <Box px={3} py={2} position="sticky" top="0" bg="white" zIndex={1}>
            <Input
              size="sm"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Box>

          {/* Options */}
          <CheckboxGroup value={value}>
            {filteredOptions.map((opt, idx) => (
              <MenuItem
                key={`${opt.value}-${idx}`}
                onClick={() => handleCheckboxChange(opt.value)}
                cursor="pointer"
              >
                <Checkbox
                  isChecked={value.includes(opt.value)}
                  pointerEvents="none"
                  colorScheme="green"
                  me={2}
                />
                {opt.label}
              </MenuItem>
            ))}
            {filteredOptions.length === 0 && (
              <Box px={4} py={2} color="gray.500" fontSize="sm">
                No results found
              </Box>
            )}
          </CheckboxGroup>
        </MenuList>
      </Menu>
    </Box>
  )
}
