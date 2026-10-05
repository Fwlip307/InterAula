export interface StudyResource {
  id: string;
  title: string;
  subject: string;
  category: 'Resumen' | 'Guia de Ejercicios' | 'Cheatsheet' | 'Formulario';
  semester: string;
  author: string;
  authorCareer: string;
  downloadsCount: number;
  rating: number;
  description: string;
  topics: string[];
  contentSummary: string;
}

export interface QuizQuestion {
  id: string;
  subject: string;
  difficulty: 'Basico' | 'Intermedio' | 'Avanzado';
  question: string;
  codeSnippet?: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Flashcard {
  id: string;
  subject: string;
  term: string;
  definition: string;
  example?: string;
  category: string;
}

export const STUDY_RESOURCES: StudyResource[] = [
  {
    id: 'res-1',
    title: 'Guia Completa de Algoritmos y Estructuras de Control',
    subject: 'Programacion de Algoritmos',
    category: 'Resumen',
    semester: '1er Semestre',
    author: 'Equipo de Tutores InterAula',
    authorCareer: 'Ingenieria en Informatica',
    downloadsCount: 142,
    rating: 4.9,
    description: 'Sintesis conceptual con pseudocodigo y ejemplos en Python sobre bucles for, while, condicionales anidados y funciones recursivas.',
    topics: ['Bucles for y while', 'Condicionales if-elif-else', 'Funciones y Alcance', 'Arreglos y Listas'],
    contentSummary: 'Incluye 15 ejercicios resueltos paso a paso con diagrama de flujo y tablas de traza de variables para preparar certamenes.',
  },
  {
    id: 'res-2',
    title: 'CheatSheet SQL: Consultas, JOINs y Agrupaciones',
    subject: 'Modelamiento y Bases de Datos',
    category: 'Cheatsheet',
    semester: '2do Semestre',
    author: 'miguel angel',
    authorCareer: 'Ingenieria en Administracion mencion Marketing',
    downloadsCount: 98,
    rating: 4.8,
    description: 'Hoja de referencia rapida de sintaxis SQL estandar (PostgreSQL / MySQL) para INNER JOIN, LEFT JOIN, GROUP BY, HAVING y subconsultas.',
    topics: ['SELECT y Filtros WHERE', 'INNER vs LEFT JOIN', 'Funciones de Agregacion', 'Indices y Claves'],
    contentSummary: 'Diagrama visual de teoria de conjuntos para entender los cruces de tablas relacionales sin confusiones.',
  },
  {
    id: 'res-3',
    title: 'Manual Practico de POO: Clases, Herencia y Polimorfismo',
    subject: 'Programacion Orientada a Objetos',
    category: 'Guia de Ejercicios',
    semester: '2do Semestre',
    author: 'Comunidad InterAula',
    authorCareer: 'Ingenieria en Informatica',
    downloadsCount: 115,
    rating: 4.9,
    description: 'Guia estructurada con casos reales de modelamiento de clases, metodos abstractos, interfaces y patrones de diseno basicos.',
    topics: ['Encapsulamiento', 'Herencia Simple y Multiple', 'Polimorfismo de Sobrecarga', 'Modificadores de Acceso'],
    contentSummary: 'Contiene 8 casos de estudio practicos de aplicacion empresarial comentados linea a linea.',
  },
  {
    id: 'res-4',
    title: 'Resumen de Tablas de Verdad y Algebra Booleana',
    subject: 'Nivelacion Matematica',
    category: 'Formulario',
    semester: '1er Semestre',
    author: 'Tutores Pares Validados',
    authorCareer: 'Ingenieria Industrial',
    downloadsCount: 87,
    rating: 4.7,
    description: 'Formulario y leyes fundamentales de De Morgan, conectores logicos (conjunction, disyuncion, condicional y bicondicional) y simplificacion.',
    topics: ['Proposiciones Logicas', 'Leyes de De Morgan', 'Tablas de Verdad', 'Compuertas Logicas'],
    contentSummary: 'Ideal para repasar antes de evaluaciones de logica matematica y computacional.',
  },
  {
    id: 'res-5',
    title: 'Guia Rapida: Arquitectura Web, DOM y Peticiones Fetch',
    subject: 'Programacion Web',
    category: 'Resumen',
    semester: '3er Semestre',
    author: 'miguel angel',
    authorCareer: 'Ingenieria en Administracion mencion Marketing',
    downloadsCount: 130,
    rating: 5.0,
    description: 'Explicacion visual del ciclo de vida del DOM en el navegador, promesas asincronas con async/await y manejo de estados.',
    topics: ['Manipulacion del DOM', 'Eventos y Formularios', 'Fetch API y JSON', 'Buenas Practicas Frontend'],
    contentSummary: 'Guia de implementacion sin librerias externas, centrada en los fundamentos de la Web moderna.',
  },
];

export const LEARNING_QUIZ_BANK: QuizQuestion[] = [
  {
    id: 'q-algo-1',
    subject: 'Programacion de Algoritmos',
    difficulty: 'Basico',
    question: 'En Python, ¿que valor final tendra la variable "resultado" tras este ciclo?',
    codeSnippet: `resultado = 0\nfor x in range(1, 5):\n    resultado += x\nprint(resultado)`,
    options: ['10', '15', '5', '4'],
    correctIndex: 0,
    explanation: 'range(1, 5) genera la secuencia [1, 2, 3, 4] excluyendo el limite superior 5. La suma sucesiva es 1 + 2 + 3 + 4 = 10.',
  },
  {
    id: 'q-algo-2',
    subject: 'Programacion de Algoritmos',
    difficulty: 'Intermedio',
    question: '¿Cual es la complejidad temporal promedio de busqueda binaria en un arreglo ordenado de tamano N?',
    options: ['O(N)', 'O(log N)', 'O(N^2)', 'O(1)'],
    correctIndex: 1,
    explanation: 'La busqueda binaria divide el espacio de busqueda a la mitad en cada iteracion, lo que da una complejidad temporal logaritmica O(log N).',
  },
  {
    id: 'q-db-1',
    subject: 'Modelamiento y Bases de Datos',
    difficulty: 'Intermedio',
    question: '¿Cual es la principal diferencia funcional entre WHERE y HAVING en una consulta SQL?',
    options: [
      'WHERE filtra registros antes de agrupar; HAVING filtra sobre los grupos resultantes del GROUP BY',
      'WHERE solo funciona con campos de texto y HAVING con numeros',
      'HAVING se ejecuta antes de cualquier JOIN y WHERE al final',
      'No existe diferencia, son palabras reservadas sinonimas',
    ],
    correctIndex: 0,
    explanation: 'WHERE evalua filas individuales antes del agrupamiento. HAVING actua exclusivamente despues de que GROUP BY produce agregaciones (como COUNT, SUM, AVG).',
  },
  {
    id: 'q-db-2',
    subject: 'Modelamiento y Bases de Datos',
    difficulty: 'Basico',
    question: 'En un modelo relacional, ¿que condicion fundamental impone una FOREIGN KEY (Clave Foranea)?',
    options: [
      'Obliga a que la columna siempre sea numerica y no negativa',
      'Garantiza integridad referencial, asegurando que el valor coincida con una Primary Key existente en otra tabla',
      'Hace que la tabla se cree de forma temporal en memoria',
      'Evita que existan indices secundarios en la base de datos',
    ],
    correctIndex: 1,
    explanation: 'Una Foreign Key vincula un registro con la fila de otra tabla y prohíbe guardar referencias a identidades que no existen.',
  },
  {
    id: 'q-poo-1',
    subject: 'Programacion Orientada a Objetos',
    difficulty: 'Intermedio',
    question: '¿Que principio de la POO permite tratar diferentes clases derivadas a traves de una misma interfaz comun?',
    options: ['Polimorfismo', 'Encapsulamiento', 'Modularidad', 'Recursividad'],
    correctIndex: 0,
    explanation: 'El polimorfismo faculta a metodos con igual nombre a responder con comportamientos especificos segun la clase concreta del objeto que lo invoque.',
  },
  {
    id: 'q-web-1',
    subject: 'Programacion Web',
    difficulty: 'Basico',
    question: 'En JavaScript moderno, ¿cual es la forma estandar de capturar un error producido dentro de una funcion asincrona con async/await?',
    options: [
      'Utilizando un bloque try { ... } catch (error) { ... }',
      'Declarando la funcion con la palabra clave "protected"',
      'Ejecutando un ciclo while infinito',
      'Configurando una propiedad error en window.document',
    ],
    correctIndex: 0,
    explanation: 'El manejo sincrono de promesas mediante async/await se intercepta limpiamente con estructuras estandar de control try/catch.',
  },
  {
    id: 'q-math-1',
    subject: 'Nivelacion Matematica',
    difficulty: 'Basico',
    question: 'En logica proposicional, ¿cual es la negacion correcta de la afirmacion "Todos los estudiantes aprobaron el certamen"?',
    options: [
      'Al menos un estudiante no aprobo el certamen',
      'Ningun estudiante aprobo el certamen',
      'Todos los estudiantes reprobaron el certamen',
      'Los estudiantes no rindieron el certamen',
    ],
    correctIndex: 0,
    explanation: 'La negacion de un cuantificador universal ("Para todo x, P(x)") es un cuantificador existencial ("Existe al menos un x que no cumple P(x)").',
  },
];

export const STUDY_FLASHCARDS: Flashcard[] = [
  {
    id: 'fc-1',
    subject: 'Programacion de Algoritmos',
    category: 'Fundamentos',
    term: 'Recursividad',
    definition: 'Tecnica en la cual una funcion se invoca a si misma para resolver un problema dividiendolo en subproblemas mas pequenos.',
    example: 'Caso base obligatorio para evitar desbordamiento de pila (Stack Overflow).',
  },
  {
    id: 'fc-2',
    subject: 'Modelamiento y Bases de Datos',
    category: 'Integridad',
    term: 'Transaccion ACID',
    definition: 'Conjunto de operaciones que garantizan Atomicidad, Consistencia, Aislamiento (Isolation) y Durabilidad en la persistencia de datos.',
    example: 'Transferencia bancaria: si debitar falla, el abono se cancela por completo (Rollback).',
  },
  {
    id: 'fc-3',
    subject: 'Programacion Orientada a Objetos',
    category: 'Arquitectura',
    term: 'Encapsulamiento',
    definition: 'Mecanismo que agrupa datos y metodos que operan sobre ellos, restringiendo el acceso directo al estado interno del objeto.',
    example: 'Atributos privados (private) accedidos unicamente mediante metodos Getters y Setters con validacion.',
  },
  {
    id: 'fc-4',
    subject: 'Programacion Web',
    category: 'Arquitectura',
    term: 'DOM (Document Object Model)',
    definition: 'Interfaz de programacion que representa la estructura HTML de un documento web como un arbol de nodos navegable y modificable en tiempo real.',
    example: 'document.getElementById() o document.querySelector() para alterar texto o estilos.',
  },
  {
    id: 'fc-5',
    subject: 'Nivelacion Matematica',
    category: 'Logica',
    term: 'Leyes de De Morgan',
    definition: 'Reglas logicas que establecen que la negacion de una conjuncion es la disyuncion de las negaciones: ¬(P ∧ Q) ≡ (¬P ∨ ¬Q).',
    example: 'Clave para simplificar condiciones complejas en sentencias if de codigo.',
  },
  {
    id: 'fc-6',
    subject: 'Modelamiento y Bases de Datos',
    category: 'Rendimiento',
    term: 'Indice de Base de Datos (INDEX)',
    definition: 'Estructura auxiliar (generalmente arbol B-Tree) que acelera drasticamente la velocidad de consulta a costa de mayor uso de disco.',
    example: 'Crear indice en columnas consultadas frecuentemente en clausulas WHERE.',
  },
];
