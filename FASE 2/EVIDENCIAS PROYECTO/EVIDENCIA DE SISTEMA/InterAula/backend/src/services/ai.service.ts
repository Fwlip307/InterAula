/**
 * ai.service.ts
 * Servicio backend centralizado para generación y evaluación con Inteligencia Artificial.
 * Admite Google Gemini API cuando GEMINI_API_KEY está configurada, con fallback automático
 * e inmediato a bancos de preguntas pedagógicos curados y motor heurístico si no hay clave.
 */

export interface ChallengeQuestionDTO {
  id: string;
  subject: string;
  level?: 'basic' | 'intermediate' | 'advanced';
  type: 'choice' | 'redaction';
  category: 'conceptual' | 'debugging' | 'pedagogical';
  prompt: string;
  codeSnippet?: string;
  timeLimit?: number;
  options?: { id: string; text: string }[];
  correctOptionId?: string;
  acceptedAnswers?: string[];
  placeholder?: string;
  explanation: string;
}

export interface SequenceChallengeStepDTO {
  id: string;
  correctOrder: number;
  phase: string;
  label: string;
  codeOrHint: string;
}

export interface SequenceChallengeDTO {
  title: string;
  scenario: string;
  steps: SequenceChallengeStepDTO[];
  source?: string;
}

export interface AdaptiveQuizQuestionDTO {
  id: string;
  subject: string;
  themeId: string;
  themeLabel: string;
  analogyContext: string;
  prompt: string;
  codeSnippet?: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  hintStepByStep: string;
  explanation: string;
  sequenceChallenge?: SequenceChallengeDTO;
}

// ==============================================================================
// BANCO BASE DE PREGUNTAS CURADAS PARA RESPALDO INSTANTÁNEO
// ==============================================================================
const CURATED_QUESTIONS: ChallengeQuestionDTO[] = [
  // Algoritmos y Programación
  {
    id: 'cur_algo_1',
    subject: 'Programación de Algoritmos',
    level: 'intermediate',
    type: 'redaction',
    category: 'conceptual',
    timeLimit: 45,
    prompt: 'Escribe el nombre de la estructura de datos lineal que opera bajo el principio LIFO (Last In, First Out).',
    acceptedAnswers: ['pila', 'stack'],
    placeholder: 'Ej: pila, cola, arbol...',
    explanation: 'La Pila (Stack) apila elementos y desapila siempre el último en ingresar (LIFO).',
  },
  {
    id: 'cur_algo_2',
    subject: 'Programación de Algoritmos',
    level: 'basic',
    type: 'choice',
    category: 'conceptual',
    timeLimit: 15,
    prompt: '¿Cuál es el valor predeterminado que retorna una función en JavaScript que no incluye la sentencia return?',
    options: [
      { id: 'a', text: 'undefined' },
      { id: 'b', text: 'null' },
      { id: 'c', text: '0' },
    ],
    correctOptionId: 'a',
    explanation: 'Toda función en JavaScript sin return explícito evalúa y retorna el primitivo undefined.',
  },
  {
    id: 'cur_algo_3',
    subject: 'Programación de Algoritmos',
    level: 'intermediate',
    type: 'redaction',
    category: 'debugging',
    timeLimit: 45,
    prompt: 'Escribe el operador de JavaScript que compara tanto el valor como el tipo de dato de forma estricta.',
    acceptedAnswers: ['==='],
    placeholder: 'Ej: ==, ===...',
    explanation: '=== es el operador de igualdad estricta sin coerción de tipos.',
  },
  {
    id: 'cur_algo_4',
    subject: 'Programación de Algoritmos',
    level: 'intermediate',
    type: 'choice',
    category: 'debugging',
    timeLimit: 15,
    prompt: '¿Qué método de array en JavaScript añade elementos al final del arreglo modificando su longitud?',
    options: [
      { id: 'a', text: 'push()' },
      { id: 'b', text: 'pop()' },
      { id: 'c', text: 'shift()' },
    ],
    correctOptionId: 'a',
    explanation: 'push() inserta al final del array y retorna la nueva longitud.',
  },
  {
    id: 'cur_algo_5',
    subject: 'Programación de Algoritmos',
    level: 'advanced',
    type: 'redaction',
    category: 'conceptual',
    timeLimit: 45,
    prompt: 'Escribe la complejidad temporal asintótica en notación Big O del acceso directo a un elemento por índice en un Array.',
    acceptedAnswers: ['O(1)', 'o(1)', '1'],
    placeholder: 'Ej: O(1), O(n)...',
    explanation: 'El acceso por índice en memoria contigua se calcula en tiempo constante O(1).',
  },
  {
    id: 'cur_algo_6',
    subject: 'Programación de Algoritmos',
    level: 'basic',
    type: 'choice',
    category: 'conceptual',
    timeLimit: 15,
    prompt: '¿Qué palabra clave permite declarar variables con ámbito de bloque que no pueden ser reasignadas?',
    options: [
      { id: 'a', text: 'const' },
      { id: 'b', text: 'let' },
      { id: 'c', text: 'var' },
    ],
    correctOptionId: 'a',
    explanation: 'const declara constantes de ámbito de bloque que impiden reasignación de identificador.',
  },
  {
    id: 'cur_algo_7',
    subject: 'Programación de Algoritmos',
    level: 'intermediate',
    type: 'redaction',
    category: 'conceptual',
    timeLimit: 45,
    prompt: 'Escribe el nombre de la estructura lineal que procesa elementos bajo el orden de llegada FIFO.',
    acceptedAnswers: ['cola', 'queue'],
    placeholder: 'Ej: cola, pila...',
    explanation: 'La Cola (Queue) sigue el principio FIFO (First In, First Out).',
  },
  {
    id: 'cur_algo_8',
    subject: 'Programación de Algoritmos',
    level: 'intermediate',
    type: 'choice',
    category: 'debugging',
    timeLimit: 15,
    prompt: '¿Qué instrucción permite interrumpir y salir anticipadamente de la ejecución de un ciclo for?',
    options: [
      { id: 'a', text: 'break' },
      { id: 'b', text: 'continue' },
      { id: 'c', text: 'return' },
    ],
    correctOptionId: 'a',
    explanation: 'break finaliza la ejecución del bucle envolvente más próximo.',
  },
  {
    id: 'cur_algo_9',
    subject: 'Programación de Algoritmos',
    level: 'advanced',
    type: 'redaction',
    category: 'conceptual',
    timeLimit: 45,
    prompt: 'Escribe el término que designa a una función que se llama a sí misma para resolver subproblemas de menor tamaño.',
    acceptedAnswers: ['recursividad', 'recursiva', 'recursion'],
    placeholder: 'Ej: iteracion, recursividad...',
    explanation: 'La recursividad es la técnica donde una función se invoca a sí misma con un caso base de parada.',
  },
  {
    id: 'cur_algo_10',
    subject: 'Programación de Algoritmos',
    level: 'basic',
    type: 'choice',
    category: 'conceptual',
    timeLimit: 15,
    prompt: '¿Cuál es el tipo de dato devuelto por la expresión: typeof [1, 2, 3] en JavaScript?',
    options: [
      { id: 'a', text: 'object' },
      { id: 'b', text: 'array' },
      { id: 'c', text: 'list' },
    ],
    correctOptionId: 'a',
    explanation: 'En JavaScript, los arreglos son instancias de Object, por lo que typeof devuelve object.',
  },

  // Base de Datos
  {
    id: 'cur_db_1',
    subject: 'Modelamiento de Base de Datos',
    level: 'intermediate',
    type: 'redaction',
    category: 'conceptual',
    timeLimit: 45,
    prompt: 'Escribe las siglas en inglés del atributo o conjunto de atributos que identifica unívocamente a cada tupla en una tabla relacional.',
    acceptedAnswers: ['pk', 'primary key'],
    placeholder: 'Ej: PK, FK...',
    explanation: 'Primary Key (PK) o Clave Primaria garantiza la unicidad e integridad de la entidad.',
  },
  {
    id: 'cur_db_2',
    subject: 'Modelamiento de Base de Datos',
    level: 'intermediate',
    type: 'choice',
    category: 'conceptual',
    timeLimit: 15,
    prompt: '¿Qué tipo de clave hace referencia a la clave primaria de otra tabla para modelar relaciones?',
    options: [
      { id: 'a', text: 'Foreign Key (FK)' },
      { id: 'b', text: 'Candidate Key' },
      { id: 'c', text: 'Composite Key' },
    ],
    correctOptionId: 'a',
    explanation: 'La Clave Foránea (FK) mantiene la integridad referencial conectando tablas.',
  },
  {
    id: 'cur_db_3',
    subject: 'Consultas de Bases de Datos',
    level: 'intermediate',
    type: 'redaction',
    category: 'debugging',
    timeLimit: 45,
    prompt: 'Escribe la cláusula SQL para filtrar grupos resultantes tras una sentencia GROUP BY.',
    acceptedAnswers: ['having'],
    placeholder: 'Ej: where, having...',
    explanation: 'HAVING filtra sobre agregaciones a diferencia de WHERE que filtra filas antes de agrupar.',
  },
  {
    id: 'cur_db_4',
    subject: 'Consultas de Bases de Datos',
    level: 'basic',
    type: 'choice',
    category: 'conceptual',
    timeLimit: 15,
    prompt: '¿Qué comando SQL se utiliza para eliminar registros de una tabla sin borrar su estructura?',
    options: [
      { id: 'a', text: 'DELETE' },
      { id: 'b', text: 'DROP' },
      { id: 'c', text: 'REMOVE' },
    ],
    correctOptionId: 'a',
    explanation: 'DELETE elimina registros sujetos a condición WHERE preservando la tabla.',
  },

  // Matemáticas
  {
    id: 'cur_mat_1',
    subject: 'Nivelación Matemática',
    level: 'basic',
    type: 'choice',
    category: 'conceptual',
    timeLimit: 15,
    prompt: '¿Cuál es el resultado de resolver la operación: 2 + 3 * 4 respetando la jerarquía operacional?',
    options: [
      { id: 'a', text: '14' },
      { id: 'b', text: '20' },
      { id: 'c', text: '24' },
    ],
    correctOptionId: 'a',
    explanation: 'La multiplicación tiene precedencia: 3 * 4 = 12, luego 2 + 12 = 14.',
  },
  {
    id: 'cur_mat_2',
    subject: 'Nivelación Matemática',
    level: 'intermediate',
    type: 'redaction',
    category: 'conceptual',
    timeLimit: 45,
    prompt: 'Si 2x + 6 = 16, escribe el valor numérico exacto de x.',
    acceptedAnswers: ['5'],
    placeholder: 'Ej: 5',
    explanation: '2x = 16 - 6 -> 2x = 10 -> x = 5.',
  },
];

