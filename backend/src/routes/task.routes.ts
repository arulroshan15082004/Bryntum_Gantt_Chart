import { Router } from 'express';
import {
  getTasks,
  createTask,
  getTaskById,
  updateTask,
  bulkUpdateTasks,
  deleteTask,
  getDeletedTasks,
  restoreTask,
  permanentlyDeleteTask,
} from '../controllers/task.controller';

const router = Router();

router.get('/', getTasks);
router.post('/', createTask);
router.get('/deleted/list', getDeletedTasks);
router.post('/:id/restore', restoreTask);
router.get('/:id', getTaskById);
router.put('/bulk', bulkUpdateTasks);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);
router.delete('/:id/permanent', permanentlyDeleteTask);

export default router;
