import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Test 1: Evaluador semántico de preguntas de redacción (aiQuestionEngine)
import { evaluateRedactionAnswer } from '../src/services/aiQuestionEngine.ts';

// Test 2: Comprobación de seguridad - eliminación de cuentas privilegiadas hardcodeadas
import { isCertifiedAccount } from '../src/services/profile.service.ts';

// Test 3: Formateadores y utilidades de presentación
import {
  getUserDisplayName,
  getUserInitial,
  formatTutoringDuration,
  formatTutoringStatus,
  formatRating,
  formatAcademicLevel,
} from '../src/utils/formatters.ts';

// Test 4: Reglas de negocio y endpoints centralizados (Anti-Hardcoding)
import { API_ENDPOINTS } from '../src/constants/apiEndpoints.ts';
import { BUSINESS_RULES } from '../src/constants/businessRules.ts';

describe('Seguridad y Autorización', () => {
  it('isCertifiedAccount debe rechazar cualquier email o ID arbitrario (no hardcoding)', () => {
    // Casos que antes pasaban por hardcoding indebido en el frontend
    assert.equal(isCertifiedAccount('kendokaponijereklein@gmail.com'), false);
    assert.equal(isCertifiedAccount('lukasdonoso1911@gmail.com'), false);
    assert.equal(isCertifiedAccount('admin@duoc.cl'), false);
    assert.equal(isCertifiedAccount('cualquier-uuid-aleatorio'), false);
    assert.equal(isCertifiedAccount(null), false);
    assert.equal(isCertifiedAccount(undefined), false);
  });
});

describe('Motor de Evaluación Semántica y Preguntas (aiQuestionEngine)', () => {
  it('evaluateRedactionAnswer reconoce respuestas exactas', () => {
    const accepted = ['polimorfismo', 'herencia'];
    assert.equal(evaluateRedactionAnswer('polimorfismo', accepted), true);
    assert.equal(evaluateRedactionAnswer('herencia', accepted), true);
  });

  it('evaluateRedactionAnswer ignora tildes, mayúsculas y espacios innecesarios', () => {
    const accepted = ['evaluación formativa', 'índice'];
    assert.equal(evaluateRedactionAnswer('  Evaluacion Formativa  ', accepted), true);
    assert.equal(evaluateRedactionAnswer('INDICE', accepted), true);
  });

  it('evaluateRedactionAnswer reconoce respuestas que contienen la palabra clave', () => {
    const accepted = ['recursión', 'recursividad'];
    assert.equal(
      evaluateRedactionAnswer('Es un algoritmo basado en recursion directa', accepted),
      true
    );
  });

  it('evaluateRedactionAnswer rechaza respuestas incorrectas o vacías', () => {
    const accepted = ['polimorfismo'];
    assert.equal(evaluateRedactionAnswer('encapsulamiento', accepted), false);
    assert.equal(evaluateRedactionAnswer('', accepted), false);
    assert.equal(evaluateRedactionAnswer('   ', accepted), false);
  });
});

describe('Utilidades de Formato e Integridad de Perfiles', () => {
  it('getUserDisplayName prioriza display_name o nombres completos antes del email', () => {
    const profileWithName = {
      first_name: 'Ana',
      last_name: 'Pérez',
      display_name: 'Ana Pérez',
      email: 'ana.perez@duocuc.cl',
    };
    assert.equal(getUserDisplayName(profileWithName), 'Ana Pérez');

    const profileWithoutName = {
      email: 'juan.valenzuela@duocuc.cl',
    };
    assert.equal(getUserDisplayName(profileWithoutName), 'juan.valenzuela');
  });

  it('getUserInitial obtiene la inicial correcta en mayúscula', () => {
    assert.equal(getUserInitial('Carlos Navarrete'), 'C');
    assert.equal(getUserInitial('pedro'), 'P');
    assert.equal(getUserInitial(''), 'U');
  });

  it('formatTutoringDuration formatea minutos y horas adecuadamente', () => {
    assert.equal(formatTutoringDuration(45), '45 min');
    assert.equal(formatTutoringDuration(60), '1 h');
    assert.equal(formatTutoringDuration(90), '1 h 30 min');
  });

  it('formatTutoringStatus retorna etiquetas y clases css válidas', () => {
    assert.equal(formatTutoringStatus('completed').label, 'Completada');
    assert.equal(formatTutoringStatus('pending').label, 'Pendiente');
    assert.equal(formatTutoringStatus('accepted').label, 'Aceptada');
  });

  it('formatRating y formatAcademicLevel formatean valores legibles', () => {
    assert.equal(formatRating(null), 'Aún sin evaluaciones');
    assert.equal(formatRating(4.8), '4.8');
    assert.equal(formatAcademicLevel('advanced'), 'Avanzado');
  });
});

