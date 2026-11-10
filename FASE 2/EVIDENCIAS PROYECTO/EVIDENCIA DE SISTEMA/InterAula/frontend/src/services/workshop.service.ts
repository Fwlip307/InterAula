import { supabase } from '../lib/supabase';
import { apiClient } from '../lib/apiClient';
import { API_ENDPOINTS } from '../constants/apiEndpoints';
import type { TutoringWorkshop,CreateWorkshopDTO } from '../types/tutoring';
let channel:ReturnType<typeof supabase.channel>|null=null;
function ensureChannel(){
  if(typeof window==='undefined'||channel)return;
  channel=supabase.channel('ia_live_workshops_feed');
  // Broadcasts only invalidate the view; actual workshop data always comes from the API.
  for(const event of ['workshop_created','workshop_status_changed','workshop_deleted']){
    channel.on('broadcast',{event},()=>window.dispatchEvent(new CustomEvent('ia_workshops_updated')));
  }
  channel.subscribe();
}
function changed(id:string,event:string){
  window.dispatchEvent(new CustomEvent('ia_workshops_updated',{detail:{id}}));
  void channel?.send({type:'broadcast',event,payload:{id}});
}
export const workshopService={
  getUpcomingWorkshops(subjectId?:string):Promise<TutoringWorkshop[]>{
    ensureChannel();return apiClient.get(API_ENDPOINTS.WORKSHOPS.BASE,{params:{subjectId}});
  },
  getWorkshopById(id:string):Promise<TutoringWorkshop>{return apiClient.get(API_ENDPOINTS.WORKSHOPS.BY_ID(id));},
  async createWorkshop(body:CreateWorkshopDTO):Promise<TutoringWorkshop>{
    const workshop=await apiClient.post<TutoringWorkshop>(API_ENDPOINTS.WORKSHOPS.BASE,body);changed(workshop.id,'workshop_created');return workshop;
  },
  async enrollInWorkshop(id:string):Promise<void>{await apiClient.post(API_ENDPOINTS.WORKSHOPS.ENROLL(id));changed(id,'workshop_status_changed');},
  async unenrollFromWorkshop(id:string):Promise<void>{await apiClient.delete(API_ENDPOINTS.WORKSHOPS.ENROLL(id));changed(id,'workshop_status_changed');},
  async updateWorkshopStatus(id:string,status:string):Promise<void>{await apiClient.patch(API_ENDPOINTS.WORKSHOPS.STATUS(id),{status});changed(id,'workshop_status_changed');},
  async deleteWorkshop(id:string):Promise<void>{await apiClient.delete(API_ENDPOINTS.WORKSHOPS.BY_ID(id));changed(id,'workshop_deleted');},
  getMyWorkshopsAsStudent():Promise<TutoringWorkshop[]>{return apiClient.get(API_ENDPOINTS.WORKSHOPS.ME_AS_STUDENT);},
  getMyWorkshopsAsTutor():Promise<TutoringWorkshop[]>{return apiClient.get(API_ENDPOINTS.WORKSHOPS.ME_AS_TUTOR);},
};
