// Test script to verify setup
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Checking setup...\n');

// Check if .env.local exists
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  console.log('✅ .env.local file found');
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const requiredVars = [
    'MONGODB_URI',
    'NEXTAUTH_SECRET', 
    'NEXTAUTH_URL',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET'
  ];
  
  const missingVars = requiredVars.filter(varName => !envContent.includes(varName));
  
  if (missingVars.length === 0) {
    console.log('✅ All required environment variables are present');
  } else {
    console.log('❌ Missing environment variables:', missingVars.join(', '));
  }
} else {
  console.log('❌ .env.local file not found');
  console.log('   Please create .env.local with the required variables');
}

// Check if package.json has required dependencies
const packagePath = path.join(__dirname, 'package.json');
if (fs.existsSync(packagePath)) {
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const requiredDeps = ['next-auth', '@auth/mongodb-adapter'];
  
  const missingDeps = requiredDeps.filter(dep => !packageJson.dependencies[dep]);
  
  if (missingDeps.length === 0) {
    console.log('✅ All required dependencies are installed');
  } else {
    console.log('❌ Missing dependencies:', missingDeps.join(', '));
    console.log('   Run: npm install ' + missingDeps.join(' '));
  }
}

// Check if key files exist
const keyFiles = [
  'src/lib/auth.ts',
  'src/app/api/auth/[...nextauth]/route.ts',
  'src/components/ProfileAvatar.tsx',
  'src/app/auth/page.tsx',
  'src/app/onboarding/page.tsx'
];

console.log('\n📁 Checking key files...');
keyFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - Missing`);
  }
});

console.log('\n🚀 Next steps:');
console.log('1. Set up Google OAuth credentials (see setup.md)');
console.log('2. Configure .env.local with your credentials');
console.log('3. Start MongoDB');
console.log('4. Run: npm run dev');
console.log('5. Visit: http://localhost:3000/auth'); 