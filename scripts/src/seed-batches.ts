import { db, batchesTable, packagesTable, serviceTypesTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// ── Service types ──────────────────────────────────────────────────────────
const serviceTypes = [
  { name: "jastip pesawat", label: "Jastip Pesawat" },
  { name: "jastip hemat+", label: "Jastip Hemat+" },
  { name: "jastip kargo", label: "Jastip Kargo" },
  { name: "jastip pelni", label: "Jastip Pelni" },
];

const deliveryRouteByService: Record<string, string[]> = {
  "jastip pesawat": ["Jakarta → Manokwari"],
  "jastip hemat+": ["Surabaya → Manokwari"],
  "jastip kargo": ["Jakarta/Surabaya → Manokwari"],
  "jastip pelni": ["Jakarta → Manokwari", "Surabaya → Manokwari"],
};

const packagingTypes = ["Kardus", "Karung", "Kayu", "Plastik Wrap"];

const extraCustomerNames = [
  "Teh Wulan Sari",
  "Ilham Nugroho",
  "Rama Setiawan",
  "Fitriani Anggraini",
  "Bapak Yusuf Hakim",
  "Kevin Tanudjaja",
  "Melati Putri",
  "Agus Salim",
];

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getShippingRate(serviceType: string, deliveryRoute: string, weight: number): number {
  if (serviceType === "jastip pesawat") return 77000;
  if (serviceType === "jastip hemat+") return 10000;
  if (serviceType === "jastip kargo") return 7000;
  if (serviceType === "jastip pelni") {
    if (deliveryRoute === "Jakarta → Manokwari") {
      if (weight <= 10) return 20000;
      if (weight <= 20) return 19000;
      if (weight <= 40) return 18000;
      return 17000;
    }
    if (weight <= 10) return 18000;
    if (weight <= 20) return 17000;
    if (weight <= 40) return 16000;
    return 15500;
  }
  return 0;
}

function getTotalShipping(serviceType: string, deliveryRoute: string, weight: number): number {
  if (serviceType === "jastip pesawat") return Math.round(weight * 77000);
  if (serviceType === "jastip hemat+") return Math.max(10000, Math.round(weight * 10000));
  if (serviceType === "jastip kargo") return Math.max(70000, Math.round(weight * 7000));
  if (serviceType === "jastip pelni") {
    const rate = getShippingRate(serviceType, deliveryRoute, weight);
    const floor = deliveryRoute === "Jakarta → Manokwari" ? 20000 : 18000;
    return Math.max(floor, Math.round(weight * rate));
  }
  return 0;
}

type BatchSeed = {
  namaKapal: string;
  etd: string;
  periodeClosingMulai: string;
  periodeClosingSelesai: string;
  kotaAsal: string;
  tujuan: string;
  statusBatch: "OPEN" | "CLOSED" | "ARSIP";
  services: string[];
  packageCount: number;
};

const batchSeeds: BatchSeed[] = [
  {
    namaKapal: "KM Tidar",
    etd: "2026-05-10",
    periodeClosingMulai: "2026-05-01",
    periodeClosingSelesai: "2026-05-08",
    kotaAsal: "Jakarta",
    tujuan: "Manokwari",
    statusBatch: "ARSIP",
    services: ["jastip pelni", "jastip kargo"],
    packageCount: 10,
  },
  {
    namaKapal: "KM Dorolonda",
    etd: "2026-06-20",
    periodeClosingMulai: "2026-06-10",
    periodeClosingSelesai: "2026-06-17",
    kotaAsal: "Jakarta",
    tujuan: "Manokwari",
    statusBatch: "CLOSED",
    services: ["jastip pelni", "jastip pesawat"],
    packageCount: 8,
  },
  {
    namaKapal: "KM Sinar Papua",
    etd: "2026-07-25",
    periodeClosingMulai: "2026-07-14",
    periodeClosingSelesai: "2026-07-21",
    kotaAsal: "Surabaya",
    tujuan: "Manokwari",
    statusBatch: "OPEN",
    services: ["jastip hemat+", "jastip pelni"],
    packageCount: 9,
  },
  {
    namaKapal: "KM Ciremai",
    etd: "2026-08-05",
    periodeClosingMulai: "2026-07-25",
    periodeClosingSelesai: "2026-08-01",
    kotaAsal: "Jakarta",
    tujuan: "Manokwari",
    statusBatch: "OPEN",
    services: ["jastip kargo", "jastip pesawat"],
    packageCount: 6,
  },
];

async function seed() {
  console.log("Seeding service types...");
  const serviceTypeIds: Record<string, number> = {};
  for (const st of serviceTypes) {
    const existing = await db
      .select()
      .from(serviceTypesTable)
      .where(eq(serviceTypesTable.name, st.name))
      .limit(1);
    if (existing[0]) {
      serviceTypeIds[st.name] = existing[0].id;
      console.log(`  Already exists: ${st.label} — skipping`);
      continue;
    }
    const [row] = await db.insert(serviceTypesTable).values(st).returning();
    serviceTypeIds[st.name] = row.id;
    console.log(`  Created: ${st.label}`);
  }

  console.log("\nLooking up owner/admin and customer accounts...");
  const admins = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.role, "admin"));
  const customers = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.role, "customer"));
  const adminId = admins[0]?.id;
  console.log(`  Found ${admins.length} admin(s), ${customers.length} customer(s)`);

  console.log("\nSeeding batches + packages...");
  let totalPackages = 0;

  for (const seed of batchSeeds) {
    const existingBatch = await db
      .select()
      .from(batchesTable)
      .where(eq(batchesTable.namaKapal, seed.namaKapal))
      .limit(1);
    if (existingBatch[0]) {
      console.log(`  Batch "${seed.namaKapal}" already exists — skipping`);
      continue;
    }

    const [batch] = await db
      .insert(batchesTable)
      .values({
        namaKapal: seed.namaKapal,
        etd: seed.etd,
        periodeClosingMulai: seed.periodeClosingMulai,
        periodeClosingSelesai: seed.periodeClosingSelesai,
        kotaAsal: seed.kotaAsal,
        tujuan: seed.tujuan,
        statusBatch: seed.statusBatch,
        createdBy: adminId,
      })
      .returning();

    console.log(`  Batch created: ${seed.namaKapal} (id=${batch.id}, ${seed.statusBatch})`);

    for (let i = 0; i < seed.packageCount; i++) {
      const serviceType = pick(seed.services);
      const deliveryRoute = pick(deliveryRouteByService[serviceType]);
      const useCustomerAccount = Math.random() < 0.5 && customers.length > 0;
      const customer = useCustomerAccount ? pick(customers) : null;
      const customerName = customer ? customer.name : pick(extraCustomerNames);

      const realWeight = serviceType === "jastip kargo" ? rand(15, 80) : rand(0.2, 8);
      const usedWeight = serviceType === "jastip kargo" ? Math.max(realWeight, rand(15, 80)) : realWeight;
      const totalShipping = getTotalShipping(serviceType, deliveryRoute, usedWeight);
      const shippingRate = getShippingRate(serviceType, deliveryRoute, usedWeight);

      // Older batches (ARSIP/CLOSED) are fully processed; the open batches
      // have a realistic in-flight mix of statuses.
      const isArchived = seed.statusBatch !== "OPEN";
      const status = isArchived || Math.random() < 0.6 ? "diserahkan" : "pending";
      const statusVerifikasi = isArchived || Math.random() < 0.75 ? "SUDAH_DIVERIFIKASI" : "BELUM_DIVERIFIKASI";
      const statusPengambilan = status === "diserahkan" ? "SUDAH_DIAMBIL" : "BELUM_DIAMBIL";
      const statusPembayaran = isArchived
        ? "SUDAH_DIBAYAR"
        : pick(["BELUM_DIBAYAR", "DP", "SUDAH_DIBAYAR"] as const);

      const rnd = Math.random().toString(36).slice(2, 10);
      const barcode = `JAJ-${Date.now().toString(36)}${i}-${rnd}`;
      const packageDate = new Date(seed.periodeClosingMulai);
      packageDate.setDate(packageDate.getDate() + Math.floor(rand(0, 5)));

      await db.insert(packagesTable).values({
        barcode,
        resiNumber: `${rnd.toUpperCase()}${Math.floor(rand(100, 999))}`,
        packageNumber: `PKT-${batch.id}-${String(i + 1).padStart(2, "0")}`,
        packagingType: pick(packagingTypes),
        serviceType,
        serviceTypeId: serviceTypeIds[serviceType],
        deliveryRoute,
        realWeight: realWeight.toFixed(2),
        usedWeight: usedWeight.toFixed(2),
        totalWeight: usedWeight.toFixed(2),
        shippingRate: shippingRate.toFixed(2),
        totalShipping: totalShipping.toFixed(2),
        status,
        statusVerifikasi,
        statusPengambilan,
        statusPembayaran,
        verified: statusVerifikasi === "SUDAH_DIVERIFIKASI" ? "sudah_diverifikasi" : "belum_diverifikasi",
        verifiedAt: statusVerifikasi === "SUDAH_DIVERIFIKASI" ? new Date() : null,
        pickedUpAt: statusPengambilan === "SUDAH_DIAMBIL" ? new Date() : null,
        batchId: batch.id,
        customerName,
        customerId: customer?.id,
        adminId,
        packageDate,
      });
      totalPackages++;
    }
    console.log(`    Seeded ${seed.packageCount} packages`);
  }

  console.log(`\nDone. ${batchSeeds.length} batches processed, ${totalPackages} packages created.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
