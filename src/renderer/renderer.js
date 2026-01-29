// Global error handler - catches any uncaught errors
window.onerror = function(message, source, lineno, colno, error) {
  console.error('Global error:', message, 'at', source, 'line', lineno);
  // Show error to user in development/debugging
  const errorDiv = document.getElementById('login-error') || document.createElement('div');
  if (errorDiv) {
    errorDiv.textContent = 'App error: ' + message;
    errorDiv.style.color = '#e74c3c';
  }
  return false;
};

// Catch unhandled promise rejections
window.onunhandledrejection = function(event) {
  console.error('Unhandled promise rejection:', event.reason);
};

// Wrap all requires in try-catch to identify module loading issues
let THREE, path, fs, os, crypto, ipcRenderer, shell, PSD, chokidar;

try {
  THREE = require('three');
  console.log('THREE loaded successfully');
} catch (e) {
  console.error('Failed to load THREE:', e);
}

try {
  path = require('path');
  fs = require('fs');
  os = require('os');
  crypto = require('crypto');
  console.log('Node modules loaded successfully');
} catch (e) {
  console.error('Failed to load Node modules:', e);
}

try {
  const electron = require('electron');
  ipcRenderer = electron.ipcRenderer;
  shell = electron.shell;
  console.log('Electron modules loaded successfully');
} catch (e) {
  console.error('Failed to load Electron modules:', e);
}

try {
  PSD = require('psd');
  console.log('PSD loaded successfully');
} catch (e) {
  console.error('Failed to load PSD:', e);
}

try {
  chokidar = require('chokidar');
  console.log('Chokidar loaded successfully');
} catch (e) {
  console.error('Failed to load chokidar:', e);
}

// Keygen.sh configuration
const KEYGEN_ACCOUNT_ID = 'd686390b-a261-42a3-b70c-29c18de597c3';
const KEYGEN_PRODUCT_TOKEN = 'prod-e6c767a1c8be1428b6fb00ffc20ff7c27f290242dc0176017adf2bdd571ff041v3';
const KEYGEN_API_URL = `https://api.keygen.sh/v1/accounts/${KEYGEN_ACCOUNT_ID}`;
const KEYGEN_MODELS_ARTIFACT_ID = 'e737065b-7e92-458e-b5d5-9d78875d9977';

// R2 URLs for remote content
const R2_BASE_URL = 'https://pub-2bbfe8dc75c745f39f4505f0d26ce9bd.r2.dev';
const MODELS_DOWNLOAD_URL = `${R2_BASE_URL}/models.zip`;
const MODELS_JSON_URL = `${R2_BASE_URL}/models.json`;
const MODELS_MANIFEST_URL = `${R2_BASE_URL}/models-manifest.json`;

// Model encryption key (must match encrypt-models.js)
const MODEL_ENCRYPTION_KEY = 'L1v3ryL4b_R3p41nt_2026_S3cur3K3y';
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';

// Decrypt an encrypted model file buffer
function decryptModelBuffer(encryptedBuffer) {
  // First 16 bytes are the IV
  const iv = encryptedBuffer.slice(0, 16);
  const encryptedData = encryptedBuffer.slice(16);

  const decipher = crypto.createDecipheriv(
    ENCRYPTION_ALGORITHM,
    Buffer.from(MODEL_ENCRYPTION_KEY),
    iv
  );

  const decrypted = Buffer.concat([
    decipher.update(encryptedData),
    decipher.final()
  ]);

  return decrypted;
}

// Show custom error modal
function showErrorModal(title, contentHtml) {
  const overlay = document.getElementById('error-modal-overlay');
  const titleEl = document.getElementById('error-modal-title-text');
  const contentEl = document.getElementById('error-modal-content');
  const closeBtn = document.getElementById('error-modal-close-btn');

  if (overlay && titleEl && contentEl) {
    titleEl.textContent = title;
    contentEl.innerHTML = contentHtml;
    overlay.classList.add('visible');

    // Close on button click
    const closeHandler = () => {
      overlay.classList.remove('visible');
      closeBtn.removeEventListener('click', closeHandler);
    };
    closeBtn.addEventListener('click', closeHandler);

    // Close on overlay click (outside modal)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('visible');
      }
    });
  }
}

// Generate a unique machine fingerprint
function getMachineFingerprint() {
  const cpus = os.cpus();
  const networkInterfaces = os.networkInterfaces();

  // Collect hardware info
  const cpuModel = cpus[0]?.model || 'unknown';
  const hostname = os.hostname();
  const platform = os.platform();
  const arch = os.arch();

  // Get first non-internal MAC address
  let mac = 'unknown';
  for (const [name, interfaces] of Object.entries(networkInterfaces)) {
    for (const iface of interfaces) {
      if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
        mac = iface.mac;
        break;
      }
    }
    if (mac !== 'unknown') break;
  }

  // Create fingerprint hash
  const fingerprintData = `${cpuModel}-${hostname}-${platform}-${arch}-${mac}`;
  const fingerprint = crypto.createHash('sha256').update(fingerprintData).digest('hex');

  console.log('Machine fingerprint generated:', fingerprint.substring(0, 16) + '...');
  return fingerprint;
}

