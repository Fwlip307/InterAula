import * as pdfjsLib from 'pdfjs-dist';
import type {
  ExtractedCertificateData,
  ExtractedCertificateSubject,
  DocumentExtractionStatus,
  MatchedStatus,
  CalculatedTutorLevel,
} from '../types/verification';

// Configuración segura del worker de pdfjs en entorno Vite/Browser
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  // Utilizar worker minificado oficial de pdfjs-dist
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
}

/**
 * Calcula automáticamente el nivel académico del tutor a partir de la calificación obtenida:
 * - 5.5 a 5.9 -> 'basic' (Básico)
 * - 6.0 a 6.4 -> 'intermediate' (Intermedio)
 * - 6.5 a 7.0 -> 'advanced' (Avanzado)
 * - < 5.5      -> null (Sin nivel asignado por ahora)
 */
export function calculateTutorLevelFromGrade(grade: number | null | undefined): CalculatedTutorLevel {
  if (grade === null || grade === undefined || isNaN(grade)) {
    return null;
  }
  // Normalizar con 1 decimal
  const rounded = Math.round(grade * 10) / 10;
  if (rounded >= 5.5 && rounded <= 5.9) {
    return 'basic';
  }
  if (rounded >= 6.0 && rounded <= 6.4) {
    return 'intermediate';
  }
  if (rounded >= 6.5 && rounded <= 7.0) {
    return 'advanced';
  }
  return null;
}

/**
 * Formatea el nivel académico para visualización amigable en la interfaz de usuario.
 */
export function formatTutorLevel(level: CalculatedTutorLevel | string | null | undefined): string {
  switch (level) {
    case 'basic':
      return 'Básico';
    case 'intermediate':
      return 'Intermedio';
    case 'advanced':
      return 'Avanzado';
    default:
      return 'Sin nivel asignado';
  }
}


/**
 * Normaliza cadenas de texto para comparaciones resilientes:
 * minúsculas, remoción de diacríticos/tildes y espacios colapsados.
 */
export function normalizeText(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Valida formato y tamaño del archivo PDF antes de procesarlo.
 */
export function validatePdfFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No se seleccionó ningún archivo.' };
  }

  const isPdfMime = file.type === 'application/pdf';
  const hasPdfExtension = file.name.toLowerCase().endsWith('.pdf');

  if (!isPdfMime && !hasPdfExtension) {
    return { valid: false, error: 'El archivo seleccionado no es un documento PDF válido.' };
  }

  // Límite de 10 MB
  const maxBytes = 10 * 1024 * 1024;
  if (file.size > maxBytes) {
    return { valid: false, error: 'El archivo excede el tamaño máximo permitido de 10 MB.' };
  }

  if (file.size < 100) {
    return { valid: false, error: 'El archivo parece estar vacío o dañado.' };
  }

  return { valid: true };
}

/**
 * Extrae texto de un archivo PDF estructurándolo en líneas ordenadas.
 */
export async function extractLinesFromPdf(file: File): Promise<{ lines: string[]; rawTextLength: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const allLines: string[] = [];
  let totalLength = 0;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Agrupar items de texto por coordenada vertical Y
    const itemsByY = new Map<number, { x: number; text: string }[]>();

    for (const item of textContent.items) {
      if ('str' in item && typeof item.str === 'string' && item.str.trim()) {
        const text = item.str.trim();
        totalLength += text.length;

        const y = Math.round(item.transform[5]);
        const x = Math.round(item.transform[4]);

        // Tolerancia de proximidad vertical (+- 3px) para misma fila
        let lineY = y;
        for (const existingY of itemsByY.keys()) {
          if (Math.abs(existingY - y) <= 3) {
            lineY = existingY;
            break;
          }
        }

        const list = itemsByY.get(lineY) || [];
        list.push({ x, text });
        itemsByY.set(lineY, list);
      }
    }

    // Ordenar líneas de arriba hacia abajo (Y descendente)
    const sortedY = Array.from(itemsByY.keys()).sort((a, b) => b - a);
    for (const y of sortedY) {
      const list = itemsByY.get(y) || [];
      // Ordenar horizontalmente de izquierda a derecha (X ascendente)
      list.sort((a, b) => a.x - b.x);
      const lineStr = list
        .map((i) => i.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (lineStr) {
        allLines.push(lineStr);
      }
    }
  }

  return { lines: allLines, rawTextLength: totalLength };
}

