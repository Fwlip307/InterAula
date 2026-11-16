// Execute via stdin inside the backend container; synthetic examples only, no DB reads/writes.
import assert from 'node:assert/strict';
import {interestDemoService} from './dist/services/interestDemo.service.js';
const checks=[];
for(const focus of ['data','web','business'])for(const scope of ['all','campus','nearby']){
 const data=await interestDemoService.run({focus,scope});
 assert.equal(data.matching.status,'ready');assert.ok(data.items.length);assert.equal(data.dataset,'synthetic_demo');
 if(scope==='campus')assert.ok(data.items.every(item=>item.communityReason==='Misma institución y sede'));
 if(scope==='nearby')assert.ok(data.items.every(item=>['Misma institución y sede','Sede en la misma comuna'].includes(item.communityReason)));
 checks.push({focus,scope,clusters:data.matching.clusterCount,count:data.items.length});
}
console.log(JSON.stringify({passed:true,checks,scope:'Docker backend to Docker Python over internal network. Synthetic public topic vectors and synthetic preferences. No Supabase or Gemini requests.'},null,2));
