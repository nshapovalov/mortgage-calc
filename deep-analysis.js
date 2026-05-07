// Глубокий анализ потенциальных ошибок
const Calc = require('./js/calc.js');

console.log('🔬 ГЛУБОКИЙ АНАЛИЗ ПОТЕНЦИАЛЬНЫХ ОШИБОК\n');

function testParams() {
    return {
        p0: 50, discount: 20, equity: 15, l1: 12, repair: 0,
        g_new: 0.05, g_old: 0.05, r: 0.14, i1: 0.06, i2: 0.18,
        t1: 2, T: 5, s0: 35, savingsMonthly: 0.4,
        repayL1Early: false,
    };
}

// НАЙДЕНА ОШИБКА 1: В тестах используется несуществующая переменная v.g
console.log('❌ ОШИБКА 1: В тесте calc.test.js строка 155');
console.log('Используется v.g, но должно быть v.g_old:');
console.log('// const expected_s0_contrib = fv(v.s0, v.g, v.T) - r.L2;');
console.log('// Правильно: fv(v.s0, v.g_old, v.T)');
console.log('');

// Проверим различие между calculate и computeSensNPV
console.log('🔍 ПРОВЕРКА 2: Точность computeSensNPV vs calculate');
const v = testParams();

// Базовый NPV
const fullResult = Calc.calculate(v);
const quickNPV = Calc.computeSensNPV({}, v);

console.log(`calculate.npvDirect: ${fullResult.npvDirect.toFixed(6)}`);  
console.log(`computeSensNPV:      ${quickNPV.toFixed(6)}`);
console.log(`Разность:            ${Math.abs(fullResult.npvDirect - quickNPV).toFixed(6)}`);

if (Math.abs(fullResult.npvDirect - quickNPV) > 0.001) {
    console.log('❌ ОШИБКА: computeSensNPV дает неточный результат!');
} else {
    console.log('✅ computeSensNPV точен');
}
console.log('');

// Проверим случай с отрицательным leftover
console.log('🔍 ПРОВЕРКА 3: Отрицательный leftover (нехватка денег при продаже)');
const vNegative = { ...testParams(), s0: 10, l1: 20 };  // Маленькая старая квартира, большой льготный кредит
const rNegative = Calc.calculate(vNegative);

console.log(`Старая квартира: ${vNegative.s0} млн`);
console.log(`Цена при продаже: ${rNegative.S1_t1.toFixed(2)} млн`);
console.log(`Дорогой кредит L2: ${rNegative.L2.toFixed(2)} млн`);
console.log(`Leftover: ${rNegative.leftoverAfterSale.toFixed(2)} млн`);

if (rNegative.leftoverAfterSale < 0) {
    console.log('При отрицательном leftover он должен расти по ставке i2');
    
    // Проверим, что отрицательный leftover правильно обрабатывается
    const expectedGrowth = rNegative.leftoverAfterSale * Calc.fv(1, vNegative.i2, vNegative.T - vNegative.t1);
    console.log(`Ожидаемый рост долга: ${expectedGrowth.toFixed(3)} млн`);
    console.log(`Фактический: ${rNegative.leftoverGrowthFV.toFixed(3)} млн`);
    
    if (Math.abs(expectedGrowth - rNegative.leftoverGrowthFV) > 0.01) {
        console.log('❌ ОШИБКА: Неправильный рост отрицательного leftover!');
    } else {
        console.log('✅ Отрицательный leftover обрабатывается правильно');
    }
} else {
    console.log('✅ В данном случае leftover положительный');
}
console.log('');

// НАЙДЕНА ОШИБКА 4: Потенциальная проблема с очень большим F0
console.log('🔍 ПРОВЕРКА 4: Очень большой F0 (остаток своих средств)');
const vBigF0 = { ...testParams(), equity: 50 };  // Очень много своих денег
const rBigF0 = Calc.calculate(vBigF0);

console.log(`Equity: ${vBigF0.equity} млн`);
console.log(`Нужно для покупки: ${(vBigF0.p0 * (1 - vBigF0.discount/100) + vBigF0.repair).toFixed(2)} млн`);
console.log(`Льготный кредит: ${vBigF0.l1} млн`);
console.log(`F0 (остаток): ${rBigF0.F0.toFixed(2)} млн`);
console.log(`L2 (дорогой кредит): ${rBigF0.L2.toFixed(2)} млн`);

