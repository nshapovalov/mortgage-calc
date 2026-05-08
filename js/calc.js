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

    var rm = v.r / 12;
    var rm1 = v.i1 / 12;
    var rm2 = v.i2 / 12;
    var N_months = (v.loanTerm || 20) * 12;

    // Честный аннуитетный платеж по кредитам
    var pmt1 = v.l1 > 0 ? v.l1 * rm1 / (1 - Math.pow(1+rm1, -N_months)) : 0;
    var pmt2 = L2 > 0   ? L2 * rm2   / (1 - Math.pow(1+rm2, -N_months)) : 0;

    var dep_A = F0;
    var dep_B = v.equity;
    var debt_l1 = v.l1;
    var debt_L2 = L2;

    var yearly = [];
    var total_int_A = 0;
    var total_prin_A = 0;

    var cur_year_int = 0;
    var cur_year_prin = 0;

    var wasL1RepaidEarly = false;
    var S1_t1 = 0;

    // Помесячная симуляция денежных потоков
    for (var m = 1; m <= v.T * 12; m++) {
        // Сценарий Б (база): вклад растет, откладываем сбережения
        dep_B = dep_B * (1 + rm) + v.savingsMonthly;

        // Сценарий А (ипотека): вклад растет, откладываем сбережения, затем списываем платежи
        dep_A = dep_A * (1 + rm) + v.savingsMonthly;

        var int1 = 0, prin1 = 0, actual_pmt1 = 0;
        if (debt_l1 > 0) {
            int1 = debt_l1 * rm1;
            actual_pmt1 = Math.min(pmt1, debt_l1 + int1);
            prin1 = actual_pmt1 - int1;
            debt_l1 -= prin1;
            dep_A -= actual_pmt1; // Аннуитетный платеж (проценты + тело) идет из бюджета/вклада
        }

        var int2 = 0, prin2 = 0, actual_pmt2 = 0;
        if (debt_L2 > 0) {
            int2 = debt_L2 * rm2;
            actual_pmt2 = Math.min(pmt2, debt_L2 + int2);
            prin2 = actual_pmt2 - int2;
            debt_L2 -= prin2;
            dep_A -= actual_pmt2; // Аннуитетный платеж (проценты + тело) идет из бюджета/вклада
        }

        cur_year_int += (int1 + int2);
        cur_year_prin += (prin1 + prin2);

        // Событие продажи старой квартиры в год t1
        if (m === v.t1 * 12) {
            S1_t1 = v.s0 * Math.pow(1 + v.g_old, v.t1);
            dep_A += S1_t1; // деньги от продажи идут на счет
            
            // Сразу гасим дорогой кредит L2 (остаток)
            if (debt_L2 > 0) {
                var payoff2 = debt_L2;
                dep_A -= payoff2;
                cur_year_prin += payoff2;
                debt_L2 = 0;
            }

            // Досрочно гасим льготный, если стоит галочка и хватает денег
            if (v.repayL1Early && dep_A >= debt_l1 && debt_l1 > 0) {
                var payoff1 = debt_l1;
                dep_A -= payoff1;
                cur_year_prin += payoff1;
                debt_l1 = 0;
                wasL1RepaidEarly = true;
            }
        }

        // Фиксация итогов каждого года
        if (m % 12 === 0) {
            var year = m / 12;
            var apt_new = v.p0 * Math.pow(1 + v.g_new, year);
            var apt_old_A = (year < v.t1) ? v.s0 * Math.pow(1 + v.g_old, year) : 0;
            var apt_old_B = v.s0 * Math.pow(1 + v.g_old, year);

            total_int_A += cur_year_int;
            total_prin_A += cur_year_prin;

            yearly.push({
                year: year,
                A_apt_new: apt_new,
                A_apt_old: apt_old_A,
                A_debt_l1: debt_l1,
                A_debt_L2: debt_L2,
                A_dep: dep_A,
                A_NW: apt_new + apt_old_A + dep_A - debt_l1 - debt_L2,
                A_int: cur_year_int,
                A_prin: cur_year_prin,
                
                B_apt_old: apt_old_B,
                B_dep: dep_B,
                B_NW: apt_old_B + dep_B
            });

            cur_year_int = 0;
            cur_year_prin = 0;
        }
    }

    var WA = yearly[v.T - 1].A_NW;
    var WB = yearly[v.T - 1].B_NW;
    var diff = WA - WB;
    var npvDirect = diff / Math.pow(1 + v.r, v.T);

    var A_NW_0 = v.p0 + v.s0 - v.l1 - L2 + F0;
    var B_NW_0 = v.equity + v.s0;

    return {
        C: C, L2: L2, F0: F0,
        pmt1: pmt1, pmt2: pmt2,
        WA: WA, WB: WB, diff: diff, npvDirect: npvDirect,
        totalPercent: total_int_A,
        totalPrin: total_prin_A,
        yearly: yearly,
        A_NW_0: A_NW_0, B_NW_0: B_NW_0,
        wasL1RepaidEarly: wasL1RepaidEarly, S1_t1: S1_t1,
        v: v
    };
}

// Быстрый пересчёт NPV с одним изменённым параметром (для торнадо-графика)
function computeSensNPV(overrides, base) {
    var v = Object.assign({}, base, overrides);
    return calculate(v).npvDirect;
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
