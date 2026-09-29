async function findRr2() {
  const tRes = await fetch("https://wbk-assets.webook.com/0.7.8/assets/@wbk/ticketing-BIN3h7yH.js");
  const tText = await tRes.text();
  
  const matches = tText.match(/[a-zA-Z0-9_$]+=\s*\(?\s*\{\s*slug/g) || [];
  console.log("Matches for ({slug:", matches);
  
  const idx = tText.indexOf('{slug:t,lang:r}');
  if (idx !== -1) {
    console.log("Around {slug:t,lang:r}:", tText.substring(Math.max(0, idx - 100), idx + 200));
  }
}
findRr2();
