import fs from 'fs';
console.log('--- ROOT DIRECTORY ---');
try {
  console.log(fs.readdirSync('/root'));
} catch (e: any) {
  console.log('Cannot read /root:', e.message);
}

const filesToCheck = [
  '/root/.gitconfig',
  '/root/.bash_history',
  '/root/.config',
  '/root/.npm_config'
];

for (const file of filesToCheck) {
  if (fs.existsSync(file)) {
    console.log(`\n--- CONTENT OF ${file} ---`);
    try {
      console.log(fs.readFileSync(file, 'utf-8'));
    } catch (e: any) {
      console.log('Error reading:', e.message);
    }
  } else {
    console.log(`${file} does not exist`);
  }
}
