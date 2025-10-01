const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class Campaign {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.name = data.name || '';
    this.status = data.status || 'active';
    this.contacts = data.contacts || [];
    this.template = data.template || '';
    this.templateId = data.templateId || '';
    this.subject = data.subject || '';
    this.resumeDocLink = data.resumeDocLink || '';
    this.userEmail = data.userEmail || '';
    this.totalEmails = data.totalEmails || 0;
    this.sentEmails = data.sentEmails || 0;
    this.failedEmails = data.failedEmails || 0;
    this.dailyLogs = data.dailyLogs || [];
    this.delay = data.delay || 10000;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.lastProcessedAt = data.lastProcessedAt || null;
    this.completedAt = data.completedAt || null;
  }

  // File storage path
  static getStoragePath() {
    return path.join(__dirname, '../../data/campaigns.json');
  }

  // Load all campaigns from file
  static async loadAll() {
    try {
      const storagePath = this.getStoragePath();
      const data = await fs.readFile(storagePath, 'utf8');
      const campaigns = JSON.parse(data);
      return campaigns.map(campaign => new Campaign(campaign));
    } catch (error) {
      // If file doesn't exist, return empty array
      return [];
    }
  }

  // Save all campaigns to file
  static async saveAll(campaigns) {
    const storagePath = this.getStoragePath();
    const dir = path.dirname(storagePath);

    // Ensure directory exists
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    const data = JSON.stringify(campaigns.map(c => c.toJSON()), null, 2);
    await fs.writeFile(storagePath, data, 'utf8');
  }

  // Find campaign by ID
  static async findById(id) {
    const campaigns = await this.loadAll();
    return campaigns.find(c => c.id === id) || null;
  }

  // Save this campaign
  async save() {
    const campaigns = await Campaign.loadAll();
    const existingIndex = campaigns.findIndex(c => c.id === this.id);

    this.updatedAt = new Date();

    if (existingIndex >= 0) {
      campaigns[existingIndex] = this;
    } else {
      campaigns.push(this);
    }

    await Campaign.saveAll(campaigns);
    return this;
  }

  // Delete this campaign
  async delete() {
    const campaigns = await Campaign.loadAll();
    const filtered = campaigns.filter(c => c.id !== this.id);
    await Campaign.saveAll(filtered);
  }

  // Instance methods
  getProgress() {
    return {
      id: this.id,
      name: this.name,
      status: this.status,
      totalEmails: this.totalEmails,
      sentEmails: this.sentEmails,
      failedEmails: this.failedEmails,
      progress: this.totalEmails > 0 ? Math.round((this.sentEmails / this.totalEmails) * 100) : 0,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastProcessedAt: this.lastProcessedAt,
      completedAt: this.completedAt
    };
  }

  getEstimatedCompletion() {
    if (this.status !== 'active' || this.sentEmails >= this.totalEmails) {
      return null;
    }

    const remainingEmails = this.totalEmails - this.sentEmails;
    const avgDelay = this.delay || 10000;
    const estimatedMs = remainingEmails * avgDelay;

    return new Date(Date.now() + estimatedMs);
  }

  updateProgress(successCount, failedCount) {
    this.sentEmails += successCount;
    this.failedEmails += failedCount;
    this.lastProcessedAt = new Date();

    if (this.sentEmails + this.failedEmails >= this.totalEmails) {
      this.status = 'completed';
      this.completedAt = new Date();
    }
  }

  addDailyLog(logData) {
    const today = new Date().toISOString().split('T')[0];
    let dailyLog = this.dailyLogs.find(log => log.date === today);

    if (!dailyLog) {
      dailyLog = {
        date: today,
        recipients: [],
        totalSent: 0,
        totalFailed: 0
      };
      this.dailyLogs.push(dailyLog);
    }

    if (logData.recipients) {
      dailyLog.recipients.push(...logData.recipients);
      dailyLog.totalSent += logData.recipients.filter(r => r.success).length;
      dailyLog.totalFailed += logData.recipients.filter(r => !r.success).length;
    }
  }

  getNextBatch(batchSize = 25) {
    const processedEmails = new Set();

    // Collect all processed emails from daily logs
    this.dailyLogs.forEach(log => {
      log.recipients.forEach(recipient => {
        processedEmails.add(recipient.email);
      });
    });

    // Find unprocessed contacts
    const unprocessedContacts = this.contacts.filter(contact =>
      !processedEmails.has(contact.email)
    );

    return unprocessedContacts.slice(0, batchSize);
  }

  isValid() {
    const errors = [];

    if (!this.name || this.name.trim().length === 0) {
      errors.push('Campaign name is required');
    }

    if (!this.contacts || this.contacts.length === 0) {
      errors.push('At least one contact is required');
    }

    if (!this.template || this.template.trim().length === 0) {
      errors.push('Email template is required');
    }

    if (!this.subject || this.subject.trim().length === 0) {
      errors.push('Email subject is required');
    }

    if (!this.userEmail || !this.userEmail.includes('@')) {
      errors.push('Valid user email is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Static methods
  static async findByStatus(status) {
    const campaigns = await this.loadAll();
    return campaigns.filter(c => c.status === status).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  static async getActiveCampaigns() {
    return this.findByStatus('active');
  }

  static async getCompletedCampaigns() {
    return this.findByStatus('completed');
  }

  static async getCampaignsByUser(userEmail) {
    const campaigns = await this.loadAll();
    return campaigns.filter(c => c.userEmail === userEmail).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      status: this.status,
      contacts: this.contacts,
      template: this.template,
      templateId: this.templateId,
      subject: this.subject,
      resumeDocLink: this.resumeDocLink,
      userEmail: this.userEmail,
      totalEmails: this.totalEmails,
      sentEmails: this.sentEmails,
      failedEmails: this.failedEmails,
      dailyLogs: this.dailyLogs,
      delay: this.delay,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastProcessedAt: this.lastProcessedAt,
      completedAt: this.completedAt
    };
  }
}

module.exports = Campaign;
