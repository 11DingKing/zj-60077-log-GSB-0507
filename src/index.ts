import express from 'express';
import cors from 'cors';
import http from 'http';
import swaggerUi from 'swagger-ui-express';
import config from './config';
import swaggerSpec from './config/swagger';
import logPersistenceWorker from './workers/logPersistenceWorker';
import websocketService from './services/websocketService';

import logRoutes from './routes/logRoutes';
import serviceRoutes from './routes/serviceRoutes';
import alertRoutes from './routes/alertRoutes';
import archiveRoutes from './routes/archiveRoutes';
import dashboardRoutes from './routes/dashboardRoutes';

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api/logs', logRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/archive', archiveRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = config.port;

server.listen(PORT, () => {
  console.log(`🚀 Log Collection Platform running on port ${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
  console.log(`🔗 WebSocket Endpoint: ws://localhost:${PORT}/api/ws`);
  
  logPersistenceWorker.start();
  websocketService.init(server);
  console.log('✅ All services initialized');
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  logPersistenceWorker.stop();
  websocketService.stop();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  logPersistenceWorker.stop();
  websocketService.stop();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
