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


function calculate(v) {
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

    // Цена старой квартиры на момент продажи и флаг досрочного гашения льготного кредита
    var S1_t1 = fv(v.s0, v.g_old, v.t1);
    var canRepayL1 = !!(v.repayL1Early) && (S1_t1 - L2) >= v.l1;

    // Ежемесячные % которые освобождаются после t1 (добавляются к базовым сбережениям)
    var savedOnPercent = canRepayL1 ? (I1 + I2) / 12 : (L2 > 0 ? I2 / 12 : 0);
    var freedMonthly = Math.max(0, savedOnPercent); // всегда >= 0

    // Сбережения в сценарии А: те же savingsMonthly + освобождённые % после t1
    function savingsDeal(t) {
        if (t === 0) return 0;
        if (t <= v.t1) return fvAnnuityMonthly(v.savingsMonthly, v.r, t);
        var phase1 = fvAnnuityMonthly(v.savingsMonthly, v.r, v.t1) * fv(1, v.r, t - v.t1);
        var phase2 = fvAnnuityMonthly(v.savingsMonthly + freedMonthly, v.r, t - v.t1);
        return phase1 + phase2;
    }

    // Капитал по сделке в момент t
    function dealCapital(t) {
        if (t === 0) return v.p0 + v.s0 - v.l1 - L2 + F0;

        var cap, paid = 0;

        if (t <= v.t1) {
            cap = fv(v.p0, v.g_new, t) - v.l1;
            cap += fv(v.s0, v.g_old, t) - L2;
        } else if (canRepayL1) {
            // При продаже гасим и L2, и l1; остаток идёт на вклад
            var leftover = S1_t1 - L2 - v.l1;
            cap = fv(v.p0, v.g_new, t); // l1 уже погашен
            cap += leftover >= 0
                ? leftover * fv(1, v.r,  t - v.t1)
                : leftover * fv(1, v.i2, t - v.t1);
        } else {
            var delta = S1_t1 - L2;
            cap = fv(v.p0, v.g_new, t) - v.l1;
            cap += delta >= 0
                ? delta * fv(1, v.r,  t - v.t1)
                : delta * fv(1, v.i2, t - v.t1);
        }

        for (var k = 1; k <= Math.min(t, v.t1); k++)
            paid += (I1 + I2) * fv(1, v.r, t - k);
        if (!canRepayL1) {
            for (var k2 = v.t1 + 1; k2 <= t; k2++)
                paid += I1 * fv(1, v.r, t - k2);
        }
        cap -= paid;

        if (F0 > 0) cap += fv(F0, v.r, t);
        cap += savingsDeal(t);
        return cap;
    }

    var WB = baseCapital(v.T);
    var WA = dealCapital(v.T);
    var diff = WA - WB;
    var npvDirect = diff / fv(1, v.r, v.T);

    var totalPercent = canRepayL1
        ? (I1 + I2) * v.t1
        : I1 * v.T + I2 * v.t1;
    var monthlyPay   = L2 > 0 ? L2 * v.i2 / 12 : 0;
    var saveFV       = fvAnnuityMonthly(v.savingsMonthly, v.r, v.T);

    // Breakdown компонентов для Step 4 сценария А
    var newAptFinal = fv(v.p0, v.g_new, v.T);
    var leftoverAfterSale = canRepayL1 
        ? (S1_t1 - L2 - v.l1)
        : (S1_t1 - L2);
    var leftoverGrowthFV = leftoverAfterSale !== 0
        ? leftoverAfterSale * (leftoverAfterSale >= 0 ? fv(1, v.r, v.T - v.t1) : fv(1, v.i2, v.T - v.t1))
        : 0;
    var initialRestFV = F0 > 0 ? fv(F0, v.r, v.T) : 0;
    
    // Будущая стоимость уплаченных % 
    var interestFV = 0;
    if (canRepayL1) {
        // Все кредиты погашены в t1 - проценты не компаундируются после погашения
        interestFV = totalPercent;
    } else {
        // Кредиты не погашены досрочно - проценты компаундируются до T
        for (var k = 1; k <= Math.min(v.T, v.t1); k++)
            interestFV += (I1 + I2) * fv(1, v.r, v.T - k);
        for (var k2 = v.t1 + 1; k2 <= v.T; k2++)
            interestFV += I1 * fv(1, v.r, v.T - k2);
    }

    return {
        C: C, L2: L2, F0: F0, I1: I1, I2: I2,
        WB: WB, WA: WA, diff: diff,
        npvDirect: npvDirect,
        monthlyPay: monthlyPay, totalPercent: totalPercent, saveFV: saveFV,
        canRepayL1: canRepayL1, S1_t1: S1_t1, freedMonthly: freedMonthly,
        savingsDealFV: savingsDeal(v.T),
        // Breakdown для Step 4
        newAptFinal: newAptFinal,
        leftoverAfterSale: leftoverAfterSale,
        leftoverGrowthFV: leftoverGrowthFV,
        initialRestFV: initialRestFV,
        interestFV: interestFV,
        v: v,
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
    var canRL1 = !!(v.repayL1Early) && delta >= v.l1;
    var PT = fv(v.p0, v.g_new, v.T);
    var sp = 0;
    for (var k = 1; k <= v.t1; k++) sp += (ia + ib) * fv(1, v.r, v.T - k);
    if (!canRL1) {
        for (var k2 = v.t1 + 1; k2 <= v.T; k2++) sp += ia * fv(1, v.r, v.T - k2);
    }
    var dfv;
    if (canRL1) {
        var leftover = delta - v.l1;
        dfv = leftover >= 0
            ? leftover * fv(1, v.r,  v.T - v.t1)
            : leftover * fv(1, v.i2, v.T - v.t1);
    } else {
        dfv = delta >= 0
            ? delta * fv(1, v.r,  v.T - v.t1)
            : delta * fv(1, v.i2, v.T - v.t1);
    }
    var WA2 = canRL1
        ? PT + dfv + f0 * fv(1, v.r, v.T) - sp
        : (PT - v.l1) + dfv + f0 * fv(1, v.r, v.T) - sp;
    // Сбережения сценария А: savingsMonthly + освобождённые % после t1
    var freed2 = canRL1 ? (ia + ib) / 12 : (l2 > 0 ? ib / 12 : 0);
    if (v.T <= v.t1) {
        WA2 += fvAnnuityMonthly(v.savingsMonthly, v.r, v.T);
    } else {
        WA2 += fvAnnuityMonthly(v.savingsMonthly, v.r, v.t1) * fv(1, v.r, v.T - v.t1)
             + fvAnnuityMonthly(v.savingsMonthly + freed2, v.r, v.T - v.t1);
    }
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
    calculate: calculate,
    computeSensNPV: computeSensNPV,
};
if (isNode) module.exports = exportTarget.Calc;

})(typeof window !== 'undefined' ? window : global);