// Validate a license key with Keygen
async function validateLicenseKey(licenseKey) {
  try {
    console.log('Validating license key...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    const response = await fetch(`${KEYGEN_API_URL}/licenses/actions/validate-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/vnd.api+json',
        'Accept': 'application/vnd.api+json'
      },
      body: JSON.stringify({
        meta: {
          key: licenseKey
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const data = await response.json();
    console.log('License validation response:', data);

    return data;
  } catch (err) {
    console.error('License validation error:', err);
    if (err.name === 'AbortError') {
      throw new Error('Connection timed out. Please check your internet connection.');
    }
    throw new Error('Failed to connect to license server. Please check your internet connection.');
  }
}

// Activate a machine for a license
async function activateMachine(licenseId, licenseKey, fingerprint) {
  try {
    const response = await fetch(`${KEYGEN_API_URL}/machines`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/vnd.api+json',
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${KEYGEN_PRODUCT_TOKEN}`
      },
      body: JSON.stringify({
        data: {
          type: 'machines',
          attributes: {
            fingerprint: fingerprint,
            name: os.hostname(),
            platform: os.platform()
          },
          relationships: {
            license: {
              data: { type: 'licenses', id: licenseId }
            }
          }
        }
      })
    });

    const data = await response.json();
    console.log('Machine activation response:', data);

    return data;
  } catch (err) {
    console.error('Machine activation error:', err);
    throw new Error('Failed to activate machine');
  }
}

// Get local storage path for license data
function getLicenseStoragePath() {
  const appDataPath = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const appFolder = path.join(appDataPath, 'LiveryLabRepaint');
  if (!fs.existsSync(appFolder)) {
    fs.mkdirSync(appFolder, { recursive: true });
  }
  return path.join(appFolder, 'license.json');
}

// Save license data locally
function saveLicenseData(data) {
  const storagePath = getLicenseStoragePath();
  fs.writeFileSync(storagePath, JSON.stringify(data, null, 2));
  console.log('License data saved to:', storagePath);
}

// Load license data from local storage
function loadLicenseData() {
  const storagePath = getLicenseStoragePath();
  if (fs.existsSync(storagePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(storagePath, 'utf8'));
      console.log('License data loaded');
      return data;
    } catch (err) {
      console.error('Failed to load license data:', err);
    }
  }
  return null;
}

// Clear license data (for logout/deactivation)
function clearLicenseData() {
  const storagePath = getLicenseStoragePath();
  if (fs.existsSync(storagePath)) {
    fs.unlinkSync(storagePath);
    console.log('License data cleared');
  }
}

// Get models storage path in AppData
function getModelsStoragePath() {
  const appDataPath = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const modelsFolder = path.join(appDataPath, 'LiveryLabRepaint', 'models');
  return modelsFolder;
}

// Check if models are already downloaded
function areModelsDownloaded() {
  const modelsFolder = getModelsStoragePath();
  if (!fs.existsSync(modelsFolder)) {
    return false;
  }
  // Check if at least one encrypted .glb.enc file exists
  const files = fs.readdirSync(modelsFolder);
  return files.some(f => f.endsWith('.glb.enc'));
}

// Download models from Cloudflare R2 (after license verification)
async function downloadModels(licenseKey, onProgress) {
  const modelsFolder = getModelsStoragePath();
  const zipPath = path.join(modelsFolder, 'models.zip');

  // Create models folder if it doesn't exist
  if (!fs.existsSync(modelsFolder)) {
    fs.mkdirSync(modelsFolder, { recursive: true });
  }

  onProgress(5, 'Connecting to server...');

  try {
    // Download from Cloudflare R2
    const response = await fetch(MODELS_DOWNLOAD_URL, {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    onProgress(10, 'Downloading models...');

    // Get the response as array buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    onProgress(60, 'Saving download...');

    // Save the zip file
    fs.writeFileSync(zipPath, buffer);

    onProgress(70, 'Extracting models...');

    // Extract the zip file using PowerShell
    const { execSync } = require('child_process');
    execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${modelsFolder}' -Force"`, {
      windowsHide: true
    });

    onProgress(95, 'Cleaning up...');

    // Remove the zip file
    fs.unlinkSync(zipPath);

    onProgress(100, 'Download complete!');

    console.log('Models downloaded and extracted to:', modelsFolder);
    return true;
  } catch (err) {
    console.error('Failed to download models:', err);
    throw err;
  }
}

// Get the path where models should be loaded from
function getModelsPath() {
  const downloadedPath = getModelsStoragePath();
  if (areModelsDownloaded()) {
    return downloadedPath;
  }
  // Fallback to bundled path (for development)
  return path.join(__dirname, '../assets/models');
}
const { OrbitControls } = require('three/examples/jsm/controls/OrbitControls.js');
const { GLTFLoader } = require('three/examples/jsm/loaders/GLTFLoader.js');

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1e1e1e); // Default background color

// Camera setup
const perspectiveCamera = new THREE.PerspectiveCamera(
  45, // Field of view
  window.innerWidth / window.innerHeight, // Aspect ratio
  0.1, // Near clipping plane
  1000 // Far clipping plane
);
perspectiveCamera.position.set(5, 3, 5);
perspectiveCamera.lookAt(0, 0, 0);

// Orthographic camera for axis-locked views
const frustumSize = 5;
const aspect = window.innerWidth / window.innerHeight;
const orthoCamera = new THREE.OrthographicCamera(
  -frustumSize * aspect / 2,
  frustumSize * aspect / 2,
  frustumSize / 2,
  -frustumSize / 2,
  0.1,
  1000
);

// Active camera reference (starts with perspective)
let camera = perspectiveCamera;
let currentViewMode = 'free'; // 'free', 'front', 'back', 'right', 'left', 'top', 'bottom'

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// Ambient light - soft overall illumination
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

// Directional light - main light source
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 7);
scene.add(directionalLight);

// Secondary directional light - fill light from opposite side
const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
fillLight.position.set(-5, 5, -5);
scene.add(fillLight);

// OrbitControls setup
const controls = new OrbitControls(perspectiveCamera, renderer.domElement);
controls.enableDamping = true; // Smooth camera movement
controls.dampingFactor = 0.05;
controls.minDistance = 2; // Minimum zoom distance
controls.maxDistance = 20; // Maximum zoom distance
controls.enablePan = true; // Right mouse drag or shift+left drag to pan
controls.target.set(0, 0, 0);
controls.update();

// View mode switching functions
const viewDistance = 10; // Distance from origin for axis views

function switchToFreeView() {
  camera = perspectiveCamera;
  currentViewMode = 'free';
  controls.object = perspectiveCamera;
  controls.enableRotate = true;
  controls.update();
  updateViewIndicator();
}

function switchToAxisView(viewName) {
  camera = orthoCamera;
  currentViewMode = viewName;
  controls.object = orthoCamera;
  controls.enableRotate = false; // Lock rotation in axis view

  // Position camera exactly on axis
  switch (viewName) {
    case 'front':
      orthoCamera.position.set(0, 0, viewDistance);
      orthoCamera.up.set(0, 1, 0);
      break;
    case 'back':
      orthoCamera.position.set(0, 0, -viewDistance);
      orthoCamera.up.set(0, 1, 0);
      break;
    case 'right':
      orthoCamera.position.set(viewDistance, 0, 0);
      orthoCamera.up.set(0, 1, 0);
      break;
    case 'left':
      orthoCamera.position.set(-viewDistance, 0, 0);
      orthoCamera.up.set(0, 1, 0);
      break;
    case 'top':
      orthoCamera.position.set(0, viewDistance, 0);
      orthoCamera.up.set(0, 0, -1);
      break;
    case 'bottom':
      orthoCamera.position.set(0, -viewDistance, 0);
      orthoCamera.up.set(0, 0, 1);
      break;
  }

  orthoCamera.lookAt(controls.target);
  controls.update();
  updateViewIndicator();
}

// Get nearest axis view based on current camera direction
function getNearestAxisView() {
  const camPos = camera.position.clone().sub(controls.target).normalize();

  const axes = [
    { name: 'front', dir: new THREE.Vector3(0, 0, 1) },
    { name: 'back', dir: new THREE.Vector3(0, 0, -1) },
    { name: 'right', dir: new THREE.Vector3(1, 0, 0) },
    { name: 'left', dir: new THREE.Vector3(-1, 0, 0) },
    { name: 'top', dir: new THREE.Vector3(0, 1, 0) },
    { name: 'bottom', dir: new THREE.Vector3(0, -1, 0) }
  ];

  let nearest = axes[0];
  let minAngle = camPos.angleTo(axes[0].dir);

  for (const axis of axes) {
    const angle = camPos.angleTo(axis.dir);
    if (angle < minAngle) {
      minAngle = angle;
      nearest = axis;
    }
  }

  return nearest.name;
}

// Toggle ortho view for nearest axis when Alt is pressed
function toggleNearestAxisOrtho() {
  if (camera === orthoCamera) {
    // Switch back to perspective, keeping camera at same position
    perspectiveCamera.position.copy(orthoCamera.position);
    perspectiveCamera.quaternion.copy(orthoCamera.quaternion);
    switchToFreeView();
  } else {
    // Snap to nearest axis in ortho
    const nearestView = getNearestAxisView();
    switchToAxisView(nearestView);
  }
}

function updateViewIndicator() {
  const indicator = document.getElementById('view-indicator');
  if (indicator) {
    const viewNames = {
      'free': 'Perspective',
      'front': 'Front',
      'back': 'Back',
      'right': 'Right',
      'left': 'Left',
      'top': 'Top',
      'bottom': 'Bottom'
    };
    indicator.textContent = viewNames[currentViewMode] || 'Perspective';
  }
}

// Reset camera to default position centered on model
function resetCamera() {
  // Reset target to origin
  controls.target.set(0, 0, 0);

  if (camera === orthoCamera) {
    // Re-apply the current axis view to recenter
    switchToAxisView(currentViewMode);
  } else {
    // Reset perspective camera to default position
    perspectiveCamera.position.set(5, 3, 5);
    perspectiveCamera.lookAt(0, 0, 0);
    controls.update();
  }
}

// Keyboard shortcuts for view switching
document.addEventListener('keydown', (e) => {
  // Only handle if not typing in an input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  switch (e.key) {
    case '1':
    case 'Numpad1':
      e.preventDefault();
      switchToAxisView('front');
      break;
    case '3':
    case 'Numpad3':
      e.preventDefault();
      switchToAxisView('right');
      break;
    case '7':
    case 'Numpad7':
      e.preventDefault();
      switchToAxisView('top');
      break;
    case '9':
    case 'Numpad9':
      e.preventDefault();
      switchToAxisView('bottom');
      break;
    case '0':
    case 'Numpad0':
      e.preventDefault();
      switchToFreeView();
      break;
    case '5':
    case 'Numpad5':
      e.preventDefault();
      // Toggle between perspective and ortho in current position
      if (camera === perspectiveCamera) {
        orthoCamera.position.copy(perspectiveCamera.position);
        orthoCamera.quaternion.copy(perspectiveCamera.quaternion);
        camera = orthoCamera;
        controls.object = orthoCamera;
      } else {
        perspectiveCamera.position.copy(orthoCamera.position);
        perspectiveCamera.quaternion.copy(orthoCamera.quaternion);
        camera = perspectiveCamera;
        controls.object = perspectiveCamera;
        controls.enableRotate = true;
      }
      controls.update();
      updateViewIndicator();
      break;
  }

  // Ctrl+1/3/7 for opposite views
  if (e.ctrlKey) {
    switch (e.key) {
      case '1':
        e.preventDefault();
        switchToAxisView('back');
        break;
      case '3':
        e.preventDefault();
        switchToAxisView('left');
        break;
    }
  }

  // Alt key to toggle ortho for nearest axis
  if (e.key === 'Alt') {
    e.preventDefault();
    toggleNearestAxisOrtho();
  }
});

