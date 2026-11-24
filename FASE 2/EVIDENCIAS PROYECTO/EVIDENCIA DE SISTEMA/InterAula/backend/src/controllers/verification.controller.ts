import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { verificationBackendService } from '../services/verification.service.js';
import { HttpError } from '../lib/httpError.js';
import {env} from '../config/env.js';
import {getAdminSupabase} from '../lib/supabase.js';
import {assessmentCatalog} from '../data/assessmentCatalog.js';
import { assessmentService } from '../services/assessment.service.js';
import { clientFor, result, attachProfiles } from '../services/remote/database.js';

export const verificationController = {
  async inclusiveStatus(req:AuthenticatedRequest,res:Response) {
    const check=await clientFor(req.token).from('inclusive_tutor_accreditations').select('proof_version,document_path,review_history').limit(0);
    let hasReviewer=false;
    try {const reviewers=await getAdminSupabase().from('academic_validators').select('profile_id').neq('profile_id',req.user!.id).limit(1);hasReviewer=!reviewers.error&&!!reviewers.data?.length;}catch {/* readiness only */}
    res.json({success:true,data:{schemaReady:!check.error,hasReviewer}});
  },
  async assessmentStatus(_req:AuthenticatedRequest,res:Response) {
    let schemaReady=false;
    if(env.supabaseServiceRoleKey)try {
      const response=await getAdminSupabase().from('tutor_assessment_attempts').select('id,question_deadline,integrity_count').limit(0);
      schemaReady=!response.error;
    } catch {/* availability only; never expose private provider errors */}
    res.json({success:true,data:{serverConfigured:!!env.supabaseServiceRoleKey,schemaReady,generationConfigured:!!process.env.GEMINI_API_KEY,catalogSubjects:assessmentCatalog.length}});
  },
  async getAssessment(req:AuthenticatedRequest,res:Response,next:NextFunction) {
    try{res.json({success:true,data:await assessmentService.get(req.user!,req.params.id)});}catch(error){next(error);}
  },
  async nextAssessmentQuestion(req:AuthenticatedRequest,res:Response,next:NextFunction) {
    try{res.json({success:true,data:await assessmentService.next(req.user!,req.params.id)});}catch(error){next(error);}
  },
  async reportAssessmentEvent(req:AuthenticatedRequest,res:Response,next:NextFunction) {
    try{res.json({success:true,data:await assessmentService.event(req.user!,req.params.id,req.body)});}catch(error){next(error);}
  },
  async getMyRequests(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const requests = await verificationBackendService.getMyVerificationRequests(req.user!, req.token!);
      res.json({ success: true, data: requests });
    } catch (err) {
      next(err);
    }
  },

  async getRequestsForValidator(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const requests = await verificationBackendService.getVerificationRequestsForValidator(req.user!, req.token!);
      res.json({ success: true, data: requests });
    } catch (err) {
      next(err);
    }
  },

  async createRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { subject_id } = req.body;
      const request = await verificationBackendService.createVerificationRequest(req.user!, req.token!, subject_id);
      res.status(201).json({ success: true, data: request });
    } catch (err) {
      next(err);
    }
  },

  async botGrant(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await verificationBackendService.botGrant(req.user!, req.token!, req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  async assignPracticalExercise(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { practical_exercise_title } = req.body;
      const updated = await verificationBackendService.assignPracticalExercise(
        req.user!,
        req.token!,
        id,
        practical_exercise_title
      );
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },

  async submitPracticalEvaluation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const updated = await verificationBackendService.submitPracticalEvaluation(req.user!, req.token!, id, req.body);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },

  async reviewRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const updated = await verificationBackendService.reviewVerificationRequest(req.user!, req.token!, id, req.body);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },

  async saveCertificateExtraction(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const updated = await verificationBackendService.saveCertificateExtraction(req.user!, req.token!, id, req.body);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },

  async cancelRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await verificationBackendService.cancelPendingRequest(req.user!, req.token!, id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async checkIsValidator(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id || (req.query.userId as string);
      if (!userId) {
        return res.json({ success: true, data: { isValidator: false } });
      }
      const isValidator = await verificationBackendService.isAcademicValidator(userId);
      res.json({ success: true, data: { isValidator } });
    } catch (err) {
      next(err);
    }
  },

  async requestTeacherEndorsement(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { subject_id, professor_name, professor_email, message } = req.body;
      const client = clientFor(req.token);
      // Asegurar idempotentemente que la materia esté registrada como ofrecida (is_verified=false) antes de solicitar el aval docente.
      const existingOffer = await result(
        client
          .from('profile_offered_subjects')
          .select('subject_id,is_verified')
          .eq('profile_id', req.user!.id)
          .eq('subject_id', subject_id)
          .maybeSingle()
      );
      if (existingOffer?.is_verified) {
        throw new HttpError(409, 'Esta asignatura ya cuenta con acreditación aprobada.');
      }
      if (!existingOffer) {
        const insertedOffer = await client.from('profile_offered_subjects').insert({
          profile_id: req.user!.id,
          subject_id,
          level: 'basic',
          is_verified: false,
        });
        if (insertedOffer.error && insertedOffer.error.code !== '23505') {
          await result(Promise.resolve(insertedOffer));
        }
      }
      const data = await result(
        client.rpc('request_teacher_endorsement', {
          p_subject_id: subject_id,
          p_name: professor_name,
          p_email: professor_email,
          p_message: message,
        }),
        'No se pudo registrar la solicitud. Comprueba que el docente sea un validador registrado y que no exista otra solicitud activa para esta asignatura.'
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async startAssessmentAttempt(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await assessmentService.start(req.user!, req.token!, req.body.subject_id,{catalogSubjectId:req.body.catalog_subject_id,timeMode:req.body.time_mode});
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async answerAssessmentAttempt(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await assessmentService.answer(req.user!, req.params.id, req.body);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async getMyInclusiveAccreditation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { data, error } = await clientFor(req.token)
        .from('inclusive_tutor_accreditations')
        .select('*')
        .eq('tutor_id', req.user!.id)
        .maybeSingle();
      if (error && !['PGRST205', '42P01'].includes(String(error.code))) {
        throw error;
      }
      res.json({ success: true, data: data || null });
    } catch (error) {
      next(error);
    }
  },

  async requestInclusiveAccreditation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const evidence=req.body;
      if(!evidence.document_path.startsWith(req.user!.id+'/')||evidence.document_path.includes('..'))throw new HttpError(400,'El certificado debe pertenecer a tu cuenta.');
      const storage=clientFor(req.token).storage.from('inclusive-evidence');
      const downloaded=await storage.download(evidence.document_path);
      if(downloaded.error||!downloaded.data)throw new HttpError(400,'No se encontró el certificado privado. Vuelve a subir el PDF.');
      const header=await downloaded.data.slice(0,5).text();
      if(header!=='%PDF-'||downloaded.data.size!==evidence.document_size_bytes||downloaded.data.size>5242880)throw new HttpError(400,'El respaldo debe ser un PDF válido de hasta 5 MB.');
      const data = await result(
        clientFor(req.token)
          .from('inclusive_tutor_accreditations')
          .upsert(
            {
              tutor_id: req.user!.id,
              status: 'pending',
              ...evidence,
              proof_version:2,
              verified_by: null,
              verified_at: null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'tutor_id' }
          )
          .select('*')
          .single(),
        'No se pudo registrar la solicitud de acreditación en acompañamiento inclusivo.'
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async listInclusiveAccreditationsForValidator(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const data = await result(
        clientFor(req.token)
          .from('inclusive_tutor_accreditations')
          .select('*')
          .order('updated_at', { ascending: false })
      );
      res.json({ success: true, data: await attachProfiles(data, 'tutor_id', 'profile', req.token!) });
    } catch (error) {
      next(error);
    }
  },

  async reviewInclusiveAccreditation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { status,reviewer_notes,verification_checks,expected_updated_at } = req.body;
      if(status==='approved'&&!Object.values(verification_checks).every(Boolean))throw new HttpError(400,'Debes completar las cuatro comprobaciones para aprobar.');
      const current=await result(clientFor(req.token).from('inclusive_tutor_accreditations').select('tutor_id').eq('id',req.params.id).maybeSingle());
      if(current?.tutor_id===req.user!.id)throw new HttpError(403,'Otro docente debe revisar tu acreditación.');
      const data = await result(
        clientFor(req.token)
          .from('inclusive_tutor_accreditations')
          .update({
            status,
            verified_by: req.user!.id,
            verified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            reviewer_notes,verification_checks,
          })
          .eq('id', req.params.id)
          .eq('updated_at',expected_updated_at)
          .select('*')
          .maybeSingle(),
        'No se pudo actualizar la acreditación.'
      );
      if(!data)throw new HttpError(409,'La solicitud cambió. Actualiza y revisa la evidencia nuevamente.');
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
};
