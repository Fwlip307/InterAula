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

    test('La acreditación solo acepta un intento del servidor, nunca una nota declarada', async () => {
      const { botGrantVerificationSchema } = await import('../schemas/verification.schema.js');
      assert.equal(botGrantVerificationSchema.safeParse({subject_id:'subject',score:100,level:'advanced'}).success,false);
      assert.equal(botGrantVerificationSchema.safeParse({attempt_id:'00000000-0000-0000-0000-000000000001'}).success,true);
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
          name: 'HttpError',
          status: 400,
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

    test('El evaluador informa indisponibilidad y no aprueba sin un criterio verificable', async () => {
      const { aiBackendService } = await import('../services/ai.service.js');

      const evaluation = await aiBackendService.evaluateAnswer({
        question: '¿Qué es el polimorfismo?',
        answer: 'Es la capacidad que tienen los objetos de diferentes clases de responder a un mismo mensaje o método con implementaciones específicas en cada tipo derivado.',
        level: 'intermediate',
      });

      assert.ok(typeof evaluation.score === 'number');
      assert.equal(evaluation.score, 0);
      assert.equal(evaluation.passed, false);
      assert.equal(evaluation.evaluated, false);
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
    const MOCK_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

    test('Foro: CRUD completo de publicaciones, respuestas, votos únicos, permisos de autor y solución aceptada', async () => {
      const { forumBackendService } = await import('../services/forum.service.js');
      const { persistentStore } = await import('../lib/persistentStore.js');
      persistentStore.resetForTests();

      const author = { id: '00000000-0000-0000-0000-000000000101', email: 'autor.foro@duocuc.cl' };
      const otherUser = { id: '00000000-0000-0000-0000-000000000202', email: 'otro.usuario@duocuc.cl' };

      // 1. Crear publicación
      const created = await forumBackendService.createPost(author, MOCK_TOKEN, {
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
          await forumBackendService.updatePost(otherUser, MOCK_TOKEN, created.id, {
            title: 'Intento de edición no autorizada',
          });
        },
        /Solo el autor puede editar/
      );

      await assert.rejects(
        async () => {
          await forumBackendService.deletePost(otherUser, MOCK_TOKEN, created.id);
        },
        /Solo el autor puede eliminar/
      );

      // 3. El autor sí puede editar su publicación
      const updated = await forumBackendService.updatePost(author, MOCK_TOKEN, created.id, {
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
        MOCK_TOKEN,
        created.id,
        'Debes colocar primero la columna de igualdad (estado) y luego la de rango (fecha).'
      );
      assert.ok(reply.id);

      // El autor del post no puede editar el texto de la respuesta de otro usuario
      await assert.rejects(
        async () => {
          await forumBackendService.updateReply(author, MOCK_TOKEN, reply.id, 'Texto alterado');
        },
        /Solo el autor puede editar esta respuesta/
      );

      // Otro usuario que no es dueño del post no puede marcar la respuesta como solución
      await assert.rejects(
        async () => {
          await forumBackendService.markReplyAsSolution(otherUser, MOCK_TOKEN, created.id, reply.id);
        },
        /Solo el autor de la consulta puede marcar una respuesta como solución/
      );

      // El autor del post marca la respuesta como solución aceptada
      const sol = await forumBackendService.markReplyAsSolution(author, MOCK_TOKEN, created.id, reply.id);
      assert.equal(sol.isSolved, true);
      assert.equal(sol.acceptedReplyId, reply.id);

      // 6. Eliminar respuesta y publicación por sus respectivos autores
      await forumBackendService.deleteReply(otherUser, MOCK_TOKEN, reply.id);
      await forumBackendService.deletePost(author, MOCK_TOKEN, created.id);
    });

    test('Biblioteca de Apuntes: CRUD, control de versiones anti-sobrescritura, visibilidad privada y descargas', async () => {
      const { notesBackendService } = await import('../services/notes.service.js');
      const { persistentStore } = await import('../lib/persistentStore.js');
      persistentStore.resetForTests();

      const owner = { id: '00000000-0000-0000-0000-000000000301', email: 'tutor.apuntes@duocuc.cl' };
      const visitor = { id: '00000000-0000-0000-0000-000000000302', email: 'estudiante@duocuc.cl' };

      // 1. Crear apunte desde el Editor Integrado
      const note = await notesBackendService.createNote(owner, MOCK_TOKEN, {
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
      const updatedV2 = await notesBackendService.updateNote(owner, MOCK_TOKEN, note.id, {
        title: 'Guía Completa de POO y Principios SOLID',
        expected_version: 1,
      });
      assert.equal(updatedV2.version, 2);

      // 3. Petición atrasada con expected_version=1 debe ser rechazada para no sobrescribir cambios nuevos
      await assert.rejects(
        async () => {
          await notesBackendService.updateNote(owner, MOCK_TOKEN, note.id, {
            title: 'Versión obsoleta que intenta pisar cambios',
            expected_version: 1,
          });
        },
        /Conflicto de versión detectado/
      );

      // 4. Apunte privado no es accesible para otros usuarios
      await notesBackendService.updateNote(owner, MOCK_TOKEN, note.id, {
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
          await notesBackendService.createNote(owner, MOCK_TOKEN, {
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
      const project = await projectBackendService.createProject(leader, MOCK_TOKEN, {
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
          await projectBackendService.applyToPosition(leader, MOCK_TOKEN, project.id, positionId, {
            message: 'Quiero postular a mi propio proyecto',
            accepted_agreements: true,
          });
        },
        /No puedes postular a tu propio proyecto/
      );

      // 3. No se puede postular sin aceptar explícitamente los acuerdos
      await assert.rejects(
        async () => {
          await projectBackendService.applyToPosition(applicant, MOCK_TOKEN, project.id, positionId, {
            message: 'Postulación sin aceptar acuerdos',
            accepted_agreements: false,
          });
        },
        /Debes aceptar explícitamente los acuerdos/
      );

      // 4. Postulación válida con aceptación explícita de acuerdos
      const application = await projectBackendService.applyToPosition(
        applicant,
        MOCK_TOKEN,
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
            MOCK_TOKEN,
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
        MOCK_TOKEN,
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

      // 7. Un integrante que no es dueño no puede remover miembros del equipo
      await assert.rejects(
        async () => {
          await projectBackendService.removeProjectMember(applicant, MOCK_TOKEN, project.id, leader.id);
        },
        /Solo el creador del proyecto puede gestionar los integrantes/
      );

      // 8. El líder remueve al integrante -> libera el cupo y reabre la vacante ('open')
      await projectBackendService.removeProjectMember(leader, MOCK_TOKEN, project.id, applicant.id);
      const membersAfterRemoval = await projectBackendService.getProjectMembers(project.id);
      assert.equal(membersAfterRemoval.length, 1);

      const positionsAfterRemoval = await projectBackendService.getProjectPositions(project.id);
      assert.equal(positionsAfterRemoval[0].slots_filled, 0);
      assert.equal(positionsAfterRemoval[0].status, 'open');
    });

    test('Accesibilidad y Privacidad: updateProfileSchema valida accessibility_preferences y learning_preferences', async () => {
      const { updateProfileSchema } = await import('../schemas/profile.schema.js');

      const validPayload = {
        learning_preferences: ['step_by_step', 'message_communication', 'low_stimulus'],
        accessibility_preferences: {
          calmMode: true,
          fontSize: 'large' as const,
          contrast: 'high' as const,
          reduceMotion: true,
          spacing: 'spacious' as const,
          untimedQuizzes: true,
        },
      };

      const parsed = updateProfileSchema.safeParse(validPayload);
      assert.equal(parsed.success, true);

      const invalidFontSize = {
        accessibility_preferences: {
          fontSize: 'gigante',
        },
      };
      const parsedInvalid = updateProfileSchema.safeParse(invalidFontSize);
      assert.equal(parsedInvalid.success, false);
    });

    test('Mi espacio de aprendizaje: creación de rutas, avance por etapas, tareas con subtareas, evaluación de temas y explicaciones adaptables', async () => {
      const { learningSpaceService } = await import('../services/learningSpace.service.js');
      const studentId = 'usr-learning-space-01';
      const token = 'mock-jwt-token';

      // 1. Actualizar configuración del perfil de aprendizaje
      const updatedConfig = await learningSpaceService.updateConfig(studentId, token, {
        onboardingCompleted: true,
        explanationStyle: ['step_by_step', 'visual_support'],
        organizationStyle: ['short_tasks', 'frequent_breaks'],
        communicationStyle: ['message_first'],
        environmentStyle: ['calm_interface', 'untimed_practice'],
        defaultStudyIntervalMinutes: 25,
        defaultBreakMinutes: 5,
        subjectsToReinforce: ['Programación de Algoritmos'],
        learningGoalSummary: 'Aprobar programación comprendiendo estructuras de datos paso a paso.',
      });
      assert.equal(updatedConfig.onboardingCompleted, true);
      assert.equal(updatedConfig.defaultStudyIntervalMinutes, 25);
      assert.deepEqual(updatedConfig.subjectsToReinforce, ['Programación de Algoritmos']);

      // 2. Crear ruta de aprendizaje personalizada y verificar etapas generadas
      const createdPath = await learningSpaceService.createLearningPath(studentId, token, {
        subject_name: 'Programación de Algoritmos',
        title: 'Arreglos y ciclos iterativos',
        goal: 'Resolver problemas de recorrido y filtrado de arreglos sin errores de índice',
        pace: 'paso_a_paso',
        preferred_mode: 'paso_a_paso',
      });
      assert.equal(createdPath.progress_percent, 0);
      assert.equal(createdPath.stages.length, 4);

      // 3. Completar primera etapa -> avance debe ser 25%
      const afterStage1 = await learningSpaceService.toggleStageCompletion(
        studentId,
        token,
        createdPath.id,
        createdPath.stages[0].id,
        true
      );
      assert.equal(afterStage1.progress_percent, 25);
      assert.equal(afterStage1.status, 'active');

      // Completar las 3 etapas restantes -> avance 100% y estado 'completed'
      for (let i = 1; i < createdPath.stages.length; i++) {
        await learningSpaceService.toggleStageCompletion(
          studentId,
          token,
          createdPath.id,
          createdPath.stages[i].id,
          true
        );
      }
      const pathsList = await learningSpaceService.listLearningPaths(studentId, token);
      assert.equal(pathsList[0].progress_percent, 100);
      assert.equal(pathsList[0].status, 'completed');

      // 3b. Editar ruta y agregar una 5ta etapa personalizada -> avance se recalcula a 80% y estado vuelve a 'active'
      const editedPath = await learningSpaceService.updateLearningPath(
        studentId,
        token,
        createdPath.id,
        {
          title: 'Arreglos, ciclos y matrices',
          goal: 'Dominar arreglos unidimensionales y matrices antes del certamen',
          pace: 'constante',
          preferred_mode: 'ejemplos',
        }
      );
      assert.equal(editedPath.title, 'Arreglos, ciclos y matrices');
      assert.equal(editedPath.pace, 'constante');
      assert.equal(editedPath.preferred_mode, 'ejemplos');

      const withFifthStage = await learningSpaceService.addStageToPath(
        studentId,
        token,
        createdPath.id,
        {
          title: 'Etapa 5: Ejercicios de matrices 2D',
          description: 'Practicar recorrido con doble ciclo for.',
          practice_prompt: 'Resolver suma de diagonal principal.',
        }
      );
      assert.equal(withFifthStage.stages.length, 5);
      assert.equal(withFifthStage.progress_percent, 80);
      assert.equal(withFifthStage.status, 'active');

      // 3c. Aislamiento por usuario: otro estudiante no puede modificar ni eliminar la ruta
      const otherStudentId = 'usr-learning-space-02';
      await assert.rejects(
        async () => {
          await learningSpaceService.updateLearningPath(otherStudentId, token, createdPath.id, {
            title: 'Intento no autorizado',
          });
        },
        /Ruta de aprendizaje no encontrada o sin permisos/
      );
      await assert.rejects(
        async () => {
          await learningSpaceService.deleteLearningPath(otherStudentId, token, createdPath.id);
        },
        /Ruta no encontrada o sin permisos/
      );

      // 4. Crear tarea de estudio con subtareas y prioridad, y verificar completitud automática
      const task = await learningSpaceService.createStudyTask(studentId, token, {
        subject_name: 'Programación de Algoritmos',
        title: 'Resolver guía práctica de arreglos',
        priority: 'alta',
        study_interval_minutes: 20,
        break_minutes: 5,
      });
      assert.equal(task.subtasks.length, 3);
      assert.equal(task.status, 'pending');
      assert.equal(task.priority, 'alta');

      const completedSubtasks = task.subtasks.map((st) => ({ ...st, completed: true }));
      const completedTask = await learningSpaceService.updateStudyTask(studentId, token, task.id, {
        subtasks: completedSubtasks,
        priority: 'baja',
      });
      assert.equal(completedTask.status, 'completed');
      assert.equal(completedTask.priority, 'baja');

      // Aislamiento por usuario en tareas
      await assert.rejects(
        async () => {
          await learningSpaceService.deleteStudyTask(otherStudentId, token, task.id);
        },
        /Tarea no encontrada o sin permisos/
      );

      // 5. Registrar evaluación de dominio por tema
      const consolidated = await learningSpaceService.recordTopicAssessment(studentId, token, {
        subject_name: 'Programación de Algoritmos',
        topic_name: 'Recorrido de arreglos con for',
        score: 90,
        total_questions: 100,
        recurring_errors: [],
      });
      assert.equal(consolidated.mastery_level, 'consolidado');

      const needsPractice = await learningSpaceService.recordTopicAssessment(studentId, token, {
        subject_name: 'Programación de Algoritmos',
        topic_name: 'Recursividad',
        score: 40,
        total_questions: 100,
        recurring_errors: ['Falta caso base de parada'],
      });
      assert.equal(needsPractice.mastery_level, 'necesita_practicar');

      // 6. Generar explicación adaptable en los 6 modos ("Aprende a tu manera") y verificar diferenciación real y fuente
      const modes = [
        'sencilla',
        'paso_a_paso',
        'ejemplos',
        'visual',
        'profunda',
        'comprobar',
      ] as const;
      const summaries = new Set<string>();
      const examples = new Set<string>();

      for (const mode of modes) {
        const exp = await learningSpaceService.generateAdaptiveExplanation({
          subject_name: 'Programación de Algoritmos',
          topic: 'Recursividad',
          mode,
          goal: 'Entender el caso base',
        });
        assert.equal(exp.mode, mode);
        assert.ok(exp.source === 'pedagogical_engine' || exp.source === 'ai_gemini');
        assert.ok(exp.summary.length > 20);
        assert.ok(exp.key_points.length >= 3);
        assert.ok(exp.comprehension_check.options.length >= 3);
        summaries.add(exp.summary);
        examples.add(exp.practical_example);
      }
      assert.equal(summaries.size, 6);
      assert.equal(examples.size, 6);
    });
  });
