const fs = require('fs');
const zlib = require('zlib');

function decodeAscii85(str) {
  // Remove whitespace
  str = str.replace(/\s/g, '');
  // Stop at end marker ~>
  const endIdx = str.indexOf('~>');
  if (endIdx !== -1) {
    str = str.substring(0, endIdx);
  }
  
  const bytes = [];
  let i = 0;
  while (i < str.length) {
    const c = str[i];
    if (c === 'z') {
      bytes.push(0, 0, 0, 0);
      i++;
      continue;
    }
    
    // Read up to 5 characters
    const chunk = [];
    while (chunk.length < 5 && i < str.length) {
      const charCode = str.charCodeAt(i);
      if (charCode >= 33 && charCode <= 117) {
        chunk.push(charCode - 33);
      }
      i++;
    }
    
    if (chunk.length === 0) break;
    
    const originalLen = chunk.length;
    // Pad chunk to 5 elements with 84 ('u' - 33)
    while (chunk.length < 5) {
      chunk.push(84);
    }
    
    let sum = 0;
    for (let j = 0; j < 5; j++) {
      sum = sum * 85 + chunk[j];
    }
    
    const b1 = (sum >> 24) & 0xff;
    const b2 = (sum >> 16) & 0xff;
    const b3 = (sum >> 8) & 0xff;
    const b4 = sum & 0xff;
    
    if (originalLen === 5) {
      bytes.push(b1, b2, b3, b4);
    } else if (originalLen === 4) {
      bytes.push(b1, b2, b3);
    } else if (originalLen === 3) {
      bytes.push(b1, b2);
    } else if (originalLen === 2) {
      bytes.push(b1);
    }
  }
  return Buffer.from(bytes);
}

const pdfPath = 'c:\\Salesforce\\Labs\\NSK\\Project Management System\\Project_Management_System_Implementation_Plan.pdf';
const buf = fs.readFileSync(pdfPath);

let textContent = '';

let offset = 0;
while (true) {
  const streamIdx = buf.indexOf('stream', offset);
  if (streamIdx === -1) break;
  
  // Find preceding obj dictionary to see filters
  const precedingContent = buf.subarray(Math.max(0, streamIdx - 300), streamIdx);
  const dictEndIdx = precedingContent.lastIndexOf('>>');
  const dictStartIdx = precedingContent.lastIndexOf('<<');
  
  let isFlate = false;
  let isAscii85 = false;
  if (dictStartIdx !== -1 && dictEndIdx !== -1 && dictStartIdx < dictEndIdx) {
    const dictText = precedingContent.subarray(dictStartIdx, dictEndIdx + 2).toString('ascii');
    if (dictText.includes('/FlateDecode')) {
      isFlate = true;
    }
    if (dictText.includes('/ASCII85Decode')) {
      isAscii85 = true;
    }
  }

  // Find endstream
  const endStreamIdx = buf.indexOf('endstream', streamIdx);
  if (endStreamIdx === -1) {
    offset = streamIdx + 6;
    continue;
  }

  // Extract stream data
  let dataStart = streamIdx + 6;
  if (buf[dataStart] === 13 && buf[dataStart + 1] === 10) {
    dataStart += 2;
  } else if (buf[dataStart] === 10) {
    dataStart += 1;
  }

  let dataEnd = endStreamIdx;
  if (buf[dataEnd - 2] === 13 && buf[dataEnd - 1] === 10) {
    dataEnd -= 2;
  } else if (buf[dataEnd - 1] === 10) {
    dataEnd -= 1;
  }

  let streamData = buf.subarray(dataStart, dataEnd);
  
  if (isAscii85) {
    streamData = decodeAscii85(streamData.toString('ascii'));
  }
  
  if (isFlate) {
    try {
      const decompressed = zlib.inflateSync(streamData);
      textContent += decompressed.toString('utf8') + '\n';
    } catch (e) {
      console.error('Flate inflation failed:', e.message);
    }
  } else {
    textContent += streamData.toString('utf8') + '\n';
  }

  offset = endStreamIdx + 9;
}

// Write the raw extracted text content
fs.writeFileSync('c:\\Salesforce\\Labs\\NSK\\Project Management System\\scratch\\extracted_text.txt', textContent);

// Let's also parse typical PDF text strings in parenthesis
const parenRegex = /\(([^)]+)\)/g;
const matches = [];
let match;
while ((match = parenRegex.exec(textContent)) !== null) {
  // Convert escaped PDF sequences like \(\) or octal character codes if any
  let clean = match[1].replace(/\\([0-7]{3})/g, (m, oct) => {
    return String.fromCharCode(parseInt(oct, 8));
  }).replace(/\\(.)/g, '$1');
  if (clean.trim().length > 2) {
    matches.push(clean);
  }
}

fs.writeFileSync('c:\\Salesforce\\Labs\\NSK\\Project Management System\\scratch\\cleaned_strings.txt', matches.join('\n'));

console.log('Done! CLEANED matches:');
console.log(matches.slice(0, 100).join('\n'));
