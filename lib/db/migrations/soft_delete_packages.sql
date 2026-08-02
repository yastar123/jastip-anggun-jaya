-- Soft-delete untuk tabel packages.
-- Jalankan satu kali di database production (VPS) setelah deploy kode terbaru.
--
-- Kolom deleted_at: NULL = paket aktif, diisi timestamp = sudah dihapus (soft-delete).
-- Data tidak benar-benar terhapus sehingga masih bisa dipulihkan jika diperlukan.

ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
