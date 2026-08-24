import {
  Box,
  Center,
  Checkbox,
  Flex,
  Spinner,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
} from '@chakra-ui/react'
import Card from 'components/Card/Card'
import CardBody from 'components/Card/CardBody'
import CardHeader from 'components/Card/CardHeader'
import Pagination from 'components/Tables/Pagination'
import TablesTableRow from 'components/Tables/TablesTableRow'
import { useEffect, useRef, useState } from 'react'

export const GenericTable = ({
  title,
  data = [],
  captions = [],
  titleActions = null,
  columnKeys = [],
  renderers = {},
  renderActions,
  loading = false,
  page,
  setPage,
  totalCount,
  perPage,
  setPerPage,
  paginated = true,
  sortByComponent = null,
  columnWidths = {},
  showCheckboxes = false,
  onSelectionChange,
  selectedRows = [],
  perPageOptions,
  actionsColumnWidth = '180px',
}) => {
  const textColor = useColorModeValue('gray.800', 'gray.100')
  const headerBg = useColorModeValue('#F8F7FC', '#121B31')
  const headerColor = useColorModeValue('gray.600', 'gray.300')
  const borderColor = useColorModeValue('rgba(148, 163, 184, 0.24)', 'rgba(148, 163, 184, 0.18)')
  const shellBg = useColorModeValue('rgba(255,255,255,0.9)', 'rgba(14, 23, 43, 0.88)')
  const scrollRef = useRef(null)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const handleScroll = () => {
      setIsScrolled(el.scrollLeft > 0)
    }

    el.addEventListener('scroll', handleScroll)
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  const toggleSelectAll = () => {
    let newSelection = []
    if (selectedRows.length === data.length) newSelection = []
    else newSelection = data?.map((row) => row.id)
    onSelectionChange?.(newSelection)
  }

  const toggleRow = (id) => {
    const currentSelection = Array.isArray(selectedRows) ? selectedRows : []
    const newSelection = currentSelection.includes(id)
      ? currentSelection.filter((r) => r !== id)
      : [...currentSelection, id]

    onSelectionChange?.(newSelection)
  }

  return (
    <Card overflow="visible" bg={shellBg} borderRadius="24px">
      <CardHeader p="0 0 18px">
        <Flex width="100%" alignItems="center" justifyContent="space-between" direction={{ base: 'column', md: 'row' }} gap={2}>
          <Stack direction="row" gap={4} align="center">
            <Text fontSize={{ base: 'lg', md: 'xl' }} color={textColor} fontWeight="800" letterSpacing="-0.01em">
              {title}
            </Text>
            {sortByComponent}
          </Stack>
          {titleActions}
          {paginated && (
            <Box mt={{ base: 3, md: 0 }}>
              <Pagination
                page={page}
                setPage={setPage}
                totalCount={totalCount ?? 0}
                perPage={perPage}
                perPageOptions={perPageOptions}
                setPerPage={setPerPage}
              />
            </Box>
          )}
        </Flex>
      </CardHeader>

      <CardBody p={0}>
        <Box
          ref={scrollRef}
          borderWidth="1px"
          borderColor={borderColor}
          borderRadius="20px"
          overflow="hidden"
          style={{ width: '100%', overflowX: 'auto', overflowY: 'visible' }}
        >
          <Table variant="simple" color={textColor}>
            <Thead>
              <Tr>
                {showCheckboxes && (
                  <Th ps={8} bg={headerBg} position="sticky" top={0} zIndex={3} color={headerColor}>
                    <Checkbox
                      isChecked={selectedRows.length === data.length && data.length > 0}
                      isIndeterminate={selectedRows.length > 0 && selectedRows.length < data.length}
                      onChange={toggleSelectAll}
                    />
                  </Th>
                )}
                {columnKeys.map((key, idx) => (
                  <Th
                    key={key}
                    ps={8}
                    color={headerColor}
                    minW={columnWidths[key] || 'auto'}
                    maxW={columnWidths[key] || 'auto'}
                    position="sticky"
                    top={0}
                    zIndex={2}
                    bg={headerBg}
                    fontWeight="700"
                    fontSize="11px"
                    letterSpacing="0.08em"
                    textTransform="uppercase"
                  >
                    {captions[idx]}
                  </Th>
                ))}
                {renderActions && (
                  <Th
                    bg={headerBg}
                    color={headerColor}
                    px={8}
                    minW={actionsColumnWidth}
                    w={actionsColumnWidth}
                    position="sticky"
                    right={0}
                    top={0}
                    zIndex={4}
                    whiteSpace="nowrap"
                    fontSize="11px"
                    letterSpacing="0.08em"
                    textTransform="uppercase"
                  >
                    Actions
                  </Th>
                )}
              </Tr>
            </Thead>

            <Tbody>
              {loading ? (
                <Tr>
                  <Td colSpan={columnKeys.length + (renderActions ? 1 : 0)}>
                    <Center py={8}>
                      <Spinner size="md" color="brand.500" />
                    </Center>
                  </Td>
                </Tr>
              ) : data.length === 0 ? (
                <Tr>
                  <Td colSpan={columnKeys.length + (renderActions ? 1 : 0)}>
                    <Center py={8}>
                      <Text color={headerColor} fontWeight="600">No records available</Text>
                    </Center>
                  </Td>
                </Tr>
              ) : (
                data.map((row, idx) => (
                  <TablesTableRow
                    key={idx}
                    row={row}
                    checkboxComponent={
                      showCheckboxes ? (
                        <Td ps={8}>
                          <Checkbox isChecked={selectedRows.includes(row.id)} onChange={() => toggleRow(row.id)} />
                        </Td>
                      ) : null
                    }
                    columnKeys={columnKeys}
                    renderers={renderers}
                    renderActions={renderActions}
                    columnWidths={columnWidths}
                    isScrolled={isScrolled}
                    actionsColumnWidth={actionsColumnWidth}
                  />
                ))
              )}
            </Tbody>
          </Table>
        </Box>
      </CardBody>
    </Card>
  )
}
