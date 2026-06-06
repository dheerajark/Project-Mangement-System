const fs = require('fs');
const pdfPath = 'c:\\Salesforce\\Labs\\NSK\\Project Management System\\Project_Management_System_Implementation_Plan.pdf';
const buf = fs.readFileSync(pdfPath);
console.log('Hex head:', buf.subarray(0, 100).toString('hex'));
console.log('ASCII head:', buf.subarray(0, 500).toString('ascii'));
console.log('Total length:', buf.length);
// Print any ascii strings found in the file
const ascii = buf.toString('ascii').replace(/[^\x20-\x7E\r\n]/g, '.');
console.log('Printable ASCII lines (first 2000 chars):');
console.log(ascii.substring(0, 2000));
