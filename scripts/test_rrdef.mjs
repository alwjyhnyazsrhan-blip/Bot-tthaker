async function findRrDef() {
  const tRes = await fetch("https://wbk-assets.webook.com/0.7.8/assets/@wbk/ticketing-BIN3h7yH.js");
  const tText = await tRes.text();
  
  // Find "Rr=" anywhere in the file
  const regex = /[^a-zA-Z0-9_$]Rr\s*=\s*([^;]+)/;
  const match = tText.match(regex);
  if (match) {
    console.log("Rr assignment:", match[0].substring(0, 300));
  } else {
    console.log("No match for Rr =");
  }
}
findRrDef();
