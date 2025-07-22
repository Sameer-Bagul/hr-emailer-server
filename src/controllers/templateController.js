const Template = require('../models/Template');
const logger = require('../utils/logger');

class TemplateController {
  // GET /api/template - Get default template
  async getDefaultTemplate(req, res) {
    try {
      const template = Template.loadDefaultTemplate();
      
      if (!template) {
        return res.status(500).json({ error: 'Failed to load template' });
      }

      // Return template for preview (remove subject line from content for display)
      const templateContent = template.content;
      const subject = template.subject;

      res.json({
        template: templateContent,
        subject: subject
      });
    } catch (error) {
      logger.error(`Error loading template: ${error.message}`);
      res.status(500).json({ error: 'Failed to load template' });
    }
  }

  // GET /api/template/preview - Preview template with sample data
  async previewTemplate(req, res) {
    try {
      const template = Template.loadDefaultTemplate();
      
      if (!template) {
        return res.status(500).json({ error: 'Failed to load template' });
      }

      const sampleData = {
        company_name: req.query.company_name || 'TechCorp Inc.',
        email: req.query.email || 'hr@techcorp.com'
      };

      const preview = template.preview(sampleData);
      
      if (!preview) {
        return res.status(500).json({ error: 'Failed to generate template preview' });
      }

      res.json({
        preview: preview.content,
        subject: preview.subject,
        sampleData
      });
    } catch (error) {
      logger.error(`Error previewing template: ${error.message}`);
      res.status(500).json({ error: 'Failed to preview template' });
    }
  }

  // GET /api/template/variables - Get template variables
  async getTemplateVariables(req, res) {
    try {
      const template = Template.loadDefaultTemplate();
      
      if (!template) {
        return res.status(500).json({ error: 'Failed to load template' });
      }

      const variables = template.extractVariables();
      
      res.json({
        variables,
        description: {
          company_name: 'Company name from Excel file',
          email: 'Recipient email address'
        }
      });
    } catch (error) {
      logger.error(`Error getting template variables: ${error.message}`);
      res.status(500).json({ error: 'Failed to get template variables' });
    }
  }

  // POST /api/template/validate - Validate template syntax
  async validateTemplate(req, res) {
    try {
      const { content, subject } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: 'Template content is required' });
      }

      const template = new Template({
        name: 'validation',
        content,
        subject: subject || ''
      });

      const validation = template.isValid();
      
      res.json({
        valid: validation.valid,
        errors: validation.errors,
        variables: template.extractVariables()
      });
    } catch (error) {
      logger.error(`Error validating template: ${error.message}`);
      res.status(500).json({ error: 'Failed to validate template' });
    }
  }

  // POST /api/template/render - Render template with custom data
  async renderTemplate(req, res) {
    try {
      const { content, subject, variables } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: 'Template content is required' });
      }

      const template = new Template({
        name: 'custom',
        content,
        subject: subject || ''
      });

      const rendered = template.render(variables || {});
      
      if (!rendered) {
        return res.status(500).json({ error: 'Failed to render template' });
      }

      res.json({
        content: rendered.content,
        subject: rendered.subject,
        variables: template.extractVariables()
      });
    } catch (error) {
      logger.error(`Error rendering template: ${error.message}`);
      res.status(500).json({ error: 'Failed to render template' });
    }
  }
}

module.exports = TemplateController;
