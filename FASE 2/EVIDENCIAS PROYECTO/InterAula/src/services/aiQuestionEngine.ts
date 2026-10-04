/**
 * aiQuestionEngine.ts
 * Motor de Generación y Evaluación de Preguntas Técnicas para el Bot de InterAula.
 * Incluye soporte para preguntas de opción rápida y preguntas de redacción técnica corta,
 * con evaluador semántico y soporte para Gemini API y bancos modulares por nivel.
 */

import type { AcademicLevel } from '../types/profile';
import { WEB_DEVELOPMENT_QUESTIONS } from '../data/questionBanks/webDevelopment';
import {
  hasGeminiApiConfigured,
  generateGeminiQuestions,
} from './geminiAiService';

export interface ChallengeQuestion {
  id: string;
  subject: string;
  level?: AcademicLevel;
  type: 'choice' | 'redaction';
  category: 'conceptual' | 'debugging' | 'pedagogical';
  prompt: string;
  codeSnippet?: string;
  timeLimit?: number; // Tiempo específico en segundos (ej. 15s alternativas, 45s desarrollo)
  // Para preguntas de selección rápida
  options?: {
    id: string;
    text: string;
  }[];
  correctOptionId?: string;
  // Para preguntas de redacción corta
  acceptedAnswers?: string[];
  placeholder?: string;
  // Explicación técnica del bot
  explanation: string;
}

export const TIME_LIMIT_CHOICE = 15; // 15 segundos para alternativas rápidas
export const TIME_LIMIT_REDACTION = 45; // 45 segundos para desarrollo técnico y redacción

export function getQuestionTimeLimit(q: ChallengeQuestion): number {
  if (q.timeLimit && q.timeLimit > 0) return q.timeLimit;
  return q.type === 'choice' ? TIME_LIMIT_CHOICE : TIME_LIMIT_REDACTION;
}


