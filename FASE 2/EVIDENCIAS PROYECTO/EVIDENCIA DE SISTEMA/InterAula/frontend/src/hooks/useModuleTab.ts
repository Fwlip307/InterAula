import { useSearchParams } from 'react-router-dom';

/** Keep module tabs addressable by search results, history and shared links. */
export function useModuleTab<T extends string>(allowed:readonly T[],fallback:T):[T,(tab:T)=>void] {
  const [params,setParams]=useSearchParams();
  const value=params.get('tab');
  const active=value&&allowed.includes(value as T)?value as T:fallback;
  const select=(tab:T)=>setParams(current=>{
    const next=new URLSearchParams(current);
    next.set('tab',tab);
    for(const detail of ['note','project','workshop'])next.delete(detail);
    return next;
  });
  return [active,select];
}
