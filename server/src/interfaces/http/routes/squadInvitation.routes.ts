// src/interfaces/http/routes/squadInvitation.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';

export const squadInvitationRouter = Router();

squadInvitationRouter.use(authenticate);

// Student endpoints
squadInvitationRouter.get('/my', authorize('student'), (req, res, next) => {
  req.app.locals.controllers.squadInvitation.getMyInvitations(req, res, next);
});

squadInvitationRouter.post('/guardian-otp/send', authorize('student'), (req, res, next) => {
  req.app.locals.controllers.squadInvitation.sendGuardianOtp(req, res, next);
});

squadInvitationRouter.post('/:id/respond', authorize('student'), (req, res, next) => {
  req.app.locals.controllers.squadInvitation.respond(req, res, next);
});

// Manager / Admin endpoints
squadInvitationRouter.post('/', authorize('manager', 'super_admin'), (req, res, next) => {
  req.app.locals.controllers.squadInvitation.send(req, res, next);
});

squadInvitationRouter.get('/academy', authorize('manager', 'super_admin'), (req, res, next) => {
  req.app.locals.controllers.squadInvitation.getAcademyInvitations(req, res, next);
});

squadInvitationRouter.delete('/:id', authorize('manager', 'super_admin'), (req, res, next) => {
  req.app.locals.controllers.squadInvitation.cancel(req, res, next);
});
