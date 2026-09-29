async function inspectBe() {
  const res = await fetch("https://wbk-assets.webook.com/0.7.8/assets/index-CriLyxpO.js");
  const text = await res.text();
  
  const idx = text.indexOf('P1=[{path:"event/:queuedSlug"');
  if (idx !== -1) {
    console.log("Before P1:", text.substring(Math.max(0, idx - 600), idx));
  }
}
inspectBe();
