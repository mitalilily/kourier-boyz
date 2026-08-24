// Predefined attribute options for professional e-commerce
export interface AttributeOption {
  value: string
  label: string
  color?: string // For color attributes
  image?: string // For material/pattern attributes
  description?: string
}

export interface AttributeConfig {
  key: string
  label: string
  type: 'color' | 'size' | 'material' | 'text' | 'select'
  required: boolean
  options: AttributeOption[]
  description?: string
  sortOrder: number
}

// Predefined attribute configurations
export const PREDEFINED_ATTRIBUTES: AttributeConfig[] = [
  {
    key: 'color',
    label: 'Color',
    type: 'color',
    required: true,
    sortOrder: 1,
    description: 'Product color options',
    options: [
      { value: 'black', label: 'Black', color: '#000000' },
      { value: 'white', label: 'White', color: '#FFFFFF' },
      { value: 'red', label: 'Red', color: '#FF0000' },
      { value: 'blue', label: 'Blue', color: '#0000FF' },
      { value: 'green', label: 'Green', color: '#008000' },
      { value: 'yellow', label: 'Yellow', color: '#FFFF00' },
      { value: 'orange', label: 'Orange', color: '#FFA500' },
      { value: 'purple', label: 'Purple', color: '#800080' },
      { value: 'pink', label: 'Pink', color: '#FFC0CB' },
      { value: 'brown', label: 'Brown', color: '#A52A2A' },
      { value: 'gray', label: 'Gray', color: '#808080' },
      { value: 'navy', label: 'Navy', color: '#000080' },
      { value: 'maroon', label: 'Maroon', color: '#800000' },
      { value: 'teal', label: 'Teal', color: '#008080' },
      { value: 'olive', label: 'Olive', color: '#808000' },
      { value: 'lime', label: 'Lime', color: '#00FF00' },
      { value: 'aqua', label: 'Aqua', color: '#00FFFF' },
      { value: 'silver', label: 'Silver', color: '#C0C0C0' },
      { value: 'gold', label: 'Gold', color: '#FFD700' },
      { value: 'beige', label: 'Beige', color: '#F5F5DC' },
    ],
  },
  {
    key: 'size',
    label: 'Size',
    type: 'size',
    required: true,
    sortOrder: 2,
    description: 'Product size options',
    options: [
      // Clothing sizes
      { value: 'xs', label: 'XS (Extra Small)' },
      { value: 's', label: 'S (Small)' },
      { value: 'm', label: 'M (Medium)' },
      { value: 'l', label: 'L (Large)' },
      { value: 'xl', label: 'XL (Extra Large)' },
      { value: 'xxl', label: 'XXL (2X Large)' },
      { value: 'xxxl', label: 'XXXL (3X Large)' },
      // Numeric sizes
      { value: '28', label: '28' },
      { value: '29', label: '29' },
      { value: '30', label: '30' },
      { value: '31', label: '31' },
      { value: '32', label: '32' },
      { value: '33', label: '33' },
      { value: '34', label: '34' },
      { value: '35', label: '35' },
      { value: '36', label: '36' },
      { value: '37', label: '37' },
      { value: '38', label: '38' },
      { value: '39', label: '39' },
      { value: '40', label: '40' },
      { value: '41', label: '41' },
      { value: '42', label: '42' },
      { value: '43', label: '43' },
      { value: '44', label: '44' },
      { value: '45', label: '45' },
      { value: '46', label: '46' },
      // Shoe sizes
      { value: '6', label: '6' },
      { value: '6.5', label: '6.5' },
      { value: '7', label: '7' },
      { value: '7.5', label: '7.5' },
      { value: '8', label: '8' },
      { value: '8.5', label: '8.5' },
      { value: '9', label: '9' },
      { value: '9.5', label: '9.5' },
      { value: '10', label: '10' },
      { value: '10.5', label: '10.5' },
      { value: '11', label: '11' },
      { value: '11.5', label: '11.5' },
      { value: '12', label: '12' },
    ],
  },
  {
    key: 'material',
    label: 'Material',
    type: 'material',
    required: false,
    sortOrder: 3,
    description: 'Product material options',
    options: [
      { value: 'cotton', label: '100% Cotton', description: 'Soft, breathable cotton' },
      { value: 'polyester', label: 'Polyester', description: 'Durable, wrinkle-resistant' },
      { value: 'wool', label: 'Wool', description: 'Warm, natural fiber' },
      { value: 'silk', label: 'Silk', description: 'Luxurious, smooth texture' },
      { value: 'leather', label: 'Leather', description: 'Premium leather material' },
      { value: 'denim', label: 'Denim', description: 'Classic denim fabric' },
      { value: 'linen', label: 'Linen', description: 'Lightweight, natural fiber' },
      { value: 'cashmere', label: 'Cashmere', description: 'Soft, luxurious wool' },
      { value: 'bamboo', label: 'Bamboo', description: 'Eco-friendly, soft material' },
      { value: 'spandex', label: 'Spandex', description: 'Stretchy, form-fitting' },
      { value: 'nylon', label: 'Nylon', description: 'Strong, lightweight synthetic' },
      { value: 'acrylic', label: 'Acrylic', description: 'Soft, warm synthetic fiber' },
      { value: 'viscose', label: 'Viscose', description: 'Silky, drapes well' },
      { value: 'canvas', label: 'Canvas', description: 'Heavy-duty, durable fabric' },
      { value: 'suede', label: 'Suede', description: 'Soft, napped leather' },
    ],
  },
  {
    key: 'style',
    label: 'Style',
    type: 'select',
    required: false,
    sortOrder: 4,
    description: 'Product style options',
    options: [
      { value: 'classic', label: 'Classic', description: 'Timeless, traditional style' },
      { value: 'modern', label: 'Modern', description: 'Contemporary, trendy design' },
      { value: 'vintage', label: 'Vintage', description: 'Retro, nostalgic style' },
      { value: 'casual', label: 'Casual', description: 'Relaxed, everyday wear' },
      { value: 'formal', label: 'Formal', description: 'Elegant, dressy style' },
      { value: 'sporty', label: 'Sporty', description: 'Athletic, active wear' },
      { value: 'bohemian', label: 'Bohemian', description: 'Free-spirited, artistic' },
      { value: 'minimalist', label: 'Minimalist', description: 'Simple, clean design' },
      { value: 'edgy', label: 'Edgy', description: 'Bold, unconventional style' },
      { value: 'romantic', label: 'Romantic', description: 'Feminine, delicate style' },
    ],
  },
  {
    key: 'pattern',
    label: 'Pattern',
    type: 'select',
    required: false,
    sortOrder: 5,
    description: 'Product pattern options',
    options: [
      { value: 'solid', label: 'Solid', description: 'Single color, no pattern' },
      { value: 'striped', label: 'Striped', description: 'Horizontal or vertical lines' },
      { value: 'polka-dot', label: 'Polka Dot', description: 'Small circular dots' },
      { value: 'floral', label: 'Floral', description: 'Flower patterns' },
      { value: 'geometric', label: 'Geometric', description: 'Geometric shapes and lines' },
      { value: 'plaid', label: 'Plaid', description: 'Checked pattern' },
      { value: 'paisley', label: 'Paisley', description: 'Teardrop-shaped pattern' },
      { value: 'animal-print', label: 'Animal Print', description: 'Leopard, zebra, etc.' },
      { value: 'abstract', label: 'Abstract', description: 'Non-representational design' },
      { value: 'tie-dye', label: 'Tie Dye', description: 'Colorful, swirled pattern' },
    ],
  },
  {
    key: 'fit',
    label: 'Fit',
    type: 'select',
    required: false,
    sortOrder: 6,
    description: 'Product fit options',
    options: [
      { value: 'slim', label: 'Slim Fit', description: 'Tight, form-fitting' },
      { value: 'regular', label: 'Regular Fit', description: 'Standard, comfortable fit' },
      { value: 'loose', label: 'Loose Fit', description: 'Relaxed, roomy fit' },
      { value: 'oversized', label: 'Oversized', description: 'Extra large, baggy fit' },
      { value: 'athletic', label: 'Athletic Fit', description: 'Muscular, tapered fit' },
      { value: 'relaxed', label: 'Relaxed Fit', description: 'Comfortable, easy fit' },
      { value: 'tailored', label: 'Tailored', description: 'Precisely fitted' },
    ],
  },
  {
    key: 'length',
    label: 'Length',
    type: 'select',
    required: false,
    sortOrder: 7,
    description: 'Product length options',
    options: [
      { value: 'short', label: 'Short', description: 'Above knee length' },
      { value: 'midi', label: 'Midi', description: 'Mid-calf length' },
      { value: 'long', label: 'Long', description: 'Full length' },
      { value: 'cropped', label: 'Cropped', description: 'Shortened length' },
      { value: 'ankle', label: 'Ankle Length', description: 'Just above ankle' },
      { value: 'floor', label: 'Floor Length', description: 'Touching the floor' },
    ],
  },
]

// Helper functions
export const getAttributeConfig = (key: string): AttributeConfig | undefined => {
  return PREDEFINED_ATTRIBUTES.find((attr) => attr.key === key)
}

export const getAttributeOptions = (key: string): AttributeOption[] => {
  const config = getAttributeConfig(key)
  return config?.options || []
}

export const getAttributeLabel = (key: string): string => {
  const config = getAttributeConfig(key)
  return config?.label || key.charAt(0).toUpperCase() + key.slice(1)
}

export const getAttributeType = (key: string): string => {
  const config = getAttributeConfig(key)
  return config?.type || 'text'
}

// Generate variant combinations
export const generateVariantCombinations = (selectedAttributes: string[]): string[][] => {
  if (selectedAttributes.length === 0) return []

  const attributeOptions = selectedAttributes.map((attr) => getAttributeOptions(attr))
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

// Format variant name from attributes
export const formatVariantName = (attributes: Record<string, string>): string => {
  return Object.entries(attributes)
    .map(([key, value]) => {
      const config = getAttributeConfig(key)
      if (config) {
        const option = config.options.find((opt) => opt.value === value)
        return option?.label || value
      }
      return value
    })
    .join(' / ')
}
