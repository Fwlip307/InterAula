import {z} from 'zod';
import {communityCatalog} from '../data/communityCatalog.js';
import {interestClusteringService} from './interestClustering.service.js';
import {defaultRecommendationPreferences,rankRecommendations,type InterestTopic,type RecommendationCandidate} from './recommendationEngine.js';
import type {CommunityPreferences} from './community.service.js';

export const interestDemoQuery=z.object({focus:z.enum(['data','web','business']).default('data'),scope:z.enum(['all','campus','nearby']).default('all')}).strict();
export type InterestDemoQuery=z.infer<typeof interestDemoQuery>;
export function interestDemoFixture(query:InterestDemoQuery){
 const groups=[{id:'data',names:['Python','Análisis de datos','Estadística']},{id:'web',names:['Desarrollo web','Diseño','JavaScript']},
  {id:'business',names:['Marketing','Administración','Finanzas']}];
 const topics:InterestTopic[]=groups.flatMap(group=>group.names.map((name,i)=>({id:`${group.id}-${i}`,name,category:group.id,aliases:[]})));
 const group=groups.find(item=>item.id===query.focus)!;
 const institution=communityCatalog.find(i=>i.sedes.some(s=>s.comuna&&s.region))!;
 const campus=institution.sedes.find(s=>s.comuna&&s.region)!;
 const alternatives=communityCatalog.flatMap(i=>i.sedes.map(s=>({institution:i.name,location:s.name,campus:s,id:i.id})));
 const neighbor=alternatives.find(p=>p.id!==institution.id&&p.campus.comuna===campus.comuna&&p.campus.region===campus.region);
 const distant=alternatives.find(p=>p.campus.comuna&&p.campus.comuna!==campus.comuna)!;
 const origins=[{institution:institution.name,location:campus.name},neighbor||{institution:institution.name,location:campus.name},distant];
 const community:CommunityPreferences={institutionId:institution.id,campusId:campus.id,scope:query.scope,modality:'any'};
 const preferences={...defaultRecommendationPreferences(),learn:[`${group.id}-0`],interest:[`${group.id}-1`]};
 const candidates:RecommendationCandidate[]=groups.flatMap((entry,g)=>{
  const people:RecommendationCandidate[]=Array.from({length:6},(_,i)=>({id:`demo-person-${g}-${i}`,kind:'person',
   title:`[DEMO] Compañero de ${entry.names[0]} ${i+1}`,summary:'Perfil ficticio, sin reservas.',href:'#',createdAt:'2026-11-01',origin:origins[i%3],
   interests:topics.filter(t=>t.category===entry.id&&(i%3!==0||t.id!==`${entry.id}-2`)).map(t=>({topic_id:t.id,intent:'interest'}))}));
  const content:RecommendationCandidate[]=['note','post','project','workshop'].map((kind,i)=>({id:`demo-content-${g}-${i}`,kind:kind as RecommendationCandidate['kind'],
   title:`[DEMO] ${['Apunte','Conversación','Proyecto','Taller'][i]} de ${entry.names[0]}`,summary:'Oportunidad ficticia para comparar temas y comunidad.',href:'#',
   createdAt:'2026-11-02',text:entry.names.slice(0,2).join(' '),origin:{...origins[i%3],...(kind==='workshop'?{modality:'online'}:{})}}));
  return [...people,...content];
 });
 return {userId:'demo-reader',topics,preferences,candidates,community,reference:{institution:institution.name,campus:campus.name,commune:campus.comuna},
  selectedTopics:[group.names[0],group.names[1]]};
}
export const interestDemoService={async run(query:InterestDemoQuery){
 const fixture=interestDemoFixture(query),matching=await interestClusteringService.match(fixture);
 const feed=rankRecommendations({...fixture,clusterBoosts:matching.boosts});
 return {dataset:'synthetic_demo' as const,matching:matching.metadata,reference:fixture.reference,selectedTopics:fixture.selectedTopics,
  scope:query.scope,items:feed.items.map(({href:_,...item})=>item)};
}};
