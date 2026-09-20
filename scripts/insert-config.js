const fs = require('fs');
const path = require('path');

const fontendDir = path.join(__dirname, '../fontend');

function processDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (let entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            processDir(fullPath);
        } else if (entry.isFile() && fullPath.endsWith('.html')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            // Check if already inserted
            if (content.includes('src="/js/config.js"')) {
                continue;
            }
            // Insert after <head>
            if (content.includes('<head>')) {
                content = content.replace('<head>', '<head>\n    <script src="/js/config.js"></script>');
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log('Updated: ' + fullPath);
            }
        }
    }
}

processDir(fontendDir);
console.log('Injection complete.');