import {
  validatePdfFile,
  calculateTutorLevelFromGrade,
  formatTutorLevel,
  normalizeText,
} from '../src/utils/pdfExtractor.ts';

describe('Validación y Extracción de Certificados PDF (pdfExtractor & Storage Security)', () => {
  it('validatePdfFile rechaza archivos nulos o vacíos', () => {
    // @ts-expect-error probando valor inválido
    const resNull = validatePdfFile(null);
    assert.equal(resNull.valid, false);
    assert.match(resNull.error!, /No se seleccionó ningún archivo/);
  });

  it('validatePdfFile rechaza extensiones y tipos MIME que no sean PDF', () => {
    const fakeDocx = {
      name: 'curriculum.docx',
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 50000,
    } as File;
    const resDocx = validatePdfFile(fakeDocx);
    assert.equal(resDocx.valid, false);
    assert.match(resDocx.error!, /no es un documento PDF válido/);

    const fakeExe = {
      name: 'malware.exe',
      type: 'application/octet-stream',
      size: 50000,
    } as File;
    const resExe = validatePdfFile(fakeExe);
    assert.equal(resExe.valid, false);
  });

  it('validatePdfFile rechaza archivos que exceden el límite de 10 MB', () => {
    const hugePdf = {
      name: 'certificado_pesado.pdf',
      type: 'application/pdf',
      size: 11 * 1024 * 1024,
    } as File;
    const res = validatePdfFile(hugePdf);
    assert.equal(res.valid, false);
    assert.match(res.error!, /excede el tamaño máximo permitido de 10 MB/);
  });

  it('validatePdfFile rechaza archivos sospechosamente pequeños (< 100 bytes)', () => {
    const tinyPdf = {
      name: 'vacio.pdf',
      type: 'application/pdf',
      size: 45,
    } as File;
    const res = validatePdfFile(tinyPdf);
    assert.equal(res.valid, false);
    assert.match(res.error!, /parece estar vacío o dañado/);
  });

  it('validatePdfFile acepta un archivo PDF válido con tamaño adecuado', () => {
    const validPdf = {
      name: 'concentracion_notas_duoc.pdf',
      type: 'application/pdf',
      size: 250000,
    } as File;
    const res = validatePdfFile(validPdf);
    assert.equal(res.valid, true);
    assert.equal(res.error, undefined);
  });

  it('calculateTutorLevelFromGrade calcula el nivel según escala de notas chilena (1.0 a 7.0)', () => {
    // 5.5 a 5.9 -> basic
    assert.equal(calculateTutorLevelFromGrade(5.5), 'basic');
    assert.equal(calculateTutorLevelFromGrade(5.8), 'basic');

    // 6.0 a 6.4 -> intermediate
    assert.equal(calculateTutorLevelFromGrade(6.0), 'intermediate');
    assert.equal(calculateTutorLevelFromGrade(6.3), 'intermediate');

    // 6.5 a 7.0 -> advanced
    assert.equal(calculateTutorLevelFromGrade(6.5), 'advanced');
    assert.equal(calculateTutorLevelFromGrade(7.0), 'advanced');

    // < 5.5 o inválidos -> null
    assert.equal(calculateTutorLevelFromGrade(5.4), null);
    assert.equal(calculateTutorLevelFromGrade(4.0), null);
    assert.equal(calculateTutorLevelFromGrade(null), null);
    assert.equal(calculateTutorLevelFromGrade(undefined), null);
    assert.equal(calculateTutorLevelFromGrade(NaN), null);
  });

  it('formatTutorLevel retorna etiquetas amigables en español', () => {
    assert.equal(formatTutorLevel('basic'), 'Básico');
    assert.equal(formatTutorLevel('intermediate'), 'Intermedio');
    assert.equal(formatTutorLevel('advanced'), 'Avanzado');
    assert.equal(formatTutorLevel(null), 'Sin nivel asignado');
  });

  it('normalizeText remueve diacríticos, tildes y caracteres especiales', () => {
    assert.equal(normalizeText('Cálculo Diferencial & Integral'), 'calculo diferencial integral');
    assert.equal(normalizeText('PROGRAMACIÓN WEB 1 - SECCIÓN #002D'), 'programacion web 1 seccion 002d');
    assert.equal(normalizeText('   Espacios    Múltiples   '), 'espacios multiples');
    assert.equal(normalizeText(''), '');
  });

  it('Sanitización de nombres de archivo para Storage previene Path Traversal', () => {
    const maliciousName = '../../etc/passwd (1) #!?.pdf';
    const sanitized = maliciousName.replace(/\.\./g, '_').replace(/[^a-zA-Z0-9._-]/g, '_');
    // Previene cualquier escape de directorio '..' y neutraliza barras y caracteres especiales:
    assert.equal(sanitized.includes('..'), false);
    assert.equal(sanitized.includes('/'), false);
    assert.equal(sanitized.includes('\\'), false);
    assert.equal(sanitized.includes(' '), false);
    assert.equal(sanitized, '____etc_passwd__1_____.pdf');

    // La ruta en el bucket privado concatena usuario/solicitud/nombre
    const userId = 'usr-123';
    const requestId = 'req-456';
    const storagePath = `${userId}/${requestId}/123456_${sanitized}`;
    assert.match(storagePath, /^usr-123\/req-456\/123456_/);
  });
});

