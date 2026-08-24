// src/pages/Blogs.jsx
import {
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  Heading,
  HStack,
  Icon,
  Image,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Text,
  useColorModeValue,
  Wrap,
  WrapItem,
} from '@chakra-ui/react'
import Card from 'components/Card/Card'
import CardBody from 'components/Card/CardBody'
import TableFilters from 'components/Tables/TableFilters'
import { useBlogs, useBlogStats } from 'hooks/useBlog'
import { usePresignedDownloadUrls } from 'hooks/usePresignedUrls'
import { useMemo, useState } from 'react'
import {
  FiEdit,
  FiEye,
  FiFileText,
  FiMoreVertical,
  FiPlus,
  FiStar,
  FiTrendingUp,
} from 'react-icons/fi'
import { useHistory } from 'react-router-dom/cjs/react-router-dom.min'
import { GenericTable } from 'views/Dashboard/Tables/components/GenericTable'

const Blogs = () => {
  const history = useHistory()
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [filters, setFilters] = useState({
    search: '',
    is_featured: '',
  })

  const textColor = useColorModeValue('gray.700', 'white')

  // Fetch blogs with filters
  const queryParams = {
    page,
    perPage,
    ...filters,
  }
  const { data, isLoading } = useBlogs(queryParams)
  const { data: stats } = useBlogStats()

  // Extract all og_image keys from blogs to get presigned URLs (fixed key)
  const featuredKeys = data?.data?.map((blog) => blog.og_image).filter(Boolean) || []
  const { data: featuredUrls } = usePresignedDownloadUrls({ keys: featuredKeys })

  // Calculate statistics
  const blogStats = useMemo(() => {
    return {
      total: stats?.data?.total || 0,
      published: stats?.data?.published || 0,
      featured: stats?.data?.featured || 0,
      views: stats?.data?.views || 0,
    }
  }, [stats])

  const columns = ['title', 'tags', 'og_image', 'is_featured', 'published_at']
  const captions = ['Title', 'Tags', 'Featured Image', 'Featured', 'Published']

  const renderers = {
    title: (value, row) => (
      <Box>
        <Text fontWeight="600" fontSize="sm" noOfLines={2}>
          {value}
        </Text>
        <Text fontSize="xs" color="gray.500" noOfLines={1}>
          {row.slug}
        </Text>
      </Box>
    ),
    og_image: (value) => {
      const url = featuredUrls?.urls?.find((u) => u.includes(value))
      if (!url)
        return (
          <Text fontSize="xs" color="gray.500">
            No Image
          </Text>
        )
      return (
        <Image
          src={url}
          alt="Blog thumbnail"
          boxSize="50px"
          objectFit="cover"
          borderRadius="md"
          fallback={<Box boxSize="50px" bg="gray.100" borderRadius="md" />}
        />
      )
    },
    tags: (value) => {
      if (!value)
        return (
          <Text fontSize="xs" color="gray.500">
            —
          </Text>
        )
      const tagsArray = typeof value === 'string' ? value.split(',').map((t) => t.trim()) : value
      return (
        <Wrap spacing={1}>
          {tagsArray.slice(0, 2).map((tag, idx) => (
            <WrapItem key={idx}>
              <Badge colorScheme="blue" fontSize="xs" px={2} py={0.5} borderRadius="md">
                {tag}
              </Badge>
            </WrapItem>
          ))}
          {tagsArray.length > 2 && (
            <WrapItem>
              <Badge colorScheme="gray" fontSize="xs" px={2} py={0.5} borderRadius="md">
                +{tagsArray.length - 2}
              </Badge>
            </WrapItem>
          )}
        </Wrap>
      )
    },
    published_at: (value) => {
      const date = new Date(value)
      return (
        <Text fontSize="sm">
          {date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </Text>
      )
    },
    is_featured: (value) => (
      <Badge colorScheme={value ? 'yellow' : 'gray'} fontSize="xs" px={2} py={1} borderRadius="md">
        {value ? (
          <HStack spacing={1}>
            <Icon as={FiStar} />
            <span>Featured</span>
          </HStack>
        ) : (
          'No'
        )}
      </Badge>
    ),
  }

  const filterOptions = [
    {
      key: 'search',
      label: 'Search',
      type: 'search',
      placeholder: 'Search by title or slug...',
    },
    {
      key: 'is_featured',
      label: 'Featured',
      type: 'select',
      placeholder: 'All Blogs',
      options: [
        { value: 'true', label: 'Featured Only' },
        { value: 'false', label: 'Not Featured' },
      ],
    },
  ]

  return (
    <Box pt={{ base: '120px', md: '75px' }}>
      {/* Page Header */}
      <Flex justify="space-between" align="center" mb={6}>
        <HStack spacing={3}>
          <Flex
            align="center"
            justify="center"
            w={12}
            h={12}
            borderRadius="xl"
            bg={useColorModeValue('blue.500', 'blue.400')}
          >
            <Icon as={FiFileText} w={6} h={6} color="white" />
          </Flex>
          <Box>
            <Heading size="lg" color={textColor}>
              Blog Management
            </Heading>
            <Text fontSize="sm" color="gray.500">
              Manage and publish your blog posts
            </Text>
          </Box>
        </HStack>
        <Button
          leftIcon={<FiPlus />}
          colorScheme="blue"
          size="md"
          onClick={() => history.push('/admin/create-blog')}
        >
          Create Blog
        </Button>
      </Flex>

      {/* Compact Statistics */}
      <Grid templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }} gap={3} mb={4}>
        <Flex
          bg={useColorModeValue('blue.50', 'blue.900')}
          p={3}
          borderRadius="lg"
          align="center"
          gap={3}
          transition="all 0.2s"
        >
          <Icon as={FiFileText} w={5} h={5} color="blue.500" flexShrink={0} />
          <Box>
            <Text fontSize="xs" color="gray.600" fontWeight="500">
              Total Blogs
            </Text>
            <Text fontSize="xl" fontWeight="bold" color={textColor}>
              {blogStats.total}
            </Text>
          </Box>
        </Flex>

        <Flex
          bg={useColorModeValue('green.50', 'green.900')}
          p={3}
          borderRadius="lg"
          align="center"
          gap={3}
          transition="all 0.2s"
        >
          <Icon as={FiTrendingUp} w={5} h={5} color="green.500" flexShrink={0} />
          <Box>
            <Text fontSize="xs" color="gray.600" fontWeight="500">
              Published
            </Text>
            <Text fontSize="xl" fontWeight="bold" color="green.500">
              {blogStats.published}
            </Text>
          </Box>
        </Flex>

        <Flex
          bg={useColorModeValue('yellow.50', 'yellow.900')}
          p={3}
          borderRadius="lg"
          align="center"
          gap={3}
          transition="all 0.2s"
        >
          <Icon as={FiStar} w={5} h={5} color="yellow.500" flexShrink={0} />
          <Box>
            <Text fontSize="xs" color="gray.600" fontWeight="500">
              Featured
            </Text>
            <Text fontSize="xl" fontWeight="bold" color="yellow.600">
              {blogStats.featured}
            </Text>
          </Box>
        </Flex>
      </Grid>

      {/* Filters Card */}
      <Card mb={4} boxShadow="sm">
        <CardBody p={4}>
          <TableFilters
            filters={filterOptions}
            values={filters}
            onApply={(appliedFilters) => {
              setFilters(appliedFilters)
              setPage(1)
            }}
            actions={[]}
            showActiveFiltersCount={true}
            cardStyle={false}
          />
        </CardBody>
      </Card>

      {/* Blogs Table */}
      <GenericTable
        title="All Blogs"
        data={data?.data || []}
        loading={isLoading}
        columnKeys={columns}
        captions={captions}
        renderers={renderers}
        page={page}
        setPage={setPage}
        perPage={perPage}
        setPerPage={setPerPage}
        totalCount={data?.total || 0}
        paginated={true}
        renderActions={(row) => (
          <Menu>
            <MenuButton as={Button} size="sm" variant="ghost" rightIcon={<FiMoreVertical />}>
              Actions
            </MenuButton>
            <MenuList>
              <MenuItem
                icon={<FiEdit />}
                onClick={() => history.push(`/admin/blogs/create/${row.id}`)}
              >
                Edit Blog
              </MenuItem>
              <MenuItem icon={<FiEye />}>Preview</MenuItem>
            </MenuList>
          </Menu>
        )}
      />
    </Box>
  )
}

export default Blogs
