import { Router } from 'express';
import { notesController } from '../controllers/notes.controller.js';
import { requireAuth, optionalAuth } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import { createNoteSchema, updateNoteSchema } from '../schemas/notes.schema.js';

const router = Router();

// Explorar apuntes accesibles (públicos, compartidos con sesión, y propios)
router.get('/', optionalAuth, notesController.getNotes);

// Mis apuntes y borradores
router.get('/me', requireAuth, notesController.getMyNotes);

// Obtener detalle de un apunte por ID
router.get('/:id', optionalAuth, notesController.getNoteById);

// Crear apunte o registrar documento subido
router.post(
  '/',
  requireAuth,
  validateRequest({ body: createNoteSchema }),
  notesController.createNote
);

// Actualizar apunte propio (con control de versiones)
router.put(
  '/:id',
  requireAuth,
  validateRequest({ body: updateNoteSchema }),
  notesController.updateNote
);

// Eliminar apunte propio
router.delete('/:id', requireAuth, notesController.deleteNote);

// Registrar descarga de apunte
router.post('/:id/download', optionalAuth, notesController.registerDownload);

export default router;

