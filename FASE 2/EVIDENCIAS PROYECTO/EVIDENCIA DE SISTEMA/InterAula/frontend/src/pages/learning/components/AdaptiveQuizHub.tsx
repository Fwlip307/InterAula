import { useState, useEffect, useMemo } from 'react';
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
  buildQuizAnswerRecord,
  computeCumulativeQuizStats,
  summarizeQuizSession,
  type QuizAnswerRecord,
} from '../../../utils/quizAnalytics';
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
  LayersIcon,
  AwardIcon,
} from '../../../components/common/Icons';
import { ReadAloudControls } from '../../../components/common/ReadAloudControls';
import '../../../styles/gamifiedQuiz.css';

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

export default function AdaptiveQuizHub({ isCalmMode: calmProp = false }: AdaptiveQuizHubProps) {
  const { user } = useAuth();
  const { isCalmMode: calmCtx, preferences } = useCalmMode();
  const effectiveCalm = calmProp || calmCtx;

  const [studioMode, setStudioMode] = useState<'quiz' | 'sequence'>('quiz');
  const [subjects, setSubjects] = useState<string[]>(CRITICAL_SUBJECTS);
  const [selectedSubject, setSelectedSubject] = useState<string>(CRITICAL_SUBJECTS[0]);
  const [customTopic, setCustomTopic] = useState<string>('');
  const [selectedTheme, setSelectedTheme] = useState<InterestTheme>(INTEREST_THEMES[0]);
  const [neededSubjectsList, setNeededSubjectsList] = useState<NeededSubject[]>([]);
  const [untimedMode, setUntimedMode] = useState<boolean>(preferences.untimedQuizzes !== false);
  const [quizHistory, setQuizHistory] = useState<QuizAttemptProgress[]>(() =>
    adaptiveQuizService.getQuizHistory()
  );

  useEffect(() => {
    setUntimedMode(preferences.untimedQuizzes !== false);
  }, [preferences.untimedQuizzes]);

  // Estado del desafío interactivo de preguntas
  const [questions, setQuestions] = useState<AdaptiveQuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [pendingOptionId, setPendingOptionId] = useState<string | null>(null);
  const [confirmedOptionId, setConfirmedOptionId] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [score, setScore] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [answerRecords, setAnswerRecords] = useState<QuizAnswerRecord[]>([]);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [loadingQuiz, setLoadingQuiz] = useState(false);

  // Estado para el Constructor Lógico de 4 Bloques IA
  const [seqVariantSeed, setSeqVariantSeed] = useState<number>(0);
  const initialChallenge = getSequenceStepsForSubject(CRITICAL_SUBJECTS[0], 0, '');
  const [sequenceTitle, setSequenceTitle] = useState<string>(initialChallenge.title);
  const [sequenceScenario, setSequenceScenario] = useState<string>(initialChallenge.scenario);
  const [sequenceBlocks, setSequenceBlocks] = useState<SequenceStepItem[]>(() =>
    scrambleSteps(initialChallenge.steps, 0)
  );
  const [loadingSequenceAI, setLoadingSequenceAI] = useState<boolean>(false);
  const [sequenceSourceLabel, setSequenceSourceLabel] = useState<string>('Motor IA DUA');
  const [draggedSeqIndex, setDraggedSeqIndex] = useState<number | null>(null);
  const [sequenceChecked, setSequenceChecked] = useState<'none' | 'ok' | 'retry'>('none');

  const isAnswered = confirmedOptionId !== null;
  const currentQ = questions[currentIdx];
  const topicSuggestions = getTopicSuggestions(selectedSubject);

  const cumulativeStats = useMemo(
    () => computeCumulativeQuizStats(quizHistory),
    [quizHistory]
  );

  const sessionSummary = useMemo(
    () => summarizeQuizSession(answerRecords, questions.length || 3, score, selectedSubject),
    [answerRecords, questions.length, score, selectedSubject]
  );

  const handleResetSequenceForSubject = (subj: string, topicValue = customTopic) => {
    const nextSeed = seqVariantSeed + 1;
    setSeqVariantSeed(nextSeed);
    const localData = getSequenceStepsForSubject(subj, nextSeed, topicValue);
    setSequenceTitle(localData.title);
    setSequenceScenario(localData.scenario);
    setSequenceBlocks(scrambleSteps(localData.steps, nextSeed));
    setSequenceChecked('none');
  };

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
      if (sequenceChecked !== 'ok') {
        setScore((prev) => prev + 50);
      }
      setSequenceChecked('ok');
    } else {
      setSequenceChecked('retry');
    }
  };

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
    void loadStudentNeeds();
  }, [user]);

  const handleStartQuiz = async () => {
    setStudioMode('quiz');
    setLoadingQuiz(true);
    setQuizCompleted(false);
    setCurrentIdx(0);
    setPendingOptionId(null);
    setConfirmedOptionId(null);
    setShowHint(false);
    setScore(0);
    setCurrentStreak(0);
    setAnswerRecords([]);

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

  const handleChooseOption = (optionId: string) => {
    if (isAnswered) return;
    setPendingOptionId(optionId);
  };

  const handleConfirmAnswer = () => {
    if (!currentQ || !pendingOptionId || isAnswered) return;
    setConfirmedOptionId(pendingOptionId);

    const record = buildQuizAnswerRecord(currentQ, pendingOptionId, showHint);
    setAnswerRecords((prev) => [...prev, record]);

    if (record.isCorrect) {
      setScore((prev) => prev + 100);
      setCurrentStreak((prev) => prev + 1);
    } else {
      setCurrentStreak(0);
    }
  };

  const handleNextQuestion = () => {
    if (currentIdx + 1 < questions.length) {
      setCurrentIdx((prev) => prev + 1);
      setPendingOptionId(null);
      setConfirmedOptionId(null);
      setShowHint(false);
    } else {
      setQuizCompleted(true);
      adaptiveQuizService.saveQuizProgress({
        subject: selectedSubject,
        theme: selectedTheme.name,
        score,
        totalQuestions: questions.length,
        completedAt: new Date().toISOString(),
      });
      setQuizHistory(adaptiveQuizService.getQuizHistory());
    }
  };

  const handleReturnToSetup = () => {
    setQuestions([]);
    setQuizCompleted(false);
    setPendingOptionId(null);
    setConfirmedOptionId(null);
    setShowHint(false);
  };

  useEffect(() => {
    if (studioMode !== 'quiz' || !currentQ || quizCompleted || loadingQuiz) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      const key = e.key.toLowerCase();
      const idxMap: Record<string, number> = {
        '1': 0, '2': 1, '3': 2, '4': 3,
        a: 0, b: 1, c: 2, d: 3,
      };

      if (!isAnswered && key in idxMap) {
        const opt = currentQ.options[idxMap[key]];
        if (opt) {
          e.preventDefault();
          setPendingOptionId(opt.id);
        }
      } else if (e.key === 'Enter' && !e.shiftKey && target?.tagName !== 'BUTTON') {
        if (!isAnswered && pendingOptionId) {
          e.preventDefault();
          handleConfirmAnswer();
        } else if (isAnswered) {
          e.preventDefault();
          handleNextQuestion();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [studioMode, currentQ, quizCompleted, loadingQuiz, isAnswered, pendingOptionId]);

  const activeQuizInProgress = studioMode === 'quiz' && questions.length > 0 && !quizCompleted;
  const answeredSoFar = answerRecords.length;
  const totalInRun = Math.max(questions.length, 1);
  const progressPct = Math.round((answeredSoFar / totalInRun) * 100);

  const ringRadius = 44;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset =
    ringCircumference - (sessionSummary.accuracyPercent / 100) * ringCircumference;

  return (
    <div className="ia-gquiz-shell" data-calm={effectiveCalm ? 'true' : 'false'}>
      <header className="ia-gquiz-hud">
        <div className="ia-gquiz-hud-copy">
          <span className="ia-gquiz-kicker">
            <SparklesIcon size={14} /> Práctica interactiva adaptada a tus intereses
          </span>
          <h2>Desafíos de Aprendizaje con IA</h2>
          <p>
            Pon a prueba lo que estudias con retos breves, pistas paso a paso y ejemplos conectados con lo que te gusta.
          </p>
        </div>

        <div className="ia-gquiz-hud-stats" aria-label="Indicadores de práctica">
          <div className="ia-gquiz-stat-pill ia-gquiz-stat-pill--accent">
            <SparklesIcon size={17} color="var(--ia-primary)" />
            <div className="ia-gquiz-stat-meta">
              <span className="ia-gquiz-stat-label">Puntos sesión</span>
              <span className="ia-gquiz-stat-value">{score} pts</span>
            </div>
          </div>

          {currentStreak > 0 && (
            <div className="ia-gquiz-stat-pill ia-gquiz-stat-pill--streak">
              <AwardIcon size={17} color="currentColor" />
              <div className="ia-gquiz-stat-meta">
                <span className="ia-gquiz-stat-label">Racha actual</span>
                <span className="ia-gquiz-stat-value">{currentStreak} seguidas</span>
              </div>
            </div>
          )}

          {cumulativeStats.completedSessions > 0 && (
            <div className="ia-gquiz-stat-pill">
              <CheckCircleIcon size={17} color="var(--ia-success)" />
              <div className="ia-gquiz-stat-meta">
                <span className="ia-gquiz-stat-label">Partidas jugadas</span>
                <span className="ia-gquiz-stat-value">{cumulativeStats.completedSessions}</span>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="ia-gquiz-mode-bar">
        <div className="ia-gquiz-mode-tabs" role="tablist" aria-label="Modalidad de práctica">
          <button
            type="button"
            role="tab"
            aria-selected={studioMode === 'quiz'}
            className={`ia-gquiz-mode-tab ${studioMode === 'quiz' ? 'is-active' : ''}`}
            onClick={() => setStudioMode('quiz')}
          >
            <TargetIcon size={16} />
            <span>Desafío de preguntas</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={studioMode === 'sequence'}
            className={`ia-gquiz-mode-tab ${studioMode === 'sequence' ? 'is-active' : ''}`}
            onClick={() => setStudioMode('sequence')}
          >
            <LayersIcon size={16} />
            <span>Constructor lógico (4 bloques)</span>
          </button>
        </div>

        {activeQuizInProgress && (
          <button type="button" className="ia-btn-secondary" onClick={handleReturnToSetup}>
            Cambiar asignatura o interés
          </button>
        )}
      </div>

      {studioMode === 'quiz' && (
        <>
          {quizCompleted && questions.length > 0 ? (
            <section className="ia-gquiz-results" aria-labelledby="gquiz-results-title">
              <div className="ia-gquiz-results-hero">
                <div className="ia-gquiz-ring-wrap" aria-hidden="true">
                  <svg className="ia-gquiz-ring-svg" viewBox="0 0 108 108">
                    <circle className="ia-gquiz-ring-track" cx="54" cy="54" r={ringRadius} />
                    <circle
                      className={`ia-gquiz-ring-fill ${
                        sessionSummary.accuracyPercent >= 66 ? 'is-high' : ''
                      }`}
                      cx="54"
                      cy="54"
                      r={ringRadius}
                      strokeDasharray={ringCircumference}
                      strokeDashoffset={ringOffset}
                    />
                  </svg>
                  <div className="ia-gquiz-ring-center">
                    <span className="ia-gquiz-ring-pct">{sessionSummary.accuracyPercent}%</span>
                    <span className="ia-gquiz-ring-sub">Precisión</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span className="ia-badge ia-badge-success">{sessionSummary.levelBadge}</span>
                    <span className="ia-badge ia-badge-blue">{selectedTheme.name}</span>
                  </div>
                  <h3 id="gquiz-results-title" style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: 'var(--ia-text-main)' }}>
                    {sessionSummary.motivationalTitle}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--ia-text-body)', lineHeight: 1.55 }}>
                    {sessionSummary.motivationalCopy}
                  </p>
                  <span style={{ fontSize: '0.78rem', color: 'var(--ia-text-muted)' }}>
                    Puntaje de práctica formativa (no equivale a nota oficial ni acreditación de tutor).
                  </span>
                </div>
              </div>

              <div className="ia-gquiz-results-metrics">
                <div className="ia-gquiz-metric-box">
                  <strong>{sessionSummary.correctCount} / {sessionSummary.totalQuestions}</strong>
                  <span>Respuestas correctas</span>
                </div>
                <div className="ia-gquiz-metric-box">
                  <strong>{sessionSummary.answeredCount}</strong>
                  <span>Preguntas respondidas</span>
                </div>
                <div className="ia-gquiz-metric-box">
                  <strong>{sessionSummary.practicePoints} pts</strong>
                  <span>Puntos de práctica</span>
                </div>
                <div className="ia-gquiz-metric-box">
                  <strong>{sessionSummary.bestStreak}</strong>
                  <span>Mejor racha seguida</span>
                </div>
              </div>

              <div className="ia-gquiz-insights-grid">
                <div className="ia-gquiz-insight-card">
                  <h4>
                    <CheckCircleIcon size={16} color="var(--ia-success)" />
                    <span>Fortalezas en esta partida ({sessionSummary.strengths.length})</span>
                  </h4>
                  {sessionSummary.strengths.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--ia-text-muted)' }}>
                      Aún no hubo aciertos en este intento. Revisa la explicación de cada pregunta abajo y vuelve a intentarlo sin prisa.
                    </p>
                  ) : (
                    <ul>
                      {sessionSummary.strengths.map((item) => (
                        <li key={item.questionId}>
                          {item.prompt}
                          {item.usedHint ? ' (resuelta con pista)' : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="ia-gquiz-insight-card">
                  <h4>
                    <TargetIcon size={16} color="var(--ia-amber)" />
                    <span>Contenidos que conviene reforzar ({sessionSummary.toReinforce.length})</span>
                  </h4>
                  {sessionSummary.toReinforce.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--ia-text-muted)' }}>
                      ¡No registraste errores en esta ronda! Puedes explorar un tema más específico o pasar al constructor de bloques.
                    </p>
                  ) : (
                    <>
                      <ul>
                        {sessionSummary.toReinforce.map((item) => (
                          <li key={item.questionId}>{item.prompt}</li>
                        ))}
                      </ul>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                        <Link
                          to={`/tutoring?search=${encodeURIComponent(selectedSubject)}`}
                          className="ia-btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        >
                          Buscar tutor en {selectedSubject}
                        </Link>
                        <Link
                          to="/resources"
                          className="ia-btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        >
                          Revisar apuntes
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {answerRecords.length > 0 && (
                <details className="ia-guided-disclosure">
                  <summary>Revisar mis respuestas y explicaciones ({answerRecords.length})</summary>
                  <div className="ia-gquiz-review-list">
                    {answerRecords.map((rec, idx) => (
                      <div key={`${rec.questionId}-${idx}`} className="ia-gquiz-review-item">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '0.9rem', color: 'var(--ia-text-main)' }}>
                            Pregunta {idx + 1}: {rec.prompt}
                          </strong>
                          <span className={`ia-badge ${rec.isCorrect ? 'ia-badge-success' : 'ia-badge-amber'}`}>
                            {rec.isCorrect ? 'Correcta' : 'Por reforzar'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.83rem', color: 'var(--ia-text-body)' }}>
                          <strong>Tu respuesta:</strong> {rec.selectedOptionText}
                        </div>
                        {!rec.isCorrect && (
                          <div style={{ fontSize: '0.83rem', color: 'var(--ia-success)', fontWeight: 600 }}>
                            <strong>Respuesta correcta:</strong> {rec.correctOptionText}
                          </div>
                        )}
                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--ia-text-muted)', lineHeight: 1.5 }}>
                          {rec.explanation}
                        </p>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              <div className="ia-gquiz-action-bar">
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="ia-btn-primary"
                    onClick={() => void handleStartQuiz()}
                    disabled={loadingQuiz}
                  >
                    <RotateCcwIcon size={16} />
                    <span>{loadingQuiz ? 'Generando preguntas...' : 'Intentar nuevo desafío'}</span>
                  </button>
                  <button
                    type="button"
                    className="ia-btn-secondary"
                    onClick={() => setStudioMode('sequence')}
                  >
                    <LayersIcon size={16} />
                    <span>Practicar en Constructor de Bloques</span>
                  </button>
                </div>

                <button type="button" className="ia-btn-secondary" onClick={handleReturnToSetup}>
                  Elegir otra materia o interés
                </button>
              </div>
            </section>
          ) : activeQuizInProgress && currentQ ? (
            <section className="ia-gquiz-arena" aria-label="Pregunta actual del cuestionario">
              <div className="ia-gquiz-progress-header">
                <div className="ia-gquiz-progress-meta">
                  <div className="ia-gquiz-quest-badges">
                    <span className="ia-badge ia-badge-blue">{currentQ.subject}</span>
                    <span className="ia-badge ia-badge-neutral">{currentQ.themeLabel}</span>
                    {untimedMode && <span className="ia-badge ia-badge-success">Sin reloj</span>}
                  </div>
                  <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--ia-text-body)' }}>
                    Pregunta {currentIdx + 1} de {questions.length} · {progressPct}% completado
                  </span>
                </div>

                <div className="ia-gquiz-progress-bar-wrap">
                  <div
                    className="ia-gquiz-progress-track"
                    role="progressbar"
                    aria-valuenow={progressPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Avance del cuestionario: ${progressPct}%`}
                  >
                    <div
                      className="ia-gquiz-progress-fill"
                      style={{
                        width: `${Math.max(
                          progressPct,
                          Math.round(((currentIdx + 0.35) / questions.length) * 100)
                        )}%`,
                      }}
                    />
                  </div>

                  <div className="ia-gquiz-step-nodes" aria-label="Estado por pregunta">
                    {questions.map((qItem, idx) => {
                      const prevRec = answerRecords[idx];
                      const status = prevRec
                        ? prevRec.isCorrect
                          ? 'correct'
                          : 'incorrect'
                        : idx === currentIdx
                          ? 'current'
                          : 'pending';
                      return (
                        <span
                          key={qItem.id}
                          className="ia-gquiz-step-node"
                          data-status={status}
                          title={
                            status === 'correct'
                              ? `Pregunta ${idx + 1}: Correcta`
                              : status === 'incorrect'
                                ? `Pregunta ${idx + 1}: Por reforzar`
                                : status === 'current'
                                  ? `Pregunta ${idx + 1}: Actual`
                                  : `Pregunta ${idx + 1}: Pendiente`
                          }
                        >
                          {status === 'correct' ? '✓' : idx + 1}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="ia-gquiz-question-box">
                <div className="ia-gquiz-analogy-banner">
                  <div>
                    <strong style={{ color: 'var(--ia-primary)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '2px' }}>
                      Contexto aplicado · {currentQ.themeLabel}
                    </strong>
                    <span>{currentQ.analogyContext}</span>
                  </div>
                  <ReadAloudControls
                    compact
                    text={[
                      currentQ.analogyContext,
                      currentQ.prompt,
                      ...currentQ.options.map(
                        (o, i) => `Alternativa ${String.fromCharCode(65 + i)}: ${o.text}`
                      ),
                    ].join('. ')}
                    label="Escuchar"
                  />
                </div>

                <h3 className="ia-gquiz-prompt">{currentQ.prompt}</h3>

                {currentQ.codeSnippet && (
                  <pre className="ia-gquiz-code">{currentQ.codeSnippet}</pre>
                )}
              </div>

              <div className="ia-gquiz-options-grid" role="radiogroup" aria-label="Alternativas de respuesta">
                {currentQ.options.map((opt, idx) => {
                  const letter = String.fromCharCode(65 + idx);
                  const isPendingSelected = !isAnswered && pendingOptionId === opt.id;
                  const isRightAnswer = opt.id === currentQ.correctOptionId;
                  const isChosenWrong = isAnswered && confirmedOptionId === opt.id && !isRightAnswer;

                  let optionState: 'normal' | 'selected' | 'correct' | 'incorrect' | 'disabled' = 'normal';
                  if (!isAnswered) {
                    optionState = isPendingSelected ? 'selected' : 'normal';
                  } else if (isRightAnswer) {
                    optionState = 'correct';
                  } else if (isChosenWrong) {
                    optionState = 'incorrect';
                  } else {
                    optionState = 'disabled';
                  }

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={isAnswered ? confirmedOptionId === opt.id : isPendingSelected}
                      disabled={isAnswered}
                      data-state={optionState}
                      className="ia-gquiz-option"
                      onClick={() => handleChooseOption(opt.id)}
                    >
                      <span className="ia-gquiz-option-key" aria-hidden="true">
                        {letter}
                      </span>
                      <span className="ia-gquiz-option-text">{opt.text}</span>
                      <span className="ia-gquiz-option-indicator" aria-hidden="true">
                        {optionState === 'correct' && <CheckIcon size={18} color="var(--ia-success)" />}
                        {optionState === 'incorrect' && <XIcon size={18} color="var(--ia-danger)" />}
                        {optionState === 'selected' && <CheckIcon size={17} color="var(--ia-primary)" />}
                      </span>
                    </button>
                  );
                })}
              </div>

              {showHint && (
                <div className="ia-gquiz-hint-box" role="status">
                  <div className="ia-gquiz-hint-title">
                    <LightbulbIcon size={16} />
                    <span>Pista paso a paso</span>
                  </div>
                  <div>{currentQ.hintStepByStep}</div>
                </div>
              )}

              {isAnswered && (
                <div
                  className={`ia-gquiz-feedback-banner ${
                    confirmedOptionId === currentQ.correctOptionId ? 'is-correct' : 'is-incorrect'
                  }`}
                  role="status"
                >
                  <div className="ia-gquiz-feedback-head">
                    <span className="ia-gquiz-feedback-title">
                      {confirmedOptionId === currentQ.correctOptionId ? (
                        <>
                          <CheckCircleIcon size={19} />
                          <span>¡Respuesta correcta! +100 pts de práctica</span>
                        </>
                      ) : (
                        <>
                          <AlertCircleIcon size={19} />
                          <span>Revisemos el razonamiento clave</span>
                        </>
                      )}
                    </span>
                    <ReadAloudControls compact text={currentQ.explanation} label="Escuchar explicación" />
                  </div>
                  <p className="ia-gquiz-feedback-body">{currentQ.explanation}</p>
                </div>
              )}

              <div className="ia-gquiz-action-bar">
                {!isAnswered ? (
                  <>
                    <button
                      type="button"
                      className="ia-btn-secondary"
                      onClick={() => setShowHint((prev) => !prev)}
                    >
                      <LightbulbIcon size={15} />
                      <span>{showHint ? 'Ocultar pista' : 'Pedir pista paso a paso'}</span>
                    </button>

                    <button
                      type="button"
                      className="ia-btn-primary"
                      disabled={!pendingOptionId}
                      onClick={handleConfirmAnswer}
                    >
                      <span>Comprobar respuesta</span>
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '0.82rem', color: 'var(--ia-text-muted)' }}>
                      {currentIdx + 1 < questions.length
                        ? `Quedan ${questions.length - (currentIdx + 1)} pregunta(s) en esta ronda`
                        : 'Completaste todas las preguntas de la ronda'}
                    </span>

                    <button
                      type="button"
                      className="ia-btn-primary"
                      onClick={handleNextQuestion}
                    >
                      <span>
                        {currentIdx + 1 < questions.length
                          ? 'Siguiente pregunta'
                          : 'Ver pantalla de resultados'}
                      </span>
                    </button>
                  </>
                )}
              </div>
            </section>
          ) : (
            <section className="ia-gquiz-setup-card" aria-label="Configurar desafío de preguntas">
              <div className="ia-gquiz-setup-step">
                <div className="ia-gquiz-step-label">
                  <span className="ia-gquiz-step-num">1</span>
                  <span>Elige la asignatura que quieres practicar</span>
                </div>
                <div className="ia-gquiz-subject-pills">
                  {subjects.map((sub) => {
                    const isSelected = selectedSubject === sub;
                    const isProfileNeeded = neededSubjectsList.some((n) => n.subject?.name === sub);
                    return (
                      <button
                        key={sub}
                        type="button"
                        className={`ia-gquiz-subject-pill ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => {
                          setSelectedSubject(sub);
                          handleResetSequenceForSubject(sub, customTopic);
                        }}
                      >
                        <BookOpenIcon size={14} />
                        <span>{sub}</span>
                        {isProfileNeeded && (
                          <span className="ia-badge ia-badge-amber" style={{ fontSize: '0.66rem', padding: '1px 6px' }}>
                            Tu meta
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="ia-gquiz-setup-step">
                <div className="ia-gquiz-step-label">
                  <span className="ia-gquiz-step-num">2</span>
                  <span>Conecta los ejercicios con un tema de tu interés</span>
                </div>
                <div className="ia-gquiz-theme-grid">
                  {INTEREST_THEMES.map((theme) => {
                    const isSelected = selectedTheme.id === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        className={`ia-gquiz-theme-card ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => setSelectedTheme(theme)}
                      >
                        <span className="ia-gquiz-theme-tag">{theme.emoji}</span>
                        <div>
                          <div className="ia-gquiz-theme-title">{theme.name}</div>
                          <div className="ia-gquiz-theme-desc">{theme.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <details className="ia-guided-disclosure" open={Boolean(customTopic.trim())}>
                <summary>Personalizar contenido específico o ajustes de tiempo (opcional)</summary>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '4px' }}>
                  <div>
                    <label htmlFor="quiz-custom-topic" className="ia-label">
                      Contenido o unidad puntual de {selectedSubject}
                    </label>
                    <input
                      id="quiz-custom-topic"
                      type="text"
                      className="ia-input"
                      placeholder={`Ej: ${topicSuggestions[0]}`}
                      value={customTopic}
                      onChange={(e) => setCustomTopic(e.target.value)}
                    />
                    <div className="ia-gquiz-topic-chips">
                      {topicSuggestions.map((sug) => (
                        <button
                          key={sug}
                          type="button"
                          className={`ia-gquiz-topic-chip ${customTopic === sug ? 'is-active' : ''}`}
                          onClick={() => setCustomTopic(customTopic === sug ? '' : sug)}
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', color: 'var(--ia-text-body)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={untimedMode}
                      onChange={(e) => setUntimedMode(e.target.checked)}
                    />
                    <span>Practicar sin presión de cronómetro y con pistas habilitadas</span>
                  </label>
                </div>
              </details>

              <div className="ia-gquiz-launch-bar">
                <span style={{ fontSize: '0.84rem', color: 'var(--ia-text-muted)' }}>
                  3 preguntas dinámicas · Pistas paso a paso · Retroalimentación inmediata
                </span>

                <button
                  type="button"
                  className="ia-btn-primary ia-gquiz-launch-cta"
                  onClick={() => void handleStartQuiz()}
                  disabled={loadingQuiz}
                >
                  <SparklesIcon size={17} color="#ffffff" />
                  <span>{loadingQuiz ? 'Preparando tu desafío con IA...' : 'Iniciar desafío interactivo'}</span>
                </button>
              </div>
            </section>
          )}
        </>
      )}

      {studioMode === 'sequence' && (
        <section className="ia-gquiz-seq-card" aria-label="Constructor de secuencia lógica">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                <span className="ia-badge ia-badge-blue">{selectedSubject}</span>
                <span className="ia-badge ia-badge-neutral">{sequenceSourceLabel}</span>
              </div>
              <h3 style={{ margin: '0 0 4px', fontSize: '1.18rem', fontWeight: 800, color: 'var(--ia-text-main)' }}>
                {sequenceTitle}
              </h3>
              <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--ia-text-body)', lineHeight: 1.5 }}>
                {sequenceScenario}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <select
                aria-label="Cambiar asignatura del reto de bloques"
                className="ia-select"
                style={{ width: 'auto', minWidth: '190px' }}
                value={selectedSubject}
                onChange={(e) => {
                  const sub = e.target.value;
                  setSelectedSubject(sub);
                  handleResetSequenceForSubject(sub, customTopic);
                  void handleGenerateAISequenceBlocks(sub, selectedTheme, customTopic);
                }}
              >
                {subjects.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="ia-btn-secondary"
                disabled={loadingSequenceAI}
                onClick={() => void handleGenerateAISequenceBlocks(selectedSubject, selectedTheme, customTopic)}
              >
                <RotateCcwIcon size={15} />
                <span>{loadingSequenceAI ? 'Generando...' : 'Nuevo reto IA'}</span>
              </button>
            </div>
          </div>

          <div className="ia-gquiz-seq-list">
            {sequenceBlocks.map((blk, index) => {
              const isCorrectSpot = sequenceChecked !== 'none' && blk.correctOrder === index + 1;
              const isWrongSpot = sequenceChecked !== 'none' && blk.correctOrder !== index + 1;

              return (
                <div
                  key={blk.id}
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
                  className={`ia-gquiz-seq-item ${isCorrectSpot ? 'is-correct-slot' : ''}`}
                  style={{
                    opacity: draggedSeqIndex === index ? 0.65 : 1,
                    borderColor: isWrongSpot ? 'var(--ia-amber)' : undefined,
                    borderLeftColor: isWrongSpot ? 'var(--ia-amber)' : undefined,
                  }}
                >
                  <span className="ia-gquiz-seq-slot-num">
                    {isCorrectSpot ? '✓' : index + 1}
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '3px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--ia-text-muted)', textTransform: 'uppercase' }}>
                        Paso #{index + 1}
                      </span>
                      {isCorrectSpot && (
                        <span className="ia-badge ia-badge-success">Posición correcta</span>
                      )}
                      {isWrongSpot && (
                        <span className="ia-badge ia-badge-amber">Mover de posición</span>
                      )}
                    </div>
                    <strong style={{ display: 'block', fontSize: '0.92rem', color: 'var(--ia-text-main)', marginBottom: '4px' }}>
                      {blk.label}
                    </strong>
                    <code
                      style={{
                        display: 'inline-block',
                        fontSize: '0.78rem',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: 'var(--ia-bg-subtle)',
                        border: '1px solid var(--ia-border)',
                        color: 'var(--ia-primary)',
                        wordBreak: 'break-word',
                      }}
                    >
                      {blk.codeOrHint}
                    </code>
                  </div>

                  <div className="ia-gquiz-seq-controls">
                    <button
                      type="button"
                      className="ia-gquiz-seq-arrow"
                      disabled={index === 0}
                      onClick={() => handleMoveSeqBlock(index, index - 1)}
                      aria-label="Subir bloque una posición"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="ia-gquiz-seq-arrow"
                      disabled={index === sequenceBlocks.length - 1}
                      onClick={() => handleMoveSeqBlock(index, index + 1)}
                      aria-label="Bajar bloque una posición"
                    >
                      ↓
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {sequenceChecked === 'ok' && (
            <div className="ia-gquiz-feedback-banner is-correct" role="status">
              <span className="ia-gquiz-feedback-title">
                <CheckCircleIcon size={18} />
                <span>¡Secuencia lógica completada! +50 pts de práctica</span>
              </span>
              <p className="ia-gquiz-feedback-body">
                Ordenaste correctamente los 4 pasos de {selectedSubject}. Puedes generar una variante nueva o volver al desafío de preguntas.
              </p>
            </div>
          )}

          {sequenceChecked === 'retry' && (
            <div className="ia-gquiz-feedback-banner is-incorrect" role="status">
              <span className="ia-gquiz-feedback-title">
                <AlertCircleIcon size={18} />
                <span>Algunos pasos aún no están en su orden lógico</span>
              </span>
              <p className="ia-gquiz-feedback-body">
                Los pasos marcados como correctos ya están en su lugar. Arrastra o usa las flechas ↑ / ↓ en los pasos restantes y vuelve a comprobar.
              </p>
            </div>
          )}

          <div className="ia-gquiz-action-bar">
            <span style={{ fontSize: '0.82rem', color: 'var(--ia-text-muted)' }}>
              Arrastra las tarjetas o usa los botones ↑ / ↓ con teclado o pantalla táctil.
            </span>
            <button type="button" className="ia-btn-primary" onClick={handleCheckSequence}>
              <CheckIcon size={16} color="#ffffff" />
              <span>Comprobar secuencia</span>
            </button>
          </div>
        </section>
      )}

      {quizHistory.length > 0 && (
        <details className="ia-card" style={{ margin: 0, padding: '14px 18px' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', color: 'var(--ia-text-main)' }}>
            Historial de partidas recientes ({quizHistory.length})
          </summary>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))',
              gap: '10px',
              marginTop: '12px',
            }}
          >
            {quizHistory.slice(0, 6).map((attempt, idx) => (
              <div
                key={`${attempt.completedAt}-${idx}`}
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--ia-border)',
                  background: 'var(--ia-bg-subtle)',
                  fontSize: '0.8rem',
                }}
              >
                <div style={{ fontWeight: 700, color: 'var(--ia-text-main)' }}>{attempt.subject}</div>
                <div style={{ color: 'var(--ia-text-muted)', fontSize: '0.75rem' }}>{attempt.theme}</div>
                <div style={{ color: 'var(--ia-primary)', fontWeight: 700, marginTop: '3px' }}>
                  {attempt.score} pts · {attempt.totalQuestions} preguntas
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
