import {z} from 'zod';
import {getAdminSupabase} from '../lib/supabase.js';

const statistic=z.object({profile_id:z.string().uuid(),total_completed_tutorings:z.coerce.number().int().min(0),
 total_reviews_received:z.coerce.number().int().min(0),avg_communication:z.coerce.number().min(0).max(10),
 avg_knowledge:z.coerce.number().min(0).max(10),avg_punctuality:z.coerce.number().min(0).max(10),overall_rating:z.coerce.number().min(0).max(10)}).strict();
export type TutorStatistic=z.infer<typeof statistic>;
let revision=0;
let cache:{key:string;expires:number;rows:TutorStatistic[]}|null=null;
const pending=new Map<string,Promise<TutorStatistic[]|null>>();
export function clearTutorStatisticsCache(){revision++;cache=null;pending.clear();}

/** Read only aggregates of public, available tutors. No reviews, comments or student IDs. */
export async function readTutorStatistics(ids:string[]):Promise<TutorStatistic[]|null>{
 if(!ids.length)return [];
 const ordered=[...new Set(ids)].sort(),key=ordered.join(',');
 if(cache?.key===key&&cache.expires>Date.now())return cache.rows;
 const existing=pending.get(key);if(existing)return existing;
 const generation=revision;
 const task=(async()=>{
  try{
   const client=getAdminSupabase(),rows:TutorStatistic[]=[];
   for(let start=0;start<ordered.length;start+=100){
    const {data,error}=await client.from('tutor_statistics_view')
     .select('profile_id,total_completed_tutorings,total_reviews_received,avg_communication,avg_knowledge,avg_punctuality,overall_rating')
     .in('profile_id',ordered.slice(start,start+100));
    if(error) return null;
    rows.push(...z.array(statistic).parse(data));
   }
   if(generation===revision)cache={key,rows,expires:Date.now()+30_000};
   return rows;
  }catch{return null;}
 })();
 if(pending.size<4)pending.set(key,task);
 try{return await task;}finally{if(pending.get(key)===task)pending.delete(key);}
}
