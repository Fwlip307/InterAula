import {apiClient} from '../lib/apiClient';
import type {Inbox,Incident,IncidentSummary,ReportKind,IncidentAction} from '../types/support';
const base='/support';
export const supportService={
 inbox:(summary=false)=>apiClient.get<Inbox>(base+'/inbox',{params:{summary:String(summary)}}),
 read:(id?:string)=>apiClient.post(base+'/inbox/read',id?{id}:{}),
 list:(queue:'mine'|'review'='mine')=>apiClient.get<{items:IncidentSummary[];canReview:boolean;limit:number}>(base+'/cases',{params:{queue}}),
 detail:(id:string)=>apiClient.get<Incident>(base+'/cases/'+encodeURIComponent(id)),
 create:(body:{kind:ReportKind;targetId:string;category:string;description:string})=>apiClient.post<Incident>(base+'/cases',body),
 act:(id:string,action:IncidentAction,message:string,revision:number)=>apiClient.post<Incident>(base+'/cases/'+encodeURIComponent(id)+'/actions',{action,message,revision}),
};
