import { Request, Response } from 'express';
import { AlertStatus } from '@prisma/client';
import alertService from '../services/alertService';

/**
 * @swagger
 * tags:
 *   name: Alerts
 *   description: 告警管理 API - 告警规则配置、触发、历史管理
 */

/**
 * @swagger
 * /alerts/rules:
 *   post:
 *     summary: 创建告警规则
 *     tags: [Alerts]
 *     description: 创建新的告警规则，当某服务在 N 分钟内 ERROR 级别日志超过 M 条时触发告警
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - serviceId
 *               - name
 *             properties:
 *               serviceId:
 *                 type: string
 *                 format: uuid
 *                 description: 关联的服务 ID
 *               name:
 *                 type: string
 *                 description: 规则名称
 *               description:
 *                 type: string
 *                 description: 规则描述
 *               timeWindowMinutes:
 *                 type: integer
 *                 default: 5
 *                 description: 时间窗口（分钟）
 *               threshold:
 *                 type: integer
 *                 default: 10
 *                 description: ERROR 日志数量阈值
 *           example:
 *             serviceId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *             name: "High Error Rate Alert"
 *             description: "当5分钟内错误日志超过5条时触发告警"
 *             timeWindowMinutes: 5
 *             threshold: 5
 *     responses:
 *       201:
 *         description: 告警规则创建成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/AlertRule'
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
 *                   example: "serviceId and name are required"
 */
export const createAlertRule = async (req: Request, res: Response): Promise<void> => {
  try {
    const { serviceId, name, description, timeWindowMinutes, threshold } = req.body;

    if (!serviceId || !name) {
      res.status(400).json({ success: false, error: 'serviceId and name are required' });
      return;
    }

    const rule = await alertService.createAlertRule({
      serviceId,
      name,
      description,
      timeWindowMinutes,
      threshold
    });

    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    res.status(400).json({ success: false, error: (error as Error).message });
  }
};

/**
 * @swagger
 * /alerts/rules:
 *   get:
 *     summary: 获取所有告警规则
 *     tags: [Alerts]
 *     description: 获取所有告警规则列表
 *     parameters:
 *       - in: query
 *         name: includeDisabled
 *         schema:
 *           type: boolean
 *           default: false
 *         description: 是否包含已禁用的规则
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
 *                     $ref: '#/components/schemas/AlertRule'
 *       500:
 *         description: 服务器内部错误
 */
export const getAllAlertRules = async (req: Request, res: Response): Promise<void> => {
  try {
    const includeDisabled = req.query.includeDisabled === 'true';
    const rules = await alertService.getAllAlertRules(includeDisabled);
    res.json({ success: true, data: rules });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
};

/**
 * @swagger
 * /alerts/rules/{id}:
 *   get:
 *     summary: 根据 ID 获取告警规则
 *     tags: [Alerts]
 *     description: 根据规则 ID 获取单个告警规则详情
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 告警规则 ID
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
 *                   $ref: '#/components/schemas/AlertRule'
 *       404:
 *         description: 告警规则不存在
 *       500:
 *         description: 服务器内部错误
 */
export const getAlertRuleById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const rule = await alertService.getAlertRuleById(id);

    if (!rule) {
      res.status(404).json({ success: false, error: 'Alert rule not found' });
      return;
    }

    res.json({ success: true, data: rule });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
};

/**
 * @swagger
 * /alerts/rules/service/{serviceId}:
 *   get:
 *     summary: 获取指定服务的告警规则
 *     tags: [Alerts]
 *     description: 获取指定服务的所有告警规则
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 服务 ID
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
 *                     $ref: '#/components/schemas/AlertRule'
 *       500:
 *         description: 服务器内部错误
 */
