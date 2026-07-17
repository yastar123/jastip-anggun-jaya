import {
  pgTable,
  serial,
  text,
  numeric,
  integer,
  timestamp,
  date,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const pengeluaranTable = pgTable("pengeluaran", {
  id: serial("id").primaryKey(),
  tanggal: date("tanggal").notNull(),
  kategori: text("kategori").notNull(),
  nominal: numeric("nominal", { precision: 15, scale: 2 }).notNull(),
  metodePembayaran: text("metode_pembayaran", {
    enum: ["cash", "transfer", "lainnya"],
  })
    .notNull()
    .default("cash"),
  dicatatOleh: integer("dicatat_oleh").references(() => usersTable.id),
  namaPencatat: text("nama_pencatat"),
  catatan: text("catatan"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Pengeluaran = typeof pengeluaranTable.$inferSelect;
export type InsertPengeluaran = typeof pengeluaranTable.$inferInsert;
