const logger = require('../utils/logger');

class EmailSocketHandler {
  constructor(io) {
    this.io = io;
    this.connectedClients = new Map();
    this.campaignProgress = new Map();
    this.maxClientHistory = 1000; // Limit client history to prevent memory leaks
    this.maxProgressHistory = 100; // Limit progress history
    
    this.setupEventHandlers();
    this.setupCleanupInterval();
    logger.info('Email socket handler initialized');
  }

  // Setup periodic cleanup to prevent memory leaks
  setupCleanupInterval() {
    setInterval(() => {
      this.cleanupStaleConnections();
      this.cleanupOldProgress();
    }, 5 * 60 * 1000); // Cleanup every 5 minutes
  }

  // Clean up stale connections
  cleanupStaleConnections() {
    const now = Date.now();
    const staleThreshold = 30 * 60 * 1000; // 30 minutes
    
    for (const [socketId, client] of this.connectedClients.entries()) {
      if (now - client.connectedAt.getTime() > staleThreshold) {
        // Check if socket is still connected
        if (!client.socket.connected) {
          this.connectedClients.delete(socketId);
          logger.debug(`Cleaned up stale connection: ${socketId}`);
        }
      }
    }

    // Limit total client history
    if (this.connectedClients.size > this.maxClientHistory) {
      const sortedClients = Array.from(this.connectedClients.entries())
        .sort((a, b) => a[1].connectedAt - b[1].connectedAt);
      
      const toRemove = sortedClients.slice(0, this.connectedClients.size - this.maxClientHistory);
      toRemove.forEach(([socketId]) => {
        this.connectedClients.delete(socketId);
      });
    }
  }

