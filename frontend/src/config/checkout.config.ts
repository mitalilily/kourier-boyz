import { Smartphone, Wallet } from 'lucide-react'

export interface PaymentMethod {
  id: string
  name: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  type: 'cod' | 'card' | 'upi' | 'wallet'
  available: boolean
}

export interface UPIOption {
  id: string
  name: string
  upiId?: string
  icon?: string
  color: string
}

export const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: 'cod',
    name: 'Cash on Delivery',
    description: 'Pay when you receive',
    icon: Wallet,
    type: 'cod',
    available: true,
  },
  {
    id: 'razorpay',
    name: 'Online Payment',
    description: 'Pay securely via UPI or card',
    icon: Smartphone,
    type: 'upi',
    available: true,
  },
]

export const UPI_OPTIONS: UPIOption[] = [
  {
    id: 'phonepe',
    name: 'PhonePe',
    color: '#5F259F',
  },
  {
    id: 'gpay',
    name: 'Google Pay',
    color: '#4285F4',
  },
  {
    id: 'paytm',
    name: 'Paytm',
    color: '#00BAF2',
  },
  {
    id: 'bhim',
    name: 'BHIM UPI',
    color: '#FF6F00',
  },
  {
    id: 'amazon-pay',
    name: 'Amazon Pay',
    color: '#FF9900',
  },
  {
    id: 'cred',
    name: 'CRED',
    color: '#000000',
  },
]

export const CHECKOUT_STEPS = [
  { id: 'address', label: 'Address', number: 1 },
  { id: 'payment', label: 'Payment', number: 2 },
  { id: 'review', label: 'Review', number: 3 },
] as const

export type CheckoutStep = (typeof CHECKOUT_STEPS)[number]['id']
