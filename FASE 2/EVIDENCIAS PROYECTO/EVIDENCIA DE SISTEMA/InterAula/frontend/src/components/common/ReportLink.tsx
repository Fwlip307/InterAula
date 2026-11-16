import {Link} from 'react-router-dom';
import type {ReportKind} from '../../types/support';
export default function ReportLink({kind,targetId}:{kind:ReportKind;targetId:string}){
 return <Link className="ia-report-link" to={`/support?report=${kind}&target=${encodeURIComponent(targetId)}`} style={{fontSize:'.8rem',color:'var(--ia-text-muted)',textDecoration:'underline'}}>Informar un problema</Link>;
}
