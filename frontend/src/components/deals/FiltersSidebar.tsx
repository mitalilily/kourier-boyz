import { ProductFiltersAttribute, ProductFiltersResponse } from '@/api/products'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { getColorHex } from '@/utils/color'
import { Search, Star } from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'

type Range = { min?: number; max?: number }

export type SelectedFilters = {
  categories: string[]
  brands: string[]
  sellers: string[]
  tags: string[]
  attributes: Record<string, string[]>
  rating?: number
  availability: string[]
  price?: Range
  discount?: Range
}

export interface FiltersSidebarProps {
  filters?: ProductFiltersResponse
  isLoading?: boolean
  selected?: Partial<SelectedFilters>
  onChange?: (filters: SelectedFilters) => void
  onReset?: () => void
  title?: string
  showSearch?: boolean
  priceSliderStep?: number
  priceCurrencySymbol?: string
  className?: string
  height?: string
}

const defaultSelectedFilters = (initial?: Partial<SelectedFilters>): SelectedFilters => ({
  categories: initial?.categories ?? [],
  brands: initial?.brands ?? [],
  sellers: initial?.sellers ?? [],
  tags: initial?.tags ?? [],
  attributes: initial?.attributes ?? {},
  rating: initial?.rating,
  availability: initial?.availability ?? [],
  price: initial?.price,
  discount: initial?.discount,
})

const formatCurrency = (value: number | null | undefined, symbol = '₹') => {
  if (value === undefined || value === null) return `${symbol}—`
  return `${symbol}${value.toLocaleString('en-IN')}`
}

