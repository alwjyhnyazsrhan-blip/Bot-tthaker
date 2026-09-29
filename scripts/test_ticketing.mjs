async function inspectTicketing() {
  const res = await fetch("https://wbk-assets.webook.com/0.7.8/assets/@wbk/ticketing-BIN3h7yH.js");
  const text = await res.text();
  console.log("ticketing JS length:", text.length);
  
  // Find api endpoints
  const apiMatches = text.match(/(['"`])\/[a-zA-Z0-9_\-\/:]+\1/g) || [];
  console.log("Ticketing endpoints:", Array.from(new Set(apiMatches)).slice(0, 40));
}
inspectTicketing();
