async function inspectHandle() {
  try {
    const res = await fetch("https://wbk-assets.webook.com/0.7.8/assets/@wbk/ticketing-BIN3h7yH.js");
    const text = await res.text();
    
    let idx = text.indexOf("handleProceedToPayment:r}=e");
    if (idx !== -1) {
      console.log("FOUND AT", idx);
      console.log(text.substring(idx - 200, idx + 600));
    } else {
      console.log("NOT FOUND");
    }
  } catch (e) {
    console.error(e);
  }
}
inspectHandle();
