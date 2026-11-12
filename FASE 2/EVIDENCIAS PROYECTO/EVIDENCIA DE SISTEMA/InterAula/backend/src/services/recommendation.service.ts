import { supabasePublic } from '../lib/supabase.js';
import { HttpError, requireDatabaseResult } from '../lib/httpError.js';
import { clientFor } from './remote/database.js';
import { rankRecommendations, type InterestTopic, type RecommendationPreferences,
  type RecommendationCandidate, type RecommendationKind } from './recommendationEngine.js';
export type { RecommendationKind };

const metadataFields = 'id,title,created_at';
async function result(query: PromiseLike<any>, message?: string): Promise<any> {
  const response=await query;
  if(['PGRST205','PGRST202','42P01','42883'].includes(String(response.error?.code))) {
    console.error('[Recommendations setup]',response.error.code);
    throw new HttpError(503,'Las sugerencias aún no están activadas en InterAula. Puedes seguir explorando la comunidad.','RECOMMENDATIONS_NOT_READY');
  }
  return requireDatabaseResult(response,message);
}
const excerpt = (text: string | null | undefined) => (text || '').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,220);
export const recommendationService = {
  async topics(): Promise<InterestTopic[]> {
    return result(supabasePublic.from('recommendation_topics').select('id,name,category,aliases').order('category').order('name'),
      'No se pudo cargar el catálogo de intereses. Intenta nuevamente.');
  },
  async preferences(token: string): Promise<RecommendationPreferences> {
    return result(clientFor(token).rpc('get_recommendation_preferences'),
      'No se pudieron cargar tus intereses. Intenta nuevamente.');
  },
  async savePreferences(token: string, document: RecommendationPreferences): Promise<RecommendationPreferences> {
    try {
      return await result(clientFor(token).rpc('save_recommendation_preferences',{p_document:document}),
        'No se pudieron guardar tus intereses. Conservamos tu selección para que reintentes.');
    } catch(error) {
      if(error instanceof HttpError && error.status===409) throw new HttpError(409,'Tus intereses cambiaron en otra ventana. Recarga antes de guardar nuevamente.');
      throw error;
    }
  },
  async feed(userId: string, token: string, limit=9) {
    const client=clientFor(token);
    const [topics,preferences] = await Promise.all([this.topics(),this.preferences(token)]);
    // Every candidate is read under the user's JWT and RLS. Never fetch HTML/files/contact.
    const [notes,posts,projects,workshops,dismissals,needed,people] = await Promise.all([
      result(client.from('academic_notes').select(`${metadataFields},author_id,summary,subject_id,subject_name,tags`)
        .eq('is_draft',false).in('visibility',['public','shared']).order('created_at',{ascending:false}).limit(150)),
      result(client.from('forum_posts').select(`${metadataFields},author_id,description,subject_id,category,tags`)
        .order('created_at',{ascending:false}).limit(150)),
      result(client.from('projects').select(`${metadataFields},owner_id,description,short_description,category,tags,technologies`)
        .eq('visibility','public').in('status',['open','recruiting']).order('created_at',{ascending:false}).limit(150)),
      result(client.from('workshop_summary').select(`${metadataFields},tutor_id,description,subject_id,status,scheduled_at,max_students,enrollments_count`)
        .in('status',['scheduled','in_progress']).or(`status.eq.in_progress,scheduled_at.gte.${new Date().toISOString()}`)
        .order('scheduled_at',{ascending:true}).limit(150)),
      result(client.from('recommendation_dismissals').select('kind,item_id').eq('user_id',userId)),
      preferences.personalization_enabled ? result(client.from('profile_needed_subjects').select('subject_id,subject:subjects(name)').eq('profile_id',userId)) : [],
      preferences.personalization_enabled ? result(client.from('public_profiles')
        .select('id,display_name,first_name,last_name,institution,career,available_for_tutoring,available_for_projects,updated_at')
        .neq('id',userId).or('available_for_tutoring.eq.true,available_for_projects.eq.true')
        .order('updated_at',{ascending:false}).limit(150)) : [],
    ]);
    const peopleIds=people.map((person:any)=>person.id);
    const subjectIds=[...new Set([...notes,...posts,...workshops].map((row:any)=>row.subject_id).filter(Boolean))];
    const [sharedTopics,offered,subjects] = await Promise.all([
      peopleIds.length ? result(client.from('discoverable_topic_interests').select('user_id,topic_id,intent').in('user_id',peopleIds)) : [],
      peopleIds.length ? result(client.from('profile_offered_subjects').select('profile_id,subject_id,is_verified,subject:subjects(name)').in('profile_id',peopleIds)) : [],
      subjectIds.length ? result(client.from('subjects').select('id,name').in('id',subjectIds)) : [],
    ]);
    const subjectNames=new Map(subjects.map((subject:any)=>[subject.id,subject.name]));
    const candidates: RecommendationCandidate[] = [
      ...notes.map((row:any)=>({id:row.id,kind:'note',title:row.title,summary:excerpt(row.summary),
        href:`/resources?note=${row.id}`,createdAt:row.created_at,ownerId:row.author_id,subjectId:row.subject_id,
        text:[row.title,row.summary,row.subject_name,...(row.tags||[])].join(' ')})),
      ...posts.map((row:any)=>({id:row.id,kind:'post',title:row.title,summary:excerpt(row.description),
        href:`/forum?post=${row.id}`,createdAt:row.created_at,ownerId:row.author_id,subjectId:row.subject_id,
        text:[row.title,row.description,row.category,subjectNames.get(row.subject_id),...(row.tags||[])].join(' ')})),
      ...projects.map((row:any)=>({id:row.id,kind:'project',title:row.title,summary:excerpt(row.short_description||row.description),
        href:`/projects?project=${row.id}`,createdAt:row.created_at,ownerId:row.owner_id,
        text:[row.title,row.description,row.category,...(row.tags||[]),...(row.technologies||[])].join(' ')})),
      ...workshops.filter((row:any)=>(row.status==='in_progress'||Date.parse(row.scheduled_at)>Date.now())&&Number(row.enrollments_count)<row.max_students)
        .map((row:any)=>({id:row.id,kind:'workshop',title:row.title,summary:excerpt(row.description),
          href:`/tutoring?tab=workshops&workshop=${row.id}`,createdAt:row.created_at,ownerId:row.tutor_id,subjectId:row.subject_id,
          text:[row.title,row.description,subjectNames.get(row.subject_id)].join(' ')})),
      ...people.map((person:any)=>({id:person.id,kind:'person',title:person.display_name||[person.first_name,person.last_name].filter(Boolean).join(' ')||'Estudiante',
        summary:[person.career,person.institution].filter(Boolean).join(' · '),href:`/profile/${person.id}`,createdAt:person.updated_at,
        interests:sharedTopics.filter((topic:any)=>topic.user_id===person.id),
        offeredSubjects:person.available_for_tutoring ? offered.filter((subject:any)=>subject.profile_id===person.id).map((subject:any)=>({id:subject.subject_id,name:subject.subject?.name||'',verified:subject.is_verified===true})) : [],
      })),
    ];
    const feed=rankRecommendations({userId,preferences,topics,candidates,limit,
      neededSubjects:needed.map((subject:any)=>({id:subject.subject_id,name:subject.subject?.name||''})),
      dismissed:dismissals.map((item:any)=>`${item.kind}:${item.item_id}`)});
    return {...feed,personalizationEnabled:preferences.personalization_enabled,algorithmVersion:'interests-v1',
      generatedAt:new Date().toISOString(),hiddenCount:dismissals.length};
  },
  async dismiss(userId: string, token: string, kind: RecommendationKind, id: string) {
    const client=clientFor(token);
    const table={note:'academic_notes',post:'forum_posts',project:'projects',workshop:'tutoring_workshops',person:'public_profiles'}[kind];
    const visible=await result(client.from(table).select('id').eq('id',id).maybeSingle());
    if(!visible) throw new HttpError(404,'Esta sugerencia ya no está disponible.');
    await result(client.from('recommendation_dismissals').upsert({user_id:userId,kind,item_id:id},
      {onConflict:'user_id,kind,item_id',ignoreDuplicates:true}),'No se pudo ocultar la sugerencia. Intenta nuevamente.');
    return {success:true};
  },
  async restore(userId: string, token: string, kind?: RecommendationKind, id?: string) {
    let query=clientFor(token).from('recommendation_dismissals').delete().eq('user_id',userId);
    if(kind&&id)query=query.eq('kind',kind).eq('item_id',id);
    await result(query,'No se pudieron restaurar las sugerencias. Intenta nuevamente.');
    return {success:true};
  },
};
