import React, { useState, useMemo } from 'react';
import MathRenderer from './MathRenderer';
import { useAuth } from '../context/AuthContext';

const getTierMeta = (language) => [
  {
    key: 'excellent',
    label: language === 'ru' ? 'Отлично (85–100%)' : "A'lo (85–100%)",
    shortLabel: language === 'ru' ? 'Отлично' : "A'lo",
    color: '#10b981',
    bgClass: 'bg-emerald-500',
    textClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/35',
  },
  {
    key: 'good',
    label: language === 'ru' ? 'Хорошо (70–84%)' : 'Yaxshi (70–84%)',
    shortLabel: language === 'ru' ? 'Хорошо' : 'Yaxshi',
    color: '#06b6d4',
    bgClass: 'bg-cyan-500',
    textClass: 'text-cyan-400',
    borderClass: 'border-cyan-500/35',
  },
  {
    key: 'fair',
    label: language === 'ru' ? 'Средне (50–69%)' : "O'rta (50–69%)",
    shortLabel: language === 'ru' ? 'Средне' : "O'rta",
    color: '#f59e0b',
    bgClass: 'bg-amber-500',
    textClass: 'text-amber-400',
    borderClass: 'border-amber-500/35',
  },
  {
    key: 'poor',
    label: language === 'ru' ? 'Низко (<50%)' : 'Sust (<50%)',
    shortLabel: language === 'ru' ? 'Низко' : 'Sust',
    color: '#f43f5e',
    bgClass: 'bg-rose-500',
    textClass: 'text-rose-400',
    borderClass: 'border-rose-500/35',
  },
];

export const getScoreColorHex = (score, noData = false) => {
  if (noData) return '#475569';
  const v = Number(score) || 0;
  if (v >= 85) return '#10b981';
  if (v >= 70) return '#06b6d4';
  if (v >= 50) return '#f59e0b';
  return '#f43f5e';
};

