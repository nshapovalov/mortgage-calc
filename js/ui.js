// UI: считывает DOM, вызывает Calc и Charts, обновляет страницу

(function() {

var INPUT_IDS = ['savingsMonthly', 'p0', 'discount', 'equity', 'l1', 'repair', 'g_new', 'g_old', 'r', 't1', 'T', 's0', 'i2'];

// ─── Объяснения показателей (открываются по кнопке ?) ────────────────────────

var TIPS = {
    base: {
        title: 'Базовый капитал — сценарий «не берём ипотеку»',
        body: 'Итоговая сумма, которая будет у вас через N лет, если НЕ покупать новую квартиру:\n'
            + '• ваши деньги лежат на вкладе под r% годовых\n'
            + '• каждый месяц откладываете сбережения на тот же вклад\n'
            + '• текущая квартира дорожает на g% в год, в конце её продаёте',
        formula: 'W_Б = equity × (1+r)^T\n'
            + '    + s0 × (1+g)^T\n'
            + '    + FV_аннуитет(сбережения/мес, r, T)',
        example: 'При equity=15 млн, r=14%, T=5 лет:\n15 × 1.14⁵ = 28.9 млн\nПлюс квартира, плюс накопленные сбережения.',
    },
    deal: {
        title: 'Капитал по сделке — сценарий «берём ипотеку»',
        body: 'Итоговая сумма, если купить новую квартиру со скидкой и продать старую через t1 лет.\n\n'
            + 'Из чего складывается:\n'
            + '• новая квартира выросла до p0×(1+g)^T минус остаток льготного долга l1\n'
            + '• выручка от продажи старой квартиры в год t1 минус погашение дорогого кредита L2 — остаток на вклад\n'
            + '• минус все проценты, уплаченные банку за весь срок',
        formula: 'W_А = (p0×(1+g)^T − l1)\n'
            + '     + max(0, S1 − L2) × (1+r)^(T−t1)\n'
            + '     − Σₖ %(k) × (1+r)^(T−k)',
        example: 'Квартира 50 млн при росте 5% через 5 лет → 63.8 млн.\nМинус долг 12 млн → 51.8 млн.\nМинус проценты за 5 лет.',
    },
    diff: {
        title: 'Разница ΔW — на сколько сценарии отличаются',
        body: 'Просто вычитаем два финальных капитала: ΔW = W_А − W_Б.\n\n'
            + '• ΔW > 0 (зелёный) → ипотека принесла больше денег к концу срока\n'
            + '• ΔW < 0 (красный) → вклад оказался выгоднее\n\n'
            + 'Это сравнение в «будущих деньгах». Чтобы сравнить в сегодняшних — смотрите NPV.',
        formula: 'ΔW = W_А − W_Б',
        example: 'W_А = 90 млн, W_Б = 105 млн → ΔW = −15 млн.\nЧерез 5 лет по вкладу будет на 15 млн больше.',
    },
    npv: {
        title: 'NPV — выгода в сегодняшних деньгах',
        body: 'NPV (Net Present Value) переводит будущую разницу капиталов в сегодняшние деньги.\n\n'
            + 'Зачем нужен: 15 млн через 5 лет ≠ 15 млн сейчас (при ставке 14% они стоят как 7.8 млн сейчас). NPV делает всё сопоставимым.\n\n'
            + '• NPV > 0 → ипотека выгоднее даже с поправкой на «стоимость денег»\n'
            + '• NPV < 0 → вклад выгоднее\n'
            + '• NPV = 0 → оба сценария одинаковы по доходности',
        formula: 'NPV = ΔW / (1+r)^T\n\nr — ставка вклада (ваша альтернативная доходность)',
        example: 'ΔW = −15 млн, r = 14%, T = 5 лет:\nNPV = −15 / 1.14⁵ = −15 / 1.925 = −7.8 млн\nИпотека «стоит» вам 7.8 млн в сегодняшних деньгах.',
    },
    monthly: {
        title: 'Ежемесячный платёж по дорогому кредиту',
        body: 'Это только процентная часть платежа по рыночному кредиту.\n\n'
            + 'В модели используется схема interest-only (bullet): каждый месяц вы платите только проценты, '
            + 'а тело долга гасится целиком при продаже старой квартиры.\n\n'
            + 'На практике большинство ипотек аннуитетные: платёж выше, но часть уходит на погашение долга. '
            + 'Реальный платёж будет выше указанного, но общая переплата — ниже.',
        formula: 'Платёж/мес = L2 × i2 / 12\n\nL2 — сумма дорогого кредита\ni2 — годовая ставка',
        example: 'L2 = 13 млн, i2 = 18%:\nПлатёж = 13 000 000 × 0.18 / 12 = 195 000 ₽/мес',
    },
    tornado: {
        title: 'График чувствительности NPV к параметрам',
        body: 'Показывает, насколько сильно меняется NPV при изменении каждого параметра на ±20% (или на фиксированный шаг).\n\n'
            + 'Чем длиннее полоса — тем сильнее этот параметр влияет на итог. Это главные рычаги.\n\n'
            + 'Как пользоваться:\n'
            + '1. Найдите самую длинную полосу — это параметр с наибольшей неопределённостью\n'
            + '2. Если правый конец полосы в зелёной зоне (NPV > 0), при оптимистичном сценарии сделка выгодна\n'
            + '3. Если полоса вся в красной зоне — даже оптимистичный прогноз не делает ипотеку выгодной',
        formula: 'Для каждого параметра X:\nNPV_min = пересчёт с X × 0.8\nNPV_max = пересчёт с X × 1.2\n\nПолоса = [NPV_min, NPV_max]',
        example: 'Рост цен g = 5%.\nПри g = 3% (пессимизм): NPV = −12 млн\nПри g = 7% (оптимизм): NPV = +2 млн\nПолоса длиной 14 млн — главный риск-фактор.',
    },
};

function showTip(key) {
    var tip = TIPS[key];
    if (!tip) return;
    var html = '<div class="tip-title">' + tip.title + '</div>'
        + '<div class="tip-body">' + tip.body.replace(/\n/g, '<br>') + '</div>';
    if (tip.formula) html += '<div class="tip-formula">' + tip.formula + '</div>';
    if (tip.example) html += '<div class="tip-example">' + tip.example.replace(/\n/g, '<br>') + '</div>';
    document.getElementById('tipContent').innerHTML = html;
    document.getElementById('tipModal').style.display = 'flex';
}

function initModal() {
    document.getElementById('tipClose').addEventListener('click', function() {
        document.getElementById('tipModal').style.display = 'none';
    });
    document.getElementById('tipModal').addEventListener('click', function(e) {
        if (e.target === this) this.style.display = 'none';
    });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') document.getElementById('tipModal').style.display = 'none';
    });
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('info-btn')) showTip(e.target.dataset.tip);
    });
}

