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


  describe('6. Evolución Completa: Foro Académico, Biblioteca de Apuntes y Hub de Proyectos', () => {
    test('Foro: CRUD completo de publicaciones, respuestas, votos únicos, permisos de autor y solución aceptada', async () => {
      const { forumBackendService } = await import('../services/forum.service.js');
      const { persistentStore } = await import('../lib/persistentStore.js');
      persistentStore.resetForTests();

      const author = { id: '00000000-0000-0000-0000-000000000101', email: 'autor.foro@duocuc.cl' };
      const otherUser = { id: '00000000-0000-0000-0000-000000000202', email: 'otro.usuario@duocuc.cl' };

      // 1. Crear publicación
      const created = await forumBackendService.createPost(author, 'fake-jwt', {
        title: '¿Cómo diseñar índices compuestos en PostgreSQL?',
        description: 'Necesito optimizar una consulta que filtra por fecha y estado en una tabla grande.',
        category: 'Bases de Datos',
        post_type: 'pregunta',
        tags: ['PostgreSQL', 'Índices'],
      });
      assert.ok(created.id);
      assert.equal(created.postType, 'pregunta');
      assert.equal(created.votesCount, 1);

      // 2. Otro usuario no puede editar ni eliminar la publicación del autor
      await assert.rejects(
        async () => {
          await forumBackendService.updatePost(otherUser, 'fake-jwt', created.id, {
            title: 'Intento de edición no autorizada',
          });
        },
        /Solo el autor puede editar/
      );

      await assert.rejects(
        async () => {
          await forumBackendService.deletePost(otherUser, 'fake-jwt', created.id);
        },
        /Solo el autor puede eliminar/
      );

      // 3. El autor sí puede editar su publicación
      const updated = await forumBackendService.updatePost(author, 'fake-jwt', created.id, {
        title: '¿Cómo diseñar índices compuestos B-Tree en PostgreSQL?',
      });
      assert.match(updated.title, /B-Tree/);

      // 4. Voto único por usuario autenticado (toggle sin duplicados infinitos)
      const vote1 = await forumBackendService.upvotePost(created.id, otherUser);
      assert.equal(vote1.votesCount, 2);
      assert.equal(vote1.hasVoted, true);

      const vote2 = await forumBackendService.upvotePost(created.id, otherUser);
      assert.equal(vote2.votesCount, 1);
      assert.equal(vote2.hasVoted, false);

      // 5. Crear respuesta, editarla y marcarla como solución aceptada por el autor del post
      const reply = await forumBackendService.createReply(
        otherUser,
        'fake-jwt',
        created.id,
        'Debes colocar primero la columna de igualdad (estado) y luego la de rango (fecha).'
      );
      assert.ok(reply.id);

      // El autor del post no puede editar el texto de la respuesta de otro usuario
      await assert.rejects(
        async () => {
          await forumBackendService.updateReply(author, 'fake-jwt', reply.id, 'Texto alterado');
        },
        /Solo el autor puede editar esta respuesta/
      );

      // Otro usuario que no es dueño del post no puede marcar la respuesta como solución
      await assert.rejects(
        async () => {
          await forumBackendService.markReplyAsSolution(otherUser, 'fake-jwt', created.id, reply.id);
        },
        /Solo el autor de la consulta puede marcar una respuesta como solución/
      );

      // El autor del post marca la respuesta como solución aceptada
      const sol = await forumBackendService.markReplyAsSolution(author, 'fake-jwt', created.id, reply.id);
      assert.equal(sol.isSolved, true);
      assert.equal(sol.acceptedReplyId, reply.id);

      // 6. Eliminar respuesta y publicación por sus respectivos autores
      await forumBackendService.deleteReply(otherUser, 'fake-jwt', reply.id);
      await forumBackendService.deletePost(author, 'fake-jwt', created.id);
    });

    test('Biblioteca de Apuntes: CRUD, control de versiones anti-sobrescritura, visibilidad privada y descargas', async () => {
      const { notesBackendService } = await import('../services/notes.service.js');
      const { persistentStore } = await import('../lib/persistentStore.js');
      persistentStore.resetForTests();

      const owner = { id: '00000000-0000-0000-0000-000000000301', email: 'tutor.apuntes@duocuc.cl' };
      const visitor = { id: '00000000-0000-0000-0000-000000000302', email: 'estudiante@duocuc.cl' };

      // 1. Crear apunte desde el Editor Integrado
      const note = await notesBackendService.createNote(owner, 'fake-jwt', {
        title: 'Guía Completa de Programación Orientada a Objetos',
        summary: 'Herencia, polimorfismo, encapsulamiento y principios SOLID.',
        subject_name: 'Programación Orientada a Objetos',
        career: 'Ingeniería en Informática',
        category: 'Resumen de Certamen',
        folder: 'Certamen 1',
        content_html: '<h1>Principios POO</h1><p>Contenido académico detallado.</p>',
        content_markdown: '# Principios POO\n\nContenido académico detallado.',
        source_type: 'editor',
        tags: ['POO', 'SOLID'],
        visibility: 'public',
        is_draft: false,
      });

      assert.equal(note.version, 1);
      assert.equal(note.downloadsCount, 0);

      // 2. Actualizar apunte incrementa versión a 2
      const updatedV2 = await notesBackendService.updateNote(owner, 'fake-jwt', note.id, {
        title: 'Guía Completa de POO y Principios SOLID',
        expected_version: 1,
      });
      assert.equal(updatedV2.version, 2);

      // 3. Petición atrasada con expected_version=1 debe ser rechazada para no sobrescribir cambios nuevos
      await assert.rejects(
        async () => {
          await notesBackendService.updateNote(owner, 'fake-jwt', note.id, {
            title: 'Versión obsoleta que intenta pisar cambios',
            expected_version: 1,
          });
        },
        /Conflicto de versión detectado/
      );

      // 4. Apunte privado no es accesible para otros usuarios
      await notesBackendService.updateNote(owner, 'fake-jwt', note.id, {
        visibility: 'private',
        expected_version: 2,
      });

      await assert.rejects(
        async () => {
          await notesBackendService.getNoteById(note.id, visitor.id);
        },
        /Este apunte es privado/
      );

      // 5. Registrar descarga incrementa contador real
      const dl = await notesBackendService.registerDownload(note.id);
      assert.equal(dl.downloadsCount, 1);

      // 6. Rechazar subida con extensión peligrosa
      await assert.rejects(
        async () => {
          await notesBackendService.createNote(owner, 'fake-jwt', {
            title: 'Archivo inválido',
            source_type: 'upload',
            file_name: 'script.bat',
            file_extension: '.bat',
          });
        },
        /Extensión de archivo no permitida/
      );
    });

    test('Hub de Proyectos: publicación con roles, acuerdos económicos, postulación auditable y gestión de cupos', async () => {
      const { projectBackendService } = await import('../services/project.service.js');
      const { persistentStore } = await import('../lib/persistentStore.js');
      persistentStore.resetForTests();

      const leader = { id: '00000000-0000-0000-0000-000000000401', email: 'lider.proyecto@duocuc.cl' };
      const applicant = { id: '00000000-0000-0000-0000-000000000402', email: 'dev.frontend@duocuc.cl' };

      // 1. Publicar proyecto con vacantes estructuradas y acuerdos económicos
      const project = await projectBackendService.createProject(leader, 'fake-jwt', {
        title: 'Sistema de Gestión de Laboratorios 3D',
        short_description: 'Plataforma web e interactiva para reserva de equipamiento.',
        description: 'Proyecto interdisciplinario con roles de Frontend, Backend y Modelado 3D.',
        problem_statement: 'Falta de trazabilidad en préstamos de equipos de laboratorio.',
        objectives: 'Construir MVP funcional en 8 semanas.',
        category: 'Desarrollo de Software',
        technologies: ['React', 'TypeScript', 'Three.js', 'PostgreSQL'],
        modality: 'hibrido',
        dedication_hours: 8,
        max_members: 4,
        compensation_type: 'milestone_based',
        compensation_amount: 120000,
        compensation_currency: 'CLP',
        compensation_periodicity: 'por_hito',
        agreements: {
          schedule: 'Martes y Jueves 19:00 hrs',
          deliverables: '1 entregable cada 2 semanas',
        },
        positions: [
          {
            title: 'Frontend & 3D Developer',
            description: 'Integración de visores Three.js en React.',
            skills_required: ['React', 'Three.js'],
            mandatory_requirements: ['Portafolio o demo previa'],
            slots: 1,
            status: 'open',
          },
        ],
      });

      assert.ok(project.id);
      assert.equal(project.positions.length, 1);
      const positionId = project.positions[0].id;

      // 2. El creador no puede postular a su propio proyecto
      await assert.rejects(
        async () => {
          await projectBackendService.applyToPosition(leader, 'fake-jwt', project.id, positionId, {
            message: 'Quiero postular a mi propio proyecto',
            accepted_agreements: true,
          });
        },
        /No puedes postular a tu propio proyecto/
      );

      // 3. No se puede postular sin aceptar explícitamente los acuerdos
      await assert.rejects(
        async () => {
          await projectBackendService.applyToPosition(applicant, 'fake-jwt', project.id, positionId, {
            message: 'Postulación sin aceptar acuerdos',
            accepted_agreements: false,
          });
        },
        /Debes aceptar explícitamente los acuerdos/
      );

      // 4. Postulación válida con aceptación explícita de acuerdos
      const application = await projectBackendService.applyToPosition(
        applicant,
        'fake-jwt',
        project.id,
        positionId,
        {
          message: 'Tengo experiencia con React y modelado en Blender/Three.js.',
          relevant_skills: ['React', 'Three.js'],
          portfolio_url: 'https://github.com/estudiante/demo3d',
          accepted_agreements: true,
        }
      );
      assert.equal(application.status, 'pending');
      assert.equal(application.accepted_agreements, true);

      // 5. Rechaza postulación duplicada a la misma vacante
      await assert.rejects(
        async () => {
          await projectBackendService.applyToPosition(
            applicant,
            'fake-jwt',
            project.id,
            positionId,
            {
              message: 'Intento duplicado',
              accepted_agreements: true,
            }
          );
        },
        /Ya tienes una postulación registrada/
      );

      // 6. El creador acepta la postulación -> llena la vacante (1/1 -> filled) y suma al postulante a project_members
      const reviewed = await projectBackendService.reviewApplication(
        leader,
        'fake-jwt',
        application.id,
        'accepted',
        'Bienvenido al equipo'
      );
      assert.equal(reviewed?.status, 'accepted');

      const positionsAfter = await projectBackendService.getProjectPositions(project.id);
      assert.equal(positionsAfter[0].slots_filled, 1);
      assert.equal(positionsAfter[0].status, 'filled');

      const membersAfter = await projectBackendService.getProjectMembers(project.id);
      assert.equal(membersAfter.length, 2); // Líder + Miembro aceptado
    });
  });
