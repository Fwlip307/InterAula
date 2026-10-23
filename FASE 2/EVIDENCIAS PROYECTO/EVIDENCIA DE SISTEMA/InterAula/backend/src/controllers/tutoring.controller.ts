import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { tutoringBackendService } from '../services/tutoring.service.js';

export const tutoringController = {
  async getAvailableTutors(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { subjectId, search, onlyVerified } = req.query;
      const tutors = await tutoringBackendService.getAvailableTutors({
        subjectId: subjectId as string,
        search: search as string,
        onlyVerified: onlyVerified === 'true',
      });
      res.json({ success: true, data: tutors });
    } catch (err) {
      next(err);
    }
  },

  async requestSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const session = await tutoringBackendService.requestSession(req.user!, req.token!, req.body);
      res.status(201).json({ success: true, data: session });
    } catch (err) {
      next(err);
    }
  },

  async updateSessionStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status, cancellation_reason } = req.body;
      const updated = await tutoringBackendService.updateSessionStatus(
        req.user!,
        req.token!,
        id,
        status,
        cancellation_reason
      );
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },

  async submitReview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const review = await tutoringBackendService.submitReview(req.user!, req.token!, id, req.body);
      res.status(201).json({ success: true, data: review });
    } catch (err) {
      next(err);
    }
  },

  async registerAttendance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await tutoringBackendService.registerAttendance(req.user!, req.token!, req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async getMySessions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const role = req.query.role === 'tutor' ? 'tutor' : 'student';
      const sessions = await tutoringBackendService.getMySessions(req.user!, req.token!, role);
      res.json({ success: true, data: sessions });
    } catch (err) {
      next(err);
    }
  },
};
