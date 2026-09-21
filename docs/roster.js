(() => {
  let report = null;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels = { squadron: '联队载具', 'premium-golden-eagles': '金鹰载具', 'premium-pack': '礼包载具',
    'premium-special': '特殊载具', component: '组合载具部件', standard: '普通 / 非金币' };
  const descriptions = { 'premium-golden-eagles': 'Wiki 标有明确的金鹰价格', 'premium-pack': 'Wiki 购买入口指向 Gaijin Store',
    'premium-special': '没有金鹰价格或当前礼包购买入口' };
  const badge = (kind, text, title = '') => `<span class="pill roster-badge roster-${kind}" title="${escape(title)}">${text}</span>`;
  const hiddenBadge = name => `<span class="pill roster-badge roster-hidden" role="button" tabindex="0" data-roster-hidden-help data-unit-name="${escape(name || '该载具')}" title="点击查看隐藏载具说明" aria-haspopup="dialog">持有后可见</span>`;

  function getHelpDialog() {
    let dialog = document.getElementById('rosterHiddenDialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'rosterHiddenDialog';
    dialog.className = 'roster-help-dialog';
    dialog.setAttribute('aria-labelledby', 'rosterHiddenTitle');
    dialog.innerHTML = `<div class="roster-help-heading">
        <div><span>隐藏载具</span><h2 id="rosterHiddenTitle">持有后可见是什么意思？</h2></div>
        <button type="button" data-roster-help-close aria-label="关闭隐藏载具说明">关闭</button>
      </div>
      <p><strong data-roster-hidden-name>该载具</strong>被游戏配置标记为“仅在拥有后显示”（<code>showOnlyWhenBought</code>）。它不是向所有账号公开展示的常规科技树载具，通常只有已经拥有、购买或满足特定发放条件的玩家才能在游戏中看到。</p>
      <p>Wiki 仍可能保留它的资料，所以本页面会显示该载具。这个标签只解释显示条件，不代表它目前仍可购买或获取，也不会将它自动视为可研发载具。</p>
      <p class="roster-help-note">研发前置、等级解锁数量和 RP / SL 计算不会因此改变。</p>`;
    dialog.addEventListener('click', event => {
      if (event.target === dialog || event.target.closest('[data-roster-help-close]')) dialog.close();
    });
    document.body.append(dialog);
    return dialog;
  }

  function openHiddenHelp(trigger) {
    const dialog = getHelpDialog();
    dialog.querySelector('[data-roster-hidden-name]').textContent = trigger.dataset.unitName || '该载具';
    if (!dialog.open) dialog.showModal();
  }

  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-roster-hidden-help]');
    if (!trigger) return;
    event.preventDefault();
    event.stopPropagation();
    openHiddenHelp(trigger);
  }, true);

  document.addEventListener('keydown', event => {
    const trigger = event.target.closest?.('[data-roster-hidden-help]');
    if (!trigger || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    openHiddenHelp(trigger);
  }, true);

  window.RosterAudit = {
    async load() {
      try {
        const response = await fetch('roster-audit.json?v=roster-1', { signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw new Error('Roster audit unavailable');
        report = await response.json();
        if (report.schema !== 2 || !report.trees) throw new Error('Invalid roster audit');
      } catch (error) { report = null; console.warn(error); }
    },
    badges(country, type, unit, displayName) {
      const item = report?.trees[`${country}/${type}`]?.units[String(unit.data_unit_id).toLowerCase()];
      if (!item) return badge('pending', '分类待核对');
      return (item.category === 'squadron' ? '' : badge(item.category, labels[item.category], descriptions[item.category] || '仅作分类展示，不改变计算规则')) +
        (item.hidden ? hiddenBadge(displayName || item.title || unit.data_unit_id) : '');
    },
    info(country, type, unitId) {
      return report?.trees[`${country}/${type}`]?.units[String(unitId || '').toLowerCase()] || null;
    },
    isHidden(country, type, unitId) {
      return report?.trees[`${country}/${type}`]?.units[String(unitId || '').toLowerCase()]?.hidden === true;
    },
    render(country, type) {
      const panel = document.getElementById('rosterAudit');
      if (!panel) return;
      const tree = report?.trees[`${country}/${type}`];
      const token = `${country}/${type}/${!!tree}`;
      if (panel.dataset.tree === token) return;
      panel.dataset.tree = token;
      panel.open = false;
      if (!tree) {
        panel.innerHTML = '<summary>载具收录对照暂不可用</summary>';
        return;
      }
      const unmatched = Object.entries(tree.units).filter(([, unit]) => !unit.matched);
      panel.innerHTML = `<summary>载具收录对照 · 已匹配 ${tree.matched}/${tree.wikiCount} · 配置独有 ${tree.candidates.length} · Wiki 独有 ${unmatched.length}</summary>
        <p>Datamine ${escape(report.version)} · ${escape(report.commit.slice(0, 7))} · 配置独有条目待核对，不代表可获取，不计入研发。</p>
        <div class="roster-legend">${Object.entries(labels).map(([k,v]) => badge(k,v)).join('')}${hiddenBadge('隐藏载具')}</div>
        <ul class="roster-candidates">${tree.candidates.map(item => `<li><code>${escape(item.id)}</code><span>等级 ${item.rank}</span>${badge('pending','待核对')}${item.isClanVehicle ? badge('squadron','联队载具') : ''}${item.showOnlyWhenBought ? hiddenBadge(item.id) : ''}</li>`).join('')}
        ${unmatched.map(([id,item]) => `<li><span>${escape(item.title || id)}</span>${badge('pending','仅 Wiki 收录')}</li>`).join('')}</ul>
        ${!tree.candidates.length && !unmatched.length ? '<p>当前科技树无收录差异。</p>' : ''}`;
    }
  };
})();
