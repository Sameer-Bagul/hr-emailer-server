const Handlebars = require('handlebars');

// Convert plain text template to HTML
const convertToHTML = (text) => {
  // Convert line breaks to HTML
  let html = text.replace(/\n\n/g, '</p><p>'); // Double line breaks = new paragraphs
  html = html.replace(/\n/g, '<br>'); // Single line breaks = line breaks
  
  // Convert markdown-style formatting
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // **bold** to <strong>
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>'); // *italic* to <em>
  html = html.replace(/`(.*?)`/g, '<code>$1</code>'); // `code` to <code>
  
  // Convert links [text](url) to HTML
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #4f46e5; text-decoration: none;">$1</a>');
  
  // Convert bullet points (lines starting with -)
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul style="margin: 0.5rem 0; padding-left: 1.5rem;">$1</ul>');
  
  // Wrap in paragraphs
  html = '<p>' + html + '</p>';
  
  // Add some basic styling
  const styledHTML = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px;">
      ${html}
    </div>
  `;
  
  return styledHTML;
};

// Register custom helpers
Handlebars.registerHelper('capitalize', function(str) {
  if (typeof str !== 'string') return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
});

Handlebars.registerHelper('upper', function(str) {
  if (typeof str !== 'string') return str;
  return str.toUpperCase();
});

Handlebars.registerHelper('lower', function(str) {
  if (typeof str !== 'string') return str;
  return str.toLowerCase();
});

// Compile template function
const compileTemplate = (templateString) => {
  try {
    // Convert plain text template to HTML
    const htmlTemplate = convertToHTML(templateString);
    const template = Handlebars.compile(htmlTemplate);
    return template;
  } catch (error) {
    throw new Error(`Template compilation failed: ${error.message}`);
  }
};

// Validate template function
const validateTemplate = (templateString, sampleData = { company_name: 'Sample Company' }) => {
  try {
    const compiled = compileTemplate(templateString);
    const result = compiled(sampleData);
    return { valid: true, result };
  } catch (error) {
    return { valid: false, error: error.message };
  }
};

module.exports = {
  compileTemplate,
  validateTemplate,
  convertToHTML
};
