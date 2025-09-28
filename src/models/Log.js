const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  level: {
    type: String,
    enum: ['error', 'warn', 'info', 'debug', 'verbose'],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['email', 'campaign', 'system', 'auth', 'api', 'database', 'scheduler'],
    default: 'system'
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  userId: {
    type: String,
    default: null,
    index: true
  },
  sessionId: {
    type: String,
    default: null
  },
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },
  requestId: {
    type: String,
    default: null
  },
  campaignId: {
    type: String,
    default: null
  },
  emailId: {
    type: String,
    default: null
  },
  error: {
    name: String,
    message: String,
    stack: String,
    code: String
  },
  duration: {
    type: Number,
    default: null // For performance monitoring
  },
  memoryUsage: {
    rss: Number,
    heapTotal: Number,
    heapUsed: Number,
    external: Number
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Compound indexes for efficient queries
logSchema.index({ level: 1, category: 1, timestamp: -1 });
logSchema.index({ category: 1, timestamp: -1 });
logSchema.index({ campaignId: 1, timestamp: -1 });
logSchema.index({ requestId: 1 });

// TTL index to automatically delete logs after 90 days
logSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Instance methods
logSchema.methods.toLogFormat = function() {
  const timestamp = this.timestamp.toISOString();
  const level = this.level.toUpperCase().padEnd(5);
  const category = this.category.toUpperCase().padEnd(8);

  let logLine = `[${timestamp}] ${level} ${category} ${this.message}`;

  if (this.campaignId) {
    logLine += ` [Campaign: ${this.campaignId}]`;
  }

  if (this.requestId) {
    logLine += ` [Request: ${this.requestId}]`;
  }

  if (this.error && this.error.message) {
    logLine += ` Error: ${this.error.message}`;
  }

  return logLine;
};

// Static methods
logSchema.statics.logError = function(message, data = {}, category = 'system') {
  return this.create({
    level: 'error',
    message,
    category,
    data,
    error: data.error || null,
    timestamp: new Date()
  });
};

logSchema.statics.logWarn = function(message, data = {}, category = 'system') {
  return this.create({
    level: 'warn',
    message,
    category,
    data,
    timestamp: new Date()
  });
};

logSchema.statics.logInfo = function(message, data = {}, category = 'system') {
  return this.create({
    level: 'info',
    message,
    category,
    data,
    timestamp: new Date()
  });
};

logSchema.statics.logDebug = function(message, data = {}, category = 'system') {
  return this.create({
    level: 'debug',
    message,
    category,
    data,
    timestamp: new Date()
  });
};

logSchema.statics.logEmailEvent = function(campaignId, email, event, data = {}) {
  return this.create({
    level: 'info',
    category: 'email',
    message: `Email ${event}: ${email}`,
    campaignId,
    data: { email, event, ...data },
    timestamp: new Date()
  });
};

logSchema.statics.logCampaignEvent = function(campaignId, event, data = {}) {
  return this.create({
    level: 'info',
    category: 'campaign',
    message: `Campaign ${event}`,
    campaignId,
    data,
    timestamp: new Date()
  });
};

logSchema.statics.logApiRequest = function(method, url, statusCode, duration, data = {}) {
  const level = statusCode >= 400 ? 'warn' : 'info';

  return this.create({
    level,
    category: 'api',
    message: `${method} ${url} - ${statusCode}`,
    data: { method, url, statusCode, duration, ...data },
    duration,
    timestamp: new Date()
  });
};

logSchema.statics.getLogsByLevel = function(level, limit = 100) {
  return this.find({ level })
    .sort({ timestamp: -1 })
    .limit(limit);
};

logSchema.statics.getLogsByCategory = function(category, limit = 100) {
  return this.find({ category })
    .sort({ timestamp: -1 })
    .limit(limit);
};

logSchema.statics.getLogsByCampaign = function(campaignId, limit = 100) {
  return this.find({ campaignId })
    .sort({ timestamp: -1 })
    .limit(limit);
};

logSchema.statics.getRecentLogs = function(limit = 100) {
  return this.find({})
    .sort({ timestamp: -1 })
    .limit(limit);
};

logSchema.statics.getErrorLogs = function(limit = 100) {
  return this.find({ level: 'error' })
    .sort({ timestamp: -1 })
    .limit(limit);
};

logSchema.statics.getLogsByDateRange = function(startDate, endDate, category = null) {
  const query = {
    timestamp: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  };

  if (category) {
    query.category = category;
  }

  return this.find(query).sort({ timestamp: -1 });
};

logSchema.statics.getLogStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: {
          level: '$level',
          category: '$category'
        },
        count: { $sum: 1 },
        lastOccurrence: { $max: '$timestamp' }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
};

logSchema.statics.cleanupOldLogs = function(daysOld = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  return this.deleteMany({
    timestamp: { $lt: cutoffDate }
  });
};

const Log = mongoose.model('Log', logSchema);

module.exports = Log;