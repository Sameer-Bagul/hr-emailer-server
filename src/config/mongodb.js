const mongoose = require('mongoose');
const logger = require('../utils/logger');

class MongoDBConnection {
  constructor() {
    this.isConnected = false;
    this.connection = null;
  }

  async connect() {
    try {
      const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hr-emailer';

      logger.info('🔄 Connecting to MongoDB...');

      // Connection options with shorter timeout for faster fallback
      const options = {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 3000, // Reduced timeout for faster fallback
        socketTimeoutMS: 45000,
        family: 4,
        bufferCommands: false, // Disable mongoose buffering when disconnected
        bufferMaxEntries: 0
      };

      this.connection = await mongoose.connect(mongoURI, options);

      this.isConnected = true;
      logger.info('✅ MongoDB connected successfully');

      // Handle connection events
      mongoose.connection.on('error', (err) => {
        logger.error('❌ MongoDB connection error:', err);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('⚠️ MongoDB disconnected');
        this.isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('🔄 MongoDB reconnected');
        this.isConnected = true;
      });

      return this.connection;
    } catch (error) {
      logger.warn('⚠️ MongoDB connection failed, falling back to JSON file storage:', error.message);
      logger.info('ℹ️ Application will continue with JSON file storage for data persistence');
      this.isConnected = false;

      // Ensure mongoose doesn't try to buffer operations
      mongoose.set('bufferCommands', false);
      mongoose.set('bufferMaxEntries', 0);

      return null;
    }
  }

  async disconnect() {
    try {
      if (this.connection) {
        await mongoose.disconnect();
        this.isConnected = false;
        logger.info('✅ MongoDB disconnected successfully');
      }
    } catch (error) {
      logger.error('❌ Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  getConnection() {
    return this.connection;
  }

  isHealthy() {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  // Get database stats
  async getStats() {
    try {
      const db = mongoose.connection.db;
      const stats = await db.stats();
      return {
        db: stats.db,
        collections: stats.collections,
        objects: stats.objects,
        avgObjSize: stats.avgObjSize,
        dataSize: stats.dataSize,
        storageSize: stats.storageSize,
        indexes: stats.indexes,
        indexSize: stats.indexSize,
        fileSize: stats.fileSize
      };
    } catch (error) {
      logger.error('❌ Error getting MongoDB stats:', error);
      return null;
    }
  }
}

// Create singleton instance
const mongoConnection = new MongoDBConnection();

module.exports = mongoConnection;