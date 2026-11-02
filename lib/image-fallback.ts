export type ImageDisplayState = 'image' | 'placeholder'

/**
 * Decide what a product card should render for its image slot.
 *
 * `imageUrl` may point at a CDN asset that no longer exists (lost in the
 * Oct-26 R2 re-seed) — the <Image> onError then flips `failed`, and we fall
 * back to the placeholder instead of showing a broken icon or re-fetching
 * the dead URL (the failed flag is the loop guard: we never swap srcs).
 */
export function imageDisplayState(
  imageUrl: string | null | undefined,
  failed = false,
): ImageDisplayState {
  if (!imageUrl || failed) return 'placeholder'
  return 'image'
}