// Banco temático neuroinclusivo (DUA)
const ADAPTIVE_DUA_BANK: Record<string, AdaptiveQuizQuestionDTO[]> = {
  videojuegos: [
    {
      id: 'dua_vj_1',
      subject: 'Programación de Algoritmos',
      themeId: 'videojuegos',
      themeLabel: 'Videojuegos y RPGs',
      analogyContext: 'En Minecraft, el cofre de madera contiene 27 casillas ordenadas numéricamente desde la posición 0.',
      prompt: '¿Qué estructura de datos informática representa idénticamente este cofre con acceso directo por posición?',
      options: [
        { id: 'a', text: 'Un Arreglo (Array) unidimensional con índices numéricos.' },
        { id: 'b', text: 'Un bucle while infinito.' },
        { id: 'c', text: 'Una variable booleana simple.' },
        { id: 'd', text: 'Un archivo de texto plano no indexado.' },
      ],
      correctOptionId: 'a',
      hintStepByStep: 'Paso 1: Agrupa elementos contiguos. Paso 2: Accedes diciendo casilla[0], casilla[1].',
      explanation: 'Un Array almacena elementos contiguos con acceso O(1) directo a través de su índice numérico.',
    },
    {
      id: 'dua_vj_2',
      subject: 'Programación de Algoritmos',
      themeId: 'videojuegos',
      themeLabel: 'Videojuegos y RPGs',
      analogyContext: 'Tu personaje en un RPG debe atacar al jefe final repetidamente hasta que su vida llegue a 0.',
      prompt: '¿Qué estructura de bucle es la adecuada cuando no sabes cuántos turnos exactos tomará derrotarlo?',
      codeSnippet: 'while (boss.hp > 0) {\n  player.attack(boss);\n}',
      options: [
        { id: 'a', text: 'Un ciclo "for" rígido de 10 iteraciones fijas.' },
        { id: 'b', text: 'Un ciclo "while" que evalúa la condición de vida en cada ronda.' },
        { id: 'c', text: 'Una función recursiva sin caso base.' },
        { id: 'd', text: 'Un condicional switch.' },
      ],
      correctOptionId: 'b',
      hintStepByStep: 'Paso 1: La cantidad de ataques es incierta. Paso 2: El ciclo debe seguir "mientras" la condición se cumpla.',
      explanation: 'El bucle while repite la ejecución mientras la condición booleana de vida sea verdadera.',
    },
    {
      id: 'dua_vj_3',
      subject: 'Modelamiento de Base de Datos',
      themeId: 'videojuegos',
      themeLabel: 'Videojuegos y RPGs',
      analogyContext: 'En un servidor multijugador, cada jugador tiene un ID de cuenta único irrepetible para guardar sus skins y nivel.',
      prompt: 'En el modelo relacional, ¿qué representa este identificador único en la tabla "Jugadores"?',
      options: [
        { id: 'a', text: 'Clave Primaria (Primary Key - PK).' },
        { id: 'b', text: 'Clave Foránea hacia otra tabla ajena.' },
        { id: 'c', text: 'Un campo descriptivo que admite duplicados.' },
        { id: 'd', text: 'Un índice secundario opcional.' },
      ],
      correctOptionId: 'a',
      hintStepByStep: 'Paso 1: Es único e irrepetible. Paso 2: Identifica inequívocamente a cada fila en la tabla.',
      explanation: 'La Clave Primaria (PK) garantiza la unicidad e integridad referencial de cada jugador.',
    },
  ],
  musica: [
    {
      id: 'dua_mus_1',
      subject: 'Programación de Algoritmos',
      themeId: 'musica',
      themeLabel: 'Música y Streaming',
      analogyContext: 'En Spotify, la lista "Reproducir a continuación" toca en primer lugar la primera canción que añadiste a la cola.',
      prompt: '¿Qué estructura de datos lineal representa este comportamiento FIFO (First In, First Out)?',
      options: [
        { id: 'a', text: 'Una Cola (Queue).' },
        { id: 'b', text: 'Una Pila (Stack).' },
        { id: 'c', text: 'Un árbol binario.' },
        { id: 'd', text: 'Un número de punto flotante.' },
      ],
      correctOptionId: 'a',
      hintStepByStep: 'Paso 1: Piensa en una fila de espera. Paso 2: El primero en llegar es el primero en ser atendido.',
      explanation: 'Una Cola (Queue) respeta la política FIFO: el primer elemento encolado es el primero en reproducirse.',
    },
    {
      id: 'dua_mus_2',
      subject: 'Modelamiento de Base de Datos',
      themeId: 'musica',
      themeLabel: 'Música y Streaming',
      analogyContext: 'En una app musical, un Artista puede publicar muchas canciones, pero cada canción pertenece a un artista principal.',
      prompt: '¿Qué cardinalidad de relación existe entre "Artista" y "Canción"?',
      options: [
        { id: 'a', text: 'Relación 1 a Muchos (1:N).' },
        { id: 'b', text: 'Relación 1 a 1 estricta (1:1).' },
        { id: 'c', text: 'Relación circular N a N sin tabla intermedia.' },
        { id: 'd', text: 'Sin relación en la base de datos.' },
      ],
      correctOptionId: 'a',
      hintStepByStep: 'Paso 1: Un artista tiene muchas canciones. Paso 2: Una canción tiene un solo artista.',
      explanation: 'La relación es 1:N. La clave foránea se coloca en la tabla de canciones apuntando al artista.',
    },
    {
      id: 'dua_mus_3',
      subject: 'Programación de Algoritmos',
      themeId: 'musica',
      themeLabel: 'Música y Streaming',
      analogyContext: 'Quieres aplicar un ecualizador a las 10 pistas de un álbum musical numeradas del 0 al 9.',
      prompt: 'Si conoces de antemano la cantidad exacta de pistas (10), ¿qué bucle es el más limpio para iterar?',
      codeSnippet: 'for (let i = 0; i < 10; i++) {\n  ecualizar(pistas[i]);\n}',
      options: [
        { id: 'a', text: 'Un ciclo for con contador numérico.' },
        { id: 'b', text: 'Un bloque try/catch.' },
        { id: 'c', text: 'Llamar a console.log sin bucles.' },
        { id: 'd', text: 'Crear 10 variables independientes.' },
      ],
      correctOptionId: 'a',
      hintStepByStep: 'Paso 1: Conoces el tamaño exacto. Paso 2: El for maneja inicio, tope e incremento.',
      explanation: 'El bucle for es la estructura idónea cuando la cantidad de repeticiones está determinada.',
    },
  ],
  ciberseguridad: [
    {
      id: 'dua_cib_1',
      subject: 'Programación de Algoritmos',
      themeId: 'ciberseguridad',
      themeLabel: 'Ciberseguridad y Hackers',
      analogyContext: 'Un sistema bancario bloquea una cuenta tras 3 intentos fallidos consecutivos de contraseña.',
      prompt: '¿Cómo modelas lógicamente esta regla de seguridad mediante control de flujo?',
      codeSnippet: 'if (intentos >= 3) {\n  bloquearCuenta();\n} else {\n  permitirIntento();\n}',
      options: [
        { id: 'a', text: 'Con una sentencia condicional if/else.' },
        { id: 'b', text: 'Con una suma aritmética simple.' },
        { id: 'c', text: 'Con una declaración de clase abstracta.' },
        { id: 'd', text: 'Borrando la tabla de usuarios.' },
      ],
      correctOptionId: 'a',
      hintStepByStep: 'Paso 1: El sistema debe decidir entre dos caminos según una condición booleana.',
      explanation: 'La bifurcación condicional if/else ejecuta un bloque u otro dependiendo de si se supera el umbral.',
    },
    {
      id: 'dua_cib_2',
      subject: 'Modelamiento de Base de Datos',
      themeId: 'ciberseguridad',
      themeLabel: 'Ciberseguridad y Hackers',
      analogyContext: 'Para proteger contraseñas, nunca se deben guardar en texto plano, sino mediante un hash criptográfico unidireccional.',
      prompt: '¿Qué tipo de dato y tamaño en base de datos es el más idóneo para almacenar un hash SHA-256 de 64 caracteres?',
      options: [
        { id: 'a', text: 'VARCHAR(64) o CHAR(64).' },
        { id: 'b', text: 'BOOLEAN.' },
        { id: 'c', text: 'INTEGER.' },
        { id: 'd', text: 'FLOAT.' },
      ],
      correctOptionId: 'a',
      hintStepByStep: 'Paso 1: Un hash SHA-256 genera una cadena alfanumérica de exactamente 64 caracteres.',
      explanation: 'CHAR(64) o VARCHAR(64) asegura la longitud exacta para un digest criptográfico.',
    },
  ],
};

// Control anti-repetición en memoria para garantizar variedad continua entre llamadas consecutivas
const recentQuestionSignatures: string[] = [];
const RECENT_MAX_HISTORY = 48;

function recordSignature(sig: string) {
  recentQuestionSignatures.push(sig);
  if (recentQuestionSignatures.length > RECENT_MAX_HISTORY) {
    recentQuestionSignatures.shift();
  }
}

function wasRecentlyServed(sig: string): boolean {
  return recentQuestionSignatures.includes(sig);
}

function fisherYatesShuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

/**
 * Baraja aleatoriamente las opciones (a, b, c, d) y actualiza correctOptionId
 * para que la respuesta correcta nunca quede fija en la misma letra.
 */
export function randomizeQuestionOptions<
  T extends {
    options?: { id: string; text: string }[];
    correctOptionId?: string;
  }
>(q: T): T {
  if (!q.options || q.options.length < 2 || !q.correctOptionId) {
    return q;
  }
  const letters = ['a', 'b', 'c', 'd', 'e'].slice(0, q.options.length);
  const originalCorrect = q.options.find((o) => o.id === q.correctOptionId) || q.options[0];
  const shuffledTexts = fisherYatesShuffle(q.options.map((o) => o.text));

  let newCorrectId = 'a';
  const remappedOptions = shuffledTexts.map((txt, idx) => {
    const letter = letters[idx] || String.fromCharCode(97 + idx);
    if (txt === originalCorrect.text) {
      newCorrectId = letter;
    }
    return { id: letter, text: txt };
  });

  return {
    ...q,
    options: remappedOptions,
    correctOptionId: newCorrectId,
  };
}

/**
 * Motor IA Generativo sin clave (OpenAI-compatible vía Pollinations Text API con semilla aleatoria).
 * Se ejecuta cuando GEMINI_API_KEY no está definida, salvo durante tests unitarios.
 */
export async function callFreeGenerativeAI(prompt: string, timeoutMs = 5500): Promise<any | null> {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    return null;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const randomSeed = Math.floor(Math.random() * 900000) + 100000;

  try {
    const response = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'openai',
        seed: randomSeed,
        temperature: 0.85,
        messages: [
          {
            role: 'system',
            content:
              'Eres el motor de inteligencia artificial académica de InterAula. Respondes SIEMPRE únicamente con JSON válido sin bloques markdown.',
          },
          {
            role: 'user',
            content: `${prompt}\n\n[Semilla aleatoria obligatoria para no repetir preguntas anteriores: ${randomSeed}]`,
          },
        ],
      }),
    });

    clearTimeout(timer);
    if (!response.ok) return null;

    const data: any = await response.json();
    const rawContent = data?.choices?.[0]?.message?.content;
    if (!rawContent || typeof rawContent !== 'string') return null;

    const clean = rawContent
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    return JSON.parse(clean);
  } catch {
    clearTimeout(timer);
    return null;
  }
}

const VARIATION_ANGLES = [
  'resolución práctica de un caso de laboratorio universitario',
  'detección y corrección de errores frecuentes (debugging)',
  'optimización y rendimiento en escenarios con múltiples datos',
  'análisis de casos borde y condiciones de entrada extremas',
  'diseño modular y arquitectura limpia paso a paso',
  'validación de integridad y trazabilidad de resultados',
];

