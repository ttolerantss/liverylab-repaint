const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.join(__dirname, '..');
const installerDir = path.join(rootDir, 'installer');
const payloadDir = path.join(installerDir, 'payload');
const appBuildDir = path.join(rootDir, 'dist', 'win-unpacked');

console.log('Building custom installer...\n');

// Step 1: Check if app build exists
console.log('Step 1: Checking app build...');
if (!fs.existsSync(appBuildDir)) {
  console.error('Error: App build not found. Run "npm run build:dir" first.');
  process.exit(1);
}
console.log('  App build found at:', appBuildDir);

// Step 2: Clear payload directory
console.log('\nStep 2: Clearing payload directory...');
if (fs.existsSync(payloadDir)) {
  fs.rmSync(payloadDir, { recursive: true, force: true });
}
fs.mkdirSync(payloadDir, { recursive: true });
console.log('  Payload directory cleared.');

// Step 3: Copy app build to payload
console.log('\nStep 3: Copying app to payload...');
copyDirSync(appBuildDir, payloadDir);
console.log('  App copied to payload.');

// Step 3b: Copy EULA if it exists
const eulaPath = path.join(rootDir, 'dist', 'SoftwareEndUserLicenseAgreement.md');
if (fs.existsSync(eulaPath)) {
  fs.copyFileSync(eulaPath, path.join(payloadDir, 'SoftwareEndUserLicenseAgreement.md'));
  console.log('  SoftwareEndUserLicenseAgreement.md copied to payload.');
}

// Step 4: Install installer dependencies
console.log('\nStep 4: Installing installer dependencies...');
execSync('npm install', { cwd: installerDir, stdio: 'inherit' });

// Step 5: Build the installer
console.log('\nStep 5: Building installer...');
execSync('npm run build', { cwd: installerDir, stdio: 'inherit' });

// Step 6: Copy installer to main dist folder
console.log('\nStep 6: Copying installer to dist...');
const installerOutput = path.join(installerDir, 'dist');
const installerFiles = fs.readdirSync(installerOutput).filter(f => f.endsWith('.exe'));
for (const file of installerFiles) {
  const src = path.join(installerOutput, file);
  const dest = path.join(rootDir, 'dist', file);
  fs.copyFileSync(src, dest);
  console.log('  Copied:', file);
}

// Step 7: Sign the installer (if Azure credentials are set)
if (process.env.AZURE_TENANT_ID && process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET) {
  console.log('\nStep 7: Signing installer with Azure Trusted Signing...');

  const signtool = 'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.26100.0\\x64\\signtool.exe';
  const dlib = path.join(rootDir, 'scripts', 'trustedsigning', 'bin', 'x64', 'Azure.CodeSigning.Dlib.dll');
  const configFile = path.join(rootDir, 'scripts', 'signing-config.json');

  for (const file of installerFiles) {
    const filePath = path.join(rootDir, 'dist', file);

    // Set Azure credentials as environment variables for the dlib
    const env = {
      ...process.env,
      AZURE_TENANT_ID: process.env.AZURE_TENANT_ID,
      AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID,
      AZURE_CLIENT_SECRET: process.env.AZURE_CLIENT_SECRET
    };

    const signCmd = `"${signtool}" sign /v /debug /fd SHA256 /tr "http://timestamp.acs.microsoft.com" /td SHA256 /dlib "${dlib}" /dmdf "${configFile}" "${filePath}"`;

    try {
      execSync(signCmd, { stdio: 'inherit', env });
      console.log('  Signed:', file);
    } catch (err) {
      console.error('  Failed to sign:', file, err.message);
    }
  }
} else {
  console.log('\nStep 7: Skipping signing (Azure credentials not set)');
  console.log('  Set AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET to enable signing');
}

console.log('\nBuild complete!');
console.log('Installer location:', path.join(rootDir, 'dist'));

// Helper function to copy directory recursively
function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
