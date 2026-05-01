import { z } from 'zod'

export const shippingSelectionSchema = z.object({
  courier_code: z.string().min(1).max(64),
  service_code: z.string().min(1).max(64),
})

export const orderItemInputSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive().max(10_000),
})

export const getShippingRatesInputSchema = z.object({
  items: z.array(orderItemInputSchema).min(1).max(100),
})

export const createOrderInputSchema = z.object({
  items: z.array(orderItemInputSchema).min(1).max(100),
  notes: z.string().max(500).optional(),
  shippingSelection: shippingSelectionSchema,
})

export type GetShippingRatesInput = z.infer<typeof getShippingRatesInputSchema>
export type CreateOrderInput = z.infer<typeof createOrderInputSchema>
