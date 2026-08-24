// src/pages/CreateBlog.js
import {
  Box,
  Button,
  Divider,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  HStack,
  Icon,
  IconButton,
  Image,
  Input,
  Spinner,
  Switch,
  Text,
  Textarea,
  useColorModeValue,
  useToast,
  VStack,
} from '@chakra-ui/react'
import Card from 'components/Card/Card'
import CardBody from 'components/Card/CardBody'
import FileUploader from 'components/upload/FileUploader'
import { useCreateBlog, useSingleBlog, useUpdateBlog } from 'hooks/useBlog'
import { usePresignedDownloadUrls } from 'hooks/usePresignedUrls'
import { useEffect, useState } from 'react'
import { FiArrowLeft, FiCheck, FiImage, FiX } from 'react-icons/fi'
import { useParams } from 'react-router-dom'
import { useHistory } from 'react-router-dom/cjs/react-router-dom.min'

const CreateBlog = () => {
  const { id } = useParams()
  const toast = useToast()
  const history = useHistory()
  const textColor = useColorModeValue('gray.700', 'white')
  const bgColor = useColorModeValue('gray.50', 'gray.800')
  const stickyHeaderBg = useColorModeValue('white', 'gray.800')
  const stickyHeaderBorder = useColorModeValue('gray.200', 'gray.700')
  const editorBorder = useColorModeValue('gray.200', 'gray.600')
  const imageBorder = useColorModeValue('gray.200', 'gray.600')
  const uploadBorder = useColorModeValue('gray.300', 'gray.600')
  const uploadBg = useColorModeValue('gray.50', 'gray.700')
  const uploadHoverBorder = useColorModeValue('blue.400', 'blue.300')
  const uploadHoverBg = useColorModeValue('blue.50', 'gray.600')
  const uploadIconBg = useColorModeValue('blue.100', 'blue.900')

  const [form, setForm] = useState({
    title: '',
    slug: '',
    excerpt: '',
    tags: '',
    featured_image: '',
    featured_image_alt: '',
    is_featured: false,
    published_at: '',
    content: '',
    og_image: '',
    meta_description: '',
  })

  const [errors, setErrors] = useState({})
  const createBlogMutation = useCreateBlog()
  const updateBlogMutation = useUpdateBlog()

  // Fetch single blog if editing
  const { data: blogData, isLoading } = useSingleBlog(id)
  const blog = blogData?.data

  // Get presigned URL for featured image preview
  const imageKey = form.og_image ? [form.og_image] : []
  const { data: imageUrls } = usePresignedDownloadUrls({ keys: imageKey })
  const imagePreviewUrl = imageUrls?.urls?.[0]

  // Populate form when blog data is fetched
  useEffect(() => {
    if (blog) {
      setForm({
        title: blog.title || '',
        slug: blog.slug || '',
        excerpt: blog.excerpt || '',
        tags: blog.tags || '',
        featured_image: blog.featured_image || '',
        featured_image_alt: blog.featured_image_alt || '',
        is_featured: blog.is_featured || false,
        published_at: blog.published_at || '',
        content: blog.content || '',
        og_image: blog.og_image || '',
        meta_description: blog.meta_description || blog.excerpt || '',
      })
    }
  }, [blog])

  const handleChange = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const handleImageUploaded = (files) => {
    if (files.length) {
      const f = files[0]
      setForm((prev) => ({
        ...prev,
        featured_image: f.originalName,
        featured_image_alt: f.originalName,
        og_image: f?.key,
      }))
    }
  }

  const handleContentChange = (event) =>
    setForm((current) => ({ ...current, content: event.target.value }))

  // Auto-generate slug and tags only for new blogs
  useEffect(() => {
    if (!blog && form.title) {
      const slug = form.title
        .trim()
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')

      const stopWords = ['the', 'and', 'for', 'with', 'a', 'an', 'of', 'in', 'on', 'at', 'to']
      const tagsArray = form.title
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.length > 2 && !stopWords.includes(word))
      const tags = [...new Set(tagsArray)].slice(0, 10).join(', ')

      setForm((f) => ({ ...f, slug, tags }))
    }
  }, [form.title, blog])

  const validateForm = () => {
    const newErrors = {}
    if (!form.title.trim()) newErrors.title = 'Title is required'
    if (!form.slug.trim()) newErrors.slug = 'Slug is required'
    if (!form.excerpt.trim()) newErrors.excerpt = 'Excerpt is required'
    if (!form.content.trim()) newErrors.content = 'Content is required'
    if (form.excerpt.length > 200) newErrors.excerpt = 'Excerpt must be under 200 characters'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    const payload = {
      ...form,
      published_at: form.published_at || new Date().toISOString(),
    }

    console.log('Blog payload:', payload)

    try {
      if (id) {
        await updateBlogMutation.mutateAsync({ id, data: payload })
        toast({
          title: 'Blog updated successfully!',
          status: 'success',
          duration: 3000,
          isClosable: true,
        })
      } else {
        const result = await createBlogMutation.mutateAsync(payload)
        console.log('Blog created:', result)
        toast({
          title: 'Blog published successfully!',
          status: 'success',
          duration: 3000,
          isClosable: true,
        })
      }

      history.push('/admin/blogs')
    } catch (err) {
      toast({
        title: `Error ${id ? 'updating' : 'creating'} blog!`,
        description: err.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    }
  }

  if (isLoading) {
    return (
      <Flex pt={{ base: '120px', md: '75px' }} justify="center" align="center" minH="60vh">
        <VStack spacing={4}>
          <Spinner size="xl" thickness="4px" color="blue.500" />
          <Text color="gray.500">Loading blog...</Text>
        </VStack>
      </Flex>
    )
  }

  return (
    <Box pt={{ base: '120px', md: '75px' }} bg={bgColor} minH="100vh" pb={10}>
      {/* Sticky Header */}
      <Box
        bg={stickyHeaderBg}
        borderBottom="1px"
        borderColor={stickyHeaderBorder}
        position="sticky"
        top="0"
        zIndex="10"
        py={4}
        mb={6}
      >
        <Flex
          justify="space-between"
          align="center"
          maxW="1400px"
          mx="auto"
          px={{ base: 4, md: 6 }}
        >
          <HStack spacing={3}>
            <IconButton
              icon={<FiArrowLeft />}
              onClick={() => history.push('/admin/blogs')}
              variant="ghost"
              aria-label="Back to blogs"
              size="md"
            />
            <Box>
              <Heading size="md" color={textColor}>
                {id ? 'Edit Blog Post' : 'Create New Blog'}
              </Heading>
              <Text fontSize="sm" color="gray.500">
                {id ? 'Update your blog post' : 'Write and publish a new article'}
              </Text>
            </Box>
          </HStack>

          <HStack spacing={3} display={{ base: 'none', md: 'flex' }}>
            <Button variant="ghost" leftIcon={<FiX />} onClick={() => history.push('/admin/blogs')}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              leftIcon={<FiCheck />}
              type="submit"
              onClick={handleSubmit}
              isLoading={createBlogMutation.isLoading || updateBlogMutation.isLoading}
            >
              {id ? 'Update Blog' : 'Publish Blog'}
            </Button>
          </HStack>
        </Flex>
      </Box>

      {/* Main Content */}
      <Box maxW="1100px" mx="auto" px={{ base: 4, md: 6 }}>
        <form onSubmit={handleSubmit}>
          <VStack spacing={6} align="stretch">
            {/* Title Input - Full Width, Prominent */}
            <FormControl isRequired isInvalid={errors.title}>
              <Input
                value={form.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="Enter your blog title..."
                size="lg"
                fontSize="2xl"
                fontWeight="bold"
                border="none"
                _focus={{ border: 'none', boxShadow: 'none' }}
                _placeholder={{ color: 'gray.400' }}
                bg="transparent"
              />
              {errors.title && <FormErrorMessage ml={0}>{errors.title}</FormErrorMessage>}
            </FormControl>

            {/* Two Column Layout */}
            <Flex direction={{ base: 'column', md: 'row' }} gap={6}>
              {/* Main Content Area */}
              <VStack flex="1" spacing={6} align="stretch">
                {/* Excerpt */}
                <Card boxShadow="sm">
                  <CardBody p={5}>
                    <FormControl isRequired isInvalid={errors.excerpt}>
                      <FormLabel fontSize="sm" fontWeight="600">
                        Excerpt
                      </FormLabel>
                      <Textarea
                        value={form.excerpt}
                        onChange={(e) => handleChange('excerpt', e.target.value)}
                        placeholder="A brief summary that will appear in blog previews and search results..."
                        rows={3}
                        resize="vertical"
                      />
                      {errors.excerpt && <FormErrorMessage>{errors.excerpt}</FormErrorMessage>}
                      <Text fontSize="xs" color="gray.500" mt={1}>
                        {form.excerpt.length}/200 characters
                      </Text>
                    </FormControl>
                  </CardBody>
                </Card>

                {/* Content Editor */}
                <Card boxShadow="sm">
                  <CardBody p={5}>
                    <FormControl isRequired isInvalid={errors.content}>
                      <FormLabel fontSize="sm" fontWeight="600" mb={3}>
                        Content
                      </FormLabel>
                      <Box
                        border="1px solid"
                        borderColor={editorBorder}
                        borderRadius="md"
                        overflow="hidden"
                        bg="white"
                      >
                        <Textarea
                          value={form.content}
                          onChange={handleContentChange}
                          minH="400px"
                          p={4}
                          fontFamily="monospace"
                          resize="vertical"
                          border="none"
                          placeholder="Enter the blog HTML here..."
                        />
                      </Box>
                      {errors.content && <FormErrorMessage>{errors.content}</FormErrorMessage>}
                    </FormControl>
                  </CardBody>
                </Card>
              </VStack>

              {/* Sidebar */}
              <VStack w={{ base: 'full', md: '320px' }} spacing={6} align="stretch">
                {/* Settings Card */}
                <Card boxShadow="sm">
                  <CardBody p={5}>
                    <VStack spacing={4} align="stretch">
                      <Box>
                        <Text fontSize="sm" fontWeight="600" mb={2}>
                          URL Slug
                        </Text>
                        <Input
                          value={form.slug}
                          onChange={(e) => handleChange('slug', e.target.value)}
                          placeholder="url-slug"
                          size="sm"
                          fontFamily="monospace"
                          fontSize="xs"
                        />
                        <Text fontSize="xs" color="gray.500" mt={1}>
                          Auto-generated from title
                        </Text>
                      </Box>

                      <Divider />

                      <Box>
                        <Text fontSize="sm" fontWeight="600" mb={2}>
                          Tags
                        </Text>
                        <Input
                          value={form.tags}
                          onChange={(e) => handleChange('tags', e.target.value)}
                          placeholder="tech, tutorial, news"
                          size="sm"
                        />
                        <Text fontSize="xs" color="gray.500" mt={1}>
                          Comma-separated
                        </Text>
                      </Box>

                      <Divider />

                      <Flex justify="space-between" align="center">
                        <VStack align="start" spacing={0}>
                          <Text fontSize="sm" fontWeight="600">
                            Featured
                          </Text>
                          <Text fontSize="xs" color="gray.500">
                            Show on homepage
                          </Text>
                        </VStack>
                        <Switch
                          colorScheme="yellow"
                          isChecked={form.is_featured}
                          onChange={(e) => handleChange('is_featured', e.target.checked)}
                        />
                      </Flex>
                    </VStack>
                  </CardBody>
                </Card>

                {/* Featured Image */}
                <Card boxShadow="sm">
                  <CardBody p={5}>
                    <HStack justify="space-between" mb={3}>
                      {imagePreviewUrl && (
                        <Button
                          size="xs"
                          variant="ghost"
                          colorScheme="red"
                          leftIcon={<FiX />}
                          onClick={() => handleChange('og_image', '')}
                        >
                          Remove
                        </Button>
                      )}
                    </HStack>

                    {imagePreviewUrl ? (
                      <Box
                        borderRadius="lg"
                        overflow="hidden"
                        border="2px solid"
                        borderColor={imageBorder}
                      >
                        <Image
                          src={imagePreviewUrl}
                          alt="Featured"
                          w="full"
                          h="200px"
                          objectFit="cover"
                        />
                      </Box>
                    ) : (
                      <Box
                        border="2px dashed"
                        borderColor={uploadBorder}
                        borderRadius="lg"
                        p={6}
                        textAlign="center"
                        bg={uploadBg}
                        transition="all 0.2s"
                        _hover={{
                          borderColor: uploadHoverBorder,
                          bg: uploadHoverBg,
                        }}
                      >
                        <VStack spacing={2}>
                          <Box
                            w={12}
                            h={12}
                            borderRadius="full"
                            bg={uploadIconBg}
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            mb={2}
                          >
                            <Icon as={FiImage} w={6} h={6} color="blue.500" />
                          </Box>
                          <Text fontSize="sm" fontWeight="500" color={textColor}>
                            Upload Featured Image
                          </Text>
                          <Text fontSize="xs" color="gray.500">
                            PNG, JPG, WEBP up to 5MB
                          </Text>
                          <Box pt={2}>
                            <FileUploader
                              folderKey="blogs"
                              getUrl
                              showUploadButton={false}
                              onUploaded={handleImageUploaded}
                              multiple={false}
                            />
                          </Box>
                        </VStack>
                      </Box>
                    )}
                  </CardBody>
                </Card>

                {/* Mobile Action Buttons */}
                <VStack spacing={3} display={{ base: 'flex', md: 'none' }}>
                  <Button
                    colorScheme="blue"
                    size="lg"
                    leftIcon={<FiCheck />}
                    type="submit"
                    isLoading={createBlogMutation.isLoading || updateBlogMutation.isLoading}
                    w="full"
                  >
                    {id ? 'Update Blog' : 'Publish Blog'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="lg"
                    leftIcon={<FiX />}
                    onClick={() => history.push('/admin/blogs')}
                    w="full"
                  >
                    Cancel
                  </Button>
                </VStack>
              </VStack>
            </Flex>
          </VStack>
        </form>
      </Box>
    </Box>
  )
}

export default CreateBlog
