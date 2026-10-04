// Catálogo oficial de Instituciones de Educación Superior y Carreras en Chile
// Fuente: Mineduc / SIES (Subsecretaría de Educación Superior)
// 128 instituciones de educación superior, sedes regionales y más de 5.000 carreras

import rawCatalog from './chileanInstitutionsCatalog.json';

export interface SedeItem {
  id: string;
  name: string;
  region?: string;
  comuna?: string;
}

export interface CareerDetailItem {
  id: string;
  name: string;
  area: string;
  nivel: string;
  sedes: string[];
}

export interface InstitutionItem {
  id: string;
  name: string;
  type: 'Universidad' | 'Instituto Profesional' | 'Centro de Formación Técnica';
  active?: boolean;
  careersCount?: number;
  careers: string[];
  careerDetails?: CareerDetailItem[];
  areas?: string[];
  sedes?: SedeItem[];
}

export const CHILEAN_INSTITUTIONS: InstitutionItem[] = rawCatalog as InstitutionItem[];

/**
 * Obtener lista de todas las instituciones ordenadas alfabéticamente
 */
export function getAllInstitutions(): InstitutionItem[] {
  return [...CHILEAN_INSTITUTIONS].sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

/**
 * Buscar institución por nombre exacto o aproximado
 */
export function findInstitutionByName(name: string): InstitutionItem | undefined {
  if (!name) return undefined;
  const clean = name.trim().toLowerCase();

  // 1. Coincidencia directa
  const direct = CHILEAN_INSTITUTIONS.find(
    (inst) =>
      inst.name.toLowerCase() === clean ||
      inst.id.toLowerCase() === clean
  );
  if (direct) return direct;

  // 2. Coincidencia para casos comunes
  if (clean.includes('duoc')) {
    return CHILEAN_INSTITUTIONS.find((i) => i.name.toLowerCase().includes('duoc'));
  }
  if (clean.includes('inacap')) {
    return CHILEAN_INSTITUTIONS.find((i) => i.name.toLowerCase().includes('inacap') && i.type === 'Instituto Profesional') ||
           CHILEAN_INSTITUTIONS.find((i) => i.name.toLowerCase().includes('inacap'));
  }
  if (clean.includes('catolica') && clean.includes('chile')) {
    return CHILEAN_INSTITUTIONS.find((i) => i.name.toLowerCase().includes('pontificia universidad cat'));
  }
  if (clean.includes('universidad de chile') || clean === 'u de chile' || clean === 'uchile') {
    return CHILEAN_INSTITUTIONS.find((i) => i.name === 'Universidad de Chile');
  }
  if (clean.includes('usach') || clean.includes('santiago de chile')) {
    return CHILEAN_INSTITUTIONS.find((i) => i.name.toLowerCase().includes('santiago de chile'));
  }
  if (clean.includes('santa maria') || clean.includes('usm')) {
    return CHILEAN_INSTITUTIONS.find((i) => i.name.toLowerCase().includes('santa mar'));
  }

  // 3. Búsqueda por inclusión de texto
  return CHILEAN_INSTITUTIONS.find((inst) => inst.name.toLowerCase().includes(clean));
}

/**
 * Obtener carreras asociadas a una institución.
 * Si se especifica un ID o nombre de sede, filtra únicamente las carreras dictadas en ese campus.
 */
export function getCareersForInstitution(institutionName: string, sedeIdOrName?: string): string[] {
  const found = findInstitutionByName(institutionName);
  if (!found || !found.careers) return [];

  // Si se seleccionó una sede específica y la institución tiene detalle de sedes por carrera
  if (sedeIdOrName && found.careerDetails && found.careerDetails.length > 0) {
    const cleanSede = sedeIdOrName.trim().toLowerCase();
    // Buscar sede_id coincidente
    const matchedSede = found.sedes?.find(
      (s) => s.id.toLowerCase() === cleanSede || cleanSede.includes(s.name.toLowerCase())
    );

    if (matchedSede) {
      const filtered = found.careerDetails
        .filter((cd) => cd.sedes && (cd.sedes.length === 0 || cd.sedes.includes(matchedSede.id)))
        .map((cd) => cd.name);
      if (filtered.length > 0) {
        return [...new Set(filtered)].sort((a, b) => a.localeCompare(b, 'es'));
      }
    }
  }

  return [...found.careers].sort((a, b) => a.localeCompare(b, 'es'));
}

/**
 * Obtener sedes o campus asociados a una institución.
 */
export function getSedesForInstitution(institutionName: string): SedeItem[] {
  const found = findInstitutionByName(institutionName);
  if (!found || !found.sedes) return [];
  return [...found.sedes];
}

/**
 * Obtener áreas de conocimiento de una institución (Tecnología, Salud, etc.)
 */
export function getAreasForInstitution(institutionName: string): string[] {
  const found = findInstitutionByName(institutionName);
  if (!found || !found.areas) return [];
  return [...found.areas];
}
