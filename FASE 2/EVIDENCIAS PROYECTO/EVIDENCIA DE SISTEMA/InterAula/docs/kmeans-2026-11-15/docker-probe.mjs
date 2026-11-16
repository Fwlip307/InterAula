// Run inside the backend container. Read-only aggregate metadata; no profile or secret output.
import assert from 'node:assert/strict';
import {tutorRecommendationsService} from './dist/services/tutorRecommendations.service.js';
const community=await tutorRecommendationsService.list('00000000-0000-4000-8000-000000000000',{priority:'balanced'});
const examples=[];
for(const priority of ['communication','knowledge','punctuality']){
 const demo=await tutorRecommendationsService.demo(priority);
 assert.equal(demo.model.method,'kmeans');assert.equal(demo.model.dataset,'synthetic_demo');
 examples.push({priority,first:demo.profiles[0].displayName,model:demo.model});
}
console.log(JSON.stringify({passed:true,community:community.model,catalogCount:community.tutors.length,examples,
 scope:'Docker backend to Docker Python/scikit-learn; existing Supabase public catalog and aggregate statistics read only. Synthetic DEMO does not access or write Supabase.'},null,2));
