async function listAllTemplateLiterals() {
  const res = await fetch("https://wbk-assets.webook.com/0.7.8/assets/@wbk/api-BgBdL-BO.js");
  const text = await res.text();
  
  // Find all template strings `...`
  const matches = text.match(/`\/[^`]+`/g) || [];
  console.log("Template string endpoints:", Array.from(new Set(matches)));
}
listAllTemplateLiterals();
