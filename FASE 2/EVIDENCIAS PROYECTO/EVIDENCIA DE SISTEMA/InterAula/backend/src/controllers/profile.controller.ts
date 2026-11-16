import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { profileBackendService } from '../services/profile.service.js';

export const profileController = {
  async getMe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const profile = await profileBackendService.getMyProfile(req.user!, req.token!);
      res.json({ success: true, data: profile });
    } catch (err) {
      next(err);
    }
  },

  async updateMe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const updated = await profileBackendService.updateMyProfile(req.user!, req.token!, req.body);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },

  async getPublicProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const profile = await profileBackendService.getPublicProfile(id, req.user?.id);
      if (!profile) {
        res.status(404).json({ success: false, error: 'Perfil de usuario no encontrado' });
        return;
      }
      res.json({ success: true, data: profile });
    } catch (err) {
      next(err);
    }
  },

  async addOfferedSubject(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const created = await profileBackendService.addOfferedSubject(req.user!, req.token!, req.body);
      res.status(201).json({ success: true, data: created });
    } catch (err) {
      next(err);
    }
  },

  async removeOfferedSubject(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { subjectId } = req.params;
      await profileBackendService.removeOfferedSubject(req.user!, req.token!, subjectId);
      res.json({ success: true, message: 'Materia dada de baja de tus asignaturas ofertadas.' });
    } catch (err) {
      next(err);
    }
  },

  async getOfferedSubjects(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const subjects = await profileBackendService.getOfferedSubjects(userId);
      res.json({ success: true, data: subjects });
    } catch (err) {
      next(err);
    }
  },

  async addNeededSubject(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const created = await profileBackendService.addNeededSubject(req.user!, req.token!, req.body);
      res.status(201).json({ success: true, data: created });
    } catch (err) {
      next(err);
    }
  },

  async removeNeededSubject(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await profileBackendService.removeNeededSubject(req.user!, req.token!, id);
      res.json({ success: true, message: 'Materia removida de tus necesidades de aprendizaje.' });
    } catch (err) {
      next(err);
    }
  },

  async getNeededSubjects(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const subjects = await profileBackendService.getNeededSubjects(userId);
      res.json({ success: true, data: subjects });
    } catch (err) {
      next(err);
    }
  },

  async getCatalogSubjects(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const onlyPilot = req.query.onlyPilot === 'true';
      const subjects = await profileBackendService.getCatalogSubjects(onlyPilot);
      res.json({ success: true, data: subjects });
    } catch (err) {
      next(err);
    }
  },
};
