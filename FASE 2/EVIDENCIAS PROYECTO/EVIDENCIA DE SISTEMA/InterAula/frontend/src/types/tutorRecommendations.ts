export type TutorPriority='balanced'|'communication'|'knowledge'|'punctuality'|'none';
export interface TutorMatch {method:'kmeans';group:number;reviewCount:number;reason:string;priority:TutorPriority;groupMean:number}
export interface TutorModelMetadata {
 method:'kmeans'|'catalog';status:'ready'|'insufficient_data'|'homogeneous_data'|'weak_structure'|'unavailable'|'not_requested';
 dataset:'community'|'synthetic_demo';description:string;trainingCount:number;minReviews:number;minTutors:number;
 clusterCount:number;silhouette:number|null;modelVersion:string|null;
}
export interface TutorDemo {model:TutorModelMetadata;profiles:{id:string;displayName:string;scores:[number,number,number];reviewCount:number;recommendation?:TutorMatch|null}[]}
