import * as fs from "fs";
import * as path from "path";

type Point = { id: string; q1: number; q2: number; n: number };

const ROW1: number[] = [
  52, 21, 93, 90, 89, 9, 31, 73, 64, 35, 48, 95, 77, 13, 33, 98, 49, 55, 55, 93,
];
const ROW2: number[] = [
  68, 56, 60, 33, 23, 86, 71, 58, 77, 40, 45, 81, 61, 90, 23, 50, 51, 54, 75,
  64,
];
const ROW3: number[] = [
  42, 24, 59, 19, 89, 44, 69, 38, 51, 76, 83, 19, 33, 43, 4, 56, 81, 75, 66, 11,
];

function toPoints(nums: number[], startIndex = 1): Point[] {
  const pts: Point[] = [];
  nums.forEach((raw, i) => {
    const n = Math.abs(Math.trunc(raw)) % 100; // берём две последние цифры
    const q1 = Math.floor(n / 10);
    const q2 = n % 10;
    pts.push({ id: `A${startIndex + i}`, q1, q2, n });
  });
  return pts;
}

function dominatesPareto(a: Point, b: Point): boolean {
  const geAll = a.q1 >= b.q1 && a.q2 >= b.q2;
  const gtAny = a.q1 > b.q1 || a.q2 > b.q2;
  return geAll && gtAny;
}

function dominatesSlater(a: Point, b: Point): boolean {
  return a.q1 > b.q1 && a.q2 > b.q2;
}

function computeFronts(points: Point[]) {
  const domByP: Record<string, Set<string>> = Object.fromEntries(
    points.map((p) => [p.id, new Set<string>()])
  );
  const domByS: Record<string, Set<string>> = Object.fromEntries(
    points.map((p) => [p.id, new Set<string>()])
  );

  for (let i = 0; i < points.length; i++) {
    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;
      const a = points[i],
        b = points[j];
      if (dominatesPareto(a, b)) domByP[b.id].add(a.id);
      if (dominatesSlater(a, b)) domByS[b.id].add(a.id);
    }
  }

  const paretoSet = Object.entries(domByP)
    .filter(([_, s]) => s.size === 0)
    .map(([pid]) => pid)
    .sort((x, y) => parseInt(x.slice(1)) - parseInt(y.slice(1)));

  const slaterSet = Object.entries(domByS)
    .filter(([_, s]) => s.size === 0)
    .map(([pid]) => pid)
    .sort((x, y) => parseInt(x.slice(1)) - parseInt(y.slice(1)));

  return { paretoSet, slaterSet, domByP, domByS };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!)
  );
}

function buildTablesHTML(
  points: Point[],
  domByP: Record<string, Set<string>>,
  domByS: Record<string, Set<string>>,
  blockName: string,
  groupSize = 10
): string {
  const groups = chunk(points, groupSize);
  const css = `
  <style>
    body{font-family:system-ui,Segoe UI,Arial; padding:24px}
    h1{margin:0 0 8px}
    h2{margin:32px 0 12px}
    .tbl{border-collapse:collapse; width:100%; margin:8px 0 24px; table-layout:fixed}
    .tbl caption{font-weight:600; text-align:left; margin-bottom:8px}
    .tbl th,.tbl td{border:1px solid #999; padding:6px 8px; vertical-align:middle; word-wrap:break-word}
    .tbl thead th{background:#eee}
    .crit{width:160px; text-align:center; font-weight:600}
    .alts{text-align:center; font-weight:600}
    .muted{color:#666}
    .pagebreak{page-break-after:always}
  </style>`;

  let html = `<!doctype html><html lang="uk"><head>
    <meta charset="utf-8"><title>${escapeHtml(
      blockName
    )} — Таблиці 1.1 та 1.2</title>
    ${css}
  </head><body>
  <h1>${escapeHtml(blockName)} — Таблиці 1.1 та 1.2</h1>`;

  groups.forEach((grp, gi) => {
    const ids = grp.map((p) => p.id);
    const q1 = grp.map((p) => p.q1);
    const q2 = grp.map((p) => p.q2);

    const headRow =
      `<tr><th rowspan="2" class="crit">Критерії</th><th colspan="${ids.length}" class="alts">Альтернативи</th></tr>` +
      `<tr>${ids.map((id) => `<th>${id}</th>`).join("")}</tr>`;

    const rowQ1 = `<tr><th>Q1</th>${q1
      .map((v) => `<td>${v}</td>`)
      .join("")}</tr>`;
    const rowQ2 = `<tr><th>Q2</th>${q2
      .map((v) => `<td>${v}</td>`)
      .join("")}</tr>`;

    const cellsP = ids
      .map((id) => {
        const arr = Array.from(domByP[id]).sort(
          (a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1))
        );
        return `<td>${
          arr.length
            ? escapeHtml(arr.join(", "))
            : "<span class='muted'>—</span>"
        }</td>`;
      })
      .join("");

    const cellsS = ids
      .map((id) => {
        const arr = Array.from(domByS[id]).sort(
          (a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1))
        );
        return `<td>${
          arr.length
            ? escapeHtml(arr.join(", "))
            : "<span class='muted'>—</span>"
        }</td>`;
      })
      .join("");

    html += `
    <h2>Альтернативи A${ids[0].slice(1)}–A${ids[ids.length - 1].slice(
      1
    )} (група ${gi + 1})</h2>

    <table class="tbl">
      <caption>Таблиця 1.1 — Значення альтернатив в області критеріїв</caption>
      <thead>${headRow}</thead>
      <tbody>${rowQ1}${rowQ2}</tbody>
    </table>

    <table class="tbl">
      <caption>Таблиця 1.2 — Значення альтернатив в області критеріїв</caption>
      <thead>${headRow}</thead>
      <tbody>
        ${rowQ1}
        ${rowQ2}
        <tr><th>Домінується<br>за Парето</th>${cellsP}</tr>
        <tr><th>Домінується<br>за Слейтером</th>${cellsS}</tr>
      </tbody>
    </table>

    ${gi !== groups.length - 1 ? '<div class="pagebreak"></div>' : ""}`;
  });

  html += `</body></html>`;
  return html;
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function saveTablesHTML(
  points: Point[],
  domByP: Record<string, Set<string>>,
  domByS: Record<string, Set<string>>,
  blockName: string,
  outDir: string,
  groupSize = 10
) {
  ensureDir(outDir);
  const html = buildTablesHTML(points, domByP, domByS, blockName, groupSize);
  fs.writeFileSync(path.join(outDir, `${blockName}_tables.html`), html, "utf8");
}

