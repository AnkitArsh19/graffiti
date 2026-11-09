const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = path.join(__dirname, 'data');
const FIG_DIR = path.join(__dirname, 'figures');
fs.mkdirSync(FIG_DIR, { recursive: true });

// Styling constants matching IEEE / ACM publication style
const FONT = 'Arial, sans-serif';
const BLUE = '#2563eb';
const TEAL = '#0d9488';
const DARK = '#1e293b';
const GRAY = '#64748b';
const LIGHT_BG = '#f8fafc';
const BORDER = '#cbd5e1';

// 1. Render Fig 09: Desktop Footprint (Tauri v2 vs Chrome vs Electron)
function renderFig09() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="260" viewBox="0 0 600 260">
    <rect width="100%" height="100%" fill="#ffffff" />
    <text x="30" y="32" font-family="${FONT}" font-size="14" font-weight="bold" fill="${DARK}">Figure 9: Process Memory Utilization (Working Set RAM in MB)</text>
    <text x="30" y="50" font-family="${FONT}" font-size="11" fill="${GRAY}">Native Desktop Shell (Tauri v2) vs. Web Browser vs. Electron Baseline</text>

    <!-- Background Grid Lines -->
    <line x1="160" y1="70" x2="160" y2="210" stroke="${BORDER}" stroke-dasharray="3,3" />
    <line x1="260" y1="70" x2="260" y2="210" stroke="${BORDER}" stroke-dasharray="3,3" />
    <line x1="360" y1="70" x2="360" y2="210" stroke="${BORDER}" stroke-dasharray="3,3" />
    <line x1="460" y1="70" x2="460" y2="210" stroke="${BORDER}" stroke-dasharray="3,3" />
    <line x1="560" y1="70" x2="560" y2="210" stroke="${BORDER}" stroke-dasharray="3,3" />

    <!-- Grid Labels -->
    <text x="160" y="228" font-family="${FONT}" font-size="10" fill="${GRAY}" text-anchor="middle">0 MB</text>
    <text x="260" y="228" font-family="${FONT}" font-size="10" fill="${GRAY}" text-anchor="middle">100 MB</text>
    <text x="360" y="228" font-family="${FONT}" font-size="10" fill="${GRAY}" text-anchor="middle">200 MB</text>
    <text x="460" y="228" font-family="${FONT}" font-size="10" fill="${GRAY}" text-anchor="middle">300 MB</text>
    <text x="560" y="228" font-family="${FONT}" font-size="10" fill="${GRAY}" text-anchor="middle">400 MB</text>

    <!-- Bar 1: Tauri v2 (42.5 MB) -->
    <text x="150" y="98" font-family="${FONT}" font-size="11" font-weight="bold" fill="${DARK}" text-anchor="end">Tauri v2 (Graffiti)</text>
    <rect x="160" y="82" width="42.5" height="24" rx="3" fill="#16a34a" />
    <text x="210" y="98" font-family="${FONT}" font-size="11" font-weight="bold" fill="#16a34a">42.5 MB (-87.7% vs Electron)</text>

    <!-- Bar 2: Chrome Browser (178.4 MB) -->
    <text x="150" y="142" font-family="${FONT}" font-size="11" fill="${DARK}" text-anchor="end">Google Chrome (Tab)</text>
    <rect x="160" y="126" width="178.4" height="24" rx="3" fill="${BLUE}" />
    <text x="345" y="142" font-family="${FONT}" font-size="11" fill="${DARK}">178.4 MB</text>

    <!-- Bar 3: Electron Baseline (345.0 MB) -->
    <text x="150" y="186" font-family="${FONT}" font-size="11" fill="${DARK}" text-anchor="end">Electron (Baseline)</text>
    <rect x="160" y="170" width="345" height="24" rx="3" fill="#dc2626" opacity="0.85" />
    <text x="512" y="186" font-family="${FONT}" font-size="11" fill="${DARK}">345.0 MB</text>
  </svg>`;
  fs.writeFileSync(path.join(FIG_DIR, 'fig09_desktop_footprint.svg'), svg, 'utf-8');
}

// 2. Render Fig 10: Edge Beautifier Latency & Accuracy
function renderFig10() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="280" viewBox="0 0 600 280">
    <rect width="100%" height="100%" fill="#ffffff" />
    <text x="30" y="32" font-family="${FONT}" font-size="14" font-weight="bold" fill="${DARK}">Figure 10: Edge-First Computational Geometry Beautifier Latency (µs)</text>
    <text x="30" y="50" font-family="${FONT}" font-size="11" fill="${GRAY}">Evaluated on 5,005 synthetic strokes | Overall Accuracy: 78.94% | 1,084x faster than Cloud AI</text>

    <!-- Cloud AI comparison callout banner -->
    <rect x="30" y="65" width="540" height="34" rx="4" fill="#eff6ff" stroke="#bfdbfe" />
    <text x="45" y="86" font-family="${FONT}" font-size="11" fill="#1e40af" font-weight="bold">Edge Execution p95: 414.9 µs (0.41 ms) vs. Cloud AI API: 450.0 ms (Zero Network Overhead)</text>

    <!-- Axes -->
    <line x1="80" y1="230" x2="560" y2="230" stroke="${BORDER}" />
    <line x1="80" y1="120" x2="80" y2="230" stroke="${BORDER}" />

    <!-- Y Labels -->
    <text x="70" y="233" font-family="${FONT}" font-size="10" fill="${GRAY}" text-anchor="end">0 µs</text>
    <text x="70" y="195" font-family="${FONT}" font-size="10" fill="${GRAY}" text-anchor="end">250 µs</text>
    <text x="70" y="157" font-family="${FONT}" font-size="10" fill="${GRAY}" text-anchor="end">500 µs</text>
    <text x="70" y="120" font-family="${FONT}" font-size="10" fill="${GRAY}" text-anchor="end">750 µs</text>

    <!-- Bars for classes: Circle (282us), Ellipse (238us), Rect (172us), Diamond (186us), Triangle (142us), Line (23us) -->
    <!-- Circle -->
    <rect x="105" y="${230 - 282 * 0.147}" width="42" height="${282 * 0.147}" rx="2" fill="${TEAL}" />
    <text x="126" y="246" font-family="${FONT}" font-size="10" fill="${DARK}" text-anchor="middle">Circle</text>
    <text x="126" y="${224 - 282 * 0.147}" font-family="${FONT}" font-size="9" fill="${DARK}" text-anchor="middle">282 µs</text>

    <!-- Ellipse -->
    <rect x="175" y="${230 - 238 * 0.147}" width="42" height="${238 * 0.147}" rx="2" fill="${TEAL}" />
    <text x="196" y="246" font-family="${FONT}" font-size="10" fill="${DARK}" text-anchor="middle">Ellipse</text>
    <text x="196" y="${224 - 238 * 0.147}" font-family="${FONT}" font-size="9" fill="${DARK}" text-anchor="middle">238 µs</text>

    <!-- Rectangle -->
    <rect x="245" y="${230 - 172 * 0.147}" width="42" height="${172 * 0.147}" rx="2" fill="${BLUE}" />
    <text x="266" y="246" font-family="${FONT}" font-size="10" fill="${DARK}" text-anchor="middle">Rectangle</text>
    <text x="266" y="${224 - 172 * 0.147}" font-family="${FONT}" font-size="9" fill="${DARK}" text-anchor="middle">172 µs</text>

    <!-- Diamond -->
    <rect x="315" y="${230 - 186 * 0.147}" width="42" height="${186 * 0.147}" rx="2" fill="${BLUE}" />
    <text x="336" y="246" font-family="${FONT}" font-size="10" fill="${DARK}" text-anchor="middle">Diamond</text>
    <text x="336" y="${224 - 186 * 0.147}" font-family="${FONT}" font-size="9" fill="${DARK}" text-anchor="middle">186 µs</text>

    <!-- Triangle -->
    <rect x="385" y="${230 - 142 * 0.147}" width="42" height="${142 * 0.147}" rx="2" fill="#8b5cf6" />
    <text x="406" y="246" font-family="${FONT}" font-size="10" fill="${DARK}" text-anchor="middle">Triangle</text>
    <text x="406" y="${224 - 142 * 0.147}" font-family="${FONT}" font-size="9" fill="${DARK}" text-anchor="middle">142 µs</text>

    <!-- Line -->
    <rect x="455" y="${230 - 23 * 0.147}" width="42" height="${23 * 0.147}" rx="2" fill="#8b5cf6" />
    <text x="476" y="246" font-family="${FONT}" font-size="10" fill="${DARK}" text-anchor="middle">Line</text>
    <text x="476" y="${224 - 23 * 0.147}" font-family="${FONT}" font-size="9" fill="${DARK}" text-anchor="middle">23 µs</text>
  </svg>`;
  fs.writeFileSync(path.join(FIG_DIR, 'fig10_beautifier_latency.svg'), svg, 'utf-8');
}

