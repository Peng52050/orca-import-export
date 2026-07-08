function getDisplayText(f) {
  const anyF = f;
  if (typeof anyF.text === "string" && anyF.text) return anyF.text;
  if (Array.isArray(f.children) && f.children.length > 0) {
    return f.children.map((c) => String(c.v ?? "")).join("");
  }
  return String(f.v ?? "");
}
function renderFrags(frags, config) {
  return frags.map((f) => {
    var _a;
    const text = String(f.v ?? "");
    switch (f.t) {
      case "bc":
        return config.bg(f.color || "yellow", text);
      case "fc":
        return config.fg(f.color || "red", text);
      case "h":
        return config.cloze(text);
      case "b":
        return config.bold(text, f.fa || {});
      case "a":
        return config.anchor(text, getDisplayText(f), !!((_a = f.fa) == null ? void 0 : _a.img));
      default:
        return config.plain(text);
    }
  }).join("");
}
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function escapeXmlAttr(s) {
  return escapeHtml(s);
}
function escapeHtmlKeepMarkdownImages(text) {
  const images = [];
  let s = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, url) => {
    images.push(`![${alt}](${url})`);
    return `\0IMG${images.length - 1}\0`;
  });
  s = escapeHtml(s);
  s = s.replace(/\x00IMG(\d+)\x00/g, (_m, i) => images[+i]);
  return s;
}
function renderBoldHtml(text, fa) {
  let result = text;
  if (fa.strikethrough) result = `<del>${result}</del>`;
  if (fa.italic) result = `<em>${result}</em>`;
  if (fa.bold) result = `<strong>${result}</strong>`;
  return result;
}
function renderBoldMarkdown(text, fa) {
  let result = text;
  if (fa.strikethrough) result = `~~${result}~~`;
  if (fa.italic) result = `*${result}*`;
  if (fa.bold) result = `**${result}**`;
  return result;
}
function renderBoldWord(text, fa) {
  let result = text;
  if (fa.strikethrough) result = `<strike>${result}</strike>`;
  if (fa.italic) result = `<i>${result}</i>`;
  if (fa.bold) result = `<b>${result}</b>`;
  return result;
}
function getBgHex(color) {
  const bg = HL_COLORS.bg;
  return bg[color] || color || bg.yellow;
}
function getFgHex(color) {
  const fg = HL_COLORS.fg;
  const fgFallback = HL_COLORS.fgFallback;
  return fg[color] || fgFallback[color] || color || fg.red;
}
function isNamedColor(color, type) {
  const palette = type === "bg" ? HL_COLORS.bg : HL_COLORS.fg;
  return color in palette;
}
function getContrastTextColor(color) {
  return color === "red" || color === "blue" ? "#fff" : "#000";
}
function makeHtmlConfig(opts) {
  return {
    name: opts.name,
    bg(color, text) {
      const hex = getBgHex(color);
      return opts.bgTpl(hex, getContrastTextColor(color), opts.escapeText(text));
    },
    fg(color, text) {
      const hex = getFgHex(color);
      return opts.fgTpl(hex, opts.escapeText(text));
    },
    cloze(text) {
      return opts.clozeTpl(opts.escapeText(text));
    },
    bold(text, fa) {
      return opts.boldRenderer(opts.escapeText(text), fa);
    },
    anchor(url, text, isImage) {
      return opts.anchorTpl(escapeXmlAttr(decodeURI(url)), text, isImage);
    },
    plain(text) {
      return opts.escapeText(text);
    }
  };
}
const LOGSEQ_CONFIG = {
  name: "logseq",
  bg(color, text) {
    if (isNamedColor(color, "bg") && color !== "yellow") {
      return `[[#${color}]]==${text}==`;
    }
    return `<span style="background:${getBgHex(color)}">${text}</span>`;
  },
  fg(color, text) {
    if (isNamedColor(color, "fg")) {
      return `[[$${color}]]==${text}==`;
    }
    return `<font color="${getFgHex(color)}">${text}</font>`;
  },
  cloze(text) {
    return `[[#cloze]]==${text}==`;
  },
  bold(text, fa) {
    return renderBoldMarkdown(text, fa);
  },
  anchor(url, text, isImage) {
    if (isImage) return `![${text}](${url})`;
    return `[${text}](${url})`;
  },
  plain(text) {
    return text;
  }
};
const OBSIDIAN_CONFIG = {
  name: "obsidian",
  bg(color, text) {
    return `<span style="background:${getBgHex(color)}">${text}</span>`;
  },
  fg(color, text) {
    return `<font color="${getFgHex(color)}">${text}</font>`;
  },
  cloze(text) {
    return `==${text}==`;
  },
  bold(text, fa) {
    return renderBoldMarkdown(text, fa);
  },
  anchor(url, text, isImage) {
    if (isImage) return `![${text}](${url})`;
    return `[${text}](${url})`;
  },
  plain(text) {
    return text;
  }
};
const ORCA_HTML_CONFIG = {
  name: "orca",
  bg(color, text) {
    if (isNamedColor(color, "bg")) {
      return `<span class="orca-inline bc bcc-${color}" data-type="t">${text}</span>`;
    }
    return `<span style="background:${getBgHex(color)}" class="orca-inline" data-type="t">${text}</span>`;
  },
  fg(color, text) {
    if (isNamedColor(color, "fg")) {
      return `<span class="orca-inline fc fcc-${color}" data-type="t">${text}</span>`;
    }
    return `<span style="color:${getFgHex(color)};font-weight:600;" class="orca-inline" data-type="t">${text}</span>`;
  },
  cloze(text) {
    return `<span class="orca-inline h" data-type="t">${text}</span>`;
  },
  bold(text, fa) {
    return renderBoldHtml(text, fa);
  },
  anchor(url, text, isImage) {
    const safeUrl = escapeXmlAttr(decodeURI(url));
    const safeText = escapeHtml(text);
    if (isImage) return `<img src="${safeUrl}" alt="${safeText}" />`;
    return `<a href="${safeUrl}">${safeText}</a>`;
  },
  plain(text) {
    return escapeHtml(text);
  }
};
const SIYUAN_BG_VAR = { red: 1, blue: 6, green: 4, yellow: 3 };
const SIYUAN_FG_VAR = { red: 1, blue: 6, green: 4, yellow: 3 };
const SIYUAN_CONFIG = {
  name: "siyuan",
  bg(color, text) {
    const idx = SIYUAN_BG_VAR[color];
    if (idx) {
      return `<span data-type="backgroundColor" style="background-color: var(--b3-font-background${idx});">${text}</span>`;
    }
    return `<span data-type="backgroundColor" style="background-color: ${getBgHex(color)};">${text}</span>`;
  },
  fg(color, text) {
    const idx = SIYUAN_FG_VAR[color];
    if (idx) {
      return `<span data-type="color" style="color: var(--b3-font-color${idx});">${text}</span>`;
    }
    return `<span data-type="color" style="color: ${getFgHex(color)};">${text}</span>`;
  },
  cloze(text) {
    return `==${text}==`;
  },
  bold(text, fa) {
    return renderBoldMarkdown(text, fa);
  },
  anchor(url, text, isImage) {
    if (isImage) return `![${text}](${url})`;
    return `[${text}](${url})`;
  },
  plain(text) {
    return text;
  }
};
const MARKDOWN_CONFIG = {
  name: "markdown",
  bg(color, text) {
    const hex = getBgHex(color);
    const contrast = getContrastTextColor(color);
    return `<mark style="background:${hex};color:${contrast};padding:0 2px;border-radius:2px;">${text}</mark>`;
  },
  fg(color, text) {
    return `<span style="color:${getFgHex(color)};font-weight:600;">${text}</span>`;
  },
  cloze(text) {
    return `==${text}==`;
  },
  bold(text, fa) {
    return renderBoldMarkdown(text, fa);
  },
  anchor(url, text, isImage) {
    if (isImage) return `![${text}](${url})`;
    return `[${text}](${url})`;
  },
  plain(text) {
    return text;
  }
};
const BASIC_HTML_CONFIG = makeHtmlConfig({
  name: "basic-html",
  bgTpl: (hex, contrast, text) => `<mark style="background:${hex} !important;color:${contrast} !important;padding:0 2px !important;border-radius:2px !important;">${text}</mark>`,
  fgTpl: (hex, text) => `<span style="color:${hex} !important;font-weight:600 !important;">${text}</span>`,
  clozeTpl: (text) => `<mark style="background:#ffeb3b !important;color:#000 !important;padding:0 2px !important;border-radius:2px !important;">${text}</mark>`,
  boldRenderer: renderBoldHtml,
  anchorTpl: (url, text, isImage) => {
    const safeText = escapeHtml(text);
    if (isImage) return `<img src="${url}" alt="${safeText}" style="max-width:100%;height:auto;" />`;
    return `<a href="${url}">${safeText}</a>`;
  },
  escapeText: escapeHtmlKeepMarkdownImages
});
const STANDARD_HTML_CONFIG = makeHtmlConfig({
  name: "standard-html",
  bgTpl: (hex, contrast, text) => `<mark style="background:${hex};color:${contrast};padding:0 2px;border-radius:2px;">${text}</mark>`,
  fgTpl: (hex, text) => `<span style="color:${hex};font-weight:600;">${text}</span>`,
  clozeTpl: (text) => `<span class="cloze" style="background:#ffeb3b;color:#000;padding:0 2px;border-radius:2px;">${text}</span>`,
  boldRenderer: renderBoldHtml,
  anchorTpl: (url, text, isImage) => {
    const safeText = escapeHtml(text);
    if (isImage) return `<img src="${url}" alt="${safeText}" style="max-width:100%;height:auto;" />`;
    return `<a href="${url}">${safeText}</a>`;
  },
  escapeText: escapeHtmlKeepMarkdownImages
});
const MSO_HIGHLIGHT = {
  yellow: "yellow",
  green: "green",
  red: "red",
  // blue (#fdbfff 浅紫) 在 Word 中映射为 magenta
  blue: "magenta"
};
const WORD_HTML_CONFIG = {
  name: "word",
  bg(color, text) {
    const hex = getBgHex(color);
    const msoColor = MSO_HIGHLIGHT[color] || "yellow";
    const contrast = getContrastTextColor(color);
    return `<span style="background:${hex};mso-highlight:${msoColor};color:${contrast};padding:0 2px;">${escapeHtml(text)}</span>`;
  },
  fg(color, text) {
    return `<font color="${getFgHex(color)}">${escapeHtml(text)}</font>`;
  },
  cloze(text) {
    return `<span style="background:#ffeb3b;color:black;padding:0 2px;">${escapeHtml(text)}</span>`;
  },
  bold(text, fa) {
    return renderBoldWord(text, fa);
  },
  anchor(url, text, isImage) {
    const safeUrl = escapeXmlAttr(decodeURI(url));
    const safeText = escapeHtml(text);
    if (isImage) return `<img src="${safeUrl}" alt="${safeText}" style="max-width:100%;height:auto;" />`;
    return `<a href="${safeUrl}">${safeText}</a>`;
  },
  plain(text) {
    return escapeHtml(text);
  }
};
const PREVIEW_HTML_CONFIG = {
  name: "preview",
  bg(color, text) {
    const hex = getBgHex(color);
    return `<mark style="background:${hex};border-radius:2px;padding:0 2px;">${escapeHtml(text)}</mark>`;
  },
  fg(color, text) {
    const hex = getFgHex(color);
    return `<span style="color:${hex};font-weight:600;">${escapeHtml(text)}</span>`;
  },
  cloze(text) {
    return `<mark style="background:#ffeb3b;border-radius:2px;padding:0 2px;">${escapeHtml(text)}</mark>`;
  },
  bold(text, fa) {
    return renderBoldHtml(text, fa);
  },
  anchor(url, text, isImage) {
    const safeUrl = escapeXmlAttr(decodeURI(url));
    const safeText = escapeHtml(text);
    if (isImage) return `<img src="${safeUrl}" alt="${safeText}" style="max-width:100%;height:auto;" />`;
    return `<a href="${safeUrl}">${safeText}</a>`;
  },
  plain(text) {
    return escapeHtml(text);
  }
};
const HL_COLORS = {
  bg: { red: "#ff4d4f", blue: "#fdbfff", green: "#affad1", yellow: "#fff3a0" },
  fg: { red: "#F36208", blue: "#8a2be2", green: "#1ddd08" },
  // yellow 文字通用 fallback 颜色 (用于 Logseq/Obsidian 模式导出)
  fgFallback: { yellow: "#b88a00" }
};
const SIYUAN_COLOR_VAR = {
  fg: { red: 1, blue: 6, green: 4, yellow: 3 },
  bg: { red: 1, blue: 6, green: 4, yellow: 3 }
};
const HL_START = "HL:";
const HL_MID = "";
const HL_END = "";
function normalizeHighlights(text, sourceFormat) {
  if (!text) return "";
  const tryAll = sourceFormat === "auto" || sourceFormat === "plaintext";
  let s = text;
  if (sourceFormat === "logseq" || tryAll) {
    s = s.replace(/\[\[#(red|blue|green|cloze)\]\]==([\s\S]+?)==/g, (_, c, t) => {
      if (c === "cloze") return `${HL_START}cloze${HL_MID}${t}${HL_END}`;
      return `${HL_START}bg:${c}${HL_MID}${t}${HL_END}`;
    });
    s = s.replace(/\[\[\$(red|blue|green)\]\]==([\s\S]+?)==/g, (_, c, t) => `${HL_START}fg:${c}${HL_MID}${t}${HL_END}`);
  }
  if (sourceFormat === "obsidian" || tryAll) {
    s = s.replace(/<mark\s+[^>]*?style=["']?\s*background:\s*(#[0-9a-fA-F]{3,8})[^"';]*["']?[^>]*>([\s\S]*?)<\/mark>/gi, (_, hex, t) => {
      const color = hexToColorName(hex, "bg");
      return `${HL_START}bg:${color}${HL_MID}${t}${HL_END}`;
    });
    s = s.replace(/<span\s+style=["']background:\s*(#[0-9a-fA-F]{3,8})[^"';]*["'][^>]*>([\s\S]*?)<\/span>/gi, (_, hex, t) => {
      const color = hexToColorName(hex, "bg");
      return `${HL_START}bg:${color}${HL_MID}${t}${HL_END}`;
    });
    s = s.replace(/<span\s+[^>]*?style=["'][^"']*background:\s*(#[0-9a-fA-F]{3,8})[^"';]*["'][^>]*>([\s\S]*?)<\/span>/gi, (_, hex, t) => {
      const color = hexToColorName(hex, "bg");
      return `${HL_START}bg:${color}${HL_MID}${t}${HL_END}`;
    });
    s = s.replace(/<font\s+color=["']?(#[0-9a-fA-F]{3,8})["']?[^>]*>([\s\S]*?)<\/font>/gi, (_, hex, t) => {
      const color = hexToColorName(hex, "fg");
      return `${HL_START}fg:${color}${HL_MID}${t}${HL_END}`;
    });
  }
  if (sourceFormat === "orca" || tryAll) {
    s = s.replace(/<span\s+class=["']orca-inline\s+bc\s+bcc-(red|blue|green|yellow)["'][^>]*>([\s\S]*?)<\/span>/gi, (_, c, t) => `${HL_START}bg:${c}${HL_MID}${t}${HL_END}`);
    s = s.replace(/<span\s+class=["']orca-inline\s+fc\s+fcc-(red|blue|green)["'][^>]*>([\s\S]*?)<\/span>/gi, (_, c, t) => `${HL_START}fg:${c}${HL_MID}${t}${HL_END}`);
    s = s.replace(/<span\s+class=["']orca-inline\s+h["'][^>]*>([\s\S]*?)<\/span>/gi, (_, t) => `${HL_START}cloze${HL_MID}${t}${HL_END}`);
  }
  if (sourceFormat === "orca") {
    s = s.replace(/==([^=\n]+)==/g, (_, t) => `${HL_START}cloze${HL_MID}${t}${HL_END}`);
  }
  if (sourceFormat === "obsidian") {
    s = s.replace(/==([^=\n]+)==/g, (_, t) => `${HL_START}bg:yellow${HL_MID}${t}${HL_END}`);
  }
  if (sourceFormat === "siyuan" || tryAll) {
    s = s.replace(/<span\s+data-type="mark"[^>]*>([\s\S]*?)<\/span>/gi, (_, t) => `${HL_START}bg:yellow${HL_MID}${t}${HL_END}`);
    s = s.replace(/<span\s+data-type="color"\s+style="color:\s*var\(--b3-font-color(\d+)\);?"[^>]*>([\s\S]*?)<\/span>/gi, (_, idx, t) => {
      const c = siyuanVarToColorName(parseInt(idx, 10), "fg");
      return `${HL_START}fg:${c}${HL_MID}${t}${HL_END}`;
    });
    s = s.replace(/<span\s+data-type="backgroundColor"\s+style="background-color:\s*var\(--b3-font-background(\d+)\);?"[^>]*>([\s\S]*?)<\/span>/gi, (_, idx, t) => {
      const c = siyuanVarToColorName(parseInt(idx, 10), "bg");
      return `${HL_START}bg:${c}${HL_MID}${t}${HL_END}`;
    });
    s = s.replace(/<span\s+data-type="color"\s+style="color:\s*(#[0-9a-fA-F]{3,8});?"[^>]*>([\s\S]*?)<\/span>/gi, (_, hex, t) => {
      const c = hexToColorName(hex, "fg");
      return `${HL_START}fg:${c}${HL_MID}${t}${HL_END}`;
    });
    s = s.replace(/<span\s+data-type="backgroundColor"\s+style="background-color:\s*(#[0-9a-fA-F]{3,8});?"[^>]*>([\s\S]*?)<\/span>/gi, (_, hex, t) => {
      const c = hexToColorName(hex, "bg");
      return `${HL_START}bg:${c}${HL_MID}${t}${HL_END}`;
    });
  }
  if (sourceFormat === "siyuan") {
    s = s.replace(/==([^=\n]+)==/g, (_, t) => `${HL_START}bg:yellow${HL_MID}${t}${HL_END}`);
  }
  if (sourceFormat === "auto") {
    s = s.replace(/==([^=\n]+)==/g, (_, t) => `${HL_START}bg:yellow${HL_MID}${t}${HL_END}`);
  }
  return s;
}
function hexToColorName(hex, type) {
  const normalized = hex.toLowerCase();
  const colors = type === "bg" ? HL_COLORS.bg : HL_COLORS.fg;
  for (const [name, value] of Object.entries(colors)) {
    if (value.toLowerCase() === normalized) return name;
  }
  return type === "bg" ? "yellow" : "red";
}
function siyuanVarToColorName(idx, type) {
  const map = type === "bg" ? SIYUAN_COLOR_VAR.bg : SIYUAN_COLOR_VAR.fg;
  for (const [name, varIdx] of Object.entries(map)) {
    if (varIdx === idx) return name;
  }
  return type === "bg" ? "yellow" : "red";
}
function parseHighlightToFrags(text, sourceFormat) {
  if (!text) return [];
  if (sourceFormat) {
    text = normalizeHighlights(text, sourceFormat);
  }
  const result = [];
  const re = /\x01HL:([^\x02]+)\x02([\s\S]*?)\x03/g;
  let lastIndex = 0;
  let match;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push({ t: "t", v: text.slice(lastIndex, match.index) });
    }
    const spec = match[1];
    const content = match[2];
    if (spec === "cloze") {
      result.push({ t: "h", v: content });
    } else {
      const [type, color] = spec.split(":");
      if (type === "bg") {
        result.push({ t: "bc", color, v: content });
      } else if (type === "fg") {
        result.push({ t: "fc", color, v: content });
      } else {
        result.push({ t: "t", v: content });
      }
    }
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) {
    result.push({ t: "t", v: text.slice(lastIndex) });
  }
  return result;
}
function fragsToLogseq(frags) {
  return renderFrags(frags, LOGSEQ_CONFIG);
}
function fragsToObsidian(frags) {
  return renderFrags(frags, OBSIDIAN_CONFIG);
}
function fragsToOrcaHTML(frags) {
  return renderFrags(frags, ORCA_HTML_CONFIG);
}
function fragsToSiyuan(frags) {
  return renderFrags(frags, SIYUAN_CONFIG);
}
function fragsToMarkdown(frags) {
  return renderFrags(frags, MARKDOWN_CONFIG);
}
function fragsToBasicHTML(frags) {
  return renderFrags(frags, BASIC_HTML_CONFIG);
}
function renderHighlightsHTML(frags) {
  return renderFrags(frags, STANDARD_HTML_CONFIG);
}
function renderHighlightsForWord(frags) {
  return renderFrags(frags, WORD_HTML_CONFIG);
}
function fragsToPreviewHTML(frags) {
  return renderFrags(frags, PREVIEW_HTML_CONFIG);
}
function fragsToPlainText(frags) {
  return frags.map((f) => {
    var _a;
    if (f.t === "a") {
      const anyF = f;
      const linkText = anyF.text || ((_a = f.children) == null ? void 0 : _a.map((c) => String(c.v ?? "")).join("")) || "";
      return linkText || String(f.v ?? "");
    }
    return String(f.v ?? "");
  }).join("");
}
function hexToColorNameAny(hex) {
  if (!hex || typeof hex !== "string") return null;
  const normalized = hex.toLowerCase().replace(/\s/g, "");
  for (const [name, h] of Object.entries(HL_COLORS.bg)) {
    if (h.toLowerCase() === normalized) return name;
  }
  for (const [name, h] of Object.entries(HL_COLORS.fg)) {
    if (h.toLowerCase() === normalized) return name;
  }
  return null;
}
function normalizeColorValue(color) {
  if (!color || typeof color !== "string") return "yellow";
  const trimmed = color.trim();
  if (trimmed.startsWith("#")) {
    const name = hexToColorNameAny(trimmed);
    return name || trimmed;
  }
  return trimmed;
}
function extractTextFromChildren(children) {
  if (!Array.isArray(children)) return "";
  return children.map((c) => String(c.v ?? "")).join("");
}
function normalizeFrags(frags) {
  return frags.map((f) => {
    if (f.v && typeof f.v === "string" && /image::?[ \t]+\S/.test(f.v)) {
      const v = f.v.replace(/(^|\s)image::?[ \t]+(\S+)/g, (_m, prefix, url) => `${prefix}![](${url})`);
      f = { ...f, v };
    }
    if (f.t === "bc" || f.t === "fc" || f.t === "h") {
      const color = f.color ? normalizeColorValue(f.color) : f.t === "fc" ? "red" : "yellow";
      const text = String(f.v ?? "") || extractTextFromChildren(f.children);
      return { t: f.t, v: text, color };
    }
    if (f.f && typeof f.f === "string") {
      const fmt = f.f;
      if (fmt === "bc" || fmt === "fc" || fmt === "h") {
        const fa = f.fa;
        let rawColor = null;
        if (fa) {
          if (fmt === "bc") rawColor = fa.bcc || fa.bccColor || fa.color || fa.c;
          else if (fmt === "fc") rawColor = fa.fcc || fa.fccColor || fa.color || fa.c;
          else rawColor = null;
        }
        if (!rawColor && f.color) rawColor = f.color;
        const color = rawColor ? normalizeColorValue(rawColor) : fmt === "fc" ? "red" : "yellow";
        const text = String(f.v ?? "") || extractTextFromChildren(f.children);
        return { t: fmt, v: text, color };
      }
    }
    if (f.fa) {
      const fa = f.fa;
      if (fa.h || fa.cloze || fa.highlight || fa.type === "h") {
        const text = String(f.v ?? "") || extractTextFromChildren(f.children);
        return { t: "h", v: text };
      }
      if (fa.bc || fa.bg || fa.background || fa.type === "bc") {
        const rawColor = fa.bc || fa.bg || fa.background || fa.color;
        const text = String(f.v ?? "") || extractTextFromChildren(f.children);
        return { t: "bc", v: text, color: normalizeColorValue(rawColor) };
      }
      if (fa.fc || fa.fg || fa.foreground || fa.type === "fc") {
        const rawColor = fa.fc || fa.fg || fa.foreground || fa.color;
        const text = String(f.v ?? "") || extractTextFromChildren(f.children);
        return { t: "fc", v: text, color: normalizeColorValue(rawColor) };
      }
      if (fa.color) {
        const rawColor = fa.color;
        const color = normalizeColorValue(rawColor);
        const text = String(f.v ?? "") || extractTextFromChildren(f.children);
        if (fa.type === "background" || fa.c === "bc") return { t: "bc", v: text, color };
        if (fa.type === "foreground" || fa.c === "fc") return { t: "fc", v: text, color };
        return { t: "bc", v: text, color };
      }
      if (fa.c && typeof fa.c === "string") {
        const colorName = fa.c.toLowerCase();
        if (["red", "blue", "green", "yellow"].includes(colorName)) {
          const text = String(f.v ?? "") || extractTextFromChildren(f.children);
          return { t: "bc", v: text, color: colorName };
        }
      }
    }
    if (f.t === "b") {
      const text = String(f.v ?? "") || extractTextFromChildren(f.children);
      const fa = f.fa || {};
      const cleanFa = {};
      if (fa.bold) cleanFa.bold = true;
      if (fa.italic) cleanFa.italic = true;
      if (fa.strikethrough) cleanFa.strikethrough = true;
      if (fa.underline) cleanFa.underline = true;
      if (Object.keys(cleanFa).length === 0) cleanFa.bold = true;
      return { t: "b", v: text, fa: cleanFa };
    }
    if (f.t === "a") {
      const url = String(f.v ?? "");
      const fa = f.fa || {};
      const linkText = extractTextFromChildren(f.children);
      return { t: "a", v: url, fa: fa.img ? { img: true } : {}, text: linkText };
    }
    if (f.t === "t") {
      const text = String(f.v || "");
      const converted = text.replace(/(^|\s)image::?[ \t]+(\S+)/g, (_m, prefix, url) => `${prefix}![](${url})`);
      return { t: "t", v: converted };
    }
    return { t: "t", v: String(f.v ?? "") };
  });
}
function fragsToOrcaInsertFormat(frags) {
  return frags.map((f) => {
    var _a;
    if (f.f || f.fa) {
      return { ...f };
    }
    if (f.t === "bc") {
      return { t: "t", v: String(f.v ?? ""), f: "bc", fa: { bcc: f.color || "yellow" } };
    }
    if (f.t === "fc") {
      return { t: "t", v: String(f.v ?? ""), f: "fc", fa: { fcc: f.color || "red" } };
    }
    if (f.t === "h") {
      return { t: "t", v: String(f.v ?? ""), f: "h", fa: {} };
    }
    if (f.t === "b") {
      const fa = f.fa || {};
      const cleanFa = {};
      if (fa.bold) cleanFa.bold = true;
      if (fa.italic) cleanFa.italic = true;
      if (fa.strikethrough) cleanFa.strikethrough = true;
      if (fa.underline) cleanFa.underline = true;
      if (Object.keys(cleanFa).length === 0) cleanFa.bold = true;
      return { t: "t", v: String(f.v ?? ""), f: "b", fa: cleanFa };
    }
    if (f.t === "a") {
      const url = String(f.v ?? "");
      const fa = ((_a = f.fa) == null ? void 0 : _a.img) ? { img: true } : {};
      const rawChildren = Array.isArray(f.children) ? f.children : [];
      let children = [];
      if (rawChildren.length > 0) {
        children = fragsToOrcaInsertFormat(rawChildren);
      } else if (f.text) {
        children = [{ t: "t", v: f.text }];
      } else if (!fa.img) {
        children = [{ t: "t", v: url }];
      }
      return { t: "a", v: url, fa, children };
    }
    if (f.t === "t") {
      return { t: "t", v: String(f.v ?? "") };
    }
    return { t: "t", v: String(f.v ?? "") };
  });
}
function convertMarkdownImagesToHTML(text) {
  return text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, url) => {
    const altText = alt || "";
    const safeUrl = escapeXmlAttr(decodeURI(url));
    return `<img src="${safeUrl}" alt="${escapeHtml(altText)}" style="max-width:100%;height:auto;" />`;
  });
}
function detectHighlightSyntax(text) {
  if (/\[\[#(red|blue|green|cloze)\]\]==/.test(text) || /\[\[\$(red|blue|green)\]\]==/.test(text)) {
    return "logseq";
  }
  if (/orca-inline\s+(bc|fc|h)/.test(text)) {
    return "orca";
  }
  if (/<span\s+data-type="(mark|color|backgroundColor)"/i.test(text)) {
    return "siyuan";
  }
  if (/<span\s+style=["']background:/.test(text) || /<font\s+color=/.test(text)) {
    return "obsidian";
  }
  return "plaintext";
}
function renderClozeToSyntax(text, syntaxes) {
  if (!text || syntaxes.length === 0) return text;
  let result = text;
  for (const syntax of syntaxes) {
    result = wrapClozeOnce(result, syntax);
  }
  return result;
}
function wrapClozeOnce(text, syntax) {
  switch (syntax) {
    case "tortoise":
      return `〖${text}〗`;
    case "bold":
      return `**${text}**`;
    case "bold-italic":
      return `***${text}***`;
    case "italic":
      return `*${text}*`;
    case "quote":
      return `"${text}"`;
    case "cloze-idx-bracket":
      return `[[c1::${text}]]`;
    case "bracket":
      return `[[${text}]]`;
    case "brace":
      return `{{${text}}}`;
    default:
      return text;
  }
}
function renderFragsClozeToSyntax(frags, syntaxes) {
  if (syntaxes.length === 0) {
    return frags.map((f) => String(f.v ?? "")).join("");
  }
  return frags.map((f) => {
    if (f.t === "h") {
      return renderClozeToSyntax(String(f.v ?? ""), syntaxes);
    }
    return renderFrags([f], MARKDOWN_CONFIG);
  }).join("");
}
function hasMarkdownImage(text) {
  if (!text) return false;
  const tokens = tokenizeInlineMarkdown(text);
  return tokens.some((t) => t.type === "image");
}
function tokenizeInlineMarkdown(text) {
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === "`") {
      const code = parseCodeSpan(text, i);
      if (code) {
        tokens.push({ type: "code", raw: code.raw, content: code.code });
        i = code.end;
        continue;
      }
      tokens.push({ type: "text", raw: text[i] });
      i++;
      continue;
    }
    if (text[i] === "!" && text[i + 1] === "[" || text[i] === "[") {
      const link = parseLinkOrImage(text, i);
      if (link) {
        tokens.push({
          type: link.isImage ? "image" : "link",
          raw: link.raw,
          content: link.text,
          url: link.url,
          title: link.title
        });
        i = link.end;
        continue;
      }
      tokens.push({ type: "text", raw: text[i] });
      i++;
      continue;
    }
    const nextSpecial = findNextSpecial(text, i);
    if (nextSpecial === -1) {
      tokens.push({ type: "text", raw: text.slice(i) });
      break;
    }
    if (nextSpecial > i) {
      tokens.push({ type: "text", raw: text.slice(i, nextSpecial) });
    }
    i = nextSpecial;
  }
  return tokens;
}
function findNextSpecial(text, start) {
  const backtick = text.indexOf("`", start);
  let linkStart = -1;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "[" && (i === 0 || text[i - 1] !== "\\")) {
      linkStart = i;
      break;
    }
    if (text[i] === "!" && text[i + 1] === "[" && (i === 0 || text[i - 1] !== "\\")) {
      linkStart = i;
      break;
    }
  }
  const candidates = [backtick, linkStart].filter((n) => n !== -1);
  return candidates.length > 0 ? Math.min(...candidates) : -1;
}
function parseCodeSpan(text, start) {
  let tickCount = 0;
  while (text[start + tickCount] === "`") tickCount++;
  if (tickCount === 0) return null;
  let p = start + tickCount;
  while (p < text.length) {
    if (text.slice(p, p + tickCount) === "`") {
      if (text[p + tickCount] === "`") {
        p++;
        continue;
      }
      const raw = text.slice(start, p + tickCount);
      let code = text.slice(start + tickCount, p);
      if (code.length >= 2 && code[0] === " " && code[code.length - 1] === " " && !/^ +$/.test(code)) {
        code = code.slice(1, -1);
      }
      return { raw, code, end: p + tickCount };
    }
    p++;
  }
  return null;
}
function parseLinkOrImage(text, start) {
  const isImage = text[start] === "!" && text[start + 1] === "[";
  const bracketStart = isImage ? start + 1 : start;
  if (text[bracketStart] !== "[") return null;
  let p = bracketStart + 1;
  let depth = 1;
  while (p < text.length && depth > 0) {
    const ch = text[p];
    if (ch === "\\") {
      p += 2;
      continue;
    }
    if (ch === "[") depth++;
    else if (ch === "]") depth--;
    p++;
  }
  if (depth !== 0) return null;
  const textEnd = p - 1;
  if (text[p] !== "(") return null;
  let q = p + 1;
  let parenDepth = 0;
  while (q < text.length) {
    const ch = text[q];
    if (ch === "\\") {
      q += 2;
      continue;
    }
    if (ch === "(") parenDepth++;
    else if (ch === ")") {
      if (parenDepth === 0) break;
      parenDepth--;
    }
    q++;
  }
  if (q >= text.length || text[q] !== ")") return null;
  const raw = text.slice(start, q + 1);
  const linkText = unescapeMarkdown(text.slice(bracketStart + 1, textEnd));
  const urlTitle = splitUrlAndTitle(text.slice(p + 1, q));
  return {
    raw,
    isImage,
    text: linkText,
    url: urlTitle.url,
    title: urlTitle.title,
    end: q + 1
  };
}
function splitUrlAndTitle(raw) {
  const trimmed = raw.trim();
  let url = trimmed;
  let title = "";
  const m = trimmed.match(/^(.*?)(?:\s+("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\((?:\\.|[^)\\])*\)))$/);
  if (m) {
    url = m[1].trim();
    title = unescapeMarkdown(m[2].slice(1, -1));
  }
  return { url: unescapeMarkdown(url), title };
}
function unescapeMarkdown(s) {
  return s.replace(/\\([\\\`\*\_\{\}\[\]\(\)\#\+\-\.\!\~\|\<\>\"\'\ ])/g, "$1");
}
function detectFormat(text) {
  const trimmed = text.trim();
  if (!trimmed) return "empty";
  if (trimmed.startsWith("<?xml") || /^<opml/i.test(trimmed)) return "opml";
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch (e) {
    }
  }
  if (/orca-inline/.test(trimmed)) return "orca";
  if (/<span\s+data-type="(mark|color|backgroundColor)"/i.test(trimmed)) return "siyuan";
  if (/<span\s+style="background:|<font\s+color=/i.test(trimmed)) return "obsidian";
  if (/\[\[#(red|blue|green|cloze)\]\]==|\[\[\$(red|blue|green)\]\]==/.test(trimmed)) return "logseq";
  if (/^#{1,6}\s/.test(trimmed)) return "markdown";
  if (/^#{1,6}\s/.test(text)) return "markdown";
  if (looksLikeMarkdown(text)) return "markdown";
  if (/^[-+*]\s/.test(trimmed)) return "list_outline";
  if (/^\d+\.\s/.test(trimmed)) return "ordered";
  if (/^\t*[-+*]\s/.test(trimmed)) return "unordered";
  return "plaintext";
}
function looksLikeMarkdown(text) {
  const s = text;
  if (/```[\s\S]*?```/.test(s)) return true;
  if (/\n\s*\|[^\n]+\|\s*\n/.test(s)) return true;
  if (/\n\s*>\s+[^\n]+/.test(s)) return true;
  if (/!?\[[^\]]+\]\([^)]+\)/.test(s)) return true;
  if (/\*\*[^*]+\*\*/.test(s) || /__[^_]+__/.test(s)) return true;
  if (/[^*]\*[^*]+\*[^*]/.test(s) || /_[^_]+_/.test(s)) return true;
  if (/~~[^~]+~~/.test(s)) return true;
  if (/`[^`]+`/.test(s)) return true;
  return false;
}
function hasOrcaHighlightSyntax(text) {
  if (/orca-inline/.test(text)) return true;
  if (/==[^=\n]+==/.test(text)) return true;
  return false;
}
function getHighlightSource(format, text) {
  if (text && (format === "list_outline" || format === "unordered" || format === "ordered" || format === "markdown" || format === "plaintext")) {
    if (hasOrcaHighlightSyntax(text)) {
      return "orca";
    }
    if (/<span\s+data-type="(mark|color|backgroundColor)"/i.test(text)) {
      return "siyuan";
    }
    if (/\[\[#(red|blue|green|cloze)\]\]==|\[\[\$(red|blue|green)\]\]==/.test(text)) {
      return "logseq";
    }
    if (/<span\s+style="[^"]*?(?:background|color):|<font\s+color=|<mark\s+style="[^"]*?background:|<span\s+class="cloze"/i.test(text)) {
      return "obsidian";
    }
  }
  switch (format) {
    case "logseq":
      return "logseq";
    case "obsidian":
      return "obsidian";
    case "orca":
      return "orca";
    case "siyuan":
      return "siyuan";
    case "json":
      return "auto";
    case "markdown":
      return "auto";
    case "list_outline":
    case "unordered":
    case "ordered":
      return "auto";
    case "opml":
      return "plaintext";
    case "plaintext":
      return "plaintext";
    default:
      return "auto";
  }
}
function isAtxHeading(line) {
  return /^#{1,6}\s/.test(line.trim());
}
function isSetextUnderline(line) {
  return /^\s*={3,}\s*$/.test(line) || /^\s*-{3,}\s*$/.test(line);
}
function preprocessSetextHeadings(lines) {
  const result = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1];
    if (nextLine && isSetextUnderline(nextLine) && line.trim() && !isAtxHeading(line)) {
      const level = /^\s*=/.test(nextLine) ? 1 : 2;
      result.push("#".repeat(level) + " " + line.trim());
      i++;
    } else {
      result.push(line);
    }
  }
  return result;
}
function computeIndent(line) {
  let indent = 0;
  let j = 0;
  while (j < line.length) {
    if (line[j] === "	") {
      indent++;
      j++;
    } else if (line[j] === " " && line[j + 1] === " ") {
      indent++;
      j += 2;
    } else break;
  }
  return { indent, contentStart: j };
}
function stripListMarker(content) {
  let taskState = null;
  const taskMatch = content.match(/^\s*([-*+]|\d+\.)\s+\[([ xX])\]\s+/);
  if (taskMatch) {
    taskState = taskMatch[2].toLowerCase() === "x" ? "[x]" : "[ ]";
    content = content.replace(/^\s*([-*+]|\d+\.)\s+\[[ xX]\]\s+/, "");
  } else {
    content = content.replace(/^\s*[-*+]\s+/, "").replace(/^\s*\d+\.\s+/, "");
  }
  return { content: content.trim(), taskState };
}
function parseMarkdown(text, hlSource = "auto") {
  let lines = text.split("\n");
  lines = preprocessSetextHeadings(lines);
  const hasHeadings = lines.some((l) => isAtxHeading(l));
  const hasBullets = lines.some((l) => /^\s*[-+*]\s/.test(l));
  const hasOrderedBullets = lines.some((l) => /^\s*\d+\.\s/.test(l));
  if (hasHeadings) {
    return parseHeadingMarkdown(lines, hlSource);
  }
  if (hasBullets || hasOrderedBullets) {
    return parseBulletMarkdown(lines, hlSource);
  }
  return parseProseMarkdown(lines, hlSource);
}
function isListLine(line) {
  return /^\s*[-+*]\s/.test(line) || /^\s*\d+\.\s/.test(line);
}
function parseProseMarkdown(lines, hlSource) {
  const roots = [];
  let paragraphBuffer = [];
  let paragraphStartIdx = 0;
  const flushParagraph = (forceIdx) => {
    if (paragraphBuffer.length === 0) return;
    const text = paragraphBuffer.join(" ").trim();
    paragraphBuffer = [];
    if (!text) return;
    const frags = parseHighlightToFrags(text, hlSource);
    roots.push({
      text: fragsToPlainText(frags),
      fragments: frags,
      children: [],
      level: 0,
      idx: forceIdx ?? paragraphStartIdx
    });
  };
  let inCodeBlock = false;
  let codeBlockLines = [];
  let codeBlockLang = "";
  let codeBlockStartIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (rawLine.trim().startsWith("```")) {
      if (!inCodeBlock) {
        flushParagraph(i);
        const fenceMatch = rawLine.match(/^([ \t]*)```(.*)$/);
        codeBlockLang = fenceMatch ? fenceMatch[2].trim() : "";
        codeBlockLines = [codeBlockLang ? `\`\`\`${codeBlockLang}` : "```"];
        codeBlockStartIdx = i;
        inCodeBlock = true;
      } else {
        codeBlockLines.push("```");
        inCodeBlock = false;
        const codeBlockContent = codeBlockLines.join("\n");
        const frags = parseHighlightToFrags(codeBlockContent, hlSource);
        const plainText = fragsToPlainText(frags);
        if (plainText.trim()) {
          roots.push({
            text: plainText,
            fragments: frags,
            children: [],
            level: 0,
            idx: codeBlockStartIdx
          });
        }
        codeBlockLines = [];
        codeBlockLang = "";
      }
      continue;
    }
    if (inCodeBlock) {
      codeBlockLines.push(rawLine);
      continue;
    }
    if (!rawLine.trim()) {
      flushParagraph();
      continue;
    }
    if (/^[-*_]{3,}\s*$/.test(rawLine.trim())) {
      flushParagraph(i);
      continue;
    }
    if (isListLine(rawLine)) {
      flushParagraph(i);
      const { indent, contentStart } = computeIndent(rawLine);
      let content = rawLine.slice(contentStart);
      const { content: strippedContent, taskState } = stripListMarker(content);
      content = strippedContent;
      if (taskState && content) content = taskState + " " + content;
      content = content.trim();
      if (content) {
        const frags = parseHighlightToFrags(content, hlSource);
        roots.push({
          text: fragsToPlainText(frags),
          fragments: frags,
          children: [],
          level: indent,
          idx: i
        });
      }
      continue;
    }
    if (/^\s*\|/.test(rawLine)) {
      flushParagraph(i);
      const tableLines = [rawLine.trim()];
      let j = i + 1;
      while (j < lines.length && /^\s*\|/.test(lines[j])) {
        tableLines.push(lines[j].trim());
        j++;
      }
      i = j - 1;
      const tableText = tableLines.join("\n");
      const frags = parseHighlightToFrags(tableText, hlSource);
      roots.push({
        text: fragsToPlainText(frags),
        fragments: frags,
        children: [],
        level: 0,
        idx: i
      });
      continue;
    }
    if (/^\s*>/.test(rawLine)) {
      flushParagraph(i);
      const content = rawLine.replace(/^\s*>\s?/, "> ").trim();
      const frags = parseHighlightToFrags(content, hlSource);
      roots.push({
        text: fragsToPlainText(frags),
        fragments: frags,
        children: [],
        level: 0,
        idx: i
      });
      continue;
    }
    if (paragraphBuffer.length === 0) {
      paragraphStartIdx = i;
    }
    paragraphBuffer.push(rawLine.trim());
  }
  flushParagraph();
  if (inCodeBlock && codeBlockLines.length > 0) {
    codeBlockLines.push("```");
    const codeBlockContent = codeBlockLines.join("\n");
    const frags = parseHighlightToFrags(codeBlockContent, hlSource);
    const plainText = fragsToPlainText(frags);
    if (plainText.trim()) {
      roots.push({
        text: plainText,
        fragments: frags,
        children: [],
        level: 0,
        idx: codeBlockStartIdx
      });
    }
  }
  return roots;
}
function parseBulletMarkdown(lines, hlSource) {
  const roots = [];
  const stack = [];
  let inCodeBlock = false;
  let codeBlockLines = [];
  let codeBlockLang = "";
  let codeBlockStartIdx = 0;
  const pushNode = (node, indent) => {
    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].node.children.push(node);
    }
    stack.push({ node, indent });
  };
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (rawLine.trim().startsWith("```")) {
      if (!inCodeBlock) {
        const fenceMatch = rawLine.match(/^([ \t]*)```(.*)$/);
        codeBlockLang = fenceMatch ? fenceMatch[2].trim() : "";
        codeBlockLines = [codeBlockLang ? `\`\`\`${codeBlockLang}` : "```"];
        codeBlockStartIdx = i;
        inCodeBlock = true;
      } else {
        codeBlockLines.push("```");
        inCodeBlock = false;
        const codeBlockContent = codeBlockLines.join("\n");
        const frags2 = parseHighlightToFrags(codeBlockContent, hlSource);
        const plainText2 = fragsToPlainText(frags2);
        if (plainText2.trim()) {
          const indent2 = computeIndent(rawLine).indent;
          const node2 = {
            text: plainText2,
            fragments: frags2,
            children: [],
            level: indent2,
            idx: codeBlockStartIdx
          };
          pushNode(node2, indent2);
        }
        codeBlockLines = [];
        codeBlockLang = "";
      }
      continue;
    }
    if (inCodeBlock) {
      codeBlockLines.push(rawLine);
      continue;
    }
    if (/^[-*_]{3,}\s*$/.test(rawLine.trim())) continue;
    if (!rawLine.trim()) continue;
    const { indent, contentStart } = computeIndent(rawLine);
    let content = rawLine.slice(contentStart);
    if (/^\s*>/.test(content)) {
      content = content.replace(/^\s*>\s?/, "> ");
      content = content.trim();
      if (!content) continue;
      const frags2 = parseHighlightToFrags(content, hlSource);
      pushNode({
        text: fragsToPlainText(frags2),
        fragments: frags2,
        children: [],
        level: indent,
        idx: i
      }, indent);
      continue;
    }
    if (/^\s*\|/.test(rawLine)) {
      const tableLines = [rawLine.trim()];
      let j = i + 1;
      while (j < lines.length && /^\s*\|/.test(lines[j])) {
        tableLines.push(lines[j].trim());
        j++;
      }
      i = j - 1;
      const tableText = tableLines.join("\n");
      const frags2 = parseHighlightToFrags(tableText, hlSource);
      const node2 = {
        text: fragsToPlainText(frags2),
        fragments: frags2,
        children: [],
        level: indent,
        idx: i
      };
      pushNode(node2, indent);
      continue;
    }
    const isBlockquote = /^\s*>/.test(content);
    let strippedContent = content;
    let taskState = null;
    if (!isBlockquote) {
      const { content: sContent, taskState: sTask } = stripListMarker(content);
      strippedContent = sContent;
      taskState = sTask;
    }
    content = strippedContent;
    if (taskState && content) {
      content = taskState + " " + content;
    }
    content = content.trim();
    if (!content) continue;
    const frags = parseHighlightToFrags(content, hlSource);
    const plainText = fragsToPlainText(frags);
    const node = {
      text: plainText,
      fragments: frags,
      children: [],
      level: indent,
      idx: i
    };
    pushNode(node, indent);
  }
  if (inCodeBlock && codeBlockLines.length > 0) {
    codeBlockLines.push("```");
    const codeBlockContent = codeBlockLines.join("\n");
    const frags = parseHighlightToFrags(codeBlockContent, hlSource);
    const plainText = fragsToPlainText(frags);
    if (plainText.trim()) {
      const node = {
        text: plainText,
        fragments: frags,
        children: [],
        level: 0,
        idx: codeBlockStartIdx
      };
      if (stack.length > 0) {
        stack[stack.length - 1].node.children.push(node);
      } else {
        roots.push(node);
      }
    }
  }
  return roots;
}
function parseHeadingMarkdown(lines, hlSource) {
  const roots = [];
  const headingStack = [];
  let parentIndex = -1;
  let contentBuffer = [];
  const flushContent = () => {
    if (contentBuffer.length === 0) return;
    const sectionLines = contentBuffer;
    contentBuffer = [];
    if (!sectionLines.some((l) => l.trim())) return;
    const sectionRoots = parseBulletMarkdown(sectionLines, hlSource);
    const parentLevel = parentIndex >= 0 ? headingStack[parentIndex].level : 0;
    const targetNode = parentIndex >= 0 ? headingStack[parentIndex].node : null;
    for (const child of sectionRoots) {
      adjustNodeLevels(child, parentLevel + 1);
      if (targetNode) {
        targetNode.children.push(child);
      } else {
        roots.push(child);
      }
    }
  };
  let inCodeBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      contentBuffer.push(line);
      continue;
    }
    if (inCodeBlock) {
      contentBuffer.push(line);
      continue;
    }
    const m = line.match(/^(#{1,6})\s+(.+)$/);
    if (m) {
      flushContent();
      const level = m[1].length;
      const content = m[2].trim();
      const fragments = parseHighlightToFrags(content, hlSource);
      const node = {
        text: fragsToPlainText(fragments),
        fragments,
        children: [],
        level,
        idx: i
      };
      while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= level) {
        headingStack.pop();
      }
      if (headingStack.length > 0) {
        headingStack[headingStack.length - 1].node.children.push(node);
      } else {
        roots.push(node);
      }
      headingStack.push({ node, level });
      parentIndex = headingStack.length - 1;
      continue;
    }
    contentBuffer.push(line);
  }
  flushContent();
  if (roots.length === 0 && headingStack.length === 0) {
    return parseBulletMarkdown(lines, hlSource);
  }
  return roots;
}
function adjustNodeLevels(node, baseLevel) {
  node.level = baseLevel + node.level;
  for (const child of node.children) {
    adjustNodeLevels(child, baseLevel);
  }
}
function parseHTML(htmlText, hlSource = "orca") {
  var _a, _b;
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, "text/html");
  const headings = doc.querySelectorAll("h1, h2, h3, h4, h5, h6");
  if (headings.length > 0) {
    return parseHTMLHeadings(doc, hlSource);
  }
  const lists = doc.querySelectorAll("ul, ol");
  if (lists.length > 0) {
    const roots = [];
    for (const list of Array.from(lists)) {
      if (((_a = list.parentElement) == null ? void 0 : _a.tagName) === "LI") continue;
      roots.push(...parseHTMLList(list, 0, hlSource));
    }
    return roots;
  }
  const bodyText = ((_b = doc.body) == null ? void 0 : _b.textContent) || htmlText;
  const frags = parseHighlightToFrags(bodyText.trim(), hlSource);
  return [{
    text: fragsToPlainText(frags),
    fragments: frags,
    children: [],
    level: 0,
    idx: 0
  }];
}
function parseHTMLHeadings(doc, hlSource) {
  const headings = doc.querySelectorAll("h1, h2, h3, h4, h5, h6");
  const flat = [];
  headings.forEach((h, i) => {
    const level = parseInt(h.tagName.substring(1));
    const html = h.innerHTML;
    const frags = parseHighlightToFrags(html, hlSource);
    flat.push({
      node: {
        text: fragsToPlainText(frags),
        fragments: frags,
        children: [],
        level,
        idx: i
      },
      level,
      el: h,
      idx: i
    });
  });
  const roots = [];
  const stack = [];
  for (const h of flat) {
    while (stack.length > 0 && stack[stack.length - 1].level >= h.level) {
      stack.pop();
    }
    if (stack.length === 0) {
      roots.push(h.node);
    } else {
      stack[stack.length - 1].node.children.push(h.node);
    }
    stack.push(h);
  }
  return roots;
}
function parseHTMLList(list, level, hlSource) {
  const nodes = [];
  const items = list.querySelectorAll(":scope > li");
  items.forEach((item, idx) => {
    const clone = item.cloneNode(true);
    const nestedLists = clone.querySelectorAll("ul, ol");
    nestedLists.forEach((l) => l.remove());
    const html = clone.innerHTML;
    const frags = parseHighlightToFrags(html, hlSource);
    const node = {
      text: fragsToPlainText(frags),
      fragments: frags,
      children: [],
      level,
      idx
    };
    const nested = item.querySelectorAll(":scope > ul, :scope > ol");
    for (const nl of Array.from(nested)) {
      node.children.push(...parseHTMLList(nl, level + 1, hlSource));
    }
    nodes.push(node);
  });
  return nodes;
}
function parseOPML(opmlText, hlSource = "auto") {
  const parser = new DOMParser();
  const doc = parser.parseFromString(opmlText, "text/xml");
  const body = doc.querySelector("body");
  if (!body) return [];
  return parseOPMLOutlines(body, 0, hlSource);
}
function parseOPMLOutlines(parent, level, hlSource) {
  const nodes = [];
  const outlines = parent.querySelectorAll(":scope > outline");
  outlines.forEach((outline, idx) => {
    const text = outline.getAttribute("text") || outline.getAttribute("title") || "";
    const frags = parseHighlightToFrags(text, hlSource);
    const node = {
      text: fragsToPlainText(frags),
      fragments: frags,
      children: [],
      level,
      idx
    };
    node.children = parseOPMLOutlines(outline, level + 1, hlSource);
    nodes.push(node);
  });
  return nodes;
}
function parseJSON(jsonText, hlSource = "auto") {
  let data;
  try {
    data = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(`JSON 解析失败: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (data && typeof data === "object" && Array.isArray(data.outline)) {
    return data.outline.map((item, idx) => jsonItemToTreeNode(item, 0, hlSource, idx));
  }
  if (Array.isArray(data)) {
    return data.map((item, idx) => jsonItemToTreeNode(item, 0, hlSource, idx));
  }
  if (data && typeof data === "object") {
    return [jsonItemToTreeNode(data, 0, hlSource, 0)];
  }
  return [];
}
function jsonItemToTreeNode(item, level, hlSource, idx) {
  if (!item || typeof item !== "object") {
    const text2 = String(item ?? "");
    const frags = parseHighlightToFrags(text2, hlSource);
    return { text: fragsToPlainText(frags), fragments: frags, children: [], level, idx };
  }
  const rawText = item.content ?? item.text ?? item.title ?? item.value ?? "";
  const fragments = parseHighlightToFrags(String(rawText), hlSource);
  const text = fragsToPlainText(fragments);
  const rawChildren = item.children || item.items || item.sub || [];
  const children = Array.isArray(rawChildren) ? rawChildren.map((child, i) => jsonItemToTreeNode(child, level + 1, hlSource, i)) : [];
  return { text, fragments, children, level, idx };
}
function cleanLogseqMarkers(text) {
  let s = text;
  s = s.replace(/^[ \t]*[-+]?[ \t]*[A-Za-z][A-Za-z0-9._-]*::[ \t]*[^\n]*$/gm, "");
  s = s.replace(/(^|\s)[A-Za-z][A-Za-z0-9._-]*::[ \t]*[^\n]*$/gm, "$1");
  return s;
}
function convertImageSyntax(text) {
  let s = text;
  s = s.replace(
    /^[ \t]*image::?[ \t]+(\S+)[ \t]*$/gm,
    (_m, p) => `![](${p})`
  );
  s = s.replace(
    /(^|\s)image:[ \t]+(\S+)/g,
    (_m, prefix, p) => `${prefix}![](${p})`
  );
  s = s.replace(
    /^[ \t]*(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|gif|webp|svg|bmp|ico))[ \t]*$/gim,
    (_m, url) => `![](${url})`
  );
  return s;
}
function decodeHtmlEntities(text) {
  return text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))).replace(/&#(\d+);/g, (_, code) => String.fromCharCode(+code)).replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}
function preprocessForImport(text) {
  return convertImageSyntax(cleanLogseqMarkers(decodeHtmlEntities(text)));
}
function parseFile(text, format) {
  const fmt = format || detectFormat(text);
  const cleaned = cleanLogseqMarkers(decodeHtmlEntities(text));
  const prepared = convertImageSyntax(cleaned);
  const hlSource = getHighlightSource(fmt, prepared);
  switch (fmt) {
    case "markdown":
      return parseMarkdown(prepared, hlSource);
    case "orca":
      return parseHTML(prepared, hlSource);
    case "opml":
      return parseOPML(prepared, hlSource);
    case "json":
      return parseJSON(prepared, hlSource);
    case "list_outline":
    case "logseq":
    case "plaintext":
      return parseMarkdown(prepared, hlSource);
    case "obsidian":
      return parseMarkdown(prepared, "obsidian");
    case "unordered": {
      const hasHeadings = prepared.split("\n").some((l) => /^#{1,6}\s/.test(l));
      if (hasHeadings) {
        return parseMarkdown(prepared, hlSource);
      } else {
        return parseBulletMarkdown(prepared.split("\n"), hlSource);
      }
    }
    case "ordered": {
      const hasHeadings = prepared.split("\n").some((l) => /^#{1,6}\s/.test(l));
      if (hasHeadings) {
        return parseMarkdown(prepared, hlSource);
      } else {
        return parseBulletMarkdown(prepared.split("\n"), hlSource);
      }
    }
    case "empty":
      return [];
    default:
      return parseMarkdown(prepared, hlSource);
  }
}
const FORMAT_OPTIONS = {
  logseq: [
    { value: "outline", label: "大纲 (无序列表)" },
    { value: "ordered", label: "大纲 (有序列表)" },
    { value: "tasklist", label: "任务列表" },
    { value: "hierarchy", label: "树形大纲 (├─└─)" },
    { value: "html", label: "HTML (大纲)" },
    { value: "json", label: "JSON" },
    { value: "opml", label: "OPML (大纲)" },
    { value: "markdown", label: "Logseq Markdown" }
  ],
  obsidian: [
    { value: "outline", label: "大纲 (无序列表)" },
    { value: "ordered", label: "大纲 (有序列表)" },
    { value: "tasklist", label: "任务列表" },
    { value: "hierarchy", label: "树形大纲 (├─└─)" },
    { value: "markdown", label: "Obsidian Markdown" }
  ],
  orca: [
    { value: "outline", label: "大纲 (无序列表)" },
    { value: "ordered", label: "大纲 (有序列表)" },
    { value: "tasklist", label: "任务列表" },
    { value: "hierarchy", label: "树形大纲 (├─└─)" },
    { value: "html", label: "HTML (大纲)" },
    { value: "json", label: "JSON (大纲)" },
    { value: "opml", label: "OPML (大纲)" },
    { value: "markdown", label: "Markdown (大纲)" },
    { value: "doc", label: "Word (大纲)" },
    { value: "txt", label: "纯文本 (大纲)" }
  ],
  siyuan: [
    { value: "outline", label: "大纲 (无序列表)" },
    { value: "ordered", label: "大纲 (有序列表)" },
    { value: "tasklist", label: "任务列表" },
    { value: "hierarchy", label: "树形大纲 (├─└─)" },
    { value: "markdown", label: "SiYuan Markdown" },
    { value: "html", label: "HTML (大纲)" },
    { value: "json", label: "JSON (大纲)" },
    { value: "opml", label: "OPML (大纲)" }
  ]
};
const EXT_MAP = {
  outline: "md",
  ordered: "md",
  tasklist: "md",
  hierarchy: "txt",
  markdown: "md",
  html: "html",
  json: "json",
  opml: "opml",
  doc: "doc",
  txt: "txt"
};
const MIME_MAP = {
  outline: "text/markdown",
  ordered: "text/markdown",
  tasklist: "text/markdown",
  hierarchy: "text/plain",
  markdown: "text/markdown",
  html: "text/html",
  json: "application/json",
  opml: "text/xml",
  doc: "application/msword",
  txt: "text/plain"
};
function isTableNode(node) {
  if (!node.fragments || node.fragments.length === 0) return false;
  const text = node.fragments.map((f) => String(f.v ?? "")).join("");
  const lines = text.split("\n");
  if (lines.length < 2) return false;
  if (!/^\s*\|/.test(lines[0])) return false;
  if (!/^\s*\|?[\s:|-]+\|?\s*$/.test(lines[1])) return false;
  if (!/-/.test(lines[1])) return false;
  return true;
}
function markdownTableToHTML(mdTable, style = "bordered") {
  const lines = mdTable.split("\n").map((l) => l.trim()).filter((l) => l && /^\|/.test(l));
  if (lines.length < 2) return mdTable;
  const rows = [];
  for (const line of lines) {
    if (/^\|?[\s:|-]+\|?$/.test(line) && !line.includes("|-|")) {
      if (/^[\s|:-]+$/.test(line) && line.includes("-")) continue;
    }
    const cells = line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
    rows.push(cells);
  }
  if (rows.length === 0) return mdTable;
  const borderStyle = style === "bordered" ? "border-collapse:collapse;width:100%;margin:8px 0;" : "border-collapse:collapse;width:100%;margin:8px 0;";
  const cellStyle = style === "bordered" ? "border:1px solid #ccc;padding:6px 10px;text-align:left;" : "padding:6px 10px;text-align:left;";
  let html = `<table style="${borderStyle}">`;
  if (rows.length > 0) {
    html += "<thead><tr>";
    for (const cell of rows[0]) {
      html += `<th style="${cellStyle}background:#f0f0f0;font-weight:600;">${escapeHtmlSafe(cell)}</th>`;
    }
    html += "</tr></thead>";
  }
  if (rows.length > 1) {
    html += "<tbody>";
    for (let i = 1; i < rows.length; i++) {
      html += "<tr>";
      for (const cell of rows[i]) {
        html += `<td style="${cellStyle}">${escapeHtmlSafe(cell)}</td>`;
      }
      html += "</tr>";
    }
    html += "</tbody>";
  }
  html += "</table>";
  return html;
}
function fragsToText(frags, style, richText, format, wordMode = "traditional", exportClozeMode = false, exportClozeSyntax = []) {
  if (exportClozeMode && exportClozeSyntax.length > 0) {
    return renderFragsClozeToSyntax(frags, exportClozeSyntax);
  }
  if (!richText) {
    return fragsToPlainText(frags);
  }
  if (style === "orca") {
    if (format === "html") {
      return convertMarkdownImagesToHTML(renderHighlightsHTML(frags));
    }
    if (format === "doc") {
      const html = wordMode === "orcaNative" ? fragsToOrcaHTML(frags) : renderHighlightsForWord(frags);
      return convertMarkdownImagesToHTML(html);
    }
    if (format === "txt") {
      return fragsToPlainText(frags);
    }
    if (format === "markdown" || format === "outline") {
      return fragsToMarkdown(frags);
    }
    return fragsToOrcaHTML(frags);
  }
  switch (style) {
    case "logseq":
      return fragsToLogseq(frags);
    case "obsidian":
      return fragsToObsidian(frags);
    case "siyuan":
      return fragsToSiyuan(frags);
    default:
      return fragsToPlainText(frags);
  }
}
function toHierarchyList(tree, opts) {
  let result = "";
  function walk(nodes, depth) {
    if (depth > opts.maxDepth) return;
    for (const node of nodes) {
      const indent = "    ".repeat(depth);
      const text = fragsToText(node.fragments, opts.style, opts.richText, opts.format, opts.wordHighlightMode, opts.exportClozeMode, opts.exportClozeSyntax);
      if (isTableNode(node)) {
        if (result && !result.endsWith("\n\n")) result += "\n";
        const tableLines = text.split("\n");
        for (const line of tableLines) {
          result += indent + line + "\n";
        }
        result += "\n";
      } else {
        result += indent + "- " + text + "\n";
      }
      walk(node.children, depth + 1);
    }
  }
  walk(tree, 0);
  return result.trim();
}
function toOrderedList(tree, opts) {
  let result = "";
  function walk(nodes, depth) {
    if (depth > opts.maxDepth) return;
    for (const node of nodes) {
      const indent = "    ".repeat(depth);
      const text = fragsToText(node.fragments, opts.style, opts.richText, opts.format, opts.wordHighlightMode, opts.exportClozeMode, opts.exportClozeSyntax);
      if (isTableNode(node)) {
        if (result && !result.endsWith("\n\n")) result += "\n";
        const tableLines = text.split("\n");
        for (const line of tableLines) {
          result += indent + line + "\n";
        }
        result += "\n";
      } else {
        result += indent + "1. " + text + "\n";
      }
      walk(node.children, depth + 1);
    }
  }
  walk(tree, 0);
  return result.trim();
}
function toTaskList(tree, opts) {
  let result = "";
  function walk(nodes, depth) {
    if (depth > opts.maxDepth) return;
    for (const node of nodes) {
      const indent = "    ".repeat(depth);
      const text = fragsToText(node.fragments, opts.style, opts.richText, opts.format, opts.wordHighlightMode, opts.exportClozeMode, opts.exportClozeSyntax);
      if (isTableNode(node)) {
        if (result && !result.endsWith("\n\n")) result += "\n";
        const tableLines = text.split("\n");
        for (const line of tableLines) {
          result += indent + line + "\n";
        }
        result += "\n";
      } else {
        result += indent + "- [ ] " + text + "\n";
      }
      walk(node.children, depth + 1);
    }
  }
  walk(tree, 0);
  return result.trim();
}
function toHierarchyTree(tree, opts) {
  let result = "";
  function renderNode(node, depth, isLast, prefix) {
    if (depth > opts.maxDepth) return;
    const connector = depth === 0 ? "" : isLast ? "└─ " : "├─ ";
    const text = fragsToText(node.fragments, opts.style, opts.richText, opts.format, opts.wordHighlightMode, opts.exportClozeMode, opts.exportClozeSyntax);
    if (isTableNode(node)) {
      const tableLines = text.split("\n");
      for (const line of tableLines) {
        result += prefix + connector + line + "\n";
      }
      const children2 = node.children;
      const childPrefix2 = depth === 0 ? "" : prefix + (isLast ? "   " : "│  ");
      for (let i = 0; i < children2.length; i++) {
        renderNode(children2[i], depth + 1, i === children2.length - 1, childPrefix2);
      }
      return;
    }
    result += prefix + connector + text + "\n";
    const children = node.children;
    const childPrefix = depth === 0 ? "" : prefix + (isLast ? "   " : "│  ");
    for (let i = 0; i < children.length; i++) {
      renderNode(children[i], depth + 1, i === children.length - 1, childPrefix);
    }
  }
  for (let i = 0; i < tree.length; i++) {
    renderNode(tree[i], 0, i === tree.length - 1, "");
  }
  return result.trim();
}
function toHierarchyHTML(tree, opts) {
  let html = '<!DOCTYPE html>\n<html lang="zh-CN">\n<head><meta charset="utf-8"><title>Outline</title></head>\n<body>\n';
  function renderNode(node, depth) {
    if (depth > opts.maxDepth) return;
    const indent = "  ".repeat(depth + 1);
    const text = fragsToText(node.fragments, opts.style, opts.richText, opts.format, opts.wordHighlightMode, opts.exportClozeMode, opts.exportClozeSyntax);
    if (isTableNode(node)) {
      const tableHTML = markdownTableToHTML(text);
      html += indent + tableHTML + "\n";
      if (node.children.length > 0) {
        html += indent + "<ul>\n";
        for (const child of node.children) renderNode(child, depth + 1);
        html += indent + "</ul>\n";
      }
      return;
    }
    html += indent + "<li>" + text + "\n";
    if (node.children.length > 0) {
      html += indent + "  <ul>\n";
      for (const child of node.children) renderNode(child, depth + 1);
      html += indent + "  </ul>\n";
    }
    html += indent + "</li>\n";
  }
  html += "<ul>\n";
  for (const root of tree) renderNode(root, 0);
  html += "</ul>\n";
  html += "</body>\n</html>";
  return html;
}
function toHierarchyJSON(tree, opts) {
  function toTree(nodes, depth) {
    if (depth > opts.maxDepth) return [];
    return nodes.map((n) => ({
      content: fragsToText(n.fragments, opts.style, opts.richText, opts.format, opts.wordHighlightMode, opts.exportClozeMode, opts.exportClozeSyntax),
      children: n.children.length > 0 ? toTree(n.children, depth + 1) : []
    }));
  }
  return JSON.stringify({ outline: toTree(tree, 0) }, null, 2);
}
function toHierarchyOPML(tree, opts) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<opml version="2.0">\n<head><title>Converted Outline</title></head>\n<body>\n';
  function renderNode(node, depth) {
    if (depth > opts.maxDepth) return;
    const indent = "  ".repeat(depth + 1);
    const text = fragsToText(node.fragments, opts.style, opts.richText, opts.format, opts.wordHighlightMode, opts.exportClozeMode, opts.exportClozeSyntax);
    if (node.children.length > 0) {
      xml += indent + '<outline text="' + escapeXmlAttr(text) + '">\n';
      for (const child of node.children) renderNode(child, depth + 1);
      xml += indent + "</outline>\n";
    } else {
      xml += indent + '<outline text="' + escapeXmlAttr(text) + '"/>\n';
    }
  }
  for (const root of tree) renderNode(root, 0);
  xml += "</body>\n</opml>";
  return xml;
}
function toHierarchyMarkdown(tree, opts) {
  let result = "";
  function walk(nodes, depth) {
    if (depth > opts.maxDepth) return;
    for (const node of nodes) {
      const indent = "    ".repeat(depth);
      const text = fragsToText(node.fragments, opts.style, opts.richText, opts.format, opts.wordHighlightMode, opts.exportClozeMode, opts.exportClozeSyntax);
      if (isTableNode(node)) {
        if (result && !result.endsWith("\n\n")) result += "\n";
        result += text + "\n";
        result += "\n";
      } else {
        result += indent + "- " + text + "\n";
      }
      walk(node.children, depth + 1);
    }
  }
  walk(tree, 0);
  return result.trim();
}
function toHierarchyDOC(tree, opts) {
  let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">\n<head><meta charset="utf-8"><title>Document</title></head>\n<body>\n';
  function renderNode(node, depth) {
    if (depth > opts.maxDepth) return;
    const indent = "  ".repeat(depth);
    const text = fragsToText(node.fragments, opts.style, opts.richText, opts.format, opts.wordHighlightMode, opts.exportClozeMode, opts.exportClozeSyntax);
    if (isTableNode(node)) {
      const tableHTML = markdownTableToHTML(text);
      html += indent + tableHTML + "\n";
      for (const child of node.children) renderNode(child, depth + 1);
      return;
    }
    html += indent + '<p style="margin-left:' + depth * 20 + 'px;">' + text + "</p>\n";
    for (const child of node.children) renderNode(child, depth + 1);
  }
  for (const root of tree) renderNode(root, 0);
  html += "</body>\n</html>";
  return html;
}
function toHierarchyTXT(tree, opts) {
  let result = "";
  function renderNode(node, depth) {
    if (depth > opts.maxDepth) return;
    result += "  ".repeat(depth) + fragsToText(node.fragments, opts.style, opts.richText, opts.format, opts.wordHighlightMode, opts.exportClozeMode, opts.exportClozeSyntax) + "\n";
    for (const child of node.children) renderNode(child, depth + 1);
  }
  for (const root of tree) renderNode(root, 0);
  return result.trim();
}
function exportTree(tree, opts) {
  let content = "";
  switch (opts.format) {
    case "outline":
      content = toHierarchyList(tree, opts);
      break;
    case "ordered":
      content = toOrderedList(tree, opts);
      break;
    case "tasklist":
      content = toTaskList(tree, opts);
      break;
    case "hierarchy":
      content = toHierarchyTree(tree, opts);
      break;
    case "markdown":
      content = toHierarchyMarkdown(tree, opts);
      break;
    case "html":
      content = toHierarchyHTML(tree, opts);
      break;
    case "json":
      content = toHierarchyJSON(tree, opts);
      break;
    case "opml":
      content = toHierarchyOPML(tree, opts);
      break;
    case "doc":
      content = toHierarchyDOC(tree, opts);
      break;
    case "txt":
      content = toHierarchyTXT(tree, opts);
      break;
    default:
      content = toHierarchyList(tree, opts);
  }
  return {
    content,
    filename: opts.filename || "orca-export",
    mimeType: MIME_MAP[opts.format] || "text/plain",
    extension: EXT_MAP[opts.format] || "txt"
  };
}
function renderExportPreview(tree, opts) {
  if (tree.length === 0) {
    return '<span class="oie-preview-placeholder">无内容</span>';
  }
  const hierarchyFormats = ["outline", "ordered", "tasklist", "hierarchy", "markdown", "opml", "txt", "json"];
  if (hierarchyFormats.includes(opts.format)) {
    return renderHierarchyListPreview(tree, opts);
  }
  if (opts.format === "html" || opts.format === "doc") {
    return renderHtmlOrDocPreview(tree, opts);
  }
  const result = exportTree(tree, opts);
  return '<pre style="white-space:pre-wrap;font-family:monospace;margin:0;font-size:12px;">' + escapeHtmlSafe(result.content) + "</pre>";
}
function renderHtmlOrDocPreview(tree, opts) {
  let html = '<div style="padding:8px 0;line-height:1.9;font-size:13px;">';
  function renderNode(node, depth) {
    if (depth > opts.maxDepth) return;
    if (isTableNode(node)) {
      const tableText = fragsToPlainText(node.fragments);
      html += `<div style="margin-left:${depth * 20}px;padding:3px 0;">${markdownTableToHTML(tableText)}</div>`;
      for (const child of node.children) renderNode(child, depth + 1);
      return;
    }
    let text = opts.richText ? fragsToBasicHTML(node.fragments) : escapeHtmlSafe(fragsToPlainText(node.fragments));
    text = convertMarkdownImagesToHTML(text);
    html += `<div style="margin-left:${depth * 20}px;padding:3px 0;">${text || '<span style="color:#aaa;">(空)</span>'}</div>`;
    for (const child of node.children) renderNode(child, depth + 1);
  }
  for (const root of tree) renderNode(root, 0);
  html += "</div>";
  return html;
}
function renderHierarchyListPreview(tree, opts) {
  let html = '<ul style="margin:4px 0 4px 20px;">';
  function renderNode(node, depth) {
    if (depth > opts.maxDepth) return;
    if (isTableNode(node)) {
      const tableText = fragsToPlainText(node.fragments);
      html += "<li>" + markdownTableToHTML(tableText);
      const children2 = node.children;
      if (children2.length > 0) {
        html += '<ul style="margin:2px 0 2px 20px;">';
        for (const child of children2) renderNode(child, depth + 1);
        html += "</ul>";
      }
      html += "</li>";
      return;
    }
    const text = renderPreviewText(node.fragments, opts);
    html += "<li>" + text;
    const children = node.children;
    if (children.length > 0) {
      html += '<ul style="margin:2px 0 2px 20px;">';
      for (const child of children) renderNode(child, depth + 1);
      html += "</ul>";
    }
    html += "</li>";
  }
  for (const root of tree) renderNode(root, 0);
  html += "</ul>";
  return html;
}
function renderPreviewText(frags, opts) {
  if (!opts.richText) {
    return escapeHtmlSafe(fragsToPlainText(frags));
  }
  return fragsToBasicHTML(frags);
}
function renderImportPreview(tree, formatOption) {
  if (tree.length === 0) return "";
  let html = "";
  const INDENT_PX = 24;
  function walk(nodes, depth) {
    for (const node of nodes) {
      const text = fragsToPreviewHTML(node.fragments);
      const marginLeft = depth * INDENT_PX;
      let prefix = "";
      if (formatOption === "unordered") prefix = "- ";
      else if (formatOption === "ordered") prefix = "1. ";
      else if (formatOption === "tasklist") prefix = "- [ ] ";
      else if (formatOption === "hierarchy") prefix = "- ";
      html += `<div style="margin-left:${marginLeft}px;line-height:1.7;">${prefix}${text}</div>`;
      walk(node.children, depth + 1);
    }
  }
  if (formatOption === "markdown") {
    let walkMd = function(nodes, depth) {
      for (const node of nodes) {
        const text = fragsToPreviewHTML(node.fragments);
        const level = Math.min(depth + 1, 6);
        html += `<div><h${level} style="margin:4px 0;font-size:${20 - depth * 2}px;">${text}</h${level}></div>`;
        walkMd(node.children, depth + 1);
      }
    };
    walkMd(tree, 0);
  } else {
    walk(tree, 0);
  }
  return html;
}
function renderImportCodeView(tree, formatOption) {
  if (tree.length === 0) return "";
  let result = "";
  const INDENT = "    ";
  function walk(nodes, depth) {
    for (const node of nodes) {
      const indent = INDENT.repeat(depth);
      const text = fragsToOrcaHTML(node.fragments);
      if (formatOption === "unordered") result += indent + "- " + text + "\n";
      else if (formatOption === "ordered") result += indent + "1. " + text + "\n";
      else if (formatOption === "tasklist") result += indent + "- [ ] " + text + "\n";
      else if (formatOption === "hierarchy") {
        result += indent + "- " + text + "\n";
      } else result += "#".repeat(Math.min(depth + 1, 6)) + " " + text + "\n";
      walk(node.children, depth + 1);
    }
  }
  if (formatOption === "hierarchy") {
    result = renderTreeCode(tree);
  } else {
    walk(tree, 0);
  }
  return result;
}
function renderTreeCode(tree) {
  let result = "";
  function renderNode(node, depth, isLast, prefix) {
    const connector = depth === 0 ? "" : isLast ? "└─ " : "├─ ";
    const text = fragsToOrcaHTML(node.fragments);
    result += prefix + connector + text + "\n";
    const children = node.children;
    const childPrefix = depth === 0 ? "" : prefix + (isLast ? "   " : "│  ");
    for (let i = 0; i < children.length; i++) {
      renderNode(children[i], depth + 1, i === children.length - 1, childPrefix);
    }
  }
  for (let i = 0; i < tree.length; i++) {
    renderNode(tree[i], 0, i === tree.length - 1, "");
  }
  return result;
}
function escapeHtmlSafe(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function visitBlocks(rootId, blocks, visitor) {
  const block = blocks[rootId];
  if (!block) return;
  visitor(rootId, block);
  if (block.children) {
    for (const childId of block.children) {
      visitBlocks(childId, blocks, visitor);
    }
  }
}
async function setAllBlocksFolded(collapse) {
  var _a, _b, _c;
  try {
    const state = orca.state;
    const activePanelId = state.activePanel;
    if (!activePanelId) {
      orca.notify("error", "未找到当前面板");
      return 0;
    }
    const panel = orca.nav.findViewPanel(activePanelId, state.panels);
    if (!panel) {
      orca.notify("error", "未找到当前面板");
      return 0;
    }
    let rootId = (_a = panel.viewArgs) == null ? void 0 : _a.blockId;
    if (rootId === void 0 || !state.blocks[rootId]) {
      const cursorBlockId = (_c = (_b = panel.viewState) == null ? void 0 : _b.cursor) == null ? void 0 : _c.blockId;
      if (cursorBlockId && state.blocks[cursorBlockId]) {
        rootId = cursorBlockId;
      } else {
        orca.notify("error", "无法确定当前块");
        return 0;
      }
    }
    const targetIds = [];
    visitBlocks(rootId, state.blocks, (blockId, block) => {
      if (block.children && block.children.length > 0) {
        targetIds.push(blockId);
      }
    });
    if (targetIds.length === 0) {
      orca.notify("info", "当前面板没有可折叠的块");
      return 0;
    }
    let success = 0;
    for (const id of targetIds) {
      try {
        await orca.invokeBackend("fold-block", id, collapse);
        success++;
      } catch (err) {
        console.warn(`[OIE] fold-block failed for id=${id}:`, err);
      }
    }
    orca.notify(
      "success",
      collapse ? `已折叠 ${success} 个父块` : `已展开 ${success} 个父块`
    );
    return success;
  } catch (err) {
    console.error("[OIE] setAllBlocksFolded failed:", err);
    orca.notify(
      "error",
      `${collapse ? "折叠" : "展开"}失败: ${err instanceof Error ? err.message : String(err)}`
    );
    return 0;
  }
}
const PLUGIN_VERSION = "2.4.6";
const DEFAULT_SETTINGS = {
  debug: false,
  defaultExportStyle: "orca",
  defaultRichText: true,
  defaultMaxDepth: 6,
  wordHighlightMode: "traditional",
  importPosition: "child",
  clozeMode: true,
  clozeSyntax: ["bold"],
  exportClozeMode: false,
  exportClozeSyntax: ["bold"]
};
const SETTINGS_SCHEMA = {
  // 注意：版本号已从 schema 中移除，避免作为 string 字段被用户编辑。
  // 改为通过 injectVersionBadge() 在设置面板顶部以只读徽章形式展示（纯展示，不可编辑/复制）。
  debug: {
    label: "调试开关",
    description: "开启后在 console 输出详细日志（导入步骤、光标状态、editor command 调用参数等）",
    type: "boolean",
    defaultValue: DEFAULT_SETTINGS.debug
  },
  defaultExportStyle: {
    label: "默认导出样式",
    description: "打开导出对话框时的默认样式：logseq / obsidian / Orca Note / SiYuan",
    type: "singleChoice",
    defaultValue: DEFAULT_SETTINGS.defaultExportStyle,
    choices: [
      { label: "Logseq 样式", value: "logseq" },
      { label: "Obsidian 样式", value: "obsidian" },
      { label: "Orca Note 样式", value: "orca" },
      { label: "SiYuan (思源) 样式", value: "siyuan" }
    ]
  },
  defaultRichText: {
    label: "默认转换富文本语法",
    description: "打开导出对话框时，富文本语法转换复选框的默认状态",
    type: "boolean",
    defaultValue: DEFAULT_SETTINGS.defaultRichText
  },
  defaultMaxDepth: {
    label: "默认最大深度",
    description: "导出时的默认层级深度（H1-H6，建议范围 2-10）",
    type: "number",
    defaultValue: DEFAULT_SETTINGS.defaultMaxDepth
  },
  wordHighlightMode: {
    label: "Word 标签模式",
    description: "导出 Word (.doc) 时使用的高亮标签：traditional = 传统 mark/span 标签（兼容性好）/ orcaNative = Orca Note 原生标签",
    type: "singleChoice",
    defaultValue: DEFAULT_SETTINGS.wordHighlightMode,
    choices: [
      { label: "传统标签 (推荐)", value: "traditional" },
      { label: "Orca 原生标签", value: "orcaNative" }
    ]
  },
  importPosition: {
    label: "导入插入位置",
    description: "导入内容到当前块的位置：child = 作为子块插入（推荐） / after = 作为同级兄弟插入",
    type: "singleChoice",
    defaultValue: DEFAULT_SETTINGS.importPosition,
    choices: [
      { label: "子块 (推荐)", value: "child" },
      { label: "同级兄弟", value: "after" }
    ]
  },
  clozeMode: {
    label: "挖空模式",
    description: "导入时将指定语法转换为 Orca 挖空（遮挡）效果。注：高亮语法由富文本转换功能全权处理",
    type: "boolean",
    defaultValue: DEFAULT_SETTINGS.clozeMode
  },
  clozeSyntax: {
    label: "挖空语法",
    description: "导入时将哪些语法识别为挖空效果（可多选，支持组合）",
    type: "multiChoices",
    defaultValue: DEFAULT_SETTINGS.clozeSyntax,
    choices: [
      { label: "〖内容〗", value: "tortoise" },
      { label: "[[c1::xx]]", value: "cloze-idx-bracket" },
      { label: "[[xx]]", value: "bracket" },
      { label: "{{xx}}", value: "brace" },
      { label: "**xx**", value: "bold" },
      { label: "***xx***", value: "bold-italic" },
      { label: "*xx*", value: "italic" },
      { label: '"xx"', value: "quote" }
    ]
  },
  exportClozeMode: {
    label: "导出挖空模式",
    description: "导出时将 Orca 挖空（遮挡）效果转换为指定语法。关闭时按各样式默认语法输出（如高亮）",
    type: "boolean",
    defaultValue: DEFAULT_SETTINGS.exportClozeMode
  },
  exportClozeSyntax: {
    label: "导出挖空语法",
    description: "导出时将 Orca 挖空转换为哪种语法（可多选，多选时按顺序嵌套组合）",
    type: "multiChoices",
    defaultValue: DEFAULT_SETTINGS.exportClozeSyntax,
    choices: [
      { label: "〖内容〗", value: "tortoise" },
      { label: "[[c1::xx]]", value: "cloze-idx-bracket" },
      { label: "[[xx]]", value: "bracket" },
      { label: "{{xx}}", value: "brace" },
      { label: "**xx**", value: "bold" },
      { label: "***xx***", value: "bold-italic" },
      { label: "*xx*", value: "italic" },
      { label: '"xx"', value: "quote" }
    ]
  }
};
let cachedSettings = null;
async function loadSettings(pluginName2) {
  try {
    const result = {};
    const allKeys = [
      "debug",
      "defaultExportStyle",
      "defaultRichText",
      "defaultMaxDepth",
      "wordHighlightMode",
      "importPosition",
      "clozeMode",
      "clozeSyntax",
      "exportClozeMode",
      "exportClozeSyntax"
    ];
    for (const key of allKeys) {
      try {
        const val = await orca.plugins.getData(pluginName2, `setting_${key}`);
        if (val !== void 0 && val !== null) {
          if (key === "debug" || key === "defaultRichText" || key === "clozeMode" || key === "exportClozeMode") {
            result[key] = val === "true" || val === true || val === "1" || val === 1;
          } else if (key === "defaultMaxDepth") {
            result[key] = Number(val);
          } else if (key === "clozeSyntax" || key === "exportClozeSyntax") {
            if (Array.isArray(val)) {
              result[key] = val.filter((v) => typeof v === "string");
            } else if (typeof val === "string" && val.includes(",")) {
              result[key] = val.split(",").filter(Boolean);
            } else if (typeof val === "string" && val) {
              result[key] = [val];
            }
          } else {
            result[key] = val;
          }
        }
      } catch (_e) {
      }
    }
    cachedSettings = { ...DEFAULT_SETTINGS, ...result };
  } catch (err) {
    console.warn("[OIE] loadSettings failed, using defaults:", err);
    cachedSettings = { ...DEFAULT_SETTINGS };
  }
  if (cachedSettings == null ? void 0 : cachedSettings.debug) {
    console.log("[OIE] Settings loaded:", cachedSettings);
  }
  return cachedSettings;
}
async function saveSettings(pluginName2, settings) {
  cachedSettings = { ...settings };
  try {
    const keys = ["debug", "defaultExportStyle", "defaultRichText", "defaultMaxDepth", "wordHighlightMode", "importPosition", "clozeMode", "clozeSyntax", "exportClozeMode", "exportClozeSyntax"];
    for (const key of keys) {
      const val = settings[key];
      if (val !== void 0 && val !== null) {
        const strVal = Array.isArray(val) ? val.filter((v) => typeof v === "string" && !v.includes(",")).join(",") : String(val);
        await orca.plugins.setData(pluginName2, `setting_${key}`, strVal);
      }
    }
  } catch (err) {
    console.error("[OIE] saveSettings failed:", err);
  }
}
function getSettings() {
  return cachedSettings || { ...DEFAULT_SETTINGS };
}
async function registerSettings(pluginName2) {
  var _a;
  try {
    if ((_a = orca.plugins) == null ? void 0 : _a.setSettingsSchema) {
      await orca.plugins.setSettingsSchema(pluginName2, SETTINGS_SCHEMA);
      console.log("[OIE] Settings schema registered");
    } else {
      console.warn("[OIE] setSettingsSchema API not available");
    }
  } catch (err) {
    console.warn("[OIE] registerSettings failed:", err);
  }
  setTimeout(() => injectVersionBadge(pluginName2), 300);
}
const VERSION_BADGE_STYLE = `
.oie-version-badge {
  --oie-badge-primary: #3370ff;
  --oie-badge-text: #1a1a1a;
  --oie-badge-text-2: #4e5969;
  --oie-badge-version-bg: rgba(51,112,255,0.12);

  margin: 0 0 16px 0;
  color: var(--oie-badge-text);
  font-size: 13px;
  line-height: 1.5;
}
.oie-version-badge-name {
  font-weight: 600;
  margin-right: 6px;
}
.oie-version-badge-version {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--oie-badge-version-bg);
  color: var(--oie-badge-primary);
  font-weight: 700;
  user-select: none;
  -webkit-user-select: none;
}
.oie-version-badge-desc {
  font-size: 12px;
  color: var(--oie-badge-text-2);
  margin-top: 2px;
}
/* Orca 暗色主题 — 通过 body 属性检测，不依赖 prefers-color-scheme */
body[data-theme="dark"] .oie-version-badge,
body.dark .oie-version-badge,
body.theme-dark .oie-version-badge {
  --oie-badge-primary: #7aaaff;
  --oie-badge-text: #e8e8e8;
  --oie-badge-text-2: #9ca3af;
  --oie-badge-version-bg: rgba(74,140,255,0.18);
}
@media (prefers-color-scheme: dark) {
  .oie-version-badge {
    --oie-badge-primary: #7aaaff;
    --oie-badge-text: #e8e8e8;
    --oie-badge-text-2: #9ca3af;
    --oie-badge-version-bg: rgba(74,140,255,0.18);
  }
}
`;
let versionBadgeInjected = false;
let versionBadgeObserver = null;
function injectVersionBadge(pluginName2) {
  if (typeof document === "undefined") return;
  if (versionBadgeInjected) {
    const existing = document.querySelector(".oie-version-badge");
    if (existing) return;
    versionBadgeInjected = false;
  }
  if (!document.getElementById("oie-version-badge-style")) {
    const style = document.createElement("style");
    style.id = "oie-version-badge-style";
    style.setAttribute("data-role", "orca-import-export");
    style.textContent = VERSION_BADGE_STYLE;
    document.head.appendChild(style);
  }
  const findPanel = () => {
    var _a;
    const settingsLabels = ["调试开关", "默认导出样式"];
    const existing = document.querySelector(".oie-version-badge");
    if (existing) {
      versionBadgeInjected = true;
      return null;
    }
    let bestCandidate = null;
    let bestArea = Infinity;
    const allEls = document.querySelectorAll("div, section, form");
    for (const el2 of allEls) {
      const text = el2.textContent || "";
      if (!settingsLabels.every((label) => text.includes(label))) continue;
      const rect = (_a = el2.getBoundingClientRect) == null ? void 0 : _a.call(el2);
      if (!rect || rect.width < 200 || rect.height < 80) continue;
      const area = rect.width * rect.height;
      if (area < bestArea) {
        bestArea = area;
        bestCandidate = el2;
      }
    }
    return bestCandidate;
  };
  const tryInject = () => {
    var _a;
    try {
      const panel = findPanel();
      if (!panel) {
        debugLog(pluginName2, "version badge: panel not found yet");
        return false;
      }
      if (panel.querySelector(".oie-version-badge")) {
        versionBadgeInjected = true;
        return true;
      }
      const headings = panel.querySelectorAll("h1, h2, h3, h4, h5, h6");
      for (const h of headings) {
        const text = ((_a = h.textContent) == null ? void 0 : _a.trim()) || "";
        if (text === pluginName2 || text === "orca-import-export") {
          h.style.display = "none";
        }
      }
      const badge = document.createElement("div");
      badge.className = "oie-version-badge";
      badge.innerHTML = `
        <div>
          <span class="oie-version-badge-name">orca-import-export</span>
          <span class="oie-version-badge-version">v${PLUGIN_VERSION}</span>
        </div>
        <div class="oie-version-badge-desc">让笔记迁移更简单</div>
      `;
      panel.insertBefore(badge, panel.firstChild);
      versionBadgeInjected = true;
      console.log("[OIE] version badge injected");
      return true;
    } catch (e) {
      return false;
    }
  };
  if (tryInject()) return;
  if (versionBadgeObserver) {
    versionBadgeObserver.disconnect();
  }
  versionBadgeObserver = new MutationObserver(() => {
    if (tryInject()) {
      versionBadgeObserver == null ? void 0 : versionBadgeObserver.disconnect();
      versionBadgeObserver = null;
    }
  });
  versionBadgeObserver.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => {
    if (!versionBadgeInjected) {
      console.warn(
        "[OIE] version badge: not injected after 5s. Available settings panels:",
        Array.from(document.querySelectorAll('.orca-plugin-settings, .orca-settings-panel, [class*="plugin-settings"], [class*="settings-content"]')).map((el2) => ({ className: el2.className, text: (el2.textContent || "").slice(0, 80) }))
      );
    }
  }, 5e3);
  setTimeout(() => {
    if (versionBadgeObserver) {
      versionBadgeObserver.disconnect();
      versionBadgeObserver = null;
    }
  }, 3e4);
}
function removeVersionBadge() {
  var _a;
  if (versionBadgeObserver) {
    versionBadgeObserver.disconnect();
    versionBadgeObserver = null;
  }
  versionBadgeInjected = false;
  (_a = document.getElementById("oie-version-badge-style")) == null ? void 0 : _a.remove();
  document.querySelectorAll(".oie-version-badge").forEach((el2) => el2.remove());
}
function debugLog(pluginName2, ...args) {
  const settings = getSettings();
  if (settings.debug) {
    console.log(`[${pluginName2}][DEBUG]`, ...args);
  }
}
function infoLog(pluginName2, ...args) {
  const settings = getSettings();
  if (settings.debug) {
    console.log(`[${pluginName2}]`, ...args);
  }
}
function errorLog(pluginName2, ...args) {
  console.error(`[${pluginName2}]`, ...args);
}
const ICONS = {
  upload: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  download: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  close: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  info: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  file: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  fileCheck: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 15 11 17 15 13"/></svg>',
  settings: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  eye: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  list: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
  listNumbers: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>',
  markdown: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 13l1.5 1.5L13 12"/><path d="M9 17l1.5-1.5L13 18"/></svg>',
  refresh: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
  copy: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  check: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  exchange: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
  chevronDown: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
  chevronUp: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>',
  trash: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
  loader: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>',
  spinner: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 0 1 10 10" opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>',
  checkCircle: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
};
const DIALOG_STYLES = `
/* ============================================================
 * CSS 变量定义 - 自动适配深色/浅色主题
 * 通过 prefers-color-scheme 媒体查询处理 fallback 颜色
 * ============================================================ */
.oie-themed, .oie-themed * {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif !important;
  box-sizing: border-box !important;
}
.oie-themed {
  --oie-bg: #ffffff;
  --oie-bg-alt: #f7f8fa;
  --oie-bg-fill: #f2f3f5;
  --oie-bg-fill-hover: #e5e6eb;
  --oie-border: #e8e8e8;
  --oie-border-light: #f0f0f0;
  --oie-text: #1a1a1a;
  --oie-text-2: #4e5969;
  --oie-text-3: #86909c;
  --oie-primary: #3370ff;
  --oie-primary-light: #e8f3ff;
  --oie-success: #00b42a;
  --oie-shadow: 0 8px 32px rgba(0,0,0,0.2);
  color: var(--oie-text);
  font-size: 14px;
  line-height: 1.5;
}
@media (prefers-color-scheme: dark) {
  .oie-themed {
    --oie-bg: #1e1e1e;
    --oie-bg-alt: #252525;
    --oie-bg-fill: #2a2a2a;
    --oie-bg-fill-hover: #353535;
    --oie-border: #3a3a3a;
    --oie-border-light: #2f2f2f;
    --oie-text: #e8e8e8;
    --oie-text-2: #b0b0b0;
    --oie-text-3: #888888;
    --oie-primary: #4a8cff;
    --oie-primary-light: #1a2a4a;
    --oie-success: #2ea043;
    --oie-shadow: 0 8px 32px rgba(0,0,0,0.5);
  }
}
/* Orca 深色主题适配：检测 Orca body 的 dark class 或 data-theme 属性 */
body[data-theme="dark"] .oie-themed,
body.dark .oie-themed,
body.theme-dark .oie-themed {
    --oie-bg: #1e1e1e;
    --oie-bg-alt: #252525;
    --oie-bg-fill: #2a2a2a;
    --oie-bg-fill-hover: #353535;
    --oie-border: #3a3a3a;
    --oie-border-light: #2f2f2f;
    --oie-text: #e8e8e8;
    --oie-text-2: #b0b0b0;
    --oie-text-3: #888888;
    --oie-primary: #4a8cff;
    --oie-primary-light: #1a2a4a;
    --oie-success: #2ea043;
    --oie-shadow: 0 8px 32px rgba(0,0,0,0.5);
}

.oie-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  z-index: 99999;
  display: flex; align-items: center; justify-content: center;
  animation: oie-fade-in 0.15s ease;
  font-size: 14px;
}
@keyframes oie-fade-in { from { opacity: 0; } to { opacity: 1; } }

.oie-dialog {
  background: var(--oie-bg);
  color: var(--oie-text);
  border-radius: 12px;
  box-shadow: var(--oie-shadow);
  width: 640px; max-width: 92vw; max-height: 86vh;
  display: flex; flex-direction: column;
  overflow: hidden;
  animation: oie-slide-up 0.2s ease;
  font-size: 14px;
  line-height: 1.5;
}
@keyframes oie-slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

.oie-dialog-header {
  padding: 14px 18px;
  border-bottom: 1px solid var(--oie-border);
  display: flex; align-items: center; justify-content: space-between;
  background: var(--oie-bg);
}
.oie-dialog-title {
  font-size: 15px; font-weight: 600;
  color: var(--oie-text);
  display: flex; align-items: center; gap: 8px;
  line-height: 1.4;
}
.oie-dialog-title svg {
  color: var(--oie-primary);
  width: 18px; height: 18px;
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
}
.oie-dialog-close {
  cursor: pointer;
  font-size: 14px;
  color: var(--oie-text-3);
  background: transparent;
  border: none;
  padding: 6px;
  line-height: 1;
  border-radius: 6px;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px; height: 28px;
}
.oie-dialog-close:hover {
  color: var(--oie-text);
  background: var(--oie-bg-fill);
}
.oie-dialog-close svg {
  width: 16px; height: 16px;
  display: block;
}

.oie-dialog-body {
  padding: 18px;
  overflow-y: auto;
  flex: 1;
  color: var(--oie-text);
  font-size: 14px;
  line-height: 1.6;
}

.oie-dialog-footer {
  padding: 12px 18px;
  border-top: 1px solid var(--oie-border);
  display: flex; justify-content: flex-end; gap: 8px;
  background: var(--oie-bg-alt);
  align-items: center;
}

.oie-btn {
  padding: 7px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s;
  display: inline-flex; align-items: center; gap: 6px;
  font-family: inherit;
  line-height: 1.4;
  white-space: nowrap;
}
.oie-btn svg {
  width: 14px; height: 14px;
  display: inline-block;
  vertical-align: middle;
}
.oie-btn-primary {
  background: var(--oie-primary);
  color: #fff;
  border-color: var(--oie-primary);
}
.oie-btn-primary:hover { opacity: 0.88; }
.oie-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.oie-btn-secondary {
  background: var(--oie-bg);
  color: var(--oie-text);
  border-color: var(--oie-border);
}
.oie-btn-secondary:hover { background: var(--oie-bg-fill); border-color: var(--oie-text-3); }
.oie-btn-ghost {
  background: transparent;
  color: var(--oie-text-2);
  border-color: transparent;
}
.oie-btn-ghost:hover { background: var(--oie-bg-fill); color: var(--oie-text); }
.oie-btn-sm { padding: 4px 10px; font-size: 12px; }
.oie-btn-sm svg { width: 12px; height: 12px; }
.oie-btn-pulse {
  animation: oie-pulse 1.2s ease-in-out infinite;
}
@keyframes oie-pulse {
  0% { box-shadow: 0 0 0 0 rgba(51, 112, 255, 0.4); }
  70% { box-shadow: 0 0 0 8px rgba(51, 112, 255, 0); }
  100% { box-shadow: 0 0 0 0 rgba(51, 112, 255, 0); }
}

.oie-section-label {
  font-size: 12px; font-weight: 600;
  color: var(--oie-text-2);
  margin: 14px 0 8px 0;
  display: flex; align-items: center; gap: 6px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.oie-section-label:first-child { margin-top: 0; }
.oie-section-label svg {
  color: var(--oie-primary);
  width: 14px; height: 14px;
  flex-shrink: 0;
}
.oie-section-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.oie-section-label-row > span:not(.oie-section-label-actions) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.oie-section-label-actions {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.oie-option-group {
  display: flex; flex-direction: column; gap: 6px;
  margin-bottom: 12px;
}
.oie-option-card {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px;
  border: 1.5px solid var(--oie-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  background: var(--oie-bg);
}
.oie-option-card:hover { border-color: var(--oie-primary); }
.oie-option-card.selected {
  border-color: var(--oie-primary);
  background: var(--oie-primary-light);
}
.oie-option-icon {
  font-size: 16px; color: var(--oie-primary);
  width: 20px; text-align: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.oie-option-icon svg { width: 16px; height: 16px; }
.oie-option-text { flex: 1; min-width: 0; }
.oie-option-label {
  font-size: 13px; font-weight: 500;
  color: var(--oie-text);
  line-height: 1.4;
}
.oie-option-desc {
  font-size: 11px;
  color: var(--oie-text-3);
  margin-top: 2px;
  line-height: 1.4;
}
.oie-radio {
  width: 16px; height: 16px;
  border: 2px solid var(--oie-border);
  border-radius: 50%;
  flex-shrink: 0;
  transition: all 0.15s;
  position: relative;
}
.oie-option-card.selected .oie-radio {
  border-color: var(--oie-primary);
  background: var(--oie-primary);
}
.oie-option-card.selected .oie-radio::after {
  content: '';
  position: absolute;
  top: 3px; left: 3px;
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #fff;
}

.oie-file-drop {
  position: relative;
  border: 2px dashed var(--oie-border);
  border-radius: 12px;
  padding: 28px 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  margin-bottom: 12px;
  background: var(--oie-bg);
  color: var(--oie-text);
  overflow: hidden;
}
.oie-file-drop:hover {
  border-color: var(--oie-primary);
  background: var(--oie-bg-alt);
}
/* P1-4: 拖放视觉反馈 - 渐变 + 光晕 + 图标弹跳 + 提示文字 */
.oie-file-drop.drag-over {
  border-color: var(--oie-primary);
  border-style: solid;
  background: linear-gradient(135deg, rgba(51,112,255,0.12) 0%, rgba(122,170,255,0.06) 100%);
  box-shadow:
    0 0 0 4px rgba(51,112,255,0.1),
    0 8px 24px rgba(51,112,255,0.15),
    inset 0 0 40px rgba(51,112,255,0.05);
  transform: scale(1.02);
  animation: oie-drop-pulse 1s ease-in-out infinite;
}
.oie-file-drop.drag-over .oie-file-drop-icon {
  color: var(--oie-primary);
  transform: scale(1.2) translateY(-4px);
}
.oie-file-drop.drag-over .oie-file-drop-text {
  color: var(--oie-primary);
  font-weight: 600;
}
@keyframes oie-drop-pulse {
  0%, 100% { box-shadow: 0 0 0 4px rgba(51,112,255,0.1), 0 8px 24px rgba(51,112,255,0.15); }
  50% { box-shadow: 0 0 0 8px rgba(51,112,255,0.06), 0 12px 32px rgba(51,112,255,0.25); }
}
.oie-file-drop-icon {
  font-size: 32px;
  color: var(--oie-text-3);
  margin-bottom: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.oie-file-drop-icon svg { width: 36px; height: 36px; }
.oie-file-drop.has-file .oie-file-drop-icon { color: var(--oie-success); }
.oie-file-drop-text {
  font-size: 13px;
  color: var(--oie-text-2);
  line-height: 1.5;
  word-break: break-all;
  transition: all 0.2s ease;
}
/* P1-4: 拖放中显示的提示文字 */
.oie-file-drop-hint-active {
  margin-top: 6px;
  font-size: 11px;
  color: var(--oie-primary);
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  animation: oie-hint-blink 1s ease-in-out infinite;
}
@keyframes oie-hint-blink {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
/* P1-5: 预览骨架屏 */
.oie-preview-skeleton {
  padding: 12px 4px;
  display: flex; flex-direction: column; gap: 10px;
}
.oie-preview-skeleton-line {
  height: 12px;
  border-radius: 4px;
  background: linear-gradient(90deg,
    var(--oie-bg-fill) 0%,
    var(--oie-bg-fill-hover) 50%,
    var(--oie-bg-fill) 100%);
  background-size: 200% 100%;
  animation: oie-skeleton-shimmer 1.2s ease-in-out infinite;
}
.oie-preview-skeleton-line:nth-child(2) { animation-delay: 0.1s; }
.oie-preview-skeleton-line:nth-child(3) { animation-delay: 0.2s; }
@keyframes oie-skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.oie-file-name {
  font-size: 14px; font-weight: 500;
  color: var(--oie-success);
}
.oie-format-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  background: var(--oie-bg-fill);
  color: var(--oie-text-2);
  margin-left: 8px;
  letter-spacing: 0.5px;
}
.oie-info-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px;
  background: var(--oie-primary-light);
  border-radius: 6px;
  font-size: 12px;
  color: var(--oie-text-2);
  margin-bottom: 12px;
  line-height: 1.5;
}
.oie-info-bar svg {
  color: var(--oie-primary);
  width: 14px; height: 14px;
  flex-shrink: 0;
}
.oie-config-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
  padding: 10px 12px;
  background: var(--oie-bg-alt);
  border: 1px solid var(--oie-border);
  border-radius: 6px;
}
@media (max-width: 520px) {
  .oie-config-bar {
    grid-template-columns: 1fr;
  }
  .oie-dialog {
    width: 100%;
    max-width: 96vw;
    border-radius: 8px;
  }
}
.oie-opt-group {
  display: flex; flex-direction: column; gap: 3px;
}
.oie-opt-group-inline {
  flex-direction: row; flex-wrap: wrap; align-items: center;
  gap: 6px 10px;
}
.oie-opt-group-inline > .oie-opt-label {
  margin-right: 4px;
}
.oie-opt-label {
  font-size: 10px; font-weight: 600;
  color: var(--oie-text-2);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.oie-select, .oie-input {
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--oie-border);
  border-radius: 4px;
  background: var(--oie-bg);
  color: var(--oie-text);
  font-size: 12px;
  outline: none;
  font-family: inherit;
  transition: border-color 0.15s;
}
.oie-select:focus, .oie-input:focus {
  border-color: var(--oie-primary);
}
.oie-select option {
  background: var(--oie-bg);
  color: var(--oie-text);
}
.oie-checkbox-label {
  display: flex; align-items: center; gap: 4px;
  font-size: 12px;
  height: 28px;
  cursor: pointer;
  color: var(--oie-text);
}
.oie-checkbox-label input { cursor: pointer; accent-color: var(--oie-primary); }

.oie-cloze-syntax-group {
  display: flex; flex-wrap: nowrap; gap: 4px 8px;
  padding: 4px 8px;
  overflow-x: auto;
  scrollbar-width: thin;
}
.oie-cloze-syntax-group::-webkit-scrollbar {
  height: 4px;
}
.oie-cloze-syntax-group::-webkit-scrollbar-thumb {
  background: var(--oie-border);
  border-radius: 2px;
}
.oie-cloze-syntax-item {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 12px; cursor: pointer;
  color: var(--oie-text);
  padding: 2px 5px;
  border-radius: 3px;
  transition: background 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
}
.oie-cloze-syntax-item:hover {
  background: var(--oie-bg-fill);
}
.oie-cloze-syntax-item input {
  cursor: pointer;
  accent-color: var(--oie-primary);
  margin: 0;
}
.oie-cloze-syntax-item span {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 10px;
}

.oie-sub-tabs {
  display: flex; gap: 0;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--oie-border);
}
.oie-sub-tabs-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--oie-border);
  gap: 8px;
  flex-wrap: wrap;
}
.oie-tab-inline-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--oie-text-2);
  cursor: pointer;
  white-space: nowrap;
  margin-right: auto;
}
.oie-tab-inline-checkbox input {
  cursor: pointer;
  accent-color: var(--oie-primary);
  margin: 0;
}
.oie-sub-tab {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--oie-text-3);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
  margin-bottom: -1px;
  user-select: none;
}
.oie-sub-tab:hover { color: var(--oie-text); }
.oie-sub-tab.active {
  color: var(--oie-primary);
  border-bottom-color: var(--oie-primary);
}
.oie-toolbar-group {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  margin-bottom: 4px;
  flex-wrap: wrap;
}
.oie-footer-hint {
  font-size: 11px;
  color: var(--oie-text-3);
  flex: 1;
  line-height: 1.4;
}

