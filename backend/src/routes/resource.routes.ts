import { Router } from 'express';
import {
  getResources,
  createResource,
  updateResource,
  deleteResource,
} from '../controllers/resource.controller';

const router = Router();

router.get('/', getResources);
router.post('/', createResource);
router.put('/:id', updateResource);
router.delete('/:id', deleteResource);

export default router;
