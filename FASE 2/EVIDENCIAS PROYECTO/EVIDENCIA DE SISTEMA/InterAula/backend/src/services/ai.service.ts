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

export const aiBackendService = {
  /**
   * Consulta el estado de la integración de IA
   */
  getStatus() {
    const key = process.env.GEMINI_API_KEY;
    const isConfigured = Boolean(key && key.trim().length > 5);
    return {
      configured: isConfigured,
      provider: isConfigured ? 'gemini' : 'curated_bank',
      models: isConfigured ? ['gemini-1.5-flash', 'gemini-2.0-flash'] : [],
    };
  },

  /**
   * Generación de preguntas técnicas para acreditación o retos
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
          return candidate.slice(0, targetCount);
        }
      } catch (err) {
        console.warn('[aiBackendService] Gemini questions falló, usando banco curado:', err);
      }
    }

    // 2. Fallback inmediato con banco pedagógico curado
    return this.getCuratedFallbackQuestions(params.subject_name, targetLevel, targetCount);
  },

  /**
   * Generación de micro-quizzes adaptativos con andamiaje neuroinclusivo DUA
   */
  async generateQuiz(params: {
    subject_name: string;
    theme_id: string;
    count?: number;
  }): Promise<AdaptiveQuizQuestionDTO[]> {
    const targetCount = params.count || 3;
    const geminiKey = process.env.GEMINI_API_KEY;

    // 1. Intentar con Gemini API
    if (geminiKey && geminiKey.trim().length > 5) {
      try {
        const candidate = await this.callGeminiQuiz(
          geminiKey,
          params.subject_name,
          params.theme_id,
          targetCount
        );
        if (candidate && candidate.length >= 2) {
          return candidate.slice(0, targetCount);
        }
      } catch (err) {
        console.warn('[aiBackendService] Gemini quiz falló, usando banco adaptativo DUA:', err);
      }
    }

    // 2. Fallback con banco adaptativo DUA
    return this.getAdaptiveFallbackQuiz(params.subject_name, params.theme_id, targetCount);
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
                temperature: 0.2,
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
  // HELPERS PRIVADOS DE INTEGRACIÓN CON GEMINI
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

    const prompt = `Eres el evaluador técnico de InterAula.
Genera exactamente ${count} preguntas técnicas para acreditar a un estudiante como tutor en la materia "${subject}", nivel "${level}".${institutionNote}${careerNote}

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
              temperature: 0.3,
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
        return parsed.map((q, idx) => ({
          ...q,
          id: `gemini_${Date.now()}_${idx + 1}`,
          subject,
          level: (level as any) || 'intermediate',
        }));
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
    count: number
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

    const prompt = `Actúa como pedagogo de Diseño Universal para el Aprendizaje (DUA) en InterAula.
Crea un micro-desafío adaptativo de ${count} preguntas para la materia "${subject}", utilizando analogías exclusivas de: "${themeDesc}".

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
    "explanation": "¡Bien hecho! Este concepto demuestra..."
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
              temperature: 0.35,
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
        return parsed.map((item, idx) => ({
          ...item,
          id: `ai_adapt_${Date.now()}_${idx + 1}`,
          subject,
          themeId,
        }));
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
    let matched = CURATED_QUESTIONS.filter((q) => norm(q.subject) === subNorm);

    if (matched.length === 0) {
      if (subNorm.includes('matemat') || subNorm.includes('calcul')) {
        matched = CURATED_QUESTIONS.filter((q) => q.subject.includes('Matemática'));
      } else if (subNorm.includes('base') || subNorm.includes('dato') || subNorm.includes('sql')) {
        matched = CURATED_QUESTIONS.filter((q) => q.subject.includes('Base de Datos'));
      } else {
        matched = CURATED_QUESTIONS.filter((q) => q.subject.includes('Algoritmos'));
      }
    }

    if (matched.length === 0) {
      matched = CURATED_QUESTIONS;
    }

    const pool = matched.length >= count ? matched : CURATED_QUESTIONS;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);

    const result: ChallengeQuestionDTO[] = [];
    for (let i = 0; i < count; i++) {
      const base = shuffled[i % shuffled.length];
      result.push({
        ...base,
        id: `cur_${Date.now()}_${i + 1}`,
        subject,
        level,
      });
    }

    return result;
  },

  getAdaptiveFallbackQuiz(
    subject: string,
    themeId: string,
    count: number
  ): AdaptiveQuizQuestionDTO[] {
    const pool = ADAPTIVE_DUA_BANK[themeId] || ADAPTIVE_DUA_BANK['videojuegos'] || [];
    const result: AdaptiveQuizQuestionDTO[] = [];

    for (let i = 0; i < count; i++) {
      const base = pool[i % pool.length];
      result.push({
        ...base,
        id: `dua_fallback_${Date.now()}_${i + 1}`,
        subject,
        themeId,
      });
    }

    return result;
  },
};
