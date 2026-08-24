import {
  Box,
  Button,
  Divider,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Text,
  VStack,
} from '@chakra-ui/react'

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

const RawBlock = ({ value }) => {
  if (value === null || value === undefined || value === '') return null

  return (
    <Box
      as="pre"
      m={0}
      p={3}
      borderRadius="10px"
      bg="gray.50"
      border="1px solid"
      borderColor="gray.200"
      color="gray.700"
      fontSize="12px"
      whiteSpace="pre-wrap"
      wordBreak="break-word"
      overflowX="auto"
    >
      {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
    </Box>
  )
}

export default function ManualRequestDetailsModal({ isOpen, onClose, title, subtitle, sections }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <Text fontWeight="800">{title}</Text>
          {subtitle ? (
            <Text mt={1} fontSize="sm" color="gray.500" fontWeight="500">
              {subtitle}
            </Text>
          ) : null}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={5} align="stretch">
            {(sections || []).map((section) => (
              <Box key={section.title}>
                <Text fontWeight="800" mb={3}>
                  {section.title}
                </Text>
                {section.fields?.length ? (
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                    {section.fields.map((field) => (
                      <Box
                        key={`${section.title}-${field.label}`}
                        border="1px solid"
                        borderColor="gray.200"
                        borderRadius="10px"
                        p={3}
                      >
                        <Text fontSize="xs" color="gray.500" fontWeight="700">
                          {field.label}
                        </Text>
                        <Text fontSize="sm" color="gray.800" wordBreak="break-word">
                          {formatValue(field.value)}
                        </Text>
                      </Box>
                    ))}
                  </SimpleGrid>
                ) : null}
                {section.raw !== undefined ? (
                  <Box mt={section.fields?.length ? 3 : 0}>
                    <RawBlock value={section.raw} />
                  </Box>
                ) : null}
                <Divider mt={5} />
              </Box>
            ))}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button colorScheme="blue" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
