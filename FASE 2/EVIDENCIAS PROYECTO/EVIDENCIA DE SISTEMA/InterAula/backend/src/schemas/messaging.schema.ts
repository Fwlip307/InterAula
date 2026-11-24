import { z } from 'zod';

export const createConversationSchema = z
  .object({
    recipient_id: z.string().uuid('ID de destinatario inválido'),
    context_type: z.enum(['general', 'tutoring', 'project']).default('general'),
    context_id: z.string().uuid().optional().nullable(),
    context_label: z.string().trim().max(120).optional().nullable(),
    initial_message: z.string().trim().min(1).max(2000).optional(),
  })
  .strict();

export const sendMessageSchema = z
  .object({
    body: z.string().trim().min(1, 'Escribe un mensaje antes de enviar').max(2000, 'El mensaje supera el límite de 2000 caracteres'),
  })
  .strict();

export const conversationParamsSchema = z
  .object({
    id: z.string().uuid('ID de conversación inválido'),
  })
  .strict();

export const contactsQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional(),
  })
  .strict();