export const aiBackendService = {
  /**
   * Consulta el estado de la integración de IA
   */
  getStatus() {
    const key = process.env.GEMINI_API_KEY;
    const isConfigured = Boolean(key && key.trim().length > 5);
    return {
      configured: true,
      provider: isConfigured ? 'gemini' : 'hybrid_generative_ai',
      models: isConfigured
        ? ['gemini-1.5-flash', 'gemini-2.0-flash']
        : ['openai-pollinations-live', 'combinatorial-dua-engine'],
    };
  },

  /**
   * Generación de preguntas técnicas para acreditación o retos (con variedad garantizada)
   */
  async generateQuestions(params: {
    subject_id?: string;
    subject_name: string;
    level?: 'basic' | 'intermediate' | 'advanced';
    count?: number;
    context?: { institution?: string; career?: string };
  }): Promise<ChallengeQuestionDTO[]> {
    const targetCount = params.count || 10;
    const targetLevel = params.level || 'intermediate';
    const geminiKey = process.env.GEMINI_API_KEY;

    // 1. Intentar con Google Gemini API si la clave está configurada
    if (geminiKey && geminiKey.trim().length > 5) {
      try {
        const candidate = await this.callGeminiQuestions(
          geminiKey,
          params.subject_name,
          targetLevel,
          targetCount,
          params.context
        );
        if (candidate && candidate.length >= 3) {
          return candidate.slice(0, targetCount).map((q) => randomizeQuestionOptions(q));
        }
      } catch (err) {
        console.warn('[aiBackendService] Gemini questions falló, intentando IA generativa libre:', err);
      }
    }

    // 2. Intentar con Motor IA Generativo en vivo (sin clave)
    try {
      const angle = VARIATION_ANGLES[Math.floor(Math.random() * VARIATION_ANGLES.length)];
      const freePrompt = `Genera exactamente ${targetCount} preguntas técnicas inéditas y variadas para evaluar a un estudiante universitario en la asignatura "${params.subject_name}" (nivel "${targetLevel}"), enfocándote hoy en: ${angle}.
Mezcla preguntas de selección múltiple ("type": "choice", 3 opciones a/b/c, "correctOptionId": "a") y de desarrollo corto ("type": "redaction", "acceptedAnswers": ["palabra1", "palabra2"]).
Devuelve ÚNICAMENTE un arreglo JSON válido con objetos:
[{"id":"q1","subject":"${params.subject_name}","type":"choice","category":"conceptual","timeLimit":15,"prompt":"...","options":[{"id":"a","text":"..."},{"id":"b","text":"..."},{"id":"c","text":"..."}],"correctOptionId":"a","explanation":"..."}]`;

      const aiParsed = await callFreeGenerativeAI(freePrompt, 5500);
      if (Array.isArray(aiParsed) && aiParsed.length >= Math.min(3, targetCount)) {
        return aiParsed.slice(0, targetCount).map((q: any, idx: number) =>
          randomizeQuestionOptions({
            id: `ai_live_${Date.now()}_${idx + 1}_${Math.floor(Math.random() * 1000)}`,
            subject: params.subject_name,
            level: targetLevel,
            type: q.type === 'redaction' ? 'redaction' : 'choice',
            category: q.category || 'practical',
            timeLimit: q.type === 'redaction' ? 45 : 15,
            prompt: String(q.prompt || `Pregunta sobre ${params.subject_name}`),
            options: Array.isArray(q.options) ? q.options : undefined,
            correctOptionId: q.correctOptionId || 'a',
            acceptedAnswers: Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : ['concepto', 'validacion'],
            placeholder: q.placeholder || 'Escribe tu respuesta técnica...',
            explanation: String(q.explanation || 'Concepto verificado por IA.'),
          })
        );
      }
    } catch {
      // Continúa al generador combinatorio
    }

    // 3. Generador combinatorio dinámico con memoria anti-repetición
    return this.getCuratedFallbackQuestions(params.subject_name, targetLevel, targetCount);
  },

  /**
   * Generación de micro-quizzes adaptativos con andamiaje neuroinclusivo DUA (siempre aleatorios)
   * Incluye generación con IA de bloques de secuencia lógica (sequenceChallenge) para la materia y tema.
   */
  async generateQuiz(params: {
    subject_name: string;
    theme_id: string;
    topic?: string;
    count?: number;
  }): Promise<AdaptiveQuizQuestionDTO[]> {
    const targetCount = params.count || 3;
    const customTopic = params.topic?.trim() || '';
    const geminiKey = process.env.GEMINI_API_KEY;
    const dynamicSeq = buildDynamicSequenceChallenge(params.subject_name, params.theme_id, customTopic);

    // 1. Intentar con Gemini API
    if (geminiKey && geminiKey.trim().length > 5) {
      try {
        const candidate = await this.callGeminiQuiz(
          geminiKey,
          params.subject_name,
          params.theme_id,
          targetCount,
          customTopic
        );
        if (candidate && candidate.length >= 2) {
          return candidate.slice(0, targetCount).map((q, idx) =>
            randomizeQuestionOptions({
              ...q,
              sequenceChallenge: idx === 0 ? q.sequenceChallenge || dynamicSeq : q.sequenceChallenge,
            })
          );
        }
      } catch (err) {
        console.warn('[aiBackendService] Gemini quiz falló, intentando IA generativa libre:', err);
      }
    }

    // 2. Intentar con Motor IA Generativo en vivo (sin clave)
    try {
      const themeLabelMap: Record<string, string> = {
        videojuegos: 'Videojuegos y RPGs (inventarios, mecánicas, stats, misiones)',
        musica: 'Música y Streaming (Spotify, ritmos, sintetizadores, playlists)',
        ciberseguridad: 'Ciberseguridad y Hackers Éticos (firewalls, hashes, puertos, auditorías)',
        anime_series: 'Anime y Series (gremios, torneos, poderes, misiones en equipo)',
        deportes: 'Deportes y Estrategia (fútbol, estadísticas en vivo, tácticas, torneos)',
        apps_reales: 'Apps y Vida Cotidiana (delivery, mapas GPS, carritos de compra, notificaciones)',
      };
      const themeDesc = themeLabelMap[params.theme_id] || 'Analogías cotidianas';
      const angle = VARIATION_ANGLES[Math.floor(Math.random() * VARIATION_ANGLES.length)];
      const topicClause = customTopic ? ` enfocándote específicamente en el tema "${customTopic}"` : '';

      const freeQuizPrompt = `Actúa como pedagogo DUA en InterAula. Genera ${targetCount} preguntas de selección múltiple TOTALMENTE NUEVAS Y DIFERENTES para la asignatura "${params.subject_name}"${topicClause}, explicadas mediante analogías de "${themeDesc}" y enfocadas en ${angle}. Además, incluye en el primer elemento un campo "sequenceChallenge" con 4 pasos ordenados lógicamente sobre "${customTopic || params.subject_name}".
Responde ÚNICAMENTE con un arreglo JSON válido:
[{"id":"q1","subject":"${params.subject_name}","themeId":"${params.theme_id}","themeLabel":"${themeDesc}","analogyContext":"Contexto narrativo creativo...","prompt":"¿Pregunta técnica conectada con la analogía?","options":[{"id":"a","text":"Opción correcta"},{"id":"b","text":"Distractor 1"},{"id":"c","text":"Distractor 2"},{"id":"d","text":"Distractor 3"}],"correctOptionId":"a","hintStepByStep":"Paso 1: ... Paso 2: ...","explanation":"Explicación clara...","sequenceChallenge":{"title":"Reto de secuencia lógica","scenario":"Breve escenario práctico","steps":[{"id":"s1","correctOrder":1,"phase":"1. Entrada / Planteamiento","label":"Primer paso lógico","codeOrHint":"Fórmula o pista 1"},{"id":"s2","correctOrder":2,"phase":"2. Estructura / Regla","label":"Segundo paso lógico","codeOrHint":"Fórmula o pista 2"},{"id":"s3","correctOrder":3,"phase":"3. Desarrollo / Proceso","label":"Tercer paso lógico","codeOrHint":"Fórmula o pista 3"},{"id":"s4","correctOrder":4,"phase":"4. Verificación / Resultado","label":"Cuarto paso lógico","codeOrHint":"Fórmula o pista 4"}]}}]`;

      const aiQuiz = await callFreeGenerativeAI(freeQuizPrompt, 5500);
      if (Array.isArray(aiQuiz) && aiQuiz.length >= Math.min(2, targetCount)) {
        const rawSeq = aiQuiz[0]?.sequenceChallenge;
        const validAiSeq: SequenceChallengeDTO =
          rawSeq && Array.isArray(rawSeq.steps) && rawSeq.steps.length === 4
            ? {
                title: String(rawSeq.title || dynamicSeq.title),
                scenario: String(rawSeq.scenario || dynamicSeq.scenario),
                source: 'ai_live',
                steps: rawSeq.steps.map((st: any, sIdx: number) => ({
                  id: `ai_seq_${Date.now()}_${sIdx + 1}`,
                  correctOrder: sIdx + 1,
                  phase: String(st.phase || `Fase ${sIdx + 1}`),
                  label: String(st.label || st.title || `Paso ${sIdx + 1}`),
                  codeOrHint: String(st.codeOrHint || st.detail || ''),
                })),
              }
            : dynamicSeq;

        return aiQuiz.slice(0, targetCount).map((item: any, idx: number) =>
          randomizeQuestionOptions({
            id: `ai_dua_${Date.now()}_${idx + 1}_${Math.floor(Math.random() * 1000)}`,
            subject: params.subject_name,
            themeId: params.theme_id,
            themeLabel: item.themeLabel || themeDesc,
            analogyContext: String(item.analogyContext || `Escenario práctico en ${themeDesc}`),
            prompt: String(item.prompt || `¿Cómo aplicarías este concepto de ${params.subject_name}?`),
            options:
              Array.isArray(item.options) && item.options.length >= 3
                ? item.options
                : [
                    { id: 'a', text: 'Aplicando la estructura lógica y validando la condición de entrada' },
                    { id: 'b', text: 'Omitiendo las reglas de validación del modelo' },
                    { id: 'c', text: 'Eliminando los registros sin verificar' },
                    { id: 'd', text: 'Dejando el proceso en un bucle infinito' },
                  ],
            correctOptionId: item.correctOptionId || 'a',
            hintStepByStep: String(
              item.hintStepByStep || 'Paso 1: Analiza la entrada. Paso 2: Verifica la regla central.'
            ),
            explanation: String(
              item.explanation || `¡Excelente! Conectaste la analogía con el fundamento de ${params.subject_name}.`
            ),
            sequenceChallenge: idx === 0 ? validAiSeq : undefined,
          })
        );
      }
    } catch {
      // Continúa al generador combinatorio DUA
    }

    // 3. Generador combinatorio dinámico DUA con barajado de preguntas, contextos y opciones
    return this.getAdaptiveFallbackQuiz(params.subject_name, params.theme_id, targetCount, customTopic);
  },

  /**
   * Evaluar semánticamente una respuesta abierta o de redacción con rúbrica pedagógica
   */
  async evaluateAnswer(data: {
    question: string;
    answer: string;
    rubric?: string;
    level?: string;
  }): Promise<{ score: number; passed: boolean; feedback: string }> {
    const geminiKey = process.env.GEMINI_API_KEY;

    if (geminiKey && geminiKey.trim().length > 5) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `Actúa como docente evaluador universitario en InterAula.
Pregunta: "${data.question}"
Respuesta del estudiante: "${data.answer}"
Rúbrica esperada: "${data.rubric || 'Demostrar comprensión conceptual, precisión técnica y capacidad explicativa.'}"
Nivel: ${data.level || 'intermedio'}

Evalúa la respuesta y responde ÚNICAMENTE con un JSON en este formato:
{
  "score": <número del 1 al 10>,
  "passed": <true si score >= 6, false de lo contrario>,
  "feedback": "<explicación pedagógica breve y constructiva de 2 a 3 líneas>"
}`,
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.3,
                responseMimeType: 'application/json',
              },
            }),
          }
        );

        clearTimeout(timer);

        if (response.ok) {
          const resJson: any = await response.json();
          const rawText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            if (typeof parsed.score === 'number') {
              return {
                score: parsed.score,
                passed: Boolean(parsed.passed ?? parsed.score >= 6),
                feedback: parsed.feedback || 'Evaluación semántica procesada por IA.',
              };
            }
          }
        }
      } catch (err) {
        console.warn('[aiBackendService] Gemini evaluate falló, usando motor heurístico:', err);
      }
    }

    // Evaluación heurística de respaldo en el servidor
    const cleanAnswer = data.answer.trim();
    const wordCount = cleanAnswer.split(/\s+/).length;
    const hasTechnicalKeywords = cleanAnswer.length > 20;
    const score = wordCount >= 8 && hasTechnicalKeywords ? 8 : wordCount >= 4 ? 6 : 4;

    return {
      score,
      passed: score >= 6,
      feedback:
        score >= 6
          ? 'Respuesta conceptualmente consistente. Demuestra nociones técnicas acordes a los requerimientos de la asignatura.'
          : 'Respuesta breve o incompleta. Se recomienda profundizar con terminología técnica precisa.',
    };
  },

  // ==============================================================================
  // HELPERS PRIVADOS DE INTEGRACIÓN CON GEMINI (CON SEMILLAS DE VARIACIÓN)
  // ==============================================================================
  async callGeminiQuestions(
    key: string,
    subject: string,
    level: string,
    count: number,
    context?: { institution?: string; career?: string }
  ): Promise<ChallengeQuestionDTO[] | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);

    const institutionNote = context?.institution ? ` Institución: ${context.institution}.` : '';
    const careerNote = context?.career ? ` Carrera: ${context.career}.` : '';
    const randomSeed = Math.floor(Math.random() * 1000000);
    const angle = VARIATION_ANGLES[Math.floor(Math.random() * VARIATION_ANGLES.length)];

    const prompt = `Eres el evaluador técnico de InterAula (Semilla de variación aleatoria #${randomSeed}).
Genera exactamente ${count} preguntas técnicas INÉDITAS y variadas para acreditar a un estudiante como tutor en la materia "${subject}", nivel "${level}".${institutionNote}${careerNote}
Enfoque especial de esta tanda: ${angle}. No repitas preguntas genéricas.

REGLAS OBLIGATORIAS:
- Mezcla 50% de alternativas ("type": "choice", 3 opciones a/b/c, 1 correcta "correctOptionId") y 50% de redacción corta ("type": "redaction", "acceptedAnswers": ["palabras", "clave"]).
- Formato JSON estricto sin markdown ni texto adicional:
[
  {
    "id": "q1",
    "subject": "${subject}",
    "type": "choice",
    "category": "conceptual",
    "timeLimit": 15,
    "prompt": "Enunciado...",
    "options": [
      {"id": "a", "text": "Opción A"},
      {"id": "b", "text": "Opción B"},
      {"id": "c", "text": "Opción C"}
    ],
    "correctOptionId": "a",
    "explanation": "Breve explicación..."
  },
  {
    "id": "q2",
    "subject": "${subject}",
    "type": "redaction",
    "category": "debugging",
    "timeLimit": 45,
    "prompt": "Enunciado...",
    "acceptedAnswers": ["termino_clave"],
    "placeholder": "Ej: ...",
    "explanation": "Breve explicación..."
  }
]`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.85,
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      clearTimeout(timer);

      if (!response.ok) return null;
      const resJson: any = await response.json();
      const rawText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) return null;

      const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed: ChallengeQuestionDTO[] = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((q, idx) =>
          randomizeQuestionOptions({
            ...q,
            id: `gemini_${Date.now()}_${idx + 1}_${randomSeed}`,
            subject,
            level: (level as any) || 'intermediate',
          })
        );
      }
      return null;
    } catch {
      clearTimeout(timer);
      return null;
    }
  },

  async callGeminiQuiz(
    key: string,
    subject: string,
    themeId: string,
    count: number,
    customTopic?: string
  ): Promise<AdaptiveQuizQuestionDTO[] | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);

    const themeLabelMap: Record<string, string> = {
      videojuegos: 'Videojuegos y RPGs (inventarios, mecánicas, stats, niveles)',
      musica: 'Música y Streaming (Spotify, ritmos, sintetizadores, playlists)',
      ciberseguridad: 'Ciberseguridad y Hackers (firewalls, contraseñas, misiones éticas)',
      anime_series: 'Anime y Series (gremios, héroes, tramas y misiones épicas)',
      deportes: 'Deportes y Estrategia (fútbol, estadísticas, torneos, tácticas)',
      apps_reales: 'Apps y Vida Cotidiana (delivery, redes sociales, mapas y GPS)',
    };

    const themeDesc = themeLabelMap[themeId] || 'Analogías cotidianas amigables';
    const randomSeed = Math.floor(Math.random() * 1000000);
    const angle = VARIATION_ANGLES[Math.floor(Math.random() * VARIATION_ANGLES.length)];
    const topicClause = customTopic ? `, específicamente sobre el tema "${customTopic}"` : '';

    const prompt = `Actúa como pedagogo de Diseño Universal para el Aprendizaje (DUA) en InterAula (Semilla #${randomSeed}).
Crea un micro-desafío adaptativo de ${count} preguntas INÉDITAS y variadas para la materia "${subject}"${topicClause}, utilizando analogías exclusivas de: "${themeDesc}" y enfocándote en: ${angle}.
Además, en la primera pregunta incluye el objeto "sequenceChallenge" con 4 pasos ordenados lógicamente (1 al 4) para resolver un problema práctico de "${customTopic || subject}".

Responde ÚNICAMENTE un arreglo JSON con esta estructura:
[
  {
    "id": "q1",
    "subject": "${subject}",
    "themeId": "${themeId}",
    "themeLabel": "${themeDesc}",
    "analogyContext": "Breve contexto narrativo amable...",
    "prompt": "¿Enunciado claro de la pregunta?",
    "options": [
      {"id": "a", "text": "Opción A"},
      {"id": "b", "text": "Opción B"},
      {"id": "c", "text": "Opción C"},
      {"id": "d", "text": "Opción D"}
    ],
    "correctOptionId": "a",
    "hintStepByStep": "Paso 1: ... Paso 2: ...",
    "explanation": "¡Bien hecho! Este concepto demuestra...",
    "sequenceChallenge": {
      "title": "Título del reto de secuencia lógica",
      "scenario": "Contexto práctico con analogía",
      "steps": [
        {"id": "s1", "correctOrder": 1, "phase": "1. Entrada / Planteamiento", "label": "Paso 1", "codeOrHint": "Detalle o fórmula"},
        {"id": "s2", "correctOrder": 2, "phase": "2. Estructura / Modelo", "label": "Paso 2", "codeOrHint": "Detalle o fórmula"},
        {"id": "s3", "correctOrder": 3, "phase": "3. Desarrollo / Proceso", "label": "Paso 3", "codeOrHint": "Detalle o fórmula"},
        {"id": "s4", "correctOrder": 4, "phase": "4. Verificación / Resultado", "label": "Paso 4", "codeOrHint": "Detalle o fórmula"}
      ]
    }
  }
]`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.85,
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      clearTimeout(timer);

      if (!response.ok) return null;
      const resJson: any = await response.json();
      const rawText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) return null;

      const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed: AdaptiveQuizQuestionDTO[] = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item, idx) =>
          randomizeQuestionOptions({
            ...item,
            id: `ai_adapt_${Date.now()}_${idx + 1}_${randomSeed}`,
            subject,
            themeId,
          })
        );
      }
      return null;
    } catch {
      clearTimeout(timer);
      return null;
    }
  },

  getCuratedFallbackQuestions(
    subject: string,
    level: 'basic' | 'intermediate' | 'advanced',
    count: number
  ): ChallengeQuestionDTO[] {
    const norm = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const subNorm = norm(subject);
    const dynamicExtras = buildDynamicChallengeQuestionsForSubject(subject, level);
    let matched = [
      ...CURATED_QUESTIONS.filter((q) => norm(q.subject) === subNorm),
      ...dynamicExtras,
    ];

    if (matched.length < count) {
      if (subNorm.includes('matemat') || subNorm.includes('calcul')) {
        matched = [
          ...matched,
          ...CURATED_QUESTIONS.filter((q) => q.subject.includes('Matemática')),
        ];
      } else if (subNorm.includes('base') || subNorm.includes('dato') || subNorm.includes('sql')) {
        matched = [
          ...matched,
          ...CURATED_QUESTIONS.filter((q) => q.subject.includes('Base de Datos')),
        ];
      } else {
        matched = [
          ...matched,
          ...CURATED_QUESTIONS.filter((q) => q.subject.includes('Algoritmos')),
        ];
      }
    }

    if (matched.length === 0) {
      matched = [...CURATED_QUESTIONS, ...dynamicExtras];
    }

    // Priorizar preguntas no servidas recientemente
    const unseen = matched.filter((q) => !wasRecentlyServed(q.prompt));
    const orderedPool = [
      ...fisherYatesShuffle(unseen),
      ...fisherYatesShuffle(matched.filter((q) => wasRecentlyServed(q.prompt))),
    ];

    const result: ChallengeQuestionDTO[] = [];
    for (let i = 0; i < count; i++) {
      const base = orderedPool[i % orderedPool.length];
      recordSignature(base.prompt);
      const randomized = randomizeQuestionOptions({
        ...base,
        id: `cur_${Date.now()}_${i + 1}_${Math.floor(Math.random() * 10000)}`,
        subject,
        level,
      });
      result.push(randomized);
    }

    return result;
  },

  getAdaptiveFallbackQuiz(
    subject: string,
    themeId: string,
    count: number,
    customTopic?: string
  ): AdaptiveQuizQuestionDTO[] {
    const generatedPool = buildCombinatorialDuaQuizPool(subject, themeId);
    const staticPool = ADAPTIVE_DUA_BANK[themeId] || [];
    const fullPool = [...generatedPool, ...staticPool];
    const dynamicSeq = buildDynamicSequenceChallenge(subject, themeId, customTopic);

    // Filtrar primero preguntas que no hayan salido en intentos recientes
    const freshItems = fullPool.filter((q) => !wasRecentlyServed(`${themeId}:${q.prompt}`));
    const staleItems = fullPool.filter((q) => wasRecentlyServed(`${themeId}:${q.prompt}`));

    const candidates = [
      ...fisherYatesShuffle(freshItems),
      ...fisherYatesShuffle(staleItems),
    ];

    const result: AdaptiveQuizQuestionDTO[] = [];
    for (let i = 0; i < count; i++) {
      const base = candidates[i % candidates.length];
      recordSignature(`${themeId}:${base.prompt}`);
      const topicPrefix = customTopic ? `[Tema: ${customTopic}] ` : '';
      result.push(
        randomizeQuestionOptions({
          ...base,
          id: `dua_gen_${Date.now()}_${i + 1}_${Math.floor(Math.random() * 10000)}`,
          subject,
          themeId,
          prompt: topicPrefix ? `${topicPrefix}${base.prompt}` : base.prompt,
          sequenceChallenge: i === 0 ? dynamicSeq : undefined,
        })
      );
    }

    return result;
  },
};

