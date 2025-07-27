const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// Import middleware
const { errorHandler, notFoundHandler, requestLogger } = require('./middleware/errorHandler');
const { cleanupOldFiles } = require('./middleware/uploadMiddleware');

// Import routes
const campaignRoutes = require('./routes/campaignRoutes');
const emailRoutes = require('./routes/emailRoutes');
const templateRoutes = require('./routes/templateRoutes');
const testRoutes = require('./routes/testRoutes');

// Import services and handlers
const EmailSocketHandler = require('./sockets/emailSocket');
const SchedulerService = require('./services/schedulerService');
const logger = require('./utils/logger');

class App {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    
    // Allow multiple origins for Socket.IO
    const allowedOrigins = [
      process.env.CLIENT_URL,
      'http://localhost:3000',
      'http://localhost:3001',
      'https://hr-emailer-client.vercel.app'
    ].filter(Boolean);
    
    this.io = socketIo(this.server, {
      cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true
      }
    });
    
    this.emailSocketHandler = null;
    this.schedulerService = null;
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
    this.setupServices();
    this.setupErrorHandling();
    
    logger.info('Application initialized');
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: false, // Allow for development
      crossOriginEmbedderPolicy: false
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: {
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.'
      },
      standardHeaders: true,
      legacyHeaders: false,
    });

    // Stricter rate limiting for upload endpoints
    const uploadLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10, // Limit each IP to 10 uploads per windowMs
      message: {
        error: 'Upload rate limit exceeded',
        message: 'Too many uploads. Please try again later.'
      }
    });

    // Apply rate limiting
    this.app.use('/api/', limiter);
    this.app.use('/api/campaigns', uploadLimiter);
    this.app.use('/api/send-emails', uploadLimiter);

    // CORS configuration for separate frontend/backend deployments
    const allowedOrigins = [
      process.env.CLIENT_URL,
      'http://localhost:3000',
      'http://localhost:3001',
      'https://hr-emailer-client.vercel.app'
    ].filter(Boolean);

    const corsOptions = {
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    };
    
    this.app.use(cors(corsOptions));

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use(requestLogger);

    // File cleanup middleware (runs periodically)
    this.app.use(cleanupOldFiles);

    // Static file serving for uploads
    this.app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
      });
    });

    // Favicon handler to prevent 404s
    this.app.get('/favicon.ico', (req, res) => {
      res.status(204).send();
    });

    // API status endpoint
    this.app.get('/api/status', (req, res) => {
      const stats = {
        server: {
          status: 'running',
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          environment: process.env.NODE_ENV || 'development'
        }
      };

      // Add socket statistics if available
      if (this.emailSocketHandler) {
        stats.sockets = this.emailSocketHandler.getStatistics();
      }

      // Add scheduler statistics if available
      if (this.schedulerService) {
        stats.scheduler = this.schedulerService.getStatistics();
      }

      res.json(stats);
    });

    logger.info('Middleware configured');
  }

  setupRoutes() {
    // API routes
    this.app.use('/api/campaigns', campaignRoutes);
    this.app.use('/api/emails', emailRoutes);
    this.app.use('/api/templates', templateRoutes);
    this.app.use('/api/test', testRoutes);
    
    // Legacy routes for backward compatibility
    this.app.use('/api/template', templateRoutes);
    
    // Import email controller for legacy route
    const EmailController = require('./controllers/emailController');
    const { legacySendEmailsUpload } = require('./middleware/uploadMiddleware');
    
    // Create controller instance
    const emailController = new EmailController();
    
    // Legacy send-emails endpoint
    this.app.post('/api/send-emails', legacySendEmailsUpload, emailController.sendEmails.bind(emailController));

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        name: 'HR Outreach Emailer API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
          campaigns: '/api/campaigns',
          emails: '/api/emails',
          templates: '/api/templates',
          health: '/health',
          status: '/api/status'
        },
        legacy: {
          'send-emails': '/api/send-emails',
          'template': '/api/template'
        }
      });
    });

    logger.info('Routes configured');
  }

  setupSocketHandlers() {
    // Initialize email socket handler
    this.emailSocketHandler = new EmailSocketHandler(this.io);
    
    // Store socket handler reference for services
    this.app.set('socketHandler', this.emailSocketHandler);
    
    logger.info('Socket handlers configured');
  }

  setupServices() {
    // Initialize scheduler service with socket handler
    this.schedulerService = new SchedulerService(this.emailSocketHandler);
    
    // Store scheduler reference for routes
    this.app.set('schedulerService', this.schedulerService);
    
    // Make scheduler globally available for campaign completion
    global.schedulerService = this.schedulerService;
    
    // Configure logger to emit logs to socket
    logger.setSocketHandler(this.emailSocketHandler);
    
    logger.info('Services configured');
  }

  setupErrorHandling() {
    // 404 handler (must be after all routes)
    this.app.use(notFoundHandler);

    // Global error handler (must be last)
    this.app.use(errorHandler);

    // Process error handlers
    process.on('uncaughtException', (error) => {
      logger.error(`Uncaught Exception: ${error.message}`);
      logger.error(error.stack);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
    });

    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      this.shutdown();
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      this.shutdown();
    });

    logger.info('Error handling configured');
  }

  // Start the scheduler service
  startScheduler() {
    if (this.schedulerService) {
      this.schedulerService.start();
      logger.info('Scheduler service started');
    }
  }

  // Stop the scheduler service
  stopScheduler() {
    if (this.schedulerService) {
      this.schedulerService.stop();
      logger.info('Scheduler service stopped');
    }
  }

  // Graceful shutdown
  async shutdown() {
    try {
      logger.info('Starting graceful shutdown...');

      // Stop scheduler
      this.stopScheduler();

      // Close socket connections
      if (this.io) {
        this.io.close();
        logger.info('Socket.IO server closed');
      }

      // Close HTTP server
      if (this.server) {
        this.server.close(() => {
          logger.info('HTTP server closed');
          process.exit(0);
        });

        // Force close after 10 seconds
        setTimeout(() => {
          logger.error('Forced shutdown after timeout');
          process.exit(1);
        }, 10000);
      }
    } catch (error) {
      logger.error(`Error during shutdown: ${error.message}`);
      process.exit(1);
    }
  }

  // Close all connections gracefully
  closeConnections() {
    if (this.emailSocketHandler) {
      this.emailSocketHandler.closeAllConnections();
    }
    
    if (this.io) {
      this.io.close();
    }
  }

  // Get Express app instance
  getApp() {
    return this.app;
  }

  // Get HTTP server instance
  getServer() {
    return this.server;
  }

  // Get Socket.IO instance
  getSocketIO() {
    return this.io;
  }

  // Get email socket handler
  getEmailSocketHandler() {
    return this.emailSocketHandler;
  }

  // Get scheduler service
  getSchedulerService() {
    return this.schedulerService;
  }
}

module.exports = App;