// ─── Вспомогательные ─────────────────────────────────────────────────────────

function getValues() {
    return {
        p0:             +document.getElementById('p0').value,
        discount:       +document.getElementById('discount').value,
        equity:         +document.getElementById('equity').value,
        l1:             +document.getElementById('l1').value,
        repair:         +document.getElementById('repair').value,
        g_new:          +document.getElementById('g_new').value / 100,
        g_old:          +document.getElementById('g_old').value / 100,
        r:              +document.getElementById('r').value / 100,
        t1:             +document.getElementById('t1').value,
        T:              +document.getElementById('T').value,
        s0:             +document.getElementById('s0').value,
        i2:             +document.getElementById('i2').value / 100,
        i1:             0.06,
        repayL1Early:   document.getElementById('repayL1Early').checked,
        savingsMonthly: +document.getElementById('savingsMonthly').value / 1000,
    };
}

function setLabel(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
}

function updateSliderLabels(v) {
    setLabel('p0Val',       v.p0 + ' млн');
    setLabel('discountVal', v.discount + '%');
    setLabel('equityVal',   v.equity + ' млн');
    setLabel('l1Val',       v.l1 + ' млн');
    setLabel('repairVal',   v.repair + ' млн');
    setLabel('g_newVal',    (v.g_new * 100).toFixed(1) + '%');
    setLabel('g_oldVal',    (v.g_old * 100).toFixed(1) + '%');
    setLabel('rVal',        (v.r * 100).toFixed(1) + '%');
    setLabel('t1Val',       v.t1 + ' г');
    setLabel('TVal',        v.T + ' лет');
    setLabel('s0Val',       v.s0 + ' млн');
    setLabel('i2Val',       (v.i2 * 100).toFixed(1) + '%');
    setLabel('savingsVal',  (v.savingsMonthly * 1000).toFixed(0) + ' тыс');
}

