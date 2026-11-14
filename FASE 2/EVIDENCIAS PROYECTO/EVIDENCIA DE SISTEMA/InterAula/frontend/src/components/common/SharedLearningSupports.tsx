import {useEffect,useState} from 'react';
import {apiClient} from '../../lib/apiClient';
import {SUPPORT_PASSPORT_OPTIONS} from '../../types/learningSpace';
interface SharedSupport {student_id:string;display_name:string;supports:string[]}
export default function SharedLearningSupports({projectId}:{projectId?:string}) {
  const [rows,setRows]=useState<SharedSupport[]>([]);const [error,setError]=useState('');const [reload,setReload]=useState(0);
  useEffect(()=>{let live=true;setRows([]);setError('');
    apiClient.get<SharedSupport[]>('/learning-space/shared-supports',{params:projectId?{project_id:projectId}:{}})
      .then(data=>{if(live)setRows(data);}).catch(()=>{if(live)setError('No pudimos consultar los apoyos compartidos.');});
    return()=>{live=false;};
  },[projectId,reload]);
  return <section className="ia-card" aria-label="Apoyos compartidos" style={{padding:16,marginBlock:16}}>
    <h3>Apoyos compartidos contigo</h3><p>Solo se muestran las preferencias que cada persona decidió compartir. Sus notas personales permanecen privadas.</p>
    {error?<p role="alert">{error}</p>:rows.length?rows.map(row=><div key={row.student_id}><strong>{row.display_name}</strong><ul>{row.supports.map(key=><li key={key}>{SUPPORT_PASSPORT_OPTIONS.find(o=>o.key===key)?.label||key}</li>)}</ul></div>):<p>No hay apoyos compartidos para mostrar.</p>}
    <button type="button" className="ia-btn-secondary" onClick={()=>setReload(v=>v+1)}>Actualizar apoyos</button>
  </section>;
}
