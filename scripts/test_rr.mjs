async function findRr() {
  const tRes = await fetch("https://wbk-assets.webook.com/0.7.8/assets/@wbk/ticketing-BIN3h7yH.js");
  const tText = await tRes.text();
  
  const idx = tText.indexOf('Rr=');
  if (idx !== -1) {
    console.log("Rr snippet:", tText.substring(idx, idx + 500));
  }
}
findRr();
