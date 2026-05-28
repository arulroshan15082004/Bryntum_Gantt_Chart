import { Router } from 'express';
import {
  getProjects,
  createProject,
  getProjectById,
  updateProject,
  deleteProject,
} from '../controllers/project.controller';
import { importTasksFromCSV } from '../controllers/task.controller';

const router = Router();

router.get('/', getProjects);
router.post('/', createProject);
router.get('/:id', getProjectById);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);

// Bulk CSV Import under project context
router.post('/:projectId/import-csv', importTasksFromCSV);

export default router;
