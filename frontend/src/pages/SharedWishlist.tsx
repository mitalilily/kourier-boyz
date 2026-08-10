'use client'

import { useSharedWishlist } from '@/api/wishlist'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/utils'
import { motion } from 'framer-motion'
import { Link, useParams } from 'react-router-dom'

const SharedWishlist = () => {
  const { token } = useParams<{ token: string }>()
  const { data, isLoading, isError } = useSharedWishlist(token)

  const wishlist = data?.wishlist
  const items =
    wishlist?.items?.filter((item) => item?.product && typeof item.product === 'object') ?? []

  if (!token) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-30">
        <Card className="border-0 shadow-xl rounded-2xl">
          <CardContent className="py-16 text-center space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900">Invalid Share Link</h2>
            <p className="text-gray-600">
              This wishlist link is missing a valid token. Please check the link and try again.
            </p>
            <Button asChild className="rounded-full">
              <Link to="/">Go Back Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-30">
        <div className="mb-8">
          <Skeleton className="h-12 w-64 mb-4" />
          <Skeleton className="h-6 w-96" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      </div>
    )
  }

  if (isError || !wishlist || items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-30">
        <Card className="border-0 shadow-xl rounded-2xl">
          <CardContent className="py-16 text-center space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900">Wishlist Unavailable</h2>
            <p className="text-gray-600">
              This shared wishlist is no longer available or has been made private.
            </p>
            <Button asChild className="rounded-full">
              <Link to="/">Browse Products</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-30">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Shared Wishlist</h1>
          <p className="text-gray-600">
            Discover products from a wishlist shared with you. Add your favorites to cart instantly.
          </p>
        </div>
        <Badge className="bg-green-100 text-green-700 border-green-200 rounded-full px-4 py-1 text-sm">
          {items.length} item{items.length === 1 ? '' : 's'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => {
          const product = item.product
          if (!product || !product._id) return null

          const image = product.mainImage || product.images?.[0] || '/image-placeholder.svg'
          const isOutOfStock = product.status === 'out_of_stock' || product.stock === 0

          return (
            <motion.div
              key={product._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow h-full">
                <div className="flex flex-col h-full">
                  <div className="relative">
                    <Link to={`/product/${product.slug || product._id}`}>
                      <img
                        src={image}
                        alt={product.name}
                        className="w-full h-56 object-cover rounded-t-2xl"
                      />
                    </Link>
                    {isOutOfStock && (
                      <Badge className="absolute top-3 right-3 bg-red-100 text-red-700 border-red-200">
                        Out of stock
                      </Badge>
                    )}
                  </div>

                  <CardContent className="flex-1 flex flex-col gap-3 p-5">
                    <div className="space-y-2">
                      <Link to={`/product/${product.slug || product._id}`}>
                        <h2 className="text-lg font-semibold text-gray-900 line-clamp-2 hover:text-[#1353A4] transition-colors">
                          {product.name}
                        </h2>
                      </Link>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {product.shortDescription || product.description || 'Wishlist product'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold text-gray-900">
                        {formatCurrency(product.effectivePrice ?? (product.price || 0))}
                      </span>
                      {product.discountPercent && (
                        <Badge className="bg-green-100 text-green-700 border-green-200">
                          {product.discountPercent}% OFF
                        </Badge>
                      )}
                    </div>

                    <Button asChild variant="default" className="mt-auto rounded-full">
                      <Link to={`/product/${product.slug || product._id}`}>View Product</Link>
                    </Button>
                  </CardContent>
                </div>
              </Card>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

export default SharedWishlist
