// TablesTableRow.jsx
import { Td, Tr, useColorModeValue } from '@chakra-ui/react'

const TablesTableRow = ({
  row,
  columnKeys,
  renderers = {},
  renderActions,
  columnWidths = {},
  isScrolled, // pass from parent
  checkboxComponent,
  actionsStickyLeft = false,
  hasCheckbox = false,
  actionsColumnWidth = '180px',
}) => {
  const bg = useColorModeValue('white', 'gray.800')
  const rowHover = useColorModeValue('#FAF7FF', '#18233D')

  return (
    <Tr _hover={{ bg: rowHover }}>
      {checkboxComponent}
      {columnKeys.map((key, idx) => {
        const value = row[key]
        const content = renderers[key] ? renderers[key](value, row) : value

        return (
          <Td key={idx} ps={8} minW={columnWidths[key] || 'auto'} overflow="visible" py={4.5}>
            {content ?? '—'}
          </Td>
        )
      })}

      {renderActions && (
        <Td
          px={8}
          minW={actionsColumnWidth}
          w={actionsColumnWidth}
          bg={bg}
          position="sticky"
          {...(actionsStickyLeft ? { left: hasCheckbox ? 56 : 0 } : { right: 0 })}
          zIndex={3}
          overflow="visible"
          whiteSpace="nowrap"
        >
          {renderActions(row)}
        </Td>
      )}
    </Tr>
  )
}

export default TablesTableRow
