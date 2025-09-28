const emailConfig = require('../config/email');
const logger = require('../utils/logger');
const successfulEmailLogger = require('../utils/successfulEmailLogger');
const Email = require('../models/Email');
const Log = require('../models/Log');
const FileUtils = require('../utils/fileUtils');

/**
 * Email Service
 *
 * Core service responsible for email sending operations, rate limiting,
 * batch processing, and email campaign management. This service handles
 * the complex logic of sending emails efficiently while respecting
 * provider limits and providing real-time feedback.
 *
 * Key Features:
 * - Intelligent email sending with retry logic
 * - Advanced rate limiting and anti-spam measures
 * - Memory-efficient batch processing for large lists
 * - Real-time progress tracking via Socket.IO
 * - Comprehensive error handling and categorization
 * - SMTP optimization and connection pooling
 * - Adaptive delay management
 *
 * @class EmailService
 */
class EmailService {
  /**
   * Initialize the Email Service with configuration and dependencies
   *
   * Sets up email transporter, batch processing configuration, rate limiting,
   * memory management settings, and failure tracking mechanisms.
   *
   * @constructor
   */
  constructor() {
    // Core email infrastructure
    /**
     * Nodemailer transporter for sending emails
     * @type {Object}
     */
    this.transporter = emailConfig.getTransporter();

    // Retry configuration
    /**
     * Maximum number of retry attempts for failed emails
     * @type {number}
     */
    this.maxRetries = 3;

    /**
     * Delay between retry attempts in milliseconds
     * @type {number}
     */
    this.retryDelay = 2000; // 2 seconds

    // Batch processing configuration for efficient email sending
    /**
     * Configuration for batch processing behavior
     * Controls how emails are grouped and sent to optimize delivery
     * @type {Object}
     */
    this.batchConfig = {
      /** Default number of emails per batch (optimal balance of speed vs. deliverability) */
      defaultBatchSize: parseInt(process.env.DEFAULT_BATCH_SIZE) || 25,
      /** Minimum allowed batch size */
      minBatchSize: parseInt(process.env.MIN_BATCH_SIZE) || 10,
      /** Maximum allowed batch size */
      maxBatchSize: parseInt(process.env.MAX_BATCH_SIZE) || 50,
      /** Default delay between emails in milliseconds */
      defaultDelayMs: parseInt(process.env.DEFAULT_BATCH_DELAY) || 10000,
      /** Minimum delay between emails */
      minDelayMs: parseInt(process.env.MIN_BATCH_DELAY) || 5000,
      /** Maximum delay between emails */
      maxDelayMs: parseInt(process.env.MAX_BATCH_DELAY) || 30000,
      /** Whether to automatically adjust delays based on performance */
      adaptiveDelayEnabled: process.env.ADAPTIVE_DELAY_ENABLED !== 'false',
      /** Whether to optimize batch sizes based on SMTP capabilities */
      smtpOptimizationEnabled: process.env.SMTP_OPTIMIZATION_ENABLED !== 'false'
    };

    // Batch failure handling and retry logic
    /**
     * Map to track recipients who consistently fail
     * Used to skip problematic recipients in future batches
     * @type {Map<string, number>}
     */
    this.failedRecipients = new Map();

    /**
     * Configuration for handling batch failures and retries
     * @type {Object}
     */
    this.batchRetryConfig = {
      /** Maximum number of times to retry a failed batch */
      maxBatchRetries: parseInt(process.env.MAX_BATCH_RETRIES) || 3,
      /** Maximum failures per recipient before skipping */
      maxRecipientFailures: parseInt(process.env.MAX_RECIPIENT_FAILURES) || 3,
      /** Whether to skip recipients who have failed multiple times */
      skipProblematicRecipients: process.env.SKIP_PROBLEMATIC_RECIPIENTS !== 'false'
    };

    // Memory management for large recipient lists
    /**
     * Configuration for memory-efficient processing of large email lists
     * Prevents memory exhaustion when processing thousands of emails
     * @type {Object}
     */
    this.memoryConfig = {
      /** Maximum emails to process in memory before chunking */
      maxEmailsInMemory: parseInt(process.env.MAX_EMAILS_IN_MEMORY) || 10000,
      /** Size of each processing chunk for large lists */
      chunkSize: parseInt(process.env.EMAIL_CHUNK_SIZE) || 5000,
      /** Whether to enable memory optimization features */
      enableMemoryOptimization: process.env.ENABLE_MEMORY_OPTIMIZATION !== 'false'
    };

    // Enhanced rate limiting with anti-spam measures
    /**
     * Comprehensive rate limiting system to prevent spam and respect provider limits
     * Implements multiple layers of rate limiting with adaptive throttling
     * @type {Object}
     */
    this.rateLimiter = {
      // Rate limit thresholds
      /** Maximum emails allowed per hour */
      maxEmailsPerHour: parseInt(process.env.MAX_EMAILS_PER_HOUR) || 500,
      /** Maximum emails allowed per minute */
      maxEmailsPerMinute: parseInt(process.env.MAX_EMAILS_PER_MINUTE) || 50,
      /** Maximum emails allowed per second (prevents burst sending) */
      maxEmailsPerSecond: parseInt(process.env.MAX_EMAILS_PER_SECOND) || 5,
      /** Maximum emails per batch (spam prevention) */
      maxEmailsPerBatch: parseInt(process.env.MAX_EMAILS_PER_BATCH) || 25,

      // Current usage counters
      /** Emails sent in current hour */
      sentThisHour: 0,
      /** Emails sent in current minute */
      sentThisMinute: 0,
      /** Emails sent in current second */
      sentThisSecond: 0,

      // Reset timestamps
      /** Last time hourly counter was reset */
      lastResetHour: Date.now(),
      /** Last time minute counter was reset */
      lastResetMinute: Date.now(),
      /** Last time second counter was reset */
      lastResetSecond: Date.now(),

      // Anti-spam and adaptive features
      /** Number of consecutive email failures */
      consecutiveFailures: 0,
      /** Timestamp of last email failure */
      lastFailureTime: 0,
      /** Whether adaptive throttling is enabled */
      adaptiveThrottling: process.env.ADAPTIVE_THROTTLING_ENABLED !== 'false',

      // Per-domain and per-IP tracking
      /** Map of domain cooldowns to prevent rapid sending to same domain */
      domainCooldowns: new Map(),
      /** Map of IP-based cooldowns for rate limiting */
      ipCooldowns: new Map()
    };
  }

  // Categorize email sending errors
  categorizeError(error) {
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes('rate limit exceeded') ||
        errorMessage.includes('rate_limit')) {
      return 'RATE_LIMIT';
    }

