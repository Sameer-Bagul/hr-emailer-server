const nodemailer = require('nodemailer');
const Handlebars = require('handlebars');

// Configure Gmail transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PASS
    }
  });
};

// Send individual email
const sendEmail = async (transporter, recipient, compiledTemplate, subject, attachmentData = null) => {
  try {
    const html = compiledTemplate({ 
      company_name: recipient.company_name,
      email: recipient.email 
    });

    // Compile the subject template as well
    const compiledSubject = Handlebars.compile(subject || 'Opportunities in Software Development | {{company_name}}');
    const finalSubject = compiledSubject({
      company_name: recipient.company_name,
      email: recipient.email
    });

    const mailOptions = {
      from: process.env.EMAIL,
      to: recipient.email,
      subject: finalSubject,
      html: html
    };

    // Add attachments if provided
    if (attachmentData) {
      const attachments = [];
      
      // Add resume PDF if provided
      if (attachmentData.resumeFile) {
        attachments.push({
          filename: attachmentData.resumeFile.filename,
          path: attachmentData.resumeFile.path,
          contentType: attachmentData.resumeFile.contentType
        });
      }
      
      // Add resume Google Doc link in email body if provided
      if (attachmentData.resumeDocLink) {
        mailOptions.html += `
          <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #007bff; border-radius: 4px;">
            <h4 style="margin: 0 0 10px 0; color: #007bff; font-size: 16px;">📄 Resume Links</h4>
            <p style="margin: 0; font-size: 14px;">
              <strong>Online Resume:</strong> 
              <a href="${attachmentData.resumeDocLink}" target="_blank" style="color: #007bff; text-decoration: none;">
                View Resume (Google Docs)
              </a>
            </p>
            ${attachmentData.resumeFile ? '<p style="margin: 5px 0 0 0; font-size: 14px;"><strong>PDF Resume:</strong> Attached to this email</p>' : ''}
          </div>`;
      }
      
      if (attachments.length > 0) {
        mailOptions.attachments = attachments;
      }
    }

    const result = await transporter.sendMail(mailOptions);
    return { success: true, recipient, messageId: result.messageId };
  } catch (error) {
    return { success: false, recipient, error: error.message };
  }
};

// Send batch of emails with delay
const sendEmailBatch = async (recipients, compiledTemplate, subject, delayMs, io, attachmentData = null) => {
  const transporter = createTransporter();
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];
    
    try {
      // Send email
      const result = await sendEmail(transporter, recipient, compiledTemplate, subject, attachmentData);
      
      if (result.success) {
        successCount++;
        io.emit('emailStatus', {
          type: 'success',
          message: `✅ Email sent to ${recipient.company_name} (${recipient.email})`,
          progress: {
            current: i + 1,
            total: recipients.length,
            successCount,
            failureCount
          }
        });
      } else {
        failureCount++;
        io.emit('emailStatus', {
          type: 'error',
          message: `❌ Failed to send to ${recipient.company_name} (${recipient.email}): ${result.error}`,
          progress: {
            current: i + 1,
            total: recipients.length,
            successCount,
            failureCount
          }
        });
      }
    } catch (error) {
      failureCount++;
      io.emit('emailStatus', {
        type: 'error',
        message: `❌ Error sending to ${recipient.company_name}: ${error.message}`,
        progress: {
          current: i + 1,
          total: recipients.length,
          successCount,
          failureCount
        }
      });
    }

    // Add delay between emails (except for the last one)
    if (i < recipients.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  // Clean up resume file after all emails are sent
  if (attachmentData && attachmentData.resumeFile) {
    try {
      const fs = require('fs');
      fs.unlinkSync(attachmentData.resumeFile.path);
    } catch (cleanupError) {
      console.error('Error cleaning up resume file:', cleanupError);
    }
  }

  // Send completion message
  io.emit('emailStatus', {
    type: 'complete',
    message: `🎉 Email campaign completed! Success: ${successCount}, Failed: ${failureCount}`,
    progress: {
      current: recipients.length,
      total: recipients.length,
      successCount,
      failureCount
    }
  });
};

module.exports = {
  sendEmail,
  sendEmailBatch,
  createTransporter
};