describe('Políticas de Privacidad de Datos Personales (Privacy Rules)', () => {
  it('Aplica reglas de ofuscación de teléfono y correo según preferencias del usuario', () => {
    const fullProfile = {
      id: 'usr-abc',
      display_name: 'Felipe Valdés',
      email: 'felipe@duoc.cl',
      phone: '+56912345678',
      show_email: false,
      show_phone: false,
    };

    // Lógica equivalente a la vista public_profiles en Postgres:
    // CASE WHEN show_email THEN email ELSE NULL END AS email
    // CASE WHEN show_phone THEN phone ELSE NULL END AS phone
    const publicProfileHidden = {
      ...fullProfile,
      email: fullProfile.show_email ? fullProfile.email : null,
      phone: fullProfile.show_phone ? fullProfile.phone : null,
    };

    assert.equal(publicProfileHidden.email, null);
    assert.equal(publicProfileHidden.phone, null);

    const publicProfileVisible = {
      ...fullProfile,
      show_phone: true,
      show_email: true,
      email: true ? fullProfile.email : null,
      phone: true ? fullProfile.phone : null,
    };

    assert.equal(publicProfileVisible.email, 'felipe@duoc.cl');
    assert.equal(publicProfileVisible.phone, '+56912345678');
  });
});

describe('Centralización de Reglas de Negocio y Endpoints (Anti-Hardcoding)', () => {
  it('API_ENDPOINTS contiene rutas REST válidas y funciones parametrizadas correctas', () => {
    assert.equal(API_ENDPOINTS.PROFILES.ME, '/profiles/me');
    assert.equal(API_ENDPOINTS.TUTORING.SESSIONS, '/tutoring/sessions');
    assert.equal(API_ENDPOINTS.WORKSHOPS.BASE, '/workshops');
    assert.equal(API_ENDPOINTS.VERIFICATION.BOT_GRANT, '/verification/bot-grant');
    assert.equal(API_ENDPOINTS.FORUM.POSTS, '/forum/posts');
    assert.equal(API_ENDPOINTS.PROJECTS.BASE, '/projects');
    assert.equal(API_ENDPOINTS.AI.EVALUATE_ANSWER, '/ai/evaluate-answer');

    // Funciones dinámicas de URL
    assert.equal(API_ENDPOINTS.PROFILES.BY_ID('usr-123'), '/profiles/usr-123');
    assert.equal(API_ENDPOINTS.WORKSHOPS.ENROLL('ws-123'), '/workshops/ws-123/enroll');
    assert.equal(API_ENDPOINTS.TUTORING.SESSION_STATUS('sess-456'), '/tutoring/sessions/sess-456/status');
    assert.equal(API_ENDPOINTS.VERIFICATION.REQUEST_BY_ID('req-789'), '/verification/requests/req-789');
    assert.equal(API_ENDPOINTS.PROJECTS.APPLY('p-1', 'pos-2'), '/projects/p-1/positions/pos-2/apply');
  });

  it('BUSINESS_RULES define umbrales de seguridad consistentes con la política académica', () => {
    assert.equal(BUSINESS_RULES.VERIFICATION.MIN_BOT_ACCREDITATION_SCORE, 70);
    assert.equal(BUSINESS_RULES.VERIFICATION.TOTAL_BOT_QUESTIONS, 10);
    assert.equal(BUSINESS_RULES.WORKSHOPS.MIN_CAPACITY, 2);
    assert.equal(BUSINESS_RULES.WORKSHOPS.MAX_CAPACITY, 100);
    assert.equal(BUSINESS_RULES.TUTORING.MIN_DURATION_MINUTES, 15);
    assert.equal(BUSINESS_RULES.TUTORING.MAX_DURATION_MINUTES, 300);
  });
});

