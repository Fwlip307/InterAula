import {useEffect,useState} from 'react';
import {Link,useLocation,useNavigate} from 'react-router-dom';
import {moderationService,type ModerationSummary} from '../../services/moderation.service';
import {useAuth} from '../../context/AuthContext';
export default function ModerationStatus(){
 const {user}=useAuth(),userId=user?.id,location=useLocation(),navigate=useNavigate(),[status,setStatus]=useState<ModerationSummary|null>(null);
 useEffect(()=>{let live=true;const refresh=()=>{if(!userId){setStatus(null);return;}moderationService.summary().then(value=>{if(live)setStatus(value);}).catch(()=>{if(live)setStatus(null);});};
  refresh();window.addEventListener('interaula:moderation-change',refresh);return()=>{live=false;window.removeEventListener('interaula:moderation-change',refresh);};
 },[userId,location.pathname]);
 useEffect(()=>{if(status?.account&&location.pathname!=='/support')navigate('/support?tab=measures',{replace:true});},[status,location.pathname,navigate]);
 if(!status?.account&&!status?.tutoring&&!status?.community)return null;
 return <aside className="ia-moderation-status" aria-label="Disponibilidad de tu cuenta"><strong>{status.account?'Tu cuenta tiene una restricción activa.':status.tutoring?'Tu oferta de tutorías está temporalmente restringida.':'Tus interacciones de comunidad están restringidas.'}</strong><span>{status.account?'Conservas el acceso a ayuda y apelación.':'Puedes seguir estudiando y consultar el seguimiento privado.'}</span><Link to="/support?tab=measures">Consultar mis medidas</Link></aside>;
}
