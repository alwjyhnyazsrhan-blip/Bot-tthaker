import fs from 'fs';

async function check() {
  try {
    const res = await fetch("https://wbk-assets.webook.com/0.7.8/assets/index-CriLyxpO.js");
    const text = await res.text();
    const urls = text.match(/https?:\/\/[a-zA-Z0-9.-]+\.webook\.com[^\s"'\`)]*/g) || [];
    console.log("Found Webook URLs:", Array.from(new Set(urls)).slice(0, 20));
    
    // Check how events are fetched
    const apiCalls = text.match(/\/api\/[a-zA-Z0-9_\-\/]+/g) || [];
    console.log("API paths:", Array.from(new Set(apiCalls)).slice(0, 30));
  } catch (e) {
    console.error(e);
  }
}
check();
