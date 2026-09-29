async function findQueueExport() {
  const qRes = await fetch("https://wbk-assets.webook.com/0.7.8/assets/@wbk/queue-DaHNt4dN.js");
  const qText = await qRes.text();
  
  // Find "export{" in queue
  const expMatch = qText.match(/export\s*\{[^}]+\}/);
  if (expMatch) {
    console.log("Queue exports snippet:", expMatch[0].substring(0, 1000));
  }
}
findQueueExport();
