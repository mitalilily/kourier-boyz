/**
 * Attribute Normalization Utilities
 * 
 * Provides functions to normalize, validate, and sanitize product attribute names
 * across various product categories and industries.
 */

const ATTRIBUTE_NAME_MAP: Record<string, string> = {
  // ========== BASIC ATTRIBUTES ==========
  // Size variations
  size: 'Size',
  sizes: 'Size',
  'size type': 'Size',
  sizing: 'Size',

  // Color variations
  color: 'Color',
  colour: 'Color',
  colors: 'Color',
  colours: 'Color',
  'colour name': 'Color',
  'color name': 'Color',
  'color family': 'Color',
  shade: 'Color',
  shades: 'Color',
  hue: 'Color',

  // Material variations
  material: 'Material',
  materials: 'Material',
  fabric: 'Material',
  'fabric type': 'Material',
  'material type': 'Material',
  composition: 'Material',
  'fiber content': 'Material',
  'fabric composition': 'Material',

  // Weight variations
  weight: 'Weight',
  'weight type': 'Weight',
  'net weight': 'Weight',
  'gross weight': 'Weight',

  // Dimensions
  length: 'Length',
  width: 'Width',
  height: 'Height',
  depth: 'Depth',
  dimension: 'Dimensions',
  dimensions: 'Dimensions',
  'dress length': 'Length',
  'skirt length': 'Length',
  'pant length': 'Length',
  'sleeve length': 'Length',

  // ========== CLOTHING & FASHION ==========
  // Sleeve variations
  sleeve: 'Sleeve Length',
  sleeves: 'Sleeve Length',
  'sleeve type': 'Sleeve Length',
  'sleeve style': 'Sleeve Length',

  // Fit variations
  fit: 'Fit',
  'fit type': 'Fit',
  fitting: 'Fit',
  'fit style': 'Fit',
  'body type': 'Fit',

  // Style variations
  style: 'Style',
  'neck style': 'Neck Style',
  'neck type': 'Neck Style',
  neck: 'Neck Style',
  neckline: 'Neck Style',

  // Pattern variations
  pattern: 'Pattern',
  patterns: 'Pattern',
  'pattern type': 'Pattern',
  'print type': 'Pattern',
  design: 'Pattern',

  // Occasion & Season
  occasion: 'Occasion',
  occasions: 'Occasion',
  season: 'Season',
  seasons: 'Season',
  'wearing occasion': 'Occasion',

  // Gender & Age
  gender: 'Gender',
  'gender type': 'Gender',
  age: 'Age Group',
  'age group': 'Age Group',
  'age range': 'Age Group',
  'target age': 'Age Group',

  // Care variations
  care: 'Care Instructions',
  'care instructions': 'Care Instructions',
  washing: 'Care Instructions',
  'washing instructions': 'Care Instructions',
  'care label': 'Care Instructions',
  maintenance: 'Care Instructions',

  // ========== ELECTRONICS ==========
  // Screen & Display
  'screen size': 'Screen Size',
  'display size': 'Screen Size',
  'screen type': 'Display Type',
  'display type': 'Display Type',
  'display technology': 'Display Type',
  resolution: 'Resolution',
  'screen resolution': 'Resolution',
  'display resolution': 'Resolution',

  // Storage & Memory
  storage: 'Storage',
  'storage capacity': 'Storage',
  'internal storage': 'Storage',
  'hard drive': 'Storage',
  'ssd capacity': 'Storage',
  memory: 'Memory',
  ram: 'RAM',
  'ram size': 'RAM',
  'memory size': 'Memory',

  // Processor & Performance
  processor: 'Processor',
  cpu: 'Processor',
  'processor type': 'Processor',
  'cpu model': 'Processor',
  chipset: 'Processor',
  'processor speed': 'Processor Speed',

  // Battery & Power
  battery: 'Battery',
  'battery capacity': 'Battery',
  'battery life': 'Battery Life',
  'battery type': 'Battery',
  'power consumption': 'Power Consumption',
  'charging time': 'Charging Time',

  // Connectivity
  connectivity: 'Connectivity',
  'connectivity options': 'Connectivity',
  'wireless connectivity': 'Connectivity',
  'bluetooth version': 'Bluetooth',
  'wifi version': 'WiFi',
  'usb ports': 'USB Ports',
  'hdmi ports': 'HDMI Ports',

  // Operating System
  'operating system': 'Operating System',
  os: 'Operating System',
  'os version': 'Operating System',
  platform: 'Operating System',

  // Camera
  camera: 'Camera',
  'camera resolution': 'Camera',
  'rear camera': 'Rear Camera',
  'front camera': 'Front Camera',
  'camera megapixels': 'Camera',

  // ========== HOME & FURNITURE ==========
  // Furniture Attributes
  'furniture type': 'Furniture Type',
  'furniture style': 'Style',
  finish: 'Finish',
  'surface finish': 'Finish',
  'wood finish': 'Finish',
  'paint finish': 'Finish',
  'assembly required': 'Assembly',
  'number of pieces': 'Number of Pieces',
  'number of drawers': 'Number of Drawers',
  'shelf capacity': 'Shelf Capacity',

  // Room & Placement
  room: 'Room',
  'room type': 'Room',
  'suitable for': 'Room',
  placement: 'Placement',
  'room placement': 'Placement',

  // ========== FOOD & BEVERAGES ==========
  // Volume & Quantity
  volume: 'Volume',
  'net volume': 'Volume',
  'pack size': 'Pack Size',
  'package size': 'Pack Size',
  quantity: 'Quantity',
  'quantity per pack': 'Quantity',
  'number of servings': 'Servings',

  // Food Attributes
  flavor: 'Flavor',
  flavour: 'Flavor',
  flavors: 'Flavor',
  flavours: 'Flavor',
  taste: 'Flavor',
  'flavor type': 'Flavor',
  'expiry date': 'Expiry Date',
  'best before': 'Expiry Date',
  'shelf life': 'Shelf Life',
  'storage instructions': 'Storage Instructions',
  'dietary information': 'Dietary Information',
  'dietary requirements': 'Dietary Information',
  'allergen information': 'Allergen Information',
  ingredients: 'Ingredients',

  // Cuisine & Category
  cuisine: 'Cuisine',
  'cuisine type': 'Cuisine',
  'food category': 'Food Category',
  'beverage type': 'Beverage Type',
  'drink type': 'Beverage Type',

  // ========== BEAUTY & COSMETICS ==========
  // Beauty Attributes
  'skin type': 'Skin Type',
  'skin tone': 'Skin Tone',
  'shade name': 'Shade',
  'shade number': 'Shade',
  'finish type': 'Finish',
  coverage: 'Coverage',
  'coverage level': 'Coverage',
  formulation: 'Formulation',
  'formula type': 'Formulation',
  spf: 'SPF',
  'sun protection factor': 'SPF',
  'hair type': 'Hair Type',
  'hair texture': 'Hair Type',
  'nail size': 'Nail Size',
  'brush type': 'Brush Type',

  // ========== SPORTS & FITNESS ==========
  // Sports Attributes
  'activity type': 'Activity Type',
  'sport type': 'Activity Type',
  'fitness level': 'Fitness Level',
  'skill level': 'Skill Level',
  'difficulty level': 'Difficulty Level',
  players: 'Number of Players',
  'number of players': 'Number of Players',
  'team size': 'Team Size',
  'playing surface': 'Playing Surface',
  'equipment type': 'Equipment Type',

  // ========== AUTOMOTIVE ==========
  // Vehicle Attributes
  'engine type': 'Engine Type',
  'engine size': 'Engine Size',
  'fuel type': 'Fuel Type',
  transmission: 'Transmission',
  'transmission type': 'Transmission',
  'drive type': 'Drive Type',
  'vehicle type': 'Vehicle Type',
  'car type': 'Vehicle Type',
  year: 'Year',
  'model year': 'Year',
  'car make': 'Make',
  'car model': 'Model',

  // ========== BOOKS & MEDIA ==========
  // Media Attributes
  'book format': 'Format',
  format: 'Format',
  'media format': 'Format',
  'file format': 'Format',
  language: 'Language',
  'book language': 'Language',
  edition: 'Edition',
  'edition type': 'Edition',
  publisher: 'Publisher',
  author: 'Author',
  genre: 'Genre',
  'book genre': 'Genre',
  'media type': 'Media Type',
  'number of pages': 'Pages',
  'playback time': 'Duration',
  'running time': 'Duration',

  // ========== TOYS & GAMES ==========
  // Toy Attributes
  'toy type': 'Toy Type',
  'game type': 'Game Type',
  'educational value': 'Educational Value',
  'battery required': 'Battery Required',
  'batteries included': 'Batteries Included',
  'play time': 'Play Time',

  // ========== JEWELRY ==========
  // Jewelry Attributes
  'metal type': 'Metal Type',
  metal: 'Metal Type',
  karat: 'Karat',
  karatage: 'Karat',
  'stone type': 'Stone Type',
  gemstone: 'Stone Type',
  'stone shape': 'Stone Shape',
  'jewelry type': 'Jewelry Type',
  'chain length': 'Chain Length',
  'ring size': 'Ring Size',

  // ========== HEALTH & WELLNESS ==========
  // Health Attributes
  dosage: 'Dosage',
  'dosage form': 'Dosage Form',
  'medicine type': 'Medicine Type',
  'treatment type': 'Treatment Type',
  'health condition': 'Health Condition',
  'age suitability': 'Age Suitability',

  // ========== PET SUPPLIES ==========
  // Pet Attributes
  'pet type': 'Pet Type',
  'pet size': 'Pet Size',
  'animal type': 'Pet Type',
  breed: 'Breed',
  'pet breed': 'Breed',
  'life stage': 'Life Stage',
  'pet age': 'Life Stage',

  // ========== OFFICE & STATIONERY ==========
  // Office Attributes
  'paper size': 'Paper Size',
  'paper type': 'Paper Type',
  'ink type': 'Ink Type',
  'pen type': 'Pen Type',
  'binding type': 'Binding Type',
  'page count': 'Pages',

  // ========== GARDEN & OUTDOOR ==========
  // Garden Attributes
  'plant type': 'Plant Type',
  'plant height': 'Plant Height',
  'sunlight requirements': 'Sunlight Requirements',
  'watering frequency': 'Watering Frequency',
  'soil type': 'Soil Type',
  'hardiness zone': 'Hardiness Zone',
  'outdoor use': 'Outdoor Use',
  'weather resistance': 'Weather Resistance',

  // ========== GENERAL ==========
  // Brand & Type
  brand: 'Brand',
  'brand name': 'Brand',
  manufacturer: 'Brand',
  make: 'Brand',
  type: 'Type',
  category: 'Category',
  'product type': 'Type',
  'product category': 'Category',

  // Condition & Quality
  condition: 'Condition',
  'product condition': 'Condition',
  quality: 'Quality',
  'quality grade': 'Quality',
  certification: 'Certification',
  'certification type': 'Certification',

  // Warranty & Support
  warranty: 'Warranty',
  'warranty period': 'Warranty',
  'warranty type': 'Warranty',
  'warranty coverage': 'Warranty',

  // Packaging
  'packaging type': 'Packaging',
  packaging: 'Packaging',
  'package type': 'Packaging',

  // Origin & Certification
  'country of origin': 'Country of Origin',
  origin: 'Country of Origin',
  'made in': 'Country of Origin',
  organic: 'Certification',
  'certified organic': 'Certification',

  // Features & Specifications
  features: 'Features',
  'special features': 'Features',
  'key features': 'Features',
  specifications: 'Specifications',
  'tech specs': 'Specifications',

  // Compatibility
  compatibility: 'Compatibility',
  'compatible with': 'Compatibility',
  'system requirements': 'System Requirements',
  requirements: 'System Requirements',

  // Accessories & Components
  includes: 'Includes',
  "what's included": 'Includes',
  'package contents': 'Includes',
  'accessories included': 'Includes',
}