/**
 * Parsea y extrae metadatos y tabla de asignaturas desde las líneas del certificado Duoc UC.
 */
export function parseCertificateLines(lines: string[], rawLength: number): {
  extractedData: ExtractedCertificateData;
  extractionStatus: DocumentExtractionStatus;
} {
  const warnings: string[] = [];
  let studentName: string | undefined;
  let studentRut: string | undefined;
  let program: string | undefined;
  let certificateId: string | undefined;
  const subjects: ExtractedCertificateSubject[] = [];

  // Expresiones regulares adaptativas
  const idRegexes = [
    /ID\s*Certificado\s*[:#]?\s*(\d{6,15})/i,
    /Certificado\s*(?:N°|Nro|ID|N|#)?\s*[:#]?\s*(\d{6,15})/i,
    /Código\s*Verificación\s*[:#]?\s*([A-Za-z0-9]{6,20})/i,
    /Validación\s*(?:N°|ID)?\s*[:#]?\s*(\d{6,15})/i,
  ];

  const rutRegex = /\b(\d{1,2}\.?\d{3}\.?\d{3}-[\dkK])\b/;
  const nameLabelRegex = /(?:Alumno|Estudiante|Nombre)\s*[:#]\s*([A-ZÁÉÍÓÚÑa-záéíóúñ\s.]+)/i;
  const careerLabelRegex = /(?:Carrera|Programa|Título|Plan)\s*[:#]\s*([A-ZÁÉÍÓÚÑa-záéíóúñ\s.-]+)/i;

  // 1. Detección de encabezados y metadatos
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Buscar ID de certificado
    if (!certificateId) {
      for (const rx of idRegexes) {
        const m = line.match(rx);
        if (m && m[1]) {
          certificateId = m[1].trim();
          break;
        }
      }
    }

    // Buscar RUT
    if (!studentRut) {
      const mRut = line.match(rutRegex);
      if (mRut && mRut[1]) {
        studentRut = mRut[1].trim();
      }
    }

    // Buscar Nombre
    if (!studentName) {
      const mName = line.match(nameLabelRegex);
      if (mName && mName[1] && mName[1].trim().length >= 4) {
        studentName = mName[1].trim();
      } else if (
        /Certificamos que el alumno|Certifica que el estudiante|Certifica que:/i.test(line) &&
        i + 1 < lines.length
      ) {
        const next = lines[i + 1].trim();
        if (next && next.length >= 4 && !/RUT|Carrera|Sede/i.test(next)) {
          studentName = next;
        }
      }
    }

    // Buscar Carrera / Programa
    if (!program) {
      const mCareer = line.match(careerLabelRegex);
      if (mCareer && mCareer[1] && mCareer[1].trim().length >= 4) {
        program = mCareer[1].trim();
      }
    }

    // 2. Detección tabular de asignaturas
    // Patrón estándar de código de materia: 2 a 4 letras seguidas de 3 a 4 dígitos
    const codeMatch = line.match(/\b([A-Z]{2,4}\s*\d{3,4})\b/i);
    // Patrón de calificación: escala 1.0 a 7.0 o 1,0 a 7,0
    const gradeMatch = line.match(/\b([1-7][,.]\d)\b/);

    if (codeMatch && gradeMatch) {
      const code = codeMatch[1].replace(/\s+/g, '').toUpperCase();
      const gradeStr = gradeMatch[1].replace(',', '.');
      const grade = parseFloat(gradeStr);

      // Año: 4 dígitos en rango 2010 a 2030
      const yearMatch = line.match(/\b(20[12]\d)\b/);
      const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined;

      // Semestre: semestre 1 / 2 o dígito 1 / 2
      const semMatch = line.match(/(?:semestre|sem\.?)\s*([12])\b/i) || line.match(/\b([12])\s*(?:er|do|ro)?\s*sem/i);
      const semester = semMatch ? parseInt(semMatch[1], 10) : undefined;

      // Carácter de la asignatura (O = Obligatoria, OP = Optativa, etc.)
      const charMatch = line.match(/\b(O|OP|OF|E|EL|OB)\b/);
      const character = charMatch ? charMatch[1].toUpperCase() : undefined;

      // Nombre de la asignatura: texto ubicado entre el código y la nota (o delimitadores)
      const codeIndex = line.indexOf(codeMatch[1]);
      const gradeIndex = line.indexOf(gradeMatch[1]);

      let namePart = '';
      if (codeIndex !== -1 && gradeIndex > codeIndex) {
        namePart = line.substring(codeIndex + codeMatch[1].length, gradeIndex);
      } else {
        // Fallback: remover código, nota, año y palabras clave
        namePart = line
          .replace(codeMatch[1], '')
          .replace(gradeMatch[1], '')
          .replace(/\b20[12]\d\b/, '')
          .replace(/semestre\s*[12]/i, '');
      }

      // Limpiar créditos numéricos iniciales (ej: "12 ", "8 ") y delimitadores como guiones, pipes o caracteres de relleno
      const cleanName = namePart
        .replace(/^\s*\d{1,2}\s+/, '')
        .replace(/^[—\-|:.\s]+/, '')
        .replace(/[—\-|:.\s]+$/, '')
        .replace(/\b(O|OP|OF|E|EL|OB)\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (cleanName.length >= 2 && !isNaN(grade)) {
        // Evitar duplicados por código en la misma extracción
        if (!subjects.some((s) => s.code === code && s.grade === grade)) {
          subjects.push({
            code,
            name: cleanName.toUpperCase(),
            grade,
            semester,
            year,
            character,
          });
        }
      }
    }
  }

  // 3. Determinar estado de la extracción
  let extractionStatus: DocumentExtractionStatus = 'completed';

  if (subjects.length === 0) {
    warnings.push('No se pudieron identificar asignaturas ni calificaciones en el formato esperado.');
    extractionStatus = 'manual_review_required';
  }

  if (!certificateId) {
    warnings.push('No se detectó un identificador de certificado explícito.');
    if (extractionStatus !== 'manual_review_required') {
      extractionStatus = 'warnings';
    }
  }

  if (!studentName) {
    warnings.push('No se detectó el nombre del estudiante de forma unívoca.');
    if (extractionStatus !== 'manual_review_required') {
      extractionStatus = 'warnings';
    }
  }

  const extractedData: ExtractedCertificateData = {
    student_name: studentName,
    student_rut: studentRut,
    program,
    certificate_id: certificateId,
    subjects,
    extracted_at: new Date().toISOString(),
    raw_text_length: rawLength,
    warnings: warnings.length > 0 ? warnings : undefined,
  };

  return { extractedData, extractionStatus };
}

/**
 * Realiza el cruce preliminar entre la asignatura postulada y las asignaturas extraídas del PDF.
 * Nota: La validación de nota mínima NO está activa de forma rígida en esta fase.
 */
export function matchSubjectWithExtractedData(
  targetSubjectName: string,
  _targetSubjectCategory: string | null | undefined,
  extractedSubjects: ExtractedCertificateSubject[]
): {
  matchedSubjectName: string | null;
  matchedGrade: number | null;
  matchedStatus: MatchedStatus;
  ambiguousMatches?: ExtractedCertificateSubject[];
} {
  if (!extractedSubjects || extractedSubjects.length === 0) {
    return {
      matchedSubjectName: null,
      matchedGrade: null,
      matchedStatus: 'not_found',
    };
  }

  const normalizedTarget = normalizeText(targetSubjectName);

  // 1. Coincidencia exacta de nombre normalizado
  const exactMatches = extractedSubjects.filter((s) => normalizeText(s.name) === normalizedTarget);

  if (exactMatches.length === 1) {
    return {
      matchedSubjectName: exactMatches[0].name,
      matchedGrade: exactMatches[0].grade,
      matchedStatus: 'found',
    };
  }

  // 2. Coincidencia por inclusión de palabras clave
  const targetWords = normalizedTarget.split(' ').filter((w) => w.length > 2);
  const partialMatches = extractedSubjects.filter((s) => {
    const normName = normalizeText(s.name);
    // Si contiene el nombre completo como subcadena o todas las palabras significativas
    return normName.includes(normalizedTarget) || targetWords.every((w) => normName.includes(w));
  });

  if (partialMatches.length === 1) {
    return {
      matchedSubjectName: partialMatches[0].name,
      matchedGrade: partialMatches[0].grade,
      matchedStatus: 'found',
    };
  }

  if (partialMatches.length > 1) {
    // Ambigüedad: múltiples materias candidatas encontradas
    return {
      matchedSubjectName: null,
      matchedGrade: null,
      matchedStatus: 'manual_review_required',
      ambiguousMatches: partialMatches,
    };
  }

  // No se encontró coincidencia
  return {
    matchedSubjectName: null,
    matchedGrade: null,
    matchedStatus: 'not_found',
  };
}

/**
 * Función integral para procesar un archivo PDF completo y retornar datos estructurados y cruce.
 */
export async function processCertificatePdf(
  file: File,
  targetSubjectName: string,
  targetSubjectCategory?: string | null
): Promise<{
  validationError?: string;
  extractedData?: ExtractedCertificateData;
  extractionStatus?: DocumentExtractionStatus;
  matchedSubjectName?: string | null;
  matchedGrade?: number | null;
  matchedStatus?: MatchedStatus;
  calculatedLevel?: CalculatedTutorLevel;
}> {
  // 1. Validaciones previas de formato y tamaño
  const fileValidation = validatePdfFile(file);
  if (!fileValidation.valid) {
    return { validationError: fileValidation.error };
  }

  try {
    // 2. Extracción de líneas desde el PDF
    const { lines, rawTextLength } = await extractLinesFromPdf(file);

    if (lines.length === 0 || rawTextLength < 30) {
      return {
        validationError: 'El documento no contiene texto legible (podría ser un documento escaneado solo con imagen). Se requiere revisión manual.',
      };
    }

    // 3. Parsing estructurado resiliente
    const { extractedData, extractionStatus } = parseCertificateLines(lines, rawTextLength);

    // 4. Cruce con la asignatura de la solicitud
    const matchResult = matchSubjectWithExtractedData(
      targetSubjectName,
      targetSubjectCategory,
      extractedData.subjects
    );

    // 5. Cálculo automático de nivel académico del tutor según la nota
    const calculatedLevel = calculateTutorLevelFromGrade(matchResult.matchedGrade);

    return {
      extractedData: {
        ...extractedData,
        calculated_level: calculatedLevel,
      },
      extractionStatus,
      matchedSubjectName: matchResult.matchedSubjectName,
      matchedGrade: matchResult.matchedGrade,
      matchedStatus: matchResult.matchedStatus,
      calculatedLevel,
    };
  } catch (err: any) {
    console.error('[pdfExtractor] Error al procesar PDF:', err);
    return {
      validationError: `No fue posible procesar el archivo PDF: ${err?.message || 'Error desconocido'}. Requiere revisión manual.`,
    };
  }
}

