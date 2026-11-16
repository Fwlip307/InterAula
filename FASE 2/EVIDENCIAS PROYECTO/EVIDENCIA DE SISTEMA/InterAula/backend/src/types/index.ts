import type { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  email?: string;
  role?: string;
  is_admin?: boolean;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  token?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: any;
}
