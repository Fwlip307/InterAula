import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { SearchIcon, XIcon, ArrowRightIcon } from '../common/Icons';
import { searchNavigation, type NavigationDestination } from '../../navigation/navigationSearch';
import '../../styles/navigationSearch.css';

export default function GlobalNavigationSearch({onOpen}:{onOpen:()=>void}) {
  const [open,setOpen]=useState(false);
  const [query,setQuery]=useState('');
  const [active,setActive]=useState(0);
  const dialog=useRef<HTMLDialogElement>(null);
  const input=useRef<HTMLInputElement>(null);
  const navigate=useNavigate();
  const location=useLocation();
  const listId=useId();
  const titleId=useId();
  const results=useMemo(()=>searchNavigation(query),[query]);
  function show() {onOpen();setQuery('');setActive(0);setOpen(true);}
  useEffect(()=>{
    const handler=(event:KeyboardEvent)=>{
      if(!event.isComposing&&!event.altKey&&(event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k') {
        event.preventDefault();
        if(open)input.current?.focus();else show();
      }
    };
    window.addEventListener('keydown',handler);
    return()=>window.removeEventListener('keydown',handler);
  });
  useEffect(()=>{
    const element=dialog.current;
    if(!element)return;
    if(open) {
      const overflow=document.body.style.overflow;
      document.body.style.overflow='hidden';
      if(!element.open)element.showModal();
      input.current?.focus({preventScroll:true});
      return()=>{if(element.open)element.close();document.body.style.overflow=overflow;};
    }
  },[open]);
  useEffect(()=>{
    if(open)document.getElementById(listId+'-'+active)?.scrollIntoView({block:'nearest'});
  },[active,listId,open]);
  function select(entry:NavigationDestination) {
    dialog.current?.close();
    setOpen(false);
    // A new location key also lets the destination reset a selected detail pane.
    navigate(entry.href);
  }
  const locationKey=location.key;
  useEffect(()=>{dialog.current?.close();},[locationKey]);
  return <>
    <button type="button" className="ia-global-search-trigger" onClick={show} aria-haspopup="dialog" aria-expanded={open}
      aria-label="Buscar módulos y opciones de InterAula (Control o Comando más K)">
      <SearchIcon size={17}/><span>Buscar en InterAula</span><kbd aria-hidden="true">Ctrl K</kbd>
    </button>
    {createPortal(<dialog ref={dialog} className="ia-global-search-dialog" aria-labelledby={titleId}
      onCancel={event=>{event.preventDefault();setOpen(false);}} onClose={()=>{if(!dialog.current?.open)setOpen(false);}}
      onKeyDown={event=>{
        if(event.key==='Escape'&&!event.nativeEvent.isComposing){event.preventDefault();setOpen(false);return;}
        if(event.key!=='Tab')return;
        const controls=event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)');
        const first=controls[0],last=controls[controls.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }}
      onClick={event=>{if(event.target===event.currentTarget){const rect=event.currentTarget.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)setOpen(false);}}}>
      <div className="ia-global-search-heading"><div><h2 id={titleId}>¿Adónde quieres ir?</h2><p>Busca módulos y opciones de InterAula.</p></div>
        <button type="button" className="ia-global-search-close" aria-label="Cerrar buscador" onClick={()=>setOpen(false)}><XIcon size={19}/></button></div>
      <div className="ia-global-search-input"><SearchIcon size={20}/><input ref={input} type="search" value={query} maxLength={120}
        aria-label="Buscar módulos y opciones" placeholder="Ej.: Quiero aprender, talleres, borradores…" autoComplete="off" spellCheck={false}
        role="combobox" aria-autocomplete="list" aria-expanded={open&&results.length>0} aria-controls={listId}
        aria-activedescendant={results.length?listId+'-'+Math.min(active,results.length-1):undefined}
        onChange={event=>{setQuery(event.target.value);setActive(0);}}
        onKeyDown={event=>{
          if(event.nativeEvent.isComposing)return;
          if((event.key==='ArrowDown'||event.key==='ArrowUp')&&results.length){event.preventDefault();setActive(index=>(index+(event.key==='ArrowDown'?1:-1)+results.length)%results.length);}
          if(event.key==='Enter'&&results[active]){event.preventDefault();select(results[active]);}
        }}/></div>
      <p className="ia-global-search-count" role="status" aria-live="polite">{query.trim()?`${results.length} resultado${results.length===1?'':'s'}`:'Accesos a todos los módulos y sus opciones'}</p>
      <div id={listId} role="listbox" aria-label="Destinos de navegación" className="ia-global-search-results">
        {results.map((entry,index)=><div key={entry.id} id={listId+'-'+index} role="option" aria-selected={active===index} data-destination={entry.id}
          className={`ia-global-search-result ${active===index?'is-active':''}`} onMouseEnter={()=>setActive(index)}
          onMouseDown={event=>event.preventDefault()} onClick={()=>select(entry)}>
          <div><span className="ia-global-search-module">{entry.module}</span><strong>{entry.title}</strong><p>{entry.description}</p></div><ArrowRightIcon size={17}/>
        </div>)}
      </div>
      {results.length===0&&<div className="ia-global-search-empty"><strong>No encontramos esa opción</strong><p>Prueba con «intereses», «tutorías», «apuntes» o «configuración».</p></div>}
      <footer className="ia-global-search-footer"><span><kbd>↑</kbd> <kbd>↓</kbd> Recorrer</span><span><kbd>Enter</kbd> Abrir</span><span><kbd>Esc</kbd> Cerrar</span></footer>
    </dialog>,document.body)}
  </>;
}
