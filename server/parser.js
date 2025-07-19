const XLSX = require('xlsx');

const parseExcelFile = async (filePath) => {
  try {
    // Read the Excel file
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Get first sheet
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    // Process and validate data
    const recipients = [];
    
    for (const row of data) {
      // Try different possible column names for company and email
      const companyName = row['Company Name'] || 
                         row['Company'] || 
                         row['company_name'] || 
                         row['company'] ||
                         row['Organization'] ||
                         row['Org'];
      
      const email = row['Email'] || 
                   row['email'] || 
                   row['Email Address'] || 
                   row['email_address'] ||
                   row['Contact Email'];
      
      // Validate that we have both company name and email
      if (companyName && email && isValidEmail(email)) {
        recipients.push({
          company_name: companyName.toString().trim(),
          email: email.toString().trim().toLowerCase()
        });
      }
    }
    
    // Remove duplicates based on email
    const uniqueRecipients = recipients.filter((recipient, index, self) =>
      index === self.findIndex(r => r.email === recipient.email)
    );
    
    return uniqueRecipients;
  } catch (error) {
    throw new Error(`Failed to parse Excel file: ${error.message}`);
  }
};

// Email validation function
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

module.exports = {
  parseExcelFile
};
