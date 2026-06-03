import filesystem from 'fs';
try {
  console.log("Contents of /app/control-plane-api:", filesystem.readdirSync('/app/control-plane-api'));
} catch (e: any) {
  console.log("Error:", e.message);
}