function fmt(x, d) { return x.toFixed(d !== undefined ? d : 2); }
function sign(x) { return x >= 0 ? '+' : ''; }
function cls(x)  { return x >= 0 ? 'positive' : 'negative'; }
function ib(key) { return '<button class="info-btn" data-tip="' + key + '">?</button>'; }

// ─── Карточки показателей ─────────────────────────────────────────────────────

function renderStats(res) {
    var v = res.v;

    document.getElementById('statsContainer').innerHTML =
        '<div class="stat-card">'
        + '<div class="label">Базовый капитал ' + ib('base') + '</div>'
        + '<div class="value">' + fmt(res.WB) + ' млн</div></div>'

        + '<div class="stat-card">'
        + '<div class="label">Капитал по сделке ' + ib('deal') + '</div>'
        + '<div class="value">' + fmt(res.WA) + ' млн</div></div>'

        + '<div class="stat-card">'
        + '<div class="label">Разница ΔW ' + ib('diff') + '</div>'
        + '<div class="value ' + cls(res.diff) + '">' + sign(res.diff) + fmt(res.diff) + ' млн</div></div>'

        + '<div class="stat-card">'
        + '<div class="label">NPV ' + ib('npv') + '</div>'
        + '<div class="value ' + cls(res.npvDirect) + '">' + sign(res.npvDirect) + fmt(res.npvDirect) + ' млн</div></div>'

        + '<div class="stat-card">'
        + '<div class="label">Платёж % дорогого / мес ' + ib('monthly') + '</div>'
        + '<div class="value">' + (res.monthlyPay * 1000).toFixed(0) + ' тыс ₽</div></div>';
}

// ─── Вердикт ─────────────────────────────────────────────────────────────────

function renderNPVExplainer(res) {
    var n  = res.npvDirect;
    var el = document.getElementById('npvExplainer');
    if (!el) return;

    var icon    = n >= 0 ? '✓' : '✗';
    var verdict = n >= 0
        ? icon + ' Ипотека выгоднее вклада на <b class="positive">' + fmt(n) + ' млн</b> в деньгах сегодня.'
        : icon + ' Вклад выгоднее ипотеки на <b class="negative">' + fmt(Math.abs(n)) + ' млн</b> в деньгах сегодня.';

    el.innerHTML = verdict;
}

// ─── Сценарий А: ипотека ─────────────────────────────────────────────────────

