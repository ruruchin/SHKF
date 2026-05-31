window.renderDemo = function (demoType, hotkey) {
  const keys = hotkey || DEMO_KEYS[demoType] || 'Alt+B';
  const fn = DEMO_BUILDERS[demoType] || DEMO_BUILDERS['center-both'];
  return fn(keys);
};

const DEMO_KEYS = {
  'center-both': 'Alt+B',
  'center-x': 'Alt+X',
  'center-y': 'Alt+Y',
  'center-viewport': 'Alt+Shift+O',
  fill: 'Alt+F',
  'match-size': 'Alt+M',
  'distribute-h': 'Alt+Shift+J',
  'distribute-v': 'Alt+Shift+K',
  swap: 'Alt+Shift+W',
  'auto-layout': 'Alt+Shift+L',
  'desktop-frame': 'Alt+Shift+G',
  'mobile-frame': 'Alt+Shift+M',
  'tablet-frame': 'Alt+Shift+T',
  'create-button': 'Alt+Shift+B',
  'create-card': 'Alt+Shift+C',
  'create-input': 'Alt+Shift+I',
  'create-navbar': 'Alt+Shift+N',
  'create-hero': 'Alt+Shift+H',
  'create-features': 'Alt+Shift+F',
  'create-mega': 'Alt+Shift+P',
};

function shell(type, hotkey, canvasHtml, toast, opts = {}) {
  const frame = opts.frame || 'Card';
  const target = opts.target || 'Button';
  return `
<div class="fd fd--${type}">
  <div class="fd-chrome">
    <div class="fd-chrome-left">
      <div class="fd-dots"><span></span><span></span><span></span></div>
      <span class="fd-file">SHKF · Mobile UI</span>
    </div>
    <div class="fd-tabs">
      <span class="fd-tab fd-tab--active">Design</span>
      <span class="fd-tab">Prototype</span>
    </div>
    <div class="fd-chrome-right">
      <span class="fd-share">Share</span>
      <div class="fd-zoom fd-zoom--pulse">100%</div>
    </div>
  </div>
    <div class="fd-workspace">
    <div class="fd-layers">
      <div class="fd-panel-head">Layers</div>
      <div class="fd-layer fd-layer--page">📄 Page 1</div>
      <div class="fd-layer fd-layer--frame">▣ ${frame}</div>
      <div class="fd-layer fd-layer--group">◇ Content</div>
      <div class="fd-layer fd-layer--child fd-layer--target">▢ ${target}</div>
      <div class="fd-layer fd-layer--bg">▢ Background</div>
    </div>
    <div class="fd-canvas">
      <div class="fd-ruler fd-ruler--top"></div>
      <div class="fd-ruler fd-ruler--left"></div>
      <div class="fd-canvas-stage">
        <div class="fd-grid"></div>
        ${canvasHtml}
        <div class="fd-click-flash" aria-hidden="true"></div>
        <div class="fd-cursor" aria-hidden="true">
          <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
            <path d="M1 1L1 16.5L5.5 12.5L8.5 20L11 19L8 11.5L14 11L1 1Z" fill="#fff" stroke="#000" stroke-width="1.2"/>
          </svg>
        </div>
        <div class="fd-hotkey"><span class="fd-hotkey-keys">${escapeHotkey(hotkey)}</span></div>
        <div class="fd-toast">${toast || ''}</div>
        <div class="fd-float-bar" aria-hidden="true">
          <span class="fd-float-tool fd-float-tool--active" title="Move">↖</span>
          <span class="fd-float-sep"></span>
          <span class="fd-float-tool" title="Frame">▢</span>
          <span class="fd-float-tool" title="Rectangle">▭</span>
          <span class="fd-float-tool" title="Text">T</span>
          <span class="fd-float-tool" title="Pen">✎</span>
        </div>
      </div>
    </div>
    <div class="fd-props">
      <div class="fd-panel-head">Design</div>
      <div class="fd-prop-group">
        <div class="fd-prop-title">Layout</div>
        <div class="fd-prop-row"><span>X</span><span class="fd-prop-val fd-prop-x">88</span></div>
        <div class="fd-prop-row"><span>Y</span><span class="fd-prop-val fd-prop-y">60</span></div>
        <div class="fd-prop-row"><span>W</span><span class="fd-prop-val">52</span></div>
        <div class="fd-prop-row"><span>H</span><span class="fd-prop-val">36</span></div>
      </div>
      <div class="fd-prop-group fd-prop-group--fill">
        <div class="fd-prop-title">Fill</div>
        <div class="fd-prop-swatch-row">
          <span class="fd-prop-swatch"></span>
          <span class="fd-prop-hex">FF7262</span>
        </div>
      </div>
    </div>
  </div>
</div>`;
}