// GLTF Loader
const gltfLoader = new GLTFLoader();
let currentModel = null;

// Load a glTF/GLB model (supports encrypted .glb.enc files)
function loadModel(modelPath) {
  return new Promise((resolve, reject) => {
    // Remove existing model if any
    if (currentModel) {
      scene.remove(currentModel);
      currentModel.traverse((child) => {
        if (child.isMesh) {
          child.geometry.dispose();
          if (child.material.map) child.material.map.dispose();
          child.material.dispose();
        }
      });
      currentModel = null;
    }

    // Check if this is an encrypted model
    const isEncrypted = modelPath.endsWith('.enc');

    const onModelLoaded = (gltf) => {
      const model = gltf.scene;

      // Calculate bounding box to center and scale model
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      // Center the model
      model.position.x = -center.x;
      model.position.y = -center.y;
      model.position.z = -center.z;

      // Scale to fit nicely in view (target size ~4 units)
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 4 / maxDim;
      model.scale.setScalar(scale);

      // Add to scene
      scene.add(model);
      currentModel = model;

      // Update controls target to model center
      controls.target.set(0, 0, 0);
      controls.update();

      console.log('Model loaded successfully');
      console.log('Meshes found:');
      model.traverse((child) => {
        if (child.isMesh) {
          console.log(' -', child.name);
        }
      });

      resolve(model);
    };

    if (isEncrypted) {
      // Load and decrypt encrypted model
      try {
        console.log('Loading encrypted model:', modelPath);
        const encryptedBuffer = fs.readFileSync(modelPath);
        const decryptedBuffer = decryptModelBuffer(encryptedBuffer);

        // Convert to ArrayBuffer for GLTFLoader.parse()
        const arrayBuffer = decryptedBuffer.buffer.slice(
          decryptedBuffer.byteOffset,
          decryptedBuffer.byteOffset + decryptedBuffer.byteLength
        );

        gltfLoader.parse(
          arrayBuffer,
          '', // path for resolving relative URLs (not needed for GLB)
          onModelLoaded,
          (error) => {
            console.error('Error parsing decrypted model:', error);
            reject(error);
          }
        );
      } catch (err) {
        console.error('Error decrypting model:', err);
        reject(err);
      }
    } else {
      // Load unencrypted model normally
      gltfLoader.load(
        modelPath,
        onModelLoaded,
        (progress) => {
          console.log('Loading progress:', (progress.loaded / progress.total * 100).toFixed(1) + '%');
        },
        (error) => {
          console.error('Error loading model:', error);
          reject(error);
        }
      );
    }
  });
}

// Handle window resize
window.addEventListener('resize', () => {
  const aspect = window.innerWidth / window.innerHeight;

  // Update perspective camera
  perspectiveCamera.aspect = aspect;
  perspectiveCamera.updateProjectionMatrix();

  // Update orthographic camera
  orthoCamera.left = -frustumSize * aspect / 2;
  orthoCamera.right = frustumSize * aspect / 2;
  orthoCamera.top = frustumSize / 2;
  orthoCamera.bottom = -frustumSize / 2;
  orthoCamera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  controls.update(); // Required for damping

  // Update camera position for glossiness shader
  if (paintMeshMaterial && paintMeshMaterial.uniforms.viewPosition) {
    paintMeshMaterial.uniforms.viewPosition.value.copy(camera.position);
  }

  renderer.render(scene, camera);
}

animate();

// Model configuration
const assetsPath = path.join(__dirname, '../assets');
let modelsPath = getModelsPath(); // Dynamic - uses AppData if downloaded, else bundled
let modelsConfig = { models: [] };
let currentModelId = null;

// Get local models config cache path
function getModelsConfigCachePath() {
  const appDataPath = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const appFolder = path.join(appDataPath, 'LiveryLabRepaint');
  if (!fs.existsSync(appFolder)) {
    fs.mkdirSync(appFolder, { recursive: true });
  }
  return path.join(appFolder, 'models.json');
}

// Get local models version path
function getModelsVersionPath() {
  const appDataPath = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(appDataPath, 'LiveryLabRepaint', 'models-version.json');
}

// Fetch models.json from R2 (with local cache fallback)
async function fetchModelsConfig() {
  try {
    console.log('Fetching models config from R2...');
    const response = await fetch(MODELS_JSON_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();

    // Cache locally
    const cachePath = getModelsConfigCachePath();
    fs.writeFileSync(cachePath, JSON.stringify(data, null, 2));

    modelsConfig = data;
    console.log('Fetched models config:', modelsConfig.models.length, 'models');
    return modelsConfig;
  } catch (err) {
    console.error('Failed to fetch models config from R2:', err);
    // Fall back to cached version
    return loadModelsConfigFromCache();
  }
}

// Load models config from local cache
function loadModelsConfigFromCache() {
  try {
    const cachePath = getModelsConfigCachePath();
    if (fs.existsSync(cachePath)) {
      const configData = fs.readFileSync(cachePath, 'utf8');
      modelsConfig = JSON.parse(configData);
      console.log('Loaded cached models config:', modelsConfig.models.length, 'models');
      return modelsConfig;
    }
  } catch (err) {
    console.error('Failed to load cached models config:', err);
  }

  // Fall back to bundled config for first run / offline
  return loadModelsConfigBundled();
}

// Load bundled models config (fallback)
function loadModelsConfigBundled() {
  try {
    const configPath = path.join(assetsPath, 'models.json');
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      modelsConfig = JSON.parse(configData);
      console.log('Loaded bundled models config:', modelsConfig.models.length, 'models');
      return modelsConfig;
    }
  } catch (err) {
    console.error('Failed to load bundled models config:', err);
  }
  return { models: [] };
}

// Check if models need to be updated based on version
async function checkModelsVersion() {
  try {
    const response = await fetch(MODELS_MANIFEST_URL);
    if (!response.ok) {
      console.log('No models manifest found, skipping version check');
      return { needsUpdate: false };
    }

    const manifest = await response.json();
    const versionPath = getModelsVersionPath();

    let localVersion = null;
    if (fs.existsSync(versionPath)) {
      try {
        const localData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
        localVersion = localData.version;
      } catch (e) {
        // Ignore parse errors
      }
    }

    console.log('Models version check - local:', localVersion, 'remote:', manifest.version);

    if (localVersion !== manifest.version) {
      return { needsUpdate: true, version: manifest.version };
    }

    return { needsUpdate: false };
  } catch (err) {
    console.error('Failed to check models version:', err);
    return { needsUpdate: false };
  }
}

// Save the current models version after download
function saveModelsVersion(version) {
  const versionPath = getModelsVersionPath();
  fs.writeFileSync(versionPath, JSON.stringify({ version, downloadedAt: new Date().toISOString() }));
}

// Legacy sync function for initial load (will be replaced by async fetch)
function loadModelsConfig() {
  return loadModelsConfigFromCache();
}

// Get model config by ID
function getModelConfig(modelId) {
  return modelsConfig.models.find(m => m.id === modelId);
}

// Update the model link in the footer
function updateModelLink(modelConfig) {
  const modelLink = document.getElementById('model-link');
  if (!modelLink) return;

  if (modelConfig) {
    // Build full model name: "Manufacturer's Year Name"
    const fullName = `${modelConfig.manufacturer}'s ${modelConfig.year} ${modelConfig.name}`;
    modelLink.textContent = fullName;

    if (modelConfig.link) {
      modelLink.href = modelConfig.link;
      modelLink.style.cursor = 'pointer';
    } else {
      modelLink.href = '#';
      modelLink.style.cursor = 'default';
    }
  } else {
    modelLink.textContent = 'Select a model';
    modelLink.href = '#';
  }
}

// Switch to a different model
async function switchModel(modelId) {
  const modelConfig = getModelConfig(modelId);
  if (!modelConfig) {
    console.error('Model not found:', modelId);
    return;
  }

  // Check for encrypted version first, then fall back to unencrypted
  let modelFile = path.join(modelsPath, modelConfig.file + '.enc');
  if (!fs.existsSync(modelFile)) {
    // Try unencrypted version (for development)
    modelFile = path.join(modelsPath, modelConfig.file);
  }

  // Check if file exists
  if (!fs.existsSync(modelFile)) {
    console.error('Model file not found:', modelFile);
    alert(`Model file not found: ${modelConfig.file}\n\nPlease convert the model and place it in src/assets/models/`);
    return;
  }

  console.log('Switching to model:', modelConfig.name);

  // Reset the paint mesh material so it gets recreated for the new model
  paintMeshMaterial = null;

  await loadModel(modelFile);
  currentModelId = modelId;

  // Re-apply current texture if one is loaded
  if (currentTexture) {
    applyTextureToModel(currentTexture);
  } else {
    // Apply body color even without texture
    const paintMesh = findPaintMesh();
    if (paintMesh) {
      paintMeshMaterial = liveryShaderMaterial();
      paintMeshMaterial.uniforms.bodyColor.value = currentBodyColor;
      paintMeshMaterial.uniforms.glossiness.value = currentGlossiness;
      paintMesh.material = paintMeshMaterial;
    }
  }

  // Apply glass materials if glass meshes are defined
  if (modelConfig.glassMeshes && modelConfig.glassMeshes.length > 0) {
    applyGlassMaterials(modelConfig.glassMeshes);
  }

  // Apply detail texture if defined
  if (modelConfig.detailMesh && modelConfig.detailTexture) {
    applyDetailTexture(modelConfig.detailMesh, modelConfig.detailTexture);
  }

  // Update the model link in the footer
  updateModelLink(modelConfig);
}

// Create glass material for windows
function createGlassMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0x222222,
    metalness: 0.0,
    roughness: 0.1,
    transmission: 0.9,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide
  });
}

