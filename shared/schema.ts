import { sql, relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User roles enum
export const userRoleEnum = pgEnum('user_role', ['viewer', 'creator', 'admin']);

// User storage table with simple auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username").unique(),
  email: varchar("email").unique(),
  password: varchar("password"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  phoneNumber: varchar("phone_number"),
  role: userRoleEnum("role").default('viewer'),
  isOnline: boolean("is_online").default(false),
  isApproved: boolean("is_approved").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Streams table
export const streams = pgTable("streams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  creatorId: varchar("creator_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  category: varchar("category").notNull(),
  isLive: boolean("is_live").default(false),
  streamUrl: text("stream_url"),
  viewerCount: integer("viewer_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Reports table
export const reports = pgTable("reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportedBy: varchar("reported_by").references(() => users.id).notNull(),
  reportedUser: varchar("reported_user").references(() => users.id).notNull(),
  reason: text("reason").notNull(),
  status: varchar("status").default('pending'), // 'pending', 'resolved', 'dismissed'
  createdAt: timestamp("created_at").defaultNow(),
});



// Relations
export const usersRelations = relations(users, ({ many }) => ({
  streams: many(streams),
}));

export const streamsRelations = relations(streams, ({ one }) => ({
  creator: one(users, {
    fields: [streams.creatorId],
    references: [users.id],
  }),
}));

// Define Zod insert schemas for frontend forms
export const insertUserSchema = createInsertSchema(users);
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = Omit<InsertUser, 'id'> & { id?: string };
export type User = typeof users.$inferSelect;

export const insertStreamSchema = createInsertSchema(streams);
export type InsertStream = z.infer<typeof insertStreamSchema>;
export type Stream = typeof streams.$inferSelect;

export const insertReportSchema = createInsertSchema(reports);
export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reports.$inferSelect;

