async function findSa() {
  const qRes = await fetch("https://wbk-assets.webook.com/0.7.8/assets/@wbk/queue-DaHNt4dN.js");
  const qText = await qRes.text();
  
  const idx = qText.indexOf('sa=');
  if (idx !== -1) {
    console.log("sa snippet:", qText.substring(idx, idx + 400));
  }
}
findSa();
