const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Encryption key - 32 bytes for AES-256
// This key is embedded in the app, so not perfectly secure against reverse engineering
// but prevents casual copying of model files
const ENCRYPTION_KEY = 'L1v3ryL4b_R3p41nt_2026_S3cur3K3y';  // Must be exactly 32 characters

const ALGORITHM = 'aes-256-cbc';

function encrypt(buffer) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  // Prepend IV to encrypted data
  return Buffer.concat([iv, encrypted]);
}

function encryptFile(inputPath, outputPath) {
  const data = fs.readFileSync(inputPath);
  const encrypted = encrypt(data);
  fs.writeFileSync(outputPath, encrypted);
  console.log(`Encrypted: ${path.basename(inputPath)} -> ${path.basename(outputPath)}`);
}

// Main
const modelsDir = path.join(__dirname, '..', 'src', 'assets', 'models');
const outputDir = path.join(__dirname, '..', 'dist', 'encrypted-models');

// Create output directory
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Check if models exist
if (!fs.existsSync(modelsDir)) {
  console.error('Models directory not found. Make sure models are in src/assets/models/');
  console.log('You may need to download them from your R2 bucket first.');
  process.exit(1);
}

// Encrypt all GLB files
const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.glb'));

if (files.length === 0) {
  console.error('No .glb files found in models directory.');
  process.exit(1);
}

console.log(`Encrypting ${files.length} model files...\n`);

for (const file of files) {
  const inputPath = path.join(modelsDir, file);
  const outputPath = path.join(outputDir, file + '.enc');
  encryptFile(inputPath, outputPath);
}

// Create a zip of encrypted models
console.log('\nCreating encrypted models archive...');
const { execSync } = require('child_process');
const zipPath = path.join(__dirname, '..', 'dist', 'models-encrypted.zip');

// Remove old zip if exists
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

execSync(`powershell Compress-Archive -Path "${outputDir}\\*" -DestinationPath "${zipPath}"`, { stdio: 'inherit' });

console.log(`\nDone! Encrypted archive: ${zipPath}`);
console.log('\nUpload this file to Cloudflare R2 to replace models.zip');
