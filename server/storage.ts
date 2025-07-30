import {
  users,
  streams,
  reports,
  userWallets,
  creatorActivities,
  upiConfig,
  tokenPurchases,
  transactions,
  type User,
  type UpsertUser,
  type Stream,
  type InsertStream,
  type Report,
  type InsertReport,
  type UserWallet,
  type InsertUserWallet,
  type CreatorActivity,
  type InsertCreatorActivity,
  type UpiConfig,
  type InsertUpiConfig,
  type TokenPurchase,
  type InsertTokenPurchase,
  type Transaction,
  type InsertTransaction,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(insertUser: any): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  updateUserPassword(username: string, hashedPassword: string): Promise<void>;
  
  // Stream operations
  createStream(stream: InsertStream): Promise<Stream>;
  getStreams(): Promise<Stream[]>;
  getLiveStreams(): Promise<Stream[]>;
  getRecentStreams(): Promise<Stream[]>;
  getStreamById(id: string): Promise<Stream | undefined>;
  updateStream(id: string, updates: Partial<InsertStream>): Promise<Stream>;
  updateStreamStatus(streamId: string, isLive: boolean): Promise<void>;
  deleteStream(id: string): Promise<void>;
  
  // User status operations
  updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void>;
  getOnlineUsers(): Promise<User[]>;
  
  // Report operations
  createReport(report: InsertReport): Promise<Report>;
  getReports(): Promise<Report[]>;
  

  
  // Admin operations
  getAllUsers(): Promise<User[]>;
  getPendingCreators(): Promise<User[]>;
  approveCreator(userId: string): Promise<User>;
  
  // Wallet operations
  getUserWallet(userId: string): Promise<UserWallet | undefined>;
  createUserWallet(userId: string): Promise<UserWallet>;
  updateTokenBalance(userId: string, amount: number): Promise<UserWallet>;
  
  // Creator activities operations
  getCreatorActivities(creatorId: string): Promise<CreatorActivity[]>;
  createCreatorActivity(activity: InsertCreatorActivity): Promise<CreatorActivity>;
  updateCreatorActivity(id: string, updates: Partial<InsertCreatorActivity>): Promise<CreatorActivity>;
  deleteCreatorActivity(id: string): Promise<void>;
  
  // UPI configuration operations
  getUpiConfig(): Promise<UpiConfig | undefined>;
  updateUpiConfig(config: InsertUpiConfig): Promise<UpiConfig>;
  
  // Token purchase operations
  createTokenPurchase(purchase: InsertTokenPurchase): Promise<TokenPurchase>;
  getPendingTokenPurchases(): Promise<TokenPurchase[]>;
  getAllTokenPurchases(): Promise<TokenPurchase[]>;
  updateTokenPurchaseStatus(id: string, status: string, adminNote?: string, processedBy?: string): Promise<TokenPurchase>;
  
  // Transaction operations
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getStreamTransactions(streamId: string): Promise<Transaction[]>;
  getUserTransactions(userId: string): Promise<Transaction[]>;
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

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
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
    return await db.select().from(streams).where(eq(streams.isLive, true));
  }

  async getRecentStreams(): Promise<Stream[]> {
    return await db
      .select()
      .from(streams)
      .where(eq(streams.isLive, false))
      .orderBy(desc(streams.createdAt))
      .limit(10);
  }

  async getStreamById(id: string): Promise<Stream | undefined> {
    const [stream] = await db.select().from(streams).where(eq(streams.id, id));
    return stream;
  }

  async updateStream(id: string, updates: Partial<InsertStream>): Promise<Stream> {
    const [updatedStream] = await db
      .update(streams)
      .set(updates)
      .where(eq(streams.id, id))
      .returning();
    return updatedStream;
  }

  async updateStreamStatus(streamId: string, isLive: boolean): Promise<void> {
    await db
      .update(streams)
      .set({ isLive })
      .where(eq(streams.id, streamId));
  }

  async deleteStream(id: string): Promise<void> {
    await db.delete(streams).where(eq(streams.id, id));
  }

  // Get current stream by creator
  async getCurrentStreamByCreator(creatorId: string): Promise<Stream | undefined> {
    const [stream] = await db
      .select()
      .from(streams)
      .where(eq(streams.creatorId, creatorId))
      .orderBy(desc(streams.createdAt))
      .limit(1);
    return stream;
  }

  // User status operations
  async updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
    await db
      .update(users)
      .set({ isOnline })
      .where(eq(users.id, userId));
  }

  async getOnlineUsers(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.isOnline, true));
  }

  // Report operations
  async createReport(report: InsertReport): Promise<Report> {
    const [newReport] = await db.insert(reports).values(report).returning();
    return newReport;
  }

  async getReports(): Promise<Report[]> {
    return await db.select().from(reports).orderBy(desc(reports.createdAt));
  }



  // Admin operations
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getPendingCreators(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(and(eq(users.role, 'creator'), eq(users.isApproved, false)));
  }

  async approveCreator(userId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ isApproved: true })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Wallet operations
  async getUserWallet(userId: string): Promise<UserWallet | undefined> {
    const [wallet] = await db.select().from(userWallets).where(eq(userWallets.userId, userId));
    return wallet;
  }

  async createUserWallet(userId: string): Promise<UserWallet> {
    const [wallet] = await db
      .insert(userWallets)
      .values({ userId, tokenBalance: 0, totalPurchased: 0, totalSpent: 0 })
      .returning();
    return wallet;
  }

  async updateTokenBalance(userId: string, amount: number): Promise<UserWallet> {
    const [wallet] = await db
      .update(userWallets)
      .set({ 
        tokenBalance: sql`${userWallets.tokenBalance} + ${amount}`,
        totalPurchased: amount > 0 ? sql`${userWallets.totalPurchased} + ${amount}` : userWallets.totalPurchased,
        totalSpent: amount < 0 ? sql`${userWallets.totalSpent} + ${Math.abs(amount)}` : userWallets.totalSpent,
        updatedAt: new Date()
      })
      .where(eq(userWallets.userId, userId))
      .returning();
    return wallet;
  }

  // Creator activities operations
  async getCreatorActivities(creatorId: string): Promise<CreatorActivity[]> {
    return await db
      .select()
      .from(creatorActivities)
      .where(and(eq(creatorActivities.creatorId, creatorId), eq(creatorActivities.isActive, true)))
      .orderBy(creatorActivities.position);
  }

  async createCreatorActivity(activity: InsertCreatorActivity): Promise<CreatorActivity> {
    const [newActivity] = await db
      .insert(creatorActivities)
      .values(activity)
      .returning();
    return newActivity;
  }

  async updateCreatorActivity(id: string, updates: Partial<InsertCreatorActivity>): Promise<CreatorActivity> {
    const [activity] = await db
      .update(creatorActivities)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(creatorActivities.id, id))
      .returning();
    return activity;
  }

  async deleteCreatorActivity(id: string): Promise<void> {
    await db.delete(creatorActivities).where(eq(creatorActivities.id, id));
  }

  // UPI configuration operations
  async getUpiConfig(): Promise<UpiConfig | undefined> {
    const [config] = await db.select().from(upiConfig).where(eq(upiConfig.isActive, true));
    return config;
  }

  async updateUpiConfig(config: InsertUpiConfig): Promise<UpiConfig> {
    // Deactivate all existing configs
    await db.update(upiConfig).set({ isActive: false });
    
    // Insert new active config
    const [newConfig] = await db
      .insert(upiConfig)
      .values({ ...config, isActive: true })
      .returning();
    return newConfig;
  }

  // Token purchase operations
  async createTokenPurchase(purchase: InsertTokenPurchase): Promise<TokenPurchase> {
    const [newPurchase] = await db
      .insert(tokenPurchases)
      .values(purchase)
      .returning();
    return newPurchase;
  }

  async getPendingTokenPurchases(): Promise<any[]> {
    return await db
      .select({
        id: tokenPurchases.id,
        userId: tokenPurchases.userId,
        requestedTokens: tokenPurchases.requestedTokens,
        amountPaid: tokenPurchases.amountPaid,
        utrNumber: tokenPurchases.utrNumber,
        status: tokenPurchases.status,
        createdAt: tokenPurchases.createdAt,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        // Frontend expects these field names
        tokens: tokenPurchases.requestedTokens,
        amount: tokenPurchases.amountPaid,
      })
      .from(tokenPurchases)
      .leftJoin(users, eq(tokenPurchases.userId, users.id))
      .where(eq(tokenPurchases.status, 'pending'))
      .orderBy(desc(tokenPurchases.createdAt));
  }

  async getAllTokenPurchases(): Promise<TokenPurchase[]> {
    return await db
      .select()
      .from(tokenPurchases)
      .orderBy(desc(tokenPurchases.createdAt));
  }

  async updateTokenPurchaseStatus(id: string, status: string, adminNote?: string, processedBy?: string): Promise<TokenPurchase> {
    const [purchase] = await db
      .update(tokenPurchases)
      .set({ 
        status, 
        adminNote, 
        processedBy, 
        processedAt: new Date() 
      })
      .where(eq(tokenPurchases.id, id))
      .returning();
    return purchase;
  }

  // Transaction operations
  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [newTransaction] = await db
      .insert(transactions)
      .values(transaction)
      .returning();
    return newTransaction;
  }

  async getStreamTransactions(streamId: string): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.streamId, streamId))
      .orderBy(desc(transactions.createdAt));
  }

  async getUserTransactions(userId: string): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.fromUserId, userId))
      .orderBy(desc(transactions.createdAt));
  }
}

export const storage = new DatabaseStorage();