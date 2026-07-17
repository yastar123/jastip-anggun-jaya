import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const tarifHistoryTable = pgTable("tarif_history", {
  id: serial("id").primaryKey(),
  jenisJastip: text("jenis_jastip").notNull(),
  tarifLama: text("tarif_lama"),
  tarifBaru: text("tarif_baru").notNull(),
  alasan: text("alasan"),
  diubahOleh: integer("diubah_oleh").references(() => usersTable.id),
  namaUbah: text("nama_ubah"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type TarifHistory = typeof tarifHistoryTable.$inferSelect;
export type InsertTarifHistory = typeof tarifHistoryTable.$inferInsert;