function escapeHotkey(str) {
  return String(str)
    .split('+')
    .map((k) => `<kbd>${k.trim()}</kbd>`)
    .join('<span class="fd-plus">+</span>');
}

function shape(cls, label) {
  return `
<div class="fd-shape ${cls}">
  ${label ? `<span class="fd-shape-label">${label}</span>` : ''}
  <span class="fd-shape-text">${label || ''}</span>
  <div class="fd-select"></div>
  <div class="fd-handle fd-h-tl"></div>
  <div class="fd-handle fd-h-tr"></div>
  <div class="fd-handle fd-h-bl"></div>
  <div class="fd-handle fd-h-br"></div>
  <div class="fd-dim fd-dim--w" aria-hidden="true">52</div>
  <div class="fd-dim fd-dim--h" aria-hidden="true">36</div>
</div>`;
}

function parentFrame(content, name) {
  return `
<div class="fd-parent">
  <span class="fd-parent-name">${name || 'Card'}</span>
  <div class="fd-parent-box">
    ${content}
    <div class="fd-guide fd-guide-v"></div>
    <div class="fd-guide fd-guide-h"></div>
    <span class="fd-dist-label fd-dist-label--x">32</span>
    <span class="fd-dist-label fd-dist-label--y">24</span>
  </div>
</div>`;
}

