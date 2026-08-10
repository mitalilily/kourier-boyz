import type { Rule } from 'antd/es/form'

/**
 * Reusable validation rules for forms
 */

// Email validation rules
export const emailRules: Rule[] = [
  { required: true, message: 'Please enter your email address' },
  { type: 'email', message: 'Please enter a valid email address' },
  {
    pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    message: 'Please enter a valid email format',
  },
  { max: 100, message: 'Email must not exceed 100 characters' },
]

// Password validation rules
export const passwordRules: Rule[] = [
  { required: true, message: 'Please enter your password' },
  { min: 6, message: 'Password must be at least 6 characters' },
  { max: 50, message: 'Password must not exceed 50 characters' },
]

// Strong password validation rules (with letters and numbers)
export const strongPasswordRules: Rule[] = [
  ...passwordRules,
  {
    pattern: /^(?=.*[a-zA-Z])(?=.*[0-9])/,
    message: 'Password must contain at least one letter and one number',
  },
]

// Name validation rules
export const nameRules: Rule[] = [
  { required: true, message: 'Please enter your full name' },
  { min: 2, message: 'Name must be at least 2 characters' },
  { max: 100, message: 'Name must not exceed 100 characters' },
  {
    pattern: /^[a-zA-Z\s]+$/,
    message: 'Name can only contain letters and spaces',
  },
  {
    whitespace: true,
    message: 'Name cannot be empty or just spaces',
  },
]

// Phone validation rules (Indian mobile numbers - 10 digits starting with 6-9)
export const phoneRules: Rule[] = [
  { required: true, message: 'Please enter your phone number' },
  {
    pattern: /^[6-9]\d{9}$/,
    message: 'Please enter a valid 10-digit mobile number',
  },
]

// International phone validation rules (flexible format)
export const internationalPhoneRules: Rule[] = [
  { required: true, message: 'Please enter your phone number' },
  {
    pattern: /^[+]?[\d\s-()]{10,15}$/,
    message: 'Please enter a valid phone number (10-15 digits)',
  },
]

// Business name validation rules
export const businessNameRules: Rule[] = [
  { required: true, message: 'Please enter your business name' },
  { min: 2, message: 'Business name must be at least 2 characters' },
  { max: 200, message: 'Business name must not exceed 200 characters' },
  {
    whitespace: true,
    message: 'Business name cannot be empty or just spaces',
  },
]

// Business address validation rules
export const businessAddressRules: Rule[] = [
  { required: true, message: 'Please enter your business address' },
  { min: 10, message: 'Business address must be at least 10 characters' },
  { max: 500, message: 'Business address must not exceed 500 characters' },
  {
    whitespace: true,
    message: 'Business address cannot be empty or just spaces',
  },
]

// GST number validation rules (Indian GST format)
export const gstNumberRules: Rule[] = [
  {
    pattern: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
    message: 'Please enter a valid GST number (e.g., 22AAAAA0000A1Z5)',
  },
]

// Required field validation
export const requiredRule: Rule = {
  required: true,
  message: 'This field is required',
}

// URL validation rules
export const urlRules: Rule[] = [
  {
    type: 'url',
    message: 'Please enter a valid URL',
  },
]

// Number validation rules
export const numberRules: Rule[] = [
  {
    type: 'number',
    message: 'Please enter a valid number',
  },
]

// Positive number validation
export const positiveNumberRules: Rule[] = [
  ...numberRules,
  {
    type: 'number',
    min: 0,
    message: 'Value must be a positive number',
  },
]

// Custom validator for confirming password
export const confirmPasswordValidator =
  (passwordField: string = 'password') =>
  ({ getFieldValue }: { getFieldValue: (field: string) => string }): Rule => ({
    validator(_, value) {
      if (!value || getFieldValue(passwordField) === value) {
        return Promise.resolve()
      }
      return Promise.reject(new Error('The two passwords do not match'))
    },
  })
