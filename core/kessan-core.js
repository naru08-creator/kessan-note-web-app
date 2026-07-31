// 決算ノート — 共通コア（Electron版・Web版で共有するUI本体）
// ビルド不要：<script type="text/babel"> として読み込む前提。
// React / ReactDOM / Recharts はグローバル（CDN読み込み）を利用する。
const { useState, useEffect, useRef } = React;
const {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell
} = Recharts;

const COLORS = {
  paper: '#E9EEE1',
  card: '#F6F8F0',
  ink: '#1E2A3A',
  inkMuted: '#5B6B5F',
  border: '#C7D0BC',
  stamp: '#A63D2F',
  teal: '#2F6B5E',
  computedBg: '#E4E9DC',
};

const PL_COLORS = { cogs: '#C97B63', sga: '#D9A441', opProfit: '#2F6B5E', netProfit: '#1E2A3A' };
const BS_ASSET_COLORS = { currentAssets: '#6E9075', fixedAssets: '#B08B2E' };
const BS_LIAB_COLORS = { currentLiab: '#A63D2F', fixedLiab: '#C97B63', equity: '#2F6B5E' };

// type: 'input' は手入力、'computed' は自動計算（編集不可）
// 会計基準（standard: 'jgaap' | 'ifrs'）によって表記を切り替える
const PL_TAB = (standard) => ([
  { type: 'input', key: 'sales', label: standard === 'ifrs' ? '売上収益' : '売上高', unit: '百万円' },
  { type: 'input', key: 'cogs', label: '売上原価', unit: '百万円' },
  { type: 'input', key: 'sga', label: '販管費', unit: '百万円' },
  { type: 'computed', key: 'opProfit', label: '営業利益', unit: '百万円' },
  { type: 'input', key: 'ordProfit', label: standard === 'ifrs' ? '税引前利益' : '経常利益', unit: '百万円' },
  { type: 'input', key: 'netProfit', label: standard === 'ifrs' ? '当期利益' : '当期純利益', unit: '百万円' },
  { type: 'input', key: 'eps', label: 'EPS', unit: '円' },
]);
const BS_TAB = (standard) => ([
  { type: 'input', key: 'currentAssets', label: '流動資産', unit: '百万円' },
  { type: 'input', key: 'fixedAssets', label: standard === 'ifrs' ? '非流動資産（のれん含む）' : '固定資産（のれん含む）', unit: '百万円' },
  { type: 'input', key: 'goodwill', label: 'のれん（固定資産の内訳参考）', unit: '百万円' },
  { type: 'input', key: 'currentLiab', label: '流動負債', unit: '百万円' },
  { type: 'input', key: 'fixedLiab', label: standard === 'ifrs' ? '非流動負債' : '固定負債', unit: '百万円' },
  { type: 'input', key: 'borrowings', label: '借入金（固定負債の内訳参考）', unit: '百万円' },
  { type: 'input', key: 'equity', label: '純資産（または資本合計）', unit: '百万円' },
]);
const CF_TAB = [
  { type: 'input', key: 'beginningCash', label: '期首現金残高', unit: '百万円' },
  { type: 'input', key: 'opCF', label: '営業CF', unit: '百万円' },
  { type: 'input', key: 'invCF', label: '投資CF', unit: '百万円' },
  { type: 'input', key: 'finCF', label: '財務CF', unit: '百万円' },
  { type: 'input', key: 'fxAdjustment', label: 'その他調整（為替換算差額など）', unit: '百万円' },
  { type: 'computed', key: 'fcf', label: 'FCF', unit: '百万円' },
  { type: 'computed', key: 'endingCash', label: '期末現金残高', unit: '百万円' },
];
const KPI_TAB = [
  { type: 'computed', key: 'roe', label: 'ROE', unit: '%' },
  { type: 'computed', key: 'roa', label: 'ROA', unit: '%' },
  { type: 'computed', key: 'equityRatio', label: '自己資本比率', unit: '%' },
  { type: 'computed', key: 'opMargin', label: '営業利益率', unit: '%' },
  { type: 'computed', key: 'deRatio', label: 'D/Eレシオ', unit: '倍' },
  { type: 'input', key: 'per', label: 'PER', unit: '倍' },
  { type: 'input', key: 'pbr', label: 'PBR', unit: '倍' },
  { type: 'input', key: 'dividend', label: '配当', unit: '円' },
  { type: 'computed', key: 'payoutRatio', label: '配当性向', unit: '%' },
];
function getTabFields(tab, standard) {
  if (tab === 'pl') return PL_TAB(standard);
  if (tab === 'bs') return BS_TAB(standard);
  if (tab === 'cf') return CF_TAB;
  if (tab === 'kpi') return KPI_TAB;
  return [];
}

// 決算書初心者向けの用語説明（？アイコンをクリックすると表示される）
const TERM_INFO = {
  pl: {
    sales: '本業でどれだけ稼いだかを示す金額。すべての利益の出発点になる数字。',
    cogs: '商品やサービスを作るために直接かかった費用。売上高からこれを引くと「粗利（売上総利益）」になる。',
    sga: '広告費や人件費など、商品を作る以外にかかった費用（販売費及び一般管理費）。',
    opProfit: '本業でどれだけ儲けたかを示す利益。「売上高－売上原価－販管費」で計算する。',
    ordProfit: '本業の利益に、利息の受け取り・支払いなど本業以外の損益を足し引きしたもの（IFRSでは税引前利益として表示）。',
    netProfit: '税金なども全て差し引いた後、最終的に会社に残った利益。',
    eps: '1株あたりの当期純利益。「当期純利益 ÷ 発行済株式数」で計算する。',
  },
  bs: {
    currentAssets: '1年以内に現金化できる資産（現金・預金・在庫など）。',
    fixedAssets: '工場や建物など、長期間使うための資産。のれんもここに含まれる。',
    goodwill: 'M&Aで買収した際に、相手企業の純資産を上回って支払った金額。固定資産の一部として扱う。',
    currentLiab: '1年以内に支払う必要がある負債。',
    fixedLiab: '1年より長い期間で返済する負債（長期借入金など）。',
    borrowings: '銀行などから借りているお金。固定負債の一部として扱う。',
    equity: '資産から負債を引いた、株主に帰属する会社の正味の財産。',
  },
  cf: {
    beginningCash: 'その期の始まり時点で会社が持っていた現金の金額。',
    opCF: '本業の営業活動で実際に増減した現金の金額。',
    invCF: '設備投資や有価証券の売買など、投資活動で増減した現金の金額。',
    finCF: '借入や返済、配当の支払いなど、資金調達に関する活動で増減した現金の金額。',
    fxAdjustment: '為替レートの変動など、営業・投資・財務のどれにも当てはまらない現金の増減。',
    fcf: '会社が自由に使えるお金。「営業CF＋投資CF」で計算する。',
    endingCash: '期末時点で会社が持っている現金の金額。期首残高に各CFを足して計算する。',
  },
  kpi: {
    roe: '株主が出したお金でどれだけ利益を生み出したかを示す指標。「当期純利益 ÷ 純資産 × 100」で計算する。',
    roa: '会社の持つ資産全体でどれだけ利益を生み出したかを示す指標。「当期純利益 ÷ 総資産 × 100」で計算する。',
    equityRatio: '総資産のうち、返済不要な自分のお金（純資産）が占める割合。高いほど倒産しにくい、安全性の高い会社とされる。「純資産 ÷ 総資産 × 100」で計算する。',
    opMargin: '売上高のうち、本業でどれだけ効率よく利益を残せているかを示す指標。高いほど「稼ぐ力」が強い会社とされる。「営業利益 ÷ 売上高 × 100」で計算する。',
    deRatio: '純資産に対して借入金がどれくらいあるかを示す指標。低いほど借金への依存度が低く、財務が安定しているとされる。「借入金 ÷ 純資産」で計算する。',
    per: '株価が1株あたり利益の何倍まで買われているかを示す指標。割安・割高の目安になる。「株価 ÷ EPS」で計算する。',
    pbr: '株価が1株あたり純資産の何倍まで買われているかを示す指標。「株価 ÷ 1株あたり純資産」で計算する。',
    dividend: '株主に還元される1株あたりの配当金額。',
    payoutRatio: '利益のうち、どれくらいを配当として株主に還元しているかを示す割合。「配当 ÷ EPS × 100」で計算する。',
  },
};