type PlotOpts = {
  labelMode?: "front" | "all" | "none"; // чьи подписи рисовать
  jitterDup?: number; // сдвиг для дублей (0..0.2 ок)
  lineMode?: "direct" | "step" | "none"; // как рисовать «фронт»
};

function savePlotHTML(
  points: Point[],
  frontIds: string[],
  title: string,
  filepath: string,
  opts: PlotOpts = { labelMode: "front", jitterDup: 0.12, lineMode: "direct" }
) {
  const labelMode = opts.labelMode ?? "front";
  const jitterDup = opts.jitterDup ?? 0.12;
  const lineMode = opts.lineMode ?? "direct";

  const xs = points.map((p) => p.q1);
  const ys = points.map((p) => p.q2);
  const labels = points.map((p) => p.id);
  const mask = points.map((p) => frontIds.includes(p.id));

  // счёт дублей
  const key = (i: number) => `${xs[i]},${ys[i]}`;
  const counts = new Map<string, number>();
  for (let i = 0; i < xs.length; i++)
    counts.set(key(i), (counts.get(key(i)) ?? 0) + 1);

  // джиттер только дублям
  const rand = () => (Math.random() * 2 - 1) * jitterDup;
  const jx = xs.map((v, i) =>
    counts.get(key(i))! > 1 && jitterDup > 0 ? v + rand() : v
  );
  const jy = ys.map((v, i) =>
    counts.get(key(i))! > 1 && jitterDup > 0 ? v + rand() : v
  );

  // исходные (без джиттера) для hover и линий
  const custom = xs.map((_, i) => [xs[i], ys[i]]);

  // точки фронта (без дублей) упорядочим
  const frontPts = points
    .filter((p) => frontIds.includes(p.id))
    .map((p) => ({ x: p.q1, y: p.q2 }))
    .sort((a, b) => (a.x === b.x ? b.y - a.y : a.x - b.x));

  // убрать возможные дубли координат на фронте
  const uniq: { x: number; y: number }[] = [];
  const seen = new Set<string>();
  for (const p of frontPts) {
    const k = `${p.x},${p.y}`;
    if (!seen.has(k)) {
      seen.add(k);
      uniq.push({ x: p.x, y: p.y });
    }
  }

  // линия фронта
  let lineX: number[] = [],
    lineY: number[] = [];
  if (lineMode !== "none" && uniq.length >= 2) {
    if (lineMode === "direct") {
      lineX = uniq.map((p) => p.x);
      lineY = uniq.map((p) => p.y);
    } else {
      // "step"
      for (let i = 0; i < uniq.length; i++) {
        const p = uniq[i];
        if (i === 0) {
          lineX.push(p.x);
          lineY.push(p.y);
          continue;
        }
        const prev = uniq[i - 1];
        lineX.push(p.x);
        lineY.push(prev.y); // горизонталь
        lineX.push(p.x);
        lineY.push(p.y); // вертикаль
      }
    }
  }

  const html = `<!doctype html>
<html lang="uk"><head>
  <meta charset="utf-8"/><title>${title}</title>
  <script src="https://cdn.plot.ly/plotly-2.35.2.min.js"></script>
  <style>body{margin:0;padding:0;font-family:system-ui,Segoe UI,Arial}</style>
</head><body>
  <div id="chart" style="width:960px;height:720px;margin:24px auto;"></div>
  <script>
    const jx  = ${JSON.stringify(jx)};
    const jy  = ${JSON.stringify(jy)};
    const labs= ${JSON.stringify(labels)};
    const mask= ${JSON.stringify(mask)};
    const custom = ${JSON.stringify(custom)};
    const lineX = ${JSON.stringify(lineX)};
    const lineY = ${JSON.stringify(lineY)};
    const labelMode = ${JSON.stringify(labelMode)};

    const allTrace = {
      x: jx, y: jy,
      mode: (labelMode === 'all') ? 'markers+text' : 'markers',
      text: labs,
      textposition: 'top left',
      textfont: { size: 10 },
      marker: { size: 7, opacity: 0.8, line: { width: 0.5 } },
      name: 'Усі альтернативи',
      hovertemplate: '<b>%{text}</b><br>Q1=%{customdata[0]}<br>Q2=%{customdata[1]}<extra></extra>',
      customdata: custom,
      cliponaxis: false
    };

    const frontTrace = {
      x: jx.filter((_,i)=>mask[i]),
      y: jy.filter((_,i)=>mask[i]),
      text: labs.filter((_,i)=>mask[i]),
      textposition: 'top center',
      textfont: { size: 12 },
      mode: (labelMode === 'none') ? 'markers' : 'markers+text',
      marker: { size: 11, symbol: 'diamond', opacity: 0.95, line: { width: 1 } },
      name: 'Фронт',
      hovertemplate: '<b>%{text}</b><br>Q1=%{customdata[0]}<br>Q2=%{customdata[1]}<extra></extra>',
      customdata: custom.filter((_,i)=>mask[i]),
      cliponaxis: false
    };

    const lineTrace = (lineX.length > 0) ? {
      x: lineX, y: lineY,
      mode: 'lines',
      line: { width: 2, shape: ${JSON.stringify(
        lineMode === "direct" ? "linear" : "hv"
      )} },
      name: 'Лінія фронту'
    } : null;

    const traces = lineTrace ? [allTrace, frontTrace, lineTrace] : [allTrace, frontTrace];

    Plotly.newPlot('chart', traces, {
      title: ${JSON.stringify(title)},
      hovermode: 'closest',
      margin: {l:60, r:20, t:60, b:60},
      xaxis: { title: 'Q1 (maximize)', rangemode: 'tozero', dtick: 1, gridcolor: 'rgba(0,0,0,0.1)' },
      yaxis: { title: 'Q2 (maximize)', rangemode: 'tozero', dtick: 1, gridcolor: 'rgba(0,0,0,0.1)' },
      legend: { orientation: 'h', x: 0.5, xanchor: 'center' }
    }, {displaylogo:false});
  </script>
</body></html>`;
  fs.writeFileSync(filepath, html, "utf8");
}

