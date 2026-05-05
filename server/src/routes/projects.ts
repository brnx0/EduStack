import { Router } from 'express';
import { listProjects, listSprints, generateDocx } from '../controllers/projectsController.js';
import { getDailyActivity } from '../controllers/monitorController.js';
import { adminMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/projects', listProjects);
router.get('/projects/:projectId/sprints', listSprints);
router.get('/sprints/:sprintId/docx', generateDocx);
router.get('/monitor/daily', adminMiddleware, getDailyActivity);

export default router;
