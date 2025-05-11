const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Ask for keystore password
function askForPassword() {
  return new Promise((resolve) => {
    rl.question('Enter your keystore password: ', (password) => {
      resolve(password);
    });
  });
}

async function main() {
  try {
    console.log('Preparing to build Android app...');
    
    // First, ensure we have fs-extra package
    try {
      require('fs-extra');
    } catch (e) {
      console.log('Installing fs-extra package...');
      execSync('npm install fs-extra', { stdio: 'inherit' });
      console.log('fs-extra installed successfully.');
    }
    
    // Setup the Gradle wrapper
    console.log('Setting up Gradle wrapper...');
    execSync('node download-gradle-wrapper.js', { stdio: 'inherit' });
    
    // Copy PWA files to Android assets
    console.log('Copying PWA files to Android assets...');
    execSync('node copy-pwa-to-android.js', { stdio: 'inherit' });
    
    // Get keystore password
    const password = await askForPassword();
    rl.close();
    
    // Update build.gradle with the password
    const buildGradlePath = path.join(__dirname, 'android-app', 'app', 'build.gradle');
    let buildGradleContent = fs.readFileSync(buildGradlePath, 'utf8');
    buildGradleContent = buildGradleContent
      .replace(/storePassword "YOUR_KEYSTORE_PASSWORD"/g, `storePassword "${password}"`)
      .replace(/keyPassword "YOUR_KEY_PASSWORD"/g, `keyPassword "${password}"`);
    fs.writeFileSync(buildGradlePath, buildGradleContent);
    
    // Ensure Android SDK is properly configured
    console.log('\nChecking for Android SDK...');
    const localPropertiesPath = path.join(__dirname, 'android-app', 'local.properties');
    const androidSdkPath = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME;
    
    if (androidSdkPath) {
      console.log(`Found Android SDK at: ${androidSdkPath}`);
      // Create local.properties file with SDK path
      fs.writeFileSync(localPropertiesPath, `sdk.dir=${androidSdkPath.replace(/\\/g, '\\\\')}\n`);
    } else {
      console.warn('\n⚠️ Warning: Android SDK path not found in environment variables.');
      console.warn('You may need to create a local.properties file manually in the android-app directory.');
      console.warn('Format: sdk.dir=C:\\\\Users\\\\YourUsername\\\\AppData\\\\Local\\\\Android\\\\Sdk\n');
    }
    
    // Build the Android app
    console.log('\nBuilding the Android app...');
    console.log('This may take a few minutes. Please be patient...');

    try {
      // For Windows
      process.chdir(path.join(__dirname, 'android-app'));
      execSync('cmd /c gradlew.bat assembleRelease', { stdio: 'inherit' });
      
      console.log('\n✅ Android app build completed successfully!');
      console.log('\nYou can find the APK file at:');
      console.log(path.join(__dirname, 'android-app', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'));
      
      console.log('\nTo create an App Bundle for Google Play Store:');
      console.log('Run: cd android-app && gradlew.bat bundleRelease');
    } catch (buildError) {
      console.error('\n❌ Error during Android app build:', buildError.message);
      console.error('\nThis could be due to missing Android SDK or build tools.');
      console.error('Make sure you have Android Studio installed with the proper SDK components.');
      console.error('You may need to set the ANDROID_HOME environment variable to point to your SDK location.');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Error preparing Android app build:', error);
    process.exit(1);
  }
}

main();