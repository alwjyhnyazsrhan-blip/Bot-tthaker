async function findHook() {
  const tRes = await fetch("https://wbk-assets.webook.com/0.7.8/assets/@wbk/ticketing-BIN3h7yH.js");
  const tText = await tRes.text();
  
  const idx = tText.indexOf('w=Nl(),');
  if (idx !== -1) {
    console.log("Hook snippet:", tText.substring(idx, idx + 400));
  }
}
findHook();