// Apply glass material to specified meshes
function applyGlassMaterials(glassMeshNames) {
  if (!currentModel) return;

  const glassMaterial = createGlassMaterial();

  currentModel.traverse((child) => {
    if (child.isMesh && glassMeshNames.includes(child.name)) {
      console.log('Applying glass material to:', child.name);
      child.material = glassMaterial;
    }
  });
}

// Apply detail texture to specified mesh
function applyDetailTexture(detailMeshName, detailTexturePath) {
  if (!currentModel) return;

  const texturePath = path.join(assetsPath, 'textures', detailTexturePath);

  if (!fs.existsSync(texturePath)) {
    console.warn('Detail texture not found:', texturePath);
    return;
  }

  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(texturePath, (texture) => {
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;

    currentModel.traverse((child) => {
      if (child.isMesh && child.name.includes(detailMeshName)) {
        console.log('Applying detail texture to:', child.name);
        child.material = new THREE.MeshStandardMaterial({
          map: texture,
          transparent: true,
          side: THREE.DoubleSide
        });
      }
    });
  });
}

// Populate model selector dropdown (both native and custom)
function populateModelSelector() {
  const select = document.getElementById('model-select');
  const customOptions = document.getElementById('model-select-options');

  if (!select) return;

  select.innerHTML = '';
  if (customOptions) customOptions.innerHTML = '';

  // Group models by manufacturer
  const byManufacturer = {};
  modelsConfig.models.forEach(model => {
    if (!byManufacturer[model.manufacturer]) {
      byManufacturer[model.manufacturer] = [];
    }
    byManufacturer[model.manufacturer].push(model);
  });

  // Create optgroups for each manufacturer
  Object.keys(byManufacturer).sort().forEach(manufacturer => {
    const optgroup = document.createElement('optgroup');
    optgroup.label = manufacturer;

    // Custom dropdown group
    if (customOptions) {
      const groupDiv = document.createElement('div');
      groupDiv.className = 'custom-select-group';

      const groupLabel = document.createElement('div');
      groupLabel.className = 'custom-select-group-label';
      groupLabel.textContent = manufacturer;
      groupDiv.appendChild(groupLabel);

      byManufacturer[manufacturer]
        .sort((a, b) => a.year - b.year)
        .forEach(model => {
          // Native option
          const option = document.createElement('option');
          option.value = model.id;
          option.textContent = `${model.year} ${model.name}`;
          optgroup.appendChild(option);

          // Custom option
          const customOption = document.createElement('div');
          customOption.className = 'custom-select-option';
          customOption.dataset.value = model.id;
          customOption.textContent = `${model.year} ${model.name}`;
          groupDiv.appendChild(customOption);
        });

      customOptions.appendChild(groupDiv);
    } else {
      byManufacturer[manufacturer]
        .sort((a, b) => a.year - b.year)
        .forEach(model => {
          const option = document.createElement('option');
          option.value = model.id;
          option.textContent = `${model.year} ${model.name}`;
          optgroup.appendChild(option);
        });
    }

    select.appendChild(optgroup);
  });

  // Select the current model
  if (currentModelId) {
    select.value = currentModelId;
    updateCustomSelectValue(currentModelId);
  }
}

// Update custom select display value
function updateCustomSelectValue(modelId) {
  const trigger = document.getElementById('model-select-trigger');
  const options = document.querySelectorAll('.custom-select-option');

  if (!trigger) return;

  const modelConfig = getModelConfig(modelId);
  if (modelConfig) {
    const valueSpan = trigger.querySelector('.custom-select-value');
    if (valueSpan) {
      valueSpan.textContent = `${modelConfig.year} ${modelConfig.name}`;
    }
  }

  // Update selected state on options
  options.forEach(opt => {
    opt.classList.toggle('selected', opt.dataset.value === modelId);
  });
}

// Initialize custom select dropdown behavior
function initCustomSelect() {
  const container = document.getElementById('model-select-container');
  const trigger = document.getElementById('model-select-trigger');
  const dropdown = document.getElementById('model-select-dropdown');
  const optionsContainer = document.getElementById('model-select-options');

  if (!container || !trigger || !dropdown) return;

  // Toggle dropdown on trigger click
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    container.classList.toggle('open');

    // Scroll selected option into view when opening
    if (container.classList.contains('open')) {
      const selected = optionsContainer.querySelector('.custom-select-option.selected');
      if (selected) {
        selected.scrollIntoView({ block: 'nearest' });
      }
    }
  });

  // Handle option selection
  optionsContainer.addEventListener('click', (e) => {
    const option = e.target.closest('.custom-select-option');
    if (option) {
      const modelId = option.dataset.value;
      if (modelId) {
        // Update native select
        const select = document.getElementById('model-select');
        if (select) select.value = modelId;

        // Update custom select display
        updateCustomSelectValue(modelId);

        // Close dropdown
        container.classList.remove('open');

        // Trigger model switch
        switchModel(modelId);
      }
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      container.classList.remove('open');
    }
  });

  // Close dropdown on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && container.classList.contains('open')) {
      container.classList.remove('open');
    }
  });
}

// Initialize models on startup
loadModelsConfig();

