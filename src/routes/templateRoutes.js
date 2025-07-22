const express = require('express');
const TemplateController = require('../controllers/templateController');

const router = express.Router();

// Create controller instance
const templateController = new TemplateController();

// GET /api/template - Get default template
router.get('/', templateController.getDefaultTemplate.bind(templateController));

// GET /api/template/preview - Preview template with sample data
router.get('/preview', templateController.previewTemplate.bind(templateController));

// GET /api/template/variables - Get template variables
router.get('/variables', templateController.getTemplateVariables.bind(templateController));

// POST /api/template/validate - Validate template syntax
router.post('/validate', templateController.validateTemplate.bind(templateController));

// POST /api/template/render - Render template with custom data
router.post('/render', templateController.renderTemplate.bind(templateController));

module.exports = router;
