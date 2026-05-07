import { Request, Response } from 'express';
import dashboardService from '../services/dashboardService';

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: 仪表盘 API - 提供日志平台的统计和监控数据
 */

/**
 * @swagger
 * /dashboard:
 *   get:
 *     summary: 获取完整仪表盘数据
 *     tags: [Dashboard]
 *     description: 获取仪表盘所需的所有数据，包括日志级别占比、服务排行、错误率趋势和最近告警
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     logLevelBreakdown:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           level:
 *                             $ref: '#/components/schemas/LogLevel'
 *                           count:
 *                             type: number
 *                             example: 156
 *                           percentage:
 *                             type: number
 *                             example: 35.5
 *                     serviceRanking:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           serviceId:
 *                             type: string
 *                             format: uuid
 *                           serviceName:
 *                             type: string
 *                           totalLogs:
 *                             type: number
 *                           errorCount:
 *                             type: number
 *                     errorRateTrend:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                           errorRate:
 *                             type: number
 *                             example: 5.2
 *                           totalLogs:
 *                             type: number
 *                           errorLogs:
 *                             type: number
 *                     recentAlerts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Alert'
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalLogsLast24h:
 *                           type: number
 *                           example: 15678
 *                         errorLogsLast24h:
 *                           type: number
 *                           example: 456
 *                         activeAlerts:
 *                           type: number
 *                           example: 3
 *                         totalServices:
 *                           type: number
 *                           example: 12
 *       500:
 *         description: 服务器内部错误
 */
export const getDashboardData = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await dashboardService.getDashboardData();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
};

/**
 * @swagger
 * /dashboard/level-breakdown:
 *   get:
 *     summary: 获取日志级别占比
 *     tags: [Dashboard]
 *     description: 获取指定时间范围内各级别日志的数量和占比
 *     parameters:
 *       - in: query
 *         name: hours
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 统计时间范围（小时）
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       level:
 *                         $ref: '#/components/schemas/LogLevel'
 *                       count:
 *                         type: number
 *                         example: 156
 *                       percentage:
 *                         type: number
 *                         example: 35.5
 *       500:
 *         description: 服务器内部错误
 */
export const getLogLevelBreakdown = async (req: Request, res: Response): Promise<void> => {
  try {
    const hours = req.query.hours ? parseInt(req.query.hours as string, 10) : 1;
    const data = await dashboardService.getLogLevelBreakdown(hours);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
};

/**
 * @swagger
 * /dashboard/service-ranking:
 *   get:
 *     summary: 获取服务日志量排行
 *     tags: [Dashboard]
 *     description: 获取按日志量排序的服务列表
 *     parameters:
 *       - in: query
 *         name: hours
 *         schema:
 *           type: integer
 *           default: 24
 *         description: 统计时间范围（小时）
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: 返回数量限制
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       serviceId:
 *                         type: string
 *                         format: uuid
 *                       serviceName:
 *                         type: string
 *                       totalLogs:
 *                         type: number
 *                         example: 5678
 *                       errorCount:
 *                         type: number
 *                         example: 123
 *       500:
 *         description: 服务器内部错误
 */
export const getServiceRanking = async (req: Request, res: Response): Promise<void> => {
  try {
    const hours = req.query.hours ? parseInt(req.query.hours as string, 10) : 24;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const data = await dashboardService.getServiceRanking(hours, limit);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
};

/**
 * @swagger
 * /dashboard/error-rate-trend:
 *   get:
 *     summary: 获取错误率趋势
 *     tags: [Dashboard]
 *     description: 获取指定时间范围内的错误率变化趋势
 *     parameters:
 *       - in: query
 *         name: hours
 *         schema:
 *           type: integer
 *           default: 24
 *         description: 统计时间范围（小时）
 *       - in: query
 *         name: granularity
 *         schema:
 *           type: string
 *           enum: [1min, 5min, 1h, 1d]
 *           default: 1h
 *         description: 时间粒度
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       errorRate:
 *                         type: number
 *                         example: 5.2
 *                       totalLogs:
 *                         type: number
 *                         example: 156
 *                       errorLogs:
 *                         type: number
 *                         example: 8
 *       500:
 *         description: 服务器内部错误
 */
export const getErrorRateTrend = async (req: Request, res: Response): Promise<void> => {
  try {
    const hours = req.query.hours ? parseInt(req.query.hours as string, 10) : 24;
    const granularity = (req.query.granularity as string) || '1h';
    const data = await dashboardService.getErrorRateTrend(hours, granularity);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
};

/**
 * @swagger
 * /dashboard/recent-alerts:
 *   get:
 *     summary: 获取最近告警列表
 *     tags: [Dashboard]
 *     description: 获取最近的告警记录列表
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: 返回数量限制
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Alert'
 *       500:
 *         description: 服务器内部错误
 */
export const getRecentAlerts = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const data = await dashboardService.getRecentAlerts(limit);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
};
