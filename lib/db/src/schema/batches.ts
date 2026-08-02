import {
  pgTable,
  serial,
  text,
  date,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const batchesTable = pgTable("batches", {
  id: serial("id").primaryKey(),
  // e.g. "Dobonsolo"
  namaKapal: text("nama_kapal").notNull(),
  // Tanggal berangkat (ETD)
  etd: date("etd").notNull(),
  // Periode closing
  periodeClosingMulai: date("periode_closing_mulai").notNull(),
  periodeClosingSelesai: date("periode_closing_selesai").notNull(),
  // Asal & tujuan
  kotaAsal: text("kota_asal").notNull(),
  tujuan: text("tujuan").notNull().default("Manokwari"),
  // Status: OPEN = masih aktif, CLOSED = dikunci, ARSIP = selesai read-only
  statusBatch: text("status_batch", {
    enum: ["OPEN", "CLOSED", "ARSIP"],
  })
    .notNull()
    .default("OPEN"),
  createdBy: integer("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Batch = typeof batchesTable.$inferSelect;
export type InsertBatch = typeof batchesTable.$inferInsert;
