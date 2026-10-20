/**
 * adaptiveQuiz.service.ts
 * Motor de Quizzes Adaptativos Neuroinclusivos basados en DUA (Diseño Universal para el Aprendizaje).
 * Cruza las materias prioritarias del estudiante con sus intereses/pasiones (videojuegos, música, series, etc.)
 * utilizando IA (Google Gemini) y un banco pedagógico con andamiaje cognitivo (scaffolding).
 */

import { callGeminiApiWithFallback } from './geminiAiService';

export interface InterestTheme {
  id: string;
  name: string;
  emoji: string;
  description: string;
  color: string;
}

export const INTEREST_THEMES: InterestTheme[] = [
  {
    id: 'videojuegos',
    name: 'Videojuegos y RPGs',
    emoji: '🎮',
    description: 'Inventarios de Minecraft, stats de Pokémon, mecánicas de RPG y servidores online.',
    color: '#8b5cf6',
  },
  {
    id: 'musica',
    name: 'Música y Streaming',
    emoji: '🎵',
    description: 'Playlists de Spotify, sintetizadores, tempos, conciertos y producción musical.',
    color: '#ec4899',
  },
  {
    id: 'ciberseguridad',
    name: 'Ciberseguridad y Hackers',
    emoji: '🛡️',
    description: 'Misiones de intrusión ética, firewalls, contraseñas hash y llaves maestras.',
    color: '#06b6d4',
  },
  {
    id: 'anime_series',
    name: 'Anime, Cine y Series',
    emoji: '🎬',
    description: 'Misiones de héroes, gremios de aventureros, sagas de ciencia ficción y tramas épicas.',
    color: '#f59e0b',
  },
  {
    id: 'deportes',
    name: 'Deportes y Estrategia',
    emoji: '⚽',
    description: 'Ligas de fútbol, estadísticas de jugadores, torneos eliminatorios y jugadas tácticas.',
    color: '#10b981',
  },
  {
    id: 'apps_reales',
    name: 'Apps y Vida Cotidiana',
    emoji: '📱',
    description: 'Pedidos de comida rápida tipo PedidosYa, rutas de GPS y publicaciones en redes.',
    color: '#3b82f6',
  },
];

