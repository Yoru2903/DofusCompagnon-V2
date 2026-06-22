import { z } from 'zod';
import { membershipRoles } from './core.types.js';

export const createUserSchema = z.object({
  username: z.string().trim().min(3).max(50),
  displayName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(200),
});

export const roleSchema = z.enum(membershipRoles);

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