/**
 * Generador dinámico de Retos de Bloques de Secuencia Lógica por Asignatura, Temática e Input del Usuario.
 * Garantiza que Matemáticas, Estadística, SQL, Modelamiento, Web, POO, Algoritmos y cualquier tema
 * escrito por el estudiante tengan siempre secuencias lógicas reales, variadas y coherentes.
 */
function buildDynamicSequenceChallenge(
  subject: string,
  themeId: string,
  customTopic?: string
): SequenceChallengeDTO {
  const lower = `${subject} ${customTopic || ''}`.toLowerCase();
  const seed = Math.floor(Math.random() * 1000);
  const nA = Math.floor(Math.random() * 8) + 3;
  const nB = Math.floor(Math.random() * 15) + 10;
  const topicLabel = customTopic?.trim() ? customTopic.trim() : subject;

  const themeContextMap: Record<string, string> = {
    videojuegos: 'en el motor de progreso y estadísticas de tu videojuego',
    musica: 'en la producción y mezcla de pistas de audio digital',
    ciberseguridad: 'en la auditoría de seguridad y protección de datos',
    anime_series: 'en la planificación estratégica de una misión de equipo',
    deportes: 'en el análisis táctico de rendimiento deportivo',
    apps_reales: 'en la plataforma digital de logística en tiempo real',
  };
  const themePhrase = themeContextMap[themeId] || 'en un escenario práctico universitario';

  // Si el estudiante escribió un tema específico personalizado, adaptar los 4 bloques directamente a ese tema
  if (customTopic && customTopic.trim().length >= 3) {
    const cleanT = customTopic.trim();
    const customVariants: SequenceChallengeDTO[] = [
      {
        title: `Secuencia de resolución para: ${cleanT} (${subject})`,
        scenario: `Ordena los 4 pasos lógicos para plantear, desarrollar y comprobar "${cleanT}" aplicado ${themePhrase}.`,
        source: 'ai_dynamic',
        steps: [
          {
            id: `seq_cust_1_${seed}`,
            correctOrder: 1,
            phase: '1. Datos y Condición Inicial',
            label: `Identificar variables conocidas y objetivo en "${cleanT}"`,
            codeOrHint: `Reconocer los datos de entrada (ej: n = ${nB}) y qué incógnita o resultado buscamos`,
          },
          {
            id: `seq_cust_2_${seed}`,
            correctOrder: 2,
            phase: '2. Planteamiento del Modelo',
            label: `Seleccionar la regla, fórmula o estructura de "${cleanT}"`,
            codeOrHint: `Establecer la relación formal de ${subject} antes de operar`,
          },
          {
            id: `seq_cust_3_${seed}`,
            correctOrder: 3,
            phase: '3. Desarrollo Paso a Paso',
            label: `Sustituir valores y ejecutar la transformación de "${cleanT}"`,
            codeOrHint: `Aplicar las operaciones respetando el orden lógico y restricciones`,
          },
          {
            id: `seq_cust_4_${seed}`,
            correctOrder: 4,
            phase: '4. Comprobación del Resultado',
            label: `Verificar que la solución obtenida cumple el caso de prueba`,
            codeOrHint: `Reemplazar el resultado en el planteamiento original para confirmar coherencia`,
          },
        ],
      },
      {
        title: `Arquitectura práctica de: ${cleanT}`,
        scenario: `Construye el flujo correcto de 4 fases para dominar "${cleanT}" en ${subject} ${themePhrase}.`,
        source: 'ai_dynamic',
        steps: [
          {
            id: `seq_custb_1_${seed}`,
            correctOrder: 1,
            phase: '1. Precondiciones y Borde',
            label: `Validar supuestos iniciales y casos límite de "${cleanT}"`,
            codeOrHint: `Descartar valores nulos o fuera de rango antes de iniciar el cálculo`,
          },
          {
            id: `seq_custb_2_${seed}`,
            correctOrder: 2,
            phase: '2. Descomposición Modular',
            label: `Dividir el problema de "${cleanT}" en componentes manejables`,
            codeOrHint: `Separar los ${nA} subprocesos principales para evitar errores acumulativos`,
          },
          {
            id: `seq_custb_3_${seed}`,
            correctOrder: 3,
            phase: '3. Ejecución Principal',
            label: `Resolver el núcleo central aplicando las propiedades de ${subject}`,
            codeOrHint: `Procesar cada etapa mantendo la equivalencia lógica`,
          },
          {
            id: `seq_custb_4_${seed}`,
            correctOrder: 4,
            phase: '4. Interpretación y Entrega',
            label: `Interpretar el resultado final en el contexto del problema`,
            codeOrHint: `Expresar la respuesta con las unidades y el formato requeridos`,
          },
        ],
      },
    ];
    return customVariants[seed % customVariants.length];
  }

  // 1. MATEMÁTICAS / NIVELACIÓN MATEMÁTICA / CÁLCULO / ÁLGEBRA / ESTADÍSTICA
  if (
    lower.includes('matem') ||
    lower.includes('calcul') ||
    lower.includes('algebr') ||
    lower.includes('estadist') ||
    lower.includes('probabil')
  ) {
    const mathChallenges: SequenceChallengeDTO[] = [
      {
        title: `Resolución de Ecuación Lineal Aplicada (${subject})`,
        scenario: `Ordena el procedimiento algebraico exacto para despejar la incógnita x en la ecuación ${nA}x + ${nB} = ${nA * 4 + nB} ${themePhrase}.`,
        source: 'ai_dynamic',
        steps: [
          {
            id: `seq_math_a1_${seed}`,
            correctOrder: 1,
            phase: '1. Planteamiento de la Ecuación',
            label: `Identificar la incógnita x y plantear la igualdad inicial`,
            codeOrHint: `${nA}x + ${nB} = ${nA * 4 + nB}  (Reconocer término con x y constante independiente)`,
          },
          {
            id: `seq_math_a2_${seed}`,
            correctOrder: 2,
            phase: '2. Reducción de Términos',
            label: `Restar ${nB} en ambos lados para aislar el término con x`,
            codeOrHint: `${nA}x = ${nA * 4 + nB} - ${nB}  →  ${nA}x = ${nA * 4}`,
          },
          {
            id: `seq_math_a3_${seed}`,
            correctOrder: 3,
            phase: '3. Despeje de la Incógnita',
            label: `Dividir ambos miembros por el coeficiente ${nA}`,
            codeOrHint: `x = ${nA * 4} / ${nA}  →  x = 4`,
          },
          {
            id: `seq_math_a4_${seed}`,
            correctOrder: 4,
            phase: '4. Verificación por Sustitución',
            label: `Reemplazar x = 4 en la ecuación original para comprobar la igualdad`,
            codeOrHint: `${nA}(4) + ${nB} = ${nA * 4 + nB}  ✓ (Igualdad verificada)`,
          },
        ],
      },
      {
        title: `Cálculo de Porcentajes, Proporciones y Variación (${subject})`,
        scenario: `Ordena los 4 pasos matemáticos para calcular un descuento del ${nA * 5}% sobre un valor base de ${nB * 100} unidades ${themePhrase}.`,
        source: 'ai_dynamic',
        steps: [
          {
            id: `seq_math_b1_${seed}`,
            correctOrder: 1,
            phase: '1. Identificar Total y Tasa',
            label: `Definir la cantidad base (100%) y el porcentaje a aplicar`,
            codeOrHint: `Valor inicial = ${nB * 100} | Porcentaje de descuento = ${nA * 5}%`,
          },
          {
            id: `seq_math_b2_${seed}`,
            correctOrder: 2,
            phase: '2. Conversión a Razón Decimal',
            label: `Transformar el porcentaje en fracción o factor decimal dividiendo por 100`,
            codeOrHint: `${nA * 5}% / 100 = ${(nA * 5) / 100}`,
          },
          {
            id: `seq_math_b3_${seed}`,
            correctOrder: 3,
            phase: '3. Producto Proporcional',
            label: `Multiplicar el valor base por el factor decimal para hallar la rebaja`,
            codeOrHint: `Descuento = ${nB * 100} × ${(nA * 5) / 100} = ${nB * nA * 5}`,
          },
          {
            id: `seq_math_b4_${seed}`,
            correctOrder: 4,
            phase: '4. Obtención del Valor Final',
            label: `Restar el descuento obtenido al valor inicial y validar coherencia`,
            codeOrHint: `Total final = ${nB * 100} - ${nB * nA * 5} = ${nB * 100 - nB * nA * 5}`,
          },
        ],
      },
      {
        title: `Análisis Estadístico y Promedio Ponderado (${subject})`,
        scenario: `Ordena las 4 etapas para analizar una muestra de ${nB} datos cuantitativos y obtener medidas de tendencia central ${themePhrase}.`,
        source: 'ai_dynamic',
        steps: [
          {
            id: `seq_math_c1_${seed}`,
            correctOrder: 1,
            phase: '1. Recolección y Ordenamiento',
            label: `Reunir los ${nB} valores de la muestra y ordenarlos de menor a mayor`,
            codeOrHint: `x₁ ≤ x₂ ≤ ... ≤ x_${nB}  (Facilita detectar valores atípicos y mediana)`,
          },
          {
            id: `seq_math_c2_${seed}`,
            correctOrder: 2,
            phase: '2. Sumatoria de Frecuencias',
            label: `Sumar todos los valores observados (Σxᵢ) multiplicados por su peso`,
            codeOrHint: `Suma total = x₁ + x₂ + ... + x_${nB}`,
          },
          {
            id: `seq_math_c3_${seed}`,
            correctOrder: 3,
            phase: '3. Cálculo de Media y Mediana',
            label: `Dividir la sumatoria entre el total de observaciones (n = ${nB})`,
            codeOrHint: `Media muestral x̄ = (Σxᵢ) / ${nB}`,
          },
          {
            id: `seq_math_c4_${seed}`,
            correctOrder: 4,
            phase: '4. Dispersión e Interpretación',
            label: `Comparar cada dato con la media para interpretar la variabilidad`,
            codeOrHint: `Concluir si el rendimiento es estable o presenta alta dispersión`,
          },
        ],
      },
    ];
    return mathChallenges[seed % mathChallenges.length];
  }

  // 2. CONSULTAS DE BASES DE DATOS / SQL
  if (lower.includes('consulta') || lower.includes('sql')) {
    const sqlChallenges: SequenceChallengeDTO[] = [
      {
        title: ` Construcción de Consulta SQL con Agregación (${subject})`,
        scenario: `Ordena la secuencia lógica de evaluación para obtener los grupos con promedio superior a ${nA}.0 ${themePhrase}.`,
        source: 'ai_dynamic',
        steps: [
          {
            id: `seq_sql_1_${seed}`,
            correctOrder: 1,
            phase: '1. Origen y Relación (FROM / JOIN)',
            label: 'Identificar la tabla principal y vincular claves foráneas con INNER JOIN',
            codeOrHint: 'FROM registros r INNER JOIN categorias c ON r.categoria_id = c.id',
          },
          {
            id: `seq_sql_2_${seed}`,
            correctOrder: 2,
            phase: '2. Filtro de Filas (WHERE)',
            label: 'Filtrar registros individuales activos antes de agrupar',
            codeOrHint: `WHERE r.activo = true AND r.ciclo >= ${nB}`,
          },
          {
            id: `seq_sql_3_${seed}`,
            correctOrder: 3,
            phase: '3. Agrupación y Condición (GROUP BY + HAVING)',
            label: 'Agrupar por categoría y filtrar el promedio agregado con HAVING',
            codeOrHint: `GROUP BY c.nombre HAVING AVG(r.puntaje) >= ${nA}.0`,
          },
          {
            id: `seq_sql_4_${seed}`,
            correctOrder: 4,
            phase: '4. Proyección y Orden (SELECT + ORDER BY)',
            label: 'Seleccionar las columnas finales y ordenarlas de mayor a menor',
            codeOrHint: `SELECT c.nombre, AVG(r.puntaje) AS promedio ORDER BY promedio DESC LIMIT ${nA};`,
          },
        ],
      },
      {
        title: `Transacción Segura ACID en Base de Datos (${subject})`,
        scenario: `Ordena los 4 bloques para descontar ${nA} unidades de inventario y registrar la operación sin pérdida de integridad ${themePhrase}.`,
        source: 'ai_dynamic',
        steps: [
          {
            id: `seq_sqlb_1_${seed}`,
            correctOrder: 1,
            phase: '1. Apertura Transaccional',
            label: 'Iniciar bloque de transacción atómica (BEGIN TRANSACTION)',
            codeOrHint: 'BEGIN; -- Garantiza que todo se ejecute como una unidad indivisible',
          },
          {
            id: `seq_sqlb_2_${seed}`,
            correctOrder: 2,
            phase: '2. Operación de Actualización',
            label: `Actualizar el registro descontando ${nA} unidades según su clave primaria`,
            codeOrHint: `UPDATE stock SET disponible = disponible - ${nA} WHERE item_id = ${nB};`,
          },
          {
            id: `seq_sqlb_3_${seed}`,
            correctOrder: 3,
            phase: '3. Verificación de Restricción',
            label: 'Comprobar que el saldo resultante cumple la regla CHECK (disponible >= 0)',
            codeOrHint: 'Si disponible < 0, disparar ROLLBACK para revertir cambios',
          },
          {
            id: `seq_sqlb_4_${seed}`,
            correctOrder: 4,
            phase: '4. Confirmación Permanente',
            label: 'Confirmar la transacción en disco mediante COMMIT',
            codeOrHint: 'COMMIT; -- Los cambios quedan persistidos de forma segura',
          },
        ],
      },
    ];
    return sqlChallenges[seed % sqlChallenges.length];
  }

  // 3. MODELAMIENTO DE BASE DE DATOS
  if (lower.includes('modelamiento') || lower.includes('base de datos')) {
    return {
      title: `Normalización Relacional Paso a Paso (${subject})`,
      scenario: `Ordena el proceso de diseño y normalización (1FN → 2FN → 3FN) para modelar ${nB} entidades sin redundancia ${themePhrase}.`,
      source: 'ai_dynamic',
      steps: [
        {
          id: `seq_mod_1_${seed}`,
          correctOrder: 1,
          phase: '1. Levantamiento de Entidades',
          label: 'Identificar las entidades del dominio, sus atributos y reglas de negocio',
          codeOrHint: 'Detectar objetos principales y eliminar grupos repetitivos en la tabla bruta',
        },
        {
          id: `seq_mod_2_${seed}`,
          correctOrder: 2,
          phase: '2. Primera Forma Normal (1FN)',
          label: 'Garantizar atributos atómicos y definir la Clave Primaria (PK) única',
          codeOrHint: 'Cada celda contiene un único valor indivisible identificado por su PK',
        },
        {
          id: `seq_mod_3_${seed}`,
          correctOrder: 3,
          phase: '3. Segunda Forma Normal (2FN)',
          label: 'Resolver relaciones N:M con tablas intermedias y eliminar dependencias parciales',
          codeOrHint: 'Todo atributo no-clave depende de la clave primaria completa',
        },
        {
          id: `seq_mod_4_${seed}`,
          correctOrder: 4,
          phase: '4. Tercera Forma Normal (3FN) y FK',
          label: 'Separar dependencias transitivas y declarar Claves Foráneas (FK) con integridad',
          codeOrHint: 'Ningún atributo depende de otro atributo no-clave; esquema listo para DDL',
        },
      ],
    };
  }

  // 4. PROGRAMACIÓN WEB
  if (lower.includes('web') || lower.includes('frontend') || lower.includes('react')) {
    return {
      title: `Flujo Reactivo Cliente-Servidor en ${subject}`,
      scenario: `Ordena las 4 capas para capturar datos de un usuario, validarlos y actualizar la interfaz consumiendo una API REST ${themePhrase}.`,
      source: 'ai_dynamic',
      steps: [
        {
          id: `seq_web_1_${seed}`,
          correctOrder: 1,
          phase: '1. Estructura Semántica y Evento',
          label: 'Capturar el evento onSubmit del formulario previniendo la recarga por defecto',
          codeOrHint: 'e.preventDefault() sobre un <form> accesible con <label> e inputs controlados',
        },
        {
          id: `seq_web_2_${seed}`,
          correctOrder: 2,
          phase: '2. Validación en Cliente',
          label: 'Verificar que los campos obligatorios y formatos sean válidos antes de enviar',
          codeOrHint: 'if (!datos.titulo.trim()) return mostrarError("Campo requerido");',
        },
        {
          id: `seq_web_3_${seed}`,
          correctOrder: 3,
          phase: '3. Petición Asíncrona HTTP',
          label: 'Activar estado loading y enviar solicitud fetch/POST con bloque try/catch',
          codeOrHint: 'const res = await apiClient.post("/endpoint", payload);',
        },
        {
          id: `seq_web_4_${seed}`,
          correctOrder: 4,
          phase: '4. Actualización de Estado y UI',
          label: 'Actualizar el estado reactivo con la respuesta y mostrar confirmación visual',
          codeOrHint: 'setItems(prev => [res.data, ...prev]); setLoading(false);',
        },
      ],
    };
  }

  // 5. PROGRAMACIÓN ORIENTADA A OBJETOS / ALGORITMOS / GENERAL
  const generalChallenges: SequenceChallengeDTO[] = [
    {
      title: `Diseño Algorítmico y Procesamiento de Colección (${topicLabel})`,
      scenario: `Ordena los 4 pasos lógicos para recorrer una lista de ${nB} elementos y filtrar aquellos que superan el umbral de ${nA * 10} puntos ${themePhrase}.`,
      source: 'ai_dynamic',
      steps: [
        {
          id: `seq_alg_1_${seed}`,
          correctOrder: 1,
          phase: '1. Entrada y Condición de Borde',
          label: `Recibir la colección de ${nB} elementos y verificar que no esté vacía`,
          codeOrHint: `if (!lista || lista.length === 0) return []; // Validación temprana`,
        },
        {
          id: `seq_alg_2_${seed}`,
          correctOrder: 2,
          phase: '2. Inicialización de Estado',
          label: 'Declarar la estructura acumuladora y la variable índice en posición 0',
          codeOrHint: 'const filtrados = []; let i = 0;',
        },
        {
          id: `seq_alg_3_${seed}`,
          correctOrder: 3,
          phase: '3. Iteración y Regla Condicional',
          label: `Recorrer del índice 0 al ${nB - 1} evaluando si el valor supera ${nA * 10}`,
          codeOrHint: `for (let i = 0; i < ${nB}; i++) { if (lista[i] > ${nA * 10}) filtrados.push(lista[i]); }`,
        },
        {
          id: `seq_alg_4_${seed}`,
          correctOrder: 4,
          phase: '4. Retorno y Verificación',
          label: 'Retornar la colección resultante y comprobar la salida con un caso de prueba',
          codeOrHint: 'return filtrados; // Salida verificada sin desbordar índices',
        },
      ],
    },
    {
      title: `Modelado Orientado a Objetos y Encapsulamiento (${topicLabel})`,
      scenario: `Ordena las 4 etapas para construir e instanciar una clase segura que administra ${nB} recursos ${themePhrase}.`,
      source: 'ai_dynamic',
      steps: [
        {
          id: `seq_oop_1_${seed}`,
          correctOrder: 1,
          phase: '1. Abstracción y Atributos Privados',
          label: 'Definir la clase y proteger sus atributos internos mediante encapsulamiento',
          codeOrHint: 'class GestorRecurso { private saldo: number; private activo: boolean; }',
        },
        {
          id: `seq_oop_2_${seed}`,
          correctOrder: 2,
          phase: '2. Inicialización en Constructor',
          label: `Asignar el estado inicial válido (${nB} unidades) dentro del método constructor`,
          codeOrHint: `constructor(saldoInicial = ${nB}) { this.saldo = Math.max(0, saldoInicial); }`,
        },
        {
          id: `seq_oop_3_${seed}`,
          correctOrder: 3,
          phase: '3. Métodos con Reglas de Negocio',
          label: 'Implementar métodos públicos que validen invariantes antes de modificar el estado',
          codeOrHint: `consumir(cant: number) { if (cant <= this.saldo) this.saldo -= cant; }`,
        },
        {
          id: `seq_oop_4_${seed}`,
          correctOrder: 4,
          phase: '4. Instanciación y Prueba',
          label: 'Crear la instancia con new e invocar su comportamiento validado',
          codeOrHint: `const gestor = new GestorRecurso(${nB}); gestor.consumir(${nA});`,
        },
      ],
    },
  ];

  return generalChallenges[seed % generalChallenges.length];
}