const TABS = [
  { key: 'pl', label: 'P/L', emoji: '📈' },
  { key: 'bs', label: 'B/S', emoji: '🏦' },
  { key: 'cf', label: 'C/F', emoji: '💰' },
  { key: 'kpi', label: '指標', emoji: '📊' },
  { key: 'memo', label: 'メモ', emoji: '📝' },
];

// PL/BS/CF/KPIの「入力項目」の完全なキー一覧（CSVシリアライズ等でも再利用する）
const PL_KEYS = ['sales', 'cogs', 'sga', 'ordProfit', 'netProfit', 'eps'];
const BS_KEYS = ['currentAssets', 'fixedAssets', 'goodwill', 'currentLiab', 'fixedLiab', 'borrowings', 'equity'];
const CF_KEYS = ['beginningCash', 'opCF', 'invCF', 'finCF', 'fxAdjustment'];
const KPI_KEYS = ['per', 'pbr', 'dividend'];

const emptyYearData = () => ({
  pl: { sales: '', cogs: '', sga: '', ordProfit: '', netProfit: '', eps: '' },
  bs: { currentAssets: '', fixedAssets: '', goodwill: '', currentLiab: '', fixedLiab: '', borrowings: '', equity: '' },
  cf: { beginningCash: '', opCF: '', invCF: '', finCF: '', fxAdjustment: '' },
  kpi: { per: '', pbr: '', dividend: '' },
  memo: '',
});

const emptyCompany = () => ({ name: '', ticker: '', favorite: false, standard: 'jgaap', years: {} });

const n = (v) => { const f = parseFloat(v); return isNaN(f) ? 0 : f; };

// 入力値から自動計算する項目をまとめて算出
function computeDerived(yd) {
  const sales = n(yd.pl.sales), cogs = n(yd.pl.cogs), sga = n(yd.pl.sga);
  const netProfit = n(yd.pl.netProfit), eps = n(yd.pl.eps), dividend = n(yd.kpi.dividend);
  const opCF = n(yd.cf.opCF), invCF = n(yd.cf.invCF), finCF = n(yd.cf.finCF), fxAdjustment = n(yd.cf.fxAdjustment);
  const beginningCash = n(yd.cf.beginningCash);
  // のれんは固定資産の内訳（すでに含まれる）なので合計には加算しない
  const totalAssets = n(yd.bs.currentAssets) + n(yd.bs.fixedAssets);
  const totalLiabEquity = n(yd.bs.currentLiab) + n(yd.bs.fixedLiab) + n(yd.bs.equity);
  const equity = n(yd.bs.equity);
  const borrowings = n(yd.bs.borrowings);
  const opProfit = sales - cogs - sga;
  return {
    opProfit,
    fcf: opCF + invCF,
    endingCash: beginningCash + opCF + invCF + finCF + fxAdjustment,
    totalAssets,
    totalLiabEquity,
    roe: equity !== 0 ? (netProfit / equity) * 100 : 0,
    roa: totalAssets !== 0 ? (netProfit / totalAssets) * 100 : 0,
    equityRatio: totalAssets !== 0 ? (equity / totalAssets) * 100 : 0,
    opMargin: sales !== 0 ? (opProfit / sales) * 100 : 0,
    deRatio: equity !== 0 ? borrowings / equity : 0,
    payoutRatio: eps !== 0 ? (dividend / eps) * 100 : 0,
  };
}

function InfoTip({ text }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <span style={{ position: 'relative', display: 'inline-block', marginLeft: 5 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={{
          width: 15, height: 15, borderRadius: '50%', border: `1px solid ${COLORS.inkMuted}`,
          background: '#fff', color: COLORS.inkMuted, fontSize: 10, lineHeight: '13px',
          cursor: 'pointer', padding: 0, verticalAlign: 'middle',
        }}
        aria-label="用語の説明"
      >？</button>
      {open && (
        <div style={{
          position: 'absolute', zIndex: 30, top: '130%', left: 0, width: 230,
          background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 6,
          padding: '10px 12px', fontSize: 12, lineHeight: 1.6, color: COLORS.ink,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontFamily: "'Zen Kaku Gothic New', sans-serif",
          fontWeight: 400, whiteSpace: 'normal',
        }}>{text}</div>
      )}
    </span>
  );
}

function Field({ label, unit, value, onChange, info }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 13, color: COLORS.inkMuted, fontFamily: "'Zen Kaku Gothic New', sans-serif" }}>
        {label} <span style={{ fontSize: 11 }}>({unit})</span>
        <InfoTip text={info} />
      </span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontVariantNumeric: 'tabular-nums',
          padding: '8px 10px',
          borderRadius: 6,
          border: `1px solid ${COLORS.border}`,
          background: '#fff',
          color: COLORS.ink,
          fontSize: 14,
        }}
        placeholder="0"
      />
    </label>
  );
}

function ComputedField({ label, unit, value, info }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 13, color: COLORS.inkMuted, fontFamily: "'Zen Kaku Gothic New', sans-serif" }}>
        {label} <span style={{ fontSize: 11 }}>({unit})</span>
        <InfoTip text={info} />
        <span style={{
          fontSize: 10, marginLeft: 6, color: COLORS.teal, border: `1px solid ${COLORS.teal}`,
          borderRadius: 4, padding: '0 4px',
        }}>自動計算</span>
      </span>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums',
        padding: '8px 10px', borderRadius: 6, border: `1px dashed ${COLORS.border}`,
        background: COLORS.computedBg, color: COLORS.ink, fontSize: 14,
      }}>
        {Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '0'}
      </div>
    </div>
  );
}

function buildPlChartData(yd, derived, label) {
  return [{
    name: label,
    売上原価: n(yd.pl.cogs), 販管費: n(yd.pl.sga),
    営業利益: derived.opProfit, 当期純利益: n(yd.pl.netProfit),
  }];
}

function buildBsCombinedData(yd) {
  return [
    { name: '資産', 固定資産: n(yd.bs.fixedAssets), 流動資産: n(yd.bs.currentAssets) },
    { name: '負債・純資産', 純資産: n(yd.bs.equity), 固定負債: n(yd.bs.fixedLiab), 流動負債: n(yd.bs.currentLiab) },
  ];
}

// 各行を「その行の合計を100%とした割合」に変換する（構成比較モード用）
function toPercentStacked(rows) {
  return rows.map((row) => {
    const keys = Object.keys(row).filter((k) => k !== 'name');
    const total = keys.reduce((s, k) => s + (row[k] || 0), 0) || 1;
    const out = { name: row.name };
    keys.forEach((k) => { out[k] = (row[k] || 0) / total * 100; });
    return out;
  });
}

