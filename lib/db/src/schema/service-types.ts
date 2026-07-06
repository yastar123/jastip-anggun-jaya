import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const serviceTypesTable = pgTable("service_types", {
  id: serial("id").primaryKey(),
  // machine key, e.g. "jastip hemat+"
  name: text("name").notNull().unique(),
  // human label, e.g. "Jastip Hemat+"
  label: text("label").notNull(),
});

export type ServiceType = typeof serviceTypesTable.$inferSelect;
