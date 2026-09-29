async function inspectQueueAndTicketing() {
  const qRes = await fetch("https://wbk-assets.webook.com/0.7.8/assets/@wbk/queue-DaHNt4dN.js");
  const qText = await qRes.text();
  console.log("Queue JS length:", qText.length);
  // Look for URLs or fetches
  const qUrls = qText.match(/https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^\s"'\`)]*/g) || [];
  console.log("Queue URLs:", Array.from(new Set(qUrls)));

  // Look for endpoints in Queue
  const qEndpoints = qText.match(/(['"`])\/[a-zA-Z0-9_\-\/:]+\1/g) || [];
  console.log("Queue endpoints:", Array.from(new Set(qEndpoints)).slice(0, 20));
}
inspectQueueAndTicketing();
