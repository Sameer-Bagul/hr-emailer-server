const mongoose = require('mongoose');

class MongoDBConnection {
  constructor() {
    this.isConnected = false;
    this.connection = null;
  }

  async connect() {
    try {
      const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hr-emailer';

      console.log('🔄 Connecting to MongoDB...');

      // Connection options with shorter timeout for faster fallback
      const options = {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 3000, // Reduced timeout for faster fallback
        socketTimeoutMS: 45000,
        family: 4
      };

      // Set mongoose options separately to avoid deprecated warnings
      mongoose.set('bufferCommands', false);

      this.connection = await mongoose.connect(mongoURI, options);

      this.isConnected = true;
      console.log('✅ MongoDB connected successfully');

      // Handle connection events
      mongoose.connection.on('error', (err) => {
        console.error('❌ MongoDB connection error:', err);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('⚠️ MongoDB disconnected');
        this.isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        console.log('🔄 MongoDB reconnected');
        this.isConnected = true;
      });

      return this.connection;
    } catch (error) {
      console.warn('⚠️ MongoDB connection failed, falling back to JSON file storage:', error.message);
      console.log('ℹ️ Application will continue with JSON file storage for data persistence');
      this.isConnected = false;

      // Ensure mongoose doesn't try to buffer operations
      mongoose.set('bufferCommands', false);

      return null;
    }
  }

  async disconnect() {
    try {
      if (this.connection) {
        await mongoose.disconnect();
        this.isConnected = false;
        console.log('✅ MongoDB disconnected successfully');
      }
    } catch (error) {
      console.error('❌ Error disconnecting from MongoDB:', error);
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
      console.error('❌ Error getting MongoDB stats:', error);
      return null;
    }
  }
}

// Create singleton instance
const mongoConnection = new MongoDBConnection();

module.exports = mongoConnection;