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
