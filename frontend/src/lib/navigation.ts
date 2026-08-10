export const isShopPath = (pathname: string) =>
  pathname === '/shop' ||
  pathname === '/store' ||
  pathname.startsWith('/product/') ||
  pathname.startsWith('/products/') ||
  pathname.startsWith('/shop-by-category') ||
  pathname.startsWith('/search') ||
  pathname.startsWith('/cart') ||
  pathname.startsWith('/profile') ||
  pathname.startsWith('/orders') ||
  pathname.startsWith('/wishlist') ||
  pathname.startsWith('/events/deals') ||
  pathname.startsWith('/best-sellers') ||
  pathname.startsWith('/seller/')
