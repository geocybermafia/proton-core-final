import { execSync } from 'child_process';
try {
  console.log('Testing public git repo:');
  const out = execSync('git ls-remote -h https://github.com/octocat/Spoon-Knife.git', { 
    encoding: 'utf-8', 
    stdio: 'pipe',
    maxBuffer: 1024 * 1024 * 50 // 50MB buffer
  });
  console.log('SUCCESS:', out.substring(0, 100));
} catch (e: any) {
  console.error('FAILED:', e.message);
}
