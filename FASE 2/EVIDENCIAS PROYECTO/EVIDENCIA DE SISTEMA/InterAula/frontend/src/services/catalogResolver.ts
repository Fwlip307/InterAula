/**
 * catalogResolver.ts
 * Motor inteligente de resolución y filtrado de asignaturas según carrera e institución.
 * Basado en el catálogo unificado oficial de educación superior chilena 2026 (chileEducationCatalog2026.json).
 */

import catalogData from '../data/chileEducationCatalog2026.json';

export interface CatalogSubjectItem {
  id: string;
  name: string;
  areaId: string;
  aliases?: string[];
  level?: string;
  relevance?: string;
  enabled?: boolean;
}

export interface CatalogArea {
  id: string;
  name: string;
  subjectCount?: number;
}

export interface CatalogProfile {
  id: string;
  areaIds: string[];
  subjectIds: string[];
  subjectCount: number;
}

export interface ResolvedSubject {
  id: string;
  name: string;
  areaId: string;
  areaName: string;
  level?: string;
  relevance?: string;
  isBoosted?: boolean;
  isPrimaryArea?: boolean;
}

// Normalización de texto para comparaciones robustas
export function normalizeCatalogText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const rawSubjectCatalog = (catalogData as any).subjectCatalog || {};
const areas: CatalogArea[] = rawSubjectCatalog.areas || [];
const canonicalSubjects: CatalogSubjectItem[] = rawSubjectCatalog.subjects || [];
const profiles: CatalogProfile[] = rawSubjectCatalog.profiles || [];
const institutions: any[] = (catalogData as any).institutions || [];

// Mapas de acceso rápido
const subjectByIdMap = new Map<string, CatalogSubjectItem>();
for (const sub of canonicalSubjects) {
  subjectByIdMap.set(sub.id, sub);
}

const areaByIdMap = new Map<string, CatalogArea>();
for (const area of areas) {
  areaByIdMap.set(area.id, area);
}

const profileByIdMap = new Map<string, CatalogProfile>();
for (const prof of profiles) {
  profileByIdMap.set(prof.id, prof);
}

/**
 * Obtener lista de asignaturas recomendadas para la carrera del estudiante
 */
export function getSuggestedSubjectsForCareer(
  careerName?: string,
  institutionOrLimit?: string | number,
  limit: number = 40
): ResolvedSubject[] {
  let institutionName: string | undefined;
  let maxLimit = limit;

  if (typeof institutionOrLimit === 'number') {
    maxLimit = institutionOrLimit;
    institutionName = undefined;
  } else if (typeof institutionOrLimit === 'string') {
    institutionName = institutionOrLimit;
  }

  if (!careerName || !careerName.trim()) {
    return getTopTroncalSubjects(maxLimit);
  }

  const normCareer = normalizeCatalogText(careerName);
  const normInst = institutionName ? normalizeCatalogText(institutionName) : '';

  // 1. Buscar en la institución específica si fue provista
  let matchedCareerDetail: any = null;
  if (normInst) {
    const inst = institutions.find(
      (i) =>
        normalizeCatalogText(i.name) === normInst ||
        normalizeCatalogText(i.name).includes(normInst) ||
        normInst.includes(normalizeCatalogText(i.name))
    );
    if (inst && inst.careerDetails) {
      matchedCareerDetail = inst.careerDetails.find((c: any) => {
        const cNorm = normalizeCatalogText(c.name);
        return cNorm === normCareer || cNorm.includes(normCareer) || normCareer.includes(cNorm);
      });
    }
  }

  // 2. Si no se encontró en la institución específica, buscar globalmente
  if (!matchedCareerDetail) {
    for (const inst of institutions) {
      if (inst.careerDetails) {
        const found = inst.careerDetails.find((c: any) => {
          const cNorm = normalizeCatalogText(c.name);
          return cNorm === normCareer || cNorm.includes(normCareer) || normCareer.includes(cNorm);
        });
        if (found) {
          matchedCareerDetail = found;
          break;
        }
      }
    }
  }

  // 3. Si encontramos la carrera y su perfil curricular
  if (matchedCareerDetail && matchedCareerDetail.profileId) {
    const profile = profileByIdMap.get(matchedCareerDetail.profileId);
    if (profile && profile.subjectIds && profile.subjectIds.length > 0) {
      const result: ResolvedSubject[] = [];
      const addedIds = new Set<string>();

      for (const sId of profile.subjectIds) {
        const sub = subjectByIdMap.get(sId);
        if (sub && !addedIds.has(sub.id)) {
          addedIds.add(sub.id);
          const area = areaByIdMap.get(sub.areaId);
          result.push({
            id: sub.id,
            name: sub.name,
            areaId: sub.areaId,
            areaName: area ? area.name : sub.areaId,
            level: 'Basico a Intermedio',
            relevance: 'troncal',
            isBoosted: true,
            isPrimaryArea: true,
          });
          if (result.length >= limit) return result;
        }
      }

      if (result.length > 0) {
        return result;
      }
    }
  }

  // 4. Búsqueda por coincidencia de palabras clave en asignaturas y áreas (fallback inteligente)
  const careerTokens = normCareer.split(' ').filter((t) => t.length > 3);
  const scoredSubjects: { subject: CatalogSubjectItem; score: number }[] = [];

  for (const sub of canonicalSubjects) {
    const subNorm = normalizeCatalogText(sub.name);
    let score = 0;

    for (const token of careerTokens) {
      if (subNorm.includes(token)) {
        score += 10;
      }
      if (sub.areaId.includes(token)) {
        score += 5;
      }
    }

    if (score > 0) {
      scoredSubjects.push({ subject: sub, score });
    }
  }

  scoredSubjects.sort((a, b) => b.score - a.score);

  if (scoredSubjects.length > 0) {
    const result: ResolvedSubject[] = [];
    const addedIds = new Set<string>();

    for (const item of scoredSubjects) {
      const sub = item.subject;
      if (!addedIds.has(sub.id)) {
        addedIds.add(sub.id);
        const area = areaByIdMap.get(sub.areaId);
        result.push({
          id: sub.id,
          name: sub.name,
          areaId: sub.areaId,
          areaName: area ? area.name : sub.areaId,
          level: 'Troncal',
          relevance: 'troncal',
          isBoosted: item.score >= 10,
          isPrimaryArea: true,
        });
        if (result.length >= limit) return result;
      }
    }
    return result;
  }

  // 5. Fallback a troncales generales
  return getTopTroncalSubjects(limit);
}

