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

    // Create user with approval logic
    const user = await storage.createUser({
      id: nanoid(),
      username,
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: role as 'viewer' | 'creator' | 'admin',
      isApproved: role === 'creator' ? false : true // Creators need approval, others auto-approved
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

    console.log('🔐 LOGIN ATTEMPT - Username:', username);
    console.log('🔐 LOGIN ATTEMPT - Session ID before login:', req.sessionID);
    console.log('🔐 LOGIN ATTEMPT - Session data before login:', JSON.stringify(req.session, null, 2));

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }

    // Find user
    const user = await storage.getUserByUsername(username);
    if (!user || !user.password) {
      console.log('❌ LOGIN FAILED - User not found or no password for:', username);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      console.log('❌ LOGIN FAILED - Invalid password for:', username);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Set session with explicit save
    (req.session as any).userId = user.id;
    
    // Force session save and wait for completion
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('❌ SESSION SAVE ERROR:', err);
          reject(err);
        } else {
          console.log('✅ SESSION SAVED successfully');
          resolve();
        }
      });
    });

    console.log('✅ LOGIN SUCCESS - User ID:', user.id);
    console.log('✅ LOGIN SUCCESS - Session ID after login:', req.sessionID);
    console.log('✅ LOGIN SUCCESS - Session data after login:', JSON.stringify(req.session, null, 2));

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('❌ Login error:', error);
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

// Logout user with redirect (used by dashboards)
router.get('/logout', async (req, res) => {
  // Get user role before destroying session
  const userId = (req.session as any).userId;
  let userRole = 'viewer';
  
  if (userId) {
    try {
      const user = await storage.getUser(userId);
      if (user && user.role) {
        userRole = user.role;
      }
    } catch (error) {
      console.error('Error fetching user for logout:', error);
    }
  }
  
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'Logout failed' });
    }
    
    // Redirect based on user role
    if (userRole === 'admin') {
      res.redirect('/admin');
    } else if (userRole === 'creator') {
      res.redirect('/creator-login');
    } else {
      res.redirect('/user-login');
    }
  });
});

// Reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { username, newPassword } = req.body;

    if (!username || !newPassword) {
      return res.status(400).json({ message: 'Username and new password required' });
    }

    // Check if user exists
    const existingUser = await storage.getUserByUsername(username);
    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update user password
    await storage.updateUserPassword(username, hashedPassword);

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ message: 'Password reset failed' });
  }
});

// Get current user
router.get('/user', requireAuth, (req, res) => {
  const { password, ...userWithoutPassword } = (req as any).user;
  res.json(userWithoutPassword);
});

// Update user profile
router.put('/profile', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { firstName, lastName, username, email, phoneNumber, profileImageUrl } = req.body;
    
    // Check if username is already taken by another user
    if (username) {
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({ message: "Username already taken" });
      }
    }
    
    const updatedUser = await storage.updateUser(userId, {
      firstName,
      lastName,
      username,
      email,
      phoneNumber,
      profileImageUrl
    });
    
    // Return user without password
    const { password: _, ...userWithoutPassword } = updatedUser;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Failed to update profile" });
  }
});

export default router;