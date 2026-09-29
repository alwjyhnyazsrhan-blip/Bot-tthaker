async function checkApi() {
  try {
    const res = await fetch("https://wbk-assets.webook.com/0.7.8/assets/@wbk/api-BgBdL-BO.js");
    const text = await res.text();
    console.log("api length:", text.length);
    // Find strings like "/events", "/zones", "/venues", "/tickets", "/seats", "/tiers", etc.
    const matches = text.match(/(['"`])\/[a-zA-Z0-9_\-\/:]+\1/g) || [];
    console.log("Endpoints in api JS:", Array.from(new Set(matches)).slice(0, 50));
  } catch (e) {
    console.error(e);
  }
}
checkApi();
