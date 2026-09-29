async function findUClient() {
  const res = await fetch("https://wbk-assets.webook.com/0.7.8/assets/@wbk/api-BgBdL-BO.js");
  const text = await res.text();
  
  // Find where `u` or axios/fetch is created
  const clientMatch = text.substring(0, 3000).match(/([a-zA-Z0-9_$]+)\s*=\s*axios\.create\([^)]+\)/);
  if (clientMatch) {
    console.log("axios.create:", clientMatch[0]);
  } else {
    // Find baseURL
    const baseMatch = text.match(/baseURL\s*:\s*[^,}]+/g) || [];
    console.log("baseURL occurrences:", baseMatch);
  }
}
findUClient();
