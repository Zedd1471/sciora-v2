const { createCanvas } = require("@napi-rs/canvas");
const fs = require("fs");
const path = require("path");

const size = 512;
const canvas = createCanvas(size, size);
const ctx = canvas.getContext("2d");

// Draw Rounded Squircle Background
const r = 110;
ctx.beginPath();
ctx.moveTo(r, 0);
ctx.lineTo(size - r, 0);
ctx.quadraticCurveTo(size, 0, size, r);
ctx.lineTo(size, size - r);
ctx.quadraticCurveTo(size, size, size - r, size);
ctx.lineTo(r, size);
ctx.quadraticCurveTo(0, size, 0, size - r);
ctx.lineTo(0, r);
ctx.quadraticCurveTo(0, 0, r, 0);
ctx.closePath();

// Royal Indigo to Deep Violet Gradient
const grad = ctx.createLinearGradient(0, 0, size, size);
grad.addColorStop(0, "#4338ca");
grad.addColorStop(0.5, "#6366f1");
grad.addColorStop(1, "#7c3aed");
ctx.fillStyle = grad;
ctx.fill();

// Subtle Inner Border Glow
ctx.lineWidth = 12;
ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
ctx.stroke();

// Draw "S" Sciora Monogram
ctx.fillStyle = "#ffffff";
ctx.font = "bold 280px sans-serif";
ctx.textAlign = "center";
ctx.textBaseline = "middle";
ctx.fillText("S", size / 2, size / 2 + 10);

// Save to public/icon.png
const outPath = path.join(__dirname, "../public/icon.png");
fs.writeFileSync(outPath, canvas.toBuffer("image/png"));
console.log(`Generated high-res 512x512 desktop icon at: ${outPath}`);

