async function findTicketingApi() {
  const res = await fetch("https://wbk-assets.webook.com/0.7.8/assets/@wbk/api-BgBdL-BO.js");
  const text = await res.text();
  
  // Find "events/" or "/ticketing" or "/queue"
  const matches = text.match(/(['"`])\/[a-zA-Z0-9_\-\/${}]+(ticket|event|zone|seat|show|season)[a-zA-Z0-9_\-\/${}]*\1/gi) || [];
  console.log("Matching endpoints:", Array.from(new Set(matches)).slice(0, 50));
}
findTicketingApi();
