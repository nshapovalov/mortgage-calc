(function(global) {

function calculateInvest(v) {
    var L = v.price - v.equity;
    if (L < 0) L = 0;
    var r_m = v.rateMortgage / 12;
    var N = v.loanTerm * 12;
    var pmt = L > 0 ? L * r_m / (1 - Math.pow(1 + r_m, -N)) : 0;
    
    var r_dep_m = v.depRate / 12;
    
    var dep1 = v.equity;
    var tax1_total = 0;
    
    var dep2 = 0; 
    var debt2 = L;
    var tax2_total = 0;
    
    var yearly = [];
    var cur_year_int1 = 0;
    var cur_year_int2 = 0;
    
    var total_interest_paid = 0;

    var months = v.T * 12;
    for (var m = 1; m <= months; m++) {
        // Сценарий 1: Вклад
        var int1 = dep1 > 0 ? dep1 * r_dep_m : 0;
        cur_year_int1 += int1;
        dep1 += int1;
        dep1 += v.savings;
        
        // Сценарий 2: Ипотека
        var int2 = dep2 > 0 ? dep2 * r_dep_m : 0;
        cur_year_int2 += int2;
        dep2 += int2;
        
        var m_int = debt2 * r_m;
        var m_prin = pmt - m_int;
        if (debt2 > 0) {
            debt2 -= m_prin;
            total_interest_paid += m_int;
        }
        
        // Остаток сбережений идет на вклад (или дефицит вычитается)
        dep2 += v.savings - pmt;
        
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
    var npvDirect = diff / Math.pow(1 + v.depRate, v.T);
    
    // IRR Calculation (Simplified)
    // CF1: -equity, +W1 at T -> irr1 = (W1 / equity)^(1/T) - 1
    var irr1 = Math.pow(W1 / v.equity, 1 / v.T) - 1;
    // CF2: -equity, -savings monthly..., +W2 at T. Since savings are identical in both, we can compare overall IRR.
    // For pure investment perspective, what's the IRR of CF2?
    // Let's use simple geometric return on equity + accumulated savings.
    var total_invested = v.equity + v.savings * months;
    var irr2 = Math.pow(W2 / total_invested, 1 / v.T) - 1; // rough approx for annual yield
    
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