#!/usr/bin/env node

/**
 * Icon Resizer Script
 * Resizes the main logo to all required icon sizes
 * 
 * Usage: node scripts/resize-icons.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PUBLIC_DIR = path.join(__dirname, '../public');
const SOURCE_IMAGE = path.join(PUBLIC_DIR, 'tj-gym-logo.png');

// Define target sizes
const SIZES = [
  { width: 16, height: 16, name: 'favicon-16x16.png' },
  { width: 32, height: 32, name: 'favicon-32x32.png' },
  { width: 180, height: 180, name: 'apple-touch-icon.png' },
  { width: 192, height: 192, name: 'android-chrome-192x192.png' },
  { width: 512, height: 512, name: 'android-chrome-512x512.png' },
];

// Check if source image exists
if (!fs.existsSync(SOURCE_IMAGE)) {
  console.error('❌ Error: Source image not found at:', SOURCE_IMAGE);
  console.error('Please place your tj-gym-logo.png in the /public directory');
  process.exit(1);
}

console.log('🎨 Starting icon generation...');
console.log('📁 Source:', SOURCE_IMAGE);
console.log('');

// Check if ImageMagick is installed
let hasImageMagick = false;
try {
  execSync('magick --version', { stdio: 'ignore' });
  hasImageMagick = true;
  console.log('✅ ImageMagick detected');
} catch (e) {
  console.log('⚠️  ImageMagick not found, will use sips (macOS only)');
}

// Function to resize using ImageMagick
function resizeWithImageMagick(size) {
  const output = path.join(PUBLIC_DIR, size.name);
  const cmd = `magick "${SOURCE_IMAGE}" -resize ${size.width}x${size.height} "${output}"`;
  
  try {
    execSync(cmd, { stdio: 'ignore' });
    console.log(`✅ Generated: ${size.name} (${size.width}x${size.height})`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to generate ${size.name}`);
    return false;
  }
}

// Function to resize using sips (macOS)
function resizeWithSips(size) {
  const output = path.join(PUBLIC_DIR, size.name);
  
  try {
    // Copy source to output first
    fs.copyFileSync(SOURCE_IMAGE, output);
    
    // Resize using sips
    const cmd = `sips -z ${size.height} ${size.width} "${output}"`;
    execSync(cmd, { stdio: 'ignore' });
    
    console.log(`✅ Generated: ${size.name} (${size.width}x${size.height})`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to generate ${size.name}`);
    return false;
  }
}

// Generate all sizes
let successCount = 0;
SIZES.forEach(size => {
  const success = hasImageMagick 
    ? resizeWithImageMagick(size)
    : resizeWithSips(size);
  
  if (success) successCount++;
});

console.log('');
console.log(`🎉 Completed! Generated ${successCount}/${SIZES.length} icons`);

if (successCount === SIZES.length) {
  console.log('');
  console.log('✨ All icons generated successfully!');
  console.log('📍 Location:', PUBLIC_DIR);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Check the generated icons in /public/');
  console.log('  2. git add public/ scripts/');
  console.log('  3. git commit -m "Update app icons with new T&J GYM logo"');
  console.log('  4. git push');
} else {
  console.log('');
  console.log('⚠️  Some icons failed to generate.');
  console.log('Please check the errors above.');
}
