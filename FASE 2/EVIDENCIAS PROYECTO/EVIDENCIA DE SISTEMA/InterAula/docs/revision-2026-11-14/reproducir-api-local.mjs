import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const root=process.argv[2],imp=p=>import(pathToFileURL(path.join(root,p)).href);
await imp('backend/dist/tests/setup.js');
globalThis.fetch=async()=>{throw Error('External access disabled in review');};
const require=createRequire(path.join(root,'backend/package.json')),request=require('supertest');
const {app}=await imp('backend/dist/app.js');
const {supabasePublic}=await imp('backend/dist/lib/supabase.js');
const {learningSpaceService}=await imp('backend/dist/services/learningSpace.service.js');
const user='00000000-0000-0000-0000-000000000101';
supabasePublic.auth.getUser=async()=>({data:{user:{id:user,email:'review@example.org',user_metadata:{},app_metadata:{}}},error:null});
const auth=r=>r.set('Authorization','Bearer isolated-review');
const out=[];
for(const [name,url,payload,method]of [
 ['create_workshop','/api/workshops',{subject_id:'00000000-0000-4000-8000-000000000001',title:'Taller de revision',scheduled_at:new Date(Date.now()+86400000).toISOString(),duration_minutes:60,participation_mode:'mixed',participation_rules:null,anticipated_materials:[]},'post'],
 ['create_deliverable','/api/projects/00000000-0000-4000-8000-000000000001/deliverables',{title:'Primer avance',assignee_name:null,due_date:null,expected_format:'Documento'},'post'],
 ['save_prep','/api/tutoring/sessions/00000000-0000-4000-8000-000000000001/prep',{participation_mode:'mixed',participation_rules:null,anticipated_materials:[]},'patch']
]){const res=await auth(request(app)[method](url)).send(payload);out.push({name,status:res.status});}
await learningSpaceService.createQuickIdea(user,'isolated',{context_type:'tutoring',context_id:'room-A',content:'Idea de la sala A'});
await learningSpaceService.createQuickIdea(user,'isolated',{context_type:'tutoring',context_id:'room-B',content:'Idea de la sala B'});
const ideas=await auth(request(app).get('/api/learning-space/ideas?context_type=tutoring&context_id=room-B'));
out.push({name:'filter_ideas_by_room_B',status:ideas.status,contexts:ideas.body.data.map(i=>i.context_id)});
const id=ideas.body.data[0].id;
const converted=await auth(request(app).post('/api/learning-space/ideas/'+id+'/convert-to-task')).send({subject_name:'SQL'});
const second=await auth(request(app).post('/api/learning-space/ideas/'+id+'/convert-to-task')).send({subject_name:'SQL'});
out.push({name:'convert_idea_twice',firstStatus:converted.status,secondStatus:second.status,subject:converted.body.data?.task?.subject_name,differentTasks:converted.body.data?.task?.id!==second.body.data?.task?.id});
console.log('REVIEW_RESULT='+JSON.stringify(out));

