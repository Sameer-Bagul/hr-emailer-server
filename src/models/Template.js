const fs = require("fs");
const path = require("path");
const Handlebars = require("handlebars");
const FileUtils = require("../utils/fileUtils");
const logger = require("../utils/logger");

class Template {
  constructor(data) {
    this.id = data.id || null;
    this.name = data.name || "Untitled Template";
    this.content = data.content || "";
    this.subject = data.subject || "";
    this.variables = data.variables || [];
    this.type = data.type || "html";
    this.category = data.category || "job-application";
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.description = data.description || "";
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
      const subject = subjectMatch ? subjectMatch[1] : "";

      // Remove subject line from content
      const templateContent = content.replace(/^Subject:\s*.+$/m, "").trim();

      return new Template({
        name: path.basename(templatePath, path.extname(templatePath)),
        content: templateContent,
        subject: subject,
      });
    } catch (error) {
      logger.error(`Failed to load template from file: ${error.message}`);
      return null;
    }
  }

  // Get all available templates
  static getAllTemplates() {
    return [
      Template.getJobSearchTemplate(),
      Template.getLeadSearchTemplate()
    ];
  }

  // Get template by ID
  static getTemplateById(id) {
    const templates = Template.getAllTemplates();
    return templates.find(template => template.id === id) || null;
  }

  // Job Search Template
  static getJobSearchTemplate() {
    const subject = `Software Developer Opportunity | {{company_name}}`;
    const content = `Hi there,

I'm <strong>Sameer Bagul</strong>, a full-stack developer and final-year Computer Engineering student from the College of Engineering, Pune.

With over 40+ MERN projects and 2 years of freelance experience, I have developed scalable web applications, AI-driven platforms, and DevOps pipelines. My recent experience includes:

<strong>LabsCheck, Pune</strong> – Built full-stack systems and automated lead operations for 100,000+ leads using AI agents.

<strong>Walnut Solutions</strong> – Improved SEO and engagement by 30% through responsive web applications in Next.js.

<strong>Smart India Hackathon Winner</strong> – Developed HireMe | Skillify, an AI-powered skill development platform serving 1,000+ users.

I am particularly skilled in MERN Stack, Next.js, AI/ML (PyTorch, LangChain, Hugging Face), and DevOps tools (Docker, Nginx, CI/CD). My portfolio and projects can be viewed here: <a href="http://sameerbagul.me">Portfolio</a> | <a href="https://github.com/Sameer-Bagul">GitHub</a>.

I am seeking internship or entry-level opportunities at {{company_name}} where I can contribute my technical skills, problem-solving mindset, and passion for innovation. I would love the chance to discuss how I can add value to your team.

Please find my resume attached for your reference.
Looking forward to your response.

Best regards,
<strong>Sameer Bagul</strong>
+91 7841941033
<a href="mailto:sameerbagul2004@gmail.com">sameerbagul2004@gmail.com</a>`;

    return new Template({
      id: "job-search",
      name: "Job Search",
      content: content,
      subject: subject,
      variables: ["company_name"],
      category: "job-search",
      description: "Professional template for job applications and internship opportunities"
    });
  }

  // Lead Search Template
  static getLeadSearchTemplate() {
    const subject = `Partnership Opportunity - Full-Stack Development Services | {{company_name}}`;
    const content = `Hello,

I'm <strong>Sameer Bagul</strong>, a skilled full-stack developer specializing in modern web technologies and AI automation solutions.

I noticed {{company_name}} and believe there might be an opportunity for us to collaborate. I offer comprehensive development services including:

<strong>🚀 Full-Stack Development</strong>
• MERN Stack (MongoDB, Express.js, React, Node.js)
• Next.js & TypeScript applications
• Real-time applications with Socket.IO

<strong>📱 Mobile Development</strong>
• React Native cross-platform apps
• Progressive Web Applications (PWA)
• Responsive mobile-first design

<strong>🤖 AI & Automation</strong>
• AI-powered chatbots and automation
• Machine Learning integrations
• Process automation solutions

<strong>☁️ DevOps & Deployment</strong>
• Docker containerization
• CI/CD pipeline setup
• Cloud deployment (AWS, Vercel, Render)

<strong>Recent Project Highlights:</strong>
• Automated lead generation system processing 100,000+ leads
• AI-powered skill development platform with 1,000+ active users
• E-commerce solutions with payment gateway integrations

I'd love to discuss how I can help {{company_name}} with your development needs. Whether it's building a new application, optimizing existing systems, or implementing automation solutions, I'm here to deliver high-quality results.

Portfolio: <a href="http://sameerbagul.me">sameerbagul.me</a>
GitHub: <a href="https://github.com/Sameer-Bagul">github.com/Sameer-Bagul</a>

Let's schedule a call to explore potential collaboration opportunities.

Best regards,
<strong>Sameer Bagul</strong>
Full-Stack Developer & AI Specialist
+91 7841941033
<a href="mailto:sameerbagul2004@gmail.com">sameerbagul2004@gmail.com</a>`;

    return new Template({
      id: "lead-search",
      name: "Lead Search",
      content: content,
      subject: subject,
      variables: ["company_name"],
      category: "lead-search",
      description: "Professional template for freelancing opportunities and business partnerships"
    });
  }

  // Load default template (fallback to job search)
  static loadDefaultTemplate() {
    return Template.getJobSearchTemplate();
  }

  // Compile template with Handlebars
  compile() {
    try {
      this.compiledContent = Handlebars.compile(this.content);
      this.compiledSubject = Handlebars.compile(this.subject);
      return true;
    } catch (error) {
      logger.error(`Template compilation failed: ${error.message}`);
      return false;
    }
  }

  // Render template with variables
  render(variables = {}) {
    try {
      if (!this.compiledContent || !this.compiledSubject) {
        if (!this.compile()) {
          return null;
        }
      }

      return {
        content: this.compiledContent(variables),
        subject: this.compiledSubject(variables)
      };
    } catch (error) {
      logger.error(`Template rendering failed: ${error.message}`);
      return null;
    }
  }

  // Validate template
  isValid() {
    const errors = [];

    if (!this.content || this.content.trim().length === 0) {
      errors.push('Template content is required');
    }

    if (!this.subject || this.subject.trim().length === 0) {
      errors.push('Template subject is required');
    }

    // Test compilation
    try {
      Handlebars.compile(this.content);
      Handlebars.compile(this.subject);
    } catch (error) {
      errors.push(`Invalid Handlebars syntax: ${error.message}`);
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
      company_name: "TechCorp Inc.",
      email: "hr@techcorp.com",
      name: "John Doe",
      position: "Software Developer",
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
      ...this.toJSON(),
      id: null,
      name: newName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      content: this.content,
      subject: this.subject,
      variables: this.variables,
      type: this.type,
      category: this.category,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      description: this.description
    };
  }
}

module.exports = Template;
