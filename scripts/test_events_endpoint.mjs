import fs from 'fs';

async function checkEventEndpoints() {
  const res = await fetch("https://wbk-assets.webook.com/0.7.8/assets/index-CriLyxpO.js");
  const text = await res.text();
  
  // Find references to api calls with event or booking
  const matches = text.match(/(get|post)\s*\(\s*[`"']\/[a-zA-Z0-9_\-\/${}]+[`"']/gi) || [];
  console.log("Matched get/post:", Array.from(new Set(matches)).slice(0, 40));

  // Find occurrences of /events/
  const eventMatches = text.match(/[`"']\/events\/[a-zA-Z0-9_\-\/${}]+[`"']/gi) || [];
  console.log("Event matches:", Array.from(new Set(eventMatches)).slice(0, 40));
}
checkEventEndpoints();
