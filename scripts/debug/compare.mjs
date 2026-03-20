import fs from 'fs';

const deployContent = fs.readFileSync('deploy.mjs', 'utf-8');
const deployMatch = deployContent.match(/const RESERVED_NAMES = \[([\s\S]*?)\];/);
let deployNames = [];
if (deployMatch) {
  const matches = deployMatch[1].match(/"([^"]+)"/g);
  if (matches) {
    deployNames = matches.map(s => s.replace(/"/g, '').toLowerCase()).filter(s => s.length > 0 && !s.startsWith('0x') && !s.includes('$'));
  }
}

const adminContent = fs.readFileSync('src/stores/adminStore.ts', 'utf-8');
const adminMatch = adminContent.match(/const RESERVED_NAMES_LIST = \[([\s\S]*?)\];/);
let adminNames = [];
if (adminMatch) {
  const matches = adminMatch[1].match(/'([^']+)'/g);
  if (matches) {
    adminNames = matches.map(s => s.replace(/'/g, '').toLowerCase()).filter(s => s.length > 0 && !s.includes(' ') && !s.includes('/') && !s.includes(':'));
  }
}

const deploySet = new Set(deployNames);
const adminSet = new Set(adminNames);
const onlyInDeploy = deployNames.filter(n => !adminSet.has(n));
const onlyInAdmin = adminNames.filter(n => !deploySet.has(n));

console.log('deploy.mjs count:', deployNames.length);
console.log('adminStore.ts count:', adminNames.length);
console.log('');
console.log('=== ONLY IN deploy.mjs (' + onlyInDeploy.length + ') ===');
onlyInDeploy.forEach(n => console.log(n));
console.log('');
console.log('=== ONLY IN adminStore.ts (' + onlyInAdmin.length + ') ===');
onlyInAdmin.forEach(n => console.log(n));
console.log('');
console.log('Names to add to adminStore.ts:', onlyInDeploy.length);
console.log('Names to add to deploy.mjs:', onlyInAdmin.length);

fs.writeFileSync('/tmp/only_in_deploy.json', JSON.stringify(onlyInDeploy));
fs.writeFileSync('/tmp/only_in_admin.json', JSON.stringify(onlyInAdmin));
fs.writeFileSync('/tmp/all_names.json', JSON.stringify([...new Set([...deployNames, ...adminNames])].sort()));
