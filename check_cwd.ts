import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('CWD:', process.cwd());
console.log('Is .git folder here?', fs.existsSync('.git'));
console.log('Contents of CWD:', fs.readdirSync('.'));

// Check parent directories
let dir = process.cwd();
while (dir !== path.parse(dir).root) {
  dir = path.dirname(dir);
  console.log(`Checking parent directory ${dir}:`);
  try {
    const contents = fs.readdirSync(dir);
    console.log(`  Contents:`, contents);
    if (contents.includes('.git')) {
      console.log(`  FOUND .git folder in ${dir}!`);
    }
  } catch (err) {
    console.log(`  Could not read ${dir}`);
  }
}
