const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class Email {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.campaignId = data.campaignId || '';
    this.recipient = data.recipient || { email: '', companyName: '' };
    this.template = data.template || { id: '', name: '', category: '' };
    this.subject = data.subject || '';
    this.content = data.content || '';
    this.to = data.to || '';
    this.html = data.html || '';
    this.companyName = data.companyName || '';
    this.templateId = data.templateId || '';
    this.templateName = data.templateName || '';
    this.templateCategory = data.templateCategory || '';
    this.userEmail = data.userEmail || '';
    this.batchId = data.batchId || '';
    this.status = data.status || 'pending';
    this.sentAt = data.sentAt || null;
    this.deliveredAt = data.deliveredAt || null;
    this.failedAt = data.failedAt || null;
    this.error = data.error || null;
    this.retryCount = data.retryCount || 0;
    this.maxRetries = data.maxRetries || 3;
    this.attachments = data.attachments || [];
    this.metadata = data.metadata || {
      userAgent: '',
      ipAddress: '',
      userEmail: '',
      batchId: '',
      smtpResponse: '',
      messageId: ''
    };
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  // File storage path
  static getStoragePath() {
    return path.join(__dirname, '../../data/emails.json');
  }

  // Load all emails from file
  static async loadAll() {
    try {
      const storagePath = this.getStoragePath();
      const data = await fs.readFile(storagePath, 'utf8');
      const emails = JSON.parse(data);
      return emails.map(email => new Email(email));
    } catch (error) {
      // If file doesn't exist, return empty array
      return [];
    }
  }

  // Save all emails to file
  static async saveAll(emails) {
    const storagePath = this.getStoragePath();
    const dir = path.dirname(storagePath);

    // Ensure directory exists
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    const data = JSON.stringify(emails.map(e => e.toJSON()), null, 2);
    await fs.writeFile(storagePath, data, 'utf8');
  }

  // Find email by ID
  static async findById(id) {
    const emails = await this.loadAll();
    return emails.find(e => e.id === id) || null;
  }

  // Save this email
  async save() {
    const emails = await Email.loadAll();
    const existingIndex = emails.findIndex(e => e.id === this.id);

    this.updatedAt = new Date();

    if (existingIndex >= 0) {
      emails[existingIndex] = this;
    } else {
      emails.push(this);
    }

    await Email.saveAll(emails);
    return this;
  }

  // Delete this email
  async delete() {
    const emails = await Email.loadAll();
    const filtered = emails.filter(e => e.id !== this.id);
    await Email.saveAll(filtered);
  }

  // Instance methods
  markAsSent(messageId = null, smtpResponse = null) {
    this.status = 'sent';
    this.sentAt = new Date();
    if (messageId) {
      this.metadata.messageId = messageId;
    }
    if (smtpResponse) {
      this.metadata.smtpResponse = smtpResponse;
    }
    return this.save();
  }

  markAsFailed(error, incrementRetry = true) {
    if (incrementRetry) {
      this.retryCount += 1;
    }

    if (this.retryCount >= this.maxRetries) {
      this.status = 'failed';
      this.failedAt = new Date();
    }

    this.error = error;
    return this.save();
  }

  markAsDelivered() {
    this.status = 'sent'; // Keep as sent, but mark delivery
    this.deliveredAt = new Date();
    return this.save();
  }

  canRetry() {
    return this.retryCount < this.maxRetries && this.status !== 'sent';
  }

  getTimeToSend() {
    if (!this.sentAt) return null;
    return this.sentAt - this.createdAt;
  }

  // Email object methods for sending emails
  isValid() {
    const errors = [];
    
    // Validate required fields for sending
    if (!this.to) {
      errors.push('Recipient email is required');
    }
    
    if (!this.subject) {
      errors.push('Subject is required');
    }
    
    if (!this.html && !this.content) {
      errors.push('Email content (html or text) is required');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  toNodemailerFormat() {
    const mailOptions = {
      from: this.from || process.env.EMAIL_USER,
      to: this.to,
      subject: this.subject,
      html: this.html || this.content
    };

    // Add attachments if present
    if (this.attachments && this.attachments.length > 0) {
      mailOptions.attachments = this.attachments.map(att => ({
        filename: att.filename,
        path: att.path,
        contentType: att.contentType || 'application/octet-stream'
      }));
    }

    return mailOptions;
  }

  addAttachment(attachment) {
    if (!this.attachments) {
      this.attachments = [];
    }
    this.attachments.push(attachment);
  }

  createLogEntry(options = {}) {
    return {
      success: options.success || false,
      error: options.error || null,
      recipient: this.to,
      companyName: this.recipient?.companyName || '',
      messageId: options.messageId || null,
      templateId: this.template?.id || null,
      timestamp: new Date()
    };
  }

  // Static methods
  static async findByCampaign(campaignId) {
    const emails = await this.loadAll();
    return emails.filter(e => e.campaignId === campaignId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  static async findByRecipient(email) {
    const emails = await this.loadAll();
    return emails.filter(e => e.recipient.email === email).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  static async findByStatus(status) {
    const emails = await this.loadAll();
    return emails.filter(e => e.status === status).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  static async getSentEmails(campaignId = null) {
    const emails = await this.loadAll();
    let filtered = emails.filter(e => e.status === 'sent');
    if (campaignId) {
      filtered = filtered.filter(e => e.campaignId === campaignId);
    }
    return filtered.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
  }

  static async getFailedEmails(campaignId = null) {
    const emails = await this.loadAll();
    let filtered = emails.filter(e => e.status === 'failed');
    if (campaignId) {
      filtered = filtered.filter(e => e.campaignId === campaignId);
    }
    return filtered.sort((a, b) => new Date(b.failedAt) - new Date(a.failedAt));
  }

  static async getPendingEmails(campaignId = null) {
    const emails = await this.loadAll();
    let filtered = emails.filter(e => e.status === 'pending');
    if (campaignId) {
      filtered = filtered.filter(e => e.campaignId === campaignId);
    }
    return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  static async getEmailStats(campaignId = null) {
    const emails = await this.loadAll();
    let filtered = campaignId ? emails.filter(e => e.campaignId === campaignId) : emails;

    const stats = {};
    filtered.forEach(email => {
      if (!stats[email.status]) {
        stats[email.status] = { count: 0, totalRetries: 0 };
      }
      stats[email.status].count += 1;
      stats[email.status].totalRetries += email.retryCount;
    });

    return Object.entries(stats).map(([status, data]) => ({
      _id: status,
      count: data.count,
      totalRetries: data.totalRetries
    }));
  }

  static async getEmailsByDateRange(startDate, endDate, campaignId = null) {
    const emails = await this.loadAll();
    let filtered = emails.filter(e => {
      const createdAt = new Date(e.createdAt);
      return createdAt >= new Date(startDate) && createdAt <= new Date(endDate);
    });

    if (campaignId) {
      filtered = filtered.filter(e => e.campaignId === campaignId);
    }

    return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  static async cleanupOldEmails(daysOld = 90) {
    const emails = await this.loadAll();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const filtered = emails.filter(e => {
      const createdAt = new Date(e.createdAt);
      return createdAt >= cutoffDate || !['sent', 'failed'].includes(e.status);
    });

    await this.saveAll(filtered);
    return emails.length - filtered.length;
  }

  toJSON() {
    return {
      id: this.id,
      campaignId: this.campaignId,
      recipient: this.recipient,
      template: this.template,
      subject: this.subject,
      content: this.content,
      to: this.to,
      html: this.html,
      companyName: this.companyName,
      templateId: this.templateId,
      templateName: this.templateName,
      templateCategory: this.templateCategory,
      userEmail: this.userEmail,
      batchId: this.batchId,
      status: this.status,
      sentAt: this.sentAt,
      deliveredAt: this.deliveredAt,
      failedAt: this.failedAt,
      error: this.error,
      retryCount: this.retryCount,
      maxRetries: this.maxRetries,
      attachments: this.attachments,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Email;
