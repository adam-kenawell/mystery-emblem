/**
 * Custom 24x24 PMD-Style Field Fences & Props Tileset Generator
 *
 * Samples exact 24x24 base floor tiles from Act 1 open-field tilesets
 * (`003` Drenched Bluff, `042` Apple Woods, `142` Lush Prairie) and
 * composites modular pixel-art wooden fences, low stone walls, trimmed
 * hedges, and field props into `assets/tilesets/tileset_144.png`.
 *
 * Usage: `node scripts/generate-custom-tileset.mjs`
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const TILE_PX = 24;
const SHEET_COLS = 16;
const SHEET_ROWS = 25;
const SHEET_W = SHEET_COLS * TILE_PX; // 384
const SHEET_H = SHEET_ROWS * TILE_PX; // 600
const KEY_RGBA = [0x50, 0x50, 0x50, 0xff];

// ---------------------------------------------------------------------------
// Minimal Pure-Node PNG Decode (colorType 2, 3, 6; 8-bit) & RGBA Encode
// ---------------------------------------------------------------------------

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function decodePngRgba(filePath) {
  const buf = fs.readFileSync(filePath);
  let off = 8; // skip PNG signature
  let width = 0;
  let height = 0;
  let colorType = 0;
  let palette = null;
  let trns = null;
  const idatParts = [];

  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    off += 12 + len;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === 'PLTE') {
      palette = data;
    } else if (type === 'tRNS') {
      trns = data;
    } else if (type === 'IDAT') {
      idatParts.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  const bpp = colorType === 3 ? 1 : colorType === 2 ? 3 : colorType === 6 ? 4 : 0;
  if (!bpp) throw new Error(`Unsupported PNG colorType ${colorType} in ${filePath}`);

  const raw = zlib.inflateSync(Buffer.concat(idatParts));
  const stride = width * bpp;
  const recon = new Uint8Array(height * stride);

  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const srcRow = y * (stride + 1) + 1;
    const dstRow = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? recon[dstRow + x - bpp] : 0;
      const b = y > 0 ? recon[dstRow - stride + x] : 0;
      const c = x >= bpp && y > 0 ? recon[dstRow - stride + x - bpp] : 0;
      let val = raw[srcRow + x];
      if (f === 1) val = (val + a) & 0xff;
      else if (f === 2) val = (val + b) & 0xff;
      else if (f === 3) val = (val + ((a + b) >> 1)) & 0xff;
      else if (f === 4) val = (val + paethPredictor(a, b, c)) & 0xff;
      recon[dstRow + x] = val;
    }
  }

  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const d = i * 4;
    if (colorType === 3) {
      const idx = recon[i];
      rgba[d] = palette[idx * 3];
      rgba[d + 1] = palette[idx * 3 + 1];
      rgba[d + 2] = palette[idx * 3 + 2];
      rgba[d + 3] = trns && idx < trns.length ? trns[idx] : 255;
    } else if (colorType === 2) {
      rgba[d] = recon[i * 3];
      rgba[d + 1] = recon[i * 3 + 1];
      rgba[d + 2] = recon[i * 3 + 2];
      rgba[d + 3] = 255;
    } else {
      rgba[d] = recon[d];
      rgba[d + 1] = recon[d + 1];
      rgba[d + 2] = recon[d + 2];
      rgba[d + 3] = recon[d + 3];
    }
  }
  return { width, height, rgba };
}

function makePngChunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePngRgba(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(
      raw,
      y * (stride + 1) + 1
    );
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    makePngChunk('IHDR', ihdr),
    makePngChunk('IDAT', compressed),
    makePngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// 24x24 Tile Buffer Helpers
// ---------------------------------------------------------------------------

function extractChunk(img, chunkIndex) {
  const col = chunkIndex % SHEET_COLS;
  const row = Math.floor(chunkIndex / SHEET_COLS);
  const sx = col * TILE_PX;
  const sy = row * TILE_PX;
  const tile = new Uint8Array(TILE_PX * TILE_PX * 4);
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const s = ((sy + y) * img.width + (sx + x)) * 4;
      const d = (y * TILE_PX + x) * 4;
      tile[d] = img.rgba[s];
      tile[d + 1] = img.rgba[s + 1];
      tile[d + 2] = img.rgba[s + 2];
      tile[d + 3] = img.rgba[s + 3];
    }
  }
  return tile;
}

function hexToRgba(hex, alpha = 255) {
  const v = parseInt(hex.replace('#', ''), 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff, alpha];
}

function makeTileCanvas(baseFloor) {
  const data = new Uint8Array(baseFloor);
  return {
    data,
    px(x, y, rgba) {
      if (x < 0 || y < 0 || x >= TILE_PX || y >= TILE_PX) return;
      const i = (y * TILE_PX + x) * 4;
      const a = rgba[3] / 255;
      if (a >= 0.999) {
        data[i] = rgba[0];
        data[i + 1] = rgba[1];
        data[i + 2] = rgba[2];
        data[i + 3] = 255;
      } else if (a > 0) {
        data[i] = Math.round(rgba[0] * a + data[i] * (1 - a));
        data[i + 1] = Math.round(rgba[1] * a + data[i + 1] * (1 - a));
        data[i + 2] = Math.round(rgba[2] * a + data[i + 2] * (1 - a));
        data[i + 3] = 255;
      }
    },
    rect(x, y, w, h, rgba) {
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) this.px(x + dx, y + dy, rgba);
      }
    },
  };
}

function blitChunk(sheetRgba, chunkIndex, tileData) {
  const col = chunkIndex % SHEET_COLS;
  const row = Math.floor(chunkIndex / SHEET_COLS);
  const dx = col * TILE_PX;
  const dy = row * TILE_PX;
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const s = (y * TILE_PX + x) * 4;
      const d = ((dy + y) * SHEET_W + (dx + x)) * 4;
      sheetRgba[d] = tileData[s];
      sheetRgba[d + 1] = tileData[s + 1];
      sheetRgba[d + 2] = tileData[s + 2];
      sheetRgba[d + 3] = tileData[s + 3];
    }
  }
}

// ---------------------------------------------------------------------------
// PMD-Style Pixel Art Palettes & Procedural Prop Renderers
// ---------------------------------------------------------------------------

const SHADOW = [16, 22, 16, 92];
const SHADOW_SOFT = [16, 22, 16, 56];

const WOOD = {
  out: hexToRgba('#341c0e'),
  dark: hexToRgba('#62381c'),
  mid: hexToRgba('#945a2e'),
  lit: hexToRgba('#c28246'),
  cap: hexToRgba('#e6b26e'),
};

const STONE = {
  out: hexToRgba('#282d38'),
  dark: hexToRgba('#545d6e'),
  mid: hexToRgba('#808b9e'),
  lit: hexToRgba('#aeb8c8'),
  cap: hexToRgba('#d8e0ec'),
  moss: hexToRgba('#447c34'),
  mossLit: hexToRgba('#68a844'),
};

const HEDGE = {
  out: hexToRgba('#143418'),
  dark: hexToRgba('#245a24'),
  mid: hexToRgba('#3c8a30'),
  lit: hexToRgba('#6ec044'),
  cap: hexToRgba('#a4e264'),
  flowerA: hexToRgba('#ffe468'),
  flowerB: hexToRgba('#ff8cb4'),
};

const IRON = {
  out: hexToRgba('#202630'),
  mid: hexToRgba('#546074'),
  lit: hexToRgba('#8c9cb0'),
};

/** Draws a chunky PMD wooden fence post centered around (cx, topY..botY). */
function drawFencePost(c, cx, topY, botY) {
  const x0 = cx - 3;
  // Ground cast shadow
  c.rect(x0 - 1, botY, 8, 2, SHADOW);
  c.rect(x0, botY + 2, 6, 1, SHADOW_SOFT);
  // Outer border
  c.rect(x0, topY, 6, botY - topY + 1, WOOD.out);
  // Interior body
  c.rect(x0 + 1, topY + 1, 4, botY - topY - 1, WOOD.mid);
  // Left highlight & right shade
  c.rect(x0 + 1, topY + 3, 1, botY - topY - 3, WOOD.lit);
  c.rect(x0 + 4, topY + 3, 1, botY - topY - 3, WOOD.dark);
  // Top beveled cap
  c.rect(x0 + 1, topY + 1, 4, 2, WOOD.cap);
  c.px(x0 + 4, topY + 2, WOOD.lit);
  c.rect(x0 + 1, topY + 3, 4, 1, WOOD.dark);
  // Subtle wood grain notch
  if (botY - topY > 8) {
    c.px(x0 + 2, topY + 7, WOOD.dark);
    c.px(x0 + 3, topY + 10, WOOD.dark);
  }
}

