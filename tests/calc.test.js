// Тесты на чистые функции из js/calc.js
// calc.js экспортирует себя через module.exports при запуске в Node.js

const Calc = require('../js/calc.js');
const { fv, fvAnnuity, fvAnnuityMonthly, npv, calcMIRR, calculate, computeSensNPV } = Calc;

// ─── Базовые финансовые функции ───────────────────────────────────────────────

describe('fv — будущая стоимость', () => {
    test('нулевая ставка: возвращает PV', () => {
        expect(fv(100, 0, 5)).toBeCloseTo(100);
    });
    test('100% ставка за 1 период: удваивает', () => {
        expect(fv(10, 1.0, 1)).toBeCloseTo(20);
    });
    test('10% за 10 лет', () => {
        expect(fv(1, 0.10, 10)).toBeCloseTo(2.5937, 3);
    });
});

describe('fvAnnuity — годовой аннуитет', () => {
    test('нулевая ставка: просто сумма', () => {
        expect(fvAnnuity(100, 0, 5)).toBeCloseTo(500);
    });
    test('10% за 3 года: 1×1.21 + 1×1.1 + 1 = 3.31', () => {
        expect(fvAnnuity(1, 0.10, 3)).toBeCloseTo(3.31, 2);
    });
});

describe('fvAnnuityMonthly — ежемесячный аннуитет', () => {
    test('нулевая ставка за 1 год: 12 взносов', () => {
        expect(fvAnnuityMonthly(1, 0, 1)).toBeCloseTo(12);
    });
    test('12% годовых (1%/мес) за 1 год с взносом 1: (1.01^12-1)/0.01 ≈ 12.68', () => {
        expect(fvAnnuityMonthly(1, 0.12, 1)).toBeCloseTo(12.6825, 2);
    });
    test('больше годового аннуитета при той же ставке и сумме (чаще начисляется)', () => {
        const annual   = fvAnnuity(12, 0.12, 1);      // 12 за год
        const monthly  = fvAnnuityMonthly(1, 0.12, 1); // 1/мес × 12 мес
        expect(monthly).toBeGreaterThan(annual);
    });
});

describe('npv — чистая приведённая стоимость', () => {
    test('одна выплата через 1 период при ставке 10%: 110/(1.1) = 100', () => {
        expect(npv(0.10, [0, 110])).toBeCloseTo(100);
    });
    test('нулевые потоки → NPV = 0', () => {
        expect(npv(0.10, [0, 0, 0])).toBeCloseTo(0);
    });
    test('вложение 100 сейчас + возврат 121 через 2 года при 10% → NPV = 0', () => {
        expect(npv(0.10, [-100, 0, 121])).toBeCloseTo(0, 4);
    });
});

describe('calcMIRR — Modified IRR', () => {
    test('возвращает null если нет положительных потоков', () => {
        expect(calcMIRR([-10, -5, -3], 0.10, 0.10)).toBeNull();
    });
    test('возвращает null если нет отрицательных потоков', () => {
        expect(calcMIRR([10, 5, 3], 0.10, 0.10)).toBeNull();
    });
    test('простой случай: вложил 100, получил 121 через 2 года при r=10% → MIRR = 10%', () => {
        // cf = [-100, 0, 121]
        // PV_neg = 100, FV_pos = 121
        // MIRR = (121/100)^(1/2) - 1 = 0.1
        expect(calcMIRR([-100, 0, 121], 0.10, 0.10)).toBeCloseTo(0.10, 4);
    });
    test('если reinvest = finance = r, то MIRR > r ↔ NPV > 0', () => {
        const r  = 0.14;
        const cf = [-100, 10, 10, 150]; // произвольный поток

        const npvVal  = npv(r, cf);
        const mirrVal = calcMIRR(cf, r, r);

        if (npvVal > 0) expect(mirrVal).toBeGreaterThan(r);
        else if (npvVal < 0) expect(mirrVal).toBeLessThan(r);
    });
});

// ─── Функция calculate ────────────────────────────────────────────────────────

function defaultParams() {
    return {
        p0: 50, discount: 20, equity: 15, l1: 12, repair: 0,
        g: 0.05, r: 0.14, i1: 0.06, i2: 0.18,
        t1: 2, T: 5, s0: 35, savingsMonthly: 0.4,
    };
}