// Load default model (first in config) - defer to after DOMContentLoaded
// so that all variables are initialized first
let defaultModelId = null;
if (modelsConfig.models.length > 0) {
  defaultModelId = modelsConfig.models[0].id;
}

// PSD Texture handling
let currentTexture = null;
let currentPsdPath = null;
let currentBodyColor = new THREE.Color(0xffffff);
let currentGlossiness = 0.0;
let paintMeshMaterial = null;

// File watcher
let fileWatcher = null;
let reloadDebounceTimer = null;
const DEBOUNCE_DELAY = 500; // ms to wait after file change before reloading

// Update watch indicator UI
function updateWatchIndicator(isWatching) {
  const indicator = document.getElementById('watch-indicator');
  if (indicator) {
    if (isWatching) {
      indicator.classList.add('watching');
      indicator.title = 'Watching for changes';
    } else {
      indicator.classList.remove('watching');
      indicator.title = '';
    }
  }
}

// Start watching a PSD file for changes
function startWatchingFile(filePath) {
  // Clean up existing watcher
  stopWatchingFile();

  console.log('Starting to watch:', filePath);

  fileWatcher = chokidar.watch(filePath, {
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100
    }
  });

  fileWatcher.on('change', () => {
    console.log('File change detected:', filePath);

    // Debounce the reload
    if (reloadDebounceTimer) {
      clearTimeout(reloadDebounceTimer);
    }

    reloadDebounceTimer = setTimeout(async () => {
      console.log('Reloading PSD...');
      try {
        const texture = await loadPsdAsTexture(filePath);
        applyTextureToModel(texture);
        console.log('PSD texture reloaded successfully');
      } catch (err) {
        console.error('Failed to reload PSD:', err);
      }
    }, DEBOUNCE_DELAY);
  });

  fileWatcher.on('error', (error) => {
    console.error('File watcher error:', error);
  });

  // Update UI indicator
  updateWatchIndicator(true);
}

// Stop watching the current file
function stopWatchingFile() {
  if (reloadDebounceTimer) {
    clearTimeout(reloadDebounceTimer);
    reloadDebounceTimer = null;
  }

  if (fileWatcher) {
    fileWatcher.close();
    fileWatcher = null;
    console.log('Stopped watching file');
  }

  updateWatchIndicator(false);
}

// Paint mesh name pattern (may have trailing underscore variations)
const PAINT_MESH_NAMES = [
  'vehicle_generic_smallspecmap__PAINT_1',
  'vehicle_generic_smallspecmap__PAINT_1_'
];

// Find the paint mesh in the current model
function findPaintMesh() {
  if (!currentModel) return null;

  let paintMesh = null;
  currentModel.traverse((child) => {
    if (child.isMesh) {
      // Check if mesh name matches any of the paint mesh patterns
      if (PAINT_MESH_NAMES.some(name => child.name.includes(name)) ||
          child.name.toLowerCase().includes('paint')) {
        paintMesh = child;
      }
    }
  });

  // If no paint mesh found by name, use the first mesh
  if (!paintMesh) {
    currentModel.traverse((child) => {
      if (child.isMesh && !paintMesh) {
        paintMesh = child;
      }
    });
  }

  return paintMesh;
}

// Load and parse PSD file, return as Three.js texture
async function loadPsdAsTexture(psdPath) {
  console.log('Loading PSD:', psdPath);

  const psd = await PSD.open(psdPath);
  const width = psd.header.width;
  const height = psd.header.height;

  console.log('PSD Info:', {
    width: width,
    height: height,
    channels: psd.header.channels,
    depth: psd.header.depth,
    mode: psd.header.mode
  });

  // Get the raw pixel data (RGBA)
  const pixelData = psd.image.pixelData;

  // Create a canvas to convert pixel data to an image
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Create ImageData from pixel array
  const imageData = ctx.createImageData(width, height);
  imageData.data.set(pixelData);
  ctx.putImageData(imageData, 0, 0);

  // Dispose of old texture if exists
  if (currentTexture) {
    currentTexture.dispose();
  }

  // Create texture directly from canvas
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  texture.needsUpdate = true;

  currentTexture = texture;
  return texture;
}

// Custom shader for body color + PSD texture blending with lighting
const liveryShaderMaterial = () => {
  return new THREE.ShaderMaterial({
    uniforms: {
      bodyColor: { value: currentBodyColor },
      liveryTexture: { value: null },
      hasTexture: { value: false },
      glossiness: { value: 0.0 },
      viewPosition: { value: new THREE.Vector3() }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;

      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 bodyColor;
      uniform sampler2D liveryTexture;
      uniform bool hasTexture;
      uniform float glossiness;
      uniform vec3 viewPosition;

      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec3 baseColor = bodyColor;

        if (hasTexture) {
          vec4 texColor = texture2D(liveryTexture, vUv);
          // Blend: texture over body color based on texture alpha
          baseColor = mix(bodyColor, texColor.rgb, texColor.a);
        }

        vec3 normal = normalize(vNormal);

        // Main directional light from top-right-front
        vec3 lightDir1 = normalize(vec3(0.5, 1.0, 0.7));
        float diff1 = max(dot(normal, lightDir1), 0.0);

        // Fill light from opposite side (softer)
        vec3 lightDir2 = normalize(vec3(-0.5, 0.5, -0.5));
        float diff2 = max(dot(normal, lightDir2), 0.0) * 0.3;

        // Ambient base ensures shadowed areas aren't too dark
        float ambient = 0.55;

        // Combine lighting - reaches ~1.0 at brightest point
        float lightFactor = ambient + diff1 * 0.4 + diff2;

        // Clamp to prevent over-brightening
        lightFactor = min(lightFactor, 1.0);

        vec3 finalColor = baseColor * lightFactor;

        // Specular highlights (glossiness)
        if (glossiness > 0.0) {
          vec3 viewDir = normalize(viewPosition - vWorldPosition);

          // Specular from main light
          vec3 reflectDir1 = reflect(-lightDir1, normal);
          float spec1 = pow(max(dot(viewDir, reflectDir1), 0.0), 16.0 + glossiness * 64.0);

          // Specular from fill light (weaker)
          vec3 reflectDir2 = reflect(-lightDir2, normal);
          float spec2 = pow(max(dot(viewDir, reflectDir2), 0.0), 16.0 + glossiness * 64.0) * 0.3;

          float specular = (spec1 + spec2) * glossiness;
          finalColor += vec3(specular);
        }

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
    side: THREE.DoubleSide
  });
};

// Apply texture to the paint mesh
function applyTextureToModel(texture) {
  const paintMesh = findPaintMesh();

  if (!paintMesh) {
    console.error('No paint mesh found in model');
    return false;
  }

  console.log('Applying texture to mesh:', paintMesh.name);

  // Create or update the shader material
  if (!paintMeshMaterial) {
    paintMeshMaterial = liveryShaderMaterial();
  }

  paintMeshMaterial.uniforms.liveryTexture.value = texture;
  paintMeshMaterial.uniforms.hasTexture.value = true;
  paintMeshMaterial.uniforms.bodyColor.value = currentBodyColor;
  paintMeshMaterial.uniforms.glossiness.value = currentGlossiness;
  paintMeshMaterial.needsUpdate = true;

  paintMesh.material = paintMeshMaterial;

  return true;
}

// Update body color
function setBodyColor(hexColor) {
  currentBodyColor.set(hexColor);

  if (paintMeshMaterial) {
    paintMeshMaterial.uniforms.bodyColor.value = currentBodyColor;
    paintMeshMaterial.needsUpdate = true;
  }

  // If no texture loaded yet, still apply the color to the mesh
  const paintMesh = findPaintMesh();
  if (paintMesh && !paintMeshMaterial) {
    paintMeshMaterial = liveryShaderMaterial();
    paintMeshMaterial.uniforms.bodyColor.value = currentBodyColor;
    paintMeshMaterial.uniforms.glossiness.value = currentGlossiness;
    paintMesh.material = paintMeshMaterial;
  }
}

// Update glossiness
function setGlossiness(value) {
  currentGlossiness = value / 100.0; // Convert 0-100 to 0-1

  if (paintMeshMaterial) {
    paintMeshMaterial.uniforms.glossiness.value = currentGlossiness;
    paintMeshMaterial.needsUpdate = true;
  }

  // If no material yet, create one
  const paintMesh = findPaintMesh();
  if (paintMesh && !paintMeshMaterial) {
    paintMeshMaterial = liveryShaderMaterial();
    paintMeshMaterial.uniforms.glossiness.value = currentGlossiness;
    paintMesh.material = paintMeshMaterial;
  }
}

// Load PNG/JPG as texture
async function loadImageAsTexture(imagePath) {
  return new Promise((resolve, reject) => {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      imagePath,
      (texture) => {
        texture.flipY = false;
        texture.colorSpace = THREE.LinearSRGBColorSpace;
        texture.needsUpdate = true;
        if (currentTexture) currentTexture.dispose();
        currentTexture = texture;
        resolve(texture);
      },
      undefined,
      (err) => reject(new Error('Failed to load image'))
    );
  });
}

