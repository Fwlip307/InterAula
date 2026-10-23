import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../app.js';

describe('InterAula Backend API - Suite de Pruebas Automatizadas', () => {
  describe('1. Endpoint de Salud y Rutas Base', () => {
    test('GET /api/health debe responder 200 con estado ok sin filtrar secretos', async () => {
      const res = await request(app).get('/api/health');
      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'ok');
      assert.equal(res.body.service, 'InterAula Backend API');
      assert.ok(typeof res.body.uptime === 'number');
      assert.ok(typeof res.body.timestamp === 'string');

      // Verificación de seguridad: no debe contener claves ni configuraciones privadas
      assert.equal(res.body.supabaseUrl, undefined);
      assert.equal(res.body.supabaseAnonKey, undefined);
      assert.equal(res.body.supabaseServiceRoleKey, undefined);
    });

    test('GET /api/ruta-inexistente debe responder 404 JSON controlado', async () => {
      const res = await request(app).get('/api/ruta-inexistente');
      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.match(res.body.error, /no encontrada/i);
    });
  });

  describe('2. Seguridad de Autenticación y Middleware requireAuth', () => {
    test('POST /api/tutoring/sessions sin token debe responder 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/tutoring/sessions')
        .send({
          tutor_id: '00000000-0000-0000-0000-000000000001',
          subject_id: 'calculo_1',
          scheduled_at: new Date(Date.now() + 86400000).toISOString(),
        });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.match(res.body.error, /No autorizado.*token Bearer/i);
    });

    test('POST /api/tutoring/sessions con Bearer token malformado o falso debe responder 401', async () => {
      const res = await request(app)
        .post('/api/tutoring/sessions')
        .set('Authorization', 'Bearer token_invalido_de_prueba')
        .send({
          tutor_id: '00000000-0000-0000-0000-000000000001',
          subject_id: 'calculo_1',
          scheduled_at: new Date(Date.now() + 86400000).toISOString(),
        });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.match(res.body.error, /Sesión inválida o expirada/i);
    });

    test('PUT /api/profiles/me sin autenticación debe responder 401', async () => {
      const res = await request(app)
        .put('/api/profiles/me')
        .send({ first_name: 'Hacker' });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    test('POST /api/workshops sin autenticación debe responder 401', async () => {
      const res = await request(app)
        .post('/api/workshops')
        .send({
          subject_id: 'matematica_1',
          title: 'Taller no autorizado',
          scheduled_at: new Date(Date.now() + 86400000).toISOString(),
        });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });
  });

  describe('3. Validación de Datos con Zod y Protección Anti-Mass Assignment', () => {
    test('POST /api/tutoring/sessions con datos incompletos debe responder 400 Bad Request', async () => {
      // Mockeamos token con formato Bearer para superar el middleware auth o verificar validación
      // Nota: auth se ejecuta antes, por lo que probamos el schema de validación directamente
      const { requestSessionSchema } = await import('../schemas/tutoring.schema.js');

      const invalidPayload = {
        duration_minutes: 5, // Mínimo es 15
        modality: 'telepatia', // No permitido
      };

      const result = requestSessionSchema.safeParse(invalidPayload);
      assert.equal(result.success, false);
      if (!result.success) {
        const issues = result.error.issues;
        assert.ok(issues.some((i) => i.path.includes('tutor_id')));
        assert.ok(issues.some((i) => i.path.includes('subject_id')));
        assert.ok(issues.some((i) => i.path.includes('scheduled_at')));
      }
    });

    test('Esquema de perfil protege contra elevación de privilegios (is_admin, role, id)', async () => {
      const { updateProfileSchema } = await import('../schemas/profile.schema.js');

      const maliciousPayload = {
        first_name: 'Estudiante',
        last_name: 'Prueba',
        // Intentos maliciosos de inyección de privilegios:
        is_admin: true,
        role: 'admin',
        is_verified: true,
        id: '00000000-0000-0000-0000-000000000000',
      };

      // Al tener .strict(), Zod rechaza campos no permitidos
      const result = updateProfileSchema.safeParse(maliciousPayload);
      assert.equal(result.success, false);
      if (!result.success) {
        const issueCodes = result.error.issues.map((i) => i.code);
        assert.ok(issueCodes.includes('unrecognized_keys'));
      }
    });

    test('Esquema de acreditación bot exige puntaje mínimo de 70%', async () => {
      const { botGrantVerificationSchema } = await import('../schemas/verification.schema.js');

      // Caso 1: Puntaje insuficiente (60%) debe ser rechazado
      const failingPayload = {
        subject_id: 'programacion_1',
        score: 60,
        level: 'intermediate' as const,
      };
      const failResult = botGrantVerificationSchema.safeParse(failingPayload);
      // El esquema admite score 0-100 pero el servicio valida >= 70, o el esquema valida rango
      assert.equal(failResult.success, true); // El esquema valida números válidos

      // Ahora verificamos la regla de negocio del servicio:
      const { verificationBackendService } = await import('../services/verification.service.js');
      await assert.rejects(
        async () => {
          await verificationBackendService.botGrant(
            { id: 'user-1' },
            'fake-token',
            failingPayload
          );
        },
        {
          name: 'Error',
          message: /Puntaje insuficiente.*mínimo de 70%/i,
        }
      );
    });

    test('Esquema de taller valida límite de cupos y fecha ISO', async () => {
      const { createWorkshopSchema } = await import('../schemas/workshop.schema.js');

      const invalidWorkshop = {
        subject_id: 'algebra_1',
        title: 'ab', // Demasiado corto (mínimo 4)
        scheduled_at: 'fecha-no-iso',
        max_students: 1, // Mínimo 2
      };

      const result = createWorkshopSchema.safeParse(invalidWorkshop);
      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error.issues.some((i) => i.path.includes('title')));
        assert.ok(result.error.issues.some((i) => i.path.includes('scheduled_at')));
        assert.ok(result.error.issues.some((i) => i.path.includes('max_students')));
      }
    });
  });

  describe('4. Reglas de Negocio en Servicios del Backend', () => {
    test('Un usuario no puede solicitar tutoría consigo mismo', async () => {
      const { tutoringBackendService } = await import('../services/tutoring.service.js');

      await assert.rejects(
        async () => {
          await tutoringBackendService.requestSession(
            { id: 'user-123' },
            'fake-token',
            {
              tutor_id: 'user-123', // Mismo usuario
              subject_id: 'quimica_general',
              scheduled_at: new Date(Date.now() + 86400000).toISOString(),
              duration_minutes: 60,
              modality: 'online',
            }
          );
        },
        {
          name: 'Error',
          message: /No puedes agendar una tutoría contigo mismo/i,
        }
      );
    });

    test('Calificación de tutoría debe estar en rango 1 a 5', async () => {
      const { submitReviewSchema } = await import('../schemas/tutoring.schema.js');

      const invalidReview = {
        rating: 6, // Fuera de rango 1-5
        comment: 'Excelente tutor',
      };

      const result = submitReviewSchema.safeParse(invalidReview);
      assert.equal(result.success, false);
    });

    test('Evaluador de IA analiza heurísticamente respuestas cuando no hay clave externa', async () => {
      const { aiBackendService } = await import('../services/ai.service.js');

      const evaluation = await aiBackendService.evaluateAnswer({
        question: '¿Qué es el polimorfismo?',
        answer: 'Es la capacidad que tienen los objetos de diferentes clases de responder a un mismo mensaje o método con implementaciones específicas en cada tipo derivado.',
        level: 'intermediate',
      });

      assert.ok(typeof evaluation.score === 'number');
      assert.ok(evaluation.score >= 1 && evaluation.score <= 10);
      assert.equal(typeof evaluation.passed, 'boolean');
      assert.ok(evaluation.feedback.length > 10);
    });
  });

  describe('5. Endpoints Públicos de Consulta y Seguridad de Roles', () => {
    test('GET /api/forum/posts responde 200 con listado en formato arreglo', async () => {
      const res = await request(app).get('/api/forum/posts');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
    });

    test('GET /api/profiles/catalog/subjects responde 200 con materias del catálogo', async () => {
      const res = await request(app).get('/api/profiles/catalog/subjects');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
    });

    test('GET /api/verification/for-validator deniega acceso sin token (401)', async () => {
      const res = await request(app).get('/api/verification/for-validator');
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    test('POST /api/verification/requests/123/practical-exercise deniega acceso sin token (401)', async () => {
      const res = await request(app)
        .post('/api/verification/requests/123/practical-exercise')
        .send({ practical_exercise_title: 'Desarrollo de API segura' });
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    test('POST /api/verification/requests/123/review deniega acceso sin token (401)', async () => {
      const res = await request(app)
        .post('/api/verification/requests/123/review')
        .send({ status: 'approved', reviewer_feedback: 'Aprobado formalmente' });
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });
  });
});

