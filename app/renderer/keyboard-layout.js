/** Physical keyboard layout — key `code` values match node-global-key-listener `name` fields. */
window.KB_LAYOUT = {
  unit: 40,
  gap: 5,

  main: [
    [
      { code: 'ESCAPE', label: 'Esc', w: 1.25 },
      { gap: 0.4 },
      { code: 'F1', label: 'F1' }, { code: 'F2', label: 'F2' }, { code: 'F3', label: 'F3' },
      { code: 'F4', label: 'F4' }, { gap: 0.2 },
      { code: 'F5', label: 'F5' }, { code: 'F6', label: 'F6' }, { code: 'F7', label: 'F7' },
      { code: 'F8', label: 'F8' }, { gap: 0.2 },
      { code: 'F9', label: 'F9' }, { code: 'F10', label: 'F10' }, { code: 'F11', label: 'F11' },
      { code: 'F12', label: 'F12' },
    ],
    [
      { code: 'BACKTICK', label: '`' },
      { code: '1', label: '1' }, { code: '2', label: '2' }, { code: '3', label: '3' },
      { code: '4', label: '4' }, { code: '5', label: '5' }, { code: '6', label: '6' },
      { code: '7', label: '7' }, { code: '8', label: '8' }, { code: '9', label: '9' },
      { code: '0', label: '0' }, { code: 'MINUS', label: '-' }, { code: 'EQUALS', label: '=' },
      { code: 'BACKSPACE', label: '⌫', w: 1.9 },
    ],
    [
      { code: 'TAB', label: 'Tab', w: 1.45 },
      { code: 'Q', label: 'Q' }, { code: 'W', label: 'W' }, { code: 'E', label: 'E' },
      { code: 'R', label: 'R' }, { code: 'T', label: 'T' }, { code: 'Y', label: 'Y' },
      { code: 'U', label: 'U' }, { code: 'I', label: 'I' }, { code: 'O', label: 'O' },
      { code: 'P', label: 'P' },
      { code: 'SQUARE BRACKET OPEN', label: '[', altCodes: ['['] },
      { code: 'SQUARE BRACKET CLOSE', label: ']', altCodes: [']'] },
      { code: 'BACKSLASH', label: '\\', w: 1.45, altCodes: ['\\'] },
    ],
    [
      { code: 'CAPS LOCK', label: 'Caps', w: 1.75 },
      { code: 'A', label: 'A' }, { code: 'S', label: 'S' }, { code: 'D', label: 'D' },
      { code: 'F', label: 'F' }, { code: 'G', label: 'G' }, { code: 'H', label: 'H' },
      { code: 'J', label: 'J' }, { code: 'K', label: 'K' }, { code: 'L', label: 'L' },
      { code: 'SEMICOLON', label: ';', altCodes: [';'] },
      { code: 'QUOTE', label: "'", altCodes: ["'"] },
      { code: 'RETURN', label: 'Enter', w: 2.05 },
    ],
    [
      { code: 'LEFT SHIFT', label: 'Shift', w: 2.25, modifier: 'shift' },
      { code: 'Z', label: 'Z' }, { code: 'X', label: 'X' }, { code: 'C', label: 'C' },
      { code: 'V', label: 'V' }, { code: 'B', label: 'B' }, { code: 'N', label: 'N' },
      { code: 'M', label: 'M' },
      { code: 'COMMA', label: ',', altCodes: [','] },
      { code: 'DOT', label: '.', altCodes: ['.'] },
      { code: 'FORWARD SLASH', label: '/', altCodes: ['/'] },
      { code: 'RIGHT SHIFT', label: 'Shift', w: 2.75, modifier: 'shift' },
    ],
    [
      { code: 'LEFT CTRL', label: 'Ctrl', w: 1.3, modifier: 'ctrl' },
      { code: 'LEFT META', label: 'Win', w: 1.2 },
      { code: 'LEFT ALT', label: 'Alt', w: 1.3, modifier: 'alt' },
      { code: 'SPACE', label: '', w: 6.2 },
      { code: 'RIGHT ALT', label: 'Alt', w: 1.3, modifier: 'alt' },
      { code: 'RIGHT META', label: 'Win', w: 1.2 },
      { code: 'RIGHT CTRL', label: 'Ctrl', w: 1.3, modifier: 'ctrl' },
    ],
  ],

  nav: [
    [
      { code: 'SNAPSHOT', label: 'PrtSc', altCodes: ['PRINT SCREEN'] },
      { code: 'SCROLL', label: 'ScrLk', altCodes: ['SCROLL LOCK'] },
      { code: 'PAUSE', label: 'Pause' },
    ],
    [
      { code: 'INSERT', label: 'Ins', altCodes: ['INS'] },
      { code: 'HOME', label: 'Home' },
      { code: 'PRIOR', label: 'PgUp', altCodes: ['PAGE UP'] },
    ],
    [
      { code: 'DELETE', label: 'Del' },
      { code: 'END', label: 'End' },
      { code: 'NEXT', label: 'PgDn', altCodes: ['PAGE DOWN'] },
    ],
  ],

  navArrows: [
    null,
    { code: 'UP', label: '↑', altCodes: ['UP ARROW'] },
    null,
    { code: 'LEFT', label: '←', altCodes: ['LEFT ARROW'] },
    { code: 'DOWN', label: '↓', altCodes: ['DOWN ARROW'] },
    { code: 'RIGHT', label: '→', altCodes: ['RIGHT ARROW'] },
  ],

  numpad: [
    { code: 'NUMLOCK', label: 'Num', col: 0, row: 0, altCodes: ['NUM LOCK'] },
    { code: 'DIVIDE', label: '/', col: 1, row: 0 },
    { code: 'MULTIPLY', label: '*', col: 2, row: 0 },
    { code: 'SUBTRACT', label: '-', col: 3, row: 0 },

    { code: 'NUMPAD7', label: '7', col: 0, row: 1, altCodes: ['NUMPAD 7'] },
    { code: 'NUMPAD8', label: '8', col: 1, row: 1, altCodes: ['NUMPAD 8'] },
    { code: 'NUMPAD9', label: '9', col: 2, row: 1, altCodes: ['NUMPAD 9'] },
    { code: 'ADD', label: '+', col: 3, row: 1, rowSpan: 2, altCodes: ['NUMPAD PLUS'] },

    { code: 'NUMPAD4', label: '4', col: 0, row: 2, altCodes: ['NUMPAD 4'] },
    { code: 'NUMPAD5', label: '5', col: 1, row: 2, altCodes: ['NUMPAD 5'] },
    { code: 'NUMPAD6', label: '6', col: 2, row: 2, altCodes: ['NUMPAD 6'] },

    { code: 'NUMPAD1', label: '1', col: 0, row: 3, altCodes: ['NUMPAD 1'] },
    { code: 'NUMPAD2', label: '2', col: 1, row: 3, altCodes: ['NUMPAD 2'] },
    { code: 'NUMPAD3', label: '3', col: 2, row: 3, altCodes: ['NUMPAD 3'] },
    { code: 'RETURN', label: 'Ent', col: 3, row: 3, rowSpan: 2 },

    { code: 'NUMPAD0', label: '0', col: 0, row: 4, colSpan: 2, altCodes: ['NUMPAD 0'] },
    { code: 'DECIMAL', label: '.', col: 2, row: 4, altCodes: ['NUMPAD DOT'] },
  ],
};

window.KB_MODIFIER_CODES = {
  ctrl: ['LEFT CTRL', 'RIGHT CTRL'],
  alt: ['LEFT ALT', 'RIGHT ALT'],
  shift: ['LEFT SHIFT', 'RIGHT SHIFT'],
};
