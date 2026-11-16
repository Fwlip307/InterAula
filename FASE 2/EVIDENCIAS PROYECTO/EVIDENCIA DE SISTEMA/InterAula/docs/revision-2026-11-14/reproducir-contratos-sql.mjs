process.on('unhandledRejection',e=>{console.error(JSON.stringify({error:e.message,code:e.code}));process.exitCode=1;});
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.argv[2];
const imp=p=>import(pathToFileURL(path.join(root,p)).href);
const {createTestPostgres}=await imp('backend/dist/tests/helpers/postgres.js');
const {updateSessionPrepSchema}=await imp('backend/dist/schemas/tutoring.schema.js');
const {createDeliverableSchema,updateDeliverableSchema}=await imp('backend/dist/schemas/project.schema.js');
const {createWorkshopSchema}=await imp('backend/dist/schemas/workshop.schema.js');
const results=[];
function check(name,schema,payload){const p=schema.safeParse(payload);results.push({name,accepted:p.success,issues:p.success?[]:p.error.issues.map(i=>({path:i.path.join('.'),code:i.code}))});}
check('default_workshop_form_inclusive_fields',createWorkshopSchema,{subject_id:'00000000-0000-4000-8000-000000000001',title:'Taller de revision',scheduled_at:new Date(Date.now()+86400000).toISOString(),duration_minutes:60,participation_mode:'mixed',participation_rules:null,anticipated_materials:[]});
check('prep_editor_valid_populated_inputs',updateSessionPrepSchema,{camera_policy:'optional',participation_mode:'voice_or_chat',participation_rules:'Se permite preguntar',anticipated_materials:['https://example.org/material.pdf']});
check('deliverable_form_without_optional_values',createDeliverableSchema,{title:'Primer avance',assignee_name:null,due_date:null,expected_format:'Documento o enlace'});
check('deliverable_date_only',createDeliverableSchema,{title:'Primer avance',due_date:'2026-11-20'});
check('deliverable_submitted_status',updateDeliverableSchema,{status:'submitted'});
const db=await createTestPostgres();
try {
 const dir=path.join(root,'supabase/migrations');
 for(const file of (await fs.readdir(dir)).filter(f=>/^\d+.*\.sql$/.test(f)&&Number(f.slice(0,3))<=19).sort()) {
  try{await db.exec(await fs.readFile(path.join(dir,file),'utf8'));}
  catch(e){throw new Error('Migration '+file+': '+e.message);}
 }
 results.push({name:'all_migrations_001_019',applied:true});
 const ids={owner:'00000000-0000-0000-0000-000000000101',student:'00000000-0000-0000-0000-000000000102',teacher:'00000000-0000-0000-0000-000000000104'};
 for(const [name,id]of Object.entries(ids))await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)",[id,name+'@review.example',JSON.stringify({first_name:name,last_name:'Review'})]);
 const as=async(id)=>{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)",[id]);await db.exec('SET ROLE authenticated');};
 const subject=(await db.query("SELECT id FROM public.subjects ORDER BY name LIMIT 1")).rows[0].id;
 await db.query("INSERT INTO public.academic_validators(profile_id,role_title) VALUES($1,'Teacher')",[ids.teacher]);
 await as(ids.owner);
 await db.query("INSERT INTO public.profile_offered_subjects(profile_id,subject_id,level) VALUES($1,$2,'basic')",[ids.owner,subject]);
 await as(ids.student);
 const session=(await db.query("INSERT INTO public.tutoring_sessions(student_id,tutor_id,subject_id,scheduled_at,duration_minutes,modality) VALUES($1,$2,$3,now()+interval '2 day',60,'online') RETURNING id,room_id",[ids.student,ids.owner,subject])).rows[0];
 const access=(await db.query("SELECT public.can_access_classroom_room($1) AS by_session,public.can_access_classroom_room($2) AS by_real_room",[session.id,session.room_id])).rows[0];
 results.push({name:'student_signal_access_for_real_session_room',...access});
 await as(ids.owner);
 await db.exec('RESET ROLE');
 const workshop=(await db.query("INSERT INTO public.tutoring_workshops(tutor_id,subject_id,title,scheduled_at,max_students,agenda_preview) VALUES($1,$2,'Review workshop',now()+interval '1 day',20,$3) RETURNING id",[ids.owner,subject,JSON.stringify({what_we_will_see:'SQL',step_by_step:'Pasos',how_it_ends:'Resumen'})])).rows[0];
 const summary=(await db.query("SELECT * FROM public.workshop_summary WHERE id=$1",[workshop.id])).rows[0];
 results.push({name:'workshop_summary_includes_new_prep_columns',agenda_preview:Object.hasOwn(summary,'agenda_preview'),participation_mode:Object.hasOwn(summary,'participation_mode'),anticipated_materials:Object.hasOwn(summary,'anticipated_materials')});
 await as(ids.owner);
 await db.query("INSERT INTO public.inclusive_tutor_accreditations(tutor_id,status,training_name,evidence_notes) VALUES($1,'pending','Taller inclusivo','Evidencia de prueba')",[ids.owner]);
 try {await db.query("INSERT INTO public.inclusive_tutor_accreditations(tutor_id,status,training_name,evidence_notes) VALUES($1,'pending','Taller actualizado','Evidencia actualizada') ON CONFLICT(tutor_id) DO UPDATE SET training_name=excluded.training_name,evidence_notes=excluded.evidence_notes,status='pending'",[ids.owner]);results.push({name:'resubmit_existing_accreditation',accepted:true});}
 catch(e){results.push({name:'resubmit_existing_accreditation',accepted:false,code:e.code});}
 await as(ids.teacher);
 const own=(await db.query("INSERT INTO public.inclusive_tutor_accreditations(tutor_id,status,training_name,evidence_notes) VALUES($1,'pending','Taller del validador','Evidencia de prueba') RETURNING id",[ids.teacher])).rows[0];
 const self=(await db.query("UPDATE public.inclusive_tutor_accreditations SET status='approved',verified_by=$1,verified_at=now() WHERE id=$2 RETURNING status",[ids.teacher,own.id])).rows[0];
 results.push({name:'validator_self_approval',allowed:self?.status==='approved'});
 const publicInfo=(await db.query("SELECT public.update_learning_config($1) AS config",[JSON.stringify({supportPassport:{selectedSupports:['written_instructions'],customNotes:'Privado',sharedWithTutorIds:[ids.owner],sharedWithProjectIds:[],sharedItemKeys:['written_instructions']}})])).rows[0];
 await as(ids.owner);
 const visible=(await db.query("SELECT learning_space_config FROM public.profiles WHERE id=$1",[ids.teacher])).rows;
 results.push({name:'authorized_tutor_can_read_shared_passport',rows:visible.length});
} finally {await db.close();}
console.log(JSON.stringify(results,null,2));

