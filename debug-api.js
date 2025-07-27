const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testEmailAPI() {
  try {
    console.log('=== Testing Email API ===');
    
    // Create a simple test Excel file or use existing one
    const excelPath = path.join(__dirname, 'test-companies.xlsx');
    
    if (!fs.existsSync(excelPath)) {
      console.error('Demo Excel file not found:', excelPath);
      return;
    }
    
    const form = new FormData();
    form.append('file', fs.createReadStream(excelPath));
    form.append('userEmail', 'test@example.com');
    form.append('campaignType', 'multi-day');
    form.append('delayMs', '5000');
    
    console.log('Sending request to API...');
    
    const response = await axios.post('http://localhost:5000/api/send-emails', form, {
      headers: {
        ...form.getHeaders(),
      },
    });
    
    console.log('Response:', response.data);
    
  } catch (error) {
    console.error('API test failed:', error.response?.data || error.message);
  }
}

testEmailAPI();
