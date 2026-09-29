import fs from 'fs';

const filePath = './src/services/webookSyncService.ts';
let code = fs.readFileSync(filePath, 'utf8');

const startMarker = '// Seating Map Generator based on venue type with REAL official event prices';
const endMarker = '// Master list of real, active Webook events matching the official platform';

const sIdx = code.indexOf(startMarker);
const eIdx = code.indexOf(endMarker);

if (sIdx !== -1 && eIdx !== -1) {
  code = code.substring(0, sIdx) + '// Curated live Webook events with verified official tiers\n' + code.substring(eIdx + endMarker.length);
  fs.writeFileSync(filePath, code, 'utf8');
  console.log("Successfully removed old generateVenueSeatingMap!");
} else {
  console.error("Markers not found:", { sIdx, eIdx });
}
