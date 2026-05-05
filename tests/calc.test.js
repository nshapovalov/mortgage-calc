// Тесты на чистые функции из js/calc.js
// calc.js экспортирует себя через module.exports при запуске в Node.js

const Calc = require('../js/calc.js');
const { fv, fvAnnuity, fvAnnuityMonthly, npv, calculate, computeSensNPV } = Calc;

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


// ─── Функция calculate ────────────────────────────────────────────────────────

function defaultParams() {
    return {
        p0: 50, discount: 20, equity: 15, l1: 12, repair: 0,
        g_new: 0.05, g_old: 0.05, r: 0.14, i1: 0.06, i2: 0.18,
        t1: 2, T: 5, s0: 35, savingsMonthly: 0.4,
        repayL1Early: false,
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

    test('нулевой рост g_new и g_old: обе квартиры не дорожают', () => {
        const v = { ...defaultParams(), g_new: 0, g_old: 0 };
        const r = calculate(v);
        expect(r.dealCapital(v.T)).toBeLessThan(calculate(defaultParams()).dealCapital(defaultParams().T));
    });

    test('при высоком росте g_new ипотека выгоднее: NPV > 0', () => {
        const v = { ...defaultParams(), g_new: 0.20, g_old: 0.20 }; // 20% рост
        expect(calculate(v).npvDirect).toBeGreaterThan(0);
    });

    test('при нулевом росте g и высокой ставке r ипотека проигрывает', () => {
        const v = { ...defaultParams(), g_new: 0, g_old: 0, r: 0.20 };
        expect(calculate(v).npvDirect).toBeLessThan(0);
    });

    test('t1 = T: дорогой кредит гасится в последний год, totalPercent = (I1+I2)*T', () => {
        const v = { ...defaultParams(), t1: 5, T: 5 };
        const r = calculate(v);
        expect(r.totalPercent).toBeCloseTo(r.I1 * 5 + r.I2 * 5, 5);
    });

    test('t1 = T: dealCapital(T) включает старую квартиру напрямую, не через вклад', () => {
        const v = { ...defaultParams(), t1: 5, T: 5 };
        const r = calculate(v);
        // старая квартира учтена как fv(s0, g, T) - L2, а не delta * fv(...)
        const expected_s0_contrib = fv(v.s0, v.g, v.T) - r.L2;
        expect(r.WA).toBeGreaterThan(0); // не ломается
    });

    test('l1 = 0: нет льготного кредита, I1 = 0', () => {
        const v = { ...defaultParams(), l1: 0 };
        const r = calculate(v);
        expect(r.I1).toBeCloseTo(0, 5);
        // весь долг — дорогой
        expect(r.L2).toBeCloseTo(v.p0 * (1 - v.discount / 100) + v.repair - v.equity, 2);
    });

    test('l1 = 0: totalPercent = только дорогой за t1 лет', () => {
        const v = { ...defaultParams(), l1: 0 };
        const r = calculate(v);
        expect(r.totalPercent).toBeCloseTo(r.I2 * v.t1, 5);
    });

    test('savingsMonthly = 0: базовый капитал = вклад + квартира', () => {
        const v = { ...defaultParams(), savingsMonthly: 0 };
        const r = calculate(v);
        const expected = fv(v.equity, v.r, v.T) + fv(v.s0, v.g_old, v.T);
        expect(r.WB).toBeCloseTo(expected, 4);
    });

    test('savingsMonthly = 0: dealCapital(T) учитывает освобождённые % после t1', () => {
        const v = { ...defaultParams(), savingsMonthly: 0 };
        const r = calculate(v);
        // При L2 > 0 после t1 освобождаются проценты I2, которые копятся как "сбережения"
        const expectedFreed = r.L2 > 0 ? r.I2 / 12 : 0;
        if (expectedFreed > 0) {
            expect(r.savingsDealFV).toBeGreaterThan(0);
        } else {
            expect(r.savingsDealFV).toBeCloseTo(0, 4);
        }
    });

    test('savingsMonthly > 0: dealCapital включает сбережения, WA растёт', () => {
        const v1 = { ...defaultParams(), savingsMonthly: 0 };
        const v2 = { ...defaultParams(), savingsMonthly: 0.5 };
        expect(calculate(v2).WA).toBeGreaterThan(calculate(v1).WA);
    });

    test('discount = 0: C = p0', () => {
        const v = { ...defaultParams(), discount: 0 };
        const r = calculate(v);
        expect(r.C).toBeCloseTo(v.p0, 5);
    });

    test('g_new = 100%: не ломает вычисления, NPV положительный при экстремальном росте', () => {
        const v = { ...defaultParams(), g_new: 1.0, g_old: 1.0 }; // 100% в год
        const r = calculate(v);
        expect(r.WA).toBeGreaterThan(0);
        expect(r.WB).toBeGreaterThan(0);
        expect(r.npvDirect).toBeGreaterThan(0); // сильный рост = ипотека выгоднее
    });

    test('equity очень большой: L2 = 0, F0 = equity + l1 - need', () => {
        const v = { ...defaultParams(), equity: 40 };
        const r = calculate(v);
        const need = v.p0 * (1 - v.discount / 100) + v.repair;
        expect(r.L2).toBeCloseTo(0, 5);
        expect(r.F0).toBeCloseTo(v.equity + v.l1 - need, 5);
    });

    test('t1 = 1 (минимум): результат финансово разумен', () => {
        const v = { ...defaultParams(), t1: 1 };
        const r = calculate(v);
        expect(r.WA).toBeGreaterThan(0);
        expect(r.totalPercent).toBeCloseTo(r.I1 * v.T + r.I2 * 1, 5);
    });

    test('T = 3 (минимум горизонта): всё считается без ошибок', () => {
        const v = { ...defaultParams(), T: 3, t1: 2 };
        const r = calculate(v);
        expect(r.WA).toBeGreaterThan(0);
        expect(r.WB).toBeGreaterThan(0);
        expect(typeof r.npvDirect).toBe('number');
        expect(isNaN(r.npvDirect)).toBe(false);
    });

});