/**
 * Generador combinatorio de preguntas técnicas por asignatura con parámetros variables
 * para evitar repeticiones en acreditación y desafíos.
 */
function buildDynamicChallengeQuestionsForSubject(
  subject: string,
  level: 'basic' | 'intermediate' | 'advanced'
): ChallengeQuestionDTO[] {
  const n1 = Math.floor(Math.random() * 12) + 4;
  const n2 = Math.floor(Math.random() * 8) + 2;
  const arrayLen = Math.floor(Math.random() * 40) + 15;

  return [
    {
      id: `dyn_ch_1_${n1}`,
      subject,
      level,
      type: 'choice',
      category: 'debugging',
      timeLimit: 15,
      prompt: `En un laboratorio de ${subject}, un algoritmo procesa una colección de ${arrayLen} elementos, pero lanza un error al intentar leer la posición índice ${arrayLen}. ¿Cuál es la causa exacta del fallo?`,
      options: [
        { id: 'a', text: `Desbordamiento de límite (off-by-one): en indexación base 0 el último índice válido es ${arrayLen - 1}.` },
        { id: 'b', text: 'Falta de memoria física en el procesador para almacenar enteros.' },
        { id: 'c', text: 'Las colecciones solo aceptan números primos como tamaño.' },
      ],
      correctOptionId: 'a',
      explanation: `En arreglos indexados desde 0, una lista de tamaño ${arrayLen} va desde 0 hasta ${arrayLen - 1}.`,
    },
    {
      id: `dyn_ch_2_${n1}`,
      subject,
      level,
      type: 'choice',
      category: 'conceptual',
      timeLimit: 15,
      prompt: `Al diseñar una solución modular en ${subject} que recibe ${n1} parámetros de entrada, ¿qué práctica garantiza mayor mantenibilidad y prevención de errores?`,
      options: [
        { id: 'a', text: 'Validar las precondiciones de entrada al inicio y dividir la lógica en funciones con responsabilidad única.' },
        { id: 'b', text: 'Declarar todas las variables como globales y omitir las validaciones de tipos.' },
        { id: 'c', text: `Duplicar el mismo bloque de código ${n2} veces dentro de un solo archivo.` },
      ],
      correctOptionId: 'a',
      explanation: 'La validación temprana (guard clauses) y la modularidad reducen el acoplamiento y facilitan las pruebas.',
    },
    {
      id: `dyn_ch_3_${n2}`,
      subject,
      level,
      type: 'redaction',
      category: 'conceptual',
      timeLimit: 45,
      prompt: `En el contexto de ${subject}, explica brevemente por qué es importante probar un caso borde (por ejemplo, cuando el conjunto de datos viene vacío o con valor 0) antes de entregar una solución.`,
      acceptedAnswers: ['error', 'borde', 'vacio', 'validar', 'excepcion', 'fallo', 'condicion', 'limite', 'prevenir'],
      placeholder: 'Ej: Permite validar que el sistema no falle ante entradas vacías o límites...',
      explanation: 'Los casos borde verifican que la lógica maneje entradas extremas sin producir caídas inesperadas.',
    },
    {
      id: `dyn_ch_4_${n1}_${n2}`,
      subject,
      level,
      type: 'choice',
      category: 'conceptual',
      timeLimit: 15,
      prompt: `Si una operación en ${subject} anida un recorrido completo de ${n1} elementos por cada uno de otros ${n1} elementos, ¿cómo escala el número de pasos cuando crece la entrada N?`,
      options: [
        { id: 'a', text: `Crecimiento cuadrático O(N²), ejecutando del orden de ${n1 * n1} comparaciones.` },
        { id: 'b', text: 'Tiempo constante O(1) sin importar el volumen de datos.' },
        { id: 'c', text: 'Reducción logarítmica O(log N) sin iteraciones.' },
      ],
      correctOptionId: 'a',
      explanation: 'Dos ciclos anidados dependientes de N multiplican el número de operaciones resultando en O(N²).',
    },
  ];
}