  // Clean up old progress data
  cleanupOldProgress() {
    if (this.campaignProgress.size > this.maxProgressHistory) {
      const sortedProgress = Array.from(this.campaignProgress.entries())
        .sort((a, b) => new Date(a[1].timestamp) - new Date(b[1].timestamp));
      
      const toRemove = sortedProgress.slice(0, this.campaignProgress.size - this.maxProgressHistory);
      toRemove.forEach(([campaignId]) => {
        this.campaignProgress.delete(campaignId);
      });
    }
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      logger.info(`Client connected: ${socket.id}`);
      this.connectedClients.set(socket.id, {
        socket,
        connectedAt: new Date(),
        subscribedCampaigns: new Set()
      });

      // Handle campaign subscription
      socket.on('subscribe-campaign', (campaignId) => {
        try {
          const client = this.connectedClients.get(socket.id);
          if (client) {
            client.subscribedCampaigns.add(campaignId);
            socket.join(`campaign-${campaignId}`);
            logger.info(`Client ${socket.id} subscribed to campaign ${campaignId}`);
            
            // Send current progress if available
            const progress = this.campaignProgress.get(campaignId);
            if (progress) {
              socket.emit('campaign-progress', progress);
            }
          }
        } catch (error) {
          logger.error(`Error subscribing to campaign: ${error.message}`);
          socket.emit('error', { message: 'Failed to subscribe to campaign' });
        }
      });

      // Handle campaign unsubscription
      socket.on('unsubscribe-campaign', (campaignId) => {
        try {
          const client = this.connectedClients.get(socket.id);
          if (client) {
            client.subscribedCampaigns.delete(campaignId);
            socket.leave(`campaign-${campaignId}`);
            logger.info(`Client ${socket.id} unsubscribed from campaign ${campaignId}`);
          }
        } catch (error) {
          logger.error(`Error unsubscribing from campaign: ${error.message}`);
          socket.emit('error', { message: 'Failed to unsubscribe from campaign' });
        }
      });

      // Handle request for campaign status
      socket.on('get-campaign-status', (campaignId) => {
        try {
          const progress = this.campaignProgress.get(campaignId);
          if (progress) {
            socket.emit('campaign-status', progress);
          } else {
            socket.emit('campaign-status', {
              campaignId,
              status: 'not_found',
              message: 'Campaign not found or not started'
            });
          }
        } catch (error) {
          logger.error(`Error getting campaign status: ${error.message}`);
          socket.emit('error', { message: 'Failed to get campaign status' });
        }
      });

      // Handle disconnect
      socket.on('disconnect', (reason) => {
        logger.info(`Client disconnected: ${socket.id} (${reason})`);
        
        // Clean up client data
        const client = this.connectedClients.get(socket.id);
        if (client) {
          // Leave all subscribed campaign rooms
          client.subscribedCampaigns.forEach(campaignId => {
            socket.leave(`campaign-${campaignId}`);
          });
        }
        
        this.connectedClients.delete(socket.id);
      });

      // Handle errors
      socket.on('error', (error) => {
        logger.error(`Socket error for ${socket.id}: ${error.message}`);
        this.connectedClients.delete(socket.id);
      });

      // Send initial connection confirmation
      socket.emit('connected', {
        id: socket.id,
        timestamp: new Date(),
        message: 'Connected to HR Emailer'
      });
    });
  }

  // Emit campaign progress update
  emitCampaignProgress(campaignId, progressData) {
    try {
      const progress = {
        campaignId,
        timestamp: new Date(),
        ...progressData
      };

      // Store progress for new subscribers
      this.campaignProgress.set(campaignId, progress);

      // Emit to all subscribers of this campaign
      this.io.to(`campaign-${campaignId}`).emit('campaign-progress', progress);
      
      logger.info(`Emitted progress for campaign ${campaignId}: ${progressData.sent}/${progressData.total}`);
    } catch (error) {
      logger.error(`Error emitting campaign progress: ${error.message}`);
    }
  }

  // Emit email sent notification
  emitEmailSent(campaignId, emailData) {
    try {
      const notification = {
        campaignId,
        timestamp: new Date(),
        type: 'email-sent',
        data: emailData
      };

      this.io.to(`campaign-${campaignId}`).emit('email-sent', notification);
      logger.info(`Emitted email sent notification for campaign ${campaignId}`);
    } catch (error) {
      logger.error(`Error emitting email sent notification: ${error.message}`);
    }
  }

  // Emit email error notification
  emitEmailError(campaignId, errorData) {
    try {
      const notification = {
        campaignId,
        timestamp: new Date(),
        type: 'email-error',
        data: errorData
      };

      this.io.to(`campaign-${campaignId}`).emit('email-error', notification);
      logger.error(`Emitted email error notification for campaign ${campaignId}: ${errorData.message}`);
    } catch (error) {
      logger.error(`Error emitting email error notification: ${error.message}`);
    }
  }

  // Emit campaign completion notification
  emitCampaignComplete(campaignId, completionData) {
    try {
      const notification = {
        campaignId,
        timestamp: new Date(),
        type: 'campaign-complete',
        data: completionData
      };

      this.io.to(`campaign-${campaignId}`).emit('campaign-complete', notification);
      
      // Remove progress data for completed campaign
      this.campaignProgress.delete(campaignId);
      
      logger.info(`Emitted campaign completion notification for campaign ${campaignId}`);
    } catch (error) {
      logger.error(`Error emitting campaign completion notification: ${error.message}`);
    }
  }

  // Emit general notification to all clients
  emitGeneralNotification(type, data) {
    try {
      const notification = {
        timestamp: new Date(),
        type,
        ...data  // Spread the data instead of nesting it
      };

      // For serverLog events, emit directly as serverLog
      if (type === 'serverLog') {
        this.io.emit('serverLog', notification);
      } else {
        this.io.emit('notification', notification);
      }
      
      logger.info(`Emitted general notification: ${type}`);
    } catch (error) {
      logger.error(`Error emitting general notification: ${error.message}`);
    }
  }

  // Close all connections gracefully
  closeAllConnections() {
    try {
      logger.info('Closing all socket connections...');
      
      // Notify all clients about server shutdown
      this.io.emit('server-shutdown', {
        message: 'Server is shutting down',
        timestamp: new Date()
      });

      // Disconnect all clients
      this.connectedClients.forEach((client, socketId) => {
        try {
          client.socket.disconnect(true);
        } catch (error) {
          logger.error(`Error disconnecting client ${socketId}: ${error.message}`);
        }
      });

      // Clear all data
      this.connectedClients.clear();
      this.campaignProgress.clear();
      
      logger.info('All socket connections closed');
    } catch (error) {
      logger.error(`Error closing socket connections: ${error.message}`);
    }
  }

  // Get connected clients count
  getConnectedClientsCount() {
    return this.connectedClients.size;
  }

  // Get active campaigns count
  getActiveCampaignsCount() {
    return this.campaignProgress.size;
  }

  // Get statistics
  getStatistics() {
    const stats = {
      connectedClients: this.getConnectedClientsCount(),
      activeCampaigns: this.getActiveCampaignsCount(),
      totalSubscriptions: 0
    };

    // Count total subscriptions
    this.connectedClients.forEach(client => {
      stats.totalSubscriptions += client.subscribedCampaigns.size;
    });

    return stats;
  }

  // Cleanup completed campaigns
  cleanupCompletedCampaigns() {
    try {
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      this.campaignProgress.forEach((progress, campaignId) => {
        if (progress.status === 'completed' && 
            now - new Date(progress.timestamp).getTime() > maxAge) {
          this.campaignProgress.delete(campaignId);
          logger.info(`Cleaned up completed campaign progress: ${campaignId}`);
        }
      });
    } catch (error) {
      logger.error(`Error cleaning up completed campaigns: ${error.message}`);
    }
  }
}

module.exports = EmailSocketHandler;
