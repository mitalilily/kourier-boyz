/**
 * SLA Rules Configuration
 * Defines SLA hours based on ticket category and priority
 */

export type TicketCategory =
  | 'order'
  | 'refund'
  | 'product'
  | 'account'
  | 'shipping'
  | 'payment'
  | 'technical'
  | 'settlement'
  | 'ledger'
  | 'payout'
  | 'other'

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'

// Map category to priority-based SLA hours
export const SLA_RULES: Record<string, Record<TicketPriority, number>> = {
  payment: { low: 48, medium: 24, high: 12, urgent: 6 },
  order: { low: 72, medium: 48, high: 24, urgent: 12 },
  technical: { low: 96, medium: 72, high: 48, urgent: 24 },
  settlement: { low: 72, medium: 48, high: 24, urgent: 12 },
  ledger: { low: 72, medium: 48, high: 24, urgent: 12 },
  payout: { low: 72, medium: 48, high: 24, urgent: 12 },
  refund: { low: 48, medium: 24, high: 12, urgent: 6 },
  shipping: { low: 72, medium: 48, high: 24, urgent: 12 },
  product: { low: 96, medium: 72, high: 48, urgent: 24 },
  account: { low: 48, medium: 24, high: 12, urgent: 6 },
  other: { low: 96, medium: 72, high: 48, urgent: 24 },
}

/**
 * Get SLA hours for a ticket based on category and priority
 */
export const getSlaHours = (
  category: TicketCategory,
  priority: TicketPriority,
): number => {
  const categoryRules = SLA_RULES[category.toLowerCase()]
  if (!categoryRules) {
    // Default to 'other' category rules
    return SLA_RULES.other[priority]
  }
  return categoryRules[priority]
}

/**
 * Calculate SLA deadline from creation date and SLA hours
 */
export const calculateSlaDeadline = (createdAt: Date, slaHours: number): Date => {
  return new Date(createdAt.getTime() + slaHours * 60 * 60 * 1000)
}

/**
 * Check if SLA is breached for an open ticket
 */
export const isSlaBreached = (
  status: string,
  createdAt: Date,
  slaHours: number,
  now: Date = new Date(),
): boolean => {
  if (status === 'closed') {
    return false
  }
  const deadline = calculateSlaDeadline(createdAt, slaHours)
  return now > deadline
}

/**
 * Check if SLA was breached for a closed ticket
 */
export const wasSlaBreached = (
  createdAt: Date,
  resolvedAt: Date | undefined,
  slaHours: number,
): boolean => {
  if (!resolvedAt) {
    return false
  }
  const resolutionTimeHours = (resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60)
  return resolutionTimeHours > slaHours
}

/**
 * Calculate current age of ticket in hours
 */
export const calculateTicketAge = (createdAt: Date, now: Date = new Date()): number => {
  return (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60)
}

/**
 * Get SLA status (AT_RISK, BREACHED, or WITHIN_SLA)
 */
export const getSlaStatus = (
  status: string,
  createdAt: Date,
  slaHours: number,
  now: Date = new Date(),
): 'AT_RISK' | 'BREACHED' | 'WITHIN_SLA' => {
  if (status === 'closed') {
    return 'WITHIN_SLA'
  }

  const age = calculateTicketAge(createdAt, now)
  const deadline = calculateSlaDeadline(createdAt, slaHours)

  if (now > deadline) {
    return 'BREACHED'
  }

  // At risk if more than 75% of SLA time has passed
  if (age > 0.75 * slaHours) {
    return 'AT_RISK'
  }

  return 'WITHIN_SLA'
}



















