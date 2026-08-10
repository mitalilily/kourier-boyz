import type { Category } from '../api/categories'

/**
 * Get full category hierarchy path (parent -> category)
 */
export const getCategoryPath = (category: Category | string | null | undefined): string => {
  if (!category) return ''

  if (typeof category === 'string') return category

  const parent = category.parent
  if (parent) {
    const parentName = typeof parent === 'string' ? '' : parent.name || ''
    return parentName ? `${parentName} > ${category.name}` : category.name
  }

  return category.name || ''
}

/**
 * Get category breadcrumb items for display
 */
export const getCategoryBreadcrumbs = (
  category: Category | string | null | undefined,
): Array<{ title: string; id?: string }> => {
  if (!category) return []

  if (typeof category === 'string') {
    return [{ title: category }]
  }

  const breadcrumbs: Array<{ title: string; id?: string }> = []

  // Add parent if exists
  if (category.parent) {
    const parent = typeof category.parent === 'string' ? null : category.parent
    if (parent) {
      breadcrumbs.push({
        title: parent.name,
        id: parent._id,
      })
    }
  }

  // Add current category
  breadcrumbs.push({
    title: category.name,
    id: category._id,
  })

  return breadcrumbs
}
