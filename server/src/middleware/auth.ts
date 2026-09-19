import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/authService.js';
import { userStore } from '../db/userStore.js';
import type { AuthTokenPayload, UserRole } from '../types/auth.js';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Authentication required. Please provide a valid Bearer token.',
    });
    return;
  }

  const token = authHeader.substring(7).trim();

  try {
    const payload = verifyToken(token);
    
    // Verify user is still active in the system
    const user = await userStore.findById(payload.userId);
    if (!user || !user.isActive) {
      res.status(401).json({
        error: 'User account is no longer active or valid.',
      });
      return;
    }

    // Real-time synchronization: use live database role and ward while preserving JWT claims
    req.user = {
      ...payload,
      userId: user.id,
      email: user.email,
      role: user.role,
      ward: user.ward || payload.ward,
    };
    next();
  } catch (err: any) {
    res.status(401).json({
      error: 'Invalid or expired authentication token.',
    });
  }
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required before role verification.',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Access denied. Requires one of the following roles: ${allowedRoles.join(', ')}.`,
      });
      return;
    }

    next();
  };
}
