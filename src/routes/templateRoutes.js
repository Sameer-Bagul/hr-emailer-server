const express = require('express');
const TemplateController = require('../controllers/templateController');

const router = express.Router();

// Create controller instance
const templateController = new TemplateController();

// Modern API routes
router.get('/', templateController.getAllTemplates.bind(templateController));
router.get('/:id', templateController.getTemplateById.bind(templateController));

// Legacy routes for backward compatibility
router.get('/template', templateController.getDefaultTemplate.bind(templateController));
router.get('/template/preview', templateController.previewTemplate.bind(templateController));
router.get('/template/variables', templateController.getTemplateVariables.bind(templateController));

// Template operations
router.post('/template/validate', templateController.validateTemplate.bind(templateController));
router.post('/template/render', templateController.renderTemplate.bind(templateController));

module.exports = router;
