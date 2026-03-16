-- Clients can insert their own orders
CREATE POLICY "orders_client_insert" ON orders
  FOR INSERT WITH CHECK (
    client_id = (SELECT id FROM clients
                 WHERE email = auth.jwt()->>'email')
  );

-- Clients can insert order_items for their own orders
CREATE POLICY "order_items_client_insert" ON order_items
  FOR INSERT WITH CHECK (
    order_id IN (
      SELECT id FROM orders WHERE client_id = (
        SELECT id FROM clients
        WHERE email = auth.jwt()->>'email'
      )
    )
  );
