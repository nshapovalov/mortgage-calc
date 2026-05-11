(function() {

var INV_INPUTS = ['inv_equity', 'inv_savings', 'inv_T', 'inv_price', 'inv_loanTerm', 'inv_rateMortgage', 'inv_growth', 'inv_depRate', 'inv_cbRate'];

var INV_TIPS = {
    inv_growth: {
        title: 'Прогноз роста стоимости новостройки',
        body: 'Цены на новостройки не растут вечно. Исторически (до 2020) они росли на уровне инфляции, в период льготной ипотеки — быстрее.\n\n' +
              'Прогноз:\n' +
              '• В период стройки (1-2 года) цена растёт по мере готовности дома (~5-8% в год).\n' +
              '• После сдачи возможен скачок (премия за ключи).\n' +
              '• Но при высокой ключевой ставке и отмене массовой льготной ипотеки, спрос охлаждается. Застройщики могут давать скрытые скидки, а вторичный рынок стагнировать.\n\n' +
              'Закладывать рост 15-20% годовых сейчас — крайне оптимистичный и рискованный сценарий. Реалистичный: 5-8% в год.'
    },
    inv_depRate: {
        title: 'Средняя ставка по вкладу',
        body: 'Какую ставку использовать на горизонте 2-3 лет?\n\n' +
              '• Сейчас ЦБ держит ставку высокой (например, 14.5 - 16%), банки дают 13-15%.\n' +
              '• По прогнозам ЦБ, в ближайшие годы ставка будет постепенно снижаться (таргет по инфляции 4%).\n' +
              '• Если горизонт 3 года, то средняя ставка может составить 10-12% годовых. Можно зафиксировать её, купив ОФЗ или открыв длинные вклады.\n\n' +
              'Рекомендация: используйте 10-12% для среднесрочного планирования, а не пиковые 15%.'
    }
};

function showInvTip(key) {
    var tip = INV_TIPS[key];
    if (!tip) return;
    var html = '<div class="tip-title">' + tip.title + '</div>'
        + '<div class="tip-body">' + tip.body.replace(/\n/g, '<br>') + '</div>';
    document.getElementById('tipContent').innerHTML = html;
    document.getElementById('tipModal').style.display = 'flex';
}

function getInvValues() {
    return {
        equity:       +document.getElementById('inv_equity').value * 1000000,
        savings:      +document.getElementById('inv_savings').value * 1000,
        T:            +document.getElementById('inv_T').value,
        price:        +document.getElementById('inv_price').value * 1000000,
        loanTerm:     +document.getElementById('inv_loanTerm').value,
        rateMortgage: +document.getElementById('inv_rateMortgage').value / 100,
        growth:       +document.getElementById('inv_growth').value / 100,
        depRate:      +document.getElementById('inv_depRate').value / 100,
        cbRate:       +document.getElementById('inv_cbRate').value / 100
    };
}

function setL(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
}

function updateInvLabels(v) {
    setL('inv_equityVal', (v.equity / 1000000).toFixed(1) + ' млн');
    setL('inv_savingsVal', (v.savings / 1000).toFixed(0) + ' тыс');
    setL('inv_TVal', v.T + ' лет');
    setL('inv_priceVal', (v.price / 1000000).toFixed(1) + ' млн');
    setL('inv_loanTermVal', v.loanTerm + ' лет');
    setL('inv_rateMortgageVal', (v.rateMortgage * 100).toFixed(1) + '%');
    setL('inv_growthVal', (v.growth * 100).toFixed(1) + '%');
    setL('inv_depRateVal', (v.depRate * 100).toFixed(1) + '%');
    setL('inv_cbRateVal', (v.cbRate * 100).toFixed(1) + '%');
}

function fmt(x) { return (x / 1000000).toFixed(2); }
function sign(x) { return x >= 0 ? '+' : ''; }
function cls(x) { return x >= 0 ? 'positive' : 'negative'; }

function updateInvUI() {
    var v = getInvValues();
    var res = CalcInvest.calculateInvest(v);
    updateInvLabels(v);

    // Stats
    document.getElementById('inv_statsContainer').innerHTML = 
        '<div class="stat-card">' +
        '<div class="label">Капитал (Вклад)</div>' +
        '<div class="value">' + fmt(res.W1) + ' млн</div></div>' +
        '<div class="stat-card">' +
        '<div class="label">Капитал (Ипотека)</div>' +
        '<div class="value">' + fmt(res.W2) + ' млн</div></div>' +
        '<div class="stat-card">' +
        '<div class="label">Разница (ΔW)</div>' +
        '<div class="value ' + cls(res.diff) + '">' + sign(res.diff) + fmt(res.diff) + ' млн</div></div>' +
        '<div class="stat-card">' +
        '<div class="label">Платёж по ипотеке</div>' +
        '<div class="value">' + (res.pmt > 0 ? (res.pmt / 1000).toFixed(1) + ' тыс ₽' : '0') + '</div></div>' +
        '<div class="stat-card">' +
        '<div class="label">IRR (Вклад / Ипотека)</div>' +
        '<div class="value" style="font-size:1.1rem;">~' + (res.irr1*100).toFixed(1) + '% / ~' + (res.irr2*100).toFixed(1) + '%</div></div>';

    // Explainer
    var el = document.getElementById('inv_npvExplainer');
    if (res.npvDirect >= 0) {
        el.innerHTML = '✓ <b>Ипотека выгоднее</b> вклада на <b class="positive">' + fmt(res.npvDirect) + ' млн</b> (в сегодняшних деньгах).';
        el.style.borderLeftColor = '#10b981';
        el.style.backgroundColor = '#f0fdf4';
    } else {
        el.innerHTML = '✗ <b>Вклад выгоднее</b> ипотеки на <b class="negative">' + fmt(Math.abs(res.npvDirect)) + ' млн</b> (в сегодняшних деньгах).';
        el.style.borderLeftColor = '#ef4444';
        el.style.backgroundColor = '#fef2f2';
    }

    // Base block
    var tax1Str = '<div style="color: #b91c1c; background: #fee2e2; padding: 6px 10px; border-radius: 6px; margin: 8px 0;">' +
                  '<b>Суммарный налог на прибыль по вкладу: ' + fmt(res.tax1_total) + ' млн ₽</b>' +
                  '</div>';

    document.getElementById('inv_baseBlock').innerHTML = 
        '<div class="step-block"><div class="step-title">Рост депозита</div>' +
        '<p>Начальный взнос: <b>' + fmt(v.equity) + ' млн</b></p>' +
        '<p>Пополнения: <b>' + (v.savings / 1000).toFixed(0) + ' тыс / мес</b></p>' +
        tax1Str +
        '<hr><p><b>Итог на руках: ' + fmt(res.W1) + ' млн ₽</b></p></div>';

    // Deal block
    var dep2 = res.yearly[v.T - 1] ? res.yearly[v.T - 1].dep2 : 0;
    var dep2Str = dep2 >= 0 
        ? '<p>Накопления (сдача от платежей): <b>+' + fmt(dep2) + ' млн</b></p>' 
        : '<p>Нехватка сбережений (долг): <b class="negative">' + fmt(dep2) + ' млн</b></p>';

    var total_tax2 = res.taxSell + res.tax2_total;
    var tax2Str = '<div style="color: #b91c1c; background: #fee2e2; padding: 6px 10px; border-radius: 6px; margin: 8px 0;">' +
                  '<b>Суммарные налоги: ' + fmt(total_tax2) + ' млн ₽</b>' +
                  '<div style="font-size: 0.8rem; margin-top: 2px;">(Налог с продажи ' + fmt(res.taxSell) + ' млн' +
                  (res.tax2_total > 0 ? ' + налог по вкладу ' + fmt(res.tax2_total) + ' млн' : '') +
                  ')</div></div>';

    document.getElementById('inv_dealBlock').innerHTML = 
        '<div class="step-block"><div class="step-title">Продажа через ' + v.T + ' лет</div>' +
        '<p>Цена продажи: <b>' + fmt(res.sellPrice) + ' млн</b></p>' +
        '<p>Остаток долга: <b class="negative">−' + fmt(res.yearly[v.T - 1] ? res.yearly[v.T - 1].debt2 : 0) + ' млн</b></p>' +
        dep2Str +
        tax2Str +
        '<hr>' +
        '<p style="font-size: 0.82rem; color: #64748b; margin-bottom: 6px;">Справочно: за этот срок банку уплачено процентов на ' + fmt(res.total_interest_paid) + ' млн ₽</p>' +
        '<p><b>Итог на руках: ' + fmt(res.W2) + ' млн ₽</b></p></div>';

    // Chart
    var years = Array.from({length: v.T + 1}, function(_,i){return i;});
    if (!window.invNetChart) {
        var ctx = document.getElementById('inv_chartNetWorth').getContext('2d');
        window.invNetChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: years.map(function(y) { return 'Год ' + y; }),
                datasets: [
                    { label: 'Вклад', data: [], borderColor: '#94a3b8', backgroundColor: 'rgba(148,163,184,0.1)', fill: true },
                    { label: 'Ипотека + Переуступка', data: [], borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.1)', fill: true }
                ]
            },
            options: { responsive: true, scales: { y: { title: { display: true, text: 'млн ₽' } } } }
        });
    }
    
    window.invNetChart.data.labels = years.map(function(y) { return 'Год ' + y; });
    
    // W1_t = dep1_t
    var w1_data = years.map(function(t) { return t === 0 ? v.equity : res.yearly[t-1].dep1; });
    
    // W2_t = price2_t - debt2_t + dep2_t - virtual tax at year t
    var w2_data = years.map(function(t) { 
        if (t === 0) return v.equity; 
        var y = res.yearly[t-1];
        var tax = Math.max(0, y.price2 - v.price) * 0.13;
        return y.price2 - y.debt2 + y.dep2 - tax;
    });

    window.invNetChart.data.datasets[0].data = w1_data.map(function(x){return x/1000000;});
    window.invNetChart.data.datasets[1].data = w2_data.map(function(x){return x/1000000;});
    window.invNetChart.update();
}

INV_INPUTS.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', updateInvUI);
});

document.addEventListener('click', function(e) {
    if (e.target.classList.contains('info-btn') && e.target.dataset.tip.startsWith('inv_')) {
        showInvTip(e.target.dataset.tip);
    }
});

updateInvUI();

})();