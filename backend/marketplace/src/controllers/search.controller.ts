import { Request, Response } from 'express'
import mongoose from 'mongoose'
import Category from '../models/Category'
import Product from '../models/Product'
import User from '../models/User'
import { fiveMinuteCache } from '../utils/cache'
import { hydrateSearchProducts } from '../utils/productHydration'

const SEARCH_CACHE_VERSION = 'v3'

function stableStringify(value: any): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }
  const keys = Object.keys(value).sort()
  const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
  return `{${entries.join(',')}}`
}

type SearchQuery = {
  q?: string
  page?: number
  limit?: number
  sort?: string
  filters?: any
}

function sanitizeQuery(q?: string): string {
  return (q || '').trim().slice(0, 200)
}

function buildLikeRegex(q: string): RegExp {
  // simple fuzzy: characters in order with gaps, case-insensitive
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = escaped.split('').join('.*')
  return new RegExp(pattern, 'i')
}

// Very lightweight NLP helpers (plural normalization, synonyms, colors)
const COLOR_WORDS = new Set<string>([
  'red',
  'blue',
  'green',
  'black',
  'white',
  'grey',
  'gray',
  'yellow',
  'pink',
  'purple',
  'orange',
  'brown',
  'beige',
  'maroon',
  'navy',
  'teal',
  'olive',
  'gold',
  'silver',
  'cream',
])
const GENDER_WORDS = new Set<string>([
  'men',
  'man',
  'male',
  'women',
  'woman',
  'female',
  'girls',
  'boys',
  'kids',
  'unisex',
])
const MATERIAL_WORDS = new Set<string>([
  'leather',
  'cotton',
  'silk',
  'linen',
  'denim',
  'polyester',
  'wool',
  'nylon',
  'rayon',
])
const STYLE_WORDS = new Set<string>([
  'casual',
  'formal',
  'sport',
  'sports',
  'party',
  'ethnic',
  'traditional',
  'modern',
  'classic',
  'slim',
  'regular',
  'fit',
  'long',
  'short',
  'midi',
  'maxi',
])
const OUTFIT_TYPES = new Set<string>([
  'dress',
  'top',
  'tshirt',
  'shirt',
  'jean',
  'pant',
  'trouser',
  'shoe',
  'sandal',
  'sneaker',
  'kurti',
  'saree',
  'lehenga',
  'skirt',
  'hoodie',
  'sweater',
  'jacket',
])
const SYNONYMS: Record<string, string> = {
  dresses: 'dress',
  tops: 'top',
  tshirts: 'tshirt',
  't-shirts': 'tshirt',
  tees: 'tshirt',
  pants: 'pant',
  trousers: 'pant',
  jeans: 'jean',
  shirts: 'shirt',
  kurtis: 'kurti',
  sarees: 'saree',
  lehengas: 'lehenga',
  shoes: 'shoe',
  sandals: 'sandal',
  sneakers: 'sneaker',
}
function stemWord(token: string): string {
  // Basic stemming to cover common English plurals
  if (SYNONYMS[token]) return SYNONYMS[token]
  if (token.endsWith('ies') && token.length > 4) return token.slice(0, -3) + 'y' // parties -> party
  if (token.endsWith('sses') && token.length > 5) return token.slice(0, -2) // dresses -> dress
  if (token.endsWith('xes') || token.endsWith('ches') || token.endsWith('shes')) {
    return token.slice(0, -2) // boxes->box, watches->watch
  }
  if (token.endsWith('es') && token.length > 3) return token.slice(0, -2) // dresses->dress, bags->bag (if 'es')
  if (token.endsWith('s') && token.length > 3) return token.slice(0, -1) // bags->bag
  return token
}
function tokenize(query: string): string[] {
  const raw = query
    .toLowerCase()
    .replace(/[^a-z0-9#\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const tokens: string[] = []
  for (const t of raw) {
    const base = stemWord(t)
    tokens.push(base)
  }
  return Array.from(new Set(tokens))
}

const STOPWORDS = new Set<string>([
  'a',
  'an',
  'the',
  'for',
  'and',
  'or',
  'with',
  'in',
  'on',
  'to',
  'of',
])
function normalizeTokens(tokens: string[]): string[] {
  return tokens.filter((t) => t && !STOPWORDS.has(t))
}

function makeNgrams(tokens: string[]): string[] {
  const grams: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    if (i + 1 < tokens.length) grams.push(`${tokens[i]} ${tokens[i + 1]}`)
    if (i + 2 < tokens.length) grams.push(`${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`)
  }
  return grams
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  return dp[m][n]
}

function computeScore(
  p: any,
  baseRelevance: number,
  q: string,
  opts?: {
    colorTokens?: string[]
    matchedCategoryIds?: string[]
    tokens?: string[]
    ngrams?: string[]
    hasOutfitType?: boolean
    fieldMatchCounts?: {
      name: number
      tags: number
      attributes: number
      description: number
      brand: number
      category: number
      total: number
    }
  },
): number {
  const name = (p.name || '').toString()
  const brand = (p.brand || '').toString()
  const tags = Array.isArray(p.tags) ? p.tags.join(' ') : ''
  const description = (p.description || '').toString()
  const attributesBlob = `${(p.features || []).join(' ')} ${JSON.stringify(
    p.specifications || [],
  )} ${JSON.stringify(p.attributeMetadata || {})}`
  const fields = `${name} ${brand} ${tags} ${description} ${attributesBlob}`.trim()

  // typo tolerance boost if <=2
  let typoBoost = 0
  const d = Math.min(
    levenshtein(q.toLowerCase(), name.toLowerCase()),
    brand ? levenshtein(q.toLowerCase(), brand.toLowerCase()) : 99,
  )
  if (d <= 2) {
    typoBoost = 5 - d // 5 for exact, 4 for 1, 3 for 2
  }

  // simple contains boost
  let containsBoost = 0
  if (name.toLowerCase().includes(q.toLowerCase())) containsBoost += 6
  if (brand && brand.toLowerCase().includes(q.toLowerCase())) containsBoost += 3
  const tokensLower = opts?.tokens?.map((t) => t.toLowerCase()) ?? []

  // token presence boosts across many fields (ANY-token matching)
  if (opts?.tokens && opts.tokens.length > 0) {
    const rich = fields.toLowerCase()
    let tokenBoost = 0
    for (const t of opts.tokens) {
      if (!t) continue
      const present = rich.includes(t.toLowerCase())
      if (present) tokenBoost += 1.5
      // prefix stronger
      if (name.toLowerCase().startsWith(t.toLowerCase())) tokenBoost += 1.5
      if (brand.toLowerCase().startsWith(t.toLowerCase())) tokenBoost += 1.0
    }
    containsBoost += tokenBoost
  }
  // phrase (bigram/trigram) boost
  if (opts?.ngrams && opts.ngrams.length > 0) {
    for (const g of opts.ngrams) {
      if (g.length < 3) continue
      if (name.toLowerCase().includes(g)) containsBoost += 2
      if (tags.toLowerCase().includes(g)) containsBoost += 1.5
    }
  }

  // popularity and conversion proxies
  const viewCount = Number(p.viewCount || 0)
  const soldCount = Number(p.soldCount || 0)
  const popularity = Math.log10(1 + viewCount) * 1.5 + Math.log10(1 + soldCount) * 3
  const conversionRate = viewCount > 0 ? (soldCount / viewCount) * 10 : 0
  const ratingWeight = Number(p.rating || 0) * 1.5

  // coverage boost (reward broad token matches)
  const coverageRatio =
    opts?.tokens && opts.tokens.length > 0
      ? Math.min(1, (opts.fieldMatchCounts?.total || 0) / (opts.tokens.length * 4))
      : 0
  const coverageBoost = coverageRatio * 40

  // brand precision boosts
  let brandBoost = 0
  if (brand) {
    const brandLower = brand.toLowerCase()
    if (tokensLower.includes(brandLower)) brandBoost += 12
    else if (tokensLower.some((t) => brandLower.startsWith(t))) brandBoost += 6
    brandBoost += (opts?.fieldMatchCounts?.brand || 0) * 4
  }

  // category text matches
  let categoryMatchBoost = (opts?.fieldMatchCounts?.category || 0) * 3

  // recency boost (newer products get slight preference)
  let recencyBoost = 0
  if (p.createdAt) {
    const createdAt = p.createdAt instanceof Date ? p.createdAt : new Date(p.createdAt)
    if (!Number.isNaN(createdAt.getTime())) {
      const monthsDiff = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30)
      recencyBoost = Math.max(0, 12 - monthsDiff) * 1.2
    }
  }

  // discount boost
  const discountValue =
    typeof p.calculatedDiscount === 'number'
      ? p.calculatedDiscount
      : typeof p.discountPercent === 'number'
      ? p.discountPercent
      : 0
  const discountBoost = Math.min(25, Math.max(0, discountValue)) * 0.6

  // out of stock penalty
  const variantHasStock = Array.isArray(p.variants)
    ? p.variants.some((variant: any) => (variant?.stock ?? 0) > 0)
    : false
  const stock = variantHasStock ? 1 : p.totalStock ?? p.stock ?? 0
  const oosPenalty = stock <= 0 || p.status === 'out_of_stock' ? -40 : 0

  // color boost if product fields hint the color
  let colorBoost = 0
  if (opts?.colorTokens && opts.colorTokens.length > 0) {
    const joined = `${fields} ${(p.features || []).join(' ')} ${JSON.stringify(
      p.specifications || [],
    )} ${JSON.stringify(p.attributeMetadata || {})}`.toLowerCase()
    for (const c of opts.colorTokens) {
      if (joined.includes(c)) colorBoost += 3
    }
  }

  // category boost if product category matches detected categories
  let categoryBoost = 0
  if (opts?.matchedCategoryIds?.length && p.category) {
    const idStr =
      typeof p.category === 'object' && p.category._id ? String(p.category._id) : String(p.category)
    if (opts.matchedCategoryIds.includes(idStr)) categoryBoost += 4
  }

  // field weighting: name*4, tags*2, attributes*2, description*1
  let fieldWeightBoost = 0
  if (opts?.fieldMatchCounts) {
    fieldWeightBoost += 4 * (opts.fieldMatchCounts.name || 0)
    fieldWeightBoost += 2 * (opts.fieldMatchCounts.tags || 0)
    fieldWeightBoost += 2 * (opts.fieldMatchCounts.attributes || 0)
    fieldWeightBoost += 1 * (opts.fieldMatchCounts.description || 0)
  }

  // outfit type priority
  const outfitBoost = opts?.hasOutfitType ? 3 : 0

  // Apply percentage boosts
  const baseTotal =
    baseRelevance +
    containsBoost +
    fieldWeightBoost +
    popularity +
    conversionRate +
    ratingWeight +
    outfitBoost +
    coverageBoost +
    brandBoost +
    categoryMatchBoost +
    recencyBoost +
    discountBoost
  const colorPct = opts?.colorTokens?.length ? 0.1 : 0 // +10% if color present
  const categoryPct = opts?.matchedCategoryIds?.length ? 0.15 : 0 // +15% if category matched
  const pctBoost = baseTotal * (colorPct + categoryPct)

  return baseTotal + pctBoost + typoBoost + categoryBoost + colorBoost + oosPenalty
}

