const { execSync } = require('child_process');
const fs = require('fs');

try {
  console.log('Cleaning /tmp/proton-core-final if it exists...');
  fs.rmSync('/tmp/proton-core-final', { recursive: true, force: true });
  
  console.log('Cloning repository geocybermafia/proton-core-final ...');
  execSync('git clone https://github.com/geocybermafia/proton-core-final.git /tmp/proton-core-final');
  console.log('Cloned successfully!');

  console.log('Copying files to /app/applet ...');
  execSync('cp -af /tmp/proton-core-final/. /app/applet/');
  console.log('Files copied successfully!');

  console.log('Listing current applet directory contents:');
  const files = fs.readdirSync('/app/applet');
  console.log(files);

} catch (e) {
  console.log('Error during restore process:', e.message);
}















