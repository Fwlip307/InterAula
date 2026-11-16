import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createTestPostgres} from './helpers/postgres.js';
import {inclusiveAccreditationRequestSchema,reviewInclusiveAccreditationSchema} from '../schemas/verification.schema.js';
import request from 'supertest';
import {app} from '../app.js';
import {supabasePublic} from '../lib/supabase.js';

const checks={identity_matches:true,issuer_verified:true,training_relevant:true,practical_passed:true};
const document={training_name:'Formación inclusiva',issuer_name:'Institución de prueba',completed_on:'2026-01-01',credential_code:'FOLIO-123',verification_url:'https://issuer.example/verify/123',evidence_notes:'Propondría instrucciones breves, una agenda anticipada, opciones para participar por chat y pausas, preguntando qué apoyos prefiere sin imponer diagnósticos.',document_path:'00000000-0000-0000-0000-000000000741/proof.pdf',document_filename:'certificado.pdf',document_size_bytes:1024};
test('La solicitud exige certificado, emisor y caso; la revisión exige justificación y las cuatro comprobaciones',()=>{
 assert.equal(inclusiveAccreditationRequestSchema.safeParse(document).success,true);
 for(const key of ['issuer_name','completed_on','credential_code','verification_url','document_path','document_filename','document_size_bytes']) {
  const copy:any={...document};delete copy[key];assert.equal(inclusiveAccreditationRequestSchema.safeParse(copy).success,false);
 }
 assert.equal(inclusiveAccreditationRequestSchema.safeParse({...document,completed_on:'2026-02-30'}).success,false);
 assert.equal(inclusiveAccreditationRequestSchema.safeParse({...document,verification_url:'javascript:alert(1)'}).success,false);
 assert.equal(inclusiveAccreditationRequestSchema.safeParse({...document,status:'approved'}).success,false);
 assert.equal(reviewInclusiveAccreditationSchema.safeParse({status:'approved',reviewer_notes:'Verifiqué certificado, emisor, titularidad y la propuesta del caso.',verification_checks:checks,expected_updated_at:new Date().toISOString()}).success,true);
 assert.equal(reviewInclusiveAccreditationSchema.safeParse({status:'approved',reviewer_notes:'Verifiqué certificado, emisor, titularidad y la propuesta del caso.',verification_checks:checks,expected_updated_at:'2026-11-14T12:34:56.123456+00:00'}).success,true);
 assert.equal(reviewInclusiveAccreditationSchema.safeParse({status:'approved'}).success,false);
});

test('HTTP: verifica PDF real y titularidad, rechaza autoaprobación y evidencia desactualizada',async(t)=>{
 let actor='00000000-0000-0000-0000-000000000741',isValidator=false,validPdf=true,stale=false;
 const id='00000000-0000-0000-0000-000000000744',pdf=new Blob(['%PDF-1.4\nDocumento sintético']);
 const auth=(call:request.Test)=>call.set('Authorization','Bearer fixture');
 t.mock.method(supabasePublic.auth,'getUser',async()=>({data:{user:{id:actor,user_metadata:{},app_metadata:{}}},error:null}));
 t.mock.method(Object.getPrototypeOf(supabasePublic.storage.from('inclusive-evidence')),'download',async()=>({data:validPdf?pdf:new Blob(['NOT A PDF']),error:null}));
 t.mock.method(Object.getPrototypeOf(supabasePublic),'from',(table:string)=>{
  let action='select',payload:any;const builder:any={select:()=>builder,eq:()=>builder,limit:()=>builder,maybeSingle:()=>builder,single:()=>builder,
   upsert:(body:any)=>{action='upsert';payload=body;return builder;},update:(body:any)=>{action='update';payload=body;return builder;},
   then:(resolve:any)=>Promise.resolve({data:table==='academic_validators'?(isValidator?[{profile_id:actor}]:[]):action==='select'?{tutor_id:'00000000-0000-0000-0000-000000000741'}:action==='update'&&stale?null:{id,...payload},error:null}).then(resolve)};
  return builder;
 });
 const body={...document,document_size_bytes:pdf.size};
 assert.equal((await auth(request(app).post('/api/verification/inclusive-accreditation')).send({...body,document_path:'other/proof.pdf'})).status,400);
 validPdf=false;
 assert.equal((await auth(request(app).post('/api/verification/inclusive-accreditation')).send(body)).status,400);
 validPdf=true;
 const submitted=await auth(request(app).post('/api/verification/inclusive-accreditation')).send(body);
 assert.equal(submitted.status,201);assert.equal(submitted.body.data.status,'pending');assert.equal(submitted.body.data.proof_version,2);
 const review={status:'approved',reviewer_notes:'Verifiqué independientemente todos los documentos y el caso.',verification_checks:checks,expected_updated_at:new Date().toISOString()};
 assert.equal((await auth(request(app).patch('/api/verification/inclusive-accreditation/'+id+'/review')).send(review)).status,403);
 isValidator=true;
 assert.equal((await auth(request(app).patch('/api/verification/inclusive-accreditation/'+id+'/review')).send(review)).status,403);
 actor='00000000-0000-0000-0000-000000000742';stale=true;
 assert.equal((await auth(request(app).patch('/api/verification/inclusive-accreditation/'+id+'/review')).send(review)).status,409);
 stale=false;
 assert.equal((await auth(request(app).patch('/api/verification/inclusive-accreditation/'+id+'/review')).send({...review,verification_checks:{...checks,issuer_verified:false}})).status,400);
 assert.equal((await auth(request(app).patch('/api/verification/inclusive-accreditation/'+id+'/review')).send(review)).status,200);
});

