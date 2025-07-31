import bcrypt from 'bcrypt';
import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';

// Extend session interface
declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

// Simple authentication middleware
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req.session as any)?.userId;
  
  // Debug logging
  console.log('🔐 Auth check - Session ID:', req.sessionID);
  console.log('🔐 Auth check - User ID from session:', userId);
  console.log('🔐 Auth check - Session data:', JSON.stringify(req.session, null, 2));
  
  if (!userId) {
    console.log('❌ Auth check failed: No userId in session');
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const user = await storage.getUser(userId);
    if (!user) {
      console.log('❌ Auth check failed: User not found for ID:', userId);
      return res.status(401).json({ message: 'User not found' });
    }
    
    console.log('✅ Auth check passed for user:', user.username);
    req.user = user;
    next();
  } catch (error) {
    console.log('❌ Auth check error:', error);
    res.status(500).json({ message: 'Authentication error' });
  }
};

export const requireRole = (role: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || (req.user as any).role !== role) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  };
};

// Hash password helper
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10);
};

// Verify password helper
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};