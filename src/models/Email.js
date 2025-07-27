const path = require('path');
const FileUtils = require('../utils/fileUtils');
const logger = require('../utils/logger');

class Email {
  constructor(data) {
    this.to = data.to;
    this.subject = data.subject;
    this.html = data.html;
    this.text = data.text;
    this.attachments = data.attachments || [];
    this.from = data.from || process.env.EMAIL;
    this.companyName = data.companyName;
    this.templateVariables = data.templateVariables || {};
  }

  // Enhanced email validation
  static isValidEmailFormat(email) {
    if (!email || typeof email !== 'string') {
      return false;
    }

    // Basic format check
    const basicRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!basicRegex.test(email)) {
      return false;
    }

    // Additional security checks
    const emailParts = email.split('@');
    if (emailParts.length !== 2) {
      return false;
    }

    const [localPart, domain] = emailParts;

    // Local part validation
    if (localPart.length === 0 || localPart.length > 64) {
      return false;
    }

    // Domain validation
    if (domain.length === 0 || domain.length > 253) {
      return false;
    }

    // Check for dangerous characters
    const dangerousChars = /[<>()[\]\\.,;:\s@"]/;
    if (dangerousChars.test(localPart.replace(/[.]/g, ''))) {
      return false;
    }

    // Domain must contain at least one dot and valid characters
    const domainRegex = /^[a-zA-Z0-9.-]+$/;
    if (!domainRegex.test(domain) || !domain.includes('.')) {
      return false;
    }

    return true;
  }

  // Validation
  isValid() {
    const errors = [];

    if (!this.to || !Email.isValidEmailFormat(this.to)) {
      errors.push('Valid recipient email is required');
    }

    if (!this.subject || this.subject.trim().length === 0) {
      errors.push('Email subject is required');
    }

    if (this.subject && this.subject.length > 200) {
      errors.push('Email subject is too long (max 200 characters)');
    }

    if (!this.html && !this.text) {
      errors.push('Email content (HTML or text) is required');
    }

    if (!this.from || !Email.isValidEmailFormat(this.from)) {
      errors.push('Valid sender email is required');
    }

    // Check for potential security issues in content
    if (this.html) {
      const dangerousPatterns = /<script|javascript:|vbscript:|onload=|onerror=/i;
      if (dangerousPatterns.test(this.html)) {
        errors.push('Email content contains potentially dangerous scripts');
      }
    }

    // Validate attachments
    if (this.attachments && this.attachments.length > 0) {
      for (const attachment of this.attachments) {
        if (!attachment.filename || !attachment.path) {
          errors.push('Invalid attachment format');
          break;
        }
        
        // Check file extension
        const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt'];
        const ext = path.extname(attachment.filename).toLowerCase();
        if (!allowedExtensions.includes(ext)) {
          errors.push(`Attachment type ${ext} not allowed`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Add attachment
  addAttachment(attachment) {
    if (attachment && attachment.filename && attachment.path) {
      this.attachments.push(attachment);
      logger.email(`Attachment added: ${attachment.filename}`);
    } else {
      logger.warning('Invalid attachment format');
    }
  }

  // Remove attachment
  removeAttachment(filename) {
    const index = this.attachments.findIndex(att => att.filename === filename);
    if (index !== -1) {
      this.attachments.splice(index, 1);
      logger.email(`Attachment removed: ${filename}`);
    }
  }

  // Set template variables
  setTemplateVariable(key, value) {
    this.templateVariables[key] = value;
  }

  setTemplateVariables(variables) {
    this.templateVariables = { ...this.templateVariables, ...variables };
  }

  // Get email size estimate
  getEstimatedSize() {
    let size = 0;
    
    // Calculate text content size
    size += Buffer.byteLength(this.subject || '', 'utf8');
    size += Buffer.byteLength(this.html || '', 'utf8');
    size += Buffer.byteLength(this.text || '', 'utf8');
    
    // Calculate attachments size
    this.attachments.forEach(att => {
      if (att.path) {
        size += FileUtils.getFileSize(att.path);
      }
    });

    return {
      bytes: size,
      formatted: FileUtils.formatFileSize(size)
    };
  }

  // Convert to nodemailer format
  toNodemailerFormat() {
    const mailOptions = {
      from: this.from,
      to: this.to,
      subject: this.subject
    };

    if (this.html) {
      mailOptions.html = this.html;
    }

    if (this.text) {
      mailOptions.text = this.text;
    }

    if (this.attachments && this.attachments.length > 0) {
      mailOptions.attachments = this.attachments.map(att => ({
        filename: att.filename,
        path: att.path,
        contentType: att.contentType || 'application/octet-stream'
      }));
    }

    return mailOptions;
  }

  // Create log entry
  createLogEntry(result) {
    return {
      to: this.to,
      companyName: this.companyName,
      subject: this.subject,
      timestamp: new Date().toISOString(),
      success: result.success,
      messageId: result.messageId,
      error: result.error,
      estimatedSize: this.getEstimatedSize()
    };
  }

  toJSON() {
    return {
      to: this.to,
      subject: this.subject,
      html: this.html,
      text: this.text,
      attachments: this.attachments,
      from: this.from,
      companyName: this.companyName,
      templateVariables: this.templateVariables
    };
  }
}

module.exports = Email;
