import {useEffect,useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {supportService} from '../../services/support.service';
import {MessageSquareIcon} from '../common/Icons';
import '../../styles/inbox.css';
export default function InboxLink(){
 const {pathname}=useLocation(),[count,setCount]=useState<number|null>(null);
 useEffect(()=>{
  let live=true,request=0,pending=false;
  const load=()=>{if(pending||!live)return;pending=true;const current=++request;supportService.inbox(true).then(result=>{if(live&&current===request)setCount(result.unreadCount);}).catch(()=>{}).finally(()=>{pending=false;});};
  const whenVisible=()=>{if(document.visibilityState==='visible')load();};
  setCount(null);load();const timer=window.setInterval(whenVisible,60000);
  window.addEventListener('interaula:inbox-change',load);window.addEventListener('focus',whenVisible);document.addEventListener('visibilitychange',whenVisible);
  return()=>{live=false;window.clearInterval(timer);window.removeEventListener('interaula:inbox-change',load);window.removeEventListener('focus',whenVisible);document.removeEventListener('visibilitychange',whenVisible);};
 },[pathname]);
 return <Link className="ia-nav-item ia-inbox-link" to="/support" title="Avisos y ayuda" aria-label={`Avisos y ayuda${count?`, ${count} sin leer`:''}`}><MessageSquareIcon size={18}/><span className="ia-inbox-label">Bandeja</span>{Boolean(count)&&<span className="ia-inbox-count">{count!>99?'99+':count}</span>}</Link>;
}