export const getAlertRulesByService = async (req: Request, res: Response): Promise<void> => {
  try {
    const { serviceId } = req.params;
    const rules = await alertService.getAlertRulesByService(serviceId);
    res.json({ success: true, data: rules });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
};

/**
 * @swagger
 * /alerts/rules/{id}:
 *   put:
 *     summary: 更新告警规则
 *     tags: [Alerts]
 *     description: 更新告警规则的配置信息
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 告警规则 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: 规则名称
 *               description:
 *                 type: string
 *                 description: 规则描述
 *               timeWindowMinutes:
 *                 type: integer
 *                 description: 时间窗口（分钟）
 *               threshold:
 *                 type: integer
 *                 description: 阈值
 *               isEnabled:
 *                 type: boolean
 *                 description: 是否启用
 *           example:
 *             name: "Updated Alert Rule"
 *             threshold: 10
 *             isEnabled: true
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
 *                   $ref: '#/components/schemas/AlertRule'
 *       400:
 *         description: 请求参数错误
 *       500:
 *         description: 服务器内部错误
 */
export const updateAlertRule = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, timeWindowMinutes, threshold, isEnabled } = req.body;

    const updatedRule = await alertService.updateAlertRule(id, {
      name,
      description,
      timeWindowMinutes,
      threshold,
      isEnabled
    });

    res.json({ success: true, data: updatedRule });
  } catch (error) {
    res.status(400).json({ success: false, error: (error as Error).message });
  }
};

/**
 * @swagger
 * /alerts/rules/{id}:
 *   delete:
 *     summary: 删除告警规则
 *     tags: [Alerts]
 *     description: 删除指定的告警规则
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 告警规则 ID
 *     responses:
 *       200:
 *         description: 删除成功
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
 *                   example: "Alert rule deleted"
 *       400:
 *         description: 请求参数错误
 *       500:
 *         description: 服务器内部错误
 */
export const deleteAlertRule = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await alertService.deleteAlertRule(id);
    res.json({ success: true, message: 'Alert rule deleted' });
  } catch (error) {
    res.status(400).json({ success: false, error: (error as Error).message });
  }
};

/**
 * @swagger
 * /alerts/check:
 *   post:
 *     summary: 手动触发告警检查
 *     tags: [Alerts]
 *     description: 手动触发一次告警规则检查，验证是否有服务需要触发告警
 *     responses:
 *       200:
 *         description: 检查完成
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
 *                   example: "Alert check completed"
 *       500:
 *         description: 服务器内部错误
 */
export const triggerAlertCheck = async (req: Request, res: Response): Promise<void> => {
  try {
    await alertService.checkAndTriggerAlerts();
    res.json({ success: true, message: 'Alert check completed' });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
};

/**
 * @swagger
 * /alerts/history:
 *   get:
 *     summary: 查询告警历史
 *     tags: [Alerts]
 *     description: 查询告警历史记录，支持按状态和服务过滤
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, RESOLVED, ACKNOWLEDGED]
 *         description: 告警状态过滤
 *       - in: query
 *         name: serviceId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 服务 ID 过滤
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
 *                     $ref: '#/components/schemas/Alert'
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
export const getAlerts = async (req: Request, res: Response): Promise<void> => {
  try {
    const status = req.query.status as AlertStatus | undefined;
    const serviceId = req.query.serviceId as string | undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20;

    const result = await alertService.getAlerts(status, serviceId, page, pageSize);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
};

/**
 * @swagger
 * /alerts/{id}/acknowledge:
 *   post:
 *     summary: 标记告警为已确认
 *     tags: [Alerts]
 *     description: 标记指定告警为已确认状态
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 告警 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - acknowledgedBy
 *             properties:
 *               acknowledgedBy:
 *                 type: string
 *                 description: 确认人标识
 *           example:
 *             acknowledgedBy: "admin-user"
 *     responses:
 *       200:
 *         description: 确认成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Alert'
 *       400:
 *         description: 请求参数错误
 *       500:
 *         description: 服务器内部错误
 */
export const acknowledgeAlert = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { acknowledgedBy } = req.body;

    if (!acknowledgedBy) {
      res.status(400).json({ success: false, error: 'acknowledgedBy is required' });
      return;
    }

    const alert = await alertService.acknowledgeAlert(id, acknowledgedBy);
    res.json({ success: true, data: alert });
  } catch (error) {
    res.status(400).json({ success: false, error: (error as Error).message });
  }
};

/**
 * @swagger
 * /alerts/{id}/resolve:
 *   post:
 *     summary: 标记告警为已解决
 *     tags: [Alerts]
 *     description: 标记指定告警为已解决状态
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 告警 ID
 *     responses:
 *       200:
 *         description: 解决成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Alert'
 *       400:
 *         description: 请求参数错误
 *       500:
 *         description: 服务器内部错误
 */
export const resolveAlert = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const alert = await alertService.resolveAlert(id);
    res.json({ success: true, data: alert });
  } catch (error) {
    res.status(400).json({ success: false, error: (error as Error).message });
  }
};
