import { z } from 'zod'

export const shippingSelectionSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('free') }),
  z.object({ mode: z.literal('manual') }),
  z.object({
    mode: z.literal('biteship'),
    courier_code: z.string().min(1).max(64),
    service_code: z.string().min(1).max(64),
  }),
])

export const orderItemInputSchema = z.object({
  productId: z.string().uuid(),
  // #90: concrete product_variants row for size-chip lines; omitted/absent
  // for flat products. Server derives price + label from the catalog — the
  // client can never inject a variant_label.
  variantId: z.string().uuid().optional(),
  quantity: z.number().int().positive().max(10_000),
})

export const getShippingRatesInputSchema = z.object({
  items: z.array(orderItemInputSchema).min(1).max(100),
})

export const fulfillmentMethodSchema = z.enum(['SHIPPING', 'PICKUP']).default('SHIPPING')

export const createOrderInputSchema = z
  .object({
    cartToken: z.string().uuid().optional(),
    items: z.array(orderItemInputSchema).min(1).max(100),
    notes: z.string().max(500).optional(),
    fulfillmentMethod: fulfillmentMethodSchema,
    shippingSelection: shippingSelectionSchema.optional(),
  })
  .refine(
    (data) => data.fulfillmentMethod === 'PICKUP' || data.shippingSelection != null,
    { message: 'shippingSelection is required for SHIPPING orders', path: ['shippingSelection'] }
  )

export type GetShippingRatesInput = z.infer<typeof getShippingRatesInputSchema>
export type CreateOrderInput = z.infer<typeof createOrderInputSchema>
