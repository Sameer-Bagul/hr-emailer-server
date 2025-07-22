const XLSX = require('xlsx');
const FileUtils = require('../utils/fileUtils');
const logger = require('../utils/logger');

class FileService {
  // Parse Excel file and extract recipients
  async parseExcelFile(filePath) {
    try {
      logger.file(`Parsing Excel file: ${filePath}`);
      
      if (!FileUtils.readFile(filePath)) {
        throw new Error('File not found or cannot be read');
      }

      // Read the Excel file
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (data.length === 0) {
        throw new Error('Excel file is empty');
      }

      // Get headers
      const headers = data[0];
      const rows = data.slice(1);

      logger.debug(`Excel file contains ${rows.length} rows with headers: ${headers.join(', ')}`);

      // Process rows (limit to 1000 for performance)
      const maxRowsToProcess = Math.min(1000, rows.length);
      const recipients = [];

      for (let i = 0; i < maxRowsToProcess; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        // Create row object
        const rowObj = {};
        headers.forEach((header, index) => {
          if (header && row[index] !== undefined) {
            rowObj[header] = row[index];
          }
        });

        // Extract company name and email
        const companyName = this.extractCompanyName(rowObj);
        const email = this.extractEmail(rowObj);

        // Validate and add recipient
        if (companyName && email && FileUtils.isValidEmailFormat(email)) {
          recipients.push({
            company_name: companyName.toString().trim(),
            email: email.toString().trim().toLowerCase()
          });
        }
      }

      // Remove duplicates based on email
      const uniqueRecipients = this.removeDuplicateEmails(recipients);

      logger.file(`Successfully parsed ${uniqueRecipients.length} unique recipients from Excel file`);

      return {
        success: true,
        recipients: uniqueRecipients,
        totalRowsInFile: rows.length,
        rowsProcessed: maxRowsToProcess,
        wasLimited: rows.length > 1000
      };
    } catch (error) {
      logger.error(`Failed to parse Excel file: ${error.message}`);
      return {
        success: false,
        error: error.message,
        recipients: []
      };
    }
  }

  // Extract company name from row object
  extractCompanyName(row) {
    const companyFields = [
      'Company Name', 'Company', 'company_name', 'company',
      'Organization', 'Org', 'Employer', 'Business'
    ];

    for (const field of companyFields) {
      if (row[field] && row[field].toString().trim()) {
        return row[field].toString().trim();
      }
    }

    return null;
  }

  // Extract email from row object
  extractEmail(row) {
    const emailFields = [
      'Email', 'email', 'Email Address', 'email_address',
      'Contact Email', 'E-mail', 'Mail'
    ];

    for (const field of emailFields) {
      if (row[field] && row[field].toString().trim()) {
        return row[field].toString().trim();
      }
    }

    return null;
  }

  // Remove duplicate emails
  removeDuplicateEmails(recipients) {
    const seen = new Set();
    return recipients.filter(recipient => {
      if (seen.has(recipient.email)) {
        return false;
      }
      seen.add(recipient.email);
      return true;
    });
  }

  // Validate file before processing
  validateFile(file) {
    const errors = [];

    if (!file) {
      errors.push('No file provided');
      return { valid: false, errors };
    }

    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      errors.push('File size exceeds 5MB limit');
    }

    // Check file extension
    const allowedExtensions = ['.xlsx', '.xls'];
    const fileExtension = FileUtils.getFileExtension(file.originalname);
    
    if (!allowedExtensions.includes(fileExtension)) {
      errors.push('Only Excel files (.xlsx, .xls) are allowed');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Delete file
  deleteFile(filePath) {
    return FileUtils.deleteFile(filePath);
  }

  // Get file info
  getFileInfo(filePath) {
    try {
      const size = FileUtils.getFileSize(filePath);
      return {
        exists: true,
        size: {
          bytes: size,
          formatted: FileUtils.formatFileSize(size)
        },
        extension: FileUtils.getFileExtension(filePath)
      };
    } catch (error) {
      return {
        exists: false,
        error: error.message
      };
    }
  }

  // Create sample Excel file for download
  createSampleExcelFile() {
    try {
      const sampleData = [
        ['Company Name', 'Email'],
        ['TechCorp Inc.', 'hr@techcorp.com'],
        ['Innovate Solutions', 'careers@innovatesolutions.com'],
        ['Digital Dynamics', 'jobs@digitaldynamics.com'],
        ['Future Systems', 'recruitment@futuresystems.com']
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(sampleData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Companies');

      // Write to buffer
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      return {
        success: true,
        buffer,
        filename: 'sample-companies.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      };
    } catch (error) {
      logger.error(`Failed to create sample Excel file: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Analyze Excel file structure
  async analyzeExcelFile(filePath) {
    try {
      const workbook = XLSX.readFile(filePath);
      const analysis = {
        sheets: [],
        recommendedSheet: null,
        totalRows: 0,
        hasValidStructure: false
      };

      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (data.length > 0) {
          const headers = data[0];
          const rows = data.slice(1);
          
          const sheetInfo = {
            name: sheetName,
            headers,
            rowCount: rows.length,
            hasCompanyField: this.hasCompanyField(headers),
            hasEmailField: this.hasEmailField(headers)
          };

          analysis.sheets.push(sheetInfo);
          analysis.totalRows += rows.length;

          // Recommend sheet with both company and email fields
          if (sheetInfo.hasCompanyField && sheetInfo.hasEmailField) {
            analysis.recommendedSheet = sheetName;
            analysis.hasValidStructure = true;
          }
        }
      });

      return analysis;
    } catch (error) {
      logger.error(`Failed to analyze Excel file: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Check if headers contain company field
  hasCompanyField(headers) {
    const companyPatterns = /company|organization|org|employer|business/i;
    return headers.some(header => companyPatterns.test(header));
  }

  // Check if headers contain email field
  hasEmailField(headers) {
    const emailPatterns = /email|mail/i;
    return headers.some(header => emailPatterns.test(header));
  }
}

module.exports = FileService;
