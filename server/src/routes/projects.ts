import { Router } from 'express';
import { listProjects, listSprints, generateDocx } from '../controllers/projectsController.js';

const router = Router();

router.get('/projects', listProjects);
router.get('/projects/:projectId/sprints', listSprints);
router.get('/sprints/:sprintId/docx', generateDocx);

export default router;
