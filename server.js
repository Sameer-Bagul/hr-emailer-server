require('dotenv').config();
const App = require('./src/app');
const logger = require('./src/utils/logger');
const securityCheck = require('./src/utils/securityCheck');

// Server configuration
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Run security checks before starting server
if (!securityCheck.runSecurityChecks()) {
  logger.error('❌ Security checks failed. Server will not start.');
  process.exit(1);
}

// Initialize application
const appInstance = new App();
const server = appInstance.getServer();

// Start server
async function startServer() {
  try {
    // Start HTTP server
    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT} in ${NODE_ENV} mode`);
      logger.info(`📱 Socket.IO enabled for real-time communication`);
      
      if (NODE_ENV === 'development') {
        logger.info(`📖 API Documentation: http://localhost:${PORT}/`);
        logger.info(`💻 Client URL: ${process.env.CLIENT_URL || 'http://localhost:3000'}`);
      }
    });

    // Start scheduler service
    appInstance.startScheduler();
    logger.info('📅 Scheduler service started');

    // Log startup completion
    logger.info('✅ HR Outreach Emailer server started successfully');
    
  } catch (error) {
    logger.error(`❌ Failed to start server: ${error.message}`);
    process.exit(1);
  }
}

// Handle startup errors
process.on('uncaughtException', (error) => {
  logger.error(`💥 Uncaught Exception during startup: ${error.message}`);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`💥 Unhandled Rejection during startup: ${reason}`);
  gracefulShutdown('unhandledRejection');
});

// Graceful shutdown
async function gracefulShutdown(signal) {
  logger.info(`🛑 Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Stop accepting new connections
    server.close(() => {
      logger.info('✅ HTTP server closed');
    });

    // Stop scheduler
    if (appInstance && appInstance.stopScheduler) {
      appInstance.stopScheduler();
      logger.info('✅ Scheduler stopped');
    }

    // Close email connections
    const emailConfig = require('./src/config/email');
    if (emailConfig && emailConfig.close) {
      emailConfig.close();
      logger.info('✅ Email connections closed');
    }

    // Close socket connections
    if (appInstance && appInstance.closeConnections) {
      appInstance.closeConnections();
      logger.info('✅ Socket connections closed');
    }

    logger.info('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error(`❌ Error during graceful shutdown: ${error.message}`);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start the server
startServer();