export function ScoreTierDonutChart({
  distribution = { excellent: 0, good: 0, fair: 0, poor: 0 },
  avgScore = 0,
  totalCount = null,
  title,
  subtitle,
}) {
  const { language, tr } = useAuth();
  const resolvedTitle = title ?? tr('Natijalar Darajasi Diagrammasi', 'Диаграмма уровней результатов');
  const resolvedSubtitle =
    subtitle ??
    tr(
      "O'quvchilar ballarining sifat darajalari bo'yicha taqsimoti",
      'Распределение баллов учеников по уровням качества'
    );
  const [hoveredKey, setHoveredKey] = useState(null);

  const buckets = useMemo(() => {
    const tierMeta = getTierMeta(language);
    const rawTotal =
      (Number(distribution?.excellent) || 0) +
      (Number(distribution?.good) || 0) +
      (Number(distribution?.fair) || 0) +
      (Number(distribution?.poor) || 0);
    const total = totalCount !== null && totalCount !== undefined ? Math.max(rawTotal, Number(totalCount) || 0) : rawTotal;
    return {
      total: rawTotal,
      displayTotal: total,
      items: tierMeta.map((m) => {
        const count = Number(distribution?.[m.key]) || 0;
        const pct = rawTotal > 0 ? Math.round((count / rawTotal) * 100) : 0;
        return { ...m, count, pct };
      }),
    };
  }, [distribution, totalCount, language]);

  const activeItem = buckets.items.find((b) => b.key === hoveredKey) || null;
  const activeCount = buckets.items.filter((b) => b.count > 0).length;

  const size = 144;
  const center = size / 2;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;

  let offsetAcc = 0;
  const segments = buckets.items.map((item) => {
    if (buckets.total <= 0 || item.count <= 0) {
      return { ...item, dashLen: 0, dashOffset: 0 };
    }
    const rawLen = (item.count / buckets.total) * circumference;
    const gap = activeCount > 1 && rawLen > 5 ? 3 : 0;
    const dashLen = Math.max(1, rawLen - gap);
    const seg = { ...item, dashLen, dashOffset: -offsetAcc };
    offsetAcc += rawLen;
    return seg;
  });

  return (
    <div
      className="p-4 rounded-2xl bg-slate-950/65 border border-slate-800/90 space-y-4 min-w-0"
      data-testid="score-tier-donut-chart"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs sm:text-sm font-black text-white">{resolvedTitle}</div>
          {resolvedSubtitle && <div className="text-[11px] text-slate-400 mt-0.5">{resolvedSubtitle}</div>}
        </div>
        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300 whitespace-nowrap">
          {language === 'ru' ? `${buckets.total} рез.` : `${buckets.total} ta natija`}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3.5 sm:gap-4">
        {/* SVG Ring */}
        <div className="relative flex-shrink-0 flex items-center justify-center">
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            role="img"
            aria-label={resolvedTitle}
            className="overflow-visible"
          >
            {/* Track Circle */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="rgba(30, 41, 59, 0.9)"
              strokeWidth={buckets.total > 0 ? 15 : 12}
              strokeDasharray={buckets.total > 0 ? undefined : '4 4'}
            />

            {/* Ring Slices */}
            <g transform={`rotate(-90 ${center} ${center})`}>
              {segments.map((seg) =>
                seg.dashLen > 0 ? (
                  <circle
                    key={seg.key}
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={hoveredKey === seg.key ? 18 : 15}
                    strokeDasharray={`${seg.dashLen} ${circumference}`}
                    strokeDashoffset={seg.dashOffset}
                    className="cursor-pointer transition-all duration-200"
                    style={{
                      opacity: hoveredKey && hoveredKey !== seg.key ? 0.38 : 1,
                    }}
                    onMouseEnter={() => setHoveredKey(seg.key)}
                    onMouseLeave={() => setHoveredKey(null)}
                    onClick={() => setHoveredKey((prev) => (prev === seg.key ? null : seg.key))}
                  >
                    <title>
                      {language === 'ru'
                        ? `${seg.label}: ${seg.count} (${seg.pct}%)`
                        : `${seg.label}: ${seg.count} ta (${seg.pct}%)`}
                    </title>
                  </circle>
                ) : null
              )}
            </g>

            {/* Inner dark fill + Center KPI */}
            <circle cx={center} cy={center} r={38} fill="rgba(7, 19, 34, 0.95)" />
            <text
              x={center}
              y={center - 2}
              textAnchor="middle"
              fill={activeItem ? activeItem.color : '#f8fafc'}
              fontSize={activeItem ? '18' : '19'}
              fontWeight="900"
            >
              {buckets.total > 0 ? (activeItem ? `${activeItem.pct}%` : `${Math.round(Number(avgScore) || 0)}%`) : '0%'}
            </text>
            <text
              x={center}
              y={center + 14}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize="9"
              fontWeight="700"
            >
              {activeItem
                ? language === 'ru'
                  ? `${activeItem.shortLabel} (${activeItem.count})`
                  : `${activeItem.shortLabel} (${activeItem.count} ta)`
                : buckets.total > 0
                ? tr("O'rtacha ball", 'Средний балл')
                : tr("Natija yo'q", 'Нет данных')}
            </text>
          </svg>
        </div>

        {/* Interactive Legend */}
        <div className="flex-1 w-full space-y-2 min-w-0">
          {buckets.items.map((item) => {
            const isHovered = hoveredKey === item.key;
            return (
              <div
                key={item.key}
                onMouseEnter={() => setHoveredKey(item.key)}
                onMouseLeave={() => setHoveredKey(null)}
                onClick={() => setHoveredKey((prev) => (prev === item.key ? null : item.key))}
                className={`px-2.5 py-2 rounded-xl border transition-all cursor-pointer ${
                  isHovered
                    ? `bg-slate-900 ${item.borderClass}`
                    : 'bg-slate-900/55 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[11px] sm:text-xs">
                  <span className="text-slate-200 font-semibold flex items-center gap-1.5 whitespace-nowrap">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.bgClass}`} />
                    <span>{item.label}</span>
                  </span>
                  <span className={`font-black whitespace-nowrap ${item.textClass}`}>
                    {language === 'ru'
                      ? `${item.count} (${item.pct}%)`
                      : `${item.count} ta (${item.pct}%)`}
                  </span>
                </div>
                <div className="w-full h-1 rounded-full bg-slate-800 mt-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${item.bgClass} transition-all duration-300`}
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function VerticalBarDiagram({
  items = [],
  title,
  subtitle = '',
  passThreshold = 60,
  onItemClick = null,
  selectedKey = null,
  emptyText,
  headerRight = null,
  testId = 'vertical-bar-diagram',
}) {
  const { tr } = useAuth();
  const resolvedTitle = title ?? tr("Ko'rsatkichlar Diagrammasi", 'Диаграмма показателей');
  const resolvedEmptyText =
    emptyText ?? tr("Hozircha diagramma uchun ma'lumot mavjud emas", 'Пока нет данных для диаграммы');
  const [hoveredKey, setHoveredKey] = useState(null);

  const safeItems = useMemo(
    () =>
      (Array.isArray(items) ? items : []).map((it, idx) => ({
        ...it,
        key: it.key ?? String(idx),
        value: Math.max(0, Math.min(100, Math.round(Number(it.value) || 0))),
        label: String(it.label || ''),
        sublabel: it.sublabel ? String(it.sublabel) : '',
      })),
    [items]
  );

  const activeItem = useMemo(() => {
    if (hoveredKey !== null) {
      return safeItems.find((i) => String(i.key) === String(hoveredKey)) || null;
    }
    if (selectedKey !== null && selectedKey !== undefined) {
      return safeItems.find((i) => String(i.key) === String(selectedKey)) || null;
    }
    return safeItems[0] || null;
  }, [safeItems, hoveredKey, selectedKey]);

  const count = safeItems.length;
  const svgWidth = count <= 6 ? 490 : Math.max(520, count * 66);
  const svgHeight = 228;
  const padLeft = 36;
  const padRight = 14;
  const padTop = 30;
  const padBottom = 50;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;
  const baselineY = padTop + plotH;
  const thresholdY = padTop + plotH * (1 - passThreshold / 100);

  const slotW = count > 0 ? plotW / count : plotW;
  const barW = Math.min(44, Math.max(18, Math.round(slotW * 0.56)));

  const truncateLabel = (str, maxLen = count > 6 ? 10 : 13) => {
    if (str.length <= maxLen) return str;
    return `${str.slice(0, maxLen - 1)}…`;
  };

  return (
    <div
      className="p-4 rounded-2xl bg-slate-950/65 border border-slate-800/90 space-y-3 min-w-0"
      data-testid={testId}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs sm:text-sm font-black text-white">{resolvedTitle}</div>
          {subtitle && <div className="text-[11px] text-slate-400 mt-0.5">{subtitle}</div>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {count > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 whitespace-nowrap">
              <span className="w-3 border-t-2 border-dashed border-amber-400" />
              {tr("O'tish:", 'Порог:')} {passThreshold}%
            </span>
          )}
          {headerRight}
        </div>
      </div>

      {count === 0 ? (
        <div className="py-12 text-center text-xs text-slate-400 rounded-xl bg-slate-900/50 border border-slate-800/70">
          {resolvedEmptyText}
        </div>
      ) : (
        <>
          <div className="w-full overflow-x-auto max-w-full">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="block h-auto"
              style={{
                width: '100%',
                minWidth: count > 7 ? `${Math.min(720, count * 62)}px` : '100%',
              }}
              role="img"
              aria-label={resolvedTitle}
            >
              {/* Y-Axis Gridlines */}
              {[0, 25, 50, 75, 100].map((tick) => {
                const y = padTop + plotH * (1 - tick / 100);
                return (
                  <g key={tick}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={svgWidth - padRight}
                      y2={y}
                      stroke={tick === 0 ? 'rgba(148, 163, 184, 0.3)' : 'rgba(51, 65, 85, 0.55)'}
                      strokeWidth="1"
                    />
                    <text
                      x={padLeft - 6}
                      y={y + 3.5}
                      textAnchor="end"
                      fill="#64748b"
                      fontSize="9.5"
                      fontWeight="700"
                    >
                      {tick}%
                    </text>
                  </g>
                );
              })}

              {/* Pass Threshold Line */}
              <line
                x1={padLeft}
                y1={thresholdY}
                x2={svgWidth - padRight}
                y2={thresholdY}
                stroke="rgba(251, 191, 36, 0.55)"
                strokeWidth="1.25"
                strokeDasharray="5 4"
              />

              {/* Bars */}
              {safeItems.map((item, idx) => {
                const cx = padLeft + slotW * idx + slotW / 2;
                const x = cx - barW / 2;
                const h = item.noData ? 4 : item.value > 0 ? Math.max(8, (item.value / 100) * plotH) : 4;
                const y = baselineY - h;
                const isSelected = selectedKey !== null && selectedKey !== undefined && String(selectedKey) === String(item.key);
                const isHovered = hoveredKey !== null && String(hoveredKey) === String(item.key);
                const fillColor = item.color || getScoreColorHex(item.value, item.noData);

                return (
                  <g
                    key={item.key}
                    className={onItemClick ? 'cursor-pointer' : 'cursor-default'}
                    onMouseEnter={() => setHoveredKey(item.key)}
                    onMouseLeave={() => setHoveredKey(null)}
                    onClick={() => onItemClick && onItemClick(item)}
                  >
                    <title>{item.detail || `${item.label}: ${item.value}%`}</title>

                    {/* Background hover column */}
                    <rect
                      x={cx - slotW * 0.42}
                      y={padTop}
                      width={slotW * 0.84}
                      height={plotH}
                      rx="8"
                      fill={isSelected || isHovered ? 'rgba(56, 189, 248, 0.08)' : 'transparent'}
                    />

                    {/* Main Bar */}
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={h}
                      rx="6"
                      fill={fillColor}
                      fillOpacity={isSelected || isHovered ? 1 : 0.88}
                      stroke={isSelected ? '#38bdf8' : isHovered ? '#e2e8f0' : 'none'}
                      strokeWidth={isSelected || isHovered ? 1.5 : 0}
                    />

                    {/* Value Label above Bar */}
                    <text
                      x={cx}
                      y={Math.max(14, y - 6)}
                      textAnchor="middle"
                      fill={item.noData ? '#64748b' : '#f8fafc'}
                      fontSize="10.5"
                      fontWeight="900"
                    >
                      {item.noData ? '—' : `${item.value}%`}
                    </text>

                    {/* X Axis Primary Label */}
                    <text
                      x={cx}
                      y={baselineY + 15}
                      textAnchor="middle"
                      fill={isSelected ? '#38bdf8' : '#cbd5e1'}
                      fontSize="10"
                      fontWeight="800"
                    >
                      {truncateLabel(item.label)}
                    </text>

                    {/* Secondary Label */}
                    {item.sublabel && (
                      <text
                        x={cx}
                        y={baselineY + 28}
                        textAnchor="middle"
                        fill="#64748b"
                        fontSize="8.8"
                        fontWeight="700"
                      >
                        {truncateLabel(item.sublabel, 12)}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {activeItem && (
            <div className="px-3 py-2 rounded-xl bg-slate-900/75 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className="text-slate-200 font-bold truncate">
                {activeItem.detail || `${activeItem.label}${activeItem.sublabel ? ` (${activeItem.sublabel})` : ''}`}
              </span>
              <span className="font-black text-cyan-300 whitespace-nowrap">
                {activeItem.noData ? tr("Natija yo'q", 'Нет данных') : `${activeItem.value}%`}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function HorizontalAccuracyDiagram({
  questions = [],
  title,
  subtitle,
  emptyText,
}) {
  const { language, tr } = useAuth();
  const resolvedTitle =
    title ?? tr("Savollar Bo'yicha O'zlashtirish Diagrammasi", 'Диаграмма успеваемости по вопросам');
  const resolvedSubtitle =
    subtitle ??
    tr(
      "Har bir savolning to'g'ri yechilish foizi va ko'p uchraydigan xato javoblar",
      'Процент правильных ответов на каждый вопрос и частые ошибки'
    );
  const resolvedEmptyText =
    emptyText ?? tr("Ushbu test uchun savol javoblari yozilmagan", 'Для этого теста пока нет ответов на вопросы');

  const safeQuestions = useMemo(() => (Array.isArray(questions) ? questions : []), [questions]);
  const answered = safeQuestions.filter((q) => Number(q.totalAnswers) > 0);
  const easyCount = answered.filter((q) => (Number(q.accuracy) || 0) >= 75).length;
  const midCount = answered.filter((q) => {
    const a = Number(q.accuracy) || 0;
    return a >= 50 && a < 75;
  }).length;
  const hardCount = answered.filter((q) => (Number(q.accuracy) || 0) < 50).length;

  return (
    <div
      className="p-4 rounded-2xl bg-slate-950/65 border border-slate-800/90 space-y-3.5 min-w-0"
      data-testid="question-accuracy-diagram"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs sm:text-sm font-black text-white">{resolvedTitle}</div>
          {resolvedSubtitle && <div className="text-[11px] text-slate-400 mt-0.5">{resolvedSubtitle}</div>}
        </div>

        {answered.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              {tr('Oson:', 'Лёгкие:')} {easyCount}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
              {tr("O'rta:", 'Средние:')} {midCount}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
              {tr('Qiyin:', 'Сложные:')} {hardCount}
            </span>
          </div>
        )}
      </div>

      {safeQuestions.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400 rounded-xl bg-slate-900/50 border border-slate-800/70">
          {resolvedEmptyText}
        </div>
      ) : answered.length === 0 ? (
        <div className="py-6 px-4 text-center text-xs text-slate-400 rounded-xl bg-slate-900/50 border border-slate-800/70">
          {language === 'ru'
            ? `По выбранному срезу статистика по вопросам ещё не сформирована (всего ${safeQuestions.length} вопр.).`
            : `Tanlangan kesim bo'yicha savolma-savol javob statistikasi hali shakllanmagan (jami ${safeQuestions.length} ta savol).`}
        </div>
      ) : (
        <div className="space-y-2">
          {safeQuestions.map((qs) => {
            const hasAns = Number(qs.totalAnswers) > 0;
            const acc = hasAns ? Math.max(0, Math.min(100, Math.round(Number(qs.accuracy) || 0))) : 0;
            const barBg = !hasAns
              ? 'bg-slate-700'
              : acc >= 75
              ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
              : acc >= 50
              ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
              : 'bg-gradient-to-r from-rose-500 to-pink-500';
            const badgeCls = !hasAns
              ? 'bg-slate-800 text-slate-400'
              : acc >= 75
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              : acc >= 50
              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
              : 'bg-rose-500/15 text-rose-300 border border-rose-500/30';

            return (
              <div
                key={qs.questionId}
                className={`p-3 rounded-xl border space-y-2 ${
                  hasAns && acc < 60
                    ? 'bg-rose-950/15 border-rose-500/30'
                    : 'bg-slate-900/60 border-slate-800/90'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-xs text-slate-200 font-semibold flex items-start gap-2 min-w-0 flex-1">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-black text-[11px] flex-shrink-0">
                      #{qs.order}
                    </span>
                    <span className="leading-snug min-w-0 break-words">
                      <MathRenderer text={qs.text} />
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 text-xs">
                    {hasAns ? (
                      <>
                        <span className="text-[11px] text-emerald-400 font-bold">
                          {qs.correctCount} {tr("to'g'ri", 'верно')}
                        </span>
                        <span className="text-[11px] text-rose-400 font-bold">
                          {qs.wrongCount} {tr('xato', 'ошиб.')}
                        </span>
                        <span className={`px-2 py-0.5 rounded-lg font-black ${badgeCls}`}>{acc}%</span>
                      </>
                    ) : (
                      <span className="text-[11px] text-slate-500 italic">
                        {tr("Javob yo'q", 'Нет ответов')}
                      </span>
                    )}
                  </div>
                </div>

                {hasAns && (
                  <div className="space-y-1">
                    <div className="relative w-full h-2 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${barBg}`}
                        style={{ width: `${Math.max(4, acc)}%` }}
                      />
                    </div>
                    {qs.mostCommonWrongOption && (
                      <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-2">
                        <span>
                          {tr("Ko'p tanlangan xato:", 'Частый ошибочный ответ:')}{' '}
                          <strong className="text-rose-300">{qs.mostCommonWrongOption}</strong>
                        </span>
                        {qs.correctOptionText && (
                          <span>
                            • {tr("To'g'ri:", 'Верный:')}{' '}
                            <strong className="text-emerald-300">{qs.correctOptionText}</strong>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function MultiSegmentDonutChart({
  segments = [],
  centerValue = '0',
  centerLabel,
  badgeText = '',
  title,
  subtitle = '',
  onSegmentClick = null,
  selectedKey = null,
  stackLegend = false,
  emptyText,
  testId = 'multi-segment-donut-chart',
}) {
  const { tr } = useAuth();
  const resolvedTitle = title ?? tr('Taqsimot Diagrammasi', 'Диаграмма распределения');
  const resolvedCenterLabel = centerLabel ?? tr('Jami', 'Всего');
  const resolvedEmptyText =
    emptyText ?? tr("Hozircha ma'lumot mavjud emas", 'Пока нет данных');
  const [hoveredKey, setHoveredKey] = useState(null);

  const normalized = useMemo(() => {
    const raw = Array.isArray(segments) ? segments : [];
    const total = raw.reduce((acc, s) => acc + Math.max(0, Number(s.value) || 0), 0);
    return {
      total,
      items: raw.map((s, idx) => {
        const val = Math.max(0, Number(s.value) || 0);
        const pct = total > 0 ? Math.round((val / total) * 100) : 0;
        return {
          ...s,
          key: s.key ?? String(idx),
          value: val,
          pct,
          color: s.color || '#38bdf8',
        };
      }),
    };
  }, [segments]);

  const activeKey = hoveredKey ?? selectedKey ?? null;
  const activeItem =
    activeKey !== null
      ? normalized.items.find((it) => String(it.key) === String(activeKey)) || null
      : null;
  const nonZeroCount = normalized.items.filter((i) => i.value > 0).length;

  const size = 134;
  const center = size / 2;
  const radius = 49;
  const circumference = 2 * Math.PI * radius;

  let offsetAcc = 0;
  const ringSegments = normalized.items.map((item) => {
    if (normalized.total <= 0 || item.value <= 0) {
      return { ...item, dashLen: 0, dashOffset: 0 };
    }
    const rawLen = (item.value / normalized.total) * circumference;
    const gap = nonZeroCount > 1 && rawLen > 5 ? 3 : 0;
    const dashLen = Math.max(1, rawLen - gap);
    const seg = { ...item, dashLen, dashOffset: -offsetAcc };
    offsetAcc += rawLen;
    return seg;
  });

  return (
    <div
      className="p-4 rounded-2xl bg-slate-950/65 border border-slate-800/90 space-y-4 min-w-0 max-w-full box-border"
      data-testid={testId}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs sm:text-sm font-black text-white">{resolvedTitle}</div>
          {subtitle && <div className="text-[11px] text-slate-400 mt-0.5">{subtitle}</div>}
        </div>
        {badgeText && (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300 whitespace-nowrap">
            {badgeText}
          </span>
        )}
      </div>

      {normalized.items.length === 0 || normalized.total <= 0 ? (
        <div className="py-10 text-center text-xs text-slate-400 rounded-xl bg-slate-900/50 border border-slate-800/70">
          {resolvedEmptyText}
        </div>
      ) : (
        <div className={`flex flex-col ${stackLegend ? '' : 'sm:flex-row'} items-center gap-3.5 sm:gap-4 min-w-0`}>
          <div className="relative flex-shrink-0 flex items-center justify-center">
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              role="img"
              aria-label={resolvedTitle}
              className="overflow-visible"
            >
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke="rgba(30, 41, 59, 0.9)"
                strokeWidth={15}
              />

              <g transform={`rotate(-90 ${center} ${center})`}>
                {ringSegments.map((seg) =>
                  seg.dashLen > 0 ? (
                    <circle
                      key={seg.key}
                      cx={center}
                      cy={center}
                      r={radius}
                      fill="none"
                      stroke={seg.color}
                      strokeWidth={String(activeKey) === String(seg.key) ? 18 : 15}
                      strokeDasharray={`${seg.dashLen} ${circumference}`}
                      strokeDashoffset={seg.dashOffset}
                      className="cursor-pointer transition-all duration-200"
                      style={{
                        opacity:
                          activeKey !== null && String(activeKey) !== String(seg.key) ? 0.35 : 1,
                      }}
                      onMouseEnter={() => setHoveredKey(seg.key)}
                      onMouseLeave={() => setHoveredKey(null)}
                      onClick={() => onSegmentClick && onSegmentClick(seg)}
                    >
                      <title>{`${seg.label}: ${seg.countText || seg.value} (${seg.pct}%)`}</title>
                    </circle>
                  ) : null
                )}
              </g>

              <circle cx={center} cy={center} r={35} fill="rgba(7, 19, 34, 0.96)" />
              <text
                x={center}
                y={center - 2}
                textAnchor="middle"
                fill={activeItem ? activeItem.color : '#f8fafc'}
                fontSize={activeItem ? '16' : '15'}
                fontWeight="900"
              >
                {activeItem ? `${activeItem.pct}%` : centerValue}
              </text>
              <text
                x={center}
                y={center + 13}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="8.5"
                fontWeight="700"
              >
                {activeItem ? activeItem.shortLabel || activeItem.label : resolvedCenterLabel}
              </text>
            </svg>
          </div>

          <div className="flex-1 w-full space-y-2 min-w-0">
            {normalized.items.map((item) => {
              const isSelected = selectedKey !== null && String(selectedKey) === String(item.key);
              const isHighlighted = isSelected || String(hoveredKey) === String(item.key);
              return (
                <div
                  key={item.key}
                  onMouseEnter={() => setHoveredKey(item.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  onClick={() => onSegmentClick && onSegmentClick(item)}
                  className={`px-2.5 py-2 rounded-xl border transition-all ${
                    onSegmentClick ? 'cursor-pointer' : 'cursor-default'
                  } ${
                    isSelected
                      ? 'bg-slate-900 border-amber-400/70 ring-1 ring-amber-400/40'
                      : isHighlighted
                      ? 'bg-slate-900 border-slate-600'
                      : 'bg-slate-900/55 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] sm:text-xs min-w-0">
                    <span className="text-slate-200 font-semibold flex items-center gap-1.5 min-w-0 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="truncate">{item.label}</span>
                    </span>
                    <span className="font-black whitespace-nowrap flex-shrink-0" style={{ color: item.color }}>
                      {item.countText ?? item.value} ({item.pct}%)
                    </span>
                  </div>
                  <div className="w-full h-1 rounded-full bg-slate-800 mt-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                    />
                  </div>
                  {item.secondaryText && (
                    <div className="text-[10px] text-slate-400 mt-1 truncate">
                      {item.secondaryText}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function ValueBarDiagram({
  items = [],
  title,
  subtitle = '',
  unit = '',
  primaryColor = '#f59e0b',
  secondaryColor = '#a855f7',
  primaryLegend = '',
  secondaryLegend = '',
  onItemClick = null,
  selectedKey = null,
  emptyText,
  headerRight = null,
  testId = 'value-bar-diagram',
}) {
  const { tr } = useAuth();
  const resolvedTitle = title ?? tr("Ko'rsatkichlar Diagrammasi", 'Диаграмма показателей');
  const resolvedEmptyText =
    emptyText ?? tr("Hozircha diagramma uchun ma'lumot mavjud emas", 'Пока нет данных для диаграммы');
  const [hoveredKey, setHoveredKey] = useState(null);

  const safeItems = useMemo(
    () =>
      (Array.isArray(items) ? items : []).map((it, idx) => {
        const pri = Math.max(0, Number(it.primaryValue ?? it.value) || 0);
        const sec = Math.max(0, Number(it.secondaryValue) || 0);
        const total = Math.max(pri + sec, Number(it.value) || 0);
        return {
          ...it,
          key: it.key ?? String(idx),
          primaryValue: it.secondaryValue !== undefined ? pri : total,
          secondaryValue: it.secondaryValue !== undefined ? sec : 0,
          total,
          label: String(it.label || ''),
          sublabel: it.sublabel ? String(it.sublabel) : '',
        };
      }),
    [items]
  );

  const rawMax = Math.max(1, ...safeItems.map((i) => i.total));
  const niceStep = (val) => {
    if (val <= 10) return Math.ceil(val / 4) * 4 || 4;
    const mag = 10 ** Math.floor(Math.log10(val));
    const norm = val / mag;
    const nice = norm <= 1.2 ? 1.2 : norm <= 2 ? 2 : norm <= 4 ? 4 : norm <= 6 ? 6 : norm <= 8 ? 8 : 10;
    return Math.ceil(nice * mag);
  };
  const yMax = niceStep(rawMax);

  const activeItem = useMemo(() => {
    if (hoveredKey !== null) {
      return safeItems.find((i) => String(i.key) === String(hoveredKey)) || null;
    }
    if (selectedKey !== null && selectedKey !== undefined) {
      return safeItems.find((i) => String(i.key) === String(selectedKey)) || null;
    }
    return safeItems[0] || null;
  }, [safeItems, hoveredKey, selectedKey]);

  const count = safeItems.length;
  const svgWidth = count <= 6 ? 500 : Math.max(540, count * 62);
  const svgHeight = 236;
  const padLeft = 44;
  const padRight = 14;
  const padTop = 30;
  const padBottom = 50;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;
  const baselineY = padTop + plotH;

  const slotW = count > 0 ? plotW / count : plotW;
  const barW = Math.min(42, Math.max(18, Math.round(slotW * 0.56)));

  const truncateLabel = (str, maxLen = count > 7 ? 9 : 13) => {
    if (str.length <= maxLen) return str;
    return `${str.slice(0, maxLen - 1)}…`;
  };

  const hasStacked = safeItems.some((i) => i.secondaryValue > 0);

  return (
    <div
      className="p-4 rounded-2xl bg-slate-950/65 border border-slate-800/90 space-y-3 min-w-0 max-w-full box-border"
      data-testid={testId}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs sm:text-sm font-black text-white">{resolvedTitle}</div>
          {subtitle && <div className="text-[11px] text-slate-400 mt-0.5">{subtitle}</div>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(primaryLegend || (hasStacked && secondaryLegend)) && (
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-300">
              {primaryLegend && (
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: primaryColor }} />
                  {primaryLegend}
                </span>
              )}
              {hasStacked && secondaryLegend && (
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: secondaryColor }} />
                  {secondaryLegend}
                </span>
              )}
            </div>
          )}
          {headerRight}
        </div>
      </div>

      {count === 0 ? (
        <div className="py-12 text-center text-xs text-slate-400 rounded-xl bg-slate-900/50 border border-slate-800/70">
          {resolvedEmptyText}
        </div>
      ) : (
        <>
          <div className="w-full overflow-x-auto max-w-full">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="block h-auto"
              style={{
                width: '100%',
                minWidth: count > 7 ? `${Math.min(780, count * 58)}px` : '100%',
              }}
              role="img"
              aria-label={resolvedTitle}
            >
              {[0, 0.25, 0.5, 0.75, 1].map((frac, idx) => {
                const tickVal = Math.round(yMax * frac);
                const y = padTop + plotH * (1 - frac);
                return (
                  <g key={idx}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={svgWidth - padRight}
                      y2={y}
                      stroke={frac === 0 ? 'rgba(148, 163, 184, 0.3)' : 'rgba(51, 65, 85, 0.55)'}
                      strokeWidth="1"
                    />
                    <text
                      x={padLeft - 6}
                      y={y + 3.5}
                      textAnchor="end"
                      fill="#64748b"
                      fontSize="9.5"
                      fontWeight="700"
                    >
                      {tickVal}
                    </text>
                  </g>
                );
              })}

              {safeItems.map((item, idx) => {
                const cx = padLeft + slotW * idx + slotW / 2;
                const x = cx - barW / 2;
                const totH = item.total > 0 ? Math.max(8, (item.total / yMax) * plotH) : 3;
                const secH =
                  item.total > 0 && item.secondaryValue > 0
                    ? Math.max(4, Math.round((item.secondaryValue / item.total) * totH))
                    : 0;
                const priH = Math.max(0, totH - secH);
                const priY = baselineY - priH;
                const secY = priY - secH;
                const topY = baselineY - totH;

                const isSelected =
                  selectedKey !== null && selectedKey !== undefined && String(selectedKey) === String(item.key);
                const isHovered = hoveredKey !== null && String(hoveredKey) === String(item.key);
                const priColor = item.color || primaryColor;
                const secColor = item.secondaryColor || secondaryColor;

                return (
                  <g
                    key={item.key}
                    className={onItemClick ? 'cursor-pointer' : 'cursor-default'}
                    onMouseEnter={() => setHoveredKey(item.key)}
                    onMouseLeave={() => setHoveredKey(null)}
                    onClick={() => onItemClick && onItemClick(item)}
                  >
                    <title>{item.detail || `${item.label}: ${item.total}${unit ? ` ${unit}` : ''}`}</title>

                    <rect
                      x={cx - slotW * 0.42}
                      y={padTop}
                      width={slotW * 0.84}
                      height={plotH}
                      rx="8"
                      fill={isSelected || isHovered ? 'rgba(56, 189, 248, 0.08)' : 'transparent'}
                    />

                    {priH > 0 && (
                      <rect
                        x={x}
                        y={priY}
                        width={barW}
                        height={priH}
                        rx={secH > 0 ? '3' : '6'}
                        fill={item.total > 0 ? priColor : '#334155'}
                        fillOpacity={isSelected || isHovered ? 1 : 0.88}
                        stroke={isSelected ? '#38bdf8' : isHovered ? '#f8fafc' : 'none'}
                        strokeWidth={isSelected || isHovered ? 1.5 : 0}
                      />
                    )}

                    {secH > 0 && (
                      <rect
                        x={x}
                        y={secY}
                        width={barW}
                        height={secH}
                        rx="4"
                        fill={secColor}
                        fillOpacity={isSelected || isHovered ? 1 : 0.92}
                        stroke={isSelected ? '#38bdf8' : isHovered ? '#f8fafc' : 'none'}
                        strokeWidth={isSelected || isHovered ? 1.5 : 0}
                      />
                    )}

                    <text
                      x={cx}
                      y={Math.max(14, topY - 6)}
                      textAnchor="middle"
                      fill={item.total > 0 ? '#f8fafc' : '#64748b'}
                      fontSize="10"
                      fontWeight="900"
                    >
                      {item.displayValue ?? item.total}
                    </text>

                    <text
                      x={cx}
                      y={baselineY + 15}
                      textAnchor="middle"
                      fill={isSelected ? '#38bdf8' : '#cbd5e1'}
                      fontSize="10"
                      fontWeight="800"
                    >
                      {truncateLabel(item.label)}
                    </text>

                    {item.sublabel && (
                      <text
                        x={cx}
                        y={baselineY + 28}
                        textAnchor="middle"
                        fill="#64748b"
                        fontSize="8.8"
                        fontWeight="700"
                      >
                        {truncateLabel(item.sublabel, 12)}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {activeItem && (
            <div className="px-3 py-2 rounded-xl bg-slate-900/75 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className="text-slate-200 font-bold truncate">
                {activeItem.detail || `${activeItem.label}${activeItem.sublabel ? ` (${activeItem.sublabel})` : ''}`}
              </span>
              <span className="font-black text-amber-300 whitespace-nowrap">
                {activeItem.displayValue ?? activeItem.total} {unit}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function TrendAreaLineChart({
  points = [],
  title,
  subtitle = '',
  emptyText,
  testId = 'trend-area-line-chart',
}) {
  const { language, tr } = useAuth();
  const resolvedTitle = title ?? tr('Kunlik Dinamika Grafigi', 'График дневной динамики');
  const resolvedEmptyText =
    emptyText ?? tr("Hozircha grafik uchun ma'lumot mavjud emas", 'Пока нет данных для графика');
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const safePoints = useMemo(
    () =>
      (Array.isArray(points) ? points : []).map((p, idx) => ({
        ...p,
        idx,
        label: String(p.label || ''),
        fullDate: String(p.fullDate || p.label || ''),
        studentCoins: Math.max(0, Number(p.studentCoins) || 0),
        classCoins: Math.max(0, Number(p.classCoins) || 0),
        totalCoins: Math.max(0, Number(p.totalCoins) || 0),
        txCount: Math.max(0, Number(p.txCount) || 0),
        submissionsCount: Math.max(0, Number(p.submissionsCount) || 0),
      })),
    [points]
  );

  const activePoint =
    hoveredIdx !== null && safePoints[hoveredIdx]
      ? safePoints[hoveredIdx]
      : safePoints[safePoints.length - 1] || null;

  const count = safePoints.length;
  const maxVal = Math.max(10, ...safePoints.map((p) => p.totalCoins));
  const yMax = Math.ceil((maxVal * 1.12) / 50) * 50 || 50;

  const svgWidth = count <= 7 ? 520 : Math.max(540, count * 60);
  const svgHeight = 216;
  const padLeft = 44;
  const padRight = 18;
  const padTop = 30;
  const padBottom = 38;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;
  const baselineY = padTop + plotH;

  const coords = safePoints.map((pt, i) => {
    const x =
      count === 1
        ? padLeft + plotW / 2
        : padLeft + (i / (count - 1)) * plotW;
    const y = baselineY - (pt.totalCoins / yMax) * plotH;
    return { ...pt, x, y };
  });

  const linePath = coords
    .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');
  const areaPath =
    coords.length > 0
      ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${baselineY.toFixed(1)} L ${coords[0].x.toFixed(1)} ${baselineY.toFixed(1)} Z`
      : '';

  const barW = count > 0 ? Math.min(26, Math.max(10, Math.round((plotW / count) * 0.4))) : 16;

  return (
    <div
      className="p-4 rounded-2xl bg-slate-950/65 border border-slate-800/90 space-y-3 min-w-0 max-w-full box-border"
      data-testid={testId}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs sm:text-sm font-black text-white">{resolvedTitle}</div>
          {subtitle && <div className="text-[11px] text-slate-400 mt-0.5">{subtitle}</div>}
        </div>
        <div className="flex items-center gap-2.5 text-[10px] font-bold text-slate-300">
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            {tr('Jami Coinlar', 'Всего коинов')}
          </span>
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500/50 border border-cyan-400" />
            {tr('Kunlik hajm', 'Дневной объём')}
          </span>
        </div>
      </div>

      {count === 0 ? (
        <div className="py-10 text-center text-xs text-slate-400 rounded-xl bg-slate-900/50 border border-slate-800/70">
          {resolvedEmptyText}
        </div>
      ) : (
        <>
          <div className="w-full overflow-x-auto max-w-full">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="block h-auto"
              style={{
                width: '100%',
                minWidth: count > 8 ? `${Math.min(720, count * 56)}px` : '100%',
              }}
              role="img"
              aria-label={resolvedTitle}
            >
              <defs>
                <linearGradient id="coinTrendAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.38" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {[0, 0.25, 0.5, 0.75, 1].map((frac, idx) => {
                const tickVal = Math.round(yMax * frac);
                const y = padTop + plotH * (1 - frac);
                return (
                  <g key={idx}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={svgWidth - padRight}
                      y2={y}
                      stroke={frac === 0 ? 'rgba(148, 163, 184, 0.3)' : 'rgba(51, 65, 85, 0.55)'}
                      strokeWidth="1"
                    />
                    <text
                      x={padLeft - 6}
                      y={y + 3.5}
                      textAnchor="end"
                      fill="#64748b"
                      fontSize="9.5"
                      fontWeight="700"
                    >
                      {tickVal}
                    </text>
                  </g>
                );
              })}

              {areaPath && coords.length > 1 && <path d={areaPath} fill="url(#coinTrendAreaGrad)" />}

              {coords.map((c) => {
                const h = c.totalCoins > 0 ? Math.max(4, baselineY - c.y) : 2;
                return (
                  <rect
                    key={`bar-${c.dateKey || c.idx}`}
                    x={c.x - barW / 2}
                    y={baselineY - h}
                    width={barW}
                    height={h}
                    rx="4"
                    fill="rgba(6, 182, 212, 0.22)"
                    stroke="rgba(56, 189, 248, 0.45)"
                    strokeWidth="1"
                  />
                );
              })}

              {linePath && coords.length > 1 && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {coords.map((c) => {
                const isActive = activePoint && activePoint.idx === c.idx;
                return (
                  <g
                    key={`dot-${c.dateKey || c.idx}`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(c.idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    onClick={() => setHoveredIdx(c.idx)}
                  >
                    <title>
                      {language === 'ru'
                        ? `${c.fullDate}: ${c.totalCoins} коин. (${c.txCount} опер.)`
                        : `${c.fullDate}: ${c.totalCoins} Coin (${c.txCount} ta operatsiya)`}
                    </title>
                    <circle
                      cx={c.x}
                      cy={c.y}
                      r={isActive ? 6 : 4}
                      fill={isActive ? '#fde047' : '#f59e0b'}
                      stroke="#0f172a"
                      strokeWidth="2"
                    />
                    <text
                      x={c.x}
                      y={Math.max(12, c.y - 9)}
                      textAnchor="middle"
                      fill={c.totalCoins > 0 ? '#fef3c7' : '#64748b'}
                      fontSize="9.5"
                      fontWeight="800"
                    >
                      {c.totalCoins}
                    </text>
                    <text
                      x={c.x}
                      y={baselineY + 16}
                      textAnchor="middle"
                      fill={isActive ? '#38bdf8' : '#94a3b8'}
                      fontSize="9.5"
                      fontWeight="700"
                    >
                      {c.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {activePoint && (
            <div className="px-3 py-2 rounded-xl bg-slate-900/75 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className="text-slate-200 font-bold">
                📅 {activePoint.fullDate}:{' '}
                <span className="text-cyan-300">
                  {tr("O'quvchilar", 'Ученики')} +{activePoint.studentCoins}
                </span>
                {activePoint.classCoins > 0 && (
                  <span className="text-purple-300">
                    {' '}• {tr('Sinf fondi', 'Фонд класса')} +{activePoint.classCoins}
                  </span>
                )}
              </span>
              <span className="font-bold text-slate-300 whitespace-nowrap">
                <strong className="text-amber-300">{activePoint.totalCoins} 💎</strong> •{' '}
                {language === 'ru'
                  ? `${activePoint.txCount} опер. • ${activePoint.submissionsCount} тестов`
                  : `${activePoint.txCount} operatsiya • ${activePoint.submissionsCount} ta test`}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
