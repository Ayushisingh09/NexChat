const fs = require('fs');
const path = require('path');

const webDir = path.join(__dirname, '../Web');
const files = fs.readdirSync(webDir).filter(f => f.endsWith('.html'));

files.forEach(file => {
  const filePath = path.join(webDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Only add if it doesn't already contain the nav-chat-btn class
  if (!content.includes('nav-chat-btn')) {
    // Replace navbar Privacy link
    const navRegex = /(<li><a href="privacy\.html"(?:\s+class="active")?>Privacy<\/a><\/li>)\s*(<\/ul>)/g;
    if (navRegex.test(content)) {
      content = content.replace(navRegex, '$1\n        <li><a href="https://chat.92lrcorps.xyz/" class="nav-chat-btn">Chat</a></li>\n      $2');
    }

    // Replace footer Contact link
    const footerRegex = /(<li><a href="contact\.html">Contact<\/a><\/li>)\s*(<\/ul>)/g;
    if (footerRegex.test(content)) {
      content = content.replace(footerRegex, '$1\n          <li><a href="https://chat.92lrcorps.xyz/">Chat</a></li>\n        $2');
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  } else {
    console.log(`Skipped ${file} (already contains nav-chat-btn)`);
  }
});