const getNumericStock = (value: unknown): number => {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

const productHasAvailableStock = (product: Record<string, any>): boolean => {
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    const variantHasInventory = product.variants.some(
      (variant: any) => getNumericStock(variant?.stock) > 0,
    )
    if (variantHasInventory) {
      return true
    }
  }

  if (getNumericStock(product.totalStock) > 0) {
    return true
  }

  return getNumericStock(product.stock ?? product.quantity) > 0
}

function resolveComparablePrice(item: any): number {
  const defaultVariant = Array.isArray(item.variants)
    ? item.variants.find((variant: any) => variant?.isDefault)
    : undefined
  if (
    defaultVariant &&
    typeof defaultVariant.price === 'number' &&
    Number.isFinite(defaultVariant.price)
  ) {
    return defaultVariant.price
  }
  if (typeof item.minPrice === 'number' && Number.isFinite(item.minPrice)) {
    return item.minPrice
  }
  if (typeof item.effectivePrice === 'number' && Number.isFinite(item.effectivePrice)) {
    return item.effectivePrice
  }
  if (Array.isArray(item.variants)) {
    const variantPrices = item.variants
      .map((variant: any) =>
        typeof variant?.price === 'number' && Number.isFinite(variant.price)
          ? variant.price
          : undefined,
      )
      .filter((price: number | undefined): price is number => typeof price === 'number')
    if (variantPrices.length > 0) {
      return Math.min(...variantPrices)
    }
  }
  if (typeof item.price === 'number' && Number.isFinite(item.price)) {
    return item.price
  }
  return Number.POSITIVE_INFINITY
}