function renderIntermediate(res) {
    var v   = res.v;
    var fv  = Calc.fv;
    var oldAptSalePrice = fv(v.s0, v.g_old, v.t1);
    var shortfall       = res.L2 > 0 && oldAptSalePrice < res.L2;

    var s1 = '<div class="step-block">'
        + '<div class="step-title">1. Покупка прямо сейчас</div>'
        + '<p>Рыночная цена: <b>' + fmt(v.p0) + ' млн</b></p>'
        + '<p>Скидка ' + v.discount + '% → цена: <b>' + fmt(res.C) + ' млн</b> (экономия ' + fmt(v.p0 - res.C) + ' млн)</p>'
        + (v.repair > 0 ? '<p>+ Ремонт: ' + fmt(v.repair) + ' млн</p>' : '')
        + '<p>Нужно: <b>' + fmt(res.C + v.repair) + ' млн</b></p><hr>'
        + '<p>Своих: ' + fmt(v.equity) + ' млн &nbsp;+&nbsp; Льготный (6%): ' + fmt(v.l1) + ' млн</p>'
        + (res.L2 > 0 ? '<p class="negative">Дорогой кредит ' + (v.i2*100).toFixed(0) + '%: <b>+' + fmt(res.L2) + ' млн</b></p>' : '')
        + (res.F0 > 0 ? '<p>Остаток ' + fmt(res.F0) + ' млн → на вклад</p>' : '')
        + '</div>';

    var monthlyDeficit = res.monthlyPay > v.savingsMonthly;
    var s2 = '<div class="step-block">'
        + '<div class="step-title">2. Первые ' + v.t1 + ' г. — две квартиры</div>'
        + '<p>% льготный: ' + fmt(res.I1) + ' млн/год (' + (res.I1*1000/12).toFixed(0) + ' тыс/мес, только %)</p>'
        + (res.L2 > 0 ? '<p class="negative">% дорогой: ' + fmt(res.I2) + ' млн/год (<b>' + (res.monthlyPay*1000).toFixed(0) + ' тыс/мес, только %</b>) — реальный платёж выше: включает тело долга</p>' : '')
        + (monthlyDeficit ? '<p class="negative">⚠ Дефицит: проценты ' + (res.monthlyPay*1000).toFixed(0) + ' тыс/мес > сбережения ' + (v.savingsMonthly*1000).toFixed(0) + ' тыс/мес</p>' : '')
        + '<p>Старая квартира растёт: ' + fmt(v.s0) + ' → <b>' + fmt(oldAptSalePrice) + ' млн</b></p>'
        + (monthlyDeficit 
            ? '<p>Сбережения: <b>невозможны</b> (весь доход уходит на проценты)</p>'
            : '<p>Откладываете на вклад: <b>' + (v.savingsMonthly*1000).toFixed(0) + ' тыс/мес</b> (остаток после процентов)</p>')
        + '</div>';

    var afterL2 = oldAptSalePrice - res.L2;
    var s3 = '<div class="step-block">'
        + '<div class="step-title">3. Год ' + v.t1 + ' — продаёте старую</div>'
        + '<p>Продаёте за: <b>' + fmt(oldAptSalePrice) + ' млн</b></p>'
        + (res.L2 > 0
            ? '<p>Гасите дорогой кредит: −' + fmt(res.L2) + ' млн</p>'
              + (shortfall
                ? '<p class="negative">⚠ Не хватает ' + fmt(res.L2 - oldAptSalePrice) + ' млн — доп. долг</p>'
                : '')
            : '')
        + (v.repayL1Early && !res.canRepayL1
            ? '<p class="negative">⚠ Досрочное погашение невозможно: нужно ' + fmt(v.l1 + res.L2) + ' млн (льготный + дорогой), выручка только ' + fmt(Math.max(0, res.S1_t1)) + ' млн</p>'
            : '')
        + (res.canRepayL1 && !shortfall
            ? '<p>Гасите льготный кредит: −' + fmt(v.l1) + ' млн</p>'
              + '<p>Остаток на вклад: <b>' + fmt(afterL2 - v.l1) + ' млн</b></p>'
              + '<p>Дальше платёж по кредиту: <b>0</b></p>'
                : (!shortfall && res.L2 > 0
                ? '<p>Остаток на вклад: <b>' + fmt(afterL2) + ' млн</b></p>'
                  + '<p>Дальше платите только: ' + fmt(res.I1) + ' млн/год (только %)</p>'
                : '<p>Дальше платите только: ' + fmt(res.I1) + ' млн/год (только %)</p>'))
        + '</div>';

    var s4 = '<div class="step-block">'
        + '<div class="step-title">4. Итог через ' + v.T + ' лет</div>'
        + '<p>Новая квартира: <b>' + fmt(res.newAptFinal) + ' млн</b></p>'
        + (!res.canRepayL1 ? '<p>Гасите льготный: −' + fmt(v.l1) + ' млн</p>' : '')
        + (res.leftoverAfterSale > 0
            ? '<p>Остаток от продажи старой → вклад (' + v.t1 + ' г. назад): +' + fmt(res.leftoverGrowthFV) + ' млн</p>'
            : (res.leftoverAfterSale < 0
                ? '<p class="negative">Нехватка после продажи (долг растёт по ' + (v.i2*100).toFixed(0) + '%): ' + fmt(res.leftoverGrowthFV) + ' млн</p>'
                : ''))
        + (res.initialRestFV > 0 
            ? '<p>Изначальный остаток на вкладе: +' + fmt(res.initialRestFV) + ' млн</p>'
            : '')
        + '<p>Накопленные сбережения: <b>+' + fmt(res.savingsDealFV) + ' млн</b> (' + (v.savingsMonthly*1000).toFixed(0) + ' тыс/мес × ' + v.T + ' лет)</p>'
        + '<p class="negative">Будущая стоимость % банку: −' + fmt(res.interestFV) + ' млн</p>'
        + '<hr>'
        + '<p><b>Итого (А): ' + fmt(res.WA) + ' млн</b></p>'
        + '<p style="font-size:0.8rem;color:#64748b;">' 
        + fmt(res.newAptFinal) + (res.canRepayL1 ? '' : ' − ' + fmt(v.l1)) 
        + (res.leftoverGrowthFV !== 0 ? (res.leftoverGrowthFV > 0 ? ' + ' : ' − ') + fmt(Math.abs(res.leftoverGrowthFV)) : '')
        + (res.initialRestFV > 0 ? ' + ' + fmt(res.initialRestFV) : '')
        + ' + ' + fmt(res.savingsDealFV) + ' − ' + fmt(res.interestFV) + '</p>'
        + '</div>';

    document.getElementById('intermediateBlock').innerHTML = s1 + s2 + s3 + s4;
}

