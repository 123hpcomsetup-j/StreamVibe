import bcrypt from 'bcrypt';
import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';

// Simple authentication middleware
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.session?.userId;
  
  if (!userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Authentication error' });
  }
};

export const requireRole = (role: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== role) {
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