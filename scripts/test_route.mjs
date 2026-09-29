async function findEventRoute() {
  const res = await fetch("https://wbk-assets.webook.com/0.7.8/assets/index-CriLyxpO.js");
  const text = await res.text();
  
  // Find where path: "events/:slug" or similar is defined
  const idx = text.indexOf('events/:');
  if (idx !== -1) {
    console.log("Found events/: context:", text.substring(Math.max(0, idx - 200), idx + 400));
  } else {
    console.log("events/: not found directly");
  }

  // Find lazy loaded chunks
  const chunkMatches = text.match(/\/assets\/[a-zA-Z0-9_\-\.]+\.js/g) || [];
  console.log("Sample chunks:", Array.from(new Set(chunkMatches)).slice(0, 30));
}
findEventRoute();