// ─── Сценарий Б: вклад ───────────────────────────────────────────────────────

function renderBaseIntermediate(res) {
    var v   = res.v;
    var fv  = Calc.fv;
    var fvM = Calc.fvAnnuityMonthly;

    var equityFinal  = fv(v.equity, v.r, v.T);
    var s0Final      = fv(v.s0, v.g_old, v.T);
    var savingsFinal = fvM(v.savingsMonthly, v.r, v.T);
    var midT         = Math.round(v.T / 2);

    var b1 = '<div class="step-block" style="border-left:3px solid #94a3b8;">'
        + '<div class="step-title" style="color:#475569;">1. Деньги сейчас</div>'
        + '<p><b>' + fmt(v.equity) + ' млн</b> → на вклад под <b>' + (v.r*100).toFixed(1) + '%</b></p>'
        + '<p>Квартира <b>' + fmt(v.s0) + ' млн</b> остаётся, растёт ' + (v.g_old*100).toFixed(1) + '%/год</p>'
        + '</div>';

    var b2 = '<div class="step-block" style="border-left:3px solid #94a3b8;">'
        + '<div class="step-title" style="color:#475569;">2. Каждый месяц откладываете</div>'
        + '<p><b>' + (v.savingsMonthly*1000).toFixed(0) + ' тыс/мес</b> → на тот же вклад</p>'
        + '<p>К году ' + midT + ': вклад ~' + fmt(fv(v.equity, v.r, midT)) + ' млн, сбережения ~' + fmt(fvM(v.savingsMonthly, v.r, midT)) + ' млн</p>'
        + '</div>';

    var b3 = '<div class="step-block" style="border-left:3px solid #94a3b8;">'
        + '<div class="step-title" style="color:#475569;">3. Квартира дорожает</div>'
        + '<p>' + fmt(v.s0) + ' × (1+' + (v.g_old*100).toFixed(1) + '%)^' + v.T + ' = <b>' + fmt(s0Final) + ' млн</b></p>'
        + '</div>';

    var b4 = '<div class="step-block" style="border-left:3px solid #94a3b8;">'
        + '<div class="step-title" style="color:#475569;">4. Итог через ' + v.T + ' лет</div>'
        + '<p>Вклад (equity): ' + fmt(v.equity) + ' → <b>' + fmt(equityFinal) + ' млн</b></p>'
        + '<p>Сбережения за ' + v.T + ' лет: <b>' + fmt(savingsFinal) + ' млн</b></p>'
        + '<p>Квартира выросла: <b>' + fmt(s0Final) + ' млн</b></p><hr>'
        + '<p><b>Итого (Б): ' + fmt(res.WB) + ' млн</b></p>'
        + '<p style="font-size:0.8rem;color:#64748b;">' + fmt(equityFinal) + ' + ' + fmt(savingsFinal) + ' + ' + fmt(s0Final) + '</p>'
        + '</div>';

    document.getElementById('baseBlock').innerHTML = b1 + b2 + b3 + b4;
}

