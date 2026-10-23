import { z } from 'zod';

export const updateProfileSchema = z
  .object({
    first_name: z.string().trim().max(60, 'El nombre no puede exceder 60 caracteres').nullable().optional(),
    last_name: z.string().trim().max(60, 'El apellido no puede exceder 60 caracteres').nullable().optional(),
    display_name: z.string().trim().max(80, 'El nombre público no puede exceder 80 caracteres').nullable().optional(),
    institution: z.string().trim().max(120, 'La institución no puede exceder 120 caracteres').nullable().optional(),
    career: z.string().trim().max(120, 'La carrera no puede exceder 120 caracteres').nullable().optional(),
    bio: z.string().trim().max(1000, 'La biografía no puede exceder 1000 caracteres').nullable().optional(),
    location: z.string().trim().max(120, 'La sede o ciudad no puede exceder 120 caracteres').nullable().optional(),
    phone: z.string().trim().max(25, 'El teléfono no puede exceder 25 caracteres').nullable().optional(),
    show_phone: z.boolean().optional(),
    show_email: z.boolean().optional(),
    github_url: z
      .string()
      .trim()
      .url('URL de GitHub inválida')
      .or(z.literal(''))
      .nullable()
      .optional(),
    linkedin_url: z
      .string()
      .trim()
      .url('URL de LinkedIn inválida')
      .or(z.literal(''))
      .nullable()
      .optional(),
    portfolio_url: z
      .string()
      .trim()
      .url('URL de Portafolio inválida')
      .or(z.literal(''))
      .nullable()
      .optional(),
    available_for_tutoring: z.boolean().optional(),
    learning_preferences: z.array(z.string()).max(20).optional(),
    // Campos de DUA y accesibilidad neuroinclusiva
    dua_contrast_mode: z.boolean().optional(),
    dua_font_scale: z.number().min(0.8).max(1.8).optional(),
    dua_adhd_reading_guide: z.boolean().optional(),
    dua_screen_reader_opt: z.boolean().optional(),
    dua_learning_style: z.string().max(50).nullable().optional(),
  })
  .strict(); // Rechaza asignación masiva de campos no autorizados (ej: id, email, is_admin)

export const addOfferedSubjectSchema = z
  .object({
    subject_id: z.string().trim().min(1, 'El identificador de materia es obligatorio'),
    level: z.enum(['basic', 'intermediate', 'advanced'], {
      errorMap: () => ({ message: 'Nivel académico inválido. Valores permitidos: basic, intermediate, advanced' }),
    }),
    description: z.string().trim().max(500, 'La descripción no puede exceder 500 caracteres').optional(),
  })
  .strict();

export const addNeededSubjectSchema = z
  .object({
    subject_id: z.string().trim().min(1, 'El identificador de materia es obligatorio'),
    level: z.enum(['basic', 'intermediate', 'advanced'], {
      errorMap: () => ({ message: 'Nivel académico inválido. Valores permitidos: basic, intermediate, advanced' }),
    }),
    notes: z.string().trim().max(500, 'Las notas no pueden exceder 500 caracteres').optional(),
  })
  .strict();
