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
  walletBalance: integer("wallet_balance").default(0),
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
  minTip: integer("min_tip").default(5),
  tokenPrice: integer("token_price").default(1), // Price per token in cents/currency units
  privateRate: integer("private_rate").default(20),
  customActions: jsonb("custom_actions").default('[]'), // Array of {name: string, tokenCost: number, enabled: boolean}
  createdAt: timestamp("created_at").defaultNow(),
});

// Transactions table for tips and payments
export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromUserId: varchar("from_user_id").references(() => users.id).notNull(),
  toUserId: varchar("to_user_id").references(() => users.id),
  tokenAmount: integer("token_amount").notNull(),
  purpose: varchar("purpose").notNull(), // 'tip', 'private_session', 'token_purchase'
  streamId: varchar("stream_id").references(() => streams.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Token purchases table
export const tokenPurchases = pgTable("token_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  tokens: integer("tokens").notNull(),
  utrNumber: varchar("utr_number"),
  status: varchar("status").default('pending'), // 'pending', 'approved', 'rejected'
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

// Payouts table
export const payouts = pgTable("payouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  creatorId: varchar("creator_id").references(() => users.id).notNull(),
  tokenAmount: integer("token_amount").notNull(), // Amount in tokens
  requestedAmount: decimal("requested_amount", { precision: 10, scale: 2 }).notNull(), // Amount in currency
  upiId: varchar("upi_id").notNull(), // Creator's UPI ID
  utrNumber: varchar("utr_number"), // Admin fills this when released
  status: varchar("status").default('pending'), // 'pending', 'released', 'rejected'
  createdAt: timestamp("created_at").defaultNow(),
  releasedAt: timestamp("released_at"),
});

// Chat messages table
export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  streamId: varchar("stream_id").references(() => streams.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  guestSessionId: varchar("guest_session_id"),
  senderName: varchar("sender_name").notNull(),
  message: text("message").notNull(),
  tipAmount: integer("tip_amount").default(0),
  isPrivate: boolean("is_private").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Creator action presets table - save custom actions for reuse
// Admin tip menu - global tip actions managed by admins
export const adminTipMenu = pgTable("admin_tip_menu", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  tokenCost: integer("token_cost").notNull(),
  isEnabled: boolean("is_enabled").default(true),
  order: integer("order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const creatorActionPresets = pgTable("creator_action_presets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  creatorId: varchar("creator_id").references(() => users.id).notNull(),
  name: varchar("name").notNull(), // e.g., "say hi", "dance", "sing song"
  tokenCost: integer("token_cost").notNull(),
  isEnabled: boolean("is_enabled").default(true),
  order: integer("order").default(0), // For sorting actions
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Guest sessions table for tracking guest viewing
export const guestSessions = pgTable("guest_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  streamId: varchar("stream_id").references(() => streams.id).notNull(),
  sessionId: varchar("session_id").notNull(),
  guestName: varchar("guest_name").notNull(), // Auto-generated guest name
  tokensRemaining: integer("tokens_remaining").default(100),
  viewTimeRemaining: integer("view_time_remaining").default(300), // 5 minutes in seconds
  ipAddress: varchar("ip_address"), // Track IP for rate limiting
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Private call request status enum
export const privateCallStatusEnum = pgEnum('private_call_status', ['pending', 'accepted', 'rejected', 'active', 'completed', 'cancelled']);

// Private call requests table
export const privateCallRequests = pgTable("private_call_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  streamId: varchar("stream_id").references(() => streams.id).notNull(),
  creatorId: varchar("creator_id").references(() => users.id).notNull(),
  requesterId: varchar("requester_id").references(() => users.id), // null for guest users
  guestSessionId: varchar("guest_session_id").references(() => guestSessions.id), // for guest requests
  requesterName: varchar("requester_name").notNull(), // Display name for request
  message: text("message"), // Optional message from requester
  tokenCost: integer("token_cost").notNull(), // Cost for private call
  durationMinutes: integer("duration_minutes").default(10), // Default 10 minutes
  status: privateCallStatusEnum("status").default('pending'),
  privateChannelId: varchar("private_channel_id"), // Agora channel for private call
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  streams: many(streams),
  sentTransactions: many(transactions, { relationName: "sentTransactions" }),
  receivedTransactions: many(transactions, { relationName: "receivedTransactions" }),
  tokenPurchases: many(tokenPurchases),
  payouts: many(payouts),
  chatMessages: many(chatMessages),
}));

export const streamsRelations = relations(streams, ({ one, many }) => ({
  creator: one(users, {
    fields: [streams.creatorId],
    references: [users.id],
  }),
  transactions: many(transactions),
  chatMessages: many(chatMessages),
  guestSessions: many(guestSessions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  fromUser: one(users, {
    fields: [transactions.fromUserId],
    references: [users.id],
    relationName: "sentTransactions",
  }),
  toUser: one(users, {
    fields: [transactions.toUserId],
    references: [users.id],
    relationName: "receivedTransactions",
  }),
  stream: one(streams, {
    fields: [transactions.streamId],
    references: [streams.id],
  }),
}));

export const creatorActionPresetsRelations = relations(creatorActionPresets, ({ one }) => ({
  creator: one(users, {
    fields: [creatorActionPresets.creatorId],
    references: [users.id],
  }),
}));

export const privateCallRequestsRelations = relations(privateCallRequests, ({ one }) => ({
  stream: one(streams, {
    fields: [privateCallRequests.streamId],
    references: [streams.id],
  }),
  creator: one(users, {
    fields: [privateCallRequests.creatorId],
    references: [users.id],
    relationName: "creatorCallRequests",
  }),
  requester: one(users, {
    fields: [privateCallRequests.requesterId],
    references: [users.id],
    relationName: "requesterCallRequests",
  }),
  guestSession: one(guestSessions, {
    fields: [privateCallRequests.guestSessionId],
    references: [guestSessions.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStreamSchema = createInsertSchema(streams).omit({
  id: true,
  createdAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export const insertTokenPurchaseSchema = createInsertSchema(tokenPurchases).omit({
  id: true,
  createdAt: true,
});

export const insertReportSchema = createInsertSchema(reports).omit({
  id: true,
  createdAt: true,
});

export const insertPayoutSchema = createInsertSchema(payouts).omit({
  id: true,
  createdAt: true,
});

export const insertCreatorActionPresetSchema = createInsertSchema(creatorActionPresets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdminTipMenuSchema = createInsertSchema(adminTipMenu).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export const insertGuestSessionSchema = createInsertSchema(guestSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPrivateCallRequestSchema = createInsertSchema(privateCallRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Custom action interface
export interface CustomAction {
  id: string;
  name: string;
  tokenCost: number;
  enabled: boolean;
  message?: string; // Optional custom message to display
}

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertStream = z.infer<typeof insertStreamSchema>;
export type Stream = typeof streams.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTokenPurchase = z.infer<typeof insertTokenPurchaseSchema>;
export type TokenPurchase = typeof tokenPurchases.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reports.$inferSelect;
export type InsertPayout = z.infer<typeof insertPayoutSchema>;
export type Payout = typeof payouts.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertGuestSession = z.infer<typeof insertGuestSessionSchema>;
export type GuestSession = typeof guestSessions.$inferSelect;
export type InsertCreatorActionPreset = z.infer<typeof insertCreatorActionPresetSchema>;
export type CreatorActionPreset = typeof creatorActionPresets.$inferSelect;
export type InsertPrivateCallRequest = z.infer<typeof insertPrivateCallRequestSchema>;
export type PrivateCallRequest = typeof privateCallRequests.$inferSelect;
