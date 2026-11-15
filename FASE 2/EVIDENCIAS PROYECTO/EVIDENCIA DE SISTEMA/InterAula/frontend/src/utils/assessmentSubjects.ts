import {getAllCatalogSubjects} from '../services/catalogResolver';
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function assessmentSubjectChoices(registered:{id:string;name:string}[],verifiedNames:string[]=[]) {
  const verified=new Set(verifiedNames.map(normalize));
  const catalog=getAllCatalogSubjects();
  const counts=new Map<string,number>();for(const s of catalog)counts.set(normalize(s.name),(counts.get(normalize(s.name))||0)+1);
  const rows=catalog.map(subject=>({id:'catalog:'+subject.id,name:subject.name,
    label:subject.name+((counts.get(normalize(subject.name))||0)>1?' · '+subject.areaName:''),verified:verified.has(normalize(subject.name))}));
  for(const subject of registered)if(/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(subject.id)) {
    const index=rows.findIndex(row=>normalize(row.name)===normalize(subject.name));
    if(index>=0)rows[index]={...rows[index],...subject};
    else rows.push({...subject,label:subject.name,verified:verified.has(normalize(subject.name))});
  }
  return rows.sort((a,b)=>a.label.localeCompare(b.label,'es'));
}