const FiltersSidebar: React.FC<FiltersSidebarProps> = ({
  filters,
  isLoading,
  selected,
  onChange,
  onReset,
  title = 'Filters',
  priceSliderStep = 100,
  priceCurrencySymbol = '₹',
  className,
  height,
}) => {
  const selectedFilters = useMemo(() => defaultSelectedFilters(selected), [selected])

  const applyUpdate = (updater: (prev: SelectedFilters) => SelectedFilters) => {
    const next = updater(selectedFilters)
    onChange?.(next)
  }

  const toggleItem = (list: string[], value: string, enabled: boolean) => {
    if (enabled) {
      return list.includes(value) ? list : [...list, value]
    }
    return list.filter((item) => item !== value)
  }

  const toggleAttribute = (
    map: Record<string, string[]>,
    attribute: string,
    value: string,
    enabled: boolean,
  ) => {
    const current = map[attribute] ?? []
    const nextValues = toggleItem(current, value, enabled)
    const next = { ...map, [attribute]: nextValues }
    if (nextValues.length === 0) {
      delete next[attribute]
    }
    return next
  }

  const priceBounds = useMemo(() => {
    const metaMin = filters?.meta.price.min ?? 0
    const metaMax = filters?.meta.price.max ?? metaMin + priceSliderStep * 20
    const validMax = metaMax > metaMin ? metaMax : metaMin + priceSliderStep * 20
    return {
      min: metaMin,
      max: validMax,
    }
  }, [filters?.meta.price.min, filters?.meta.price.max, priceSliderStep])

  const discountBounds = useMemo(() => {
    const metaMin = filters?.meta.discount.min ?? 0
    const metaMax = filters?.meta.discount.max ?? 100
    const validMax = metaMax > metaMin ? metaMax : Math.min(metaMin + 10, 100)
    return {
      min: Math.max(0, metaMin),
      max: Math.min(100, validMax),
    }
  }, [filters?.meta.discount.min, filters?.meta.discount.max])

  const clampAndSortRange = (
    range: [number, number],
    bounds: { min: number; max: number },
  ): [number, number] => {
    const clampedMin = Math.min(Math.max(range[0], bounds.min), bounds.max)
    const clampedMax = Math.min(Math.max(range[1], bounds.min), bounds.max)
    return clampedMin <= clampedMax ? [clampedMin, clampedMax] : [clampedMax, clampedMin]
  }

  const [localPriceRange, setLocalPriceRange] = useState<[number, number]>(() =>
    clampAndSortRange(
      [
        selectedFilters.price?.min ?? priceBounds.min,
        selectedFilters.price?.max ?? priceBounds.max,
      ],
      priceBounds,
    ),
  )
  const [localDiscountRange, setLocalDiscountRange] = useState<[number, number]>(() =>
    clampAndSortRange(
      [
        selectedFilters.discount?.min ?? discountBounds.min,
        selectedFilters.discount?.max ?? discountBounds.max,
      ],
      discountBounds,
    ),
  )

  useEffect(() => {
    setLocalPriceRange(
      clampAndSortRange(
        [
          selectedFilters.price?.min ?? priceBounds.min,
          selectedFilters.price?.max ?? priceBounds.max,
        ],
        priceBounds,
      ),
    )
  }, [selectedFilters.price?.min, selectedFilters.price?.max, priceBounds])

  useEffect(() => {
    setLocalDiscountRange(
      clampAndSortRange(
        [
          selectedFilters.discount?.min ?? discountBounds.min,
          selectedFilters.discount?.max ?? discountBounds.max,
        ],
        discountBounds,
      ),
    )
  }, [selectedFilters.discount?.min, selectedFilters.discount?.max, discountBounds])

  const commitPriceRange = (range: [number, number]) => {
    const normalized = clampAndSortRange(range, priceBounds)
    setLocalPriceRange(normalized)
    applyUpdate((prev) => ({
      ...prev,
      price: { min: normalized[0], max: normalized[1] },
    }))
  }

  const commitDiscountRange = (range: [number, number]) => {
    const normalized = clampAndSortRange(range, discountBounds)
    setLocalDiscountRange(normalized)
    applyUpdate((prev) => ({
      ...prev,
      discount: { min: normalized[0], max: normalized[1] },
    }))
  }

  const handlePriceInputChange = (index: 0 | 1, value: string) => {
    const parsed = Number(value)
    setLocalPriceRange((prev) => {
      const next: [number, number] = [...prev] as [number, number]
      next[index] = Number.isFinite(parsed) ? parsed : prev[index]
      return next
    })
  }

  const handleDiscountInputChange = (index: 0 | 1, value: string) => {
    const parsed = Number(value)
    setLocalDiscountRange((prev) => {
      const next: [number, number] = [...prev] as [number, number]
      next[index] = Number.isFinite(parsed) ? parsed : prev[index]
      return next
    })
  }

  const renderEmpty = () => (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-sm text-slate-500">
      <Search className="h-8 w-8 text-slate-300" />
      <p>No filter data available yet.</p>
      <p className="text-xs text-slate-400">
        Filters will populate once the product feed finishes loading.
      </p>
    </div>
  )

  const renderSkeleton = () => (
    <div className="space-y-4">
      {[...Array(5)].map((_, index) => (
        <div key={index} className="space-y-2">
          <div className="h-4 w-30 animate-pulse rounded bg-slate-200" />
          <div className="space-y-2 pl-1">
            <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-16 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-12 animate-pulse rounded bg-slate-200" />
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <aside
      style={{ height }}
      className={cn(
        'sticky top-20 min-w-[300px] max-h-[80vh] rounded-2xl border border-slate-200 bg-white p-6 shadow-sm',
        'flex flex-col overflow-hidden',
        className,
      )}
    >
      <div className=" flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-slate-500 hover:text-slate-700"
          onClick={() => {
            onReset?.()
          }}
        >
          Reset
        </Button>
      </div>

      <ScrollArea className="mt-2 pr-2">
        {isLoading ? (
          <div className="space-y-6">
            <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
            {renderSkeleton()}
          </div>
        ) : !filters ? (
          renderEmpty()
        ) : (
          <Accordion
            type="multiple"
            defaultValue={[
              'categories',
              'brands',
              'sellers',
              'attributes',
              'rating',
              'availability',
              'price',
              'discount',
              'tags',
            ]}
          >
            {filters.categories.length > 0 && (
              <AccordionItem value="categories">
                <AccordionTrigger className="text-[15px] font-medium text-slate-800">
                  Categories
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {filters.categories.map((category) => (
                      <Label
                        key={category.id}
                        className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50"
                      >
                        <Checkbox
                          checked={selectedFilters.categories.includes(category.id)}
                          onCheckedChange={(checked) =>
                            applyUpdate((prev) => ({
                              ...prev,
                              categories: toggleItem(
                                prev.categories,
                                category.id,
                                Boolean(checked),
                              ),
                            }))
                          }
                        />
                        <span className="text-slate-700">{category.name}</span>
                      </Label>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {filters?.brands?.length ? (
              <AccordionItem value="brands">
                <AccordionTrigger className="text-[15px] font-medium text-slate-800">
                  Brands
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {filters.brands.map((brand) => (
                      <Label
                        key={brand.name}
                        className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50"
                      >
                        <Checkbox
                          checked={selectedFilters.brands.includes(brand.name)}
                          onCheckedChange={(checked) =>
                            applyUpdate((prev) => ({
                              ...prev,
                              brands: toggleItem(prev.brands, brand.name, Boolean(checked)),
                            }))
                          }
                        />
                        <span className="text-slate-700">{brand.name}</span>
                      </Label>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ) : null}

            {filters?.tags?.length ? (
              <AccordionItem value="tags">
                <AccordionTrigger className="text-[15px] font-medium text-slate-800">
                  Tags
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-wrap gap-2">
                    {filters.tags.map((tag) => {
                      const isSelected = selectedFilters.tags.includes(tag.value)
                      return (
                        <Badge
                          key={tag.value}
                          variant={isSelected ? 'default' : 'secondary'}
                          className="cursor-pointer"
                          onClick={() =>
                            applyUpdate((prev) => ({
                              ...prev,
                              tags: toggleItem(prev.tags, tag.value, !isSelected),
                            }))
                          }
                        >
                          {tag.value}
                        </Badge>
                      )
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ) : null}

            {filters?.sellers?.length ? (
              <AccordionItem value="sellers">
                <AccordionTrigger className="text-[15px] font-medium text-slate-800">
                  Sellers
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {filters.sellers.map((seller) => (
                      <Label
                        key={seller.id}
                        className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50"
                      >
                        <Checkbox
                          checked={selectedFilters.sellers.includes(seller.id)}
                          onCheckedChange={(checked) =>
                            applyUpdate((prev) => ({
                              ...prev,
                              sellers: toggleItem(prev.sellers, seller.id, Boolean(checked)),
                            }))
                          }
                        />
                        <span className="text-slate-700">{seller.name}</span>
                      </Label>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ) : null}

            {filters.attributes.length > 0 && (
              <AccordionItem value="attributes">
                <AccordionTrigger className="text-[15px] font-medium text-slate-800">
                  Attributes
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    {filters.attributes.map((attribute: ProductFiltersAttribute) => {
                      const isColorAttribute =
                        attribute.name.toLowerCase().includes('color') ||
                        attribute.values.some((value) => value.hex)
                      const attrValues = attribute.values
                      return (
                        <div key={attribute.name} className="space-y-2">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {attribute.name}
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {attrValues.map((value) => {
                              const isSelected =
                                selectedFilters.attributes[attribute.name]?.includes(value.value) ??
                                false
                              if (isColorAttribute) {
                                return (
                                  <button
                                    key={value.value}
                                    type="button"
                                    onClick={() =>
                                      applyUpdate((prev) => ({
                                        ...prev,
                                        attributes: toggleAttribute(
                                          prev.attributes,
                                          attribute.name,
                                          value.value,
                                          !isSelected,
                                        ),
                                      }))
                                    }
                                    className={`flex items-center gap-2 rounded-full border px-2 py-1 text-xs transition-all ${
                                      isSelected
                                        ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                                        : 'border-slate-200 bg-white text-slate-600'
                                    }`}
                                    title={value.value}
                                  >
                                    <span
                                      className={`h-4 w-4 rounded-full border ${
                                        isSelected ? 'border-indigo-500' : 'border-slate-200'
                                      }`}
                                      style={{
                                        backgroundColor:
                                          value.hex?.toLowerCase() || getColorHex(value.value),
                                      }}
                                    />
                                  </button>
                                )
                              }

                              return (
                                <Badge
                                  key={value.value}
                                  variant={isSelected ? 'default' : 'secondary'}
                                  className="cursor-pointer"
                                  onClick={() =>
                                    applyUpdate((prev) => ({
                                      ...prev,
                                      attributes: toggleAttribute(
                                        prev.attributes,
                                        attribute.name,
                                        value.value,
                                        !isSelected,
                                      ),
                                    }))
                                  }
                                >
                                  {value.value}
                                </Badge>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            <AccordionItem value="rating">
              <AccordionTrigger className="text-[15px] font-medium text-slate-800">
                Customer Reviews
              </AccordionTrigger>
              <AccordionContent>
                <RadioGroup
                  value={selectedFilters.rating ? String(selectedFilters.rating) : 'all'}
                  onValueChange={(value) =>
                    applyUpdate((prev) => ({
                      ...prev,
                      rating: value === 'all' ? undefined : Number(value),
                    }))
                  }
                  className="space-y-2"
                >
                  <Label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
                    <RadioGroupItem value="all" id="rating-all" />
                    <span className="text-slate-700">All ratings</span>
                  </Label>
                  {filters.ratingBuckets.map((bucket) => (
                    <Label
                      key={bucket.minRating}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50"
                    >
                      <RadioGroupItem
                        value={String(bucket.minRating)}
                        id={`rating-${bucket.minRating}`}
                      />
                      <span className="flex items-center gap-1 text-slate-700">
                        {[...Array(5)].map((_, index) => (
                          <Star
                            key={index}
                            className={cn(
                              'h-3 w-3',
                              index < bucket.minRating
                                ? 'fill-yellow text-yellow'
                                : 'text-slate-300',
                            )}
                          />
                        ))}
                        <span>{bucket.label}</span>
                      </span>
                    </Label>
                  ))}
                </RadioGroup>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="availability">
              <AccordionTrigger className="text-[15px] font-medium text-slate-800">
                Availability
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  <Label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
                    <Checkbox
                      checked={selectedFilters.availability.includes('include_out_of_stock')}
                      onCheckedChange={(checked) =>
                        applyUpdate((prev) => ({
                          ...prev,
                          availability: toggleItem(
                            prev.availability,
                            'include_out_of_stock',
                            Boolean(checked),
                          ),
                        }))
                      }
                    />
                    <span className="text-slate-700">Include out of stock</span>
                  </Label>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="price">
              <AccordionTrigger className="text-[15px] font-medium text-slate-800">
                Price Range
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                    <span>{formatCurrency(localPriceRange[0], priceCurrencySymbol)}</span>
                    <span>{formatCurrency(localPriceRange[1], priceCurrencySymbol)}</span>
                  </div>
                  <Slider
                    min={priceBounds.min}
                    max={priceBounds.max}
                    step={priceSliderStep}
                    value={localPriceRange}
                    onValueChange={(value) => setLocalPriceRange(value as [number, number])}
                    onValueCommit={(value) => commitPriceRange(value as [number, number])}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      value={localPriceRange[0]}
                      onChange={(event) => handlePriceInputChange(0, event.target.value)}
                      onBlur={() => commitPriceRange(localPriceRange)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          commitPriceRange(localPriceRange)
                        }
                      }}
                      placeholder="Min"
                      className="text-sm"
                    />
                    <Input
                      type="number"
                      value={localPriceRange[1]}
                      onChange={(event) => handlePriceInputChange(1, event.target.value)}
                      onBlur={() => commitPriceRange(localPriceRange)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          commitPriceRange(localPriceRange)
                        }
                      }}
                      placeholder="Max"
                      className="text-sm"
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="discount">
              <AccordionTrigger className="text-[15px] font-medium text-slate-800">
                Discount
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                    <span>{localDiscountRange[0]}%</span>
                    <span>{localDiscountRange[1]}%</span>
                  </div>
                  <Slider
                    min={discountBounds.min}
                    max={discountBounds.max}
                    step={1}
                    value={localDiscountRange}
                    onValueChange={(value) => setLocalDiscountRange(value as [number, number])}
                    onValueCommit={(value) => commitDiscountRange(value as [number, number])}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      value={localDiscountRange[0]}
                      onChange={(event) => handleDiscountInputChange(0, event.target.value)}
                      onBlur={() => commitDiscountRange(localDiscountRange)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          commitDiscountRange(localDiscountRange)
                        }
                      }}
                      placeholder="Min"
                      className="text-sm"
                    />
                    <Input
                      type="number"
                      value={localDiscountRange[1]}
                      onChange={(event) => handleDiscountInputChange(1, event.target.value)}
                      onBlur={() => commitDiscountRange(localDiscountRange)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          commitDiscountRange(localDiscountRange)
                        }
                      }}
                      placeholder="Max"
                      className="text-sm"
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </ScrollArea>
    </aside>
  )
}

export default FiltersSidebar
