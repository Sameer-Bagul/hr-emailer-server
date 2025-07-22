const logger = require('../utils/logger');

class EmailSocketHandler {
  constructor(io) {
    this.io = io;
    this.connectedClients = new Map();
    this.campaignProgress = new Map();
    
    this.setupEventHandlers();
    logger.info('Email socket handler initialized');
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
      socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
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
        data
      };

      this.io.emit('notification', notification);
      logger.info(`Emitted general notification: ${type}`);
    } catch (error) {
      logger.error(`Error emitting general notification: ${error.message}`);
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
