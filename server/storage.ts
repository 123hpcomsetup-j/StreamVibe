import {
  users,
  streams,
  reports,
  type User,
  type UpsertUser,
  type Stream,
  type InsertStream,
  type Report,
  type InsertReport,
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
}

export const storage = new DatabaseStorage();