/** Draws a horizontal rail segment spanning [xStart..xEnd] at railTopY (4px tall). */
function drawHorizontalRail(c, xStart, xEnd, railTopY) {
  const w = xEnd - xStart + 1;
  if (w <= 0) return;
  c.rect(xStart, railTopY, w, 1, WOOD.out);
  c.rect(xStart, railTopY + 1, w, 1, WOOD.lit);
  c.rect(xStart, railTopY + 2, w, 1, WOOD.mid);
  c.rect(xStart, railTopY + 3, w, 1, WOOD.out);
  // Grain dashes
  for (let x = xStart + 1; x < xEnd; x += 5) {
    c.px(x, railTopY + 2, WOOD.dark);
  }
}

/** Draws a vertical fence bar segment spanning [yStart..yEnd] centered at x=9..14. */
function drawVerticalBar(c, yStart, yEnd) {
  const h = yEnd - yStart + 1;
  if (h <= 0) return;
  c.rect(10, yStart, 4, h, WOOD.out);
  c.rect(11, yStart, 1, h, WOOD.lit);
  c.rect(12, yStart, 1, h, WOOD.mid);
  for (let y = yStart + 1; y < yEnd; y += 4) {
    c.px(12, y, WOOD.dark);
  }
}

function drawFenceTile(baseFloor, { n = false, s = false, e = false, w = false }) {
  const c = makeTileCanvas(baseFloor);

  // Horizontal rail cast shadows first
  if (w) c.rect(0, 19, 10, 2, SHADOW_SOFT);
  if (e) c.rect(14, 19, 10, 2, SHADOW_SOFT);
  if (n) c.rect(10, 0, 5, 10, SHADOW_SOFT);
  if (s) c.rect(10, 14, 5, 10, SHADOW_SOFT);

  // Vertical connectors (drawn behind center post)
  if (n) drawVerticalBar(c, 0, 11);
  if (s) drawVerticalBar(c, 13, 23);

  // Horizontal rails (upper + lower)
  if (w) {
    drawHorizontalRail(c, 0, 9, 8);
    drawHorizontalRail(c, 0, 9, 14);
  }
  if (e) {
    drawHorizontalRail(c, 14, 23, 8);
    drawHorizontalRail(c, 14, 23, 14);
  }

  // Side reinforcement posts on long vertical runs for solid visual weight
  if (n && s && !e && !w) {
    drawFencePost(c, 12, 0, 8);
    drawFencePost(c, 12, 12, 21);
  } else {
    // Center primary post
    drawFencePost(c, 12, 4, 20);
    // Secondary edge-posts on pure horizontal runs so long fences look rhythmic
    if (w && e && !n && !s) {
      // subtle nail rivets on rails near center post
      c.px(8, 9, WOOD.out);
      c.px(8, 15, WOOD.out);
      c.px(15, 9, WOOD.out);
      c.px(15, 15, WOOD.out);
    }
  }
  return c.data;
}

