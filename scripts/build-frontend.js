const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../fontend');
const distDir = path.join(__dirname, '../dist');

// Utility to copy directory recursively
function copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirectory(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// Ensure dist directory exists and is clean
if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir);

console.log('Building frontend to dist directory...');

// 1. Copy public/* directly into dist/ (so public/index.html becomes dist/index.html)
console.log('Copying public -> /');
copyDirectory(path.join(srcDir, 'public'), distDir);

// 2. Copy other directories into their respective folders in dist/
const dirsToMap = ['assets', 'admin', 'webmanager', 'staff', 'participant'];
for (const dir of dirsToMap) {
    const srcPath = path.join(srcDir, dir);
    if (fs.existsSync(srcPath)) {
        console.log(`Copying ${dir} -> /${dir}`);
        copyDirectory(srcPath, path.join(distDir, dir));
    }
}

console.log('Frontend build complete. The "dist" directory is ready for Cloudflare Pages.');