function saveTablesAndPlots(
  points: Point[],
  paretoSet: string[],
  slaterSet: string[],
  domByP: Record<string, Set<string>>,
  domByS: Record<string, Set<string>>,
  blockName: string
) {
  const figsDir = path.join(process.cwd(), "figs");
  const tablesDir = path.join(process.cwd(), "tables");
  ensureDir(figsDir);
  ensureDir(tablesDir);

  saveTablesHTML(points, domByP, domByS, blockName, tablesDir, 10);

  savePlotHTML(
    points,
    paretoSet,
    `${blockName}: Границя Парето`,
    path.join(figsDir, `${blockName}_pareto.html`),
    { labelMode: "front", jitterDup: 0.12, lineMode: "direct" }
  );
  savePlotHTML(
    points,
    slaterSet,
    `${blockName}: Границя Слейтера`,
    path.join(figsDir, `${blockName}_slater.html`),
    { labelMode: "front", jitterDup: 0.12, lineMode: "direct" }
  );
}

function runBlock(nums: number[], blockName: string, startIndex: number) {
  const points = toPoints(nums, startIndex);
  const { paretoSet, slaterSet, domByP, domByS } = computeFronts(points);

  console.log(`\n=== ${blockName}: короткий підсумок ===`);
  console.log(`Парето:  ${paretoSet.join(", ") || "—"}`);
  console.log(`Слейтер: ${slaterSet.join(", ") || "—"}`);

  saveTablesAndPlots(points, paretoSet, slaterSet, domByP, domByS, blockName);

  return { lastIdx: startIndex + points.length - 1 };
}

(function main() {
  if (ROW1.length !== 20 || ROW2.length !== 20 || ROW3.length !== 20) {
    console.log(
      "Будь ласка, заповніть ROW1, ROW2, ROW3 (по 20 чисел у кожному)."
    );
    process.exit(0);
  }

  const { lastIdx: idx1 } = runBlock(ROW1, "Рядок1", 1);
  const { lastIdx: idx2 } = runBlock(ROW2, "Рядок2", idx1 + 1);
  runBlock(ROW3, "Рядок3", idx2 + 1);

  const all = ROW1.concat(ROW2, ROW3);
  runBlock(all, "Об'єднано(1-3)", 1);
})();
