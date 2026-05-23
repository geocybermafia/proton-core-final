import { execSync } from 'child_process';

const urls = [
  'https://github.com/devdarianib/geocybermafia.git',
  'https://github.com/devdarianib/geocybermafia',
  'https://github.com/geocybermafia/geocybermafia.git',
  'https://github.com/geocybermafia/geocybermafia'
];

console.log('--- TESTING REPOSITORY URLS ---');
for (const url of urls) {
  try {
    console.log(`Checking URL: ${url}`);
    const stdout = execSync(`git ls-remote ${url}`, { encoding: 'utf-8', stdio: 'pipe' });
    console.log(`SUCCESS! Remote exists for: ${url}`);
    console.log(stdout.substring(0, 300));
    break;
  } catch (err: any) {
    console.error(`FAILED: ${url} -> ${err.message}`);
  }
}
