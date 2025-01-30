import './styles/style.css';
import * as THREE from 'three';

// Additional Three.js Examples
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

// Dat.GUI (if you wish to use for debugging)
import * as dat from 'dat.gui';

// Canvas and loading screen elements
const canvas = document.querySelector('canvas.webgl');
const loadingScreen = document.querySelector('.loading-screen');
const loadingText = document.querySelector('.loading-screen div');

// HDRI path
const envStudio = "https://cdn.jsdelivr.net/gh/sabareesh-ed/sail@main/shanghai_bund_2k.hdr";
// const envStudio = "https://cdn.jsdelivr.net/gh/sabareesh-ed/sail@main/moonless_golf_1k.hdr";

// Create scene
const scene = new THREE.Scene();

// Create camera
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(-0.3, 0, 0.2);

// Create renderer
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);

// Tone mapping for HDR environment
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.2;

// Orbit Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.target.set(0, 0, 0);
controls.update();

// Load the HDR environment map
const rgbeLoader = new RGBELoader();
rgbeLoader.load(envStudio, function (texture) {
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = texture;
  // scene.background = texture;
});

let model = null;

// GLTF model loader
const loader = new GLTFLoader();
loader.load(
  'https://cdn.jsdelivr.net/gh/sabareesh-ed/sail@main/Mask%20Remeshed.glb',
  (gltf) => {
    console.log('Model loaded:', gltf);
    model = gltf.scene;
    scene.add(model);

    model.traverse((child) => {
      if (child.isMesh) {
        child.material.envMapIntensity = 0.4;
      }
    });

    loadingText.textContent = 'START';
    model.rotation.y = -10;
  },
  (xhr) => {
    console.log((xhr.loaded / xhr.total) * 100 + '% loaded');
  },
  (error) => {
    console.error('An error happened', error);
  }
);

// Hide loading screen on click
loadingScreen.addEventListener('click', () => {
  loadingScreen.style.display = 'none';
});

// Variables to store initial device orientation if on mobile
let initialAlpha = null;
let initialBeta = null;
let initialGamma = null;

// Target rotation for the model
const targetRotation = { x: 0, y: 0 };
const currentRotation = { x: 0, y: 0 };

// Utility functions
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeAngle(angle) {
  return (angle + Math.PI) % (2 * Math.PI) - Math.PI;
}

function lerp(start, end, t) {
  return start + (end - start) * t;
}

// Handle device orientation (mobile/tablet)
function handleOrientation(event) {
  const alpha = event.alpha * (Math.PI / 180);
  const beta = event.beta * (Math.PI / 180);
  const gamma = event.gamma * (Math.PI / 180);

  if (initialAlpha === null || initialBeta === null || initialGamma === null) {
    initialAlpha = alpha;
    initialBeta = beta;
    initialGamma = gamma;
  }

  const deltaBeta = normalizeAngle(beta - initialBeta);
  const deltaGamma = normalizeAngle(gamma - initialGamma);

  // Subtle rotation limits
  targetRotation.x = clamp(deltaBeta, -0.25, 0.25);
  targetRotation.y = clamp(deltaGamma, -0.5, 0.5);
}

// Check if device orientation permission is needed (iOS 13+)
function requestGyroPermission() {
  if (
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof DeviceOrientationEvent.requestPermission === 'function'
  ) {
    DeviceOrientationEvent.requestPermission()
      .then((response) => {
        if (response === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation);
        } else {
          console.log('Gyroscope permission denied.');
          alert('Permission to access the gyroscope was denied. Please enable it in your device settings.');
        }
      })
      .catch((error) => {
        console.error('Error requesting gyroscope permission:', error);
        alert('Error requesting permission. Please try again.');
      });
  } else {
    // If permission not needed (Android or older iOS), just add event listener
    window.addEventListener('deviceorientation', handleOrientation);
  }
}

// Detect mobile devices (basic check)
function isMobileDevice() {
  return /Mobi|Android/i.test(navigator.userAgent);
}

// Add click event to request gyroscope permission
document.body.addEventListener('click', () => {  
  if (isMobileDevice()) {
    requestGyroPermission();
  }
});

// Mouse-based rotation (desktop)
function handleMouseMove(event) {
  // If the user is on desktop, we apply a subtle rotation based on mouse position
  if (!isMobileDevice()) {
    const rect = renderer.domElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Normalize -1 to +1
    const normalizedX = (x / rect.width) * 2 - 1;
    const normalizedY = (y / rect.height) * 2 - 1;

    // Apply subtle rotation; tweak multipliers for more or less rotation
    targetRotation.x = normalizedY * 0.1; // invert Y so moving up tilts forward
    targetRotation.y = normalizedX * 0.1;  
  }
}

// Mouse move listener (only needed for desktop)
if (!isMobileDevice()) {
  window.addEventListener('mousemove', handleMouseMove);
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  // Smoothly interpolate model rotation to target rotation
  if (model) {
    currentRotation.x = lerp(currentRotation.x, targetRotation.x, 0.1);
    currentRotation.y = lerp(currentRotation.y, targetRotation.y, 0.1);

    model.rotation.x = currentRotation.x;
    model.rotation.y = currentRotation.y;
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();

// Resize handling
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