/** Modular Low Stone Wall (cobblestone masonry with optional moss). */
function drawStoneWallTile(baseFloor, { n = false, s = false, e = false, w = false, broken = false, mossy = true }) {
  const c = makeTileCanvas(baseFloor);

  const fillStoneBlock = (x, y, bw, bh) => {
    c.rect(x, y + bh, bw, 2, SHADOW);
    c.rect(x, y, bw, bh, STONE.out);
    if (bw > 2 && bh > 2) {
      c.rect(x + 1, y + 1, bw - 2, bh - 2, STONE.mid);
      // Top bevel cap (3/4 top face)
      c.rect(x + 1, y + 1, bw - 2, Math.min(3, bh - 2), STONE.lit);
      c.rect(x + 1, y + 1, bw - 2, 1, STONE.cap);
      // Bottom shadow face
      if (bh >= 6) {
        c.rect(x + 1, y + bh - 3, bw - 2, 2, STONE.dark);
      }
      // Mortar joints
      for (let mx = x + 4; mx < x + bw - 2; mx += 6) {
        c.rect(mx, y + 4, 1, Math.max(1, bh - 5), STONE.out);
        if (mx + 3 < x + bw - 1) c.rect(mx + 3, y + 1, 1, 3, STONE.dark);
      }
      if (bh >= 8) {
        c.rect(x + 1, y + Math.floor(bh / 2) + 1, bw - 2, 1, STONE.out);
      }
    }
  };

  if (broken) {
    // Two crumbled wall stumps with rubble gap in center
    fillStoneBlock(0, 7, 8, 11);
    fillStoneBlock(16, 8, 8, 10);
    // Rubble pebbles in gap
    c.rect(9, 15, 3, 2, STONE.out);
    c.px(10, 15, STONE.lit);
    c.rect(13, 13, 2, 2, STONE.dark);
    c.px(13, 13, STONE.mid);
    c.rect(11, 18, 3, 2, STONE.out);
    c.px(12, 18, STONE.mid);
    return c.data;
  }

  // Horizontal arms
  if (w) fillStoneBlock(0, 7, 10, 11);
  if (e) fillStoneBlock(14, 7, 10, 11);
  // Vertical arms
  if (n) fillStoneBlock(7, 0, 10, 11);
  if (s) fillStoneBlock(7, 13, 10, 11);
  // Center anchor block
  fillStoneBlock(6, 6, 12, 13);

  // Seamless stitch across connected arms
  if (w) {
    c.rect(6, 8, 3, 3, STONE.lit);
    c.rect(6, 8, 3, 1, STONE.cap);
    c.rect(6, 11, 3, 4, STONE.mid);
    c.rect(6, 15, 3, 2, STONE.dark);
  }
  if (e) {
    c.rect(15, 8, 3, 3, STONE.lit);
    c.rect(15, 8, 3, 1, STONE.cap);
    c.rect(15, 11, 3, 4, STONE.mid);
    c.rect(15, 15, 3, 2, STONE.dark);
  }
  if (n) {
    c.rect(8, 6, 8, 3, STONE.lit);
    c.rect(8, 9, 8, 2, STONE.mid);
  }
  if (s) {
    c.rect(8, 14, 8, 4, STONE.mid);
    c.rect(8, 18, 8, 2, STONE.dark);
  }

  if (mossy) {
    c.px(8, 8, STONE.mossLit);
    c.px(9, 8, STONE.moss);
    c.px(8, 9, STONE.moss);
    c.px(15, 13, STONE.moss);
    c.px(14, 14, STONE.mossLit);
  }
  return c.data;
}

