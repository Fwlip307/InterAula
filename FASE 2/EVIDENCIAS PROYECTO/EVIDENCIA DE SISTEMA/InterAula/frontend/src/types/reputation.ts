export interface TutorReputation {
 profile_id:string;valid_sessions:number;legacy_sessions:number;recent_reviews:number;recent_reviewers:number;
 communication_average:number|null;knowledge_average:number|null;punctuality_average:number|null;
 communication_adjusted:number|null;knowledge_adjusted:number|null;punctuality_adjusted:number|null;
 communication_highlight:boolean;knowledge_highlight:boolean;punctuality_highlight:boolean;
}
export interface ReputationResult {
 status:'ready'|'activation_required';reputation:TutorReputation|null;
 policy?:{version:number;windowDays:number;minReviews:number;minReviewers:number;threshold:number;priorMean:number;priorWeight:number};
}
