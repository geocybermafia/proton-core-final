import { execSync } from 'child_process';
console.log('Searching for any directories containing ".git"...');
try {
  const result = execSync('find / -name ".git" -type d 2>/dev/null', { encoding: 'utf-8', stdio: 'pipe' });
  console.log('Found .git dirs at:\n', result);
} catch (e: any) {
  console.log('Search for .git failed:', e.message);
}

try {
  const result2 = execSync('find / -name ".github" -type d 2>/dev/null', { encoding: 'utf-8', stdio: 'pipe' });
  console.log('Found .github dirs at:\n', result2);
} catch (e: any) {
  console.log('Search for .github failed:', e.message);
}