// Handle texture file selection (PSD, PNG, JPG)
async function handleSelectPsd() {
  const filePath = await ipcRenderer.invoke('open-psd-dialog');

  if (!filePath) {
    console.log('No file selected');
    return;
  }

  currentPsdPath = filePath;
  const ext = path.extname(filePath).toLowerCase();

  // Update UI
  const psdPathElement = document.getElementById('psd-path');
  psdPathElement.textContent = path.basename(filePath);

  try {
    let texture;

    if (ext === '.psd') {
      texture = await loadPsdAsTexture(filePath);
    } else {
      // PNG, JPG, JPEG
      texture = await loadImageAsTexture(filePath);
    }

    applyTextureToModel(texture);
    console.log('Texture applied successfully');

    // Start watching the file for changes
    startWatchingFile(filePath);
  } catch (err) {
    console.error('Failed to load texture:', err);
    psdPathElement.textContent = `Error: ${err.message || 'Failed to load file'}`;

    if (ext === '.psd') {
      showErrorModal('Failed to load PSD file', `
        Reasons:
        <ul>
          <li>File may be too large (try a PNG export)</li>
          <li>Unsupported color mode (use RGB 8-bit)</li>
        </ul>
      `);
    }
  }
}

// Set up UI event listeners when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Populate model selector
  populateModelSelector();

  // Initialize custom select dropdown
  initCustomSelect();

  // Load default model using switchModel (applies body color properly)
  if (defaultModelId) {
    const modelSelect = document.getElementById('model-select');
    if (modelSelect) {
      modelSelect.value = defaultModelId;
    }
    updateCustomSelectValue(defaultModelId);
    switchModel(defaultModelId);
  }

  // Model selector event listener (native select fallback)
  const modelSelect = document.getElementById('model-select');
  if (modelSelect) {
    modelSelect.addEventListener('change', (e) => {
      const modelId = e.target.value;
      if (modelId) {
        updateCustomSelectValue(modelId);
        switchModel(modelId);
      }
    });
  }

  // PSD file selector
  const selectPsdBtn = document.getElementById('select-psd-btn');
  if (selectPsdBtn) {
    selectPsdBtn.addEventListener('click', handleSelectPsd);
  }

  // Body color picker event listener
  const bodyColorInput = document.getElementById('body-color');
  const colorHexDisplay = document.getElementById('color-hex');

  if (bodyColorInput) {
    bodyColorInput.addEventListener('input', (e) => {
      const color = e.target.value;
      setBodyColor(color);
      if (colorHexDisplay) {
        colorHexDisplay.textContent = color.toUpperCase();
      }
    });
  }

  // Glossiness slider event listener
  const glossinessSlider = document.getElementById('glossiness-slider');
  const glossValueDisplay = document.getElementById('gloss-value');
  const resetGlossBtn = document.getElementById('reset-gloss-btn');

  if (glossinessSlider) {
    glossinessSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value, 10);
      setGlossiness(value);
      if (glossValueDisplay) {
        glossValueDisplay.textContent = value;
      }
    });
  }

  if (resetGlossBtn) {
    resetGlossBtn.addEventListener('click', () => {
      setGlossiness(0);
      if (glossinessSlider) glossinessSlider.value = 0;
      if (glossValueDisplay) glossValueDisplay.textContent = '0';
    });
  }

  // Background color picker event listener
  const bgColorInput = document.getElementById('bg-color');
  const bgColorHexDisplay = document.getElementById('bg-color-hex');

  if (bgColorInput) {
    bgColorInput.addEventListener('input', (e) => {
      const color = e.target.value;
      scene.background = new THREE.Color(color);
      if (bgColorHexDisplay) {
        bgColorHexDisplay.textContent = color.toUpperCase();
      }
    });
  }

  // Reset PSD button
  const resetPsdBtn = document.getElementById('reset-psd-btn');
  if (resetPsdBtn) {
    resetPsdBtn.addEventListener('click', () => {
      // Stop watching file
      if (typeof stopWatchingFile === 'function') {
        stopWatchingFile();
      }
      // Clear texture
      if (currentTexture) {
        currentTexture.dispose();
        currentTexture = null;
      }
      currentPsdPath = null;
      // Reset paint mesh material
      if (paintMeshMaterial) {
        paintMeshMaterial.uniforms.liveryTexture.value = null;
        paintMeshMaterial.uniforms.hasTexture.value = false;
        paintMeshMaterial.needsUpdate = true;
      }
      // Update UI
      const psdPathEl = document.getElementById('psd-path');
      if (psdPathEl) psdPathEl.textContent = 'No file selected';
    });
  }

  // Reset body color button
  const resetBodyColorBtn = document.getElementById('reset-body-color-btn');
  if (resetBodyColorBtn) {
    resetBodyColorBtn.addEventListener('click', () => {
      const defaultColor = '#ffffff';
      setBodyColor(defaultColor);
      if (bodyColorInput) bodyColorInput.value = defaultColor;
      if (colorHexDisplay) colorHexDisplay.textContent = defaultColor.toUpperCase();
    });
  }

  // Reset background color button
  const resetBgColorBtn = document.getElementById('reset-bg-color-btn');
  if (resetBgColorBtn) {
    resetBgColorBtn.addEventListener('click', () => {
      const defaultColor = '#1e1e1e';
      scene.background = new THREE.Color(defaultColor);
      if (bgColorInput) bgColorInput.value = defaultColor;
      if (bgColorHexDisplay) bgColorHexDisplay.textContent = defaultColor.toUpperCase();
    });
  }

  // Reset camera button
  const resetCameraBtn = document.getElementById('reset-camera-btn');
  if (resetCameraBtn) {
    resetCameraBtn.addEventListener('click', resetCamera);
  }

  // Panel toggle button
  const toggleBtn = document.getElementById('toggle-btn');
  const controlsPanel = document.getElementById('controls');
  const logo = document.getElementById('logo');

  if (toggleBtn && controlsPanel) {
    toggleBtn.addEventListener('click', () => {
      controlsPanel.classList.toggle('collapsed');
      const isCollapsed = controlsPanel.classList.contains('collapsed');

      toggleBtn.title = isCollapsed ? 'Expand panel' : 'Minimize panel';

      // Swap logo based on collapsed state
      if (logo) {
        logo.src = isCollapsed
          ? '../assets/logo-small.svg'
          : '../assets/logo.svg';
      }
    });
  }

  // Open external links in default browser
  document.querySelectorAll('a[href^="http"]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      shell.openExternal(link.href);
    });
  });

  // Open EULA when clicking licensing links
  document.querySelectorAll('.licensing-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      shell.openExternal('https://cdn.shopify.com/s/files/1/0757/8589/6248/files/SoftwareEndUserLicenseAgreement.md?v=1769547583');
    });
  });

  // Title bar window controls
  const minBtn = document.getElementById('min-btn');
  const maxBtn = document.getElementById('max-btn');
  const closeBtn = document.getElementById('close-btn');

  if (minBtn) {
    minBtn.addEventListener('click', () => {
      console.log('Minimize button clicked');
      if (ipcRenderer) {
        ipcRenderer.send('minimize-window');
      } else {
        console.error('ipcRenderer not available');
      }
    });
  } else {
    console.error('min-btn not found');
  }

  if (maxBtn) {
    maxBtn.addEventListener('click', () => {
      console.log('Maximize button clicked');
      if (ipcRenderer) {
        ipcRenderer.send('maximize-window');
      } else {
        console.error('ipcRenderer not available');
      }
    });
  } else {
    console.error('max-btn not found');
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      console.log('Close button clicked');
      if (ipcRenderer) {
        ipcRenderer.send('close-window');
      } else {
        console.error('ipcRenderer not available');
      }
    });
  } else {
    console.error('close-btn not found');
  }

  // Login screen handlers
  const loginScreen = document.getElementById('login-screen');
  const appContainer = document.getElementById('app-container');
  const activateBtn = document.getElementById('activate-btn');
  const licenseKeyInput = document.getElementById('license-key-input');
  const loginError = document.getElementById('login-error');

  // Function to show the main app
  async function showMainApp() {
    const loginContainer = document.querySelector('.login-container');
    const downloadContainer = document.getElementById('download-container');
    const downloadProgressFill = document.getElementById('download-progress-fill');
    const downloadStatus = document.getElementById('download-status');

    // Check if models need to be downloaded or updated
    let needsDownload = !areModelsDownloaded();
    let modelsVersion = null;

    // Check for model updates even if models exist
    if (!needsDownload) {
      try {
        const versionCheck = await checkModelsVersion();
        if (versionCheck.needsUpdate) {
          console.log('Models update available:', versionCheck.version);
          needsDownload = true;
          modelsVersion = versionCheck.version;
        }
      } catch (err) {
        console.log('Could not check for model updates:', err.message);
      }
    }

    if (needsDownload) {
      // Show download screen
      if (loginContainer) loginContainer.style.display = 'none';
      if (downloadContainer) downloadContainer.style.display = 'flex';

      try {
        // Get the saved license key
        const savedLicense = loadLicenseData();
        if (!savedLicense || !savedLicense.licenseKey) {
          throw new Error('No license key found');
        }

        // Download models with progress updates
        await downloadModels(savedLicense.licenseKey, (percent, status) => {
          if (downloadProgressFill) downloadProgressFill.style.width = percent + '%';
          if (downloadStatus) downloadStatus.textContent = status;
        });

        // Save the models version if we have one
        if (modelsVersion) {
          saveModelsVersion(modelsVersion);
        } else {
          // Try to get version from manifest for first download
          try {
            const response = await fetch(MODELS_MANIFEST_URL);
            if (response.ok) {
              const manifest = await response.json();
              saveModelsVersion(manifest.version);
            }
          } catch (e) {
            // Ignore - version tracking is optional
          }
        }

        // Update modelsPath to point to downloaded location
        modelsPath = getModelsPath();

      } catch (err) {
        console.error('Failed to download models:', err);
        if (downloadStatus) {
          downloadStatus.textContent = 'Download failed: ' + err.message;
          downloadStatus.style.color = '#e74c3c';
        }
        return; // Don't proceed to main app
      }
    }

    // Fetch latest models.json from R2 (async, non-blocking)
    fetchModelsConfig().then(() => {
      populateModelSelector();
    }).catch(err => {
      console.log('Using cached models config');
    });

    loginScreen.classList.add('hidden');
    appContainer.classList.remove('hidden');
    // Make titlebar solid on main app
    document.querySelector('.titlebar')?.classList.add('solid');
    // Trigger a resize event so Three.js adjusts to the container
    window.dispatchEvent(new Event('resize'));
  }

  // Function to return to auth screen
  function showAuthScreen() {
    appContainer.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    // Make titlebar transparent on auth
    document.querySelector('.titlebar')?.classList.remove('solid');
    // Clear license input
    if (licenseKeyInput) licenseKeyInput.value = '';
    if (loginError) loginError.textContent = '';
  }

  // Auto-login: Check for existing valid license on startup
  async function checkExistingLicense() {
    const savedLicense = loadLicenseData();

    if (savedLicense && savedLicense.licenseKey) {
      console.log('Found saved license, validating...');

      try {
        const fingerprint = getMachineFingerprint();

        // Verify fingerprint matches
        if (savedLicense.fingerprint !== fingerprint) {
          console.log('Fingerprint mismatch, clearing license');
          clearLicenseData();
          return;
        }

        // Validate the license is still active
        const validation = await validateLicenseKey(savedLicense.licenseKey);

        if (validation.meta?.valid) {
          console.log('Saved license is valid, auto-logging in');
          showMainApp();
          return;
        } else {
          console.log('Saved license is no longer valid:', validation.meta?.code);
          clearLicenseData();
        }
      } catch (err) {
        console.error('Failed to validate saved license:', err);
        // Don't clear on network errors - allow offline use
      }
    }
  }

  // Run auto-login check
  checkExistingLicense();

  // Activate button - license validation with Keygen
  if (activateBtn) {
    activateBtn.addEventListener('click', async () => {
      console.log('Activate button clicked');

      const licenseKey = licenseKeyInput?.value?.trim();

      if (!licenseKey) {
        if (loginError) loginError.textContent = 'Please enter a license key';
        loginError?.classList.add('visible');
        return;
      }

      // Show loading state
      activateBtn.textContent = 'Validating...';
      activateBtn.disabled = true;
      if (loginError) {
        loginError.textContent = '';
        loginError.classList.remove('visible');
      }

      try {
        // Step 1: Validate the license key
        const validation = await validateLicenseKey(licenseKey);
        console.log('Full validation response:', JSON.stringify(validation, null, 2));

        if (validation.errors) {
          const errorMsg = validation.errors[0]?.detail || 'Invalid license key';
          throw new Error(errorMsg);
        }

        const meta = validation.meta;
        const licenseId = validation.data?.id;
        const code = meta?.code || 'UNKNOWN';

        console.log('License status:', { valid: meta?.valid, code: code, licenseId: licenseId });

        // Check for fatal validation errors
        if (!meta?.valid) {
          let errorMsg = 'License is not valid';

          switch (code) {
            case 'SUSPENDED':
              errorMsg = 'This license has been suspended';
              throw new Error(errorMsg);
            case 'EXPIRED':
              errorMsg = 'This license has expired';
              throw new Error(errorMsg);
            case 'OVERDUE':
              errorMsg = 'This license is overdue for renewal';
              throw new Error(errorMsg);
            case 'FINGERPRINT_SCOPE_MISMATCH':
              errorMsg = 'This license key is already registered to a machine.\nPlease try with a new license key.';
              throw new Error(errorMsg);
            case 'NO_MACHINES':
            case 'NO_MACHINE':
              // License is valid but needs machine activation - continue
              console.log('License needs machine activation');
              break;
            default:
              // For other codes, continue to try machine activation
              console.log('License code:', code, '- will attempt machine activation');
          }
        }

        // Step 2: Get machine fingerprint
        const fingerprint = getMachineFingerprint();

        // Step 3: Always try to activate the machine (if not already activated)
        loginError.textContent = 'Activating machine...';
        console.log('Attempting machine activation with fingerprint:', fingerprint);

        const activation = await activateMachine(licenseId, licenseKey, fingerprint);
        console.log('Machine activation response:', JSON.stringify(activation, null, 2));

        if (activation.errors) {
          const errorCode = activation.errors[0]?.code;
          const errorMsg = activation.errors[0]?.detail || 'Failed to activate machine';

          // If machine already exists, that's fine - continue
          if (errorCode === 'MACHINE_ALREADY_ACTIVATED' ||
              errorMsg.includes('already') ||
              errorMsg.includes('exists')) {
            console.log('Machine already activated, continuing...');
          } else if (errorMsg.includes('exceeded') || errorMsg.includes('maximum')) {
            // License already has max machines registered
            throw new Error('This license key is already registered to a machine.\nPlease try with a new license key.');
          } else {
            throw new Error(errorMsg);
          }
        } else {
          console.log('Machine activated successfully');
        }

        // Step 4: Save license data locally
        saveLicenseData({
          licenseKey: licenseKey,
          licenseId: licenseId,
          fingerprint: fingerprint,
          activatedAt: new Date().toISOString()
        });

        // Success - show main app
        console.log('License activated successfully!');
        showMainApp();

      } catch (err) {
        console.error('Activation failed:', err);
        const errorMessage = err.message || 'Activation failed. Please check your internet connection.';
        if (loginError) {
          loginError.textContent = errorMessage;
          loginError.classList.add('visible');
        }
      } finally {
        activateBtn.textContent = 'Activate License';
        activateBtn.disabled = false;
      }
    });
  } else {
    console.error('Activate button not found in DOM');
  }

  console.log('All event handlers attached successfully');
  console.log('Window controls:', {
    minBtn: !!document.getElementById('min-btn'),
    maxBtn: !!document.getElementById('max-btn'),
    closeBtn: !!document.getElementById('close-btn')
  });
  console.log('Login elements:', {
    activateBtn: !!document.getElementById('activate-btn'),
    licenseInput: !!document.getElementById('license-key-input')
  });

  // App update notification handlers
  ipcRenderer.on('update-available', (event, info) => {
    console.log('Update available:', info.version);
    showUpdateNotification(info.version);
  });

  ipcRenderer.on('update-download-progress', (event, progress) => {
    updateDownloadProgress(progress.percent);
  });

  ipcRenderer.on('update-downloaded', (event, info) => {
    console.log('Update downloaded:', info.version);
    showUpdateReady(info.version);
  });
});

