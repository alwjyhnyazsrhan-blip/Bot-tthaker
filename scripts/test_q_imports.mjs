async function checkQueueImports() {
  const qRes = await fetch("https://wbk-assets.webook.com/0.7.8/assets/@wbk/queue-DaHNt4dN.js");
  const qText = await qRes.text();
  console.log("Queue top 1000:", qText.substring(0, 1000));
}
checkQueueImports();
