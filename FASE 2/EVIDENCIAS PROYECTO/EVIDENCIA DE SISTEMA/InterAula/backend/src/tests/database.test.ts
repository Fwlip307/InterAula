import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTestPostgres } from './helpers/postgres.js';

const migrations=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../supabase/migrations');
const ids={owner:'00000000-0000-0000-0000-000000000101',student:'00000000-0000-0000-0000-000000000102',other:'00000000-0000-0000-0000-000000000103',teacher:'00000000-0000-0000-0000-000000000104'};
test('Migraciones completas: privacidad, persistencia y acreditación en PostgreSQL aislado',async()=>{
  const db=await createTestPostgres();
  try{
    const activationSql=await fs.readFile(path.join(migrations,'../ACTIVAR_INTERESES.sql'),'utf8');
    await assert.rejects(db.exec(activationSql),/Falta la tabla previa/);
    await db.exec('ROLLBACK');
    assert.equal((await db.query<any>("SELECT to_regclass('public.recommendation_topics') AS missing")).rows[0].missing,null);
    for(const file of (await fs.readdir(migrations)).filter(file=>file.endsWith('.sql')&&Number(file.slice(0,3))<=15).sort()){
      try{await db.exec(await fs.readFile(path.join(migrations,file),'utf8'));}
      catch(error){throw new Error('Migration '+file+': '+(error instanceof Error?error.message:String(error)));}
    }
    await db.exec(activationSql);
    assert.equal((await db.query<any>('SELECT count(*)::integer AS total FROM public.recommendation_topics')).rows[0].total,22);
    await db.exec("GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;GRANT SELECT ON storage.objects TO anon;");
    // Restore the deliberate service-only table grants after simulating Supabase defaults.
    await db.exec("REVOKE ALL ON public.tutor_assessment_attempts,public.tutoring_attendance FROM anon,authenticated;");
    for(const [name,id]of Object.entries(ids))await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)",[id,name+'@university.example',JSON.stringify({first_name:name,last_name:'Test'})]);
    await db.query("UPDATE public.profiles SET phone='private-contact',learning_preferences=ARRAY['private-preference'],show_phone=false WHERE id=$1",[ids.owner]);
    const as=async(role:string,id?:string)=>{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",[id||'',role]);await db.exec('SET ROLE '+role);};
    await as('authenticated',ids.student);
    assert.equal((await db.query("SELECT * FROM public.profiles WHERE id=$1",[ids.owner])).rows.length,0);
    const publicProfile:any=(await db.query("SELECT * FROM public.public_profiles WHERE id=$1",[ids.owner])).rows[0];
    assert.equal(publicProfile.phone,null);
    assert.deepEqual(publicProfile.learning_preferences,[]);


    // Interest selections are private, versioned and atomically replaced.
    const preferenceDoc={revision:0,personalization_enabled:true,discoverable:false,interest:['python'],learn:['databases'],teach:[]};
    await as('authenticated',ids.owner);
    const initialPrefs:any=(await db.query("SELECT public.get_recommendation_preferences() AS value")).rows[0];
    assert.equal(initialPrefs.value.revision,0);assert.deepEqual(initialPrefs.value.interest,[]);
    await db.query("SELECT public.save_recommendation_preferences($1)",[JSON.stringify(preferenceDoc)]);
    assert.equal((await db.query<any>("SELECT public.get_recommendation_preferences() AS value")).rows[0].value.revision,1);
    await assert.rejects(db.query("SELECT public.save_recommendation_preferences($1)",[JSON.stringify(preferenceDoc)]));
    await assert.rejects(db.query("SELECT public.save_recommendation_preferences($1)",[JSON.stringify({...preferenceDoc,revision:1,interest:['unknown-topic']})]));
    assert.deepEqual((await db.query<any>("SELECT public.get_recommendation_preferences() AS value")).rows[0].value.interest,['python']);
    await as('authenticated',ids.student);
    assert.equal((await db.query("SELECT * FROM public.user_topic_interests WHERE user_id=$1",[ids.owner])).rows.length,0);
    assert.equal((await db.query("SELECT * FROM public.recommendation_preferences WHERE user_id=$1",[ids.owner])).rows.length,0);
    assert.equal((await db.query("SELECT * FROM public.discoverable_topic_interests WHERE user_id=$1",[ids.owner])).rows.length,0);
    await assert.rejects(db.query("INSERT INTO public.user_topic_interests(user_id,topic_id,intent) VALUES($1,'java','interest')",[ids.owner]));
    await as('authenticated',ids.owner);
    await db.query("SELECT public.save_recommendation_preferences($1)",[JSON.stringify({...preferenceDoc,revision:1,discoverable:true})]);
    await as('authenticated',ids.student);
    const shared:any[]=(await db.query("SELECT * FROM public.discoverable_topic_interests WHERE user_id=$1",[ids.owner])).rows;
    assert.equal(shared.length,2);assert.deepEqual(Object.keys(shared[0]).sort(),['intent','topic_id','user_id']);
    await as('authenticated',ids.owner);
    await db.query("SELECT public.save_recommendation_preferences($1)",[JSON.stringify({...preferenceDoc,revision:2,discoverable:true,personalization_enabled:false})]);
    assert.deepEqual((await db.query<any>("SELECT public.get_recommendation_preferences() AS value")).rows[0].value.learn,['databases']);
    await db.query("INSERT INTO public.recommendation_dismissals(user_id,kind,item_id) VALUES($1,'note',$2)",[ids.owner,ids.teacher]);
    await as('authenticated',ids.student);
    assert.equal((await db.query("SELECT * FROM public.discoverable_topic_interests WHERE user_id=$1",[ids.owner])).rows.length,0);
    assert.equal((await db.query("SELECT * FROM public.recommendation_dismissals WHERE user_id=$1",[ids.owner])).rows.length,0);
    await db.query("DELETE FROM public.recommendation_dismissals WHERE user_id=$1",[ids.owner]);
    await assert.rejects(db.query("INSERT INTO public.recommendation_dismissals(user_id,kind,item_id) VALUES($1,'note',$2)",[ids.owner,ids.teacher]));
    await as('authenticated',ids.owner);
    assert.equal((await db.query("SELECT * FROM public.recommendation_dismissals")).rows.length,1);
    await db.query("DELETE FROM public.recommendation_dismissals WHERE user_id=$1",[ids.owner]);

    await as('authenticated',ids.owner);
    const saved:any=(await db.query("SELECT public.save_collaborative_project(NULL,$1) AS id",[JSON.stringify({title:'Private project',visibility:'private',positions:[{title:'Developer',slots:1}]})])).rows[0];
    const projectId=saved.id;
    await as('anon');
    assert.equal((await db.query("SELECT * FROM public.projects WHERE id=$1",[projectId])).rows.length,0);
    assert.equal((await db.query("SELECT * FROM public.project_positions WHERE project_id=$1",[projectId])).rows.length,0);
    assert.equal((await db.query("SELECT * FROM public.project_members WHERE project_id=$1",[projectId])).rows.length,0);
    await as('authenticated',ids.owner);
    await db.query("UPDATE public.projects SET visibility='public' WHERE id=$1",[projectId]);
    const position:any=(await db.query("SELECT id FROM public.project_positions WHERE project_id=$1",[projectId])).rows[0];
    await as('authenticated',ids.student);
    const application:any=(await db.query("SELECT public.apply_collaborative_project($1,$2,$3) AS application",[projectId,position.id,JSON.stringify({accepted_agreements:true})])).rows[0];
    await assert.rejects(db.query("UPDATE public.project_applications SET status='accepted' WHERE id=$1",[application.application.id]));
    await as('authenticated',ids.owner);
    await db.query("SELECT public.review_project_application($1,'accepted',NULL)",[application.application.id]);
    await assert.rejects(db.query("SELECT public.review_project_application($1,'accepted',NULL)",[application.application.id]));
    assert.equal((await db.query<any>("SELECT slots_filled FROM public.project_positions WHERE id=$1",[position.id])).rows[0].slots_filled,1);

    await as('authenticated',ids.owner);
    const learning:any=(await db.query("SELECT public.create_learning_path($1,$2) AS id",[JSON.stringify({subject_name:'Programming',title:'A learning path',goal:'Learn loops'}),JSON.stringify([{title:'Read'},{title:'Practice'}])])).rows[0];
    await db.query("UPDATE public.learning_path_stages SET completed=true WHERE path_id=$1",[learning.id]);
    const complete:any=(await db.query("SELECT progress_percent,status FROM public.learning_paths WHERE id=$1",[learning.id])).rows[0];
    assert.equal(complete.progress_percent,100);assert.equal(complete.status,'completed');
    await as('authenticated',ids.other);
    await assert.rejects(db.query("SELECT public.add_learning_stage($1,$2)",[learning.id,JSON.stringify({title:'Unauthorized'})]));
    await as('authenticated',ids.owner);
    await db.query("SELECT public.add_learning_stage($1,$2)",[learning.id,JSON.stringify({title:'New stage'})]);
    assert.equal((await db.query<any>("SELECT progress_percent FROM public.learning_paths WHERE id=$1",[learning.id])).rows[0].progress_percent,67);

    // Private files remain private even when their object names are known.
    await as('authenticated',ids.owner);
    const note:any=(await db.query("INSERT INTO public.academic_notes(author_id,title,visibility,file_url) VALUES($1,'Private note','private',$2) RETURNING id",[ids.owner,'storage://academic-notes/'+ids.owner+'/private.pdf'])).rows[0];
    await db.query("INSERT INTO storage.objects(bucket_id,name,owner) VALUES('academic-notes',$1,$2)",[ids.owner+'/private.pdf',ids.owner]);
    await as('authenticated',ids.student);
    assert.equal((await db.query("SELECT * FROM public.academic_notes WHERE id=$1",[note.id])).rows.length,0);
    assert.equal((await db.query("SELECT * FROM storage.objects WHERE name=$1",[ids.owner+'/private.pdf'])).rows.length,0);
    await assert.rejects(db.query("INSERT INTO public.academic_notes(author_id,title,file_url) VALUES($1,'Stolen file',$2)",[ids.student,'storage://academic-notes/'+ids.owner+'/private.pdf']));
    await as('authenticated',ids.owner);
    await db.query("UPDATE public.academic_notes SET visibility='public' WHERE id=$1",[note.id]);
    await as('anon');
    assert.equal((await db.query("SELECT * FROM storage.objects WHERE name=$1",[ids.owner+'/private.pdf'])).rows.length,1);
    await db.query("SELECT public.register_note_download($1)",[note.id]);
    await as('authenticated',ids.owner);
    await db.query("UPDATE public.academic_notes SET is_draft=true WHERE id=$1",[note.id]);
    await as('anon');
    assert.equal((await db.query("SELECT * FROM storage.objects WHERE name=$1",[ids.owner+'/private.pdf'])).rows.length,0);
    await assert.rejects(db.query("SELECT public.register_note_download($1)",[note.id]));

    await as('authenticated',ids.owner);
    await assert.rejects(db.query("SELECT public.save_collaborative_project(NULL,$1)",[JSON.stringify({title:'Rolled back project',positions:[{title:'Invalid slot',slots:-1}]})]));
    assert.equal((await db.query("SELECT * FROM public.projects WHERE title='Rolled back project'")).rows.length,0);
    const post:any=(await db.query("INSERT INTO public.forum_posts(author_id,title,description) VALUES($1,'Database question','How do transactions work?') RETURNING id",[ids.owner])).rows[0];
    await as('authenticated',ids.student);
    const vote:any=(await db.query("SELECT public.toggle_forum_vote($1) AS vote",[post.id])).rows[0];
    assert.equal(vote.vote.votesCount,1);assert.equal(vote.vote.hasVoted,true);
    const unvote:any=(await db.query("SELECT public.toggle_forum_vote($1) AS vote",[post.id])).rows[0];
    assert.equal(unvote.vote.votesCount,0);assert.equal(unvote.vote.hasVoted,false);

    // Assessment answer keys and scores are writable only by the backend role.
    await as('service_role');
    await db.query("INSERT INTO public.academic_validators(profile_id,role_title) VALUES($1,'Teacher')",[ids.teacher]);
    const subject:any=(await db.query("SELECT id FROM public.subjects ORDER BY name LIMIT 1")).rows[0];
    await as('authenticated',ids.owner);
    await db.query("INSERT INTO public.profile_offered_subjects(profile_id,subject_id,level) VALUES($1,$2,'basic')",[ids.owner,subject.id]);
    await assert.rejects(db.query("SELECT * FROM public.tutor_assessment_attempts"));
    await assert.rejects(db.query("SELECT public.grant_tutor_assessment($1,$2)",[ids.owner,ids.owner]));
    await as('service_role');
    const questions=Array.from({length:5},(_,index)=>({id:'q'+index,type:'choice',correctOptionId:'a'}));
    const attempt:any=(await db.query("INSERT INTO public.tutor_assessment_attempts(user_id,subject_id,questions,answers,state,score,expires_at) VALUES($1,$2,$3,$4,'passed',100,now()+interval '1 hour') RETURNING id",[ids.owner,subject.id,JSON.stringify(questions),JSON.stringify(questions.map(q=>({question_id:q.id,correct:true})))])).rows[0];
    const grant:any=(await db.query("SELECT public.grant_tutor_assessment($1,$2) AS grant",[attempt.id,ids.owner])).rows[0];
    assert.equal(grant.grant.success,true);assert.equal(grant.grant.level,'basic');
    assert.equal((await db.query<any>("SELECT is_verified FROM public.profile_offered_subjects WHERE profile_id=$1 AND subject_id=$2",[ids.owner,subject.id])).rows[0].is_verified,true);
    await db.query("SELECT public.grant_tutor_assessment($1,$2)",[attempt.id,ids.owner]);
    assert.equal((await db.query("SELECT * FROM public.tutor_verification_requests WHERE assessment_attempt_id=$1",[attempt.id])).rows.length,1);
    await as('authenticated',ids.owner);
    await db.query("UPDATE public.profile_offered_subjects SET level='advanced',is_verified=true WHERE profile_id=$1 AND subject_id=$2",[ids.owner,subject.id]);
    assert.equal((await db.query<any>("SELECT level FROM public.profile_offered_subjects WHERE profile_id=$1 AND subject_id=$2",[ids.owner,subject.id])).rows[0].level,'basic');

    // Real teacher requests persist and are tied to a registered validator.
    await as('authenticated',ids.student);
    await db.query("INSERT INTO public.profile_offered_subjects(profile_id,subject_id,level) VALUES($1,$2,'basic')",[ids.student,subject.id]);
    const endorsement:any=(await db.query("SELECT public.request_teacher_endorsement($1,'Teacher','teacher@university.example','Please review my work') AS request",[subject.id])).rows[0];
    assert.equal(endorsement.request.delivery,'in_app');
    await assert.rejects(db.query("UPDATE public.tutor_verification_requests SET status='approved' WHERE id=$1",[endorsement.request.id]));
    await as('authenticated',ids.teacher);
    await db.query("UPDATE public.tutor_verification_requests SET status='approved',reviewer_feedback='Reviewed successfully' WHERE id=$1",[endorsement.request.id]);
    await as('authenticated',ids.student);
    assert.equal((await db.query<any>("SELECT is_verified FROM public.profile_offered_subjects WHERE profile_id=$1 AND subject_id=$2",[ids.student,subject.id])).rows[0].is_verified,true);

    // A workshop's final seat is guarded inside the insert transaction.
    await as('authenticated',ids.owner);
    const workshop:any=(await db.query("INSERT INTO public.tutoring_workshops(tutor_id,subject_id,title,scheduled_at,max_students) VALUES($1,$2,'A test workshop',now()+interval '1 day',2) RETURNING id",[ids.owner,subject.id])).rows[0];
    for(const user of [ids.student,ids.other]){await as('authenticated',user);await db.query("INSERT INTO public.workshop_enrollments(workshop_id,student_id) VALUES($1,$2)",[workshop.id,user]);}
    await as('authenticated',ids.teacher);
    await assert.rejects(db.query("INSERT INTO public.workshop_enrollments(workshop_id,student_id) VALUES($1,$2)",[workshop.id,ids.teacher]));

    // Duration supplied by the browser cannot manufacture attendance.
    await as('authenticated',ids.other);
    const session:any=(await db.query("INSERT INTO public.tutoring_sessions(student_id,tutor_id,subject_id,scheduled_at,duration_minutes,modality) VALUES($1,$2,$3,now()+interval '2 day',60,'online') RETURNING id",[ids.other,ids.owner,subject.id])).rows[0];
    await as('authenticated',ids.owner);
    await db.query("UPDATE public.tutoring_sessions SET status='accepted' WHERE id=$1",[session.id]);
    await db.query("SELECT public.register_session_attendance($1,'join',999999)",[session.id]);
    await as('authenticated',ids.other);
    await db.query("SELECT public.register_session_attendance($1,'join',999999)",[session.id]);
    const attendance:any=(await db.query("SELECT public.register_session_attendance($1,'heartbeat',999999) AS attendance",[session.id])).rows[0];
    assert.equal(attendance.attendance.attendance_verified,false);
    assert.equal(attendance.attendance.actual_duration_minutes,0);
    await assert.rejects(db.query("UPDATE public.tutoring_sessions SET attendance_verified=true WHERE id=$1",[session.id]));
    await as('authenticated',ids.student);
    await assert.rejects(db.query("INSERT INTO public.tutoring_sessions(student_id,tutor_id,subject_id,scheduled_at,duration_minutes,modality) VALUES($1,$2,$3,now()+interval '2 day',60,'online')",[ids.student,ids.owner,subject.id]));
    await as('service_role');
    await db.exec('RESET ROLE');
    for (const file of ['016_privacy_and_transactional_persistence.sql','017_server_assessments_and_endorsements.sql','018_interests_and_recommendations.sql']) {
      await db.exec(await fs.readFile(path.join(migrations,file),'utf8'));
    }
    console.log('PostgreSQL: privacy, rollback, projects, learning, files, votes, accreditation, endorsements, capacity and attendance verified.');
  }finally{await db.close();}
});
