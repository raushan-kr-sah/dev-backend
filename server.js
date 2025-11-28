// backend/server.js
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import puppeteer from "puppeteer";
import { setTimeout as sleep } from "timers/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// INIT APP BEFORE USING app.use
const app = express();

// One CORS registration is enough
app.use(cors({ origin: "https://dev-frontend-smoky.vercel.app" }));
app.use(bodyParser.json({ limit: "5mb" }));

/**
 * Simple rule-based parser: description -> scene JSON
 */
function generateScene(description) {
  if (!description || typeof description !== "string")
    return { error: "Description required" };

  // Utils: number parsing and clamps (were missing)
  const nums = Array.from(description.matchAll(/[-+]?\d*\.?\d+/g)).map(m => Number(m[0]));
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number(v)));
  const pick = (arr, def) => (Array.isArray(arr) && arr.length ? Number(arr[0]) : def);

  const desc = description.toLowerCase().trim();

  // Normalize common misspellings/aliases for Bernoulli
  const isBernoulli = [
    /bernoulli/,
    /bernolli/,
    /bernouli/,
    /bernoulli'?s/,
    /bernolli'?s/,
    /bernouli'?s/,
    /bernouli'?s\s+thero?e?rem/,        // "bernouli's therorem"/theorem
    /bernoulli\s+principle/,
    /principle\s+bernoulli/,
    /theorem\s+bernoulli/
  ].some(rx => rx.test(desc));

  if (desc.includes("bubble sort") || desc.includes("bubble-sort")) {
    const count = clamp(pick(nums, 5), 3, 30);
    const objects = Array.from({ length: count }).map((_, i) => ({
      id: `b${i + 1}`,
      value: Math.floor(60 + Math.random() * 180)
    }));
    // naive precomputed swaps for demo
    const animations = [];
    for (let i = 0; i < Math.min(count - 1, 6); i++) {
      animations.push({ type: "swap", a: `b${i + 1}`, b: `b${i + 2}`, at: 0.6 * (i + 1) });
    }
    return {
      type: "bubble_sort",
      objects,
      animations,
      duration: clamp(0.8 * animations.length + 2, 3, 12)
    };
  }

  if (desc.includes("sine wave") || desc.includes("sine")) {
    // try to map first two numbers to amplitude and frequency
    const amplitude = clamp(nums[0] ?? 80, 10, 200);
    const frequency = clamp(nums[1] ?? 0.02, 0.002, 0.2);
    return {
      type: "sine_wave",
      amplitude,
      frequency,
      duration: 6
    };
  }

  if (desc.includes("pythagoras") || desc.includes("pythagorean")) {
    const a = clamp(nums[0] ?? 140, 40, 220);
    const b = clamp(nums[1] ?? 100, 40, 220);
    return {
      type: "pythagoras",
      a,
      b,
      duration: 6
    };
  }

  // Fallback: choose a sensible default based on words or random
  if (desc.includes("sort") || desc.includes("bars")) {
    const count = clamp(pick(nums, 5), 3, 20);
    const objects = Array.from({ length: count }).map((_, i) => ({
      id: `b${i + 1}`,
      value: Math.floor(60 + Math.random() * 180)
    }));
    const animations = [];
    for (let i = 0; i < Math.min(count - 1, 5); i++) {
      animations.push({ type: "swap", a: `b${i + 1}`, b: `b${i + 2}`, at: 0.7 * (i + 1) });
    }
    return { type: "bubble_sort", objects, animations, duration: 6 };
  }

  if (desc.includes("wave") || desc.includes("oscill")) {
    return { type: "sine_wave", amplitude: 70, frequency: 0.025, duration: 6 };
  }

  // geometric shapes
  if (desc.includes("circle") || desc.includes("rectangle") || desc.includes("shape")) {
    return {
      type: "shapes",
      shapes: [
        { kind: "circle", x: 140, y: 120, r: clamp(nums[0] ?? 40, 10, 120), color: "#4f8ef7" },
        { kind: "rect", x: 240, y: 60, w: 120, h: 80, color: "#f76e4f" },
        { kind: "triangle", points: [[380,160],[460,160],[420,80]], color: "#2ecc71" }
      ],
      duration: 6
    };
  }

  // mathematical formula (TeX) + step-by-step derivation
  if (desc.includes("formula") || desc.includes("derivation")) {
    const steps = [
      { latex: "\\int x^2 \\, dx", note: "Start with the integral." },
      { latex: "\\frac{x^3}{3} + C", note: "Apply power rule: $\\int x^n = \\frac{x^{n+1}}{n+1}$." }
    ];
    return {
      type: "derivation",
      title: "Integral of x^2",
      steps,
      duration: clamp(nums[0] ?? 6, 4, 12)
    };
  }

  // moving vectors
  // TIGHTEN: only match when explicitly asking vectors, not just "velocity"
  if (desc.includes("vector") || (desc.includes("vectors") && !isBernoulli)) {
    return {
      type: "vectors",
      vectors: [
        { id: "v1", from: [80, 160], to: [220, 120], color: "#4f8ef7", label: "v1" },
        { id: "v2", from: [220, 120], to: [320, 80], color: "#f76e4f", label: "v2" }
      ],
      animate: "tip-oscillate",
      duration: 6
    };
  }

  // graphs & plots
  if (desc.includes("plot") || desc.includes("graph") || desc.includes("function")) {
    const fn = desc.includes("quadratic") ? "quadratic" : desc.includes("linear") ? "linear" : "sine";
    return {
      type: "plot",
      fn,
      amplitude: clamp(nums[0] ?? 80, 10, 200),
      slope: nums[1] ?? 1,
      duration: 6
    };
  }

  // algorithmic visualization
  if (desc.includes("algorithm") || desc.includes("search") || desc.includes("tree")) {
    return {
      type: "algorithm",
      algo: desc.includes("bfs") ? "bfs" : desc.includes("dfs") ? "dfs" : "bfs",
      nodes: [
        { id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }, { id: "E" }
      ],
      edges: [
        ["A","B"],["A","C"],["B","D"],["C","E"]
      ],
      order: ["A","B","C","D","E"],
      duration: 6
    };
  }

  // scientific diagram
  if (desc.includes("diagram") || desc.includes("circuit") || desc.includes("lab")) {
    return {
      type: "diagram",
      items: [
        { kind: "box", x: 120, y: 80, w: 120, h: 70, label: "Sensor" },
        { kind: "arrow", from: [240,115], to: [340,115], label: "" },
        { kind: "box", x: 340, y: 80, w: 140, h: 70, label: "Processor" }
      ],
      duration: 6
    };
  }

  // Bernoulli's Principle: flowing pipe with pressure and velocity
  if (isBernoulli) {
    const p1 = nums[0] ?? 80;
    const v1 = nums[1] ?? 2;
    const p2 = Math.max(20, p1 - 40);
    const v2 = Math.max(3, v1 + 3);
    return {
      type: "bernoulli",
      inlet: { pressure: p1, velocity: v1 },
      outlet: { pressure: p2, velocity: v2 },
      duration: 6
    };
  }

  // 4x4 Matrix Exponentiation (A^n) demo: show steps with intermediate matrices
  if (desc.includes("matrix") && desc.includes("exponent")) {
    // simple predefined 4x4 matrix and exponent n
    // FIX: correct Math.round syntax
    const n = Math.max(1, Math.min(6, Math.round(nums[0] ?? 3)));
    const A = [
      [1, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 0, 1, 1],
      [0, 0, 0, 1],
    ];
    return {
      type: "matrix_exp",
      title: `Matrix Exponentiation A^${n}`,
      n,
      A,
      duration: 7
    };
  }

  // random default so "any text" still generates a video
  const defaults = [
    { type: "sine_wave", amplitude: 80, frequency: 0.02, duration: 6 },
    {
      type: "bubble_sort",
      objects: [
        { id: "b1", value: 120 },
        { id: "b2", value: 60 },
        { id: "b3", value: 200 },
        { id: "b4", value: 90 },
        { id: "b5", value: 150 }
      ],
      animations: [
        { type: "swap", a: "b1", b: "b2", at: 0.8 },
        { type: "swap", a: "b3", b: "b4", at: 2.0 }
      ],
      duration: 6
    },
    { type: "pythagoras", a: 140, b: 100, duration: 6 }
  ];
  return defaults[Math.floor(Math.random() * defaults.length)];
}

