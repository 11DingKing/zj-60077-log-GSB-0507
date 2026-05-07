import { Request, Response } from 'express';
import { LogLevel } from '@prisma/client';
import logService from '../services/logService';
import { LogEntry, LogQueryParams, LogAggregationParams } from '../types/log';

/**
 * @swagger
 * tags:
 *   name: Logs
 *   description: 日志管理 API - 接收、查询、聚合和导出日志
 */

/**
 * @swagger
 * /logs/single:
 *   post:
 *     summary: 接收单条日志
 *     tags: [Logs]
 *     description: 接收单条日志数据，验证后写入 Redis 队列缓冲
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LogEntry'
 *           example:
 *             timestamp: "2024-01-15T10:30:00.000Z"
 *             level: "INFO"
 *             service: "user-service"
 *             message: "User logged in successfully"
 *             metadata:
 *               userId: 12345
 *               requestId: "req_abc123"
 *               durationMs: 150
 *     responses:
 *       202:
 *         description: 日志已成功加入队列
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Log queued successfully"
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Missing required fields: timestamp, level, service, message"
 */
export const receiveSingleLog = async (req: Request, res: Response): Promise<void> => {
  try {
    const logEntry: LogEntry = req.body;
    await logService.receiveSingleLog(logEntry);
    res.status(202).json({ success: true, message: 'Log queued successfully' });
  } catch (error) {
    res.status(400).json({ success: false, error: (error as Error).message });
  }
};

/**
 * @swagger
 * /logs/batch:
 *   post:
 *     summary: 批量接收日志
 *     tags: [Logs]
 *     description: 接收多条日志数据，批量写入 Redis 队列缓冲
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               $ref: '#/components/schemas/LogEntry'
 *           example:
 *             - timestamp: "2024-01-15T10:30:00.000Z"
 *               level: "INFO"
 *               service: "user-service"
 *               message: "User logged in successfully"
 *               metadata:
 *                 userId: 12345
 *             - timestamp: "2024-01-15T10:30:01.000Z"
 *               level: "ERROR"
 *               service: "payment-service"
 *               message: "Payment processing failed"
 *               metadata:
 *                 orderId: "ORD_001"
 *     responses:
 *       202:
 *         description: 批量日志已处理
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 success:
 *                   type: number
 *                   example: 98
 *                 failed:
 *                   type: number
 *                   example: 2
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["Log at index 5: Service 'unknown-service' not found"]
 *                 message:
 *                   type: string
 *                   example: "Processed 98 logs, 2 failed"
 *       400:
 *         description: 请求格式错误
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Expected an array of logs"
 *       500:
 *         description: 服务器内部错误
 */
export const receiveBatchLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const logEntries: LogEntry[] = req.body;
    
    if (!Array.isArray(logEntries)) {
      res.status(400).json({ success: false, error: 'Expected an array of logs' });
      return;
    }

    const result = await logService.receiveBatchLogs(logEntries);
    res.status(202).json({
      success: true,
      ...result,
      message: result.failed > 0 
        ? `Processed ${result.success} logs, ${result.failed} failed` 
        : `Processed ${result.success} logs successfully`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
};

/**
 * @swagger
 * /logs/query:
 *   get:
 *     summary: 查询日志
 *     tags: [Logs]
 *     description: 按条件查询日志，支持时间范围、级别过滤、服务过滤、关键词搜索和分页
 *     parameters:
 *       - in: query
 *         name: startTime
 *         schema:
 *           type: string
 *           format: date-time
 *         description: 开始时间（ISO 格式）
 *         example: "2024-01-15T00:00:00.000Z"
 *       - in: query
 *         name: endTime
 *         schema:
 *           type: string
 *           format: date-time
 *         description: 结束时间（ISO 格式）
 *         example: "2024-01-15T23:59:59.000Z"
 *       - in: query
 *         name: levels
 *         schema:
 *           type: string
 *         description: 日志级别（逗号分隔）
 *         example: "ERROR,WARN"
 *       - in: query
 *         name: services
 *         schema:
 *           type: string
 *         description: 服务名称（逗号分隔）
 *         example: "user-service,payment-service"
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: 消息关键词搜索（不区分大小写）
 *         example: "error"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 页码
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 每页数量
 *     responses:
 *       200:
 *         description: 查询成功
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
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       level:
 *                         $ref: '#/components/schemas/LogLevel'
 *                       serviceId:
 *                         type: string
 *                       serviceName:
 *                         type: string
 *                       message:
 *                         type: string
 *                       metadata:
 *                         type: object
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 total:
 *                   type: number
 *                   example: 156
 *                 page:
 *                   type: number
 *                   example: 1
 *                 pageSize:
 *                   type: number
 *                   example: 20
 *                 totalPages:
 *                   type: number
 *                   example: 8
 *       500:
 *         description: 服务器内部错误
 */
export const queryLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const params: LogQueryParams = {
      startTime: req.query.startTime as string,
      endTime: req.query.endTime as string,
      levels: req.query.levels ? (req.query.levels as string).split(',') as LogLevel[] : undefined,
      serviceNames: req.query.services ? (req.query.services as string).split(',') : undefined,
      keyword: req.query.keyword as string,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20
    };

    const result = await logService.queryLogs(params);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
};

