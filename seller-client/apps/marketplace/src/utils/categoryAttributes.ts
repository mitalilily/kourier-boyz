// Category-based attribute configurations for professional e-commerce
export interface AttributeOption {
  value: string
  label: string
  color?: string // For color attributes
  image?: string // For material/pattern attributes
  description?: string
  sortOrder?: number
}

export interface AttributeConfig {
  key: string
  label: string
  type: 'color' | 'size' | 'material' | 'text' | 'select'
  required: boolean
  options: AttributeOption[]
  description?: string
  sortOrder: number
  categorySpecific?: boolean // If this attribute is specific to certain categories
}

export interface CategoryAttributeSet {
  categoryId: string
  categoryName: string
  attributes: AttributeConfig[]
}

// Predefined category-specific attribute sets
export const CATEGORY_ATTRIBUTE_SETS: CategoryAttributeSet[] = [
  {
    categoryId: 'clothing',
    categoryName: 'Clothing & Apparel',
    attributes: [
      {
        key: 'size',
        label: 'Size',
        type: 'select',
        required: true,
        sortOrder: 1,
        description: 'Clothing size (S, M, L, XL, etc.)',
        options: [
          { value: 'xs', label: 'XS', sortOrder: 1 },
          { value: 's', label: 'S', sortOrder: 2 },
          { value: 'm', label: 'M', sortOrder: 3 },
          { value: 'l', label: 'L', sortOrder: 4 },
          { value: 'xl', label: 'XL', sortOrder: 5 },
          { value: 'xxl', label: 'XXL', sortOrder: 6 },
          { value: 'xxxl', label: 'XXXL', sortOrder: 7 },
        ],
      },
      {
        key: 'color',
        label: 'Color',
        type: 'color',
        required: true,
        sortOrder: 2,
        description: 'Primary color of the item',
        options: [
          { value: 'black', label: 'Black', color: '#000000', sortOrder: 1 },
          { value: 'white', label: 'White', color: '#FFFFFF', sortOrder: 2 },
          { value: 'red', label: 'Red', color: '#FF0000', sortOrder: 3 },
          { value: 'blue', label: 'Blue', color: '#0000FF', sortOrder: 4 },
          { value: 'green', label: 'Green', color: '#008000', sortOrder: 5 },
          { value: 'yellow', label: 'Yellow', color: '#FFFF00', sortOrder: 6 },
          { value: 'pink', label: 'Pink', color: '#FFC0CB', sortOrder: 7 },
          { value: 'purple', label: 'Purple', color: '#800080', sortOrder: 8 },
          { value: 'orange', label: 'Orange', color: '#FFA500', sortOrder: 9 },
          { value: 'gray', label: 'Gray', color: '#808080', sortOrder: 10 },
          { value: 'brown', label: 'Brown', color: '#A52A2A', sortOrder: 11 },
          { value: 'navy', label: 'Navy', color: '#000080', sortOrder: 12 },
        ],
      },
      {
        key: 'material',
        label: 'Material',
        type: 'select',
        required: false,
        sortOrder: 3,
        description: 'Fabric or material composition',
        options: [
          { value: 'cotton', label: '100% Cotton', sortOrder: 1 },
          { value: 'polyester', label: '100% Polyester', sortOrder: 2 },
          { value: 'cotton-polyester', label: 'Cotton-Polyester Blend', sortOrder: 3 },
          { value: 'wool', label: 'Wool', sortOrder: 4 },
          { value: 'silk', label: 'Silk', sortOrder: 5 },
          { value: 'linen', label: 'Linen', sortOrder: 6 },
          { value: 'denim', label: 'Denim', sortOrder: 7 },
          { value: 'leather', label: 'Leather', sortOrder: 8 },
          { value: 'synthetic', label: 'Synthetic', sortOrder: 9 },
        ],
      },
      {
        key: 'fit',
        label: 'Fit',
        type: 'select',
        required: false,
        sortOrder: 4,
        description: 'How the clothing fits',
        options: [
          { value: 'slim', label: 'Slim Fit', sortOrder: 1 },
          { value: 'regular', label: 'Regular Fit', sortOrder: 2 },
          { value: 'loose', label: 'Loose Fit', sortOrder: 3 },
          { value: 'oversized', label: 'Oversized', sortOrder: 4 },
          { value: 'athletic', label: 'Athletic Fit', sortOrder: 5 },
        ],
      },
      {
        key: 'pattern',
        label: 'Pattern',
        type: 'select',
        required: false,
        sortOrder: 5,
        description: 'Print or pattern',
        options: [
          { value: 'solid', label: 'Solid' },
          { value: 'striped', label: 'Striped' },
          { value: 'floral', label: 'Floral' },
          { value: 'geometric', label: 'Geometric' },
          { value: 'polka-dot', label: 'Polka Dot' },
          { value: 'checkered', label: 'Checkered' },
        ],
      },
    ],
  },
  {
    categoryId: 'shoes',
    categoryName: 'Shoes & Footwear',
    attributes: [
      {
        key: 'size',
        label: 'Size',
        type: 'select',
        required: true,
        sortOrder: 1,
        description: 'Shoe size',
        options: [
          { value: '5', label: '5', sortOrder: 1 },
          { value: '5.5', label: '5.5', sortOrder: 2 },
          { value: '6', label: '6', sortOrder: 3 },
          { value: '6.5', label: '6.5', sortOrder: 4 },
          { value: '7', label: '7', sortOrder: 5 },
          { value: '7.5', label: '7.5', sortOrder: 6 },
          { value: '8', label: '8', sortOrder: 7 },
          { value: '8.5', label: '8.5', sortOrder: 8 },
          { value: '9', label: '9', sortOrder: 9 },
          { value: '9.5', label: '9.5', sortOrder: 10 },
          { value: '10', label: '10', sortOrder: 11 },
          { value: '10.5', label: '10.5', sortOrder: 12 },
          { value: '11', label: '11', sortOrder: 13 },
          { value: '11.5', label: '11.5', sortOrder: 14 },
          { value: '12', label: '12', sortOrder: 15 },
        ],
      },
      {
        key: 'color',
        label: 'Color',
        type: 'color',
        required: true,
        sortOrder: 2,
        description: 'Shoe color',
        options: [
          { value: 'black', label: 'Black', color: '#000000', sortOrder: 1 },
          { value: 'white', label: 'White', color: '#FFFFFF', sortOrder: 2 },
          { value: 'brown', label: 'Brown', color: '#A52A2A', sortOrder: 3 },
          { value: 'tan', label: 'Tan', color: '#D2B48C', sortOrder: 4 },
          { value: 'navy', label: 'Navy', color: '#000080', sortOrder: 5 },
          { value: 'gray', label: 'Gray', color: '#808080', sortOrder: 6 },
          { value: 'red', label: 'Red', color: '#FF0000', sortOrder: 7 },
          { value: 'blue', label: 'Blue', color: '#0000FF', sortOrder: 8 },
        ],
      },
      {
        key: 'width',
        label: 'Width',
        type: 'select',
        required: false,
        sortOrder: 3,
        description: 'Shoe width',
        options: [
          { value: 'narrow', label: 'Narrow (B)', sortOrder: 1 },
          { value: 'medium', label: 'Medium (D)', sortOrder: 2 },
          { value: 'wide', label: 'Wide (E)', sortOrder: 3 },
          { value: 'extra-wide', label: 'Extra Wide (EE)', sortOrder: 4 },
        ],
      },
    ],
  },
  {
    categoryId: 'electronics',
    categoryName: 'Electronics & Gadgets',
    attributes: [
      {
        key: 'storage',
        label: 'Storage',
        type: 'select',
        required: true,
        sortOrder: 1,
        description: 'Storage capacity',
        options: [
          { value: '32gb', label: '32GB', sortOrder: 1 },
          { value: '64gb', label: '64GB', sortOrder: 2 },
          { value: '128gb', label: '128GB', sortOrder: 3 },
          { value: '256gb', label: '256GB', sortOrder: 4 },
          { value: '512gb', label: '512GB', sortOrder: 5 },
          { value: '1tb', label: '1TB', sortOrder: 6 },
          { value: '2tb', label: '2TB', sortOrder: 7 },
        ],
      },
      {
        key: 'color',
        label: 'Color',
        type: 'color',
        required: true,
        sortOrder: 2,
        description: 'Device color',
        options: [
          { value: 'space-gray', label: 'Space Gray', color: '#2F2F2F', sortOrder: 1 },
          { value: 'silver', label: 'Silver', color: '#C0C0C0', sortOrder: 2 },
          { value: 'gold', label: 'Gold', color: '#FFD700', sortOrder: 3 },
          { value: 'rose-gold', label: 'Rose Gold', color: '#E8B4B8', sortOrder: 4 },
          { value: 'black', label: 'Black', color: '#000000', sortOrder: 5 },
          { value: 'white', label: 'White', color: '#FFFFFF', sortOrder: 6 },
          { value: 'blue', label: 'Blue', color: '#0000FF', sortOrder: 7 },
          { value: 'red', label: 'Red', color: '#FF0000', sortOrder: 8 },
        ],
      },
      {
        key: 'ram',
        label: 'RAM',
        type: 'select',
        required: false,
        sortOrder: 3,
        description: 'Memory/RAM size',
        options: [
          { value: '4gb', label: '4GB', sortOrder: 1 },
          { value: '6gb', label: '6GB', sortOrder: 2 },
          { value: '8gb', label: '8GB', sortOrder: 3 },
          { value: '12gb', label: '12GB', sortOrder: 4 },
          { value: '16gb', label: '16GB', sortOrder: 5 },
          { value: '32gb', label: '32GB', sortOrder: 6 },
        ],
      },
      {
        key: 'connectivity',
        label: 'Connectivity',
        type: 'select',
        required: false,
        sortOrder: 4,
        description: 'Connection options',
        options: [
          { value: 'wifi', label: 'WiFi Only', sortOrder: 1 },
          { value: 'wifi-cellular', label: 'WiFi + Cellular', sortOrder: 2 },
          { value: 'bluetooth', label: 'Bluetooth', sortOrder: 3 },
          { value: 'usb-c', label: 'USB-C', sortOrder: 4 },
          { value: 'lightning', label: 'Lightning', sortOrder: 5 },
        ],
      },
    ],
  },
  {
    categoryId: 'jewelry',
    categoryName: 'Jewelry & Accessories',
    attributes: [
      {
        key: 'metal',
        label: 'Metal Type',
        type: 'select',
        required: true,
        sortOrder: 1,
        description: 'Type of metal used',
        options: [
          { value: 'gold', label: 'Gold', sortOrder: 1 },
          { value: 'silver', label: 'Silver', sortOrder: 2 },
          { value: 'platinum', label: 'Platinum', sortOrder: 3 },
          { value: 'rose-gold', label: 'Rose Gold', sortOrder: 4 },
          { value: 'white-gold', label: 'White Gold', sortOrder: 5 },
          { value: 'stainless-steel', label: 'Stainless Steel', sortOrder: 6 },
          { value: 'titanium', label: 'Titanium', sortOrder: 7 },
        ],
      },
      {
        key: 'size',
        label: 'Size',
        type: 'size',
        required: true,
        sortOrder: 2,
        description: 'Ring size, chain length, etc.',
        options: [
          { value: 'xs', label: 'XS', sortOrder: 1 },
          { value: 's', label: 'S', sortOrder: 2 },
          { value: 'm', label: 'M', sortOrder: 3 },
          { value: 'l', label: 'L', sortOrder: 4 },
          { value: 'xl', label: 'XL', sortOrder: 5 },
          { value: '16-inch', label: '16 inch', sortOrder: 6 },
          { value: '18-inch', label: '18 inch', sortOrder: 7 },
          { value: '20-inch', label: '20 inch', sortOrder: 8 },
          { value: '22-inch', label: '22 inch', sortOrder: 9 },
          { value: '24-inch', label: '24 inch', sortOrder: 10 },
        ],
      },
      {
        key: 'gemstone',
        label: 'Gemstone',
        type: 'select',
        required: false,
        sortOrder: 3,
        description: 'Type of gemstone',
        options: [
          { value: 'diamond', label: 'Diamond', sortOrder: 1 },
          { value: 'ruby', label: 'Ruby', sortOrder: 2 },
          { value: 'sapphire', label: 'Sapphire', sortOrder: 3 },
          { value: 'emerald', label: 'Emerald', sortOrder: 4 },
          { value: 'pearl', label: 'Pearl', sortOrder: 5 },
          { value: 'amethyst', label: 'Amethyst', sortOrder: 6 },
          { value: 'topaz', label: 'Topaz', sortOrder: 7 },
          { value: 'none', label: 'No Gemstone', sortOrder: 8 },
        ],
      },
    ],
  },
  {
    categoryId: 'home-garden',
    categoryName: 'Home & Garden',
    attributes: [
      {
        key: 'dimensions',
        label: 'Dimensions',
        type: 'text',
        required: false,
        sortOrder: 1,
        description: 'Product dimensions (L x W x H)',
        options: [],
      },
      {
        key: 'material',
        label: 'Material',
        type: 'select',
        required: false,
        sortOrder: 2,
        description: 'Primary material',
        options: [
          { value: 'wood', label: 'Wood', sortOrder: 1 },
          { value: 'metal', label: 'Metal', sortOrder: 2 },
          { value: 'plastic', label: 'Plastic', sortOrder: 3 },
          { value: 'glass', label: 'Glass', sortOrder: 4 },
          { value: 'ceramic', label: 'Ceramic', sortOrder: 5 },
          { value: 'fabric', label: 'Fabric', sortOrder: 6 },
          { value: 'leather', label: 'Leather', sortOrder: 7 },
        ],
      },
      {
        key: 'color',
        label: 'Color',
        type: 'color',
        required: false,
        sortOrder: 3,
        description: 'Product color',
        options: [
          { value: 'white', label: 'White', color: '#FFFFFF', sortOrder: 1 },
          { value: 'black', label: 'Black', color: '#000000', sortOrder: 2 },
          { value: 'brown', label: 'Brown', color: '#A52A2A', sortOrder: 3 },
          { value: 'gray', label: 'Gray', color: '#808080', sortOrder: 4 },
          { value: 'beige', label: 'Beige', color: '#F5F5DC', sortOrder: 5 },
          { value: 'blue', label: 'Blue', color: '#0000FF', sortOrder: 6 },
          { value: 'green', label: 'Green', color: '#008000', sortOrder: 7 },
        ],
      },
      {
        key: 'finish',
        label: 'Finish',
        type: 'select',
        required: false,
        sortOrder: 4,
        description: 'Surface finish',
        options: [
          { value: 'matte', label: 'Matte' },
          { value: 'glossy', label: 'Glossy' },
          { value: 'satin', label: 'Satin' },
          { value: 'brushed', label: 'Brushed' },
          { value: 'textured', label: 'Textured' },
        ],
      },
    ],
  },
]

