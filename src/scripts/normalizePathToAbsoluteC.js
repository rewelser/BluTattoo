/**
 * Normalize an SVG path 'd' into:
 * - absolute commands
 * - explicit cubic curves only (M + C + Z)
 * - one command per line
 *
 * Supports: M/m, C/c, S/s, Z/z
 * (Enough for common Illustrator "circle/droplet" exports.)
 */
function normalizePathToAbsoluteC(dRaw) {
  // 1) tokenize: commands or numbers
  const tokens = [];
  const re = /[MmCcSsZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
  const str = (dRaw || "").trim();
  let m;
  while ((m = re.exec(str))) tokens.push(m[0]);

  let i = 0;
  let cx = 0, cy = 0;          // current point
  let sx = 0, sy = 0;          // subpath start (for Z)
  let prevCmd = null;
  let prevC2x = null, prevC2y = null; // previous cubic's 2nd control point (for S reflection)

  const out = [];

  function isCmd(t) { return /^[A-Za-z]$/.test(t); }
  function num() {
    if (i >= tokens.length) throw new Error("Unexpected end of path data.");
    const t = tokens[i++];
    if (isCmd(t)) throw new Error(`Expected number, got command '${t}'.`);
    return Number(t);
  }
  function reflect(x, about) { return 2 * about - x; }

  while (i < tokens.length) {
    let cmd = tokens[i];

    // SVG allows repeating coordinate sets without repeating the command letter.
    if (isCmd(cmd)) {
      i++;
    } else {
      // implicit repeat of previous command
      if (!prevCmd) throw new Error("Path starts with numbers (missing initial command).");
      cmd = prevCmd;
    }

    prevCmd = cmd;

    if (cmd === "Z" || cmd === "z") {
      out.push(`Z`);
      cx = sx; cy = sy;
      prevC2x = prevC2y = null;
      continue;
    }

    if (cmd === "M" || cmd === "m") {
      // M: pairs, first is move, subsequent are treated as implicit L per spec,
      // but Illustrator outputs typically use a single move. We'll handle only the move pair here.
      const x = num(), y = num();
      if (cmd === "m") { cx += x; cy += y; } else { cx = x; cy = y; }
      sx = cx; sy = cy;
      out.push(`M ${cx.toFixed(2)} ${cy.toFixed(2)}`);
      prevC2x = prevC2y = null;

      // If more pairs follow, you could add L normalization here if needed.
      continue;
    }

    // C/c: can repeat in groups of 6 numbers
    if (cmd === "C" || cmd === "c") {
      while (i < tokens.length && !isCmd(tokens[i])) {
        let x1 = num(), y1 = num(), x2 = num(), y2 = num(), x = num(), y = num();
        if (cmd === "c") {
          x1 += cx; y1 += cy;
          x2 += cx; y2 += cy;
          x  += cx; y  += cy;
        }
        out.push(
          `C ${x1.toFixed(2)} ${y1.toFixed(2)}   ${x2.toFixed(2)} ${y2.toFixed(2)}   ${x.toFixed(2)} ${y.toFixed(2)}`
        );
        cx = x; cy = y;
        prevC2x = x2; prevC2y = y2;
      }
      continue;
    }

    // S/s: smooth cubic; reflect previous C2 about current point to get the missing C1
    if (cmd === "S" || cmd === "s") {
      while (i < tokens.length && !isCmd(tokens[i])) {
        let x2 = num(), y2 = num(), x = num(), y = num();
        if (cmd === "s") {
          x2 += cx; y2 += cy;
          x  += cx; y  += cy;
        }

        let x1, y1;
        if (prevC2x != null && (prevCmd === "C" || prevCmd === "c" || prevCmd === "S" || prevCmd === "s")) {
          x1 = reflect(prevC2x, cx);
          y1 = reflect(prevC2y, cy);
        } else {
          // If no previous cubic, reflection defaults to current point
          x1 = cx; y1 = cy;
        }

        out.push(
          `C ${x1.toFixed(2)} ${y1.toFixed(2)}   ${x2.toFixed(2)} ${y2.toFixed(2)}   ${x.toFixed(2)} ${y.toFixed(2)}`
        );
        cx = x; cy = y;
        prevC2x = x2; prevC2y = y2;
      }
      continue;
    }

    throw new Error(`Unsupported command '${cmd}'. This normalizer supports M/m, C/c, S/s, Z/z.`);
  }

  return out.join("\n");
}

// Convenience: just line-break without normalizing
function prettyBreaks(dRaw) {
  return (dRaw || "")
    .trim()
    .replace(/,/g, " ")
    .replace(/([MmCcSsZz])/g, "\n$1")
    .replace(/\s+/g, " ")
    .trim();
}

// Example usage:
// console.log(prettyBreaks(YOUR_D_STRING));
// console.log(normalizePathToAbsoluteC(YOUR_D_STRING));
