import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {useLocation,useNavigate} from 'react-router-dom';
import {ORIENTATION_FLOWS,ORIENTATION_CHOICES,isOrientationLocation,type OrientationGoal} from '../content/orientationFlows';
import {orientationChatService,orientationNavigation,type OrientationMessage,type OrientationChatRequest} from '../services/orientationChat.service';
import {stopSpeech} from '../utils/speechReader';

type Message=OrientationMessage;
const WELCOME='Hola. Puedo conversar sobre tus estudios y ayudarte a usar InterAula. ¿Qué necesitas hoy?';
const initial=()=>({busy:false,error:'',provider:'',open:false,goal:null as OrientationGoal|null,index:0,running:false,started:false,done:false,reply:WELCOME,messages:[] as Message[],choices:ORIENTATION_CHOICES.map(item=>item.id)});
type State=ReturnType<typeof initial>;
type Context={state:State;blocked:boolean;open:()=>void;close:()=>void;choose:(goal:OrientationGoal)=>void;ask:(text:string)=>Promise<void>;retry:()=>Promise<void>;start:()=>void;pause:()=>void;next:()=>void;back:()=>void;clear:()=>void};
const OrientationContext=createContext<Context|null>(null);
export function OrientationProvider({children}:{children:ReactNode}){
 const [state,setState]=useState(initial),[blocked,setBlocked]=useState(false);
 const location=useLocation(),navigate=useNavigate(),wasBlocked=useRef(false);
 const pending=useRef<AbortController|null>(null),generation=useRef(0),lastRequest=useRef<OrientationChatRequest|null>(null);
 const cancel=useCallback(()=>{generation.current++;pending.current?.abort();pending.current=null;},[]);
 useEffect(()=>()=>cancel(),[cancel]);
 const current=location.pathname+location.search;
 const go=useCallback((goal:OrientationGoal,index:number)=>{
  const step=ORIENTATION_FLOWS[goal].steps[index];
  if(!isOrientationLocation(current,step.href))navigate(step.href);
 },[current,navigate]);
 useEffect(()=>()=>stopSpeech(),[]);
 useEffect(()=>{
  const check=()=>{
   const modal=[...document.querySelectorAll('.ia-assessment-overlay,dialog[open],[aria-modal="true"]')].some(element=>element.getClientRects().length>0);
   const active=Boolean(document.fullscreenElement||modal);
   if(active===wasBlocked.current)return;
   wasBlocked.current=active;setBlocked(active);
   if(active){cancel();stopSpeech();setState(value=>({...value,open:false,running:false,busy:false}));}
  };
  check();const observer=new MutationObserver(check);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open','aria-modal','hidden']});
  document.addEventListener('fullscreenchange',check);
  return()=>{observer.disconnect();document.removeEventListener('fullscreenchange',check);};
 },[cancel]);
 useEffect(()=>{
  const params=new URLSearchParams(location.search);
  if(params.get('orientador')!=='1')return;
  params.delete('orientador');
  if(!blocked)setState(value=>({...value,open:true}));
  navigate({pathname:location.pathname,search:params.toString(),hash:location.hash},{replace:true});
 },[location.key,location.pathname,location.search,location.hash,blocked,navigate]);
 const open=()=>{if(!blocked)setState(value=>({...value,open:true}));};
 const close=()=>{cancel();stopSpeech();setState(value=>({...value,open:false,running:false,busy:false}));};
 const choose=(goal:OrientationGoal)=>{
  cancel();stopSpeech();setState(value=>({...value,busy:false,error:'',provider:'',goal,index:0,running:false,started:false,done:false,choices:[],reply:ORIENTATION_FLOWS[goal].introduction}));
 };
 const send=async(input:OrientationChatRequest)=>{
  if(pending.current||wasBlocked.current)return;
  const controller=new AbortController(),token=++generation.current;
  pending.current=controller;lastRequest.current=input;
  stopSpeech();
  setState(value=>({...value,busy:true,error:'',goal:null,index:0,running:false,started:false,done:false,reply:'',choices:[],provider:''}));
  try{
   const result=await orientationChatService.reply(input,controller.signal);
   if(token!==generation.current)return;
   lastRequest.current=null;
   setState(value=>({...value,busy:false,reply:result.message,provider:result.provider,choices:result.suggested_guides,messages:[...value.messages,{role:'assistant',text:result.message}].slice(-10) as Message[]}));
  }catch{
   if(token!==generation.current)return;
   setState(value=>({...value,busy:false,error:'No pude obtener una respuesta de la IA. Puedes reintentar o elegir un recorrido manual.',choices:ORIENTATION_CHOICES.map(item=>item.id)}));
  }finally{if(token===generation.current)pending.current=null;}
 };
 const ask=async(raw:string)=>{
  const text=raw.trim().slice(0,1600);if(!text||pending.current||wasBlocked.current)return;
  const input:OrientationChatRequest={message:text,history:state.messages.slice(-8),context:{...orientationNavigation(location.pathname,location.search),...(state.goal?{guide:state.goal,stage:state.done?'completed' as const:state.started?'paused' as const:'selected' as const}:{})}};
  setState(value=>({...value,messages:[...value.messages,{role:'user',text}].slice(-10) as Message[]}));
  await send(input);
 };
 const retry=async()=>{if(lastRequest.current)await send(lastRequest.current);};
 const start=()=>{
  if(!state.goal||blocked)return;
  stopSpeech();setState(value=>({...value,open:true,running:true,started:true,done:false}));go(state.goal,state.index);
 };
 const pause=()=>{stopSpeech();setState(value=>({...value,running:false}));};
 const next=()=>{
  if(!state.goal)return;
  stopSpeech();
  if(state.index+1>=ORIENTATION_FLOWS[state.goal].steps.length){setState(value=>({...value,running:false,done:true,reply:ORIENTATION_FLOWS[state.goal!].outcome}));return;}
  const index=state.index+1;setState(value=>({...value,index,running:true}));go(state.goal,index);
 };
 const back=()=>{
  if(!state.goal)return;
  const index=Math.max(0,state.index-1);stopSpeech();setState(value=>({...value,index,running:true,done:false}));go(state.goal,index);
 };
 const clear=()=>{cancel();lastRequest.current=null;stopSpeech();setState({...initial(),open:true});};
 return <OrientationContext.Provider value={{state,blocked,open,close,choose,ask,retry,start,pause,next,back,clear}}>{children}</OrientationContext.Provider>;
}
export function useOrientation(){const value=useContext(OrientationContext);if(!value)throw Error('OrientationProvider is required');return value;}