// General attributes that can be used across all categories
// Only keep true variant axes here (used to create sub-SKUs)
export const GENERAL_ATTRIBUTES: AttributeConfig[] = [
  {
    key: 'color',
    label: 'Color',
    type: 'color',
    required: false,
    sortOrder: 1,
    description: 'Product color',
    options: [
      { value: 'black', label: 'Black', color: '#000000', sortOrder: 1 },
      { value: 'white', label: 'White', color: '#FFFFFF', sortOrder: 2 },
      { value: 'red', label: 'Red', color: '#FF0000', sortOrder: 3 },
      { value: 'blue', label: 'Blue', color: '#0000FF', sortOrder: 4 },
      { value: 'green', label: 'Green', color: '#008000', sortOrder: 5 },
      { value: 'yellow', label: 'Yellow', color: '#FFFF00', sortOrder: 6 },
      { value: 'pink', label: 'Pink', color: '#FFC0CB', sortOrder: 7 },
      { value: 'purple', label: 'Purple', color: '#800080', sortOrder: 8 },
      { value: 'orange', label: 'Orange', color: '#FFA500', sortOrder: 9 },
      { value: 'gray', label: 'Gray', color: '#808080', sortOrder: 10 },
      { value: 'brown', label: 'Brown', color: '#A52A2A', sortOrder: 11 },
      { value: 'navy', label: 'Navy', color: '#000080', sortOrder: 12 },
      { value: 'beige', label: 'Beige', color: '#F5F5DC', sortOrder: 13 },
      { value: 'maroon', label: 'Maroon', color: '#800000', sortOrder: 14 },
      { value: 'teal', label: 'Teal', color: '#008080', sortOrder: 15 },
    ],
  },
  {
    key: 'size',
    label: 'Size',
    type: 'select',
    required: false,
    sortOrder: 2,
    description: 'Product size',
    options: [
      { value: 'xs', label: 'XS', sortOrder: 1 },
      { value: 's', label: 'S', sortOrder: 2 },
      { value: 'm', label: 'M', sortOrder: 3 },
      { value: 'l', label: 'L', sortOrder: 4 },
      { value: 'xl', label: 'XL', sortOrder: 5 },
      { value: 'xxl', label: 'XXL', sortOrder: 6 },
      { value: 'xxxl', label: 'XXXL', sortOrder: 7 },
      { value: '4xs', label: '4XS', sortOrder: 8 },
      { value: '5xl', label: '5XL', sortOrder: 9 },
    ],
  },
  {
    key: 'material',
    label: 'Material',
    type: 'select',
    required: false,
    sortOrder: 3,
    description: 'Product material',
    options: [
      { value: 'cotton', label: '100% Cotton', sortOrder: 1 },
      { value: 'polyester', label: '100% Polyester', sortOrder: 2 },
      { value: 'cotton-polyester', label: 'Cotton-Polyester Blend', sortOrder: 3 },
      { value: 'wool', label: 'Wool', sortOrder: 4 },
      { value: 'silk', label: 'Silk', sortOrder: 5 },
      { value: 'linen', label: 'Linen', sortOrder: 6 },
      { value: 'denim', label: 'Denim', sortOrder: 7 },
      { value: 'leather', label: 'Leather', sortOrder: 8 },
      { value: 'synthetic', label: 'Synthetic', sortOrder: 9 },
      { value: 'wood', label: 'Wood', sortOrder: 10 },
      { value: 'metal', label: 'Metal', sortOrder: 11 },
      { value: 'plastic', label: 'Plastic', sortOrder: 12 },
      { value: 'glass', label: 'Glass', sortOrder: 13 },
      { value: 'ceramic', label: 'Ceramic', sortOrder: 14 },
      { value: 'fabric', label: 'Fabric', sortOrder: 15 },
    ],
  },
  {
    key: 'pattern',
    label: 'Pattern',
    type: 'select',
    required: false,
    sortOrder: 4,
    description: 'Print or pattern',
    options: [
      { value: 'solid', label: 'Solid' },
      { value: 'striped', label: 'Striped' },
      { value: 'floral', label: 'Floral' },
      { value: 'geometric', label: 'Geometric' },
      { value: 'polka-dot', label: 'Polka Dot' },
      { value: 'checkered', label: 'Checkered' },
    ],
  },
  {
    key: 'finish',
    label: 'Finish',
    type: 'select',
    required: false,
    sortOrder: 5,
    description: 'Surface finish',
    options: [
      { value: 'matte', label: 'Matte' },
      { value: 'glossy', label: 'Glossy' },
      { value: 'satin', label: 'Satin' },
      { value: 'brushed', label: 'Brushed' },
      { value: 'textured', label: 'Textured' },
    ],
  },
  {
    key: 'capacity',
    label: 'Capacity',
    type: 'select',
    required: false,
    sortOrder: 6,
    description: 'Storage capacity or volume',
    options: [
      { value: '32gb', label: '32GB' },
      { value: '64gb', label: '64GB' },
      { value: '128gb', label: '128GB' },
      { value: '256gb', label: '256GB' },
      { value: '512gb', label: '512GB' },
      { value: '1tb', label: '1TB' },
      { value: '2tb', label: '2TB' },
      { value: '500ml', label: '500 ml' },
      { value: '1l', label: '1 L' },
      { value: '2l', label: '2 L' },
    ],
  },
  {
    key: 'connectivity',
    label: 'Connectivity',
    type: 'select',
    required: false,
    sortOrder: 7,
    description: 'Connection options',
    options: [
      { value: 'wifi', label: 'WiFi' },
      { value: 'wifi-cellular', label: 'WiFi + Cellular' },
      { value: 'bluetooth', label: 'Bluetooth' },
      { value: 'usb-c', label: 'USB-C' },
      { value: 'lightning', label: 'Lightning' },
    ],
  },
  {
    key: 'width',
    label: 'Width',
    type: 'select',
    required: false,
    sortOrder: 8,
    description: 'Shoe width',
    options: [
      { value: 'narrow', label: 'Narrow (B)' },
      { value: 'medium', label: 'Medium (D)' },
      { value: 'wide', label: 'Wide (E)' },
      { value: 'extra-wide', label: 'Extra Wide (EE)' },
    ],
  },
  {
    key: 'metal',
    label: 'Metal',
    type: 'select',
    required: false,
    sortOrder: 9,
    description: 'Metal type',
    options: [
      { value: 'gold', label: 'Gold' },
      { value: 'silver', label: 'Silver' },
      { value: 'platinum', label: 'Platinum' },
      { value: 'rose-gold', label: 'Rose Gold' },
      { value: 'titanium', label: 'Titanium' },
      { value: 'stainless-steel', label: 'Stainless Steel' },
    ],
  },
]

