/**
 * Client-safe address display helpers (#101).
 *
 * Kept out of lib/shipping.ts on purpose: that module imports the
 * service-role Supabase client (`server-only`), so any *value* import from it in
 * a client component fails the build. Types alone are erased and are fine.
 */

/**
 * Labels are optional free text in the ops dashboard (1 of 39 live rows is
 * blank), so the picker always needs a readable fallback per position.
 */
export function addressLabelText(address: { label?: string | null }, index: number): string {
  const label = address.label?.trim()
  return label ? label : `Alamat ${index + 1}`
}
