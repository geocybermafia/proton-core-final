import { execSync } from 'child_process';

function run(cmd: string) {
  try {
    console.log(`> ${cmd}`);
    console.log(execSync(cmd, { encoding: 'utf8' }));
  } catch (e: any) {
    console.error(`Error: ${e.message}`);
    if (e.stdout) console.log(`stdout: ${e.stdout}`);
    if (e.stderr) console.error(`stderr: ${e.stderr}`);
  }
}

run('git status');
run('git remote -v');
run('git log -n 5 --oneline');
run('git branch -a');
