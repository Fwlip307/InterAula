import { z } from 'zod';
import { BUSINESS_RULES } from '../constants/businessRules.js';

const P_RULES = BUSINESS_RULES.PROJECTS;

export const createProjectSchema = z
  .object({
    title: z.string().trim().min(P_RULES.MIN_TITLE_LENGTH, `El título debe tener al menos ${P_RULES.MIN_TITLE_LENGTH} caracteres`).max(P_RULES.MAX_TITLE_LENGTH),
    short_description: z.string().trim().max(300).optional(),
    description: z.string().trim().min(5, 'La descripción debe tener al menos 5 caracteres').max(5000).optional(),
    category: z.string().trim().max(100).default('Desarrollo de Software').optional(),
    max_members: z.number().int().min(P_RULES.MIN_MEMBERS).max(P_RULES.MAX_MEMBERS).default(P_RULES.DEFAULT_MEMBERS).optional(),
    positions: z.array(z.string().trim().max(P_RULES.POSITION.MAX_TITLE_LENGTH)).max(10).optional(),
    required_roles: z.array(z.string().trim().max(50)).max(10).optional(),
    tags: z.array(z.string().trim().max(30)).max(8).optional(),
  })
  .strict();

export const applyToProjectSchema = z
  .object({
    message: z.string().trim().max(P_RULES.MAX_PITCH_LENGTH).optional(),
    role_applied: z.string().trim().max(50).optional(),
  })
  .strict();

export const reviewApplicationSchema = z
  .object({
    status: z.enum(['accepted', 'rejected'], {
      errorMap: () => ({ message: 'Estado inválido. Opciones: accepted, rejected' }),
    }),
  })
  .strict();
