import { NextFunction, Request, Response } from 'express'
import jwt, { TokenExpiredError } from 'jsonwebtoken'
import User from '../models/User'
import { hasPermission, ModuleName, Permission } from '../utils/permissions'

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey'

export const protect = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res
      .status(401)
      .json({ error: 'Not authorized', message: 'Missing or invalid authorization header' })
  }

  const token = authHeader.split(' ')[1]

  // Check if token is null, undefined, or empty
  if (!token || token === 'null' || token === 'undefined' || token.trim() === '') {
    return res.status(401).json({
      error: 'Token invalid',
      message: 'Authentication token is missing or invalid. Please log in again.',
    })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string
      role: string
      sessionVersion?: number
    }

    const user = await User.findById(decoded.userId).select(
      'role isBlocked blockedReason sessionVersion sellerLifecycleStatus buyerLifecycleStatus',
    )

    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }

    const currentSessionVersion = user.sessionVersion ?? 0
    const tokenSessionVersion = decoded.sessionVersion ?? 0
    if (currentSessionVersion !== tokenSessionVersion) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' })
    }

    // Check if seller account is deactivated
    if (user.role === 'seller' && user.sellerLifecycleStatus === 'DEACTIVATED') {
      return res.status(403).json({
        error: 'ACCOUNT_DEACTIVATED',
        message:
          'Your seller account has been deactivated. Please contact support for more information.',
        code: 'ACCOUNT_DEACTIVATED',
      })
    }

    // Check if buyer account is deactivated
    // Allow access to order history, refunds, returns, and tickets even if deactivated
    // but block access to other routes (like profile updates, new orders, etc.)
    const allowedDeactivatedRoutes = [
      '/orders', // Order history and details
      '/refunds', // Refund requests
      '/returns', // Return requests
      '/tickets', // Support tickets
      '/buyer/deactivation', // Deactivation status endpoint
      '/buyer/reactivate', // Reactivation endpoint
    ]
    const requestPath = req.path || req.originalUrl || ''
    const isAllowedRoute = allowedDeactivatedRoutes.some((route) => requestPath.includes(route))

    if (
      user.role === 'customer' &&
      user.buyerLifecycleStatus === 'DEACTIVATED' &&
      !isAllowedRoute
    ) {
      return res.status(403).json({
        error: 'ACCOUNT_DEACTIVATED',
        message:
          'Your account has been deactivated. You cannot access this feature. Your order history, refunds, returns, and support tickets remain accessible.',
        code: 'ACCOUNT_DEACTIVATED',
      })
    }

    // Check if user account is blocked (for customers)
    if (user.role === 'customer' && user.isBlocked) {
      return res.status(403).json({
        error: 'ACCOUNT_BLOCKED',
        message:
          user.blockedReason ||
          'Your account has been blocked. Please contact support for more information.',
        blockedReason: user.blockedReason,
      })
    }

    req.user = {
      userId: user._id.toString(),
      role: user.role,
      sessionVersion: currentSessionVersion,
    }
    next()
  } catch (err) {
    // Enhanced error logging for debugging
    if (err instanceof TokenExpiredError) {
      console.error('[Auth Middleware] Token expired:', {
        path: req.path,
        method: req.method,
        error: err.message,
      })
      return res
        .status(401)
        .json({ error: 'Token expired', message: 'Please refresh your session' })
    }

    // Log other JWT errors for debugging
    console.error('[Auth Middleware] Token validation failed:', {
      path: req.path,
      method: req.method,
      error: err instanceof Error ? err.message : String(err),
      errorName: err instanceof Error ? err.name : 'Unknown',
    })

    res.status(401).json({
      error: 'Token invalid',
      message: err instanceof Error ? err.message : 'Please log in again',
    })
  }
}

export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next()
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string
      role: string
    }

    if (decoded.role === 'customer') {
      const user = await User.findById(decoded.userId).select('isBlocked blockedReason role')
      if (user && user.isBlocked) {
        return res.status(403).json({
          error: 'ACCOUNT_BLOCKED',
          message:
            user.blockedReason ||
            'Your account has been blocked. Please contact support for more information.',
          blockedReason: user.blockedReason,
        })
      }
    }

    req.user = decoded
  } catch (err) {
    // Ignore token errors for optional auth, but ensure user stays undefined
    if (!(err instanceof TokenExpiredError)) {
      console.warn('Optional auth token invalid:', err)
    }
    req.user = undefined
  }

  next()
}

export const adminOnly = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user
  if (user?.role !== 'super-admin') return res.status(403).json({ error: 'Admin access only' })
  next()
}

// Authorize specific roles
export const authorize = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user
    if (!user) {
      console.error('[AUTHORIZE] No user in request:', { path: req.path, method: req.method })
      return res.status(403).json({ error: 'Access denied', message: 'Not authenticated' })
    }
    if (!roles.includes(user.role)) {
      console.error('[AUTHORIZE] Role mismatch:', {
        path: req.path,
        method: req.method,
        userRole: user.role,
        requiredRoles: roles,
      })
      return res.status(403).json({
        error: 'Access denied',
        message: `Role ${user.role} not authorized. Required: ${roles.join(', ')}`,
      })
    }
    next()
  }
}

/**
 * Middleware to check if seller has submitted KYC
 */
