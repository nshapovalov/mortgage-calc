// Финансовая математика — чистые функции без DOM
// Доступны через window.Calc в браузере и через global.Calc в Node.js (тесты)

(function(global) {

function fv(pv, rate, periods) {
    return pv * Math.pow(1 + rate, periods);
}

// Будущая стоимость аннуитета: взнос в НАЧАЛЕ каждого года, n лет
function fvAnnuity(pmt, rate, n) {
    return rate === 0 ? pmt * n : pmt * (Math.pow(1 + rate, n) - 1) / rate;
}

// Будущая стоимость аннуитета: взнос каждый МЕСЯЦ, years лет — точнее для зарплатных сбережений
function fvAnnuityMonthly(pmt, annualRate, years) {
    var rm = annualRate / 12;
    var n  = years * 12;
    return rm === 0 ? pmt * n : pmt * (Math.pow(1 + rm, n) - 1) / rm;
}

function npv(rate, cashflows) {
    return cashflows.reduce(function(sum, cf, i) {
        return sum + cf / Math.pow(1 + rate, i);
    }, 0);
}

// MIRR — Modified IRR, решает проблему нескольких нулей у стандартного IRR.
// Положительные потоки реинвестируются по reinvestRate (обычно ставка вклада r).
// Отрицательные потоки дисконтируются по financeRate (тоже r как альтернативная стоимость).
// Ключевое свойство при reinvestRate = financeRate = r: MIRR > r ↔ NPV > 0 (всегда согласовано).
function calcMIRR(cashflows, reinvestRate, financeRate) {
    var n = cashflows.length - 1;
    var pvNeg = 0, fvPos = 0;
    for (var i = 0; i <= n; i++) {
        if (cashflows[i] < 0) {
            pvNeg += Math.abs(cashflows[i]) / Math.pow(1 + financeRate, i);
        } else if (cashflows[i] > 0) {
            fvPos += cashflows[i] * Math.pow(1 + reinvestRate, n - i);
        }
    }
    if (pvNeg === 0 || fvPos === 0) return null;
    return Math.pow(fvPos / pvNeg, 1 / n) - 1;
}

function calculate(v) {
    var annual = v.savingsMonthly * 12;

    // Базовый сценарий: equity лежит на вкладе, старая квартира растёт, сбережения ежемесячные
    function baseCapital(t) {
        if (t === 0) return v.equity + v.s0;
        return fv(v.equity, v.r, t)
             + fv(v.s0, v.g_old, t)
             + fvAnnuityMonthly(v.savingsMonthly, v.r, t);
    }

    // Параметры покупки
    var C    = v.p0 * (1 - v.discount / 100);
    var need = C + v.repair;
    var L2, F0;
    if (v.equity + v.l1 >= need) {
        L2 = 0;
        F0 = v.equity + v.l1 - need;
    } else {
        L2 = need - v.equity - v.l1;
        F0 = 0;
    }
    var I1 = v.l1 * v.i1;
    var I2 = L2  * v.i2;

    // Капитал по сделке в момент t
    function dealCapital(t) {
        if (t === 0) return v.p0 + v.s0 - v.l1 - L2 + F0;

        var cap = fv(v.p0, v.g_new, t) - v.l1;

        if (t <= v.t1) {
            cap += fv(v.s0, v.g_old, t) - L2;
        } else {
            var S1    = fv(v.s0, v.g_old, v.t1);
            var delta = S1 - L2;
            cap += delta >= 0
                ? delta * fv(1, v.r,  t - v.t1)
                : delta * fv(1, v.i2, t - v.t1);
        }

        var paid = 0;
        for (var k = 1; k <= Math.min(t, v.t1); k++)
            paid += (I1 + I2) * fv(1, v.r, t - k);
        for (var k2 = v.t1 + 1; k2 <= t; k2++)
            paid += I1 * fv(1, v.r, t - k2);
        cap -= paid;

        if (F0 > 0) cap += fv(F0, v.r, t);
        return cap;
    }

    var WB = baseCapital(v.T);
    var WA = dealCapital(v.T);
    var diff = WA - WB;
    var npvDirect = diff / fv(1, v.r, v.T);

    // Разностные денежные потоки (Сделка − База) для MIRR
    var cf = new Array(v.T + 1).fill(0);
    cf[0] = -(v.equity - F0);
    for (var t = 1; t <= v.T; t++) {
        var savingsFV_t = fvAnnuityMonthly(v.savingsMonthly, v.r, t);
        var savingsFV_prev = t > 1 ? fvAnnuityMonthly(v.savingsMonthly, v.r, t - 1) : 0;
        var baseCF = savingsFV_t - savingsFV_prev * (1 + v.r); // прирост сбережений за год t
        var dealCF = 0;

        if (t <= v.t1) dealCF -= (I1 + I2); else dealCF -= I1;
        if (t === v.t1) { dealCF += fv(v.s0, v.g_old, v.t1); dealCF -= L2; }
        if (t === v.T) {
            dealCF += fv(v.p0, v.g_new, v.T) - v.l1;
            baseCF  += fv(v.s0, v.g_old, v.T) + fv(v.equity, v.r, v.T) + fvAnnuityMonthly(v.savingsMonthly, v.r, v.T);
        }
        cf[t] = dealCF - baseCF;
    }

    // MIRR с обоими ставками = r: гарантированно MIRR > r ↔ NPV > 0
    var mirrVal = calcMIRR(cf, v.r, v.r);

    var totalPercent = I1 * v.T + I2 * v.t1;
    var monthlyPay   = L2 > 0 ? L2 * v.i2 / 12 : 0;
    var saveFV       = fvAnnuityMonthly(v.savingsMonthly, v.r, v.T);

    return {
        C: C, L2: L2, F0: F0, I1: I1, I2: I2,
        WB: WB, WA: WA, diff: diff,
        npvDirect: npvDirect,
        mirrVal: mirrVal,
        monthlyPay: monthlyPay, totalPercent: totalPercent, saveFV: saveFV,
        v: v, cf: cf,
        baseCapital: baseCapital, dealCapital: dealCapital,
    };
}

// Быстрый пересчёт NPV с одним изменённым параметром (для торнадо-графика)
function computeSensNPV(overrides, base) {
    var v = Object.assign({}, base, overrides);
    var C2  = v.p0 * (1 - v.discount / 100);
    var tot = C2 + v.repair;
    var l2, f0;
    if (v.equity + v.l1 >= tot) { l2 = 0; f0 = v.equity + v.l1 - tot; }
    else { l2 = tot - v.equity - v.l1; f0 = 0; }
    var ia = v.l1 * v.i1;
    var ib = l2 * v.i2;
    var S1 = fv(v.s0, v.g_old, v.t1);
    var delta = S1 - l2;
    var PT = fv(v.p0, v.g_new, v.T);
    var sp = 0;
    for (var k = 1; k <= v.t1; k++) sp += (ia + ib) * fv(1, v.r, v.T - k);
    for (var k2 = v.t1 + 1; k2 <= v.T; k2++) sp += ia * fv(1, v.r, v.T - k2);
    var dfv = delta >= 0
        ? delta * fv(1, v.r,  v.T - v.t1)
        : delta * fv(1, v.i2, v.T - v.t1);
    var WA2 = (PT - v.l1) + dfv + f0 * fv(1, v.r, v.T) - sp;
    var WB2 = fv(v.equity, v.r, v.T) + fv(v.s0, v.g_old, v.T) + fvAnnuityMonthly(v.savingsMonthly, v.r, v.T);
    return (WA2 - WB2) / fv(1, v.r, v.T);
}

var isNode = typeof module !== 'undefined' && module.exports;
var exportTarget = isNode ? global : global;
exportTarget.Calc = {
    fv: fv,
    fvAnnuity: fvAnnuity,
    fvAnnuityMonthly: fvAnnuityMonthly,
    npv: npv,
    calcMIRR: calcMIRR,
    calculate: calculate,
    computeSensNPV: computeSensNPV,
};
if (isNode) module.exports = exportTarget.Calc;

})(typeof window !== 'undefined' ? window : global);