// Show update available notification
function showUpdateNotification(version) {
  const existing = document.getElementById('update-notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.id = 'update-notification';
  notification.innerHTML = `
    <div class="update-content">
      <span>Update available: v${version}</span>
      <button id="update-download-btn">Download</button>
      <button id="update-dismiss-btn">Later</button>
    </div>
  `;
  document.body.appendChild(notification);

  document.getElementById('update-download-btn').addEventListener('click', () => {
    ipcRenderer.send('download-update');
    notification.querySelector('.update-content').innerHTML = `
      <span>Downloading update...</span>
      <div class="update-progress-bar"><div class="update-progress-fill" style="width: 0%"></div></div>
    `;
  });

  document.getElementById('update-dismiss-btn').addEventListener('click', () => {
    notification.remove();
  });
}

// Update download progress
function updateDownloadProgress(percent) {
  const fill = document.querySelector('.update-progress-fill');
  if (fill) {
    fill.style.width = percent.toFixed(0) + '%';
  }
}

// Show update ready to install
function showUpdateReady(version) {
  const notification = document.getElementById('update-notification');
  if (notification) {
    notification.querySelector('.update-content').innerHTML = `
      <span>Update ready! Restart to install v${version}</span>
      <button id="update-restart-btn">Restart Now</button>
      <button id="update-later-btn">Later</button>
    `;

    document.getElementById('update-restart-btn').addEventListener('click', () => {
      ipcRenderer.send('install-update');
    });

    document.getElementById('update-later-btn').addEventListener('click', () => {
      notification.remove();
    });
  }
}

// Help Modal functionality
function initHelpModal() {
  const overlay = document.getElementById('help-modal-overlay');
  const closeBtn = document.getElementById('help-modal-close');
  const navItems = document.querySelectorAll('.help-nav-item');
  const content = document.querySelector('.help-modal-content');
  const copyBtn = document.getElementById('copy-license-key');

  if (!overlay) return;

  // Open/close functions
  function openHelpModal() {
    overlay.classList.add('visible');
    populateHelpModalData();
  }

  function closeHelpModal() {
    overlay.classList.remove('visible');
  }

  // Close button
  if (closeBtn) {
    closeBtn.addEventListener('click', closeHelpModal);
  }

  // Close on overlay click (outside modal)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeHelpModal();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('visible')) {
      closeHelpModal();
    }
  });

  // Ctrl+H to toggle help modal
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'h') {
      e.preventDefault();
      if (overlay.classList.contains('visible')) {
        closeHelpModal();
      } else {
        openHelpModal();
      }
    }
  });

  // Navigation clicks - smooth scroll to section
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = item.getAttribute('href').substring(1);
      const targetSection = document.getElementById(targetId);

      if (targetSection && content) {
        targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Update active state
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
      }
    });
  });

  // Update active nav item on scroll
  if (content) {
    content.addEventListener('scroll', () => {
      const sections = document.querySelectorAll('.help-section');
      let currentSection = '';

      sections.forEach(section => {
        const sectionTop = section.offsetTop - content.offsetTop;
        if (content.scrollTop >= sectionTop - 50) {
          currentSection = section.id;
        }
      });

      navItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('href') === '#' + currentSection) {
          item.classList.add('active');
        }
      });
    });
  }

  // Copy license key button
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const licenseInput = document.getElementById('user-license-key');
      if (licenseInput && licenseInput.value && licenseInput.value !== 'Loading...' && licenseInput.value !== 'Not activated') {
        try {
          await navigator.clipboard.writeText(licenseInput.value);
          copyBtn.classList.add('copied');
          setTimeout(() => copyBtn.classList.remove('copied'), 1500);
        } catch (err) {
          console.error('Failed to copy:', err);
        }
      }
    });
  }
}

