import { motion } from 'framer-motion'
import { ArrowRight, HelpCircle, MessageCircle, Search, ThumbsDown, ThumbsUp, Ticket } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useRateArticle, useSupportArticle, useSupportArticles } from '../api/support'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import SectionHeading from '../components/ui/SectionHeading'

const categories = [
  { id: 'orders', label: 'Orders', icon: '📦', gradient: 'from-blue-500 to-cyan-500' },
  { id: 'shipping', label: 'Shipping', icon: '🚚', gradient: 'from-green-500 to-emerald-500' },
  { id: 'returns', label: 'Returns', icon: '↩️', gradient: 'from-orange-500 to-red-500' },
  { id: 'payments', label: 'Payments', icon: '💳', gradient: 'from-purple-500 to-violet-500' },
  { id: 'account', label: 'Account', icon: '👤', gradient: 'from-pink-500 to-rose-500' },
  { id: 'products', label: 'Products', icon: '🛍️', gradient: 'from-indigo-500 to-purple-500' },
  { id: 'other', label: 'Other', icon: '❓', gradient: 'from-gray-500 to-slate-500' },
]

const HelpCenter = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null)

  const { data: articles = [], isLoading } = useSupportArticles({
    category: selectedCategory,
    search: searchQuery || undefined,
  })

  const { data: selectedArticle } = useSupportArticle(selectedArticleId || '')
  const rateMutation = useRateArticle()

  const handleRateArticle = (helpful: boolean) => {
    if (selectedArticleId) {
      rateMutation.mutate({ id: selectedArticleId, helpful })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 px-4 py-20 sm:py-24">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-700" />
        </div>

        <div className="relative z-10  mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mt-3 sm:mt-5 md:mt-10 text-4xl font-bold text-white mb-5 sm:mb-6 md:text-6xl"
          >
            How can we <span className="font-italic-cursive font-light text-white">help</span> you?
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mx-auto mb-10 max-w-2xl text-base text-gray-300 sm:mb-12 sm:text-xl"
          >
            Get help with orders, returns, products, and more
          </motion.p>

          {/* Search Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="max-w-2xl mx-auto"
          >
            <div className="relative">
              <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search for help..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-14 pr-6 py-4 rounded-2xl bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                style={{
                  backdropFilter: 'blur(10px) saturate(180%)',
                }}
              />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Quick Actions - Redesigned */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 gap-8 mb-20">
          {/* Create Ticket Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            whileHover={{ y: -8, scale: 1.02 }}
          >
            <Link to="/help/tickets/new">
              <Card
                className="group cursor-pointer hover:shadow-2xl transition-all duration-500 border-2 border-purple-200 bg-gradient-to-br from-purple-50 via-white to-pink-50 overflow-hidden relative"
              >
                {/* Decorative gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <CardContent className="p-10 relative z-10">
                  <div className="flex items-start gap-6">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-lg">
                      <Ticket className="w-10 h-10 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-purple-600 transition-colors">
                        Create Support Ticket
                      </h3>
                      <p className="text-gray-700 text-lg mb-4 leading-relaxed">
                        Have any issue regarding product, return, or something else?
                      </p>
                      <div className="flex items-center gap-2 text-purple-600 font-semibold group-hover:gap-3 transition-all">
                        <span>Create Ticket</span>
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>

          {/* Contact Us Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            whileHover={{ y: -8, scale: 1.02 }}
          >
            <Link to="/contact">
              <Card
                className="group cursor-pointer hover:shadow-2xl transition-all duration-500 border-2 border-blue-200 bg-gradient-to-br from-blue-50 via-white to-cyan-50 overflow-hidden relative"
              >
                {/* Decorative gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <CardContent className="p-10 relative z-10">
                  <div className="flex items-start gap-6">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-lg">
                      <MessageCircle className="w-10 h-10 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                        Contact Us
                      </h3>
                      <p className="text-gray-700 text-lg mb-4 leading-relaxed">
                        Have any other query? We're here to help!
                      </p>
                      <div className="flex items-center gap-2 text-blue-600 font-semibold group-hover:gap-3 transition-all">
                        <span>Get in Touch</span>
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        </div>

        {/* Categories */}
        <SectionHeading
          title="Browse by"
          italicPart="Topic"
          subtitle="Select a category to find relevant help articles"
          align="left"
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-16">
          {categories.map((category, index) => {
            const isSelected = selectedCategory === category.id
            return (
              <motion.button
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.03 }}
                whileHover={{ y: -5 }}
                onClick={() => {
                  setSelectedCategory(isSelected ? undefined : category.id)
                  setSelectedArticleId(null)
                }}
                className="group cursor-pointer"
              >
                {/* Liquid Glass Card - matching QuickLinks style */}
                <div
                  className={`relative h-32 rounded-3xl overflow-hidden transition-all duration-300 ${
                    isSelected ? 'ring-2 ring-purple-500 shadow-xl' : ''
                  }`}
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
                    backdropFilter: 'blur(10px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(10px) saturate(180%)',
                    border: isSelected
                      ? '1px solid rgba(147, 51, 234, 0.3)'
                      : '1px solid rgba(255,255,255,0.18)',
                    boxShadow: isSelected
                      ? '0 8px 32px 0 rgba(147, 51, 234, 0.3)'
                      : '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
                  }}
                >
                  {/* Gradient overlay that changes on hover */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${
                      category.gradient
                    } opacity-0 group-hover:opacity-30 transition-all duration-500 ${
                      isSelected ? 'opacity-20' : ''
                    }`}
                  />

                  {/* Animated shine effect */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
                  </div>

                  {/* Content */}
                  <div className="relative h-full flex flex-col items-center justify-center p-4">
                    {/* Icon */}
                    <div className="text-3xl mb-2 group-hover:scale-110 transition-transform duration-300">
                      {category.icon}
                    </div>

                    {/* Label */}
                    <div className="text-center">
                      <span className="text-xs font-bold text-gray-800 group-hover:text-gray-900 transition-colors duration-200 line-clamp-2">
                        {category.label}
                      </span>
                    </div>
                  </div>

                  {/* Corner accent */}
                  <div
                    className={`absolute top-2 right-2 w-6 h-6 bg-gradient-to-br ${
                      category.gradient
                    } rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm ${
                      isSelected ? 'opacity-50' : ''
                    }`}
                  />
                </div>
              </motion.button>
            )
          })}
        </div>

        {/* Articles List */}
        {selectedArticleId && selectedArticle ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto"
          >
            <Button
              variant="ghost"
              onClick={() => setSelectedArticleId(null)}
              className="mb-6 text-gray-600 hover:text-gray-900"
            >
              ← Back to articles
            </Button>
            <Card
              className="border-0 shadow-2xl"
              style={{
                background:
                  'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
                backdropFilter: 'blur(10px) saturate(180%)',
                WebkitBackdropFilter: 'blur(10px) saturate(180%)',
                border: '1px solid rgba(255,255,255,0.18)',
                boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
              }}
            >
              <CardContent className="p-10">
                <h2 className="text-4xl font-bold text-gray-900 mb-6">{selectedArticle.title}</h2>
                <div
                  className="prose max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600 prose-strong:text-gray-900"
                  dangerouslySetInnerHTML={{ __html: selectedArticle.content }}
                />
                <div className="mt-10 pt-8 border-t border-gray-200">
                  <p className="text-sm font-semibold text-gray-700 mb-4">
                    Was this article helpful?
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        onClick={() => handleRateArticle(true)}
                        size="lg"
                        className="group relative min-w-[160px] bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg hover:shadow-xl rounded-xl border-0"
                      >
                        <ThumbsUp className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
                        <span>Yes, helpful</span>
                        {selectedArticle.helpful > 0 && (
                          <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs font-bold">
                            {selectedArticle.helpful}
                          </span>
                        )}
                      </Button>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        onClick={() => handleRateArticle(false)}
                        size="lg"
                        className="group relative min-w-[160px] bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 hover:from-slate-800 hover:via-blue-800 hover:to-slate-700 text-white shadow-lg hover:shadow-xl rounded-xl border-0"
                      >
                        <ThumbsDown className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
                        <span>Not helpful</span>
                        {selectedArticle.notHelpful > 0 && (
                          <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs font-bold">
                            {selectedArticle.notHelpful}
                          </span>
                        )}
                      </Button>
                    </motion.div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <div className=" mx-auto">
            {isLoading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-48 bg-gray-200 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : articles.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {articles.map((article, index) => (
                  <motion.div
                    key={article._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    whileHover={{ y: -5 }}
                  >
                    <Card
                      onClick={() => setSelectedArticleId(article._id)}
                      className="cursor-pointer hover:shadow-2xl transition-all duration-500 border-0 h-full group"
                      style={{
                        background:
                          'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
                        backdropFilter: 'blur(10px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(10px) saturate(180%)',
                        border: '1px solid rgba(255,255,255,0.18)',
                        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
                      }}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-semibold text-gray-700 capitalize">
                            {article.category}
                          </span>
                          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-gray-900 group-hover:translate-x-1 transition-all" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                          {article.title}
                        </h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span>{article.views} views</span>
                          {article.helpful > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-green-600">
                                {article.helpful} found helpful
                              </span>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            ) : (
              <Card
                className="border-0 text-center py-16"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
                  backdropFilter: 'blur(10px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(10px) saturate(180%)',
                  border: '1px solid rgba(255,255,255,0.18)',
                }}
              >
                <CardContent>
                  <HelpCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 text-lg mb-6">
                    {searchQuery
                      ? 'No articles found matching your search.'
                      : 'No articles available in this category.'}
                  </p>
                  <Link to="/contact">
                    <Button>Contact us for help</Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default HelpCenter