function majorityThreshold(tokenCount: number): number {
  if (tokenCount <= 1) return 1
  return Math.max(1, Math.ceil((2 * tokenCount) / 3))
}

function suggestCorrections(tokens: string[]): { corrected: string[]; changed: boolean } {
  // Lightweight correction using known dictionaries
  const vocab = new Set<string>([
    ...Array.from(COLOR_WORDS),
    ...Array.from(GENDER_WORDS),
    ...Array.from(MATERIAL_WORDS),
    ...Array.from(STYLE_WORDS),
    ...Array.from(OUTFIT_TYPES),
  ])
  const corrected: string[] = []
  let changed = false
  for (const t of tokens) {
    if (vocab.has(t)) {
      corrected.push(t)
      continue
    }
    if (t.length <= 3) {
      corrected.push(t)
      continue
    }
    let best = t
    let bestD = Infinity
    for (const v of vocab) {
      const d = levenshtein(t, v)
      if (d < bestD) {
        bestD = d
        best = v
      }
    }
    if (bestD > 0 && bestD <= 2) {
      corrected.push(best)
      changed = true
    } else {
      corrected.push(t)
    }
  }
  return { corrected, changed }
}

export const getSearch = async (req: Request, res: Response) => {
  try {
    const rawQ = sanitizeQuery(req.query.q as string)
    const categoryId = (req.query.categoryId as string)?.trim() || ''
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10))
    const limit = Math.max(1, Math.min(50, parseInt((req.query.limit as string) || '24', 10)))
    const skip = (page - 1) * limit
    const sort = (req.query.sort as string) || 'relevance'
    const filters = req.query.filters ? JSON.parse(req.query.filters as string) : {}

    // Allow search without query if categoryId is provided
    if (!rawQ && !categoryId) {
      return res.status(200).json({ products: [], pagination: { total: 0, page, limit, pages: 0 } })
    }

    // Use categoryId from query param if provided, otherwise use filters.category
    const effectiveCategoryId = categoryId || filters?.category

    const cacheKeyFilters = stableStringify({ ...filters, categoryId: effectiveCategoryId })
    const cacheKey = `${SEARCH_CACHE_VERSION}:search:${rawQ || ''}:${
      effectiveCategoryId || ''
    }:${page}:${limit}:${sort}:${cacheKeyFilters}`
    const cached = fiveMinuteCache.get<any>(cacheKey)
    if (cached) {
      return res.json(cached)
    }

    const q = rawQ
    const baseTokens = q ? normalizeTokens(tokenize(q)) : []
    const ngrams = q ? makeNgrams(baseTokens) : []
    const { corrected, changed } = q
      ? suggestCorrections(baseTokens)
      : { corrected: [], changed: false }
    const scoringTokens = changed ? Array.from(new Set([...baseTokens, ...corrected])) : baseTokens
    const didYouMean = changed ? corrected.join(' ') : undefined
    const colorTokens = scoringTokens.filter((t) => COLOR_WORDS.has(t))
    const hasOutfitType = scoringTokens.some((t) => OUTFIT_TYPES.has(t))
    // Attempt to detect likely categories (do not hard filter, but boost later)
    const matchedCategories = q
      ? await Category.find({ name: new RegExp(scoringTokens.join('.*'), 'i') }, { _id: 1 })
          .limit(10)
          .lean()
          .exec()
      : []
    const matchedCategoryIds = matchedCategories.map((c) => String(c._id))
    const normalizeFilterArray = (value: unknown): string[] => {
      if (Array.isArray(value)) {
        return value
          .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
          .filter((entry) => entry.length > 0)
      }
      if (typeof value === 'string') {
        return value
          .split(',')
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0)
      }
      return []
    }

    const availabilityFilters = normalizeFilterArray(filters?.availability).map((value) =>
      value.toLowerCase(),
    )
    const includeOutOfStock =
      Boolean(filters?.includeOutOfStock) ||
      availabilityFilters.includes('include_out_of_stock') ||
      availabilityFilters.includes('out_of_stock')

    const filterQuery: any = includeOutOfStock
      ? { status: { $in: ['active', 'out_of_stock'] } }
      : { status: 'active' }

    // Handle category filtering - prioritize categoryId from query param
    if (effectiveCategoryId) {
      try {
        const categoryObjectId = new mongoose.Types.ObjectId(effectiveCategoryId)
        // Get category to check if it's a parent or child
        const categoryDoc = await Category.findById(effectiveCategoryId).lean().exec()
        if (categoryDoc) {
          // Check if this category has a parent (it's a child/subcategory)
          if (categoryDoc.parent) {
            // It's a child category - just use this category directly
            filterQuery.category = categoryObjectId
          } else {
            // It's a parent category - include parent + all its subcategories
            const subcategoryIds = await Category.find({
              $or: [{ _id: categoryObjectId }, { parent: categoryObjectId }],
            }).distinct('_id')
            if (subcategoryIds.length > 0) {
              filterQuery.category = { $in: subcategoryIds }
            } else {
              // No subcategories found, just use the parent
              filterQuery.category = categoryObjectId
            }
          }
        } else {
          // Category not found, try direct match anyway
          filterQuery.category = categoryObjectId
        }
      } catch (err) {
        console.error('Error processing category filter:', err, 'categoryId:', effectiveCategoryId)
        // If ObjectId conversion fails, try to find by slug or name
        try {
          const categoryBySlug = await Category.findOne({
            $or: [{ slug: effectiveCategoryId }, { name: new RegExp(effectiveCategoryId, 'i') }],
          })
            .lean()
            .exec()
          if (categoryBySlug && categoryBySlug._id) {
            const catId = new mongoose.Types.ObjectId(String(categoryBySlug._id))
            if (categoryBySlug.parent) {
              filterQuery.category = catId
            } else {
              const subcategoryIds = await Category.find({
                $or: [{ _id: catId }, { parent: catId }],
              }).distinct('_id')
              filterQuery.category = subcategoryIds.length > 0 ? { $in: subcategoryIds } : catId
            }
          }
        } catch (err2) {
          console.error('Error finding category by slug/name:', err2)
        }
      }
    } else if (filters?.category) {
      try {
        const categoryObjectId = new mongoose.Types.ObjectId(filters.category)
        const categoryDoc = await Category.findById(filters.category).lean().exec()
        if (categoryDoc) {
          if (categoryDoc.parent) {
            // It's a child category - just use this category
            filterQuery.category = categoryObjectId
          } else {
            // It's a parent category - include parent + all its subcategories
            const subcategoryIds = await Category.find({
              $or: [{ _id: categoryObjectId }, { parent: categoryObjectId }],
            }).distinct('_id')
            filterQuery.category =
              subcategoryIds.length > 0 ? { $in: subcategoryIds } : categoryObjectId
          }
        } else {
          filterQuery.category = categoryObjectId
        }
      } catch (err) {
        console.error('Error processing category filter from filters:', err)
      }
    }

    if (filters) {
      const brandFilters = normalizeFilterArray(filters.brand)
      if (brandFilters.length > 0) {
        filterQuery.brand = { $in: brandFilters }
      }

      if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
        filterQuery.price = {}
        if (filters.minPrice !== undefined) filterQuery.price.$gte = filters.minPrice
        if (filters.maxPrice !== undefined) filterQuery.price.$lte = filters.maxPrice
      }

      if (filters.minRating !== undefined) {
        filterQuery.rating = { $gte: filters.minRating }
      }

      const tagFilters = normalizeFilterArray(filters.tag)
      if (tagFilters.length > 0) {
        filterQuery.tags = { $in: tagFilters }
      }

      // Handle attribute filters
      if (filters.attributes && typeof filters.attributes === 'object') {
        const attributeConditions: any[] = []
        Object.entries(filters.attributes).forEach(([attributeKey, attributeValues]) => {
          if (!Array.isArray(attributeValues) || attributeValues.length === 0) return

          // Normalize attribute values (trim and filter empty)
          const normalizedValues = attributeValues
            .map((val) => (typeof val === 'string' ? val.trim() : ''))
            .filter((val) => val.length > 0)

          if (normalizedValues.length === 0) return

          const trimmedKey = attributeKey.trim()
          // Escape special regex characters in the key
          const escapedKey = trimmedKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

          // Match products where filterMetadata contains an entry with this key (case-insensitive)
          // and at least one of the requested values
          attributeConditions.push({
            filterMetadata: {
              $elemMatch: {
                key: { $regex: new RegExp(`^${escapedKey}$`, 'i') },
                values: { $in: normalizedValues },
              },
            },
          })
        })

        // If we have attribute conditions, add them to the filter
        if (attributeConditions.length > 0) {
          if (attributeConditions.length === 1) {
            Object.assign(filterQuery, attributeConditions[0])
          } else {
            // Multiple attribute filters - all must match (AND logic)
            filterQuery.$and = (filterQuery.$and || []).concat(attributeConditions)
          }
        }
      }
    }

    // Get approved sellers first
    const approvedSellerIds = await User.find({ role: 'seller', isApproved: true }).distinct('_id')
    if (approvedSellerIds.length > 0) {
      filterQuery.seller = { $in: approvedSellerIds }
    } else {
      // No approved sellers, return empty
      return res.json({
        products: [],
        pagination: { total: 0, page, limit, pages: 0 },
        didYouMean,
      })
    }

    const baseProjection: any = {
      name: 1,
      brand: 1,
      tags: 1,
      category: 1,
      price: 1,
      effectivePrice: 1,
      comparePrice: 1,
      status: 1,
      totalStock: 1,
      stock: 1,
      soldCount: 1,
      viewCount: 1,
      rating: 1,
      images: 1,
      mainImage: 1,
      slug: 1,
      hasVariants: 1,
      description: 1,
      features: 1,
      specifications: 1,
      attributeMetadata: 1,
      discountPercent: 1,
      discountStart: 1,
      discountEnd: 1,
      createdAt: 1,
      seller: 1,
    }

    const populateOptions = [
      {
        path: 'category',
        select: 'name slug parent mainImage',
        populate: { path: 'parent', select: 'name slug' },
      },
      {
        path: 'seller',
        select: 'businessName storeName name storeSlug sellerRating sellerReviewCount',
      },
    ]

    // Try MongoDB text search first (if it works and we have a query)
    let results: any[] = []
    if (q) {
      try {
        results = await Product.find(
          { ...filterQuery, $text: { $search: q } },
          { ...baseProjection, score: { $meta: 'textScore' } },
        )
          .sort({ score: { $meta: 'textScore' } })
          .limit(200)
          .populate(populateOptions)
          .lean()
      } catch (err) {
        // Text search failed (e.g., no text index or textScore error), fall through to regex
        console.log('Text search failed, using regex fallback:', err)
      }
    }

    // Fallback/augmentation: Use partial/like matches (or category-only search)
    // If no query but we have category filter, or if results are insufficient, query products
    if (!q && effectiveCategoryId) {
      // Category-only search: query products directly
      results = await Product.find(filterQuery, baseProjection)
        .limit(200)
        .populate(populateOptions)
        .lean()
    } else if (q && results.length < limit) {
      const colorRegexes = q ? colorTokens.map((c) => new RegExp(`\\b${c}\\b`, 'i')) : []
      const tokenRegexes = q
        ? scoringTokens.map((t) => new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
        : []
      const prefixRegexes = q
        ? scoringTokens.map((t) => new RegExp(`^${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'))
        : []
      const ngramRegexes = q
        ? ngrams.map((g) => new RegExp(g.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
        : []
      const searchRegex = q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null

      // If we have a query, use search regexes
      const searchConditions = {
        $or: [
          { name: searchRegex },
          { description: searchRegex },
          { brand: searchRegex },
          { tags: searchRegex },
          { features: { $elemMatch: { $regex: searchRegex } } },
          { 'specifications.value': { $regex: searchRegex } },
          { 'specifications.key': { $regex: searchRegex } },
          { 'filterMetadata.values': { $regex: searchRegex } },
          ...(colorRegexes.length
            ? [
                { features: { $elemMatch: { $in: colorRegexes as any } } },
                { 'specifications.value': { $in: colorRegexes as any } },
                { tags: { $in: colorTokens } },
              ]
            : []),
          ...(tokenRegexes.length
            ? tokenRegexes.flatMap((r) => [
                { name: r },
                { brand: r },
                { tags: r },
                { description: r },
              ])
            : []),
          ...(prefixRegexes.length
            ? prefixRegexes.flatMap((r) => [{ name: r }, { brand: r }, { description: r }])
            : []),
          ...(ngramRegexes.length ? ngramRegexes.flatMap((r) => [{ name: r }, { tags: r }]) : []),
        ],
      }

      const likeMatches = await Product.find(
        {
          ...filterQuery,
          ...searchConditions,
        },
        baseProjection,
      )
        .limit(200)
        .populate(populateOptions)
        .lean()
      const existingIds = new Set(results.map((p: any) => String(p._id)))
      for (const p of likeMatches) {
        if (!existingIds.has(String(p._id))) {
          ;(p as any).score = (p as any).score ?? 0.3
          results.push(p as any)
        }
      }
    }

    if (!results.length) {
      return res.json({
        products: [],
        pagination: { total: 0, page, limit, pages: 0 },
        didYouMean,
      })
    }

    results = await hydrateSearchProducts(results)

    if (!includeOutOfStock) {
      results = results.filter((product) => productHasAvailableStock(product))
    }

    // Token-majority requirement and fuzzy gating (skip if no query)
    const minTokensToMatch = q ? majorityThreshold(scoringTokens.length) : 0

    function countFieldMatches(p: any): {
      name: number
      tags: number
      attributes: number
      description: number
      brand: number
      category: number
      total: number
    } {
      const nameStr = (p.name || '').toString().toLowerCase()
      const tagsStr = (Array.isArray(p.tags) ? p.tags.join(' ') : '').toLowerCase()
      const descriptionStr = (p.description || '').toString().toLowerCase()
      const attrStr = `${(p.features || []).join(' ')} ${JSON.stringify(
        p.specifications || [],
      )} ${JSON.stringify(p.attributeMetadata || {})}`.toLowerCase()
      const brandStr = (p.brand || '').toString().toLowerCase()
      const categoryStr =
        typeof p.category === 'object' && p.category?.name
          ? p.category.name.toString().toLowerCase()
          : ''
      let n = 0,
        tg = 0,
        at = 0,
        ds = 0,
        br = 0,
        ct = 0
      for (const t of scoringTokens) {
        if (nameStr.includes(t)) n++
        if (tagsStr.includes(t)) tg++
        if (attrStr.includes(t)) at++
        if (descriptionStr.includes(t)) ds++
        if (brandStr.includes(t)) br++
        if (categoryStr.includes(t)) ct++
      }
      const total = n + tg + at + ds + br + ct
      return { name: n, tags: tg, attributes: at, description: ds, brand: br, category: ct, total }
    }

    const preRanked = results
      .map((p: any) => {
        // If no query, just use a base score for sorting
        if (!q) {
          const textScore = 0
          const baseRelevance = 50 // Base score for category-only results
          const finalScore = computeScore(p, baseRelevance, '', {
            colorTokens: [],
            matchedCategoryIds: effectiveCategoryId ? [effectiveCategoryId] : [],
            tokens: [],
            ngrams: [],
            hasOutfitType: false,
            fieldMatchCounts: {
              name: 0,
              tags: 0,
              attributes: 0,
              description: 0,
              brand: 0,
              category: 0,
              total: 0,
            },
          })
          return { ...p, _finalScore: finalScore }
        }

        const fieldsMatch = countFieldMatches(p)
        const hasAnyToken = fieldsMatch.total > 0
        // Only filter out if we have tokens and no matches at all (very strict)
        // For single token queries, be more lenient
        if (!hasAnyToken && scoringTokens.length > 0) {
          // Check if the query itself appears in any field (case-insensitive)
          const qLower = q.toLowerCase()
          const nameLower = (p.name || '').toString().toLowerCase()
          const descLower = (p.description || '').toString().toLowerCase()
          const brandLower = (p.brand || '').toString().toLowerCase()
          const tagsLower = (Array.isArray(p.tags) ? p.tags.join(' ') : '').toLowerCase()
          if (
            !nameLower.includes(qLower) &&
            !descLower.includes(qLower) &&
            !brandLower.includes(qLower) &&
            !tagsLower.includes(qLower)
          ) {
            return null
          }
        }
        // For multi-token queries, require at least some token matches
        if (scoringTokens.length > 1 && fieldsMatch.total < minTokensToMatch) {
          const textScore = typeof (p as any).score === 'number' ? (p as any).score : 0
          // Only filter if text score is very low (text search didn't find it)
          if (textScore < 0.25) return null
        }
        const textScore = typeof (p as any).score === 'number' ? (p as any).score : 0
        const finalScore = computeScore(p, textScore, q, {
          colorTokens,
          matchedCategoryIds,
          tokens: scoringTokens,
          ngrams,
          hasOutfitType,
          fieldMatchCounts: fieldsMatch,
        })
        return { ...p, _finalScore: finalScore }
      })
      .filter(Boolean) as any[]

    const ranked = preRanked as any[]

    // Apply sort
    if (sort === 'price_asc')
      ranked.sort((a, b) => resolveComparablePrice(a) - resolveComparablePrice(b))
    else if (sort === 'price_desc')
      ranked.sort((a, b) => resolveComparablePrice(b) - resolveComparablePrice(a))
    else if (sort === 'newest')
      ranked.sort((a, b) => (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0))
    else ranked.sort((a, b) => b._finalScore - a._finalScore)

    let orderedResults: any[]
    if (sort === 'relevance') {
      const buckets: Record<string, any[]> = { low: [], mid: [], high: [] }
      for (const item of ranked) {
        const price = resolveComparablePrice(item)
        const bucket = price <= 1000 ? 'low' : price <= 5000 ? 'mid' : 'high'
        buckets[bucket].push(item)
      }
      const roundRobinByBrand = (list: any[], take: number): any[] => {
        const result: any[] = []
        const brandGroups = new Map<string, any[]>()
        for (const it of list) {
          const key = (it.brand || 'unknown').toString()
          if (!brandGroups.has(key)) brandGroups.set(key, [])
          brandGroups.get(key)!.push(it)
        }
        const keys = Array.from(brandGroups.keys())
        let idx = 0
        while (result.length < take && keys.length > 0) {
          const k = keys[idx % keys.length]
          const g = brandGroups.get(k)!
          const next = g.shift()
          if (next) result.push(next)
          if (g.length === 0) {
            brandGroups.delete(k)
            keys.splice(idx % keys.length, 1)
            idx = 0
          } else {
            idx++
          }
        }
        return result
      }
      orderedResults = roundRobinByBrand(
        [...buckets.high, ...buckets.mid, ...buckets.low],
        ranked.length,
      )
    } else {
      orderedResults = ranked
    }

    const total = ranked.length
    const pageItems = orderedResults
      .slice(skip, skip + limit)
      .map(({ _finalScore, ...rest }) => rest)
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const hasMore = skip + limit < total
    const response = {
      products: pageItems,
      pagination: {
        total,
        page,
        limit,
        pages: totalPages,
        hasMore,
      },
      didYouMean,
    }

    // track recent searches for authenticated users (only if we have a query)
    if (q) {
      try {
        const userId = (req as any).user?.userId || (req as any).user?.id
        if (userId) {
          // Remove existing same query (case-insensitive) to avoid duplicates at different positions
          await User.updateOne(
            { _id: userId },
            { $pull: { recentSearches: { query: { $regex: new RegExp(`^${q}$`, 'i') } } } },
          ).exec()
          await User.findByIdAndUpdate(userId, {
            $push: {
              recentSearches: {
                $each: [{ query: q, searchedAt: new Date() }],
                $position: 0,
              },
            },
            $set: { updatedAt: new Date() },
          }).exec()
          await User.updateOne(
            { _id: userId, $expr: { $gt: [{ $size: { $ifNull: ['$recentSearches', []] } }, 20] } },
            { $push: { recentSearches: { $each: [], $slice: 20 } } },
          ).exec()
        }
      } catch {
        // ignore
      }
    }

    fiveMinuteCache.set(cacheKey, response, 300)
    return res.json(response)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Search failed' })
  }
}

export const getSearchSuggestions = async (req: Request, res: Response) => {
  try {
    const rawQ = sanitizeQuery(req.query.q as string)
    const q = rawQ
    const cacheKey = `suggest:${q}`
    const cached = fiveMinuteCache.get<any>(cacheKey)
    if (cached) {
      return res.json(cached)
    }

    if (!q) {
      // trending fallback when empty
      const trending = await Product.find({}, { name: 1, soldCount: 1, viewCount: 1 })
        .sort({ soldCount: -1, viewCount: -1 })
        .limit(6)
        .lean()
        .exec()
      const response = {
        products: trending.slice(0, 5).map((p) => p.name),
        categories: [],
        trending: trending.map((p) => p.name),
      }
      fiveMinuteCache.set(cacheKey, response, 300)
      return res.json(response)
    }

    const regex = buildLikeRegex(q)
    const [productDocs, categoryDocs] = await Promise.all([
      Product.find(
        {
          status: { $in: ['active', 'out_of_stock'] },
          $or: [{ name: regex }, { brand: regex }, { tags: regex }],
        },
        { name: 1, mainImage: 1, images: 1, slug: 1, brand: 1, price: 1, category: 1 },
      )
        .populate('category', 'name')
        .sort({ soldCount: -1, viewCount: -1 })
        .limit(20)
        .lean()
        .exec(),
      Category.find({ name: regex }, { name: 1, mainImage: 1, hoverImage: 1, slug: 1 })
        .limit(20)
        .lean()
        .exec(),
    ])

    const products = productDocs
      .map((p) => ({
        id: String((p as any)._id),
        name: p.name as string,
        slug: (p as any).slug as string | undefined,
        image:
          (p as any).mainImage ||
          (Array.isArray((p as any).images) && (p as any).images[0]
            ? (p as any).images[0]
            : undefined),
        brand: (p as any).brand as string | undefined,
        price: typeof (p as any).price === 'number' ? ((p as any).price as number) : undefined,
        category: (p as any).category?.name as string | undefined,
      }))
      .slice(0, 5)
    const categories = categoryDocs
      .map((c) => ({
        id: String((c as any)._id),
        name: c.name as string,
        slug: (c as any).slug as string | undefined,
        image: (c as any).mainImage || (c as any).hoverImage || undefined,
      }))
      .slice(0, 5)

    // trending searches proxy using popular products
    const trendingDocs = await Product.find({}, { name: 1, soldCount: 1, viewCount: 1 })
      .sort({ soldCount: -1, viewCount: -1 })
      .limit(6)
      .lean()
      .exec()

    const response = {
      products,
      categories,
      trending: trendingDocs.map((p) => p.name),
    }
    fiveMinuteCache.set(cacheKey, response, 300)
    return res.json(response)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Suggestions failed' })
  }
}

export const getUserRecentSearches = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    if (!userId) {
      return res.json({ recent: [] })
    }
    const user = await User.findById(userId, { recentSearches: 1 }).lean().exec()
    const items =
      (user?.recentSearches || [])
        .slice(0, 20)
        .map((e: any) => ({ query: e.query, searchedAt: e.searchedAt })) || []
    return res.json({ recent: items })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Failed to load recent searches' })
  }
}

export const deleteUserRecentSearch = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    if (!userId) return res.status(401).json({ message: 'Unauthorized' })
    const term = (req.query.q as string)?.trim()
    if (!term) return res.status(400).json({ message: 'q is required' })
    await User.updateOne(
      { _id: userId },
      { $pull: { recentSearches: { query: { $regex: new RegExp(`^${term}$`, 'i') } } } },
    ).exec()
    return res.json({ success: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Failed to remove recent search' })
  }
}
