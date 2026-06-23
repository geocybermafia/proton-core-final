import { readdirSync, existsSync, lstatSync } from 'fs';

try {
  const dirsToCheck = ['/node_modules', '../node_modules', '/app/node_modules', '/app/applet/node_modules'];
  for (const dir of dirsToCheck) {
    if (existsSync(dir)) {
      console.log(`Directory ${dir} exists!`);
      try {
        const stat = lstatSync(dir);
        console.log(`  isSymbolicLink: ${stat.isSymbolicLink()}`);
        console.log(`  isDirectory: ${stat.isDirectory()}`);
        console.log(`  Contains ${readdirSync(dir).length} items`);
      } catch (err) {
        console.log(`  Error querying: ${err.message}`);
      }
    } else {
      console.log(`Directory ${dir} does NOT exist.`);
    }
  }
} catch (e) {
  console.error("Diagnostic error:", e.message || e);
}
