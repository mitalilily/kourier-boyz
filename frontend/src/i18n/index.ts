import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

export const supportedLanguages = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
]

const resources = {
  en: {
    translation: {
      language: {
        switcherLabel: 'Language',
      },
      navigation: {
        home: 'Home',
        shop: 'Shop',
        categories: 'Categories',
        wishlist: 'Wishlist',
        history: 'History',
        cart: 'Cart',
        orders: 'Orders',
        profile: 'Profile',
        helpCenter: 'Help Center',
        contactUs: 'Contact Us',
        chatSupport: 'Chat Support',
        more: 'Menu',
        moreOptionsTitle: 'Quick Access',
        moreOptionsSubtitle: 'Orders, support, profile, and shopping shortcuts in one place.',
        discover: 'Discover',
        yourStuff: 'Your Stuff',
        deals: 'Deals of the Day',
        newArrivals: 'New Arrivals',
        trending: 'Trending',
        bestSellers: 'Best Sellers',
        hoverCategory: 'Hover over a category',
        toViewSubcategories: 'to view its subcategories',
        noSubcategories: 'No subcategories available',
        viewAllCategory: 'View All {{category}}',
        moreInCategory: 'More in {{category}}',
        subcategoryCount_one: '{{count}} subcategory available',
        subcategoryCount_other: '{{count}} subcategories available',
        shopByCategories: 'Shop by Categories',
        menuTitle: 'Explore Kourier Boyz',
        menuDescription: 'Browse categories, update delivery details, and jump to key sections.',
        deliveringTo: 'Delivering to',
        chooseDeliveryLocation: 'Choose delivery location',
        toggleMobileMenu: 'Toggle mobile menu',
        selectLocation: 'Select location',
        addDeliveryPin: 'Tap change to add a delivery PIN.',
        change: 'Change',
        searchPlaceholder: 'Search for products, brands and more',
        submitSearch: 'Submit search',
        noCategories: 'No categories available',
        viewAllProducts: 'View All Products →',
        signOut: 'Sign out',
        signIn: 'Sign in',
        signUp: 'Sign up',
      },
      footer: {
        joinCommunityTitle: 'Useful updates, no clutter',
        joinCommunitySubtitle:
          'Get practical shipping guidance, seller updates, and selected marketplace offers.',
        emailPlaceholder: 'Enter your email',
        subscribe: 'Subscribe',
        brandDescription:
          'Shop useful products, send parcels, and run marketplace orders with dependable delivery support.',
        contactPhoneLabel: '',
        contactEmailLabel: 'support@kourierboyz.com',
        contactAddress: '',
        legalNotice: 'Copyright {{year}} Kourier Boyz. All rights reserved.',
        nav: {
          privacyPolicy: 'Privacy Policy',
          terms: 'Terms of Service',
          contact: 'Contact',
        },
        sections: {
          shop: {
            title: 'Shop',
            links: {
              newArrivals: 'New Arrivals',
              bestSellers: 'Best Sellers',
              sale: 'Sale',
            },
          },
          company: {
            title: 'Company',
            links: {
              about: 'About Us',
              blog: 'Blog',
            },
          },
          support: {
            title: 'Support',
            links: {
              helpCenter: 'Help Center',
              contact: 'Contact',
              trackOrder: 'Track Your Order',
              returns: 'Returns',
            },
          },
        },
      },
    },
  },
  hi: {
    translation: {
      language: {
        switcherLabel: 'भाषा',
      },
      navigation: {
        home: 'होम',
        shop: 'खरीदारी',
        categories: 'श्रेणियाँ',
        wishlist: 'इच्छा सूची',
        history: 'इतिहास',
        cart: 'कार्ट',
        orders: 'ऑर्डर',
        profile: 'प्रोफ़ाइल',
        helpCenter: 'सहायता केंद्र',
        contactUs: 'संपर्क करें',
        chatSupport: 'चैट सहायता',
        more: 'मेनू',
        moreOptionsTitle: 'त्वरित पहुँच',
        moreOptionsSubtitle: 'ऑर्डर, सहायता, प्रोफ़ाइल और खरीदारी शॉर्टकट एक ही जगह।',
        discover: 'खोजें',
        yourStuff: 'आपकी चीज़ें',
        deals: 'आज के सौदे',
        newArrivals: 'नए आगमन',
        trending: 'ट्रेंडिंग',
        bestSellers: 'सबसे ज्यादा बिकने वाले',
        hoverCategory: 'किसी श्रेणी पर होवर करें',
        toViewSubcategories: 'उसकी उप-श्रेणियाँ देखने के लिए',
        noSubcategories: 'कोई उप-श्रेणियाँ उपलब्ध नहीं हैं',
        viewAllCategory: 'सभी {{category}} देखें',
        moreInCategory: '{{category}} में और देखें',
        subcategoryCount_one: '{{count}} उप-श्रेणी उपलब्ध',
        subcategoryCount_other: '{{count}} उप-श्रेणियाँ उपलब्ध',
        shopByCategories: 'श्रेणियों के अनुसार खरीदें →',
        menuTitle: 'टेटोज़ एक्सप्लोर करें',
        menuDescription: 'श्रेणियाँ देखें, डिलीवरी विवरण अपडेट करें और मुख्य अनुभागों तक जल्दी पहुँचें।',
        deliveringTo: 'डिलीवरी स्थान',
        chooseDeliveryLocation: 'डिलीवरी स्थान चुनें',
        toggleMobileMenu: 'मोबाइल मेनू टॉगल करें',
        selectLocation: 'स्थान चुनें',
        addDeliveryPin: 'डिलीवरी पिन जोड़ने के लिए बदलें पर टैप करें।',
        change: 'बदलें',
        searchPlaceholder: 'उत्पाद, ब्रांड और अधिक खोजें',
        submitSearch: 'खोज सबमिट करें',
        noCategories: 'कोई श्रेणियाँ उपलब्ध नहीं हैं',
        viewAllProducts: 'सभी उत्पाद देखें →',
        signOut: 'साइन आउट',
        signIn: 'साइन इन',
        signUp: 'साइन अप',
      },
      footer: {
        joinCommunityTitle: 'हमारे समुदाय से जुड़ें',
        joinCommunitySubtitle:
          'हमारी बिक्री, विशेष सौदों और उत्पाद लॉन्च की अग्रिम जानकारी प्राप्त करने के लिए सदस्यता लें।',
        emailPlaceholder: 'अपना ईमेल दर्ज करें',
        subscribe: 'सदस्यता लें',
        brandDescription:
          'टेटोज़ आपको भरोसेमंद गुणवत्ता तेज़ी और देखभाल के साथ प्रदान करता है। हम ऐसे उत्पाद लाते हैं जो आपके जीवन को आसान बनाते हैं और सेवा जिस पर आप भरोसा कर सकते हैं।',
        contactPhoneLabel: '',
        contactEmailLabel: 'support@kourierboyz.com',
        contactAddress: '',
        legalNotice: 'Copyright {{year}} Kourier Boyz. All rights reserved.',
        nav: {
          privacyPolicy: 'गोपनीयता नीति',
          terms: 'सेवा की शर्तें',
          contact: 'संपर्क',
        },
        sections: {
          shop: {
            title: 'खरीदारी',
            links: {
              newArrivals: 'नए आगमन',
              bestSellers: 'सबसे ज्यादा बिकने वाले',
              sale: 'सेल',
            },
          },
          company: {
            title: 'कंपनी',
            links: {
              about: 'हमारे बारे में',
              blog: 'ब्लॉग',
            },
          },
          support: {
            title: 'सहायता',
            links: {
              helpCenter: 'सहायता केंद्र',
              contact: 'संपर्क',
              trackOrder: 'ऑर्डर ट्रैक करें',
              returns: 'रिटर्न',
            },
          },
        },
      },
    },
  },
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: supportedLanguages.map((language) => language.code),
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },
  })

export default i18n
