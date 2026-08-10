import { Card, CardContent } from '@/components/ui/card'
import { motion } from 'framer-motion'
import { Heart, Loader2 } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { useToggleWishlist, useWishlistStatus } from '../../api/wishlist'
import { useAuthStore } from '../../store/authStore'
import type { ThemeConfig } from '../../utils/themes'

interface ThemedProductCardProps {
  id: string | number
  name: string
  price: number
  originalPrice?: number
  image: string
  rating?: number
  reviews?: number
  badge?: string
  discount?: number
  description?: string
  buttonText?: string
  onAddToCart?: (id: string | number) => void
  onAddToWishlist?: (id: string | number) => void
  onClick?: (id: string | number) => void
  theme: ThemeConfig
}

const ThemedProductCard: React.FC<ThemedProductCardProps> = ({
  id,
  name,
  price,
  originalPrice,
  image,
  badge,
  description,
  buttonText = 'Add To Cart',
  onAddToCart,
  onAddToWishlist,
  onClick,
  theme,
}) => {
  const { isAuthenticated } = useAuthStore()
  const { isInWishlist } = useWishlistStatus(String(id))
  const { toggleProduct, isLoading: isTogglingWishlist } = useToggleWishlist()
  const [isFavorite, setIsFavorite] = useState(false)

  useEffect(() => {
    setIsFavorite(isInWishlist)
  }, [isInWishlist])

  const handleCardClick = () => {
    onClick?.(id)
  }

  const handleWishlistClick = async (e: React.MouseEvent) => {
    e.stopPropagation()

    if (!isAuthenticated) {
      localStorage.setItem('pendingWishlistProduct', String(id))
      window.location.href = `/login?redirect=${encodeURIComponent(
        window.location.pathname + window.location.search,
      )}`
      return
    }

    setIsFavorite(!isFavorite)

    try {
      await toggleProduct(String(id))
      onAddToWishlist?.(id)
    } catch {
      setIsFavorite(!isFavorite)
    }
  }

  const handleCartClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onAddToCart?.(id)
  }

  // Card styles based on theme
  const getCardStyles = () => {
    const baseStyles: React.CSSProperties = {
      borderRadius: theme.styles.borderRadius,
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      color: theme.colors.text,
    }

    switch (theme.styles.cardStyle) {
      case 'elevated':
        return {
          ...baseStyles,
          boxShadow: `0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)`,
          border: 'none',
        }
      case 'bordered':
        return {
          ...baseStyles,
          borderWidth: '2px',
          borderStyle: 'solid',
          boxShadow: 'none',
        }
      case 'flat':
      default:
        return {
          ...baseStyles,
          borderWidth: '1px',
          borderStyle: 'solid',
          boxShadow: 'none',
        }
    }
  }

  // Render different card layouts
  const renderModernCard = () => (
    <Card
      className="group relative overflow-hidden cursor-pointer flex flex-col h-full transition-all duration-300 hover:scale-105"
      style={getCardStyles()}
      onClick={handleCardClick}
    >
      <div className="relative h-56 bg-white overflow-hidden" style={{ borderRadius: theme.styles.borderRadius }}>
        {badge && (
          <motion.div className="absolute top-3 left-3 z-20" initial={{ scale: 0 }} animate={{ scale: 1 }}>
            <div
              className="px-3 py-1.5 text-white text-xs font-bold rounded-full"
              style={{
                background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.secondary} 100%)`,
              }}
            >
              {badge}
            </div>
          </motion.div>
        )}
        <motion.button
          onClick={handleWishlistClick}
          disabled={isTogglingWishlist}
          className="absolute top-3 right-3 z-20 p-1 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-all shadow-md"
          style={{ backgroundColor: theme.colors.surface }}
          whileTap={{ scale: 0.9 }}
        >
          {isTogglingWishlist ? (
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: theme.colors.text }} />
          ) : (
            <Heart
              className={`w-4 h-4 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`}
              style={{ color: isFavorite ? '#ef4444' : theme.colors.textSecondary }}
            />
          )}
        </motion.button>
        <div className="relative h-full w-full p-3">
          <img
            src={image}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            style={{ borderRadius: theme.styles.borderRadius }}
          />
        </div>
      </div>
      <CardContent className="flex-1 flex flex-col p-4" style={{ backgroundColor: theme.colors.surface }}>
        <h3
          className="text-base font-bold line-clamp-2"
          style={{ color: theme.colors.text }}
        >
          {name}
        </h3>
        {description && (
          <p
            className="text-xs mt-1 line-clamp-2 leading-relaxed"
            style={{ color: theme.colors.textSecondary }}
          >
            {description}
          </p>
        )}
        <div className="mt-auto flex items-start justify-between gap-2">
          <div className="flex flex-col">
            {originalPrice && originalPrice > price ? (
              <>
                <span
                  className="text-lg font-bold"
                  style={{ color: theme.colors.primary }}
                >
                  ₹{price.toLocaleString()}
                </span>
                <span
                  className="text-xs line-through"
                  style={{ color: theme.colors.textSecondary }}
                >
                  ₹{originalPrice.toLocaleString()}
                </span>
              </>
            ) : (
              <span
                className="text-lg font-bold"
                style={{ color: theme.colors.primary }}
              >
                ₹{price.toLocaleString()}
              </span>
            )}
          </div>
          <motion.button
            onClick={handleCartClick}
            className="px-4 py-2 text-white font-semibold text-xs rounded-full transition-all"
            style={{
              background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.secondary} 100%)`,
            }}
            whileTap={{ scale: 0.95 }}
          >
            {buttonText}
          </motion.button>
        </div>
      </CardContent>
    </Card>
  )

  const renderClassicCard = () => (
    <Card
      className="group relative overflow-hidden cursor-pointer flex flex-col h-full transition-all duration-300"
      style={{
        ...getCardStyles(),
        borderWidth: '2px',
        borderColor: theme.colors.primary,
      }}
      onClick={handleCardClick}
    >
      <div className="relative h-48 bg-white overflow-hidden" style={{ borderRadius: theme.styles.borderRadius }}>
        {badge && (
          <div
            className="absolute top-2 left-2 z-20 px-2 py-1 text-white text-xs font-semibold"
            style={{
              backgroundColor: theme.colors.primary,
              borderRadius: theme.styles.borderRadius,
            }}
          >
            {badge}
          </div>
        )}
        <motion.button
          onClick={handleWishlistClick}
          disabled={isTogglingWishlist}
          className="absolute top-2 right-2 z-20 p-1.5 rounded-full transition-all"
          style={{ backgroundColor: theme.colors.surface, border: `1px solid ${theme.colors.border}` }}
          whileTap={{ scale: 0.9 }}
        >
          {isTogglingWishlist ? (
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: theme.colors.text }} />
          ) : (
            <Heart
              className={`w-4 h-4 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`}
              style={{ color: isFavorite ? '#ef4444' : theme.colors.textSecondary }}
            />
          )}
        </motion.button>
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          style={{ borderRadius: theme.styles.borderRadius }}
        />
      </div>
      <CardContent className="flex-1 flex flex-col p-5" style={{ backgroundColor: theme.colors.surface }}>
        <h3
          className="text-lg font-semibold line-clamp-2 mb-2"
          style={{ color: theme.colors.text }}
        >
          {name}
        </h3>
        {description && (
          <p
            className="text-sm mb-3 line-clamp-2"
            style={{ color: theme.colors.textSecondary }}
          >
            {description}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between">
          <div className="flex flex-col">
            {originalPrice && originalPrice > price ? (
              <>
                <span
                  className="text-xl font-bold"
                  style={{ color: theme.colors.primary }}
                >
                  ₹{price.toLocaleString()}
                </span>
                <span
                  className="text-sm line-through"
                  style={{ color: theme.colors.textSecondary }}
                >
                  ₹{originalPrice.toLocaleString()}
                </span>
              </>
            ) : (
              <span
                className="text-xl font-bold"
                style={{ color: theme.colors.primary }}
              >
                ₹{price.toLocaleString()}
              </span>
            )}
          </div>
          <motion.button
            onClick={handleCartClick}
            className="px-5 py-2.5 text-white font-medium text-sm rounded transition-all"
            style={{
              backgroundColor: theme.colors.primary,
            }}
            whileTap={{ scale: 0.95 }}
          >
            {buttonText}
          </motion.button>
        </div>
      </CardContent>
    </Card>
  )

  const renderMinimalCard = () => (
    <Card
      className="group relative overflow-hidden cursor-pointer flex flex-col h-full transition-all duration-300 hover:border-opacity-100"
      style={{
        ...getCardStyles(),
        borderWidth: '1px',
        borderColor: theme.colors.border,
      }}
      onClick={handleCardClick}
    >
      <div className="relative h-52 bg-white overflow-hidden">
        {badge && (
          <div
            className="absolute top-2 left-2 z-20 px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: theme.colors.text,
              color: theme.colors.surface,
              borderRadius: '2px',
            }}
          >
            {badge}
          </div>
        )}
        <motion.button
          onClick={handleWishlistClick}
          disabled={isTogglingWishlist}
          className="absolute top-2 right-2 z-20 p-1 transition-all"
          style={{ color: theme.colors.textSecondary }}
          whileTap={{ scale: 0.9 }}
        >
          {isTogglingWishlist ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
          )}
        </motion.button>
        <img src={image} alt={name} className="w-full h-full object-cover" />
      </div>
      <CardContent className="flex-1 flex flex-col p-4" style={{ backgroundColor: theme.colors.surface }}>
        <h3
          className="text-sm font-medium line-clamp-2 mb-1"
          style={{ color: theme.colors.text }}
        >
          {name}
        </h3>
        {description && (
          <p
            className="text-xs mb-2 line-clamp-1"
            style={{ color: theme.colors.textSecondary }}
          >
            {description}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between">
          <span
            className="text-base font-medium"
            style={{ color: theme.colors.text }}
          >
            ₹{price.toLocaleString()}
          </span>
          <motion.button
            onClick={handleCartClick}
            className="px-3 py-1 text-xs font-medium transition-all"
            style={{
              backgroundColor: 'transparent',
              color: theme.colors.text,
              borderBottom: `1px solid ${theme.colors.text}`,
              borderRadius: '0',
            }}
            whileTap={{ scale: 0.95 }}
          >
            {buttonText}
          </motion.button>
        </div>
      </CardContent>
    </Card>
  )

  const renderGridCard = () => (
    <Card
      className="group relative overflow-hidden cursor-pointer flex flex-col h-full transition-all duration-300 hover:shadow-2xl"
      style={{
        ...getCardStyles(),
        boxShadow: `0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)`,
      }}
      onClick={handleCardClick}
    >
      <div
        className="relative h-64 bg-gradient-to-br overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${theme.colors.primary}20 0%, ${theme.colors.secondary}20 100%)`,
          borderRadius: theme.styles.borderRadius,
        }}
      >
        {badge && (
          <motion.div className="absolute top-3 left-3 z-20" initial={{ scale: 0 }} animate={{ scale: 1 }}>
            <div
              className="px-3 py-1.5 text-white text-xs font-bold rounded-full shadow-lg"
              style={{
                background: theme.colors.accent,
                boxShadow: `0 4px 14px 0 ${theme.colors.accent}40`,
              }}
            >
              {badge}
            </div>
          </motion.div>
        )}
        <motion.button
          onClick={handleWishlistClick}
          disabled={isTogglingWishlist}
          className="absolute top-3 right-3 z-20 p-2 rounded-full transition-all shadow-lg"
          style={{
            backgroundColor: theme.colors.surface,
            boxShadow: `0 4px 14px 0 ${theme.colors.primary}30`,
          }}
          whileTap={{ scale: 0.9 }}
        >
          {isTogglingWishlist ? (
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: theme.colors.primary }} />
          ) : (
            <Heart
              className={`w-4 h-4 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`}
              style={{ color: isFavorite ? '#ef4444' : theme.colors.primary }}
            />
          )}
        </motion.button>
        <div className="relative h-full w-full p-4">
          <img
            src={image}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 group-hover:rotate-2"
            style={{ borderRadius: theme.styles.borderRadius }}
          />
        </div>
      </div>
      <CardContent className="flex-1 flex flex-col p-5" style={{ backgroundColor: theme.colors.surface }}>
        <h3
          className="text-lg font-bold line-clamp-2 mb-2"
          style={{ color: theme.colors.text }}
        >
          {name}
        </h3>
        {description && (
          <p
            className="text-sm mb-3 line-clamp-2"
            style={{ color: theme.colors.textSecondary }}
          >
            {description}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between">
          <div className="flex flex-col">
            {originalPrice && originalPrice > price ? (
              <>
                <span
                  className="text-2xl font-bold"
                  style={{ color: theme.colors.primary }}
                >
                  ₹{price.toLocaleString()}
                </span>
                <span
                  className="text-sm line-through"
                  style={{ color: theme.colors.textSecondary }}
                >
                  ₹{originalPrice.toLocaleString()}
                </span>
              </>
            ) : (
              <span
                className="text-2xl font-bold"
                style={{ color: theme.colors.primary }}
              >
                ₹{price.toLocaleString()}
              </span>
            )}
          </div>
          <motion.button
            onClick={handleCartClick}
            className="px-6 py-3 text-white font-bold text-sm rounded-full transition-all shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.secondary} 100%)`,
              boxShadow: `0 4px 14px 0 ${theme.colors.primary}40`,
            }}
            whileTap={{ scale: 0.95 }}
          >
            {buttonText}
          </motion.button>
        </div>
      </CardContent>
    </Card>
  )

  // Render based on cardLayout
  switch (theme.styles.cardLayout) {
    case 'classic':
      return renderClassicCard()
    case 'minimal':
      return renderMinimalCard()
    case 'grid':
      return renderGridCard()
    case 'modern':
    default:
      return renderModernCard()
  }
}

export default ThemedProductCard