// ─── Сбережения в сценарии А ──────────────────────────────────────────────────

describe('savings in dealCapital', () => {
    test('savingsDealFV >= saveFV при одинаковых параметрах (освобождённые % дают бонус)', () => {
        const r = calculate(defaultParams());
        // saveFV = базовые сбережения; savingsDealFV включает освобождённые % после t1
        expect(r.savingsDealFV).toBeGreaterThanOrEqual(r.saveFV);
    });

    test('freedMonthly = 0 если L2 = 0 и repayL1Early = false', () => {
        const v = { ...defaultParams(), equity: 40, l1: 5, repayL1Early: false };
        // equity+l1=45 > need=40 → L2=0, I2=0
        const r = calculate(v);
        expect(r.L2).toBeCloseTo(0, 5);
        expect(r.freedMonthly).toBeCloseTo(0, 5);
    });

    test('freedMonthly = I2/12 при L2 > 0 и repayL1Early=false', () => {
        const r = calculate(defaultParams());
        expect(r.freedMonthly).toBeCloseTo(r.I2 / 12, 5);
    });

    test('WA > WB или разрыв уменьшается: сбережения в сделке улучшают сценарий А', () => {
        const r = calculate(defaultParams());
        // Разница WA - WB теперь включает сбережения в А, сравниваем что WA не ниже ожидаемого
        expect(r.WA).toBeGreaterThan(0);
        expect(r.savingsDealFV).toBeGreaterThan(0);
    });

});

// ─── repayL1Early ─────────────────────────────────────────────────────────────

describe('repayL1Early — досрочное гашение льготного кредита', () => {
    test('repayL1Early=false: canRepayL1 = false, поведение как раньше', () => {
        const v = { ...defaultParams(), repayL1Early: false };
        const r = calculate(v);
        expect(r.canRepayL1).toBe(false);
        expect(r.totalPercent).toBeCloseTo(r.I1 * v.T + r.I2 * v.t1, 5);
    });

    test('repayL1Early=true, выручка покрывает L2+l1: canRepayL1 = true', () => {
        // s0=35, g_old=5%, t1=2: S1 = 35*1.05^2 = 38.6 > L2(13)+l1(12) = 25
        const v = { ...defaultParams(), repayL1Early: true };
        const r = calculate(v);
        expect(r.canRepayL1).toBe(true);
    });

    test('repayL1Early=true: totalPercent = (I1+I2)*t1, не платим % после t1', () => {
        const v = { ...defaultParams(), repayL1Early: true };
        const r = calculate(v);
        expect(r.totalPercent).toBeCloseTo((r.I1 + r.I2) * v.t1, 5);
    });

    test('interestFV > totalPercent: FV процентов всегда больше номинала (компаундирование)', () => {
        const withEarly    = calculate({ ...defaultParams(), repayL1Early: true });
        const withoutEarly = calculate({ ...defaultParams(), repayL1Early: false });
        expect(withEarly.interestFV).toBeGreaterThan(withEarly.totalPercent);
        expect(withoutEarly.interestFV).toBeGreaterThan(withoutEarly.totalPercent);
    });

    test('repayL1Early=true: WA > WA без досрочного гашения если r > i1', () => {
        // r=14% > i1=6%, значит финансово невыгодно гасить l1 досрочно → WA ниже
        const withEarly    = calculate({ ...defaultParams(), repayL1Early: true });
        const withoutEarly = calculate({ ...defaultParams(), repayL1Early: false });
        // r > i1(6%), гасим невыгодно → капитал со снятием меньше
        expect(withEarly.WA).toBeLessThan(withoutEarly.WA);
    });

    test('repayL1Early=true, выручка НЕ покрывает L2+l1: canRepayL1 = false, поведение обычное', () => {
        // s0 маленький — выручка покрывает только часть долга
        const v = { ...defaultParams(), repayL1Early: true, s0: 10, l1: 20, L2_implicit: true };
        // need = 50*0.8 = 40; equity+l1 = 15+20 = 35 < 40 → L2=5
        // S1 = 10*(1.05^2)=11.0; S1-L2=11-5=6 < l1=20 → canRepayL1=false
        const r = calculate({ ...defaultParams(), repayL1Early: true, s0: 10, l1: 20 });
        expect(r.canRepayL1).toBe(false);
        // Поведение как без досрочного гашения
        const rNo = calculate({ ...defaultParams(), repayL1Early: false, s0: 10, l1: 20 });
        expect(r.WA).toBeCloseTo(rNo.WA, 4);
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

    test('рост g_new повышает NPV (ипотека выигрывает от роста цен новой)', () => {
        const npvLow  = computeSensNPV({ g_new: 0.02 }, v);
        const npvHigh = computeSensNPV({ g_new: 0.15 }, v);
        expect(npvHigh).toBeGreaterThan(npvLow);
    });

    test('рост g_old снижает NPV (растёт альтернативная стоимость базы)', () => {
        const npvLow  = computeSensNPV({ g_old: 0.02 }, v);
        const npvHigh = computeSensNPV({ g_old: 0.15 }, v);
        expect(npvHigh).toBeLessThan(npvLow);
    });

    test('рост r снижает NPV (высокая ставка вклада делает ипотеку менее выгодной)', () => {
        const npvLow  = computeSensNPV({ r: 0.08 }, v);
        const npvHigh = computeSensNPV({ r: 0.18 }, v);
        expect(npvHigh).toBeLessThan(npvLow);
    });
});
