import { useNotificationPreferences, useUpdateNotificationPreferences } from '@/api/notifications'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/authStore'
import { motion } from 'framer-motion'
import { Mail, Send } from 'lucide-react'
import React from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

const NewsletterSection: React.FC = () => {
  const { isAuthenticated } = useAuthStore()
  const { data: preferencesData } = useNotificationPreferences()
  const updatePreferencesMutation = useUpdateNotificationPreferences()

  const isNewsletterSubscribed = preferencesData?.data?.newsletter ?? false

  const handleSubscribe = async (e?: React.FormEvent) => {
    e?.preventDefault()

    // Newsletter subscription is only for logged-in users (updates preference)
    if (!isAuthenticated) {
      toast.error('Please log in to subscribe to newsletter')
      return
    }

    // Update newsletter preference (for blogs)
    try {
      await updatePreferencesMutation.mutateAsync({
        newsletter: true,
      })
      toast.success('Successfully subscribed to newsletter!')
    } catch (error) {
      const errorMessage =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to subscribe. Please try again.'
      toast.error(errorMessage)
    }
  }

  // Don't show newsletter section if user is logged in and already subscribed
  if (isAuthenticated && isNewsletterSubscribed) {
    return null
  }

  return (
    <section className="py-20 md:py-28 bg-gradient-to-br from-purple-600 via-pink-600 to-orange-600 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-40 h-40 bg-white rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <Mail className="w-10 h-10 text-white" />
            </div>
          </div>

          {/* Heading */}
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4">
            Stay In The Loop
          </h2>

          {/* Description */}
          <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-2xl mx-auto">
            Subscribe to our newsletter and get exclusive deals, new arrivals, and special offers
            delivered to your inbox!
          </p>

          {/* Form */}
          {/* Newsletter subscription only for logged-in users */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
            className="flex flex-col items-center gap-4 max-w-xl mx-auto"
          >
            {isAuthenticated ? (
              <>
                <Button
                  onClick={() => handleSubscribe()}
                  className="py-6 px-8 bg-white text-purple-600 rounded-full font-bold text-lg hover:bg-gray-100 shadow-lg whitespace-nowrap"
                  disabled={updatePreferencesMutation.isPending}
                >
                  {updatePreferencesMutation.isPending
                    ? 'Subscribing...'
                    : 'Subscribe to Newsletter'}
                  <Send className="w-5 h-5 ml-2" />
                </Button>
                <p className="text-sm text-white/80">
                  Manage your preferences in{' '}
                  <Link
                    to="/profile/notifications"
                    className="underline font-semibold hover:text-white"
                  >
                    Notification Settings
                  </Link>
                </p>
              </>
            ) : (
              <div className="text-center">
                <p className="text-white/90 mb-4">Please log in to subscribe to our newsletter</p>
                <Link to="/login">
                  <Button className="py-6 px-8 bg-white text-purple-600 rounded-full font-bold text-lg hover:bg-gray-100 shadow-lg">
                    Log In to Subscribe
                  </Button>
                </Link>
              </div>
            )}
          </motion.div>

          {/* Trust badges */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 md:gap-8 text-white/80 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-2xl">✓</span>
              <span>No spam, unsubscribe anytime</span>
            </div>
            <div className="hidden sm:block w-1 h-1 bg-white/40 rounded-full" />
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔒</span>
              <span>We respect your privacy</span>
            </div>
            <div className="hidden sm:block w-1 h-1 bg-white/40 rounded-full" />
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎁</span>
              <span>Exclusive member offers</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default NewsletterSection
