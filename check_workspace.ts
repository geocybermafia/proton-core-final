import fs from 'fs';
try {
  console.log('Contents of /workspace:', fs.readdirSync('/workspace'));
  if (fs.existsSync('/workspace/.git')) {
    console.log('Found .git in /workspace!');
  }
} catch (err: any) {
  console.error('Error reading /workspace:', err.message);
}
