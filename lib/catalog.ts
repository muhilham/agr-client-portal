import { createClient } from '@/lib/supabase/server'

export type CatalogProduct = {
  id: string
  name: string
  description: string | null
  unit: string
  sku: string | null
  imageUrl: string | null
  effectivePrice: number
  minQty: number
  isGlobal: boolean
}

export async function getCatalogForClient(clientId: string): Promise<CatalogProduct[]> {
  const supabase = await createClient()

  // Fetch global products
  const { data: globalProducts, error: globalErr } = await supabase
    .from('products')
    .select('id, name, description, unit, sku, base_price, image_url, is_global')
    .eq('is_active', true)
    .eq('is_global', true)

  if (globalErr) throw globalErr

  // Fetch client-specific assigned products (non-global with overrides)
  const { data: clientProducts, error: clientErr } = await supabase
    .from('client_products')
    .select(`
      custom_price,
      min_qty,
      products (id, name, description, unit, sku, base_price, image_url, is_global, is_active)
    `)
    .eq('client_id', clientId)

  if (clientErr) throw clientErr

  const catalog = new Map<string, CatalogProduct>()

  // Add global products first
  for (const p of globalProducts ?? []) {
    catalog.set(p.id, {
      id: p.id,
      name: p.name,
      description: p.description,
      unit: p.unit,
      sku: p.sku,
      imageUrl: p.image_url,
      effectivePrice: Number(p.base_price),
      minQty: 1,
      isGlobal: true,
    })
  }

  // Merge client-specific overrides (may override global or add non-global)
  for (const cp of clientProducts ?? []) {
    const p = cp.products as unknown as {
      id: string
      name: string
      description: string | null
      unit: string
      sku: string | null
      base_price: number
      image_url: string | null
      is_global: boolean
      is_active: boolean
    } | null
    if (!p || !p.is_active) continue

    catalog.set(p.id, {
      id: p.id,
      name: p.name,
      description: p.description,
      unit: p.unit,
      sku: p.sku,
      imageUrl: p.image_url,
      effectivePrice: cp.custom_price != null ? Number(cp.custom_price) : Number(p.base_price),
      minQty: cp.min_qty ?? 1,
      isGlobal: p.is_global,
    })
  }

  return Array.from(catalog.values())
}
