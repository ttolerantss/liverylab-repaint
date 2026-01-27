const { execSync } = require('child_process');
const path = require('path');

// Azure Trusted Signing configuration
const config = {
  endpoint: 'https://eus.codesigning.azure.net/',
  account: 'liverylab-signing',
  certificateProfile: 'liverylab-public',
  tenantId: process.env.AZURE_TENANT_ID,
  clientId: process.env.AZURE_CLIENT_ID,
  clientSecret: process.env.AZURE_CLIENT_SECRET
};

async function sign(configuration) {
  const filePath = configuration.path;

  // Skip if not an exe
  if (!filePath.endsWith('.exe')) {
    console.log('Skipping non-exe file:', filePath);
    return;
  }

  console.log('Signing:', filePath);

  const args = [
    'sign',
    '-kvu', config.endpoint,
    '-kva', config.account,
    '-kvt', config.tenantId,
    '-kvi', config.clientId,
    '-kvs', config.clientSecret,
    '-kvcp', config.certificateProfile,
    '-tr', 'http://timestamp.acs.microsoft.com',
    '-td', 'sha256',
    '-v',
    `"${filePath}"`
  ];

  try {
    execSync(`azuresigntool ${args.join(' ')}`, { stdio: 'inherit' });
    console.log('Successfully signed:', filePath);
  } catch (err) {
    console.error('Failed to sign:', filePath, err.message);
    throw err;
  }
}

module.exports = sign;
