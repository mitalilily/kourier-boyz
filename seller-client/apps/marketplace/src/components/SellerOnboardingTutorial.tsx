import { driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMarkOnboardingTourCompleted } from '../api/profileQueries'
import './SellerOnboardingTutorial.css'

export const SELLER_TUTORIAL_STORAGE_KEY = 'seller_platform_tutorial_completed'

/** Step with optional route to open when entering this step */
type TourStepWithNav = DriveStep & { navigateTo?: string }

const NAV_DELAY_MS = 800
const ELEMENT_POLL_MS = 50
const ELEMENT_WAIT_MAX_MS = 3000

/** Poll until element exists, then call fn. Fallback to fn after timeout. */
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

const TOUR_STEPS: TourStepWithNav[] = [
  {
    element: '[data-tour="dashboard-welcome"]',
    popover: {
      title: 'Welcome to Kourier Boyz Seller Hub',
      description: 'This tour shows key sections. Use Next to move through each page, or Skip to exit.',
      side: 'bottom',
      align: 'start',
      showButtons: ['next'],
    },
  },
  {
    element: '.seller-tour-dashboard',
    popover: {
      title: 'Dashboard',
      description:
        'Your home screen. Here you’ll see store stats, recent orders, quick actions, and alerts. Use the cards and links to jump to products, orders, or settings.',
      side: 'right',
      align: 'start',
      showButtons: ['previous', 'next'],
    },
  },
  {
    navigateTo: '/products',
    element: '[data-tour="add-product-btn"]',
    popover: {
      title: 'Products',
      description:
        'On this page: Click “Add product” to create a listing. Fill in name, price, category, images, and inventory. Complete Profile and Store Settings first so you can publish. You can save as draft and publish later.',
      side: 'right',
      align: 'start',
      showButtons: ['previous', 'next'],
    },
  },
  {
    navigateTo: '/categories',
    element: '[data-tour="request-category-btn"]',
    popover: {
      title: 'Categories',
      description:
        'On this page: Click “Request a category” and choose the category you want to sell in. After approval, you can assign it to products. Products must have a category to be published.',
      side: 'right',
      align: 'start',
      showButtons: ['previous', 'next'],
    },
  },
  {
    navigateTo: '/brands',
    element: '[data-tour="request-brand-btn"]',
    popover: {
      title: 'Brands',
      description:
        'On this page: If you sell branded goods, click “Request a brand” and upload your trademark or authorization letter. Once approved, you can assign that brand to products when creating listings.',
      side: 'right',
      align: 'start',
      showButtons: ['previous', 'next'],
    },
  },
  {
    navigateTo: '/orders',
    element: '.seller-tour-orders',
    popover: {
      title: 'Orders',
      description: 'View and process orders. Ship on time and add tracking.',
      side: 'right',
      align: 'start',
      showButtons: ['previous', 'next'],
    },
  },
  {
    navigateTo: '/profile',
    element: '.seller-tour-profile',
    popover: {
      title: 'Profile & Store Settings',
      description:
        'Complete business details, KYC, bank info, and store policies—required to publish products.',
      side: 'right',
      align: 'start',
      showButtons: ['previous', 'next'],
    },
  },
  {
    navigateTo: '/dashboard',
    element: '[data-tour="seller-header"]',
    popover: {
      title: "You're all set",
      description: 'Use the bell icon for alerts. Replay this tour anytime from the header.',
      side: 'bottom',
      align: 'end',
      showButtons: ['previous', 'next'],
    },
  },
]

function markCompleted() {
  try {
    localStorage.setItem(SELLER_TUTORIAL_STORAGE_KEY, 'true')
  } catch {
    // ignore
  }
}

interface SellerOnboardingTutorialProps {
  run: boolean
  onComplete?: () => void
}

/**
 * Runs a driver.js guided tour of the seller panel: dashboard, sidebar sections, and header.
 * Tour completion is stored in the backend; localStorage is used as fallback.
 */
const SellerOnboardingTutorial = ({ run, onComplete }: SellerOnboardingTutorialProps) => {
  const driverRef = useRef<ReturnType<typeof driver> | null>(null)
  const onCompleteRef = useRef(onComplete)
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  const markTourCompletedMutation = useMarkOnboardingTourCompleted()
  navigateRef.current = navigate
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
      doneBtnText: 'Finish',
      popoverClass: 'seller-tour-popover',
      steps: TOUR_STEPS as DriveStep[],
      onPopoverRender: (popover) => {
        popover.closeButton.textContent = 'Skip tutorial'
      },
      onNextClick: (_element, _step, opts) => {
        const nextIdx = (opts.state.activeIndex ?? 0) + 1
        const nextStep = TOUR_STEPS[nextIdx] as TourStepWithNav | undefined
        if (nextStep?.navigateTo && typeof nextStep.element === 'string') {
          navigateRef.current(nextStep.navigateTo)
          waitForElementThen(nextStep.element, () => opts.driver.moveNext())
        } else {
          opts.driver.moveNext()
        }
      },
      onPrevClick: (_element, _step, opts) => {
        const prevIdx = (opts.state.activeIndex ?? 0) - 1
        const prevStep = TOUR_STEPS[prevIdx] as TourStepWithNav | undefined
        if (prevStep?.navigateTo && typeof prevStep.element === 'string') {
          navigateRef.current(prevStep.navigateTo)
          waitForElementThen(prevStep.element, () => opts.driver.movePrevious())
        } else {
          opts.driver.movePrevious()
        }
      },
      onDestroyStarted: () => {
        markTourCompletedMutation.mutate(undefined, {
          onSettled: () => {
            markCompleted()
            onCompleteRef.current?.()
            driverObj.destroy()
          },
        })
      },
      onDestroyed: () => {
        driverRef.current = null
      },
    })

    driverRef.current = driverObj

    const t = setTimeout(() => {
      driverObj.drive()
    }, 300)

    return () => {
      clearTimeout(t)
      driverObj.destroy()
      driverRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- onComplete/navigate in refs to avoid tour destruction on route change
  }, [run])

  return null
}

export default SellerOnboardingTutorial
