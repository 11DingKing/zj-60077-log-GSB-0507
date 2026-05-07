import { Request, Response } from 'express';
import archiveService from '../services/archiveService';

/**
 * @swagger
 * tags:
 *   name: Archive
 *   description: 日志归档 API - 手动归档、统计和查询归档日志
 */

/**
 * @swagger
 * /archive/trigger:
 *   post:
 *     summary: 手动触发日志归档
 *     tags: [Archive]
 *     description: 手动触发全量日志归档，超过配置保留天数的日志将被归档到归档表
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customRetentionDays:
 *                 type: integer
 *                 description: 自定义保留天数（可选，不填则使用默认配置）
 *                 example: 30
 *     responses:
 *       200:
 *         description: 归档任务执行完成
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
 *                   example: "Archive completed successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     archivedCount:
 *                       type: number
 *                       example: 1567
 *                     deletedCount:
 *                       type: number
 *                       example: 1567
 *                     error:
 *                       type: string
 *                       nullable: true
 *       500:
 *         description: 服务器内部错误
 */
export const triggerArchive = async (req: Request, res: Response): Promise<void> => {
  try {
    const { customRetentionDays } = req.body;
    
    const result = await archiveService.archiveOldLogs(
      customRetentionDays ? parseInt(customRetentionDays, 10) : undefined
    );

    res.json({
      success: true,
      message: result.error 
        ? `Archive completed with errors: ${result.error}` 
        : `Archive completed successfully`,
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
};

/**
 * @swagger
 * /archive/trigger/service/{serviceId}:
 *   post:
 *     summary: 按服务触发日志归档
 *     tags: [Archive]
 *     description: 手动触发指定服务的日志归档
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 服务 ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customRetentionDays:
 *                 type: integer
 *                 description: 自定义保留天数（可选）
 *                 example: 30
 *     responses:
 *       200:
 *         description: 归档任务执行完成
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
 *                   example: "Archive completed successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     archivedCount:
 *                       type: number
 *                       example: 567
 *                     deletedCount:
 *                       type: number
 *                       example: 567
 *                     error:
 *                       type: string
 *                       nullable: true
 *       500:
 *         description: 服务器内部错误
 */
export const triggerArchiveByService = async (req: Request, res: Response): Promise<void> => {
  try {
    const { serviceId } = req.params;
    const { customRetentionDays } = req.body;

    const result = await archiveService.archiveLogsByService(
      serviceId,
      customRetentionDays ? parseInt(customRetentionDays, 10) : undefined
    );

    res.json({
      success: true,
      message: result.error 
        ? `Archive completed with errors: ${result.error}` 
        : `Archive completed successfully`,
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
};

/**
 * @swagger
 * /archive/stats:
 *   get:
 *     summary: 获取归档统计
 *     tags: [Archive]
 *     description: 获取日志归档统计信息，包括归档日志数量、活跃日志数量等
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
 *                     totalArchivedLogs:
 *                       type: number
 *                       example: 50000
 *                     totalActiveLogs:
 *                       type: number
 *                       example: 15000
 *                     oldestArchiveDate:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                     newestArchiveDate:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *       500:
 *         description: 服务器内部错误
 */
export const getArchiveStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await archiveService.getArchiveStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
};

/**
 * @swagger
 * /archive/query:
 *   get:
 *     summary: 查询归档日志
 *     tags: [Archive]
 *     description: 查询已归档的日志记录
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
 *         name: services
 *         schema:
 *           type: string
 *         description: 服务名称（逗号分隔）
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
 *                       originalId:
 *                         type: string
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
 *                       archivedAt:
 *                         type: string
 *                         format: date-time
 *                 total:
 *                   type: number
 *                   example: 5000
 *                 page:
 *                   type: number
 *                   example: 1
 *                 pageSize:
 *                   type: number
 *                   example: 20
 *                 totalPages:
 *                   type: number
 *                   example: 250
 *       500:
 *         description: 服务器内部错误
 */
export const queryArchivedLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startTime, endTime, services, page, pageSize } = req.query;

    const result = await archiveService.queryArchivedLogs(
      startTime as string,
      endTime as string,
      services ? (services as string).split(',') : undefined,
      page ? parseInt(page as string, 10) : 1,
      pageSize ? parseInt(pageSize as string, 10) : 20
    );

    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
};