.oie-code-view {
  font: 12px/1.6 'JetBrains Mono', 'Consolas', 'Menlo', monospace;
  white-space: pre-wrap;
  word-break: break-word;
  background: var(--oie-bg-alt);
  border: 1px solid var(--oie-border);
  border-radius: 6px;
  padding: 10px 12px;
  min-height: 180px;
  max-height: 360px;
  overflow: auto;
  color: var(--oie-text);
}
.oie-preview-view {
  background: var(--oie-bg-alt);
  border: 1px solid var(--oie-border);
  border-radius: 6px;
  padding: 10px 12px;
  min-height: 180px;
  max-height: 360px;
  overflow: auto;
  font-size: 13px;
  line-height: 1.7;
  color: var(--oie-text);
}
.oie-preview-view ul, .oie-preview-view ol {
  margin: 4px 0 4px 20px;
}
.oie-preview-view li { margin: 2px 0; }
.oie-preview-view p { margin: 4px 0; }
.oie-preview-view h1, .oie-preview-view h2, .oie-preview-view h3 {
  color: var(--oie-text);
  font-weight: 600;
  margin: 8px 0 4px 0;
}
.oie-preview-view strong { color: var(--oie-text); }
.oie-preview-view code {
  background: var(--oie-bg-fill);
  color: var(--oie-text);
  padding: 1px 4px;
  border-radius: 3px;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 12px;
}
.oie-preview-placeholder {
  color: var(--oie-text-3);
  font-size: 13px;
  text-align: center;
  padding: 40px 20px;
  display: block;
}
.oie-preview-syntax {
  background: var(--oie-bg-fill);
  color: var(--oie-text);
  padding: 1px 6px;
  border-radius: 3px;
  font-family: 'JetBrains Mono', 'Consolas', 'Menlo', monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  display: inline;
}

