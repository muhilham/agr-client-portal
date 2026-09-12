import { createClient } from '@/lib/supabase/server'
import { getClientAccessByEmail } from '@/lib/clients/active-client'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const clientAccess = await getClientAccessByEmail(user.email)
  if (clientAccess.status !== 'active') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { client } = clientAccess
  const { searchParams } = req.nextUrl
  const after = searchParams.get('after') // cursor: last seen order id
  const limit = Math.min(Number(searchParams.get('limit') ?? 20), 100)

  let query = supabase
    .from('orders')
    .select('id, order_number, fulfillment_status, payment_status, total_amount, shipping_cost, created_at')
    .eq('client_id', client.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (after) {
    // Cursor: get orders older than 'after' (created_at of that order)
    const { data: cursorOrder } = await supabase
      .from('orders')
      .select('created_at')
      .eq('id', after)
      .single()

    if (cursorOrder) {
      query = query
        .lt('created_at', cursorOrder.created_at)
        .lte('id', after)
    }
  }

  const { data: orders, error } = await query

  if (error) {
    console.error('[GET /api/orders]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({ orders: orders ?? [] })
}
