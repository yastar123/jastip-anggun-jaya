import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const packagesTable = pgTable("packages", {
  id: serial("id").primaryKey(),
  barcode: text("barcode").notNull().unique(),
  resiNumber: text("resi_number").notNull(),
  itemName: text("item_name").notNull(),
  weight: numeric("weight", { precision: 10, scale: 2 }),
  notes: text("notes"),
  status: text("status", { enum: ["pending", "in_transit", "ready", "picked_up"] }).notNull().default("ready"),
  customerId: integer("customer_id").notNull().references(() => usersTable.id),
  adminId: integer("admin_id").references(() => usersTable.id),
  pickedUpAt: timestamp("picked_up_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPackageSchema = createInsertSchema(packagesTable).omit({ id: true, barcode: true, createdAt: true, updatedAt: true });
export type InsertPackage = z.infer<typeof insertPackageSchema>;
export type Package = typeof packagesTable.$inferSelect;
