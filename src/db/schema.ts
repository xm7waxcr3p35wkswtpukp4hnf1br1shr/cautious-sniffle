import { pgTable, varchar, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const usernameChecks = pgTable("username_checks", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id", { length: 64 }),
  username: varchar("username", { length: 64 }).notNull(),
  status: varchar("status", { length: 64 }).notNull(),
  name: text("name"),
  photo: text("photo"),
  hasPremium: varchar("has_premium", { length: 10 }),
  checkedAt: timestamp("checked_at").defaultNow().notNull(),
});
