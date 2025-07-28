import { Router } from 'express';
import { storage } from './storage';
import { hashPassword, verifyPassword, requireAuth } from './simpleAuth';
import { nanoid } from 'nanoid';

const router = Router();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, role = 'viewer' } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }

    // Check if user already exists
    const existingUser = await storage.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await storage.createUser({
      id: nanoid(),
      username,
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: role as 'viewer' | 'creator' | 'admin'
    });

    // Set session
    (req.session as any).userId = user.id;

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }

    // Find user
    const user = await storage.getUserByUsername(username);
    if (!user || !user.password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Set session
    (req.session as any).userId = user.id;

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

// Logout user
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'Logout failed' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

// Get current user
router.get('/user', requireAuth, (req, res) => {
  const { password, ...userWithoutPassword } = (req as any).user;
  res.json(userWithoutPassword);
});

export default router;