// При большом equity: должно быть L2 = 0, F0 > 0
if (rBigF0.L2 !== 0 && rBigF0.F0 > 0) {
    console.log('❌ ПОТЕНЦИАЛЬНАЯ ОШИБКА: При избытке средств не должно быть дорогого кредита!');
} else {
    console.log('✅ Логика избытка средств работает правильно');
}
console.log('');

// НАЙДЕНА ОШИБКА 5: Проверим минимальные значения t1
console.log('🔍 ПРОВЕРКА 5: Минимальное значение t1=1');
const vMinT1 = { ...testParams(), t1: 1 };
const rMinT1 = Calc.calculate(vMinT1);

console.log(`t1: ${vMinT1.t1}, T: ${vMinT1.T}`);
console.log(`Период сбережений в сделке: ${vMinT1.T - vMinT1.t1} лет`);
console.log(`SavingsDealFV: ${rMinT1.savingsDealFV.toFixed(3)} млн`);

const expectedSavingsT1 = Calc.fvAnnuityMonthly(vMinT1.savingsMonthly, vMinT1.r, vMinT1.T - vMinT1.t1);
if (Math.abs(rMinT1.savingsDealFV - expectedSavingsT1) > 0.01) {
    console.log('❌ ОШИБКА: Неправильные сбережения при t1=1!');
} else {
    console.log('✅ При t1=1 сбережения рассчитаны правильно');
}
console.log('');

// НАЙДЕНА ОШИБКА 6: Проверим случай T < t1 (недопустимый, но calc не должен крашиться)
console.log('🔍 ПРОВЕРКА 6: Недопустимый случай T < t1');
const vInvalid = { ...testParams(), T: 3, t1: 5 };
const rInvalid = Calc.calculate(vInvalid);

console.log(`T: ${vInvalid.T}, t1: ${vInvalid.t1}`);
console.log(`SavingsDealFV: ${rInvalid.savingsDealFV.toFixed(3)} млн (должно быть 0)`);

if (rInvalid.savingsDealFV !== 0) {
    console.log('❌ ПРОБЛЕМА: При T < t1 должно быть savingsDealFV = 0!');
    console.log('Это может означать ошибку в функции savingsDeal()');
} else {
    console.log('✅ При T < t1 savingsDealFV = 0 (правильно)');
}
console.log('');

// НАЙДЕНА ОШИБКА 7: Проверим досрочное гашение l1
console.log('🔍 ПРОВЕРКА 7: Логика досрочного гашения льготного кредита');
const vEarly = { ...testParams(), repayL1Early: true };
const rEarly = Calc.calculate(vEarly);

console.log(`repayL1Early: ${vEarly.repayL1Early}`);
console.log(`canRepayL1: ${rEarly.canRepayL1}`);
console.log(`S1_t1: ${rEarly.S1_t1.toFixed(2)} млн`);
console.log(`L2: ${rEarly.L2.toFixed(2)} млн`);
console.log(`l1: ${vEarly.l1} млн`);
console.log(`S1_t1 - L2: ${(rEarly.S1_t1 - rEarly.L2).toFixed(2)} млн`);
console.log(`Достаточно для гашения l1? ${(rEarly.S1_t1 - rEarly.L2) >= vEarly.l1}`);

// При досрочном гашении totalPercent должно быть меньше
const rNoEarly = Calc.calculate({ ...vEarly, repayL1Early: false });
if (rEarly.canRepayL1 && rEarly.totalPercent >= rNoEarly.totalPercent) {
    console.log('❌ ПОТЕНЦИАЛЬНАЯ ОШИБКА: При досрочном гашении totalPercent должно быть меньше!');
    console.log(`С досрочным: ${rEarly.totalPercent.toFixed(3)}, без: ${rNoEarly.totalPercent.toFixed(3)}`);
} else {
    console.log('✅ Логика досрочного гашения работает правильно');
}

console.log('\n🎯 ГЛУБОКИЙ АНАЛИЗ ЗАВЕРШЕН');