import { Request, Response } from 'express';
import serviceService from '../services/serviceService';

/**
 * @swagger
 * tags:
 *   name: Services
 *   description: 服务管理 API - 注册、查询、更新和删除上报日志的服务
 */

/**
 * @swagger
 * /services:
 *   post:
 *     summary: 注册新服务
 *     tags: [Services]
 *     description: 注册一个新的服务，用于接收该服务上报的日志
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: 服务名称（唯一标识）
 *                 example: "user-service"
 *               description:
 *                 type: string
 *                 description: 服务描述
 *                 example: "用户认证与管理服务"
 *               logRetentionDays:
 *                 type: integer
 *                 default: 30
 *                 description: 日志保留天数
 *                 example: 30
 *               alertContacts:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 告警联系人列表
 *                 example: ["admin@example.com", "dev@example.com"]
 *     responses:
 *       201:
 *         description: 服务注册成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Service'
 *       400:
 *         description: 请求参数错误或服务名已存在
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
 *                   example: "Service with name 'user-service' already exists"
 */
export const createService = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, logRetentionDays, alertContacts } = req.body;

    if (!name) {
      res.status(400).json({ success: false, error: 'Service name is required' });
      return;
    }

    const service = await serviceService.createService({
      name,
      description,
      logRetentionDays,
      alertContacts
    });

    res.status(201).json({ success: true, data: service });
  } catch (error) {
    res.status(400).json({ success: false, error: (error as Error).message });
  }
};

/**
 * @swagger
 * /services:
 *   get:
 *     summary: 获取所有服务
 *     tags: [Services]
 *     description: 获取所有已注册的服务列表
 *     parameters:
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *           default: false
 *         description: 是否包含已标记为不活跃的服务
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
 *                     $ref: '#/components/schemas/Service'
 *       500:
 *         description: 服务器内部错误
 */
export const getAllServices = async (req: Request, res: Response): Promise<void> => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const services = await serviceService.getAllServices(includeInactive);
    res.json({ success: true, data: services });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
};

/**
 * @swagger
 * /services/{id}:
 *   get:
 *     summary: 根据 ID 获取服务
 *     tags: [Services]
 *     description: 根据服务 ID 获取单个服务的详细信息
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 服务 ID
 *         example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
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
 *                   $ref: '#/components/schemas/Service'
 *       404:
 *         description: 服务不存在
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
 *                   example: "Service not found"
 *       500:
 *         description: 服务器内部错误
 */
export const getServiceById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const service = await serviceService.getServiceById(id);

    if (!service) {
      res.status(404).json({ success: false, error: 'Service not found' });
      return;
    }

    res.json({ success: true, data: service });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
};

/**
 * @swagger
 * /services/name/{name}:
 *   get:
 *     summary: 根据名称获取服务
 *     tags: [Services]
 *     description: 根据服务名称获取单个服务的详细信息
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: 服务名称（URL 编码）
 *         example: "user-service"
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
 *                   $ref: '#/components/schemas/Service'
 *       404:
 *         description: 服务不存在
 *       500:
 *         description: 服务器内部错误
 */
export const getServiceByName = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.params;
    const service = await serviceService.getServiceByName(decodeURIComponent(name));

    if (!service) {
      res.status(404).json({ success: false, error: 'Service not found' });
      return;
    }

    res.json({ success: true, data: service });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
};

/**
 * @swagger
 * /services/{id}:
 *   put:
 *     summary: 更新服务
 *     tags: [Services]
 *     description: 更新服务的配置信息
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 服务 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *                 description: 服务描述
 *               logRetentionDays:
 *                 type: integer
 *                 description: 日志保留天数
 *               alertContacts:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 告警联系人列表
 *               isActive:
 *                 type: boolean
 *                 description: 是否活跃
 *           example:
 *             description: "更新后的服务描述"
 *             logRetentionDays: 60
 *             alertContacts: ["new-admin@example.com"]
 *             isActive: true
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Service'
 *       400:
 *         description: 请求参数错误
 *       500:
 *         description: 服务器内部错误
 */
export const updateService = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { description, logRetentionDays, alertContacts, isActive } = req.body;

    const updatedService = await serviceService.updateService(id, {
      description,
      logRetentionDays,
      alertContacts,
      isActive
    });

    res.json({ success: true, data: updatedService });
  } catch (error) {
    res.status(400).json({ success: false, error: (error as Error).message });
  }
};

/**
 * @swagger
 * /services/{id}:
 *   delete:
 *     summary: 删除服务
 *     tags: [Services]
 *     description: 删除服务（如果有关联日志，则仅标记为不活跃）
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 服务 ID
 *     responses:
 *       200:
 *         description: 删除成功（或标记为不活跃）
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
 *                   example: "Service deleted (or marked as inactive)"
 *       400:
 *         description: 请求参数错误
 *       500:
 *         description: 服务器内部错误
 */
export const deleteService = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await serviceService.deleteService(id);
    res.json({ success: true, message: 'Service deleted (or marked as inactive)' });
  } catch (error) {
    res.status(400).json({ success: false, error: (error as Error).message });
  }
};

/**
 * @swagger
 * /services/{id}/stats:
 *   get:
 *     summary: 获取服务统计
 *     tags: [Services]
 *     description: 获取指定服务的日志统计信息
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 服务 ID
 *       - in: query
 *         name: startTime
 *         schema:
 *           type: string
 *           format: date-time
 *         description: 开始时间（默认 24 小时前）
 *       - in: query
 *         name: endTime
 *         schema:
 *           type: string
 *           format: date-time
 *         description: 结束时间（默认当前时间）
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
 *                     serviceId:
 *                       type: string
 *                       example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *                     totalLogs:
 *                       type: number
 *                       example: 1567
 *                     levelCounts:
 *                       type: object
 *                       properties:
 *                         INFO:
 *                           type: number
 *                           example: 800
 *                         WARN:
 *                           type: number
 *                           example: 400
 *                         ERROR:
 *                           type: number
 *                           example: 350
 *                         DEBUG:
 *                           type: number
 *                           example: 15
 *                         FATAL:
 *                           type: number
 *                           example: 2
 *                     timeRange:
 *                       type: object
 *                       properties:
 *                         start:
 *                           type: string
 *                           format: date-time
 *                         end:
 *                           type: string
 *                           format: date-time
 *       500:
 *         description: 服务器内部错误
 */
export const getServiceStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { startTime, endTime } = req.query;

    const start = startTime ? new Date(startTime as string) : undefined;
    const end = endTime ? new Date(endTime as string) : undefined;

    const stats = await serviceService.getServiceStats(id, start, end);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
};
