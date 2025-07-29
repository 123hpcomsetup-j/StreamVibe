import {
  users,
  streams,
  transactions,
  tokenPurchases,
  reports,
  payouts,
  chatMessages,
  guestSessions,
  type User,
  type UpsertUser,
  type Stream,
  type InsertStream,
  type Transaction,
  type InsertTransaction,
  type TokenPurchase,
  type InsertTokenPurchase,
  type Report,
  type InsertReport,
  type Payout,
  type InsertPayout,
  type ChatMessage,
  type InsertChatMessage,
  type GuestSession,
  type InsertGuestSession,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(insertUser: any): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserPassword(username: string, hashedPassword: string): Promise<void>;
  
  // Stream operations
  createStream(stream: InsertStream): Promise<Stream>;
  getStreams(): Promise<Stream[]>;
  getLiveStreams(): Promise<Stream[]>;
  getStreamById(id: string): Promise<Stream | undefined>;
  updateStream(id: string, updates: Partial<InsertStream>): Promise<Stream>;
  updateStreamStatus(streamId: string, isLive: boolean): Promise<void>;
  deleteStream(id: string): Promise<void>;
  
  // Transaction operations
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransactionsByUser(userId: string): Promise<Transaction[]>;
  getUserEarnings(userId: string): Promise<number>;
  
  // Token purchase operations
  createTokenPurchase(purchase: InsertTokenPurchase): Promise<TokenPurchase>;
  getPendingTokenPurchases(): Promise<TokenPurchase[]>;
  updateTokenPurchaseStatus(id: string, status: string): Promise<TokenPurchase>;
  
  // Report operations
  createReport(report: InsertReport): Promise<Report>;
  getPendingReports(): Promise<Report[]>;
  updateReportStatus(id: string, status: string): Promise<Report>;
  
  // Payout operations
  createPayout(payout: InsertPayout): Promise<Payout>;
  getPendingPayouts(): Promise<Payout[]>;
  updatePayoutStatus(id: string, status: string): Promise<Payout>;
  
  // Chat operations
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getChatMessages(streamId: string): Promise<ChatMessage[]>;
  
  // Guest sessions
  createGuestSession(session: InsertGuestSession): Promise<GuestSession>;
  getGuestSession(streamId: string, sessionId: string): Promise<GuestSession | undefined>;
  getGuestSessionById(id: string): Promise<GuestSession | undefined>;
  updateGuestSession(id: string, updates: Partial<GuestSession>): Promise<GuestSession>;
  
  // Admin operations
  getPendingCreators(): Promise<User[]>;
  approveCreator(userId: string): Promise<User>;
  updateUserWallet(userId: string, amount: number): Promise<User>;
  
  // User status operations
  getOnlineUsers(): Promise<User[]>;
  updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void>;
  
  // Creator analytics
  getCreatorStats(creatorId: string): Promise<any>;
  getCreatorTips(creatorId: string): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: any): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserPassword(username: string, hashedPassword: string): Promise<void> {
    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.username, username));
  }

  // Stream operations
  async createStream(stream: InsertStream): Promise<Stream> {
    const [newStream] = await db.insert(streams).values(stream).returning();
    return newStream;
  }

  async getStreams(): Promise<Stream[]> {
    return await db.select().from(streams).orderBy(desc(streams.createdAt));
  }

  async getLiveStreams(): Promise<Stream[]> {
    // Only return streams that are currently live for real-time accuracy
    return await db
      .select()
      .from(streams)
      .where(eq(streams.isLive, true))
      .orderBy(desc(streams.viewerCount), desc(streams.createdAt));
  }

  async getStreamById(id: string): Promise<Stream | undefined> {
    const [stream] = await db.select().from(streams).where(eq(streams.id, id));
    return stream || undefined;
  }

  async updateStream(id: string, updates: Partial<InsertStream>): Promise<Stream> {
    const [updatedStream] = await db
      .update(streams)
      .set(updates)
      .where(eq(streams.id, id))
      .returning();
    return updatedStream;
  }

  async updateStreamStatus(streamId: string, isLive: boolean, viewerCount?: number): Promise<void> {
    const updateData: any = { isLive };
    if (viewerCount !== undefined) {
      updateData.viewerCount = viewerCount;
    }
    
    await db
      .update(streams)
      .set(updateData)
      .where(eq(streams.id, streamId));
  }

  async deleteStream(id: string): Promise<void> {
    await db.delete(streams).where(eq(streams.id, id));
  }

  // Transaction operations
  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [newTransaction] = await db
      .insert(transactions)
      .values(transaction)
      .returning();
    return newTransaction;
  }

  async getTransactionsByUser(userId: string): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.fromUserId, userId))
      .orderBy(desc(transactions.createdAt));
  }

  async getUserEarnings(userId: string): Promise<number> {
    const result = await db
      .select({ total: sql<number>`sum(${transactions.tokenAmount})` })
      .from(transactions)
      .where(eq(transactions.toUserId, userId));
    return result[0]?.total || 0;
  }

  // Token purchase operations
  async createTokenPurchase(purchase: InsertTokenPurchase): Promise<TokenPurchase> {
    const [newPurchase] = await db
      .insert(tokenPurchases)
      .values(purchase)
      .returning();
    return newPurchase;
  }

  async getPendingTokenPurchases(): Promise<TokenPurchase[]> {
    return await db
      .select()
      .from(tokenPurchases)
      .where(eq(tokenPurchases.status, 'pending'))
      .orderBy(desc(tokenPurchases.createdAt));
  }

  async updateTokenPurchaseStatus(id: string, status: string): Promise<TokenPurchase> {
    const [updated] = await db
      .update(tokenPurchases)
      .set({ status })
      .where(eq(tokenPurchases.id, id))
      .returning();
    return updated;
  }

  // Report operations
  async createReport(report: InsertReport): Promise<Report> {
    const [newReport] = await db.insert(reports).values(report).returning();
    return newReport;
  }

  async getPendingReports(): Promise<Report[]> {
    return await db
      .select()
      .from(reports)
      .where(eq(reports.status, 'pending'))
      .orderBy(desc(reports.createdAt));
  }

  async updateReportStatus(id: string, status: string): Promise<Report> {
    const [updated] = await db
      .update(reports)
      .set({ status })
      .where(eq(reports.id, id))
      .returning();
    return updated;
  }

  // Payout operations
  async createPayout(payout: InsertPayout): Promise<Payout> {
    const [newPayout] = await db.insert(payouts).values(payout).returning();
    return newPayout;
  }

  async getPendingPayouts(): Promise<Payout[]> {
    return await db
      .select()
      .from(payouts)
      .where(eq(payouts.status, 'pending'))
      .orderBy(desc(payouts.createdAt));
  }

  async updatePayoutStatus(id: string, status: string): Promise<Payout> {
    const [updated] = await db
      .update(payouts)
      .set({ status })
      .where(eq(payouts.id, id))
      .returning();
    return updated;
  }

  // Chat operations
  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [newMessage] = await db
      .insert(chatMessages)
      .values(message)
      .returning();
    return newMessage;
  }

  async getChatMessages(streamId: string): Promise<ChatMessage[]> {
    return await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.streamId, streamId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(50);
  }

  // Admin operations
  async getPendingCreators(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(and(eq(users.role, 'creator'), eq(users.isApproved, false)));
  }

  async approveCreator(userId: string): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ isApproved: true })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async updateUserWallet(userId: string, amount: number): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ walletBalance: sql`${users.walletBalance} + ${amount}` })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  // User status operations
  async getOnlineUsers(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.isOnline, true));
  }

  async updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
    await db
      .update(users)
      .set({ isOnline })
      .where(eq(users.id, userId));
  }

  // Stream cleanup operations
  async stopAllUserStreams(userId: string): Promise<void> {
    // Stop all active streams for a specific user - useful for cleanup
    await db
      .update(streams)
      .set({ isLive: false })
      .where(and(eq(streams.creatorId, userId), eq(streams.isLive, true)));
  }

  // Guest session methods
  async createGuestSession(session: InsertGuestSession): Promise<GuestSession> {
    const [newSession] = await db.insert(guestSessions).values(session).returning();
    return newSession;
  }

  async getGuestSession(streamId: string, sessionId: string): Promise<GuestSession | undefined> {
    const [session] = await db.select().from(guestSessions)
      .where(and(eq(guestSessions.streamId, streamId), eq(guestSessions.sessionId, sessionId)));
    return session;
  }

  async getGuestSessionById(id: string): Promise<GuestSession | undefined> {
    const [session] = await db.select().from(guestSessions)
      .where(eq(guestSessions.id, id));
    return session;
  }

  async updateGuestSession(id: string, updates: Partial<GuestSession>): Promise<GuestSession> {
    const [updatedSession] = await db.update(guestSessions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(guestSessions.id, id))
      .returning();
    return updatedSession;
  }

  async cleanupStaleStreams(): Promise<number> {
    // Mark streams as offline if they've been "live" for more than 2 hours
    // This handles cases where creators close browser without properly ending stream
    const result = await db
      .update(streams)
      .set({ isLive: false })
      .where(
        sql`${streams.isLive} = true AND ${streams.createdAt} < NOW() - INTERVAL '2 hours'`
      );
    
    return result.rowCount || 0;
  }

  // Creator analytics methods
  async getCreatorStats(creatorId: string): Promise<any> {
    // Get total earnings from transactions where creator received tips
    const earningsResult = await db
      .select({ 
        totalEarnings: sql<number>`COALESCE(SUM(${transactions.tokenAmount}), 0)::int`
      })
      .from(transactions)
      .where(and(
        eq(transactions.toUserId, creatorId),
        eq(transactions.purpose, 'tip')
      ));

    // Get tip count for this month
    const tipsResult = await db
      .select({ 
        totalTips: sql<number>`COALESCE(COUNT(*), 0)::int`,
        weeklyTips: sql<number>`COALESCE(COUNT(CASE WHEN ${transactions.createdAt} >= NOW() - INTERVAL '7 days' THEN 1 END), 0)::int`
      })
      .from(transactions)
      .where(and(
        eq(transactions.toUserId, creatorId),
        eq(transactions.purpose, 'tip')
      ));

    // Get total stream hours (sum of stream durations)
    const streamHoursResult = await db
      .select({ 
        totalStreamHours: sql<number>`COALESCE(COUNT(*), 0)::int` // For now, count number of streams
      })
      .from(streams)
      .where(eq(streams.creatorId, creatorId));

    // Get follower count (for now, use wallet balance as mock follower count)
    const followerResult = await db
      .select({ followerCount: users.walletBalance })
      .from(users)
      .where(eq(users.id, creatorId));

    const totalEarnings = earningsResult[0]?.totalEarnings || 0;
    const { totalTips = 0, weeklyTips = 0 } = tipsResult[0] || {};
    const totalStreamHours = streamHoursResult[0]?.totalStreamHours || 0;
    const followerCount = followerResult[0]?.followerCount || 0;

    return {
      totalEarnings,
      availableEarnings: totalEarnings, // For now, all earnings are available
      earningsGrowth: totalEarnings > 0 ? 15 : null, // Mock growth percentage
      totalTips,
      weeklyTips,
      totalStreamHours,
      followerCount,
      newFollowers: weeklyTips > 0 ? Math.floor(weeklyTips / 2) : 0, // Mock new followers
      tokenPrice: 1 // Default token price
    };
  }

  async getCreatorTips(creatorId: string): Promise<any[]> {
    // Get recent tips with sender information
    const tipsWithSender = await db
      .select({
        id: transactions.id,
        amount: transactions.tokenAmount,
        createdAt: transactions.createdAt,
        senderId: transactions.fromUserId,
        senderUsername: users.username,
        senderFirstName: users.firstName,
        senderLastName: users.lastName
      })
      .from(transactions)
      .leftJoin(users, eq(transactions.fromUserId, users.id))
      .where(and(
        eq(transactions.toUserId, creatorId),
        eq(transactions.purpose, 'tip')
      ))
      .orderBy(desc(transactions.createdAt))
      .limit(20);

    return tipsWithSender.map(tip => ({
      id: tip.id,
      amount: tip.amount,
      message: null, // No description field in schema
      createdAt: tip.createdAt,
      senderName: tip.senderFirstName && tip.senderLastName 
        ? `${tip.senderFirstName} ${tip.senderLastName}`
        : tip.senderUsername || 'Anonymous'
    }));
  }
}

export const storage = new DatabaseStorage();
