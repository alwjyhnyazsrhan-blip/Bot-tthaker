async function inspectBookChunk() {
  const res = await fetch("https://wbk-assets.webook.com/0.7.8/assets/book-BPdfZCzC.js");
  const text = await res.text();
  console.log("book chunk size:", text.length);
  
  // Find endpoints or function calls
  const matches = text.match(/(['"`])\/[a-zA-Z0-9_\-\/:]+\1/g) || [];
  console.log("Book endpoints:", Array.from(new Set(matches)).slice(0, 40));
}
inspectBookChunk();
