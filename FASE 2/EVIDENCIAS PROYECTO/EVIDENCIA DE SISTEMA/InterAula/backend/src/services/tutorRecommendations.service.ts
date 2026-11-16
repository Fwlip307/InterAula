import {z} from 'zod';
import {tutoringBackendService} from './tutoring.service.js';
import {readTutorStatistics} from './tutorStatistics.service.js';
import {tutorClusteringService,tutorPriorities,MIN_TUTOR_REVIEWS,MIN_CLUSTER_TUTORS,MAX_CLUSTER_TUTORS,matchesTutor,rankClusteredTutors,type TutorPriority,type TutorVector,type ClusteringResult} from './tutorClustering.service.js';

export const tutorRecommendationQuery=z.object({subjectId:z.string().trim().min(1).max(200).optional(),search:z.string().trim().max(120).optional(),
 onlyVerified:z.enum(['true','false']).optional(),onlyInclusive:z.enum(['true','false']).optional(),priority:z.enum(tutorPriorities).default('balanced')}).strict();
export const tutorDemoQuery=z.object({priority:z.enum(tutorPriorities).default('balanced')}).strict();
export type TutorRecommendationFilters=z.infer<typeof tutorRecommendationQuery>;
const descriptions:Record<string,string>={ready:'Ordenamos perfiles con valoraciones similares según la prioridad que elegiste. Revisa también las materias y la disponibilidad.',
 insufficient_data:'Todavía faltan valoraciones para comparar perfiles. Puedes seguir buscando tutores por materia.',
 homogeneous_data:'Las valoraciones disponibles son muy parecidas. Mostramos los tutores sin agruparlos.',
 weak_structure:'No encontramos grupos suficientemente claros. Puedes seguir explorando el catálogo.',
 unavailable:'La comparación de perfiles no está disponible ahora. El catálogo sigue funcionando.',
 not_requested:'Mostramos el catálogo sin priorizar perfiles por sus valoraciones.'};
function metadata(model:ClusteringResult|{status:'not_requested';trainingCount:number},dataset:'community'|'synthetic_demo'){
 return {method:model.status==='ready'?'kmeans':'catalog',status:model.status,dataset,description:descriptions[model.status],
  trainingCount:model.trainingCount,minReviews:MIN_TUTOR_REVIEWS,minTutors:MIN_CLUSTER_TUTORS,
  clusterCount:'k' in model?model.k:0,silhouette:'silhouette' in model?model.silhouette:null,
  modelVersion:'modelVersion' in model?model.modelVersion:null};
}
export const tutorRecommendationsService={
 async list(userId:string,filters:TutorRecommendationFilters){
  const pool=await tutoringBackendService.getAvailableTutors();
  const stats=await readTutorStatistics(pool.map(t=>t.id)),byId=new Map((stats||[]).map(row=>[row.profile_id,row]));
  const vectors:TutorVector[]=(stats||[]).filter(row=>row.total_reviews_received>=MIN_TUTOR_REVIEWS&&[row.avg_communication,row.avg_knowledge,row.avg_punctuality].every(score=>score>=1))
   .sort((a,b)=>b.total_reviews_received-a.total_reviews_received||a.profile_id.localeCompare(b.profile_id)).slice(0,MAX_CLUSTER_TUTORS)
   .map(row=>({id:row.profile_id,reviews:row.total_reviews_received,scores:[row.avg_communication,row.avg_knowledge,row.avg_punctuality]}));
  const visible=pool.filter(t=>t.id!==userId&&matchesTutor(t,{...filters,onlyInclusive:filters.onlyInclusive==='true'}))
   .map(t=>({...t,statistics:byId.get(t.id)||null,recommendation:null}));
  const model=filters.priority==='none'?{status:'not_requested' as const,trainingCount:vectors.length}
   :stats===null?{status:'unavailable' as const,trainingCount:0}:await tutorClusteringService.fit(vectors);
  return {tutors:model.status==='not_requested'?visible:rankClusteredTutors(visible,vectors,model,filters.priority),model:metadata(model,'community')};
 },
 async demo(priority:TutorPriority){
  const groups=[{name:'Comunicación',scores:[9.3,6.5,6.2]},{name:'Dominio',scores:[6.3,9.4,6.4]},{name:'Puntualidad',scores:[6.5,6.3,9.5]}];
  const vectors:TutorVector[]=groups.flatMap((group,g)=>Array.from({length:6},(_,i)=>({id:`demo-${g}-${i}`,reviews:12+i,
   scores:group.scores.map((value,j)=>Number((value+(((i+j)%3)-1)*0.12).toFixed(2))) as [number,number,number]})));
  const profiles=vectors.map((row,i)=>({id:row.id,displayName:`[DEMO] Perfil ${groups[Math.floor(i/6)].name} ${i%6+1}`,scores:row.scores,reviewCount:row.reviews}));
  const model=priority==='none'?{status:'not_requested' as const,trainingCount:vectors.length}:await tutorClusteringService.fit(vectors);
  return {profiles:model.status==='not_requested'?profiles:rankClusteredTutors(profiles,vectors,model,priority),model:metadata(model,'synthetic_demo')};
 },
};
