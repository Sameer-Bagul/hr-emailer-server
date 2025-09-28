const Template = require('../models/Template');
const logger = require('../utils/logger');

class TemplateController {
  // GET /api/templates - Get all templates
  async getAllTemplates(req, res) {
    try {
      const templates = Template.getAllTemplates();
      res.json({
        templates: templates.map(t => t.toJSON()),
        count: templates.length
      });
    } catch (error) {
      logger.error(`Error getting all templates: ${error.message}`);
      res.status(500).json({ error: 'Failed to get templates' });
    }
  }

  // GET /api/templates/:id - Get template by ID
  async getTemplateById(req, res) {
    try {
      const { id } = req.params;
      const template = Template.getTemplateById(id);
      
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      res.json(template.toJSON());
    } catch (error) {
      logger.error(`Error getting template by ID: ${error.message}`);
      res.status(500).json({ error: 'Failed to get template' });
    }
  }

  // GET /api/template - Get default template (legacy support)
  async getDefaultTemplate(req, res) {
    try {
      const template = Template.loadDefaultTemplate();
      
      if (!template) {
        return res.status(500).json({ error: 'Failed to load template' });
      }

      res.json({
        template: template.content,
        subject: template.subject
      });
    } catch (error) {
      logger.error(`Error loading template: ${error.message}`);
      res.status(500).json({ error: 'Failed to load template' });
    }
  }

  // GET /api/template/preview - Preview template with sample data
  async previewTemplate(req, res) {
    try {
      const templateId = req.query.templateId || 'job-application';
      const template = Template.getTemplateById(templateId);
      
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
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
        sampleData,
        template: template.toJSON()
      });
    } catch (error) {
      logger.error(`Error previewing template: ${error.message}`);
      res.status(500).json({ error: 'Failed to preview template' });
    }
  }

  // GET /api/template/variables - Get template variables
  async getTemplateVariables(req, res) {
    try {
      const templateId = req.query.templateId || 'job-application';
      const template = Template.getTemplateById(templateId);
      
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      const variables = template.extractVariables();
      
      res.json({
        variables,
        description: {
          company_name: 'Company name from Excel file',
          email: 'Recipient email address'
        },
        template: template.toJSON()
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
      const { content, subject, variables, templateId } = req.body;
      
      let template;
      
      if (templateId) {
        template = Template.getTemplateById(templateId);
        if (!template) {
          return res.status(404).json({ error: 'Template not found' });
        }
      } else {
        if (!content) {
          return res.status(400).json({ error: 'Template content is required' });
        }
        
        template = new Template({
          name: 'custom',
          content,
          subject: subject || ''
        });
      }

      const rendered = template.render(variables || {});
      
      if (!rendered) {
        return res.status(500).json({ error: 'Failed to render template' });
      }

      res.json({
        content: rendered.content,
        subject: rendered.subject,
        variables: template.extractVariables(),
        template: template.toJSON()
      });
    } catch (error) {
      logger.error(`Error rendering template: ${error.message}`);
      res.status(500).json({ error: 'Failed to render template' });
    }
  }
}

module.exports = TemplateController;
