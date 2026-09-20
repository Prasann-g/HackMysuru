import { Router } from 'express';
import {
  registerCitizen,
  registerOfficer,
  loginUser,
  sanitizeUser,
  requestCitizenOtp,
  verifyCitizenOtp,
} from '../services/authService.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { userStore } from '../db/userStore.js';

import rateLimit from 'express-rate-limit';

export const authRouter = Router();

const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST;

const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTest ? 100 : 5, // 5 requests per IP
  message: { error: 'Too many requests from this IP. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTest ? 200 : 15, // 15 verification attempts per IP
  message: { error: 'Too many verification attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

authRouter.post('/otp/request', otpRequestLimiter, async (req, res) => {
  try {
    const { identifier, method, purpose } = req.body;
    const result = await requestCitizenOtp({ identifier, method, purpose });
    res.status(200).json(result);
  } catch (err: any) {
    const isCooldown = err.message?.includes('Please wait');
    res.status(isCooldown ? 429 : 400).json({ error: err.message || 'OTP request failed.' });
  }
});

authRouter.post('/otp/verify', otpVerifyLimiter, async (req, res) => {
  try {
    const { identifier, method, purpose, code, name, ward } = req.body;
    const result = await verifyCitizenOtp({ identifier, method, purpose, code, name, ward });
    res.status(200).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'OTP verification failed.' });
  }
});

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