/**
 * Checks if an attribute name looks like valid product attribute or garbage data
 */
export const isValidAttributeName = (name: string): boolean => {
  if (!name || typeof name !== 'string') return false

  const trimmed = name.trim()
  if (trimmed.length < 2) return false
  if (trimmed.length > 100) return false // Too long to be meaningful

  // Check if it's mostly numbers or special characters (likely garbage)
  const alphanumericChars = trimmed.replace(/[^a-zA-Z0-9\s]/g, '').length
  const totalChars = trimmed.replace(/\s/g, '').length
  if (totalChars > 0 && alphanumericChars / totalChars < 0.5) {
    return false // Too many special characters
  }

  // Check if it's mostly numbers (likely garbage like "12345" or "SKU-123")
  const digitCount = trimmed.replace(/\D/g, '').length
  if (digitCount > trimmed.length * 0.7) {
    return false // Too many numbers
  }

  // Must have at least one letter (not just numbers/special chars)
  if (!/[a-zA-Z]/.test(trimmed)) {
    return false
  }

  // Check for common garbage patterns
  const lower = trimmed.toLowerCase()
  const garbagePatterns = [
    /^[0-9]+$/, // Only numbers
    /^(test|temp|tmp|abc|xyz|asdf|qwerty)/i, // Common test strings
    /^[a-z0-9]{32,}$/i, // Looks like a hash/ID (too long alphanumeric)
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i, // UUID
    /^[0-9a-f]{24}$/i, // MongoDB ObjectId
  ]

  if (garbagePatterns.some((pattern) => pattern.test(trimmed))) {
    return false
  }

  return true
}

