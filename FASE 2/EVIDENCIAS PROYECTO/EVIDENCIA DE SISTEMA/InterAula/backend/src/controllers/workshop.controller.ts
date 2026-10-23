import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { workshopBackendService } from '../services/workshop.service.js';

export const workshopController = {
  async getUpcomingWorkshops(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const subjectId = req.query.subjectId as string | undefined;
      const currentUserId = req.user?.id;
      const workshops = await workshopBackendService.getUpcomingWorkshops(subjectId, currentUserId);
      res.json({ success: true, data: workshops });
    } catch (err) {
      next(err);
    }
  },

  async getWorkshopById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const currentUserId = req.user?.id;
      const workshop = await workshopBackendService.getWorkshopById(id, currentUserId);
      if (!workshop) {
        return res.status(404).json({ success: false, error: 'Taller no encontrado' });
      }
      res.json({ success: true, data: workshop });
    } catch (err) {
      next(err);
    }
  },

  async createWorkshop(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const workshop = await workshopBackendService.createWorkshop(req.user!, req.token!, req.body);
      res.status(201).json({ success: true, data: workshop });
    } catch (err) {
      next(err);
    }
  },

  async enroll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await workshopBackendService.enroll(req.user!, req.token!, id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async unenroll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await workshopBackendService.unenroll(req.user!, req.token!, id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async updateStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const updated = await workshopBackendService.updateStatus(req.user!, req.token!, id, status);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },

  async deleteWorkshop(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await workshopBackendService.deleteWorkshop(req.user!, req.token!, id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async getMyWorkshopsAsStudent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const workshops = await workshopBackendService.getMyWorkshopsAsStudent(req.user!, req.token!);
      res.json({ success: true, data: workshops });
    } catch (err) {
      next(err);
    }
  },

  async getMyWorkshopsAsTutor(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const workshops = await workshopBackendService.getMyWorkshopsAsTutor(req.user!, req.token!);
      res.json({ success: true, data: workshops });
    } catch (err) {
      next(err);
    }
  },
};