/** Modular Trimmed Hedge with organic leafy shading and blossom dots. */
function drawHedgeTile(baseFloor, { n = false, s = false, e = false, w = false }) {
  const c = makeTileCanvas(baseFloor);
  const x0 = w ? 0 : 4;
  const x1 = e ? 23 : 19;
  const y0 = n ? 0 : 3;
  const y1 = s ? 23 : 20;

  // Cast shadow under hedge
  c.rect(x0 + 1, Math.min(22, y1), x1 - x0 - 1, 2, SHADOW);

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      // Round outer corners when not connected
      const isCorner =
        (!n && !w && x === x0 && y === y0) ||
        (!n && !e && x === x1 && y === y0) ||
        (!s && !w && x === x0 && y === y1) ||
        (!s && !e && x === x1 && y === y1);
      if (isCorner) continue;

      const onEdge =
        (!n && y === y0) ||
        (!s && y === y1) ||
        (!w && x === x0) ||
        (!e && x === x1);
      if (onEdge) {
        c.px(x, y, HEDGE.out);
        continue;
      }

      // Leaf cluster hash pattern
      const hash = ((x * 7 + y * 13) ^ (x * 3)) & 15;
      if (y <= y0 + 4) {
        c.px(x, y, hash < 4 ? HEDGE.cap : hash < 11 ? HEDGE.lit : HEDGE.mid);
      } else if (y >= y1 - 3) {
        c.px(x, y, hash < 5 ? HEDGE.out : HEDGE.dark);
      } else {
        c.px(x, y, hash < 3 ? HEDGE.lit : hash < 11 ? HEDGE.mid : HEDGE.dark);
      }
    }
  }

  // Tiny flower/berry accents
  c.px(9, 8, HEDGE.flowerA);
  c.px(15, 11, HEDGE.flowerB);
  if (w || e) c.px(5, 12, HEDGE.flowerA);
  return c.data;
}