.oie-headbar-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: inherit;
  transition: all 0.15s;
  position: relative;
  background: none;
  border: 1px solid transparent;
}
.oie-headbar-btn:hover {
  background: rgba(99, 102, 241, 0.08);
  color: var(--oie-primary);
}
.oie-headbar-btn:focus-visible {
  outline: 2px solid var(--oie-primary);
  outline-offset: 1px;
}
.oie-headbar-btn[aria-expanded="true"] {
  background: var(--oie-primary-light, rgba(99, 102, 241, 0.12));
  color: var(--oie-primary);
}
.oie-headbar-btn-icon {
  font-size: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.oie-headbar-btn-icon svg { width: 18px; height: 18px; }

.oie-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: var(--oie-bg);
  color: var(--oie-text);
  border-radius: 8px;
  box-shadow: var(--oie-shadow);
  border: 1px solid var(--oie-border);
  min-width: 180px;
  z-index: 100000;
  overflow: hidden;
  animation: oie-dropdown-in 0.12s ease;
  font-size: 13px;
}
@keyframes oie-dropdown-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
.oie-dropdown-item {
  display: flex; align-items: center; gap: 8px;
  padding: 9px 14px;
  cursor: pointer;
  font-size: 13px;
  color: var(--oie-text);
  transition: background 0.12s;
  line-height: 1.4;
  outline: none;
}
.oie-dropdown-item:hover,
.oie-dropdown-item:focus-visible {
  background: var(--oie-bg-fill);
}
.oie-dropdown-item:focus-visible {
  box-shadow: inset 2px 0 0 0 var(--oie-primary);
}
.oie-dropdown-item-icon {
  font-size: 16px;
  color: var(--oie-primary);
  width: 18px;
  text-align: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.oie-dropdown-item-icon svg { width: 16px; height: 16px; }
.oie-dropdown-divider {
  height: 1px;
  background: var(--oie-border-light);
  margin: 0;
}

.oie-context-menu {
  position: fixed;
  background: var(--oie-bg);
  color: var(--oie-text);
  border-radius: 8px;
  box-shadow: var(--oie-shadow);
  border: 1px solid var(--oie-border);
  min-width: 200px;
  z-index: 100001;
  overflow: hidden;
  animation: oie-dropdown-in 0.1s ease;
  font-size: 13px;
}
.oie-context-menu-header {
  padding: 7px 14px;
  font-size: 11px;
  font-weight: 600;
  color: var(--oie-text-3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: var(--oie-bg-alt);
  border-bottom: 1px solid var(--oie-border-light);
}

/* 高亮语法预览样式 */
.oie-preview-view .orca-inline.bc.bcc-red { background: #ff4d4f; border-radius: 2px; padding: 0 2px; color: #fff; }
.oie-preview-view .orca-inline.bc.bcc-blue { background: #fdbfff; border-radius: 2px; padding: 0 2px; }
.oie-preview-view .orca-inline.bc.bcc-green { background: #affad1; border-radius: 2px; padding: 0 2px; }
.oie-preview-view .orca-inline.bc.bcc-yellow { background: #fff3a0; border-radius: 2px; padding: 0 2px; }
.oie-preview-view .orca-inline.fc.fcc-red { color: #F36208; font-weight: 600; }
.oie-preview-view .orca-inline.fc.fcc-blue { color: #8a2be2; font-weight: 600; }
.oie-preview-view .orca-inline.fc.fcc-green { color: #1ddd08; font-weight: 600; }
.oie-preview-view .orca-inline.h { background: #ffeb3b; border-radius: 2px; padding: 0 2px; }

/* SiYuan (思源笔记) 高亮预览样式 */
.oie-preview-view [data-type="mark"] { background: #ffeb3b; border-radius: 2px; padding: 0 2px; }
.oie-preview-view [data-type="backgroundColor"] { border-radius: 2px; padding: 0 2px; }
.oie-preview-view [data-type="color"] { font-weight: 600; }
/* SiYuan CSS 变量预览 (与思源默认主题颜色接近) */
.oie-preview-view [style*="b3-font-background1"] { background: #ffe4e4 !important; }
.oie-preview-view [style*="b3-font-background3"] { background: #fff3a0 !important; }
.oie-preview-view [style*="b3-font-background4"] { background: #affad1 !important; }
.oie-preview-view [style*="b3-font-background6"] { background: #fdbfff !important; }
.oie-preview-view [style*="b3-font-color1"] { color: #F36208 !important; }
.oie-preview-view [style*="b3-font-color3"] { color: #b88a00 !important; }
.oie-preview-view [style*="b3-font-color4"] { color: #1ddd08 !important; }
.oie-preview-view [style*="b3-font-color6"] { color: #8a2be2 !important; }

/* 基础 HTML 标签样式 (fragsToBasicHTML 输出) */
/* 只重置没有 inline style 的 mark，避免覆盖 fragsToBasicHTML 的颜色 */
.oie-preview-view mark:not([style]) {
  background: #ffeb3b;
  color: inherit;
  padding: 0 2px;
  border-radius: 2px;
}
.oie-preview-view .cloze {
  background: #ffeb3b;
  border-radius: 2px;
  padding: 0 2px;
}

/* 导入成功后块高亮动画 */
.oie-import-highlight {
  animation: oie-import-pulse 1.5s ease-in-out;
}
@keyframes oie-import-pulse {
  0% { box-shadow: inset 4px 0 0 0 rgba(51, 112, 255, 0.8); }
  50% { box-shadow: inset 4px 0 0 0 rgba(51, 112, 255, 0.2); }
  100% { box-shadow: inset 4px 0 0 0 rgba(51, 112, 255, 0); }
}

/* 样式设置：富文本 / 挖空 并排两列，挖空语法整行排列 */
.oie-style-config {
  grid-template-columns: auto 1fr;
  align-items: start;
  gap: 12px 16px;
}
.oie-style-config .oie-opt-group {
  min-width: 0;
}
.oie-style-config .oie-opt-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
}
.oie-style-config .oie-cloze-syntax-group {
  margin-top: 4px;
  padding: 6px 10px;
  background: var(--oie-bg-fill);
  border-radius: 4px;
  border: 1px solid var(--oie-border-light);
}
@media (max-width: 520px) {
  .oie-style-config {
    grid-template-columns: 1fr;
  }
}

/* 进度浮层 - 科技感设计 */
.oie-progress-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: radial-gradient(ellipse at center, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.35) 100%);
  backdrop-filter: blur(12px) saturate(1.3);
  -webkit-backdrop-filter: blur(12px) saturate(1.3);
  z-index: 100000;
  display: flex; align-items: center; justify-content: center;
  animation: oie-fade-in 0.3s ease;
}
.oie-progress-card {
  position: relative;
  background: linear-gradient(135deg, 
    rgba(255,255,255,0.12) 0%, 
    rgba(255,255,255,0.08) 50%,
    rgba(255,255,255,0.04) 100%);
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: 24px;
  padding: 28px 32px;
  min-width: 380px; max-width: 520px; width: 90%;
  box-shadow:
    0 32px 80px rgba(0,0,0,0.25),
    0 0 0 1px rgba(255,255,255,0.1) inset,
    0 0 60px rgba(51,112,255,0.15),
    0 0 120px rgba(51,112,255,0.08);
  backdrop-filter: blur(24px) saturate(1.8);
  -webkit-backdrop-filter: blur(24px) saturate(1.8);
  animation: oie-scale-in 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}
/* 科技感光晕边框 */
.oie-progress-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 24px;
  padding: 1px;
  background: linear-gradient(135deg, 
    rgba(51,112,255,0.4) 0%, 
    rgba(122,170,255,0.2) 25%,
    transparent 50%,
    rgba(122,170,255,0.2) 75%,
    rgba(51,112,255,0.4) 100%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  animation: oie-border-glow 3s ease-in-out infinite;
}
@keyframes oie-border-glow {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
/* 背景粒子效果 */
.oie-progress-card::after {
  content: '';
  position: absolute;
  top: -50%; left: -50%;
  width: 200%; height: 200%;
  background: 
    radial-gradient(circle at 20% 30%, rgba(51,112,255,0.15) 0%, transparent 40%),
    radial-gradient(circle at 80% 70%, rgba(122,170,255,0.1) 0%, transparent 40%),
    radial-gradient(circle at 50% 50%, rgba(255,255,255,0.05) 0%, transparent 60%);
  animation: oie-particles 8s ease-in-out infinite;
  pointer-events: none;
}
@keyframes oie-particles {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  33% { transform: translate(2%, 2%) rotate(120deg); }
  66% { transform: translate(-2%, -2%) rotate(240deg); }
}
@keyframes oie-scale-in {
  from { transform: scale(0.92); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.oie-progress-header {
  position: relative;
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 18px;
  gap: 12px;
  z-index: 1;
}
.oie-progress-title {
  font-size: 15px; font-weight: 600;
  color: var(--oie-text);
  display: flex; align-items: center; gap: 12px;
  text-shadow: 0 1px 2px rgba(0,0,0,0.1);
}
.oie-progress-title svg {
  width: 20px; height: 20px;
  flex-shrink: 0;
  filter: drop-shadow(0 0 8px rgba(51,112,255,0.5));
}
.oie-progress-spinner {
  color: var(--oie-primary);
  animation: oie-spin 1s linear infinite;
}
.oie-progress-spinner svg {
  stroke-dasharray: 60;
  stroke-dashoffset: 0;
  animation: oie-spinner-dash 1.2s ease-in-out infinite;
}
@keyframes oie-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes oie-spinner-dash {
  0% { stroke-dashoffset: 60; }
  50% { stroke-dashoffset: 15; }
  100% { stroke-dashoffset: 60; }
}
.oie-progress-success {
  color: var(--oie-success);
  animation: oie-scale-pop 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  filter: drop-shadow(0 0 12px rgba(0,180,42,0.6));
}
@keyframes oie-scale-pop {
  from { transform: scale(0.5); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.oie-progress-percent {
  font-size: 16px; font-weight: 700;
  color: var(--oie-primary);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 0 10px rgba(51,112,255,0.4);
  z-index: 1;
}
.oie-progress-track {
  position: relative;
  width: 100%; height: 10px;
  background: linear-gradient(90deg, 
    rgba(255,255,255,0.08) 0%, 
    rgba(255,255,255,0.04) 100%);
  border-radius: 999px;
  overflow: hidden;
  box-shadow: 
    inset 0 1px 3px rgba(0,0,0,0.1),
    0 1px 0 rgba(255,255,255,0.05);
  z-index: 1;
}
.oie-progress-fill {
  height: 100%; width: 0%;
  background: linear-gradient(90deg, 
    var(--oie-primary) 0%, 
    #7aaaff 50%,
    #a8d4ff 100%);
  border-radius: 999px;
  transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
  box-shadow: 
    0 0 16px rgba(51,112,255,0.6),
    0 0 32px rgba(51,112,255,0.3),
    inset 0 1px 0 rgba(255,255,255,0.3);
}
.oie-progress-fill::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 50%;
  background: linear-gradient(180deg, 
    rgba(255,255,255,0.4) 0%, 
    rgba(255,255,255,0) 100%);
  border-radius: 999px 999px 0 0;
}
.oie-progress-fill::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(90deg, 
    transparent 0%, 
    rgba(255,255,255,0.5) 50%, 
    transparent 100%);
  animation: oie-progress-shimmer 1.5s ease-in-out infinite;
}
@keyframes oie-progress-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
}
.oie-progress-meta {
  position: relative;
  display: flex; justify-content: space-between; align-items: center;
  margin-top: 14px;
  font-size: 12px; color: var(--oie-text-3);
  z-index: 1;
}
.oie-progress-status { 
  color: var(--oie-text-2);
  text-shadow: 0 1px 2px rgba(0,0,0,0.1);
}
.oie-progress-card.is-complete .oie-progress-fill {
  background: linear-gradient(90deg, 
    var(--oie-success) 0%, 
    #5cd380 50%,
    #8ee8a8 100%);
  box-shadow: 
    0 0 20px rgba(0,180,42,0.5),
    0 0 40px rgba(0,180,42,0.25),
    inset 0 1px 0 rgba(255,255,255,0.3);
}
.oie-progress-card.is-complete .oie-progress-percent {
  color: var(--oie-success);
  text-shadow: 0 0 12px rgba(0,180,42,0.5);
}
.oie-progress-card.is-complete::before {
  background: linear-gradient(135deg, 
    rgba(0,180,42,0.5) 0%, 
    rgba(92,211,128,0.3) 50%,
    rgba(0,180,42,0.5) 100%);
}
.oie-progress-header-right {
  display: flex; align-items: center; gap: 12px;
  z-index: 1;
}
.oie-progress-cancel {
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.2);
  background: rgba(255,255,255,0.08);
  color: var(--oie-text);
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
  line-height: 1.4;
  white-space: nowrap;
  backdrop-filter: blur(8px);
}
.oie-progress-cancel:hover {
  background: rgba(247,49,73,0.15);
  border-color: rgba(247,49,73,0.4);
  color: #f73149;
}
.oie-progress-cancel:active { transform: scale(0.96); }
.oie-progress-cancel:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: rgba(255,255,255,0.04);
  color: var(--oie-text-3);
}
.oie-progress-card.is-cancelling .oie-progress-fill {
  background: linear-gradient(90deg, #f73149 0%, #ff7a8a 100%) !important;
  box-shadow: 0 0 16px rgba(247,49,73,0.4) !important;
  animation: oie-cancelling-shimmer 0.6s ease-in-out infinite;
}
.oie-progress-card.is-cancelling .oie-progress-spinner {
  color: #f73149;
  animation: oie-spin 0.6s linear infinite;
}
@keyframes oie-cancelling-shimmer {
  0% { opacity: 0.4; }
  50% { opacity: 1; }
  100% { opacity: 0.4; }
}
`;
let styleInjected = false;
function injectStyles() {
  if (styleInjected) return;
  const style = document.createElement("style");
  style.dataset.role = "orca-import-export";
  style.textContent = DIALOG_STYLES;
  document.head.appendChild(style);
  styleInjected = true;
}
function removeStyles() {
  const styles = document.querySelectorAll('style[data-role="orca-import-export"]');
  styles.forEach((s) => s.remove());
  styleInjected = false;
}
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  let hasTextContent = false;
  let hasIcon = false;
  for (const [key, value] of Object.entries(props)) {
    if (value === void 0 || value === null || value === false) continue;
    if (key === "className") node.className = value;
    else if (key === "style" && typeof value === "object") Object.assign(node.style, value);
    else if (key === "innerHTML") {
      node.innerHTML = value;
      hasTextContent = true;
    } else if (key === "textContent") {
      node.textContent = value;
      hasTextContent = true;
    } else if (key === "icon" && typeof value === "string") {
      const span = document.createElement("span");
      span.className = "oie-icon-span";
      span.style.display = "inline-flex";
      span.style.alignItems = "center";
      span.style.justifyContent = "center";
      span.innerHTML = ICONS[value] || value;
      node.appendChild(span);
      hasIcon = true;
    } else if (key.startsWith("on") && typeof value === "function") {
      const eventName = key.slice(2).toLowerCase();
      node.addEventListener(eventName, value);
    } else if (value === true) {
      node.setAttribute(key, "");
    } else {
      node.setAttribute(key, String(value));
    }
  }
  if (!hasTextContent && !hasIcon) {
    for (const child of children) {
      if (child === null || child === void 0) continue;
      if (Array.isArray(child)) {
        for (const c of child) {
          if (c === null || c === void 0) continue;
          if (typeof c === "string") node.appendChild(document.createTextNode(c));
          else node.appendChild(c);
        }
      } else if (typeof child === "string") {
        node.appendChild(document.createTextNode(child));
      } else {
        node.appendChild(child);
      }
    }
  }
  return node;
}
function setIcon(element, iconName) {
  const svgString = ICONS[iconName];
  if (!svgString) return;
  element.innerHTML = "";
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, "image/svg+xml");
  const svg = doc.documentElement;
  if (svg && svg.tagName.toLowerCase() === "svg") {
    svg.setAttribute("width", "1em");
    svg.setAttribute("height", "1em");
    svg.style.display = "inline-block";
    svg.style.verticalAlign = "middle";
    element.appendChild(svg);
  }
}
function countNodes(tree) {
  let count = 0;
  for (const node of tree) {
    count++;
    count += countNodes(node.children);
  }
  return count;
}
function stripHighlightFromTree(tree) {
  return tree.map((node) => ({
    ...node,
    fragments: [{ t: "t", v: node.fragments.map((f) => String(f.v ?? "")).join("") }],
    children: stripHighlightFromTree(node.children)
  }));
}
function showStatusHintIn(container, text, type = "info", durationMs = 2200) {
  const old = container.querySelector(".oie-status-hint");
  if (old) old.remove();
  const hint = el("div", {
    className: `oie-status-hint oie-status-${type}`,
    textContent: text
  });
  hint.style.cssText = `
    position: relative; padding: 6px 12px; margin: 4px 0;
    border-radius: 4px; font-size: 12px; line-height: 1.4;
    background: ${type === "success" ? "rgba(46,160,67,0.12)" : type === "warn" ? "rgba(212,160,4,0.12)" : type === "error" ? "rgba(247,49,73,0.12)" : "rgba(51,112,255,0.12)"};
    color: ${type === "success" ? "#2ea043" : type === "warn" ? "#b88a00" : type === "error" ? "#f73149" : "#3370ff"};
    border: 1px solid ${type === "success" ? "rgba(46,160,67,0.3)" : type === "warn" ? "rgba(212,160,4,0.3)" : type === "error" ? "rgba(247,49,73,0.3)" : "rgba(51,112,255,0.3)"};
    animation: oie-hint-fade 0.2s ease;
  `;
  container.appendChild(hint);
  setTimeout(() => {
    hint.style.transition = "opacity 0.3s ease";
    hint.style.opacity = "0";
    setTimeout(() => hint.remove(), 300);
  }, durationMs);
}
async function downloadFile(content, filename, mimeType) {
  const extension = filename.split(".").pop() || "";
  if ("showSaveFilePicker" in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: extension ? [{
          description: "导出文件",
          accept: { [mimeType]: [`.${extension}`] }
        }] : void 0
      });
      const writable = await handle.createWritable();
      await writable.write(new Blob([content], { type: mimeType }));
      await writable.close();
      return "downloaded";
    } catch (err) {
      if ((err == null ? void 0 : err.name) === "AbortError") {
        return "cancelled";
      }
      console.warn("[OIE] showSaveFilePicker failed:", err);
    }
  }
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return "downloaded";
  } catch (err) {
    console.warn("[OIE] <a download> failed:", err);
  }
  return "failed";
}
function createProgressOverlay(title) {
  injectStyles();
  const fill = el("div", { className: "oie-progress-fill" });
  const track = el("div", { className: "oie-progress-track" }, fill);
  const statusEl = el("span", { className: "oie-progress-status", textContent: "正在处理..." });
  const countEl = el("span", { className: "oie-progress-count", textContent: "0 / 0" });
  const percentEl = el("span", { className: "oie-progress-percent", textContent: "0%" });
  const iconEl = el("span", { icon: "spinner", className: "oie-progress-spinner" });
  const titleText = el("span", { textContent: title });
  const cancelBtn = el("button", {
    className: "oie-progress-cancel",
    type: "button",
    title: "取消当前操作",
    "aria-label": "取消",
    onclick: () => {
      if (abortController && !abortController.signal.aborted) {
        abortController.abort("user-cancel");
        statusEl.textContent = "正在取消...";
        cancelBtn.disabled = true;
        cancelBtn.textContent = "取消中";
        card.classList.add("is-cancelling");
      }
    }
  }, "取消");
  cancelBtn.style.display = "none";
  const card = el(
    "div",
    { className: "oie-progress-card" },
    el(
      "div",
      { className: "oie-progress-header" },
      el(
        "div",
        { className: "oie-progress-title" },
        iconEl,
        titleText
      ),
      el(
        "div",
        { className: "oie-progress-header-right" },
        percentEl,
        cancelBtn
      )
    ),
    track,
    el("div", { className: "oie-progress-meta" }, statusEl, countEl)
  );
  const overlay = el("div", { className: "oie-progress-overlay oie-themed" }, card);
  document.body.appendChild(overlay);
  let abortController = null;
  return {
    el: overlay,
    update(current, total, status) {
      const pct = total > 0 ? Math.min(100, Math.round(current / total * 100)) : 0;
      fill.style.width = pct + "%";
      percentEl.textContent = pct + "%";
      countEl.textContent = `${current} / ${total}`;
      if (status) statusEl.textContent = status;
    },
    close() {
      abortController = null;
      cancelBtn.style.display = "none";
      fill.style.width = "100%";
      statusEl.textContent = "完成";
      percentEl.textContent = "100%";
      card.classList.remove("is-cancelling");
      card.classList.add("is-complete");
      iconEl.innerHTML = ICONS.checkCircle;
      iconEl.classList.remove("oie-progress-spinner");
      iconEl.classList.add("oie-progress-success");
      titleText.textContent = title + "完成";
      overlay.style.opacity = "0";
      overlay.style.transition = "opacity 0.3s ease";
      setTimeout(() => overlay.remove(), 300);
    },
    setCancellable(cancellable) {
      if (cancellable) {
        abortController = new AbortController();
        cancelBtn.style.display = "";
        cancelBtn.disabled = false;
        cancelBtn.textContent = "取消";
        return abortController.signal;
      } else {
        abortController = null;
        cancelBtn.style.display = "none";
        return new AbortController().signal;
      }
    },
    isCancelled() {
      return !!(abortController == null ? void 0 : abortController.signal.aborted);
    }
  };
}
function showImportDialog(onImport) {
  const existingImport = document.getElementById("oie-import-dialog-overlay");
  if (existingImport) existingImport.remove();
  try {
    injectStyles();
  } catch (err) {
    orca.notify("error", `样式注入失败: ${err}`);
    return;
  }
  let fileContent = "";
  let fileName = "";
  let detectedFormat = "";
  let manualFormat = "auto";
  let parsedTree = [];
  let preparedText = "";
  let sourceFormat = "auto";
  let formatOption = "unordered";
  let importSubTab = "preview";
  const settings = getSettings();
  let clozeMode = settings.clozeMode;
  let clozeSyntax = settings.clozeSyntax || ["bold"];
  let convertHighlight = true;
  try {
    let updateDropZone = function() {
      dropZone.className = "oie-file-drop" + (fileName ? " has-file" : "");
      setIcon(dropIcon, fileName ? "fileCheck" : "upload");
      dropText.innerHTML = "";
      if (dropHint.parentElement) dropHint.remove();
      if (fileName) {
        const fileNameSpan = el("span", { className: "oie-file-name", textContent: fileName });
        dropText.appendChild(fileNameSpan);
        if (detectedFormat) {
          dropText.appendChild(el("span", { className: "oie-format-badge", textContent: detectedFormat }));
        }
      } else {
        dropText.textContent = "点击选择文件或拖拽文件到此处";
        dropZone.appendChild(dropHint);
      }
    }, handleFileSelect = function(file) {
      if (file.size > MAX_FILE_SIZE) {
        orca.notify("error", `文件过大 (${(file.size / 1024 / 1024).toFixed(1)} MB)，最大支持 50 MB`, { title: "导入错误" });
        return;
      }
      const textExts = [".md", ".txt", ".opml", ".xml", ".json", ".markdown", ".csv", ".org"];
      const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
      if (file.type && !file.type.startsWith("text/") && file.type !== "application/json" && file.type !== "application/xml" && file.type !== "text/xml") {
        if (!textExts.includes(ext)) {
          orca.notify("error", "不支持的文件类型，请选择文本文件 (.md/.txt/.opml/.json)", { title: "导入错误" });
          return;
        }
      }
      const currentSeq = ++fileReadSeq;
      const reader = new FileReader();
      reader.onload = (e) => {
        var _a;
        if (currentSeq !== fileReadSeq) return;
        fileContent = (_a = e.target) == null ? void 0 : _a.result;
        if (fileContent.charCodeAt(0) === 65279) {
          fileContent = fileContent.slice(1);
        }
        if (!fileContent.trim()) {
          orca.notify("warn", "文件内容为空", { title: "导入提示" });
          return;
        }
        fileName = file.name;
        preparedText = preprocessForImport(fileContent);
        detectedFormat = detectFormat(fileContent);
        sourceFormat = getHighlightSource(detectedFormat, preparedText);
        try {
          parsedTree = parseFile(fileContent, manualFormat === "auto" ? void 0 : manualFormat);
        } catch (err) {
          parsedTree = [];
          orca.notify("error", `文件解析失败: ${err instanceof Error ? err.message : String(err)}`, { title: "导入错误" });
        }
        updateDropZone();
        updateParsedSection();
      };
      reader.onerror = () => {
        if (currentSeq !== fileReadSeq) return;
        orca.notify("error", "文件读取失败", { title: "导入错误" });
      };
      reader.readAsText(file);
    }, updateImportBtn = function() {
      importBtn.disabled = parsedTree.length === 0;
    }, close = function() {
      overlay.remove();
    };
    const overlay = el("div", { className: "oie-overlay oie-themed", id: "oie-import-dialog-overlay" });
    overlay.addEventListener("click", () => close());
    const dialog = el("div", { className: "oie-dialog" });
    dialog.addEventListener("click", (e) => e.stopPropagation());
    overlay.appendChild(dialog);
    const header = el(
      "div",
      { className: "oie-dialog-header" },
      el(
        "div",
        { className: "oie-dialog-title", id: "oie-import-dialog-title" },
        el("span", { icon: "upload" }),
        el("span", { textContent: "导入文件" })
      ),
      el(
        "button",
        {
          className: "oie-dialog-close",
          title: "关闭 (Esc)",
          "aria-label": "关闭",
          onClick: close
        },
        el("span", { icon: "close" })
      )
    );
    dialog.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "Enter" && parsedTree.length > 0) {
        const target = e.target;
        if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA")) {
          return;
        }
        e.preventDefault();
        importBtn.click();
      } else if (e.key === "Tab") {
        const focusable = dialog.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "oie-import-dialog-title");
    dialog.tabIndex = -1;
    const body = el("div", { className: "oie-dialog-body" });
    const fileInput = el("input", {
      type: "file",
      style: { display: "none" },
      accept: ".md,.txt,.opml,.xml,.json"
    });
    const dropZone = el("div", { className: "oie-file-drop" });
    const dropIcon = el("div", { className: "oie-file-drop-icon", innerHTML: ICONS.upload });
    const dropText = el("div", { className: "oie-file-drop-text", textContent: "点击选择文件或拖拽文件到此处" });
    const dropHint = el("div", {
      style: { fontSize: "11px", color: "var(--oie-text-3)", marginTop: "4px" },
      textContent: "支持 .md / .txt / .opml / .json (自动检测 Logseq / Obsidian / Orca Note 富文本语法)"
    });
    dropZone.append(dropIcon, dropText, dropHint, fileInput);
    const pasteBtn = el(
      "button",
      {
        className: "oie-btn oie-btn-secondary oie-btn-sm",
        style: { marginTop: "8px", width: "100%" }
      },
      el("span", { icon: "copy" }),
      el("span", { textContent: "从剪贴板粘贴文本" })
    );
    updateDropZone();
    dropZone.addEventListener("click", () => fileInput.click());
    let dragCounter = 0;
    const dropHintActive = el("div", { className: "oie-file-drop-hint-active", textContent: "释放鼠标导入" });
    let dropHintActiveAppended = false;
    const showDragOver = () => {
      if (dropHint.parentElement) dropHint.remove();
      if (!dropHintActiveAppended) {
        dropZone.appendChild(dropHintActive);
        dropHintActiveAppended = true;
      }
    };
    const hideDragOver = () => {
      if (dropHintActiveAppended) {
        dropHintActive.remove();
        dropHintActiveAppended = false;
      }
    };
    dropZone.addEventListener("dragenter", (e) => {
      e.preventDefault();
      dragCounter++;
      dropZone.classList.add("drag-over");
      if (dragCounter === 1) showDragOver();
    });
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    });
    dropZone.addEventListener("dragleave", (e) => {
      e.preventDefault();
      dragCounter = Math.max(0, dragCounter - 1);
      if (dragCounter === 0) {
        dropZone.classList.remove("drag-over");
        hideDragOver();
        updateDropZone();
      }
    });
    dropZone.addEventListener("drop", (e) => {
      var _a;
      e.preventDefault();
      dragCounter = 0;
      dropZone.classList.remove("drag-over");
      hideDragOver();
      const file = (_a = e.dataTransfer) == null ? void 0 : _a.files[0];
      if (file) handleFileSelect(file);
      else updateDropZone();
    });
    fileInput.addEventListener("change", (e) => {
      var _a;
      const file = (_a = e.target.files) == null ? void 0 : _a[0];
      if (file) handleFileSelect(file);
    });
    pasteBtn.addEventListener("click", async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (!text || !text.trim()) {
          orca.notify("warn", "剪贴板为空", { title: "导入提示" });
          return;
        }
        fileContent = text;
        fileName = "(粘贴内容)";
        preparedText = preprocessForImport(text);
        detectedFormat = detectFormat(fileContent);
        sourceFormat = getHighlightSource(detectedFormat, preparedText);
        try {
          parsedTree = parseFile(fileContent, manualFormat === "auto" ? void 0 : manualFormat);
        } catch (err) {
          parsedTree = [];
          orca.notify("error", `文件解析失败: ${err instanceof Error ? err.message : String(err)}`, { title: "导入错误" });
        }
        updateDropZone();
        updateParsedSection();
        orca.notify("success", "已从剪贴板粘贴", { title: "导入" });
      } catch {
        orca.notify("error", "无法读取剪贴板", { title: "导入错误" });
      }
    });
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    let fileReadSeq = 0;
    const parsedSection = el("div");
    parsedSection.style.display = "none";
    const importBtn = el(
      "button",
      { className: "oie-btn oie-btn-primary oie-btn-sm", disabled: true },
      el("span", { icon: "download" }),
      el("span", { textContent: "导入" })
    );
    importBtn.addEventListener("click", () => {
      if (parsedTree.length === 0) {
        orca.notify("warn", "请先选择文件", { title: "导入提示" });
        return;
      }
      const tree = parsedTree;
      const fmt = formatOption;
      const currentClozeMode = clozeMode;
      const currentClozeSyntax = clozeSyntax;
      const currentConvertHighlight = convertHighlight;
      close();
      setTimeout(() => {
        onImport(tree, fmt, currentClozeMode, currentClozeSyntax, preparedText, sourceFormat, currentConvertHighlight);
      }, 0);
    });
    const updateParsedSection = function() {
      parsedSection.style.display = parsedTree.length > 0 ? "block" : "none";
      parsedSection.innerHTML = "";
      if (parsedTree.length === 0) {
        updateImportBtn();
        return;
      }
      parsedSection.appendChild(
        el(
          "div",
          { className: "oie-info-bar" },
          el("span", { icon: "info" }),
          el("span", { textContent: `已解析 ${countNodes(parsedTree)} 个节点，富文本语法已自动转换为 Orca 原生格式` })
        )
      );
      const importFormatConfig = el("div", { className: "oie-config-bar" });
      const importFormatSelect = el(
        "select",
        { className: "oie-select" },
        [
          el("option", { value: "auto", textContent: "自动检测" }),
          el("option", { value: "markdown", textContent: "Markdown" }),
          el("option", { value: "unordered", textContent: "无序列表大纲" }),
          el("option", { value: "ordered", textContent: "有序列表大纲" }),
          el("option", { value: "json", textContent: "JSON" }),
          el("option", { value: "logseq", textContent: "Logseq" }),
          el("option", { value: "obsidian", textContent: "Obsidian" }),
          el("option", { value: "orca", textContent: "Orca Note" }),
          el("option", { value: "siyuan", textContent: "SiYuan (思源)" }),
          el("option", { value: "plaintext", textContent: "纯文本" })
        ]
      );
      importFormatSelect.value = manualFormat;
      importFormatSelect.addEventListener("change", () => {
        manualFormat = importFormatSelect.value;
        if (fileContent) {
          try {
            parsedTree = parseFile(fileContent, manualFormat === "auto" ? void 0 : manualFormat);
            preparedText = preprocessForImport(fileContent);
            detectedFormat = detectFormat(fileContent);
            sourceFormat = getHighlightSource(detectedFormat, preparedText);
          } catch (err) {
            parsedTree = [];
            orca.notify("error", `文件解析失败: ${err instanceof Error ? err.message : String(err)}`, { title: "导入错误" });
          }
          updateParsedSection();
        }
      });
      importFormatConfig.append(
        el(
          "div",
          { className: "oie-opt-group" },
          el("label", { className: "oie-opt-label", textContent: "导入格式" }),
          importFormatSelect
        )
      );
      parsedSection.appendChild(importFormatConfig);
      parsedSection.appendChild(
        el(
          "div",
          { className: "oie-section-label" },
          el("span", { icon: "settings" }),
          el("span", { textContent: "导入格式" })
        )
      );
      const optionGroup = el("div", { className: "oie-option-group" });
      const formatOptions = [
        { id: "unordered", label: "无序列表", desc: "使用 - 符号的层级大纲", icon: "list" },
        { id: "ordered", label: "有序列表", desc: "使用 1. 2. 3. 的层级大纲", icon: "listNumbers" },
        { id: "markdown", label: "Markdown", desc: "使用 # 标题的层级结构", icon: "markdown" }
      ];
      for (const opt of formatOptions) {
        const card = el(
          "div",
          { className: "oie-option-card" + (formatOption === opt.id ? " selected" : "") },
          el("div", { className: "oie-radio" }),
          el("div", { className: "oie-option-icon", icon: opt.icon }),
          el(
            "div",
            { className: "oie-option-text" },
            el("div", { className: "oie-option-label", textContent: opt.label }),
            el("div", { className: "oie-option-desc", textContent: opt.desc })
          )
        );
        card.addEventListener("click", () => {
          formatOption = opt.id;
          updateParsedSection();
          updatePreviewContent();
        });
        optionGroup.appendChild(card);
      }
      parsedSection.appendChild(optionGroup);
      const styleConfigBar = el("div", { className: "oie-config-bar oie-style-config" });
      const clozeModeCheckbox = el("input", {
        type: "checkbox",
        checked: clozeMode
      });
      const clozeModeLabel = el(
        "label",
        { className: "oie-checkbox-label" },
        clozeModeCheckbox,
        el("span", { textContent: "启用挖空" })
      );
      const CLOZE_SYNTAX_OPTIONS = [
        { value: "cloze-idx-bracket", label: "[[c1::xx]]" },
        { value: "bracket", label: "[[xx]]" },
        { value: "brace", label: "{{xx}}" },
        { value: "tortoise", label: "〖xx〗" },
        { value: "bold", label: "**xx**" },
        { value: "bold-italic", label: "***xx***" },
        { value: "italic", label: "*xx*" },
        { value: "quote", label: '"xx"' }
      ];
      const clozeSyntaxCheckboxes = [];
      const clozeSyntaxGroup = el("div", { className: "oie-cloze-syntax-group" });
      for (const opt of CLOZE_SYNTAX_OPTIONS) {
        const cb = el("input", {
          type: "checkbox",
          checked: clozeSyntax.includes(opt.value)
        });
        clozeSyntaxCheckboxes.push(cb);
        const cbLabel = el(
          "label",
          { className: "oie-cloze-syntax-item" },
          cb,
          el("span", { textContent: opt.label })
        );
        clozeSyntaxGroup.appendChild(cbLabel);
      }
      const convertHighlightCheckbox = el("input", {
        type: "checkbox",
        checked: convertHighlight
      });
      const convertHighlightLabel = el(
        "label",
        { className: "oie-checkbox-label" },
        convertHighlightCheckbox,
        el("span", { textContent: "转换富文本语法" })
      );
      styleConfigBar.append(
        // 挖空模式 + 语法选项整合为一行（富文本已移至预览/源码标签行）
        el(
          "div",
          { className: "oie-opt-group oie-opt-group-inline" },
          el("label", { className: "oie-opt-label", textContent: "挖空" }),
          clozeModeLabel,
          clozeSyntaxGroup
        )
      );
      parsedSection.appendChild(styleConfigBar);
      convertHighlightCheckbox.addEventListener("change", () => {
        convertHighlight = convertHighlightCheckbox.checked;
        updatePreviewContent();
      });
      clozeModeCheckbox.addEventListener("change", () => {
        clozeMode = clozeModeCheckbox.checked;
        clozeSyntaxGroup.style.opacity = clozeMode ? "1" : "0.4";
        clozeSyntaxGroup.style.pointerEvents = clozeMode ? "auto" : "none";
        if (clozeMode) {
          showStatusHint("挖空已启用：将在导入时按所选语法包裹", "success");
        } else {
          showStatusHint("挖空已关闭", "info");
        }
      });
      const updateClozeSyntax = () => {
        clozeSyntax = clozeSyntaxCheckboxes.map((cb, i) => cb.checked ? CLOZE_SYNTAX_OPTIONS[i].value : null).filter((v) => v !== null);
        if (clozeMode && clozeSyntax.length > 0) {
          showStatusHint(`已选 ${clozeSyntax.length} 种挖空语法：${clozeSyntax.map((s) => {
            var _a;
            return ((_a = CLOZE_SYNTAX_OPTIONS.find((o) => o.value === s)) == null ? void 0 : _a.label) || s;
          }).join(" / ")}`, "info");
        }
      };
      for (const cb of clozeSyntaxCheckboxes) {
        cb.addEventListener("change", updateClozeSyntax);
      }
      function showStatusHint(text, type = "info") {
        showStatusHintIn(parsedSection, text, type);
      }
      clozeSyntaxGroup.style.opacity = clozeMode ? "1" : "0.4";
      clozeSyntaxGroup.style.pointerEvents = clozeMode ? "auto" : "none";
      const subTabs = el("div", { className: "oie-sub-tabs oie-sub-tabs-row" });
      const richTextToggle = el(
        "label",
        { className: "oie-tab-inline-checkbox" },
        convertHighlightCheckbox,
        el("span", { textContent: "富文本" })
      );
      const previewTab = el("div", { className: "oie-sub-tab" + (importSubTab === "preview" ? " active" : ""), textContent: "预览" });
      const codeTab = el("div", { className: "oie-sub-tab" + (importSubTab === "code" ? " active" : ""), textContent: "源码" });
      subTabs.append(richTextToggle, previewTab, codeTab);
      const toolbarGroup = el("div", { className: "oie-toolbar-group" });
      toolbarGroup.appendChild(importBtn);
      subTabs.appendChild(toolbarGroup);
      previewTab.addEventListener("click", () => {
        importSubTab = "preview";
        previewTab.className = "oie-sub-tab active";
        codeTab.className = "oie-sub-tab";
        updatePreviewContent();
      });
      codeTab.addEventListener("click", () => {
        importSubTab = "code";
        codeTab.className = "oie-sub-tab active";
        previewTab.className = "oie-sub-tab";
        updatePreviewContent();
      });
      parsedSection.appendChild(subTabs);
      const previewArea = el("div");
      parsedSection.appendChild(previewArea);
      let previewDebounce = null;
      let isFirstRender = true;
      function updatePreviewContent(immediate = false) {
        if (previewDebounce !== null) {
          clearTimeout(previewDebounce);
          previewDebounce = null;
        }
        const render = () => {
          previewArea.innerHTML = "";
          if (parsedTree.length === 0) {
            previewArea.appendChild(el("div", { className: "oie-preview-placeholder", textContent: "无内容" }));
            return;
          }
          if (isFirstRender) {
            isFirstRender = false;
            doRender();
            return;
          }
          previewArea.innerHTML = "";
          const skeleton = el("div", { className: "oie-preview-skeleton" });
          for (let i = 0; i < 3; i++) {
            const line = el("div", {
              className: "oie-preview-skeleton-line",
              style: { width: 40 + i * 17 % 50 + "%" }
            });
            skeleton.appendChild(line);
          }
          previewArea.appendChild(skeleton);
          setTimeout(doRender, 80);
        };
        const doRender = () => {
          previewArea.innerHTML = "";
          if (parsedTree.length === 0) {
            previewArea.appendChild(el("div", { className: "oie-preview-placeholder", textContent: "无内容" }));
            return;
          }
          const treeForRender = convertHighlight ? parsedTree : stripHighlightFromTree(parsedTree);
          if (importSubTab === "preview") {
            const previewHTML = renderImportPreview(treeForRender, formatOption);
            previewArea.appendChild(el("div", {
              className: "oie-preview-view oie-import-preview",
              innerHTML: previewHTML || '<span class="oie-preview-placeholder">无内容</span>'
            }));
          } else {
            const codeText = renderImportCodeView(treeForRender, formatOption);
            previewArea.appendChild(el("div", {
              className: "oie-code-view",
              textContent: codeText || "无内容"
            }));
          }
        };
        if (immediate) {
          render();
        } else {
          previewDebounce = window.setTimeout(render, 120);
        }
      }
      updatePreviewContent(true);
      updateImportBtn();
    };
    body.append(dropZone, pasteBtn, parsedSection);
    const footer = el(
      "div",
      { className: "oie-dialog-footer" },
      el("span", {
        className: "oie-footer-hint",
        textContent: "提示：拖拽文件到上方区域或点击选择，也可从剪贴板粘贴"
      }),
      el("button", { className: "oie-btn oie-btn-secondary", textContent: "取消", onClick: close })
    );
    dialog.append(header, body, footer);
    document.body.appendChild(overlay);
    setTimeout(() => dialog.focus(), 50);
  } catch (err) {
    orca.notify("error", `创建导入对话框失败: ${err instanceof Error ? err.message : String(err)}`);
  }
}
function showExportDialog(tree, blockCount, sourceFormat, rootName = "orca-export") {
  const existingExport = document.getElementById("oie-export-dialog-overlay");
  if (existingExport) existingExport.remove();
  try {
    let updateFormatOptions = function() {
      formatSelect.innerHTML = "";
      const formats = FORMAT_OPTIONS[style];
      for (const fmt of formats) {
        const opt = el("option", { value: fmt.value, textContent: fmt.label });
        formatSelect.appendChild(opt);
      }
      if (!formats.some((f) => f.value === format)) {
        format = formats[0].value;
      }
      formatSelect.value = format;
    }, getOpts = function() {
      const settings = getSettings();
      return {
        style,
        format,
        richText,
        maxDepth,
        bodyMode,
        sourceFormat,
        filename,
        wordHighlightMode: settings.wordHighlightMode,
        exportClozeMode,
        exportClozeSyntax
      };
    }, updateContent = function() {
      contentArea.innerHTML = "";
      if (tree.length === 0) {
        contentArea.appendChild(el("div", { className: "oie-preview-placeholder", textContent: "无内容" }));
        return;
      }
      if (subTab === "preview") {
        const previewHTML = renderExportPreview(tree, getOpts());
        contentArea.appendChild(el("div", {
          className: "oie-preview-view",
          innerHTML: previewHTML || '<span class="oie-preview-placeholder">无内容</span>'
        }));
      } else {
        const result = exportTree(tree, getOpts());
        let text = result.content.substring(0, 5e3);
        if (result.content.length > 5e3) text += "\n\n...(内容过长，请下载完整文件)";
        contentArea.appendChild(el("div", { className: "oie-code-view", textContent: text }));
      }
    }, close = function() {
      overlay.remove();
    };
    injectStyles();
    let style = "orca";
    let format = "outline";
    let richText = true;
    let maxDepth = 6;
    let bodyMode = "include";
    let filename = rootName || "orca-export";
    let subTab = "preview";
    let exportClozeMode = false;
    let exportClozeSyntax = ["bold"];
    try {
      const settings = getSettings();
      style = settings.defaultExportStyle;
      richText = settings.defaultRichText;
      maxDepth = settings.defaultMaxDepth;
      exportClozeMode = settings.exportClozeMode;
      exportClozeSyntax = settings.exportClozeSyntax || ["bold"];
    } catch (err) {
    }
    const overlay = el("div", { className: "oie-overlay oie-themed", id: "oie-export-dialog-overlay" });
    overlay.addEventListener("click", () => close());
    const dialog = el("div", { className: "oie-dialog" });
    dialog.addEventListener("click", (e) => e.stopPropagation());
    overlay.appendChild(dialog);
    const header = el(
      "div",
      { className: "oie-dialog-header" },
      el(
        "div",
        { className: "oie-dialog-title", id: "oie-export-dialog-title" },
        el("span", { icon: "download" }),
        el("span", { textContent: "导出文件" })
      ),
      el(
        "button",
        {
          className: "oie-dialog-close",
          title: "关闭 (Esc)",
          "aria-label": "关闭",
          onClick: close
        },
        el("span", { icon: "close" })
      )
    );
    const body = el("div", { className: "oie-dialog-body" });
    dialog.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "Enter" && tree.length > 0) {
        const target = e.target;
        if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA")) {
          return;
        }
        e.preventDefault();
        exportBtn.click();
      } else if (e.key === "Tab") {
        const focusable = dialog.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "oie-export-dialog-title");
    dialog.tabIndex = -1;
    body.appendChild(
      el(
        "div",
        { className: "oie-info-bar" },
        el("span", { icon: "info" }),
        el("span", { textContent: `当前面板包含 ${blockCount} 个块，${tree.length} 个根节点` })
      )
    );
    const configBar = el("div", { className: "oie-config-bar" });
    const styleSelect = el(
      "select",
      { className: "oie-select" },
      [
        el("option", { value: "logseq", textContent: "Logseq" }),
        el("option", { value: "obsidian", textContent: "Obsidian" }),
        el("option", { value: "orca", textContent: "Orca Note" }),
        el("option", { value: "siyuan", textContent: "SiYuan (思源)" })
      ]
    );
    styleSelect.value = style;
    const formatSelect = el("select", { className: "oie-select" });
    const depthSelect = el(
      "select",
      { className: "oie-select" },
      [
        el("option", { value: "2", textContent: "H1~H2" }),
        el("option", { value: "3", textContent: "H1~H3" }),
        el("option", { value: "4", textContent: "H1~H4" }),
        el("option", { value: "6", textContent: "H1~H6" })
      ]
    );
    depthSelect.value = String(maxDepth);
    const bodyModeSelect = el(
      "select",
      { className: "oie-select" },
      [
        el("option", { value: "include", textContent: "保留正文" }),
        el("option", { value: "onlyH", textContent: "仅标题" })
      ]
    );
    bodyModeSelect.value = bodyMode;
    const richTextCheckbox = el("input", { type: "checkbox" });
    richTextCheckbox.checked = richText;
    const filenameInput = el("input", {
      type: "text",
      className: "oie-input",
      placeholder: "文件名",
      style: { width: "120px" }
    });
    filenameInput.value = filename;
    configBar.append(
      el(
        "div",
        { className: "oie-opt-group" },
        el("label", { className: "oie-opt-label", textContent: "样式" }),
        styleSelect
      ),
      el(
        "div",
        { className: "oie-opt-group" },
        el("label", { className: "oie-opt-label", textContent: "格式" }),
        formatSelect
      ),
      el(
        "div",
        { className: "oie-opt-group" },
        el("label", { className: "oie-opt-label", textContent: "最大深度" }),
        depthSelect
      ),
      el(
        "div",
        { className: "oie-opt-group" },
        el("label", { className: "oie-opt-label", textContent: "正文处理" }),
        bodyModeSelect
      ),
      el(
        "div",
        { className: "oie-opt-group" },
        el("label", { className: "oie-opt-label", textContent: "文件名" }),
        filenameInput
      )
    );
    body.appendChild(configBar);
    const EXPORT_CLOZE_SYNTAX_OPTIONS = [
      { value: "cloze-idx-bracket", label: "[[c1::xx]]" },
      { value: "bracket", label: "[[xx]]" },
      { value: "brace", label: "{{xx}}" },
      { value: "tortoise", label: "〖xx〗" },
      { value: "bold", label: "**xx**" },
      { value: "bold-italic", label: "***xx***" },
      { value: "italic", label: "*xx*" },
      { value: "quote", label: '"xx"' }
    ];
    const exportClozeModeCheckbox = el("input", {
      type: "checkbox",
      checked: exportClozeMode
    });
    const exportClozeModeLabel = el(
      "label",
      { className: "oie-checkbox-label" },
      exportClozeModeCheckbox,
      el("span", { textContent: "启用导出挖空" })
    );
    const exportClozeSyntaxCheckboxes = [];
    const exportClozeSyntaxGroup = el("div", { className: "oie-cloze-syntax-group" });
    for (const opt of EXPORT_CLOZE_SYNTAX_OPTIONS) {
      const cb = el("input", {
        type: "checkbox",
        checked: exportClozeSyntax.includes(opt.value)
      });
      exportClozeSyntaxCheckboxes.push(cb);
      const cbLabel = el(
        "label",
        { className: "oie-cloze-syntax-item" },
        cb,
        el("span", { textContent: opt.label })
      );
      exportClozeSyntaxGroup.appendChild(cbLabel);
    }
    const exportClozeRow = el(
      "div",
      { className: "oie-config-bar" },
      el(
        "div",
        { className: "oie-opt-group oie-opt-group-inline" },
        el("label", { className: "oie-opt-label", textContent: "挖空" }),
        exportClozeModeLabel,
        exportClozeSyntaxGroup
      )
    );
    body.appendChild(exportClozeRow);
    exportClozeModeCheckbox.addEventListener("change", () => {
      exportClozeMode = exportClozeModeCheckbox.checked;
      exportClozeSyntaxGroup.style.opacity = exportClozeMode ? "1" : "0.4";
      exportClozeSyntaxGroup.style.pointerEvents = exportClozeMode ? "auto" : "none";
      updateContent();
    });
    const updateExportClozeSyntax = () => {
      exportClozeSyntax = exportClozeSyntaxCheckboxes.map((cb, i) => cb.checked ? EXPORT_CLOZE_SYNTAX_OPTIONS[i].value : null).filter((v) => v !== null);
      updateContent();
    };
    for (const cb of exportClozeSyntaxCheckboxes) {
      cb.addEventListener("change", updateExportClozeSyntax);
    }
    exportClozeSyntaxGroup.style.opacity = exportClozeMode ? "1" : "0.4";
    exportClozeSyntaxGroup.style.pointerEvents = exportClozeMode ? "auto" : "none";
    const subTabs = el("div", { className: "oie-sub-tabs oie-sub-tabs-row" });
    const richTextToggle = el(
      "label",
      { className: "oie-tab-inline-checkbox" },
      richTextCheckbox,
      el("span", { textContent: "富文本" })
    );
    const previewTab = el("div", { className: "oie-sub-tab" + (subTab === "preview" ? " active" : ""), textContent: "预览" });
    const codeTab = el("div", { className: "oie-sub-tab" + (subTab === "code" ? " active" : ""), textContent: "源码" });
    subTabs.append(richTextToggle, previewTab, codeTab);
    const toolbarGroup = el("div", { className: "oie-toolbar-group" });
    let isFolded = false;
    const foldToggleBtn = el(
      "button",
      { className: "oie-btn oie-btn-ghost oie-btn-sm", title: "切换折叠状态" },
      el("span", { icon: "chevronDown" }),
      el("span", { textContent: "全部展开" })
    );
    const refreshBtn = el(
      "button",
      { className: "oie-btn oie-btn-ghost oie-btn-sm", title: "刷新预览" },
      el("span", { icon: "refresh" }),
      el("span", { textContent: "刷新" })
    );
    const copyBtn = el(
      "button",
      { className: "oie-btn oie-btn-secondary oie-btn-sm" },
      el("span", { icon: "copy" }),
      el("span", { textContent: "复制" })
    );
    const exportBtn = el(
      "button",
      { className: "oie-btn oie-btn-primary oie-btn-sm" },
      el("span", { icon: "download" }),
      el("span", { textContent: "导出" })
    );
    const cancelBtn = el("button", { className: "oie-btn oie-btn-secondary oie-btn-sm", textContent: "取消", onClick: close });
    toolbarGroup.append(foldToggleBtn, refreshBtn, copyBtn, cancelBtn, exportBtn);
    subTabs.appendChild(toolbarGroup);
    body.appendChild(subTabs);
    const contentArea = el("div");
    body.appendChild(contentArea);
    const footer = el(
      "div",
      { className: "oie-dialog-footer" },
      el("span", {
        className: "oie-footer-hint",
        textContent: "提示：在工具栏选择样式与格式，预览会实时更新"
      })
    );
    styleSelect.addEventListener("change", () => {
      style = styleSelect.value;
      updateFormatOptions();
      updateContent();
    });
    formatSelect.addEventListener("change", () => {
      format = formatSelect.value;
      updateContent();
    });
    depthSelect.addEventListener("change", () => {
      maxDepth = parseInt(depthSelect.value);
      updateContent();
    });
    bodyModeSelect.addEventListener("change", () => {
      bodyMode = bodyModeSelect.value;
      updateContent();
    });
    richTextCheckbox.addEventListener("change", () => {
      richText = richTextCheckbox.checked;
      updateContent();
    });
    filenameInput.addEventListener("input", () => {
      filename = filenameInput.value.replace(/[\\/:*?"<>|\r\n\t]/g, "_");
    });
    previewTab.addEventListener("click", () => {
      subTab = "preview";
      previewTab.className = "oie-sub-tab active";
      codeTab.className = "oie-sub-tab";
      updateContent();
    });
    codeTab.addEventListener("click", () => {
      subTab = "code";
      codeTab.className = "oie-sub-tab active";
      previewTab.className = "oie-sub-tab";
      updateContent();
    });
    refreshBtn.addEventListener("click", () => {
      refreshBtn.style.transform = "rotate(360deg)";
      setTimeout(() => {
        refreshBtn.style.transform = "";
      }, 300);
      updateContent();
      orca.notify("info", "预览已刷新");
    });
    exportBtn.addEventListener("click", () => {
      if (tree.length === 0) return;
      exportBtn.disabled = true;
      exportBtn.classList.add("oie-btn-pulse");
      orca.notify("info", "正在准备导出...", { title: "导出中" });
      setTimeout(async () => {
        try {
          const result = exportTree(tree, getOpts());
          const status = await downloadFile(result.content, result.filename + "." + result.extension, result.mimeType);
          if (status === "downloaded") {
            orca.notify("success", `已导出 ${result.filename}.${result.extension}`, { title: "导出成功" });
          } else if (status === "cancelled") {
            orca.notify("info", "已取消导出", { title: "导出取消" });
          } else {
            await navigator.clipboard.writeText(result.content);
            orca.notify("success", "下载失败，已复制到剪贴板", { title: "导出成功（剪贴板）" });
          }
        } catch (err) {
          orca.notify("error", `导出失败: ${err instanceof Error ? err.message : String(err)}`, { title: "导出错误" });
        } finally {
          exportBtn.disabled = false;
          exportBtn.classList.remove("oie-btn-pulse");
          close();
        }
      }, 100);
    });
    copyBtn.addEventListener("click", () => {
      if (tree.length === 0) return;
      const result = exportTree(tree, getOpts());
      navigator.clipboard.writeText(result.content).then(() => {
        orca.notify("success", "已复制到剪贴板");
      }).catch(() => {
        orca.notify("error", "复制失败");
      });
    });
    foldToggleBtn.addEventListener("click", async () => {
      foldToggleBtn.disabled = true;
      try {
        isFolded = !isFolded;
        await setAllBlocksFolded(isFolded);
        const iconSpan = foldToggleBtn.querySelector("span:first-child");
        const textSpan = foldToggleBtn.querySelector("span:last-child");
        if (iconSpan && textSpan) {
          if (isFolded) {
            setIcon(iconSpan, "chevronDown");
            textSpan.textContent = "全部展开";
          } else {
            setIcon(iconSpan, "chevronUp");
            textSpan.textContent = "全部折叠";
          }
        }
        setTimeout(() => updateContent(), 200);
      } finally {
        foldToggleBtn.disabled = false;
      }
    });
    updateFormatOptions();
    updateContent();
    dialog.append(header, body, footer);
    document.body.appendChild(overlay);
    setTimeout(() => dialog.focus(), 50);
  } catch (err) {
    orca.notify("error", `创建导出对话框失败: ${err instanceof Error ? err.message : String(err)}`);
  }
}
function showContextMenu(x, y, blockId, onImport, onExport, onClearEmpty) {
  injectStyles();
  const existing = document.getElementById("oie-context-menu-container");
  if (existing) existing.remove();
  const container = el("div", { id: "oie-context-menu-container" });
  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - 200);
  const menu = el(
    "div",
    {
      className: "oie-context-menu oie-themed",
      style: { left: adjustedX + "px", top: adjustedY + "px" }
    },
    el("div", { className: "oie-context-menu-header", textContent: "导入 / 导出" }),
    el(
      "div",
      { className: "oie-dropdown-item", onClick: () => {
        close();
        onImport();
      } },
      el("span", { className: "oie-dropdown-item-icon", icon: "upload" }),
      el("span", { textContent: "导入文件到此处" })
    ),
    el(
      "div",
      { className: "oie-dropdown-item", onClick: () => {
        close();
        onExport();
      } },
      el("span", { className: "oie-dropdown-item-icon", icon: "download" }),
      el("span", { textContent: "导出当前笔记" })
    ),
    el("div", { className: "oie-dropdown-divider" }),
    el(
      "div",
      { className: "oie-dropdown-item", onClick: () => {
        close();
        onClearEmpty();
      } },
      el("span", { className: "oie-dropdown-item-icon", icon: "trash" }),
      el("span", { textContent: "清除当前页空块" })
    )
  );
  container.appendChild(menu);
  document.body.appendChild(container);
  function handleClickOutside(e) {
    if (!menu.contains(e.target)) {
      close();
    }
  }
  setTimeout(() => {
    document.addEventListener("mousedown", handleClickOutside);
  }, 0);
  function close() {
    document.removeEventListener("mousedown", handleClickOutside);
    container.remove();
  }
}
const getReact = () => {
  const R = window.React;
  if (!(R == null ? void 0 : R.createElement)) {
    throw new Error("React 未就绪，headbar 按钮不可用");
  }
  return R;
};
function createHeadbarButton(onImport, onExport, onClearEmpty) {
  injectStyles();
  return getReact().createElement(HeadbarButton, { onImport, onExport, onClearEmpty });
}
function HeadbarButton({ onImport, onExport, onClearEmpty }) {
  const R = getReact();
  const [open, setOpen] = R.useState(false);
  const ref = R.useRef(null);
  R.useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const uploadIconEl = R.createElement(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      width: 16,
      height: 16,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round"
    },
    R.createElement("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }),
    R.createElement("polyline", { points: "17 8 12 3 7 8" }),
    R.createElement("line", { x1: 12, y1: 3, x2: 12, y2: 15 })
  );
  const downloadIconEl = R.createElement(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      width: 16,
      height: 16,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round"
    },
    R.createElement("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }),
    R.createElement("polyline", { points: "7 10 12 15 17 10" }),
    R.createElement("line", { x1: 12, y1: 15, x2: 12, y2: 3 })
  );
  const exchangeIconEl = R.createElement(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      width: 18,
      height: 18,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round"
    },
    R.createElement("polyline", { points: "17 1 21 5 17 9" }),
    R.createElement("path", { d: "M3 11V9a4 4 0 0 1 4-4h14" }),
    R.createElement("polyline", { points: "7 23 3 19 7 15" }),
    R.createElement("path", { d: "M21 13v2a4 4 0 0 1-4 4H3" })
  );
  const trashIconEl = R.createElement(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      width: 16,
      height: 16,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round"
    },
    R.createElement("polyline", { points: "3 6 5 6 21 6" }),
    R.createElement("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }),
    R.createElement("line", { x1: 10, y1: 11, x2: 10, y2: 17 }),
    R.createElement("line", { x1: 14, y1: 11, x2: 14, y2: 17 })
  );
  return R.createElement(
    "div",
    { ref, style: { position: "relative", display: "inline-flex" } },
    R.createElement(
      "button",
      {
        className: "oie-headbar-btn",
        onClick: () => setOpen(!open),
        title: "导入 / 导出",
        "aria-label": "导入 / 导出",
        "aria-expanded": open
      },
      R.createElement("span", {
        className: "oie-headbar-btn-icon"
      }, exchangeIconEl)
    ),
    open && R.createElement(
      "div",
      { className: "oie-dropdown", role: "menu" },
      R.createElement(
        "div",
        {
          className: "oie-dropdown-item",
          role: "menuitem",
          tabIndex: 0,
          onClick: () => {
            setOpen(false);
            onImport();
          },
          onKeyDown: (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen(false);
              onImport();
            }
          }
        },
        R.createElement("span", { className: "oie-dropdown-item-icon" }, uploadIconEl),
        R.createElement("span", null, "导入文件")
      ),
      R.createElement("div", { className: "oie-dropdown-divider" }),
      R.createElement(
        "div",
        {
          className: "oie-dropdown-item",
          role: "menuitem",
          tabIndex: 0,
          onClick: () => {
            setOpen(false);
            onExport();
          },
          onKeyDown: (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen(false);
              onExport();
            }
          }
        },
        R.createElement("span", { className: "oie-dropdown-item-icon" }, downloadIconEl),
        R.createElement("span", null, "导出文件")
      ),
      R.createElement("div", { className: "oie-dropdown-divider" }),
      R.createElement(
        "div",
        {
          className: "oie-dropdown-item",
          role: "menuitem",
          tabIndex: 0,
          onClick: () => {
            setOpen(false);
            onClearEmpty();
          },
          onKeyDown: (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen(false);
              onClearEmpty();
            }
          }
        },
        R.createElement("span", { className: "oie-dropdown-item-icon" }, trashIconEl),
        R.createElement("span", null, "清除当前页空块")
      )
    )
  );
}
let pluginName;
let capturedCursor = null;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
function getCurrentCursor() {
  var _a;
  try {
    const state = orca.state;
    const activePanelId = state.activePanel;
    if (!activePanelId) return null;
    const panel = orca.nav.findViewPanel(activePanelId, state.panels);
    if (!panel) return null;
    return ((_a = panel.viewState) == null ? void 0 : _a.cursor) || null;
  } catch (e) {
    debugLog(pluginName, "getCurrentCursor failed:", e);
    return null;
  }
}
function openImportDialog() {
  capturedCursor = getCurrentCursor();
  showImportDialog(async (tree, formatOption, clozeMode, clozeSyntax, preparedText, sourceFormat, convertHighlight) => {
    try {
      const settings = getSettings();
      const VALID_CLOZE_SYNTAX = [
        "tortoise",
        "bold",
        "bold-italic",
        "italic",
        "quote",
        "cloze-idx-bracket",
        "bracket",
        "brace"
      ];
      const validSet = new Set(VALID_CLOZE_SYNTAX);
      const validatedSyntax = clozeSyntax.filter((s) => validSet.has(s));
      const updated = { ...settings, clozeMode, clozeSyntax: validatedSyntax };
      await saveSettings(pluginName, updated);
    } catch (e) {
      debugLog(pluginName, "Failed to persist cloze settings:", e);
    }
    orca.commands.invokeEditorCommand(
      `${pluginName}.doImport`,
      capturedCursor,
      tree,
      formatOption,
      clozeMode,
      clozeSyntax,
      preparedText,
      sourceFormat,
      convertHighlight
    ).catch((err) => {
      errorLog(pluginName, "[onImport] doImport failed:", err);
      orca.notify("error", `导入执行失败: ${err instanceof Error ? err.message : String(err)}`);
    });
  });
}
async function load(name) {
  var _a;
  pluginName = name;
  infoLog(pluginName, `load() called, name=${name}`);
  if (typeof orca === "undefined") {
    errorLog(pluginName, "Orca global not found, plugin cannot start");
    return;
  }
  await loadSettings(pluginName);
  await registerSettings(pluginName);
  orca.commands.registerCommand(
    `${pluginName}.importFile`,
    async () => {
      infoLog(pluginName, "[CMD] importFile triggered");
      try {
        openImportDialog();
      } catch (err) {
        errorLog(pluginName, "[CMD] importFile failed:", err);
        orca.notify("error", `打开导入对话框失败: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    "导入文件 (md/txt/OPML/JSON)"
  );
  orca.commands.registerEditorCommand(
    `${pluginName}.doImport`,
    async (editor, tree, formatOption, clozeMode, clozeSyntax, preparedText, sourceFormat, convertHighlight = true) => {
      const cursor = (editor == null ? void 0 : editor[2]) ?? null;
      debugLog(pluginName, `[doImport] tree=${tree == null ? void 0 : tree.length} textLen=${(preparedText == null ? void 0 : preparedText.length) ?? 0} src=${sourceFormat} cursor=${!!cursor} hl=${convertHighlight}`);
      if (!tree || !Array.isArray(tree) || tree.length === 0) {
        errorLog(pluginName, "[doImport] tree is null or empty, aborting");
        orca.notify("error", "导入内容为空，请检查文件格式");
        return;
      }
      try {
        await handleImport(tree, formatOption, clozeMode, clozeSyntax, cursor, preparedText, sourceFormat, convertHighlight);
      } catch (err) {
        errorLog(pluginName, "[doImport] handleImport failed:", err);
        orca.notify("error", `导入失败: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    () => {
    },
    { label: "执行导入", hasArgs: true }
  );
  orca.commands.registerCommand(
    `${pluginName}.exportFile`,
    async () => {
      debugLog(pluginName, "[CMD] exportFile triggered");
      try {
        handleExport();
      } catch (err) {
        errorLog(pluginName, "[CMD] exportFile failed:", err);
        orca.notify("error", `导出失败: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    "导出文件"
  );
  orca.commands.registerCommand(
    `${pluginName}.clearEmptyBlocks`,
    async () => {
      infoLog(pluginName, "[CMD] clearEmptyBlocks triggered");
      try {
        await handleClearEmptyBlocks();
      } catch (err) {
        errorLog(pluginName, "[CMD] clearEmptyBlocks failed:", err);
        orca.notify("error", `清除空块失败: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    "清除空块 (当前页面)"
  );
  orca.toolbar.registerToolbarButton(`${pluginName}.importBtn`, {
    icon: "ti ti-upload",
    tooltip: "导入文件",
    command: `${pluginName}.importFile`
  });
  orca.toolbar.registerToolbarButton(`${pluginName}.exportBtn`, {
    icon: "ti ti-download",
    tooltip: "导出文件",
    command: `${pluginName}.exportFile`
  });
  try {
    if ((_a = orca.headbar) == null ? void 0 : _a.registerHeadbarButton) {
      orca.headbar.registerHeadbarButton(
        `${pluginName}.headbarBtn`,
        () => createHeadbarButton(
          () => openImportDialog(),
          () => handleExport(),
          () => handleClearEmptyBlocks()
        )
      );
    }
  } catch (err) {
    debugLog(pluginName, "Headbar button registration failed:", err);
  }
  orca.slashCommands.registerSlashCommand(`${pluginName}/import`, {
    icon: "ti ti-upload",
    group: "Import/Export",
    title: "导入文件",
    command: `${pluginName}.importFile`
  });
  orca.slashCommands.registerSlashCommand(`${pluginName}/export`, {
    icon: "ti ti-download",
    group: "Import/Export",
    title: "导出文件",
    command: `${pluginName}.exportFile`
  });
  orca.slashCommands.registerSlashCommand(`${pluginName}/clear-empty`, {
    icon: "ti ti-eraser",
    group: "Import/Export",
    title: "清除当前页空块",
    command: `${pluginName}.clearEmptyBlocks`
  });
  document.body.addEventListener("contextmenu", onContextMenu);
  infoLog(pluginName, "Plugin load complete");
}
async function unload() {
  var _a;
  if (typeof orca === "undefined") return;
  orca.commands.unregisterCommand(`${pluginName}.importFile`);
  orca.commands.unregisterCommand(`${pluginName}.exportFile`);
  orca.commands.unregisterCommand(`${pluginName}.clearEmptyBlocks`);
  orca.commands.unregisterEditorCommand(`${pluginName}.doImport`);
  orca.toolbar.unregisterToolbarButton(`${pluginName}.importBtn`);
  orca.toolbar.unregisterToolbarButton(`${pluginName}.exportBtn`);
  try {
    if ((_a = orca.headbar) == null ? void 0 : _a.unregisterHeadbarButton) {
      orca.headbar.unregisterHeadbarButton(`${pluginName}.headbarBtn`);
    }
  } catch (err) {
  }
  orca.slashCommands.unregisterSlashCommand(`${pluginName}/import`);
  orca.slashCommands.unregisterSlashCommand(`${pluginName}/export`);
  orca.slashCommands.unregisterSlashCommand(`${pluginName}/clear-empty`);
  document.body.removeEventListener("contextmenu", onContextMenu);
  removeStyles();
  removeVersionBadge();
  infoLog(pluginName, "Plugin unloaded");
}
function onContextMenu(e) {
  const target = e.target;
  if (!target) return;
  const blockEl = target.closest(".orca-block");
  const contentEl = target.closest(".orca-repr-main-content");
  if (!contentEl && !blockEl) return;
  const selection = window.getSelection();
  if (selection && selection.toString().trim().length > 0) return;
  let blockId = null;
  if (blockEl) {
    blockId = blockEl.dataset.id || null;
  }
  e.preventDefault();
  e.stopPropagation();
  capturedCursor = getCurrentCursor();
  showContextMenu(
    e.clientX,
    e.clientY,
    blockId,
    () => {
      openImportDialog();
    },
    () => handleExport(),
    () => handleClearEmptyBlocks()
  );
}
const IMAGE_PROP_NAMES = /* @__PURE__ */ new Set(["image", "src", "url"]);
const IMAGE_REPR_FIELD_KEYS = ["src", "url", "image"];
function getString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
function getImageUrl(block) {
  if (!block) return null;
  const b = block;
  if (b._repr && typeof b._repr === "object") {
    for (const key of IMAGE_REPR_FIELD_KEYS) {
      const url = getString(b._repr[key]);
      if (url) return url;
    }
  }
  if (Array.isArray(b.aliases)) {
    for (const alias of b.aliases) {
      if (typeof alias === "string") {
        const match = alias.match(/^image::?\s*(\S+)/);
        const url = match && match[1] ? getString(match[1]) : null;
        if (url) return url;
      }
    }
  }
  if (Array.isArray(b.properties)) {
    for (const prop of b.properties) {
      if (!prop) continue;
      if (prop.name === "_repr" && prop.value && typeof prop.value === "object") {
        for (const key of IMAGE_REPR_FIELD_KEYS) {
          const url = getString(prop.value[key]);
          if (url) return url;
        }
      }
      if (typeof prop.name === "string" && IMAGE_PROP_NAMES.has(prop.name)) {
        const url = getString(prop.value);
        if (url) return url;
      }
    }
  }
  if (Array.isArray(b.refs)) {
    for (const ref of b.refs) {
      if (ref && ref.type === "image") {
        const url = getString(ref.src) || getString(ref.url);
        if (url) return url;
      }
    }
  }
  return null;
}
function extractImageUrls(block) {
  if (!block) return [];
  const b = block;
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  const push = (raw) => {
    const url = getString(raw);
    if (url && !seen.has(url)) {
      seen.add(url);
      out.push(url);
    }
  };
  if (b._repr && typeof b._repr === "object") {
    for (const key of IMAGE_REPR_FIELD_KEYS) push(b._repr[key]);
  }
  if (Array.isArray(b.aliases)) {
    for (const alias of b.aliases) {
      if (typeof alias === "string") {
        const m = alias.match(/^image::?\s*(\S+)/);
        if (m && m[1]) push(m[1]);
      }
    }
  }
  if (Array.isArray(b.properties)) {
    for (const prop of b.properties) {
      if (!prop) continue;
      if (prop.name === "_repr" && prop.value && typeof prop.value === "object") {
        for (const key of IMAGE_REPR_FIELD_KEYS) push(prop.value[key]);
      }
      if (typeof prop.name === "string" && IMAGE_PROP_NAMES.has(prop.name)) push(prop.value);
    }
  }
  if (Array.isArray(b.refs)) {
    for (const ref of b.refs) {
      if (ref && ref.type === "image") {
        push(ref.src);
        push(ref.url);
      }
    }
  }
  return out;
}
function stripHighlightFromNode(node) {
  const plainText = node.fragments.map((f) => String(f.v ?? "")).join("");
  return {
    ...node,
    fragments: [{ t: "t", v: plainText }],
    children: node.children.map((child) => stripHighlightFromNode(child))
  };
}
function countTreeNodes(tree) {
  let count = 0;
  for (const node of tree) {
    count++;
    count += countTreeNodes(node.children);
  }
  return count;
}
const allPlainText = (frags) => frags.length > 0 && frags.every((f) => f.t === "t");
const containsMarkdownImage = (frags) => {
  return frags.some((f) => f.t === "t" && typeof f.v === "string" && hasMarkdownImage(f.v));
};
function fragsToOrcaMarkdown(frags) {
  return frags.map((f) => {
    var _a, _b, _c, _d, _e, _f, _g;
    if (f.t === "t") {
      const v = String(f.v ?? "");
      if (((_a = f.fa) == null ? void 0 : _a.bold) && ((_b = f.fa) == null ? void 0 : _b.italic)) return `***${v}***`;
      if ((_c = f.fa) == null ? void 0 : _c.bold) return `**${v}**`;
      if ((_d = f.fa) == null ? void 0 : _d.italic) return `*${v}*`;
      if ((_e = f.fa) == null ? void 0 : _e.strikethrough) return `~~${v}~~`;
      return v;
    }
    if (f.t === "bc" || f.t === "fc" || f.t === "h") return `==${f.v}==`;
    if (f.t === "a") {
      const text = ((_f = f.children) == null ? void 0 : _f.map((c) => String(c.v ?? "")).join("")) || "";
      if ((_g = f.fa) == null ? void 0 : _g.img) return `![${text}](${f.v})`;
      return `[${text}](${f.v})`;
    }
    if (f.t === "c") return `\`${f.v}\``;
    return String(f.v ?? "");
  }).join("");
}
function parseInlineMarkdownLite(text) {
  const frags = [];
  const regex = /(!\[[^\]*\]\([^)]+\))|(\[[^\]*\]\([^)]+\))|(`[^`]+`)|(\*{3}([\s\S]*?)\*{3})|(\*\*([\s\S]*?)\*\*)|(\*([\s\S]*?)\*)|(~~([\s\S]*?)~~)|(==([\s\S]*?)==)/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) frags.push({ t: "t", v: text.slice(lastIndex, match.index) });
    const fm = match[0];
    if (match[1]) frags.push({ t: "t", v: fm });
    else if (match[2]) frags.push({ t: "t", v: fm });
    else if (match[3]) frags.push({ t: "t", v: fm });
    else if (match[4]) frags.push({ t: "t", v: match[5] ?? "", f: "b", fa: { bold: true, italic: true } });
    else if (match[6]) frags.push({ t: "t", v: match[7] ?? "", f: "b", fa: { bold: true } });
    else if (match[8]) frags.push({ t: "t", v: match[9] ?? "", f: "b", fa: { italic: true } });
    else if (match[10]) frags.push({ t: "t", v: match[11] ?? "", f: "b", fa: { strikethrough: true } });
    else if (match[12]) frags.push({ t: "h", v: match[13] ?? "" });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) frags.push({ t: "t", v: text.slice(lastIndex) });
  return frags.length > 0 ? frags : [{ t: "t", v: text }];
}
const parseInlineMarkdownInFrags = (frags) => {
  const result = [];
  for (const frag of frags) {
    if (frag.t === "t" && typeof frag.v === "string") {
      result.push(...parseInlineMarkdownLite(frag.v));
    } else {
      result.push(frag);
    }
  }
  return result;
};
const convertSyntaxToCloze = (text, syntax) => {
  let result = text;
  switch (syntax) {
    case "tortoise":
      result = result.replace(/\u3016([\s\S]+?)\u3017/g, (_, t) => `HL:cloze${t}`);
      break;
    case "bold":
      result = result.replace(/\*\*([\s\S]+?)\*\*(?!\*)/g, (_, t) => `HL:cloze${t}`);
      break;
    case "bold-italic":
      result = result.replace(/\*{3}([\s\S]+?)\*{3}/g, (_, t) => `HL:cloze${t}`);
      break;
    case "italic":
      result = result.replace(/\*([\s\S]+?)\*(?!\*)/g, (_, t) => `HL:cloze${t}`);
      break;
    case "quote":
      result = result.replace(
        /"([\s\S]*?)"|([\u201c\u300c\u300e\u00ab])([\s\S]*?)([\u201d\u300d\u300f\u00bb])/g,
        (_, en, openCn, t, _closeCn) => `HL:cloze${en || t}`
      );
      break;
    case "cloze-idx-bracket":
      result = result.replace(/\[\[c\d+::([\s\S]*?)\]\]/g, (_, t) => `HL:cloze${t}`);
      break;
    case "bracket":
      result = result.replace(/\[\[([\s\S]*?)\]\]/g, (_, t) => `HL:cloze${t}`);
      break;
    case "brace":
      result = result.replace(/\{\{([\s\S]*?)\}\}/g, (_, t) => `HL:cloze${t}`);
      break;
  }
  return result;
};
const parseClozeMarkers = (text) => {
  const frags = [];
  const regex = /(!\[[^\]*\]\([^)]+\))|(\[[^\]*\]\([^)]+\))|(`[^`]+`)|(\*{3}([\s\S]*?)\*{3})|(\*\*([\s\S]*?)\*\*)|(\*([\s\S]*?)\*)|(~~([\s\S]*?)~~)|(==([\s\S]*?)==)/g;
  let lastIndex = 0;
  let m;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) frags.push({ t: "t", v: text.slice(lastIndex, m.index) });
    frags.push({ t: "h", v: m[1] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) frags.push({ t: "t", v: text.slice(lastIndex) });
  return frags.length > 0 ? frags : [{ t: "t", v: text }];
};
function convertClozeSyntaxInFrags(frags, syntaxes) {
  const result = [];
  for (const frag of frags) {
    if (frag.t === "t" && typeof frag.v === "string") {
      let converted = frag.v;
      for (const syntax of syntaxes) {
        converted = convertSyntaxToCloze(converted, syntax);
      }
      if (converted !== frag.v) {
        const parsed = parseClozeMarkers(converted);
        for (const pf of parsed) {
          if (pf.t === "h") {
            result.push(pf);
          } else if (pf.t === "t" && typeof pf.v === "string") {
            result.push(...parseInlineMarkdownLite(pf.v));
          } else {
            result.push(pf);
          }
        }
      } else {
        result.push(...parseInlineMarkdownLite(frag.v));
      }
    } else {
      result.push(frag);
    }
  }
  return result;
}
class ImportContext {
  constructor(cursor, progress, totalNodes, clozeMode, clozeSyntax, pluginName2) {
    this.cursor = cursor;
    this.progress = progress;
    this.allInserted = [];
    this.importedCount = 0;
    this.totalNodes = totalNodes;
    this.clozeMode = clozeMode;
    this.clozeSyntax = clozeSyntax;
    this.pluginName = pluginName2;
  }
  getInserted() {
    return this.allInserted;
  }
  getImportedCount() {
    return this.importedCount;
  }
  // ============================================================
  // 方向1+2：自适应等待新块 + 内容前缀匹配
  // 替代 v2.4.0 的 delay(300) + slice(-5)，更快更可靠
  // ============================================================
  async waitForNewChildren(parentId, baselineCount, timeoutMs = 1500) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (this.progress.isCancelled()) return [];
      const parentBlock = orca.state.blocks[parentId];
      const children = (parentBlock == null ? void 0 : parentBlock.children) || [];
      if (children.length > baselineCount) {
        return children.slice(baselineCount);
      }
      await delay(50);
    }
    return [];
  }
  /** 方向2：获取块内容前缀用于匹配 */
  getBlockTextPrefix(block) {
    var _a;
    const content = (block == null ? void 0 : block.content) || ((_a = block == null ? void 0 : block._repr) == null ? void 0 : _a.content) || [];
    return content.map((f) => String(f.v || "")).join("").substring(0, 30).trim();
  }
  // ============================================================
  // insertBlock：position 'lastChild'，返回新块 ID
  // 方向4：移除未使用的 afterBlockId 参数
  // ============================================================
  async insertBlock(frags, parentId) {
    try {
      const freshParent = orca.state.blocks[parentId];
      if (!freshParent) {
        errorLog(this.pluginName, "[handleImport] insertBlock: parent not found");
        return null;
      }
      const orcaFrags = fragsToOrcaInsertFormat(frags);
      const result = await orca.commands.invokeEditorCommand(
        "core.editor.insertBlock",
        this.cursor,
        freshParent,
        "lastChild",
        orcaFrags,
        { type: "text" }
      );
      if (result == null) return null;
      if (typeof result === "number") return result;
      if (typeof result === "object" && result.id !== void 0) return result.id;
      const num = Number(result);
      if (!isNaN(num) && num > 0) return num;
      return null;
    } catch (e) {
      errorLog(this.pluginName, "insertBlock failed:", e);
      return null;
    }
  }
  // ============================================================
  // insertViaBatch：自适应延迟 + 内容前缀匹配
  // 方向1：用轮询替代 delay(300)，平均 50ms 即可检测到新块
  // 方向2：用内容前缀匹配替代 slice(-5)，更精确
  // 方向4：移除未使用的 afterBlockId 参数
  // ============================================================
  async insertViaBatch(text, parentId) {
    try {
      const parentBlock = orca.state.blocks[parentId];
      if (!parentBlock) return null;
      const baselineCount = (parentBlock.children || []).length;
      await orca.commands.invokeEditorCommand(
        "core.editor.batchInsertText",
        this.cursor,
        parentBlock,
        "lastChild",
        text
      );
      const newChildren = await this.waitForNewChildren(parentId, baselineCount);
      if (newChildren.length === 0) return null;
      const textPrefix = text.substring(0, 30).trim();
      if (textPrefix) {
        for (const id of newChildren) {
          const block = orca.state.blocks[id];
          if (block && this.getBlockTextPrefix(block) === textPrefix) {
            return id;
          }
        }
      }
      return newChildren[newChildren.length - 1];
    } catch (e) {
      errorLog(this.pluginName, "[handleImport] batchInsertText failed:", e);
      return null;
    }
  }
  // ============================================================
  // 方向1：同级纯文本批量插入
  // 将连续的纯文本叶子节点合并为一次 batchInsertText 调用（用 \n 分隔）
  // ============================================================
  async insertBatchSiblings(nodes, parentId) {
    if (nodes.length <= 1) return false;
    try {
      const parentBlock = orca.state.blocks[parentId];
      if (!parentBlock) return false;
      const baselineCount = (parentBlock.children || []).length;
      const texts = nodes.map((n) => n.fragments.map((f) => String(f.v || "")).join(""));
      const combinedText = texts.join("\n");
      await orca.commands.invokeEditorCommand(
        "core.editor.batchInsertText",
        this.cursor,
        parentBlock,
        "lastChild",
        combinedText
      );
      const newChildren = await this.waitForNewChildren(parentId, baselineCount);
      let matched = 0;
      for (let j = 0; j < nodes.length && j < newChildren.length; j++) {
        const id = newChildren[j];
        const block = orca.state.blocks[id];
        const expected = texts[j].substring(0, 30).trim();
        const actual = block ? this.getBlockTextPrefix(block) : "";
        if (expected === actual) {
          this.allInserted.push({ id, fragments: nodes[j].fragments });
          this.importedCount++;
          this.progress.update(this.importedCount, this.totalNodes, `已导入 ${this.importedCount}/${this.totalNodes}`);
          matched++;
        } else {
          debugLog(this.pluginName, `[batch] content mismatch at ${j}: expected "${expected}" got "${actual}"`);
          this.allInserted.push({ id, fragments: nodes[j].fragments });
          this.importedCount++;
          this.progress.update(this.importedCount, this.totalNodes, `已导入 ${this.importedCount}/${this.totalNodes}`);
          matched++;
        }
      }
      return matched === nodes.length;
    } catch (e) {
      errorLog(this.pluginName, "[handleImport] batch siblings failed:", e);
      return false;
    }
  }
  // ============================================================
  // 方向3：单节点插入，带 1 次重试
  // ============================================================
  async insertWithRetry(fn, plainText) {
    let result = await fn();
    if (result == null && !this.progress.isCancelled()) {
      debugLog(this.pluginName, `[Import] retry: "${plainText.substring(0, 40)}"`);
      await delay(100);
      result = await fn();
    }
    return result;
  }
  // ============================================================
  // processNode：方向3 取消检查 + 方向3 失败重试 + 方向4 移除 afterBlockId
  // ============================================================
  async processNode(node, parentBlockId) {
    if (this.progress.isCancelled()) return null;
    const frags = node.fragments;
    const plainText = frags.map((f) => String(f.v || "")).join("");
    let insertedId = null;
    if (allPlainText(frags)) {
      const textForInsert = plainText;
      let useBatchInsert = true;
      let insertFrags = null;
      if (this.clozeMode) {
        const clozeFrags = convertClozeSyntaxInFrags(frags, this.clozeSyntax);
        if (clozeFrags.some((f) => f.t === "h")) {
          insertFrags = clozeFrags;
          useBatchInsert = false;
        }
      }
      if (useBatchInsert) {
        debugLog(this.pluginName, `[Import] batchInsert: "${textForInsert.substring(0, 40)}"`);
        insertedId = await this.insertWithRetry(() => this.insertViaBatch(textForInsert, parentBlockId), plainText);
      } else {
        debugLog(this.pluginName, `[Import] insertBlock (cloze): "${textForInsert.substring(0, 40)}"`);
        insertedId = await this.insertWithRetry(() => this.insertBlock(insertFrags, parentBlockId), plainText);
      }
    } else {
      let insertFrags;
      if (this.clozeMode) {
        insertFrags = convertClozeSyntaxInFrags(frags, this.clozeSyntax);
      } else {
        insertFrags = parseInlineMarkdownInFrags(frags);
      }
      if (!this.clozeMode && containsMarkdownImage(insertFrags)) {
        const mdText = fragsToOrcaMarkdown(insertFrags);
        debugLog(this.pluginName, `[Import] batchInsert (rich text + image): "${mdText.substring(0, 40)}"`);
        insertedId = await this.insertWithRetry(() => this.insertViaBatch(mdText, parentBlockId), plainText);
      } else {
        insertedId = await this.insertWithRetry(() => this.insertBlock(insertFrags, parentBlockId), plainText);
      }
    }
    if (insertedId) {
      this.allInserted.push({ id: insertedId, fragments: node.fragments });
      this.importedCount++;
      this.progress.update(this.importedCount, this.totalNodes, `已导入 ${this.importedCount}/${this.totalNodes}`);
    }
    if (insertedId) {
      const leafChildren = [];
      const nonLeafIndices = [];
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        const childFrags = child.fragments;
        const isPlain = allPlainText(childFrags);
        const hasCloze = this.clozeMode && convertClozeSyntaxInFrags(childFrags, this.clozeSyntax).some((f) => f.t === "h");
        const hasChildren = child.children.length > 0;
        const hasImage = containsMarkdownImage(childFrags);
        if (isPlain && !hasCloze && !hasChildren && !hasImage) {
          leafChildren.push(child);
        } else {
          if (leafChildren.length > 0) {
            if (leafChildren.length === 1) {
              await this.processNode(leafChildren[0], insertedId);
            } else {
              const ok = await this.insertBatchSiblings(leafChildren, insertedId);
              if (!ok) {
                for (const n of leafChildren) {
                  if (this.progress.isCancelled()) break;
                  await this.processNode(n, insertedId);
                }
              }
            }
            leafChildren.length = 0;
          }
          nonLeafIndices.push(i);
        }
      }
      if (leafChildren.length > 0) {
        if (leafChildren.length === 1) {
          await this.processNode(leafChildren[0], insertedId);
        } else {
          const ok = await this.insertBatchSiblings(leafChildren, insertedId);
          if (!ok) {
            for (const n of leafChildren) {
              if (this.progress.isCancelled()) break;
              await this.processNode(n, insertedId);
            }
          }
        }
      }
      for (const idx of nonLeafIndices) {
        if (this.progress.isCancelled()) break;
        await this.processNode(node.children[idx], insertedId);
      }
    } else {
      errorLog(this.pluginName, `[handleImport] skipped children of failed node: "${plainText.substring(0, 40)}"`);
    }
    return insertedId;
  }
}
let isImporting = false;
async function handleImport(tree, formatOption, clozeMode, clozeSyntax, cursor, preparedText, sourceFormat, convertHighlight = true) {
  if (isImporting) {
    orca.notify("warn", "导入正在进行中，请等待完成后再试", { title: "导入提示" });
    return;
  }
  isImporting = true;
  try {
    infoLog(pluginName, `[Import] start: roots=${tree.length} fmt=${formatOption} cloze=${clozeMode} src=${sourceFormat} hl=${convertHighlight}`);
    if (tree.length === 0) {
      orca.notify("warn", "没有可导入的内容", { title: "导入提示" });
      return;
    }
    if (!convertHighlight) {
      tree = tree.map((node) => stripHighlightFromNode(node));
    }
    const importTarget = getTargetBlock();
    if (!importTarget) {
      orca.notify("error", "无法找到导入位置。请在 Orca 中打开一个笔记页面后重试。", { title: "导入错误" });
      return;
    }
    const pageRootId = importTarget.parentBlock.id;
    const totalNodes = countTreeNodes(tree);
    const progress = createProgressOverlay("导入文件");
    progress.update(0, totalNodes, "正在导入...");
    progress.setCancellable(true);
    const ctx = new ImportContext(cursor, progress, totalNodes, clozeMode, clozeSyntax, pluginName);
    for (const node of tree) {
      if (ctx.progress.isCancelled()) break;
      await ctx.processNode(node, pageRootId);
    }
    const importedCount = ctx.getImportedCount();
    const allInserted = ctx.getInserted();
    await delay(200);
    progress.close();
    const failed = totalNodes - importedCount;
    const wasCancelled = progress.isCancelled();
    if (wasCancelled) {
      orca.notify("warn", `已取消导入：成功 ${importedCount}/${totalNodes}，跳过 ${failed} 个`, { title: "导入已取消" });
    } else if (importedCount === totalNodes) {
      const clozeNote = clozeMode ? "（含挖空处理）" : "";
      orca.notify("success", `导入成功，共 ${importedCount} 个块${clozeNote}`, { title: "导入完成" });
    } else if (importedCount > 0) {
      orca.notify("warn", `部分导入成功：${importedCount}/${totalNodes}，${failed} 个块失败`, { title: "导入提示" });
    } else {
      orca.notify("warn", "导入完成，但未检测到新增块", { title: "导入提示" });
    }
    infoLog(pluginName, `[Import] done: inserted=${importedCount}/${totalNodes} cancelled=${wasCancelled}`);
  } catch (err) {
    errorLog(pluginName, "Import setup error:", err);
    orca.notify("error", `导入初始化失败: ${err instanceof Error ? err.message : String(err)}`, { title: "导入错误" });
  } finally {
    isImporting = false;
  }
}
function getTargetBlock() {
  var _a;
  try {
    const state = orca.state;
    const activePanelId = state.activePanel;
    if (!activePanelId) {
      errorLog(pluginName, "[getTargetBlock] no activePanel");
      return null;
    }
    const panel = orca.nav.findViewPanel(activePanelId, state.panels);
    if (!panel) {
      errorLog(pluginName, `[getTargetBlock] no view panel for ${activePanelId}`);
      return null;
    }
    const rootId = (_a = panel.viewArgs) == null ? void 0 : _a.blockId;
    if (rootId === void 0 || !state.blocks[rootId]) {
      errorLog(pluginName, `[getTargetBlock] no root block ${rootId}`);
      return null;
    }
    const rootBlock = state.blocks[rootId];
    const settings = getSettings();
    const importPosition = settings.importPosition || "child";
    if (importPosition === "child") {
      debugLog(pluginName, `[getTargetBlock] insert as child of ${rootId}`);
      return { parentBlock: rootBlock, position: "lastChild", afterSibling: null };
    }
    const parentId = rootBlock.parent;
    if (parentId === null || parentId === void 0) {
      debugLog(pluginName, "[getTargetBlock] root has no parent, fallback to child");
      return { parentBlock: rootBlock, position: "lastChild", afterSibling: null };
    }
    const parent = state.blocks[parentId];
    if (!parent) {
      errorLog(pluginName, `[getTargetBlock] parent ${parentId} not found`);
      return { parentBlock: rootBlock, position: "lastChild", afterSibling: null };
    }
    const grandparentId = parent.parent;
    const isRootLevel = grandparentId === null || grandparentId === void 0 || !state.blocks[grandparentId];
    if (!isRootLevel) {
      debugLog(pluginName, `[getTargetBlock] root ${rootId} is not at root level, fallback to child`);
      return { parentBlock: rootBlock, position: "lastChild", afterSibling: null };
    }
    debugLog(pluginName, `[getTargetBlock] insert as sibling after ${rootId} in parent ${parentId}`);
    return { parentBlock: parent, position: "after", afterSibling: rootBlock };
  } catch (e) {
    errorLog(pluginName, "getTargetBlock error:", e);
    return null;
  }
}
function handleExport() {
  infoLog(pluginName, "[Export] start");
  const progress = createProgressOverlay("导出文件");
  progress.update(0, 1, "正在提取块...");
  const abortSignal = progress.setCancellable(true);
  try {
    if (abortSignal.aborted) {
      progress.close();
      orca.notify("warn", "已取消导出", { title: "导出已取消" });
      return;
    }
    const { tree, blockCount, sourceFormat, rootName } = extractBlocksFromPanel();
    progress.update(1, 1, `已提取 ${blockCount} 个块`);
    infoLog(pluginName, `[Export] extracted: roots=${tree.length} blocks=${blockCount} src=${sourceFormat} name="${rootName}"`);
    if (tree.length === 0) {
      progress.close();
      orca.notify("warn", "当前页面没有可导出的内容", { title: "导出提示" });
      return;
    }
    if (abortSignal.aborted) {
      progress.close();
      orca.notify("warn", "已取消导出", { title: "导出已取消" });
      return;
    }
    setTimeout(() => {
      progress.close();
      showExportDialog(tree, blockCount, sourceFormat, rootName);
    }, 100);
  } catch (err) {
    progress.close();
    errorLog(pluginName, "[Export] error:", err);
    orca.notify("error", `导出失败: ${err instanceof Error ? err.message : String(err)}`);
  }
}
function extractBlocksFromPanel() {
  var _a, _b;
  debugLog(pluginName, "[Export] extractBlocksFromPanel start");
  const state = orca.state;
  const blocks = state.blocks;
  const totalBlocks = Object.keys(blocks).length;
  let rootBlockIds = [];
  let rootName = "";
  let viewPanel = null;
  const activePanelId = state.activePanel;
  if (activePanelId) {
    viewPanel = orca.nav.findViewPanel(activePanelId, state.panels);
    if (viewPanel) {
      const rootId = (_a = viewPanel.viewArgs) == null ? void 0 : _a.blockId;
      if (rootId !== void 0 && blocks[rootId]) {
        rootBlockIds = blocks[rootId].children || [];
      }
    }
  }
  if (rootBlockIds.length === 0) {
    debugLog(pluginName, "[Export] no root from active panel, trying all panels");
    const allPanels = findAllViewPanels(state.panels);
    for (const panel of allPanels) {
      const rootId = (_b = panel.viewArgs) == null ? void 0 : _b.blockId;
      if (rootId !== void 0 && blocks[rootId]) {
        rootBlockIds = blocks[rootId].children || [];
        viewPanel = panel;
        if (rootBlockIds.length > 0) break;
      }
    }
  }
  if (rootBlockIds.length === 0) {
    debugLog(pluginName, "[Export] trying DOM-based block detection");
    const blockEls = document.querySelectorAll(".orca-block[data-id]");
    const visibleBlockIds = [];
    const childSet = /* @__PURE__ */ new Set();
    for (const el2 of blockEls) {
      const idStr = el2.dataset.id;
      if (!idStr) continue;
      const id = Number(idStr);
      if (!blocks[id]) continue;
      visibleBlockIds.push(id);
      const block = blocks[id];
      if (block.children) {
        for (const childId of block.children) {
          childSet.add(childId);
        }
      }
    }
    rootBlockIds = visibleBlockIds.filter((id) => !childSet.has(id));
  }
  if (rootBlockIds.length === 0) {
    debugLog(pluginName, "[Export] trying parentless block detection");
    rootBlockIds = Object.keys(blocks).map((k) => Number(k)).filter((id) => {
      const block = blocks[id];
      return block && (block.parent === void 0 || !blocks[block.parent]);
    });
  }
  if (rootBlockIds.length === 0) {
    debugLog(pluginName, "[Export] fallback to root-level blocks only");
    rootBlockIds = Object.keys(blocks).map((k) => Number(k)).filter((id) => {
      const block = blocks[id];
      return block && (block.parent === void 0 || block.parent === null || !blocks[block.parent]);
    });
  }
  debugLog(pluginName, `[Export] total=${totalBlocks} roots=${rootBlockIds.length} first=[${rootBlockIds.slice(0, 5).join(",")}${rootBlockIds.length > 5 ? "..." : ""}]`);
  let blockCount = 0;
  let rawText = "";
  const tree = rootBlockIds.map((id) => blockToTreeNode(id, blocks, 0, () => {
    blockCount++;
  }, (t) => {
    rawText += t + "\n";
  })).filter((n) => n !== null);
  let sourceFormat = "orca";
  const hasOrcaFrags = checkHasOrcaHighlights(blocks, rootBlockIds);
  if (!hasOrcaFrags && rawText.trim()) {
    sourceFormat = detectHighlightSyntax(rawText);
  }
  if (tree.length > 0 && tree[0].text) {
    rootName = sanitizeFilename(tree[0].text);
  }
  return { tree, blockCount, sourceFormat, rootName };
}
function sanitizeFilename(name, maxLength = 60) {
  let s = (name || "").trim();
  s = s.replace(/^#+\s*/, "");
  s = s.replace(/\*\*?([^*]+)\*\*?/g, "$1");
  s = s.replace(/`([^`]+)`/g, "$1");
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, "[图片]");
  s = s.replace(/\[\[([^\]]+)\]\]/g, "$1");
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  s = s.replace(/<[^>]+>/g, "");
  s = s.replace(/[\\/:*?"<>|\r\n\t]/g, "_");
  if (s.length > maxLength) s = s.substring(0, maxLength).trim();
  return s || "orca-export";
}
function findAllViewPanels(panels) {
  const result = [];
  function walk(node) {
    if (!node) return;
    if (node.view !== void 0 && typeof node.view === "string") {
      result.push(node);
      return;
    }
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) walk(child);
    }
  }
  walk(panels);
  return result;
}
function checkHasOrcaHighlights(blocks, rootIds) {
  function checkBlock(id, visited) {
    if (visited.has(id)) return false;
    visited.add(id);
    const block = blocks[id];
    if (!block) return false;
    if (block.content) {
      for (const frag of block.content) {
        if (frag.t === "bc" || frag.t === "fc" || frag.t === "h") return true;
        if (frag.f === "bc" || frag.f === "fc" || frag.f === "h") return true;
        if (frag.fa && (frag.fa.bc || frag.fa.fc || frag.fa.h || frag.fa.color || frag.fa.c)) return true;
      }
    }
    if (block.children) {
      for (const childId of block.children) {
        if (checkBlock(childId, visited)) return true;
      }
    }
    return false;
  }
  for (const id of rootIds) {
    if (checkBlock(id, /* @__PURE__ */ new Set())) return true;
  }
  return false;
}
function extractTableMarkdown(block) {
  var _a;
  const b = block;
  const blockId = b.id ?? "?";
  if ((!b.text || b.text === "") && (!b.content || !Array.isArray(b.content) || b.content.length === 0) && Array.isArray(b.children) && b.children.length >= 1) {
    const blocks = (_a = orca.state) == null ? void 0 : _a.blocks;
    if (blocks) {
      const columns = [];
      let rowCount = 0;
      let isTableStructure = true;
      for (const colId of b.children) {
        const colBlock = blocks[colId];
        if (!colBlock) {
          isTableStructure = false;
          break;
        }
        if (colBlock.text && colBlock.text !== "" || colBlock.content && Array.isArray(colBlock.content) && colBlock.content.length > 0 || !Array.isArray(colBlock.children) || colBlock.children.length === 0) {
          isTableStructure = false;
          break;
        }
        const colCells = [];
        for (const rowId of colBlock.children) {
          const rowBlock = blocks[rowId];
          if (!rowBlock) {
            isTableStructure = false;
            break;
          }
          if (!Array.isArray(rowBlock.children) || rowBlock.children.length === 0) {
            const cellText = rowBlock.text || (Array.isArray(rowBlock.content) ? rowBlock.content.map((f) => String(f.v ?? "")).join("") : "");
            if (cellText) {
              colCells.push(cellText.trim());
            } else {
              isTableStructure = false;
              break;
            }
          } else if (rowBlock.children.length === 1) {
            const cellBlock = blocks[rowBlock.children[0]];
            if (!cellBlock) {
              isTableStructure = false;
              break;
            }
            const cellText = cellBlock.text || (Array.isArray(cellBlock.content) ? cellBlock.content.map((f) => String(f.v ?? "")).join("") : "");
            colCells.push(cellText.trim());
          } else {
            isTableStructure = false;
            break;
          }
        }
        if (!isTableStructure) break;
        if (rowCount === 0) {
          rowCount = colCells.length;
        } else if (colCells.length !== rowCount) {
          isTableStructure = false;
          break;
        }
        columns.push(colCells);
      }
      if (isTableStructure && columns.length >= 2 && rowCount >= 1) {
        const mdRows = [];
        for (let rowIdx = 0; rowIdx < rowCount; rowIdx++) {
          const cells = [];
          for (let colIdx = 0; colIdx < columns.length; colIdx++) {
            const cellText = columns[colIdx][rowIdx] || "";
            cells.push(cellText.replace(/\|/g, "\\|").replace(/\n/g, " ").trim());
          }
          mdRows.push("| " + cells.join(" | ") + " |");
        }
        if (mdRows.length >= 1) {
          const colCount = columns.length;
          const sep = "| " + Array(colCount).fill("---").join(" | ") + " |";
          mdRows.splice(1, 0, sep);
        }
        debugLog(pluginName, `[Export] table nested: ${columns.length}×${rowCount} (block=${blockId})`);
        return mdRows.join("\n");
      }
    }
  }
  if (Array.isArray(b.content) && b.content.length > 0) {
    const fragText = b.content.map((f) => String(f.v ?? "")).join("");
    if (fragText) {
      const lines = fragText.split("\n").map((l) => l.trim()).filter((l) => l);
      if (lines.length >= 2 && lines[0].includes("|") && /^\|?[\s:|-]+\|?$/.test(lines[1]) && lines[1].includes("-")) {
        debugLog(pluginName, `[Export] table content (block=${blockId})`);
        return fragText;
      }
    }
  }
  const text = b.text || "";
  if (text) {
    const lines = text.split("\n").map((l) => l.trim()).filter((l) => l);
    if (lines.length >= 2 && lines[0].includes("|") && /^\|?[\s:|-]+\|?$/.test(lines[1]) && lines[1].includes("-")) {
      debugLog(pluginName, `[Export] table text (block=${blockId})`);
      return text;
    }
  }
  const repr = b._repr;
  if (repr && typeof repr === "object") {
    let rows = null;
    if (Array.isArray(repr.rows)) rows = repr.rows;
    else if (repr.data && Array.isArray(repr.data.rows)) rows = repr.data.rows;
    else if (Array.isArray(repr)) rows = repr;
    else if (Array.isArray(repr.cells) && repr.cells.length > 0 && Array.isArray(repr.cells[0])) rows = repr.cells;
    else if (Array.isArray(repr.matrix)) rows = repr.matrix;
    if (rows && rows.length > 0) {
      const mdRows = [];
      let colCount = 0;
      for (const row of rows) {
        if (!Array.isArray(row)) break;
        colCount = Math.max(colCount, row.length);
        const cells = row.map((cell) => {
          if (cell === null || cell === void 0) return "";
          if (typeof cell === "object" && cell !== null) {
            if (Array.isArray(cell.fragments)) {
              return cell.fragments.map((f) => String(f.v ?? "")).join("").replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
            }
            if (typeof cell.text === "string") return cell.text.replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
            if (typeof cell.v === "string") return cell.v.replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
            return JSON.stringify(cell).replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
          }
          return String(cell).replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
        });
        mdRows.push("| " + cells.join(" | ") + " |");
      }
      if (colCount > 0 && mdRows.length >= 1) {
        const sep = "| " + Array(colCount).fill("---").join(" | ") + " |";
        mdRows.splice(1, 0, sep);
        debugLog(pluginName, `[Export] table _repr: ${colCount}×${rows.length} (block=${blockId})`);
        return mdRows.join("\n");
      }
    }
  }
  return null;
}
function blockToTreeNode(blockId, blocks, level, countFn, textCollector) {
  const block = blocks[blockId];
  if (!block) return null;
  countFn();
  const tableMd = extractTableMarkdown(block);
  if (tableMd !== null) {
    const fragments2 = [{ t: "t", v: tableMd }];
    textCollector(tableMd);
    return { text: tableMd, fragments: fragments2, children: [], level, idx: 0 };
  }
  let fragments;
  if (block.content && Array.isArray(block.content) && block.content.length > 0) {
    fragments = normalizeFrags(block.content);
  } else if (block.text) {
    fragments = [{ t: "t", v: block.text }];
  } else {
    const imageUrl = getImageUrl(block);
    if (imageUrl) {
      fragments = [{ t: "t", v: `![](${imageUrl})` }];
    } else {
      fragments = [{ t: "t", v: "" }];
    }
  }
  const extraImageUrl = getImageUrl(block);
  if (extraImageUrl && !fragments.some((f) => f.v && /!\[.*\]\(.*\)/.test(String(f.v)))) {
    fragments = [...fragments, { t: "t", v: `![](${extraImageUrl})` }];
  }
  const text = fragments.map((f) => String(f.v)).join("");
  textCollector(text);
  const children = (block.children || []).map((childId) => blockToTreeNode(childId, blocks, level + 1, countFn, textCollector)).filter((n) => n !== null);
  return { text, fragments, children, level, idx: 0 };
}
async function removeOrcaBlock(blockId) {
  if (typeof orca === "undefined") return false;
  try {
    await orca.invokeBackend("remove-block", blockId);
    return true;
  } catch (_e1) {
  }
  try {
    await orca.invokeBackend("delete-block", blockId);
    return true;
  } catch (_e2) {
  }
  try {
    await orca.commands.invokeEditorCommand("core.editor.removeBlock", null, blockId);
    return true;
  } catch (_e3) {
  }
  try {
    const block = orca.state.blocks[blockId];
    if (!block) return true;
    const parentId = block.parent;
    if (parentId !== void 0 && parentId !== null) {
      const parent = orca.state.blocks[parentId];
      if (parent && Array.isArray(parent.children)) {
        const idx = parent.children.indexOf(blockId);
        if (idx >= 0) parent.children.splice(idx, 1);
      }
    }
    delete orca.state.blocks[blockId];
    return true;
  } catch (e) {
    errorLog(pluginName, `[removeOrcaBlock] All attempts failed for blockId=${blockId}:`, e);
    return false;
  }
}
function isEmptyBlock(block) {
  var _a;
  if (!block) return false;
  if (Array.isArray(block.children) && block.children.length > 0) return false;
  if (Array.isArray(block.aliases) && block.aliases.length > 0) return false;
  if (Array.isArray(block.refs) && block.refs.length > 0) return false;
  if (Array.isArray(block.backRefs) && block.backRefs.length > 0) return false;
  if (Array.isArray(block.properties) && block.properties.length > 0) return false;
  const content = block.content || [];
  if (content.length === 0) return true;
  let hasImage = false;
  let text = "";
  for (const f of content) {
    if (f.t === "a" && ((_a = f.fa) == null ? void 0 : _a.img)) {
      hasImage = true;
    } else if (typeof f.v === "string") {
      text += f.v;
    } else if (f.v && typeof f.v === "object" && f.v.text) {
      text += f.v.text;
    }
  }
  return text.trim() === "" && !hasImage;
}
function collectEmptyBlocks(parentId) {
  const result = [];
  const parent = orca.state.blocks[parentId];
  if (!parent) return result;
  const children = [...parent.children || []];
  for (const childId of children) {
    result.push(...collectEmptyBlocks(childId));
  }
  const freshParent = orca.state.blocks[parentId];
  if (freshParent && Array.isArray(freshParent.children) && freshParent.children.length > 0) {
    return result;
  }
  if (parentId !== (freshParent == null ? void 0 : freshParent.parent)) {
    if (isEmptyBlock(freshParent || parent)) {
      result.push(parentId);
    }
  }
  return result;
}
async function handleClearEmptyBlocks() {
  var _a;
  infoLog(pluginName, "===== handleClearEmptyBlocks start =====");
  const state = orca.state;
  const activePanelId = state.activePanel;
  if (!activePanelId) {
    orca.notify("error", "无法找到活动面板", { title: "清除空块" });
    return;
  }
  const panel = orca.nav.findViewPanel(activePanelId, state.panels);
  if (!panel || !((_a = panel.viewArgs) == null ? void 0 : _a.blockId)) {
    orca.notify("error", "无法找到当前页面", { title: "清除空块" });
    return;
  }
  const rootBlockId = panel.viewArgs.blockId;
  infoLog(pluginName, `handleClearEmptyBlocks: root block = ${rootBlockId}`);
  const emptyBlockIds = collectEmptyBlocks(rootBlockId);
  infoLog(pluginName, `handleClearEmptyBlocks: found ${emptyBlockIds.length} empty blocks`);
  if (emptyBlockIds.length === 0) {
    orca.notify("info", "当前页面没有空块", { title: "清除空块" });
    return;
  }
  let removedCount = 0;
  for (const blockId of emptyBlockIds) {
    const success = await removeOrcaBlock(blockId);
    if (success) removedCount++;
  }
  orca.notify("success", `已清除 ${removedCount} 个空块`, { title: "清除空块" });
  infoLog(pluginName, `===== handleClearEmptyBlocks done: removed ${removedCount}/${emptyBlockIds.length} =====`);
}
export {
  extractImageUrls,
  getImageUrl,
  load,
  unload
};