export interface AdaptiveQuizQuestion {
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

// Banco de preguntas de reserva de alta fidelidad pedagógica por temática
const OFFLINE_ADAPTIVE_BANK: Record<string, Record<string, AdaptiveQuizQuestion[]>> = {
  'Programación de Algoritmos': {
    videojuegos: [
      {
        id: 'algo_vj_1',
        subject: 'Programación de Algoritmos',
        themeId: 'videojuegos',
        themeLabel: 'Videojuegos y RPGs',
        analogyContext: 'En Minecraft, el inventario de un cofre tiene una cantidad fija de 27 casillas numeradas desde 0 hasta 26.',
        prompt: '¿Qué estructura de datos representa de forma idéntica este cofre con acceso inmediato a cualquier casilla usando su posición numérica?',
        options: [
          { id: 'a', text: 'Un Arreglo (Array) unidimensional con índices numéricos.' },
          { id: 'b', text: 'Un bucle while infinito.' },
          { id: 'c', text: 'Una variable booleana simple.' },
          { id: 'd', text: 'Un archivo de texto externo sin índice.' },
        ],
        correctOptionId: 'a',
        hintStepByStep: 'Paso 1: Recuerda que un cofre agrupa varios elementos del mismo tipo de forma contigua.\nPaso 2: Accedes directamente a la casilla diciendo "casilla 0", "casilla 1", etc.',
        explanation: '¡Excelente deducción! Un Array es una colección de elementos contiguos donde accedes en tiempo inmediato O(1) usando su índice (como abrir directamente la casilla [4] del cofre).',
      },
      {
        id: 'algo_vj_2',
        subject: 'Programación de Algoritmos',
        themeId: 'videojuegos',
        themeLabel: 'Videojuegos y RPGs',
        analogyContext: 'En un juego de rol, tu personaje debe atacar a un jefe hasta que los Puntos de Vida (HP) del jefe lleguen a 0 o menos.',
        prompt: '¿Qué tipo de estructura de repetición es la más adecuada cuando NO sabes exactamente cuántos golpes tomará derrotarlo?',
        codeSnippet: 'while (jefe.hp > 0) {\n  personaje.atacar(jefe);\n}',
        options: [
          { id: 'a', text: 'Un bucle "for" con 10 repeticiones fijas sin importar la vida del jefe.' },
          { id: 'b', text: 'Un bucle "while" que evalúa la condición de que la vida sea mayor a 0 en cada turno.' },
          { id: 'c', text: 'Una sentencia "return" inmediata que cierra el juego.' },
          { id: 'd', text: 'Un operador ternario para definir el color de la armadura.' },
        ],
        correctOptionId: 'b',
        hintStepByStep: 'Paso 1: Si no sabes de antemano el número de golpes (por golpes críticos o fallos), necesitas evaluar una condición continua.\nPaso 2: ¿Qué bucle sigue ejecutándose "mientras" la condición sea verdadera?',
        explanation: '¡Exacto! El bucle `while` es ideal para situaciones donde la detención depende de una condición dinámica (mientras el jefe tenga vida) y no de un conteo rígido predeterminado.',
      },
      {
        id: 'algo_vj_3',
        subject: 'Programación de Algoritmos',
        themeId: 'videojuegos',
        themeLabel: 'Videojuegos y RPGs',
        analogyContext: 'En Pokémon, para calcular el daño final se multiplican el ataque del Pokémon, la defensa del rival y el multiplicador de tipo.',
        prompt: 'Si necesitas encapsular este cálculo para reutilizarlo en cada batalla sin repetir las 20 líneas de código cada vez, ¿qué debes crear?',
        options: [
          { id: 'a', text: 'Una Función o Método (ej: calcularDanio(atk, def, tipo)) con parámetros y retorno.' },
          { id: 'b', text: 'Copiar y pegar el bloque de código 100 veces en cada archivo del juego.' },
          { id: 'c', text: 'Un arreglo vacío sin elementos.' },
          { id: 'd', text: 'Un comentario de una sola línea // daño.' },
        ],
        correctOptionId: 'a',
        hintStepByStep: 'Paso 1: El principio DRY (Don\'t Repeat Yourself) busca empaquetar lógica repetible.\nPaso 2: Una función recibe datos de entrada (parámetros) y devuelve un resultado.',
        explanation: '¡Brillante! Una función modulariza la lógica, evita errores por duplicación y permite calcular el daño de cualquier criatura llamándola limpiamente.',
      },
    ],
    musica: [
      {
        id: 'algo_mus_1',
        subject: 'Programación de Algoritmos',
        themeId: 'musica',
        themeLabel: 'Música y Streaming',
        analogyContext: 'En Spotify, la cola de reproducción "Reproducir a continuación" reproduce primero la primera canción que agregaste.',
        prompt: '¿Qué estructura de datos lineal representa este comportamiento FIFO (First In, First Out / El primero en entrar es el primero en salir)?',
        options: [
          { id: 'a', text: 'Una Cola (Queue).' },
          { id: 'b', text: 'Una Pila (Stack) de platos.' },
          { id: 'c', text: 'Una matriz tridimensional de audio.' },
          { id: 'd', text: 'Un número flotante constante.' },
        ],
        correctOptionId: 'a',
        hintStepByStep: 'Paso 1: Piensa en la fila de un concierto o una cola de canciones.\nPaso 2: La primera canción que solicitaste es la primera que sonará.',
        explanation: '¡Muy bien! Una Cola (Queue) sigue el principio FIFO: la primera canción encolada es la primera en reproducirse.',
      },
      {
        id: 'algo_mus_2',
        subject: 'Programación de Algoritmos',
        themeId: 'musica',
        themeLabel: 'Música y Streaming',
        analogyContext: 'Quieres aplicar un efecto de filtro acústico a cada uno de los 12 tracks de un álbum de estudio.',
        prompt: 'Si conoces de antemano la cantidad exacta de pistas (12), ¿cuál es la estructura de bucle más limpia para recorrer del track 0 al 11?',
        codeSnippet: 'for (let i = 0; i < 12; i++) {\n  aplicarFiltro(album[i]);\n}',
        options: [
          { id: 'a', text: 'Un bucle "for" con un contador inicializado en 0 hasta el tamaño del álbum.' },
          { id: 'b', text: 'Un switch-case con 50 casos.' },
          { id: 'c', text: 'Llamar a consola sin ejecutar código.' },
          { id: 'd', text: 'Crear 12 variables distintas sin bucles.' },
        ],
        correctOptionId: 'a',
        hintStepByStep: 'Paso 1: Conoces la longitud exacta de elementos.\nPaso 2: Un ciclo `for` gestiona el inicio, la condición de tope y el incremento en una sola línea.',
        explanation: '¡Correcto! El bucle `for` es la herramienta idónea para iterar colecciones cuando el tamaño es conocido o medible a través de `.length`.',
      },
    ],
    ciberseguridad: [
      {
        id: 'algo_cib_1',
        subject: 'Programación de Algoritmos',
        themeId: 'ciberseguridad',
        themeLabel: 'Ciberseguridad y Hackers',
        analogyContext: 'Un sistema de autenticación bancaria solo permite 3 intentos fallidos de clave antes de bloquear la cuenta por seguridad.',
        prompt: '¿Cómo modelas lógicamente el bloqueo mediante un algoritmo de decisión?',
        codeSnippet: 'if (intentosFallidos >= 3) {\n  bloquearCuenta();\n} else {\n  permitirReintento();\n}',
        options: [
          { id: 'a', text: 'Con una estructura condicional "if / else" que evalúa si los intentos superan el umbral.' },
          { id: 'b', text: 'Con una suma simple de strings.' },
          { id: 'c', text: 'Eliminando la base de datos de usuarios.' },
          { id: 'd', text: 'Un operador de bits que ignore los intentos.' },
        ],
        correctOptionId: 'a',
        hintStepByStep: 'Paso 1: El sistema debe bifurcar su comportamiento en dos caminos según una condición.\nPaso 2: ¿Qué sentencia en programación permite tomar una decisión "si se cumple, haz X; si no, haz Y"?',
        explanation: '¡Gran trabajo! La estructura condicional `if / else` permite gobernar el flujo del algoritmo y proteger el sistema aplicando reglas de negocio claras.',
      },
    ],
  },
  'Modelamiento de Base de Datos': {
    videojuegos: [
      {
        id: 'db_vj_1',
        subject: 'Modelamiento de Base de Datos',
        themeId: 'videojuegos',
        themeLabel: 'Videojuegos y RPGs',
        analogyContext: 'En un juego multijugador online, cada Jugador tiene un identificador único irrepetible (ID de Cuenta) para que el servidor no confunda sus skins ni sus monedas.',
        prompt: 'En el modelo relacional de base de datos, ¿qué concepto representa este identificador único irrepetible en la tabla "Jugadores"?',
        options: [
          { id: 'a', text: 'Clave Primaria (Primary Key - PK).' },
          { id: 'b', text: 'Clave Foránea hacia otra tabla sin relación.' },
          { id: 'c', text: 'Un campo de texto que permite nulos y duplicados.' },
          { id: 'd', text: 'Un índice secundario opcional.' },
        ],
        correctOptionId: 'a',
        hintStepByStep: 'Paso 1: Es el campo que identifica de forma única y no ambigua a cada registro en su propia tabla.\nPaso 2: No puede repetirse jamás entre dos filas distintas.',
        explanation: '¡Perfecto! La Clave Primaria (Primary Key) garantiza la unicidad e integridad referencial de cada registro en una tabla relacional.',
      },
      {
        id: 'db_vj_2',
        subject: 'Modelamiento de Base de Datos',
        themeId: 'videojuegos',
        themeLabel: 'Videojuegos y RPGs',
        analogyContext: 'Un jugador puede tener muchos logros desbloqueados, pero cada registro de "logro_obtenido" debe apuntar al Jugador específico que lo consiguió.',
        prompt: '¿Cómo se le llama al campo en la tabla "logros_obtenidos" que guarda el ID del jugador para vincular ambas tablas?',
        options: [
          { id: 'a', text: 'Clave Foránea (Foreign Key - FK).' },
          { id: 'b', text: 'Clave Primaria compuesta de 10 columnas.' },
          { id: 'c', text: 'Un trigger destructivo.' },
          { id: 'd', text: 'Un tipo de dato boolean.' },
        ],
        correctOptionId: 'a',
        hintStepByStep: 'Paso 1: La tabla A se conecta con la tabla B.\nPaso 2: El campo en la tabla secundaria que "hace referencia" a la clave de la tabla principal es una clave externa.',
        explanation: '¡Exacto! La Clave Foránea (Foreign Key) establece el vínculo de relación entre dos tablas, asegurando que un logro pertenezca a un jugador real.',
      },
    ],
    musica: [
      {
        id: 'db_mus_1',
        subject: 'Modelamiento de Base de Datos',
        themeId: 'musica',
        themeLabel: 'Música y Streaming',
        analogyContext: 'En una app como Apple Music, un Artista puede publicar MUCHAS Canciones, pero cada canción suele pertenecer a UN Artista principal.',
        prompt: '¿Qué tipo de cardinalidad de relación existe entre la entidad "Artista" y la entidad "Canción"?',
        options: [
          { id: 'a', text: 'Relación 1 a Muchos (1:N).' },
          { id: 'b', text: 'Relación 1 a 1 estricta (1:1).' },
          { id: 'c', text: 'No existe relación relacional.' },
          { id: 'd', text: 'Relación circular infinita.' },
        ],
        correctOptionId: 'a',
        hintStepByStep: 'Paso 1: Haz la pregunta en ambas direcciones: "¿Cuántas canciones puede tener un artista?" -> Muchas.\nPaso 2: "¿Cuántos artistas principales tiene la pista?" -> Uno.',
        explanation: '¡Notable! Es una relación Uno a Muchos (1:N). El lado "Muchos" (Canción) lleva la Clave Foránea que apunta al Artista.',
      },
    ],
  },
  'Consultas de Bases de Datos': {
    videojuegos: [
      {
        id: 'sql_vj_1',
        subject: 'Consultas de Bases de Datos',
        themeId: 'videojuegos',
        themeLabel: 'Videojuegos y RPGs',
        analogyContext: 'Quieres mostrar la tabla de posiciones con los 10 mejores jugadores con mayor puntaje en el servidor.',
        prompt: '¿Qué consulta SQL obtiene exactamente los 10 mejores ordenados de mayor a menor puntaje?',
        options: [
          { id: 'a', text: 'SELECT * FROM jugadores ORDER BY puntaje DESC LIMIT 10;' },
          { id: 'b', text: 'SELECT * FROM jugadores WHERE puntaje = 10;' },
          { id: 'c', text: 'DELETE FROM jugadores WHERE puntaje > 10;' },
          { id: 'd', text: 'UPDATE jugadores SET puntaje = 0;' },
        ],
        correctOptionId: 'a',
        hintStepByStep: 'Paso 1: Para ordenar de mayor a menor se utiliza `DESC` (descendente).\nPaso 2: Para limitar la cantidad de filas devueltas se utiliza `LIMIT 10`.',
        explanation: '¡Excelente! `ORDER BY puntaje DESC` clasifica los registros del mayor al menor y `LIMIT 10` corta la lista en el top 10.',
      },
    ],
    musica: [
      {
        id: 'sql_mus_1',
        subject: 'Consultas de Bases de Datos',
        themeId: 'musica',
        themeLabel: 'Música y Streaming',
        analogyContext: 'Necesitas filtrar todas las canciones de tu catálogo que pertenezcan exclusivamente al género "Rock" o "Indie".',
        prompt: '¿Qué cláusula SQL se utiliza para filtrar filas bajo condiciones específicas?',
        options: [
          { id: 'a', text: 'La cláusula WHERE (ej: WHERE genero IN (\'Rock\', \'Indie\')).' },
          { id: 'b', text: 'La cláusula GROUP BY obligatoria.' },
          { id: 'c', text: 'La cláusula DROP TABLE.' },
          { id: 'd', text: 'La sentencia INSERT INTO.' },
        ],
        correctOptionId: 'a',
        hintStepByStep: 'Paso 1: `SELECT` elige qué columnas ver.\nPaso 2: ¿Qué cláusula filtra cuáles filas cumplen con la condición?',
        explanation: '¡Correcto! La cláusula `WHERE` es el filtro estándar en SQL para seleccionar únicamente las filas que cumplen la condición booleana.',
      },
    ],
  },
  'Programación Web': {
    apps_reales: [
      {
        id: 'web_app_1',
        subject: 'Programación Web',
        themeId: 'apps_reales',
        themeLabel: 'Apps y Vida Cotidiana',
        analogyContext: 'En una app como Uber Eats o PedidosYa, cuando haces clic en "Agregar al Carrito", el número del carrito sube de 0 a 1 sin que se recargue toda la página del navegador.',
        prompt: '¿Cómo se llama la manipulación del árbol de la página web que permite actualizar ese elemento visual dinámicamente con JavaScript?',
        options: [
          { id: 'a', text: 'Manipulación del DOM (Document Object Model) y estado reactivo.' },
          { id: 'b', text: 'Reiniciar el módem de internet.' },
          { id: 'c', text: 'Compilar el kernel del sistema operativo.' },
          { id: 'd', text: 'Un archivo CSS estático de solo lectura.' },
        ],
        correctOptionId: 'a',
        hintStepByStep: 'Paso 1: El DOM es la representación en memoria que el navegador hace del HTML.\nPaso 2: Con JavaScript puedes escuchar el evento \'click\' y modificar el texto del elemento en vivo.',
        explanation: '¡Impecable! JavaScript interactúa con el DOM capturando eventos de usuario y actualizando el contenido visual sin recargas molestas de la pantalla.',
      },
    ],
    videojuegos: [
      {
        id: 'web_vj_1',
        subject: 'Programación Web',
        themeId: 'videojuegos',
        themeLabel: 'Videojuegos y RPGs',
        analogyContext: 'Quieres que al presionar la tecla "Espacio" en la web se active la animación de salto de tu personaje.',
        prompt: '¿Qué mecanismo de JavaScript se utiliza para escuchar y reaccionar a la pulsación de teclas del usuario?',
        codeSnippet: 'window.addEventListener("keydown", (e) => {\n  if (e.code === "Space") saltar();\n});',
        options: [
          { id: 'a', text: 'Un Event Listener (addEventListener) para el evento "keydown".' },
          { id: 'b', text: 'Una etiqueta HTML <img />.' },
          { id: 'c', text: 'Una regla de CSS @keyframes sin JavaScript.' },
          { id: 'd', text: 'Un bucle while que bloquee el hilo principal del navegador.' },
        ],
        correctOptionId: 'a',
        hintStepByStep: 'Paso 1: El navegador genera "eventos" cuando el usuario interactúa.\nPaso 2: `addEventListener` registra una función que se disparará al ocurrir dicho evento.',
        explanation: '¡Gran deducción! Los escuchadores de eventos (`EventListeners`) son la base de la interactividad en la web moderna, permitiendo responder a teclados, ratones y pantallas táctiles.',
      },
    ],
  },
  'Nivelación Matemática': {
    videojuegos: [
      {
        id: 'mat_vj_1',
        subject: 'Nivelación Matemática',
        themeId: 'videojuegos',
        themeLabel: 'Videojuegos y RPGs',
        analogyContext: 'Una espada cuesta normalmente 2.000 monedas de oro en la tienda del juego, pero por evento especial tiene un 25% de descuento.',
        prompt: '¿Cuál es el precio final que pagarás por la espada tras aplicar el descuento?',
        options: [
          { id: 'a', text: '1.500 monedas de oro (descuento de 500 monedas).' },
          { id: 'b', text: '1.800 monedas de oro.' },
          { id: 'c', text: '1.250 monedas de oro.' },
          { id: 'd', text: '2.500 monedas de oro.' },
        ],
        correctOptionId: 'a',
        hintStepByStep: 'Paso 1: El 25% equivale a dividir por 4 o multiplicar por 0.25 (2.000 * 0.25 = 500).\nPaso 2: Resta el descuento al valor original (2.000 - 500).',
        explanation: '¡Brillante cálculo! El 25% de 2.000 es 500, por lo que el precio final con descuento es 1.500 monedas.',
      },
    ],
    deportes: [
      {
        id: 'mat_dep_1',
        subject: 'Nivelación Matemática',
        themeId: 'deportes',
        themeLabel: 'Deportes y Estrategia',
        analogyContext: 'Un delantero ha pateado 20 tiros al arco durante el torneo y 6 de ellos terminaron en gol.',
        prompt: '¿Cuál es el porcentaje de efectividad de gol del delantero sobre el total de tiros?',
        options: [
          { id: 'a', text: '30% de efectividad.' },
          { id: 'b', text: '12% de efectividad.' },
          { id: 'c', text: '40% de efectividad.' },
          { id: 'd', text: '60% de efectividad.' },
        ],
        correctOptionId: 'a',
        hintStepByStep: 'Paso 1: Calcula la fracción: 6 / 20 = 0.30.\nPaso 2: Multiplica por 100 para obtener el porcentaje: 0.30 * 100 = 30%.',
        explanation: '¡Excelente! 6 de 20 tiros representa una proporción de 3/10 o 30% de conversión goleadora.',
      },
    ],
  },
};

export const adaptiveQuizService = {
  /**
   * Genera un conjunto de 3-4 preguntas con andamiaje cognitivo adaptativo
   * conectando la materia con el tema de interés.
   */
  async generateQuiz(
    subjectName: string,
    theme: InterestTheme,
    count: number = 3
  ): Promise<AdaptiveQuizQuestion[]> {
    // 1. Intentar generación dinámica mediante Gemini IA
    try {
      const geminiQuestions = await this.generateWithGemini(subjectName, theme, count);
      if (geminiQuestions && geminiQuestions.length >= 2) {
        return geminiQuestions;
      }
    } catch (err) {
      console.warn('[adaptiveQuizService] Fallback a banco offline adaptativo:', err);
    }

    // 2. Fallback inteligente usando el banco de alta pedagogía
    return this.getFallbackQuestions(subjectName, theme, count);
  },

  /**
   * Llamada a Gemini con prompt basado en DUA (Diseño Universal para el Aprendizaje)
   */
  async generateWithGemini(
    subjectName: string,
    theme: InterestTheme,
    count: number
  ): Promise<AdaptiveQuizQuestion[] | null> {
    const systemPrompt = `Eres un pedagogo universitario experto en Diseño Universal para el Aprendizaje (DUA) y educación neuroinclusiva en Informática de InterAula (Duoc UC).
Tu misión es crear un micro-desafío interactivo y amable de ${count} preguntas para la materia "${subjectName}".

REGLA CLAVE DE ENGAGEMENT:
Debes usar EXCLUSIVAMENTE analogías, metáforas y contextos del interés del alumno: "${theme.name}" (${theme.description}).
Por ejemplo, si el tema es Videojuegos, explica bucles con jefes de batalla o arreglos con cofres e inventarios. Si es Música, usa canciones, ritmos o Spotify.

DIRECTRICES PEDAGÓGICAS NEUROINCLUSIVAS:
1. "analogyContext": 1 o 2 oraciones breves y atractivas que sitúan el concepto dentro de su interés.
2. "prompt": Enunciado claro, sin trampas ambiguas ni lenguaje intimidante.
3. "codeSnippet": (Opcional) Código corto y limpio si ayuda a la comprensión visual.
4. "options": 4 alternativas ("id": "a", "b", "c", "d") con 1 sola correcta ("correctOptionId").
5. "hintStepByStep": Una pista progresiva y amable que desglosa el problema en pasos masticables (andamiaje/chunking cognitivo) para quien tenga dudas.
6. "explanation": Justificación empática y positiva explicando por qué es la respuesta correcta y qué concepto se aprendió.`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${systemPrompt}\n\nDevuelve ÚNICAMENTE un arreglo JSON con las ${count} preguntas conforme a esta estructura:\n[
  {
    "id": "q1",
    "subject": "${subjectName}",
    "themeId": "${theme.id}",
    "themeLabel": "${theme.name}",
    "analogyContext": "Contexto amigable del interés...",
    "prompt": "¿Enunciado de la pregunta?",
    "codeSnippet": "código opcional o null",
    "options": [
      {"id": "a", "text": "Opción A"},
      {"id": "b", "text": "Opción B"},
      {"id": "c", "text": "Opción C"},
      {"id": "d", "text": "Opción D"}
    ],
    "correctOptionId": "a",
    "hintStepByStep": "Paso 1: Analiza... Paso 2: Observa...",
    "explanation": "¡Bien hecho! Este concepto demuestra..."
  }
]`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: 'application/json',
        maxOutputTokens: 2500,
      },
    };

    const candidateText = await callGeminiApiWithFallback(requestBody, 15000);
    if (!candidateText) return null;

    const cleaned = candidateText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, count).map((item, idx) => ({
        ...item,
        id: `ai_adapt_${Date.now()}_${idx + 1}`,
        subject: subjectName,
        themeId: theme.id,
        themeLabel: theme.name,
      }));
    }
    return null;
  },

  /**
   * Resuelve preguntas del banco pedagógico si la IA está desconectada o tarda
   */
  getFallbackQuestions(
    subjectName: string,
    theme: InterestTheme,
    count: number
  ): AdaptiveQuizQuestion[] {
    const bySubject = OFFLINE_ADAPTIVE_BANK[subjectName] || OFFLINE_ADAPTIVE_BANK['Programación de Algoritmos'];
    const byTheme = bySubject[theme.id] || bySubject['videojuegos'] || [];

    if (byTheme.length >= count) {
      return byTheme.slice(0, count);
    }

    // Si faltan, rellenar de temas afines
    const pool: AdaptiveQuizQuestion[] = [...byTheme];
    for (const otherThemeId of Object.keys(bySubject)) {
      for (const q of bySubject[otherThemeId]) {
        if (!pool.some((p) => p.id === q.id)) {
          pool.push({
            ...q,
            themeId: theme.id,
            themeLabel: theme.name,
          });
        }
      }
    }

    return pool.slice(0, count);
  },

  /**
   * Guarda puntaje y logros de micro-quizzes completados en almacenamiento local
   */
  saveQuizProgress(record: {
    subject: string;
    theme: string;
    score: number;
    totalQuestions: number;
    completedAt: string;
  }) {
    try {
      const key = 'ia_adaptive_quiz_history';
      const raw = localStorage.getItem(key);
      const list = raw ? JSON.parse(raw) : [];
      list.unshift(record);
      localStorage.setItem(key, JSON.stringify(list.slice(0, 30)));
    } catch { }
  },

  getQuizHistory(): any[] {
    try {
      const raw = localStorage.getItem('ia_adaptive_quiz_history');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },
};