// ─── Прочие рендеры ───────────────────────────────────────────────────────────

function renderSavingsImpact(res) {
    var v = res.v;
    document.getElementById('savingsImpact').innerHTML =
        '<b>Сбережения ' + (v.savingsMonthly*1000).toFixed(0) + ' тыс/мес учтены в обоих сценариях.</b>'
        + ' В базовом за ' + v.T + ' лет: <b>' + fmt(res.saveFV) + ' млн</b>.'
        + ' В сделке: <b>' + fmt(res.savingsDealFV) + ' млн</b>.<br>'
        + 'Процентов банку за весь срок: <b>' + fmt(res.totalPercent) + ' млн</b>.';
}

function buildTornadoData(v) {
    var params = [
        { key: 'g_new',         label: 'Рост новой квартиры', delta: 0.02 },
        { key: 'g_old',         label: 'Рост старой квартиры',delta: 0.02 },
        { key: 'r',             label: 'Ставка вклада',        delta: 0.02 },
        { key: 't1',            label: 'Срок продажи старой', delta: 1, round: true },
        { key: 'repair',        label: 'Ремонт',               pct: 0.3 },
        { key: 'discount',      label: 'Скидка',               delta: 0.03 },
        { key: 'savingsMonthly',label: 'Сбережения/мес',       pct: 0.3 },
    ];
    var data = params.map(function(p) {
        var base = v[p.key];
        var lo = p.delta !== undefined ? base - p.delta : base * (1 - p.pct);
        var hi = p.delta !== undefined ? base + p.delta : base * (1 + p.pct);
        if (p.round) { lo = Math.max(1, Math.round(lo)); hi = Math.round(hi); }
        if (p.key === 'g' || p.key === 'r' || p.key === 'discount') lo = Math.max(0, lo);
        var ov = {}; ov[p.key] = lo;
        var nLo = Calc.computeSensNPV(ov, v);
        ov[p.key] = hi;
        var nHi = Calc.computeSensNPV(ov, v);
        return { label: p.label, min: Math.min(nLo, nHi), max: Math.max(nLo, nHi) };
    });
    return data.sort(function(a, b) { return (b.max - b.min) - (a.max - a.min); });
}

// ─── Главный цикл ─────────────────────────────────────────────────────────────

