async function inspectBeDef() {
  const res = await fetch("https://wbk-assets.webook.com/0.7.8/assets/index-CriLyxpO.js");
  const text = await res.text();
  
  const matches = text.match(/[a-zA-Z0-9_$]+=[a-zA-Z0-9_$]+\.lazy\(\(\)=>x\(\(\)=>import\([^)]+\),__vite__mapDeps\(\[[0-9,]+\]\)\)/g) || [];
  console.log("Lazy imports:", matches.slice(0, 30));
}
inspectBeDef();
