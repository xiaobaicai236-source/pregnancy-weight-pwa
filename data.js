window.PregnancyData = Object.freeze({
  appVersion: '1.9.0',
  storageKey: 'pregnancy-weight-pwa-v1',
  defaultPrePregnancyWeight: null,
  defaultHeightCm: null,
  defaultPlurality: 'singleton',
  defaultWeek: 25,
  defaultDay: 0,
  minWeek: 1,
  maxWeek: 40,
  maxDay: 6,
  shareConfig: Object.freeze({
    productName: '孕期体重监测',
    productUrl: 'https://xiaobaicai236-source.github.io/pregnancy-weight-pwa/',
    qrEnabled: true
  }),
  constraints: Object.freeze({
    minWeightKg: 30,
    maxWeightKg: 200,
    minHeightCm: 120,
    maxHeightCm: 220,
    maxStoredRecords: 80,
    maxDoctorTargets: 280,
    maxImportRecords: 2000,
    maxBackupBytes: 2 * 1024 * 1024,
    minimumPaceSpanDays: 14,
    paceWindowWeeks: 4
  }),
  bmiCategories: Object.freeze([
    Object.freeze({ id:'underweight', label:'低体重', min:0, max:18.5 }),
    Object.freeze({ id:'normal', label:'正常体重', min:18.5, max:24 }),
    Object.freeze({ id:'overweight', label:'超重', min:24, max:28 }),
    Object.freeze({ id:'obese', label:'肥胖', min:28, max:Infinity })
  ]),
  references: Object.freeze({
    singleton: Object.freeze({
      // WS/T 801—2022. Units: kg and kg/week. The standard applies to
      // adult Chinese women with singleton natural pregnancy.
      firstTrimesterEndWeek: 13,
      firstTrimesterGainKg: Object.freeze([0, 2.0]),
      byBmi: Object.freeze({
        underweight: Object.freeze({ totalGainKg:[11,16], weeklyTargetKg:0.46, weeklyGainKg:[0.37,0.56] }),
        normal: Object.freeze({ totalGainKg:[8,14], weeklyTargetKg:0.37, weeklyGainKg:[0.26,0.48] }),
        overweight: Object.freeze({ totalGainKg:[7,11], weeklyTargetKg:0.30, weeklyGainKg:[0.22,0.37] }),
        obese: Object.freeze({ totalGainKg:[5,9], weeklyTargetKg:0.22, weeklyGainKg:[0.15,0.30] })
      })
    })
  }),
  sources: Object.freeze([
    Object.freeze({
      name:'国家卫生健康委员会 · WS/T 801—2022《妊娠期妇女体重增长推荐值标准》',
      url:'https://www.nhc.gov.cn/wjw/c100311/202208/deb61e5c2299451ea1b957b0672272b3.shtml',
      note:'默认计算标准；2022年7月28日发布，2022年10月1日实施，适用于我国妇女单胎自然妊娠'
    }),
    Object.freeze({
      name:'CDC · Weight Gain During Pregnancy（补充参考）',
      url:'https://www.cdc.gov/maternal-infant-health/pregnancy-weight/index.html',
      note:'仅作补充阅读，不参与默认计算'
    }),
    Object.freeze({
      name:'NASEM/IOM · Weight Gain During Pregnancy (2009)（补充参考）',
      url:'https://nap.nationalacademies.org/catalog/12584/weight-gain-during-pregnancy-reexamining-the-guidelines',
      note:'仅作补充阅读，不参与默认计算'
    })
  ])
});