// Evaluador semántico y difuso para respuestas redactadas por el estudiante
export function evaluateRedactionAnswer(userAnswer: string, acceptedAnswers: string[]): boolean {
  if (!userAnswer || !acceptedAnswers || acceptedAnswers.length === 0) return false;

  const normalize = (str: string) =>
    str
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remover tildes
      .replace(/[;.,:()'"\n\r`]/g, '') // Remover signos de puntuación y comillas
      .replace(/\s+/g, ' ');

  const cleanUser = normalize(userAnswer);
  if (!cleanUser) return false;

  return acceptedAnswers.some((target) => {
    const cleanTarget = normalize(target);
    if (cleanUser === cleanTarget) return true;
    // Si la respuesta del usuario contiene la palabra clave técnica principal
    if (cleanUser.includes(cleanTarget) && cleanTarget.length >= 3) return true;
    return false;
  });
}

// Banco técnico extenso categorizado por asignatura Duoc UC
const QUESTION_BANK: ChallengeQuestion[] = [
  // ==========================================
  // PROGRAMACIÓN DE ALGORITMOS (30 preguntas)
  // ==========================================
  {
    id: 'algo_01',
    subject: 'Programación de Algoritmos',
    type: 'redaction',
    category: 'conceptual',
    prompt: 'Escribe la palabra clave de JavaScript para declarar una variable de ámbito de bloque que sí permite ser reasignada.',
    acceptedAnswers: ['let'],
    placeholder: 'Ej: var, let, const...',
    explanation: 'let permite reasignación y limita su alcance estrictamente al bloque léxico en que fue declarada.',
  },
  {
    id: 'algo_02',
    subject: 'Programación de Algoritmos',
    type: 'redaction',
    category: 'conceptual',
    prompt: 'Escribe el nombre de la estructura de datos lineal que opera bajo el principio LIFO (Last In, First Out).',
    acceptedAnswers: ['pila', 'stack'],
    placeholder: 'Ej: pila, cola, arbol...',
    explanation: 'La Pila (Stack) apila elementos y desapila siempre el último en ingresar (LIFO).',
  },
  {
    id: 'algo_03',
    subject: 'Programación de Algoritmos',
    type: 'redaction',
    category: 'conceptual',
    prompt: 'Escribe el nombre de la estructura de datos lineal que opera bajo el principio FIFO (First In, First Out).',
    acceptedAnswers: ['cola', 'queue'],
    placeholder: 'Ej: pila, cola, grafo...',
    explanation: 'La Cola (Queue) procesa los elementos en el estricto orden de llegada (FIFO).',
  },
  {
    id: 'algo_04',
    subject: 'Programación de Algoritmos',
    type: 'redaction',
    category: 'debugging',
    prompt: 'Escribe el operador de JavaScript que compara tanto el valor como el tipo de dato de forma estricta.',
    acceptedAnswers: ['==='],
    placeholder: 'Ej: ==, ===, =...',
    explanation: '=== es el operador de igualdad estricta en JavaScript (no realiza coerción de tipos).',
  },
  {
    id: 'algo_05',
    subject: 'Programación de Algoritmos',
    type: 'redaction',
    category: 'debugging',
    prompt: 'Escribe el método de arrays en JavaScript para agregar uno o más elementos al final del arreglo.',
    acceptedAnswers: ['push', 'push()', '.push()'],
    placeholder: 'Ej: push, pop, shift...',
    explanation: 'Array.prototype.push() inserta elementos al final del arreglo y retorna la nueva longitud.',
  },
  {
    id: 'algo_06',
    subject: 'Programación de Algoritmos',
    type: 'redaction',
    category: 'debugging',
    prompt: 'Escribe la instrucción o palabra clave para forzar la salida inmediata de un bucle for o while.',
    acceptedAnswers: ['break', 'break;'],
    placeholder: 'Ej: continue, return, break...',
    explanation: 'break interrumpe de forma anticipada la ejecución del bucle envolvente más cercano.',
  },
  {
    id: 'algo_07',
    subject: 'Programación de Algoritmos',
    type: 'redaction',
    category: 'conceptual',
    prompt: 'Escribe el valor que retorna por defecto una función en JavaScript que no especifica una sentencia return.',
    acceptedAnswers: ['undefined'],
    placeholder: 'Ej: null, undefined, 0...',
    explanation: 'Toda función en JavaScript sin return explícito evalúa y retorna el valor primitivo undefined.',
  },
  {
    id: 'algo_08',
    subject: 'Programación de Algoritmos',
    type: 'choice',
    category: 'debugging',
    prompt: '¿Por qué el siguiente bucle nunca finaliza su ejecución?',
    codeSnippet: 'let x = 0;\nwhile (x < 5) {\n  console.log(x);\n}',
    options: [
      { id: 'a', text: 'Porque la variable x nunca se incrementa dentro del cuerpo del bucle.' },
      { id: 'b', text: 'Porque la palabra while solo admite comparaciones booleanas estrictas.' },
      { id: 'c', text: 'Porque x debió ser declarada con const.' },
    ],
    correctOptionId: 'a',
    explanation: 'Al no modificar x (por ejemplo con x++), la condición x < 5 permanece siempre verdadera.',
  },
  {
    id: 'algo_09',
    subject: 'Programación de Algoritmos',
    type: 'choice',
    category: 'conceptual',
    prompt: '¿Cuál es la complejidad temporal en el peor caso del algoritmo de Búsqueda Binaria sobre un arreglo ordenado de n elementos?',
    options: [
      { id: 'a', text: 'O(log n)' },
      { id: 'b', text: 'O(n)' },
      { id: 'c', text: 'O(n^2)' },
    ],
    correctOptionId: 'a',
    explanation: 'La búsqueda binaria descarta la mitad de las opciones en cada paso, logrando orden logarítmico O(log n).',
  },
  {
    id: 'algo_10',
    subject: 'Programación de Algoritmos',
    type: 'choice',
    category: 'debugging',
    prompt: '¿Qué condición permite filtrar únicamente números impares utilizando el operador módulo (%)?',
    codeSnippet: 'const impares = arr.filter(n => /* condicion */);',
    options: [
      { id: 'a', text: 'n % 2 !== 0' },
      { id: 'b', text: 'n % 2 === 0' },
      { id: 'c', text: 'n / 2 === 1' },
    ],
    correctOptionId: 'a',
    explanation: 'El residuo de dividir cualquier número impar entre 2 es distinto de cero (1 o -1 en negativos).',
  },
  {
    id: 'algo_11',
    subject: 'Programación de Algoritmos',
    type: 'choice',
    category: 'conceptual',
    prompt: '¿Qué excepción se produce cuando una función recursiva carece de caso base?',
    options: [
      { id: 'a', text: 'Stack Overflow (Desbordamiento de la pila de llamadas).' },
      { id: 'b', text: 'NullPointerException en tiempo de compilación.' },
      { id: 'c', text: 'Segmentation Fault del disco duro.' },
    ],
    correctOptionId: 'a',
    explanation: 'Cada llamada recursiva reserva un marco en el Call Stack; sin caso base, se agota la memoria de la pila.',
  },
  {
    id: 'algo_12',
    subject: 'Programación de Algoritmos',
    type: 'choice',
    category: 'pedagogical',
    prompt: '¿Cómo le explicarías a un estudiante inicial la diferencia entre console.log() y return?',
    options: [
      { id: 'a', text: 'console.log imprime en pantalla para inspección; return entrega un valor computable al resto del código.' },
      { id: 'b', text: 'Son exactamente lo mismo, pero return solo funciona en Node.js.' },
      { id: 'c', text: 'console.log solo funciona con texto y return solo con números.' },
    ],
    correctOptionId: 'a',
    explanation: 'console.log es solo un efecto secundario visual; return formaliza la salida matemática de la subrutina.',
  },

  // ==========================================
  // MODELAMIENTO DE BASE DE DATOS (30 preguntas)
  // ==========================================
  {
    id: 'mod_01',
    subject: 'Modelamiento de Base de Datos',
    type: 'redaction',
    category: 'conceptual',
    prompt: 'Escribe las siglas de la clave que identifica de manera única e irrepetible cada registro dentro de una tabla.',
    acceptedAnswers: ['pk', 'primary key', 'clave primaria'],
    placeholder: 'Ej: PK, FK...',
    explanation: 'La Primary Key (PK) es el identificador único obligatorio para preservar la identidad de la tupla.',
  },
  {
    id: 'mod_02',
    subject: 'Modelamiento de Base de Datos',
    type: 'redaction',
    category: 'conceptual',
    prompt: 'Escribe las siglas del campo que hace referencia a la clave primaria de otra tabla para relacionarlas.',
    acceptedAnswers: ['fk', 'foreign key', 'clave foranea'],
    placeholder: 'Ej: PK, FK...',
    explanation: 'La Foreign Key (FK) materializa la integridad referencial conectando tablas.',
  },
  {
    id: 'mod_03',
    subject: 'Modelamiento de Base de Datos',
    type: 'redaction',
    category: 'conceptual',
    prompt: 'Escribe la opción de borrado referencial (ON DELETE ...) que elimina automáticamente los registros hijos al borrar el padre.',
    acceptedAnswers: ['cascade', 'on delete cascade'],
    placeholder: 'Ej: restrict, cascade, set null...',
    explanation: 'ON DELETE CASCADE propaga la eliminación a las filas vinculadas para no dejar huérfanos.',
  },
  {
    id: 'mod_04',
    subject: 'Modelamiento de Base de Datos',
    type: 'redaction',
    category: 'conceptual',
    prompt: 'Escribe la forma normal (ej: 1NF, 2NF, 3NF) que exige atomicidad de datos y ausencia de grupos repetitivos.',
    acceptedAnswers: ['1nf', 'primera forma normal', 'primera'],
    placeholder: 'Ej: 1NF, 2NF, 3NF...',
    explanation: 'La 1ª Forma Normal exige que los valores de los dominios sean atómicos e indivisibles.',
  },
  {
    id: 'mod_05',
    subject: 'Modelamiento de Base de Datos',
    type: 'redaction',
    category: 'conceptual',
    prompt: 'Escribe el nombre de la propiedad ACID que asegura que una transacción se ejecuta completamente o no se ejecuta nada.',
    acceptedAnswers: ['atomicidad', 'atomicity'],
    placeholder: 'Ej: atomicidad, consistencia...',
    explanation: 'La Atomicidad garantiza que el lote de operaciones es un bloque indivisible de todo o nada.',
  },
  {
    id: 'mod_06',
    subject: 'Modelamiento de Base de Datos',
    type: 'choice',
    category: 'conceptual',
    prompt: '¿Cómo se resuelve técnicamente en el modelo relacional una relación de cardinalidad Muchos a Muchos (N:M)?',
    options: [
      { id: 'a', text: 'Creando una tabla asociativa o intermedia que contenga las Foreign Keys de ambas tablas.' },
      { id: 'b', text: 'Creando un campo con un arreglo de textos en la tabla principal.' },
      { id: 'c', text: 'Duplicando la base de datos por cada relación.' },
    ],
    correctOptionId: 'a',
    explanation: 'Las relaciones N:M se descomponen en dos relaciones 1:N mediante una tabla asociativa.',
  },
  {
    id: 'mod_07',
    subject: 'Modelamiento de Base de Datos',
    type: 'choice',
    category: 'debugging',
    prompt: 'En una relación 1 a Muchos (ej: un Departamento tiene muchos Empleados), ¿dónde debe ubicarse físicamente la Foreign Key?',
    options: [
      { id: 'a', text: 'En la tabla Empleados (el lado del Muchos).' },
      { id: 'b', text: 'En la tabla Departamento (el lado del Uno).' },
      { id: 'c', text: 'Es obligatorio crear una tabla asociativa siempre.' },
    ],
    correctOptionId: 'a',
    explanation: 'En relaciones 1:N la clave foránea viaja siempre a la tabla del extremo de la cardinalidad N.',
  },
  {
    id: 'mod_08',
    subject: 'Modelamiento de Base de Datos',
    type: 'choice',
    category: 'pedagogical',
    prompt: '¿Cuál es el principal beneficio de normalizar una base de datos hasta Tercera Forma Normal (3NF)?',
    options: [
      { id: 'a', text: 'Eliminar la redundancia y prevenir anomalías de inserción, actualización y borrado.' },
      { id: 'b', text: 'Hacer que las contraseñas se encripten de forma automática.' },
      { id: 'c', text: 'Garantizar que la base de datos no ocupe espacio en disco.' },
    ],
    correctOptionId: 'a',
    explanation: '3NF asegura que los atributos no clave dependan exclusiva y directamente de la clave primaria.',
  },

  // ==========================================
  // CONSULTAS DE BASES DE DATOS (30 preguntas)
  // ==========================================
  {
    id: 'sql_01',
    subject: 'Consultas de Bases de Datos',
    type: 'redaction',
    category: 'debugging',
    prompt: 'Escribe el comando SQL para descartar los cambios y revertir una transacción no confirmada.',
    acceptedAnswers: ['rollback', 'rollback;'],
    placeholder: 'Ej: commit, rollback...',
    explanation: 'ROLLBACK cancela todas las instrucciones ejecutadas en la transacción actual.',
  },
  {
    id: 'sql_02',
    subject: 'Consultas de Bases de Datos',
    type: 'redaction',
    category: 'debugging',
    prompt: 'Escribe el comando SQL para consolidar y guardar permanentemente los cambios de una transacción.',
    acceptedAnswers: ['commit', 'commit;'],
    placeholder: 'Ej: commit, save...',
    explanation: 'COMMIT fija de forma definitiva las modificaciones en disco garantizando durabilidad.',
  },
  {
    id: 'sql_03',
    subject: 'Consultas de Bases de Datos',
    type: 'redaction',
    category: 'conceptual',
    prompt: 'Escribe la cláusula SQL para filtrar los grupos resultantes de una agregación (GROUP BY).',
    acceptedAnswers: ['having'],
    placeholder: 'Ej: where, having...',
    explanation: 'HAVING filtra sobre valores agregados (como SUM o COUNT), mientras que WHERE filtra filas antes de agrupar.',
  },
  {
    id: 'sql_04',
    subject: 'Consultas de Bases de Datos',
    type: 'redaction',
    category: 'debugging',
    prompt: 'Escribe la función estándar SQL para retornar un valor alternativo cuando un campo es NULL (ej: sustituir por 0).',
    acceptedAnswers: ['coalesce', 'coalesce()'],
    placeholder: 'Ej: coalesce, nullif, nvl...',
    explanation: 'COALESCE() evalúa secuencialmente sus argumentos y entrega el primer valor no nulo.',
  },
  {
    id: 'sql_05',
    subject: 'Consultas de Bases de Datos',
    type: 'redaction',
    category: 'conceptual',
    prompt: 'Escribe el carácter comodín de la cláusula LIKE en SQL que representa cero o más caracteres arbitrarios.',
    acceptedAnswers: ['%'],
    placeholder: 'Ej: %, _, ?...',
    explanation: '% equivale a cualquier secuencia de caracteres; _ representa exactamente un carácter.',
  },
  {
    id: 'sql_06',
    subject: 'Consultas de Bases de Datos',
    type: 'choice',
    category: 'debugging',
    prompt: 'Necesitas obtener todos los clientes de la tabla clientes, incluso si no tienen ninguna factura registrada en la tabla facturas. ¿Qué tipo de JOIN debes emplear?',
    codeSnippet: 'SELECT c.nombre, f.total\nFROM clientes c\n/* ¿Qué JOIN aquí? */ facturas f ON c.id = f.cliente_id;',
    options: [
      { id: 'a', text: 'LEFT JOIN' },
      { id: 'b', text: 'INNER JOIN' },
      { id: 'c', text: 'CROSS JOIN' },
    ],
    correctOptionId: 'a',
    explanation: 'LEFT JOIN conserva todas las filas de la tabla izquierda y rellena con NULL si no hay correspondencia.',
  },
  {
    id: 'sql_07',
    subject: 'Consultas de Bases de Datos',
    type: 'choice',
    category: 'conceptual',
    prompt: '¿Por qué no es válido referenciar en la cláusula WHERE un alias de columna creado en el SELECT?',
    options: [
      { id: 'a', text: 'Porque el motor ejecuta el bloque WHERE antes que el bloque SELECT en el orden lógico.' },
      { id: 'b', text: 'Porque los alias solo se permiten con variables numéricas.' },
      { id: 'c', text: 'Porque el operador WHERE no admite comparaciones de texto.' },
    ],
    correctOptionId: 'a',
    explanation: 'El flujo de ejecución es FROM -> WHERE -> GROUP BY -> HAVING -> SELECT -> ORDER BY.',
  },
  {
    id: 'sql_08',
    subject: 'Consultas de Bases de Datos',
    type: 'choice',
    category: 'pedagogical',
    prompt: '¿Por qué un tutor debe desaconsejar el uso indiscriminado de SELECT * en producción?',
    options: [
      { id: 'a', text: 'Aumenta el tráfico de red inútilmente, anula coberturas de índices y fragiliza el código frente a cambios de esquema.' },
      { id: 'b', text: 'Porque SELECT * borra los datos si la consulta dura más de un segundo.' },
      { id: 'c', text: 'Porque los navegadores web bloquean consultas con asterisco.' },
    ],
    correctOptionId: 'a',
    explanation: 'Especificar las columnas exactas es un principio elemental de rendimiento y estabilidad.',
  },

  // ==========================================
  // PROGRAMACIÓN WEB (30 preguntas)
  // ==========================================
  {
    id: 'web_01',
    subject: 'Programación Web',
    type: 'redaction',
    category: 'debugging',
    prompt: 'Escribe el valor de la propiedad CSS box-sizing que incluye el padding y el border en el cálculo del ancho total.',
    acceptedAnswers: ['border-box', 'box-sizing: border-box'],
    placeholder: 'Ej: content-box, border-box...',
    explanation: 'box-sizing: border-box evita desbordes calculando el width incluyendo relleno y borde.',
  },
  {
    id: 'web_02',
    subject: 'Programación Web',
    type: 'redaction',
    category: 'debugging',
    prompt: 'Escribe el método de evento en JavaScript para detener la propagación de eventos por el árbol DOM (Event Bubbling).',
    acceptedAnswers: ['stoppropagation', 'stoppropagation()', 'e.stoppropagation()'],
    placeholder: 'Ej: stopPropagation, preventDefault...',
    explanation: 'event.stopPropagation() frena el ascenso de la burbuja hacia elementos contenedores.',
  },
  {
    id: 'web_03',
    subject: 'Programación Web',
    type: 'redaction',
    category: 'debugging',
    prompt: 'Escribe el método de evento en JavaScript para cancelar la acción por defecto del navegador (como el envío de formulario).',
    acceptedAnswers: ['preventdefault', 'preventdefault()', 'e.preventdefault()'],
    placeholder: 'Ej: preventDefault, stopPropagation...',
    explanation: 'event.preventDefault() anula el comportamiento nativo asociado al evento.',
  },
  {
    id: 'web_04',
    subject: 'Programación Web',
    type: 'redaction',
    category: 'conceptual',
    prompt: 'Escribe el código numérico de estado HTTP que indica que la petición carece de autenticación (Unauthorized).',
    acceptedAnswers: ['401'],
    placeholder: 'Ej: 200, 401, 403, 404...',
    explanation: '401 Unauthorized indica que la solicitud requiere credenciales de autenticación válidas.',
  },
  {
    id: 'web_05',
    subject: 'Programación Web',
    type: 'redaction',
    category: 'conceptual',
    prompt: 'Escribe el verbo HTTP estándar en APIs REST para realizar una actualización PARCIAL de un recurso.',
    acceptedAnswers: ['patch'],
    placeholder: 'Ej: put, patch, post...',
    explanation: 'PATCH modifica únicamente los campos enviados; PUT reemplaza la entidad completa.',
  },
  {
    id: 'web_06',
    subject: 'Programación Web',
    type: 'choice',
    category: 'debugging',
    prompt: 'Un alumno ejecuta fetch(url) e inmediatamente hace console.log(data), obteniendo Promise { <pending> }. ¿Cómo se resuelve?',
    codeSnippet: 'const data = fetch(url);\nconsole.log(data); // Imprime pending',
    options: [
      { id: 'a', text: 'Usando await antes del fetch dentro de una función async (o encadenando .then()).' },
      { id: 'b', text: 'Cambiando la variable a var para forzar sincronismo.' },
      { id: 'c', text: 'Reiniciando el navegador web.' },
    ],
    correctOptionId: 'a',
    explanation: 'fetch es asíncrono y devuelve una Promesa que debe resolverse antes de acceder a la respuesta.',
  },
  {
    id: 'web_07',
    subject: 'Programación Web',
    type: 'choice',
    category: 'conceptual',
    prompt: 'En React, ¿por qué hacer array.push(item); setArray(array); no desencadena una nueva renderización visual?',
    options: [
      { id: 'a', text: 'Porque push muta el arreglo manteniendo la misma referencia de memoria; React compara por referencia.' },
      { id: 'b', text: 'Porque el método push está prohibido en frameworks frontend.' },
      { id: 'c', text: 'Porque React solo funciona con componentes de clase.' },
    ],
    correctOptionId: 'a',
    explanation: 'React exige inmutabilidad de estado: debe generarse una nueva referencia con [...array, item].',
  },
  {
    id: 'web_08',
    subject: 'Programación Web',
    type: 'choice',
    category: 'pedagogical',
    prompt: '¿Por qué se prefiere addEventListener("click", fn) sobre atributos onclick="..." en línea en el HTML?',
    options: [
      { id: 'a', text: 'Separa la estructura HTML de la lógica JS y permite adjuntar múltiples observadores al mismo evento.' },
      { id: 'b', text: 'Porque onclick ya no es compatible con Chrome ni Firefox.' },
      { id: 'c', text: 'Porque addEventListener duplica la velocidad del procesador.' },
    ],
    correctOptionId: 'a',
    explanation: 'Desacopla la vista de la conducta, facilitando mantenibilidad, pruebas y seguridad.',
  },

  // ==========================================
  // NIVELACIÓN MATEMÁTICA (15 preguntas)
  // ==========================================
  {
    id: 'mat_01',
    subject: 'Nivelación Matemática',
    type: 'redaction',
    category: 'conceptual',
    prompt: '¿Cuál es el valor numérico exacto de 2 elevado a la potencia 8 (2^8)?',
    acceptedAnswers: ['256'],
    placeholder: 'Ej: 64, 128, 256...',
    explanation: '2^8 = 256 (base de la representación de un byte de 8 bits con valores de 0 a 255).',
  },
  {
    id: 'mat_02',
    subject: 'Nivelación Matemática',
    type: 'redaction',
    category: 'debugging',
    prompt: 'Calcula el resultado de la expresión aritmética con precedencia: 4 + 3 * 2',
    acceptedAnswers: ['10'],
    placeholder: 'Ej: 14, 10...',
    explanation: 'La multiplicación tiene mayor jerarquía que la suma: 3 * 2 = 6, y 4 + 6 = 10.',
  },
  {
    id: 'mat_03',
    subject: 'Nivelación Matemática',
    type: 'choice',
    category: 'conceptual',
    prompt: 'En lógica proposicional, si P es VERDADERO y Q es FALSO, ¿cuál es el valor de verdad de (P AND Q)?',
    options: [
      { id: 'a', text: 'Falso' },
      { id: 'b', text: 'Verdadero' },
      { id: 'c', text: 'Indeterminado' },
    ],
    correctOptionId: 'a',
    explanation: 'La conjunción lógica (AND) requiere que ambas proposiciones sean simultáneamente verdaderas.',
  },
  {
    id: 'mat_04',
    subject: 'Nivelación Matemática',
    type: 'choice',
    category: 'conceptual',
    prompt: '¿Cuál es el resultado de convertir el número binario 1010 a sistema decimal?',
    options: [
      { id: 'a', text: '10' },
      { id: 'b', text: '12' },
      { id: 'c', text: '8' },
    ],
    correctOptionId: 'a',
    explanation: '1*2^3 + 0*2^2 + 1*2^1 + 0*2^0 = 8 + 0 + 2 + 0 = 10.',
  },
];

// Materias soportadas en el Piloto de Evaluación con Inteligencia Artificial
export const SUPPORTED_AI_PILOT_SUBJECTS = [
  'Programación Web',
  'Programación de Algoritmos',
];

export function isSubjectSupportedForAiEvaluation(subjectName: string): boolean {
  if (!subjectName) return false;
  return SUPPORTED_AI_PILOT_SUBJECTS.some(
    (s) => s.toLowerCase() === subjectName.toLowerCase()
  );
}

/**
 * Genera una ronda de 10 preguntas para la evaluación técnica de tutores.
 * 1. Si Gemini API está configurada, intenta generar retos dinámicos adaptados al nivel.
 * 2. Si no, extrae preguntas aleatorias del banco curado EXCLUSIVAMENTE para esa materia y nivel.
 * 3. NUNCA mezcla materias distintas.
 */
export async function generateLightningRound(
  subjectName: string,
  level: AcademicLevel = 'intermediate',
  count: number = 10,
  context?: { institution?: string; career?: string }
): Promise<ChallengeQuestion[]> {
  // 1. Intentar generación con Google Gemini API si la clave está disponible
  if (hasGeminiApiConfigured()) {
    try {
      const geminiQuestions = await generateGeminiQuestions(subjectName, level, count, context);
      if (geminiQuestions && geminiQuestions.length >= count) {
        return geminiQuestions;
      }
    } catch (e) {
      console.warn('[aiQuestionEngine] Falló generación con Gemini, recurriendo al banco curado:', e);
    }
  }

  // 2. Extraer del banco curado modular
  const allCurated = [...WEB_DEVELOPMENT_QUESTIONS, ...QUESTION_BANK];

  // Filtrar estrictamente por el nombre de la materia (sin cruces con otras asignaturas)
  let matched = allCurated.filter(
    (q) => q.subject.toLowerCase() === subjectName.toLowerCase()
  );

  if (matched.length === 0) {
    // Si la materia no cuenta con banco de preguntas cargado, retornar vacío (no inventar de otra materia)
    return [];
  }

  // Filtrar por el nivel seleccionado si hay preguntas etiquetadas
  const levelMatched = matched.filter((q) => !q.level || q.level === level);
  const pool = levelMatched.length >= count ? levelMatched : matched;

  // Barajar todo el conjunto aleatoriamente
  const shuffled = [...pool].sort(() => Math.random() - 0.5);

  // Separar desarrollo técnico (redaction) y selección rápida (choice)
  const redactions = shuffled.filter((q) => q.type === 'redaction');
  const choices = shuffled.filter((q) => q.type === 'choice');

  const picked: ChallengeQuestion[] = [];
  let rIdx = 0;
  let cIdx = 0;

  // Intercalar para ritmo dinámico en el chat
  while (picked.length < count && (rIdx < redactions.length || cIdx < choices.length)) {
    if (rIdx < redactions.length && picked.length < count) {
      picked.push(redactions[rIdx++]);
    }
    if (cIdx < choices.length && picked.length < count) {
      picked.push(choices[cIdx++]);
    }
  }

  // Si faltan, completar con lo que quede del grupo barajado de la MISMA materia
  for (const q of shuffled) {
    if (picked.length >= count) break;
    if (!picked.some((p) => p.id === q.id)) {
      picked.push(q);
    }
  }

  // Mezclar opciones para preguntas tipo choice
  return picked.map((q) => {
    if (q.type === 'choice' && q.options) {
      return {
        ...q,
        options: [...q.options].sort(() => Math.random() - 0.5),
      };
    }
    return { ...q };
  });
}
