import { execSync } from 'child_process';

function run(cmd: string) {
  console.log(`\nExecuting: ${cmd}`);
  try {
    const stdout = execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
    console.log('STDOUT:\n', stdout);
  } catch (err: any) {
    console.error('ERROR:\n', err.stdout || err.message || err);
  }
}

console.log('--- GIT DIAGNOSTICS & RESTORE ---');
run('git status');
run('git remote -v');
run('git branch -a');
run('git fetch --all');
run('git reset --hard origin/main || git reset --hard origin/master');
run('git status');
