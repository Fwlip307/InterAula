import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { projectBackendService } from '../services/project.service.js';

export const projectController = {
  async getProjects(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const projects = await projectBackendService.getProjects();
      res.json({ success: true, data: projects });
    } catch (err) {
      next(err);
    }
  },

  async getProjectById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const project = await projectBackendService.getProjectById(id);
      if (!project) {
        return res.status(404).json({ success: false, error: 'Proyecto no encontrado' });
      }
      res.json({ success: true, data: project });
    } catch (err) {
      next(err);
    }
  },

  async getMyProjects(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const projects = await projectBackendService.getMyProjects(req.user!, req.token!);
      res.json({ success: true, data: projects });
    } catch (err) {
      next(err);
    }
  },

  async getProjectPositions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const positions = await projectBackendService.getProjectPositions(id);
      res.json({ success: true, data: positions });
    } catch (err) {
      next(err);
    }
  },

  async getProjectMembers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const members = await projectBackendService.getProjectMembers(id);
      res.json({ success: true, data: members });
    } catch (err) {
      next(err);
    }
  },

  async getProjectApplications(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const applications = await projectBackendService.getProjectApplications(req.user!, req.token!, id);
      res.json({ success: true, data: applications });
    } catch (err) {
      next(err);
    }
  },

  async getMyApplications(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const applications = await projectBackendService.getMyApplications(req.user!, req.token!);
      res.json({ success: true, data: applications });
    } catch (err) {
      next(err);
    }
  },

  async createProject(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const project = await projectBackendService.createProject(req.user!, req.token!, req.body);
      res.status(201).json({ success: true, data: project });
    } catch (err) {
      next(err);
    }
  },

  async updateProject(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const project = await projectBackendService.updateProject(req.user!, req.token!, id, req.body);
      res.json({ success: true, data: project });
    } catch (err) {
      next(err);
    }
  },

  async updatePositionStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id, positionId } = req.params;
      const { status } = req.body;
      const result = await projectBackendService.updatePositionStatus(
        req.user!,
        req.token!,
        id,
        positionId,
        status
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async applyToPosition(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id, positionId } = req.params;
      const application = await projectBackendService.applyToPosition(
        req.user!,
        req.token!,
        id,
        positionId,
        req.body
      );
      res.status(201).json({ success: true, data: application });
    } catch (err) {
      next(err);
    }
  },

  async withdrawApplication(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { applicationId } = req.params;
      const result = await projectBackendService.withdrawApplication(req.user!, req.token!, applicationId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async reviewApplication(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { applicationId } = req.params;
      const { status, feedback } = req.body;
      const result = await projectBackendService.reviewApplication(
        req.user!,
        req.token!,
        applicationId,
        status,
        feedback
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async deleteProject(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await projectBackendService.deleteProject(req.user!, req.token!, id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
};