function buildCfWaterfallData(yd) {
  const beginCash = n(yd.cf.beginningCash);
  const opCF = n(yd.cf.opCF), invCF = n(yd.cf.invCF), finCF = n(yd.cf.finCF), fxAdj = n(yd.cf.fxAdjustment);
  const c0 = beginCash, c1 = c0 + opCF, c2 = c1 + invCF, c3 = c2 + finCF, c4 = c3 + fxAdj;
  return [
    { name: '期首残高', base: 0, value: c0, rawValue: c0, kind: 'total' },
    { name: '営業CF', base: Math.min(c0, c1), value: Math.abs(opCF), rawValue: opCF, kind: opCF >= 0 ? 'up' : 'down' },
    { name: '投資CF', base: Math.min(c1, c2), value: Math.abs(invCF), rawValue: invCF, kind: invCF >= 0 ? 'up' : 'down' },
    { name: '財務CF', base: Math.min(c2, c3), value: Math.abs(finCF), rawValue: finCF, kind: finCF >= 0 ? 'up' : 'down' },
    { name: '期末残高', base: 0, value: c4, rawValue: c4, kind: 'total' },
  ];
}

// 会社比較ページで使う、1社分のCFキャッシュフロー滝グラフ（P/L・B/Sは統合比較グラフ側で表示する）
function CompanyCfColumn({ title, yd }) {
  const cfData = buildCfWaterfallData(yd);
  return (
    <ChartCard title={`💰 ${title} キャッシュフロー滝グラフ（百万円）`}>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={cfData}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip content={<CFWaterfallTooltip />} />
          <Bar dataKey="base" stackId="cf" fill="transparent" legendType="none" isAnimationActive={false} />
          <Bar dataKey="value" stackId="cf" isAnimationActive={false}>
            {cfData.map((entry, i) => (
              <Cell key={i} fill={entry.kind === 'total' ? COLORS.ink : entry.kind === 'up' ? COLORS.teal : COLORS.stamp} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function CFWaterfallTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload.find((p) => p.dataKey === 'value');
  if (!p) return null;
  return (
    <div style={{ background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13 }}>
      <div style={{ fontWeight: 700 }}>{label}</div>
      <div>{p.payload.rawValue.toLocaleString()} 百万円</div>
    </div>
  );
}

// Admax等の広告scriptタグを安全に差し込むための枠。
// これらの広告タグは内部でdocument.write()を使っていることが多く、ページ読み込み後に
// JSで動的挿入されたscriptからのdocument.write()は最近のブラウザで無視されてしまう。
// そのため、専用のiframeを作ってその中の真っさらなドキュメントに書き込む形にしている。
function AdSlot({ src }) {
  const containerRef = useRef(null);
  useEffect(() => {
    if (!containerRef.current || !src) return;
    containerRef.current.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.style.border = 'none';
    iframe.style.width = '100%';
    iframe.style.minHeight = '1px';
    iframe.scrolling = 'no';
    containerRef.current.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(
      '<!DOCTYPE html><html><head><style>html,body{margin:0;padding:0;display:flex;justify-content:center;overflow:hidden;}</style></head>' +
      '<body><script src="' + src + '"><' + '/script></body></html>'
    );
    doc.close();

    // 広告は遅れて読み込まれることが多いので、高さを数秒ポーリングして自動調整する
    const resize = () => {
      try {
        const h = doc.body ? doc.body.scrollHeight : 0;
        if (h > 0) iframe.style.height = h + 'px';
      } catch (e) { /* no-op */ }
    };
    iframe.addEventListener('load', resize);
    const poll = setInterval(resize, 500);
    const stop = setTimeout(() => clearInterval(poll), 6000);
    return () => { clearInterval(poll); clearTimeout(stop); };
  }, [src]);
  return (
    <div
      ref={containerRef}
      className="no-print"
      style={{ display: 'flex', justifyContent: 'center', margin: '14px 0' }}
    />
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="chart-card" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '16px 18px' }}>
      <div style={{ fontFamily: "'Zen Old Mincho', serif", fontSize: 15, marginBottom: 8, color: COLORS.ink }}>{title}</div>
      {children}
    </div>
  );
}

// ── CSVバックアップ機能用のユーティリティ（Electron版のフォルダ保存とは別に、
//    どちらのプラットフォームでも「zipでバックアップ／読み込み」できるようにするためのもの）──
const CSV_LABELS = {
  pl: { sales: '売上高', cogs: '売上原価', sga: '販管費', ordProfit: '経常利益(またはIFRS税引前利益)', netProfit: '当期純利益', eps: 'EPS' },
  bs: { currentAssets: '流動資産', fixedAssets: '固定資産(のれん含む)', goodwill: 'のれん(内訳参考)', currentLiab: '流動負債', fixedLiab: '固定負債', borrowings: '借入金(内訳参考)', equity: '純資産(または資本合計)' },
  cf: { beginningCash: '期首現金残高', opCF: '営業CF', invCF: '投資CF', finCF: '財務CF', fxAdjustment: 'その他調整(為替換算差額など)' },
  kpi: { per: 'PER', pbr: 'PBR', dividend: '配当' },
};

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function rowsToCsv(rows) {
  // 先頭にBOMを付けないと、Excelで開いたときに日本語が文字化けする
  return '\uFEFF' + rows.map((r) => r.map(csvEscape).join(',')).join('\n');
}

function csvToRows(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = [];
  let i = 0, field = '', row = [], inQuotes = false;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    } else {
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ',') { row.push(field); field = ''; i++; continue; }
      if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); field = ''; row = []; i++; continue;
      }
      field += c; i++; continue;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1 || r[0] !== '');
}

function companyYearToRows(comp, year, yearData) {
  const rows = [['category', 'key', 'label', 'value']];
  rows.push(['company', 'name', '会社名', comp.name || '']);
  rows.push(['company', 'ticker', '証券コード', comp.ticker || '']);
  rows.push(['company', 'favorite', 'お気に入り(1/0)', comp.favorite ? '1' : '0']);
  rows.push(['company', 'standard', '会計基準', comp.standard || 'jgaap']);
  rows.push(['meta', 'year', '年度', year]);
  PL_KEYS.forEach((k) => rows.push(['pl', k, CSV_LABELS.pl[k] || k, yearData.pl[k] ?? '']));
  BS_KEYS.forEach((k) => rows.push(['bs', k, CSV_LABELS.bs[k] || k, yearData.bs[k] ?? '']));
  CF_KEYS.forEach((k) => rows.push(['cf', k, CSV_LABELS.cf[k] || k, yearData.cf[k] ?? '']));
  KPI_KEYS.forEach((k) => rows.push(['kpi', k, CSV_LABELS.kpi[k] || k, yearData.kpi[k] ?? '']));
  rows.push(['memo', 'memo', 'メモ', yearData.memo || '']);
  return rows;
}

function rowsToCompanyYear(rows) {
  const meta = { name: '', ticker: '', favorite: false, standard: 'jgaap' };
  const yearData = emptyYearData();
  let year = '';
  for (let i = 1; i < rows.length; i++) {
    const [category, key, , value] = rows[i];
    if (category === 'company') {
      if (key === 'name') meta.name = value;
      else if (key === 'ticker') meta.ticker = value;
      else if (key === 'favorite') meta.favorite = value === '1';
      else if (key === 'standard') meta.standard = value || 'jgaap';
    } else if (category === 'meta' && key === 'year') {
      year = value;
    } else if (category === 'memo') {
      yearData.memo = value;
    } else if (yearData[category] && key in yearData[category]) {
      yearData[category][key] = value;
    }
  }
  return { meta, year, yearData };
}

window.KessanCsvUtils = { csvEscape, rowsToCsv, csvToRows, companyYearToRows, rowsToCompanyYear };

