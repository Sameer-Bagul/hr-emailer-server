# 📊 Examples & Demo Files

This directory contains example files and utilities to help you get started with the HR Outreach Emailer application.

## 📁 Contents

### Demo Excel Files
- **`demo-companies.xlsx`** - Sample Excel file with tech company contacts
- **`demo-companies.csv`** - CSV version of the demo data

### Utility Scripts
- **`create-demo-excel.js`** - Generate demo Excel files for testing
- **`create-extended-demo.js`** - Create larger demo datasets
- **`verify-excel.js`** - Validate Excel file format and structure

### Documentation
- **`EXCEL_FORMAT.md`** - Detailed Excel file format requirements
- **`email-template.txt`** - Example email template (reference only)

## 🚀 Quick Start

### 1. Use Demo Excel File
The fastest way to test the application:

```bash
# The demo-companies.xlsx file is ready to use!
# Just upload it directly in the application
```

### 2. Create Custom Demo Data
Generate your own demo Excel file:

```bash
cd examples
npm install
node create-demo-excel.js
```

This creates a new Excel file with sample company data.

### 3. Verify Excel Format
Check if your Excel file has the correct format:

```bash
cd examples
node verify-excel.js path/to/your/file.xlsx
```

## 📋 Excel File Requirements

Your Excel file must contain these columns:

| Column Name | Alternatives | Required | Description |
|-------------|--------------|----------|-------------|
| `Company Name` | `Company` | ✅ Yes | Name of the company |
| `Email` | `Email Address` | ✅ Yes | Contact email address |

### Example Structure:
```
Company Name    | Email
Microsoft       | hr@microsoft.com
Google          | careers@google.com
Apple           | jobs@apple.com
Amazon          | recruiting@amazon.com
Meta            | talent@meta.com
```

## 🛠️ Utility Scripts

### create-demo-excel.js
Creates a demo Excel file with popular tech companies.

**Usage:**
```bash
node create-demo-excel.js [filename] [count]
```

**Parameters:**
- `filename` (optional) - Output filename (default: demo-companies.xlsx)
- `count` (optional) - Number of companies to include (default: 25)

**Example:**
```bash
# Create default demo file
node create-demo-excel.js

# Create custom demo file
node create-demo-excel.js my-demo.xlsx 50
```

### create-extended-demo.js
Creates larger demo datasets for testing with more companies.

**Features:**
- Includes 100+ tech companies
- Various company sizes (startups to enterprises)
- Different industries within tech sector
- Realistic email formats

### verify-excel.js
Validates Excel file structure and content.

**Checks:**
- Column names match requirements
- Email format validation
- Duplicate detection
- File format verification

**Usage:**
```bash
node verify-excel.js path/to/file.xlsx
```

**Output:**
```
✅ File format: Valid Excel file
✅ Columns found: Company Name, Email
✅ Total rows: 25
✅ Valid emails: 25
⚠️  Duplicates found: 2
✅ Ready for upload!
```

## 📧 Email Template Reference

The `email-template.txt` file shows the structure of email templates used by the application. 

**Note**: The application uses a fixed template, so this file is for reference only.

**Template Variables:**
- `{{company_name}}` - Replaced with company name from Excel
- Custom variables can be added if template system is extended

## 🎯 Testing Scenarios

### Small Dataset Testing
Use the default demo file (25 companies) for:
- Initial application testing
- Feature verification
- Development workflow testing

### Large Dataset Testing
Use extended demo (100+ companies) for:
- Performance testing
- Rate limiting verification
- Bulk email testing

### Custom Data Testing
Create your own Excel files for:
- Real-world company lists
- Specific industry targeting
- Custom email validation

## 🔧 Development Utilities

### Package.json Scripts
```json
{
  "scripts": {
    "demo": "node create-demo-excel.js",
    "demo:large": "node create-extended-demo.js",
    "verify": "node verify-excel.js"
  }
}
```

### Installation
```bash
cd examples
npm install
```

**Dependencies:**
- `xlsx` - Excel file creation and parsing
- `path` - File path utilities
- `fs` - File system operations

## 📊 Demo Data Sources

The demo files include realistic data from:
- **Fortune 500 tech companies**
- **Popular startups and scale-ups**
- **Open source organizations**
- **Tech consultancies and agencies**

**Email Formats Used:**
- `hr@company.com`
- `careers@company.com`
- `jobs@company.com`
- `recruiting@company.com`
- `talent@company.com`

## ⚠️ Important Notes

### Demo Data Disclaimer
- **Demo emails are fictional** - Do not send actual emails to demo addresses
- **Use for testing only** - Replace with real data for actual campaigns
- **Respect privacy** - Only email companies you have permission to contact

### File Size Limits
- Excel files should be under 5MB
- Recommended maximum: 300 companies per file
- Large files may impact performance

### Email Validation
- All demo emails follow valid format patterns
- Real email validation happens server-side
- Invalid emails are filtered out during processing

## 🚀 Getting Started Checklist

1. **✅ Download demo file** - Use `demo-companies.xlsx`
2. **✅ Test application** - Upload demo file to verify everything works
3. **✅ Create custom data** - Use utility scripts for your own data
4. **✅ Verify format** - Run verification script on your files
5. **✅ Start campaigning** - Upload your real company data

---

**Ready to launch your HR outreach campaigns! 🚀**
