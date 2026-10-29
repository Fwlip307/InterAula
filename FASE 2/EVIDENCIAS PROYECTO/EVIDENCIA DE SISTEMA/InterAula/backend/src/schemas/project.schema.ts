import { z } from 'zod';
import { BUSINESS_RULES } from '../constants/businessRules.js';

const P_RULES = BUSINESS_RULES.PROJECTS;

export const projectPositionInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(P_RULES.POSITION.MIN_TITLE_LENGTH).max(P_RULES.POSITION.MAX_TITLE_LENGTH),
  description: z.string().trim().max(1000).nullable().optional(),
  skills_required: z.array(z.string().trim().max(50)).max(15).optional().default([]),
  mandatory_requirements: z.array(z.string().trim().max(150)).max(10).optional().default([]),
  optional_requirements: z.array(z.string().trim().max(150)).max(10).optional().default([]),
  level_required: z.string().trim().max(40).optional().default('intermediate'),
  dedication_hours: z.number().int().min(1).max(60).optional().default(6),
  slots: z.number().int().min(P_RULES.POSITION.MIN_SLOTS).max(P_RULES.POSITION.MAX_SLOTS).optional().default(1),
  compensation_override: z.string().trim().max(200).nullable().optional(),
  status: z.enum(['open', 'paused', 'filled', 'closed']).optional().default('open'),
});

export const projectMilestoneInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(2).max(150),
  description: z.string().trim().max(500).optional(),
  due_date: z.string().trim().max(40).optional(),
  completed: z.boolean().default(false),
});

export const createProjectSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(P_RULES.MIN_TITLE_LENGTH, `El título debe tener al menos ${P_RULES.MIN_TITLE_LENGTH} caracteres`)
      .max(P_RULES.MAX_TITLE_LENGTH),
    short_description: z.string().trim().max(350).nullable().optional(),
    description: z.string().trim().min(5, 'La descripción debe tener al menos 5 caracteres').max(6000).nullable().optional(),
    problem_statement: z.string().trim().max(3000).nullable().optional(),
    objectives: z.string().trim().max(3000).nullable().optional(),
    category: z.string().trim().max(100).default('Desarrollo de Software').optional(),
    career: z.string().trim().max(120).default('Ingeniería en Informática').optional(),
    technologies: z.array(z.string().trim().max(50)).max(20).optional().default([]),
    tags: z.array(z.string().trim().max(40)).max(12).optional().default([]),
    status: z.enum(['draft', 'open', 'recruiting', 'in_progress', 'completed', 'cancelled']).optional().default('open'),
    visibility: z.enum(['public', 'private']).optional().default('public'),
    modality: z.enum(['online', 'presencial', 'hibrido']).optional().default('online'),
    dedication_hours: z.number().int().min(1).max(60).optional().default(6),
    max_members: z
      .number()
      .int()
      .min(P_RULES.MIN_MEMBERS)
      .max(P_RULES.MAX_MEMBERS)
      .default(P_RULES.DEFAULT_MEMBERS)
      .optional(),
    requirements: z.string().trim().max(2000).nullable().optional(),
    compensation_type: z
      .enum(['unpaid_academic', 'paid', 'milestone_based', 'revenue_share', 'negotiable'])
      .optional()
      .default('unpaid_academic'),
    compensation_amount: z.number().min(0).nullable().optional(),
    compensation_currency: z.string().trim().max(15).nullable().optional().default('CLP'),
    compensation_periodicity: z.string().trim().max(50).nullable().optional(),
    compensation_notes: z.string().trim().max(1000).nullable().optional(),
    agreements: z.record(z.any()).optional().default({}),
    external_links: z.record(z.any()).optional().default({}),
    milestones: z.array(projectMilestoneInputSchema).max(20).optional().default([]),
    cover_url: z.string().trim().max(500).nullable().optional(),
    // Soporta tanto lista de nombres simples (compatibilidad) como objetos estructurados de rol
    positions: z.array(z.union([z.string().trim().max(P_RULES.POSITION.MAX_TITLE_LENGTH), projectPositionInputSchema])).max(15).optional(),
    required_roles: z.array(z.string().trim().max(50)).max(15).optional(),
  })
  .strict();

export const updateProjectSchema = z
  .object({
    title: z.string().trim().min(P_RULES.MIN_TITLE_LENGTH).max(P_RULES.MAX_TITLE_LENGTH).optional(),
    short_description: z.string().trim().max(350).nullable().optional(),
    description: z.string().trim().max(6000).nullable().optional(),
    problem_statement: z.string().trim().max(3000).nullable().optional(),
    objectives: z.string().trim().max(3000).nullable().optional(),
    category: z.string().trim().max(100).optional(),
    career: z.string().trim().max(120).optional(),
    technologies: z.array(z.string().trim().max(50)).max(20).optional(),
    tags: z.array(z.string().trim().max(40)).max(12).optional(),
    status: z.enum(['draft', 'open', 'recruiting', 'in_progress', 'completed', 'cancelled']).optional(),
    visibility: z.enum(['public', 'private']).optional(),
    modality: z.enum(['online', 'presencial', 'hibrido']).optional(),
    dedication_hours: z.number().int().min(1).max(60).optional(),
    max_members: z.number().int().min(P_RULES.MIN_MEMBERS).max(P_RULES.MAX_MEMBERS).optional(),
    requirements: z.string().trim().max(2000).nullable().optional(),
    compensation_type: z
      .enum(['unpaid_academic', 'paid', 'milestone_based', 'revenue_share', 'negotiable'])
      .optional(),
    compensation_amount: z.number().min(0).nullable().optional(),
    compensation_currency: z.string().trim().max(15).nullable().optional(),
    compensation_periodicity: z.string().trim().max(50).nullable().optional(),
    compensation_notes: z.string().trim().max(1000).nullable().optional(),
    agreements: z.record(z.any()).optional(),
    external_links: z.record(z.any()).optional(),
    milestones: z.array(projectMilestoneInputSchema).max(20).optional(),
    cover_url: z.string().trim().max(500).nullable().optional(),
    positions: z.array(z.union([z.string().trim().max(P_RULES.POSITION.MAX_TITLE_LENGTH), projectPositionInputSchema])).max(15).optional(),
  })
  .strict();

export const applyToProjectSchema = z
  .object({
    message: z.string().trim().max(P_RULES.MAX_PITCH_LENGTH).optional(),
    role_applied: z.string().trim().max(80).optional(),
    relevant_skills: z.array(z.string().trim().max(50)).max(15).optional().default([]),
    portfolio_url: z.string().trim().max(300).nullable().optional(),
    availability_notes: z.string().trim().max(500).nullable().optional(),
    accepted_agreements: z.boolean().optional().default(true),
  })
  .strict();

export const reviewApplicationSchema = z
  .object({
    status: z.enum(['accepted', 'rejected'], {
      errorMap: () => ({ message: 'Estado inválido. Opciones: accepted, rejected' }),
    }),
    feedback: z.string().trim().max(500).optional(),
  })
  .strict();

export const updatePositionStatusSchema = z
  .object({
    status: z.enum(['open', 'paused', 'filled', 'closed']),
  })
  .strict();