// Suggested tags (metadata) for product discovery and filters
export const SUGGESTED_TAGS: string[] = [
  // Brands
  'nike',
  'adidas',
  'puma',
  'under armour',
  'apple',
  'samsung',
  'sony',
  'lg',
  'generic',
  'premium',
  // Styles
  'casual',
  'formal',
  'sporty',
  'vintage',
  'modern',
  'classic',
  'trendy',
  'minimalist',
  'bohemian',
  'streetwear',
  // Patterns
  'solid',
  'striped',
  'polka dot',
  'floral',
  'geometric',
  'abstract',
  'checkered',
  'paisley',
  'animal print',
  'tie dye',
  // Finish
  'matte',
  'glossy',
  'satin',
  'textured',
  'smooth',
  'brushed',
  'polished',
  'distressed',
  // Capacity / Volume
  '32gb',
  '64gb',
  '128gb',
  '256gb',
  '512gb',
  '1tb',
  '2tb',
  '500ml',
  '1l',
  '2l',
  // Weight descriptors
  'light',
  'medium',
  'heavy',
  'ultra light',
  'extra heavy',
  // Age group
  'infant',
  'toddler',
  'kids',
  'teen',
  'adult',
  'senior',
  'all ages',
  // Gender
  'men',
  'women',
  'unisex',
  'boys',
  'girls',
  // Season
  'spring',
  'summer',
  'fall',
  'winter',
  'all season',
  // Occasion
  'work',
  'party',
  'wedding',
  'sports',
  'travel',
  'home',
  'outdoor',
  // Care instructions
  'machine wash',
  'hand wash',
  'dry clean',
  'spot clean',
  'no wash',
  // Warranty
  'no warranty',
  '30 days',
  '90 days',
  '1 year',
  '2 years',
  '3 years',
  'lifetime',
]

