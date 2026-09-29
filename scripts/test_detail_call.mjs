async function findEventDetailCall() {
  const res = await fetch("https://wbk-assets.webook.com/0.7.8/assets/@wbk/api-BgBdL-BO.js");
  const text = await res.text();
  
  const idx = text.indexOf('`/event-detail/${');
  if (idx !== -1) {
    console.log("Around /event-detail/:\n", text.substring(Math.max(0, idx - 400), idx + 400));
  }
}
findEventDetailCall();