/**
 * Obtener las asignaturas troncales más frecuentes de educación superior en Chile
 */
export function getTopTroncalSubjects(limit: number = 25): ResolvedSubject[] {
  const result: ResolvedSubject[] = [];
  const addedIds = new Set<string>();

  // Selección de áreas troncales de alta demanda transversal
  const keyAreaIds = [
    'matematicas_estadistica',
    'informatica_software',
    'administracion_gestion',
    'contabilidad_auditoria',
    'ciencias_basicas',
    'formacion_transversal',
  ];

  for (const areaId of keyAreaIds) {
    const areaSubjects = canonicalSubjects.filter((s) => s.areaId === areaId);
    const area = areaByIdMap.get(areaId);

    for (const sub of areaSubjects.slice(0, 6)) {
      if (!addedIds.has(sub.id)) {
        addedIds.add(sub.id);
        result.push({
          id: sub.id,
          name: sub.name,
          areaId: sub.areaId,
          areaName: area ? area.name : sub.areaId,
          level: 'Troncal',
          relevance: 'troncal',
        });
        if (result.length >= limit) return result;
      }
    }
  }

  return result;
}

/**
 * Búsqueda predictiva abierta en todo el catálogo de 1.000 asignaturas canónicas
 */
export function searchSubjectsInCatalog(query: string, maxResults: number = 25): ResolvedSubject[] {
  if (!query || !query.trim()) return [];
  const normQuery = normalizeCatalogText(query);

  const results: { item: ResolvedSubject; matchScore: number }[] = [];

  for (const sub of canonicalSubjects) {
    const normName = normalizeCatalogText(sub.name);
    let score = 0;

    if (normName === normQuery) {
      score = 100;
    } else if (normName.startsWith(normQuery)) {
      score = 50;
    } else if (normName.includes(normQuery)) {
      score = 25;
    } else if (sub.aliases) {
      for (const alias of sub.aliases) {
        const normAlias = normalizeCatalogText(alias);
        if (normAlias.includes(normQuery)) {
          score = 15;
          break;
        }
      }
    } else if (normalizeCatalogText(sub.areaId).includes(normQuery)) {
      score = 10;
    }

    if (score > 0) {
      const area = areaByIdMap.get(sub.areaId);
      results.push({
        item: {
          id: sub.id,
          name: sub.name,
          areaId: sub.areaId,
          areaName: area ? area.name : sub.areaId,
          level: 'Basico a Avanzado',
          relevance: 'troncal',
        },
        matchScore: score,
      });
    }
  }

  results.sort((a, b) => b.matchScore - a.matchScore);
  return results.slice(0, maxResults).map((r) => r.item);
}

/**
 * Obtiene todas las asignaturas canónicas del catálogo unificado 2026.
 */
export function getAllCatalogSubjects(): ResolvedSubject[] {
  return canonicalSubjects.map((sub) => {
    const area = areaByIdMap.get(sub.areaId);
    return {
      id: sub.id,
      name: sub.name,
      areaId: sub.areaId,
      areaName: area ? area.name : sub.areaId,
      level: 'Basico a Avanzado',
      relevance: 'troncal',
    };
  });
}
