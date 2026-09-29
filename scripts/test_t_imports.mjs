async function checkTicketingImports() {
  const tRes = await fetch("https://wbk-assets.webook.com/0.7.8/assets/@wbk/ticketing-BIN3h7yH.js");
  const tText = await tRes.text();
  console.log("Ticketing top 1000 chars:", tText.substring(0, 1000));
}
checkTicketingImports();
