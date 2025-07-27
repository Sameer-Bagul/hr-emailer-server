const ExcelJS = require('exceljs');
const path = require('path');

async function createTestExcel() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Companies');
  
  // Add headers
  worksheet.columns = [
    { header: 'Company Name', key: 'company_name', width: 30 },
    { header: 'Email', key: 'email', width: 40 }
  ];
  
  // Add test data
  worksheet.addRow({
    company_name: 'Test Company 1',
    email: 'test1@example.com'
  });
  
  worksheet.addRow({
    company_name: 'Test Company 2',
    email: 'test2@example.com'
  });
  
  const excelPath = path.join(__dirname, 'test-companies.xlsx');
  await workbook.xlsx.writeFile(excelPath);
  console.log('Test Excel file created:', excelPath);
}

createTestExcel();
