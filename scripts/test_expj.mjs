async function inspectExportJ() {
  const tRes = await fetch("https://wbk-assets.webook.com/0.7.8/assets/@wbk/ticketing-BIN3h7yH.js");
  const tText = await tRes.text();
  
  // Find "export{" or "export {"
  const expMatch = tText.match(/export\s*\{[^}]+\}/g);
  console.log("Exports in ticketing:", expMatch);
}
inspectExportJ();
