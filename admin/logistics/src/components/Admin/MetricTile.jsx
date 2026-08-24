import { Box, Flex, Text, useColorModeValue } from '@chakra-ui/react'

export default function MetricTile({
  icon,
  label,
  value,
  accent = 'brand.500',
  muted,
  onClick,
  active = false,
}) {
  const bg = useColorModeValue('white', 'rgba(14, 23, 43, 0.9)')
  const activeBorderColor = useColorModeValue(
    'rgba(49, 2, 118, 0.34)',
    'rgba(249, 115, 22, 0.36)',
  )
  const inactiveBorderColor = useColorModeValue(
    'rgba(148, 163, 184, 0.24)',
    'rgba(148, 163, 184, 0.16)',
  )
  const borderColor = active ? activeBorderColor : inactiveBorderColor
  const titleColor = useColorModeValue('gray.500', 'gray.400')
  const valueColor = useColorModeValue('gray.800', 'white')
  const shadow = useColorModeValue(
    '0 14px 34px rgba(15, 23, 42, 0.05)',
    '0 16px 40px rgba(2, 8, 23, 0.32)',
  )
  const hoverBorderColor = useColorModeValue(
    'rgba(49, 2, 118, 0.26)',
    'rgba(249, 115, 22, 0.28)',
  )
  const hoverShadow = useColorModeValue(
    '0 18px 40px rgba(67, 56, 202, 0.1)',
    '0 20px 48px rgba(2, 8, 23, 0.42)',
  )
  const iconBg = useColorModeValue('rgba(49, 2, 118, 0.08)', 'rgba(255,255,255,0.06)')

  return (
    <Flex
      direction="column"
      justify="space-between"
      minH="136px"
      p={4.5}
      borderRadius="22px"
      borderWidth="1px"
      borderColor={borderColor}
      bg={bg}
      boxShadow={shadow}
      cursor={onClick ? 'pointer' : 'default'}
      transition="transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease"
      _hover={
        onClick
          ? {
              transform: 'translateY(-2px)',
              borderColor: hoverBorderColor,
              boxShadow: hoverShadow,
            }
          : undefined
      }
      onClick={onClick}
    >
      <Flex align="center" justify="space-between" mb={5}>
        <Text fontSize="xs" fontWeight="700" textTransform="uppercase" letterSpacing="0.1em" color={titleColor}>
          {label}
        </Text>
        <Flex
          align="center"
          justify="center"
          w="42px"
          h="42px"
          borderRadius="16px"
          bg={iconBg}
          color={accent}
        >
          {icon}
        </Flex>
      </Flex>
      <Box>
        <Text fontSize={{ base: '2xl', md: '3xl' }} fontWeight="800" letterSpacing="-0.03em" color={valueColor}>
          {value}
        </Text>
        {muted ? (
          <Text mt={1.5} fontSize="sm" color={titleColor}>
            {muted}
          </Text>
        ) : null}
      </Box>
    </Flex>
  )
}
