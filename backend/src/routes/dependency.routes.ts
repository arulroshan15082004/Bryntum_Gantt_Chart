import { Router } from 'express';
import {
  getDependencies,
  createDependency,
  updateDependency,
  deleteDependency,
} from '../controllers/dependency.controller';

const router = Router();

router.get('/', getDependencies);
router.post('/', createDependency);
router.put('/:id', updateDependency);
router.delete('/:id', deleteDependency);

export default router;