/** Field Prop 1: 3/4 Wooden Supply Crate */
function drawCrateProp(baseFloor) {
  const c = makeTileCanvas(baseFloor);
  c.rect(4, 19, 17, 3, SHADOW);
  c.rect(4, 4, 16, 16, WOOD.out);
  // Top face (lid)
  c.rect(5, 5, 14, 5, WOOD.lit);
  c.rect(5, 5, 14, 1, WOOD.cap);
  c.rect(5, 7, 14, 1, WOOD.mid);
  c.rect(5, 10, 14, 1, WOOD.out);
  // Front face
  c.rect(5, 11, 14, 8, WOOD.mid);
  c.rect(6, 12, 12, 6, WOOD.dark);
  // Diagonal brace slat
  for (let i = 0; i < 6; i++) {
    c.px(6 + i * 2, 12 + i, WOOD.lit);
    c.px(7 + i * 2, 12 + i, WOOD.mid);
  }
  // Frame trim
  c.rect(5, 11, 14, 1, WOOD.lit);
  c.rect(5, 18, 14, 1, WOOD.dark);
  c.rect(5, 11, 1, 8, WOOD.lit);
  c.rect(18, 11, 1, 8, WOOD.dark);
  // Iron corner rivets
  c.px(6, 6, IRON.out);
  c.px(17, 6, IRON.out);
  c.px(6, 12, IRON.lit);
  c.px(17, 12, IRON.lit);
  c.px(6, 17, IRON.mid);
  c.px(17, 17, IRON.mid);
  return c.data;
}

/** Field Prop 2: Banded Oak Barrel */
function drawBarrelProp(baseFloor) {
  const c = makeTileCanvas(baseFloor);
  c.rect(5, 19, 14, 3, SHADOW);
  // Silhouette
  c.rect(7, 4, 10, 16, WOOD.out);
  c.rect(6, 6, 12, 12, WOOD.out);
  // Top lid
  c.rect(8, 5, 8, 3, WOOD.cap);
  c.rect(7, 6, 10, 2, WOOD.lit);
  c.rect(8, 8, 8, 1, WOOD.out);
  // Curved staves
  c.rect(7, 9, 10, 10, WOOD.mid);
  c.rect(8, 9, 2, 10, WOOD.lit);
  c.rect(15, 9, 2, 10, WOOD.dark);
  c.rect(11, 9, 1, 10, WOOD.dark);
  c.rect(14, 9, 1, 10, WOOD.dark);
  // Iron hoops
  c.rect(6, 10, 12, 2, IRON.out);
  c.rect(7, 10, 10, 1, IRON.lit);
  c.rect(6, 16, 12, 2, IRON.out);
  c.rect(7, 16, 10, 1, IRON.mid);
  return c.data;
}

/** Field Prop 3: PMD Village Wooden Signpost */
function drawSignpostProp(baseFloor) {
  const c = makeTileCanvas(baseFloor);
  c.rect(8, 19, 8, 2, SHADOW);
  // Post
  c.rect(10, 12, 4, 8, WOOD.out);
  c.rect(11, 13, 1, 6, WOOD.lit);
  c.rect(12, 13, 1, 6, WOOD.dark);
  // Plaque board
  c.rect(4, 4, 16, 10, WOOD.out);
  c.rect(5, 5, 14, 8, WOOD.lit);
  c.rect(5, 5, 14, 1, WOOD.cap);
  c.rect(5, 12, 14, 1, WOOD.dark);
  // Carved text lines
  c.rect(7, 7, 10, 1, WOOD.dark);
  c.rect(7, 9, 8, 1, WOOD.dark);
  c.rect(7, 11, 6, 1, WOOD.mid);
  return c.data;
}

/** Field Prop 4: Mossy Field Boulder */
function drawBoulderProp(baseFloor, mossy = true) {
  const c = makeTileCanvas(baseFloor);
  c.rect(4, 18, 16, 3, SHADOW);
  // Rounded silhouette
  c.rect(7, 5, 10, 14, STONE.out);
  c.rect(5, 7, 14, 11, STONE.out);
  c.rect(4, 10, 16, 7, STONE.out);
  // Mid body
  c.rect(7, 6, 10, 12, STONE.mid);
  c.rect(6, 8, 12, 9, STONE.mid);
  c.rect(5, 11, 14, 5, STONE.mid);
  // Lit upper facet
  c.rect(7, 6, 8, 4, STONE.lit);
  c.rect(8, 6, 6, 2, STONE.cap);
  c.rect(6, 9, 5, 3, STONE.lit);
  // Deep underside shade
  c.rect(6, 15, 12, 2, STONE.dark);
  c.rect(14, 11, 4, 5, STONE.dark);
  c.px(12, 10, STONE.dark);
  c.px(13, 11, STONE.dark);
  if (mossy) {
    c.rect(7, 7, 4, 2, STONE.mossLit);
    c.rect(6, 8, 3, 2, STONE.moss);
  }
  return c.data;
}

