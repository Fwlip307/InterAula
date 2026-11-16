import {useCallback,useEffect,useRef} from 'react';

/** Prevent an older response or a response after unmount from replacing current data. */
export function useLatestRequest(){
 const revision=useRef(0);
 useEffect(()=>()=>{revision.current++;},[]);
 return useCallback(()=>{
  const request=++revision.current;
  return ()=>request===revision.current;
 },[]);
}
