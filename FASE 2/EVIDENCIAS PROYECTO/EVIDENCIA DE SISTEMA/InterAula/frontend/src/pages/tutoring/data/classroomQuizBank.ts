/**
 * Banco Pedagógico de Desafíos y Quizzes en Vivo para el Aula Virtual
 * (Materias Críticas de Informática Duoc UC)
 */
export interface QuizChallenge {
  id: string;
  subjectCategory: string;
  difficulty: 'Básico' | 'Intermedio' | 'Avanzado';
  question: string;
  codeSnippet?: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export const INFORMATICS_QUIZ_BANK: QuizChallenge[] = [
  {
    id: 'algo-1',
    subjectCategory: 'Programación de Algoritmos',
    difficulty: 'Básico',
    question: '¿Qué valor imprimirá en consola este bloque de código?',
    codeSnippet: `total = 0\nfor i in range(1, 4):\n    total += i\nprint(total)`,
    options: ['3', '6', '10', '4'],
    correctIndex: 1,
    explanation: 'El bucle for en range(1, 4) recorre 1, 2 y 3 (excluye el 4). La suma es 1 + 2 + 3 = 6.',
  },
  {
    id: 'algo-2',
    subjectCategory: 'Programación de Algoritmos',
    difficulty: 'Básico',
    question: '¿Cuál es la causa principal de que un bucle "while" se vuelva infinito?',
    options: [
      'Declarar la variable antes del bucle',
      'Olvidar actualizar la variable de control que hace falsa la condición',
      'Utilizar una variable de tipo entero',
      'Imprimir mensajes dentro del cuerpo del bucle',
    ],
    correctIndex: 1,
    explanation: 'Un bucle while evalúa su condición en cada ciclo; si ninguna instrucción modifica las variables evaluadas hacia un estado falso, nunca termina.',
  },
  {
    id: 'web-1',
    subjectCategory: 'Programación Web',
    difficulty: 'Básico',
    question: '¿Qué método previene la recarga automática de la página al enviar un formulario en JS?',
    codeSnippet: `const handleSubmit = (event) => {\n  event.????();\n  enviarDatos();\n};`,
    options: ['event.stopPropagation()', 'event.preventDefault()', 'event.stop()', 'event.cancel()'],
    correctIndex: 1,
    explanation: 'event.preventDefault() cancela la acción por defecto del navegador de recargar la página tras el submit.',
  },
  {
    id: 'web-2',
    subjectCategory: 'Programación Web',
    difficulty: 'Intermedio',
    question: 'En JavaScript moderno (ES6+), ¿cuál es la principal diferencia entre "const" y "let"?',
    options: [
      'const no permite reasignar el identificador a otro valor en memoria',
      'const solo se puede usar con números y let con strings',
      'let tiene alcance global obligatorio y const no',
      'const se ejecuta de forma asíncrona',
    ],
    correctIndex: 0,
    explanation: 'Las variables declaradas con const crean una referencia inmutable por reasignación (=). let sí permite reasignar.',
  },
  {
    id: 'db-1',
    subjectCategory: 'Modelamiento y Bases de Datos',
    difficulty: 'Intermedio',
    question: '¿Qué cláusula de SQL permite filtrar grupos generados por la cláusula GROUP BY?',
    codeSnippet: `SELECT carrera_id, COUNT(*)\nFROM estudiantes\nGROUP BY carrera_id\n???? COUNT(*) >= 5;`,
    options: ['WHERE', 'HAVING', 'FILTER BY', 'ORDER BY'],
    correctIndex: 1,
    explanation: 'HAVING actúa sobre las filas agrupadas y funciones de agregación (COUNT, SUM, AVG). WHERE solo filtra filas individuales antes de agrupar.',
  },
  {
    id: 'db-2',
    subjectCategory: 'Modelamiento y Bases de Datos',
    difficulty: 'Básico',
    question: '¿Cuál es la restricción fundamental de una Llave Primaria (PRIMARY KEY) en una tabla relacional?',
    options: [
      'Solo permite valores positivos',
      'Garantiza unicidad en cada registro y prohíbe valores NULL',
      'Debe ser obligatoriamente de tipo VARCHAR',
      'Solo se puede consultar mediante INNER JOIN',
    ],
    correctIndex: 1,
    explanation: 'Una clave primaria identifica unívocamente cada fila y por integridad relacional nunca admite valores NULL.',
  },
  {
    id: 'poo-1',
    subjectCategory: 'Programación Orientada a Objetos',
    difficulty: 'Intermedio',
    question: '¿Qué principio de la POO consiste en ocultar el estado interno y obligar a interactuar mediante métodos?',
    options: ['Polimorfismo', 'Encapsulamiento', 'Herencia múltiple', 'Sobrecarga de operadores'],
    correctIndex: 1,
    explanation: 'El encapsulamiento protege los atributos de una clase declarándolos privados y proveyendo métodos públicos para su acceso y modificación.',
  },
  {
    id: 'math-1',
    subjectCategory: 'Nivelación Matemática',
    difficulty: 'Básico',
    question: 'En lógica proposicional y tablas de verdad, ¿cuándo es Verdadera una conjunción (P ∧ Q)?',
    options: [
      'Cuando al menos una de las proposiciones es verdadera',
      'Únicamente cuando tanto P como Q son verdaderas',
      'Cuando ambas proposiciones son falsas',
      'Cuando P es verdadera y Q es falsa',
    ],
    correctIndex: 1,
    explanation: 'La conjunción lógica (AND / ∧) requiere que todas sus partes sean verdaderas simultáneamente para dar como resultado verdadero.',
  },
];
