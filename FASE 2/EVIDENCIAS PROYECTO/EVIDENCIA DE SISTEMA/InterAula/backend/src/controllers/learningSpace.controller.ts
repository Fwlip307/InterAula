import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { learningSpaceService } from '../services/learningSpace.service.js';
import {
  updateLearningSpaceConfigSchema,
  createLearningPathSchema,
  updateLearningPathSchema,
  addLearningStageSchema,
  toggleLearningStageSchema,
  createStudyTaskSchema,
  updateStudyTaskSchema,
  recordTopicAssessmentSchema,
  adaptiveExplanationRequestSchema,
  createQuickIdeaSchema,
  updateQuickIdeaSchema,
} from '../schemas/learningSpace.schema.js';

export const learningSpaceController = {
  /**
   * GET /api/learning-space/overview
   * Obtiene el estado integral de Mi espacio de aprendizaje del usuario autenticado
   */
  async getOverview(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const token = req.token!;

      const [config, paths, tasks, assessments] = await Promise.all([
        learningSpaceService.getConfig(userId, token),
        learningSpaceService.listLearningPaths(userId, token),
        learningSpaceService.listStudyTasks(userId, token),
        learningSpaceService.listTopicAssessments(userId, token),
      ]);

      res.json({
        success: true,
        data: {
          config,
          paths,
          tasks,
          assessments,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/learning-space/config
   */
  async updateConfig(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = updateLearningSpaceConfigSchema.parse(req.body);
      const updated = await learningSpaceService.updateConfig(
        req.user!.id,
        req.token!,
        parsed
      );
      res.json({
        success: true,
        data: updated,
        message: 'Preferencias de tu espacio de aprendizaje actualizadas.',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/learning-space/paths
   */
  async createPath(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createLearningPathSchema.parse(req.body);
      const created = await learningSpaceService.createLearningPath(
        req.user!.id,
        req.token!,
        parsed
      );
      res.status(201).json({
        success: true,
        data: created,
        message: 'Ruta de aprendizaje creada exitosamente.',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/learning-space/paths/:pathId
   */
  async updatePath(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pathId = String(req.params.pathId);
      const parsed = updateLearningPathSchema.parse(req.body);
      const updated = await learningSpaceService.updateLearningPath(
        req.user!.id,
        req.token!,
        pathId,
        parsed
      );
      res.json({
        success: true,
        data: updated,
        message: 'Ruta de aprendizaje actualizada.',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/learning-space/paths/:pathId/stages
   */
  async addStage(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pathId = String(req.params.pathId);
      const parsed = addLearningStageSchema.parse(req.body);
      const updated = await learningSpaceService.addStageToPath(
        req.user!.id,
        req.token!,
        pathId,
        parsed
      );
      res.status(201).json({
        success: true,
        data: updated,
        message: 'Etapa agregada a tu ruta de aprendizaje.',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/learning-space/paths/:pathId/stages/:stageId
   */
  async toggleStage(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pathId = String(req.params.pathId);
      const stageId = String(req.params.stageId);
      const parsed = toggleLearningStageSchema.parse(req.body);

      const updatedPath = await learningSpaceService.toggleStageCompletion(
        req.user!.id,
        req.token!,
        pathId,
        stageId,
        parsed.completed
      );

      res.json({
        success: true,
        data: updatedPath,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/learning-space/paths/:pathId
   */
  async deletePath(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pathId = String(req.params.pathId);
      await learningSpaceService.deleteLearningPath(req.user!.id, req.token!, pathId);
      res.json({
        success: true,
        message: 'Ruta de aprendizaje eliminada.',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/learning-space/tasks
   */
  async createTask(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createStudyTaskSchema.parse(req.body);
      const created = await learningSpaceService.createStudyTask(
        req.user!.id,
        req.token!,
        parsed
      );
      res.status(201).json({
        success: true,
        data: created,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/learning-space/tasks/:taskId
   */
  async updateTask(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const taskId = String(req.params.taskId);
      const parsed = updateStudyTaskSchema.parse(req.body);
      const updated = await learningSpaceService.updateStudyTask(
        req.user!.id,
        req.token!,
        taskId,
        parsed
      );
      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/learning-space/tasks/:taskId
   */
  async deleteTask(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const taskId = String(req.params.taskId);
      await learningSpaceService.deleteStudyTask(req.user!.id, req.token!, taskId);
      res.json({
        success: true,
        message: 'Tarea eliminada.',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/learning-space/assessments
   */
  async recordAssessment(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const parsed = recordTopicAssessmentSchema.parse(req.body);
      const record = await learningSpaceService.recordTopicAssessment(
        req.user!.id,
        req.token!,
        parsed
      );
      res.status(201).json({
        success: true,
        data: record,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/learning-space/explain
   * Genera una explicación adaptable según el modo elegido por el estudiante
   */
  async explainAdaptively(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const parsed = adaptiveExplanationRequestSchema.parse(req.body);
      const explanation = await learningSpaceService.generateAdaptiveExplanation(parsed);
      res.json({
        success: true,
        data: explanation,
      });
    } catch (error) {
      next(error);
    }
  },

  async listQuickIdeas(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await learningSpaceService.listQuickIdeas(req.user!.id, req.token!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async createQuickIdea(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createQuickIdeaSchema.parse(req.body);
      const data = await learningSpaceService.createQuickIdea(req.user!.id, req.token!, parsed);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async updateQuickIdea(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = updateQuickIdeaSchema.parse(req.body);
      const data = await learningSpaceService.updateQuickIdea(
        req.user!.id,
        req.token!,
        String(req.params.ideaId),
        parsed
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async deleteQuickIdea(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await learningSpaceService.deleteQuickIdea(req.user!.id, req.token!, String(req.params.ideaId));
      res.json({ success: true, message: 'Nota eliminada.' });
    } catch (error) {
      next(error);
    }
  },

  async convertQuickIdeaToTask(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await learningSpaceService.convertQuickIdeaToTask(
        req.user!.id,
        req.token!,
        String(req.params.ideaId)
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
};
