import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { verificationBackendService } from '../services/verification.service.js';
import { assessmentService } from '../services/assessment.service.js';
import { clientFor, result } from '../services/remote/database.js';

export const verificationController = {
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
      const data = await result(
        clientFor(req.token).rpc('request_teacher_endorsement', {
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
      const data = await assessmentService.start(req.user!, req.token!, req.body.subject_id);
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
      const { training_name, evidence_notes } = req.body;
      const data = await result(
        clientFor(req.token)
          .from('inclusive_tutor_accreditations')
          .upsert(
            {
              tutor_id: req.user!.id,
              status: 'pending',
              training_name,
              evidence_notes,
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
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async reviewInclusiveAccreditation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { status } = req.body;
      const data = await result(
        clientFor(req.token)
          .from('inclusive_tutor_accreditations')
          .update({
            status,
            verified_by: req.user!.id,
            verified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', req.params.id)
          .select('*')
          .single(),
        'No se pudo actualizar la acreditación.'
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
};
