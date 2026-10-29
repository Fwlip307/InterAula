import { z } from 'zod';
import { BUSINESS_RULES } from '../constants/businessRules.js';

const F_RULES = BUSINESS_RULES.FORUM;

export const createForumPostSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(F_RULES.POST.MIN_TITLE_LENGTH, `El título debe tener al menos ${F_RULES.POST.MIN_TITLE_LENGTH} caracteres`)
      .max(F_RULES.POST.MAX_TITLE_LENGTH),
    description: z
      .string()
      .trim()
      .min(F_RULES.POST.MIN_DESCRIPTION_LENGTH, `El contenido debe tener al menos ${F_RULES.POST.MIN_DESCRIPTION_LENGTH} caracteres`)
      .max(F_RULES.POST.MAX_DESCRIPTION_LENGTH),
    category: z.string().trim().min(2).max(80).default('General'),
    post_type: z.enum(['pregunta', 'discusion', 'duda', 'recurso']).default('pregunta'),
    subject_id: z.string().uuid().nullable().optional(),
    tags: z.array(z.string().trim().max(30)).max(F_RULES.POST.MAX_TAGS).default([]),
  })
  .strict();

export const updateForumPostSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(F_RULES.POST.MIN_TITLE_LENGTH, `El título debe tener al menos ${F_RULES.POST.MIN_TITLE_LENGTH} caracteres`)
      .max(F_RULES.POST.MAX_TITLE_LENGTH)
      .optional(),
    description: z
      .string()
      .trim()
      .min(F_RULES.POST.MIN_DESCRIPTION_LENGTH, `El contenido debe tener al menos ${F_RULES.POST.MIN_DESCRIPTION_LENGTH} caracteres`)
      .max(F_RULES.POST.MAX_DESCRIPTION_LENGTH)
      .optional(),
    category: z.string().trim().min(2).max(80).optional(),
    post_type: z.enum(['pregunta', 'discusion', 'duda', 'recurso']).optional(),
    subject_id: z.string().uuid().nullable().optional(),
    tags: z.array(z.string().trim().max(30)).max(F_RULES.POST.MAX_TAGS).optional(),
  })
  .strict();

export const createForumReplySchema = z
  .object({
    content: z
      .string()
      .trim()
      .min(F_RULES.REPLY.MIN_CONTENT_LENGTH, `La respuesta debe tener al menos ${F_RULES.REPLY.MIN_CONTENT_LENGTH} caracteres`)
      .max(F_RULES.REPLY.MAX_CONTENT_LENGTH),
  })
  .strict();

export const updateForumReplySchema = z
  .object({
    content: z
      .string()
      .trim()
      .min(F_RULES.REPLY.MIN_CONTENT_LENGTH, `La respuesta debe tener al menos ${F_RULES.REPLY.MIN_CONTENT_LENGTH} caracteres`)
      .max(F_RULES.REPLY.MAX_CONTENT_LENGTH),
  })
  .strict();

export const toggleSolvedSchema = z
  .object({
    is_solved: z.boolean().optional(),
  })
  .strict();
