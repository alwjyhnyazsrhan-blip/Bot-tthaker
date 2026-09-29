async function findMr() {
  const qRes = await fetch("https://wbk-assets.webook.com/0.7.8/assets/@wbk/queue-DaHNt4dN.js");
  const qText = await qRes.text();
  
  const idx = qText.indexOf('Mr=');
  if (idx !== -1) {
    console.log("Mr snippet:", qText.substring(idx, idx + 400));
  }
}
findMr();
