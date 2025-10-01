const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class FileLogger {
  constructor(options = {}) {
    this.logDir = options.logDir || path.join(__dirname, '../../logs');
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxFiles = options.maxFiles || 30; // Keep 30 days of logs
    this.ttlDays = options.ttlDays || 90; // Delete logs older than 90 days
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    this.currentLogLevel = options.logLevel || 'info';

    // Ensure log directory exists
    this.ensureLogDirectory();
  }

  async ensureLogDirectory() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  getLogFileName(date = new Date(), category = 'app') {
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    return `${category}-${dateStr}.log`;
  }

  getLogFilePath(date = new Date(), category = 'app') {
    return path.join(this.logDir, this.getLogFileName(date, category));
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.currentLogLevel];
  }

  formatLogEntry(level, message, category = 'app', data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      id: uuidv4(),
      timestamp,
      level: level.toUpperCase(),
      category,
      message: this.sanitizeMessage(message),
      data,
      pid: process.pid
    };

    return JSON.stringify(logEntry) + '\n';
  }

  sanitizeMessage(message) {
    if (typeof message !== 'string') {
      return message;
    }

    // Remove potential sensitive patterns
    const sensitivePatterns = [
      /password[^a-zA-Z0-9]*[:=][^a-zA-Z0-9]*([^\s,;]{8,})/gi,
      /token[^a-zA-Z0-9]*[:=][^a-zA-Z0-9]*([^\s,;]{20,})/gi,
      /key[^a-zA-Z0-9]*[:=][^a-zA-Z0-9]*([^\s,;]{16,})/gi,
      /secret[^a-zA-Z0-9]*[:=][^a-zA-Z0-9]*([^\s,;]{16,})/gi,
      /api_key[^a-zA-Z0-9]*[:=][^a-zA-Z0-9]*([^\s,;]{16,})/gi,
      /auth[^a-zA-Z0-9]*[:=][^a-zA-Z0-9]*([^\s,;]{16,})/gi
    ];

    let sanitized = message;
    sensitivePatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, (match, captured) => {
        return match.replace(captured, '***REDACTED***');
      });
    });

    return sanitized;
  }

  async writeLog(level, message, category = 'app', data = {}) {
    if (!this.shouldLog(level)) {
      return;
    }

    try {
      const logEntry = this.formatLogEntry(level, message, category, data);
      const logFilePath = this.getLogFilePath(new Date(), category);

      // Check if file needs rotation
      await this.checkFileRotation(logFilePath);

      await fs.appendFile(logFilePath, logEntry, 'utf8');
    } catch (error) {
      console.error('Failed to write log:', error);
    }
  }

  async checkFileRotation(filePath) {
    try {
      const stats = await fs.stat(filePath);
      if (stats.size > this.maxFileSize) {
        const backupPath = `${filePath}.${Date.now()}.bak`;
        await fs.rename(filePath, backupPath);
      }
    } catch (error) {
      // File doesn't exist yet, no rotation needed
    }
  }

  async log(level, message, category = 'app', data = {}) {
    await this.writeLog(level, message, category, data);
  }

  async error(message, category = 'app', data = {}) {
    await this.writeLog('error', message, category, data);
  }

  async warn(message, category = 'app', data = {}) {
    await this.writeLog('warn', message, category, data);
  }

  async info(message, category = 'app', data = {}) {
    await this.writeLog('info', message, category, data);
  }

  async debug(message, category = 'app', data = {}) {
    await this.writeLog('debug', message, category, data);
  }

  async campaign(message, data = {}) {
    await this.writeLog('info', message, 'campaign', data);
  }

  async email(message, data = {}) {
    await this.writeLog('info', message, 'email', data);
  }

  async file(message, data = {}) {
    await this.writeLog('info', message, 'file', data);
  }

  async query(options = {}) {
    const {
      level,
      category,
      startDate,
      endDate,
      limit = 100,
      offset = 0,
      search
    } = options;

    try {
      const logFiles = await this.getLogFiles(category, startDate, endDate);
      const results = [];

      for (const file of logFiles) {
        if (results.length >= limit + offset) break;

        try {
          const content = await fs.readFile(file, 'utf8');
          const lines = content.trim().split('\n');

          for (const line of lines) {
            if (results.length >= limit + offset) break;

            try {
              const entry = JSON.parse(line);

              // Apply filters
              if (level && entry.level.toLowerCase() !== level.toLowerCase()) continue;
              if (category && entry.category !== category) continue;
              if (search && !entry.message.toLowerCase().includes(search.toLowerCase())) continue;

              results.push(entry);
            } catch (parseError) {
              // Skip malformed lines
              continue;
            }
          }
        } catch (fileError) {
          // Skip files that can't be read
          continue;
        }
      }

      // Sort by timestamp descending and apply pagination
      results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      return {
        logs: results.slice(offset, offset + limit),
        total: results.length,
        hasMore: results.length > offset + limit
      };
    } catch (error) {
      console.error('Failed to query logs:', error);
      return { logs: [], total: 0, hasMore: false };
    }
  }

  async getLogFiles(category, startDate, endDate) {
    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = [];

      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const end = endDate ? new Date(endDate) : new Date();

      for (const file of files) {
        if (file.endsWith('.log')) {
          const fileCategory = file.split('-')[0];
          if (!category || fileCategory === category) {
            // Extract date from filename (YYYY-MM-DD)
            const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})\.log$/);
            if (dateMatch) {
              const fileDate = new Date(dateMatch[1]);
              if (fileDate >= start && fileDate <= end) {
                logFiles.push(path.join(this.logDir, file));
              }
            }
          }
        }
      }

      // Sort by date descending (newest first)
      logFiles.sort((a, b) => {
        const dateA = this.extractDateFromPath(a);
        const dateB = this.extractDateFromPath(b);
        return dateB - dateA;
      });

      return logFiles;
    } catch (error) {
      console.error('Failed to get log files:', error);
      return [];
    }
  }

  extractDateFromPath(filePath) {
    const fileName = path.basename(filePath);
    const dateMatch = fileName.match(/(\d{4}-\d{2}-\d{2})\.log$/);
    return dateMatch ? new Date(dateMatch[1]) : new Date(0);
  }

  async cleanupOldLogs() {
    try {
      const files = await fs.readdir(this.logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.ttlDays);

      let deletedCount = 0;

      for (const file of files) {
        if (file.endsWith('.log') || file.endsWith('.bak')) {
          const filePath = path.join(this.logDir, file);
          const stats = await fs.stat(filePath);

          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
            deletedCount++;
          }
        }
      }

      if (deletedCount > 0) {
        await this.info(`Cleaned up ${deletedCount} old log files`, 'system', { deletedCount });
      }

      return deletedCount;
    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
      return 0;
    }
  }

  async getStats() {
    try {
      const files = await fs.readdir(this.logDir);
      const stats = {
        totalFiles: 0,
        totalSize: 0,
        categories: {},
        levels: { ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0 }
      };

      for (const file of files) {
        if (file.endsWith('.log')) {
          const filePath = path.join(this.logDir, file);
          const fileStats = await fs.stat(filePath);

          stats.totalFiles++;
          stats.totalSize += fileStats.size;

          const category = file.split('-')[0];
          if (!stats.categories[category]) {
            stats.categories[category] = 0;
          }
          stats.categories[category]++;

          // Sample some entries for level stats (read last 1000 bytes)
          try {
            const content = await fs.readFile(filePath, 'utf8');
            const lines = content.trim().split('\n').slice(-10); // Last 10 entries

            for (const line of lines) {
              try {
                const entry = JSON.parse(line);
                if (stats.levels[entry.level] !== undefined) {
                  stats.levels[entry.level]++;
                }
              } catch (e) {
                // Skip malformed entries
              }
            }
          } catch (e) {
            // Skip files that can't be read
          }
        }
      }

      return stats;
    } catch (error) {
      console.error('Failed to get log stats:', error);
      return { totalFiles: 0, totalSize: 0, categories: {}, levels: {} };
    }
  }

  // Start periodic cleanup
  startCleanup(intervalMs = 24 * 60 * 60 * 1000) { // Daily
    setInterval(async () => {
      await this.cleanupOldLogs();
    }, intervalMs);
  }
}

module.exports = FileLogger;