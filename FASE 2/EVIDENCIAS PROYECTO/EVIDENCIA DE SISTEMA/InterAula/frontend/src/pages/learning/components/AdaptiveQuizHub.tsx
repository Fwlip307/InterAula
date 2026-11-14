import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useCalmMode } from '../../../context/CalmModeContext';
import { profileService } from '../../../services/profile.service';
import type { NeededSubject } from '../../../types/profile';
import {
  adaptiveQuizService,
  INTEREST_THEMES,
  type InterestTheme,
  type AdaptiveQuizQuestion,
  type QuizAttemptProgress,
  type SequenceStepItem,
} from '../../../services/adaptiveQuiz.service';
import {
  SparklesIcon,
  CheckIcon,
  XIcon,
  BookOpenIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  LightbulbIcon,
  TargetIcon,
  RotateCcwIcon,
} from '../../../components/common/Icons';
import { ReadAloudControls } from '../../../components/common/ReadAloudControls';

const CRITICAL_SUBJECTS = [
  'Programación de Algoritmos',
  'Programación Web',
  'Modelamiento de Base de Datos',
  'Consultas de Bases de Datos',
  'Nivelación Matemática',
  'Matemáticas',
  'Estadística',
  'Programación Orientada a Objetos',
];

const SUBJECT_TOPIC_SUGGESTIONS: Record<string, string[]> = {
  matem: [
    'Ecuaciones de primer grado y despeje de incógnitas',
    'Porcentajes, descuentos y proporciones directas',
    'Funciones lineales y cálculo de pendiente',
    'Jerarquía de operaciones y fracciones',
  ],
  estadist: [
    'Promedio, mediana y análisis de dispersión',
    'Probabilidad condicional y casos favorables',
    'Tablas de frecuencias y percentiles',
  ],
  consulta: [
    'Consultas con INNER JOIN entre múltiples tablas',
    'Agrupación con GROUP BY y filtro HAVING',
    'Transacciones seguras BEGIN, UPDATE y COMMIT',
  ],
  modelamiento: [
    'Normalización de 1FN, 2FN y 3FN paso a paso',
    'Diseño de Claves Primarias (PK) y Foráneas (FK)',
    'Transformación de Modelo Entidad-Relación a Tablas',
  ],
  web: [
    'Validación de formularios y eventos en React',
    'Consumo de API REST con fetch y async/await',
    'Maquetación responsiva con CSS Grid y Flexbox',
  ],
  objeto: [
    'Encapsulamiento, clases y método constructor',
    'Herencia, polimorfismo e interfaces',
    'Validación de reglas de negocio en métodos',
  ],
  algoritm: [
    'Recorrido de arreglos y prevención de desbordamiento',
    'Estructuras de control condicional y ciclos while/for',
    'Funciones modulares, parámetros y casos borde',
  ],
};

function getTopicSuggestions(subject: string): string[] {
  const lower = subject.toLowerCase();
  for (const key of Object.keys(SUBJECT_TOPIC_SUGGESTIONS)) {
    if (lower.includes(key)) {
      return SUBJECT_TOPIC_SUGGESTIONS[key];
    }
  }
  return SUBJECT_TOPIC_SUGGESTIONS.algoritm;
}

