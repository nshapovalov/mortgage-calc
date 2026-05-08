// Инициализация и обновление графиков — Chart.js подключён как CDN глобальный

(function(global) {

function initCharts() {
    global.netChart = new Chart(document.getElementById('chartNetWorth'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Сделка (ипотека)',
                    data: [],
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37,99,235,0.1)',
                    fill: true,
                    tension: 0.2,
                },
                {
                    label: 'База (вклад + квартира)',
                    data: [],
                    borderColor: '#94a3b8',
                    backgroundColor: 'rgba(148,163,184,0.1)',
                    fill: true,
                    tension: 0.2,
                },
            ],
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'top' } },
            scales: { y: { title: { display: true, text: 'млн ₽' } } },
        },
    });

    global.finalChart = new Chart(document.getElementById('chartFinal'), {
        type: 'bar',
        data: {
            labels: ['База', 'Сделка'],
            datasets: [{
                data: [0, 0],
                backgroundColor: ['#94a3b8', '#2563eb'],
            }],
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { title: { display: true, text: 'млн ₽' } } },
        },
    });

    global.tornadoChart = new Chart(document.getElementById('chartTornado'), {
        type: 'bar',
        data: {
            labels: [],
            datasets: [
                { label: '', data: [], backgroundColor: 'transparent' },
                { label: 'Диапазон PV(Δ)', data: [], backgroundColor: '#3b82f6' },
            ],
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { stacked: true, title: { display: true, text: 'PV(Δ богатства), млн ₽' } },
                y: { stacked: true },
            },
        },
    });
}

function updateCharts(res, tornadoData) {
    var v = res.v;
    var years = Array.from({ length: v.T + 1 }, function(_, i) { return i; });

    if (global.netChart) {
        global.netChart.data.labels = years.map(function(y) { return 'Год ' + y; });
        global.netChart.data.datasets[0].data = years.map(function(t) { return t === 0 ? res.A_NW_0 : res.yearly[t-1].A_NW; });
        global.netChart.data.datasets[1].data = years.map(function(t) { return t === 0 ? res.B_NW_0 : res.yearly[t-1].B_NW; });
        global.netChart.update();
    }

    if (global.finalChart) {
        global.finalChart.data.datasets[0].data = [res.WB, res.WA];
        global.finalChart.update();
    }

    if (global.tornadoChart && tornadoData) {
        global.tornadoChart.data.labels = tornadoData.map(function(d) { return d.label; });
        global.tornadoChart.data.datasets[0].data = tornadoData.map(function(d) { return d.min; });
        global.tornadoChart.data.datasets[1].data = tornadoData.map(function(d) { return d.max - d.min; });
        global.tornadoChart.update();
    }
}

global.Charts = { initCharts: initCharts, updateCharts: updateCharts };

})(window);
