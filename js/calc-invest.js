(function(global) {

function calculateInvest(v) {
    var equity_for_apt = Math.min(v.equity, v.price);
    var L = v.price - equity_for_apt;
    
    var r_m = v.rateMortgage / 12;
    var N = v.loanTerm * 12;
    var pmt = 0;
    if (L > 0) {
        pmt = r_m > 0 ? L * r_m / (1 - Math.pow(1 + r_m, -N)) : L / N;
    }
    
    var r_dep_m = v.depRate / 12;
    
    var dep1 = v.equity;
    var tax1_total = 0;
    
    var dep2 = v.equity - equity_for_apt; 
    var debt2 = L;
    var tax2_total = 0;
    
    var yearly = [];
    var cur_year_int1 = 0;
    var cur_year_int2 = 0;
    
    var total_interest_paid = 0;

    var months = v.T * 12;
    for (var m = 1; m <= months; m++) {
        // Сценарий 1: Вклад
        var int1 = dep1 * r_dep_m;
        if (int1 > 0) cur_year_int1 += int1;
        dep1 += int1 + v.savings;
        
        // Сценарий 2: Ипотека
        var int2 = dep2 * r_dep_m;
        if (int2 > 0) cur_year_int2 += int2;
        dep2 += int2;
        
        var actual_pmt = 0;
        if (debt2 > 0.01) {
            var m_int = debt2 * r_m;
            actual_pmt = Math.min(pmt, debt2 + m_int);
            var m_prin = actual_pmt - m_int;
            debt2 -= m_prin;
            total_interest_paid += m_int;
            if (debt2 < 0.01) debt2 = 0; // snap to 0 to avoid floating point micro-debts
        }
        
        // Остаток сбережений идет на вклад (или дефицит вычитается)
        dep2 += v.savings - actual_pmt;
        
        // Налоги на вклады (раз в год)
        if (m % 12 === 0) {
            var year = m / 12;
            var free_limit = 1000000 * v.cbRate; // Необлагаемая база
            
            if (cur_year_int1 > free_limit) {
                var tax = (cur_year_int1 - free_limit) * 0.13;
                dep1 -= tax;
                tax1_total += tax;
            }
            if (cur_year_int2 > free_limit) {
                var tax = (cur_year_int2 - free_limit) * 0.13;
                dep2 -= tax;
                tax2_total += tax;
            }
            
            cur_year_int1 = 0;
            cur_year_int2 = 0;
            
            yearly.push({
                year: year,
                dep1: dep1,
                dep2: dep2,
                debt2: debt2,
                price2: v.price * Math.pow(1 + v.growth, year)
            });
        }
    }
    
    var sellPrice = v.price * Math.pow(1 + v.growth, v.T);
    
    // Юридически правильный налог: (Продажа - Покупка) * 13%
    var profit = sellPrice - v.price;
    var taxSell = profit > 0 ? profit * 0.13 : 0;
    
    var W1 = dep1;
    var W2 = sellPrice - taxSell - debt2 + dep2;
    
    var diff = W2 - W1;
    var effective_discount = Math.pow(1 + r_dep_m, months);
    var npvDirect = diff / effective_discount;
    
    // Exact IRR Calculation
    function calcMonthlyIRR(W) {
        if (months === 0) return 0; // Edge case: 0 months horizon
        
        var cf = new Array(months + 1).fill(0);
        cf[0] = -v.equity;
        for (var m = 1; m <= months; m++) {
            cf[m] = -v.savings;
        }
        cf[months] += W;
        
        // Bisection method
        var low = -0.9999;
        var high = 10.0;
        
        var sum = 0;
        for(var i=0; i<=months; i++) sum += cf[i];
        if (sum < 0) {
            high = 0;
        } else {
            low = 0;
        }

        for (var i = 0; i < 100; i++) {
            var mid = (low + high) / 2;
            var npv = 0;
            for (var t = 0; t <= months; t++) {
                npv += cf[t] / Math.pow(1 + mid, t);
            }
            if (npv > 0) {
                low = mid;
            } else {
                high = mid;
            }
        }
        return Math.pow(1 + (low + high)/2, 12) - 1;
    }
    
    var irr1 = calcMonthlyIRR(W1);
    var irr2 = calcMonthlyIRR(W2);
    
    return {
        pmt: pmt,
        W1: W1,
        W2: W2,
        diff: diff,
        npvDirect: npvDirect,
        irr1: irr1,
        irr2: irr2,
        yearly: yearly,
        sellPrice: sellPrice,
        taxSell: taxSell,
        tax1_total: tax1_total,
        tax2_total: tax2_total,
        total_interest_paid: total_interest_paid,
        v: v
    };
}

var exportTarget = (typeof module !== 'undefined' && module.exports) ? global : global;
exportTarget.CalcInvest = {
    calculateInvest: calculateInvest
};
if (typeof module !== 'undefined' && module.exports) module.exports = exportTarget.CalcInvest;

})(typeof window !== 'undefined' ? window : global);