import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import { motion } from 'framer-motion'
import { Quote, Star } from 'lucide-react'
import React from 'react'
import SectionHeading from '../ui/SectionHeading'

const testimonials = [
  {
    id: 1,
    name: 'Sarah Johnson',
    role: 'Frequent Shopper',
    rating: 5,
    text: 'Amazing shopping experience! Fast delivery and great quality products. Highly recommend!',
    image:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face',
  },
  {
    id: 2,
    name: 'Michael Chen',
    role: 'Verified Buyer',
    rating: 5,
    text: 'Best marketplace I have ever used. Customer service is top-notch and prices are unbeatable.',
    image:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
  },
  {
    id: 3,
    name: 'Emma Williams',
    role: 'Premium Member',
    rating: 5,
    text: 'I love the variety of products and the easy navigation. Shopping has never been this pleasant!',
    image:
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face',
  },
  {
    id: 4,
    name: 'David Rodriguez',
    role: 'Verified Buyer',
    rating: 5,
    text: 'Exceeded my expectations! Quick checkout process and fantastic product quality. Will definitely shop again.',
    image:
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
  },
]

const TestimonialSection: React.FC = () => {
  return (
    <section className="py-20 md:py-32 bg-white">
      <div className=" mx-auto px-6">
        <SectionHeading
          title="What Our Customers Say"
          italicPart="Say"
          subtitle="Don't just take our word for it"
          align="center"
        />

        <Carousel
          opts={{
            align: 'start',
            loop: true,
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-2 md:-ml-4">
            {testimonials.map((testimonial, index) => (
              <CarouselItem
                key={testimonial.id}
                className="pl-2 md:pl-4 basis-full md:basis-1/2 lg:basis-1/3"
              >
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="h-full"
                >
                  <div className="relative bg-gradient-to-br from-gray-50 to-white rounded-3xl p-8 h-full shadow-lg hover:shadow-2xl transition-shadow duration-300 border border-gray-100 group">
                    {/* Quote icon */}
                    <div className="absolute top-6 right-6 opacity-10">
                      <Quote className="w-16 h-16 text-purple-600" />
                    </div>

                    {/* Stars */}
                    <div className="flex items-center gap-1 mb-6">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="w-5 h-5 fill-yellow text-yellow" />
                      ))}
                    </div>

                    {/* Testimonial text */}
                    <p className="text-gray-700 text-base leading-relaxed mb-8 relative z-10">
                      "{testimonial.text}"
                    </p>

                    {/* Author info */}
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-purple-600/20 group-hover:border-purple-600/40 transition-colors duration-300">
                        <img
                          src={testimonial.image}
                          alt={testimonial.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{testimonial.name}</h4>
                        <p className="text-sm text-gray-600">{testimonial.role}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden lg:flex -left-12 bg-white/80 backdrop-blur-sm border-gray-200 hover:bg-white" />
          <CarouselNext className="hidden lg:flex -right-12 bg-white/80 backdrop-blur-sm border-gray-200 hover:bg-white" />
        </Carousel>
      </div>
    </section>
  )
}

export default TestimonialSection