export const requireKYCSubmission = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }

    const seller = await User.findById(userId)
    if (!seller || seller.role !== 'seller') {
      res.status(404).json({ error: 'Seller not found' })
      return
    }

    if (!seller.kycSubmitted) {
      res.status(403).json({
        error: 'KYC submission required',
        message: 'Please submit your KYC documents before proceeding',
        code: 'KYC_NOT_SUBMITTED',
      })
      return
    }

    next()
  } catch (err) {
    console.error('Error in requireKYCSubmission middleware:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

/**
 * Middleware to check if seller is approved (KYC approved)
 */
export const requireKYCApproval = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }

    const seller = await User.findById(userId)
    if (!seller || seller.role !== 'seller') {
      res.status(404).json({ error: 'Seller not found' })
      return
    }

    if (!seller.kycSubmitted) {
      res.status(403).json({
        error: 'KYC submission required',
        message: 'Please submit your KYC documents first',
        code: 'KYC_NOT_SUBMITTED',
      })
      return
    }

    if (!seller.isApproved) {
      res.status(403).json({
        error: 'KYC approval required',
        message: 'Your KYC is under review. You can only save drafts until approved.',
        code: 'KYC_NOT_APPROVED',
        rejectionReason: seller.rejectionReason,
      })
      return
    }

    next()
  } catch (err) {
    console.error('Error in requireKYCApproval middleware:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

/**
 * Middleware to check if seller has completed essential store information
 */
export const requireStoreInfo = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }

    const seller = await User.findById(userId)
    if (!seller || seller.role !== 'seller') {
      res.status(404).json({ error: 'Seller not found' })
      return
    }

    // Check essential store information
    const missingInfo: string[] = []
    if (!seller.storeDescription || seller.storeDescription.trim().length === 0) {
      missingInfo.push('store description')
    }
    if (!seller.shippingPolicy || seller.shippingPolicy.trim().length === 0) {
      missingInfo.push('shipping policy')
    }
    if (!seller.returnPolicy || seller.returnPolicy.trim().length === 0) {
      missingInfo.push('return policy')
    }
    if (!seller.storeLogo) {
      missingInfo.push('store logo')
    }

    // Check contact information
    if (!seller.storeEmail || seller.storeEmail.trim().length === 0) {
      missingInfo.push('store email')
    }
    if (!seller.storePhone || seller.storePhone.trim().length === 0) {
      missingInfo.push('store phone')
    }
    if (!seller.supportEmail || seller.supportEmail.trim().length === 0) {
      missingInfo.push('support email')
    }

    // Check compliance agreements
    if (!seller.sellerAgreementSigned) {
      missingInfo.push('seller agreement signature')
    }
    if (!seller.returnRefundPolicyAccepted) {
      missingInfo.push('return & refund policy acceptance')
    }

    if (missingInfo.length > 0) {
      res.status(403).json({
        error: 'Store information incomplete',
        message: `Please complete the following: ${missingInfo.join(', ')}`,
        code: 'STORE_INFO_INCOMPLETE',
        missingFields: missingInfo,
      })
      return
    }

    next()
  } catch (err) {
    console.error('Error in requireStoreInfo middleware:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

/**
 * Combined middleware: Requires both KYC approval and store info
 */
export const requireFullSellerSetup = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  // First check KYC approval
  await requireKYCApproval(req, res, async () => {
    // Then check store info
    await requireStoreInfo(req, res, next)
  })
}

/**
 * Middleware to check if user has a specific permission for a module
 */
export const requirePermission = (module: ModuleName, permission: Permission) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId
      if (!userId) {
        res.status(401).json({ error: 'Not authenticated', message: 'User not found in request' })
        return
      }

      // Super-admin bypass: Grant all permissions immediately
      if (req.user?.role === 'super-admin') {
        return next()
      }

      const hasAccess = await hasPermission(userId, module, permission)

      if (!hasAccess) {
        res.status(403).json({
          error: 'Access denied',
          message: `You do not have ${permission} permission for ${module}`,
        })
        return
      }

      next()
    } catch (err) {
      console.error('[requirePermission] Error checking permission:', err)
      res.status(500).json({ error: 'Server error', message: 'Failed to check permissions' })
    }
  }
}

/**
 * Get the appropriate module name based on user role
 * Maps user roles to their corresponding permission modules
 */
const getModuleForRole = (role: string): ModuleName => {
  switch (role) {
    case 'seller':
      return 'sellerManagement'
    case 'customer':
      return 'customerManagement'
    default:
      return 'userManagement'
  }
}

/**
 * Middleware to check permission based on role from query parameter
 * Used for routes like GET /?role=seller
 */
export const requirePermissionByQueryRole = (permission: Permission) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { role } = req.query
      const roleStr = typeof role === 'string' ? role : undefined
      const module = getModuleForRole(roleStr || '')
      return requirePermission(module, permission)(req, res, next)
    } catch (err) {
      console.error('Error in requirePermissionByQueryRole middleware:', err)
      res.status(500).json({ error: 'Server error' })
    }
  }
}

/**
 * Middleware to check permission based on user ID in route params
 * Fetches the user first, then checks permission based on their role
 * Used for routes like GET /:id
 */
export const requirePermissionByUserId = (permission: Permission) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.params.id
      if (!userId) {
        res.status(400).json({ error: 'User ID is required' })
        return
      }

      const user = await User.findById(userId).select('role')
      if (!user) {
        res.status(404).json({ error: 'User not found' })
        return
      }

      const module = getModuleForRole(user.role)
      return requirePermission(module, permission)(req, res, next)
    } catch (err) {
      console.error('Error in requirePermissionByUserId middleware:', err)
      res.status(500).json({ error: 'Server error' })
    }
  }
}
