import { z } from 'zod';

/**
 * Common validation schemas and helpers
 * Reusable validators for addresses, contacts, dates, etc.
 */

/**
 * Address schema
 */
export const addressSchema = z.object({
  street: z.string().min(1, 'Street address is required'),
  city: z.string().min(1, 'City is required'),
  county: z.string().optional(),
  state: z.string().length(2, 'State must be 2-letter code (e.g., CA)'),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code format'),
  country: z.string().length(2, 'Country must be 2-letter code (e.g., US)').default('US'),
});

export type Address = z.infer<typeof addressSchema>;

/**
 * Contact schema
 */
export const contactSchema = z.object({
  email: z.string().email('Invalid email address'),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number (use E.164 format)'),
  primary_contact_name: z.string().min(1, 'Contact name is required').optional(),
});

export type Contact = z.infer<typeof contactSchema>;

/**
 * Pagination schema
 */
export const paginationSchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).default('20'),
  sort_by: z.string().optional(),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

export type Pagination = z.infer<typeof paginationSchema>;

/**
 * ObjectId validator
 */
export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId format');

/**
 * Date range validator
 */
export const dateRangeSchema = z.object({
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
}).refine(
  (data) => {
    if (data.start_date && data.end_date) {
      return new Date(data.start_date) <= new Date(data.end_date);
    }
    return true;
  },
  { message: 'start_date must be before end_date' }
);

export type DateRange = z.infer<typeof dateRangeSchema>;

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  return z.string().email().safeParse(email).success;
}

/**
 * Validate phone format (E.164)
 */
export function isValidPhone(phone: string): boolean {
  return /^\+?[1-9]\d{1,14}$/.test(phone);
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate MongoDB ObjectId
 */
export function isValidObjectId(id: string): boolean {
  return /^[a-f\d]{24}$/i.test(id);
}

/**
 * Sanitize user input (XSS prevention via HTML entity encoding)
 */
export function sanitizeInput(input: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
  };
  return input
    .replace(/[&<>"'\/]/g, (char) => htmlEntities[char] || char)
    .trim();
}

/**
 * Validate date is not in the past
 */
export function isNotPastDate(date: Date): boolean {
  return date.getTime() > Date.now();
}

/**
 * Validate date is within expiration threshold
 */
export function isExpiringWithin(date: Date, daysThreshold: number): boolean {
  const thresholdMs = daysThreshold * 24 * 60 * 60 * 1000;
  return date.getTime() - Date.now() <= thresholdMs && date.getTime() > Date.now();
}

/**
 * Validate date is expired
 */
export function isExpired(date: Date): boolean {
  return date.getTime() < Date.now();
}