// Helper functions
export const getCategoryAttributes = (categoryId: string): AttributeConfig[] => {
  const categorySet = CATEGORY_ATTRIBUTE_SETS.find((set) => set.categoryId === categoryId)
  return categorySet ? categorySet.attributes : GENERAL_ATTRIBUTES
}

// Get suggested attributes for a category (with ability to add custom)
export const getSuggestedAttributes = (
  categoryId: string,
): {
  suggested: AttributeConfig[]
  canAddCustom: boolean
  customAttributeTypes: string[]
} => {
  const categorySet = CATEGORY_ATTRIBUTE_SETS.find((set) => set.categoryId === categoryId)

  if (categorySet) {
    return {
      suggested: categorySet.attributes,
      canAddCustom: true,
      customAttributeTypes: ['color', 'size', 'material', 'text', 'select'],
    }
  }

  return {
    suggested: GENERAL_ATTRIBUTES,
    canAddCustom: true,
    customAttributeTypes: ['color', 'size', 'material', 'text', 'select'],
  }
}

export const getCategoryAttributeSet = (categoryId: string): CategoryAttributeSet | null => {
  return CATEGORY_ATTRIBUTE_SETS.find((set) => set.categoryId === categoryId) || null
}

export const getAllCategorySets = (): CategoryAttributeSet[] => {
  return CATEGORY_ATTRIBUTE_SETS
}

