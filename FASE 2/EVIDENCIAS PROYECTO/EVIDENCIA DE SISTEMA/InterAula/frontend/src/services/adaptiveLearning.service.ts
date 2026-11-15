import {apiClient} from '../lib/apiClient';
import type {AdaptiveOverview,AdaptiveExercise,AdaptiveFeedback,AdaptiveDemo} from '../types/adaptiveLearning';
const base='/learning-space/adaptive';
export const adaptiveLearningService={
 overview:():Promise<AdaptiveOverview>=>apiClient.get(base+'/overview'),
 goal:(goal_skill_id:string):Promise<AdaptiveOverview>=>apiClient.put(base+'/goal',{goal_skill_id}),
 start:():Promise<AdaptiveExercise>=>apiClient.post(base+'/practice'),
 hint:(id:string):Promise<{hint:string}>=>apiClient.post(base+'/practice/'+encodeURIComponent(id)+'/hint'),
 answer:(id:string,answer:string):Promise<{feedback:AdaptiveFeedback;overview:AdaptiveOverview}>=>apiClient.post(base+'/practice/'+encodeURIComponent(id)+'/answer',{answer}),
 demo:():Promise<AdaptiveDemo>=>apiClient.get(base+'/demo'),
};

