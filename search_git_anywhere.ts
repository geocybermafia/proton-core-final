import filesystem from 'fs';
import path from 'path';

function searchForGit(dir: string, depth: number = 0) {
  if (depth > 6) return;
  try {
    const files = filesystem.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (file === '.git') {
        console.log(`FOUND .git AT: ${fullPath}`);
      }
      try {
        const stat = filesystem.statSync(fullPath);
        if (stat.isDirectory()) {
          // ignore system directories
          if (file === 'node_modules' || file === 'proc' || file === 'sys' || file === 'dev' || file === 'var' || file === 'lib') {
            continue;
          }
          searchForGit(fullPath, depth + 1);
        }
      } catch (e) {}
    }
  } catch (e) {}
}

console.log("Searching for any .git directory...");
searchForGit('/app');
searchForGit('/workspace');
searchForGit('/root');
console.log("Search finished.");
