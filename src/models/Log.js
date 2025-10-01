const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class Log {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.level = data.level || 'info';
    this.message = data.message || '';
    this.category = data.category || 'system';
    this.data = data.data || {};
    this.userId = data.userId || null;
    this.sessionId = data.sessionId || null;
    this.ipAddress = data.ipAddress || null;
    this.userAgent = data.userAgent || null;
    this.requestId = data.requestId || null;
    this.campaignId = data.campaignId || null;
    this.emailId = data.emailId || null;
    this.error = data.error || null;
    this.duration = data.duration || null;
    this.memoryUsage = data.memoryUsage || null;
    this.timestamp = data.timestamp || new Date();
  }

  // File storage path
  static getStoragePath() {
    return path.join(__dirname, '../../data/logs.json');
  }

  // Load all logs from file
  static async loadAll() {
    try {
      const storagePath = this.getStoragePath();
      const data = await fs.readFile(storagePath, 'utf8');
      const logs = JSON.parse(data);
      return logs.map(log => new Log(log));
    } catch (error) {
      // If file doesn't exist, return empty array
      return [];
    }
  }

  // Save all logs to file
  static async saveAll(logs) {
    const storagePath = this.getStoragePath();
    const dir = path.dirname(storagePath);

    // Ensure directory exists
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    const data = JSON.stringify(logs.map(l => l.toJSON()), null, 2);
    await fs.writeFile(storagePath, data, 'utf8');
  }

  // Find log by ID
  static async findById(id) {
    const logs = await this.loadAll();
    return logs.find(l => l.id === id) || null;
  }

  // Save this log
  async save() {
    const logs = await Log.loadAll();
    logs.push(this);
    await Log.saveAll(logs);
    return this;
  }

  // Delete this log
  async delete() {
    const logs = await Log.loadAll();
    const filtered = logs.filter(l => l.id !== this.id);
    await Log.saveAll(filtered);
  }

  // Instance methods
  toLogFormat() {
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
  }

  // Static methods
  static async logError(message, data = {}, category = 'system') {
    const log = new Log({
      level: 'error',
      message,
      category,
      data,
      error: data.error || null,
      timestamp: new Date()
    });
    return log.save();
  }

  static async logWarn(message, data = {}, category = 'system') {
    const log = new Log({
      level: 'warn',
      message,
      category,
      data,
      timestamp: new Date()
    });
    return log.save();
  }

  static async logInfo(message, data = {}, category = 'system') {
    const log = new Log({
      level: 'info',
      message,
      category,
      data,
      timestamp: new Date()
    });
    return log.save();
  }

  static async logDebug(message, data = {}, category = 'system') {
    const log = new Log({
      level: 'debug',
      message,
      category,
      data,
      timestamp: new Date()
    });
    return log.save();
  }

  static async logEmailEvent(campaignId, email, event, data = {}) {
    const log = new Log({
      level: 'info',
      category: 'email',
      message: `Email ${event}: ${email}`,
      campaignId,
      data: { email, event, ...data },
      timestamp: new Date()
    });
    return log.save();
  }

  static async logCampaignEvent(campaignId, event, data = {}) {
    const log = new Log({
      level: 'info',
      category: 'campaign',
      message: `Campaign ${event}`,
      campaignId,
      data,
      timestamp: new Date()
    });
    return log.save();
  }

  static async logApiRequest(method, url, statusCode, duration, data = {}) {
    const level = statusCode >= 400 ? 'warn' : 'info';

    const log = new Log({
      level,
      category: 'api',
      message: `${method} ${url} - ${statusCode}`,
      data: { method, url, statusCode, duration, ...data },
      duration,
      timestamp: new Date()
    });
    return log.save();
  }

  static async getLogsByLevel(level, limit = 100) {
    const logs = await this.loadAll();
    return logs.filter(l => l.level === level)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  static async getLogsByCategory(category, limit = 100) {
    const logs = await this.loadAll();
    return logs.filter(l => l.category === category)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  static async getLogsByCampaign(campaignId, limit = 100) {
    const logs = await this.loadAll();
    return logs.filter(l => l.campaignId === campaignId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  static async getRecentLogs(limit = 100) {
    const logs = await this.loadAll();
    return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  static async getErrorLogs(limit = 100) {
    return this.getLogsByLevel('error', limit);
  }

  static async getLogsByDateRange(startDate, endDate, category = null) {
    const logs = await this.loadAll();
    let filtered = logs.filter(l => {
      const timestamp = new Date(l.timestamp);
      return timestamp >= new Date(startDate) && timestamp <= new Date(endDate);
    });

    if (category) {
      filtered = filtered.filter(l => l.category === category);
    }

    return filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  static async getLogStats() {
    const logs = await this.loadAll();

    const stats = {};
    logs.forEach(log => {
      const key = `${log.level}_${log.category}`;
      if (!stats[key]) {
        stats[key] = {
          level: log.level,
          category: log.category,
          count: 0,
          lastOccurrence: log.timestamp
        };
      }
      stats[key].count += 1;
      if (new Date(log.timestamp) > new Date(stats[key].lastOccurrence)) {
        stats[key].lastOccurrence = log.timestamp;
      }
    });

    return Object.values(stats).sort((a, b) => b.count - a.count);
  }

  static async cleanupOldLogs(daysOld = 90) {
    const logs = await this.loadAll();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const filtered = logs.filter(l => new Date(l.timestamp) >= cutoffDate);
    await this.saveAll(filtered);
    return logs.length - filtered.length;
  }

  toJSON() {
    return {
      id: this.id,
      level: this.level,
      message: this.message,
      category: this.category,
      data: this.data,
      userId: this.userId,
      sessionId: this.sessionId,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      requestId: this.requestId,
      campaignId: this.campaignId,
      emailId: this.emailId,
      error: this.error,
      duration: this.duration,
      memoryUsage: this.memoryUsage,
      timestamp: this.timestamp
    };
  }
}

module.exports = Log;