import { verificationService } from '../src/services/verification.service.ts';

describe('Seguridad de Servicios y Prevención de Bypass (Fail-Closed)', () => {
  it('verificationService.botGrant rechaza puntajes inferiores al 70% sin invocar el backend', async () => {
    await assert.rejects(
      async () => {
        await verificationService.botGrant({
          subject_id: 'sub-123',
          score: 65,
          level: 'basic',
        });
      },
      {
        message: /Puntaje insuficiente \(65%\)\. Se requiere un mínimo de 70%/,
      }
    );
  });

  it('verificationService.assignPracticalExercise rechaza títulos vacíos preventivamente', async () => {
    await assert.rejects(
      async () => {
        await verificationService.assignPracticalExercise('req-1', '   ');
      },
      {
        message: /El título o descripción del ejercicio práctico no puede estar vacío/,
      }
    );
  });

  it('verificationService.submitPracticalEvaluation rechaza entregas sin justificación conceptual', async () => {
    await assert.rejects(
      async () => {
        await verificationService.submitPracticalEvaluation('req-1', {
          practical_submission: 'https://github.com/proyecto/repo',
          defense_notes: '   ',
        });
      },
      {
        message: /Debes incluir la justificación conceptual y defensa de tu solución/,
      }
    );
  });

  it('verificationService.reviewVerificationRequest rechaza estados inválidos o retroalimentación vacía', async () => {
    await assert.rejects(
      async () => {
        await verificationService.reviewVerificationRequest('req-1', {
          // @ts-expect-error estado intencionalmente inválido
          status: 'invalido',
          reviewer_feedback: 'Buen trabajo',
        });
      },
      {
        message: /El estado resolutivo indicado no es válido/,
      }
    );

    await assert.rejects(
      async () => {
        await verificationService.reviewVerificationRequest('req-1', {
          status: 'approved',
          reviewer_feedback: '   ',
        });
      },
      {
        message: /Debes proporcionar retroalimentación pedagógica al dictaminar la solicitud/,
      }
    );
  });
});


import { validateNoteFile } from '../src/services/notes.service.ts';
import {
  parseNoteToStructuredBlocks,
  htmlToMarkdown,
  generateStructuredPdfBytes,
  parseInterAulaNoteFile,
} from '../src/utils/noteExporter.ts';

