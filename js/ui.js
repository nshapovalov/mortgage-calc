// UI: считывает DOM, вызывает Calc и Charts, обновляет страницу

(function() {

var INPUT_IDS = ['savingsMonthly', 'p0', 'discount', 'equity', 'l1', 'repair', 'g_new', 'g_old', 'r', 't1', 'T', 's0', 'i2', 'loanTerm'];

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
            + '• новая квартира выросла до p0×(1+g)^T\n'
            + '• выручка от продажи старой квартиры пошла на вклад и погашение долгов\n'
            + '• минус остаток долга на конец срока\n'
            + '• плюс накопления на вкладе за вычетом ежемесячных аннуитетных платежей',
        example: 'Квартира 50 млн при росте 5% через 5 лет → 63.8 млн.\nМинус остаток долга 10 млн → 53.8 млн.\nПлюс накопленный вклад.',
    },
    diff: {
        title: 'Разница ΔW — на сколько сценарии отличаются',
        body: 'Просто вычитаем два финальных капитала: ΔW = W_А − W_Б.\n\n'
            + '• ΔW > 0 (зелёный) → ипотека принесла больше денег к концу срока\n'
            + '• ΔW < 0 (красный) → вклад оказался выгоднее\n\n'
            + 'Это сравнение в «будущих деньгах». Чтобы сравнить в сегодняшних — смотрите PV(Δ богатства).',
        formula: 'ΔW = W_А − W_Б',
        example: 'W_А = 90 млн, W_Б = 105 млн → ΔW = −15 млн.\nЧерез 5 лет по вкладу будет на 15 млн больше.',
    },
    npv: {
        title: 'PV(Δ богатства) — не классический NPV',
        body: 'Это приведённая к сегодняшнему дню разница терминальных капиталов: ΔW / (1+r)^T. '
            + 'Не дисконированные потоки по годам (DCF), а одна скидка всей ΔW к горизонту T.\n\n'
            + 'Зачем нужен: 15 млн через 5 лет ≠ 15 млн сейчас (при ставке 14% они стоят как ~7.8 млн сейчас).\n\n'
            + '• PV(Δ) > 0 → ипотека выгоднее в этой метрике\n'
            + '• PV(Δ) < 0 → вклад выгоднее\n'
            + '• PV(Δ) = 0 → одинаково',
        formula: 'PV(Δ богатства) = ΔW / (1+r)^T,  где ΔW = W_А − W_Б\n\nr — ставка вклада (альтернативная доходность)',
        example: 'ΔW = −15 млн, r = 14%, T = 5 лет:\nPV(Δ) = −15 / 1.14⁵ ≈ −7.8 млн в «сегодняшних» деньгах.',
    },
    monthly: {
        title: 'Ежемесячный аннуитетный платёж',
        body: 'Суммарный платёж по всем кредитам (льготному и дорогому).\n\n'
            + 'Рассчитан по формуле классического аннуитета на указанный срок ипотеки (по умолчанию 20 лет). '
            + 'Платёж включает в себя и проценты, и выплату тела долга. Эти деньги каждый месяц берутся из вашего '
            + 'бюджета на сбережения (остаток идёт на вклад, если бюджет больше платежа; если меньше — вклад тает).',
        formula: 'Платёж/мес = L × rm / (1 - (1+rm)^(-N))',
        example: 'L = 12 млн, i = 6%, срок = 20 лет (240 мес):\nПлатёж = 85 971 ₽/мес',
    },
    tornado: {
        title: 'График чувствительности PV(Δ богатства) к параметрам',
        body: 'Показывает, насколько сильно меняется PV(Δ богатства) при изменении каждого параметра на ±20% (или на фиксированный шаг).\n\n'
            + 'Чем длиннее полоса — тем сильнее этот параметр влияет на итог. Это главные рычаги.\n\n'
            + 'Как пользоваться:\n'
            + '1. Найдите самую длинную полосу — это параметр с наибольшей неопределённостью\n'
            + '2. Если правый конец полосы в зелёной зоне (PV(Δ) > 0), при оптимистичном сценарии сделка выгодна\n'
            + '3. Если полоса вся в красной зоне — даже оптимистичный прогноз не делает ипотеку выгодной',
        formula: 'Для каждого параметра X:\nPV_min = пересчёт с X на нижней границе\nPV_max = пересчёт с X на верхней границе\n\nПолоса = [PV_min, PV_max]',
        example: 'Рост цен g = 5%.\nПессимизм / оптимизм по g меняет PV(Δ) — длина полосы показывает чувствительность.',
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
        loanTerm:       +document.getElementById('loanTerm').value,
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
    setLabel('loanTermVal', v.loanTerm + ' лет');
}

function fmt(x, d) { return x.toFixed(d !== undefined ? d : 2); }
function sign(x) { return x >= 0 ? '+' : ''; }
function cls(x)  { return x >= 0 ? 'positive' : 'negative'; }
function ib(key) { return '<button class="info-btn" data-tip="' + key + '">?</button>'; }

// ─── Карточки показателей ─────────────────────────────────────────────────────

function renderStats(res) {
    var v = res.v;
    var monthlyPay = res.pmt1 + res.pmt2;

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
        + '<div class="label">PV(Δ богатства) ' + ib('npv') + '</div>'
        + '<div class="value ' + cls(res.npvDirect) + '">' + sign(res.npvDirect) + fmt(res.npvDirect) + ' млн</div></div>'

        + '<div class="stat-card">'
        + '<div class="label">Платёж по кредитам / мес ' + ib('monthly') + '</div>'
        + '<div class="value">' + (monthlyPay * 1000).toFixed(0) + ' тыс ₽</div></div>';
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
    var v = res.v;
    var s1 = '<div class="step-block">'
        + '<div class="step-title">1. Покупка (Сводка)</div>'
        + '<p>Цена со скидкой + ремонт: <b>' + fmt(res.C + v.repair) + ' млн</b></p>'
        + '<p>Свои (' + fmt(v.equity) + ') + Льготный (' + fmt(v.l1) + ')' + (res.L2 > 0 ? ' + Дорогой (' + fmt(res.L2) + ')' : '') + '</p>'
        + '<p>Платёж: <b>' + ((res.pmt1 + res.pmt2) * 1000).toFixed(0) + ' тыс/мес</b> (списывается из сбережений)</p>'
        + '</div>';

    var s2 = '<div class="step-block">'
        + '<div class="step-title">2. Продажа старой квартиры</div>'
        + '<p>Год продажи: <b>' + v.t1 + '</b></p>'
        + '<p>Выручка: <b>' + fmt(res.S1_t1) + ' млн</b></p>'
        + '<p>Остаток рыночного долга гасится.</p>'
        + (res.wasL1RepaidEarly ? '<p>Льготный долг гасится досрочно.</p>' : '')
        + '<p>Разница переходит на вклад.</p>'
        + '</div>';

    var s3 = '<div class="step-block">'
        + '<div class="step-title">3. Итог через ' + v.T + ' лет</div>'
        + '<p>Новая квартира: <b>' + fmt(res.yearly[v.T - 1].A_apt_new) + ' млн</b></p>'
        + '<p>Остаток долга: <b class="negative">−' + fmt(res.yearly[v.T - 1].A_debt_l1 + res.yearly[v.T - 1].A_debt_L2) + ' млн</b></p>'
        + '<p>Вклад (с учётом сбережений): <b>+' + fmt(res.yearly[v.T - 1].A_dep) + ' млн</b></p>'
        + '<hr>'
        + '<p><b>Итого (А): ' + fmt(res.WA) + ' млн</b></p>'
        + '</div>';

    document.getElementById('intermediateBlock').innerHTML = s1 + s2 + s3;
}

// ─── Сценарий Б: вклад ───────────────────────────────────────────────────────

function renderBaseIntermediate(res) {
    var v = res.v;
    var b1 = '<div class="step-block" style="border-left:3px solid #94a3b8;">'
        + '<div class="step-title" style="color:#475569;">1. Без покупки (Сводка)</div>'
        + '<p>Свои деньги (' + fmt(v.equity) + ' млн) идут на вклад под ' + (v.r*100).toFixed(1) + '%.</p>'
        + '<p>Квартира (' + fmt(v.s0) + ' млн) остаётся и дорожает.</p>'
        + '<p>Сбережения (' + (v.savingsMonthly*1000).toFixed(0) + ' тыс/мес) идут на вклад.</p>'
        + '</div>';

    var b2 = '<div class="step-block" style="border-left:3px solid #94a3b8;">'
        + '<div class="step-title" style="color:#475569;">2. Итог через ' + v.T + ' лет</div>'
        + '<p>Старая квартира: <b>' + fmt(res.yearly[v.T - 1].B_apt_old) + ' млн</b></p>'
        + '<p>Размер вклада: <b>' + fmt(res.yearly[v.T - 1].B_dep) + ' млн</b></p>'
        + '<hr>'
        + '<p><b>Итого (Б): ' + fmt(res.WB) + ' млн</b></p>'
        + '</div>';

    document.getElementById('baseBlock').innerHTML = b1 + b2;
}

function renderYearlyTable(res) {
    var html = '<h3 style="margin:30px 0 12px; font-size:1.2rem; color:#0f172a;">Детализация по годам (млн ₽)</h3>'
        + '<div style="overflow-x:auto;">'
        + '<table class="yearly-table">'
        + '<thead>'
        + '<tr>'
        + '<th>Год</th>'
        + '<th colspan="5" style="border-right: 2px solid #e2e8f0; text-align: center;">Сценарий А (Ипотека)</th>'
        + '<th colspan="3" style="text-align: center;">Сценарий Б (Вклад)</th>'
        + '</tr>'
        + '<tr>'
        + '<th style="text-align: center;">#</th>'
        + '<th style="text-align: right;">Недвижимость</th>'
        + '<th style="text-align: right;">Остаток долга</th>'
        + '<th style="text-align: right;">Размер вклада</th>'
        + '<th style="text-align: right;">Платежи банку</th>'
        + '<th style="border-right: 2px solid #e2e8f0; text-align: right;">Капитал</th>'
        + '<th style="text-align: right;">Недвижимость</th>'
        + '<th style="text-align: right;">Размер вклада</th>'
        + '<th style="text-align: right;">Капитал</th>'
        + '</tr>'
        + '</thead><tbody>';

    res.yearly.forEach(function(y) {
        var a_realty = y.A_apt_new + y.A_apt_old;
        var a_debt = y.A_debt_l1 + y.A_debt_L2;
        var a_payment = y.A_prin + y.A_int;

        html += '<tr>'
            + '<td style="text-align: center;"><b>' + y.year + '</b></td>'
            + '<td>' + fmt(a_realty) + '</td>'
            + '<td class="' + (a_debt > 0 ? 'negative' : '') + '">' + (a_debt > 0 ? '−' + fmt(a_debt) : '0') + '</td>'
            + '<td>' + fmt(y.A_dep) + '</td>'
            + '<td class="' + (a_payment > 0 ? 'negative' : '') + '">'
            + (a_payment > 0 ? '−' + fmt(a_payment) + '<br><span style="font-size:0.75rem;color:#94a3b8;">(тело ' + fmt(y.A_prin) + ' / % ' + fmt(y.A_int) + ')</span>' : '0')
            + '</td>'
            + '<td style="font-weight:700; color:#1e40af; border-right: 2px solid #e2e8f0;">' + fmt(y.A_NW) + '</td>'
            + '<td>' + fmt(y.B_apt_old) + '</td>'
            + '<td>' + fmt(y.B_dep) + '</td>'
            + '<td style="font-weight:700; color:#475569;">' + fmt(y.B_NW) + '</td>'
            + '</tr>';
    });

    html += '<tr style="background-color: #f8fafc; font-weight: 700;">'
        + '<td style="text-align: center;">Итого</td>'
        + '<td colspan="3" style="text-align: right;">Уплачено процентов за ' + res.v.T + ' лет:</td>'
        + '<td class="negative">−' + fmt(res.totalPercent) + '</td>'
        + '<td colspan="4"></td>'
        + '</tr>';

    html += '</tbody></table></div>';
    
    var container = document.getElementById('yearlyTableContainer');
    if (container) container.innerHTML = html;
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
        if (p.key === 'g_new' || p.key === 'g_old' || p.key === 'r' || p.key === 'discount') lo = Math.max(0, lo);
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
    var currentMonthlyPercent = res.pmt1 + res.pmt2;
    var isAffordable = currentMonthlyPercent <= v.savingsMonthly;
    
    var resultDiv = document.getElementById('affordabilityResult');
    if (!resultDiv) return;

    if (isAffordable) {
        resultDiv.innerHTML = 
            '<div style="color: #28a745; font-weight: bold;">✅ Кредит доступен</div>' +
            '<div style="font-size: 0.9em; margin-top: 5px;">' +
            'Ежемесячный платеж: <b>' + (currentMonthlyPercent * 1000).toFixed(0) + ' тыс</b> из ' + (v.savingsMonthly * 1000).toFixed(0) + ' тыс доступных<br>' +
            'В запас (на вклад): <b>' + ((v.savingsMonthly - currentMonthlyPercent) * 1000).toFixed(0) + ' тыс/мес</b>' +
            '</div>';
        resultDiv.style.backgroundColor = '#d4edda';
        resultDiv.style.border = '1px solid #c3e6cb';
    } else {
        var deficit = currentMonthlyPercent - v.savingsMonthly;
        resultDiv.innerHTML = 
            '<div style="color: #dc3545; font-weight: bold;">❌ Кредит недоступен (вклад будет проедаться)</div>' +
            '<div style="font-size: 0.9em; margin-top: 5px;">' +
            'Платёж: <b>' + (currentMonthlyPercent * 1000).toFixed(0) + ' тыс/мес</b>, доход: <b>' + (v.savingsMonthly * 1000).toFixed(0) + ' тыс</b><br>' +
            'Дефицит: <b>' + (deficit * 1000).toFixed(0) + ' тыс/мес</b>' +
            '</div>';
        resultDiv.style.backgroundColor = '#f8d7da';
        resultDiv.style.border = '1px solid #f5c6cb';
    }
}

function updateUI() {
    // Физическое ограничение: t1 < T (нельзя продать квартиру после горизонта)
    var t1El = document.getElementById('t1');
    var TEl  = document.getElementById('T');
    if (t1El && TEl) {
        t1El.max = +TEl.value - 1;
        if (+t1El.value >= +TEl.value) t1El.value = +TEl.value - 1;
        TEl.min  = +t1El.value + 1;
        if (+TEl.value <= +t1El.value) TEl.value = +t1El.value + 1;
    }

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
    renderYearlyTable(res);

    var warning = document.getElementById('warningMessage');
    if (warning) {
        if (res.L2 > 0 && Calc.fv(v.s0, v.g_old, v.t1) < res.L2) {
            warning.style.display = 'block';
            warning.textContent = '⚠ Выручка от продажи квартиры через ' + v.t1 + ' лет ('
                + fmt(Calc.fv(v.s0, v.g_old, v.t1)) + ' млн) < остатка рыночного долга. Нехватка учтена в отрицательном балансе вклада.';
        } else {
            warning.style.display = 'none';
        }
    }

    if (window.Charts) {
        Charts.updateCharts(res, buildTornadoData(v));
    }
}

INPUT_IDS.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', updateUI);
});
var repayCheck = document.getElementById('repayL1Early');
if (repayCheck) repayCheck.addEventListener('change', updateUI);

initModal();
if (window.Charts) Charts.initCharts();
updateUI();

})();
