import {
  pgTable,
  serial,
  text,
  numeric,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const packagesTable = pgTable("packages", {
  id: serial("id").primaryKey(),
  barcode: text("barcode").notNull().unique(),
  resiNumber: text("resi_number").notNull(),
  packageNumber: text("package_number"),
  itemName: text("item_name"),
  packageMode: text("package_mode"),
  // Berat Real Kg
  realWeight: numeric("real_weight", { precision: 10, scale: 2 }),
  // Dimensi (cm)
  length: numeric("length", { precision: 10, scale: 2 }),
  width: numeric("width", { precision: 10, scale: 2 }),
  height: numeric("height", { precision: 10, scale: 2 }),
  // Berat Volume = P x L x T / divisor
  volumeWeight: numeric("volume_weight", { precision: 10, scale: 2 }),
  // Jenis Paking
  packagingType: text("packaging_type"),
  // Jenis jasa / layanan jastip
  serviceType: text("service_type"),
  deliveryRoute: text("delivery_route"),
  // Berat Yang Digunakan = MAX(realWeight, volumeWeight)
  usedWeight: numeric("used_weight", { precision: 10, scale: 2 }),
  // Ongkir Per Kg
  shippingRate: numeric("shipping_rate", { precision: 15, scale: 2 }),
  // Total Berat (semua paket konsumen)
  totalWeight: numeric("total_weight", { precision: 10, scale: 2 }),
  // Harga barang
  price: numeric("price", { precision: 15, scale: 2 }),
  // Total Ongkir
  totalShipping: numeric("total_shipping", { precision: 15, scale: 2 }),
  // Legacy weight (kept for backward compat)
  weight: numeric("weight", { precision: 10, scale: 2 }),
  notes: text("notes"),
  status: text("status", {
    enum: ["pending", "diserahkan"],
  })
    .notNull()
    .default("pending"),
  verified: text("verified", {
    enum: ["belum_diverifikasi", "sudah_diverifikasi"],
  })
    .notNull()
    .default("belum_diverifikasi"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  customerName: text("customer_name").notNull(),
  customerId: integer("customer_id").references(() => usersTable.id),
  adminId: integer("admin_id").references(() => usersTable.id),
  packageDate: timestamp("package_date", { withTimezone: true }),
  pickedUpAt: timestamp("picked_up_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertPackageSchema = createInsertSchema(packagesTable).omit({
  id: true,
  barcode: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPackage = z.infer<typeof insertPackageSchema>;
export type Package = typeof packagesTable.$inferSelect;
