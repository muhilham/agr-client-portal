import { getSupabaseAdmin } from '@/lib/supabase/admin'

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
  isClientAssigned: boolean
  shipWeightGrams: number
}

type ProductRow = {
  id: string
  name: string
  description: string | null
  unit: string
  sku: string | null
  base_price: number
  image_url: string | null
  is_global: boolean
  is_active: boolean
  ship_weight_grams: number
}

type ClientProductRow = {
  custom_price: number | null
  min_qty: number | null
  variant_id: string | null
  products: ProductRow | null
}

export async function getCatalogForClient(clientId: string): Promise<CatalogProduct[]> {
  const supabase = getSupabaseAdmin()

  const { data: globalProducts, error: globalErr } = await supabase
    .from('products')
    .select('id, name, description, unit, sku, base_price, image_url, is_global, is_active, ship_weight_grams')
    .eq('is_active', true)
    .eq('is_global', true)
    .returns<ProductRow[]>()

  if (globalErr) throw globalErr

  const { data: clientProducts, error: clientErr } = await supabase
    .from('client_products')
    .select(
      'custom_price, min_qty, variant_id, products (id, name, description, unit, sku, base_price, image_url, is_global, is_active, ship_weight_grams)'
    )
    .eq('client_id', clientId)
    // agr-ops #297 (migration 068): client_products can now hold per-variant
    // cliff rows (variant_id NOT NULL). The portal still sells FLAT products
    // (size-chip UI is portal #90, not built yet) — a variant cliff belongs to
    // ONE size and must never price the whole product. Until #90 ships, only
    // the whole-product row (variant_id IS NULL) may override the catalog.
    .is('variant_id', null)
    .returns<ClientProductRow[]>()

  if (clientErr) throw clientErr

  const catalog = new Map<string, CatalogProduct>()

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
      isClientAssigned: false,
      shipWeightGrams: Number(p.ship_weight_grams),
    })
  }

  for (const cp of clientProducts ?? []) {
    const p = cp.products
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
      isClientAssigned: true,
      shipWeightGrams: Number(p.ship_weight_grams),
    })
  }

  return Array.from(catalog.values())
}
