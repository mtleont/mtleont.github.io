/* ========================================
   PixelPainter — Pixel Art Studio
   Complete engine module
   ======================================== */
(() => {
  'use strict';

  const $ = (q, ctx = document) => ctx.querySelector(q);
  const $$ = (q, ctx = document) => Array.from(ctx.querySelectorAll(q));

  function hexToRgba(hex) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    const a = h.length === 8 ? parseInt(h.substring(6, 8), 16) : 255;
    return { r, g, b, a };
  }

  function rgbaToHex(r, g, b, a = 255) {
    const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
    const toHx = (v) => clamp(v).toString(16).padStart(2, '0');
    return `#${toHx(r)}${toHx(g)}${toHx(b)}${toHx(a)}`;
  }

  const PALETTE = [
    '#000000','#ffffff','#ff0000','#00ff00','#0000ff','#ffff00','#ff00ff','#00ffff',
    '#ff6b6b','#feca57','#48dbfb','#ff9ff3','#54a0ff','#5f27cd','#01a3a4','#f368e0',
    '#ff6348','#7bed9f','#70a1ff','#5352ed','#ff4757','#2ed573','#1e90ff','#ffa502',
    '#eccc68','#a4b0be','#ff7f50','#2f3542','#57606f','#ced6e0','#dfe4ea','#ffffff',
    '#6c5ce7','#a29bfe','#fd79a8','#e84393','#d63031','#e17055','#fdcb6e','#00b894',
    '#00cec9','#0984e3','#6c5ce7','#2d3436','#636e72','#b2bec3','#c44569','#f78fb3',
    '#3dc1d3','#e77f67','#cf6a87','#574b90','#303952','#e15f41','#c44569','#f19066',
    '#f5cd79','#78e08f','#3dc1d3','#e77f67','#574b90','#f19066','#f5cd79',
    '#060606','#1a1a2e','#16213e','#0f3460','#222831','#393e46','#00adb5','#eeeeee'
  ];

  class Layer {
    constructor(w, h, name = 'Layer') {
      this.name = name;
      this.canvas = document.createElement('canvas');
      this.canvas.width = w;
      this.canvas.height = h;
      this.ctx = this.canvas.getContext('2d');
      this.visible = true;
      this.opacity = 1.0;
      this.clear();
    }

    clear() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    getImageData() { return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height); }
    putImageData(d) { this.ctx.putImageData(d, 0, 0); }

    clone() {
      const c = new Layer(this.canvas.width, this.canvas.height, this.name + ' copy');
      c.ctx.drawImage(this.canvas, 0, 0);
      c.visible = this.visible;
      c.opacity = this.opacity;
      return c;
    }

    setPixel(x, y, colorHex) {
      const { r, g, b, a } = hexToRgba(colorHex);
      this.ctx.clearRect(x, y, 1, 1);
      this.ctx.fillStyle = colorHex;
      this.ctx.fillRect(x, y, 1, 1);
    }

    getPixel(x, y) {
      const d = this.ctx.getImageData(x, y, 1, 1).data;
      return rgbaToHex(d[0], d[1], d[2], d[3]);
    }

    fill(colorHex) {
      this.ctx.fillStyle = colorHex;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  class History {
    constructor(max = 60) {
      this.states = [];
      this.idx = -1;
      this.max = max;
    }

    push(s) {
      this.states.length = Math.min(this.idx + 1, this.max);
      this.states.push(s);
      if (this.states.length > this.max) this.states.shift();
      this.idx = this.states.length - 1;
    }

    undo() { if (this.idx > 0) return this.states[--this.idx]; return null; }
    redo() { if (this.idx < this.states.length - 1) return this.states[++this.idx]; return null; }
    get canUndo() { return this.idx > 0; }
    get canRedo() { return this.idx < this.states.length - 1; }
  }

  function floodFill(ctx, w, h, sx, sy, fillHex) {
    const { r: fr, g: fg, b: fb, a: fa } = hexToRgba(fillHex);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const idx = (x, y) => (y * w + x) * 4;
    const sr = idx(sx, sy);
    const dr = d[sr], dg = d[sr+1], db = d[sr+2], da = d[sr+3];
    if (Math.abs(dr - fr) <= 1 && Math.abs(dg - fg) <= 1 && Math.abs(db - fb) <= 1 && Math.abs(da - fa) <= 1) return;

    const stack = [[sx, sy]];
    const visited = new Uint8Array(w * h);
    while (stack.length) {
      const [x, y] = stack.pop();
      if (x < 0 || x >= w || y < 0 || y >= h) continue;
      const pi = y * w + x;
      if (visited[pi]) continue;
      const i = pi * 4;
      if (Math.abs(d[i] - dr) > 1 || Math.abs(d[i+1] - dg) > 1 || Math.abs(d[i+2] - db) > 1 || Math.abs(d[i+3] - da) > 1) continue;
      visited[pi] = 1;
      d[i] = fr; d[i+1] = fg; d[i+2] = fb; d[i+3] = fa;
      stack.push([x+1, y], [x-1, y], [x, y+1], [x, y-1]);
    }
    ctx.putImageData(img, 0, 0);
  }

  class PixelPainter {
    constructor() {
      this.width = 32;
      this.height = 32;
      this.layers = [];
      this.activeLayerIdx = 0;
      this.activeTool = 'pencil';
      this.foreColor = '#000000';
      this.backColor = '#ffffff';
      this.zoom = 8;
      this.canvasX = 0;
      this.canvasY = 0;
      this.isPanning = false;
      this.isDrawing = false;
      this.showGrid = true;
      this.panStart = null;
      this.lastDrawCell = null;
      this.shapeStart = null;
      this.shapeSnapshot = null;
      this.onionPrev = 0.3;
      this.onionNext = 0.3;
      this.onionShiftX = 1;
      this.onionShiftY = 0;
      this.onionEnabled = false;
      this.history = new History();
      this.viewport = $('#canvasViewport');
      this.canvas = $('#mainCanvas');
      this.ctx = this.canvas.getContext('2d');
      this.offscreen = document.createElement('canvas');
      this.octx = this.offscreen.getContext('2d');
      this.init();
    }

    init() {
      this.initDOM();
      this.initPalette();
      this.initCanvasSize(this.width, this.height);
      this.bindEvents();
      this.updateUI();
      this.render();
    }

    initDOM() {
      this.dom = {
        canvasInfo: $('#canvasInfo'),
        zoomLabel: $('#zoomLabel'),
        cursorPos: $('#cursorPos'),
        toolStatus: $('#toolStatus'),
        canvasW: $('#canvasWidth'),
        canvasH: $('#canvasHeight'),
        colorPicker: $('#colorPicker'),
        bgColorPicker: $('#bgColorPicker'),
        swatchFg: $('#swatchForeground'),
        swatchBg: $('#swatchBackground'),
        paletteGrid: $('#paletteGrid'),
        layerList: $('#layerList'),
        layerPreview0: $('#layerPreview0'),
        layerOpacity: $('#layerOpacity'),
        layerOpacityValue: $('#layerOpacityValue'),
        onionPrevSlider: $('#onionPrevOpacity'),
        onionNextSlider: $('#onionNextOpacity'),
        onionPrevValue: $('#onionPrevValue'),
        onionNextValue: $('#onionNextValue'),
        onionShiftX: $('#onionShiftX'),
        onionShiftY: $('#onionShiftY'),
        exportCanvas: $('#exportCanvas'),
        exportFormat: $('#exportFormat'),
        exportQuality: $('#exportQuality'),
        exportQualityValue: $('#exportQualityValue'),
        exportDims: $('#exportDims'),
        exportScale: $('#exportScale'),
        exportTransparent: $('#exportTransparent'),
        exportFlat: $('#exportFlat'),
        exportModal: $('#exportModal'),
        resizeModal: $('#resizeModal'),
      };
    }

    initPalette() {
      this.dom.paletteGrid.innerHTML = '';
      PALETTE.forEach(color => {
        const sw = document.createElement('div');
        sw.className = 'palette-swatch';
        sw.style.background = color;
        sw.dataset.color = color;
        sw.title = color;
        sw.addEventListener('mousedown', (e) => {
          e.button === 2 ? this.setColor('back', color) : this.setColor('fore', color);
        });
        sw.addEventListener('contextmenu', e => e.preventDefault());
        this.dom.paletteGrid.appendChild(sw);
      });
    }

    initCanvasSize(w, h) {
      this.width = w;
      this.height = h;
      this.canvas.width = w * this.zoom;
      this.canvas.height = h * this.zoom;
      this.offscreen.width = w;
      this.offscreen.height = h;
      this.layers = [new Layer(w, h, 'Background')];
      this.layers[0].fill(this.backColor);
      this.activeLayerIdx = 0;
      this.history = new History();
      this.saveState();
      this.centerCanvas();
      this.updateLayerUI();
      this.updateLayerPreviews();
    }

    centerCanvas() {
      this.canvasX = (this.viewport.clientWidth - this.canvas.width) / 2;
      this.canvasY = (this.viewport.clientHeight - this.canvas.height) / 2;
      this.applyCanvasTransform();
    }

    applyCanvasTransform() {
      this.canvas.style.transform = `translate(calc(-50% + ${this.canvasX}px), calc(-50% + ${this.canvasY}px))`;
    }

    saveState() {
      const state = {
        layers: this.layers.map(l => ({
          img: l.getImageData(),
          name: l.name,
          visible: l.visible,
          opacity: l.opacity,
        })),
        activeLayerIdx: this.activeLayerIdx,
      };
      this.history.push(state);
      this.updateUndoRedoUI();
    }

    undo() {
      if (this.history.canUndo) this.restoreState(this.history.undo());
    }

    redo() {
      if (this.history.canRedo) this.restoreState(this.history.redo());
    }

    restoreState(state) {
      if (!state || !Array.isArray(state.layers)) return;

      while (this.layers.length > state.layers.length) this.layers.pop();

      while (this.layers.length < state.layers.length) {
        const l = new Layer(this.width, this.height, 'Layer');
        this.layers.push(l);
      }

      state.layers.forEach((saved, i) => {
        const layer = this.layers[i];
        layer.putImageData(saved.img);
        if (saved.name !== undefined) layer.name = saved.name;
        if (saved.visible !== undefined) layer.visible = saved.visible;
        if (saved.opacity !== undefined) layer.opacity = saved.opacity;
      });

      this.activeLayerIdx = Math.max(0, Math.min(state.activeLayerIdx, this.layers.length - 1));
      this.updateLayerUI();
      this.updateLayerPreviews();
      this.updateUndoRedoUI();
      this.render();
    }

    get activeLayer() { return this.layers[this.activeLayerIdx]; }

    render() {
      this.octx.clearRect(0, 0, this.width, this.height);

      // Onion skin
      if (this.onionEnabled) {
        if (this.activeLayerIdx > 0) {
          const prev = this.layers[this.activeLayerIdx - 1];
          if (prev.visible) {
            this.octx.globalAlpha = Math.min(1, Math.max(0, this.onionPrev));
            this.octx.drawImage(prev.canvas, -this.onionShiftX, -this.onionShiftY);
          }
        }
        if (this.activeLayerIdx < this.layers.length - 1) {
          const next = this.layers[this.activeLayerIdx + 1];
          if (next.visible) {
            this.octx.globalAlpha = Math.min(1, Math.max(0, this.onionNext));
            this.octx.drawImage(next.canvas, this.onionShiftX, this.onionShiftY);
          }
        }
        this.octx.globalAlpha = 1.0;
      }

      // Composite layers
      for (let i = 0; i < this.layers.length; i++) {
        const layer = this.layers[i];
        if (!layer.visible) continue;
        this.octx.globalAlpha = Math.min(1, Math.max(0, layer.opacity));
        this.octx.drawImage(layer.canvas, 0, 0);
      }
      this.octx.globalAlpha = 1.0;

      // To main canvas
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.drawImage(this.offscreen, 0, 0, this.canvas.width, this.canvas.height);

      // Grid
      if (this.showGrid && this.zoom >= 4) {
        this.ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        this.ctx.lineWidth = 1;
        for (let x = 0; x <= this.width; x++) {
          this.ctx.beginPath();
          this.ctx.moveTo(x * this.zoom + 0.5, 0);
          this.ctx.lineTo(x * this.zoom + 0.5, this.canvas.height);
          this.ctx.stroke();
        }
        for (let y = 0; y <= this.height; y++) {
          this.ctx.beginPath();
          this.ctx.moveTo(0, y * this.zoom + 0.5);
          this.ctx.lineTo(this.canvas.width, y * this.zoom + 0.5);
          this.ctx.stroke();
        }
      }
    }

    updateLayerPreviews() {
      for (let i = 0; i < this.layers.length; i++) {
        const prev = document.createElement('canvas');
        prev.width = 32; prev.height = 32;
        const pctx = prev.getContext('2d');
        pctx.imageSmoothingEnabled = false;
        pctx.drawImage(this.layers[i].canvas, 0, 0, 32, 32);
        const el = document.getElementById('layerPreview' + i);
        if (el) {
          el.style.backgroundImage = `url(${prev.toDataURL()})`;
          el.style.backgroundSize = 'cover';
        }
      }
    }

    viewportToPixel(e) {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      return { px: Math.floor(x / this.zoom), py: Math.floor(y / this.zoom), x, y };
    }

    inBounds(px, py) {
      return px >= 0 && px < this.width && py >= 0 && py < this.height;
    }

    setTool(tool) {
      this.activeTool = tool;
      $$('.tool-btn[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
      const names = { pencil: 'Pencil', eraser: 'Eraser', fill: 'Fill', eyedropper: 'Eyedropper', move: 'Move', rect: 'Rectangle', 'rect-fill': 'Filled Rectangle', circle: 'Ellipse', 'circle-fill': 'Filled Ellipse', line: 'Line' };
      this.dom.toolStatus.textContent = names[tool] || tool;
      const cursors = { pencil: 'crosshair', eraser: 'crosshair', fill: 'crosshair', eyedropper: 'crosshair', move: 'grab', rect: 'crosshair', 'rect-fill': 'crosshair', circle: 'crosshair', 'circle-fill': 'crosshair', line: 'crosshair' };
      this.viewport.style.cursor = cursors[tool] || 'crosshair';
    }

    drawPixel(px, py) {
      if (this.activeLayer.locked) return;
      this.activeLayer.setPixel(px, py, this.foreColor);
      this.render();
      this.updateLayerPreviews();
    }

    erasePixel(px, py) {
      if (this.activeLayer.locked) return;
      this.activeLayer.ctx.clearRect(px, py, 1, 1);
      this.render();
      this.updateLayerPreviews();
    }

    pickColor(px, py) {
      this.foreColor = this.activeLayer.getPixel(px, py);
      this.updateColorUI();
      this.setTool('pencil');
    }

    fillAt(sx, sy) {
      if (this.activeLayer.locked) return;
      floodFill(this.activeLayer.ctx, this.width, this.height, sx, sy, this.foreColor);
      this.render();
      this.updateLayerPreviews();
    }

    drawShape(ax, ay, bx, by) {
      if (this.activeLayer.locked) return;
      const { r, g, b, a } = hexToRgba(this.foreColor);
      const x0 = Math.min(ax, bx), y0 = Math.min(ay, by);
      const x1 = Math.max(ax, bx), y1 = Math.max(ay, by);
      const w = x1 - x0, h = y1 - y0;

      if (w === 0 && h === 0) return;

      switch (this.activeTool) {
        case 'line':
          this.drawBresenhamLine(ax, ay, bx, by);
          break;
        case 'rect':
        case 'rect-fill': {
          const img = this.activeLayer.ctx.getImageData(x0, y0, w + 1, h + 1);
          const d = img.data;
          if (this.activeTool === 'rect-fill') {
            for (let i = 0; i < d.length; i += 4) {
              d[i] = r; d[i+1] = g; d[i+2] = b; d[i+3] = a;
            }
          } else {
            for (let px2 = x0; px2 <= x1; px2++) {
              const top = ((y0 - y0) * (w + 1) + (px2 - x0)) * 4;
              const bot = ((y1 - y0) * (w + 1) + (px2 - x0)) * 4;
              d[top]=r; d[top+1]=g; d[top+2]=b; d[top+3]=a;
              d[bot]=r; d[bot+1]=g; d[bot+2]=b; d[bot+3]=a;
            }
            for (let py2 = y0; py2 <= y1; py2++) {
              const le = ((py2 - y0) * (w + 1)) * 4;
              const ri = ((py2 - y0) * (w + 1) + (x1 - x0)) * 4;
              d[le]=r; d[le+1]=g; d[le+2]=b; d[le+3]=a;
              d[ri]=r; d[ri+1]=g; d[ri+2]=b; d[ri+3]=a;
            }
          }
          this.activeLayer.ctx.putImageData(img, x0, y0);
          break;
        }
        case 'circle':
        case 'circle-fill': {
          const cx = (ax + bx) / 2, cy = (ay + by) / 2;
          const rx = Math.abs(bx - ax) / 2, ry = Math.abs(by - ay) / 2;
          this.activeLayer.ctx.save();
          this.activeLayer.ctx.beginPath();
          this.activeLayer.ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          this.activeLayer.ctx.clip();
          if (this.activeTool === 'circle-fill') {
            this.activeLayer.ctx.fillStyle = this.foreColor;
            this.activeLayer.ctx.fillRect(x0, y0, w + 1, h + 1);
          } else {
            this.activeLayer.ctx.strokeStyle = this.foreColor;
            this.activeLayer.ctx.lineWidth = 1;
            this.activeLayer.ctx.stroke();
          }
          this.activeLayer.ctx.restore();
          break;
        }
      }
      this.render();
      this.updateLayerPreviews();
    }

    drawBresenhamLine(x0, y0, x1, y1) {
      let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
      let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx - dy;
      while (true) {
        this.activeLayer.setPixel(x0, y0, this.foreColor);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x0 += sx; }
        if (e2 < dx) { err += dx; y0 += sy; }
      }
    }

    setColor(which, hex) {
      which === 'fore' ? this.foreColor = hex : this.backColor = hex;
      this.updateColorUI();
    }

    updateColorUI() {
      this.dom.swatchFg.style.background = this.foreColor;
      this.dom.swatchBg.style.background = this.backColor;
      this.dom.colorPicker.value = this.toValidHex(this.foreColor);
      this.dom.bgColorPicker.value = this.toValidHex(this.backColor);
    }

    toValidHex(hex) {
      const { r, g, b } = hexToRgba(hex);
      return `#${[r, g, b].map(v => Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
    }

    // Layers
    addLayer() {
      const l = new Layer(this.width, this.height, `Layer ${this.layers.length}`);
      this.layers.push(l);
      this.activeLayerIdx = this.layers.length - 1;
      this.updateLayerUI();
      this.updateLayerPreviews();
      this.render();
    }

    duplicateLayer() {
      const dup = this.activeLayer.clone();
      dup.name = this.activeLayer.name + ' copy';
      this.layers.splice(this.activeLayerIdx + 1, 0, dup);
      this.activeLayerIdx++;
      this.updateLayerUI();
      this.updateLayerPreviews();
      this.render();
    }

    deleteLayer() {
      if (this.layers.length <= 1) return;
      this.layers.splice(this.activeLayerIdx, 1);
      this.activeLayerIdx = Math.min(this.activeLayerIdx, this.layers.length - 1);
      this.updateLayerUI();
      this.updateLayerPreviews();
      this.render();
    }

    moveLayer(dir) {
      const ni = this.activeLayerIdx + dir;
      if (ni < 0 || ni >= this.layers.length) return;
      [this.layers[this.activeLayerIdx], this.layers[ni]] = [this.layers[ni], this.layers[this.activeLayerIdx]];
      this.activeLayerIdx = ni;
      this.updateLayerUI();
      this.updateLayerPreviews();
      this.render();
    }

    mergeDown() {
      if (this.activeLayerIdx <= 0) return;
      const upper = this.layers[this.activeLayerIdx];
      const lower = this.layers[this.activeLayerIdx - 1];
      lower.ctx.globalAlpha = upper.opacity;
      lower.ctx.drawImage(upper.canvas, 0, 0);
      lower.ctx.globalAlpha = 1.0;
      this.layers.splice(this.activeLayerIdx, 1);
      this.activeLayerIdx--;
      this.updateLayerUI();
      this.updateLayerPreviews();
      this.render();
    }

    clearActiveLayer() {
      if (this.activeLayer.locked) return;
      this.activeLayer.clear();
      this.render();
      this.updateLayerPreviews();
    }

    updateLayerUI() {
      const container = this.dom.layerList;
      container.innerHTML = '';
      this.layers.forEach((layer, i) => {
        const item = document.createElement('div');
        item.className = `layer-item${i === this.activeLayerIdx ? ' active' : ''}`;
        item.dataset.layer = i;
        item.innerHTML = `
          <div class="layer-preview" id="layerPreview${i}"></div>
          <span class="layer-name">${layer.name}</span>
          <button class="layer-visibility" title="Toggle visibility">${layer.visible ? '👁' : '👁‍🗨'}</button>
        `;
        item.addEventListener('click', (e) => {
          if (e.target.classList.contains('layer-visibility')) {
            layer.visible = !layer.visible;
            this.updateLayerUI();
            this.render();
            return;
          }
          this.activeLayerIdx = i;
          this.updateLayerUI();
          this.render();
        });
        container.appendChild(item);
      });
      this.dom.layerOpacity.value = Math.round(this.activeLayer.opacity * 100);
      this.dom.layerOpacityValue.textContent = `${Math.round(this.activeLayer.opacity * 100)}%`;
    }

    updateUndoRedoUI() {
      $('#btnUndo').style.opacity = this.history.canUndo ? '1' : '0.4';
      $('#btnRedo').style.opacity = this.history.canRedo ? '1' : '0.4';
    }

    updateUI() {
      this.dom.canvasInfo.textContent = `${this.width} × ${this.height}`;
      this.dom.zoomLabel.textContent = `${Math.round((this.zoom / 8) * 100)}%`;
      this.dom.canvasW.value = this.width;
      this.dom.canvasH.value = this.height;
      this.updateUndoRedoUI();
    }

    bindEvents() {
      // Mouse
      this.viewport.addEventListener('mousedown', e => this.onMouseDown(e));
      window.addEventListener('mousemove', e => this.onMouseMove(e));
      window.addEventListener('mouseup', e => this.onMouseUp(e));
      this.viewport.addEventListener('wheel', e => this.onWheel(e), { passive: false });
      this.viewport.addEventListener('contextmenu', e => e.preventDefault());

      // Keyboard
      window.addEventListener('keydown', e => this.onKeyDown(e));

      // Colors
      this.dom.colorPicker.addEventListener('input', e => {
        this.foreColor = e.target.value;
        this.updateColorUI();
      });
      this.dom.bgColorPicker.addEventListener('input', e => {
        this.backColor = e.target.value;
        this.updateColorUI();
      });
      $('#btnSwapColors').addEventListener('click', () => {
        [this.foreColor, this.backColor] = [this.backColor, this.foreColor];
        this.updateColorUI();
      });
      $('#btnResetColors').addEventListener('click', () => {
        this.foreColor = '#000000';
        this.backColor = '#ffffff';
        this.updateColorUI();
      });

      // Tools
      $$('.tool-btn[data-tool]').forEach(btn => {
        btn.addEventListener('mousedown', e => {
          e.preventDefault();
          this.setTool(btn.dataset.tool);
        });
      });

      // Grid
      $('#btnGridToggle').addEventListener('click', () => {
        this.showGrid = !this.showGrid;
        this.render();
      });

      // Canvas size
      $('#btnResize').addEventListener('click', () => this.dom.resizeModal.style.display = 'flex');
      $('#btnCloseResize').addEventListener('click', () => this.dom.resizeModal.style.display = 'none');
      $('#btnCancelResize').addEventListener('click', () => this.dom.resizeModal.style.display = 'none');
      $('#btnCreateCanvas').addEventListener('click', () => {
        const w = Math.min(512, Math.max(1, parseInt($('#newCanvasWidth').value) || 32));
        const h = Math.min(512, Math.max(1, parseInt($('#newCanvasHeight').value) || 32));
        this.initCanvasSize(w, h);
        this.dom.resizeModal.style.display = 'none';
        this.updateUI();
        this.render();
      });

      // Layer controls
      $('#btnAddLayer').addEventListener('click', () => { this.saveState(); this.addLayer(); });
      $('#btnDelLayer').addEventListener('click', () => { this.saveState(); this.deleteLayer(); });
      $('#btnDupLayer').addEventListener('click', () => { this.saveState(); this.duplicateLayer(); });
      $('#btnMoveLayerUp').addEventListener('click', () => { this.saveState(); this.moveLayer(1); });
      $('#btnMoveLayerDown').addEventListener('click', () => { this.saveState(); this.moveLayer(-1); });
      $('#btnMergeDown').addEventListener('click', () => { this.saveState(); this.mergeDown(); });
      $('#btnClearLayer').addEventListener('click', () => { this.saveState(); this.clearActiveLayer(); });

      // Opacity
      this.dom.layerOpacity.addEventListener('input', e => {
        this.activeLayer.opacity = parseInt(e.target.value) / 100;
        this.dom.layerOpacityValue.textContent = `${e.target.value}%`;
        this.render();
      });

      // Onion skin
      this.dom.onionPrevSlider.addEventListener('input', e => {
        this.onionPrev = parseInt(e.target.value) / 100;
        this.dom.onionPrevValue.textContent = `${e.target.value}%`;
        this.render();
      });
      this.dom.onionNextSlider.addEventListener('input', e => {
        this.onionNext = parseInt(e.target.value) / 100;
        this.dom.onionNextValue.textContent = `${e.target.value}%`;
        this.render();
      });
      this.dom.onionShiftX.addEventListener('change', e => { this.onionShiftX = parseInt(e.target.value) || 0; this.render(); });
      this.dom.onionShiftY.addEventListener('change', e => { this.onionShiftY = parseInt(e.target.value) || 0; this.render(); });

      // Export
      $('#btnExport').addEventListener('click', () => this.openExportModal());
      $('#btnCloseExport').addEventListener('click', () => this.dom.exportModal.style.display = 'none');
      this.dom.exportFormat.addEventListener('change', () => {
        $('#qualityRow').style.display = ['jpeg', 'webp'].includes(this.dom.exportFormat.value) ? 'flex' : 'none';
        this.updateExportPreview();
      });
      this.dom.exportScale.addEventListener('input', () => this.updateExportPreview());
      this.dom.exportTransparent.addEventListener('change', () => this.updateExportPreview());
      this.dom.exportFlat.addEventListener('change', () => this.updateExportPreview());
      this.dom.exportQuality.addEventListener('input', e => {
        this.dom.exportQualityValue.textContent = `${e.target.value}%`;
        this.updateExportPreview();
      });
      $('#btnDownloadImage').addEventListener('click', () => this.downloadImage());
      $('#btnCopyImage').addEventListener('click', () => this.copyImage());

      // Undo/Redo
      $('#btnUndo').addEventListener('click', () => { this.undo(); this.updateUI(); });
      $('#btnRedo').addEventListener('click', () => { this.redo(); this.updateUI(); });
    }

    onMouseDown(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON') return;

      if (e.button === 1 || (e.button === 0 && (e.getModifierState('Space') || this.activeTool === 'move'))) {
        this.isPanning = true;
        this.panStart = { x: e.clientX, y: e.clientY, cx: this.canvasX, cy: this.canvasY };
        this.viewport.classList.add('panning');
        return;
      }

      const { px, py } = this.viewportToPixel(e);

      switch (this.activeTool) {
        case 'pencil':
        case 'eraser': {
          this.isDrawing = true;
          this.saveState();
          this.lastDrawCell = { px, py };
          this.activeTool === 'pencil' ? this.drawPixel(px, py) : this.erasePixel(px, py);
          break;
        }
        case 'eyedropper':
          this.pickColor(px, py);
          break;
        case 'fill':
          this.saveState();
          this.fillAt(px, py);
          break;
        case 'rect':
        case 'rect-fill':
        case 'circle':
        case 'circle-fill':
        case 'line': {
          this.isDrawing = true;
          this.saveState();
          this.shapeStart = { px, py };
          this.shapeSnapshot = this.activeLayer.getImageData();
          break;
        }
      }
    }

    onMouseMove(e) {
      const { px, py } = this.viewportToPixel(e);

      if (this.inBounds(px, py)) {
        this.dom.cursorPos.textContent = `X: ${px} Y: ${py}`;
      } else {
        this.dom.cursorPos.textContent = 'X: — Y: —';
      }

      if (this.isPanning) {
        this.canvasX = this.panStart.cx + (e.clientX - this.panStart.x);
        this.canvasY = this.panStart.cy + (e.clientY - this.panStart.y);
        this.applyCanvasTransform();
        return;
      }

      if (!this.isDrawing) return;
      if (!this.inBounds(px, py)) return;

      switch (this.activeTool) {
        case 'pencil':
          if (this.lastDrawCell && (this.lastDrawCell.px !== px || this.lastDrawCell.py !== py)) {
            this.lastDrawCell = { px, py };
            this.drawPixel(px, py);
          }
          break;
        case 'eraser':
          if (this.lastDrawCell && (this.lastDrawCell.px !== px || this.lastDrawCell.py !== py)) {
            this.lastDrawCell = { px, py };
            this.erasePixel(px, py);
          }
          break;
        case 'rect':
        case 'rect-fill':
        case 'circle':
        case 'circle-fill':
        case 'line':
          this.activeLayer.putImageData(this.shapeSnapshot);
          this.drawShape(this.shapeStart.px, this.shapeStart.py, px, py);
          break;
      }
    }

    onMouseUp(e) {
      if (this.isPanning) {
        this.isPanning = false;
        this.viewport.classList.remove('panning');
        return;
      }

      if (!this.isDrawing) return;
      this.isDrawing = false;

      const { px, py } = this.viewportToPixel(e);

      if (this.inBounds(px, py) && this.shapeStart) {
        this.activeLayer.putImageData(this.shapeSnapshot);
        this.drawShape(this.shapeStart.px, this.shapeStart.py, px, py);
      }

      this.lastDrawCell = null;
      this.shapeSnapshot = null;
      this.shapeStart = null;
      this.updateLayerPreviews();
    }

    onMouseMove(e) {
      const { px, py } = this.viewportToPixel(e);

      if (this.inBounds(px, py)) {
        this.dom.cursorPos.textContent = `X: ${px} Y: ${py}`;
      } else {
        this.dom.cursorPos.textContent = 'X: — Y: —';
      }

      if (this.isPanning) {
        this.canvasX = this.panStart.cx + (e.clientX - this.panStart.x);
        this.canvasY = this.panStart.cy + (e.clientY - this.panStart.y);
        this.applyCanvasTransform();
        return;
      }

      if (!this.isDrawing) return;

      if (!this.inBounds(px, py)) return;

      switch (this.activeTool) {
        case 'pencil':
          if (this.lastDrawCell && (this.lastDrawCell.px !== px || this.lastDrawCell.py !== py)) {
            this.lastDrawCell = { px, py };
            this.drawPixel(px, py);
          }
          break;
        case 'eraser':
          if (this.lastDrawCell && (this.lastDrawCell.px !== px || this.lastDrawCell.py !== py)) {
            this.lastDrawCell = { px, py };
            this.erasePixel(px, py);
          }
          break;
        case 'rect':
        case 'rect-fill':
        case 'circle':
        case 'circle-fill':
        case 'line':
          this.activeLayer.putImageData(this.shapeSnapshot);
          this.drawShape(this.shapeStart.px, this.shapeStart.py, px, py);
          break;
      }
    }

    onMouseUp(e) {
      if (this.isPanning) {
        this.isPanning = false;
        this.viewport.classList.remove('panning');
        return;
      }
      if (!this.isDrawing) return;
      this.isDrawing = false;
      this.lastDrawCell = null;
      this.shapeSnapshot = null;
      this.shapeStart = null;
      this.updateLayerPreviews();
    }

    onWheel(e) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -1 : 1;
      const newZoom = Math.min(32, Math.max(1, this.zoom + delta));
      if (newZoom === this.zoom) return;

      const viewportRect = this.viewport.getBoundingClientRect();
      const mouseX = e.clientX - viewportRect.left;
      const mouseY = e.clientY - viewportRect.top;
      const cx = viewportRect.width / 2;
      const cy = viewportRect.height / 2;
      const oldZoom = this.zoom;

      const px = (mouseX - cx - this.canvasX + (this.width * oldZoom) / 2) / oldZoom;
      const py = (mouseY - cy - this.canvasY + (this.height * oldZoom) / 2) / oldZoom;

      this.zoom = newZoom;
      this.canvas.width = this.width * this.zoom;
      this.canvas.height = this.height * this.zoom;

      this.canvasX = mouseX - cx + (this.width * newZoom) / 2 - px * newZoom;
      this.canvasY = mouseY - cy + (this.height * newZoom) / 2 - py * newZoom;

      this.applyCanvasTransform();
      this.render();
      this.updateUI();
    }

    onKeyDown(e) {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === 'z') { e.preventDefault(); if (e.shiftKey) this.redo(); else this.undo(); this.updateUI(); return; }
      if (ctrl && e.key === 'y') { e.preventDefault(); this.redo(); this.updateUI(); return; }
      if (ctrl && e.key === 's') { e.preventDefault(); return; }

      const keyMap = { b: 'pencil', e: 'eraser', g: 'fill', i: 'eyedropper', m: 'move', l: 'line', u: 'rect', o: 'circle' };
      if (!e.ctrlKey && !e.metaKey && keyMap[e.key]) {
        this.setTool(e.shiftKey && (e.key === 'u') ? 'rect-fill' : e.shiftKey && (e.key === 'o') ? 'circle-fill' : keyMap[e.key]);
      }
      if (!e.ctrlKey && !e.metaKey && e.key === 'X') {
        const t = this.foreColor; this.foreColor = this.backColor; this.backColor = t;
        this.updateColorUI();
      }
    }

    openExportModal() {
      this.dom.exportModal.style.display = 'flex';
      this.updateExportPreview();
    }

    updateExportPreview() {
      const scale = parseInt(this.dom.exportScale.value) || 1;
      const c = document.createElement('canvas');
      c.width = this.width * scale;
      c.height = this.height * scale;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      for (let i = 0; i < this.layers.length; i++) {
        const layer = this.layers[i];
        if (!layer.visible) continue;
        ctx.globalAlpha = layer.opacity;
        ctx.drawImage(layer.canvas, 0, 0, this.width * scale, this.height * scale);
      }
      ctx.globalAlpha = 1.0;
      this.dom.exportCanvas.width = this.width * scale;
      this.dom.exportCanvas.height = this.height * scale;
      const ectx = this.dom.exportCanvas.getContext('2d');
      ectx.imageSmoothingEnabled = false;
      ectx.drawImage(c, 0, 0);
      this.dom.exportDims.textContent = `${this.width * scale} × ${this.height * scale} px`;
    }

    getMimeType(fmt) {
      const map = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp', bmp: 'image/bmp' };
      return map[fmt] || 'image/png';
    }

    downloadImage() {
      const fmt = this.dom.exportFormat.value;
      const quality = parseInt(this.dom.exportQuality.value) / 100;
      const scale = parseInt(this.dom.exportScale.value) || 1;
      const flat = this.dom.exportFlat.checked;

      const c = document.createElement('canvas');
      c.width = this.width * scale;
      c.height = this.height * scale;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      if (flat) {
        for (let i = 0; i < this.layers.length; i++) {
          const layer = this.layers[i];
          if (!layer.visible) continue;
          ctx.globalAlpha = layer.opacity;
          ctx.drawImage(layer.canvas, 0, 0, this.width * scale, this.height * scale);
        }
        ctx.globalAlpha = 1.0;
      } else {
        ctx.drawImage(this.dom.exportCanvas, 0, 0);
      }

      const dataUrl = c.toDataURL(this.getMimeType(fmt), fmt === 'png' || fmt === 'bmp' ? undefined : quality);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `pixelpainter-${this.width}x${this.height}.${fmt}`;
      a.click();
    }

    async copyImage() {
      try {
        const blob = await new Promise(resolve => {
          const canvas = document.createElement('canvas');
          canvas.width = this.width;
          canvas.height = this.height;
          const ctx = canvas.getContext('2d');
          for (let i = 0; i < this.layers.length; i++) {
            const layer = this.layers[i];
            if (!layer.visible) continue;
            ctx.globalAlpha = layer.opacity;
            ctx.drawImage(layer.canvas, 0, 0);
          }
          ctx.globalAlpha = 1.0;
          canvas.toBlob(resolve, 'image/png');
        });
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      } catch (err) {
        console.error('Copy failed:', err);
      }
    }
  }

  // Start app
  window.addEventListener('DOMContentLoaded', () => {
    window.app = new PixelPainter();
  });
})();
