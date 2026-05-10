const Calc = require('../js/calc.js');
const CalcInvest = require('../js/calc-invest.js');
const { calculate, computeSensNPV, fv, fvAnnuityMonthly } = Calc;
const { calculateInvest } = CalcInvest;

function defaultParams() {
    return {
        p0: 31, discount: 0, equity: 15, l1: 12, repair: 8,
        g_new: 0.20, g_old: 0.12, r: 0.095, i1: 0.06, i2: 0.18,
        t1: 2, T: 4, s0: 30, savingsMonthly: 0.28,
        repayL1Early: false, loanTerm: 20
    };
}

describe('calculate with annuity', () => {
    test('calculate returns WA and WB', () => {
        const res = calculate(defaultParams());
        expect(res.WA).toBeGreaterThan(0);
        expect(res.WB).toBeGreaterThan(0);
        expect(res.yearly.length).toBe(defaultParams().T);
    });

    test('npvDirect is WA - WB discounted', () => {
        const res = calculate(defaultParams());
        const expectedNpv = (res.WA - res.WB) / Math.pow(1 + defaultParams().r, defaultParams().T);
        expect(res.npvDirect).toBeCloseTo(expectedNpv, 4);
    });

    test('sensNPV matches calculate npvDirect', () => {
        const v = defaultParams();
        const baseNpv = calculate(v).npvDirect;
        const sensNpv = computeSensNPV({}, v);
        expect(sensNpv).toBeCloseTo(baseNpv, 4);
    });

    test('pmt is calculated correctly (annuity)', () => {
        const res = calculate(defaultParams());
        expect(res.pmt1).toBeGreaterThan(0);
        // Should pay principal too
        expect(res.totalPrin).toBeGreaterThan(0);
    });
});

describe('calculateInvest', () => {
    function defaultInvestParams() {
        return {
            equity: 3000000,
            savings: 70000,
            T: 3,
            price: 15000000,
            loanTerm: 30,
            rateMortgage: 0.06,
            growth: 0.08,
            depRate: 0.12,
            cbRate: 0.145
        };
    }

    test('calculateInvest returns W1 and W2', () => {
        const res = calculateInvest(defaultInvestParams());
        expect(res.W1).toBeGreaterThan(0);
        expect(res.W2).toBeGreaterThan(0);
        expect(res.yearly.length).toBe(defaultInvestParams().T);
    });

    test('npvDirect is W2 - W1 discounted', () => {
        const params = defaultInvestParams();
        const res = calculateInvest(params);
        const expectedNpv = (res.W2 - res.W1) / Math.pow(1 + params.depRate / 12, params.T * 12);
        expect(res.npvDirect).toBeCloseTo(expectedNpv, 4);
    });

    test('Taxes are calculated for deposit if interest exceeds limit', () => {
        const params = defaultInvestParams();
        params.equity = 10000000; // Big deposit
        params.depRate = 0.20; // 20%
        params.cbRate = 0.05; // limit 50k
        const res = calculateInvest(params);
        expect(res.tax1_total).toBeGreaterThan(0);
    });

    test('Edge case: loan term is shorter than investment horizon', () => {
        const params = defaultInvestParams();
        params.loanTerm = 2; // Pay off in 2 years
        params.T = 5; // Horizon is 5 years
        const res = calculateInvest(params);
        // Debt should be strictly 0 at the end, not negative
        expect(res.yearly[4].debt2).toBeCloseTo(0, 4);
        // Pmt should stop subtracting from dep2 after year 2
        expect(res.W2).toBeGreaterThan(0); 
    });

    test('Edge case: equity is greater than apartment price', () => {
        const params = defaultInvestParams();
        params.equity = 20000000;
        params.price = 15000000;
        const res = calculateInvest(params);
        // Should take no mortgage
        expect(res.pmt).toBe(0);
        // Remaining 5M should go to deposit
        expect(res.yearly[0].debt2).toBe(0);
        expect(res.yearly[0].dep2).toBeGreaterThan(5000000); 
    });
});
