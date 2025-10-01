const { Server } = require('socket.io');

class SocketHandler {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: [
          process.env.CLIENT_URL,
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:5173',
          'http://localhost:5174',
          'https://hr-emailer-client.vercel.app'
        ].filter(Boolean),
        credentials: true,
        methods: ['GET', 'POST']
      }
    });

    this.connectedClients = new Map();
    this.setupSocketListeners();
  }

  setupSocketListeners() {
    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);

      // Store client connection
      this.connectedClients.set(socket.id, {
        socket,
        connectedAt: new Date()
      });

      // Handle client disconnection
      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        this.connectedClients.delete(socket.id);
      });

      // Handle client requests for log history
      socket.on('get-log-history', async (options = {}) => {
        try {
          const logger = require('./logger');
          const result = await logger.queryLogs(options);
          socket.emit('log-history', result);
        } catch (error) {
          socket.emit('error', { message: 'Failed to fetch log history' });
        }
      });

      // Handle client requests for log stats
      socket.on('get-log-stats', async () => {
        try {
          const logger = require('./logger');
          const stats = await logger.getLogStats();
          socket.emit('log-stats', stats);
        } catch (error) {
          socket.emit('error', { message: 'Failed to fetch log stats' });
        }
      });
    });
  }

  // Emit general notification to all connected clients
  emitGeneralNotification(event, data) {
    this.io.emit(event, data);
  }

  // Emit campaign-specific events
  emitCampaignProgress(campaignId, data) {
    this.io.emit('campaign-progress', { campaignId, ...data });
  }

  emitCampaignStarted(campaignId, data) {
    this.io.emit('campaign-started', { campaignId, ...data });
  }

  emitCampaignComplete(campaignId, data) {
    this.io.emit('campaign-complete', { campaignId, ...data });
  }

  emitEmailSent(campaignId, data) {
    this.io.emit('email-sent', { campaignId, ...data });
  }

  emitEmailError(campaignId, data) {
    this.io.emit('email-error', { campaignId, ...data });
  }

  // Cleanup completed campaigns from client tracking
  cleanupCompletedCampaigns() {
    // This could be used to clean up any campaign-specific data
    // For now, just emit a cleanup event
    this.io.emit('cleanup-completed-campaigns');
  }

  // Get connection statistics
  getConnectionStats() {
    return {
      totalConnections: this.connectedClients.size,
      connections: Array.from(this.connectedClients.entries()).map(([id, data]) => ({
        id,
        connectedAt: data.connectedAt
      }))
    };
  }

  // Close all connections (for graceful shutdown)
  closeConnections() {
    return new Promise((resolve) => {
      this.io.close(() => {
        console.log('Socket.IO server closed');
        resolve();
      });
    });
  }
}

module.exports = SocketHandler;