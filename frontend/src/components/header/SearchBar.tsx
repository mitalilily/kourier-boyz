import {
  deleteUserRecentSearch,
  fetchSearchSuggestions,
  useGuestRecentSearches,
  useUserRecentSearches,
  type SearchSuggestionsResponse,
} from '@/api/search'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useQueryClient } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

interface SearchBarProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  searchInputRef?: RefObject<HTMLInputElement>
  isLightBg: boolean
  isAuthenticated: boolean
  containerClassName?: string
  inputClassName?: string
}

export const SearchBar: React.FC<SearchBarProps> = ({
  searchQuery,
  onSearchChange,
  searchInputRef,
  isLightBg,
  isAuthenticated,
  containerClassName,
  inputClassName,
}) => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [suggestions, setSuggestions] = useState<SearchSuggestionsResponse | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number>(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<number | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const queryClient = useQueryClient()
  const userRecentQuery = useUserRecentSearches(isAuthenticated)
  const guestRecentQuery = useGuestRecentSearches(!isAuthenticated)
  const recentSearches = useMemo(
    () => (isAuthenticated ? userRecentQuery.data ?? [] : guestRecentQuery.data ?? []),
    [isAuthenticated, userRecentQuery.data, guestRecentQuery.data],
  )

  const highlight = (text?: string, query?: string) => {
    const base = ((text ?? '') as string).toString()
    const q = ((query ?? '') as string).toString().trim()
    if (!q) return base
    const lowerBase = base.toLowerCase()
    const lowerQ = q.toLowerCase()
    const idx = lowerBase.indexOf(lowerQ)
    if (idx === -1) return base
    const before = base.slice(0, idx)
    const match = base.slice(idx, idx + q.length)
    const after = base.slice(idx + q.length)
    return (
      <>
        {before}
        <mark className="bg-yellow-100 rounded px-0.5">{match}</mark>
        {after}
      </>
    )
  }

  const cancelSuggestionRequests = () => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }

  useEffect(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    // Always fetch suggestions to get trending when empty
    debounceRef.current = window.setTimeout(
      async () => {
        abortControllerRef.current?.abort()
        const controller = new AbortController()
        abortControllerRef.current = controller
        try {
          const resp = await fetchSearchSuggestions(searchQuery.trim(), controller.signal)
          setSuggestions(resp)
          if (searchInputRef?.current?.value?.trim()) {
            setShowDropdown(true)
            setActiveIndex(-1)
          }
        } catch (err) {
          const maybeError = err as { name?: string; code?: string } | undefined
          if (maybeError?.name === 'CanceledError' || maybeError?.code === 'ERR_CANCELED') return
          // ignore
        }
      },
      searchQuery.trim() ? 300 : 150,
    )
    return () => {
      cancelSuggestionRequests()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery])

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('click', onClickOutside)
    return () => document.removeEventListener('click', onClickOutside)
  }, [])

  // Hotkey to focus search (desktop)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (document.activeElement && (document.activeElement as HTMLElement).tagName === 'INPUT')
          return
        e.preventDefault()
        searchInputRef?.current?.focus()
        setShowDropdown(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const commitSearch = (q: string) => {
    const trimmed = q.trim()
    if (!trimmed) return
    cancelSuggestionRequests()
    if (!isAuthenticated) {
      try {
        const raw = localStorage.getItem('recent_searches')
        const arr = raw ? (JSON.parse(raw) as string[]) : []
        const next = [
          trimmed,
          ...arr.filter((x) => x.toLowerCase() !== trimmed.toLowerCase()),
        ].slice(0, 10)
        localStorage.setItem('recent_searches', JSON.stringify(next))
      } catch {
        // ignore
      }
      queryClient.invalidateQueries({ queryKey: ['recent-searches', 'guest'] })
    } else {
      // Server stores authenticated searches automatically; refresh cache so dropdown updates immediately
      queryClient.invalidateQueries({ queryKey: ['recent-searches', 'user'] })
    }
    navigate(`/products/search?q=${encodeURIComponent(trimmed)}`)
    setShowDropdown(false)
  }

  type DropdownItem = {
    type: 'product' | 'category' | 'recent' | 'trending'
    name?: string
    query: string
    image?: string
    category?: string
    id?: string
  }

  const suggestionItems = useMemo<DropdownItem[]>(() => {
    const items: DropdownItem[] = []
    const seen = new Set<string>()
    const addItem = (query: string) => {
      const key = query.trim().toLowerCase()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    }

    if (searchQuery.trim() && suggestions) {
      ;(suggestions.products || []).forEach((p) => {
        const name = p.name || ''
        if (!addItem(name)) return
        items.push({
          type: 'product',
          name: p.name,
          query: name,
          image: p.image,
          category: p.category,
          id: p.id,
        })
      })
      ;(suggestions.categories || []).forEach((c) => {
        const name = c.name || ''
        if (!addItem(name)) return
        items.push({
          type: 'category',
          name: c.name,
          query: name,
          image: c.image,
          id: c.id,
        })
      })
    }

    if (suggestions?.trending) {
      suggestions.trending.forEach((t) => {
        if (!addItem(t)) return
        items.push({
          type: 'trending',
          query: t,
        })
      })
    }

    return items
  }, [searchQuery, suggestions])

  const recentItems = useMemo<DropdownItem[]>(() => {
    const items: DropdownItem[] = []
    const seen = new Set<string>()
    for (const r of recentSearches) {
      const key = r.trim().toLowerCase()
      if (!key || seen.has(key)) continue
      seen.add(key)
      items.push({ type: 'recent', query: r })
      if (items.length >= 7) break
    }
    return items
  }, [recentSearches])

  const navigationItems = useMemo(
    () => [...recentItems, ...suggestionItems],
    [recentItems, suggestionItems],
  )

  const removeRecent = async (term: string) => {
    if (isAuthenticated) {
      try {
        await deleteUserRecentSearch(term)
        queryClient.invalidateQueries({ queryKey: ['recent-searches', 'user'] })
      } catch {
        // ignore
      }
      return
    }
    try {
      const raw = localStorage.getItem('recent_searches')
      const arr = raw ? (JSON.parse(raw) as string[]) : []
      const next = arr.filter((x) => x.toLowerCase() !== term.toLowerCase())
      localStorage.setItem('recent_searches', JSON.stringify(next))
    } catch {
      // ignore
    }
    queryClient.invalidateQueries({ queryKey: ['recent-searches', 'guest'] })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        commitSearch(searchQuery)
      }}
      className={`flex items-center ${containerClassName ?? ''}`}
    >
      <div className="relative w-full" ref={containerRef}>
        <Input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t('navigation.searchPlaceholder')}
          className={`${inputClassName ?? ''} rounded-2xl border pl-14 pr-24 shadow-sm transition-all duration-300 ${
            isLightBg
              ? 'border-white/12 bg-white/96 text-gray-900 placeholder:text-gray-500 focus:border-sky-300 focus:shadow-[0_14px_32px_rgba(15,23,42,0.16)]'
              : 'border-white/12 bg-white/94 text-gray-900 placeholder:text-gray-500 backdrop-blur-md focus:border-sky-300 focus:shadow-[0_14px_32px_rgba(15,23,42,0.16)]'
          }`}
          onFocus={() => {
            // Show dropdown on focus to show recent/trending
            setShowDropdown(true)
          }}
          onKeyDown={(e) => {
            if (!showDropdown) return
            const totalItems = navigationItems.length
            if (totalItems === 0) return
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActiveIndex((prev) => (((prev + 1) % totalItems) + totalItems) % totalItems)
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActiveIndex(
                (prev) => (((prev - 1 + totalItems) % totalItems) + totalItems) % totalItems,
              )
            } else if (e.key === 'Enter') {
              if (activeIndex >= 0 && activeIndex < totalItems) {
                e.preventDefault()
                const item = navigationItems[activeIndex]
                commitSearch(item.query)
              }
            }
          }}
        />
        <div className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center gap-2 text-slate-400">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100">
            <Search size={16} />
          </span>
        </div>
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          className={`absolute right-2 top-1/2 h-9 w-9 -translate-y-1/2 rounded-xl cursor-pointer transition-all duration-300 ${
            isLightBg
              ? 'bg-slate-900 text-white hover:bg-slate-800'
              : 'bg-slate-900 text-white hover:bg-slate-800'
          }`}
          aria-label={t('navigation.submitSearch')}
        >
          <Search size={16} />
        </Button>
        <div className="pointer-events-none absolute right-12 top-1/2 hidden -translate-y-1/2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-400 lg:block">
          /
        </div>
        {showDropdown && (
          <div className="absolute left-0 top-[calc(100%+0.6rem)] z-50 w-full rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
            <div className="max-h-[80vh] overflow-y-auto p-3">
              <div className="flex items-center justify-between px-2 py-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <Search className="h-3.5 w-3.5" />
                  {searchQuery.trim() ? 'Suggestions' : 'Search'}
                </div>
                {searchQuery.trim() && (
                  <button
                    className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      commitSearch(searchQuery.trim())
                    }}
                  >
                    Search "{searchQuery.trim()}"
                  </button>
                )}
              </div>
              {navigationItems.length === 0 ? (
                <div className="px-3 py-4 text-sm text-slate-500">
                  {recentSearches.length
                    ? 'Fetching trending searches...'
                    : 'Start typing to search for products or categories.'}
                </div>
              ) : (
                <>
                  {recentItems.length > 0 && (
                    <div className="px-1 pb-2">
                      <div className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Recent searches
                      </div>
                      <ul>
                        {recentItems.map((item, idx) => {
                          const isActive = activeIndex === idx
                          return (
                            <li
                              key={`recent-${item.query}-${idx}`}
                              className={`flex cursor-pointer items-center justify-between rounded-2xl px-3 py-3 text-sm ${
                                isActive ? 'bg-slate-100' : 'hover:bg-slate-50'
                              }`}
                              onMouseEnter={() => setActiveIndex(idx)}
                              onMouseDown={(e) => {
                                e.preventDefault()
                                commitSearch(item.query)
                              }}
                            >
                              <div className="flex items-center gap-2 flex-1">
                                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100">
                                  <Search className="h-4 w-4 text-slate-400" />
                                </span>
                                <span className="truncate text-slate-700">{item.query}</span>
                              </div>
                              <button
                                className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded hover:bg-slate-200 text-slate-500"
                                aria-label={`Remove ${item.query} from recent`}
                                onMouseDown={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  removeRecent(item.query)
                                }}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}

                  {suggestionItems.length > 0 && (
                    <div className="mt-1">
                      <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {searchQuery.trim() ? 'Suggestions' : 'Trending searches'}
                      </div>
                      <ul>
                        {suggestionItems.map((item, idx) => {
                          const globalIndex = recentItems.length + idx
                          const isTrending = item.type === 'trending'
                          return (
                            <li
                              key={`${item.type}-${item.id || item.query}-${idx}`}
                              className={`flex cursor-pointer items-center rounded-2xl px-3 py-3 text-sm ${
                                isTrending ? 'justify-between' : 'gap-3'
                              } ${
                                activeIndex === globalIndex ? 'bg-slate-100' : 'hover:bg-slate-50'
                              }`}
                              onMouseEnter={() => setActiveIndex(globalIndex)}
                              onMouseDown={(e) => {
                                e.preventDefault()
                                commitSearch(item.query)
                              }}
                            >
                              {item.type === 'product' || item.type === 'category' ? (
                                <>
                                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                                    {item.image ? (
                                      <img
                                        src={item.image}
                                        alt={item.name || 'Item'}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <div className="h-full w-full bg-slate-200" />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="font-medium text-slate-900 whitespace-normal wrap-break-word pr-1">
                                      {highlight(item.name ?? '', searchQuery)}
                                    </div>
                                    <div className="mt-0.5 text-xs text-slate-500">
                                      {item.type === 'product'
                                        ? item.category
                                          ? `in ${item.category}`
                                          : 'in products'
                                        : 'in categories'}
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="flex items-center gap-2 flex-1">
                                    {isTrending && (
                                      <span className="text-xs text-orange-500 font-semibold">
                                        🔥
                                      </span>
                                    )}
                                    <span className="truncate">{item.query}</span>
                                  </div>
                                </>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </form>
  )
}

export default SearchBar
