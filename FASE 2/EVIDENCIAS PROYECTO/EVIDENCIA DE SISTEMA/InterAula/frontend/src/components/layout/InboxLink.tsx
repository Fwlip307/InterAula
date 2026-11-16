import {useEffect,useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {supportService} from '../../services/support.service';
import {MessageSquareIcon} from '../common/Icons';
import '../../styles/inbox.css';
export default function InboxLink(){
 const {pathname}=useLocation(),[count,setCount]=useState<number|null>(null);
 useEffect(()=>{let live=true,request=0;const load=()=>{const current=++request;supportService.inbox(true).then(result=>{if(live&&current===request)setCount(result.unreadCount);}).catch(()=>{});};setCount(null);load();window.addEventListener('interaula:inbox-change',load);return()=>{live=false;window.removeEventListener('interaula:inbox-change',load);};},[pathname]);
 return <Link className="ia-nav-item ia-inbox-link" to="/support" title="Avisos y ayuda" aria-label={`Avisos y ayuda${count?`, ${count} sin leer`:''}`}><MessageSquareIcon size={18}/><span className="ia-inbox-label">Bandeja</span>{Boolean(count)&&<span className="ia-inbox-count">{count!>99?'99+':count}</span>}</Link>;
}
