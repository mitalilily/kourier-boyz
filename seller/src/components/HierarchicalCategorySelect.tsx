import { Select, type SelectProps } from 'antd'
import type { Category } from '../api/categories'

interface HierarchicalCategorySelectProps extends Omit<SelectProps, 'options'> {
  categories: Category[]
  showSubcategories?: boolean
}

const HierarchicalCategorySelect = ({
  categories,
  showSubcategories = true,
  ...props
}: HierarchicalCategorySelectProps) => {
  // Build hierarchical options
  const buildOptions = () => {
    const options: Array<{ label: string; value: string }> = []

    // Get root categories first (categories with no parent or parent not in list)
    const rootCategories = categories.filter((cat) => {
      if (!cat.parent) return true
      const parentId = typeof cat.parent === 'string' ? cat.parent : cat.parent._id || ''
      return !categories.find((c) => c._id === parentId)
    })

    rootCategories.forEach((rootCat) => {
      // Add root category
      options.push({
        label: rootCat.name,
        value: rootCat._id,
      })

      // Add subcategories if enabled
      if (showSubcategories) {
        const subcategories = categories.filter((cat) => {
          if (!cat.parent) return false
          const parentId = typeof cat.parent === 'string' ? cat.parent : cat.parent._id || ''
          return parentId === rootCat._id
        })

        subcategories.forEach((subcat) => {
          options.push({
            label: `  └─ ${subcat.name}`,
            value: subcat._id,
          })
        })
      }
    })

    return options
  }

  const options = buildOptions()

  return (
    <Select
      {...props}
      showSearch
      optionFilterProp="label"
      filterOption={(input, option) =>
        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
      }
      options={options.map((opt) => ({
        label: opt.label,
        value: opt.value,
      }))}
    />
  )
}

export default HierarchicalCategorySelect
