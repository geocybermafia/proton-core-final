async function checkContents() {
  const headers = { 'User-Agent': 'Mozilla/5.0' };
  try {
    const res = await fetch('https://api.github.com/repos/geocybermafia/proton-core-final/contents', { headers });
    const data: any = await res.json();
    console.log('Contents of geocybermafia/proton-core-final:');
    if (Array.isArray(data)) {
      console.log(data.map((f: any) => ({ name: f.name, type: f.type })));
    } else {
      console.log(data);
    }
  } catch (e: any) {
    console.error('Failed to fetch:', e.message);
  }
}
checkContents();
