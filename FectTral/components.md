# FectTral Component Library

Quick-reference for all UI components in the FectTral design system.

---

## Buttons

### Primary CTA Button
```html
<button class="btn-primary">INITIALIZE</button>
```
```css
.btn-primary {
  font-family: var(--font-display);
  font-size: 0.7rem;
  letter-spacing: 0.15em;
  padding: 10px 24px;
  background: rgba(0,150,255,0.1);
  border: 1px solid var(--blue-core);
  color: var(--blue-bright);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}
.btn-primary:hover {
  background: rgba(0,170,255,0.2);
  box-shadow: var(--glow-md);
  transform: translateY(-1px);
}
```

### Ghost Button
```html
<button class="btn-ghost">CANCEL</button>
```
```css
.btn-ghost {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  padding: 8px 18px;
  background: transparent;
  border: 1px solid var(--border-mid);
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}
.btn-ghost:hover { border-color: var(--blue-dim); color: var(--text-secondary); }
```

---

## Status Badges

```html
<span class="badge badge-active">ONLINE</span>
<span class="badge badge-warn">WARNING</span>
<span class="badge badge-error">CRITICAL</span>
```
```css
.badge {
  font-family: var(--font-mono);
  font-size: 0.55rem;
  letter-spacing: 0.1em;
  padding: 3px 7px;
  border-radius: 3px;
  text-transform: uppercase;
}
.badge-active { background: rgba(0,200,100,0.12); color: #00cc66; border: 1px solid rgba(0,200,100,0.3); }
.badge-warn   { background: rgba(255,160,0,0.12);  color: #ffaa00; border: 1px solid rgba(255,160,0,0.3); }
.badge-error  { background: rgba(255,40,60,0.12);  color: #ff2244; border: 1px solid rgba(255,40,60,0.3); }
```

---

## Progress / Meter Bar

```html
<div class="meter-bar">
  <div class="meter-fill" style="width: 68%"></div>
</div>
```
```css
.meter-bar {
  height: 3px;
  background: rgba(0,100,200,0.15);
  border-radius: 2px;
  overflow: hidden;
}
.meter-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--blue-electric), var(--blue-bright));
  box-shadow: 0 0 6px var(--blue-core);
  border-radius: 2px;
  transition: width 0.5s ease;
}
```

---

## Data Table

```css
.cyber-table { width: 100%; border-collapse: collapse; }
.cyber-table th {
  font-family: var(--font-mono);
  font-size: 0.55rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-dim);
  text-align: left;
}
.cyber-table td {
  font-size: 0.8rem;
  color: var(--text-secondary);
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-dim);
}
.cyber-table tr:hover td { background: rgba(0,130,255,0.04); color: var(--text-primary); }
```

---

## Input Field

```html
<div class="input-group">
  <label class="input-label">QUERY</label>
  <input type="text" class="cyber-input" placeholder="enter command...">
</div>
```
```css
.input-label {
  font-family: var(--font-mono);
  font-size: 0.55rem;
  color: var(--text-muted);
  letter-spacing: 0.12em;
  display: block;
  margin-bottom: 5px;
}
.cyber-input {
  width: 100%;
  background: rgba(0,30,80,0.4);
  border: 1px solid var(--border-mid);
  border-radius: 4px;
  padding: 9px 12px;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-primary);
  outline: none;
  transition: all 0.2s;
}
.cyber-input:focus {
  border-color: var(--blue-core);
  box-shadow: var(--glow-sm);
  background: rgba(0,50,120,0.15);
}
.cyber-input::placeholder { color: var(--text-muted); }
```

---

## Tooltip (on nav items)

```html
<a class="nav-item has-tip" href="#">
  <span class="nav-icon">◈</span><span>Dashboard</span>
  <div class="tip">Main overview</div>
</a>
```
```css
.has-tip { position: relative; }
.tip {
  position: absolute;
  left: calc(100% + 8px); top: 50%;
  transform: translateY(-50%);
  background: var(--bg-card);
  border: 1px solid var(--border-mid);
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 0.6rem;
  padding: 4px 9px;
  border-radius: 4px;
  white-space: nowrap;
  opacity: 0; pointer-events: none;
  transition: opacity 0.15s;
  z-index: 100;
}
.has-tip:hover .tip { opacity: 1; }
```

---

## Hex Icon / Symbol Display

```html
<div class="hex-display">⬡</div>
```
```css
.hex-display {
  font-size: 2.5rem;
  color: var(--blue-core);
  text-shadow: var(--glow-md);
  animation: hexPulse 3s ease-in-out infinite;
}
@keyframes hexPulse {
  0%, 100% { text-shadow: var(--glow-md); }
  50% { text-shadow: 0 0 30px rgba(0,212,255,0.9), 0 0 60px rgba(0,150,255,0.4); }
}
```

---

## AI Provider Card (sidebar footer)

```html
<div class="provider-card">
  <div class="prov-top">
    <span class="prov-label">AI Provider</span>
    <div class="prov-status"><span class="dot"></span><span>Online</span></div>
  </div>
  <div class="prov-name">OLLAMA LOCAL</div>
  <div class="prov-model">qwen2.5-coder:14b · 10GB</div>
</div>
```
```css
.provider-card {
  margin: 8px 10px;
  padding: 10px 12px;
  background: rgba(0,100,200,0.06);
  border: 1px solid var(--border-mid);
  border-radius: 6px;
}
.prov-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.prov-label { font-family: var(--font-mono); font-size: 0.55rem; color: var(--text-muted); letter-spacing: 0.1em; text-transform: uppercase; }
.prov-status { display: flex; align-items: center; gap: 4px; font-family: var(--font-mono); font-size: 0.55rem; color: #00cc66; }
.prov-status .dot { width: 5px; height: 5px; background: #00cc66; border-radius: 50%; animation: pulseDot 2s ease-in-out infinite; }
.prov-name { font-family: var(--font-display); font-size: 0.72rem; font-weight: 600; color: var(--blue-bright); letter-spacing: 0.08em; }
.prov-model { font-family: var(--font-mono); font-size: 0.58rem; color: var(--text-muted); margin-top: 2px; }
```
