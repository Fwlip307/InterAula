import { z } from 'zod';
import { BUSINESS_RULES } from '../constants/businessRules.js';

const N_RULES = BUSINESS_RULES.NOTES;

export const createNoteSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(N_RULES.MIN_TITLE_LENGTH, `El título debe tener al menos ${N_RULES.MIN_TITLE_LENGTH} caracteres`)
      .max(N_RULES.MAX_TITLE_LENGTH),
    summary: z.string().trim().max(N_RULES.MAX_SUMMARY_LENGTH).default(''),
    subject_id: z.string().uuid().nullable().optional(),
    subject_name: z.string().trim().max(120).default('General'),
    career: z.string().trim().max(120).default('Ingeniería en Informática'),
    category: z.string().trim().max(80).default('Apunte de Clase'),
    folder: z.string().trim().max(80).default('General'),
    content_html: z.string().max(N_RULES.MAX_CONTENT_LENGTH).default(''),
    content_markdown: z.string().max(N_RULES.MAX_CONTENT_LENGTH).default(''),
    content_json: z.record(z.any()).optional().default({}),
    source_type: z.enum(['editor', 'upload']).default('editor'),
    file_url: z.string().max(500000).nullable().optional(),
    file_name: z.string().trim().max(255).nullable().optional(),
    file_mime: z.string().trim().max(150).nullable().optional(),
    file_size: z
      .number()
      .int()
      .min(0)
      .max(N_RULES.MAX_FILE_SIZE_BYTES, 'El archivo excede el tamaño máximo permitido de 15 MB')
      .optional()
      .default(0),
    file_extension: z.string().trim().max(20).nullable().optional(),
    tags: z.array(z.string().trim().max(40)).max(12).default([]),
    visibility: z.enum(['private', 'shared', 'public']).default('public'),
    is_draft: z.boolean().default(false),
  })
  .strict();

export const updateNoteSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(N_RULES.MIN_TITLE_LENGTH, `El título debe tener al menos ${N_RULES.MIN_TITLE_LENGTH} caracteres`)
      .max(N_RULES.MAX_TITLE_LENGTH)
      .optional(),
    summary: z.string().trim().max(N_RULES.MAX_SUMMARY_LENGTH).optional(),
    subject_id: z.string().uuid().nullable().optional(),
    subject_name: z.string().trim().max(120).optional(),
    career: z.string().trim().max(120).optional(),
    category: z.string().trim().max(80).optional(),
    folder: z.string().trim().max(80).optional(),
    content_html: z.string().max(N_RULES.MAX_CONTENT_LENGTH).optional(),
    content_markdown: z.string().max(N_RULES.MAX_CONTENT_LENGTH).optional(),
    content_json: z.record(z.any()).optional(),
    file_url: z.string().max(500000).nullable().optional(),
    file_name: z.string().trim().max(255).nullable().optional(),
    file_mime: z.string().trim().max(150).nullable().optional(),
    file_size: z.number().int().min(0).max(N_RULES.MAX_FILE_SIZE_BYTES).optional(),
    file_extension: z.string().trim().max(20).nullable().optional(),
    tags: z.array(z.string().trim().max(40)).max(12).optional(),
    visibility: z.enum(['private', 'shared', 'public']).optional(),
    is_draft: z.boolean().optional(),
    expected_version: z.number().int().min(1).optional(),
  })
  .strict();

