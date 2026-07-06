/**
 * One-time migration: create service_types reference data, create the
 * "Batch Legacy" sentinel batch, then backfill all existing packages
 * that are missing batch_id / service_type_id / new status fields.
 *
 * Run with: npx tsx scripts/migrate-batch-legacy.ts
 */

import { db, serviceTypesTable, batchesTable, packagesTable, paymentsTable } from "@workspace/db";
import { isNull, sql, eq, inArray } from "drizzle-orm";

const SERVICE_TYPE_MAP: Record<string, string> = {
  "jastip hemat+": "Jastip Hemat+",
  "jastip pesawat": "Jastip Pesawat",
  "jastip kargo": "Jastip Kargo",
  "jastip pelni": "Jastip Pelni",
};

async function main() {
  console.log("=== Jastip Anggun Jaya — Batch Legacy Migration ===\n");

  await db.transaction(async (tx) => {
    // ── 1. Seed service_types ──────────────────────────────────────────────
    console.log("Step 1: Seeding service_types table…");
    for (const [name, label] of Object.entries(SERVICE_TYPE_MAP)) {
      await tx
        .insert(serviceTypesTable)
        .values({ name, label })
        .onConflictDoNothing();
    }
    const allTypes = await tx.select().from(serviceTypesTable);
    console.log(`  ✓ ${allTypes.length} service types in table`);
    const typeByName = new Map(allTypes.map((t) => [t.name, t.id]));

    // ── 2. Create / fetch legacy batch ─────────────────────────────────────
    console.log("Step 2: Creating legacy batch…");
    const LEGACY_NAME = "Batch Legacy - Data Sebelum Fitur Batch";
    let legacyBatch = (
      await tx
        .select()
        .from(batchesTable)
        .where(eq(batchesTable.namaKapal, LEGACY_NAME))
        .limit(1)
    )[0];

    if (!legacyBatch) {
      const inserted = await tx
        .insert(batchesTable)
        .values({
          namaKapal: LEGACY_NAME,
          etd: "2024-01-01",
          periodeClosingMulai: "2024-01-01",
          periodeClosingSelesai: "2024-01-01",
          kotaAsal: "Jakarta/Surabaya/Makassar",
          tujuan: "Manokwari",
          statusBatch: "ARSIP",
        })
        .returning();
      legacyBatch = inserted[0];
      console.log(`  ✓ Created legacy batch id=${legacyBatch.id}`);
    } else {
      console.log(`  ✓ Legacy batch already exists id=${legacyBatch.id}`);
    }

    // ── 3. Count packages before ──────────────────────────────────────────
    const [{ countBefore }] = await tx
      .select({ countBefore: sql<number>`count(*)::int` })
      .from(packagesTable);
    console.log(`\nStep 3: Packages before migration: ${countBefore}`);

    // ── 4. Backfill batchId for packages without one ──────────────────────
    console.log("Step 4: Backfilling batch_id for legacy packages…");
    const batchResult = await tx
      .update(packagesTable)
      .set({ batchId: legacyBatch.id })
      .where(isNull(packagesTable.batchId));
    console.log(`  ✓ Updated packages missing batch_id`);

    // ── 5. Backfill serviceTypeId based on serviceType text ───────────────
    console.log("Step 5: Backfilling service_type_id…");
    for (const [name, id] of typeByName.entries()) {
      await tx
        .update(packagesTable)
        .set({ serviceTypeId: id })
        .where(
          sql`${packagesTable.serviceType} = ${name} AND ${packagesTable.serviceTypeId} IS NULL`,
        );
    }
    console.log(`  ✓ service_type_id backfilled`);

    // ── 6. Backfill statusVerifikasi from verified ────────────────────────
    console.log("Step 6: Backfilling status_verifikasi from verified…");
    await tx.execute(sql`
      UPDATE packages
      SET status_verifikasi = CASE
        WHEN verified = 'sudah_diverifikasi' THEN 'SUDAH_DIVERIFIKASI'
        ELSE 'BELUM_DIVERIFIKASI'
      END
      WHERE status_verifikasi = 'BELUM_DIVERIFIKASI'
    `);
    console.log(`  ✓ status_verifikasi updated`);

    // ── 7. Backfill statusPengambilan from status ─────────────────────────
    console.log("Step 7: Backfilling status_pengambilan from status…");
    await tx.execute(sql`
      UPDATE packages
      SET status_pengambilan = CASE
        WHEN status = 'diserahkan' THEN 'SUDAH_DIAMBIL'
        ELSE 'BELUM_DIAMBIL'
      END
      WHERE status_pengambilan = 'BELUM_DIAMBIL'
    `);
    console.log(`  ✓ status_pengambilan updated`);

    // ── 8. Backfill statusPembayaran from payments table ──────────────────
    console.log("Step 8: Backfilling status_pembayaran from payments…");
    const allPayments = await tx.select({ packageIds: paymentsTable.packageIds }).from(paymentsTable);
    const paidPackageIds = new Set<number>();
    for (const payment of allPayments) {
      const ids = payment.packageIds as number[];
      if (Array.isArray(ids)) ids.forEach((id) => paidPackageIds.add(id));
    }
    if (paidPackageIds.size > 0) {
      await tx
        .update(packagesTable)
        .set({ statusPembayaran: "SUDAH_DIBAYAR" })
        .where(
          sql`id = ANY(${sql.raw(`ARRAY[${Array.from(paidPackageIds).join(",")}]::int[]`)}) AND status_pembayaran = 'BELUM_DIBAYAR'`,
        );
      console.log(`  ✓ Marked ${paidPackageIds.size} paid package IDs as SUDAH_DIBAYAR`);
    } else {
      console.log(`  ✓ No payments found — all packages remain BELUM_DIBAYAR`);
    }

    // ── 9. Count packages after ────────────────────────────────────────────
    const [{ countAfter }] = await tx
      .select({ countAfter: sql<number>`count(*)::int` })
      .from(packagesTable);
    console.log(`\nStep 9: Packages after migration: ${countAfter}`);

    if (countBefore !== countAfter) {
      throw new Error(
        `Row count mismatch! Before=${countBefore} After=${countAfter} — rolling back.`,
      );
    }
    console.log("  ✓ Row count verified — no data lost");
  });

  console.log("\n✅ Migration completed successfully.");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Migration failed:", err);
  process.exit(1);
});
