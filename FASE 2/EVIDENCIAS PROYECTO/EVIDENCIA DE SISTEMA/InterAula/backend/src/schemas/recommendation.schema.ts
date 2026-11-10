import { z } from 'zod';
const topicIds = z.array(z.string().regex(/^[a-z][a-z0-9-]{1,49}$/)).max(12)
  .refine(ids=>new Set(ids).size===ids.length,'Hay temas repetidos.');
export const recommendationPreferencesSchema = z.object({
  revision:z.number().int().min(0).max(999999999),
  personalization_enabled:z.boolean(), discoverable:z.boolean(),
  interest:topicIds, learn:topicIds, teach:topicIds,
}).strict();
export const recommendationFeedQuery = z.object({limit:z.coerce.number().int().min(1).max(30).default(9)}).strict();
export const recommendationItemSchema = z.object({
  kind:z.enum(['note','post','project','workshop','person']),id:z.string().uuid(),
}).strict();