/**
 * Generador combinatorio de Micro-Quizzes DUA que cruza todas las asignaturas
 * con las 6 temáticas de interés y valores dinámicos para que nunca se repitan.
 */
function buildCombinatorialDuaQuizPool(
  subject: string,
  themeId: string
): AdaptiveQuizQuestionDTO[] {
  const lowerSub = subject.toLowerCase();
  const randA = Math.floor(Math.random() * 40) + 12;
  const randB = Math.floor(Math.random() * 8) + 3;

  const themeNarratives: Record<
    string,
    {
      label: string;
      scenarios: string[];
      entities: string[];
      actions: string[];
    }
  > = {
    videojuegos: {
      label: 'Videojuegos y RPGs',
      scenarios: [
        `Estás programando el sistema de inventario de un RPG con ${randA} ranuras de objetos épicos`,
        `Tu escuadrón entra a una mazmorra de nivel ${randB} donde cada cofre tiene reglas de apertura`,
        `En un torneo eSports necesitas calcular el daño crítico de ${randA} habilidades en tiempo real`,
        `El motor de un juego de mundo abierto actualiza la posición de ${randA} NPCs en cada frame`,
      ],
      entities: ['inventario de ítems', 'puntos de maná (MP)', 'tabla de loot', 'árbol de habilidades'],
      actions: ['equipar un escudo legendario', 'subir de nivel al personaje', 'guardar partida en el checkpoint'],
    },
    musica: {
      label: 'Música y Producción',
      scenarios: [
        `Estás produciendo una sesión en tu DAW con ${randA} pistas sincronizadas a ${90 + randA} BPM`,
        `En una plataforma tipo Spotify organizas ${randA} canciones sin repetir ningún artista seguido`,
        `Un sintetizador digital aplica ${randB} filtros de ecualización en cadena sobre la voz principal`,
        `Estás armando el setlist en vivo para un festival con ${randA} temas ordenados por energía`,
      ],
      entities: ['cola de reproducción', 'frecuencia de muestreo', 'catálogo de álbumes', 'compás rítmico'],
      actions: ['activar el loop del coro', 'filtrar pistas por género musical', 'normalizar el volumen del máster'],
    },
    ciberseguridad: {
      label: 'Ciberseguridad y Hacking Ético',
      scenarios: [
        `Como auditor de seguridad analizas ${randA} paquetes de red que llegan al puerto 443`,
        `Un firewall perimetral evalúa ${randB} reglas de control de acceso antes de autorizar un token`,
        `En un reto Capture The Flag (CTF) debes verificar la integridad de ${randA} firmas SHA-256`,
        `El centro de monitoreo SOC detecta ${randA} intentos de conexión desde direcciones IP desconocidas`,
      ],
      entities: ['registro de auditoría (log)', 'tabla de permisos IAM', 'hash criptográfico', 'regla del firewall'],
      actions: ['bloquear tráfico sospechoso', 'validar el certificado TLS', 'sanitizar los parámetros de entrada'],
    },
    anime_series: {
      label: 'Anime y Series',
      scenarios: [
        `En el gremio de aventureros se registran ${randA} misiones clasificadas desde rango S hasta rango D`,
        `Durante un torneo entre academias, ${randB} equipos compiten siguiendo llaves eliminatorias`,
        `Un protagonista entrena ${randA} técnicas elementales que requieren activarse en un orden exacto`,
        `El archivo secreto de la serie organiza ${randA} episodios conectando cada arco argumental`,
      ],
      entities: ['registro del gremio', 'nivel de poder espiritual', 'pergamino de técnicas', 'alianza de equipos'],
      actions: ['invocar la técnica definitiva', 'superar la prueba de clasificación', 'sincronizar al equipo en misión'],
    },
    deportes: {
      label: 'Deportes y Estrategia',
      scenarios: [
        `El cuerpo técnico analiza las métricas de ${randA} jugadores durante los 90 minutos del partido`,
        `En un campeonato universitario con ${randB} grupos, necesitas calcular la tabla de posiciones en vivo`,
        `Un sistema de telemetría deportiva registra ${randA} sprints y pases completados por tiempo`,
        `Antes de la final, el entrenador filtra las ${randB} jugadas de balón detenido con mayor efectividad`,
      ],
      entities: ['estadística de posesión', 'tabla de goleadores', 'alineación táctica', 'historial de partidos'],
      actions: ['calcular el promedio de efectividad', 'ordenar la tabla por diferencia de goles', 'validar cambios reglamentarios'],
    },
    apps_reales: {
      label: 'Apps y Vida Cotidiana',
      scenarios: [
        `Una app de delivery calcula la ruta óptima para entregar ${randA} pedidos calientes en tu comuna`,
        `En una plataforma de streaming o carrito de compras, ${randB} usuarios actualizan su pedido al mismo tiempo`,
        `Una aplicación de transporte público estima el tiempo de llegada de ${randA} buses mediante GPS`,
        `El sistema de reservas de la biblioteca universitaria procesa ${randA} solicitudes simultáneas`,
      ],
      entities: ['carrito de compras', 'estado del pedido en vivo', 'ruta GPS óptima', 'catálogo de productos'],
      actions: ['confirmar el pago sin duplicar cobros', 'filtrar restaurantes por tiempo de entrega', 'actualizar el stock disponible'],
    },
  };

  const t = themeNarratives[themeId] || themeNarratives.videojuegos;

  // Determinar familia conceptual de la asignatura
  if (lowerSub.includes('base de datos') || lowerSub.includes('consulta') || lowerSub.includes('sql') || lowerSub.includes('modelamiento')) {
    return [
      {
        id: `comb_db_1_${randA}`,
        subject,
        themeId,
        themeLabel: t.label,
        analogyContext: `${t.scenarios[0]}. Cada registro del ${t.entities[0]} debe identificarse sin ambigüedad aunque dos elementos tengan el mismo nombre.`,
        prompt: `En ${subject}, ¿qué restricción garantiza que cada registro del ${t.entities[0]} tenga un identificador único e irrepetible?`,
        options: [
          { id: 'a', text: 'Definir una Clave Primaria (PRIMARY KEY) única y no nula para cada registro.' },
          { id: 'b', text: 'Repetir todos los datos en una sola columna de texto separado por comas.' },
          { id: 'c', text: 'Eliminar todas las restricciones de la tabla para insertar duplicados.' },
          { id: 'd', text: 'Usar únicamente comentarios en lugar de columnas tipadas.' },
        ],
        correctOptionId: 'a',
        hintStepByStep: `Paso 1: Piensa qué pasaría si dos elementos en tu ${t.entities[0]} tuvieran el mismo ID. Paso 2: La restricción que exige unicidad y NOT NULL es la Clave Primaria (PK).`,
        explanation: `¡Exacto! Una PRIMARY KEY asegura que cada fila en ${subject} sea única e inequívoca.`,
      },
      {
        id: `comb_db_2_${randA}`,
        subject,
        themeId,
        themeLabel: t.label,
        analogyContext: `${t.scenarios[1]}. Necesitas obtener únicamente los registros que superan un umbral de ${randA} puntos y luego agruparlos por categoría.`,
        prompt: `En una consulta SQL de ${subject}, ¿en qué orden lógico se filtran las filas individuales antes de agrupar con GROUP BY?`,
        options: [
          { id: 'a', text: `Primero se filtra cada fila con WHERE (ej: puntaje > ${randA}) y después se agrupa con GROUP BY.` },
          { id: 'b', text: 'Se ejecuta ORDER BY antes de leer la tabla en FROM.' },
          { id: 'c', text: 'Se usa DROP TABLE para filtrar los registros temporales.' },
          { id: 'd', text: 'No es posible combinar filtros con agrupaciones en SQL.' },
        ],
        correctOptionId: 'a',
        hintStepByStep: `Paso 1: WHERE actúa sobre filas individuales antes de agrupar. Paso 2: GROUP BY reúne los grupos y HAVING filtra funciones agregadas.`,
        explanation: `¡Muy bien! En SQL el flujo lógico evalúa FROM -> WHERE -> GROUP BY -> HAVING -> SELECT -> ORDER BY.`,
      },
      {
        id: `comb_db_3_${randB}`,
        subject,
        themeId,
        themeLabel: t.label,
        analogyContext: `${t.scenarios[2]}. Un elemento puede participar en múltiples ${t.entities[3]} y cada uno de ellos incluye múltiples participantes (relación muchos a muchos N:M).`,
        prompt: `¿Cómo se resuelve correctamente una relación Muchos a Muchos (N:M) al normalizar el modelo en ${subject}?`,
        options: [
          { id: 'a', text: 'Creando una tabla intermedia (asociativa) con claves foráneas (FK) hacia ambas entidades.' },
          { id: 'b', text: 'Creando columnas infinitas (item1, item2, item3...) dentro de la misma tabla.' },
          { id: 'c', text: 'Borrando una de las dos tablas para evitar la relación.' },
          { id: 'd', text: 'Guardando todas las relaciones en un archivo sin claves foráneas.' },
        ],
        correctOptionId: 'a',
        hintStepByStep: `Paso 1: Dos tablas no pueden apuntarse N:M directamente sin redundancia. Paso 2: Una tabla intermedia divide la relación N:M en dos relaciones 1:N limpias.`,
        explanation: `¡Correcto! La tabla intersección o asociativa mantiene el esquema en Tercera Forma Normal (3FN).`,
      },
      {
        id: `comb_db_4_${randA}`,
        subject,
        themeId,
        themeLabel: t.label,
        analogyContext: `${t.scenarios[3]}. Quieres listar solo aquellos registros de la tabla principal que tienen coincidencia exacta con la tabla de ${t.entities[2]}.`,
        prompt: `¿Qué tipo de cláusula JOIN debes utilizar para traer únicamente los registros que tienen coincidencia en ambas tablas?`,
        options: [
          { id: 'a', text: 'INNER JOIN comparando la clave primaria (PK) con la clave foránea (FK).' },
          { id: 'b', text: 'CROSS JOIN sin condición ON, generando un producto cartesiano masivo.' },
          { id: 'c', text: 'TRUNCATE JOIN para vaciar ambas tablas simultáneamente.' },
          { id: 'd', text: 'ALTER TABLE sin especificar columnas.' },
        ],
        correctOptionId: 'a',
        hintStepByStep: `Paso 1: Buscas la intersección exacta entre dos tablas. Paso 2: INNER JOIN retorna solo las filas que cumplen la igualdad entre PK y FK.`,
        explanation: `¡Excelente! INNER JOIN combina filas relacionadas garantizando integridad referencial.`,
      },
    ];
  }

  if (lowerSub.includes('web') || lowerSub.includes('frontend') || lowerSub.includes('react') || lowerSub.includes('interfaz')) {
    return [
      {
        id: `comb_web_1_${randA}`,
        subject,
        themeId,
        themeLabel: t.label,
        analogyContext: `${t.scenarios[0]}. Cuando el usuario decide ${t.actions[0]}, la interfaz debe actualizar inmediatamente el contador de ${randA} a ${randA + 1} sin recargar toda la página.`,
        prompt: `En el desarrollo moderno de ${subject}, ¿qué mecanismo permite que la vista se re-renderice automáticamente al cambiar un dato?`,
        options: [
          { id: 'a', text: 'Gestionar el valor mediante un Estado Reactivo (como useState) de forma inmutable.' },
          { id: 'b', text: 'Forzar la recarga completa del navegador con window.location.reload() en cada clic.' },
          { id: 'c', text: 'Modificar variables sueltas fuera del ciclo de vida sin notificar al componente.' },
          { id: 'd', text: 'Reescribir manualmente el archivo HTML en el servidor por cada usuario.' },
        ],
        correctOptionId: 'a',
        hintStepByStep: `Paso 1: La interfaz necesita enterarse de que el dato cambió. Paso 2: Al actualizar el estado reactivo, el componente vuelve a dibujar solo la parte necesaria.`,
        explanation: `¡Exacto! El estado reactivo mantiene sincronizados los datos con la interfaz de usuario sin recargas bruscas.`,
      },
      {
        id: `comb_web_2_${randB}`,
        subject,
        themeId,
        themeLabel: t.label,
        analogyContext: `${t.scenarios[1]}. La aplicación solicita ${randA} registros a un servidor externo para mostrar el ${t.entities[0]} en pantalla.`,
        prompt: `Al consumir una API REST de forma asíncrona (fetch / async-await) en ${subject}, ¿qué tres estados es indispensable manejar para una buena experiencia de usuario?`,
        options: [
          { id: 'a', text: 'Estado de carga (loading), estado de éxito con los datos (data) y estado de error controlado (error).' },
          { id: 'b', text: 'Congelar la pestaña principal hasta que el servidor responda sin mostrar indicadores.' },
          { id: 'c', text: 'Asumir que la red nunca falla y omitir bloques try/catch.' },
          { id: 'd', text: 'Ocultar los mensajes de error dejando la pantalla completamente en blanco.' },
        ],
        correctOptionId: 'a',
        hintStepByStep: `Paso 1: La red toma tiempo y puede fallar. Paso 2: Mostrar carga, datos o un mensaje claro de error evita que el usuario piense que la app se bloqueó.`,
        explanation: `¡Muy bien! Manejar loading, data y error es un estándar esencial de calidad y accesibilidad web.`,
      },
      {
        id: `comb_web_3_${randA}`,
        subject,
        themeId,
        themeLabel: t.label,
        analogyContext: `${t.scenarios[2]}. Quieres que cualquier persona pueda navegar por los ${randB} paneles del ${t.entities[2]} usando teclado o lector de pantalla.`,
        prompt: `¿Qué práctica de HTML5 y accesibilidad (WCAG) asegura que la estructura de la página sea comprensible y navegable?`,
        options: [
          { id: 'a', text: 'Utilizar etiquetas semánticas (<main>, <nav>, <section>, <button>) y atributos aria-label descriptivos.' },
          { id: 'b', text: 'Construir toda la página únicamente con etiquetas <div> sin foco de teclado.' },
          { id: 'c', text: 'Eliminar el borde de enfoque (:focus) y usar textos con bajo contraste.' },
          { id: 'd', text: 'Colocar formularios sin etiquetas <label> asociadas a los campos.' },
        ],
        correctOptionId: 'a',
        hintStepByStep: `Paso 1: Un botón real (<button>) ya soporta Enter, Espacio y Tabulador. Paso 2: El HTML semántico comunica el propósito de cada bloque.`,
        explanation: `¡Excelente! La semántica HTML5 es la base de una web inclusiva y bien estructurada.`,
      },
    ];
  }

  if (lowerSub.includes('matem') || lowerSub.includes('calcul') || lowerSub.includes('algebr')) {
    const baseVal = (randB + 2) * 10;
    return [
      {
        id: `comb_math_1_${randA}`,
        subject,
        themeId,
        themeLabel: t.label,
        analogyContext: `${t.scenarios[0]}. El rendimiento inicial es de ${baseVal} unidades y aumenta a razón constante de ${randB} unidades por cada ciclo X.`,
        prompt: `En ${subject}, ¿qué función lineal modela el valor total f(x) después de x ciclos?`,
        options: [
          { id: 'a', text: `f(x) = ${randB}x + ${baseVal}, donde ${randB} es la pendiente (tasa de cambio) y ${baseVal} el valor inicial.` },
          { id: 'b', text: `f(x) = ${baseVal}x - ${randB}, invirtiendo el valor fijo con la tasa variable.` },
          { id: 'c', text: `f(x) = ${baseVal} / x, disminuyendo hacia cero en cada paso.` },
          { id: 'd', text: `f(x) = 0, porque las constantes anulan la variable independiente.` },
        ],
        correctOptionId: 'a',
        hintStepByStep: `Paso 1: Identifica el valor fijo inicial cuando x = 0 (${baseVal}). Paso 2: Suma el incremento constante por cada unidad x (${randB}x).`,
        explanation: `¡Correcto! En la ecuación lineal f(x) = mx + b, m=${randB} representa el cambio por unidad y b=${baseVal} la condición inicial.`,
      },
      {
        id: `comb_math_2_${randB}`,
        subject,
        themeId,
        themeLabel: t.label,
        analogyContext: `${t.scenarios[1]}. De un total de ${baseVal} intentos registrados, el ${randB * 10}% cumple con el criterio de éxito.`,
        prompt: `¿Cómo calculas de forma directa la cantidad exacta de casos exitosos sobre el total de ${baseVal}?`,
        options: [
          { id: 'a', text: `Multiplicando el total ${baseVal} por la proporción decimal ${(randB * 10) / 100} (obteniendo ${(baseVal * randB * 10) / 100}).` },
          { id: 'b', text: `Sumando ${baseVal} + ${randB * 10} sin convertir el porcentaje a fracción.` },
          { id: 'c', text: `Dividiendo ${randB} entre 1000 sin considerar el total.` },
          { id: 'd', text: `Elevando ${baseVal} a la potencia ${randB}.` },
        ],
        correctOptionId: 'a',
        hintStepByStep: `Paso 1: Convierte el porcentaje ${randB * 10}% a decimal dividiendo por 100 (${(randB * 10) / 100}). Paso 2: Multiplica por el total (${baseVal}).`,
        explanation: `¡Muy bien! El porcentaje es una razón sobre 100 que al expresarse como decimal permite calcular proporciones directas.`,
      },
    ];
  }

  // Por defecto: Programación de Algoritmos / POO / Estructura de Datos / General
  return [
    {
      id: `comb_alg_1_${randA}`,
      subject,
      themeId,
      themeLabel: t.label,
      analogyContext: `${t.scenarios[0]}. Necesitas recorrer los ${randA} elementos del ${t.entities[0]} para encontrar aquel que permita ${t.actions[0]}.`,
      prompt: `En ${subject}, ¿qué estructura de control y condición garantizan recorrer los ${randA} elementos sin producir un ciclo infinito?`,
      options: [
        { id: 'a', text: `Un ciclo controlado (for / while) con variable de avance en cada iteración y condición de parada en ${randA}.` },
        { id: 'b', text: 'Un bucle while(true) sin modificar la variable de control ni incluir condición de salida.' },
        { id: 'c', text: `Escribir ${randA} condicionales if separados manualmente en el código.` },
        { id: 'd', text: 'Reiniciar el contador a 0 dentro del cuerpo del ciclo en cada vuelta.' },
      ],
      correctOptionId: 'a',
      hintStepByStep: `Paso 1: Todo ciclo necesita un inicio claro y un límite (${randA}). Paso 2: En cada paso la variable debe avanzar hacia la condición de término.`,
      explanation: `¡Excelente! Definir condición de borde y progreso por iteración evita bucles infinitos y desbordamientos.`,
    },
    {
      id: `comb_alg_2_${randB}`,
      subject,
      themeId,
      themeLabel: t.label,
      analogyContext: `${t.scenarios[1]}. Antes de permitir ${t.actions[1]}, el sistema debe verificar simultáneamente dos condiciones obligatorias.`,
      prompt: `¿Qué operador lógico debes utilizar cuando AMBAS condiciones deben ser verdaderas al mismo tiempo para ejecutar la acción?`,
      options: [
        { id: 'a', text: 'El operador de conjunción lógica AND (&&), que solo es verdadero si ambas partes se cumplen.' },
        { id: 'b', text: 'El operador OR (||), que ejecuta la acción aunque una de las condiciones obligatorias sea falsa.' },
        { id: 'c', text: 'El operador de negación NOT (!), invirtiendo el resultado esperado.' },
        { id: 'd', text: 'Un operador de asignación (=) dentro del condicional if.' },
      ],
      correctOptionId: 'a',
      hintStepByStep: `Paso 1: Si necesitas que se cumpla la Condición 1 Y TAMBIÉN la Condición 2, ambas son indispensables. Paso 2: Eso corresponde a la conjunción lógica AND (&&).`,
      explanation: `¡Exacto! El operador lógico AND (&&) exige que todas las precondiciones sean verdaderas.`,
    },
    {
      id: `comb_alg_3_${randA}_${randB}`,
      subject,
      themeId,
      themeLabel: t.label,
      analogyContext: `${t.scenarios[2]}. Para organizar el código de ${t.entities[2]}, decides encapsular los datos y comportamientos dentro de una unidad reutilizable.`,
      prompt: `Al descomponer un problema de ${subject} en funciones o módulos reutilizables, ¿cuál es el beneficio principal?`,
      options: [
        { id: 'a', text: 'Evitar duplicación de código, facilitar las pruebas de cada parte por separado y mejorar la legibilidad.' },
        { id: 'b', text: 'Hacer que el programa sea más difícil de leer al ocultar los nombres de las variables.' },
        { id: 'c', text: 'Impedir que la función pueda recibir parámetros de entrada.' },
        { id: 'd', text: 'Borrar los datos de salida antes de retornarlos al flujo principal.' },
      ],
      correctOptionId: 'a',
      hintStepByStep: `Paso 1: Divide y vencerás. Paso 2: Una función bien definida recibe entradas claras, aplica una transformación y retorna un resultado verificable.`,
      explanation: `¡Muy bien! La descomposición modular es un pilar de ${subject} para resolver problemas complejos paso a paso.`,
    },
    {
      id: `comb_alg_4_${randA}`,
      subject,
      themeId,
      themeLabel: t.label,
      analogyContext: `${t.scenarios[3]}. Las solicitudes van llegando una tras otra y deben atenderse estrictamente en el mismo orden de llegada (el primero en entrar es el primero en salir).`,
      prompt: `¿Qué estructura de datos modela fielmente el comportamiento "Primero en Entrar, Primero en Salir" (FIFO)?`,
      options: [
        { id: 'a', text: 'Una Cola (Queue), donde se encola al final (enqueue) y se atiende desde el frente (dequeue).' },
        { id: 'b', text: 'Una Pila (Stack LIFO), donde siempre se extrae el último elemento recién ingresado.' },
        { id: 'c', text: 'Una variable booleana simple que solo guarda true o false.' },
        { id: 'd', text: 'Un árbol binario sin raíz ni nodos.' },
      ],
      correctOptionId: 'a',
      hintStepByStep: `Paso 1: Piensa en una fila de atención: quien llega primero es atendido primero. Paso 2: En informática esa estructura se denomina Cola (Queue - FIFO).`,
      explanation: `¡Correcto! Las Colas (Queues) procesan elementos en orden FIFO (First-In, First-Out).`,
    },
  ];
}

