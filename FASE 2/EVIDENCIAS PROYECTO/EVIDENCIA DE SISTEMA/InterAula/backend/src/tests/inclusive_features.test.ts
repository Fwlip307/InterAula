import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../app.js';
import { accessibilityPreferencesSchema } from '../schemas/profile.schema.js';
import {
  updateLearningSpaceConfigSchema,
  createQuickIdeaSchema,
  adaptiveExplanationRequestSchema,
} from '../schemas/learningSpace.schema.js';
import { aiBreakdownTaskSchema } from '../schemas/ai.schema.js';
import {
  updateSessionPrepSchema,
  classroomSignalSchema,
} from '../schemas/tutoring.schema.js';
import {
  inclusiveAccreditationRequestSchema,
  reviewInclusiveAccreditationSchema,
} from '../schemas/verification.schema.js';
import { createDeliverableSchema } from '../schemas/project.schema.js';

describe('Aprendizaje Inclusivo — Esquemas Zod y Seguridad Fail-Closed', () => {
  it('accessibilityPreferencesSchema acepta preferencias sensoriales y rechaza campos no permitidos (.strict)', () => {
    const valid = accessibilityPreferencesSchema.safeParse({
      warmFilter: true,
      easyReadingFont: true,
      readingRuler: true,
      readingRulerIntensity: 'medium',
      disableFlashing: true,
      literalLanguage: true,
    });
    assert.equal(valid.success, true);

    const invalid = accessibilityPreferencesSchema.safeParse({
      warmFilter: true,
      diagnosticLabel: 'should_fail',
    });
    assert.equal(invalid.success, false);
  });

  it('updateLearningSpaceConfigSchema valida supportPassport, weeklyGoalDays y activeStudyDates', () => {
    const valid = updateLearningSpaceConfigSchema.safeParse({
      weeklyGoalDays: 4,
      activeStudyDates: ['2026-11-10', '2026-11-12'],
      supportPassport: {
        selectedSupports: ['written_instructions', 'literal_language'],
        customNotes: 'Prefiero consignas breves por escrito.',
        sharedWithTutorIds: ['00000000-0000-4000-8000-000000000001'],
        sharedWithProjectIds: [],
        sharedItemKeys: ['written_instructions'],
      },
    });
    assert.equal(valid.success, true);

    const badDate = updateLearningSpaceConfigSchema.safeParse({
      activeStudyDates: ['12-11-2026'],
    });
    assert.equal(badDate.success, false);
  });

  it('esquemas de Quick Ideas, AI Breakdown, Literal Mode, Semáforo, Guion, Acreditación Inclusiva y Entregables validan correctamente', () => {
    assert.equal(
      createQuickIdeaSchema.safeParse({ content: 'Preguntar por JOIN', context_type: 'tutoring' }).success,
      true
    );
    assert.equal(
      aiBreakdownTaskSchema.safeParse({ title: 'Estudiar recursión en Java' }).success,
      true
    );
    assert.equal(
      adaptiveExplanationRequestSchema.safeParse({
        subject_name: 'Programación',
        topic: 'Recursión',
        mode: 'paso_a_paso',
        literal_mode: true,
      }).success,
      true
    );
    assert.equal(classroomSignalSchema.safeParse({ signal: 'blue' }).success, true);
    assert.equal(classroomSignalSchema.safeParse({ signal: 'purple' }).success, false);
    assert.equal(
      updateSessionPrepSchema.safeParse({
        agenda_preview: {
          what_we_will_see: 'Repaso de consultas SQL',
          step_by_step: '1. SELECT 2. JOIN',
          how_it_ends: 'Resumen y dudas finales',
        },
        camera_policy: 'optional',
        participation_mode: 'chat_or_voice',
      }).success,
      true
    );
    assert.equal(
      inclusiveAccreditationRequestSchema.safeParse({
        training_name: 'Taller de acompañamiento inclusivo',
        evidence_notes: 'Certificado de participación en formación inclusiva.',
      }).success,
      true
    );
    assert.equal(
      reviewInclusiveAccreditationSchema.safeParse({ status: 'approved' }).success,
      true
    );
    assert.equal(
      createDeliverableSchema.safeParse({
        title: 'Primer prototipo',
        expected_format: 'PDF o enlace',
      }).success,
      true
    );
  });

  it('endpoints privados inclusivos responden 401 sin token de autenticación', async () => {
    const resIdeas = await request(app).get('/api/learning-space/ideas');
    assert.equal(resIdeas.status, 401);

    const resBreakdown = await request(app)
      .post('/api/ai/breakdown-task')
      .send({ title: 'Preparar certamen' });
    assert.equal(resBreakdown.status, 401);

    const resSignals = await request(app).get('/api/tutoring/rooms/test-room/signals');
    assert.equal(resSignals.status, 401);

    const resInclusive = await request(app).get('/api/verification/inclusive-accreditation/me');
    assert.equal(resInclusive.status, 401);

    const resDeliverables = await request(app).get(
      '/api/projects/00000000-0000-4000-8000-000000000001/deliverables'
    );
    assert.equal(resDeliverables.status, 401);
  });
});

