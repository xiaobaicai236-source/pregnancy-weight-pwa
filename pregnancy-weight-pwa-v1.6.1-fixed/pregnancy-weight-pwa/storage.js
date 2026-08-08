
window.PregnancyStorage = (() => {
  const KEY = 'pregnancy-weight-pwa-v1';
  const defaults = () => ({
    preWeight: window.PregnancyData.defaultPrePregnancyWeight,
    week: window.PregnancyData.defaultWeek,
    day: window.PregnancyData.defaultDay,
    currentWeight: '',
    records: []
  });

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
      return { ...defaults(), ...raw, records: Array.isArray(raw.records) ? raw.records : [] };
    } catch { return defaults(); }
  }

  function save(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function addRecord(state, week, day, weight) {
    const value = Number(weight);
    if (!Number.isFinite(value) || value <= 0) return state;
    const gestation = window.PregnancyCalculator.gestationalWeek(week, day);
    const id = `${Math.round(gestation * 7)}d`;
    const record = { id, week: +week, day: +day, gestation, weight: value, updatedAt: Date.now() };
    const records = state.records.filter(r => r.id !== id);
    records.push(record);
    records.sort((a,b) => a.gestation - b.gestation);
    return { ...state, currentWeight: value, week:+week, day:+day, records: records.slice(-80) };
  }

  function updateRecord(state, id, weight) {
    const value = Number(weight);
    if (!Number.isFinite(value) || value < 30 || value > 200) return state;
    const records = state.records.map(r => r.id === id ? { ...r, weight:value, updatedAt:Date.now() } : r);
    const latest = [...records].sort((a,b)=>a.gestation-b.gestation).at(-1);
    return { ...state, records, currentWeight: latest ? latest.weight : '' };
  }

  function deleteRecord(state, id) {
    const records = state.records.filter(r => r.id !== id);
    const latest = [...records].sort((a,b)=>a.gestation-b.gestation).at(-1);
    return { ...state, records, currentWeight: latest ? latest.weight : '' };
  }

  function clearRecords(state) { return { ...state, currentWeight:'', records:[] }; }
  function replaceData(statePatch) {
    const next = { ...defaults(), ...statePatch, records:Array.isArray(statePatch.records)?statePatch.records:[] };
    save(next);
    return next;
  }
  return { load, save, addRecord, updateRecord, deleteRecord, clearRecords, replaceData };
})();
