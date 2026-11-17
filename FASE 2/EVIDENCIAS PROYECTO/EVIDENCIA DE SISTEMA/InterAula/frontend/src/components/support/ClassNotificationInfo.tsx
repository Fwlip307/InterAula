import '../../styles/support.css';
import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {apiClient} from '../../lib/apiClient';
interface Channels{activated:boolean;emailConfigured:boolean;automaticReminders:boolean;emailState:string}
export default function ClassNotificationInfo(){
 const [status,setStatus]=useState<Channels|null>(null),[error,setError]=useState('');
 useEffect(()=>{let live=true;apiClient.get<Channels>('/support/channels').then(value=>{if(live)setStatus(value);}).catch(()=>{if(live)setError('No pudimos comprobar el canal de correo. Tus avisos siguen disponibles en la bandeja.');});return()=>{live=false;};},[]);
 return <aside className="ia-class-notification-info" aria-label="Avisos de tus clases">
  <strong>Avisos de tutorías y talleres</strong>
  <p>Recibe confirmaciones y cambios de tus clases. Los recordatorios se preparan 24 horas y una hora antes, según cuándo se programe la sesión.</p>
  {error?<p>{error}</p>:!status?<p role="status">Comprobando canales…</p>:<p>{!status.activated?'Los avisos automáticos nuevos están pendientes de activación.':status.automaticReminders?'Recordatorios automáticos activos en tu bandeja.':'Los recordatorios se comprueban al abrir la bandeja.'}{' '}{status.emailConfigured?'El servicio de correo está configurado. El envío depende de tus preferencias y de la aceptación del proveedor.':'El envío por correo está preparado; falta configurar el remitente y el servicio de envío.'}</p>}
  <Link to="/settings#notifications">Elegir mis correos y recordatorios</Link>
 </aside>;
}
