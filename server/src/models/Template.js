const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const FileUtils = require('../utils/fileUtils');
const logger = require('../utils/logger');

class Template {
  constructor(data) {
    this.name = data.name;
    this.content = data.content;
    this.subject = data.subject;
    this.variables = data.variables || [];
    this.type = data.type || 'html'; // html, text, or both
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  // Load template from file
  static loadFromFile(templatePath) {
    try {
      const content = FileUtils.readFile(templatePath);
      if (!content) {
        throw new Error(`Template file not found: ${templatePath}`);
      }

      // Extract subject line if it exists
      const subjectMatch = content.match(/^Subject:\s*(.+)$/m);
      const subject = subjectMatch ? subjectMatch[1] : '';

      // Remove subject line from content
      const templateContent = content.replace(/^Subject:\s*.+$/m, '').trim();

      return new Template({
        name: path.basename(templatePath, path.extname(templatePath)),
        content: templateContent,
        subject: subject
      });
    } catch (error) {
      logger.error(`Failed to load template from file: ${error.message}`);
      return null;
    }
  }

  // Load default HR template
  static loadDefaultTemplate() {
    const defaultContent = `Dear Hiring Team at {{company_name}},

I hope this email finds you well. My name is Sameer Bagul, and I am a passionate and dedicated software developer with expertise in full-stack development, machine learning, and modern web technologies.

I am excited to express my interest in software development opportunities at {{company_name}}. With a strong foundation in JavaScript, Python, React, Node.js, and cloud technologies, I am confident that my skills and enthusiasm would make me a valuable addition to your development team.

Key highlights of my background:
• Full-stack development experience with modern frameworks
• Machine learning and AI implementation skills
• Strong problem-solving abilities and passion for clean, efficient code
• Experience with agile development methodologies
• Continuous learning mindset and adaptability to new technologies

I have attached my resume for your review and would welcome the opportunity to discuss how my skills and passion for technology can contribute to {{company_name}}'s continued success.

Thank you for considering my application. I look forward to hearing from you soon.

Best regards,
Sameer Bagul
Software Developer
Email: sameerbagul2004@gmail.com
Phone: [Your Phone Number]`;

    const defaultSubject = `Software Developer Opportunity | {{company_name}}`;

    return new Template({
      name: 'default-hr-template',
      content: defaultContent,
      subject: defaultSubject,
      variables: ['company_name'],
      type: 'html'
    });
  }

  // Compile template with Handlebars
  compile() {
    try {
      const compiledTemplate = Handlebars.compile(this.content);
      const compiledSubject = this.subject ? Handlebars.compile(this.subject) : null;

      return {
        template: compiledTemplate,
        subject: compiledSubject
      };
    } catch (error) {
      logger.error(`Failed to compile template: ${error.message}`);
      return null;
    }
  }

  // Render template with variables
  render(variables = {}) {
    try {
      const compiled = this.compile();
      if (!compiled) {
        throw new Error('Failed to compile template');
      }

      const renderedContent = compiled.template(variables);
      const renderedSubject = compiled.subject ? compiled.subject(variables) : this.subject;

      // Convert line breaks to HTML if type is html
      const finalContent = this.type === 'html' ? 
        renderedContent.replace(/\n/g, '<br>\n') : 
        renderedContent;

      return {
        content: finalContent,
        subject: renderedSubject,
        type: this.type
      };
    } catch (error) {
      logger.error(`Failed to render template: ${error.message}`);
      return null;
    }
  }

  // Validate template
  isValid() {
    const errors = [];

    if (!this.name || this.name.trim().length === 0) {
      errors.push('Template name is required');
    }

    if (!this.content || this.content.trim().length === 0) {
      errors.push('Template content is required');
    }

    // Try to compile template to check for syntax errors
    try {
      Handlebars.compile(this.content);
      if (this.subject) {
        Handlebars.compile(this.subject);
      }
    } catch (error) {
      errors.push(`Template syntax error: ${error.message}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Extract variables from template
  extractVariables() {
    const variableRegex = /\{\{([^}]+)\}\}/g;
    const variables = new Set();
    let match;

    // Extract from content
    while ((match = variableRegex.exec(this.content)) !== null) {
      variables.add(match[1].trim());
    }

    // Extract from subject
    if (this.subject) {
      while ((match = variableRegex.exec(this.subject)) !== null) {
        variables.add(match[1].trim());
      }
    }

    this.variables = Array.from(variables);
    return this.variables;
  }

  // Preview template with sample data
  preview(sampleData = {}) {
    const defaultSampleData = {
      company_name: 'TechCorp Inc.',
      email: 'hr@techcorp.com',
      name: 'John Doe',
      position: 'Software Developer'
    };

    const previewData = { ...defaultSampleData, ...sampleData };
    return this.render(previewData);
  }

  // Save template to file
  saveToFile(templatePath) {
    try {
      let content = this.content;
      
      // Add subject line if it exists
      if (this.subject) {
        content = `Subject: ${this.subject}\n\n${content}`;
      }

      return FileUtils.writeFile(templatePath, content);
    } catch (error) {
      logger.error(`Failed to save template to file: ${error.message}`);
      return false;
    }
  }

  // Clone template
  clone(newName) {
    return new Template({
      name: newName || `${this.name} (Copy)`,
      content: this.content,
      subject: this.subject,
      variables: [...this.variables],
      type: this.type
    });
  }

  toJSON() {
    return {
      name: this.name,
      content: this.content,
      subject: this.subject,
      variables: this.variables,
      type: this.type,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Template;
