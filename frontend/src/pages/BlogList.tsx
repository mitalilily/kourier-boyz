import { useBlogs } from '@/api/blogs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDistanceToNow } from 'date-fns'
import { Calendar, Clock, Search, Tag, User } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

const BlogList = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const limit = 12

  const { data, isLoading } = useBlogs({
    status: 'published',
    search: searchQuery || undefined,
    page: currentPage,
    limit,
  })

  const blogs = data?.blogs || []
  const pagination = data?.pagination

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-24 px-4 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-700" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Our <span className="text-blue-400">Blog</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-8">
            Discover the latest insights, tutorials, and stories from our team
          </p>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <Input
                type="text"
                placeholder="Search blogs..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-10 py-6 text-lg bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-gray-400 focus:bg-white/20"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Blog Posts Grid */}
      <div className="max-w-7xl mx-auto px-4 py-16">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="h-48 w-full" />
                <CardHeader>
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : blogs.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 text-lg">No blog posts found.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {blogs.map((blog) => (
                <Card key={blog._id} className="overflow-hidden hover:shadow-xl transition-shadow group">
                  <Link to={`/blog/${blog.slug || blog._id}`}>
                    {blog.featuredImage ? (
                      <div className="relative h-48 overflow-hidden">
                        <img
                          src={blog.featuredImage}
                          alt={blog.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      </div>
                    ) : (
                      <div className="h-48 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <span className="text-white text-4xl font-bold">{blog.title.charAt(0)}</span>
                      </div>
                    )}
                    <CardHeader>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                        <User size={14} />
                        <span>{typeof blog.author === 'object' ? blog.author.name : 'Unknown'}</span>
                        <span>•</span>
                        <Calendar size={14} />
                        <span>
                          {blog.publishedAt
                            ? formatDistanceToNow(new Date(blog.publishedAt), { addSuffix: true })
                            : 'Recently'}
                        </span>
                      </div>
                      <CardTitle className="line-clamp-2 group-hover:text-blue-600 transition-colors">
                        {blog.title}
                      </CardTitle>
                      {blog.excerpt && (
                        <CardDescription className="line-clamp-3 mt-2">{blog.excerpt}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      {blog.tags && blog.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {blog.tags.slice(0, 3).map((tag, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full"
                            >
                              <Tag size={12} />
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Clock size={14} />
                          <span>{Math.ceil(blog.content.split(' ').length / 200)} min read</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span>{blog.views || 0} views</span>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button variant="outline" className="w-full group-hover:bg-blue-50 group-hover:border-blue-200">
                        Read More →
                      </Button>
                    </CardFooter>
                  </Link>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-12">
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="text-gray-600">
                  Page {currentPage} of {pagination.pages}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage((p) => Math.min(pagination.pages, p + 1))}
                  disabled={currentPage === pagination.pages}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default BlogList