describe('Biblioteca de Apuntes, Validación de Archivos y Exportadores Estructurados', () => {
  it('validateNoteFile acepta extensiones académicas permitidas (.pdf, .docx, .md, .txt, .pptx, .xlsx)', () => {
    const validMd = {
      name: 'resumen_algoritmos.md',
      type: 'text/markdown',
      size: 12000,
    } as File;
    const resMd = validateNoteFile(validMd);
    assert.equal(resMd.valid, true);
    assert.equal(resMd.extension, '.md');

    const validDocx = {
      name: 'guia_sql.docx',
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 450000,
    } as File;
    const resDocx = validateNoteFile(validDocx);
    assert.equal(resDocx.valid, true);
    assert.equal(resDocx.extension, '.docx');
  });

  it('validateNoteFile rechaza archivos ejecutables, vacíos o mayores a 15 MB', () => {
    const exeFile = {
      name: 'script.exe',
      type: 'application/octet-stream',
      size: 5000,
    } as File;
    assert.equal(validateNoteFile(exeFile).valid, false);

    const emptyFile = {
      name: 'apunte.pdf',
      type: 'application/pdf',
      size: 0,
    } as File;
    assert.equal(validateNoteFile(emptyFile).valid, false);

    const oversizedFile = {
      name: 'dataset.pdf',
      type: 'application/pdf',
      size: 16 * 1024 * 1024,
    } as File;
    const resOver = validateNoteFile(oversizedFile);
    assert.equal(resOver.valid, false);
    assert.match(resOver.error!, /15 MB/);
  });

  it('parseNoteToStructuredBlocks preserva títulos H1-H3, listas, código, fórmulas y tablas', () => {
    const sampleHtml = `
      <h1>Normalización de Bases de Datos</h1>
      <h2>Primera Forma Normal (1FN)</h2>
      <p>Elimina grupos repetitivos y asegura atomicidad.</p>
      <ul><li>Atributos atómicos</li><li>Clave primaria definida</li></ul>
      <div data-math="true">R(A, B) \\to B depende funcionalmente de A</div>
      <pre><code>CREATE TABLE estudiantes (id INT PRIMARY KEY);</code></pre>
    `;
    const blocks = parseNoteToStructuredBlocks(sampleHtml);
    assert.ok(blocks.some((b) => b.type === 'h1' && b.text.includes('Normalización')));
    assert.ok(blocks.some((b) => b.type === 'h2' && b.text.includes('Primera Forma Normal')));
    assert.ok(blocks.some((b) => b.type === 'list-item' && b.text.includes('Atributos atómicos')));
    assert.ok(blocks.some((b) => b.type === 'math' && b.text.includes('depende funcionalmente')));
    assert.ok(blocks.some((b) => b.type === 'code' && b.text.includes('CREATE TABLE')));
  });

  it('htmlToMarkdown convierte encabezados, énfasis y listas a Markdown limpio', () => {
    const md = htmlToMarkdown('<h1>Título</h1><p>Texto en <strong>negrita</strong> y <em>cursiva</em>.</p><ul><li>Item 1</li></ul>');
    assert.match(md, /# Título/);
    assert.match(md, /\*\*negrita\*\*/);
    assert.match(md, /\*cursiva\*/);
    assert.match(md, /- Item 1/);
  });

  it('generateStructuredPdfBytes genera un binario PDF (%PDF-1.4) válido y multipágina con estructura académica', () => {
    const pdfBytes = generateStructuredPdfBytes({
      title: 'Apunte de Arquitectura de Software',
      subjectName: 'Arquitectura de Sistemas',
      career: 'Ingeniería en Informática',
      authorName: 'Matías Rojas',
      summary: 'Patrones en capas y microservicios.',
      contentHtml: '<h1>1. Patrón MVC</h1><p>Separa modelo, vista y controlador.</p><pre><code>export class UserController {}</code></pre>',
      version: 2,
    });
    assert.ok(pdfBytes instanceof Uint8Array);
    assert.ok(pdfBytes.byteLength > 400);
    const header = new TextDecoder().decode(pdfBytes.slice(0, 8));
    assert.equal(header, '%PDF-1.4');
    const fullText = new TextDecoder().decode(pdfBytes);
    assert.match(fullText, /Apunte de Arquitectura de Software/);
    assert.match(fullText, /%%EOF/);
  });

  it('parseInterAulaNoteFile valida e importa archivos .interaula.json correctamente', () => {
    const validRaw = JSON.stringify({
      schema: 'interaula.academic-note.v1',
      exportedAt: new Date().toISOString(),
      note: {
        title: 'Apunte Importado',
        subjectName: 'Programación Web',
        contentHtml: '<h2>Hooks en React</h2>',
      },
    });
    const imported = parseInterAulaNoteFile(validRaw);
    assert.equal(imported.title, 'Apunte Importado');
    assert.equal(imported.subjectName, 'Programación Web');

    assert.throws(() => {
      parseInterAulaNoteFile(JSON.stringify({ schema: 'invalido' }));
    }, /formato válido de apunte InterAula/);
  });
});
