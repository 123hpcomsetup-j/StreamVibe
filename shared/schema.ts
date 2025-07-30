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

// User wallets for token balance
export const userWallets = pgTable("user_wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  tokenBalance: integer("token_balance").default(0),
  totalPurchased: integer("total_purchased").default(0),
  totalSpent: integer("total_spent").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Creator custom activities (up to 10 per creator)
export const creatorActivities = pgTable("creator_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  creatorId: varchar("creator_id").references(() => users.id).notNull(),
  name: varchar("name").notNull(), // e.g., "say hi", "say bye"
  tokenCost: integer("token_cost").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  position: integer("position").default(0), // for ordering
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// UPI payment configuration for admin
export const upiConfig = pgTable("upi_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  upiId: varchar("upi_id").notNull(),
  qrCodeUrl: text("qr_code_url"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Token purchase requests with UTR submission
export const tokenPurchases = pgTable("token_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  requestedTokens: integer("requested_tokens").notNull(),
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).notNull(),
  utrNumber: varchar("utr_number").notNull(),
  paymentScreenshot: text("payment_screenshot"), // optional
  status: varchar("status").default('pending'), // 'pending', 'approved', 'denied'
  adminNote: text("admin_note"),
  processedBy: varchar("processed_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  processedAt: timestamp("processed_at"),
});

// Tips and activity usage transactions
export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromUserId: varchar("from_user_id").references(() => users.id).notNull(),
  toUserId: varchar("to_user_id").references(() => users.id).notNull(), // creator
  streamId: varchar("stream_id").references(() => streams.id).notNull(),
  type: varchar("type").notNull(), // 'tip', 'activity'
  amount: integer("amount").notNull(), // tokens
  activityId: varchar("activity_id").references(() => creatorActivities.id),
  message: text("message"), // for custom tips
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  streams: many(streams),
  wallet: one(userWallets),
  activities: many(creatorActivities),
  sentTransactions: many(transactions, { relationName: "sentTransactions" }),
  receivedTransactions: many(transactions, { relationName: "receivedTransactions" }),
  tokenPurchases: many(tokenPurchases),
}));

export const userWalletsRelations = relations(userWallets, ({ one }) => ({
  user: one(users, { fields: [userWallets.userId], references: [users.id] }),
}));

export const creatorActivitiesRelations = relations(creatorActivities, ({ one, many }) => ({
  creator: one(users, { fields: [creatorActivities.creatorId], references: [users.id] }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  fromUser: one(users, { fields: [transactions.fromUserId], references: [users.id], relationName: "sentTransactions" }),
  toUser: one(users, { fields: [transactions.toUserId], references: [users.id], relationName: "receivedTransactions" }),
  stream: one(streams, { fields: [transactions.streamId], references: [streams.id] }),
  activity: one(creatorActivities, { fields: [transactions.activityId], references: [creatorActivities.id] }),
}));

export const tokenPurchasesRelations = relations(tokenPurchases, ({ one }) => ({
  user: one(users, { fields: [tokenPurchases.userId], references: [users.id] }),
  processedByUser: one(users, { fields: [tokenPurchases.processedBy], references: [users.id] }),
}));

export const streamsRelations = relations(streams, ({ one, many }) => ({
  creator: one(users, { fields: [streams.creatorId], references: [users.id] }),
  transactions: many(transactions),
}));

// Type exports for all tables
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type UpsertUser = typeof users.$inferInsert;

export type Stream = typeof streams.$inferSelect;
export type InsertStream = typeof streams.$inferInsert;

export type UserWallet = typeof userWallets.$inferSelect;
export type InsertUserWallet = typeof userWallets.$inferInsert;

export type CreatorActivity = typeof creatorActivities.$inferSelect;
export type InsertCreatorActivity = typeof creatorActivities.$inferInsert;

export type UpiConfig = typeof upiConfig.$inferSelect;
export type InsertUpiConfig = typeof upiConfig.$inferInsert;

export type TokenPurchase = typeof tokenPurchases.$inferSelect;
export type InsertTokenPurchase = typeof tokenPurchases.$inferInsert;

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users);
export const insertStreamSchema = createInsertSchema(streams);
export const insertReportSchema = createInsertSchema(reports);
export const insertUserWalletSchema = createInsertSchema(userWallets);
export const insertCreatorActivitySchema = createInsertSchema(creatorActivities);
export const insertUpiConfigSchema = createInsertSchema(upiConfig);
export const insertTokenPurchaseSchema = createInsertSchema(tokenPurchases);
export const insertTransactionSchema = createInsertSchema(transactions);

