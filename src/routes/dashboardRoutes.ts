import { Router } from 'express';
import {
  getDashboardData,
  getLogLevelBreakdown,
  getServiceRanking,
  getErrorRateTrend,
  getRecentAlerts
} from '../controllers/dashboardController';

const router = Router();

router.get('/', getDashboardData);
router.get('/level-breakdown', getLogLevelBreakdown);
router.get('/service-ranking', getServiceRanking);
router.get('/error-rate-trend', getErrorRateTrend);
router.get('/recent-alerts', getRecentAlerts);

export default router;
