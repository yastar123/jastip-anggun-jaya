-- Performance indexes for the packages table.
-- Run this once on the production database to speed up the barcode page
-- and all other pages that filter packages.
--
-- CONCURRENTLY means the indexes are built without locking the table,
-- so the app stays available while they're created.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_packages_status
  ON packages(status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_packages_status_pengambilan
  ON packages(status_pengambilan);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_packages_batch_id
  ON packages(batch_id);

-- Composite index used by the barcode page (batch + active-status filter)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_packages_batch_status
  ON packages(batch_id, status, status_pengambilan);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_packages_created_at
  ON packages(created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_packages_customer_name
  ON packages(customer_name);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_packages_service_type
  ON packages(service_type);
