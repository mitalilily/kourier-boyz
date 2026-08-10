import { driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import './SellerOnboardingTutorial.css'

/** Step with optional route to open when entering this step */
type TourStepWithNav = DriveStep & { navigateTo?: string }

const NAV_DELAY_MS = 600
const ELEMENT_POLL_MS = 50
const ELEMENT_WAIT_MAX_MS = 2500

function waitForElementThen(selector: string, fn: () => void) {
  const start = Date.now()
  const check = () => {
    if (document.querySelector(selector) || Date.now() - start > ELEMENT_WAIT_MAX_MS) {
      fn()
    } else {
      setTimeout(check, ELEMENT_POLL_MS)
    }
  }
  setTimeout(check, NAV_DELAY_MS)
}

const STORE_SETTINGS_TAB_STEPS: TourStepWithNav[] = [
  {
    navigateTo: '/store-settings?tab=general',
    element: '[data-tour="store-settings-tab-general"]',
    popover: {
      title: 'General',
      description:
        'Store name, description, logo, and banner. Set your store status (active/inactive) and choose a theme. Your store URL is based on the slug.',
      side: 'bottom',
      align: 'start',
      showButtons: ['next'],
    },
  },
  {
    navigateTo: '/store-settings?tab=contact',
    element: '[data-tour="store-settings-tab-contact"]',
    popover: {
      title: 'Contact',
      description:
        'Store email, phone, and support email. Customers use these to reach you. Keep them updated for order and return inquiries.',
      side: 'bottom',
      align: 'start',
      showButtons: ['previous', 'next'],
    },
  },
  {
    navigateTo: '/store-settings?tab=storefront',
    element: '[data-tour="store-settings-tab-storefront"]',
    popover: {
      title: 'Storefront & Catalog',
      description:
        'Homepage banners and store video. Add multiple banners and a welcome video to showcase your store to buyers.',
      side: 'bottom',
      align: 'start',
      showButtons: ['previous', 'next'],
    },
  },
  {
    navigateTo: '/store-settings?tab=policies',
    element: '[data-tour="store-settings-tab-policies"]',
    popover: {
      title: 'Policies',
      description:
        'Shipping, return, refund, cancellation, warranty, and replacement policies. Clear policies build trust and reduce disputes.',
      side: 'bottom',
      align: 'start',
      showButtons: ['previous', 'next'],
    },
  },
  {
    navigateTo: '/store-settings?tab=shipping',
    element: '[data-tour="store-settings-tab-shipping"]',
    popover: {
      title: 'Shipping & Logistics',
      description:
        'Pickup/warehouse addresses for orders. Add preferred couriers and packaging standards. RTO (return) addresses if different.',
      side: 'bottom',
      align: 'start',
      showButtons: ['previous', 'next'],
    },
  },
  {
    navigateTo: '/store-settings?tab=social',
    element: '[data-tour="store-settings-tab-social"]',
    popover: {
      title: 'Social & Links',
      description:
        'Website, Facebook, Instagram, Twitter, YouTube, LinkedIn. Link your social profiles so buyers can follow your brand.',
      side: 'bottom',
      align: 'start',
      showButtons: ['previous', 'next'],
    },
  },
  {
    navigateTo: '/store-settings?tab=seo',
    element: '[data-tour="store-settings-tab-seo"]',
    popover: {
      title: 'SEO',
      description:
        'Meta title, description, and keywords for search engines. Helps your store appear in marketplace and Google search.',
      side: 'bottom',
      align: 'start',
      showButtons: ['previous', 'next'],
    },
  },
  {
    navigateTo: '/store-settings?tab=preferences',
    element: '[data-tour="store-settings-tab-preferences"]',
    popover: {
      title: 'Preferences',
      description:
        'Notification settings: low stock alerts, new order alerts. Turn these on to stay informed.',
      side: 'bottom',
      align: 'start',
      showButtons: ['previous', 'next'],
    },
  },
  {
    navigateTo: '/store-settings?tab=compliance',
    element: '[data-tour="store-settings-tab-compliance"]',
    popover: {
      title: 'Compliance & Agreements',
      description:
        'Sign the seller agreement, accept marketplace terms, return/refund policy, prohibited items declaration, and data privacy. Required to sell.',
      side: 'bottom',
      align: 'start',
      showButtons: ['previous', 'next'],
    },
  },
]

interface StoreSettingsTutorialProps {
  run: boolean
  onComplete?: () => void
}

const StoreSettingsTutorial = ({ run, onComplete }: StoreSettingsTutorialProps) => {
  const onCompleteRef = useRef(onComplete)
  const navigate = useNavigate()
  onCompleteRef.current = onComplete

  useEffect(() => {
    if (!run) return

    const driverObj = driver({
      animate: true,
      overlayColor: '#0f172a',
      overlayOpacity: 0.75,
      showProgress: true,
      showButtons: ['next', 'previous', 'close'],
      progressText: '{{current}} of {{total}}',
      nextBtnText: 'Next',
      prevBtnText: 'Previous',
      doneBtnText: 'Done',
      popoverClass: 'seller-tour-popover',
      steps: STORE_SETTINGS_TAB_STEPS as DriveStep[],
      onPopoverRender: (popover) => {
        popover.closeButton.textContent = 'Skip'
      },
      onNextClick: (_element, _step, opts) => {
        const nextIdx = (opts.state.activeIndex ?? 0) + 1
        const nextStep = STORE_SETTINGS_TAB_STEPS[nextIdx] as TourStepWithNav | undefined
        if (nextStep?.navigateTo && typeof nextStep.element === 'string') {
          navigate(nextStep.navigateTo)
          waitForElementThen(nextStep.element, () => opts.driver.moveNext())
        } else {
          opts.driver.moveNext()
        }
      },
      onPrevClick: (_element, _step, opts) => {
        const prevIdx = (opts.state.activeIndex ?? 0) - 1
        const prevStep = STORE_SETTINGS_TAB_STEPS[prevIdx] as TourStepWithNav | undefined
        if (prevStep?.navigateTo && typeof prevStep.element === 'string') {
          navigate(prevStep.navigateTo)
          waitForElementThen(prevStep.element, () => opts.driver.movePrevious())
        } else {
          opts.driver.movePrevious()
        }
      },
      onDestroyStarted: () => {
        onCompleteRef.current?.()
        driverObj.destroy()
      },
      onDestroyed: () => {},
    })

    const t = setTimeout(() => driverObj.drive(), 400)

    return () => {
      clearTimeout(t)
      driverObj.destroy()
    }
  }, [run, navigate])

  return null
}

export default StoreSettingsTutorial