// ---------------------------------------------------------------------------
// Sheet Assembly
// ---------------------------------------------------------------------------

const FENCE_VARIANTS = [
  { e: true, w: true }, // +0: H
  { n: true, s: true }, // +1: V
  { s: true, e: true }, // +2: NW corner
  { s: true, w: true }, // +3: NE corner
  { n: true, e: true }, // +4: SW corner
  { n: true, w: true }, // +5: SE corner
  { n: true, e: true, w: true }, // +6: T-North
  { s: true, e: true, w: true }, // +7: T-South
  { n: true, s: true, w: true }, // +8: T-West
  { n: true, s: true, e: true }, // +9: T-East
  { n: true, s: true, e: true, w: true }, // +10: Cross
  { e: true }, // +11: End-Left
  { w: true }, // +12: End-Right
  { s: true }, // +13: End-Top
  { n: true }, // +14: End-Bottom
  {}, // +15: Standalone Post
];

const STONE_VARIANTS = [
  { e: true, w: true }, // +16: H
  { n: true, s: true }, // +17: V
  { s: true, e: true }, // +18: NW
  { s: true, w: true }, // +19: NE
  { n: true, e: true }, // +20: SW
  { n: true, w: true }, // +21: SE
  {}, // +22: Pillar
  { broken: true }, // +23: Broken/Gap
];

const HEDGE_VARIANTS = [
  { e: true, w: true }, // +24: H
  { n: true, s: true }, // +25: V
  { s: true, e: true }, // +26: NW
  { s: true, w: true }, // +27: NE
  { n: true, e: true }, // +28: SW
  { n: true, w: true }, // +29: SE
];

const BIOMES = [
  { id: '003', floorChunk: 28, startChunk: 1, mossy: false },
  { id: '042', floorChunk: 28, startChunk: 49, mossy: true },
  { id: '142', floorChunk: 27, startChunk: 97, mossy: true },
];

function main() {
  const tilesetDir = path.resolve(process.cwd(), 'assets', 'tilesets');
  const sheetRgba = new Uint8Array(SHEET_W * SHEET_H * 4);
  // Fill entire sheet with #505050 key color (chunk 0 defines key color)
  for (let i = 0; i < SHEET_W * SHEET_H; i++) {
    const p = i * 4;
    sheetRgba[p] = KEY_RGBA[0];
    sheetRgba[p + 1] = KEY_RGBA[1];
    sheetRgba[p + 2] = KEY_RGBA[2];
    sheetRgba[p + 3] = KEY_RGBA[3];
  }

  let totalChunks = 0;
  for (const biome of BIOMES) {
    const srcPath = path.join(tilesetDir, `tileset_${biome.id}.png`);
    const srcImg = decodePngRgba(srcPath);
    const baseFloor = extractChunk(srcImg, biome.floorChunk);
    const base = biome.startChunk;

    FENCE_VARIANTS.forEach((cfg, i) => {
      blitChunk(sheetRgba, base + i, drawFenceTile(baseFloor, cfg));
      totalChunks++;
    });
    STONE_VARIANTS.forEach((cfg, i) => {
      blitChunk(sheetRgba, base + 16 + i, drawStoneWallTile(baseFloor, { ...cfg, mossy: biome.mossy }));
      totalChunks++;
    });
    HEDGE_VARIANTS.forEach((cfg, i) => {
      blitChunk(sheetRgba, base + 24 + i, drawHedgeTile(baseFloor, cfg));
      totalChunks++;
    });
    // Row +2, cols 0..3 (offset +31..+34 from startChunk since startChunk is col 1)
    const propBase = base + 31;
    blitChunk(sheetRgba, propBase, drawCrateProp(baseFloor));
    blitChunk(sheetRgba, propBase + 1, drawBarrelProp(baseFloor));
    blitChunk(sheetRgba, propBase + 2, drawSignpostProp(baseFloor));
    blitChunk(sheetRgba, propBase + 3, drawBoulderProp(baseFloor, biome.mossy));
    totalChunks += 4;
  }

  const outPath = path.join(tilesetDir, 'tileset_144.png');
  fs.writeFileSync(outPath, encodePngRgba(SHEET_W, SHEET_H, sheetRgba));
  console.log(`Generated ${outPath} (${SHEET_W}x${SHEET_H}, ${totalChunks} custom chunks).`);
}

main();
