import { Search } from 'lucide-react'
import { Input } from '../ui/input'
import type { ThemeConfig } from '../../utils/themes'

interface SearchSectionProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  onSearchSubmit: (e: React.FormEvent) => void
  theme: ThemeConfig | null
}

export const SearchSection = ({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  theme,
}: SearchSectionProps) => {
  return (
    <div className="mb-8">
      <form onSubmit={onSearchSubmit} className="max-w-2xl mx-auto">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5"
            style={{ color: theme?.colors.textSecondary || '#9ca3af' }}
          />
          <Input
            type="text"
            placeholder="Search products in this store..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-4 py-3 w-full"
            style={{
              borderColor: theme?.colors.border || '#d1d5db',
              color: theme?.colors.text || '#111827',
            }}
          />
        </div>
      </form>
    </div>
  )
}

