import { apiClient } from '../lib/apiClient';
import { API_ENDPOINTS } from '../constants/apiEndpoints';
import type { InterestTopic, InterestPreferences, RecommendationFeed, RecommendationKind, CommunityPreferences, AcademicCommunity,InterestDemo } from '../types/recommendations';
const endpoints=API_ENDPOINTS.RECOMMENDATIONS;
export const recommendationsService = {
  getDemo:(focus:'data'|'web'|'business',scope:'all'|'campus'|'nearby')=>apiClient.get<InterestDemo>(endpoints.DEMO,{params:{focus,scope}}),
  getCommunity:()=>apiClient.get<AcademicCommunity>(endpoints.COMMUNITY),
  saveCommunity:(preferences:CommunityPreferences)=>apiClient.put<AcademicCommunity>(endpoints.COMMUNITY,preferences),
  getTopics:()=>apiClient.get<InterestTopic[]>(endpoints.TOPICS),
  getPreferences:()=>apiClient.get<InterestPreferences>(endpoints.PREFERENCES),
  savePreferences:(preferences:InterestPreferences)=>apiClient.put<InterestPreferences>(endpoints.PREFERENCES,preferences),
  getFeed:(limit=9)=>apiClient.get<RecommendationFeed>(endpoints.FEED,{params:{limit}}),
  dismiss:(kind:RecommendationKind,id:string)=>apiClient.post(endpoints.DISMISSALS,{kind,id}),
  restore:(kind:RecommendationKind,id:string)=>apiClient.delete(endpoints.DISMISSAL(kind,id)),
  restoreAll:()=>apiClient.delete(endpoints.DISMISSALS),
};
