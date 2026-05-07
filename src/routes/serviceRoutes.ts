import { Router } from 'express';
import {
  createService,
  getServiceById,
  getServiceByName,
  getAllServices,
  updateService,
  deleteService,
  getServiceStats
} from '../controllers/serviceController';

const router = Router();

router.post('/', createService);
router.get('/', getAllServices);
router.get('/:id', getServiceById);
router.get('/name/:name', getServiceByName);
router.put('/:id', updateService);
router.delete('/:id', deleteService);
router.get('/:id/stats', getServiceStats);

export default router;