/**
 * Capitalizes words in a string properly (title case)
 */
export const capitalizeWords = (str: string): string => {
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((word) => {
      if (word.length === 0) return word
      // Capitalize first letter, keep rest lowercase
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

/**
 * Normalizes an attribute name to a standard format
 * Maps common variations to standardized names
 */
export const normalizeAttributeName = (raw: string): string => {
  if (!raw || typeof raw !== 'string') return 'Specifications'

  const trimmed = raw.trim()
  if (!trimmed) return 'Specifications'

  // Validate first
  if (!isValidAttributeName(trimmed)) {
    return 'Specifications' // Default to Specifications for invalid names
  }

  const lower = trimmed.toLowerCase()

  // Check exact match in map first
  if (ATTRIBUTE_NAME_MAP[lower]) {
    return ATTRIBUTE_NAME_MAP[lower]
  }

  // Check partial matches for common attributes (ordered by specificity)
  // Electronics
  if (lower.includes('screen size') || lower.includes('display size')) return 'Screen Size'
  if (lower.includes('screen') || lower.includes('display')) return 'Display Type'
  if (lower.includes('storage') || lower.includes('hard drive') || lower.includes('ssd'))
    return 'Storage'
  if (lower.includes('ram') || (lower.includes('memory') && !lower.includes('card'))) return 'RAM'
  if (lower.includes('processor') || lower.includes('cpu') || lower.includes('chipset'))
    return 'Processor'
  if (lower.includes('battery')) return 'Battery'
  if (lower.includes('bluetooth')) return 'Bluetooth'
  if (lower.includes('wifi') || lower.includes('wi-fi')) return 'WiFi'
  if (lower.includes('operating system') || lower.includes('os version') || lower === 'os')
    return 'Operating System'
  if (lower.includes('camera') || lower.includes('megapixel')) return 'Camera'
  if (lower.includes('resolution')) return 'Resolution'

  // Clothing & Fashion
  if (lower.includes('sleeve')) return 'Sleeve Length'
  if (lower.includes('neck') || lower.includes('neckline')) return 'Neck Style'
  if (
    lower.includes('dress length') ||
    lower.includes('skirt length') ||
    lower.includes('pant length')
  )
    return 'Length'
  if (lower.includes('length') && !lower.includes('sleeve') && !lower.includes('chain'))
    return 'Length'
  if (lower.includes('fit') && !lower.includes('benefit') && !lower.includes('wifi')) return 'Fit'
  if (lower.includes('occasion') || lower.includes('wearing occasion')) return 'Occasion'
  if (lower.includes('season') && !lower.includes('all')) return 'Season'
  if (lower.includes('care') || lower.includes('washing') || lower.includes('maintenance'))
    return 'Care Instructions'

  // Materials & Composition
  if (
    lower.includes('material') ||
    lower.includes('fabric') ||
    lower.includes('fiber') ||
    lower.includes('composition')
  )
    return 'Material'
  if (lower.includes('metal') && !lower.includes('detector')) return 'Metal Type'
  if (lower.includes('stone') || lower.includes('gemstone')) return 'Stone Type'

  // Size & Dimensions
  if (
    (lower.includes('size') &&
      !lower.includes('screen') &&
      !lower.includes('display') &&
      !lower.includes('paper') &&
      !lower.includes('ring') &&
      !lower.includes('pack')) ||
    lower.includes('sizing')
  )
    return 'Size'
  if (lower.includes('dimension') || (lower.includes('width') && lower.includes('height')))
    return 'Dimensions'
  if (lower.includes('width')) return 'Width'
  if (lower.includes('height')) return 'Height'
  if (lower.includes('depth')) return 'Depth'
  if (lower.includes('weight') || lower.includes('net weight') || lower.includes('gross weight'))
    return 'Weight'

  // Color & Appearance
  if (
    lower.includes('color') ||
    lower.includes('colour') ||
    lower.includes('shade') ||
    lower.includes('hue')
  )
    return 'Color'
  if (
    lower.includes('pattern') ||
    lower.includes('print') ||
    (lower.includes('design') && !lower.includes('graphic'))
  )
    return 'Pattern'
  if (lower.includes('finish') || lower.includes('surface finish')) return 'Finish'
  if (lower.includes('style') && !lower.includes('neck') && !lower.includes('life')) return 'Style'

  // Food & Beverages
  if (lower.includes('flavor') || lower.includes('flavour') || lower.includes('taste'))
    return 'Flavor'
  if (lower.includes('volume') || lower.includes('net volume')) return 'Volume'
  if (lower.includes('pack size') || lower.includes('package size')) return 'Pack Size'
  if (lower.includes('servings') || lower.includes('serving')) return 'Servings'
  if (lower.includes('expiry') || lower.includes('best before') || lower.includes('shelf life'))
    return 'Expiry Date'
  if (lower.includes('ingredient')) return 'Ingredients'
  if (lower.includes('allergen')) return 'Allergen Information'
  if (lower.includes('dietary') || lower.includes('diet')) return 'Dietary Information'
  if (lower.includes('cuisine')) return 'Cuisine'
  if (lower.includes('beverage') || lower.includes('drink type')) return 'Beverage Type'

  // Beauty & Cosmetics
  if (lower.includes('skin type') || lower.includes('skin tone')) return 'Skin Type'
  if (lower.includes('coverage')) return 'Coverage'
  if (lower.includes('spf') || lower.includes('sun protection')) return 'SPF'
  if (lower.includes('hair type') || lower.includes('hair texture')) return 'Hair Type'

  // Sports & Fitness
  if (lower.includes('activity') || lower.includes('sport type')) return 'Activity Type'
  if (
    lower.includes('fitness level') ||
    lower.includes('skill level') ||
    lower.includes('difficulty')
  )
    return 'Fitness Level'
  if (
    lower.includes('number of players') ||
    lower.includes('players') ||
    lower.includes('team size')
  )
    return 'Number of Players'
  if (lower.includes('playing surface')) return 'Playing Surface'

  // Automotive
  if (lower.includes('engine')) return 'Engine Type'
  if (lower.includes('fuel type') || lower.includes('fuel')) return 'Fuel Type'
  if (lower.includes('transmission')) return 'Transmission'
  if (lower.includes('drive type')) return 'Drive Type'
  if (lower.includes('vehicle type') || lower.includes('car type')) return 'Vehicle Type'
  if (lower.includes('model year') || lower === 'year') return 'Year'
  if (lower.includes('car make') || lower.includes('make')) return 'Make'
  if (lower.includes('car model') || (lower === 'model' && !lower.includes('year'))) return 'Model'

  // Books & Media
  if (lower.includes('format') || lower.includes('media format') || lower.includes('file format'))
    return 'Format'
  if (lower.includes('language') || lower.includes('book language')) return 'Language'
  if (lower.includes('edition')) return 'Edition'
  if (lower.includes('publisher')) return 'Publisher'
  if (lower.includes('author')) return 'Author'
  if (lower.includes('genre') || lower.includes('book genre')) return 'Genre'
  if (lower.includes('number of pages') || lower.includes('pages')) return 'Pages'
  if (
    lower.includes('playback time') ||
    lower.includes('running time') ||
    lower.includes('duration')
  )
    return 'Duration'

  // Toys & Games
  if (lower.includes('toy type') || lower.includes('game type')) return 'Toy Type'
  if (lower.includes('educational value')) return 'Educational Value'
  if (lower.includes('battery required') || lower.includes('batteries included'))
    return 'Battery Required'

  // Jewelry
  if (lower.includes('karat') || lower.includes('karatage')) return 'Karat'
  if (lower.includes('chain length')) return 'Chain Length'
  if (lower.includes('ring size')) return 'Ring Size'

  // Health & Wellness
  if (lower.includes('dosage')) return 'Dosage'
  if (lower.includes('medicine type') || lower.includes('treatment type')) return 'Medicine Type'
  if (lower.includes('health condition')) return 'Health Condition'

  // Pet Supplies
  if (lower.includes('pet type') || lower.includes('animal type')) return 'Pet Type'
  if (lower.includes('pet size')) return 'Pet Size'
  if (lower.includes('breed') || lower.includes('pet breed')) return 'Breed'
  if (lower.includes('life stage') || lower.includes('pet age')) return 'Life Stage'

  // Office & Stationery
  if (lower.includes('paper size')) return 'Paper Size'
  if (lower.includes('paper type')) return 'Paper Type'
  if (lower.includes('ink type')) return 'Ink Type'
  if (lower.includes('pen type')) return 'Pen Type'
  if (lower.includes('binding type')) return 'Binding Type'

  // Garden & Outdoor
  if (lower.includes('plant type')) return 'Plant Type'
  if (lower.includes('plant height')) return 'Plant Height'
  if (lower.includes('sunlight') || lower.includes('sun requirements'))
    return 'Sunlight Requirements'
  if (lower.includes('watering')) return 'Watering Frequency'
  if (lower.includes('soil type')) return 'Soil Type'
  if (lower.includes('hardiness zone')) return 'Hardiness Zone'
  if (lower.includes('weather resistance') || lower.includes('outdoor use'))
    return 'Weather Resistance'

  // General
  if (lower.includes('brand') || lower.includes('manufacturer') || lower === 'make') return 'Brand'
  if (
    lower.includes('type') &&
    !lower.includes('vehicle') &&
    !lower.includes('medicine') &&
    !lower.includes('toy') &&
    !lower.includes('game') &&
    !lower.includes('pet') &&
    !lower.includes('furniture') &&
    !lower.includes('plant')
  )
    return 'Type'
  if (lower.includes('category') || lower.includes('product category')) return 'Category'
  if (lower.includes('gender')) return 'Gender'
  if (
    lower.includes('age group') ||
    lower.includes('age range') ||
    lower.includes('target age') ||
    lower === 'age'
  )
    return 'Age Group'
  if (lower.includes('condition') || lower.includes('product condition')) return 'Condition'
  if (lower.includes('quality') || lower.includes('quality grade')) return 'Quality'
  if (lower.includes('warranty')) return 'Warranty'
  if (lower.includes('packaging') || lower.includes('package type')) return 'Packaging'
  if (lower.includes('country of origin') || lower.includes('origin') || lower.includes('made in'))
    return 'Country of Origin'
  if (lower.includes('certification') || lower.includes('certified')) return 'Certification'
  if (
    lower.includes('features') ||
    lower.includes('special features') ||
    lower.includes('key features')
  )
    return 'Features'
  if (lower.includes('specifications') || lower.includes('specs') || lower.includes('tech specs'))
    return 'Specifications'
  if (lower.includes('compatibility') || lower.includes('compatible with')) return 'Compatibility'
  if (lower.includes('system requirements') || lower.includes('requirements'))
    return 'System Requirements'
  if (
    lower.includes('includes') ||
    lower.includes("what's included") ||
    lower.includes('package contents') ||
    lower.includes('accessories included')
  )
    return 'Includes'

  // For other valid names, return properly capitalized version
  return capitalizeWords(trimmed)
}

/**
 * Sanitizes an attribute name to be a valid JavaScript object key.
 * Ensures the name is non-empty, trimmed, normalized, and contains only safe characters.
 * Filters out garbage/invalid names and returns normalized, capitalized names.
 */
export const sanitizeAttributeName = (name: string): string => {
  if (!name || typeof name !== 'string') return 'Specifications'

  // First normalize the name (this also validates and maps common names)
  const normalized = normalizeAttributeName(name)

  // If normalization returned default, the name was invalid
  if (normalized === 'Specifications' && isValidAttributeName(name)) {
    // If it's actually valid but wasn't in our map, use capitalized version
    return capitalizeWords(name.trim())
  }

  // Trim and normalize whitespace
  let sanitized = normalized.trim().replace(/\s+/g, ' ')

  // Remove null/control characters and other problematic characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '')

  // Ensure it's not empty after all sanitization
  if (!sanitized.trim() || !isValidAttributeName(sanitized)) {
    return 'Specifications'
  }

  return sanitized
}