    if (errorMessage.includes('authentication failed') ||
        errorMessage.includes('invalid credentials') ||
        errorMessage.includes('535') ||
        errorMessage.includes('auth')) {
      return 'AUTHENTICATION';
    }

    if (errorMessage.includes('connection') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('network') ||
        errorMessage.includes('econnrefused') ||
        errorMessage.includes('enotfound')) {
      return 'NETWORK';
    }

    if (errorMessage.includes('too many') ||
        errorMessage.includes('quota') ||
        errorMessage.includes('429')) {
      return 'RATE_LIMIT';
    }

    if (errorMessage.includes('invalid') ||
        errorMessage.includes('malformed') ||
        errorMessage.includes('recipient') ||
        errorMessage.includes('address')) {
      return 'VALIDATION';
    }

    return 'UNKNOWN';
  }

  // Sanitize error messages for logging
  sanitizeErrorMessage(error, recipient) {
    let sanitized = error.message;

    // Remove sensitive information
    sanitized = sanitized.replace(/user=[^&\s]+/gi, 'user=***REDACTED***');
    sanitized = sanitized.replace(/pass=[^&\s]+/gi, 'pass=***REDACTED***');
    sanitized = sanitized.replace(/token=[^&\s]+/gi, 'token=***REDACTED***');

    // Add context without exposing sensitive data
    return `Email to ${recipient || 'unknown'}: ${sanitized}`;
  }

  // Send a single email with retry logic
  async sendEmail(emailData, retryCount = 0, campaignId = null) {
    try {
      // Check rate limits
      const rateLimitCheck = this.checkRateLimit();
      if (!rateLimitCheck.allowed) {
        const errorMsg = `Rate limit exceeded: ${rateLimitCheck.reason}`;
        logger.warning(`Rate limit exceeded for ${emailData.to}: ${rateLimitCheck.reason}`);
        throw new Error(errorMsg);
      }

      // Validate and sanitize input data
      const inputValidation = this.validateAndSanitizeEmailData(emailData);
      if (!inputValidation.valid) {
        const errorMsg = `Input validation failed: ${inputValidation.errors.join(', ')}`;
        logger.warning(this.sanitizeErrorMessage({ message: errorMsg }, emailData.to));
        throw new Error(errorMsg);
      }

      const email = new Email(inputValidation.sanitized);

      // Additional email model validation
      const validation = email.isValid();
      if (!validation.valid) {
        const errorMsg = `Email validation failed: ${validation.errors.join(', ')}`;
        logger.warning(this.sanitizeErrorMessage({ message: errorMsg }, email.to));
        throw new Error(errorMsg);
      }

      // Convert to nodemailer format
      const mailOptions = email.toNodemailerFormat();

      logger.email(`Sending email to ${email.to} (${email.companyName || 'Unknown Company'}) - Attempt ${retryCount + 1}/${this.maxRetries + 1}`);

      // Send email
      const result = await this.transporter.sendMail(mailOptions);

      // Record successful send for rate limiting
      this.recordEmailSent(emailData);

      logger.email(`Email sent successfully to ${email.to} - MessageID: ${result.messageId}`);

      // Create email record in MongoDB
      try {
        const emailRecord = new Email({
          campaignId: campaignId,
          recipient: {
            email: email.to,
            companyName: email.companyName
          },
          template: {
            id: email.templateId,
            name: email.templateName || 'Unknown',
            category: email.templateCategory || 'unknown'
          },
          subject: email.subject,
          content: email.html,
          status: 'sent',
          sentAt: new Date(),
          deliveredAt: new Date(), // Assume delivered for now
          metadata: {
            messageId: result.messageId,
            userEmail: emailData.userEmail,
            batchId: emailData.batchId,
            smtpResponse: result.response
          }
        });

        await emailRecord.save();

        // Log successful email event
        await Log.logEmailEvent(campaignId, email.to, 'sent', {
          messageId: result.messageId,
          templateId: email.templateId
        });

      } catch (dbError) {
        logger.error(`Failed to save email record to database: ${dbError.message}`);
        // Continue execution even if DB save fails
      }

      return {
        success: true,
        messageId: result.messageId,
        recipient: email.to,
        companyName: email.companyName,
        logEntry: email.createLogEntry({ success: true, messageId: result.messageId })
      };
    } catch (error) {
      const errorCategory = this.categorizeError(error);
      const sanitizedError = this.sanitizeErrorMessage(error, emailData.to);

      logger.error(`${errorCategory} error: ${sanitizedError}`);

      // Record failure for adaptive throttling
      this.recordEmailFailure();

      // Retry logic for transient errors
      if (retryCount < this.maxRetries &&
          (errorCategory === 'NETWORK' || errorCategory === 'RATE_LIMIT')) {
        logger.warning(`Retrying email to ${emailData.to} in ${this.retryDelay}ms (attempt ${retryCount + 1}/${this.maxRetries})`);
        await this.delay(this.retryDelay * (retryCount + 1)); // Exponential backoff
        return this.sendEmail(emailData, retryCount + 1, campaignId);
      }

      // Create email record for failed email in MongoDB
      try {
        const failedEmailRecord = new Email({
          campaignId: campaignId,
          recipient: {
            email: emailData.to,
            companyName: emailData.companyName
          },
          template: {
            id: emailData.templateId,
            name: emailData.templateName || 'Unknown',
            category: emailData.templateCategory || 'unknown'
          },
          subject: emailData.subject,
          content: emailData.html,
          status: 'failed',
          failedAt: new Date(),
          error: this.getSafeErrorMessage(errorCategory, error),
          retryCount: retryCount,
          metadata: {
            userEmail: emailData.userEmail,
            batchId: emailData.batchId,
            errorCategory: errorCategory
          }
        });

        await failedEmailRecord.save();

        // Log failed email event
        await Log.logEmailEvent(campaignId, emailData.to, 'failed', {
          error: this.getSafeErrorMessage(errorCategory, error),
          errorCategory,
          retryCount
        });

      } catch (dbError) {
        logger.error(`Failed to save failed email record to database: ${dbError.message}`);
        // Continue execution even if DB save fails
      }

      // Return appropriate error response based on category
      const errorResponse = {
        success: false,
        error: this.getSafeErrorMessage(errorCategory, error),
        errorCategory,
        recipient: emailData.to,
        companyName: emailData.companyName,
        retryCount,
        logEntry: {
          success: false,
          error: this.getSafeErrorMessage(errorCategory, error),
          errorCategory
        }
      };

      return errorResponse;
    }
  }

  // Get safe error messages that don't expose sensitive information
  getSafeErrorMessage(category, originalError) {
    switch (category) {
      case 'AUTHENTICATION':
        return 'Authentication failed. Please check email credentials.';
      case 'NETWORK':
        return 'Network connection failed. Please try again later.';
      case 'RATE_LIMIT':
        return 'Rate limit exceeded. Please wait before sending more emails.';
      case 'VALIDATION':
        return originalError.message; // Validation errors are safe to expose
      default:
        return 'An unexpected error occurred while sending the email.';
    }
  }

  // Check enhanced rate limits with anti-spam measures
  checkRateLimit(emailData = null) {
    const now = Date.now();

    // Reset counters if needed
    if (now - this.rateLimiter.lastResetHour >= 3600000) { // 1 hour
      this.rateLimiter.sentThisHour = 0;
      this.rateLimiter.lastResetHour = now;
    }

    if (now - this.rateLimiter.lastResetMinute >= 60000) { // 1 minute
      this.rateLimiter.sentThisMinute = 0;
      this.rateLimiter.lastResetMinute = now;
    }

    if (now - this.rateLimiter.lastResetSecond >= 1000) { // 1 second
      this.rateLimiter.sentThisSecond = 0;
      this.rateLimiter.lastResetSecond = now;
    }

    // Check per-second limit (most restrictive)
    if (this.rateLimiter.sentThisSecond >= this.rateLimiter.maxEmailsPerSecond) {
      return {
        allowed: false,
        reason: 'RATE_LIMIT_SECOND',
        resetIn: 1000 - (now - this.rateLimiter.lastResetSecond),
        message: `Too many emails per second (${this.rateLimiter.sentThisSecond}/${this.rateLimiter.maxEmailsPerSecond})`
      };
    }

    // Check per-minute limit
    if (this.rateLimiter.sentThisMinute >= this.rateLimiter.maxEmailsPerMinute) {
      return {
        allowed: false,
        reason: 'RATE_LIMIT_MINUTE',
        resetIn: 60000 - (now - this.rateLimiter.lastResetMinute),
        message: `Rate limit exceeded: ${this.rateLimiter.sentThisMinute}/${this.rateLimiter.maxEmailsPerMinute} emails per minute`
      };
    }

    // Check per-hour limit
    if (this.rateLimiter.sentThisHour >= this.rateLimiter.maxEmailsPerHour) {
      return {
        allowed: false,
        reason: 'RATE_LIMIT_HOUR',
        resetIn: 3600000 - (now - this.rateLimiter.lastResetHour),
        message: `Rate limit exceeded: ${this.rateLimiter.sentThisHour}/${this.rateLimiter.maxEmailsPerHour} emails per hour`
      };
    }

    // Check consecutive failures (adaptive throttling)
    if (this.rateLimiter.adaptiveThrottling && this.rateLimiter.consecutiveFailures >= 5) {
      const timeSinceLastFailure = now - this.rateLimiter.lastFailureTime;
      const backoffTime = Math.min(30000 * Math.pow(2, this.rateLimiter.consecutiveFailures - 5), 300000); // Max 5 minutes

      if (timeSinceLastFailure < backoffTime) {
        return {
          allowed: false,
          reason: 'ADAPTIVE_THROTTLE',
          resetIn: backoffTime - timeSinceLastFailure,
          message: `Adaptive throttling: ${this.rateLimiter.consecutiveFailures} consecutive failures`
        };
      }
    }

    // Check domain-specific rate limiting (if email data provided)
    if (emailData && emailData.to) {
      const domain = emailData.to.split('@')[1]?.toLowerCase();
      if (domain) {
        const domainLastSent = this.rateLimiter.domainCooldowns.get(domain) || 0;
        const timeSinceDomainSend = now - domainLastSent;

        // Enforce minimum 2 seconds between emails to same domain
        if (timeSinceDomainSend < 2000) {
          return {
            allowed: false,
            reason: 'DOMAIN_COOLDOWN',
            resetIn: 2000 - timeSinceDomainSend,
            message: `Domain cooldown: ${domain} (2s minimum between emails)`
          };
        }
      }
    }

    return { allowed: true };
  }

  // Record email sent for rate limiting
  recordEmailSent(emailData = null) {
    this.rateLimiter.sentThisHour++;
    this.rateLimiter.sentThisMinute++;
    this.rateLimiter.sentThisSecond++;

    // Reset consecutive failures on success
    this.rateLimiter.consecutiveFailures = 0;

    // Record domain-specific sending
    if (emailData && emailData.to) {
      const domain = emailData.to.split('@')[1]?.toLowerCase();
      if (domain) {
        this.rateLimiter.domainCooldowns.set(domain, Date.now());
      }
    }
  }

  // Record email failure for adaptive throttling
  recordEmailFailure() {
    this.rateLimiter.consecutiveFailures++;
    this.rateLimiter.lastFailureTime = Date.now();
  }

  // Get rate limit status
  getRateLimitStatus() {
    const check = this.checkRateLimit();
    return {
      allowed: check.allowed,
      sentThisHour: this.rateLimiter.sentThisHour,
      maxPerHour: this.rateLimiter.maxEmailsPerHour,
      sentThisMinute: this.rateLimiter.sentThisMinute,
      maxPerMinute: this.rateLimiter.maxEmailsPerMinute,
      resetIn: check.resetIn || 0
    };
  }

  // Get batch configuration
  getBatchConfig() {
    return { ...this.batchConfig };
  }

  // Validate and normalize batch size
  validateBatchSize(batchSize) {
    const size = parseInt(batchSize) || this.batchConfig.defaultBatchSize;
    return Math.max(
      this.batchConfig.minBatchSize,
      Math.min(this.batchConfig.maxBatchSize, size)
    );
  }

  // Validate and normalize delay
  validateDelay(delayMs) {
    const delay = parseInt(delayMs) || this.batchConfig.defaultDelayMs;
    return Math.max(
      this.batchConfig.minDelayMs,
      Math.min(this.batchConfig.maxDelayMs, delay)
    );
  }


  // Check if recipient should be skipped due to persistent failures
  shouldSkipRecipient(email) {
    if (!this.batchRetryConfig.skipProblematicRecipients) {
      return false;
    }

    const failures = this.failedRecipients.get(email) || 0;
    return failures >= this.batchRetryConfig.maxRecipientFailures;
  }

  // Record recipient failure
  recordRecipientFailure(email) {
    const currentFailures = this.failedRecipients.get(email) || 0;
    this.failedRecipients.set(email, currentFailures + 1);

    if (currentFailures + 1 >= this.batchRetryConfig.maxRecipientFailures) {
      logger.warning(`Recipient ${email} has failed ${currentFailures + 1} times, will be skipped in future batches`);
    }
  }

  // Clear recipient failure record on success
  clearRecipientFailure(email) {
    if (this.failedRecipients.has(email)) {
      this.failedRecipients.delete(email);
      logger.debug(`Cleared failure record for recipient ${email}`);
    }
  }

  // Filter out problematic recipients from email list
  filterProblematicRecipients(emails) {
    if (!this.batchRetryConfig.skipProblematicRecipients) {
      return emails;
    }

    const filtered = emails.filter(email => {
      const shouldSkip = this.shouldSkipRecipient(email.to);
      if (shouldSkip) {
        logger.debug(`Skipping problematic recipient: ${email.to}`);
      }
      return !shouldSkip;
    });

    const skipped = emails.length - filtered.length;
    if (skipped > 0) {
      logger.info(`Filtered out ${skipped} problematic recipients from batch`);
    }

    return filtered;
  }

  // Retry failed batch with exponential backoff
  async retryFailedBatch(failedEmails, batchNumber, options = {}) {
    const maxRetries = options.maxRetries || this.batchRetryConfig.maxBatchRetries;
    const baseDelay = options.baseDelay || 30000; // 30 seconds

    for (let retry = 1; retry <= maxRetries; retry++) {
      logger.warning(`Retrying failed batch ${batchNumber} (attempt ${retry}/${maxRetries})`);

      try {
        // Filter out problematic recipients
        const filteredEmails = this.filterProblematicRecipients(failedEmails);

        if (filteredEmails.length === 0) {
          logger.warning(`No valid recipients left in failed batch ${batchNumber} after filtering`);
          return { success: false, message: 'No valid recipients remaining' };
        }

        // Calculate retry delay with exponential backoff
        const retryDelay = baseDelay * Math.pow(2, retry - 1);
        await this.delay(retryDelay);

        // Retry the batch
        const result = await this.sendEmailBatch(filteredEmails, this.batchConfig.defaultDelayMs, null, campaignId);

        if (result.successful > 0 || result.failed < failedEmails.length) {
          logger.info(`Batch ${batchNumber} retry ${retry} partially successful: ${result.successful} sent, ${result.failed} failed`);
          return result;
        }

      } catch (error) {
        logger.error(`Batch ${batchNumber} retry ${retry} failed: ${error.message}`);
      }
    }

    logger.error(`Batch ${batchNumber} failed after ${maxRetries} retries`);
    return { success: false, message: `Failed after ${maxRetries} retries` };
  }

  // Optimize batch size based on SMTP server capabilities
  async optimizeBatchSize(currentBatchSize = null) {
    if (!this.batchConfig.smtpOptimizationEnabled) {
      return currentBatchSize || this.batchConfig.defaultBatchSize;
    }

    try {
      // Get SMTP connection stats
      const smtpStats = this.transporter.pool ? {
        maxConnections: this.transporter.pool.maxConnections || 5,
        maxMessages: this.transporter.pool.maxMessages || 100
      } : {
        maxConnections: 5,
        maxMessages: 100
      };

      // Get current rate limiting status
      const rateLimitStatus = this.getRateLimitStatus();

      // Calculate optimal batch size based on multiple factors
      let optimalSize = this.batchConfig.defaultBatchSize;

      // Factor 1: SMTP connection limits
      const smtpLimit = Math.min(smtpStats.maxConnections * 10, smtpStats.maxMessages);
      optimalSize = Math.min(optimalSize, smtpLimit);

      // Factor 2: Rate limiting constraints
      const rateLimitBasedSize = Math.min(
        Math.floor(rateLimitStatus.maxPerMinute / 2), // Conservative approach
        Math.floor(rateLimitStatus.maxPerHour / 60)  // Spread over time
      );
      optimalSize = Math.min(optimalSize, rateLimitBasedSize);

      // Factor 3: Current sending patterns (reduce if rate limited recently)
      if (rateLimitStatus.sentThisMinute > rateLimitStatus.maxPerMinute * 0.8) {
        optimalSize = Math.max(Math.floor(optimalSize * 0.5), this.batchConfig.minBatchSize);
        logger.debug(`Reducing batch size due to high per-minute usage: ${optimalSize}`);
      }

      // Factor 4: Adaptive sizing based on recent performance
      if (this.rateLimiter.consecutiveFailures > 0) {
        optimalSize = Math.max(Math.floor(optimalSize * 0.7), this.batchConfig.minBatchSize);
        logger.debug(`Reducing batch size due to recent failures: ${optimalSize}`);
      }

      // Ensure within configured bounds
      optimalSize = Math.max(this.batchConfig.minBatchSize, Math.min(this.batchConfig.maxBatchSize, optimalSize));

      if (currentBatchSize && Math.abs(optimalSize - currentBatchSize) > 5) {
        logger.info(`Optimized batch size from ${currentBatchSize} to ${optimalSize} based on SMTP capabilities`);
      }

      return optimalSize;

    } catch (error) {
      logger.warning(`Failed to optimize batch size: ${error.message}, using default`);
      return currentBatchSize || this.batchConfig.defaultBatchSize;
    }
  }

  // Get SMTP server capabilities and limits
  async getSMTPCapabilities() {
    try {
      const capabilities = {
        maxConnections: 5,
        maxMessages: 100,
        rateLimit: {
          perSecond: this.rateLimiter.maxEmailsPerSecond,
          perMinute: this.rateLimiter.maxEmailsPerMinute,
          perHour: this.rateLimiter.maxEmailsPerHour
        },
        supported: true
      };

      // Try to get actual SMTP capabilities if available
      if (this.transporter && this.transporter.transporter) {
        const transporter = this.transporter.transporter;

        if (transporter.pool) {
          capabilities.maxConnections = transporter.pool.maxConnections || capabilities.maxConnections;
          capabilities.maxMessages = transporter.pool.maxMessages || capabilities.maxMessages;
        }

        // Check for rate limiting headers or capabilities
        if (transporter.options && transporter.options.rateDelta) {
          capabilities.rateLimit.perSecond = Math.floor(1000 / transporter.options.rateDelta) * (transporter.options.rateLimit || 1);
        }
      }

      return capabilities;

    } catch (error) {
      logger.warning(`Failed to get SMTP capabilities: ${error.message}`);
      return {
        maxConnections: 5,
        maxMessages: 100,
        rateLimit: {
          perSecond: this.rateLimiter.maxEmailsPerSecond,
          perMinute: this.rateLimiter.maxEmailsPerMinute,
          perHour: this.rateLimiter.maxEmailsPerHour
        },
        supported: false,
        error: error.message
      };
    }
  }

  // Memory-efficient processing for large recipient lists
  async processLargeEmailList(emails, options = {}, onProgress = null, campaignId = null) {
    const totalEmails = emails.length;

    // Check if memory optimization is needed
    if (!this.memoryConfig.enableMemoryOptimization || totalEmails <= this.memoryConfig.maxEmailsInMemory) {
      // Process normally
      return this.sendEmailsInBatches(emails, options, onProgress, campaignId);
    }

    logger.info(`Processing large email list (${totalEmails} emails) in chunks for memory efficiency`);

    const results = {
      total: totalEmails,
      successful: 0,
      failed: 0,
      batchesProcessed: 0,
      totalBatches: 0,
      details: [],
      rateLimited: false,
      skippedRecipients: 0,
      chunksProcessed: 0,
      totalChunks: Math.ceil(totalEmails / this.memoryConfig.chunkSize),
      errors: {
        authentication: 0,
        network: 0,
        rateLimit: 0,
        validation: 0,
        unknown: 0
      },
      statistics: {
        startTime: Date.now(),
        endTime: null,
        totalProcessingTime: 0,
        averageChunkTime: 0
      }
    };

    // Process emails in chunks
    for (let i = 0; i < totalEmails; i += this.memoryConfig.chunkSize) {
      const chunk = emails.slice(i, i + this.memoryConfig.chunkSize);
      const chunkStartTime = Date.now();
      const chunkNumber = results.chunksProcessed + 1;

      logger.info(`Processing chunk ${chunkNumber}/${results.totalChunks} (${chunk.length} emails)`);

      try {
        // Optimize batch size for this chunk
        const optimizedBatchSize = await this.optimizeBatchSize(options.batchSize);

        // Process chunk with optimized settings
        const chunkResult = await this.sendEmailsInBatches(
          chunk,
          { ...options, batchSize: optimizedBatchSize },
          (progress) => {
            // Adjust progress for overall processing
            if (onProgress) {
              const overallProgress = {
                ...progress,
                current: i + progress.current,
                total: totalEmails,
                chunkNumber: chunkNumber,
                totalChunks: results.totalChunks
              };
              onProgress(overallProgress);
            }
          },
          campaignId
        );

        // Aggregate results
        results.successful += chunkResult.successful;
        results.failed += chunkResult.failed;
        results.batchesProcessed += chunkResult.batchesProcessed;
        results.details.push(...chunkResult.details);
        results.rateLimited = results.rateLimited || chunkResult.rateLimited;
        results.skippedRecipients += chunkResult.skippedRecipients || 0;

        // Aggregate error counts
        Object.keys(chunkResult.errors).forEach(errorType => {
          results.errors[errorType] += chunkResult.errors[errorType];
        });

        results.chunksProcessed++;

        // Update statistics
        const chunkTime = Date.now() - chunkStartTime;
        results.statistics.averageChunkTime = (results.statistics.averageChunkTime * (results.chunksProcessed - 1) + chunkTime) / results.chunksProcessed;

        // Force garbage collection hint (if available)
        if (global.gc) {
          global.gc();
          logger.debug(`Garbage collection triggered after chunk ${chunkNumber}`);
        }

        // Brief pause between chunks to allow memory cleanup
        if (i + this.memoryConfig.chunkSize < totalEmails) {
          await this.delay(1000);
        }

      } catch (error) {
        logger.error(`Error processing chunk ${chunkNumber}: ${error.message}`);
        results.failed += chunk.length;
        results.errors.unknown += chunk.length;

        // Add failed chunk details
        chunk.forEach(email => {
          results.details.push({
            success: false,
            error: 'Chunk processing failed',
            errorCategory: 'UNKNOWN',
            recipient: email.to,
            companyName: email.companyName
          });
        });

        results.chunksProcessed++;
      }
    }

    // Calculate total batches across all chunks
    results.totalBatches = results.batchesProcessed;

    // Finalize statistics
    results.statistics.endTime = Date.now();
    results.statistics.totalProcessingTime = results.statistics.endTime - results.statistics.startTime;

    logger.info(`Large email list processing completed: ${results.successful}/${results.total} successful, ${results.failed} failed in ${results.chunksProcessed} chunks`);

    return results;
  }

  // Get memory usage statistics
  getMemoryStats() {
    const memUsage = process.memoryUsage();
    return {
      rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      external: Math.round(memUsage.external / 1024 / 1024), // MB
      failedRecipientsCount: this.failedRecipients.size,
      memoryOptimizationEnabled: this.memoryConfig.enableMemoryOptimization,
      maxEmailsInMemory: this.memoryConfig.maxEmailsInMemory
    };
  }

  // Generate comprehensive batch processing report
  generateBatchReport(results) {
    const report = {
      summary: {
        totalEmails: results.total,
        successful: results.successful,
        failed: results.failed,
        skipped: results.skippedRecipients || 0,
        successRate: results.total > 0 ? ((results.successful / results.total) * 100).toFixed(2) : 0,
        failureRate: results.total > 0 ? ((results.failed / results.total) * 100).toFixed(2) : 0
      },
      processing: {
        batchesProcessed: results.batchesProcessed,
        totalBatches: results.totalBatches,
        chunksProcessed: results.chunksProcessed || 0,
        totalChunks: results.totalChunks || 0,
        rateLimited: results.rateLimited
      },
      errors: results.errors,
      statistics: results.statistics,
      performance: {
        emailsPerSecond: results.statistics.totalProcessingTime > 0 ?
          (results.successful / (results.statistics.totalProcessingTime / 1000)).toFixed(2) : 0,
        averageBatchTime: results.statistics.averageBatchTime ?
          Math.round(results.statistics.averageBatchTime / 1000) : 0,
        totalTimeMinutes: Math.round(results.statistics.totalProcessingTime / 60000)
      },
      memory: this.getMemoryStats(),
      rateLimitStatus: this.getRateLimitStatus(),
      smtpCapabilities: null // Will be populated asynchronously if needed
    };

    // Add error analysis
    report.errorAnalysis = {
      mostCommonError: Object.entries(results.errors)
        .filter(([key, value]) => value > 0)
        .sort((a, b) => b[1] - a[1])[0] || ['none', 0],
      errorDistribution: results.errors
    };

    // Add recommendations
    report.recommendations = this.generateRecommendations(results);

    return report;
  }

  // Generate recommendations based on batch results
  generateRecommendations(results) {
    const recommendations = [];

    const successRate = results.total > 0 ? (results.successful / results.total) * 100 : 0;

    if (successRate < 50) {
      recommendations.push({
        type: 'CRITICAL',
        message: 'Low success rate detected. Check email credentials and recipient validation.',
        action: 'Verify SMTP configuration and recipient email addresses'
      });
    } else if (successRate < 80) {
      recommendations.push({
        type: 'WARNING',
        message: 'Moderate success rate. Consider reviewing rate limiting and delays.',
        action: 'Increase delays between emails or reduce batch sizes'
      });
    }

    if (results.errors.rateLimit > results.errors.network * 2) {
      recommendations.push({
        type: 'WARNING',
        message: 'High rate limiting detected. Current settings may trigger spam filters.',
        action: 'Increase delays between batches and reduce batch sizes'
      });
    }

    if (results.errors.authentication > 0) {
      recommendations.push({
        type: 'CRITICAL',
        message: 'Authentication errors detected. Email credentials may be invalid.',
        action: 'Verify and update email authentication settings'
      });
    }

    if (results.statistics.averageBatchTime > 60000) { // More than 1 minute per batch
      recommendations.push({
        type: 'INFO',
        message: 'Slow batch processing detected. Consider optimizing batch sizes.',
        action: 'Reduce batch size or increase delays for better performance'
      });
    }

    if (results.skippedRecipients > results.total * 0.1) { // More than 10% skipped
      recommendations.push({
        type: 'WARNING',
        message: 'High number of skipped recipients. Review recipient validation.',
        action: 'Check recipient email addresses for validity'
      });
    }

    return recommendations;
  }

  // Enhanced progress tracking with real-time updates
  createProgressTracker(onProgress = null, options = {}) {
    const tracker = {
      startTime: Date.now(),
      lastUpdate: Date.now(),
      updateInterval: options.updateInterval || 5000, // 5 seconds
      onProgress,
      stats: {
        current: 0,
        total: 0,
        successful: 0,
        failed: 0,
        batchNumber: 0,
        totalBatches: 0,
        rateLimited: false,
        estimatedTimeRemaining: 0
      },

      update: function(progress) {
        const now = Date.now();
        Object.assign(this.stats, progress);

        // Calculate estimated time remaining
        if (this.stats.current > 0 && this.stats.total > 0) {
          const elapsed = now - this.startTime;
          const progressRatio = this.stats.current / this.stats.total;
          const estimatedTotal = elapsed / progressRatio;
          this.stats.estimatedTimeRemaining = Math.max(0, estimatedTotal - elapsed);
        }

        // Throttle updates to prevent spam
        if (now - this.lastUpdate >= this.updateInterval || progress.current === progress.total) {
          this.lastUpdate = now;

          if (this.onProgress) {
            this.onProgress({
              ...this.stats,
              timestamp: now,
              elapsed: now - this.startTime
            });
          }
        }
      },

      getFinalStats: function() {
        return {
          ...this.stats,
          totalTime: Date.now() - this.startTime,
          finalTimestamp: Date.now()
        };
      }
    };

    return tracker;
  }

  // Validate and sanitize email input data
  validateAndSanitizeEmailData(emailData) {
    const sanitized = { ...emailData };
    const errors = [];

    // Validate recipient email
    if (!sanitized.to || typeof sanitized.to !== 'string') {
      errors.push('Recipient email is required');
    } else {
      // Basic email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(sanitized.to.trim())) {
        errors.push('Invalid email format');
      }
      sanitized.to = sanitized.to.trim().toLowerCase();

      // Prevent email injection
      if (sanitized.to.includes('\n') || sanitized.to.includes('\r') ||
          sanitized.to.includes('<') || sanitized.to.includes('>')) {
        errors.push('Invalid characters in email address');
      }
    }

    // Validate subject
    if (sanitized.subject && typeof sanitized.subject === 'string') {
      sanitized.subject = sanitized.subject.trim();
      if (sanitized.subject.length > 200) {
        errors.push('Subject too long (max 200 characters)');
      }
      // Remove potential injection characters
      sanitized.subject = sanitized.subject.replace(/[\r\n]/g, ' ');
    }

    // Validate and sanitize HTML content
    if (sanitized.html && typeof sanitized.html === 'string') {
      // Remove dangerous HTML/script content
      sanitized.html = sanitized.html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/vbscript:/gi, '')
        .replace(/onload\s*=/gi, '')
        .replace(/onerror\s*=/gi, '')
        .replace(/onclick\s*=/gi, '')
        .replace(/onmouseover\s*=/gi, '');

      // Basic length check
      if (sanitized.html.length > 100000) {
        errors.push('Email content too long (max 100,000 characters)');
      }
    }

    // Validate company name
    if (sanitized.companyName && typeof sanitized.companyName === 'string') {
      sanitized.companyName = sanitized.companyName.trim();
      if (sanitized.companyName.length > 100) {
        errors.push('Company name too long (max 100 characters)');
      }
      // Remove potential injection characters
      sanitized.companyName = sanitized.companyName.replace(/[<>\r\n]/g, '');
    }

    return {
      valid: errors.length === 0,
      sanitized,
      errors
    };
  }

  // Send emails in configurable batches with intelligent scheduling
  async sendEmailsInBatches(emails, options = {}, onProgress = null, campaignId = null) {
    const batchSize = this.validateBatchSize(options.batchSize);
    const delayMs = this.validateDelay(options.delayMs);
    const maxRetries = options.maxRetries || 3;

    // Filter out problematic recipients first
    const filteredEmails = this.filterProblematicRecipients(emails);
    const skippedCount = emails.length - filteredEmails.length;

    logger.email(`Starting batch processing: ${filteredEmails.length} emails in batches of ${batchSize} with ${delayMs}ms delay${skippedCount > 0 ? ` (${skippedCount} problematic recipients skipped)` : ''}`);

    const results = {
      total: filteredEmails.length,
      successful: 0,
      failed: 0,
      batchesProcessed: 0,
      totalBatches: Math.ceil(filteredEmails.length / batchSize),
      details: [],
      rateLimited: false,
      skippedRecipients: skippedCount,
      errors: {
        authentication: 0,
        network: 0,
        rateLimit: 0,
        validation: 0,
        unknown: 0
      },
      statistics: {
        startTime: Date.now(),
        endTime: null,
        averageBatchTime: 0,
        totalProcessingTime: 0
      }
    };

    // Process emails in batches
    for (let i = 0; i < filteredEmails.length; i += batchSize) {
      const batch = filteredEmails.slice(i, i + batchSize);
      const batchStartTime = Date.now();
      const batchNumber = results.batchesProcessed + 1;

      logger.email(`Processing batch ${batchNumber}/${results.totalBatches} (${batch.length} emails)`);

      try {
        // Send current batch
        const batchResult = await this.sendEmailBatch(batch, delayMs, (progress) => {
          // Adjust progress for overall batch processing
          const overallProgress = {
            ...progress,
            current: i + progress.current,
            total: filteredEmails.length,
            batchNumber: batchNumber,
            totalBatches: results.totalBatches
          };

          if (onProgress) onProgress(overallProgress);
        }, campaignId);

        // Aggregate results
        results.successful += batchResult.successful;
        results.failed += batchResult.failed;
        results.details.push(...batchResult.details);
        results.rateLimited = results.rateLimited || batchResult.rateLimited;

        // Aggregate error counts
        Object.keys(batchResult.errors).forEach(errorType => {
          results.errors[errorType] += batchResult.errors[errorType];
        });

        // Record recipient failures for problematic recipient tracking
        batchResult.details.forEach(detail => {
          if (!detail.success && detail.recipient) {
            this.recordRecipientFailure(detail.recipient);
          } else if (detail.success && detail.recipient) {
            this.clearRecipientFailure(detail.recipient);
          }
        });

        results.batchesProcessed++;

        // Update statistics
        const batchTime = Date.now() - batchStartTime;
        results.statistics.averageBatchTime = (results.statistics.averageBatchTime * (results.batchesProcessed - 1) + batchTime) / results.batchesProcessed;

        // Intelligent delay between batches (if not the last batch)
        if (i + batchSize < filteredEmails.length) {
          const adaptiveDelay = this.calculateAdaptiveDelay(delayMs, batchResult);
          logger.debug(`Waiting ${adaptiveDelay}ms before next batch (adaptive delay)`);
          await this.delay(adaptiveDelay);
        }

      } catch (error) {
        logger.error(`Error processing batch ${batchNumber}: ${error.message}`);

        // Attempt to retry the failed batch
        const failedEmails = batch.map(email => email); // Copy batch
        const retryResult = await this.retryFailedBatch(failedEmails, batchNumber, { maxRetries: 2 });

        if (retryResult.successful > 0) {
          // Partial success from retry
          results.successful += retryResult.successful;
          results.failed += retryResult.failed;
          results.details.push(...retryResult.details);
        } else {
          // Complete failure
          results.failed += batch.length;
          results.errors.unknown += batch.length;

          // Add failed batch details
          batch.forEach(email => {
            results.details.push({
              success: false,
              error: 'Batch processing failed after retries',
              errorCategory: 'UNKNOWN',
              recipient: email.to,
              companyName: email.companyName
            });
            this.recordRecipientFailure(email.to);
          });
        }

        results.batchesProcessed++;

        // Continue with next batch unless max retries exceeded
        if (results.batchesProcessed >= maxRetries) {
          logger.error(`Maximum batch retries (${maxRetries}) exceeded, stopping batch processing`);
          break;
        }
      }
    }

    // Finalize statistics
    results.statistics.endTime = Date.now();
    results.statistics.totalProcessingTime = results.statistics.endTime - results.statistics.startTime;

    logger.email(`Batch processing completed: ${results.successful}/${results.total} successful, ${results.failed} failed in ${results.batchesProcessed} batches${results.skippedRecipients > 0 ? `, ${results.skippedRecipients} skipped` : ''}`);
    if (results.rateLimited) {
      logger.warning('Rate limiting detected during batch processing');
    }

    return results;
  }

  // Calculate adaptive delay based on batch results and rate limiting
  calculateAdaptiveDelay(baseDelay, batchResult) {
    if (!this.batchConfig.adaptiveDelayEnabled) {
      return baseDelay;
    }

    let adaptiveDelay = baseDelay;

    // Increase delay if rate limited
    if (batchResult.rateLimited) {
      adaptiveDelay = Math.min(adaptiveDelay * 2, this.batchConfig.maxDelayMs);
      logger.debug(`Rate limiting detected, increasing delay to ${adaptiveDelay}ms`);
    }

    // Increase delay if high failure rate
    const failureRate = batchResult.failed / (batchResult.successful + batchResult.failed);
    if (failureRate > 0.5) {
      adaptiveDelay = Math.min(adaptiveDelay * 1.5, this.batchConfig.maxDelayMs);
      logger.debug(`High failure rate (${(failureRate * 100).toFixed(1)}%), increasing delay to ${adaptiveDelay}ms`);
    }

    // Decrease delay if all successful and no rate limiting
    if (batchResult.failed === 0 && !batchResult.rateLimited && adaptiveDelay > this.batchConfig.minDelayMs) {
      adaptiveDelay = Math.max(adaptiveDelay * 0.9, this.batchConfig.minDelayMs);
      logger.debug(`All emails successful, decreasing delay to ${adaptiveDelay}ms`);
    }

    return Math.round(adaptiveDelay);
  }

  // Send batch of emails with delay and rate limiting (legacy method, now uses sendEmailsInBatches internally)
  async sendEmailBatch(emails, delayMs = 10000, onProgress = null, campaignId = null) {
    const results = {
      total: emails.length,
      successful: 0,
      failed: 0,
      details: [],
      rateLimited: false,
      errors: {
        authentication: 0,
        network: 0,
        rateLimit: 0,
        validation: 0,
        unknown: 0
      }
    };

    logger.email(`Starting batch email sending: ${emails.length} emails with ${delayMs}ms delay`);

    for (let i = 0; i < emails.length; i++) {
      const emailData = emails[i];

      try {
        // Send email
        const result = await this.sendEmail(emailData, 0, campaignId);

        if (result.success) {
          results.successful++;
        } else {
          results.failed++;
          // Track error categories
          if (result.errorCategory) {
            results.errors[result.errorCategory.toLowerCase()]++;
            if (result.errorCategory === 'RATE_LIMIT') {
              results.rateLimited = true;
            }
          } else {
            results.errors.unknown++;
          }
        }

        results.details.push(result);

        // Call progress callback if provided
        if (onProgress && typeof onProgress === 'function') {
          onProgress({
            current: i + 1,
            total: emails.length,
            successful: results.successful,
            failed: results.failed,
            currentEmail: result,
            rateLimited: results.rateLimited
          });
        }

        // Add delay between emails (except for the last one)
        if (i < emails.length - 1) {
          logger.debug(`Waiting ${delayMs}ms before next email...`);
          await this.delay(delayMs);
        }
      } catch (error) {
        logger.error(`Unexpected error in batch processing: ${this.sanitizeErrorMessage(error, emailData.to)}`);
        results.failed++;
        results.errors.unknown++;

        results.details.push({
          success: false,
          error: this.getSafeErrorMessage('UNKNOWN', error),
          errorCategory: 'UNKNOWN',
          recipient: emailData.to,
          companyName: emailData.companyName
        });
      }
    }

    logger.email(`Batch email sending completed: ${results.successful} successful, ${results.failed} failed`);
    if (results.rateLimited) {
      logger.warning('Rate limiting detected during batch sending');
    }

    return results;
  }

  // Create email from template
  createEmailFromTemplate(template, recipient, templateVariables = {}) {
    try {
      // Prepare template variables
      const variables = {
        company_name: recipient.company_name || recipient.companyName,
        email: recipient.email,
        name: recipient.name,
        ...templateVariables
      };

      // Render template
      const rendered = template.render(variables);
      if (!rendered) {
        throw new Error('Template rendering failed');
      }

      // Use recipient-specific subject/message if available, otherwise use template
      const subject = recipient.subject || rendered.subject;
      let html = recipient.message_body || rendered.content;

      // If using recipient message_body, ensure it's HTML formatted
      if (recipient.message_body && !recipient.message_body.includes('<')) {
        // Convert plain text to simple HTML
        html = recipient.message_body.replace(/\n/g, '<br>');
      }

      // Create email object
      const emailData = {
        to: recipient.email,
        subject: subject,
        html: html,
        companyName: variables.company_name,
        templateVariables: variables
      };

      return new Email(emailData);
    } catch (error) {
      logger.error(`Failed to create email from template: ${error.message}`);
      return null;
    }
  }

  // Prepare emails from campaign data
  prepareEmailsFromCampaign(campaign, recipients = null) {
    try {
      // Load template - prioritize templateId over template content
      let template;
      if (campaign.templateId) {
        const Template = require('../models/Template');
        template = Template.getTemplateById(campaign.templateId);
        if (!template) {
          logger.warning(`Template ${campaign.templateId} not found, falling back to campaign template`);
          template = new Template({
            content: campaign.template,
            subject: campaign.subject
          });
        }
      } else {
        template = new Template({
          content: campaign.template,
          subject: campaign.subject
        });
      }

      const contacts = recipients || campaign.contacts;
      const emails = [];

      for (const contact of contacts) {
        const email = this.createEmailFromTemplate(template, contact);
        if (email) {
          // Add attachments if available
          if (campaign.attachments && campaign.attachments.length > 0) {
            campaign.attachments.forEach(att => {
              email.addAttachment(att);
            });
          }

          // Add resume doc link to email content if available
          if (campaign.resumeDocLink) {
            const resumeSection = `
              <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 5px; border-left: 4px solid #667eea;">
                <p style="margin: 0; font-size: 14px; color: #333;">
                  <strong>📄 Resume:</strong> 
                  <a href="${campaign.resumeDocLink}" target="_blank" style="color: #667eea; text-decoration: none;">
                    View my complete resume and portfolio
                  </a>
                </p>
              </div>`;
            
            email.html += resumeSection;
          }

          emails.push(email);
        }
      }

      logger.email(`Prepared ${emails.length} emails from campaign data`);
      return emails;
    } catch (error) {
      logger.error(`Failed to prepare emails from campaign: ${error.message}`);
      return [];
    }
  }

  // Verify email configuration
  async verifyConfiguration() {
    try {
      const verification = await emailConfig.verifyConnection();
      if (verification.success) {
        logger.email('Email configuration verified successfully');
        return verification;
      } else {
        logger.error(`Email configuration verification failed: ${verification.error}`);
        return verification;
      }
    } catch (error) {
      logger.error(`Email configuration verification failed: ${this.sanitizeErrorMessage(error)}`);
      return {
        success: false,
        error: 'Configuration verification failed',
        errorType: 'UNKNOWN'
      };
    }
  }

  // Utility function to add delay
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Estimate email sending time
  estimateSendingTime(emailCount, delayMs = 10000) {
    const totalTimeMs = (emailCount - 1) * delayMs; // No delay after last email
    const totalTimeMinutes = Math.ceil(totalTimeMs / 60000);
    
    return {
      totalTimeMs,
      totalTimeMinutes,
      estimatedCompletion: new Date(Date.now() + totalTimeMs),
      breakdown: {
        emails: emailCount,
        delayBetweenEmails: `${delayMs / 1000} seconds`,
        totalDelayTime: `${totalTimeMinutes} minutes`
      }
    };
  }

  // Clean up attachments after sending
  cleanupAttachments(emails) {
    const cleanedFiles = [];
    
    emails.forEach(email => {
      if (email.attachments && email.attachments.length > 0) {
        email.attachments.forEach(attachment => {
          if (attachment.path && FileUtils.deleteFile(attachment.path)) {
            cleanedFiles.push(attachment.filename);
          }
        });
      }
    });

    if (cleanedFiles.length > 0) {
      logger.file(`Cleaned up ${cleanedFiles.length} attachment files`);
    }
  }

  // Send batch of emails for a specific campaign with enhanced batch processing
  async sendCampaignBatch(campaignId, batchSize, onProgress = null) {
    try {
      // Get campaign service (we'll need to import it)
      const CampaignService = require('./campaignService');
      const campaignService = new CampaignService();

      const campaign = campaignService.getCampaignById(campaignId);
      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      // Get next batch of contacts that haven't been sent yet
      const nextBatch = campaignService.getNextBatch(campaignId);
      if (!nextBatch || !nextBatch.contacts || nextBatch.contacts.length === 0) {
        logger.info(`No more emails to send for campaign ${campaignId}`);
        return { success: true, sent: 0, message: 'No pending emails' };
      }

      // Validate batch size using configuration
      const validatedBatchSize = this.validateBatchSize(batchSize);
      const actualBatch = nextBatch.contacts.slice(0, validatedBatchSize);

      // Prepare emails from campaign and batch contacts
      const emails = this.prepareEmailsFromCampaign(campaign, actualBatch);

      // Use enhanced batch processing with intelligent scheduling
      const result = await this.sendEmailsInBatches(emails, {
        batchSize: 1, // Process individual emails within the batch (legacy behavior)
        delayMs: campaign.delay,
        maxRetries: this.maxRetries
      }, onProgress, campaignId);

      // Update campaign progress
      const updatedCampaign = campaignService.updateCampaignProgress(campaignId, result.successful, result.failed);

      logger.email(`Campaign ${campaignId}: Sent ${result.successful}/${result.total} emails in batch`);

      // Check if campaign is now completed
      if (updatedCampaign.status === 'completed') {
        logger.info(`🎉 Campaign ${campaignId} completed after this batch!`);

        // Emit completion event through event system instead of direct call
        if (global.schedulerService) {
          try {
            await global.schedulerService.completeCampaign(campaignId);
          } catch (error) {
            logger.error(`Error triggering campaign completion: ${error.message}`);
          }
        }
      }

      return {
        success: true,
        sent: result.successful,
        failed: result.failed,
        total: result.total,
        batchesProcessed: result.batchesProcessed,
        statistics: result.statistics
      };

    } catch (error) {
      logger.error(`Error sending campaign batch ${campaignId}: ${error.message}`);
      throw error;
    }
  }
}

module.exports = EmailService;