function updateAffordabilityCheck(res) {
    var v = res.v;
    var maxMonthlyPayment = v.savingsMonthly;  // максимальный ежемесячный платеж = доходу
    var maxAnnualPercent = maxMonthlyPayment * 12;  // максимальный годовой процент

    // Рассчитаем максимальные кредиты при текущих ставках
    var maxL1 = Math.min(25, maxAnnualPercent / v.i1);  // ограничено ползунком
    var remainingPercent = Math.max(0, maxAnnualPercent - maxL1 * v.i1);
    var maxL2 = remainingPercent / v.i2;

    // Максимальная сумма покупки
    var maxTotal = v.equity + maxL1 + maxL2 + v.repair;
    var maxP0 = maxTotal / (1 - v.discount/100);

    // Текущий расчет: полный ежемесячный процент = льготный + дорогой
    var currentMonthlyPercent = (res.I1 + res.I2) / 12;
    var isAffordable = currentMonthlyPercent <= v.savingsMonthly;
    
    // Подсветка проблемных ползунков красным
    var problemSliders = [];
    if (v.l1 > maxL1) problemSliders.push('l1');
    if (res.L2 > maxL2) problemSliders.push('p0', 'discount', 'equity', 'repair');
    
    // Сброс стилей всех ползунков
    ['p0', 'discount', 'equity', 'l1', 'repair'].forEach(function(id) {
        var slider = document.getElementById(id);
        if (slider) {
            if (problemSliders.indexOf(id) >= 0) {
                slider.style.accentColor = '#dc3545';
                slider.parentElement.style.backgroundColor = 'rgba(220, 53, 69, 0.1)';
                slider.parentElement.style.borderRadius = '6px';
                slider.parentElement.style.padding = '8px';
            } else {
                slider.style.accentColor = '';
                slider.parentElement.style.backgroundColor = '';
                slider.parentElement.style.borderRadius = '';
                slider.parentElement.style.padding = '';
            }
        }
    });
    
    var resultDiv = document.getElementById('affordabilityResult');
    if (isAffordable) {
        resultDiv.innerHTML = 
            '<div style="color: #28a745; font-weight: bold;">✅ Кредит доступен</div>' +
            '<div style="font-size: 0.9em; margin-top: 5px;">' +
            'Ежемесячный платеж: <b>' + (currentMonthlyPercent * 1000).toFixed(0) + ' тыс</b> из ' + (v.savingsMonthly * 1000).toFixed(0) + ' тыс доступных<br>' +
            'Запас: <b>' + ((v.savingsMonthly - currentMonthlyPercent) * 1000).toFixed(0) + ' тыс/мес</b>' +
            '</div>';
        resultDiv.style.backgroundColor = '#d4edda';
        resultDiv.style.border = '1px solid #c3e6cb';
    } else {
        var deficit = currentMonthlyPercent - v.savingsMonthly;
        resultDiv.innerHTML = 
            '<div style="color: #dc3545; font-weight: bold;">❌ Кредит недоступен</div>' +
            '<div style="font-size: 0.9em; margin-top: 5px;">' +
            'Нужно: <b>' + (currentMonthlyPercent * 1000).toFixed(0) + ' тыс/мес</b>, есть: <b>' + (v.savingsMonthly * 1000).toFixed(0) + ' тыс</b><br>' +
            'Дефицит: <b>' + (deficit * 1000).toFixed(0) + ' тыс/мес</b><br>' +
            '<div style="margin-top: 8px; color: #6c757d;">💡 Максимальная квартира при текущем доходе: <b>' + maxP0.toFixed(1) + ' млн</b></div>' +
            '</div>';
        resultDiv.style.backgroundColor = '#f8d7da';
        resultDiv.style.border = '1px solid #f5c6cb';
    }
}

function updateUI() {
    var v   = getValues();
    var res = Calc.calculate(v);

    updateSliderLabels(v);
    updateAffordabilityCheck(res);

    // Обновляем динамические заголовки
    var h = document.getElementById('chartFinalTitle');
    if (h) h.textContent = 'Итоговый капитал через ' + v.T + ' лет';

    renderStats(res);
    renderNPVExplainer(res);
    renderIntermediate(res);
    renderBaseIntermediate(res);
    renderSavingsImpact(res);

    var warning = document.getElementById('warningMessage');
    if (res.L2 > 0 && Calc.fv(v.s0, v.g_old, v.t1) < res.L2) {
        warning.style.display = 'block';
        warning.textContent = '⚠ Выручка от продажи квартиры через ' + v.t1 + ' лет ('
            + fmt(Calc.fv(v.s0, v.g_old, v.t1)) + ' млн) < долга ('
            + fmt(res.L2) + ' млн). Нехватка учтена через повышенную ставку.';
    } else {
        warning.style.display = 'none';
    }

    Charts.updateCharts(res, buildTornadoData(v));
}

INPUT_IDS.forEach(function(id) {
    document.getElementById(id).addEventListener('input', updateUI);
});
document.getElementById('repayL1Early').addEventListener('change', updateUI);

initModal();
Charts.initCharts();
updateUI();

})();
