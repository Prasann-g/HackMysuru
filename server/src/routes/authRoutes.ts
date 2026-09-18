import { Router } from 'express';
import {
  registerCitizen,
  registerOfficer,
  loginUser,
  sanitizeUser,
} from '../services/authService.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { userStore } from '../db/userStore.js';

export const authRouter = Router();

// 1. Citizen Registration (Public)
authRouter.post('/register/citizen', async (req, res) => {
  try {
    const { name, email, password, ward } = req.body;
    const result = await registerCitizen({ name, email, password, ward });
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Registration failed.' });
  }
});

// 2. Controlled Officer Registration (Requires Invite Code)
authRouter.post('/register/officer', async (req, res) => {
  try {
    const { name, email, password, ward, department, inviteCode } = req.body;
    const result = await registerOfficer({
      name,
      email,
      password,
      ward,
      department,
      inviteCode,
    });
    res.status(201).json(result);
  } catch (err: any) {
    const status = err.message?.includes('Invalid officer invite') ? 403 : 400;
    res.status(status).json({ error: err.message || 'Officer registration failed.' });
  }
});

// 3. User Login (Citizen or Officer)
authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await loginUser({ email, password });
    res.status(200).json(result);
  } catch (err: any) {
    const status = err.message?.includes('Invalid email or password') ? 401 : 400;
    res.status(status).json({ error: err.message || 'Login failed.' });
  }
});

// 4. Current User Session Check
authRouter.get('/me', requireAuth, async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }

  const user = await userStore.findById(req.user.userId);
  if (!user) {
    res.status(404).json({ error: 'User account not found.' });
    return;
  }

  res.status(200).json({
    user: sanitizeUser(user),
  });
});

// 5. Test/Demonstration Route for Role-Based Access Control
authRouter.get('/officer-queue', requireAuth, requireRole(['OFFICER', 'ADMIN']), (req, res) => {
  res.status(200).json({
    authorized: true,
    message: 'Authorized for officer review queue.',
    user: req.user,
  });
});
