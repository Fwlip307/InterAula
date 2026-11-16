import {useEffect,useRef,useState,type FormEvent} from 'react';
import type {TutoringSession} from '../../../types/tutoring';
import {tutoringService} from '../../../services/tutoring.service';
import {getUserDisplayName} from '../../../utils/formatters';
import {XIcon,StarIcon} from '../../../components/common/Icons';
import '../../../styles/tutoringReview.css';

interface Props {session:TutoringSession|null;isOpen:boolean;onClose:()=>void;onSuccess:()=>void}
export default function ReviewModal({session,isOpen,onClose,onSuccess}:Props){
 const dialog=useRef<HTMLDialogElement>(null);
 const [scores,setScores]=useState<Record<string,number|''>>({communication_score:'',knowledge_score:'',punctuality_score:''});
 const [comment,setComment]=useState(''),[submitting,setSubmitting]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  if(!isOpen||!session)return;
  setScores({communication_score:'',knowledge_score:'',punctuality_score:''});setComment('');setError('');
  const element=dialog.current;
  if(element&&!element.open)element.showModal();
  return()=>element?.close();
 },[isOpen,session?.id]);
 if(!isOpen||!session)return null;
 const selected=Object.values(scores).every(value=>value!=='');
 const average=selected?((Number(scores.communication_score)+Number(scores.knowledge_score)+Number(scores.punctuality_score))/3).toFixed(2):null;
 const submit=async(event:FormEvent)=>{
  event.preventDefault();if(submitting||!selected)return;
  setSubmitting(true);setError('');
  try{
   await tutoringService.submitReview({session_id:session.id,tutor_id:session.tutor_id,communication_score:Number(scores.communication_score),knowledge_score:Number(scores.knowledge_score),punctuality_score:Number(scores.punctuality_score),comment});
   onSuccess();onClose();
  }catch(cause){setError(cause instanceof Error?cause.message:'No pudimos guardar tu valoración. Reintenta.');}
  finally{setSubmitting(false);}
 };
 const criteria=[
  {key:'communication_score',label:'Comunicación',help:'¿La explicación fue clara y comprensible?'},
  {key:'knowledge_score',label:'Dominio del tema',help:'¿El tutor demostró conocer la materia?'},
  {key:'punctuality_score',label:'Puntualidad',help:'¿Respetó el horario y los acuerdos de la sesión?'},
 ];
 return <dialog ref={dialog} className="ia-review-dialog" aria-labelledby="review-title" aria-describedby="review-description" onCancel={event=>{event.preventDefault();if(!submitting)onClose();}}>
  <header><div><span className="ia-review-eyebrow">Tu experiencia cuenta</span><h2 id="review-title"><StarIcon size={20}/>Valorar tutoría</h2></div><button type="button" className="ia-btn-secondary" onClick={onClose} disabled={submitting} aria-label="Cerrar valoración"><XIcon size={19}/></button></header>
  <p id="review-description">Evalúa tu sesión con {getUserDisplayName(session.tutor)}. Elige de 1 (muy deficiente) a 10 (excelente) en cada criterio.</p>
  <form onSubmit={submit}>
   <fieldset disabled={submitting}><legend>Elige tus tres calificaciones</legend>{criteria.map(item=><div key={item.key} className="ia-review-criterion"><div><label htmlFor={'review-'+item.key}>{item.label}</label><p id={'review-help-'+item.key}>{item.help}</p></div><select id={'review-'+item.key} required value={scores[item.key]} aria-describedby={'review-help-'+item.key} onChange={event=>setScores(value=>({...value,[item.key]:event.target.value===''?'':Number(event.target.value)}))}><option value="">Elegir</option>{Array.from({length:10},(_,i)=><option key={i+1} value={i+1}>{i+1} / 10</option>)}</select></div>)}
   <label htmlFor="review-comment">Comentario opcional</label><textarea id="review-comment" className="ia-input" rows={2} maxLength={1000} value={comment} onChange={event=>setComment(event.target.value)} placeholder="¿Qué te ayudó y qué podría mejorar?"/>
   </fieldset>
   <p className="ia-review-average" role="status">{average?'Promedio de tu valoración: '+average+' / 10':'Cada criterio se guarda por separado. El sistema calcula el promedio.'}</p>
   {error&&<p role="alert" className="ia-review-error">{error}</p>}
   <footer><button type="button" className="ia-btn-secondary" onClick={onClose} disabled={submitting}>Cancelar</button><button type="submit" className="ia-btn-primary" disabled={submitting||!selected}>{submitting?'Guardando…':'Guardar valoración'}</button></footer>
  </form>
 </dialog>;
}