const DEMO_BUILDERS = {
  'center-both': (hotkey) =>
    shell(
      'center-both',
      hotkey,
      parentFrame(shape('fd-shape--move-both', 'Button'), 'Card'),
      'Центр в родителе',
      { frame: 'Card', target: 'Button' }
    ),

  'center-x': (hotkey) =>
    shell(
      'center-x',
      hotkey,
      parentFrame(
        shape('fd-shape--move-x', 'Button') + '<div class="fd-axis fd-axis--x"></div>',
        'Card'
      ),
      'Центр по X',
      { frame: 'Card', target: 'Button' }
    ),

  'center-y': (hotkey) =>
    shell(
      'center-y',
      hotkey,
      parentFrame(
        shape('fd-shape--move-y', 'Button') + '<div class="fd-axis fd-axis--y"></div>',
        'Card'
      ),
      'Центр по Y',
      { frame: 'Card', target: 'Button' }
    ),

  'center-viewport': (hotkey) =>
    shell(
      'center-viewport',
      hotkey,
      `
<div class="fd-viewport-zone">
  <div class="fd-vp-crosshair"></div>
  ${shape('fd-shape--move-vp', 'Icon')}
</div>`,
      'Центр на экране',
      { frame: 'Screen', target: 'Icon' }
    ),

  fill: (hotkey) =>
    shell(
      'fill',
      hotkey,
      parentFrame(shape('fd-shape--fill', 'Background'), 'Modal'),
      'Заполнить фрейм',
      { frame: 'Modal', target: 'Background' }
    ),

  'match-size': (hotkey) =>
    shell(
      'match-size',
      hotkey,
      parentFrame(shape('fd-shape--match', 'Placeholder'), 'Card'),
      'Размер как у родителя',
      { frame: 'Card', target: 'Placeholder' }
    ),

  'distribute-h': (hotkey) =>
    shell(
      'distribute-h',
      hotkey,
      parentFrame(
        `<div class="fd-shape fd-shape--d1 fd-shape--chip">A</div>
         <div class="fd-shape fd-shape--d2 fd-shape--chip">B</div>
         <div class="fd-shape fd-shape--d3 fd-shape--chip">C</div>
         <div class="fd-dist-line fd-dist-line--h"></div>
         <span class="fd-dist-label fd-dist-label--gap-h">24</span>`,
        'Row'
      ),
      'Распределить H',
      { frame: 'Row', target: 'Chip A' }
    ),

  'distribute-v': (hotkey) =>
    shell(
      'distribute-v',
      hotkey,
      parentFrame(
        `<div class="fd-shape fd-shape--dv1 fd-shape--chip">A</div>
         <div class="fd-shape fd-shape--dv2 fd-shape--chip">B</div>
         <div class="fd-shape fd-shape--dv3 fd-shape--chip">C</div>
         <div class="fd-dist-line fd-dist-line--v"></div>
         <span class="fd-dist-label fd-dist-label--gap-v">16</span>`,
        'Stack'
      ),
      'Распределить V',
      { frame: 'Stack', target: 'Chip A' }
    ),

  swap: (hotkey) =>
    shell(
      'swap',
      hotkey,
      `
<div class="fd-swap-stage">
  ${shape('fd-shape--swap', 'Shape')}
  <div class="fd-inspector">
    <div class="fd-insp-row fd-insp-fill"><span class="fd-swatch fd-swatch--fill"></span> Fill</div>
    <div class="fd-insp-row fd-insp-stroke"><span class="fd-swatch fd-swatch--stroke"></span> Stroke</div>
  </div>
</div>`,
      'Fill ↔ Stroke',
      { frame: 'Shape', target: 'Rectangle' }
    ),

  'auto-layout': (hotkey) =>
    shell(
      'auto-layout',
      hotkey,
      `
<div class="fd-parent">
  <span class="fd-parent-name">Frame → Auto Layout</span>
  <div class="fd-parent-box fd-al-box">
    <div class="fd-al-badge">⬍ Auto</div>
    <div class="fd-shape fd-shape--al1 fd-shape--chip">Item</div>
    <div class="fd-shape fd-shape--al2 fd-shape--chip">Item</div>
    <div class="fd-shape fd-shape--al3 fd-shape--chip">Item</div>
    <div class="fd-al-padding"></div>
  </div>
</div>`,
      'Auto Layout',
      { frame: 'List', target: 'Item 1' }
    ),

  'desktop-frame': (hotkey) =>
    shell(
      'desktop-frame',
      hotkey,
      `
<div class="fd-parent fd-parent--desktop">
  <span class="fd-parent-name">Desktop 1920×1080</span>
  <div class="fd-parent-box fd-desktop-box">
    <div class="fd-desktop-grid"></div>
    <span class="fd-desktop-size">1920 × 1080</span>
  </div>
</div>`,
      'Desktop · 12 col',
      { frame: 'Desktop 1920×1080', target: 'Artboard' }
    ),

  'mobile-frame': (hotkey) =>
    shell(
      'mobile-frame',
      hotkey,
      `
<div class="fd-create-stage">
  <div class="fd-device fd-device--mobile">
    <div class="fd-device-status" aria-hidden="true"></div>
    <span class="fd-device-size">390 × 844</span>
  </div>
</div>`,
      'Mobile · 390×844',
      { frame: 'Mobile 390×844', target: 'Frame' }
    ),

  'tablet-frame': (hotkey) =>
    shell(
      'tablet-frame',
      hotkey,
      `
<div class="fd-create-stage">
  <div class="fd-device fd-device--tablet">
    <span class="fd-device-size">834 × 1194</span>
  </div>
</div>`,
      'Tablet · 834×1194',
      { frame: 'Tablet 834×1194', target: 'Frame' }
    ),

  'create-button': (hotkey) =>
    shell(
      'create-button',
      hotkey,
      `
<div class="fd-comp-stage">
  <div class="fd-ui-btn"><span>Добавить</span></div>
</div>`,
      'Primary button',
      { frame: 'Page', target: 'Button' }
    ),

  'create-card': (hotkey) =>
    shell(
      'create-card',
      hotkey,
      `
<div class="fd-comp-stage">
  <div class="fd-ui-card">
    <div class="fd-ui-card-title">Заголовок</div>
    <div class="fd-ui-card-desc">Краткое описание карточки</div>
  </div>
</div>`,
      'Card · 16px radius',
      { frame: 'Section', target: 'Card' }
    ),

  'create-input': (hotkey) =>
    shell(
      'create-input',
      hotkey,
      `
<div class="fd-comp-stage">
  <div class="fd-ui-field">
    <span class="fd-ui-label">Email</span>
    <div class="fd-ui-input"><span>you@email.com</span></div>
  </div>
</div>`,
      'Label + input',
      { frame: 'Form', target: 'Email field' }
    ),

  'create-navbar': (hotkey) =>
    shell(
      'create-navbar',
      hotkey,
      `
<div class="fd-comp-stage fd-comp-stage--wide">
  <div class="fd-ui-nav">
    <span class="fd-ui-nav-logo">SHKF</span>
    <span class="fd-ui-nav-link">Home</span>
    <span class="fd-ui-nav-link">About</span>
    <span class="fd-ui-nav-cta">Start</span>
  </div>
</div>`,
      'Navbar + CTA',
      { frame: 'Page', target: 'Navbar' }
    ),

  'create-hero': (hotkey) =>
    shell(
      'create-hero',
      hotkey,
      `
<div class="fd-comp-stage fd-comp-stage--hero">
  <div class="fd-ui-hero">
    <div class="fd-ui-hero-title">Build faster</div>
    <div class="fd-ui-hero-sub">Studio UI за одно нажатие</div>
    <div class="fd-ui-hero-actions">
      <span class="fd-ui-btn fd-ui-btn--sm">Начать</span>
      <span class="fd-ui-btn fd-ui-btn--ghost fd-ui-btn--sm">Подробнее</span>
    </div>
  </div>
</div>`,
      'Hero section',
      { frame: 'Page', target: 'Hero' }
    ),

  'create-features': (hotkey) =>
    shell(
      'create-features',
      hotkey,
      `
<div class="fd-comp-stage fd-comp-stage--wide">
  <div class="fd-ui-features">
    <div class="fd-ui-feat"><span class="fd-ui-feat-icon">⚡</span><span>Speed</span></div>
    <div class="fd-ui-feat"><span class="fd-ui-feat-icon">◆</span><span>Design</span></div>
    <div class="fd-ui-feat"><span class="fd-ui-feat-icon">✦</span><span>Flow</span></div>
  </div>
</div>`,
      '3 feature cards',
      { frame: 'Section', target: 'Features' }
    ),

  'create-mega': (hotkey) =>
    shell(
      'create-mega',
      hotkey,
      `
<div class="fd-mega-stage">
  <div class="fd-mega-device fd-mega-device--d">
    <span class="fd-mega-label">1440</span>
    <div class="fd-mega-wire"><span></span><span></span><span></span></div>
  </div>
  <div class="fd-mega-device fd-mega-device--t">
    <span class="fd-mega-label">834</span>
    <div class="fd-mega-wire"><span></span><span></span></div>
  </div>
  <div class="fd-mega-device fd-mega-device--m">
    <span class="fd-mega-label">390</span>
    <div class="fd-mega-wire"><span></span><span></span><span></span><span></span></div>
  </div>
</div>`,
      'Desktop + Tablet + Mobile',
      { frame: 'Landing', target: 'Breakpoints' }
    ),
};