function getSequenceStepsForSubject(
  subject: string,
  variantSeed = 0,
  customTopic = ''
): { title: string; scenario: string; steps: SequenceStepItem[] } {
  const lower = `${subject} ${customTopic}`.toLowerCase();
  const v = Math.abs(variantSeed) % 3;
  const cleanTopic = customTopic.trim();

  if (cleanTopic.length >= 3) {
    return {
      title: `Secuencia lógica aplicada: ${cleanTopic}`,
      scenario: `Ordena del 1 al 4 el procedimiento estructurado para resolver "${cleanTopic}" en ${subject}.`,
      steps: [
        {
          id: `cust-1-${v}`,
          correctOrder: 1,
          phase: 'Fase 1 · Entrada y Datos',
          label: `Identificar los datos conocidos y el objetivo en "${cleanTopic}"`,
          codeOrHint: 'Definir variables de entrada, restricciones y qué se pide obtener',
        },
        {
          id: `cust-2-${v}`,
          correctOrder: 2,
          phase: 'Fase 2 · Planteamiento / Regla',
          label: `Seleccionar la fórmula, modelo o estructura de "${cleanTopic}"`,
          codeOrHint: `Plantear la estructura formal de ${subject} antes de ejecutar`,
        },
        {
          id: `cust-3-${v}`,
          correctOrder: 3,
          phase: 'Fase 3 · Desarrollo Paso a Paso',
          label: `Reemplazar valores y aplicar la transformación de "${cleanTopic}"`,
          codeOrHint: 'Desarrollar cada operación manteniendo la consistencia lógica',
        },
        {
          id: `cust-4-${v}`,
          correctOrder: 4,
          phase: 'Fase 4 · Verificación Final',
          label: `Comprobar que el resultado obtenido satisface el problema original`,
          codeOrHint: 'Validar con un caso de prueba o sustitución directa ✓',
        },
      ],
    };
  }

  if (
    lower.includes('matem') ||
    lower.includes('calcul') ||
    lower.includes('algebr') ||
    lower.includes('estadist')
  ) {
    const mathChallenges = [
      {
        title: `Resolución paso a paso de Ecuación Lineal (${subject})`,
        scenario: 'Ordena los 4 bloques algebraicos para despejar la incógnita x y comprobar la igualdad sin errores de signo.',
        steps: [
          {
            id: 'mt-a1',
            correctOrder: 1,
            phase: 'Fase 1 · Planteamiento',
            label: 'Identificar la incógnita x y escribir la ecuación inicial equilibrada',
            codeOrHint: '3x + 12 = 30  (Reconocer término con variable y término constante)',
          },
          {
            id: 'mt-a2',
            correctOrder: 2,
            phase: 'Fase 2 · Reducción Aditiva',
            label: 'Restar la constante (12) en ambos miembros para aislar el término con x',
            codeOrHint: '3x = 30 - 12   →   3x = 18',
          },
          {
            id: 'mt-a3',
            correctOrder: 3,
            phase: 'Fase 3 · Despeje Multiplicativo',
            label: 'Dividir ambos lados entre el coeficiente principal (3)',
            codeOrHint: 'x = 18 / 3   →   x = 6',
          },
          {
            id: 'mt-a4',
            correctOrder: 4,
            phase: 'Fase 4 · Comprobación',
            label: 'Sustituir x = 6 en la ecuación original para verificar la identidad',
            codeOrHint: '3(6) + 12 = 18 + 12 = 30 ✓ (Solución comprobada)',
          },
        ],
      },
      {
        title: `Cálculo de Porcentajes y Variación Proporcional (${subject})`,
        scenario: 'Ordena la secuencia matemática para aplicar un descuento del 25% sobre un valor base de 2.400 unidades.',
        steps: [
          {
            id: 'mt-b1',
            correctOrder: 1,
            phase: 'Fase 1 · Datos Base',
            label: 'Identificar la cantidad total (100%) y el porcentaje requerido',
            codeOrHint: 'Total inicial = 2.400  |  Tasa de descuento = 25%',
          },
          {
            id: 'mt-b2',
            correctOrder: 2,
            phase: 'Fase 2 · Conversión Decimal',
            label: 'Convertir el porcentaje en razón decimal dividiendo entre 100',
            codeOrHint: '25% = 25 / 100 = 0.25',
          },
          {
            id: 'mt-b3',
            correctOrder: 3,
            phase: 'Fase 3 · Producto Proporcional',
            label: 'Multiplicar el valor base por el factor decimal para hallar el descuento',
            codeOrHint: 'Descuento = 2.400 × 0.25 = 600',
          },
          {
            id: 'mt-b4',
            correctOrder: 4,
            phase: 'Fase 4 · Resultado Final',
            label: 'Restar el descuento al total original e interpretar el resultado',
            codeOrHint: 'Valor final = 2.400 - 600 = 1.800 ✓',
          },
        ],
      },
      {
        title: `Análisis de Muestra y Promedio Estadístico (${subject})`,
        scenario: 'Ordena las 4 etapas para calcular e interpretar la media y mediana de un conjunto de datos.',
        steps: [
          {
            id: 'mt-c1',
            correctOrder: 1,
            phase: 'Fase 1 · Ordenamiento de Datos',
            label: 'Recolectar las observaciones de la muestra y ordenarlas de menor a mayor',
            codeOrHint: 'Muestra ordenada: [12, 15, 18, 20, 25]  (n = 5 datos)',
          },
          {
            id: 'mt-c2',
            correctOrder: 2,
            phase: 'Fase 2 · Sumatoria Total',
            label: 'Sumar todos los valores cuantitativos registrados (Σxᵢ)',
            codeOrHint: 'Σxᵢ = 12 + 15 + 18 + 20 + 25 = 90',
          },
          {
            id: 'mt-c3',
            correctOrder: 3,
            phase: 'Fase 3 · División por Tamaño Muestral',
            label: 'Dividir la suma total entre el número de observaciones (n)',
            codeOrHint: 'Media (x̄) = 90 / 5 = 18.0',
          },
          {
            id: 'mt-c4',
            correctOrder: 4,
            phase: 'Fase 4 · Contraste e Interpretación',
            label: 'Comparar la media con el valor central (mediana = 18) para validar simetría',
            codeOrHint: 'Distribución equilibrada sin sesgo extremo ✓',
          },
        ],
      },
    ];
    return mathChallenges[v];
  }

  if (lower.includes('consulta') || lower.includes('sql')) {
    const sqlVariants = [
      {
        title: 'Construcción de Consulta SQL con Agregación',
        scenario: 'Ordena las cláusulas SQL según el flujo lógico para filtrar y agrupar promedios académicos.',
        steps: [
          { id: 'sq-a1', correctOrder: 1, phase: 'Fase 1 · Origen (SELECT / FROM)', label: 'Definir tabla origen y columnas a proyectar', codeOrHint: 'SELECT carrera, AVG(nota) FROM estudiantes' },
          { id: 'sq-a2', correctOrder: 2, phase: 'Fase 2 · Filtro de Filas (WHERE)', label: 'Filtrar filas individuales activas antes de agrupar', codeOrHint: 'WHERE semestre = 2026 AND activo = true' },
          { id: 'sq-a3', correctOrder: 3, phase: 'Fase 3 · Agrupación (GROUP BY / HAVING)', label: 'Agrupar por carrera y filtrar el promedio calculado', codeOrHint: 'GROUP BY carrera HAVING AVG(nota) >= 5.0' },
          { id: 'sq-a4', correctOrder: 4, phase: 'Fase 4 · Ordenamiento (ORDER BY)', label: 'Ordenar el resultado final de mayor a menor', codeOrHint: 'ORDER BY AVG(nota) DESC LIMIT 10;' },
        ],
      },
      {
        title: 'Relación de Tablas Mediante INNER JOIN',
        scenario: 'Ordena los pasos para consultar sesiones de tutoría cruzadas con el catálogo de asignaturas.',
        steps: [
          { id: 'sq-b1', correctOrder: 1, phase: 'Fase 1 · Tabla Principal', label: 'Especificar la entidad base en la cláusula FROM', codeOrHint: 'FROM sesiones_tutoria s' },
          { id: 'sq-b2', correctOrder: 2, phase: 'Fase 2 · Vínculo Relacional', label: 'Unir la tabla secundaria comparando FK con PK en INNER JOIN', codeOrHint: 'INNER JOIN asignaturas a ON s.subject_id = a.id' },
          { id: 'sq-b3', correctOrder: 3, phase: 'Fase 3 · Condición de Búsqueda', label: 'Aplicar predicado booleano en WHERE', codeOrHint: "WHERE s.estado = 'completada'" },
          { id: 'sq-b4', correctOrder: 4, phase: 'Fase 4 · Selección de Atributos', label: 'Proyectar las columnas limpias requeridas en el reporte', codeOrHint: 'SELECT a.nombre, s.duracion_minutos' },
        ],
      },
      {
        title: 'Transacción Segura ACID en Base de Datos',
        scenario: 'Ordena la secuencia transaccional para reservar un cupo sin riesgo de inconsistencia.',
        steps: [
          { id: 'sq-c1', correctOrder: 1, phase: 'Fase 1 · Inicio Atómico', label: 'Abrir bloque transaccional (BEGIN TRANSACTION)', codeOrHint: 'BEGIN; -- Garantizar atomicidad ACID' },
          { id: 'sq-c2', correctOrder: 2, phase: 'Fase 2 · Modificación DML', label: 'Actualizar el cupo disponible de la actividad seleccionada', codeOrHint: 'UPDATE talleres SET cupos = cupos - 1 WHERE id = 7;' },
          { id: 'sq-c3', correctOrder: 3, phase: 'Fase 3 · Regla de Integridad', label: 'Verificar que el cupo resultante no sea menor a cero', codeOrHint: 'Validar restricción CHECK (cupos >= 0)' },
          { id: 'sq-c4', correctOrder: 4, phase: 'Fase 4 · Persistencia', label: 'Confirmar de forma permanente los cambios (COMMIT)', codeOrHint: 'COMMIT; -- Transacción confirmada' },
        ],
      },
    ];
    return sqlVariants[v];
  }

  if (lower.includes('modelamiento') || lower.includes('base de datos')) {
    const modelVariants = [
      {
        title: 'Normalización Relacional de 1FN a 3FN',
        scenario: 'Ordena las 4 fases para transformar registros redundantes en un esquema relacional íntegro.',
        steps: [
          { id: 'md-a1', correctOrder: 1, phase: 'Fase 1 · Dominio', label: 'Identificar entidades principales y reglas de negocio', codeOrHint: 'Ej: Estudiante, Asignatura, SolicitudTutoria' },
          { id: 'md-a2', correctOrder: 2, phase: 'Fase 2 · 1ra Forma Normal (1FN)', label: 'Definir Claves Primarias (PK) y asegurar atributos atómicos', codeOrHint: 'Eliminar columnas multivaluadas o repetitivas' },
          { id: 'md-a3', correctOrder: 3, phase: 'Fase 3 · 2da Forma Normal (2FN)', label: 'Resolver relaciones N:M con tablas intermedias sin dependencia parcial', codeOrHint: 'Todo atributo depende de la clave completa' },
          { id: 'md-a4', correctOrder: 4, phase: 'Fase 4 · 3ra Forma Normal (3FN)', label: 'Separar dependencias transitivas y declarar Claves Foráneas (FK)', codeOrHint: 'Integridad referencial lista para implementación' },
        ],
      },
      {
        title: 'Evolución de Diseño: Conceptual a Físico',
        scenario: 'Ordena el ciclo de ingeniería de datos desde los requerimientos hasta el código DDL.',
        steps: [
          { id: 'md-b1', correctOrder: 1, phase: 'Fase 1 · Requerimientos', label: 'Levantar reglas de información y consultas necesarias', codeOrHint: '¿Qué datos se almacenan y cómo se relacionan?' },
          { id: 'md-b2', correctOrder: 2, phase: 'Fase 2 · Modelo Conceptual (MER)', label: 'Trazar entidades, atributos y cardinalidades (1:1, 1:N, N:M)', codeOrHint: 'Diagrama Entidad-Relación independiente del motor' },
          { id: 'md-b3', correctOrder: 3, phase: 'Fase 3 · Modelo Lógico Relacional', label: 'Mapear tablas normalizadas con PK y FK explícitas', codeOrHint: 'Definir esquemas relacionales y participación' },
          { id: 'md-b4', correctOrder: 4, phase: 'Fase 4 · Modelo Físico (DDL)', label: 'Escribir sentencias CREATE TABLE con tipos de datos y CONSTRAINTS', codeOrHint: 'VARCHAR, INTEGER, NOT NULL, REFERENCES' },
        ],
      },
      {
        title: 'Resolución de Relación Muchos a Muchos (N:M)',
        scenario: 'Ordena los pasos para modelar correctamente que un Estudiante cursa muchas Materias y viceversa.',
        steps: [
          { id: 'md-c1', correctOrder: 1, phase: 'Fase 1 · Detección N:M', label: 'Identificar cardinalidad N:M entre Estudiante y Materia', codeOrHint: 'No se puede colocar una sola FK directa sin repetir filas' },
          { id: 'md-c2', correctOrder: 2, phase: 'Fase 2 · Entidad Asociativa', label: 'Crear tabla intermedia "Inscripcion" (o Estudiante_Materia)', codeOrHint: 'Rompe la relación N:M en dos relaciones 1:N' },
          { id: 'md-c3', correctOrder: 3, phase: 'Fase 3 · Claves Foráneas', label: 'Vincular estudiante_id (FK) y materia_id (FK) hacia las tablas padres', codeOrHint: 'Garantiza que ambos registros existan previamente' },
          { id: 'md-c4', correctOrder: 4, phase: 'Fase 4 · Atributos Propios', label: 'Añadir clave única compuesta y atributos de la relación (fecha, estado)', codeOrHint: 'UNIQUE(estudiante_id, materia_id) + fecha_inscripcion' },
        ],
      },
    ];
    return modelVariants[v];
  }

  if (lower.includes('web')) {
    const webVariants = [
      {
        title: 'Arquitectura Frontend y Consumo de API REST',
        scenario: 'Ordena las 4 capas para construir un componente web accesible y conectado a datos reales.',
        steps: [
          { id: 'wb-a1', correctOrder: 1, phase: 'Fase 1 · Semántica HTML5', label: 'Estructurar el documento con etiquetas accesibles y roles claros', codeOrHint: '<main>, <section>, <form>, <label>, aria-label' },
          { id: 'wb-a2', correctOrder: 2, phase: 'Fase 2 · Layout Responsivo', label: 'Aplicar sistema visual adaptable con CSS Grid, Flexbox y variables', codeOrHint: 'Diseño fluido y contraste legible WCAG AA' },
          { id: 'wb-a3', correctOrder: 3, phase: 'Fase 3 · Estado Reactivo', label: 'Gestionar estado local y eventos controlados en React + TypeScript', codeOrHint: 'useState, manejadores onChange/onSubmit y validación' },
          { id: 'wb-a4', correctOrder: 4, phase: 'Fase 4 · Integración Asíncrona', label: 'Consumir endpoint REST manejando estados loading, data y error', codeOrHint: 'await fetch() + retroalimentación visual al usuario' },
        ],
      },
      {
        title: 'Flujo de Envío Seguro de un Formulario Web',
        scenario: 'Ordena la secuencia desde que el usuario presiona "Guardar" hasta que la interfaz se actualiza.',
        steps: [
          { id: 'wb-b1', correctOrder: 1, phase: 'Fase 1 · Captura de Evento', label: 'Interceptar el evento onSubmit previniendo la recarga del navegador', codeOrHint: 'e.preventDefault() al inicio del manejador' },
          { id: 'wb-b2', correctOrder: 2, phase: 'Fase 2 · Validación Cliente', label: 'Comprobar que los campos obligatorios y formatos sean válidos', codeOrHint: 'Verificar longitud, tipos y reglas antes de transmitir' },
          { id: 'wb-b3', correctOrder: 3, phase: 'Fase 3 · Petición HTTP POST', label: 'Enviar payload JSON mediante petición asíncrona autenticada', codeOrHint: 'await apiClient.post(endpoint, payload)' },
          { id: 'wb-b4', correctOrder: 4, phase: 'Fase 4 · Actualización UI', label: 'Refrescar la lista en memoria y desplegar confirmación de éxito', codeOrHint: 'setItems(prev => [nuevo, ...prev])' },
        ],
      },
      {
        title: 'Procesamiento de Petición en Backend Web',
        scenario: 'Ordena las etapas que recorre una solicitud HTTP al llegar al servidor de la aplicación.',
        steps: [
          { id: 'wb-c1', correctOrder: 1, phase: 'Fase 1 · Enrutamiento', label: 'Recibir la solicitud en la ruta REST correspondiente', codeOrHint: 'router.post("/api/recurso", ...)' },
          { id: 'wb-c2', correctOrder: 2, phase: 'Fase 2 · Seguridad y Esquema', label: 'Verificar autenticación JWT y validar el body con Zod', codeOrHint: 'requireAuth + validateRequest(schema)' },
          { id: 'wb-c3', correctOrder: 3, phase: 'Fase 3 · Servicio y Persistencia', label: 'Ejecutar reglas de negocio y guardar en la base de datos', codeOrHint: 'service.create(userId, validatedData)' },
          { id: 'wb-c4', correctOrder: 4, phase: 'Fase 4 · Respuesta HTTP', label: 'Devolver código de estado 201 Created con el recurso en JSON', codeOrHint: 'res.status(201).json({ success: true, data })' },
        ],
      },
    ];
    return webVariants[v];
  }

  const algVariants = [
    {
      title: `Diseño Algorítmico e Iteración Segura (${subject})`,
      scenario: 'Ordena los 4 pasos lógicos para recorrer una colección de datos y calcular un resultado verificable.',
      steps: [
        { id: 'al-a1', correctOrder: 1, phase: 'Fase 1 · Entrada y Borde', label: 'Analizar los datos de entrada y validar condiciones de borde', codeOrHint: '¿Qué recibe la función y qué ocurre si la lista viene vacía?' },
        { id: 'al-a2', correctOrder: 2, phase: 'Fase 2 · Inicialización', label: 'Declarar e inicializar variables acumuladoras o estructuras auxiliares', codeOrHint: 'Definir estado base antes de iterar (ej: let suma = 0;)' },
        { id: 'al-a3', correctOrder: 3, phase: 'Fase 3 · Ciclo Controlado', label: 'Ejecutar el ciclo o transformación asegurando el avance hacia el límite', codeOrHint: 'for (let i = 0; i < lista.length; i++) { ... }' },
        { id: 'al-a4', correctOrder: 4, phase: 'Fase 4 · Retorno y Prueba', label: 'Retornar el valor procesado y comprobar con un caso de prueba', codeOrHint: 'return suma; // Verificar que la salida cumple el objetivo' },
      ],
    },
    {
      title: `Resolución Recursiva y Caso Base (${subject})`,
      scenario: 'Ordena la estructura lógica de un algoritmo recursivo para evitar desbordamiento de pila.',
      steps: [
        { id: 'al-b1', correctOrder: 1, phase: 'Fase 1 · Condición de Parada', label: 'Definir el caso base que detiene las llamadas recursivas', codeOrHint: 'if (n <= 1) return 1; // Evita recursión infinita' },
        { id: 'al-b2', correctOrder: 2, phase: 'Fase 2 · División del Problema', label: 'Reducir la entrada hacia un subproblema de menor tamaño', codeOrHint: 'Acercar el parámetro al caso base (n - 1)' },
        { id: 'al-b3', correctOrder: 3, phase: 'Fase 3 · Combinación', label: 'Invocar la llamada recursiva y combinar el resultado parcial', codeOrHint: 'return n * factorial(n - 1);' },
        { id: 'al-b4', correctOrder: 4, phase: 'Fase 4 · Consolidación', label: 'Desapilar las llamadas y entregar el resultado final al origen', codeOrHint: 'Retorno consolidado tras resolver todos los niveles' },
      ],
    },
    {
      title: `Modelado Orientado a Objetos y Encapsulamiento (${subject})`,
      scenario: 'Ordena las 4 etapas para diseñar, proteger e instanciar una clase con reglas de negocio.',
      steps: [
        { id: 'al-c1', correctOrder: 1, phase: 'Fase 1 · Abstracción', label: 'Definir la clase y declarar sus atributos internos como privados', codeOrHint: 'Encapsulamiento: proteger la integridad del estado' },
        { id: 'al-c2', correctOrder: 2, phase: 'Fase 2 · Constructor', label: 'Inicializar los atributos con valores válidos en el constructor', codeOrHint: 'constructor(id: string, saldoInicial: number) { ... }' },
        { id: 'al-c3', correctOrder: 3, phase: 'Fase 3 · Comportamiento', label: 'Implementar métodos públicos que validen las reglas antes de mutar', codeOrHint: 'Operar sobre el objeto manteniendo sus invariantes' },
        { id: 'al-c4', correctOrder: 4, phase: 'Fase 4 · Instanciación', label: 'Crear el objeto con new e invocar sus métodos verificados', codeOrHint: 'const cuenta = new Cuenta("01", 500); cuenta.operar();' },
      ],
    },
  ];
  return algVariants[v];
}

