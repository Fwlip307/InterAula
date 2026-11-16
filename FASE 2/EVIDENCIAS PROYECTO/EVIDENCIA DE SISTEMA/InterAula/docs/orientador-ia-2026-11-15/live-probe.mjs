import {config} from '../../backend/node_modules/dotenv/lib/main.js';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {orientationChatService} from '../../backend/dist/services/orientationChat.service.js';
config({path:'backend/.env'});
const messages=['hola me hago tutor','No, quiero que alguien me explique Matemáticas','Explícame qué es una derivada con un ejemplo sencillo','¿y cómo puedo practicarlo en la app?'];
const rows=[];let history=[];
for(const message of messages){
 const start=Date.now();
 try{const reply=await orientationChatService.reply({message,history,context:{page:'/tutoring',tab:'my_classes'}});rows.push({input:message,...reply,ms:Date.now()-start});history=[...history,{role:'user',text:message},{role:'assistant',text:reply.message}].slice(-8);console.log(JSON.stringify(rows.at(-1)));}
 catch(error){rows.push({message,error:error.message});console.log(JSON.stringify(rows.at(-1)));break;}
}
fs.writeFileSync('docs/orientador-ia-2026-11-15/gemini-smoke.json',JSON.stringify(rows,null,2));

assert.equal(rows.length,4);
assert.ok(rows.every(row=>row.provider==='google_gemini'));
assert.ok(rows[0].suggested_guides.includes('become-tutor'));
assert.ok(rows[1].suggested_guides.includes('tutors'));
assert.equal(rows[2].topic,'study');
assert.ok(rows[3].suggested_guides.includes('practice'));
