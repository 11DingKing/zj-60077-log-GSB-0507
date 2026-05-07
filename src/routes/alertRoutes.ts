import { Router } from 'express';
import {
  createAlertRule,
  getAlertRuleById,
  getAlertRulesByService,
  getAllAlertRules,
  updateAlertRule,
  deleteAlertRule,
  triggerAlertCheck,
  getAlerts,
  acknowledgeAlert,
  resolveAlert
} from '../controllers/alertController';

const router = Router();

router.post('/rules', createAlertRule);
router.get('/rules', getAllAlertRules);
router.get('/rules/:id', getAlertRuleById);
router.get('/rules/service/:serviceId', getAlertRulesByService);
router.put('/rules/:id', updateAlertRule);
router.delete('/rules/:id', deleteAlertRule);

router.post('/check', triggerAlertCheck);
router.get('/history', getAlerts);
router.post('/:id/acknowledge', acknowledgeAlert);
router.post('/:id/resolve', resolveAlert);

export default router;
