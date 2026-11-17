// Execute inside the backend container. Structure/configuration only, zero user records read.
import {getAdminSupabase} from './dist/lib/supabase.js';
import {classEmailService} from './dist/services/classEmail.service.js';
const client=getAdminSupabase();
const {data,error}=await client.from('email_notification_outbox').select('id,notification_id,recipient_id,state,attempts,expires_at,lease_id,provider_id').limit(0);
console.log(JSON.stringify({queueActivated:!error,recordsRead:data?.length||0,errorCode:error?.code||null,channels:await classEmailService.channelStatus(),scope:'SELECT limit(0) and server configuration flags only. No recipient data, keys, sends or writes.'},null,2));
