import type { PGlite } from '@electric-sql/pglite';

// Test transport: executes the real service's query builders against PostgreSQL/RLS.
// This deliberately implements only operations used by recommendation.service.ts.
export function postgresQuery(db:PGlite,table:string) {
  if(!/^[a-z_]+$/.test(table))throw Error('Invalid test table');
  const state={fields:'*',filters:[] as {op:string;column:string;value:any}[],orders:[] as string[],limit:0,
    single:false,action:'select',payload:null as any};
  const column=(name:string)=>{if(!/^[a-z_]+$/.test(name))throw Error('Invalid test column '+name);return 't.'+name;};
  const query:any=Promise.resolve().then(async()=>{
    try {
      const params:any[]=[];
      const bind=(value:any)=>{params.push(value);return '$'+params.length;};
      const condition=(filter:{op:string;column:string;value:any}):string=>{
        if(filter.op==='in')return column(filter.column)+' IN ('+filter.value.map((value:any)=>bind(value)).join(',')+')';
        if(filter.op==='or')return '('+filter.value.split(',').map((part:string)=>{
          const [field,op,...value]=part.split('.');return condition({column:field,op,value:value.join('.')});
        }).join(' OR ')+')';
        return column(filter.column)+({eq:'=',neq:'<>',gte:'>='}[filter.op]||'=')+bind(filter.value);
      };
      let sql:string;
      if(state.action==='upsert') {
        const keys=Object.keys(state.payload);keys.forEach(column);
        sql='INSERT INTO public.'+table+' ('+keys.join(',')+') VALUES ('+keys.map(key=>bind(state.payload[key])).join(',')+') ON CONFLICT DO NOTHING';
      } else {
        const where=state.filters.length?' WHERE '+state.filters.map(condition).join(' AND '):'';
        if(state.action==='delete')sql='DELETE FROM public.'+table+' t'+where;
        else {
          const fields=state.fields.split(',').map(field=>field==='subject:subjects(name)'
            ?"(SELECT jsonb_build_object('name',s.name) FROM public.subjects s WHERE s.id=t.subject_id) AS subject"
            :field==='*'?'t.*':column(field)).join(',');
          sql='SELECT '+fields+' FROM public.'+table+' t'+where;
          if(state.orders.length)sql+=' ORDER BY '+state.orders.join(',');
          if(state.limit)sql+=' LIMIT '+state.limit;
        }
      }
      const response=await db.query(sql,params);
      return {data:state.action!=='select'?null:state.single?response.rows[0]||null:response.rows,error:null};
    } catch(cause:any){return {data:null,error:{code:cause.code,message:cause.message}};}
  });
  query.select=(fields='*')=>{state.fields=fields;return query;};
  for(const op of ['eq','neq','in'])query[op]=(field:string,value:any)=>{state.filters.push({op,column:field,value});return query;};
  query.or=(value:string)=>{state.filters.push({op:'or',column:'',value});return query;};
  query.order=(field:string,options:{ascending?:boolean}={})=>{state.orders.push(column(field)+(options.ascending===false?' DESC':' ASC'));return query;};
  query.limit=(limit:number)=>{state.limit=limit;return query;};
  query.maybeSingle=()=>{state.single=true;return query;};
  query.delete=()=>{state.action='delete';return query;};
  query.upsert=(payload:any)=>{state.action='upsert';state.payload=payload;return query;};
  return query;
}
