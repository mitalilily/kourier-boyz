/* eslint-disable */
import { Flex, Text, useColorModeValue } from '@chakra-ui/react'

export default function Footer() {
  const textColor = useColorModeValue('gray.500', 'gray.400')

  return (
    <Flex
      flexDirection={{ base: 'column', xl: 'row' }}
      alignItems={{ base: 'center', xl: 'start' }}
      justifyContent="space-between"
      px="30px"
      py="20px"
      w="100%"
    >
      <Text
        color={textColor}
        textAlign={{ base: 'center', xl: 'start' }}
        mb={{ base: '20px', xl: '0px' }}
        fontSize="sm"
      >
        &copy; {new Date().getFullYear()} Kourier Boyz. All rights reserved.
      </Text>
      <Text color={textColor} fontWeight="semibold" fontSize="sm">
        Logistics Control Center
      </Text>
    </Flex>
  )
}
