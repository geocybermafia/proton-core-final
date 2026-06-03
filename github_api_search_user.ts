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
    const res = await fetchJson('https://api.github.com/search/users?q=devdarianib');
    console.log("Search user 'devdarianib':", JSON.stringify(res, null, 2));

    const resEmail = await fetchJson('https://api.github.com/search/users?q=devdarianib@gmail.com');
    console.log("Search user by email:", JSON.stringify(resEmail, null, 2));

    const resRepos = await fetchJson('https://api.github.com/search/repositories?q=proton-core');
    console.log("Search repos 'proton-core':", JSON.stringify(resRepos.items?.slice(0, 10).map((r: any) => ({ name: r.full_name, url: r.html_url })), null, 2));
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

main();