// Populate help modal with user data and version info
async function populateHelpModalData() {
  // User details
  const licenseKeyInput = document.getElementById('user-license-key');
  const machineNameEl = document.getElementById('user-machine-name');
  const activatedDateEl = document.getElementById('user-activated-date');

  const savedLicense = loadLicenseData();

  if (savedLicense) {
    if (licenseKeyInput) {
      licenseKeyInput.value = savedLicense.licenseKey || 'Unknown';
    }
    if (machineNameEl) {
      machineNameEl.textContent = os.hostname() || 'Unknown';
    }
    if (activatedDateEl && savedLicense.activatedAt) {
      const date = new Date(savedLicense.activatedAt);
      activatedDateEl.textContent = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  } else {
    if (licenseKeyInput) licenseKeyInput.value = 'Not activated';
    if (machineNameEl) machineNameEl.textContent = os.hostname() || 'Unknown';
    if (activatedDateEl) activatedDateEl.textContent = 'Not activated';
  }

  // Version info
  const versionEl = document.getElementById('help-app-version');
  const changelogEl = document.getElementById('help-changelog-content');

  // Get app version from package.json via electron
  if (versionEl && ipcRenderer) {
    try {
      const appVersion = await ipcRenderer.invoke('get-app-version');
      versionEl.textContent = 'v' + appVersion;
    } catch (err) {
      // Fallback - try to read from the DOM or use a default
      versionEl.textContent = 'v1.0.1';
    }
  }

  // Fetch changelog from models-manifest.json
  if (changelogEl) {
    try {
      const response = await fetch(MODELS_MANIFEST_URL);
      if (response.ok) {
        const manifest = await response.json();
        if (manifest.changelog) {
          changelogEl.innerHTML = manifest.changelog
            .split('\n')
            .map(line => `<p>${line}</p>`)
            .join('');
        } else if (manifest.version) {
          changelogEl.innerHTML = `<p>Version ${manifest.version} - Latest release</p>`;
        }
      } else {
        changelogEl.innerHTML = '<p>Unable to load changelog.</p>';
      }
    } catch (err) {
      console.error('Failed to fetch changelog:', err);
      changelogEl.innerHTML = '<p>Unable to load changelog.</p>';
    }
  }
}

// Initialize help modal when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initHelpModal();
});

// Export for use in other modules
module.exports = {
  scene,
  camera,
  renderer,
  controls,
  loadModel,
  currentModel: () => currentModel,
  loadPsdAsTexture,
  applyTextureToModel,
  setBodyColor
};
