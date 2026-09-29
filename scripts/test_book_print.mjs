async function printBookChunk() {
  const res = await fetch("https://wbk-assets.webook.com/0.7.8/assets/book-BPdfZCzC.js");
  const text = await res.text();
  console.log(text);
}
printBookChunk();
