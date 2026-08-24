import { ArrowRight, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

const platformLinks = [
  { label: 'Home', to: '/' },
  { label: 'Marketplace', to: '/shop' },
  { label: 'Ship', to: '/ship' },
  { label: 'Track', to: '/track' },
  { label: 'Rates', to: '/rates' },
]

const PlatformHeader = () => {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const sellerUrl = '/become-a-seller'

  useEffect(() => setMenuOpen(false), [location.pathname])

  useEffect(() => {
    const onScroll = () => setIsCollapsed(window.scrollY > 48)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname === to

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 lg:px-7">
      <div className={`kb-frosted-nav mx-auto ${isCollapsed ? 'is-collapsed' : 'is-expanded'}`}>
        <div className="kb-platform-nav-inner">
          <Link to="/" className="flex shrink-0 items-center" aria-label="Kourier Boyz home">
            <img
              src="/brand/kourier-boyz-logo-nav-cropped.png"
              alt="Kourier Boyz"
              className="kb-platform-logo"
            />
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Platform navigation">
            {platformLinks.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`kb-platform-nav-link ${isActive(item.to) ? 'is-active' : ''}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden shrink-0 md:block">
            {sellerUrl.startsWith('http') ? (
              <a href={sellerUrl} className="kb-platform-cta">Sell with us <ArrowRight className="h-4 w-4" /></a>
            ) : (
              <Link to={sellerUrl} className="kb-platform-cta">Sell with us <ArrowRight className="h-4 w-4" /></Link>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-11 w-11 shrink-0 items-center justify-center border border-black/10 bg-white/45 text-[#1d1d1c] shadow-sm transition hover:bg-white/75 md:hidden"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-black/8 px-4 py-4 md:hidden">
            <nav className="grid gap-1" aria-label="Mobile platform navigation">
              {platformLinks.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`kb-platform-mobile-link ${isActive(item.to) ? 'is-active' : ''}`}
                >
                  {item.label}
                </Link>
              ))}
              {sellerUrl.startsWith('http') ? (
                <a href={sellerUrl} className="kb-platform-mobile-cta">Sell with us <ArrowRight className="h-4 w-4" /></a>
              ) : (
                <Link to={sellerUrl} className="kb-platform-mobile-cta">Sell with us <ArrowRight className="h-4 w-4" /></Link>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}

export default PlatformHeader