describe('calculate — основная функция', () => {
    const res = calculate(defaultParams());

    test('цена покупки = p0 × (1 - discount/100)', () => {
        expect(res.C).toBeCloseTo(50 * 0.8, 5);
    });

    test('нужен дорогой кредит: equity + l1 = 27 < need = 40', () => {
        expect(res.L2).toBeCloseTo(40 - 15 - 12, 5); // = 13
        expect(res.F0).toBeCloseTo(0, 5);
    });

    test('годовые проценты льготного = l1 × i1', () => {
        expect(res.I1).toBeCloseTo(12 * 0.06, 5);
    });

    test('годовые проценты дорогого = L2 × i2', () => {
        expect(res.I2).toBeCloseTo(13 * 0.18, 5);
    });

    test('WA и WB — положительные числа', () => {
        expect(res.WA).toBeGreaterThan(0);
        expect(res.WB).toBeGreaterThan(0);
    });

    test('diff = WA - WB', () => {
        expect(res.diff).toBeCloseTo(res.WA - res.WB, 5);
    });

    test('npvDirect = diff / (1+r)^T', () => {
        const expected = res.diff / Math.pow(1 + defaultParams().r, defaultParams().T);
        expect(res.npvDirect).toBeCloseTo(expected, 5);
    });

    test('MIRR > r ↔ NPV > 0', () => {
        if (res.npvDirect > 0.001)  expect(res.mirrVal).toBeGreaterThan(defaultParams().r);
        if (res.npvDirect < -0.001) expect(res.mirrVal).toBeLessThan(defaultParams().r);
    });

    test('baseCapital(0) = equity + s0', () => {
        expect(res.baseCapital(0)).toBeCloseTo(15 + 35, 5);
    });

    test('dealCapital(0) = p0 + s0 - l1 - L2 + F0', () => {
        const v = defaultParams();
        const expected = v.p0 + v.s0 - v.l1 - res.L2 + res.F0;
        expect(res.dealCapital(0)).toBeCloseTo(expected, 5);
    });
});

describe('calculate — краевые случаи', () => {
    test('если льготного кредита хватает: L2 = 0, F0 >= 0', () => {
        const v = defaultParams();
        v.l1   = 30; // перекрывает всю стоимость покупки (40 млн)
        const r = calculate(v);
        expect(r.L2).toBeCloseTo(0, 5);
        expect(r.F0).toBeGreaterThanOrEqual(0);
    });

    test('нулевой ремонт не влияет на стоимость покупки', () => {
        const v1 = defaultParams();
        const v2 = { ...defaultParams(), repair: 0 };
        expect(calculate(v1).C).toBeCloseTo(calculate(v2).C, 5);
    });

    test('нулевой рост g: обе квартиры не дорожают', () => {
        const v = { ...defaultParams(), g: 0 };
        const r = calculate(v);
        expect(r.dealCapital(v.T)).toBeLessThan(calculate(defaultParams()).dealCapital(defaultParams().T));
    });

    test('при высоком росте g ипотека выгоднее: NPV > 0', () => {
        const v = { ...defaultParams(), g: 0.20 }; // 20% рост
        expect(calculate(v).npvDirect).toBeGreaterThan(0);
    });

    test('при нулевом росте g и высокой ставке r ипотека проигрывает', () => {
        const v = { ...defaultParams(), g: 0, r: 0.20 };
        expect(calculate(v).npvDirect).toBeLessThan(0);
    });
});

// ─── computeSensNPV ───────────────────────────────────────────────────────────

describe('computeSensNPV — чувствительность NPV', () => {
    const v = defaultParams();

    test('при стандартных параметрах даёт то же значение, что calculate.npvDirect', () => {
        const expected = calculate(v).npvDirect;
        const actual   = computeSensNPV({}, v);
        expect(actual).toBeCloseTo(expected, 2);
    });

    test('рост g повышает NPV (ипотека выигрывает от роста цен)', () => {
        const npvLow  = computeSensNPV({ g: 0.02 }, v);
        const npvHigh = computeSensNPV({ g: 0.15 }, v);
        expect(npvHigh).toBeGreaterThan(npvLow);
    });

    test('рост r снижает NPV (высокая ставка вклада делает ипотеку менее выгодной)', () => {
        const npvLow  = computeSensNPV({ r: 0.08 }, v);
        const npvHigh = computeSensNPV({ r: 0.18 }, v);
        expect(npvHigh).toBeLessThan(npvLow);
    });
});
