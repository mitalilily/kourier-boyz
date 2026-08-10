import { useBlog, useBlogs } from "@/api/blogs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import {
  Calendar,
  Clock,
  Share2,
  Tag,
  User,
  ArrowLeft,
  Check,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

const BlogDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: blog, isLoading, error } = useBlog(slug || "");
  const { data: relatedBlogs } = useBlogs({
    status: "published",
    limit: 3,
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (blog) {
      document.title = blog.metaTitle || blog.title;
      const metaDescription = document.querySelector(
        'meta[name="description"]'
      );
      if (metaDescription && blog.metaDescription) {
        metaDescription.setAttribute("content", blog.metaDescription);
      }
    }
  }, [blog]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 py-16">
        <div className="max-w-4xl mx-auto px-4">
          <Skeleton className="h-96 w-full mb-8 rounded-xl" />
          <Skeleton className="h-10 w-3/4 mb-4" />
          <Skeleton className="h-6 w-full mb-2" />
          <Skeleton className="h-6 w-2/3 mb-8" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
      </div>
    );
  }

  if ((!isLoading && !blog) || error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="bg-white rounded-2xl shadow-lg p-12">
            <h1 className="text-4xl font-bold mb-4 text-gray-900">
              Blog Post Not Found
            </h1>
            <p className="text-gray-600 mb-8 text-lg">
              {error
                ? "The blog post you're looking for doesn't exist or may not be published yet."
                : "The blog post you're looking for doesn't exist."}
            </p>
            <Link to="/blog">
              <Button size="lg" className="gap-2">
                <ArrowLeft size={18} />
                Back to Blog
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Type guard: blog is definitely defined at this point
  if (!blog) return null;

  const readingTime = Math.ceil(blog.content.split(" ").length / 200);
  const authorName =
    typeof blog.author === "object" ? blog.author.name : "Unknown";

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: blog.title,
          text: blog.excerpt || blog.title,
          url: window.location.href,
        });
        toast.success("Shared successfully!");
      } catch (err) {
        // User cancelled or error occurred
        if ((err as Error).name !== "AbortError") {
          console.log("Error sharing:", err);
        }
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50">
      {/* Hero Section */}
      {blog.featuredImage && (
        <div className="relative h-96 md:h-[500px] overflow-hidden">
          <img
            src={blog.featuredImage}
            alt={blog.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/40 to-transparent" />
        </div>
      )}

      {/* Content */}
      <article className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <header className="mb-12">
          <Link to="/blog">
            <Button
              variant="ghost"
              className="mb-6 gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft size={18} />
              Back to Blog
            </Button>
          </Link>

          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 mb-6">
            <div className="flex items-center gap-1.5">
              <User size={16} className="text-gray-400" />
              <span className="font-medium">{authorName}</span>
            </div>
            <span className="text-gray-300">•</span>
            <div className="flex items-center gap-1.5">
              <Calendar size={16} className="text-gray-400" />
              <span>
                {blog.publishedAt
                  ? formatDistanceToNow(new Date(blog.publishedAt), {
                      addSuffix: true,
                    })
                  : "Recently"}
              </span>
            </div>
            <span className="text-gray-300">•</span>
            <div className="flex items-center gap-1.5">
              <Clock size={16} className="text-gray-400" />
              <span>{readingTime} min read</span>
            </div>
            <span className="text-gray-300">•</span>
            <div>
              <span>{blog.views || 0} views</span>
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-gray-900 leading-tight">
            {blog.title}
          </h1>

          {blog.excerpt && (
            <p className="text-xl text-gray-600 mb-8 leading-relaxed max-w-3xl">
              {blog.excerpt}
            </p>
          )}

          {blog.tags && blog.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-8">
              {blog.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-50 text-blue-700 text-sm font-medium rounded-full border border-blue-100 hover:bg-blue-100 transition-colors"
                >
                  <Tag size={14} />
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
            <Button
              variant="outline"
              onClick={handleShare}
              className="flex items-center gap-2 hover:bg-gray-50"
            >
              {copied ? (
                <>
                  <Check size={16} className="text-green-600" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Share2 size={16} />
                  <span>Share</span>
                </>
              )}
            </Button>
          </div>
        </header>

        {/* Content */}
        <div
          className="prose prose-lg prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600 prose-strong:text-gray-900 prose-ul:text-gray-700 prose-ol:text-gray-700 prose-li:text-gray-700 prose-blockquote:text-gray-600 prose-blockquote:border-l-blue-500 max-w-none mb-12"
          dangerouslySetInnerHTML={{ __html: blog.content }}
        />

        {/* Categories */}
        {blog.categories && blog.categories.length > 0 && (
          <div className="mb-12 pt-8 border-t border-gray-200">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">
              Categories
            </h3>
            <div className="flex flex-wrap gap-2">
              {blog.categories.map((category, idx) => (
                <span
                  key={idx}
                  className="px-4 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-full hover:bg-gray-200 transition-colors"
                >
                  {category}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Author Info */}
        {typeof blog.author === "object" && (
          <Card className="mb-12 border border-gray-200 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                  {authorName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-gray-900">
                    {authorName}
                  </h3>
                  {blog.author.email && (
                    <p className="text-gray-600 text-sm">{blog.author.email}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Related Blogs */}
        {relatedBlogs && relatedBlogs.blogs.length > 0 && (
          <div className="mt-16 pt-12 border-t border-gray-200">
            <h2 className="text-3xl font-bold mb-8 text-gray-900">
              Related Posts
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedBlogs.blogs
                .filter((b) => b._id !== blog._id)
                .slice(0, 3)
                .map((relatedBlog) => (
                  <Link
                    key={relatedBlog._id}
                    to={`/blog/${relatedBlog.slug || relatedBlog._id}`}
                    className="group"
                  >
                    <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 border border-gray-200 h-full">
                      {relatedBlog.featuredImage ? (
                        <div className="h-48 overflow-hidden">
                          <img
                            src={relatedBlog.featuredImage}
                            alt={relatedBlog.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                        </div>
                      ) : (
                        <div className="h-48 bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                          <span className="text-white text-3xl font-bold">
                            {relatedBlog.title.charAt(0)}
                          </span>
                        </div>
                      )}
                      <CardContent className="p-5">
                        <h3 className="font-semibold mb-2 line-clamp-2 text-gray-900 group-hover:text-blue-600 transition-colors">
                          {relatedBlog.title}
                        </h3>
                        {relatedBlog.excerpt && (
                          <p className="text-sm text-gray-600 line-clamp-2">
                            {relatedBlog.excerpt}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
            </div>
          </div>
        )}
      </article>
    </div>
  );
};

export default BlogDetail;
