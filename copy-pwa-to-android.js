const fs = require('fs-extra');
const path = require('path');

// Source (PWA) and destination (Android) directories
const PWA_DIR = __dirname;
const ANDROID_ASSETS_DIR = path.join(__dirname, 'android-app', 'app', 'src', 'main', 'assets', 'web');

// List of PWA files to copy
const pwaFiles = [
  'index.html',
  'manifest.json',
  'script.js',
  'styles.css',
  'service-worker.js',
  'icon-192x192.png',
  'icon-512x512.png'
  // Add any other files your PWA needs
];

// Ensure the target directory exists
fs.ensureDirSync(ANDROID_ASSETS_DIR);

// Copy the PWA files to the Android assets directory
console.log('Copying PWA files to Android assets...');
pwaFiles.forEach(file => {
  const src = path.join(PWA_DIR, file);
  const dest = path.join(ANDROID_ASSETS_DIR, file);
  
  if (fs.existsSync(src)) {
    fs.copySync(src, dest);
    console.log(`Copied: ${file}`);
  } else {
    console.warn(`File not found: ${file}`);
  }
});

console.log('Done! PWA files have been copied to the Android app.');

// Modify the service worker for Android WebView compatibility
console.log('Modifying service worker for Android WebView...');
const swPath = path.join(ANDROID_ASSETS_DIR, 'service-worker.js');
if (fs.existsSync(swPath)) {
  let swContent = fs.readFileSync(swPath, 'utf8');
  
  // Add a prefix to all cache paths for Android assets
  swContent = swContent.replace(
    /const STATIC_ASSETS = \[([\s\S]*?)\];/,
    (match, assetList) => {
      // Modify asset paths to work with Android's file:///android_asset/web/ structure
      const newAssetList = assetList
        .split('\n')
        .map(line => {
          if (line.includes('./')) {
            return line.replace('./', '');
          }
          return line;
        })
        .join('\n');
      
      return `const STATIC_ASSETS = [${newAssetList}];`;
    }
  );
  
  // Write the modified service worker back
  fs.writeFileSync(swPath, swContent);
  console.log('Modified service worker for Android compatibility.');
}

// Update index.html to work with the Android WebView
console.log('Updating index.html for Android WebView...');
const indexPath = path.join(ANDROID_ASSETS_DIR, 'index.html');
if (fs.existsSync(indexPath)) {
  let indexContent = fs.readFileSync(indexPath, 'utf8');
  
  // Replace relative paths with absolute paths for better compatibility
  indexContent = indexContent
    .replace(/href="\.\//g, 'href="')
    .replace(/src="\.\//g, 'src="');
  
  // Write the modified index.html back
  fs.writeFileSync(indexPath, indexContent);
  console.log('Updated index.html for Android WebView compatibility.');
}

console.log('Your PWA is ready to be packaged as an Android app!');