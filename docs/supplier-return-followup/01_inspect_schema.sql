-- READ ONLY. Run manually on the intended database; send the result before DDL.
-- No credentials and no live connection are used by the agent.
SELECT DATABASE() AS database_name,
       TABLE_NAME AS table_name,
       COLUMN_NAME AS column_name,
       COLUMN_TYPE AS column_type,
       IS_NULLABLE AS is_nullable,
       COLUMN_KEY AS column_key
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN (
    'warehouse_returns', 'return_documents', 'inventory_lots',
    'warehouse_receipts', 'warehouse_receipt_items',
    'purchase_orders', 'purchase_order_items', 'po_pricing_batches',
    'purchase_package_submissions', 'supplier_return_cases',
    'supplier_return_events', 'supplier_return_replacement_links',
    'supplier_return_settlements'
  )
ORDER BY TABLE_NAME, ORDINAL_POSITION;
