async function inspectContentful() {
  const res = await fetch("https://wbk-assets.webook.com/0.7.8/assets/@wbk/contentful-9uMqmgoA.js");
  const text = await res.text();
  console.log("contentful JS length:", text.length);
  
  // Find GraphQL or API URLs
  const urls = text.match(/https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^\s"'\`)]*/g) || [];
  console.log("URLs in contentful:", Array.from(new Set(urls)).slice(0, 30));
  
  // Find GraphQL queries or fetch endpoints
  const apiMatches = text.match(/(['"`])\/[a-zA-Z0-9_\-\/:]+\1/g) || [];
  console.log("Endpoints in contentful:", Array.from(new Set(apiMatches)).slice(0, 30));
}
inspectContentful();
