import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { verificationBackendService } from '../services/verification.service.js';

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
};
