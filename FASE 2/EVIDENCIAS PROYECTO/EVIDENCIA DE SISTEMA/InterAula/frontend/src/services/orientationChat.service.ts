import {apiClient} from '../lib/apiClient';
import {ORIENTATION_FLOWS,type OrientationGoal} from '../content/orientationFlows';
export type OrientationMessage={role:'user'|'assistant';text:string};
export type OrientationChatRequest={message:string;history:OrientationMessage[];context:{page:string;tab?:string;guide?:OrientationGoal;stage?:'selected'|'paused'|'completed'}};
export type OrientationChatReply={message:string;topic:'app'|'study'|'out_of_scope';suggested_guides:OrientationGoal[];provider:'google_gemini';model:string};
export function orientationNavigation(pathname:string,search:string):OrientationChatRequest['context']{
 const pages=['/dashboard','/learning-space','/tutoring','/resources','/projects','/forum','/profile','/settings','/guide'];
 const tab=new URLSearchParams(search).get('tab');
 return {page:pages.includes(pathname)?pathname:'other',...(tab&&/^[a-z_]{1,30}$/.test(tab)?{tab}:{})};
}
export const orientationChatService={async reply(input:OrientationChatRequest,signal?:AbortSignal):Promise<OrientationChatReply>{
 const result=await apiClient.post<OrientationChatReply>('/ai/orientation-chat',input,{signal});
 if(result.provider!=='google_gemini'||typeof result.message!=='string'||!Array.isArray(result.suggested_guides))throw Error('Respuesta no válida del orientador.');
 return {...result,suggested_guides:result.suggested_guides.filter(id=>Object.hasOwn(ORIENTATION_FLOWS,id)).slice(0,3)};
}};
