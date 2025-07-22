const fs = require('fs');
const path = require('path');
const logger = require('./logger');

class FileUtils {
  static ensureDirectoryExists(dirPath) {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        logger.file(`Directory created: ${dirPath}`);
      }
      return true;
    } catch (error) {
      logger.error(`Failed to create directory ${dirPath}: ${error.message}`);
      return false;
    }
  }

  static deleteFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.file(`File deleted: ${path.basename(filePath)}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`Failed to delete file ${filePath}: ${error.message}`);
      return false;
    }
  }

  static readFile(filePath, encoding = 'utf8') {
    try {
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, encoding);
      }
      logger.warning(`File not found: ${filePath}`);
      return null;
    } catch (error) {
      logger.error(`Failed to read file ${filePath}: ${error.message}`);
      return null;
    }
  }

  static writeFile(filePath, data) {
    try {
      // Ensure directory exists
      const dirPath = path.dirname(filePath);
      this.ensureDirectoryExists(dirPath);
      
      fs.writeFileSync(filePath, data);
      logger.file(`File written: ${path.basename(filePath)}`);
      return true;
    } catch (error) {
      logger.error(`Failed to write file ${filePath}: ${error.message}`);
      return false;
    }
  }

  static getFileExtension(filename) {
    return path.extname(filename).toLowerCase();
  }

  static getFileSize(filePath) {
    try {
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch (error) {
      logger.error(`Failed to get file size for ${filePath}: ${error.message}`);
      return 0;
    }
  }

  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  static isValidEmailFormat(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static sanitizeFilename(filename) {
    return filename.replace(/[^a-z0-9.-]/gi, '_').toLowerCase();
  }
}

module.exports = FileUtils;
