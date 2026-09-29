async function findSaDef() {
  const qRes = await fetch("https://wbk-assets.webook.com/0.7.8/assets/@wbk/queue-DaHNt4dN.js");
  const qText = await qRes.text();
  
  // Find where `sa` is assigned or declared
  const matches = qText.match(/[^a-zA-Z0-9_$]sa\s*=[^;,]+/g) || [];
  console.log("Matches for sa =:", matches.slice(0, 10));
}
findSaDef();
