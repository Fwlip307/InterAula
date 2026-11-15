import {z} from 'zod';

export const tutorPriorities=['balanced','communication','knowledge','punctuality','none'] as const;
export type TutorPriority=typeof tutorPriorities[number];
export const MIN_TUTOR_REVIEWS=3,MIN_CLUSTER_TUTORS=6,MAX_CLUSTER_TUTORS=500;
export interface TutorVector {id:string;scores:[number,number,number];reviews:number}
const vector=z.tuple([z.number().finite().min(1).max(10),z.number().finite().min(1).max(10),z.number().finite().min(1).max(10)]);
const modelSchema=z.object({status:z.enum(['ready','insufficient_data','homogeneous_data','weak_structure']),
 labels:z.array(z.number().int().min(0)).max(500),centroids:z.array(vector).max(4),k:z.number().int().min(0).max(4),
 silhouette:z.number().finite().min(-1).max(1).nullable(),trainingCount:z.number().int().min(0).max(500),
 modelVersion:z.literal('kmeans-ratings-v1'),libraryVersion:z.string().min(1).max(30)}).strict();
export type TutorClusterModel=z.infer<typeof modelSchema>;
export type ClusteringResult=TutorClusterModel|{status:'unavailable';trainingCount:number};
const normalize=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function matchesTutor(profile:any,filters:{subjectId?:string;search?:string;onlyInclusive?:boolean}){
 if(filters.onlyInclusive&&!profile.inclusive_accredited)return false;
 const offered=(profile.profile_offered_subjects||[]).filter((s:any)=>s.is_verified===true);
 if(!offered.length)return false;
 if(filters.subjectId&&filters.subjectId!=='all'&&!offered.some((s:any)=>s.subject_id===filters.subjectId))return false;
 const search=normalize(filters.search?.trim()||'');
 return !search||normalize([profile.first_name,profile.last_name,profile.display_name,profile.career,...offered.flatMap((s:any)=>[s.subject?.name,s.subject?.category])].join(' ')).includes(search);
}

export const tutorClusteringService={async fit(rows:TutorVector[]):Promise<ClusteringResult>{
 if(rows.length<MIN_CLUSTER_TUTORS)return {status:'insufficient_data',trainingCount:rows.length,labels:[],centroids:[],k:0,silhouette:null,modelVersion:'kmeans-ratings-v1',libraryVersion:'not-run'};
 const url=process.env.ML_SERVICE_URL;
 if(!url)return {status:'unavailable',trainingCount:rows.length};
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
 try{
  // Only numeric averages leave the backend, never tutor IDs or learner preferences.
  const response=await fetch(url.replace(/\/$/,'')+'/cluster',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,
   body:JSON.stringify({features:rows.map(row=>row.scores)})});
  if(!response.ok)throw Error('unavailable');
  const model=modelSchema.parse(await response.json());
  if(model.trainingCount!==rows.length)throw Error('invalid population');
  if(model.status==='ready'&&(model.k<2||model.labels.length!==rows.length||model.centroids.length!==model.k||model.silhouette===null||model.silhouette<0.15||model.labels.some(id=>id>=model.k)))throw Error('invalid model');
  if(model.status!=='ready'&&(model.labels.length||model.centroids.length||model.k))throw Error('invalid fallback');
  return model;
 }catch{return {status:'unavailable',trainingCount:rows.length};}
 finally{clearTimeout(timer);}
}};

const mean=(row:number[])=>row.reduce((sum,value)=>sum+value,0)/row.length;
const dimension=(priority:TutorPriority)=>({communication:0,knowledge:1,punctuality:2} as Record<string,number>)[priority];
export function rankClusteredTutors(tutors:any[],vectors:TutorVector[],model:ClusteringResult,priority:TutorPriority){
 if(model.status!=='ready'||priority==='none')return tutors;
 const selected=dimension(priority),measure=(scores:number[])=>selected===undefined?mean(scores):scores[selected];
 const groups=model.centroids.map((center,id)=>({id,score:measure(center)})).sort((a,b)=>b.score-a.score||a.id-b.id);
 const groupOrder=new Map(groups.map((group,index)=>[group.id,index]));
 const byId=new Map(vectors.map((row,index)=>[row.id,{...row,group:model.labels[index]}]));
 const label=selected===0?'comunicación':selected===1?'dominio del tema':selected===2?'puntualidad':'valoración equilibrada';
 const decorated=tutors.map(tutor=>{
  const row=byId.get(tutor.id);
  if(!row)return {...tutor,recommendation:null};
  return {...tutor,recommendation:{method:'kmeans',group:row.group,reviewCount:row.reviews,
   reason:`Comparte un perfil de valoraciones afín a tu prioridad de ${label}. Basado en ${row.reviews} valoraciones.`,
   priority,groupMean:Number(measure(model.centroids[row.group]).toFixed(2))}};
 });
 const rated=decorated.filter(t=>t.recommendation).sort((a,b)=>{
  const x=byId.get(a.id)!,y=byId.get(b.id)!;
  return groupOrder.get(x.group)!-groupOrder.get(y.group)!||measure(y.scores)-measure(x.scores)||a.id.localeCompare(b.id);
 });
 // Keep newcomers visible: reserve one in every five positions for tutors lacking enough reviews.
 const newcomers=decorated.filter(t=>!t.recommendation),ordered:any[]=[];
 while(rated.length||newcomers.length){
  for(let i=0;i<4&&rated.length;i++)ordered.push(rated.shift());
  if(newcomers.length)ordered.push(newcomers.shift());
 }
 return ordered;
}
