import {z} from 'zod';
import {detectTopics,type InterestTopic,type RecommendationCandidate,type RecommendationPreferences} from './recommendationEngine.js';

const MODEL_VERSION='interests-kmeans-v1';
const statuses=['ready','insufficient_data','homogeneous_data','weak_structure'] as const;
const modelSchema=z.object({status:z.enum(statuses),centroids:z.array(z.array(z.number().finite().min(0).max(1)).min(2).max(128)).max(4),
 k:z.number().int().min(0).max(4),silhouette:z.number().finite().min(-1).max(1).nullable(),trainingCount:z.number().int().min(0).max(150),
 modelVersion:z.literal(MODEL_VERSION),libraryVersion:z.string().min(1).max(30)}).strict();
export type InterestModelStatus=typeof statuses[number]|'disabled'|'no_interests'|'unavailable';
export interface InterestMatchingMetadata {
 method:'hybrid-kmeans'|'affinity';status:InterestModelStatus;description:string;trainingCount:number;clusterCount:number;modelVersion:string|null;
}
const descriptions:Record<InterestModelStatus,string>={
 ready:'Combinamos tus temas, grupos de intereses similares y la comunidad que elegiste.',
 insufficient_data:'Usamos tus temas y tu comunidad. Aún faltan perfiles con temas públicos para formar grupos.',
 homogeneous_data:'Los temas públicos son muy parecidos. Usamos afinidad directa y tu comunidad.',
 weak_structure:'Todavía no hay grupos claros. Usamos tus temas y tu comunidad.',
 disabled:'La personalización está desactivada: mostramos novedades de la comunidad elegida.',
 no_interests:'Elige temas para combinar tus intereses con las oportunidades de tu comunidad.',
 unavailable:'La agrupación no está disponible ahora. Tus temas y filtros de comunidad siguen funcionando.',
};
export const interestMetadata=(status:InterestModelStatus,trainingCount=0,clusterCount=0):InterestMatchingMetadata=>({
 method:status==='ready'?'hybrid-kmeans':'affinity',status,description:descriptions[status],trainingCount,clusterCount,modelVersion:status==='ready'?MODEL_VERSION:null,
});
export interface InterestMatching {metadata:InterestMatchingMetadata;boosts:Map<string,number>}
const cosine=(a:number[],b:number[])=>{
 const denominator=Math.hypot(...a)*Math.hypot(...b);
 return denominator?Math.max(0,Math.min(1,a.reduce((sum,value,i)=>sum+value*b[i],0)/denominator)):0;
};
function candidateTopics(candidate:RecommendationCandidate,topics:InterestTopic[]):Set<string>{
 return new Set(candidate.kind==='person'
  ?[...(candidate.interests||[]).map(item=>item.topic_id),...(candidate.offeredSubjects||[]).filter(subject=>subject.verified).flatMap(subject=>detectTopics(subject.name,topics))]
  :detectTopics(candidate.text||`${candidate.title} ${candidate.summary}`,topics));
}
export const interestClusteringService={
 async match(input:{userId:string;preferences:RecommendationPreferences;topics:InterestTopic[];candidates:RecommendationCandidate[];
  neededSubjects?:{id:string;name:string}[];dismissed?:string[]}):Promise<InterestMatching>{
  const fallback=(status:InterestModelStatus,count=0):InterestMatching=>({metadata:interestMetadata(status,count),boosts:new Map()});
  const {preferences,topics}=input;
  if(!preferences.personalization_enabled)return fallback('disabled');
  const learning=new Set([...preferences.learn,...(input.neededSubjects||[]).flatMap(subject=>detectTopics(subject.name,topics))]);
  const ordered=[...topics].sort((a,b)=>a.id.localeCompare(b.id));
  const own=ordered.map(topic=>learning.has(topic.id)?1.5:preferences.interest.includes(topic.id)?1:preferences.teach.includes(topic.id)?.75:0);
  if(!own.some(Boolean))return fallback('no_interests');
  if(ordered.length<2||ordered.length>128)return fallback('unavailable');
  const hidden=new Set(input.dismissed||[]),seen=new Set<string>();
  const people=input.candidates.filter(candidate=>candidate.kind==='person'&&candidate.id!==input.userId&&!hidden.has(`person:${candidate.id}`))
   .sort((a,b)=>a.id.localeCompare(b.id)).filter(candidate=>{if(seen.has(candidate.id))return false;seen.add(candidate.id);return true;});
  const features=people.map(candidate=>{const selected=candidateTopics(candidate,ordered);return ordered.map(topic=>selected.has(topic.id)?1:0);})
   .filter(row=>row.some(Boolean)).slice(0,150);
  if(features.length<6)return fallback('insufficient_data',features.length);
  if(!process.env.ML_SERVICE_URL)return fallback('unavailable',features.length);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
  try{
   // Only public topic presence is sent. The user's private query vector and location stay here.
   const response=await fetch(process.env.ML_SERVICE_URL.replace(/\/$/,'')+'/interests',{method:'POST',headers:{'Content-Type':'application/json'},
    signal:controller.signal,body:JSON.stringify({features})});
   if(!response.ok)throw Error('ML unavailable');
   const model=modelSchema.parse(await response.json());
   if(model.trainingCount!==features.length)throw Error('Invalid population');
   if(model.status!=='ready'){
    if(model.k||model.centroids.length)throw Error('Invalid fallback');
    return fallback(model.status,features.length);
   }
   if(model.k<2||model.centroids.length!==model.k||model.silhouette===null||model.silhouette<.15
     ||model.centroids.some(row=>row.length!==ordered.length||!row.some(Boolean)))throw Error('Invalid centroids');
   const affinity=model.centroids.map(center=>cosine(own,center));
   const boosts=new Map<string,number>();
   for(const candidate of input.candidates){
    const selected=candidateTopics(candidate,ordered),row=ordered.map(topic=>selected.has(topic.id)?1:0);
    // Assign to the nearest topic group locally; a centroid never makes unrelated content eligible.
    const similarities=model.centroids.map(center=>cosine(row,center));
    const group=similarities.reduce((best,score,index)=>score>similarities[best]?index:best,0);
    if(affinity[group]>=.35&&similarities[group]>=.45)boosts.set(`${candidate.kind}:${candidate.id}`,2*affinity[group]*similarities[group]);
   }
   return {metadata:interestMetadata('ready',features.length,model.k),boosts};
  }catch{return fallback('unavailable',features.length);}
  finally{clearTimeout(timer);}
 },
};
