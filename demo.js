const demoReport = [
  { id: 'revenue', label: 'Выручка', total: 168.4, parts: [['Рестораны «Центр» (3 юрлица)', 89.2], ['Рестораны «Регион» (4 юрлица)', 52.3], ['Служба доставки (1 юрлицо)', 26.9]] },
  { id: 'costs', label: 'Себестоимость', total: -69.9, parts: [['Продукты и напитки', -42.5], ['Упаковка и доставка', -18.6], ['Прочие прямые затраты', -8.8]] },
  { id: 'gross_profit', label: 'Валовая прибыль', total: 98.5, parts: [['Выручка', 168.4], ['Себестоимость', -69.9]] },
  { id: 'personnel', label: 'Расходы на персонал', total: -48.6, parts: [['Заработная плата', -37.4], ['Взносы и начисления', -11.2]] },
  { id: 'rent', label: 'Аренда и коммунальные', total: -22.1, parts: [['Аренда помещений', -18.4], ['Коммунальные услуги', -3.7]] },
  { id: 'operating_profit', label: 'Операционная прибыль', total: 27.8, parts: [['Валовая прибыль', 98.5], ['Расходы на персонал', -48.6], ['Аренда и коммунальные', -22.1]] }
];

const demoDialog = document.querySelector('#demo-dialog');
const demoRows = document.querySelector('[data-demo-rows]');
const reportFormatter = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function formatReportAmount(value) {
  return reportFormatter.format(value).replace('-', '−');
}

for (const item of demoReport) {
  const row = document.createElement('details');
  row.className = 'demo-row';

  const heading = document.createElement('summary');
  const label = document.createElement('span');
  const amount = document.createElement('strong');
  label.textContent = item.label;
  amount.className = 'amount';
  amount.textContent = formatReportAmount(item.total);
  heading.append(label, amount);

  const breakdown = document.createElement('dl');
  breakdown.className = 'detail-list';
  for (const [name, value] of item.parts) {
    const entry = document.createElement('div');
    const term = document.createElement('dt');
    const definition = document.createElement('dd');
    term.textContent = name;
    definition.className = 'amount';
    definition.textContent = formatReportAmount(value);
    entry.append(term, definition);
    breakdown.append(entry);
  }

  row.append(heading, breakdown);
  row.addEventListener('toggle', () => {
    if (!row.open || !demoDialog.open) return;
    window.finAnalytics?.track('demo_row_expand', { report: 'pnl', row: item.id });
  });
  demoRows.append(row);
}

let demoTrigger;
for (const trigger of document.querySelectorAll('[data-demo-open]')) {
  trigger.addEventListener('click', () => {
    if (demoDialog.open) return;
    demoTrigger = trigger;
    demoDialog.showModal();
    window.finAnalytics?.track('demo_open', { report: 'pnl' });
  });
}
demoDialog.addEventListener('close', () => {
  for (const row of demoRows.querySelectorAll('[open]')) row.open = false;
  demoTrigger?.focus();
});
