import { demoCategories, demoProducts } from '@/components/Home/demoStoreData'

type DemoProduct = (typeof demoProducts)[number]

type DemoQuery = {
  q?: string
  categoryId?: string
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest'
  brand?: string[] | string
  tag?: string[] | string
  minPrice?: number
  maxPrice?: number
  minRating?: number
  includeOutOfStock?: boolean
}

const asArray = (value?: string[] | string) =>
  Array.isArray(value) ? value : value ? [value] : []

const textForProduct = (product: DemoProduct) =>
  [
    product.name,
    product.description,
    product.shortDescription,
    product.brand,
    product.category?.name,
    ...(product.tags || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

const categoryAliases: Record<string, string[]> = {
  'demo-sub-fashion-clothing': ['fashion', 'shirt', 'cotton', 'wear'],
  'demo-sub-fashion-footwear': ['fashion', 'footwear', 'sneakers'],
  'demo-sub-electronics-wearables': ['electronics', 'watch', 'fitness'],
  'demo-sub-electronics-audio': ['electronics', 'audio', 'earbuds'],
  'demo-sub-home-furniture': ['home', 'furniture', 'chair'],
  'demo-sub-home-storage': ['home', 'storage', 'organizer'],
  'demo-sub-bags-everyday': ['bag', 'tote', 'fashion'],
  'demo-sub-bags-travel': ['bag', 'travel'],
  'demo-sub-beauty-care': ['beauty', 'care', 'skincare'],
  'demo-sub-gifts-essentials': ['gift', 'accessory', 'watch'],
}

export const getDemoProduct = (identifier: string) =>
  demoProducts.find(
    (product) => product._id === identifier || product.slug === identifier,
  )

export const queryDemoProducts = (query: DemoQuery = {}) => {
  const q = query.q?.trim().toLowerCase()
  const brands = asArray(query.brand).map((value) => value.toLowerCase())
  const tags = asArray(query.tag).map((value) => value.toLowerCase())
  const aliases = query.categoryId ? categoryAliases[query.categoryId] || [] : []

  let products = demoProducts.filter((product) => {
    const searchable = textForProduct(product)
    if (q && !searchable.includes(q)) return false
    if (query.categoryId) {
      const categoryMatch = [product.category?._id, product.category?.slug]
        .filter(Boolean)
        .includes(query.categoryId)
      const aliasMatch = aliases.length > 0 && aliases.some((alias) => searchable.includes(alias))
      if (!categoryMatch && !aliasMatch) return false
    }
    if (brands.length > 0 && !brands.includes((product.brand || '').toLowerCase())) return false
    if (tags.length > 0 && !tags.some((tag) => searchable.includes(tag))) return false
    const price = product.effectivePrice ?? product.price ?? 0
    if (query.minPrice !== undefined && price < query.minPrice) return false
    if (query.maxPrice !== undefined && price > query.maxPrice) return false
    if (query.minRating !== undefined && (product.rating || 0) < query.minRating) return false
    if (!query.includeOutOfStock && (product.stock ?? product.totalStock ?? 0) <= 0) return false
    return true
  })

  if (query.sort === 'price_asc') {
    products = products.sort((a, b) => (a.effectivePrice ?? a.price ?? 0) - (b.effectivePrice ?? b.price ?? 0))
  } else if (query.sort === 'price_desc') {
    products = products.sort((a, b) => (b.effectivePrice ?? b.price ?? 0) - (a.effectivePrice ?? a.price ?? 0))
  } else if (query.sort === 'newest') {
    products = products.slice().reverse()
  } else {
    products = products.sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0))
  }

  return products
}

export const getDemoPagination = (total: number, page = 1, limit = total || 24) => ({
  total,
  page,
  limit,
  pages: total > 0 ? Math.ceil(total / limit) : 1,
  hasMore: page * limit < total,
})

export const getDemoFilters = (products = demoProducts) => {
  const prices = products.map((product) => product.effectivePrice ?? product.price ?? 0)
  const discounts = products.map((product) => product.discountPercent || 0)
  const ratings = products.map((product) => product.rating || 0)
  const range = (values: number[]) => ({
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
  })
  const countValues = (values: string[]) =>
    Array.from(new Set(values)).map((value) => ({
      name: value,
      count: values.filter((entry) => entry === value).length,
    }))
  const brands = countValues(products.map((product) => product.brand || 'Kourier Select'))
  const tags = products.flatMap((product) => product.tags || [])

  return {
    meta: {
      total: products.length,
      price: range(prices),
      discount: range(discounts),
      rating: {
        ...range(ratings),
        average: ratings.length
          ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
          : null,
      },
    },
    categories: demoCategories.map((category) => ({
      id: category._id,
      name: category.name,
      slug: category.slug,
      count: products.filter((product) => product.category?._id === category._id).length,
    })),
    brands,
    sellers: [{ id: 'demo-seller-kourier-boyz', name: 'Kourier Boyz Picks', count: products.length }],
    tags: Array.from(new Set(tags)).map((value) => ({ value, count: tags.filter((tag) => tag === value).length })),
    attributes: [],
    availability: {
      inStock: products.filter((product) => (product.stock ?? product.totalStock ?? 0) > 0).length,
      outOfStock: products.filter((product) => (product.stock ?? product.totalStock ?? 0) <= 0).length,
    },
    ratingBuckets: [5, 4, 3].map((rating) => ({
      label: `${rating}+ stars`,
      minRating: rating,
      count: products.filter((product) => (product.rating || 0) >= rating).length,
    })),
  }
}

export const demoSeller = {
  _id: 'demo-seller-kourier-boyz',
  name: 'Kourier Boyz Picks',
  businessName: 'Kourier Boyz Picks',
  storeSlug: 'kourier-boyz-picks',
  storeBanner: '/brand/kourier-boyz-commerce-hero.webp',
  storefrontBanners: [
    { imageUrl: '/brand/kourier-boyz-commerce-hero.webp', order: 1, gridSpan: 2 },
    { imageUrl: '/brand/kourier-boyz-hero.webp', order: 2, gridSpan: 1 },
  ],
  storeDescription: 'A practical selection of everyday products backed by Kourier Boyz delivery.',
  storeStatus: 'active' as const,
  storeEmail: 'support@kourierboyz.com',
  supportEmail: 'support@kourierboyz.com',
  shippingPolicy: 'Orders are dispatched through available Kourier Boyz courier partners.',
  returnPolicy: 'Eligible products can be returned within the period shown on the product page.',
  brandNames: Array.from(new Set(demoProducts.map((product) => product.brand).filter(Boolean))) as string[],
  storeTheme: 'default',
}

export const demoSellerCategories = demoCategories.map((category) => ({
  _id: category._id,
  name: category.name,
  slug: category.slug,
  mainImage: category.mainImage,
  productCount: category.productCount || 0,
  subcategories: (category.subcategories || []).map((subcategory) => ({
    _id: subcategory._id,
    name: subcategory.name,
    slug: subcategory.slug,
    mainImage: subcategory.mainImage,
    productCount: subcategory.productCount || 0,
  })),
}))
