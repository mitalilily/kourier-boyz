export type FilterMetadataEntry = { id: string; key: string; values: string[] }

const generateMetadataId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `filter-${Date.now()}-${Math.random().toString(16).slice(2)}`

export const createFilterMetadataEntry = (
  overrides?: Partial<Omit<FilterMetadataEntry, 'id'>>,
): FilterMetadataEntry => ({
  id: generateMetadataId(),
  key: overrides?.key ?? '',
  values: overrides?.values ?? [],
})
