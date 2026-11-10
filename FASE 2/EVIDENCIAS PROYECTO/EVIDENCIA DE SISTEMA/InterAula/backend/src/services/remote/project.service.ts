import type { AuthenticatedUser } from '../../types/index.js';
import { HttpError } from '../../lib/httpError.js';
import { clientFor, result, existing, attachProfiles } from './database.js';

async function owned(user: AuthenticatedUser, token: string, id: string) {
  return existing(clientFor(token).from('projects').select('id,owner_id').eq('id',id).eq('owner_id',user.id).maybeSingle(),'Proyecto no encontrado o sin permisos.');
}
async function decorate(rows: any[], token?: string): Promise<any[]> {
  if (!rows.length) return [];
  const ids = rows.map(row=>row.id);
  const [positions,members,owners] = await Promise.all([
    result(clientFor(token).from('project_positions').select('*').in('project_id',ids)),
    result(clientFor(token).from('project_members').select('*').in('project_id',ids)),
    attachProfiles(rows,'owner_id','owner',token),
  ]);
  return owners.map(project=>({
    ...project,
    positions:positions.filter((position:any)=>position.project_id===project.id),
    members:members.filter((member:any)=>member.project_id===project.id),
    open_slots_count:positions.filter((p:any)=>p.project_id===project.id&&p.status==='open')
      .reduce((total:number,p:any)=>total+Math.max(0,p.slots-p.slots_filled),0),
  }));
}
export const remoteProjectService = {
  async getProjects(): Promise<any[]> {
    const rows=await result(clientFor().from('projects').select('*').eq('visibility','public').neq('status','draft').order('created_at',{ascending:false}));
    return decorate(rows);
  },
  async getProjectById(id:string,_userId?:string,token?:string):Promise<any> {
    const row=await result(clientFor(token).from('projects').select('*').eq('id',id).maybeSingle());
    if(!row)return null;
    return (await decorate([row],token))[0];
  },
  async getMyProjects(user:AuthenticatedUser,token:string):Promise<any[]> {
    return decorate(await result(clientFor(token).from('projects').select('*').eq('owner_id',user.id).order('created_at',{ascending:false})),token);
  },
  async getProjectPositions(id:string,userId?:string,token?:string):Promise<any[]> {
    if(!await this.getProjectById(id,userId,token))throw new HttpError(404,'Proyecto no encontrado');
    return result(clientFor(token).from('project_positions').select('*').eq('project_id',id).order('created_at'));
  },
  async getProjectMembers(id:string,userId?:string,token?:string):Promise<any[]> {
    if(!await this.getProjectById(id,userId,token))throw new HttpError(404,'Proyecto no encontrado');
    return attachProfiles(await result(clientFor(token).from('project_members').select('*,position:project_positions(*)').eq('project_id',id)),'profile_id','profile',token);
  },
  async getProjectApplications(user:AuthenticatedUser,token:string,id:string):Promise<any[]> {
    await owned(user,token,id);
    return attachProfiles(await result(clientFor(token).from('project_applications').select('*,position:project_positions(*)').eq('project_id',id).order('created_at',{ascending:false})),'applicant_id','applicant',token);
  },
  async getMyApplications(user:AuthenticatedUser,token:string):Promise<any[]> {
    return result(clientFor(token).from('project_applications').select('*,project:projects(*),position:project_positions(*)').eq('applicant_id',user.id).order('created_at',{ascending:false}));
  },
  async createProject(_user:AuthenticatedUser,token:string,body:Record<string,any>):Promise<any> {
    const id=await result(clientFor(token).rpc('save_collaborative_project',{p_project_id:null,p_payload:body}));
    return this.getProjectById(id,_user.id,token);
  },
  async updateProject(user:AuthenticatedUser,token:string,id:string,body:Record<string,any>):Promise<any> {
    await owned(user,token,id);
    await result(clientFor(token).rpc('save_collaborative_project',{p_project_id:id,p_payload:body}));
    return this.getProjectById(id,user.id,token);
  },
  async updatePositionStatus(user:AuthenticatedUser,token:string,id:string,positionId:string,status:string):Promise<any> {
    await owned(user,token,id);
    return existing(clientFor(token).from('project_positions').update({status}).eq('id',positionId).eq('project_id',id).select('*').maybeSingle(),'Vacante no encontrada.');
  },
  async applyToPosition(user:AuthenticatedUser,token:string,id:string,positionId:string,body:Record<string,any>):Promise<any> {
    const project=await this.getProjectById(id,user.id,token);
    if(!project)throw new HttpError(404,'Proyecto no encontrado');
    if(project.owner_id===user.id)throw new HttpError(400,'No puedes postular a tu propio proyecto.');
    return result(clientFor(token).rpc('apply_collaborative_project',{p_project_id:id,p_position_id:positionId,p_payload:body}));
  },
  async withdrawApplication(user:AuthenticatedUser,token:string,id:string):Promise<any> {
    return existing(clientFor(token).from('project_applications').update({status:'withdrawn',updated_at:new Date().toISOString()})
      .eq('id',id).eq('applicant_id',user.id).eq('status','pending').select('*').maybeSingle(),'La postulación ya fue resuelta o no existe.');
  },
  async reviewApplication(_user:AuthenticatedUser,token:string,id:string,status:string,feedback?:string):Promise<any> {
    return result(clientFor(token).rpc('review_project_application',{p_application_id:id,p_status:status,p_feedback:feedback||null}));
  },
  async deleteProject(user:AuthenticatedUser,token:string,id:string):Promise<any> {
    await owned(user,token,id);
    await existing(clientFor(token).from('projects').delete().eq('id',id).eq('owner_id',user.id).select('id').maybeSingle(),'Proyecto no encontrado.');
    return {success:true,id};
  },
  async removeProjectMember(_user:AuthenticatedUser,token:string,id:string,memberId:string):Promise<any> {
    await result(clientFor(token).rpc('remove_collaborative_member',{p_project_id:id,p_member_id:memberId}));
    return {success:true,id:memberId};
  },
};
