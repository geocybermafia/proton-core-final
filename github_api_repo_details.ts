import https from 'https';

function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Node.js-App-Agent'
      }
    };
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data.slice(0, 100)}`));
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  try {
    const repoInfo = await fetchJson('https://api.github.com/repos/geocybermafia/proton-core-final');
    console.log("Repo Details:", JSON.stringify(repoInfo, null, 2));

    const branches = await fetchJson('https://api.github.com/repos/geocybermafia/proton-core-final/branches');
    console.log("Branches:", JSON.stringify(branches, null, 2));

    const contents = await fetchJson('https://api.github.com/repos/geocybermafia/proton-core-final/contents/');
    console.log("Root Contents:", JSON.stringify(contents?.map((c: any) => ({ name: c.name, type: c.type })), null, 2));
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

main();
