import { apiClient } from '../lib/apiClient';
import { API_ENDPOINTS } from '../constants/apiEndpoints';
import type { InterestTopic, InterestPreferences, RecommendationFeed, RecommendationKind } from '../types/recommendations';
const endpoints=API_ENDPOINTS.RECOMMENDATIONS;
export const recommendationsService = {
  getTopics:()=>apiClient.get<InterestTopic[]>(endpoints.TOPICS),
  getPreferences:()=>apiClient.get<InterestPreferences>(endpoints.PREFERENCES),
  savePreferences:(preferences:InterestPreferences)=>apiClient.put<InterestPreferences>(endpoints.PREFERENCES,preferences),
  getFeed:(limit=9)=>apiClient.get<RecommendationFeed>(endpoints.FEED,{params:{limit}}),
  dismiss:(kind:RecommendationKind,id:string)=>apiClient.post(endpoints.DISMISSALS,{kind,id}),
  restore:(kind:RecommendationKind,id:string)=>apiClient.delete(endpoints.DISMISSAL(kind,id)),
  restoreAll:()=>apiClient.delete(endpoints.DISMISSALS),
};
