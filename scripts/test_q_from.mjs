async function checkQueueLine2() {
  const qRes = await fetch("https://wbk-assets.webook.com/0.7.8/assets/@wbk/queue-DaHNt4dN.js");
  const qText = await qRes.text();
  const fromMatch = qText.substring(0, 3000).match(/from\s*["'][^"']+["']/g);
  console.log("Imports from in queue:", fromMatch);
}
checkQueueLine2();
