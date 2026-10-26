const fs = require('fs');
const html = fs.readFileSync('sidepanel.html', 'utf8');
const js = fs.readFileSync('sidepanel.js', 'utf8');
const regex = /getElementById\(['"]([^'"]+)['"]\)/g;
let match;
const missing = [];
while ((match = regex.exec(js)) !== null) {
  const id = match[1];
  if (!html.includes('id="' + id + '"') && !html.includes("id='" + id + "'")) {
    missing.push(id);
  }
}
console.log('Missing IDs:', missing);
