import { Router } from 'express';
import { profileController } from '../controllers/profile.controller.js';
import { requireAuth, optionalAuth } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import {
  updateProfileSchema,
  addOfferedSubjectSchema,
  addNeededSubjectSchema,
} from '../schemas/profile.schema.js';

const router = Router();

// Perfil propio del usuario autenticado
router.get('/me', requireAuth, profileController.getMe);
router.put(
  '/me',
  requireAuth,
  validateRequest({ body: updateProfileSchema }),
  profileController.updateMe
);

// Catálogo general de asignaturas
router.get('/catalog/subjects', profileController.getCatalogSubjects);

// Perfiles públicos (accesible con sesión o anónimo, enmascara datos sensibles)
router.get('/:id', optionalAuth, profileController.getPublicProfile);

// Materias ofrecidas por el tutor
router.get('/:userId/offered-subjects', profileController.getOfferedSubjects);
router.post(
  '/offered-subjects',
  requireAuth,
  validateRequest({ body: addOfferedSubjectSchema }),
  profileController.addOfferedSubject
);
router.delete('/offered-subjects/:subjectId', requireAuth, profileController.removeOfferedSubject);

// Materias requeridas / de interés por el estudiante
router.get('/:userId/needed-subjects', profileController.getNeededSubjects);
router.post(
  '/needed-subjects',
  requireAuth,
  validateRequest({ body: addNeededSubjectSchema }),
  profileController.addNeededSubject
);
router.delete('/needed-subjects/:id', requireAuth, profileController.removeNeededSubject);

export default router;
