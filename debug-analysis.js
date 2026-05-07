// Анализ потенциальных ошибок в расчетах
const Calc = require('./js/calc.js');

console.log('🔍 АНАЛИЗ ПОТЕНЦИАЛЬНЫХ ОШИБОК В РАСЧЕТАХ\n');

function testParams() {
    return {
        p0: 50, discount: 20, equity: 15, l1: 12, repair: 0,
        g_new: 0.05, g_old: 0.05, r: 0.14, i1: 0.06, i2: 0.18,
        t1: 2, T: 5, s0: 35, savingsMonthly: 0.4,
        repayL1Early: false,
    };
}

// 1. Проверка случая, когда g_old != g_new
console.log('1. ПРОВЕРКА: разные темпы роста новой и старой квартиры');
const v1 = { ...testParams(), g_new: 0.12, g_old: 0.05 };  // Новая растет быстрее
const r1 = Calc.calculate(v1);

console.log(`g_new=12%, g_old=5%: NPV = ${r1.npvDirect.toFixed(2)} млн`);

// Проверим breakdown вручную
const expectedNewApt = Calc.fv(v1.p0, v1.g_new, v1.T);
const expectedOldSalePrice = Calc.fv(v1.s0, v1.g_old, v1.t1);
console.log(`Новая квартира через ${v1.T} лет: ${expectedNewApt.toFixed(2)} млн (ожидаем ${r1.newAptFinal.toFixed(2)})`);
console.log(`Цена продажи старой через ${v1.t1} года: ${expectedOldSalePrice.toFixed(2)} млн (ожидаем ${r1.S1_t1.toFixed(2)})`);

if (Math.abs(expectedNewApt - r1.newAptFinal) > 0.01) {
    console.log('❌ ОШИБКА: Неправильный расчет цены новой квартиры!');
}
if (Math.abs(expectedOldSalePrice - r1.S1_t1) > 0.01) {
    console.log('❌ ОШИБКА: Неправильный расчет цены продажи старой квартиры!');
}

console.log('');

// 2. Проверка breakdown сценария А - все компоненты должны сходиться
console.log('2. ПРОВЕРКА: breakdown сценария А (WA)');
const v2 = testParams();
const r2 = Calc.calculate(v2);

const manualWA = r2.newAptFinal + r2.leftoverGrowthFV + r2.initialRestFV + r2.savingsDealFV - r2.interestFV;
if (!r2.canRepayL1) {
    // При обычном режиме (не досрочное гашение) нужно вычесть льготный кредит
    const manualWACorrect = r2.newAptFinal - r2.v.l1 + r2.leftoverGrowthFV + r2.initialRestFV + r2.savingsDealFV - r2.interestFV;
    console.log(`Ручной расчет WA: ${manualWACorrect.toFixed(2)} млн`);
    console.log(`calculate() WA:   ${r2.WA.toFixed(2)} млн`);
    
    if (Math.abs(manualWACorrect - r2.WA) > 0.01) {
        console.log('❌ ОШИБКА: Breakdown не сходится с WA!');
        console.log(`Разность: ${(manualWACorrect - r2.WA).toFixed(3)} млн`);
    } else {
        console.log('✅ Breakdown WA сходится');
    }
} else {
    console.log(`Ручной расчет WA (досрочное): ${manualWA.toFixed(2)} млн`);
    console.log(`calculate() WA:               ${r2.WA.toFixed(2)} млн`);
    
    if (Math.abs(manualWA - r2.WA) > 0.01) {
        console.log('❌ ОШИБКА: Breakdown не сходится с WA при досрочном гашении!');
    } else {
        console.log('✅ Breakdown WA сходится');  
    }
}

console.log('');

// 3. Проверка логики процентов
console.log('3. ПРОВЕРКА: расчет будущей стоимости процентных платежей');
let manualInterestFV = 0;
const v3 = testParams();
const r3 = Calc.calculate(v3);

// До t1: платим (I1 + I2)
for (let k = 1; k <= Math.min(v3.T, v3.t1); k++) {
    manualInterestFV += (r3.I1 + r3.I2) * Calc.fv(1, v3.r, v3.T - k);
}
// После t1: платим только I1 (если не досрочное гашение)  
if (!r3.canRepayL1) {
    for (let k = v3.t1 + 1; k <= v3.T; k++) {
        manualInterestFV += r3.I1 * Calc.fv(1, v3.r, v3.T - k);
    }
}

console.log(`Ручной расчет interestFV: ${manualInterestFV.toFixed(3)} млн`);
console.log(`calculate() interestFV:   ${r3.interestFV.toFixed(3)} млн`);

if (Math.abs(manualInterestFV - r3.interestFV) > 0.001) {
    console.log('❌ ОШИБКА: Неправильный расчет будущей стоимости процентов!');
} else {
    console.log('✅ InterestFV рассчитан правильно');
}

console.log('');

// 4. Проверка сбережений в сценарии А
console.log('4. ПРОВЕРКА: сбережения в сценарии А начинаются только после t1');
const v4 = testParams();
const r4 = Calc.calculate(v4);

const expectedSavingsDeal = Calc.fvAnnuityMonthly(v4.savingsMonthly, v4.r, v4.T - v4.t1);
console.log(`Ожидаемые сбережения (T-t1=${v4.T - v4.t1} лет): ${expectedSavingsDeal.toFixed(3)} млн`);
console.log(`calculate() savingsDealFV: ${r4.savingsDealFV.toFixed(3)} млн`);

if (Math.abs(expectedSavingsDeal - r4.savingsDealFV) > 0.001) {
    console.log('❌ ОШИБКА: Неправильный расчет сбережений в сценарии А!');
} else {
    console.log('✅ Сбережения в сценарии А рассчитаны правильно');
}

// Проверка что savings < savingsBase
if (r4.savingsDealFV >= r4.saveFV) {
    console.log('❌ НАРУШЕНИЕ ИНВАРИАНТА: savingsDealFV должно быть < saveFV!');
    console.log(`savingsDealFV: ${r4.savingsDealFV.toFixed(3)}, saveFV: ${r4.saveFV.toFixed(3)}`);
} else {
    console.log('✅ Инвариант savingsDealFV < saveFV соблюден');
}

console.log('');

// 5. Проверка экстремальных случаев
console.log('5. ПРОВЕРКА: экстремальные случаи');

// 5a. Очень высокие ставки
const vHigh = { ...testParams(), i2: 0.50, r: 0.30 }; // 50% по кредиту, 30% по вкладу
const rHigh = Calc.calculate(vHigh);
if (isNaN(rHigh.WA) || isNaN(rHigh.WB) || isNaN(rHigh.npvDirect)) {
    console.log('❌ ОШИБКА: NaN при высоких ставках!');
} else {
    console.log('✅ Высокие ставки обрабатываются корректно');
}

// 5b. t1 = T (продаем в последний год)
const vLast = { ...testParams(), t1: 5, T: 5 };
const rLast = Calc.calculate(vLast);
if (rLast.savingsDealFV !== 0) {
    console.log('❌ ОШИБКА: При t1=T должно быть savingsDealFV = 0!');
    console.log(`Фактически: ${rLast.savingsDealFV}`);
} else {
    console.log('✅ При t1=T сбережения = 0 (правильно)');
}

console.log('\n🎯 АНАЛИЗ ЗАВЕРШЕН');