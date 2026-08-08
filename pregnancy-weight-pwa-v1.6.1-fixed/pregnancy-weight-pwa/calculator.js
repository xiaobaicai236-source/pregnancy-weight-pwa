
window.PregnancyCalculator = (() => {
  const D = window.PregnancyData;
  const round1 = n => Math.round((n + Number.EPSILON) * 10) / 10;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  function gestationalWeek(week, day) {
    const w = clamp(Number.isFinite(+week) ? +week : D.defaultWeek, D.minWeek, D.maxWeek);
    const d = clamp(Number.isFinite(+day) ? +day : 0, 0, 6);
    return w + d / 7;
  }

  function gainAt(gestation, type = 'target') {
    const c = D.curve;
    const g = clamp(+gestation, D.minWeek, D.maxWeek);
    const suffix = type[0].toUpperCase() + type.slice(1);
    const first = c['firstTrimesterGain' + suffix];
    const later = c['laterWeeklyGain' + suffix];
    if (g <= c.firstTrimesterEndWeek) {
      const progress = clamp((g - D.minWeek) / (c.firstTrimesterEndWeek - D.minWeek), 0, 1);
      return first * progress;
    }
    return first + (g - c.firstTrimesterEndWeek) * later;
  }

  function recommendation(preWeight, week, day) {
    const base = +preWeight || D.defaultPrePregnancyWeight;
    const g = gestationalWeek(week, day);
    return {
      gestation: g,
      target: round1(base + gainAt(g, 'target')),
      low: round1(base + gainAt(g, 'low')),
      high: round1(base + gainAt(g, 'high'))
    };
  }

  function curve(preWeight, start = D.minWeek, end = 40, step = 0.5) {
    const out = [];
    for (let w = start; w <= end + 1e-9; w += step) {
      const r = recommendation(preWeight, w, 0);
      out.push({ week: +w.toFixed(2), low: r.low, target: r.target, high: r.high });
    }
    return out;
  }

  return { gestationalWeek, recommendation, curve, round1 };
})();
