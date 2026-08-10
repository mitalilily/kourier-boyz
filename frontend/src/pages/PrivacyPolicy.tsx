import { getAgreementByType } from '@/api/agreements'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Shield } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'

const PrivacyPolicy = () => {
  const {
    data: agreement,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['agreement', 'privacy-policy'],
    queryFn: () => getAgreementByType('privacy-policy'),
    retry: false,
  })

  useEffect(() => {
    if (agreement) {
      document.title = agreement.title || 'Privacy Policy'
    } else {
      document.title = 'Privacy Policy'
    }
  }, [agreement])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50">
        {/* Hero Skeleton */}
        <div className="relative">
          <Skeleton className="h-64 md:h-80 w-full" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Skeleton className="h-12 w-64" />
          </div>
        </div>
        {/* Content Skeleton */}
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="space-y-4">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-5/6" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-4/5" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !agreement) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 py-36">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="bg-white rounded-2xl shadow-lg p-12">
            <Shield className="w-16 h-16 mx-auto mb-6 text-gray-400" />
            <h1 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">Privacy Policy</h1>
            <p className="text-gray-600 mb-8 text-lg">
              {error
                ? (error as Error)?.message ||
                  'Privacy policy is not available at this time. Please check back later or contact support.'
                : 'Privacy policy is currently being updated. Please check back later.'}
            </p>
            <Link to="/">
              <Button size="lg" className="gap-2">
                <ArrowLeft size={18} />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50">
      {/* Hero Section */}
      <div className="relative">
        <div className="relative h-64 md:h-80 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAzMHYySDI0di0yaDEyek0zNiAyNnYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center px-4">
              <Shield className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 text-white opacity-90" />
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white drop-shadow-lg">
                {agreement.title}
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-12 md:py-16">
        {/* Metadata */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">Version:</span>
              <span>{agreement.version}</span>
            </div>
            {agreement.effectiveDate && (
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">Effective Date:</span>
                <span>
                  {new Date(agreement.effectiveDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
            )}
            {agreement.updatedAt && (
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">Last Updated:</span>
                <span>
                  {new Date(agreement.updatedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* PDF Download Button */}
        {agreement.pdfUrl && (
          <div className="mb-6">
            <a
              href={agreement.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-black font-semibold rounded-full hover:bg-primary/90 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <Shield size={18} />
              Download PDF Version
            </a>
          </div>
        )}

        {/* Content Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-10">
          <div
            className="prose prose-lg prose-gray max-w-none
              prose-headings:font-bold prose-headings:text-gray-900
              prose-p:text-gray-700 prose-p:leading-relaxed
              prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
              prose-strong:text-gray-900
              prose-ul:list-disc prose-ol:list-decimal
              prose-li:text-gray-700
              prose-img:rounded-xl prose-img:shadow-md
              prose-h1:text-3xl prose-h1:mb-4
              prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4
              prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3"
            dangerouslySetInnerHTML={{ __html: agreement.content }}
          />
        </div>

        {/* Back to Home Button */}
        <div className="mt-8 text-center">
          <Link to="/">
            <Button variant="outline" size="lg" className="gap-2">
              <ArrowLeft size={18} />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default PrivacyPolicy
