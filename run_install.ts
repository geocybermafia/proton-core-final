import { execSync } from 'child_process';

try {
  console.log("Starting custom npm install...");
  execSync('npm install --no-audit --no-fund', { stdio: 'inherit' });
  console.log("npm install completed successfully!");
} catch (error: any) {
  console.error("npm install failed:", error.message || error);
}
