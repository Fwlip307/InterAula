import {apiClient} from '../lib/apiClient';
export type MeasureScope='warning'|'subject'|'tutoring'|'community'|'account';
export const MEASURE_LABELS:Record<MeasureScope,string>={warning:'Advertencia',subject:'Tutorías de una materia',tutoring:'Ofrecer tutorías y talleres',community:'Publicar e interactuar en comunidad',account:'Uso de la cuenta'};
export interface Measure{id:string;caseId?:string;scope:MeasureScope;subjectName?:string;reason:string;precautionary:boolean;startsAt:string;endsAt:string|null;revokedAt:string|null;revocationReason?:string;active?:boolean}
export interface ModerationSummary{enabled:boolean;account:boolean;tutoring:boolean;community:boolean}
export interface MyMeasures{summary:ModerationSummary;strikes:number;windowDays:number;items:Measure[]}
export interface CaseMeasures{canSanction:boolean;canSuspendAccounts:boolean;hasMeasure:boolean;needsMeasureAppeal:boolean;finding:{id:string;severity:string;reason:string;overturnedAt:string|null}|null;relatedFindings:{id:string;caseId:string;reason:string;confirmedAt:string;overturned:boolean}[];subjects:{id:string;name:string}[];measures:Measure[]}
export const moderationService={
 summary:()=>apiClient.get<ModerationSummary>('/moderation/summary'),
 mine:()=>apiClient.get<MyMeasures>('/moderation/mine'),
 context:(id:string)=>apiClient.get<CaseMeasures>('/moderation/cases/'+encodeURIComponent(id)),
 decide:(id:string,revision:number,document:Record<string,unknown>)=>apiClient.post<CaseMeasures>('/moderation/cases/'+encodeURIComponent(id)+'/decision',{revision,document}),
 appeal:(id:string,revision:number,outcome:string,reason:string,message:string)=>apiClient.post<CaseMeasures>('/moderation/cases/'+encodeURIComponent(id)+'/appeal-decision',{revision,outcome,reason,message}),
};
