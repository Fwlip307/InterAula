import {useEffect,useMemo,useRef,useState} from 'react';
import {SearchIcon,XIcon} from '../../../components/common/Icons';

interface SubjectChoice {id:string;name:string;label:string;verified:boolean}
interface Props {choices:SubjectChoice[];value:string;onChange:(id:string)=>void;disabled:boolean}
const normalize=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();

export default function AssessmentSubjectPicker({choices,value,onChange,disabled}:Props) {
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[active,setActive]=useState(-1);
 const input=useRef<HTMLInputElement>(null),list=useRef<HTMLDivElement>(null);
 const selected=choices.find(choice=>choice.id===value);
 const matches=useMemo(()=>choices.filter(choice=>normalize(choice.label).includes(normalize(query))),[choices,query]);
 const visible=matches.slice(0,60);
 useEffect(()=>{if(open&&active>=0)list.current?.querySelector('[data-active="true"]')?.scrollIntoView({block:'nearest'});},[active,open]);
 function select(choice:SubjectChoice){if(disabled||choice.verified)return;onChange(choice.id);setOpen(false);setQuery('');setActive(-1);}
 function move(direction:number){
  if(!open){setOpen(true);setQuery('');setActive(-1);return;}
  let next=active<0?(direction>0?-1:0):active;
  for(let count=0;count<visible.length;count++){
   next=(next+direction+visible.length)%visible.length;
   if(!visible[next].verified){setActive(next);return;}
  }
 }
 return <div className="ia-assessment-subject-picker" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget)){setOpen(false);setQuery('');setActive(-1);}}}>
  <label htmlFor="assessment-subject">Materia para acreditar</label>
  <div className="ia-assessment-subject-input">
   <SearchIcon size={18}/>
   <input ref={input} id="assessment-subject" className="ia-input" role="combobox" type="text" autoComplete="off"
    aria-expanded={open} aria-autocomplete="list" aria-controls="assessment-subject-results"
    aria-activedescendant={open&&active>=0?'assessment-subject-option-'+active:undefined} aria-describedby="assessment-subject-help"
    value={open?query:selected?.label||''} disabled={disabled} placeholder="Busca y selecciona: matemáticas, marketing, biología…"
    onFocus={()=>{setOpen(true);setQuery('');setActive(-1);}}
    onChange={event=>{setQuery(event.target.value);setOpen(true);setActive(-1);onChange('');}}
    onKeyDown={event=>{
     if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();move(event.key==='ArrowDown'?1:-1);}
     else if(event.key==='Enter'&&open){event.preventDefault();const choice=visible[active>=0?active:visible.findIndex(choice=>!choice.verified)];if(choice)select(choice);}
     else if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();setOpen(false);setQuery('');setActive(-1);}
    }}/>
   {(value||query)&&<button type="button" disabled={disabled} aria-label="Limpiar materia" onClick={()=>{onChange('');setQuery('');setOpen(true);setActive(-1);input.current?.focus();}}><XIcon size={16}/></button>}
  </div>
  {open&&!disabled&&<div className="ia-assessment-subject-menu">
   <div ref={list} id="assessment-subject-results" role="listbox" aria-label="Materias disponibles">
    {visible.map((choice,index)=><div key={choice.id} id={'assessment-subject-option-'+index} role="option"
     aria-selected={choice.id===value} aria-disabled={choice.verified} data-active={index===active}
     onMouseDown={event=>event.preventDefault()} onMouseEnter={()=>setActive(index)} onClick={()=>select(choice)}>
      <span>{choice.label}</span>{choice.verified&&<small>Acreditada</small>}
    </div>)}
   </div>
   <p role="status">{matches.length===0?'No encontramos esa materia. Prueba con otro nombre.':matches.length>visible.length?'Mostrando '+visible.length+' de '+matches.length+'. Escribe para afinar la búsqueda.':matches.length+' materias encontradas.'}</p>
  </div>}
  <p id="assessment-subject-help">{choices.length} materias en un solo catálogo. Selecciona una coincidencia para comenzar.</p>
 </div>;
}

