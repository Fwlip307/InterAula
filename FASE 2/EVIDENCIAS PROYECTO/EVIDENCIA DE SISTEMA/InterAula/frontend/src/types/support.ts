export type ReportKind='session'|'profile'|'note'|'post'|'project'|'workshop';
export type IncidentStatus='open'|'under_review'|'awaiting_reply'|'resolved'|'closed'|'appealed';
export type IncidentAction='claim'|'reply'|'note'|'request_reply'|'resolve'|'close'|'appeal';
export interface IncidentSummary{id:string;targetKind:ReportKind;category:string;status:IncidentStatus;updatedAt:string;role:'reporter'|'respondent'|'reviewer'}
export interface Incident extends IncidentSummary{
 targetId:string;description:string|null;sharedSummary:string|null;resolution:string|null;revision:number;createdAt:string;
 assignedToMe:boolean|null;assigned:boolean;canClaim:boolean;canAppeal:boolean;appealUsed:boolean;
 events:{id:string;kind:string;body:string;actor:string;createdAt:string}[];
}
export interface InboxNotice{id:string;title:string;body:string;href:string;created_at:string;read_at:string|null}
export interface Inbox{items:InboxNotice[];unreadCount:number;canReview:boolean;limit:number}
export const INCIDENT_STATUSES:Record<IncidentStatus,string>={open:'Recibida',under_review:'En revisión',awaiting_reply:'Esperando antecedentes',resolved:'Resuelta',closed:'Cerrada',appealed:'Apelación pendiente'};
export const REPORT_KINDS:Record<ReportKind,string>={session:'Tutoría',profile:'Perfil',note:'Apunte',post:'Foro',project:'Proyecto',workshop:'Taller'};
export const REPORT_CATEGORIES:Record<string,string>={no_show:'Inasistencia',agreement:'Incumplimiento de acuerdos',harassment:'Trato inadecuado o acoso',fraud:'Posible fraude',content:'Problema con el contenido',other:'Otro motivo'};
