const FileService = require('./src/services/fileService');

async function testCsvParsing() {
  const fileService = new FileService();
  const csvPath = './sample-contacts.csv';

  console.log('Testing CSV parsing...');

  try {
    const result = await fileService.parseCsvFile(csvPath);

    if (result.success) {
      console.log('✅ CSV parsing successful!');
      console.log(`Found ${result.recipients.length} recipients:`);
      console.log('Delimiter used:', result.delimiterUsed);

      result.recipients.forEach((recipient, index) => {
        console.log(`\nRecipient ${index + 1}:`);
        console.log(`  Company: ${recipient.company_name}`);
        console.log(`  Email: ${recipient.email}`);
        if (recipient.name) console.log(`  Name: ${recipient.name}`);
        if (recipient.subject) console.log(`  Subject: ${recipient.subject}`);
        if (recipient.message_body) console.log(`  Message Body: ${recipient.message_body}`);
      });
    } else {
      console.log('❌ CSV parsing failed:', result.error);
    }
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run the test
testCsvParsing();