// storage: { loadAll(): Promise<{companies}|null>, saveAll(companies): Promise<void> }
// platform: 'electron' | 'web'
// folderPath / onChooseFolder: Electron版のみ使用（保存先フォルダの表示・変更）
function KessanNoteCore({ storage, platform, folderPath, onChooseFolder, licenseUrl, copyrightHolder }) {
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState({});
  const [activeCompanyId, setActiveCompanyId] = useState(null);
  const [currentYear, setCurrentYear] = useState(null);
  const [activeTab, setActiveTab] = useState('pl');
  const [newYearInput, setNewYearInput] = useState('');
  const [stamped, setStamped] = useState(false);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState('input'); // 'input' | 'charts' | 'compare'
  const [compareAId, setCompareAId] = useState(null);
  const [compareAYear, setCompareAYear] = useState(null);
  const [compareBId, setCompareBId] = useState(null);
  const [compareBYear, setCompareBYear] = useState(null);
  const [compareMode, setCompareMode] = useState('absolute'); // 'absolute' | 'percent'
  const fileInputRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await storage.loadAll();
        const comps = (res && res.companies) || {};
        setCompanies(comps);
        const ids = Object.keys(comps);
        if (ids.length) {
          setActiveCompanyId(ids[0]);
          const yrs = Object.keys(comps[ids[0]].years || {}).sort();
          if (yrs.length) setCurrentYear(yrs[yrs.length - 1]);
        }
      } catch (e) {
        console.error('読み込みに失敗しました', e);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function persist(nextCompanies) {
    try {
      await storage.saveAll(nextCompanies);
      setStatus('saved');
      setStamped(true);
      setTimeout(() => setStamped(false), 1300);
    } catch (e) {
      console.error('保存に失敗しました', e);
      setStatus('error');
    }
  }

  function addCompany() {
    const id = 'temp_' + Date.now();
    const next = { ...companies, [id]: emptyCompany() };
    setCompanies(next);
    setActiveCompanyId(id);
    setCurrentYear(null);
    setActiveTab('pl');
    setPage('input');
    persist(next);
  }

  function switchCompany(id) {
    setActiveCompanyId(id);
    const yrs = Object.keys(companies[id]?.years || {}).sort();
    setCurrentYear(yrs.length ? yrs[yrs.length - 1] : null);
    setPage('input');
  }

  function updateCompanyField(patch) {
    if (!activeCompanyId) return;
    setCompanies({ ...companies, [activeCompanyId]: { ...companies[activeCompanyId], ...patch } });
  }

  function commitCompanyField(patch) {
    if (!activeCompanyId) return;
    const next = { ...companies, [activeCompanyId]: { ...companies[activeCompanyId], ...patch } };
    setCompanies(next);
    persist(next);
  }

  // 証券コードは会社の識別キーとしても使う（Electron版のファイル名にそのまま使われる）。
  // 未入力→入力された時点で、内部の一時キーから証券コードキーへ「引っ越し」させる。
  function commitTickerChange(rawTicker) {
    if (!activeCompanyId) return;
    const trimmed = (rawTicker || '').trim();
    if (!trimmed || trimmed === activeCompanyId) {
      persist(companies);
      return;
    }
    if (companies[trimmed]) {
      setStatus('duplicate-ticker');
      return;
    }
    const movedComp = { ...companies[activeCompanyId], ticker: trimmed };
    const next = { ...companies };
    delete next[activeCompanyId];
    next[trimmed] = movedComp;
    setCompanies(next);
    setActiveCompanyId(trimmed);
    setStatus('');
    persist(next);
  }

  async function handleExportCsv() {
    if (typeof JSZip === 'undefined') {
      setStatus('csv-error');
      return;
    }
    const zip = new JSZip();
    let fileCount = 0;
    Object.keys(companies).forEach((key) => {
      const comp = companies[key];
      const ticker = (comp.ticker || key || 'untitled').trim() || 'untitled';
      Object.keys(comp.years).forEach((year) => {
        const rows = companyYearToRows(comp, year, comp.years[year]);
        zip.file(`${ticker}_${year}.csv`, rowsToCsv(rows));
        fileCount++;
      });
    });
    if (fileCount === 0) { setStatus('csv-empty'); return; }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kessan_note_${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus('csv-exported');
  }

  async function handleImportFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const csvEntries = [];
    for (const f of files) {
      const lower = f.name.toLowerCase();
      if (lower.endsWith('.zip') && typeof JSZip !== 'undefined') {
        const zip = await JSZip.loadAsync(f);
        for (const [name, entry] of Object.entries(zip.files)) {
          if (!entry.dir && name.toLowerCase().endsWith('.csv')) {
            csvEntries.push({ name, text: await entry.async('string') });
          }
        }
      } else if (lower.endsWith('.csv')) {
        csvEntries.push({ name: f.name, text: await f.text() });
      }
    }
    if (!csvEntries.length) { setStatus('csv-import-empty'); return; }
    const next = { ...companies };
    csvEntries.forEach(({ name, text }) => {
      const rows = csvToRows(text);
      const { meta, year, yearData } = rowsToCompanyYear(rows);
      const m = name.match(/^(.+?)_(\d{4})\.csv$/i);
      const ticker = (meta.ticker || (m && m[1]) || '').trim();
      const resolvedYear = year || (m && m[2]) || '';
      const key = ticker || `imported_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const base = next[key] || emptyCompany();
      next[key] = {
        ...base,
        name: meta.name || base.name,
        ticker: ticker || base.ticker,
        favorite: meta.favorite,
        standard: meta.standard,
        years: { ...base.years, [resolvedYear]: yearData },
      };
    });
    setCompanies(next);
    const ids = Object.keys(next);
    if (ids.length) {
      const lastId = ids[ids.length - 1];
      setActiveCompanyId(lastId);
      const yrs = Object.keys(next[lastId].years).sort();
      setCurrentYear(yrs.length ? yrs[yrs.length - 1] : null);
    }
    setStatus('csv-imported');
    persist(next);
  }

  function addYear() {
    const y = newYearInput.trim();
    if (!/^[0-9]{4}$/.test(y)) { setStatus('invalid'); return; }
    if (!activeCompanyId) return;
    const comp = companies[activeCompanyId];
    const nextYears = comp.years[y] ? comp.years : { ...comp.years, [y]: emptyYearData() };
    const next = { ...companies, [activeCompanyId]: { ...comp, years: nextYears } };
    setCompanies(next);
    setCurrentYear(y);
    setNewYearInput('');
    persist(next);
  }

  function updateField(section, key, value) {
    if (!activeCompanyId || !currentYear) return;
    const comp = companies[activeCompanyId];
    const yearData = comp.years[currentYear];
    const nextYearData = { ...yearData, [section]: { ...yearData[section], [key]: value } };
    const next = { ...companies, [activeCompanyId]: { ...comp, years: { ...comp.years, [currentYear]: nextYearData } } };
    setCompanies(next);
  }

  function updateMemo(value) {
    if (!activeCompanyId || !currentYear) return;
    const comp = companies[activeCompanyId];
    const next = { ...companies, [activeCompanyId]: { ...comp, years: { ...comp.years, [currentYear]: { ...comp.years[currentYear], memo: value } } } };
    setCompanies(next);
  }

  const companyList = Object.entries(companies).map(([id, c]) => ({ id, name: c.name || '（未入力）' }));
  const comp = activeCompanyId ? companies[activeCompanyId] : null;
  const sortedYears = comp ? Object.keys(comp.years).sort() : [];
  const cur = comp && currentYear ? comp.years[currentYear] : null;
  const derived = cur ? computeDerived(cur) : null;

  const plChartData = cur ? buildPlChartData(cur, derived, currentYear) : [];
  const bsCombinedData = cur ? buildBsCombinedData(cur) : [];
  const cfWaterfallData = cur ? buildCfWaterfallData(cur) : [];

  // 直近5年分まで（データがそれ未満ならある分だけ）を1画面で並べて見るための集計
  const recentYears = sortedYears.slice(-5);
  const plMultiYearData = comp ? recentYears.map((y) => {
    const yd = comp.years[y];
    return buildPlChartData(yd, computeDerived(yd), y)[0];
  }) : [];
  const bsAssetMultiYearData = comp ? recentYears.map((y) => {
    const yd = comp.years[y];
    return { name: y, 固定資産: n(yd.bs.fixedAssets), 流動資産: n(yd.bs.currentAssets) };
  }) : [];
  const bsLiabMultiYearData = comp ? recentYears.map((y) => {
    const yd = comp.years[y];
    return { name: y, 純資産: n(yd.bs.equity), 固定負債: n(yd.bs.fixedLiab), 流動負債: n(yd.bs.currentLiab) };
  }) : [];

  const trendData = comp ? sortedYears.map((y) => {
    const d = computeDerived(comp.years[y]);
    return {
      year: y,
      売上高: n(comp.years[y].pl.sales), 営業利益: d.opProfit,
      ROE: d.roe, 配当性向: d.payoutRatio,
      EPS: n(comp.years[y].pl.eps), 配当: n(comp.years[y].kpi.dividend),
      借入金: n(comp.years[y].bs.borrowings), のれん: n(comp.years[y].bs.goodwill),
    };
  }) : [];

  // ── 会社比較用のデータ ──
  const compAObj = compareAId ? companies[compareAId] : null;
  const compBObj = compareBId ? companies[compareBId] : null;
  const cmpA = compAObj && compareAYear ? compAObj.years[compareAYear] : null;
  const cmpB = compBObj && compareBYear ? compBObj.years[compareBYear] : null;
  const derivedA = cmpA ? computeDerived(cmpA) : null;
  const derivedB = cmpB ? computeDerived(cmpB) : null;
  const nameA = compAObj?.name || '会社A';
  const nameB = compBObj?.name || '会社B';

  const plMergedRaw = (cmpA && cmpB) ? [
    { name: nameA, 売上原価: n(cmpA.pl.cogs), 販管費: n(cmpA.pl.sga), 営業利益: derivedA.opProfit, 当期純利益: n(cmpA.pl.netProfit) },
    { name: nameB, 売上原価: n(cmpB.pl.cogs), 販管費: n(cmpB.pl.sga), 営業利益: derivedB.opProfit, 当期純利益: n(cmpB.pl.netProfit) },
  ] : [];
  const bsMergedRaw = (cmpA && cmpB) ? [
    { name: `${nameA}・資産`, 固定資産: n(cmpA.bs.fixedAssets), 流動資産: n(cmpA.bs.currentAssets) },
    { name: `${nameA}・負債純資産`, 純資産: n(cmpA.bs.equity), 固定負債: n(cmpA.bs.fixedLiab), 流動負債: n(cmpA.bs.currentLiab) },
    { name: `${nameB}・資産`, 固定資産: n(cmpB.bs.fixedAssets), 流動資産: n(cmpB.bs.currentAssets) },
    { name: `${nameB}・負債純資産`, 純資産: n(cmpB.bs.equity), 固定負債: n(cmpB.bs.fixedLiab), 流動負債: n(cmpB.bs.currentLiab) },
  ] : [];
  const plMergedData = compareMode === 'percent' ? toPercentStacked(plMergedRaw) : plMergedRaw;
  const bsMergedData = compareMode === 'percent' ? toPercentStacked(bsMergedRaw) : bsMergedRaw;
  const compareTooltipFormatter = (value, name) => compareMode === 'percent'
    ? [`${Number(value).toFixed(1)}%`, name]
    : [`${Number(value).toLocaleString()} 百万円`, name];

  const kpiCompareRows = (cmpA && cmpB) ? [
    { key: 'roe', label: 'ROE', unit: '%', a: derivedA.roe, b: derivedB.roe },
    { key: 'roa', label: 'ROA', unit: '%', a: derivedA.roa, b: derivedB.roa },
    { key: 'equityRatio', label: '自己資本比率', unit: '%', a: derivedA.equityRatio, b: derivedB.equityRatio },
    { key: 'opMargin', label: '営業利益率', unit: '%', a: derivedA.opMargin, b: derivedB.opMargin },
    { key: 'deRatio', label: 'D/Eレシオ', unit: '倍', a: derivedA.deRatio, b: derivedB.deRatio },
    { key: 'per', label: 'PER', unit: '倍', a: n(cmpA.kpi.per), b: n(cmpB.kpi.per) },
    { key: 'pbr', label: 'PBR', unit: '倍', a: n(cmpA.kpi.pbr), b: n(cmpB.kpi.pbr) },
    { key: 'eps', label: 'EPS', unit: '円', a: n(cmpA.pl.eps), b: n(cmpB.pl.eps) },
    { key: 'dividend', label: '配当', unit: '円', a: n(cmpA.kpi.dividend), b: n(cmpB.kpi.dividend) },
    { key: 'payoutRatio', label: '配当性向', unit: '%', a: derivedA.payoutRatio, b: derivedB.payoutRatio },
  ] : [];

  if (loading) {
    return <div style={{ padding: 40, fontFamily: "'Zen Kaku Gothic New', sans-serif" }}>読み込み中…</div>;
  }

  return (
    <div className="app-shell" style={{
      minHeight: '100vh',
      background: COLORS.paper,
      backgroundImage: `repeating-linear-gradient(to bottom, transparent, transparent 31px, ${COLORS.border}55 32px)`,
      fontFamily: "'Zen Kaku Gothic New', sans-serif",
      color: COLORS.ink,
      padding: '24px 16px 60px',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Zen+Old+Mincho:wght@500;700&family=Zen+Kaku+Gothic+New:wght@400;500;700&family=JetBrains+Mono:wght@500;700&display=swap');
        .tab-btn { transition: all 0.15s ease; }
        @keyframes stamp-in {
          0% { transform: scale(2.4) rotate(-12deg); opacity: 0; }
          60% { transform: scale(0.9) rotate(-12deg); opacity: 1; }
          100% { transform: scale(1) rotate(-12deg); opacity: 1; }
        }
        .stamp-mark { animation: stamp-in 0.4s ease-out; }
        .print-heading { display: none; }
        select.ledger-select { font-family: 'Zen Kaku Gothic New', sans-serif; }
        @media print {
          .no-print { display: none !important; }
          .app-shell { background: white !important; background-image: none !important; padding: 0 !important; }
          .print-heading { display: block !important; }
          .chart-card { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        {platform === 'electron' && (
          <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: COLORS.inkMuted, marginBottom: 10 }}>
            <span>📁 保存先: {folderPath || '（未設定）'}</span>
            <button
              onClick={onChooseFolder}
              style={{ fontSize: 11, padding: '3px 8px', borderRadius: 12, border: `1px solid ${COLORS.border}`, background: '#fff', color: COLORS.inkMuted, cursor: 'pointer' }}
            >
              フォルダを変更
            </button>
          </div>
        )}

        {/* 会社一覧（切り替え） */}
        <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          {companyList.map((c) => (
            <button
              key={c.id}
              onClick={() => switchCompany(c.id)}
              className="tab-btn"
              style={{
                fontSize: 13, padding: '6px 14px', borderRadius: 20,
                border: `1px solid ${c.id === activeCompanyId ? COLORS.stamp : COLORS.border}`,
                background: c.id === activeCompanyId ? COLORS.stamp : '#fff',
                color: c.id === activeCompanyId ? '#fff' : COLORS.ink, cursor: 'pointer',
              }}
            >
              {c.name}
            </button>
          ))}
          <button
            onClick={addCompany}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, padding: '6px 12px',
              borderRadius: 20, border: `1px dashed ${COLORS.teal}`, background: '#fff', color: COLORS.teal, cursor: 'pointer',
            }}
          >
            ＋ 会社追加
          </button>
        </div>

        {/* CSVバックアップ／読み込み（ブラウザのデータが消えても復元できるように） */}
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <button
            onClick={handleExportCsv}
            style={{ fontSize: 12, padding: '5px 12px', borderRadius: 14, border: `1px solid ${COLORS.border}`, background: '#fff', color: COLORS.inkMuted, cursor: 'pointer' }}
          >
            📥 CSVでバックアップ
          </button>
          <button
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            style={{ fontSize: 12, padding: '5px 12px', borderRadius: 14, border: `1px solid ${COLORS.border}`, background: '#fff', color: COLORS.inkMuted, cursor: 'pointer' }}
          >
            📤 CSVを読み込む
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".csv,.zip"
            style={{ display: 'none' }}
            onChange={(e) => { handleImportFiles(e.target.files); e.target.value = ''; }}
          />
          {status === 'csv-exported' && <span style={{ fontSize: 12, color: COLORS.teal }}>バックアップをダウンロードしました</span>}
          {status === 'csv-imported' && <span style={{ fontSize: 12, color: COLORS.teal }}>読み込みました</span>}
          {status === 'csv-empty' && <span style={{ fontSize: 12, color: COLORS.stamp }}>バックアップするデータがありません</span>}
          {status === 'csv-import-empty' && <span style={{ fontSize: 12, color: COLORS.stamp }}>CSVファイルが見つかりませんでした</span>}
          {status === 'csv-error' && <span style={{ fontSize: 12, color: COLORS.stamp }}>読み込みに失敗しました。ページを再読み込みしてもう一度試してください</span>}
        </div>

        {platform === 'web' && <AdSlot src="https://adm.shinobi.jp/s/e1df715adc5bcc8924f8591f00cb48a8" />}

        {!activeCompanyId ? (
          <div style={{
            background: COLORS.card, border: `1px dashed ${COLORS.border}`, borderRadius: 10,
            padding: 40, textAlign: 'center', color: COLORS.inkMuted,
          }}>
            まずは「会社追加」から1社登録してください
          </div>
        ) : (
        <>
        <div style={{
          background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10,
          padding: '20px 22px', marginBottom: 20, position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 16 }}>📖</span>
            <span style={{ fontSize: 13, color: COLORS.inkMuted, letterSpacing: 1 }}>会社ノート</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <input
              value={comp.name}
              onChange={(e) => updateCompanyField({ name: e.target.value })}
              onBlur={() => persist(companies)}
              placeholder="会社名を入力"
              style={{
                fontFamily: "'Zen Old Mincho', serif", fontWeight: 700, fontSize: 26,
                border: 'none', background: 'transparent', color: COLORS.ink, outline: 'none', minWidth: 200,
              }}
            />
            <input
              value={comp.ticker}
              onChange={(e) => updateCompanyField({ ticker: e.target.value })}
              onBlur={(e) => commitTickerChange(e.target.value)}
              placeholder="証券コード"
              style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: COLORS.inkMuted,
                border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: '4px 8px', width: 100, background: '#fff',
              }}
            />
            <button
              className="no-print"
              onClick={() => commitCompanyField({ favorite: !comp.favorite })}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, fontSize: 20, color: COLORS.stamp }}
              aria-label="お気に入り"
            >
              {comp.favorite ? '★' : '☆'}
            </button>
            <div className="no-print" style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
              {[{ v: 'jgaap', label: '日本基準' }, { v: 'ifrs', label: 'IFRS' }].map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => commitCompanyField({ standard: opt.v })}
                  style={{
                    fontSize: 12, padding: '5px 10px', borderRadius: 14,
                    border: `1px solid ${comp.standard === opt.v ? COLORS.teal : COLORS.border}`,
                    background: comp.standard === opt.v ? COLORS.teal : '#fff',
                    color: comp.standard === opt.v ? '#fff' : COLORS.inkMuted, cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {status === 'duplicate-ticker' && (
            <div style={{ fontSize: 12, color: COLORS.stamp, marginTop: 6 }}>その証券コードは既に別の会社で使われています</div>
          )}

          {stamped && (
            <div className="stamp-mark" style={{
              position: 'absolute', top: 14, right: 20, width: 64, height: 64, borderRadius: '50%',
              border: `3px solid ${COLORS.stamp}`, color: COLORS.stamp, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontFamily: "'Zen Old Mincho', serif", fontWeight: 700, fontSize: 15,
              transform: 'rotate(-12deg)', pointerEvents: 'none',
            }}>記帳済</div>
          )}
        </div>

        <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
          {sortedYears.map((y) => (
            <button
              key={y}
              onClick={() => setCurrentYear(y)}
              className="tab-btn"
              style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 14, padding: '6px 14px',
                borderRadius: 20, border: `1px solid ${y === currentYear ? COLORS.stamp : COLORS.border}`,
                background: y === currentYear ? COLORS.stamp : '#fff',
                color: y === currentYear ? '#fff' : COLORS.ink, cursor: 'pointer',
              }}
            >
              {y}
            </button>
          ))}
          <input
            value={newYearInput}
            onChange={(e) => setNewYearInput(e.target.value)}
            placeholder="2025"
            style={{
              width: 70, fontFamily: "'JetBrains Mono', monospace", fontSize: 14, padding: '6px 10px',
              borderRadius: 20, border: `1px dashed ${COLORS.border}`, background: '#fff', color: COLORS.ink,
            }}
          />
          <button
            onClick={addYear}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, padding: '6px 12px',
              borderRadius: 20, border: `1px solid ${COLORS.teal}`, background: '#fff', color: COLORS.teal, cursor: 'pointer',
            }}
          >
            ＋ 年度追加
          </button>
        </div>

        <div className="no-print" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 18 }}>
          {[{ v: 'input', label: '📝 入力フォーム' }, { v: 'charts', label: '📊 グラフ表示' }, { v: 'compare', label: '🆚 会社比較' }].map((opt) => (
            <button
              key={opt.v}
              onClick={() => setPage(opt.v)}
              style={{
                fontSize: 13, padding: '7px 14px', borderRadius: 8,
                border: `1px solid ${page === opt.v ? COLORS.ink : COLORS.border}`,
                background: page === opt.v ? COLORS.ink : '#fff',
                color: page === opt.v ? '#fff' : COLORS.ink, cursor: 'pointer', fontWeight: page === opt.v ? 700 : 400,
              }}
            >
              {opt.label}
            </button>
          ))}
          {(page === 'charts' || page === 'compare') && (
            <button
              onClick={() => window.print()}
              style={{
                marginLeft: 'auto', fontSize: 13, padding: '7px 14px', borderRadius: 8,
                border: `1px solid ${COLORS.teal}`, background: '#fff', color: COLORS.teal, cursor: 'pointer',
              }}
            >
              🖨 印刷 / PDF保存
            </button>
          )}
        </div>

        {page === 'charts' && currentYear && (
          <div className="print-heading" style={{ marginBottom: 14, fontFamily: "'Zen Old Mincho', serif" }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{comp.name || '（会社名未入力）'} {comp.ticker && `（${comp.ticker}）`}</div>
            <div style={{ fontSize: 13, color: COLORS.inkMuted }}>{currentYear}年度 決算ノート</div>
          </div>
        )}
        {page === 'compare' && cmpA && cmpB && (
          <div className="print-heading" style={{ marginBottom: 14, fontFamily: "'Zen Old Mincho', serif" }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{nameA}（{compareAYear}年） vs {nameB}（{compareBYear}年）</div>
            <div style={{ fontSize: 13, color: COLORS.inkMuted }}>決算比較</div>
          </div>
        )}

        {page === 'compare' ? (
          <div style={{ display: 'grid', gap: 20 }}>
            <div className="no-print chart-card" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                  <div style={{ fontSize: 13, color: COLORS.inkMuted, marginBottom: 6 }}>会社A</div>
                  <select className="ledger-select" value={compareAId || ''} onChange={(e) => { setCompareAId(e.target.value || null); setCompareAYear(null); }}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: `1px solid ${COLORS.border}`, marginBottom: 8 }}>
                    <option value="">会社を選択</option>
                    {companyList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select className="ledger-select" value={compareAYear || ''} onChange={(e) => setCompareAYear(e.target.value || null)}
                    disabled={!compAObj} style={{ width: '100%', padding: 8, borderRadius: 6, border: `1px solid ${COLORS.border}` }}>
                    <option value="">年度を選択</option>
                    {compAObj && Object.keys(compAObj.years).sort().map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 13, color: COLORS.inkMuted, marginBottom: 6 }}>会社B</div>
                  <select className="ledger-select" value={compareBId || ''} onChange={(e) => { setCompareBId(e.target.value || null); setCompareBYear(null); }}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: `1px solid ${COLORS.border}`, marginBottom: 8 }}>
                    <option value="">会社を選択</option>
                    {companyList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select className="ledger-select" value={compareBYear || ''} onChange={(e) => setCompareBYear(e.target.value || null)}
                    disabled={!compBObj} style={{ width: '100%', padding: 8, borderRadius: 6, border: `1px solid ${COLORS.border}` }}>
                    <option value="">年度を選択</option>
                    {compBObj && Object.keys(compBObj.years).sort().map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {!(cmpA && cmpB) ? (
              <div style={{ background: COLORS.card, border: `1px dashed ${COLORS.border}`, borderRadius: 10, padding: 40, textAlign: 'center', color: COLORS.inkMuted }}>
                会社Aと会社Bの両方で会社・年度を選んでください
              </div>
            ) : (
              <>
                <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                  {[{ v: 'percent', label: '📈 構成比較（各社100%）' }, { v: 'absolute', label: '📊 実額比較（共通スケール）' }].map((opt) => (
                    <button
                      key={opt.v}
                      onClick={() => setCompareMode(opt.v)}
                      style={{
                        fontSize: 12, padding: '6px 12px', borderRadius: 14,
                        border: `1px solid ${compareMode === opt.v ? COLORS.teal : COLORS.border}`,
                        background: compareMode === opt.v ? COLORS.teal : '#fff',
                        color: compareMode === opt.v ? '#fff' : COLORS.inkMuted, cursor: 'pointer',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <ChartCard title="📈 P/L比較">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={plMergedData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} domain={compareMode === 'percent' ? [0, 100] : undefined} />
                      <Tooltip formatter={compareTooltipFormatter} /><Legend />
                      <Bar dataKey="売上原価" stackId="a" fill={PL_COLORS.cogs} />
                      <Bar dataKey="販管費" stackId="a" fill={PL_COLORS.sga} />
                      <Bar dataKey="営業利益" stackId="a" fill={PL_COLORS.opProfit} />
                      <Bar dataKey="当期純利益" stackId="a" fill={PL_COLORS.netProfit} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="🏦 B/S比較">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={bsMergedData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 12 }} domain={compareMode === 'percent' ? [0, 100] : undefined} />
                      <Tooltip formatter={compareTooltipFormatter} /><Legend />
                      <Bar dataKey="固定資産" stackId="a" fill={BS_ASSET_COLORS.fixedAssets} />
                      <Bar dataKey="純資産" stackId="a" fill={BS_LIAB_COLORS.equity} />
                      <Bar dataKey="流動資産" stackId="a" fill={BS_ASSET_COLORS.currentAssets} />
                      <Bar dataKey="固定負債" stackId="a" fill={BS_LIAB_COLORS.fixedLiab} />
                      <Bar dataKey="流動負債" stackId="a" fill={BS_LIAB_COLORS.currentLiab} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <CompanyCfColumn title={`${nameA}（${compareAYear}年）`} yd={cmpA} />
                  <CompanyCfColumn title={`${nameB}（${compareBYear}年）`} yd={cmpB} />
                </div>

                <div className="chart-card" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '16px 18px' }}>
                  <div style={{ fontFamily: "'Zen Old Mincho', serif", fontSize: 15, marginBottom: 10, color: COLORS.ink }}>📊 指標比較</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                        <th style={{ textAlign: 'left', padding: '6px 4px', color: COLORS.inkMuted }}>指標</th>
                        <th style={{ textAlign: 'right', padding: '6px 4px' }}>{nameA}</th>
                        <th style={{ textAlign: 'right', padding: '6px 4px' }}>{nameB}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kpiCompareRows.map((r) => (
                        <tr key={r.key} style={{ borderBottom: `1px solid ${COLORS.border}55` }}>
                          <td style={{ padding: '6px 4px', color: COLORS.inkMuted }}>{r.label}（{r.unit}）<InfoTip text={TERM_INFO.kpi[r.key]} /></td>
                          <td style={{ padding: '6px 4px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{r.a.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                          <td style={{ padding: '6px 4px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{r.b.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="chart-card" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '16px 18px' }}>
                  <div style={{ fontFamily: "'Zen Old Mincho', serif", fontSize: 15, marginBottom: 10, color: COLORS.ink }}>📝 メモ比較</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 13 }}>
                    <div>
                      <div style={{ color: COLORS.inkMuted, marginBottom: 4 }}>{nameA}</div>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{cmpA.memo || '（メモなし）'}</div>
                    </div>
                    <div>
                      <div style={{ color: COLORS.inkMuted, marginBottom: 4 }}>{nameB}</div>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{cmpB.memo || '（メモなし）'}</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : !currentYear ? (
          <div style={{
            background: COLORS.card, border: `1px dashed ${COLORS.border}`, borderRadius: 10,
            padding: 40, textAlign: 'center', color: COLORS.inkMuted,
          }}>
            まずは年度を追加してください（例: 2024）
          </div>
        ) : (
          <>
            {page === 'input' && (
            <>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className="tab-btn"
                  style={{
                    fontSize: 14, padding: '8px 16px', borderRadius: '8px 8px 0 0',
                    border: `1px solid ${COLORS.border}`, borderBottom: activeTab === t.key ? `2px solid ${COLORS.card}` : `1px solid ${COLORS.border}`,
                    background: activeTab === t.key ? COLORS.card : '#e2e7d8',
                    color: COLORS.ink, cursor: 'pointer', fontWeight: activeTab === t.key ? 700 : 400,
                    marginBottom: -1,
                  }}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>

            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '0 8px 8px 8px', padding: 20, marginBottom: 24 }}>
              {activeTab === 'memo' ? (
                <textarea
                  value={cur.memo}
                  onChange={(e) => updateMemo(e.target.value)}
                  placeholder="例）工場建設、社長交代、自分の感想…"
                  rows={6}
                  style={{
                    width: '100%', fontFamily: "'Zen Kaku Gothic New', sans-serif", fontSize: 14,
                    padding: 12, borderRadius: 6, border: `1px solid ${COLORS.border}`, resize: 'vertical',
                  }}
                />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
                  {getTabFields(activeTab, comp.standard).map((f) => (
                    f.type === 'computed' ? (
                      <ComputedField key={f.key} label={f.label} unit={f.unit} value={derived[f.key]} info={TERM_INFO[activeTab]?.[f.key]} />
                    ) : (
                      <Field
                        key={f.key}
                        label={f.label}
                        unit={f.unit}
                        value={cur[activeTab][f.key]}
                        onChange={(v) => updateField(activeTab, f.key, v)}
                        info={TERM_INFO[activeTab]?.[f.key]}
                      />
                    )
                  ))}
                </div>
              )}

              {activeTab === 'bs' && (
                <div style={{
                  marginTop: 14, fontSize: 13, color: Math.abs(derived.totalAssets - derived.totalLiabEquity) < 1 ? COLORS.inkMuted : COLORS.stamp,
                }}>
                  資産合計 {derived.totalAssets.toLocaleString()}百万円 ／ 負債・純資産合計 {derived.totalLiabEquity.toLocaleString()}百万円
                  {Math.abs(derived.totalAssets - derived.totalLiabEquity) >= 1 && '（一致していません）'}
                  <div style={{ marginTop: 4, fontSize: 12 }}>
                    内訳参考｜のれん: {n(cur.bs.goodwill).toLocaleString()}百万円（固定資産に含む）　借入金: {n(cur.bs.borrowings).toLocaleString()}百万円（固定負債に含む）
                  </div>
                </div>
              )}

              <button
                onClick={() => persist(companies)}
                style={{
                  marginTop: 18, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14,
                  padding: '9px 18px', borderRadius: 6, border: 'none', background: COLORS.stamp,
                  color: '#fff', cursor: 'pointer', fontWeight: 700,
                }}
              >
                💾 {currentYear}年のデータを保存
              </button>
              {status === 'invalid' && <div style={{ color: COLORS.stamp, fontSize: 13, marginTop: 8 }}>年度は4桁の数字で入力してください</div>}
            </div>
            </>
            )}

            {page === 'charts' && (
            <div style={{ display: 'grid', gap: 20 }}>
              <ChartCard title={`📈 P/L構成（${currentYear}年・百万円）`}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={plChartData} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="売上原価" stackId="a" fill={PL_COLORS.cogs} />
                    <Bar dataKey="販管費" stackId="a" fill={PL_COLORS.sga} />
                    <Bar dataKey="営業利益" stackId="a" fill={PL_COLORS.opProfit} />
                    <Bar dataKey="当期純利益" stackId="a" fill={PL_COLORS.netProfit} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title={`🏦 資産 と 負債・純資産の構成比較（${currentYear}年・百万円）`}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={bsCombinedData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip /><Legend />
                    <Bar dataKey="固定資産" stackId="a" fill={BS_ASSET_COLORS.fixedAssets} />
                    <Bar dataKey="純資産" stackId="a" fill={BS_LIAB_COLORS.equity} />
                    <Bar dataKey="流動資産" stackId="a" fill={BS_ASSET_COLORS.currentAssets} />
                    <Bar dataKey="固定負債" stackId="a" fill={BS_LIAB_COLORS.fixedLiab} />
                    <Bar dataKey="流動負債" stackId="a" fill={BS_LIAB_COLORS.currentLiab} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title={`💰 キャッシュフロー滝グラフ（${currentYear}年・百万円）`}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={cfWaterfallData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip content={<CFWaterfallTooltip />} />
                    <Bar dataKey="base" stackId="cf" fill="transparent" legendType="none" isAnimationActive={false} />
                    <Bar dataKey="value" stackId="cf" isAnimationActive={false}>
                      {cfWaterfallData.map((entry, i) => (
                        <Cell key={i} fill={entry.kind === 'total' ? COLORS.ink : entry.kind === 'up' ? COLORS.teal : COLORS.stamp} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ fontSize: 12, color: COLORS.inkMuted, marginTop: 6 }}>
                  濃紺＝期首・期末残高、緑＝資金の増加、赤＝資金の減少
                </div>
              </ChartCard>

              {recentYears.length >= 2 && (
                <>
                  <ChartCard title={`📈 P/L構成の推移（直近${recentYears.length}年・百万円）`}>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={plMultiYearData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip /><Legend />
                        <Bar dataKey="売上原価" stackId="a" fill={PL_COLORS.cogs} />
                        <Bar dataKey="販管費" stackId="a" fill={PL_COLORS.sga} />
                        <Bar dataKey="営業利益" stackId="a" fill={PL_COLORS.opProfit} />
                        <Bar dataKey="当期純利益" stackId="a" fill={PL_COLORS.netProfit} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <ChartCard title={`🏦 資産構成の推移（直近${recentYears.length}年）`}>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={bsAssetMultiYearData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip /><Legend />
                          <Bar dataKey="固定資産" stackId="a" fill={BS_ASSET_COLORS.fixedAssets} />
                          <Bar dataKey="流動資産" stackId="a" fill={BS_ASSET_COLORS.currentAssets} />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>
                    <ChartCard title={`🏦 負債・純資産構成の推移（直近${recentYears.length}年）`}>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={bsLiabMultiYearData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip /><Legend />
                          <Bar dataKey="純資産" stackId="a" fill={BS_LIAB_COLORS.equity} />
                          <Bar dataKey="固定負債" stackId="a" fill={BS_LIAB_COLORS.fixedLiab} />
                          <Bar dataKey="流動負債" stackId="a" fill={BS_LIAB_COLORS.currentLiab} />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  </div>
                </>
              )}

              {sortedYears.length >= 1 && (
                <>
                  <ChartCard title="📊 業績推移（売上高・営業利益／百万円）">
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                        <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip /><Legend />
                        <Line type="monotone" dataKey="売上高" stroke={COLORS.ink} strokeWidth={2} />
                        <Line type="monotone" dataKey="営業利益" stroke={COLORS.teal} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartCard>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <ChartCard title="📊 ROE・配当性向推移（%）">
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={trendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                          <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip /><Legend />
                          <Line type="monotone" dataKey="ROE" stroke={COLORS.stamp} strokeWidth={2} />
                          <Line type="monotone" dataKey="配当性向" stroke={COLORS.teal} strokeWidth={2} strokeDasharray="4 3" />
                        </LineChart>
                      </ResponsiveContainer>
                    </ChartCard>
                    <ChartCard title="📊 EPS・配当推移（円）">
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={trendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                          <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip /><Legend />
                          <Line type="monotone" dataKey="EPS" stroke={COLORS.ink} strokeWidth={2} />
                          <Line type="monotone" dataKey="配当" stroke={COLORS.stamp} strokeWidth={2} strokeDasharray="4 3" />
                        </LineChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  </div>
                  <ChartCard title="📊 借入金・のれん推移（百万円）">
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                        <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip /><Legend />
                        <Line type="monotone" dataKey="借入金" stroke={COLORS.stamp} strokeWidth={2} />
                        <Line type="monotone" dataKey="のれん" stroke={COLORS.teal} strokeWidth={2} strokeDasharray="4 3" />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </>
              )}
            </div>
            )}
          </>
        )}
        </>
        )}

        {platform === 'web' && <AdSlot src="https://adm.shinobi.jp/s/e6b53f390f9eb0365c81341a330df8f3" />}

        <div className="no-print" style={{
          textAlign: 'center', fontSize: 11, color: COLORS.inkMuted, marginTop: 32,
          paddingTop: 14, borderTop: `1px solid ${COLORS.border}`,
        }}>
          © {new Date().getFullYear()} {copyrightHolder || 'えるぴょん'}　本ツールは{' '}
          <a
            href={licenseUrl || 'https://github.com/naru08-creator/kessan-note-web-app?tab=License-1-ov-file'}
            target="_blank" rel="noopener noreferrer"
            style={{ color: COLORS.inkMuted, textDecoration: 'underline' }}
          >
            PolyForm Noncommercial License 1.0.0
          </a>{' '}のもとで公開しています
        </div>
      </div>
    </div>
  );
}

window.KessanNoteCore = KessanNoteCore;
window.KessanNoteHelpers = { PL_KEYS, BS_KEYS, CF_KEYS, KPI_KEYS, emptyYearData, emptyCompany };
