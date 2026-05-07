import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { parse } from 'url';
import redis, { LOG_STREAM_CHANNEL } from '../lib/redis';

interface Subscription {
  services: string[] | null;
  levels: string[] | null;
}

interface ConnectedClient {
  ws: WebSocket;
  subscription: Subscription;
  id: string;
}

export class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ConnectedClient> = new Map();
  private redisSubscriber: ReturnType<typeof redis.duplicate> | null = null;
  private clientIdCounter: number = 0;

  init(server: any): void {
    this.wss = new WebSocketServer({ server, path: '/api/ws' });
    
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });

    this.initRedisSubscriber();
    console.log('WebSocket server initialized');
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const clientId = `client_${++this.clientIdCounter}`;
    const queryParams = parse(req.url || '', true).query;

    const subscription: Subscription = {
      services: queryParams.services 
        ? (queryParams.services as string).split(',') 
        : null,
      levels: queryParams.levels 
        ? (queryParams.levels as string).split(',').map(l => l.toUpperCase()) 
        : null
    };

    const client: ConnectedClient = {
      ws,
      subscription,
      id: clientId
    };

    this.clients.set(clientId, client);
    console.log(`WebSocket client connected: ${clientId}`);

    ws.on('message', (message: string) => {
      this.handleClientMessage(clientId, message);
    });

    ws.on('close', () => {
      this.handleClientDisconnect(clientId);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      this.handleClientDisconnect(clientId);
    });

    this.sendToClient(client, {
      type: 'connected',
      message: 'Connected to log stream',
      subscription
    });
  }

  private handleClientMessage(clientId: string, message: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const data = JSON.parse(message);
      
      if (data.type === 'subscribe') {
        client.subscription = {
          services: data.services || null,
          levels: data.levels ? data.levels.map((l: string) => l.toUpperCase()) : null
        };
        this.sendToClient(client, {
          type: 'subscribed',
          subscription: client.subscription
        });
      } else if (data.type === 'unsubscribe') {
        client.subscription = { services: null, levels: null };
        this.sendToClient(client, {
          type: 'unsubscribed'
        });
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  private handleClientDisconnect(clientId: string): void {
    this.clients.delete(clientId);
    console.log(`WebSocket client disconnected: ${clientId}`);
  }

  private initRedisSubscriber(): void {
    this.redisSubscriber = redis.duplicate();
    
    this.redisSubscriber.subscribe(LOG_STREAM_CHANNEL, (err, count) => {
      if (err) {
        console.error('Failed to subscribe to Redis channel:', err);
        return;
      }
      console.log(`Subscribed to ${count} Redis channel(s)`);
    });

    this.redisSubscriber.on('message', (channel, message) => {
      if (channel === LOG_STREAM_CHANNEL) {
        this.broadcastLog(message);
      }
    });
  }

  private broadcastLog(logMessage: string): void {
    let logData: any;
    try {
      logData = JSON.parse(logMessage);
    } catch (error) {
      console.error('Error parsing log message:', error);
      return;
    }

    const messageToSend = JSON.stringify({
      type: 'log',
      data: logData
    });

    this.clients.forEach((client) => {
      if (this.shouldSendToClient(client, logData)) {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(messageToSend);
        }
      }
    });
  }

  private shouldSendToClient(client: ConnectedClient, logData: any): boolean {
    const { subscription } = client;

    if (subscription.services && subscription.services.length > 0) {
      if (!subscription.services.includes(logData.service)) {
        return false;
      }
    }

    if (subscription.levels && subscription.levels.length > 0) {
      if (!subscription.levels.includes(logData.level)) {
        return false;
      }
    }

    return true;
  }

  private sendToClient(client: ConnectedClient, data: any): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(data));
    }
  }

  getConnectedClients(): number {
    return this.clients.size;
  }

  stop(): void {
    if (this.redisSubscriber) {
      this.redisSubscriber.unsubscribe(LOG_STREAM_CHANNEL);
      this.redisSubscriber.disconnect();
    }
    
    if (this.wss) {
      this.wss.close();
    }
    
    this.clients.clear();
    console.log('WebSocket server stopped');
  }
}

export const websocketService = new WebSocketService();
export default websocketService;