export const getAttributeConfig = (
  categoryId: string,
  attributeKey: string,
): AttributeConfig | null => {
  const attributes = getCategoryAttributes(categoryId)
  return attributes.find((attr) => attr.key === attributeKey) || null
}

export const getAttributeOptions = (
  categoryId: string,
  attributeKey: string,
): AttributeOption[] => {
  const config = getAttributeConfig(categoryId, attributeKey)
  return config ? config.options : []
}

export const formatVariantName = (attributes: Record<string, string>): string => {
  return Object.entries(attributes)
    .map(([key, value]) => {
      const config = GENERAL_ATTRIBUTES.find((attr) => attr.key === key)
      if (config) {
        const option = config.options.find((opt) => opt.value === value)
        return option?.label || value
      }
      return value
    })
    .join(' / ')
}

export const generateVariantCombinations = (selectedAttributes: string[]): string[][] => {
  if (selectedAttributes.length === 0) return []

  const attributeOptions = selectedAttributes.map((attr) => getAttributeOptions('general', attr))
  const combinations: string[][] = []

  const generateCombinations = (current: string[], remaining: AttributeOption[][]) => {
    if (remaining.length === 0) {
      combinations.push([...current])
      return
    }

    const [first, ...rest] = remaining
    for (const option of first) {
      generateCombinations([...current, option.value], rest)
    }
  }

  generateCombinations([], attributeOptions)
  return combinations
}