// 3. Render Fig 11: Canvas 60 FPS Render Scalability
function renderFig11() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="260" viewBox="0 0 600 260">
    <rect width="100%" height="100%" fill="#ffffff" />
    <text x="30" y="32" font-family="${FONT}" font-size="14" font-weight="bold" fill="${DARK}">Figure 11: Canvas Rendering Scalability & Frame Budget Utilization</text>
    <text x="30" y="50" font-family="${FONT}" font-size="11" fill="${GRAY}">Target Frame Budget: 16.67 ms (60 FPS) | Viewport-Culled Rough.js Pipeline</text>

    <!-- 60 FPS Limit Line -->
    <line x1="80" y1="90" x2="560" y2="90" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4,4" />
    <text x="560" y="85" font-family="${FONT}" font-size="10" font-weight="bold" fill="#ef4444" text-anchor="end">60 FPS Budget Limit (16.67 ms)</text>

    <!-- Axes -->
    <line x1="80" y1="210" x2="560" y2="210" stroke="${BORDER}" />
    <line x1="80" y1="90" x2="80" y2="210" stroke="${BORDER}" />

    <!-- Y labels -->
    <text x="70" y="213" font-family="${FONT}" font-size="10" fill="${GRAY}" text-anchor="end">0 ms</text>
    <text x="70" y="174" font-family="${FONT}" font-size="10" fill="${GRAY}" text-anchor="end">5 ms</text>
    <text x="70" y="135" font-family="${FONT}" font-size="10" fill="${GRAY}" text-anchor="end">10 ms</text>
    <text x="70" y="93" font-family="${FONT}" font-size="10" fill="${GRAY}" text-anchor="end">16.6 ms</text>

    <!-- Bars for densities: 100 (0.39ms), 500 (1.53ms), 1000 (2.15ms), 2500 (1.99ms), 5000 (2.07ms), 10000 (3.16ms) -->
    <!-- Scale: 16.67ms = 120px height -> 1ms = 7.2px -->
    <!-- 100 -->
    <rect x="105" y="${210 - 0.39 * 7.2}" width="45" height="${0.39 * 7.2}" rx="2" fill="#22c55e" />
    <text x="127" y="228" font-family="${FONT}" font-size="10" fill="${DARK}" text-anchor="middle">100</text>
    <text x="127" y="${204 - 0.39 * 7.2}" font-family="${FONT}" font-size="9" fill="${DARK}" text-anchor="middle">0.4ms</text>

    <!-- 500 -->
    <rect x="180" y="${210 - 1.53 * 7.2}" width="45" height="${1.53 * 7.2}" rx="2" fill="#22c55e" />
    <text x="202" y="228" font-family="${FONT}" font-size="10" fill="${DARK}" text-anchor="middle">500</text>
    <text x="202" y="${204 - 1.53 * 7.2}" font-family="${FONT}" font-size="9" fill="${DARK}" text-anchor="middle">1.5ms</text>

    <!-- 1,000 -->
    <rect x="255" y="${210 - 2.15 * 7.2}" width="45" height="${2.15 * 7.2}" rx="2" fill="${BLUE}" />
    <text x="277" y="228" font-family="${FONT}" font-size="10" fill="${DARK}" text-anchor="middle">1,000</text>
    <text x="277" y="${204 - 2.15 * 7.2}" font-family="${FONT}" font-size="9" fill="${DARK}" text-anchor="middle">2.2ms</text>

    <!-- 2,500 -->
    <rect x="330" y="${210 - 1.99 * 7.2}" width="45" height="${1.99 * 7.2}" rx="2" fill="${BLUE}" />
    <text x="352" y="228" font-family="${FONT}" font-size="10" fill="${DARK}" text-anchor="middle">2,500</text>
    <text x="352" y="${204 - 1.99 * 7.2}" font-family="${FONT}" font-size="9" fill="${DARK}" text-anchor="middle">2.0ms</text>

    <!-- 5,000 -->
    <rect x="405" y="${210 - 2.07 * 7.2}" width="45" height="${2.07 * 7.2}" rx="2" fill="${TEAL}" />
    <text x="427" y="228" font-family="${FONT}" font-size="10" fill="${DARK}" text-anchor="middle">5,000</text>
    <text x="427" y="${204 - 2.07 * 7.2}" font-family="${FONT}" font-size="9" fill="${DARK}" text-anchor="middle">2.1ms</text>

    <!-- 10,000 -->
    <rect x="480" y="${210 - 3.16 * 7.2}" width="45" height="${3.16 * 7.2}" rx="2" fill="${TEAL}" />
    <text x="502" y="228" font-family="${FONT}" font-size="10" fill="${DARK}" text-anchor="middle">10,000</text>
    <text x="502" y="${204 - 3.16 * 7.2}" font-family="${FONT}" font-size="9" fill="${DARK}" text-anchor="middle">3.2ms</text>
  </svg>`;
  fs.writeFileSync(path.join(FIG_DIR, 'fig11_canvas_fps_scalability.svg'), svg, 'utf-8');
}

// 4. Render Fig 12: Dual-Pipeline LWW-CRDT Concurrency & Throughput
function renderFig12() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="310" viewBox="0 0 600 310">
    <rect width="100%" height="100%" fill="#ffffff" />
    <text x="30" y="30" font-family="${FONT}" font-size="14" font-weight="bold" fill="${DARK}">Figure 12: Dual-Pipeline LWW-CRDT Scalability & Convergence</text>
    <text x="30" y="47" font-family="${FONT}" font-size="11" fill="${GRAY}">Stress-tested up to 500 concurrent users | 471,000 merged operations | 100.00% consistency</text>

    <!-- 100% Convergence Banner -->
    <rect x="30" y="58" width="540" height="30" rx="4" fill="#f0fdf4" stroke="#bbf7d0" />
    <text x="45" y="77" font-family="${FONT}" font-size="11" fill="#15803d" font-weight="bold">State Convergence: 100.00% across all 8 tiers (0 divergences under arrival shuffle &amp; reversal)</text>

    <!-- Table Layout for IEEE publication style -->
    <rect x="30" y="98" width="540" height="195" rx="4" fill="${LIGHT_BG}" stroke="${BORDER}" />
    
    <!-- Table Header -->
    <rect x="30" y="98" width="540" height="24" fill="#e2e8f0" />
    <text x="45" y="114" font-family="${FONT}" font-size="9.5" font-weight="bold" fill="${DARK}">Active Users</text>
    <text x="135" y="114" font-family="${FONT}" font-size="9.5" font-weight="bold" fill="${DARK}">Total Ops</text>
    <text x="210" y="114" font-family="${FONT}" font-size="9.5" font-weight="bold" fill="${DARK}">Convergence</text>
    <text x="310" y="114" font-family="${FONT}" font-size="9.5" font-weight="bold" fill="${DARK}">Merge Time (p95)</text>
    <text x="430" y="114" font-family="${FONT}" font-size="9.5" font-weight="bold" fill="${DARK}">Network Fanout (60Hz)</text>

    <!-- Row 1: 10 Users -->
    <line x1="30" y1="142" x2="570" y2="142" stroke="${BORDER}" />
    <text x="45" y="136" font-family="${FONT}" font-size="9.5" fill="${DARK}">10 Users</text>
    <text x="135" y="136" font-family="${FONT}" font-size="9.5" fill="${DARK}">5,000</text>
    <text x="210" y="136" font-family="${FONT}" font-size="9.5" font-weight="bold" fill="#15803d">100% (0 div)</text>
    <text x="310" y="136" font-family="${FONT}" font-size="9.5" fill="${DARK}">0.13 µs</text>
    <text x="430" y="136" font-family="${FONT}" font-size="9.5" fill="${DARK}">5,400 msgs/s</text>

    <!-- Row 2: 25 Users -->
    <line x1="30" y1="164" x2="570" y2="164" stroke="${BORDER}" />
    <text x="45" y="158" font-family="${FONT}" font-size="9.5" fill="${DARK}">25 Users</text>
    <text x="135" y="158" font-family="${FONT}" font-size="9.5" fill="${DARK}">12,500</text>
    <text x="210" y="158" font-family="${FONT}" font-size="9.5" font-weight="bold" fill="#15803d">100% (0 div)</text>
    <text x="310" y="158" font-family="${FONT}" font-size="9.5" fill="${DARK}">0.10 µs</text>
    <text x="430" y="158" font-family="${FONT}" font-size="9.5" fill="${DARK}">36,000 msgs/s</text>

    <!-- Row 3: 50 Users -->
    <line x1="30" y1="186" x2="570" y2="186" stroke="${BORDER}" />
    <text x="45" y="180" font-family="${FONT}" font-size="9.5" fill="${DARK}">50 Users</text>
    <text x="135" y="180" font-family="${FONT}" font-size="9.5" fill="${DARK}">25,000</text>
    <text x="210" y="180" font-family="${FONT}" font-size="9.5" font-weight="bold" fill="#15803d">100% (0 div)</text>
    <text x="310" y="180" font-family="${FONT}" font-size="9.5" fill="${DARK}">0.15 µs</text>
    <text x="430" y="180" font-family="${FONT}" font-size="9.5" fill="${DARK}">147,000 msgs/s</text>

    <!-- Row 4: 100 Users -->
    <line x1="30" y1="208" x2="570" y2="208" stroke="${BORDER}" />
    <text x="45" y="202" font-family="${FONT}" font-size="9.5" fill="${DARK}">100 Users</text>
    <text x="135" y="202" font-family="${FONT}" font-size="9.5" fill="${DARK}">50,000</text>
    <text x="210" y="202" font-family="${FONT}" font-size="9.5" font-weight="bold" fill="#15803d">100% (0 div)</text>
    <text x="310" y="202" font-family="${FONT}" font-size="9.5" fill="${DARK}">0.05 µs</text>
    <text x="430" y="202" font-family="${FONT}" font-size="9.5" font-weight="bold" fill="#ca8a04">594,000 msgs/s (Network Limit)</text>

    <!-- Row 5: 250 Users -->
    <line x1="30" y1="230" x2="570" y2="230" stroke="${BORDER}" />
    <text x="45" y="224" font-family="${FONT}" font-size="9.5" fill="${DARK}">250 Users</text>
    <text x="135" y="224" font-family="${FONT}" font-size="9.5" fill="${DARK}">125,000</text>
    <text x="210" y="224" font-family="${FONT}" font-size="9.5" font-weight="bold" fill="#15803d">100% (0 div)</text>
    <text x="310" y="224" font-family="${FONT}" font-size="9.5" fill="${DARK}">0.08 µs</text>
    <text x="430" y="224" font-family="${FONT}" font-size="9.5" fill="#dc2626">3.73M msgs/s (Requires Cluster)</text>

    <!-- Row 6: 500 Users -->
    <line x1="30" y1="252" x2="570" y2="252" stroke="${BORDER}" />
    <text x="45" y="246" font-family="${FONT}" font-size="9.5" font-weight="bold" fill="${DARK}">500 Users</text>
    <text x="135" y="246" font-family="${FONT}" font-size="9.5" fill="${DARK}">250,000</text>
    <text x="210" y="246" font-family="${FONT}" font-size="9.5" font-weight="bold" fill="#15803d">100% (0 div)</text>
    <text x="310" y="246" font-family="${FONT}" font-size="9.5" fill="${DARK}">0.05 µs (&gt;10M ops/s)</text>
    <text x="430" y="246" font-family="${FONT}" font-size="9.5" fill="#dc2626">14.97M msgs/s (Requires Sharding)</text>

    <text x="45" y="278" font-family="${FONT}" font-size="9.5" fill="${GRAY}">*System Breaking Point: Client CRDT state merge remains sub-microsecond (&lt;0.2 µs); the architectural ceiling is O(N²) network socket broadcast fanout.</text>
  </svg>`;
  fs.writeFileSync(path.join(FIG_DIR, 'fig12_collab_crdt_convergence.svg'), svg, 'utf-8');
}

