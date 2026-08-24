import {
  alpha,
  Box,
  CircularProgress,
  ClickAwayListener,
  Grow,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Popper,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { CiSearch } from 'react-icons/ci'
import { useNavigate } from 'react-router-dom'
import type { GlobalSearchResult } from '../../api/globalSearch.api'
import { useGlobalSearch } from '../../hooks/useGlobalSearch'
import { getClientAwbTrackingPath, isValidAwb, normalizeAwb } from '../../utils/awb'

const BRAND_PRIMARY = '#B78115'
const BRAND_INVOICE = '#555D61'
const BRAND_INK = '#17171A'
const BRAND_MUTED = '#626966'

interface GlobalSearchProps {
  compact?: boolean
}

const GlobalSearch = ({ compact = false }: GlobalSearchProps) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [popperReady, setPopperReady] = useState(false)

  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [animatePlaceholder, setAnimatePlaceholder] = useState(true)

  const anchorRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const placeholders = useMemo(
    () => [
      'Search orders...',
      'Track by AWB number...',
      'Find invoices instantly...',
      'Search NDR cases...',
      'Locate RTO shipments...',
      'Check weight discrepancies...',
    ],
    [],
  )

  const shouldSearch = open && searchQuery.trim().length >= 2

  const { data: searchResults, isLoading, isFetching } = useGlobalSearch(searchQuery, shouldSearch)

  useEffect(() => {
    if (open && anchorRef.current) {
      const timer = setTimeout(() => setPopperReady(true), 20)

      return () => {
        clearTimeout(timer)
        setPopperReady(false)
      }
    }

    setPopperReady(false)
  }, [open])

  useEffect(() => {
    if (searchQuery.trim()) return

    const interval = setInterval(() => {
      setAnimatePlaceholder(false)

      setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % placeholders.length)

        setAnimatePlaceholder(true)
      }, 400)
    }, 4000)

    return () => clearInterval(interval)
  }, [searchQuery, placeholders.length])

  const handleResultClick = (result: GlobalSearchResult) => {
    const awb = result.metadata?.awb

    if (typeof awb === 'string' && awb && result.type === 'order') {
      navigate(getClientAwbTrackingPath(awb))
    } else {
      navigate(result.link)
    }

    setSearchQuery('')
    setOpen(false)
  }

  const searchOrNavigate = () => {
    const trimmedQuery = searchQuery.trim()

    if (!trimmedQuery) return

    const normalizedQuery = normalizeAwb(trimmedQuery)
    if (isValidAwb(normalizedQuery)) {
      navigate(getClientAwbTrackingPath(normalizedQuery))
    } else if (searchResults?.results?.length) {
      handleResultClick(searchResults.results[0])
    } else {
      navigate(`/orders/list?search=${encodeURIComponent(trimmedQuery)}`)
    }

    setSearchQuery('')
    setOpen(false)
  }

  const handleKeyPress = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') searchOrNavigate()

    if (event.key === 'Escape') setOpen(false)
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      order: 'Order',
      invoice: 'Invoice',
      ndr: 'NDR',
      rto: 'RTO',
      weight_discrepancy: 'Weight Discrepancy',
    }

    return labels[type] || type
  }

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      order: BRAND_PRIMARY,
      invoice: BRAND_INVOICE,
      ndr: '#F59E0B',
      rto: '#D73A49',
      weight_discrepancy: BRAND_MUTED,
    }

    return colors[type] || BRAND_MUTED
  }

  return (
    <Box
      sx={{
        position: 'relative',
        width: compact
          ? {
              xs: 150,
              sm: 180,
              md: 230,
            }
          : {
              xs: 170,
              sm: 340,
              md: 430,
            },

        maxWidth: compact
          ? {
              xs: '48vw',
              md: 230,
            }
          : {
              xs: '50vw',
              sm: 'none',
            },
      }}
    >
      <div ref={anchorRef}>
        <TextField
          value={searchQuery}
          onChange={(event) => {
            const value = event.target.value

            setSearchQuery(value)

            if (value.trim().length >= 2 || open) {
              setOpen(true)
            }
          }}
          onKeyDown={handleKeyPress}
          onFocus={() => setOpen(true)}
          placeholder={placeholders[placeholderIndex]}
          size="small"
          fullWidth
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '14px',

              minHeight: compact
                ? {
                    xs: 38,
                    sm: 40,
                    md: 42,
                  }
                : {
                    xs: 44,
                    sm: 48,
                  },

              px: compact ? 1 : 1.2,
              pr: compact ? 0.8 : 1.1,

              bgcolor: '#FFFFFF',

              border: '1px solid rgba(23,23,26,0.08)',

              boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 6px 18px rgba(0,0,0,0.03)',

              transition: 'all 220ms cubic-bezier(0.4,0,0.2,1)',

              '& fieldset': {
                border: 'none',
              },

              '&:hover': {
                borderColor: 'rgba(23,23,26,0.16)',

                boxShadow: '0 2px 6px rgba(0,0,0,0.05), 0 10px 24px rgba(0,0,0,0.05)',

                transform: 'translateY(-1px)',
              },

              '&.Mui-focused': {
                borderColor: BRAND_PRIMARY,

                boxShadow: `
                    0 0 0 4px rgba(49, 2, 118,0.08),
                    0 10px 26px rgba(49, 2, 118,0.08)
                  `,

                transform: 'translateY(-1px)',
              },
            },

            '& .MuiOutlinedInput-input': {
              py: compact ? 1 : 1.15,

              px: 0,

              fontSize: compact
                ? {
                    xs: '0.8rem',
                    sm: '0.84rem',
                  }
                : {
                    xs: '0.92rem',
                    sm: '0.96rem',
                  },

              fontWeight: 500,
              letterSpacing: '0.01em',

              color: BRAND_INK,

              '&::placeholder': {
                color: '#8A8A94',

                opacity: animatePlaceholder ? 1 : 0,

                transform: animatePlaceholder ? 'translateY(0px)' : 'translateY(6px)',

                transition: 'all 220ms ease',
              },
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment
                position="start"
                sx={{
                  mr: 1,
                  ml: 0.2,
                }}
              >
                <Box
                  sx={{
                    width: 30,
                    height: 30,
                    borderRadius: '10px',
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: 'rgba(49, 2, 118,0.06)',
                  }}
                >
                  <CiSearch
                    size={17}
                    style={{
                      color: BRAND_PRIMARY,
                    }}
                  />
                </Box>
              </InputAdornment>
            ),

            endAdornment: (
              <InputAdornment position="end">
                {isLoading || isFetching ? (
                  <CircularProgress
                    size={16}
                    thickness={5}
                    sx={{
                      color: BRAND_PRIMARY,
                      mr: 0.4,
                    }}
                  />
                ) : !searchQuery ? (
                  <Box
                    sx={{
                      px: 0.8,
                      py: 0.35,
                      borderRadius: '8px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      color: '#626966',
                      bgcolor: '#F6F6F7',
                      border: '1px solid rgba(0,0,0,0.05)',
                    }}
                  >
                    ⏎
                  </Box>
                ) : null}
              </InputAdornment>
            ),
          }}
        />
      </div>

      {open && anchorRef.current && (
        <Popper
          open={open && popperReady}
          anchorEl={anchorRef.current}
          placement="bottom-start"
          transition
          style={{
            zIndex: 9999,
          }}
          modifiers={[
            {
              name: 'offset',
              options: {
                offset: [0, 10],
              },
            },
          ]}
        >
          {({ TransitionProps }) => (
            <Grow
              {...TransitionProps}
              in={popperReady}
              timeout={180}
              style={{
                transformOrigin: 'top left',
              }}
            >
              <Box>
                <ClickAwayListener onClickAway={() => setOpen(false)}>
                  <Paper
                    elevation={0}
                    sx={{
                      width: anchorRef.current?.offsetWidth ?? 430,

                      maxHeight: 420,

                      overflow: 'auto',

                      mt: 0.8,
                      p: 1,

                      borderRadius: '16px',

                      bgcolor: '#FFFFFF',

                      border: '1px solid rgba(0,0,0,0.06)',

                      boxShadow: '0 16px 40px rgba(0,0,0,0.08)',
                    }}
                  >
                    {searchQuery.trim().length < 2 ? (
                      <Box
                        sx={{
                          px: 1.2,
                          py: 1.4,
                        }}
                      >
                        <Typography
                          sx={{
                            fontSize: '0.92rem',
                            fontWeight: 700,
                            color: BRAND_INK,
                          }}
                        >
                          Start typing to search
                        </Typography>

                        <Typography
                          sx={{
                            fontSize: '0.8rem',
                            color: BRAND_MUTED,
                            mt: 0.4,
                          }}
                        >
                          Search by orders, invoice, AWB or shipment IDs.
                        </Typography>
                      </Box>
                    ) : searchResults?.results?.length ? (
                      <List disablePadding>
                        {searchResults.results.map((result) => (
                          <ListItem
                            key={`${result.type}-${result.link}`}
                            disablePadding
                            sx={{
                              mb: 0.5,
                            }}
                          >
                            <ListItemButton
                              onClick={() => handleResultClick(result)}
                              sx={{
                                borderRadius: '14px',

                                px: 1.2,
                                py: 1,

                                alignItems: 'flex-start',

                                transition: 'all 180ms ease',

                                '&:hover': {
                                  bgcolor: '#F8FAFC',

                                  transform: 'translateX(2px)',
                                },
                              }}
                            >
                              <ListItemText
                                primary={
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      gap: 1,
                                    }}
                                  >
                                    <Typography
                                      sx={{
                                        fontSize: '0.9rem',
                                        fontWeight: 700,
                                        color: BRAND_INK,
                                      }}
                                    >
                                      {result.title}
                                    </Typography>

                                    <Box
                                      sx={{
                                        px: 1,
                                        py: 0.35,
                                        borderRadius: 999,

                                        bgcolor: alpha(getTypeColor(result.type), 0.08),

                                        color: getTypeColor(result.type),

                                        fontSize: '0.66rem',

                                        fontWeight: 800,

                                        textTransform: 'uppercase',
                                      }}
                                    >
                                      {getTypeLabel(result.type)}
                                    </Box>
                                  </Box>
                                }
                                secondary={
                                  <Typography
                                    sx={{
                                      mt: 0.4,
                                      fontSize: '0.78rem',
                                      color: BRAND_MUTED,
                                    }}
                                  >
                                    {result.subtitle || result.link}
                                  </Typography>
                                }
                              />
                            </ListItemButton>
                          </ListItem>
                        ))}
                      </List>
                    ) : (
                      <Box
                        sx={{
                          px: 1.2,
                          py: 1.4,
                        }}
                      >
                        <Typography
                          sx={{
                            fontSize: '0.9rem',
                            fontWeight: 700,
                            color: BRAND_INK,
                          }}
                        >
                          No results found
                        </Typography>

                        <Typography
                          sx={{
                            mt: 0.4,
                            fontSize: '0.8rem',
                            color: BRAND_MUTED,
                          }}
                        >
                          Press Enter to search across orders.
                        </Typography>
                      </Box>
                    )}
                  </Paper>
                </ClickAwayListener>
              </Box>
            </Grow>
          )}
        </Popper>
      )}
    </Box>
  )
}

export default GlobalSearch
