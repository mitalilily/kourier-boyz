import { useAboutUs } from "@/api/aboutUs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Target, Eye, Building2, Users, Heart, Award } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";

const AboutUs = () => {
  const { data: aboutUs, isLoading, error } = useAboutUs();

  useEffect(() => {
    if (aboutUs) {
      document.title = aboutUs.title || "About Us";
    }
  }, [aboutUs]);

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
    );
  }

  if (error || !aboutUs) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="bg-white rounded-2xl shadow-lg p-12">
            <Building2 className="w-16 h-16 mx-auto mb-6 text-gray-400" />
            <h1 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">
              About Us
            </h1>
            <p className="text-gray-600 mb-8 text-lg">
              This page is currently being updated. Please check back later.
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
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50">
      {/* Hero Section */}
      <div className="relative">
        {aboutUs.heroImage ? (
          <div className="relative h-64 md:h-80 lg:h-96 overflow-hidden">
            <img
              src={aboutUs.heroImage}
              alt={aboutUs.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent" />
            <div className="absolute inset-0 flex items-center justify-center">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white text-center px-4 drop-shadow-lg">
                {aboutUs.title}
              </h1>
            </div>
          </div>
        ) : (
          <div className="relative h-64 md:h-80 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAzMHYySDI0di0yaDEyek0zNiAyNnYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
            <div className="absolute inset-0 flex items-center justify-center">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white text-center px-4">
                {aboutUs.title}
              </h1>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-12 md:py-16">
        {/* Content Section */}
        {aboutUs.content && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-10 mb-10">
            <div
              className="prose prose-lg prose-gray max-w-none
                prose-headings:font-bold prose-headings:text-gray-900
                prose-p:text-gray-700 prose-p:leading-relaxed
                prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
                prose-strong:text-gray-900
                prose-ul:list-disc prose-ol:list-decimal
                prose-li:text-gray-700
                prose-img:rounded-xl prose-img:shadow-md"
              dangerouslySetInnerHTML={{ __html: aboutUs.content }}
            />
          </div>
        )}

        {/* Mission & Vision Cards */}
        {(aboutUs.mission || aboutUs.vision) && (
          <div className="grid md:grid-cols-2 gap-6 mb-10">
            {aboutUs.mission && (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 md:p-8 border border-blue-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                    <Target className="w-6 h-6 text-blue-600" />
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                    Our Mission
                  </h2>
                </div>
                <p className="text-gray-700 leading-relaxed">{aboutUs.mission}</p>
              </div>
            )}

            {aboutUs.vision && (
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 md:p-8 border border-purple-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                    <Eye className="w-6 h-6 text-purple-600" />
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                    Our Vision
                  </h2>
                </div>
                <p className="text-gray-700 leading-relaxed">{aboutUs.vision}</p>
              </div>
            )}
          </div>
        )}

        {/* Values Section - Static */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-10">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-8">
            Why Choose Us
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="text-center p-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <Award className="w-7 h-7 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Quality Products</h3>
              <p className="text-sm text-gray-600">
                We curate only the best products from trusted sellers
              </p>
            </div>
            <div className="text-center p-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-4">
                <Users className="w-7 h-7 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Customer First</h3>
              <p className="text-sm text-gray-600">
                Your satisfaction is our top priority
              </p>
            </div>
            <div className="text-center p-4 sm:col-span-2 lg:col-span-1">
              <div className="w-14 h-14 rounded-2xl bg-rose-100 flex items-center justify-center mx-auto mb-4">
                <Heart className="w-7 h-7 text-rose-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Trusted Service</h3>
              <p className="text-sm text-gray-600">
                Secure payments and reliable delivery
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutUs;