// 5. Render Fig 13: Canvas Breaking Point & Frame Degradation Knee
function renderFig13() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="320" viewBox="0 0 600 320">
    <rect width="100%" height="100%" fill="#ffffff" />
    <text x="30" y="32" font-family="${FONT}" font-size="14" font-weight="bold" fill="${DARK}">Figure 13: Unculled Panoramic Stress Curve &amp; Canvas Breaking Point</text>
    <text x="30" y="50" font-family="${FONT}" font-size="11" fill="${GRAY}">Simultaneously visible unculled vector shapes vs. Frame Time (ms) &amp; Effective FPS</text>

    <!-- Threshold Guide Lines -->
    <!-- Plot Area: x: 80 to 550, y: 80 to 260 (height: 180) -->
    <!-- Max ms on Y = 100ms. 1ms = 1.8px -->
    <!-- 16.67ms (60 FPS limit) => y = 260 - 16.67 * 1.8 = 230 -->
    <!-- 33.33ms (30 FPS limit) => y = 260 - 33.33 * 1.8 = 200 -->

    <rect x="80" y="230" width="470" height="30" fill="#f0fdf4" opacity="0.6" />
    <rect x="80" y="200" width="470" height="30" fill="#fefce8" opacity="0.6" />
    <rect x="80" y="80" width="470" height="120" fill="#fef2f2" opacity="0.6" />

    <!-- 60 FPS Target Line -->
    <line x1="80" y1="230" x2="550" y2="230" stroke="#16a34a" stroke-width="1.5" stroke-dasharray="4,4" />
    <text x="545" y="226" font-family="${FONT}" font-size="9" font-weight="bold" fill="#16a34a" text-anchor="end">60 FPS Budget (16.67 ms)</text>

    <!-- 30 FPS Usability Floor Line -->
    <line x1="80" y1="200" x2="550" y2="200" stroke="#ca8a04" stroke-width="1.5" stroke-dasharray="4,4" />
    <text x="545" y="196" font-family="${FONT}" font-size="9" font-weight="bold" fill="#ca8a04" text-anchor="end">30 FPS Usability Floor (33.33 ms)</text>

    <!-- Axes -->
    <line x1="80" y1="260" x2="550" y2="260" stroke="${BORDER}" />
    <line x1="80" y1="80" x2="80" y2="260" stroke="${BORDER}" />

    <!-- Y labels (Frame Time in ms) -->
    <text x="70" y="263" font-family="${FONT}" font-size="9.5" fill="${GRAY}" text-anchor="end">0 ms (∞ FPS)</text>
    <text x="70" y="233" font-family="${FONT}" font-size="9.5" fill="#16a34a" font-weight="bold" text-anchor="end">16.7 ms (60 FPS)</text>
    <text x="70" y="203" font-family="${FONT}" font-size="9.5" fill="#ca8a04" font-weight="bold" text-anchor="end">33.3 ms (30 FPS)</text>
    <text x="70" y="152" font-family="${FONT}" font-size="9.5" fill="${GRAY}" text-anchor="end">60.0 ms (16 FPS)</text>
    <text x="70" y="85" font-family="${FONT}" font-size="9.5" fill="#dc2626" font-weight="bold" text-anchor="end">100 ms (10 FPS)</text>

    <!-- X Mapping: 0 to 10,000 shapes => 80 to 550 (470px width => 1 shape = 0.047px) -->
    <!-- 100: x=85, y=260 - 1.13*1.8 = 258 -->
    <!-- 500: x=103, y=260 - 4.98*1.8 = 251 -->
    <!-- 1000: x=127, y=260 - 13.03*1.8 = 236.5 -->
    <!-- 1500: x=150, y=260 - 14.09*1.8 = 234.6 -->
    <!-- 2000 (Knee 1): x=174, y=260 - 16.90*1.8 = 229.6 -->
    <!-- 3000: x=221, y=260 - 26.69*1.8 = 212.0 -->
    <!-- 4000 (Knee 2): x=268, y=260 - 37.21*1.8 = 193.0 -->
    <!-- 5000: x=315, y=260 - 46.11*1.8 = 177.0 -->
    <!-- 7500: x=432, y=260 - 57.69*1.8 = 156.2 -->
    <!-- 10000: x=550, y=260 - 98.02*1.8 = 83.6 -->

    <!-- Shaded area under curve -->
    <path d="M 85 258 L 103 251 L 127 236.5 L 150 234.6 L 174 229.6 L 221 212 L 268 193 L 315 177 L 432 156.2 L 550 83.6 L 550 260 L 85 260 Z" fill="${BLUE}" opacity="0.1" />

    <!-- Curve Line -->
    <path d="M 85 258 L 103 251 L 127 236.5 L 150 234.6 L 174 229.6 L 221 212 L 268 193 L 315 177 L 432 156.2 L 550 83.6" fill="none" stroke="${BLUE}" stroke-width="2.5" />

    <!-- Data Points -->
    <circle cx="85" cy="258" r="3.5" fill="${BLUE}" />
    <circle cx="103" cy="251" r="3.5" fill="${BLUE}" />
    <circle cx="127" cy="236.5" r="3.5" fill="${BLUE}" />
    <circle cx="150" cy="234.6" r="3.5" fill="${BLUE}" />

    <!-- Knee 1 Point: 2000 shapes -->
    <circle cx="174" cy="229.6" r="5" fill="#ca8a04" stroke="#ffffff" stroke-width="1.5" />
    <line x1="174" y1="229.6" x2="174" y2="185" stroke="#ca8a04" stroke-width="1" stroke-dasharray="2,2" />
    <rect x="140" y="155" width="115" height="28" rx="3" fill="#fefce8" stroke="#ca8a04" />
    <text x="197" y="167" font-family="${FONT}" font-size="8.5" font-weight="bold" fill="#854d0e" text-anchor="middle">Breaking Point 1 (60 FPS)</text>
    <text x="197" y="178" font-family="${FONT}" font-size="8" fill="#854d0e" text-anchor="middle">2,000 shapes (16.9 ms / 59.2 FPS)</text>

    <!-- Point 3000 -->
    <circle cx="221" cy="212" r="3.5" fill="${BLUE}" />

    <!-- Knee 2 Point: 4000 shapes -->
    <circle cx="268" cy="193" r="5" fill="#dc2626" stroke="#ffffff" stroke-width="1.5" />
    <line x1="268" y1="193" x2="268" y2="140" stroke="#dc2626" stroke-width="1" stroke-dasharray="2,2" />
    <rect x="235" y="110" width="115" height="28" rx="3" fill="#fef2f2" stroke="#dc2626" />
    <text x="292" y="122" font-family="${FONT}" font-size="8.5" font-weight="bold" fill="#991b1b" text-anchor="middle">Breaking Point 2 (30 FPS)</text>
    <text x="292" y="133" font-family="${FONT}" font-size="8" fill="#991b1b" text-anchor="middle">4,000 shapes (37.2 ms / 26.9 FPS)</text>

    <!-- Remaining points -->
    <circle cx="315" cy="177" r="3.5" fill="${BLUE}" />
    <circle cx="432" cy="156.2" r="3.5" fill="${BLUE}" />

    <!-- Endpoint: 10,000 shapes -->
    <circle cx="550" cy="83.6" r="5" fill="#991b1b" stroke="#ffffff" stroke-width="1.5" />
    <rect x="430" y="80" width="110" height="26" rx="3" fill="#fef2f2" stroke="#991b1b" />
    <text x="485" y="92" font-family="${FONT}" font-size="8.5" font-weight="bold" fill="#991b1b" text-anchor="middle">Critical Freeze</text>
    <text x="485" y="102" font-family="${FONT}" font-size="8" fill="#991b1b" text-anchor="middle">10,000 shapes (98.0 ms / 10 FPS)</text>

    <!-- X Axis Labels -->
    <text x="85" y="276" font-family="${FONT}" font-size="9" fill="${DARK}" text-anchor="middle">100</text>
    <text x="127" y="276" font-family="${FONT}" font-size="9" fill="${DARK}" text-anchor="middle">1,000</text>
    <text x="174" y="276" font-family="${FONT}" font-size="9" font-weight="bold" fill="#ca8a04" text-anchor="middle">2,000</text>
    <text x="268" y="276" font-family="${FONT}" font-size="9" font-weight="bold" fill="#dc2626" text-anchor="middle">4,000</text>
    <text x="362" y="276" font-family="${FONT}" font-size="9" fill="${DARK}" text-anchor="middle">6,000</text>
    <text x="456" y="276" font-family="${FONT}" font-size="9" fill="${DARK}" text-anchor="middle">8,000</text>
    <text x="550" y="276" font-family="${FONT}" font-size="9" font-weight="bold" fill="#991b1b" text-anchor="middle">10,000</text>
    <text x="315" y="295" font-family="${FONT}" font-size="10.5" font-weight="bold" fill="${DARK}" text-anchor="middle">Simultaneously Visible Vector Shapes (Unculled Viewport)</text>
    <text x="315" y="310" font-family="${FONT}" font-size="9" fill="${GRAY}" text-anchor="middle">*Note: Under normal operation with Graffiti's spatial AABB culling active, frame times remain &lt;3.2 ms even at 10,000 shapes (Fig. 11).</text>
  </svg>`;
  fs.writeFileSync(path.join(FIG_DIR, 'fig13_canvas_breaking_point.svg'), svg, 'utf-8');
}

console.log('Rendering figures...');
renderFig09();
renderFig10();
renderFig11();
renderFig12();
renderFig13();
console.log('All figures (Fig 09, 10, 11, 12, 13) successfully generated in test data/figures!');

