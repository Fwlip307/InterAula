import { z } from 'zod';
import { communityCatalog } from '../data/communityCatalog.js';
import { clientFor, result } from './remote/database.js';
import { HttpError } from '../lib/httpError.js';

export const communitySchema=z.object({
  institutionId:z.string().max(80).nullable(),campusId:z.string().max(80).nullable(),
  scope:z.enum(['all','institution','campus','nearby']),
  modality:z.enum(['any','online','in_person','hybrid']),
}).strict();
export type CommunityPreferences=z.infer<typeof communitySchema>;
export interface AcademicOrigin {institution?:string|null;location?:string|null;modality?:string|null}
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function resolveAcademicOrigin(origin:AcademicOrigin) {
  const name=normalize(origin.institution||'');
  const institution=communityCatalog.find(i=>i.id===origin.institution||normalize(i.name)===name)
    ||(name.includes('duoc')?communityCatalog.find(i=>normalize(i.name).includes('duoc')):undefined);
  const location=normalize(origin.location||'');
  const campus=institution?.sedes.find(s=>s.id===origin.location||normalize(s.name)===location);
  return {institution,campus};
}
export function validateCommunity(document:CommunityPreferences):CommunityPreferences {
  const institution=communityCatalog.find(i=>i.id===document.institutionId);
  const campus=institution?.sedes.find(s=>s.id===document.campusId);
  if(document.institutionId&&!institution)throw new HttpError(400,'Elige una institución del catálogo.');
  if(document.campusId&&!campus)throw new HttpError(400,'La sede debe pertenecer a la institución elegida.');
  if(document.scope!=='all'&&!institution)throw new HttpError(400,'Elige una institución para limitar la comunidad.');
  if(['campus','nearby'].includes(document.scope)&&!campus)throw new HttpError(400,'Elige una sede para esta búsqueda.');
  if(document.scope==='nearby'&&(!campus?.comuna||!campus.region))throw new HttpError(400,'Esta sede no tiene una comuna registrada. Puedes buscar por institución.');
  return document;
}
export function matchCommunity(preferences:CommunityPreferences,origin:AcademicOrigin) {
  const ref=communityCatalog.find(i=>i.id===preferences.institutionId);
  const campus=ref?.sedes.find(s=>s.id===preferences.campusId);
  const candidate=resolveAcademicOrigin(origin);
  const sameInstitution=!!ref&&ref.id===candidate.institution?.id;
  const sameCampus=sameInstitution&&!!campus&&campus.id===candidate.campus?.id;
  const sameArea=!!campus?.comuna&&!!campus.region&&!!candidate.campus?.comuna
    &&normalize(campus.comuna)===normalize(candidate.campus.comuna)
    &&normalize(campus.region)===normalize(candidate.campus.region||'');
  const scopeMatch=preferences.scope==='all'||(preferences.scope==='institution'&&sameInstitution)
    ||(preferences.scope==='campus'&&sameCampus)||(preferences.scope==='nearby'&&sameArea);
  const mode=origin.modality;
  const modalityMatch=preferences.modality==='any'||!mode||mode===preferences.modality
    ||(mode==='hybrid'&&['online','in_person'].includes(preferences.modality));
  const reason=sameCampus?'Misma institución y sede':sameArea?'Sede en la misma comuna':sameInstitution?'Misma institución':'';
  return {scopeMatch,modalityMatch,reason,priority:preferences.modality==='online'&&preferences.scope==='all'?0:sameCampus?3:sameArea?2:sameInstitution?1:0};
}
export const communityService={
  async get(userId:string,token:string) {
    const response=await clientFor(token).from('profiles').select('institution,location,community_preferences').eq('id',userId).maybeSingle();
    let profile=response.data;let activationRequired=false;
    if(response.error&&['42703','PGRST204'].includes(String(response.error.code))) {
      profile=await result(clientFor(token).from('profiles').select('institution,location').eq('id',userId).maybeSingle());
      activationRequired=true;
    } else if(response.error)await result(Promise.resolve(response));
    const origin=resolveAcademicOrigin(profile||{});
    const saved=communitySchema.safeParse(profile?.community_preferences);
    const preferences:CommunityPreferences=saved.success?saved.data:{institutionId:origin.institution?.id||null,campusId:origin.campus?.id||null,scope:'all',modality:'any'};
    return {preferences,activationRequired};
  },
  async save(userId:string,token:string,document:CommunityPreferences) {
    const preferences=validateCommunity(document);
    const response=await clientFor(token).from('profiles').update({community_preferences:preferences}).eq('id',userId).select('id').maybeSingle();
    if(response.error&&['42703','PGRST204'].includes(String(response.error.code)))throw new HttpError(503,'La comunidad académica aún no está activada en la base de datos.','COMMUNITY_NOT_READY');
    await result(Promise.resolve(response));
    if(!response.data)throw new HttpError(404,'No encontramos tu perfil.');
    return {preferences,activationRequired:false};
  },
};
