async function searchSeating() {
  const res = await fetch("https://wbk-assets.webook.com/0.7.8/assets/@wbk/ticketing-BIN3h7yH.js");
  const text = await res.text();
  
  const keywords = ['seat', 'map', 'section', 'venue', 'stadium', 'secutix', 'svg', 'canvas', 'booking'];
  for (const kw of keywords) {
    const regex = new RegExp(`[a-zA-Z0-9_]{0,20}${kw}[a-zA-Z0-9_]{0,20}`, 'gi');
    const matches = text.match(regex) || [];
    console.log(`Keyword "${kw}": ${matches.length} matches, sample:`, Array.from(new Set(matches)).slice(0, 10));
  }
}
searchSeating();
