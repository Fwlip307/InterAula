export type InterestIntent = 'interest' | 'learn' | 'teach';
export type RecommendationKind = 'note' | 'post' | 'project' | 'workshop' | 'person';
export interface InterestTopic { id: string; name: string; category: string; aliases: string[] }
export interface InterestPreferences {
  revision: number;
  personalization_enabled: boolean;
  discoverable: boolean;
  interest: string[];
  learn: string[];
  teach: string[];
}
export interface RecommendationItem {
  id: string; kind: RecommendationKind; title: string; summary: string; href: string;
  reason: string; topics: string[]; communityReason?:string;
}
export interface RecommendationFeed {
  mode: 'personalized' | 'starter' | 'disabled';
  items: RecommendationItem[];
  personalizationEnabled: boolean;
  algorithmVersion: string;
  generatedAt: string;
  hiddenCount: number;
  community?:AcademicCommunity;
}
export const RECOMMENDATION_KIND_LABELS: Record<RecommendationKind,string> = {
  note:'Apunte',post:'Foro',project:'Proyecto',workshop:'Taller',person:'Persona',
};

export interface CommunityPreferences {
 institutionId:string|null;campusId:string|null;
 scope:'all'|'institution'|'campus'|'nearby';modality:'any'|'online'|'in_person'|'hybrid';
}
export interface AcademicCommunity {preferences:CommunityPreferences;activationRequired:boolean}
