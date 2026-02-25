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
      Template.getJobSearchTemplate()
    ];
  }

  // Get template by ID
  static getTemplateById(id) {
    const templates = Template.getAllTemplates();
    return templates.find(template => template.id === id) || null;
  }

  // Job Search Template
  static getJobSearchTemplate() {
    const subject = `Software Developer with AI & DevOps Experience`;
    const content = `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 650px; margin: 0 auto;">

  <p>Hi {{name}},</p>

  <p>
    I'm <strong>Sameer Bagul</strong>, a Full-Stack &amp; AI Engineer currently working at
    <strong>Hashnode (Bug0)</strong> as a Software Engineer, where I build AI agents for automated
    testing that help teams ship faster and improve development workflows.
  </p>

  <p>
    My work focuses on designing production-ready AI systems — including RAG-based tools,
    intelligent agents, developer-focused CLI tools, and scalable full-stack applications. I've
    also worked across DevOps, containerized deployments, and CI/CD pipelines to ensure systems
    are reliable and scalable in real-world environments.
  </p>

  <p>
    I've previously built and shipped AI-driven platforms in startup environments and have won
    multiple national-level hackathons for innovative AI solutions.
  </p>

  <p>
    Rather than listing everything here, I'd encourage you to check my portfolio — it includes
    detailed breakdowns of my projects, achievements, hackathon wins, and technical implementations.
  </p>

  <p>Resume is attached for reference.</p>

  <p style="margin-top: 20px; line-height: 2;">
    <strong>Portfolio:</strong> <a href="https://sameerbagul.me/" style="color:#3182ce; text-decoration:none;">https://sameerbagul.me/</a><br>
    <strong>GitHub:</strong> <a href="https://github.com/sameer-bagul" style="color:#3182ce; text-decoration:none;">https://github.com/sameer-bagul</a><br>
    <strong>LinkedIn:</strong> <a href="https://www.linkedin.com/in/sameer-bagul/" style="color:#3182ce; text-decoration:none;">https://www.linkedin.com/in/sameer-bagul/</a>
  </p>

  <p>
    If there's an opportunity to contribute to your team, I'd be glad to connect and discuss how I can add value.
  </p>

  <hr style="border:none; border-top:1px solid #e2e8f0; margin:25px 0;">

  <p style="margin-bottom:5px;"><strong>Best,</strong></p>
  <p style="margin-bottom:5px;"><strong>Sameer Bagul</strong></p>

</div>
`;

    return new Template({
      id: "job-search",
      name: "Job Search",
      content: content,
      subject: subject,
      variables: ["name"],
      category: "job-search",
      description: "Modern outreach template highlighting AI & DevOps engineering role at Hashnode"
    });
  }
  // Lead Search Template
  static getLeadSearchTemplate() {
    const subject = `Partnership Opportunity - Full-Stack Development Services | {{company_name}}`;

    const content = `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 650px; margin: 0 auto;">

  <p>Dear Hiring Manager,</p>

  <p>
    My name is <strong>Sameer Bagul</strong>, a final-year B.Tech (Information Technology) student at 
    <strong>PES Modern College of Engineering, Pune</strong>.  
    I am a <strong>Full-Stack & AI Developer with DevOps expertise</strong>, bringing 2+ years of freelancing and professional experience in building scalable web applications, AI-driven platforms, and modern deployment pipelines.
  </p>

  <p>
    In addition to my internships, my <strong>freelancing background</strong> has given me the opportunity to deliver high-quality solutions to real clients, enhancing my skills in end-to-end project execution, communication, and business impact.  
    This blend of <strong>industry, freelance, and academic experience</strong> makes me confident in my ability to take ownership of projects and excel in software development roles at <strong>{{company_name}}</strong>.
  </p>

  <h3 style="color:#2c5282; margin-top:25px; margin-bottom:10px;">Professional Experience</h3>
  <ul style="margin-left:20px; line-height:1.8;">
    <li><strong>LabsCheck, Pune</strong> – Built full-stack systems and automated lead operations for 100,000+ leads using AI agents; deployed medical lab platforms with Docker, Nginx & CI/CD achieving 99% uptime.</li>
    <li><strong>Walnut Solutions</strong> – Developed responsive Next.js applications, improving SEO and engagement by 30%, integrated APIs, and optimized UI performance.</li>
    <li><strong>Freelance Projects</strong> – Delivered custom software solutions such as <em>BillCraft</em> (multi-shop billing platform) and other MERN/Next.js platforms, driving measurable client growth and efficiency.</li>
  </ul>

  <h3 style="color:#2c5282; margin-top:25px; margin-bottom:10px;">Key Projects</h3>
  <ul style="margin-left:20px; line-height:1.8;">
    <li><strong>HireMe | Skillify</strong> – AI-powered skill development platform with 1,000+ users; Smart India Hackathon Winner 2024.</li>
    <li><strong>BillCraft (Freelance)</strong> – Multi-shop billing system for 18+ outlets and 200+ products with analytics dashboards.</li>
    <li><strong>Evento</strong> – Event management platform in Next.js, increasing student participation by 25% and supporting 500+ concurrent users.</li>
  </ul>

  <h3 style="color:#2c5282; margin-top:25px; margin-bottom:10px;">Technical Skills</h3>
  <p style="background:#f7fafc; padding:15px; border-left:4px solid #3182ce;">
    <strong>Languages:</strong> JavaScript, TypeScript, Python, Java, C, C++ <br>
    <strong>Frameworks:</strong> MERN, Next.js, React.js, Three.js <br>
    <strong>Databases:</strong> MongoDB, SQL, Firebase <br>
    <strong>DevOps:</strong> Docker, Nginx, Git, CI/CD, Portainer <br>
    <strong>AI/ML:</strong> PyTorch, TensorFlow, Hugging Face, LangChain, NLP
  </p>

  <p style="margin-top:25px;">
    Recognized as a <strong>Smart India Hackathon Winner</strong> and <strong>National Hackathon Champion</strong>, 
    I bring not only technical depth but also leadership, having mentored 200+ students as Technical Lead of the APP Club.  
    With my proven track record of delivering impactful freelance and professional projects, I believe I am well-positioned to contribute meaningfully at <strong>{{company_name}}</strong>.
  </p>

  <p>
    Please find my resume attached for your consideration. I would welcome the opportunity to discuss how I can support your team’s goals and deliver high-quality software solutions.
  </p>

  <p>Thank you for your time and consideration.</p>

  <hr style="border:none; border-top:1px solid #e2e8f0; margin:25px 0;">

  <p style="margin-bottom:5px;"><strong>Best regards,</strong></p>
  <p style="margin-bottom:5px;"><strong>Sameer Bagul</strong></p>
  <p style="margin-bottom:5px;">Pune, India</p>
  <p style="margin-bottom:5px;">+91 7841941033</p>
  <p style="margin-bottom:5px;">
    <a href="mailto:sameerbagul2004@gmail.com" style="color:#3182ce; text-decoration:none;">sameerbagul2004@gmail.com</a>
  </p>
  <p style="margin-bottom:5px;">
    <a href="http://sameerbagul.me" style="color:#3182ce; text-decoration:none;">Portfolio</a> | 
    <a href="https://github.com/Sameer-Bagul" style="color:#3182ce; text-decoration:none;">GitHub</a> | 
    <a href="https://linkedin.com/in/sameer-bagul" style="color:#3182ce; text-decoration:none;">LinkedIn</a>
  </p>

</div>
`;


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
