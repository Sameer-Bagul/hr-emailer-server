import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Send, Upload, FileSpreadsheet, Mail, Clock, Info, Eye, EyeOff, FileText, Link } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const EmailForm = ({ onSendingStart, isSending }) => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm();
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedResume, setSelectedResume] = useState(null);
  const [resumeDocLink, setResumeDocLink] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [fixedTemplate, setFixedTemplate] = useState('');
  const [emailSubject, setEmailSubject] = useState('');

  // Load fixed template on component mount
  useEffect(() => {
    const loadFixedTemplate = async () => {
      try {
        const response = await axios.get('/api/template');
        setFixedTemplate(response.data.template);
        setEmailSubject(response.data.subject);
      } catch (error) {
        console.error('Error loading template:', error);
        toast.error('Failed to load email template');
      }
    };
    loadFixedTemplate();
  }, []);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
      ];
      
      if (allowedTypes.includes(file.type)) {
        setSelectedFile(file);
        toast.success(`File selected: ${file.name}`);
      } else {
        toast.error('Please select a valid Excel file (.xlsx or .xls)');
        setSelectedFile(null);
      }
    }
  };

  const handleResumeChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type === 'application/pdf') {
        if (file.size <= 5 * 1024 * 1024) { // 5MB limit
          setSelectedResume(file);
          toast.success(`Resume selected: ${file.name}`);
        } else {
          toast.error('Resume file must be smaller than 5MB');
          setSelectedResume(null);
        }
      } else {
        toast.error('Please select a PDF file for your resume');
        setSelectedResume(null);
      }
    }
  };

  const onSubmit = async (data) => {
    if (!selectedFile) {
      toast.error('Please select an Excel file');
      return;
    }

    setIsLoading(true);
    onSendingStart();

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('delayMs', data.delayMs);
      
      // Add resume data if provided
      if (selectedResume) {
        formData.append('resume', selectedResume);
      }
      if (resumeDocLink.trim()) {
        formData.append('resumeDocLink', resumeDocLink.trim());
      }
      
      // Subject and template are both fixed on server side now

      const response = await axios.post('/send-emails', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success(`Email sending started! Processing ${response.data.totalEmails} recipients.`);
      
    } catch (error) {
      console.error('Error sending emails:', error);
      toast.error(error.response?.data?.error || 'Failed to send emails');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="email-form">
      <div className="form-title">
        <Mail size={28} />
        HR Outreach Email Campaign
      </div>
      <p className="form-subtitle">
        Upload your Excel file with company names and emails, customize your template, and send personalized outreach emails.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="form-grid">
        {/* File Upload */}
        <div className="form-group">
          <label className="form-label">
            <FileSpreadsheet size={18} />
            Excel File (Company Names & Emails)
          </label>
          <div className="file-input-wrapper">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="file-input"
              disabled={isSending}
            />
            <div className={`file-input-display ${selectedFile ? 'has-file' : ''}`}>
              <Upload size={20} />
              <span className={`file-info ${selectedFile ? 'has-file' : ''}`}>
                {selectedFile ? selectedFile.name : 'Click to upload Excel file'}
              </span>
            </div>
          </div>
          <div className="helper-text">
            <Info size={16} />
            <strong>Excel file should contain columns:</strong>
            <ul>
              <li><code>Company Name</code> or <code>Company</code></li>
              <li><code>Email</code> or <code>Email Address</code></li>
            </ul>
            Maximum 300 emails will be processed per campaign.
          </div>
        </div>

        {/* Resume Upload */}
        <div className="form-group">
          <label className="form-label">
            <FileText size={18} />
            Resume (PDF)
          </label>
          <div className="file-input-wrapper">
            <input
              type="file"
              accept=".pdf"
              onChange={handleResumeChange}
              className="file-input"
              disabled={isSending}
            />
            <div className={`file-input-display ${selectedResume ? 'has-file' : ''}`}>
              <Upload size={20} />
              <span className={`file-info ${selectedResume ? 'has-file' : ''}`}>
                {selectedResume ? selectedResume.name : 'Click to upload resume PDF'}
              </span>
            </div>
          </div>
          <div className="helper-text">
            <Info size={16} />
            <strong>Resume requirements:</strong>
            <ul>
              <li>PDF format only</li>
              <li>Maximum file size: 5MB</li>
            </ul>
          </div>
        </div>

        {/* Resume Google Doc Link */}
        <div className="form-group">
          <label htmlFor="resumeDocLink" className="form-label">
            <Link size={18} />
            Resume Google Doc Link (Optional)
          </label>
          <input
            id="resumeDocLink"
            type="url"
            className="form-input"
            placeholder="https://docs.google.com/document/d/..."
            value={resumeDocLink}
            onChange={(e) => setResumeDocLink(e.target.value)}
            disabled={isSending}
          />
          <div className="helper-text">
            <Info size={16} />
            Provide a Google Doc link to your resume for easy access
          </div>
        </div>

        {/* Delay Configuration */}
        <div className="form-group">
          <label htmlFor="delayMs" className="form-label">
            <Clock size={18} />
            Delay Between Emails (seconds)
          </label>
          <input
            id="delayMs"
            type="number"
            className="form-input"
            placeholder="10"
            min="5"
            max="60"
            disabled={isSending}
            {...register('delayMs', { 
              required: 'Delay is required',
              min: { value: 5, message: 'Minimum delay is 5 seconds' },
              max: { value: 60, message: 'Maximum delay is 60 seconds' },
              valueAsNumber: true,
              transform: (value) => value * 1000 // Convert to milliseconds
            })}
          />
          {errors.delayMs && (
            <span className="error-message">{errors.delayMs.message}</span>
          )}
        </div>

        {/* Email Template Preview */}
        <div className="form-group">
          <div className="form-label-with-action">
            <label className="form-label">
              <Mail size={18} />
              Email Template (Fixed)
            </label>
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="preview-toggle"
            >
              {showPreview ? <EyeOff size={16} /> : <Eye size={16} />}
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </button>
          </div>
          
          {showPreview && (
            <div className="template-preview">
              <div className="preview-header">
                <Mail size={16} />
                Complete Email Preview (with sample data)
              </div>
              <div className="preview-content">
                {fixedTemplate && emailSubject ? (
                  <div>
                    <div className="preview-subject">
                      <strong>Subject: </strong>
                      {emailSubject.replace(/\{\{company_name\}\}/g, 'TechCorp Inc.')}
                    </div>
                    <hr className="preview-divider" />
                    <pre className="template-text">
                      {fixedTemplate.replace(/\{\{company_name\}\}/g, 'TechCorp Inc.')}
                    </pre>
                  </div>
                ) : (
                  <div className="loading-template">Loading template...</div>
                )}
              </div>
            </div>
          )}
          
          <div className="helper-text">
            <Info size={16} />
            <strong>Fixed Email Features:</strong>
            <ul>
              <li><strong>Subject:</strong> Automatically includes company name</li>
              <li><strong>Content:</strong> Professional HR outreach message</li>
              <li><strong>Personalization:</strong> Company names from your Excel file</li>
              <li><strong>Portfolio:</strong> Includes technical skills and contact links</li>
              <li><strong>Consistency:</strong> Same professional format for all emails</li>
            </ul>
          </div>
        </div>

        <button 
          type="submit" 
          className="submit-button"
          disabled={isSending || isLoading || !selectedFile}
        >
          {isLoading || isSending ? (
            <>
              <div className="loading-spinner"></div>
              {isSending ? 'Sending Emails...' : 'Processing...'}
            </>
          ) : (
            <>
              <Send size={20} />
              Send Email Campaign
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default EmailForm;