/**
 * @swagger
 * /logs/aggregate:
 *   get:
 *     summary: 聚合统计日志
 *     tags: [Logs]
 *     description: 按时间粒度聚合统计各级别日志数量，支持按服务维度统计
 *     parameters:
 *       - in: query
 *         name: startTime
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *         description: 开始时间（ISO 格式）
 *         example: "2024-01-15T00:00:00.000Z"
 *       - in: query
 *         name: endTime
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *         description: 结束时间（ISO 格式）
 *         example: "2024-01-15T23:59:59.000Z"
 *       - in: query
 *         name: granularity
 *         schema:
 *           type: string
 *           enum: [1min, 5min, 1h, 1d]
 *           default: 1h
 *         description: 时间粒度
 *       - in: query
 *         name: services
 *         schema:
 *           type: string
 *         description: 服务名称（逗号分隔，不填则统计所有服务）
 *         example: "user-service,payment-service"
 *     responses:
 *       200:
 *         description: 聚合成功
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
 *                         example: "2024-01-15T10:00:00.000Z"
 *                       serviceName:
 *                         type: string
 *                         example: "user-service"
 *                       level:
 *                         $ref: '#/components/schemas/LogLevel'
 *                       count:
 *                         type: number
 *                         example: 156
 *       400:
 *         description: 缺少必填参数
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "startTime and endTime are required"
 *       500:
 *         description: 服务器内部错误
 */
export const aggregateLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startTime, endTime } = req.query;
    
    if (!startTime || !endTime) {
      res.status(400).json({ success: false, error: 'startTime and endTime are required' });
      return;
    }

    const params: LogAggregationParams = {
      startTime: startTime as string,
      endTime: endTime as string,
      granularity: (req.query.granularity as '1min' | '5min' | '1h' | '1d') || '1h',
      serviceNames: req.query.services ? (req.query.services as string).split(',') : undefined
    };

    const result = await logService.aggregateLogs(params);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
};

/**
 * @swagger
 * /logs/export:
 *   get:
 *     summary: 导出日志
 *     tags: [Logs]
 *     description: 导出查询结果为 JSON 文件下载
 *     parameters:
 *       - in: query
 *         name: startTime
 *         schema:
 *           type: string
 *           format: date-time
 *         description: 开始时间
 *       - in: query
 *         name: endTime
 *         schema:
 *           type: string
 *           format: date-time
 *         description: 结束时间
 *       - in: query
 *         name: levels
 *         schema:
 *           type: string
 *         description: 日志级别（逗号分隔）
 *       - in: query
 *         name: services
 *         schema:
 *           type: string
 *         description: 服务名称（逗号分隔）
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: 关键词搜索
 *     responses:
 *       200:
 *         description: 导出成功，返回 JSON 文件
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       500:
 *         description: 服务器内部错误
 */
export const exportLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const params: LogQueryParams = {
      startTime: req.query.startTime as string,
      endTime: req.query.endTime as string,
      levels: req.query.levels ? (req.query.levels as string).split(',') as LogLevel[] : undefined,
      serviceNames: req.query.services ? (req.query.services as string).split(',') : undefined,
      keyword: req.query.keyword as string,
      page: 1,
      pageSize: 10000
    };

    const result = await logService.queryLogs(params);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=logs_${Date.now()}.json`);
    res.json(result.data);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
};