/* ---------- API: generate scene ---------- */
app.post("/generate", (req, res) => {
  const { description } = req.body;
  if (!description) return res.status(400).json({ error: "description missing" });
  const scene = generateScene(description);
  return res.json(scene);
});

/* ---------- API: export video ---------- */
/**
 * POST /export
 * body: { scene: { ... } , width?: number, height?: number, fps?: number, duration?: number }
 * returns: { success: true, file: "/path/to/file.mp4" } on success
 */
app.post("/export", async (req, res) => {
  try {
    const { width = 900, height = 360, fps = 30 } = req.body;
    const scene = req.body.scene;
    if (!scene) return res.status(400).json({ error: "scene missing" });
    const duration = Number(scene.duration || 6);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "anim-"));
    const framesDir = path.join(tmpDir, "frames");
    fs.mkdirSync(framesDir, { recursive: true });

    const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Export Renderer</title>
<style>
  body{margin:0;background:#fff}
  svg{width:${width}px;height:${height}px;display:block}
  .label{font-family:Arial;font-size:12px;fill:#111}
</style>
</head>
<body>
<svg id="svgRoot" viewBox="0 0 ${width} ${height}"></svg>
<script>
const scene = ${JSON.stringify(scene)};
const svg = document.getElementById('svgRoot');
const DURATION_MS = ${duration} * 1000;
let __handles = {};

function clearSVG(){ while(svg.firstChild) svg.removeChild(svg.firstChild); }

function renderScene(){
  clearSVG();
  __handles = {};

  // Bubble Sort
  if (scene.type === 'bubble_sort') {
    const padding = 40;
    const baseY = ${height} - 60;
    const arr = scene.objects || [];
    const n = arr.length;
    const areaW = ${width} - padding*2;
    const barW = n ? Math.floor(areaW / (n*1.6)) : 0;
    const gap = n>1 ? (areaW - n*barW)/(n-1) : 0;
    const bars = [];
    arr.forEach((o,i)=>{
      const x = padding + i*(barW+gap);
      const h = Number(o.value)||20;
      const y = baseY - h;
      const r = document.createElementNS('http://www.w3.org/2000/svg','rect');
      r.setAttribute('x',x);
      r.setAttribute('y',y);
      r.setAttribute('width',barW);
      r.setAttribute('height',h);
      r.setAttribute('fill','#4f8ef7');
      r.setAttribute('rx','4');
      r.dataset.id = o.id;
      svg.appendChild(r);
      const t = document.createElementNS('http://www.w3.org/2000/svg','text');
      t.setAttribute('x', x + barW/2);
      t.setAttribute('y', baseY + 16);
      t.setAttribute('text-anchor','middle');
      t.setAttribute('class','label');
      t.textContent = h;
      svg.appendChild(t);
      bars.push({id:o.id, rect:r, x});
    });
    const anims = (scene.animations||[]).map(a=>{
      const start = (Number(a.at)||0)*1000;
      return { a:a.a, b:a.b, start, end:start+600 };
    });
    __handles.bubble = { bars, anims };
  }

  // Sine Wave
  if (scene.type === 'sine_wave') {
    const amp = Number(scene.amplitude)||50;
    const samples = 220;
    const left = 60, right = ${width}-60;
    const W = right-left;
    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    const pts = [];
    for(let i=0;i<=samples;i++){
      const t=i/samples;
      const x=left+t*W;
      const y=${height}/2 - Math.sin(t*2*Math.PI)*amp;
      pts.push(x+','+y);
    }
    path.setAttribute('d','M '+pts.join(' L '));
    path.setAttribute('fill','none');
    path.setAttribute('stroke','#4f8ef7');
    path.setAttribute('stroke-width','3');
    svg.appendChild(path);
    const dot = document.createElementNS('http://www.w3.org/2000/svg','circle');
    dot.setAttribute('r','8');
    dot.setAttribute('fill','#f76e4f');
    svg.appendChild(dot);
    __handles.sine = { path, dot, len: path.getTotalLength() };
  }

  // Pythagoras
  if (scene.type === 'pythagoras') {
    const a = Number(scene.a)||140;
    const b = Number(scene.b)||100;
    const c = Math.sqrt(a*a+b*b);
    const ox = 200, oy = ${height}-100;
    const tri = document.createElementNS('http://www.w3.org/2000/svg','path');
    tri.setAttribute('d', \`M \${ox} \${oy} L \${ox+a} \${oy} L \${ox+a} \${oy-b} Z\`);
    tri.setAttribute('stroke','#4f8ef7');
    tri.setAttribute('stroke-width','3');
    tri.setAttribute('fill','none');
    svg.appendChild(tri);
    const sqA = document.createElementNS('http://www.w3.org/2000/svg','rect');
    sqA.setAttribute('x', ox);
    sqA.setAttribute('y', oy+4);
    sqA.setAttribute('width','0');
    sqA.setAttribute('height','0');
    sqA.setAttribute('fill','#a7e37e');
    svg.appendChild(sqA);
    const sqB = document.createElementNS('http://www.w3.org/2000/svg','rect');
    sqB.setAttribute('x', ox+a+4);
    sqB.setAttribute('y', oy-b);
    sqB.setAttribute('width','0');
    sqB.setAttribute('height','0');
    sqB.setAttribute('fill','#f7d66a');
    svg.appendChild(sqB);
    const sqC = document.createElementNS('http://www.w3.org/2000/svg','rect');
    sqC.setAttribute('x', ox+a-c);
    sqC.setAttribute('y', oy-b-c);
    sqC.setAttribute('width','0');
    sqC.setAttribute('height','0');
    sqC.setAttribute('fill','#f6a6c1');
    const gC = document.createElementNS('http://www.w3.org/2000/svg','g');
    const ang = -Math.atan2(b,a)*180/Math.PI;
    gC.setAttribute('transform', \`rotate(\${ang} \${ox+a} \${oy-b})\`);
    gC.appendChild(sqC);
    svg.appendChild(gC);
    __handles.pyth = { a,b,c,sqA,sqB,sqC };
  }

  // Shapes
  if (scene.type === 'shapes') {
    const circles=[], rects=[];
    (scene.shapes||[]).forEach(s=>{
      if(s.kind==='circle'){
        const c=document.createElementNS('http://www.w3.org/2000/svg','circle');
        c.setAttribute('cx',s.x); c.setAttribute('cy',s.y);
        c.setAttribute('r',s.r); c.setAttribute('fill',s.color||'#4f8ef7');
        svg.appendChild(c); circles.push(c);
      } else if (s.kind==='rect'){
        const r=document.createElementNS('http://www.w3.org/2000/svg','rect');
        r.setAttribute('x',s.x); r.setAttribute('y',s.y);
        r.setAttribute('width',s.w); r.setAttribute('height',s.h);
        r.setAttribute('fill',s.color||'#4f8ef7');
        svg.appendChild(r); rects.push(r);
      }
    });
    __handles.shapes = { circles, rects };
  }

  // Vectors
  if (scene.type === 'vectors') {
    const lines=[];
    (scene.vectors||[]).forEach(v=>{
      const ln=document.createElementNS('http://www.w3.org/2000/svg','line');
      ln.setAttribute('x1',v.from[0]); ln.setAttribute('y1',v.from[1]);
      ln.setAttribute('x2',v.to[0]); ln.setAttribute('y2',v.to[1]);
      ln.setAttribute('stroke',v.color||'#4f8ef7');
      ln.setAttribute('stroke-width','2');
      svg.appendChild(ln); lines.push(ln);
    });
    __handles.vectors = { lines, animate: scene.animate };
  }

  // Plot
  if (scene.type === 'plot') {
    const padding=40;
    const baseY=${height}-padding;
    const left=padding,right=${width}-padding;
    const W=right-left;
    const samples=120;
    const fn = scene.fn==='quadratic'
      ? (x)=> (scene.amplitude||1)*(x/100)**2
      : scene.fn==='linear'
        ? (x)=> (scene.slope||1)*x
        : (x)=> Math.sin(x/10)*(scene.amplitude||40);
    const pts=[];
    for(let i=0;i<=samples;i++){
      const t=i/samples;
      const x=left+t*W;
      const y=baseY - fn(i*100);
      pts.push(x+','+y);
    }
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d','M '+pts.join(' L '));
    path.setAttribute('fill','none');
    path.setAttribute('stroke','#4f8ef7');
    path.setAttribute('stroke-width','2');
    svg.appendChild(path);
  }

  // Diagram
  if (scene.type === 'diagram') {
    (scene.items||[]).forEach(item=>{
      if(item.kind==='box'){
        const r=document.createElementNS('http://www.w3.org/2000/svg','rect');
        r.setAttribute('x',item.x); r.setAttribute('y',item.y);
        r.setAttribute('width',item.w); r.setAttribute('height',item.h);
        r.setAttribute('fill','#4f8ef7');
        svg.appendChild(r);
      } else if(item.kind==='arrow'){
        const ln=document.createElementNS('http://www.w3.org/2000/svg','line');
        ln.setAttribute('x1',item.from[0]); ln.setAttribute('y1',item.from[1]);
        ln.setAttribute('x2',item.to[0]); ln.setAttribute('y2',item.to[1]);
        ln.setAttribute('stroke','#4f8ef7'); ln.setAttribute('stroke-width','2');
        svg.appendChild(ln);
      }
    });
  }

  // Algorithm
  if (scene.type === 'algorithm') {
    const nodes = scene.nodes||[];
    const edges = scene.edges||[];
    const order = scene.order||[];
    const cx=${width}/2, cy=${height}/2;
    const radius=Math.min(${width},${height})/3 - 40;
    const nodeHandles=[];
    nodes.forEach((n,i)=>{
      const ang=(i/nodes.length)*Math.PI*2;
      const x=cx+radius*Math.cos(ang);
      const y=cy+radius*Math.sin(ang);
      const circ=document.createElementNS('http://www.w3.org/2000/svg','circle');
      circ.setAttribute('cx',x); circ.setAttribute('cy',y);
      circ.setAttribute('r','26');
      circ.setAttribute('fill','#4f8ef7');
      circ.dataset.id=n.id;
      svg.appendChild(circ);
      const tx=document.createElementNS('http://www.w3.org/2000/svg','text');
      tx.setAttribute('x',x); tx.setAttribute('y',y+3);
      tx.setAttribute('text-anchor','middle');
      tx.setAttribute('class','label'); tx.textContent=n.id;
      svg.appendChild(tx);
      nodeHandles.push({id:n.id,x,y});
    });
    edges.forEach(([a,b])=>{
      const A=nodeHandles.find(h=>h.id===a);
      const B=nodeHandles.find(h=>h.id===b);
      if(!A||!B) return;
      const ln=document.createElementNS('http://www.w3.org/2000/svg','line');
      ln.setAttribute('x1',A.x); ln.setAttribute('y1',A.y);
      ln.setAttribute('x2',B.x); ln.setAttribute('y2',B.y);
      ln.setAttribute('stroke','#b0c4e8'); ln.setAttribute('stroke-width','2');
      svg.insertBefore(ln, svg.firstChild);
    });
    __handles.algorithm={ nodeHandles, order };
  }

  // Derivation
  if (scene.type === 'derivation') {
    const steps=scene.steps||[];
    const texts=[];
    steps.forEach((s,i)=>{
      const tx=document.createElementNS('http://www.w3.org/2000/svg','text');
      tx.setAttribute('x','60');
      tx.setAttribute('y', String(60 + i*28));
      tx.setAttribute('class','label');
      tx.setAttribute('opacity','0');
      tx.textContent=(s.latex||'')+' — '+(s.note||'');
      svg.appendChild(tx);
      texts.push(tx);
    });
    __handles.derivation={ texts };
    const ttl=document.createElementNS('http://www.w3.org/2000/svg','text');
    ttl.setAttribute('x','60'); ttl.setAttribute('y','30');
    ttl.setAttribute('class','label');
    ttl.textContent=scene.title||'Derivation';
    svg.appendChild(ttl);
  }

  // Bernoulli
  if (scene.type === 'bernoulli') {
    const inletP = Number(scene.inlet?.pressure)||80;
    const inletV = Number(scene.inlet?.velocity)||2;
    const outletP = Number(scene.outlet?.pressure)||Math.max(20,inletP-40);
    const outletV = Number(scene.outlet?.velocity)||Math.max(3,inletV+3);
    const wideStart=60, wideEnd=360, narrowEnd=560, midY=150;

    const wide=document.createElementNS('http://www.w3.org/2000/svg','rect');
    wide.setAttribute('x',wideStart); wide.setAttribute('y',midY-30);
    wide.setAttribute('width',wideEnd-wideStart); wide.setAttribute('height','60');
    wide.setAttribute('fill','#bcd6ff'); svg.appendChild(wide);

    const narrow=document.createElementNS('http://www.w3.org/2000/svg','rect');
    narrow.setAttribute('x',wideEnd); narrow.setAttribute('y',midY-15);
    narrow.setAttribute('width',narrowEnd-wideEnd); narrow.setAttribute('height','30');
    narrow.setAttribute('fill','#bcd6ff'); svg.appendChild(narrow);

    const l1=document.createElementNS('http://www.w3.org/2000/svg','text');
    l1.setAttribute('x',wideStart+80); l1.setAttribute('y',midY-45);
    l1.setAttribute('class','label'); l1.textContent=\`P1=\${inletP} v1=\${inletV}\`;
    svg.appendChild(l1);
    const l2=document.createElementNS('http://www.w3.org/2000/svg','text');
    l2.setAttribute('x',wideEnd+80); l2.setAttribute('y',midY-45);
    l2.setAttribute('class','label'); l2.textContent=\`P2=\${outletP} v2=\${outletV}\`;
    svg.appendChild(l2);

    const cap=document.createElementNS('http://www.w3.org/2000/svg','text');
    cap.setAttribute('x',wideStart); cap.setAttribute('y',midY-70);
    cap.setAttribute('class','label');
    cap.textContent="Bernoulli: velocity increases in constriction";
    svg.appendChild(cap);

    const dots=[];
    const count=30, spacing=26;
    const travelLen=narrowEnd-wideStart;
    for(let i=0;i<count;i++){
      const c=document.createElementNS('http://www.w3.org/2000/svg','circle');
      c.setAttribute('r','4'); c.setAttribute('fill','#1c66ff');
      c.setAttribute('cx', String(wideStart + (i*spacing)%travelLen));
      c.setAttribute('cy', String(midY));
      svg.appendChild(c);
      dots.push({ el:c, offset:i*spacing });
    }
    const wideSpeed=Math.max(25,inletV*30);
    const narrowSpeed=Math.max(wideSpeed+5,outletV*50);
    __handles.bernoulli={ dots, wideStart, wideEnd, narrowEnd, travelLen, wideSpeed, narrowSpeed, midY };
  }

  // Matrix exponentiation
  if (scene.type === 'matrix_exp') {
    const A = scene.A||[[1,1,0,0],[0,1,1,0],[0,0,1,1],[0,0,0,1]];
    const n = Number(scene.n)||3;
    const cell=40, oxA=60, oyA=60, oxR=360, oyR=60;
    function drawMatrix(m, ox, oy, stroke){
      for(let r=0;r<4;r++) for(let c=0;c<4;c++){
        const rect=document.createElementNS('http://www.w3.org/2000/svg','rect');
        rect.setAttribute('x',ox+c*cell); rect.setAttribute('y',oy+r*cell);
        rect.setAttribute('width',cell); rect.setAttribute('height',cell);
        rect.setAttribute('fill','#f5f7ff'); rect.setAttribute('stroke',stroke);
        svg.appendChild(rect);
        const tx=document.createElementNS('http://www.w3.org/2000/svg','text');
        tx.setAttribute('x',ox+c*cell+cell/2); tx.setAttribute('y',oy+r*cell+cell/2+2);
        tx.setAttribute('text-anchor','middle'); tx.setAttribute('class','label');
        tx.textContent=m[r][c];
        svg.appendChild(tx);
      }
    }
    drawMatrix(A, oxA, oyA, '#4f8ef7');
    // placeholder result matrix cells
    drawMatrix([[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], oxR, oyR, '#f76e4f');
    const title=document.createElementNS('http://www.w3.org/2000/svg','text');
    title.setAttribute('x',oxA); title.setAttribute('y',oyA-20);
    title.setAttribute('class','label');
    title.textContent=\`A^n (n=\${n})\`;
    svg.appendChild(title);
    __handles.mxexp={ A, n, oxR, oyR, cell };
  }
}

function mul(X,Y){
  const R=Array.from({length:4},()=>Array(4).fill(0));
  for(let i=0;i<4;i++) for(let j=0;j<4;j++) for(let k=0;k<4;k++) R[i][j]+=X[i][k]*Y[k][j];
  return R;
}
function pow(A,e){
  let R=[[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]];
  let B=A.map(r=>r.slice());
  while(e>0){
    if(e&1) R=mul(R,B);
    e >>=1;
    if(e) B=mul(B,B);
  }
  return R;
}

window.__updateFrame = function(ms){
  const t = Math.max(0, Math.min(ms, DURATION_MS));

  // Bubble sort
  if (__handles.bubble) {
    __handles.bubble.bars.forEach(b=>b.rect.setAttribute('transform','translate(0,0)'));
    __handles.bubble.anims.forEach(sw=>{
      if(t<sw.start || t>sw.end) return;
      const A=__handles.bubble.bars.find(x=>x.id===sw.a);
      const B=__handles.bubble.bars.find(x=>x.id===sw.b);
      if(!A||!B) return;
      const p=(t-sw.start)/(sw.end-sw.start);
      const dxAB=(B.x-A.x)*p;
      const dxBA=(A.x-B.x)*p;
      A.rect.setAttribute('transform',\`translate(\${dxAB},-8)\`);
      B.rect.setAttribute('transform',\`translate(\${dxBA},-8)\`);
    });
  }

  // Sine wave
  if (__handles.sine) {
    const p=t/DURATION_MS;
    const L=__handles.sine.len;
    const pt=__handles.sine.path.getPointAtLength(L*p);
    __handles.sine.dot.setAttribute('cx',pt.x);
    __handles.sine.dot.setAttribute('cy',pt.y);
  }

  // Pythagoras
  if (__handles.pyth) {
    const p=t/DURATION_MS;
    const h=__handles.pyth;
    h.sqA.setAttribute('width', h.a*p);
    h.sqA.setAttribute('height', h.a*p);
    h.sqB.setAttribute('width', h.b*p);
    h.sqB.setAttribute('height', h.b*p);
    h.sqC.setAttribute('width', h.c*p);
    h.sqC.setAttribute('height', h.c*p);
  }

  // Shapes pulse
  if (__handles.shapes) {
    const k=t/300;
    __handles.shapes.circles.forEach((c,i)=>{
      const base=Number(c.getAttribute('r'))||40;
      c.setAttribute('r', String(base + 6*Math.sin(k+i)));
    });
  }

  // Vectors tip oscillation
  if (__handles.vectors && __handles.vectors.animate==='tip-oscillate') {
    __handles.vectors.lines.forEach((ln,i)=>{
      const x1=Number(ln.getAttribute('x1'));
      const y1=Number(ln.getAttribute('y1'));
      const x2=Number(ln.getAttribute('x2'));
      const y2=Number(ln.getAttribute('y2'));
      const ang=Math.atan2(y2-y1,x2-x1);
      const mag=Math.sqrt((x2-x1)**2+(y2-y1)**2);
      const osc=Math.sin(t/200+i)*6;
      ln.setAttribute('x2', String(x1 + Math.cos(ang)*(mag+osc)));
      ln.setAttribute('y2', String(y1 + Math.sin(ang)*(mag+osc)));
    });
  }

  // Algorithm activation
  if (__handles.algorithm) {
    const { nodeHandles, order } = __handles.algorithm;
    const total=order.length;
    const p=t/DURATION_MS;
    const active=Math.min(total, Math.floor(p*total));
    const activeSet=new Set(order.slice(0,active));
    nodeHandles.forEach(h=>{
      const circ=svg.querySelector(\`circle[data-id="\${h.id}"]\`);
      if(circ) circ.setAttribute('fill', activeSet.has(h.id)?'#2ecc71':'#4f8ef7');
    });
  }

  // Derivation reveal
  if (__handles.derivation) {
    const { texts } = __handles.derivation;
    const stepDur = DURATION_MS / Math.max(1,texts.length);
    texts.forEach((el,i)=>{
      el.setAttribute('opacity', t >= i*stepDur ? '1':'0');
    });
  }

  // Bernoulli flow
  if (__handles.bernoulli) {
    const { dots, wideStart, wideEnd, travelLen, wideSpeed, narrowSpeed } = __handles.bernoulli;
    if(travelLen>0){
      dots.forEach(d=>{
        const inWide = d.offset < (wideEnd - wideStart);
        const speed = inWide ? wideSpeed : narrowSpeed;
        const x = wideStart + ((d.offset + (t/1000)*speed) % travelLen);
        d.el.setAttribute('cx', String(x));
      });
    }
  }

  // Matrix exponentiation
  if (__handles.mxexp) {
    const { A, n, oxR, oyR, cell } = __handles.mxexp;
    const k=Math.max(1, Math.floor((t/DURATION_MS)*n));
    const R=pow(A,k);
    // update result numbers
    for(let r=0;r<4;r++) for(let c=0;c<4;c++){
      const x=oxR+c*cell+cell/2;
      const y=oyR+r*cell+cell/2+2;
      const el=[...svg.querySelectorAll('text')].find(tEl=>tEl.getAttribute('x')==String(x) && tEl.getAttribute('y')==String(y));
      if(el) el.textContent=R[r][c];
    }
  }
};

renderScene();
</script>
</body>
</html>
`;

    // Ensure Chromium is available
    const execPath = process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath();
    if (!execPath || !fs.existsSync(execPath)) {
      return res.status(500).json({
        error: "Chromium not found. Set PUPPETEER_EXECUTABLE_PATH to your Chrome/Chromium binary."
      });
    }

    // Verify ffmpeg is available before rendering frames
    const ffmpegCheck = await new Promise((resolve) => {
      const p = spawn("ffmpeg", ["-version"]);
      let ok = false;
      p.stdout.on("data", () => { ok = true; });
      p.stderr.on("data", () => {});
      p.on("close", () => resolve(ok));
      p.on("error", () => resolve(false));
    });
    if (!ffmpegCheck) {
      return res.status(500).json({
        error: "ffmpeg not found. Install ffmpeg and retry export."
      });
    }

    const browser = await puppeteer.launch({
      headless: "new",
      executablePath: execPath,
      args: ["--no-sandbox","--disable-setuid-sandbox","--disable-gpu","--disable-dev-shm-usage"]
    });

    const page = await browser.newPage();
    page.on('pageerror', e => console.error('Page error:', e.message));
    page.on('console', m => console.log('[page]', m.type(), m.text()));
    page.on('requestfailed', req => console.error('[page] requestfailed', req.url(), req.failure()?.errorText));
    await page.setViewport({ width, height });
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    // Wait for SVG and update function to be ready
    await page.waitForSelector("#svgRoot", { timeout: 5000 }).catch(() => {});
    const hasUpdater = await page.evaluate(() => typeof window.__updateFrame === "function");
    if (!hasUpdater) {
      await browser.close();
      return res.status(500).json({ error: "Renderer not ready in page (__updateFrame missing)" });
    }

    await new Promise(r=>setTimeout(r,200));

    const totalFrames = Math.ceil(duration * fps);
    for (let i=0;i<totalFrames;i++){
      const ms = Math.round((i/fps)*1000);
      const ok = await page.evaluate((t)=>{ try{ window.__updateFrame(t); return true; } catch(e){ console.error('update fail', e.message); return false;} }, ms);
      if(!ok) {
        await browser.close();
        return res.status(500).json({ error: "Frame update failed (see backend logs)" });
      }
      try {
        const buf = await page.screenshot({ type:"png" });
        fs.writeFileSync(path.join(framesDir, `frame_${String(i).padStart(5,'0')}.png`), buf);
      } catch (e) {
        await browser.close();
        return res.status(500).json({ error: "Screenshot failed: " + e.message });
      }
    }
    await browser.close();

    const outFile = path.join(tmpDir, `export_${Date.now()}.mp4`);
    await new Promise((resolve,reject)=>{
      const ff = spawn("ffmpeg",[
        "-y",
        "-framerate", String(fps),
        "-i", path.join(framesDir,"frame_%05d.png"),
        "-c:v","libx264",
        "-pix_fmt","yuv420p",
        "-vf", `scale=${width}:${height}`,
        outFile
      ]);
      ff.stderr.on('data', d=>process.stderr.write(d));
      ff.on('error', e=>reject(new Error("ffmpeg start failed: "+e.message)));
      ff.on('close', c=> c===0 ? resolve() : reject(new Error("ffmpeg exit code "+c)));
    }).catch(err => {
      return res.status(500).json({ error: err.message });
    });

    // Stream MP4
    const stat = fs.statSync(outFile);
    res.setHeader("Content-Type","video/mp4");
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Content-Disposition",'attachment; filename="animation.mp4"');
    fs.createReadStream(outFile)
      .on('close', ()=> { try{ fs.rmSync(tmpDir,{recursive:true,force:true}); }catch{} })
      .on('error', e=> {
        console.error("stream error", e);
        res.status(500).end("stream error");
        try{ fs.rmSync(tmpDir,{recursive:true,force:true}); }catch{}
      })
      .pipe(res);

  } catch (err) {
    console.error("Export error:", err);
    res.status(500).json({ error: err.message });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend started on port ${PORT}`);
});
