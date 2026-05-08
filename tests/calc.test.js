const Calc = require('../js/calc.js');
const { calculate, computeSensNPV, fv, fvAnnuityMonthly } = Calc;

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