test('PostgreSQL: respaldo privado, no autoaprobación, rúbrica, historial inmutable, revocación y activación repetible',async()=>{
 const db=await createTestPostgres(),dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../supabase/migrations');
 const ids={owner:'00000000-0000-0000-0000-000000000741',teacher:'00000000-0000-0000-0000-000000000742',stranger:'00000000-0000-0000-0000-000000000743'};
 const as=async(id:string)=>{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)",[id]);await db.exec('SET ROLE authenticated');};
 try {
  for(const file of (await fs.readdir(dir)).filter(f=>f.endsWith('.sql')&&Number(f.slice(0,3))<=23).sort())await db.exec(await fs.readFile(path.join(dir,file),'utf8'));
  await db.exec('GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated');
  for(const [name,id] of Object.entries(ids))await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[id,name+'@fixture.example',JSON.stringify({first_name:name})]);
  await db.query("INSERT INTO public.academic_validators(profile_id,role_title) VALUES($1,'Docente autorizado')",[ids.teacher]);
  await as(ids.owner);
  await assert.rejects(db.query("INSERT INTO public.inclusive_tutor_accreditations(tutor_id,training_name,evidence_notes) VALUES($1,'Solo texto','Sin documento')",[ids.owner]));
  await db.query("INSERT INTO storage.objects(bucket_id,name,owner) VALUES('inclusive-evidence',$1,$2)",[document.document_path,ids.owner]);
  const columns=Object.keys(document),values=Object.values(document);
  const created:any=(await db.query('INSERT INTO public.inclusive_tutor_accreditations(tutor_id,proof_version,'+columns.join(',')+') VALUES($1,2,'+columns.map((_,i)=>'$'+(i+2)).join(',')+') RETURNING id',[ids.owner,...values])).rows[0];
  await assert.rejects(db.query("UPDATE public.inclusive_tutor_accreditations SET status='approved' WHERE id=$1",[created.id]));
  await db.query("DELETE FROM storage.objects WHERE bucket_id='inclusive-evidence' AND name=$1",[document.document_path]);
  assert.equal((await db.query<any>("SELECT count(*)::int AS n FROM storage.objects WHERE bucket_id='inclusive-evidence'")).rows[0].n,1);
  await as(ids.stranger);
  assert.equal((await db.query('SELECT * FROM public.inclusive_tutor_accreditations')).rows.length,0);
  assert.equal((await db.query("SELECT * FROM storage.objects WHERE bucket_id='inclusive-evidence'")).rows.length,0);
  await db.query("UPDATE public.inclusive_tutor_accreditations SET status='approved' WHERE id=$1",[created.id]);
  await as(ids.teacher);
  await assert.rejects(db.query("UPDATE public.inclusive_tutor_accreditations SET status='approved' WHERE id=$1",[created.id]));
  await assert.rejects(db.query("UPDATE public.inclusive_tutor_accreditations SET status='approved',reviewer_notes='Revisión independiente de todas las evidencias requeridas.',verification_checks='{}' WHERE id=$1",[created.id]));
  await assert.rejects(db.query("UPDATE public.inclusive_tutor_accreditations SET issuer_name='Otro emisor',status='approved',reviewer_notes='Revisión independiente de todas las evidencias requeridas.',verification_checks=$2 WHERE id=$1",[created.id,JSON.stringify(checks)]));
  await db.query("UPDATE public.inclusive_tutor_accreditations SET status='approved',reviewer_notes='Verifiqué titularidad, autenticidad con el emisor, pertinencia y resolución del caso.',verification_checks=$2 WHERE id=$1",[created.id,JSON.stringify(checks)]);
  const approved:any=(await db.query('SELECT * FROM public.inclusive_tutor_accreditations WHERE id=$1',[created.id])).rows[0];
  assert.equal(approved.verified_by,ids.teacher);assert.equal(approved.review_history.length,1);
  await as(ids.stranger);
  assert.equal((await db.query('SELECT * FROM public.inclusive_tutor_accreditations')).rows.length,0);
  const publicBadge:any=(await db.query('SELECT * FROM public.inclusive_tutor_public_credentials')).rows[0];
  assert.equal(publicBadge.tutor_id,ids.owner);
  for(const field of ['document_path','credential_code','evidence_notes','review_history','verification_url'])assert.equal(field in publicBadge,false);
  await as(ids.owner);
  assert.equal((await db.query("UPDATE public.inclusive_tutor_accreditations SET review_history='[]' WHERE id=$1 RETURNING id",[created.id])).rows.length,0);
  await as(ids.teacher);
  await db.query("UPDATE public.inclusive_tutor_accreditations SET status='revoked',review_history='[]',reviewer_notes='Se revoca tras confirmar una discrepancia con la entidad emisora.' WHERE id=$1",[created.id]);
  assert.equal((await db.query<any>('SELECT jsonb_array_length(review_history) AS n FROM public.inclusive_tutor_accreditations WHERE id=$1',[created.id])).rows[0].n,2);
  assert.equal((await db.query('SELECT * FROM public.inclusive_tutor_public_credentials')).rows.length,0);
  await db.exec('RESET ROLE');
  await db.exec(await fs.readFile(path.join(dir,'../ACTIVAR_ACREDITACION_INCLUSIVA.sql'),'utf8'));
  await db.exec(await fs.readFile(path.join(dir,'../ACTIVAR_ACREDITACION_INCLUSIVA.sql'),'utf8'));
  assert.equal((await db.query<any>('SELECT count(*)::int AS n FROM public.inclusive_tutor_accreditations WHERE id=$1',[created.id])).rows[0].n,1);
 }finally{await db.close();}
});