function scrambleSteps(steps: SequenceStepItem[], seed = 0): SequenceStepItem[] {
  if (steps.length < 4) return [...steps];
  const permutations = [
    [steps[2], steps[0], steps[3], steps[1]],
    [steps[1], steps[3], steps[0], steps[2]],
    [steps[3], steps[1], steps[2], steps[0]],
    [steps[2], steps[3], steps[0], steps[1]],
  ];
  return permutations[Math.abs(seed) % permutations.length];
}

interface AdaptiveQuizHubProps {
  isCalmMode?: boolean;
}

export default function AdaptiveQuizHub({ isCalmMode = false }: AdaptiveQuizHubProps) {
  const { user } = useAuth();
  const { isDarkMode, preferences } = useCalmMode();
  const [subjects, setSubjects] = useState<string[]>(CRITICAL_SUBJECTS);
  const [selectedSubject, setSelectedSubject] = useState<string>(CRITICAL_SUBJECTS[0]);
  const [customTopic, setCustomTopic] = useState<string>('');
  const [selectedTheme, setSelectedTheme] = useState<InterestTheme>(INTEREST_THEMES[0]);
  const [neededSubjectsList, setNeededSubjectsList] = useState<NeededSubject[]>([]);
  const [untimedMode, setUntimedMode] = useState<boolean>(preferences.untimedQuizzes !== false);
  const [quizHistory, setQuizHistory] = useState<QuizAttemptProgress[]>(() =>
    adaptiveQuizService.getQuizHistory()
  );
  const [missedTopics, setMissedTopics] = useState<string[]>([]);

  useEffect(() => {
    setUntimedMode(preferences.untimedQuizzes !== false);
  }, [preferences.untimedQuizzes]);

  // Estado del juego de preguntas
  const [questions, setQuestions] = useState<AdaptiveQuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [loadingQuiz, setLoadingQuiz] = useState(false);

  // Estado para el Laboratorio de Secuencia por Bloques Arrastrables con IA
  const [seqVariantSeed, setSeqVariantSeed] = useState<number>(0);
  const initialChallenge = getSequenceStepsForSubject(CRITICAL_SUBJECTS[0], 0, '');
  const [sequenceTitle, setSequenceTitle] = useState<string>(initialChallenge.title);
  const [sequenceScenario, setSequenceScenario] = useState<string>(initialChallenge.scenario);
  const [sequenceBlocks, setSequenceBlocks] = useState<SequenceStepItem[]>(() =>
    scrambleSteps(initialChallenge.steps, 0)
  );
  const [loadingSequenceAI, setLoadingSequenceAI] = useState<boolean>(false);
  const [sequenceSourceLabel, setSequenceSourceLabel] = useState<string>('IA Adaptativa DUA');
  const [draggedSeqIndex, setDraggedSeqIndex] = useState<number | null>(null);
  const [sequenceChecked, setSequenceChecked] = useState<'none' | 'ok' | 'retry'>('none');

  // Sincronizar bloques localmente de inmediato cuando cambia asignatura y luego pedir a la IA
  const handleResetSequenceForSubject = (subj: string, topicValue = customTopic) => {
    const nextSeed = seqVariantSeed + 1;
    setSeqVariantSeed(nextSeed);
    const localData = getSequenceStepsForSubject(subj, nextSeed, topicValue);
    setSequenceTitle(localData.title);
    setSequenceScenario(localData.scenario);
    setSequenceBlocks(scrambleSteps(localData.steps, nextSeed));
    setSequenceChecked('none');
  };

  // Generar reto de bloques directamente con la IA en base a asignatura + tema escrito + interés
  const handleGenerateAISequenceBlocks = async (
    subj = selectedSubject,
    theme = selectedTheme,
    topicValue = customTopic
  ) => {
    setLoadingSequenceAI(true);
    setSequenceChecked('none');
    const nextSeed = seqVariantSeed + 1;
    setSeqVariantSeed(nextSeed);

    try {
      const generated = await adaptiveQuizService.generateQuiz(subj, theme, 3, topicValue);
      const aiSeq = generated?.[0]?.sequenceChallenge;
      if (aiSeq && Array.isArray(aiSeq.steps) && aiSeq.steps.length === 4) {
        setSequenceTitle(aiSeq.title);
        setSequenceScenario(aiSeq.scenario);
        setSequenceBlocks(scrambleSteps(aiSeq.steps, nextSeed));
        setSequenceSourceLabel(aiSeq.source === 'ai_live' ? 'IA Generativa en Vivo' : 'Motor IA DUA');
        return;
      }
    } catch {
      // Continúa al generador local contextualizado
    } finally {
      setLoadingSequenceAI(false);
    }

    const fallbackData = getSequenceStepsForSubject(subj, nextSeed, topicValue);
    setSequenceTitle(fallbackData.title);
    setSequenceScenario(fallbackData.scenario);
    setSequenceBlocks(scrambleSteps(fallbackData.steps, nextSeed));
  };

  const handleMoveSeqBlock = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= sequenceBlocks.length || fromIdx === toIdx) return;
    setSequenceBlocks((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
    setSequenceChecked('none');
  };

  const handleCheckSequence = () => {
    const isOrdered = sequenceBlocks.every((blk, i) => blk.correctOrder === i + 1);
    if (isOrdered) {
      setSequenceChecked('ok');
      setScore((prev) => prev + 50);
    } else {
      setSequenceChecked('retry');
    }
  };

  // Cargar materias que el alumno necesita reforzar desde su perfil
  useEffect(() => {
    async function loadStudentNeeds() {
      if (!user) return;
      try {
        const needed = await profileService.getNeededSubjects(user.id);
        setNeededSubjectsList(needed);
        if (needed && needed.length > 0) {
          const names = needed
            .map((n) => n.subject?.name)
            .filter((name): name is string => Boolean(name));
          if (names.length > 0) {
            setSubjects((prev) => Array.from(new Set([...names, ...prev])));
            const firstSub = names[0];
            setSelectedSubject(firstSub);
            const initData = getSequenceStepsForSubject(firstSub, 1, '');
            setSequenceTitle(initData.title);
            setSequenceScenario(initData.scenario);
            setSequenceBlocks(scrambleSteps(initData.steps, 1));
          }
        }
      } catch (err) {
        console.warn('[AdaptiveQuizHub] No fue posible cargar materias necesarias:', err);
      }
    }
    loadStudentNeeds();
  }, [user]);

  // Generar Quiz + Actualizar Bloques con IA
  const handleStartQuiz = async () => {
    setLoadingQuiz(true);
    setQuizCompleted(false);
    setCurrentIdx(0);
    setSelectedOptionId(null);
    setShowHint(false);
    setIsAnswered(false);
    setScore(0);
    setCorrectCount(0);
    setMissedTopics([]);

    try {
      const generated = await adaptiveQuizService.generateQuiz(
        selectedSubject,
        selectedTheme,
        3,
        customTopic
      );
      setQuestions(generated);

      const aiSeq = generated?.[0]?.sequenceChallenge;
      if (aiSeq && Array.isArray(aiSeq.steps) && aiSeq.steps.length === 4) {
        const nextSeed = seqVariantSeed + 1;
        setSeqVariantSeed(nextSeed);
        setSequenceTitle(aiSeq.title);
        setSequenceScenario(aiSeq.scenario);
        setSequenceBlocks(scrambleSteps(aiSeq.steps, nextSeed));
        setSequenceChecked('none');
      }
    } catch (err) {
      console.error('[AdaptiveQuizHub] Error al generar quiz:', err);
    } finally {
      setLoadingQuiz(false);
    }
  };

  const handleSelectOption = (optionId: string) => {
    if (isAnswered) return;
    setSelectedOptionId(optionId);
    setIsAnswered(true);

    const q = questions[currentIdx];
    if (q && optionId === q.correctOptionId) {
      setScore((prev) => prev + 100);
      setCorrectCount((prev) => prev + 1);
    } else if (q) {
      setMissedTopics((prev) => [...prev, q.prompt]);
    }
  };

  const handleNextQuestion = () => {
    if (currentIdx + 1 < questions.length) {
      setCurrentIdx((prev) => prev + 1);
      setSelectedOptionId(null);
      setShowHint(false);
      setIsAnswered(false);
    } else {
      setQuizCompleted(true);
      adaptiveQuizService.saveQuizProgress({
        subject: selectedSubject,
        theme: selectedTheme.name,
        score: score,
        totalQuestions: questions.length,
        completedAt: new Date().toISOString(),
      });
      setQuizHistory(adaptiveQuizService.getQuizHistory());
    }
  };

  const currentQ = questions[currentIdx];
  const topicSuggestions = getTopicSuggestions(selectedSubject);

  // Colores de acento para cada posición de paso en el laboratorio de bloques
  const STEP_ACCENTS = [
    { border: '#2563eb', badgeBg: '#dbeafe', badgeText: '#1e40af', darkBadgeBg: 'rgba(37, 99, 235, 0.25)', darkBadgeText: '#93c5fd' },
    { border: '#7c3aed', badgeBg: '#ede9fe', badgeText: '#5b21b6', darkBadgeBg: 'rgba(124, 58, 237, 0.25)', darkBadgeText: '#c4b5fd' },
    { border: '#0891b2', badgeBg: '#cffafe', badgeText: '#155e75', darkBadgeBg: 'rgba(8, 145, 178, 0.25)', darkBadgeText: '#67e8f9' },
    { border: '#059669', badgeBg: '#d1fae5', badgeText: '#065f46', darkBadgeBg: 'rgba(5, 150, 105, 0.25)', darkBadgeText: '#6ee7b7' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Banner Superior Neuroinclusivo */}
      <div
        className="ia-quiz-hero-banner"
        style={{
          background: isDarkMode
            ? 'linear-gradient(135deg, #1e1b4b 0%, #172554 55%, #0f172a 100%)'
            : isCalmMode
            ? '#e8efe5'
            : 'linear-gradient(135deg, #eff6ff 0%, #f5f3ff 55%, #ecfdf5 100%)',
          border: `1.5px solid ${isDarkMode ? '#3730a3' : isCalmMode ? '#b8c9b2' : '#c4b5fd'}`,
          borderRadius: '16px',
          padding: '22px 26px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ maxWidth: '820px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  background: isCalmMode ? '#2c5b6c' : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  color: '#ffffff',
                  fontSize: '0.73rem',
                  fontWeight: 800,
                  padding: '4px 12px',
                  borderRadius: '999px',
                  letterSpacing: '0.04em',
                }}
              >
                LABORATORIO ADAPTATIVO DUA + IA
              </span>
              <span style={{ fontSize: '0.82rem', color: isDarkMode ? '#c4b5fd' : '#5b21b6', fontWeight: 700 }}>
                Preguntas y bloques dinámicos generados según tu materia, tema e intereses
              </span>
            </div>

            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: isDarkMode ? '#f8fafc' : '#0f172a', margin: '0 0 6px 0' }}>
              Micro-Quizzes y Bloques Lógicos Interactivos con IA
            </h2>
            <p style={{ fontSize: '0.9rem', color: isDarkMode ? '#cbd5e1' : '#334155', lineHeight: 1.55, margin: 0 }}>
              Elige tu asignatura, escribe opcionalmente el tema exacto que estás estudiando y selecciona tu interés favorito.
              La IA generará preguntas inéditas y un desafío de bloques ordenables a tu medida.
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: isDarkMode ? '#0f172a' : '#ffffff',
              border: `1px solid ${isDarkMode ? '#334155' : '#ddd6fe'}`,
              padding: '10px 18px',
              borderRadius: '14px',
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06)',
            }}
          >
            <SparklesIcon size={20} color={isDarkMode ? '#a78bfa' : '#7c3aed'} />
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--ia-text-muted)', textTransform: 'uppercase' }}>
                Dominio acumulado
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 900, color: isDarkMode ? '#f8fafc' : '#4c1d95' }}>
                {score} pts
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* GRILLA DE 2 COLUMNAS DE ANCHO COMPLETO: IZQUIERDA (QUIZ) | DERECHA (LABORATORIO DE BLOQUES IA) */}
      <div className="ia-quiz-studio-grid">
        {/* COLUMNA IZQUIERDA: CONFIGURADOR Y REPRODUCTOR DE MICRO-QUIZ */}
        <div
          className="ia-card"
          style={{
            margin: 0,
            padding: '24px',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {questions.length === 0 || quizCompleted ? (
            <>
              {quizCompleted && (
                <div
                  style={{
                    background: isDarkMode ? 'rgba(16, 185, 129, 0.14)' : '#f0fdf4',
                    border: `1.5px solid ${isDarkMode ? '#059669' : '#86efac'}`,
                    padding: '18px 20px',
                    borderRadius: '14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <CheckCircleIcon size={26} color="#10b981" />
                    <div>
                      <h3 style={{ margin: '0 0 2px', fontSize: '1.12rem', fontWeight: 800, color: isDarkMode ? '#ecfdf5' : '#166534' }}>
                        ¡Gran avance en {selectedSubject}!
                      </h3>
                      <p style={{ margin: 0, fontSize: '0.88rem', color: isDarkMode ? '#a7f3d0' : '#15803d' }}>
                        Obtuviste <strong>{score} puntos</strong> ({correctCount} de {questions.length} aciertos) con analogías de{' '}
                        <strong>{selectedTheme.name}</strong>.
                      </p>
                    </div>
                  </div>

                  {missedTopics.length > 0 && (
                    <div
                      style={{
                        marginTop: '12px',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        background: isDarkMode ? '#0f172a' : '#ffffff',
                        border: `1px solid ${isDarkMode ? '#334155' : '#bbf7d0'}`,
                      }}
                    >
                      <strong style={{ fontSize: '0.82rem', color: isDarkMode ? '#6ee7b7' : '#166534', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <TargetIcon size={15} color="#10b981" />
                        <span>Conceptos sugeridos para repasar con un tutor o apunte:</span>
                      </strong>
                      <ul style={{ margin: '0 0 10px 0', paddingLeft: '18px', fontSize: '0.82rem', color: 'var(--ia-text-body)', lineHeight: 1.5 }}>
                        {missedTopics.map((topic, i) => (
                          <li key={i}>{topic}</li>
                        ))}
                      </ul>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <Link to="/tutoring" className="ia-btn-primary ia-btn-sm">
                          Buscar Tutor en {selectedSubject}
                        </Link>
                        <Link to="/resources" className="ia-btn-secondary ia-btn-sm">
                          Ver Apuntes de {selectedSubject}
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Paso 1: Selección de Materia */}
              <div>
                <label style={{ display: 'block', fontSize: '0.92rem', fontWeight: 800, color: 'var(--ia-text-main)', marginBottom: '8px' }}>
                  1. Selecciona la asignatura que deseas practicar:
                </label>
                {neededSubjectsList.length > 0 && (
                  <p style={{ margin: '0 0 10px', fontSize: '0.8rem', color: 'var(--ia-primary)', fontWeight: 600 }}>
                    Incluye las asignaturas registradas en tu perfil para refuerzo prioritario.
                  </p>
                )}

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {subjects.map((sub) => {
                    const isSelected = selectedSubject === sub;
                    const isProfileNeeded = neededSubjectsList.some((n) => n.subject?.name === sub);
                    return (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => {
                          setSelectedSubject(sub);
                          handleResetSequenceForSubject(sub, customTopic);
                          handleGenerateAISequenceBlocks(sub, selectedTheme, customTopic);
                        }}
                        style={{
                          padding: '8px 14px',
                          borderRadius: '10px',
                          fontSize: '0.84rem',
                          fontWeight: isSelected ? 800 : 600,
                          border: `1.5px solid ${
                            isSelected
                              ? '#6366f1'
                              : isDarkMode
                              ? '#334155'
                              : '#cbd5e1'
                          }`,
                          background: isSelected
                            ? isDarkMode
                              ? 'rgba(99, 102, 241, 0.22)'
                              : '#eef2ff'
                            : isDarkMode
                            ? '#1e293b'
                            : '#ffffff',
                          color: isSelected
                            ? isDarkMode
                              ? '#a5b4fc'
                              : '#4338ca'
                            : 'var(--ia-text-body)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <BookOpenIcon size={14} color={isSelected ? '#6366f1' : '#64748b'} />
                        <span>{sub}</span>
                        {isProfileNeeded && (
                          <span
                            style={{
                              backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7',
                              color: isDarkMode ? '#fbbf24' : '#b45309',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              padding: '1px 6px',
                              borderRadius: '6px',
                            }}
                          >
                            Prioritaria
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Paso 2: Tema específico opcional para dirigir la IA */}
              <div
                style={{
                  background: isDarkMode ? '#172033' : '#f8fafc',
                  border: `1px solid ${isDarkMode ? '#283548' : '#e2e8f0'}`,
                  borderRadius: '12px',
                  padding: '14px 16px',
                }}
              >
                <label
                  htmlFor="quiz-custom-topic"
                  style={{ display: 'block', fontSize: '0.88rem', fontWeight: 800, color: 'var(--ia-text-main)', marginBottom: '4px' }}
                >
                  2. ¿Qué tema o contenido específico quieres que la IA genere? (Opcional)
                </label>
                <p style={{ margin: '0 0 10px', fontSize: '0.79rem', color: 'var(--ia-text-muted)' }}>
                  Escribe un concepto o elige una sugerencia rápida: tanto el Micro-Quiz como los bloques ordenables de la derecha se adaptarán a lo que pongas.
                </p>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  <input
                    id="quiz-custom-topic"
                    type="text"
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                    placeholder={`Ej: ${topicSuggestions[0]}...`}
                    className="ia-input"
                    style={{ flex: 1, minWidth: '220px' }}
                  />
                  <button
                    type="button"
                    className="ia-btn-secondary ia-btn-sm"
                    onClick={() => handleGenerateAISequenceBlocks(selectedSubject, selectedTheme, customTopic)}
                    disabled={loadingSequenceAI}
                  >
                    <SparklesIcon size={14} color="#6366f1" />
                    <span>{loadingSequenceAI ? 'Generando bloques...' : 'Adaptar bloques con IA'}</span>
                  </button>
                </div>

                {/* Chips de sugerencias rápidas por asignatura */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--ia-text-muted)' }}>
                    Temas sugeridos:
                  </span>
                  {topicSuggestions.map((sug) => {
                    const activeSug = customTopic === sug;
                    return (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => {
                          const nextVal = activeSug ? '' : sug;
                          setCustomTopic(nextVal);
                          handleResetSequenceForSubject(selectedSubject, nextVal);
                          handleGenerateAISequenceBlocks(selectedSubject, selectedTheme, nextVal);
                        }}
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          padding: '3px 10px',
                          borderRadius: '999px',
                          border: `1px solid ${activeSug ? '#6366f1' : isDarkMode ? '#334155' : '#cbd5e1'}`,
                          background: activeSug
                            ? isDarkMode
                              ? 'rgba(99, 102, 241, 0.25)'
                              : '#e0e7ff'
                            : isDarkMode
                            ? '#0f172a'
                            : '#ffffff',
                          color: activeSug
                            ? isDarkMode
                              ? '#c7d2fe'
                              : '#3730a3'
                            : 'var(--ia-text-body)',
                          cursor: 'pointer',
                        }}
                      >
                        {sug}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Paso 3: Selección de Pasión / Interés */}
              <div>
                <label style={{ display: 'block', fontSize: '0.92rem', fontWeight: 800, color: 'var(--ia-text-main)', marginBottom: '4px' }}>
                  3. Elige tu interés para las analogías explicativas:
                </label>
                <p style={{ margin: '0 0 10px', fontSize: '0.8rem', color: 'var(--ia-text-muted)' }}>
                  Conectamos la teoría de {selectedSubject} con contextos que te resulten familiares y entretenidos.
                </p>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '10px',
                  }}
                >
                  {INTEREST_THEMES.map((theme) => {
                    const isSelected = selectedTheme.id === theme.id;
                    return (
                      <div
                        key={theme.id}
                        onClick={() => {
                          setSelectedTheme(theme);
                          handleGenerateAISequenceBlocks(selectedSubject, theme, customTopic);
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedTheme(theme);
                            handleGenerateAISequenceBlocks(selectedSubject, theme, customTopic);
                          }
                        }}
                        style={{
                          border: `2px solid ${
                            isSelected
                              ? theme.color
                              : isDarkMode
                              ? '#283548'
                              : '#e2e8f0'
                          }`,
                          background: isSelected
                            ? isDarkMode
                              ? `${theme.color}22`
                              : `${theme.color}10`
                            : isDarkMode
                            ? '#172033'
                            : '#ffffff',
                          borderRadius: '12px',
                          padding: '12px 14px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '5px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              backgroundColor: `${theme.color}20`,
                              color: theme.color,
                            }}
                          >
                            {theme.emoji}
                          </span>
                          {isSelected && (
                            <span
                              style={{
                                backgroundColor: theme.color,
                                color: '#ffffff',
                                padding: '2px 8px',
                                borderRadius: '999px',
                                fontSize: '0.68rem',
                                fontWeight: 800,
                              }}
                            >
                              Activo
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--ia-text-main)' }}>
                          {theme.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--ia-text-muted)', lineHeight: 1.35 }}>
                          {theme.description}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Botón de Lanzamiento y Modo de Ritmo */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                  paddingTop: '10px',
                  borderTop: '1px solid var(--ia-border)',
                }}
              >
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: 'var(--ia-text-body)',
                    cursor: 'pointer',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    background: 'var(--ia-bg-subtle)',
                    border: '1px solid var(--ia-border)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={untimedMode}
                    onChange={(e) => setUntimedMode(e.target.checked)}
                  />
                  <span>Sin límite de tiempo (Ritmo pausado)</span>
                </label>

                <button
                  type="button"
                  onClick={handleStartQuiz}
                  disabled={loadingQuiz}
                  className="ia-btn-primary"
                  style={{
                    background: isCalmMode
                      ? '#2c5b6c'
                      : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                    borderColor: isCalmMode ? '#2c5b6c' : '#4f46e5',
                    padding: '11px 22px',
                    fontSize: '0.92rem',
                    fontWeight: 800,
                  }}
                >
                  <SparklesIcon size={17} color="#ffffff" />
                  <span>
                    {loadingQuiz
                      ? 'Generando preguntas con IA...'
                      : quizCompleted
                      ? 'Generar Nuevo Micro-Quiz IA'
                      : 'Comenzar Micro-Quiz Adaptativo'}
                  </span>
                </button>
              </div>
            </>
          ) : (
            /* Reproductor del Quiz Interactivo */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      background: isDarkMode ? 'rgba(124, 58, 237, 0.25)' : '#ede9fe',
                      color: isDarkMode ? '#c4b5fd' : '#6d28d9',
                      fontSize: '0.76rem',
                      fontWeight: 900,
                      padding: '4px 10px',
                      borderRadius: '8px',
                    }}
                  >
                    PREGUNTA {currentIdx + 1} DE {questions.length}
                  </span>
                  <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--ia-text-main)' }}>
                    {currentQ.subject}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setQuestions([])}
                  className="ia-btn-secondary ia-btn-sm"
                >
                  Cambiar materia o tema
                </button>
              </div>

              {currentQ.analogyContext && (
                <div
                  style={{
                    background: isDarkMode ? '#172033' : '#f5f3ff',
                    borderLeft: '4px solid #7c3aed',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    fontSize: '0.87rem',
                    color: 'var(--ia-text-body)',
                    lineHeight: 1.5,
                  }}
                >
                  <strong style={{ color: isDarkMode ? '#c4b5fd' : '#6d28d9' }}>
                    Contexto ({currentQ.themeLabel}):{' '}
                  </strong>
                  {currentQ.analogyContext}
                </div>
              )}

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--ia-text-main)', margin: 0, lineHeight: 1.45, flex: 1 }}>
                    {currentQ.prompt}
                  </h3>
                  <ReadAloudControls
                    text={`${currentQ.prompt}${currentQ.options ? '. ' + currentQ.options.map((o) => o.text).join('. ') : ''}`}
                    label="Escuchar pregunta"
                    compact
                  />
                </div>

                {currentQ.codeSnippet && (
                  <pre
                    style={{
                      backgroundColor: '#0f172a',
                      color: '#e2e8f0',
                      padding: '14px 18px',
                      borderRadius: '10px',
                      fontSize: '0.85rem',
                      fontFamily: 'Consolas, monospace',
                      overflowX: 'auto',
                      lineHeight: 1.5,
                      margin: '10px 0',
                      border: '1px solid #334155',
                    }}
                  >
                    <code>{currentQ.codeSnippet}</code>
                  </pre>
                )}
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowHint((prev) => !prev)}
                  className="ia-btn-secondary ia-btn-sm"
                  style={{ borderStyle: 'dashed' }}
                >
                  <LightbulbIcon size={15} color="#3b82f6" />
                  <span>{showHint ? 'Ocultar pista paso a paso' : 'Ver pista paso a paso (sin penalización)'}</span>
                </button>
              </div>

              {showHint && (
                <div
                  style={{
                    background: isDarkMode ? 'rgba(37, 99, 235, 0.16)' : '#eff6ff',
                    border: `1px solid ${isDarkMode ? '#3b82f6' : '#bfdbfe'}`,
                    padding: '12px 16px',
                    borderRadius: '10px',
                    fontSize: '0.85rem',
                    color: isDarkMode ? '#bfdbfe' : '#1e40af',
                    lineHeight: 1.5,
                    whiteSpace: 'pre-line',
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: '4px' }}>Andamiaje paso a paso:</div>
                  {currentQ.hintStepByStep}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {currentQ.options.map((opt) => {
                  const isSelected = selectedOptionId === opt.id;
                  const isCorrect = opt.id === currentQ.correctOptionId;

                  let optBg = isDarkMode ? '#172033' : '#ffffff';
                  let optBorder = isDarkMode ? '#334155' : '#cbd5e1';
                  let optColor = isDarkMode ? '#f8fafc' : '#1e293b';

                  if (isAnswered) {
                    if (isCorrect) {
                      optBg = isDarkMode ? 'rgba(16, 185, 129, 0.18)' : '#f0fdf4';
                      optBorder = '#10b981';
                      optColor = isDarkMode ? '#6ee7b7' : '#15803d';
                    } else if (isSelected) {
                      optBg = isDarkMode ? 'rgba(239, 68, 68, 0.18)' : '#fef2f2';
                      optBorder = '#ef4444';
                      optColor = isDarkMode ? '#fca5a5' : '#b91c1c';
                    }
                  } else if (isSelected) {
                    optBg = isDarkMode ? 'rgba(124, 58, 237, 0.22)' : '#f5f3ff';
                    optBorder = '#7c3aed';
                    optColor = isDarkMode ? '#ddd6fe' : '#6d28d9';
                  }

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectOption(opt.id)}
                      disabled={isAnswered}
                      style={{
                        backgroundColor: optBg,
                        border: `2px solid ${optBorder}`,
                        color: optColor,
                        padding: '13px 16px',
                        borderRadius: '12px',
                        textAlign: 'left',
                        fontSize: '0.9rem',
                        fontWeight: isSelected ? 700 : 500,
                        cursor: isAnswered ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '8px',
                            backgroundColor:
                              isSelected || (isAnswered && isCorrect)
                                ? optBorder
                                : isDarkMode
                                ? '#0f172a'
                                : '#f1f5f9',
                            color:
                              isSelected || (isAnswered && isCorrect)
                                ? '#ffffff'
                                : 'var(--ia-text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.8rem',
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          {opt.id.toUpperCase()}
                        </span>
                        <span>{opt.text}</span>
                      </div>

                      {isAnswered && isCorrect && <CheckIcon size={20} color="#10b981" />}
                      {isAnswered && isSelected && !isCorrect && <XIcon size={20} color="#ef4444" />}
                    </button>
                  );
                })}
              </div>

              {isAnswered && (
                <div
                  style={{
                    background:
                      selectedOptionId === currentQ.correctOptionId
                        ? isDarkMode
                          ? 'rgba(16, 185, 129, 0.14)'
                          : '#f0fdf4'
                        : isDarkMode
                        ? 'rgba(245, 158, 11, 0.14)'
                        : '#fffbeb',
                    border: `1.5px solid ${
                      selectedOptionId === currentQ.correctOptionId ? '#10b981' : '#f59e0b'
                    }`,
                    padding: '16px 18px',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {selectedOptionId === currentQ.correctOptionId ? (
                      <>
                        <CheckIcon size={18} color="#10b981" />
                        <span style={{ fontSize: '0.92rem', fontWeight: 800, color: isDarkMode ? '#6ee7b7' : '#166534' }}>
                          ¡Respuesta Correcta! (+100 pts)
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircleIcon size={18} color="#f59e0b" />
                        <span style={{ fontSize: '0.92rem', fontWeight: 800, color: isDarkMode ? '#fcd34d' : '#92400e' }}>
                          ¡Buen intento! Analicemos la lógica:
                        </span>
                      </>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--ia-text-body)', lineHeight: 1.5 }}>
                    {currentQ.explanation}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                    <button
                      type="button"
                      onClick={handleNextQuestion}
                      className="ia-btn-primary ia-btn-sm"
                    >
                      {currentIdx + 1 < questions.length ? 'Siguiente Pregunta →' : 'Ver Resultados Finales'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA: LABORATORIO VISUAL DE SECUENCIA LÓGICA CON IA (REDISEÑADO) */}
        <div
          className="ia-card ia-sequence-studio-card"
          style={{
            margin: 0,
            padding: '24px',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            background: isDarkMode
              ? 'linear-gradient(180deg, #111827 0%, #0f172a 100%)'
              : isCalmMode
              ? '#f6f8f4'
              : 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
            border: `1.5px solid ${isDarkMode ? '#334155' : '#cbd5e1'}`,
          }}
        >
          {/* Cabecera del Laboratorio de Bloques */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    padding: '3px 10px',
                    borderRadius: '999px',
                    background: isDarkMode ? 'rgba(59, 130, 246, 0.22)' : '#dbeafe',
                    color: isDarkMode ? '#93c5fd' : '#1d4ed8',
                  }}
                >
                   Constructor Interactivo Drag & Drop
                </span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '3px 9px',
                    borderRadius: '999px',
                    background: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : '#dcfce7',
                    color: isDarkMode ? '#6ee7b7' : '#15803d',
                  }}
                >
                  {sequenceSourceLabel} · {selectedSubject}
                </span>
              </div>

              <h3 style={{ fontSize: '1.12rem', fontWeight: 800, color: 'var(--ia-text-main)', margin: '0 0 4px 0' }}>
                {sequenceTitle}
              </h3>
              <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--ia-text-muted)', lineHeight: 1.45 }}>
                {sequenceScenario}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="ia-btn-secondary ia-btn-sm"
                onClick={() => handleGenerateAISequenceBlocks(selectedSubject, selectedTheme, customTopic)}
                disabled={loadingSequenceAI}
                title="Generar un nuevo desafío de bloques con IA para esta asignatura y tema"
              >
                <SparklesIcon size={14} color="#6366f1" />
                <span>{loadingSequenceAI ? 'Generando...' : 'Nuevo reto IA'}</span>
              </button>
              <button
                type="button"
                className="ia-btn-secondary ia-btn-sm"
                onClick={() => handleResetSequenceForSubject(selectedSubject, customTopic)}
                title="Mezclar el orden de los bloques"
              >
                <RotateCcwIcon size={14} />
                <span>Mezclar</span>
              </button>
              <button
                type="button"
                className="ia-btn-primary ia-btn-sm"
                onClick={handleCheckSequence}
              >
                <CheckCircleIcon size={14} />
                <span>Verificar orden</span>
              </button>
            </div>
          </div>

          {/* Pista visual de progreso de bloques */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '8px',
              padding: '10px 12px',
              borderRadius: '12px',
              background: isDarkMode ? '#172033' : '#f1f5f9',
              border: `1px solid ${isDarkMode ? '#283548' : '#e2e8f0'}`,
            }}
          >
            {[0, 1, 2, 3].map((slotIdx) => {
              const blk = sequenceBlocks[slotIdx];
              const isSpotOk = sequenceChecked !== 'none' && blk?.correctOrder === slotIdx + 1;
              const isSpotErr = sequenceChecked !== 'none' && blk?.correctOrder !== slotIdx + 1;
              const accent = STEP_ACCENTS[slotIdx];
              return (
                <div
                  key={slotIdx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    color: isSpotOk
                      ? '#10b981'
                      : isSpotErr
                      ? '#f59e0b'
                      : 'var(--ia-text-body)',
                  }}
                >
                  <span
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: isSpotOk
                        ? '#10b981'
                        : isSpotErr
                        ? '#f59e0b'
                        : accent.border,
                      color: '#ffffff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {isSpotOk ? '✓' : slotIdx + 1}
                  </span>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {slotIdx === 0
                      ? 'Entrada'
                      : slotIdx === 1
                      ? 'Planteamiento'
                      : slotIdx === 2
                      ? 'Desarrollo'
                      : 'Verificación'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Lienzo de Bloques Arrastrables con Conectores de Flujo */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {sequenceBlocks.map((blk, index) => {
              const isCorrectSpot = sequenceChecked !== 'none' && blk.correctOrder === index + 1;
              const isWrongSpot = sequenceChecked !== 'none' && blk.correctOrder !== index + 1;
              const accent = STEP_ACCENTS[index % STEP_ACCENTS.length];
              const isBeingDragged = draggedSeqIndex === index;

              return (
                <div key={blk.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div
                    draggable
                    onDragStart={(e) => {
                      setDraggedSeqIndex(index);
                      e.dataTransfer.setData('text/plain', String(index));
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const from =
                        draggedSeqIndex !== null
                          ? draggedSeqIndex
                          : Number(e.dataTransfer.getData('text/plain'));
                      if (!Number.isNaN(from)) {
                        handleMoveSeqBlock(from, index);
                      }
                      setDraggedSeqIndex(null);
                    }}
                    onDragEnd={() => setDraggedSeqIndex(null)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '14px',
                      padding: '14px 16px',
                      borderRadius: '14px',
                      cursor: 'grab',
                      opacity: isBeingDragged ? 0.65 : 1,
                      border: `1.5px solid ${
                        isCorrectSpot
                          ? '#10b981'
                          : isWrongSpot
                          ? '#f59e0b'
                          : isDarkMode
                          ? '#283548'
                          : '#cbd5e1'
                      }`,
                      borderLeft: `6px solid ${
                        isCorrectSpot ? '#10b981' : isWrongSpot ? '#f59e0b' : accent.border
                      }`,
                      background: isCorrectSpot
                        ? isDarkMode
                          ? 'rgba(16, 185, 129, 0.14)'
                          : '#f0fdf4'
                        : isWrongSpot
                        ? isDarkMode
                          ? 'rgba(245, 158, 11, 0.14)'
                          : '#fffbeb'
                        : isDarkMode
                        ? '#172033'
                        : '#ffffff',
                      boxShadow: isDarkMode
                        ? '0 4px 12px rgba(0, 0, 0, 0.25)'
                        : '0 2px 8px rgba(15, 23, 42, 0.05)',
                      transition: 'all 0.16s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minWidth: 0 }}>
                      {/* Grip + Número de Posición Actual */}
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px',
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '10px',
                            background: isCorrectSpot
                              ? '#10b981'
                              : isWrongSpot
                              ? '#f59e0b'
                              : isDarkMode
                              ? accent.darkBadgeBg
                              : accent.badgeBg,
                            color:
                              isCorrectSpot || isWrongSpot
                                ? '#ffffff'
                                : isDarkMode
                                ? accent.darkBadgeText
                                : accent.badgeText,
                            fontWeight: 900,
                            fontSize: '0.88rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {index + 1}
                        </span>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 900,
                            color: 'var(--ia-text-muted)',
                            letterSpacing: '1px',
                            userSelect: 'none',
                          }}
                          title="Arrastrar bloque"
                        >
                          ⋮⋮
                        </span>
                      </div>

                      {/* Contenido del Bloque */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              letterSpacing: '0.03em',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: isDarkMode ? 'rgba(148, 163, 184, 0.14)' : '#f1f5f9',
                              color: isDarkMode ? '#cbd5e1' : '#475569',
                            }}
                          >
                            Posición actual #{index + 1}
                          </span>
                          {isCorrectSpot && (
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#10b981' }}>
                              ✓ Paso {blk.correctOrder} en orden correcto
                            </span>
                          )}
                          {isWrongSpot && (
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#f59e0b' }}>
                              Reubicar bloque
                            </span>
                          )}
                        </div>

                        <strong
                          style={{
                            display: 'block',
                            fontSize: '0.92rem',
                            color: 'var(--ia-text-main)',
                            lineHeight: 1.35,
                            marginBottom: '6px',
                          }}
                        >
                          {blk.label}
                        </strong>

                        <div
                          style={{
                            display: 'inline-block',
                            padding: '5px 10px',
                            borderRadius: '8px',
                            background: isDarkMode ? '#0f172a' : '#f8fafc',
                            border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                            fontSize: '0.78rem',
                            color: isDarkMode ? '#93c5fd' : '#1e40af',
                            fontFamily: 'Consolas, monospace',
                            lineHeight: 1.4,
                            wordBreak: 'break-word',
                          }}
                        >
                          {blk.codeOrHint}
                        </div>
                      </div>
                    </div>

                    {/* Botones Accesibles de Subir / Bajar */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flexShrink: 0 }}>
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMoveSeqBlock(index, index - 1)}
                        aria-label="Subir bloque una posición"
                        title="Subir bloque"
                        style={{
                          width: '32px',
                          height: '28px',
                          borderRadius: '8px',
                          border: `1px solid ${isDarkMode ? '#334155' : '#cbd5e1'}`,
                          background: isDarkMode ? '#0f172a' : '#f8fafc',
                          color: 'var(--ia-text-main)',
                          fontWeight: 800,
                          cursor: index === 0 ? 'not-allowed' : 'pointer',
                          opacity: index === 0 ? 0.4 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={index === sequenceBlocks.length - 1}
                        onClick={() => handleMoveSeqBlock(index, index + 1)}
                        aria-label="Bajar bloque una posición"
                        title="Bajar bloque"
                        style={{
                          width: '32px',
                          height: '28px',
                          borderRadius: '8px',
                          border: `1px solid ${isDarkMode ? '#334155' : '#cbd5e1'}`,
                          background: isDarkMode ? '#0f172a' : '#f8fafc',
                          color: 'var(--ia-text-main)',
                          fontWeight: 800,
                          cursor: index === sequenceBlocks.length - 1 ? 'not-allowed' : 'pointer',
                          opacity: index === sequenceBlocks.length - 1 ? 0.4 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {sequenceChecked === 'ok' && (
            <div className="alert alert-success" style={{ marginTop: '4px' }}>
              <CheckCircleIcon size={18} />
              <span>
                <strong>¡Secuencia lógica perfecta!</strong> Ordenaste los 4 pasos de {selectedSubject} correctamente (+50 pts de dominio práctico).
              </span>
            </div>
          )}
          {sequenceChecked === 'retry' && (
            <div className="alert alert-error" style={{ marginTop: '4px' }}>
              <AlertCircleIcon size={18} />
              <span>
                Los bloques marcados en <strong>verde</strong> ya están en su posición correcta. Arrastra o usa las flechas <strong>↑ / ↓</strong> en los bloques en ámbar para completar la secuencia.
              </span>
            </div>
          )}

          {/* Historial de Intentos Recientes */}
          {quizHistory.length > 0 && (
            <div style={{ borderTop: '1px solid var(--ia-border)', paddingTop: '14px', marginTop: '4px' }}>
              <h4 style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--ia-text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', margin: '0 0 10px 0' }}>
                Tu Historial de Práctica Reciente ({quizHistory.length})
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '8px' }}>
                {quizHistory.slice(0, 4).map((attempt, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1px solid var(--ia-border)',
                      background: 'var(--ia-bg-subtle)',
                      fontSize: '0.78rem',
                    }}
                  >
                    <div style={{ fontWeight: 800, color: 'var(--ia-text-main)' }}>{attempt.subject}</div>
                    <div style={{ color: isDarkMode ? '#c4b5fd' : '#6d28d9', fontWeight: 600 }}>
                      {attempt.theme}
                    </div>
                    <div style={{ color: isDarkMode ? '#6ee7b7' : '#15803d', fontWeight: 700, marginTop: '3px' }}>
                      {attempt.score} pts ({attempt.totalQuestions} preguntas)
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
