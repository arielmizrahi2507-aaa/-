(function () {
  'use strict';

  var STORAGE_KEY_TX = 'dnm_transactions_v1';
  var STORAGE_KEY_SETTINGS = 'dnm_settings_v1';

  var HEBREW_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  var TRANSACTION_TYPES = ['מכר דירה', 'קניית דירה', 'מכר מסחרי', 'ליווי משכנתא', 'הסכם ממון', 'צוואה וירושה', 'ייפוי כוח', 'אחר'];
  var MONTHS_WINDOW = 36;

  var state = {
    transactions: [],
    settings: { monthlyGoal: 30000 }
  };

  var activeDetailId = null;
  var quickPostponeId = null;
  var pendingConfirmCallback = null;
  var pendingDraft = null;
  var splitSourceTxId = null;

  // ---------- Persistence ----------
  function loadState() {
    try {
      var tx = localStorage.getItem(STORAGE_KEY_TX);
      var settings = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (tx) state.transactions = JSON.parse(tx);
      if (settings) state.settings = Object.assign(state.settings, JSON.parse(settings));
    } catch (e) {
      console.error('שגיאה בטעינת נתונים שמורים', e);
    }
    // transactions saved before the "new" indicator existed are treated as already seen
    state.transactions.forEach(function (t) {
      if (t.seen === undefined) t.seen = true;
    });
  }

  function saveTransactions() {
    localStorage.setItem(STORAGE_KEY_TX, JSON.stringify(state.transactions));
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(state.settings));
  }

  function uid() {
    return 'tx_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  // ---------- Date helpers ----------
  function todayMonthStart() {
    var d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  function todayDateStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function currentMonthStartStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-01';
  }

  function monthKey(year, monthIndex) {
    return year + '-' + String(monthIndex + 1).padStart(2, '0');
  }

  function monthKeyFromDate(dateStr) {
    return dateStr.slice(0, 7);
  }

  function formatMonthLabel(year, monthIndex) {
    return HEBREW_MONTHS[monthIndex] + ' ' + year;
  }

  function addMonths(base, n) {
    return new Date(base.getFullYear(), base.getMonth() + n, 1);
  }

  function clampDateToMonth(dateStr, year, monthIndex) {
    var day = parseInt(dateStr.slice(8, 10), 10) || 1;
    var lastDay = new Date(year, monthIndex + 1, 0).getDate();
    var useDay = Math.min(day, lastDay);
    return year + '-' + String(monthIndex + 1).padStart(2, '0') + '-' + String(useDay).padStart(2, '0');
  }

  function formatMoney(n) {
    return '₪' + Math.round(n).toLocaleString('he-IL');
  }

  function formatDateHuman(dateStr) {
    var parts = dateStr.split('-');
    return parts[2] + '.' + parts[1] + '.' + parts[0];
  }

  function isWithinNextTwoMonths(today, monthDate) {
    var diff = (monthDate.getFullYear() - today.getFullYear()) * 12 + (monthDate.getMonth() - today.getMonth());
    return diff === 1 || diff === 2;
  }

  // ---------- Clock ----------
  function tickClock() {
    var el = document.getElementById('clock');
    var now = new Date();
    var dateStr = now.toLocaleDateString('he-IL', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    var timeStr = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    el.textContent = dateStr + ' | ' + timeStr;
  }

  // ---------- Month data ----------
  function computeMonthData(year, monthIndex) {
    var key = monthKey(year, monthIndex);
    var list = state.transactions
      .filter(function (t) { return monthKeyFromDate(t.dueDate) === key; })
      .sort(function (a, b) { return a.createdAt - b.createdAt; });

    var total = 0;
    list.forEach(function (t) { total += Number(t.fee) || 0; });

    // A paid transaction can't usefully be "moved to another month" (the money is
    // already in), so it never carries the overage flag itself - but its amount
    // still counts toward the cumulative total, and the flag lands on the next
    // unpaid transaction at or after the point the goal is crossed. Otherwise,
    // paying off the one transaction the flag happened to land on would silently
    // clear the whole month's warning even though the remaining unpaid total
    // still exceeds the goal. A transaction whose own fee already exceeds the
    // goal is excluded the same way - moving it to another month can never help
    // (it would exceed the goal there too), so it gets its own solo-overage
    // indicator and a split-into-payments offer instead of a move suggestion.
    var cumulative = 0;
    var overageId = null;
    for (var i = 0; i < list.length; i++) {
      cumulative += Number(list[i].fee) || 0;
      if (cumulative > state.settings.monthlyGoal && overageId === null &&
          !list[i].paid && Number(list[i].fee) <= state.settings.monthlyGoal) {
        overageId = list[i].id;
      }
    }

    return { key: key, list: list, total: total, overageId: overageId };
  }

  // ---------- Rendering ----------
  function computeTotalEarned() {
    var total = 0;
    state.transactions.forEach(function (t) {
      if (t.paid) total += Number(t.fee) || 0;
    });
    return total;
  }

  function renderGoal() {
    document.getElementById('goalValue').textContent = formatMoney(state.settings.monthlyGoal) + ' ▾';
    var year = new Date().getFullYear();
    document.getElementById('yearlyLabel').textContent = 'צפי הכנסה לשנת ' + year + ':';
    document.getElementById('yearlyValue').textContent = formatMoney(state.settings.monthlyGoal * 12);
    document.getElementById('earnedValue').textContent = formatMoney(computeTotalEarned());
  }

  function renderMonths() {
    var track = document.getElementById('monthsTrack');
    track.innerHTML = '';
    var today = todayMonthStart();
    var base = todayMonthStart();

    for (var i = 0; i < MONTHS_WINDOW; i++) {
      (function (i) {
        var monthDate = addMonths(base, i);
        var year = monthDate.getFullYear();
        var monthIndex = monthDate.getMonth();
        var data = computeMonthData(year, monthIndex);

        var showWarning = isWithinNextTwoMonths(today, monthDate) && data.total < state.settings.monthlyGoal;

        var col = document.createElement('div');
        col.className = 'month-column';
        col.dataset.monthIndex = String(i);

        var header = document.createElement('div');
        header.className = 'month-header';
        var titleSpan = document.createElement('span');
        titleSpan.textContent = formatMonthLabel(year, monthIndex);
        header.appendChild(titleSpan);
        if (showWarning) {
          var warn = document.createElement('span');
          warn.className = 'month-warning';
          warn.title = 'טרם הגעת ליעד החודשי בחודש זה';
          warn.textContent = '⚠';
          header.appendChild(warn);
        }
        col.appendChild(header);

        var totalEl = document.createElement('div');
        totalEl.className = 'month-total' + (data.total > state.settings.monthlyGoal ? ' over-goal' : '');
        totalEl.textContent = formatMoney(data.total) + ' צפוי';
        col.appendChild(totalEl);

        var listEl = document.createElement('div');
        listEl.className = 'transactions-list';

        if (data.list.length === 0) {
          var empty = document.createElement('div');
          empty.className = 'empty-hint';
          empty.textContent = 'אין עסקאות';
          listEl.appendChild(empty);
        }

        data.list.forEach(function (t) {
          var row = document.createElement('div');
          row.className = 'transaction-row';

          var square = document.createElement('button');
          square.type = 'button';
          square.className = 'tx-square';
          if (t.paid) {
            square.classList.add('paid');
            square.textContent = '✓';
            square.title = 'שולם - לחצו לביטול הסימון';
            square.addEventListener('click', function (e) {
              e.stopPropagation();
              unmarkTransactionPaid(t.id);
            });
          } else if (Number(t.fee) > state.settings.monthlyGoal) {
            square.classList.add('overage');
            square.textContent = '!';
            square.title = 'שכ"ט העסקה בעצמו חורג מהיעד החודשי - לחצו לפרטים';
            square.addEventListener('click', function (e) {
              e.stopPropagation();
              openSoloOverageModal(t);
            });
          } else if (t.id === data.overageId) {
            square.classList.add('overage');
            square.textContent = '!';
            square.title = 'חריגה מהיעד החודשי - לחצו לפרטים';
            square.addEventListener('click', function (e) {
              e.stopPropagation();
              openMoveModal(t);
            });
          } else if (!t.seen) {
            square.classList.add('new');
            square.textContent = '!';
            square.title = 'עסקה חדשה';
            square.disabled = true;
          } else {
            square.disabled = true;
          }
          row.appendChild(square);

          var nameBtn = document.createElement('button');
          nameBtn.type = 'button';
          nameBtn.className = 'tx-name' + (t.paid ? ' paid-text' : '');
          nameBtn.textContent = t.clientName;
          nameBtn.addEventListener('click', function () { openDetailModal(t.id); });
          row.appendChild(nameBtn);

          var actions = document.createElement('div');
          actions.className = 'tx-actions';

          var paidBtn = document.createElement('button');
          paidBtn.type = 'button';
          paidBtn.className = 'tx-icon-btn paid';
          if (t.paid) {
            paidBtn.textContent = '↺';
            paidBtn.title = 'ביטול סימון ששולם';
            paidBtn.addEventListener('click', function (e) {
              e.stopPropagation();
              unmarkTransactionPaid(t.id);
            });
          } else {
            paidBtn.textContent = '✓';
            paidBtn.title = 'קיבלתי את הכסף';
            paidBtn.addEventListener('click', function (e) {
              e.stopPropagation();
              markTransactionPaid(t.id);
            });
          }
          actions.appendChild(paidBtn);

          var postponeBtnEl = document.createElement('button');
          postponeBtnEl.type = 'button';
          postponeBtnEl.className = 'tx-icon-btn postpone';
          postponeBtnEl.title = 'לדחות תשלום';
          postponeBtnEl.textContent = '⏱';
          postponeBtnEl.addEventListener('click', function (e) {
            e.stopPropagation();
            openQuickPostponeModal(t.id);
          });
          actions.appendChild(postponeBtnEl);

          var deleteBtnEl = document.createElement('button');
          deleteBtnEl.type = 'button';
          deleteBtnEl.className = 'tx-icon-btn delete';
          deleteBtnEl.title = 'מחיקת עסקה';
          deleteBtnEl.textContent = '✕';
          deleteBtnEl.addEventListener('click', function (e) {
            e.stopPropagation();
            deleteTransactionById(t.id);
          });
          actions.appendChild(deleteBtnEl);

          row.appendChild(actions);

          listEl.appendChild(row);
        });

        col.appendChild(listEl);
        track.appendChild(col);
      })(i);
    }
  }

  function renderAll() {
    renderGoal();
    renderMonths();
  }

  // ---------- Add transaction ----------
  function openAddForm() {
    document.getElementById('transactionForm').reset();
    clearFormErrors();
    document.getElementById('dueDate').min = currentMonthStartStr();
    document.getElementById('addFormModal').classList.remove('hidden');
    document.getElementById('clientName').focus();
  }

  function closeAddForm() {
    document.getElementById('addFormModal').classList.add('hidden');
  }

  function clearFormErrors() {
    document.querySelectorAll('#addFormModal .field').forEach(function (f) {
      f.classList.remove('invalid');
      var msg = f.querySelector('.error-msg');
      if (msg && msg.dataset.defaultMsg) msg.textContent = msg.dataset.defaultMsg;
    });
  }

  function markInvalid(fieldId, message) {
    var field = document.getElementById('field-' + fieldId);
    field.classList.add('invalid');
    if (message) {
      var msg = field.querySelector('.error-msg');
      if (msg) {
        if (!msg.dataset.defaultMsg) msg.dataset.defaultMsg = msg.textContent;
        msg.textContent = message;
      }
    }
  }

  function handleAddSubmit(e) {
    e.preventDefault();
    clearFormErrors();

    var clientName = document.getElementById('clientName').value.trim();
    var fee = document.getElementById('fee').value;
    var dueDate = document.getElementById('dueDate').value;
    var type = document.getElementById('type').value;
    var phone = document.getElementById('phone').value.trim();

    var firstInvalid = null;
    if (!clientName) { markInvalid('clientName'); firstInvalid = firstInvalid || 'clientName'; }
    if (!fee) { markInvalid('fee'); firstInvalid = firstInvalid || 'fee'; }
    if (!dueDate) {
      markInvalid('dueDate');
      firstInvalid = firstInvalid || 'dueDate';
    } else if (dueDate < currentMonthStartStr()) {
      markInvalid('dueDate', 'לא ניתן לבחור חודש שכבר עבר');
      firstInvalid = firstInvalid || 'dueDate';
    }

    if (firstInvalid) {
      document.getElementById(firstInvalid).focus();
      return;
    }

    var draft = { clientName: clientName, type: type, fee: Number(fee), dueDate: dueDate, phone: phone };

    // The split-into-payments offer only makes sense when the transaction itself
    // is too big for the goal - splitting a small fee that merely tips an
    // already-busy month over the edge isn't a meaningful "payment plan", so
    // that case is left to the regular overage flag + move-to-another-month
    // suggestions after creation, same as any other multi-transaction overage.
    if (draft.fee > state.settings.monthlyGoal) {
      pendingDraft = draft;
      closeAddForm();
      openFeeExceedsGoalModal();
      return;
    }

    closeAddForm();
    createTransactionFromDraft(draft);
  }

  function buildTransaction(draft) {
    return {
      id: uid(),
      clientName: draft.clientName,
      type: draft.type,
      fee: draft.fee,
      dueDate: draft.dueDate,
      phone: draft.phone,
      paid: false,
      seen: false,
      createdAt: Date.now()
    };
  }

  // Standing rule: a payment can be billed anywhere from its estimated month up to
  // two months later. New transactions are placed automatically within that
  // 3-month window to keep every month as close as possible to the monthly goal -
  // preferring the earliest month that doesn't push itself over the goal, or (if
  // none of the three qualify) whichever of the three ends up least over. Once
  // placed this way, a transaction is never moved again automatically - only the
  // user's own explicit actions (postpone, or a move suggestion they pick) change
  // it after that, since the client may already have been told the date.
  function pickBestMonthForFee(originalDueDate, fee) {
    var baseYear = Number(originalDueDate.slice(0, 4));
    var baseMonthIndex = Number(originalDueDate.slice(5, 7)) - 1;
    var goal = state.settings.monthlyGoal;

    var fallback = null;
    for (var n = 0; n <= 2; n++) {
      var d = addMonths(new Date(baseYear, baseMonthIndex, 1), n);
      var year = d.getFullYear();
      var monthIndex = d.getMonth();
      var projected = computeMonthData(year, monthIndex).total + fee;

      if (projected <= goal) {
        return clampDateToMonth(originalDueDate, year, monthIndex);
      }
      if (!fallback || projected < fallback.projected) {
        fallback = { year: year, monthIndex: monthIndex, projected: projected };
      }
    }
    return clampDateToMonth(originalDueDate, fallback.year, fallback.monthIndex);
  }

  function createTransactionFromDraft(draft) {
    draft.dueDate = pickBestMonthForFee(draft.dueDate, draft.fee);
    var tx = buildTransaction(draft);
    state.transactions.push(tx);
    saveTransactions();
    renderAll();
    scrollToMonthOfDate(tx.dueDate);
    return tx;
  }

  // ---------- Single transaction whose fee alone exceeds the monthly goal ----------
  // Reaching the goal is the whole point of the app, so a transaction that alone
  // already blows past it at creation time gets a choice up front instead of
  // silently becoming just another overage flag: change the details, split it
  // into several smaller payments, or keep it as one transaction (in which case
  // everything behaves exactly like the regular overage flow already does).
  function openFeeExceedsGoalModal() {
    if (!pendingDraft) return;
    document.getElementById('feeExceedsGoalMessage').textContent =
      'שכ"ט העסקה (' + formatMoney(pendingDraft.fee) + ') גבוה בעצמו מהיעד החודשי שקבעת (' +
      formatMoney(state.settings.monthlyGoal) + '). מה תרצה לעשות?';
    document.getElementById('feeExceedsGoalModal').classList.remove('hidden');
  }

  function closeFeeExceedsGoalModal() {
    document.getElementById('feeExceedsGoalModal').classList.add('hidden');
  }

  function handleChangeDetails() {
    closeFeeExceedsGoalModal();
    if (!pendingDraft) return;
    document.getElementById('clientName').value = pendingDraft.clientName;
    document.getElementById('type').value = pendingDraft.type;
    document.getElementById('fee').value = pendingDraft.fee;
    document.getElementById('dueDate').value = pendingDraft.dueDate;
    document.getElementById('dueDate').min = currentMonthStartStr();
    document.getElementById('phone').value = pendingDraft.phone;
    pendingDraft = null;
    document.getElementById('addFormModal').classList.remove('hidden');
    document.getElementById('fee').focus();
  }

  function handleKeepAsSingle() {
    closeFeeExceedsGoalModal();
    if (pendingDraft) createTransactionFromDraft(pendingDraft);
    pendingDraft = null;
  }

  function handleChooseSplit() {
    closeFeeExceedsGoalModal();
    splitSourceTxId = null;
    openSplitPaymentsModal();
  }

  // ---------- Split payments builder ----------
  function addMonthsToDateStr(dateStr, n) {
    var year = Number(dateStr.slice(0, 4));
    var monthIndex = Number(dateStr.slice(5, 7)) - 1;
    var target = addMonths(new Date(year, monthIndex, 1), n);
    return clampDateToMonth(dateStr, target.getFullYear(), target.getMonth());
  }

  function addSplitRow(amount, dateStr) {
    var container = document.getElementById('splitRows');
    var row = document.createElement('div');
    row.className = 'split-row';

    var amountInput = document.createElement('input');
    amountInput.type = 'number';
    amountInput.min = '0';
    amountInput.step = '1';
    amountInput.className = 'split-amount-input';
    amountInput.value = amount != null ? amount : '';
    amountInput.addEventListener('input', updateSplitTotal);
    row.appendChild(amountInput);

    var dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.className = 'split-date-input';
    dateInput.min = currentMonthStartStr();
    dateInput.value = dateStr || '';
    row.appendChild(dateInput);

    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'tx-icon-btn delete';
    removeBtn.title = 'הסרת תשלום';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', function () {
      row.remove();
      updateSplitTotal();
    });
    row.appendChild(removeBtn);

    container.appendChild(row);
  }

  function updateSplitTotal() {
    var rows = document.querySelectorAll('#splitRows .split-row');
    var sum = 0;
    rows.forEach(function (row) {
      sum += Number(row.querySelector('.split-amount-input').value) || 0;
    });
    var totalEl = document.getElementById('splitCurrentTotal');
    totalEl.textContent = formatMoney(sum);
    var matches = pendingDraft && Math.abs(sum - pendingDraft.fee) < 0.01 && rows.length >= 1;
    totalEl.classList.toggle('mismatch', !matches);
    document.getElementById('splitError').classList.add('hidden');
  }

  function openSplitPaymentsModal() {
    if (!pendingDraft) return;
    document.getElementById('splitClientLabel').textContent = pendingDraft.clientName;
    document.getElementById('splitTotalLabel').textContent = formatMoney(pendingDraft.fee);
    document.getElementById('splitRows').innerHTML = '';

    var firstAmount = Math.round(pendingDraft.fee / 2);
    var secondAmount = pendingDraft.fee - firstAmount;
    addSplitRow(firstAmount, pendingDraft.dueDate);
    addSplitRow(secondAmount, addMonthsToDateStr(pendingDraft.dueDate, 1));
    updateSplitTotal();

    document.getElementById('splitError').classList.add('hidden');
    document.getElementById('splitPaymentsModal').classList.remove('hidden');
  }

  function closeSplitPaymentsModal() {
    document.getElementById('splitPaymentsModal').classList.add('hidden');
  }

  function handleBackFromSplit() {
    closeSplitPaymentsModal();
    if (splitSourceTxId) {
      var t = state.transactions.find(function (x) { return x.id === splitSourceTxId; });
      if (t) { openSoloOverageModal(t); return; }
      splitSourceTxId = null;
      pendingDraft = null;
      return;
    }
    openFeeExceedsGoalModal();
  }

  function handleConfirmSplit() {
    if (!pendingDraft) return;
    var rows = document.querySelectorAll('#splitRows .split-row');
    var installments = [];
    var allValid = rows.length >= 1;

    rows.forEach(function (row) {
      var amount = Number(row.querySelector('.split-amount-input').value);
      var date = row.querySelector('.split-date-input').value;
      if (!amount || amount <= 0 || !date || date < currentMonthStartStr()) allValid = false;
      installments.push({ fee: amount, dueDate: date });
    });

    var sum = installments.reduce(function (acc, inst) { return acc + (inst.fee || 0); }, 0);
    if (!allValid || Math.abs(sum - pendingDraft.fee) > 0.01) {
      document.getElementById('splitError').classList.remove('hidden');
      return;
    }

    var draft = pendingDraft;

    if (splitSourceTxId) {
      state.transactions = state.transactions.filter(function (x) { return x.id !== splitSourceTxId; });
    }

    installments.forEach(function (inst, idx) {
      var tx = buildTransaction({
        clientName: draft.clientName,
        type: draft.type,
        fee: inst.fee,
        dueDate: inst.dueDate,
        phone: draft.phone
      });
      tx.createdAt = Date.now() + idx;
      state.transactions.push(tx);
    });
    saveTransactions();
    renderAll();
    scrollToMonthOfDate(installments[0].dueDate);

    pendingDraft = null;
    splitSourceTxId = null;
    closeSplitPaymentsModal();
  }

  // ---------- Detail modal ----------
  function openDetailModal(id) {
    activeDetailId = id;
    var t = state.transactions.find(function (x) { return x.id === id; });
    if (!t) return;

    if (!t.seen) {
      t.seen = true;
      saveTransactions();
      renderMonths();
    }

    document.getElementById('detailClientName').textContent = t.clientName;
    document.getElementById('detailType').textContent = t.type || '—';
    document.getElementById('detailFee').textContent = formatMoney(t.fee);
    document.getElementById('detailDate').textContent = formatDateHuman(t.dueDate);
    document.getElementById('detailPhone').textContent = t.phone || '—';
    document.getElementById('editFeeRow').classList.add('hidden');
    document.getElementById('postponeRow').classList.add('hidden');

    var paidBtn = document.getElementById('markPaidBtn');
    paidBtn.textContent = t.paid ? 'ביטול סימון ששולם' : 'קיבלתי את הכסף';
    paidBtn.disabled = false;
    paidBtn.classList.toggle('btn-secondary', !!t.paid);
    paidBtn.classList.toggle('btn-primary', !t.paid);

    document.getElementById('detailModal').classList.remove('hidden');
  }

  function closeDetailModal() {
    document.getElementById('detailModal').classList.add('hidden');
    activeDetailId = null;
  }

  function getActiveTx() {
    return state.transactions.find(function (x) { return x.id === activeDetailId; });
  }

  function markTransactionPaid(id, onDone) {
    var t = state.transactions.find(function (x) { return x.id === id; });
    if (!t) return;
    showConfirm('לאשר שקיבלת את התשלום מ' + t.clientName + '?', function () {
      t.paid = true;
      t.seen = true;
      saveTransactions();
      renderAll();
      if (onDone) onDone();
    });
  }

  function unmarkTransactionPaid(id, onDone) {
    var t = state.transactions.find(function (x) { return x.id === id; });
    if (!t) return;
    showConfirm('לבטל את סימון "שולם" עבור ' + t.clientName + '? העסקה עצמה תישאר, רק הסימון יוסר.', function () {
      t.paid = false;
      saveTransactions();
      renderAll();
      if (onDone) onDone();
    });
  }

  // If deleting a transaction leaves its month under goal, pull in an unpaid
  // transaction from one of the next two months that's currently contributing
  // to an overage there - but only if it fits under goal in the freed month
  // too. Moves at most one transaction, and marks it unseen (the blue "!") so
  // the change is visible rather than silent, since it wasn't the user's own
  // explicit action.
  function rebalanceAfterDelete(freedYear, freedMonthIndex) {
    var goal = state.settings.monthlyGoal;
    var freedTotal = computeMonthData(freedYear, freedMonthIndex).total;
    if (freedTotal >= goal) return;
    var room = goal - freedTotal;

    for (var n = 1; n <= 2; n++) {
      var d = addMonths(new Date(freedYear, freedMonthIndex, 1), n);
      var candidateData = computeMonthData(d.getFullYear(), d.getMonth());
      if (candidateData.total <= goal) continue;

      for (var i = 0; i < candidateData.list.length; i++) {
        var cand = candidateData.list[i];
        if (cand.paid) continue;
        if (Number(cand.fee) <= room) {
          cand.dueDate = clampDateToMonth(cand.dueDate, freedYear, freedMonthIndex);
          cand.seen = false;
          return;
        }
      }
    }
  }

  function deleteTransactionById(id, onDone) {
    var t = state.transactions.find(function (x) { return x.id === id; });
    if (!t) return;
    showConfirm('למחוק את העסקה של ' + t.clientName + '?', function () {
      var freedYear = Number(t.dueDate.slice(0, 4));
      var freedMonthIndex = Number(t.dueDate.slice(5, 7)) - 1;
      state.transactions = state.transactions.filter(function (x) { return x.id !== id; });
      rebalanceAfterDelete(freedYear, freedMonthIndex);
      saveTransactions();
      renderAll();
      if (onDone) onDone();
    });
  }

  function handleMarkPaid() {
    if (!activeDetailId) return;
    var t = getActiveTx();
    if (!t) return;
    if (t.paid) {
      unmarkTransactionPaid(activeDetailId, closeDetailModal);
    } else {
      markTransactionPaid(activeDetailId, closeDetailModal);
    }
  }

  function handleEditFeeToggle() {
    var t = getActiveTx();
    if (!t) return;
    document.getElementById('editFeeInput').value = t.fee;
    document.getElementById('editFeeRow').classList.remove('hidden');
  }

  function handleSaveFee() {
    var t = getActiveTx();
    if (!t) return;
    var val = document.getElementById('editFeeInput').value;
    if (val === '' || Number(val) < 0) return;
    t.fee = Number(val);
    saveTransactions();
    document.getElementById('detailFee').textContent = formatMoney(t.fee);
    document.getElementById('editFeeRow').classList.add('hidden');
    renderAll();
  }

  function handlePostponeToggle() {
    var t = getActiveTx();
    if (!t) return;
    var minDate = todayDateStr();
    var dateInput = document.getElementById('postponeDate');
    dateInput.min = minDate;
    dateInput.value = t.dueDate < minDate ? minDate : t.dueDate;
    var errEl = document.getElementById('postponeError');
    if (errEl) errEl.classList.add('hidden');
    document.getElementById('postponeRow').classList.remove('hidden');
  }

  function handleConfirmPostpone() {
    var t = getActiveTx();
    if (!t) return;
    var newDate = document.getElementById('postponeDate').value;
    if (!newDate) return;
    var errEl = document.getElementById('postponeError');
    if (newDate < todayDateStr()) {
      if (errEl) errEl.classList.remove('hidden');
      return;
    }
    if (errEl) errEl.classList.add('hidden');
    t.dueDate = newDate;
    t.seen = true;
    saveTransactions();
    closeDetailModal();
    renderAll();
    scrollToMonthOfDate(newDate);
  }

  function handleDeleteTransaction() {
    if (!activeDetailId) return;
    deleteTransactionById(activeDetailId, closeDetailModal);
  }

  // ---------- Overage move modal ----------
  // The point of a suggestion is to actually help hit the monthly goal, not just
  // shuffle the overage into a different month - so each candidate month is
  // checked against what ITS total would become with this transaction added, and
  // labeled accordingly. The user can still pick a month that doesn't fully fit,
  // move it manually via "postpone" instead, or decline with "don't change".
  function openMoveModal(t) {
    var optionsEl = document.getElementById('moveOptions');
    optionsEl.innerHTML = '';
    var base = todayMonthStart();
    var goal = state.settings.monthlyGoal;
    var fee = Number(t.fee) || 0;

    for (var n = 1; n <= 2; n++) {
      (function (n) {
        var d = addMonths(base, n);
        var targetYear = d.getFullYear();
        var targetMonthIndex = d.getMonth();
        var targetData = computeMonthData(targetYear, targetMonthIndex);
        var projectedTotal = targetData.total + fee;
        var fitsGoal = projectedTotal <= goal;

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-secondary move-option-btn ' + (fitsGoal ? 'good-fit' : 'still-over');

        var mainText = document.createElement('span');
        mainText.textContent = 'להעביר ל-' + formatMonthLabel(targetYear, targetMonthIndex);
        btn.appendChild(mainText);

        var badge = document.createElement('span');
        badge.className = 'move-option-badge';
        badge.textContent = fitsGoal ? '✓ מתאים ליעד' : '⚠ עדיין יחרוג שם';
        btn.appendChild(badge);

        btn.addEventListener('click', function () {
          var tx = state.transactions.find(function (x) { return x.id === t.id; });
          if (tx) {
            tx.dueDate = clampDateToMonth(tx.dueDate, targetYear, targetMonthIndex);
            saveTransactions();
          }
          closeMoveModal();
          renderAll();
          if (tx) scrollToMonthOfDate(tx.dueDate);
        });
        optionsEl.appendChild(btn);
      })(n);
    }

    document.getElementById('moveModal').classList.remove('hidden');
  }

  function closeMoveModal() {
    document.getElementById('moveModal').classList.add('hidden');
  }

  // ---------- Solo overage (an existing transaction whose own fee exceeds goal) ----------
  var soloOverageTxId = null;

  function openSoloOverageModal(t) {
    soloOverageTxId = t.id;
    document.getElementById('soloOverageMessage').textContent =
      'שכ"ט העסקה של ' + t.clientName + ' (' + formatMoney(t.fee) + ') גבוה בעצמו מהיעד החודשי (' +
      formatMoney(state.settings.monthlyGoal) + '). מה תרצה לעשות?';
    document.getElementById('soloOverageModal').classList.remove('hidden');
  }

  function closeSoloOverageModal() {
    document.getElementById('soloOverageModal').classList.add('hidden');
    soloOverageTxId = null;
    splitSourceTxId = null;
    pendingDraft = null;
  }

  function handleSoloSplit() {
    var t = state.transactions.find(function (x) { return x.id === soloOverageTxId; });
    document.getElementById('soloOverageModal').classList.add('hidden');
    soloOverageTxId = null;
    if (!t) return;
    pendingDraft = { clientName: t.clientName, type: t.type, fee: t.fee, dueDate: t.dueDate, phone: t.phone };
    splitSourceTxId = t.id;
    openSplitPaymentsModal();
  }

  // ---------- Legend ----------
  function openLegendModal() {
    document.getElementById('legendModal').classList.remove('hidden');
  }

  function closeLegendModal() {
    document.getElementById('legendModal').classList.add('hidden');
  }

  // ---------- Quick postpone modal (inline row action) ----------
  function openQuickPostponeModal(id) {
    var t = state.transactions.find(function (x) { return x.id === id; });
    if (!t) return;
    quickPostponeId = id;
    var minDate = todayDateStr();
    var dateInput = document.getElementById('quickPostponeDate');
    dateInput.min = minDate;
    dateInput.value = t.dueDate < minDate ? minDate : t.dueDate;
    var errEl = document.getElementById('quickPostponeError');
    if (errEl) errEl.classList.add('hidden');
    document.getElementById('quickPostponeModal').classList.remove('hidden');
  }

  function closeQuickPostponeModal() {
    document.getElementById('quickPostponeModal').classList.add('hidden');
    quickPostponeId = null;
  }

  function handleQuickPostponeConfirm() {
    var t = state.transactions.find(function (x) { return x.id === quickPostponeId; });
    if (!t) return;
    var newDate = document.getElementById('quickPostponeDate').value;
    if (!newDate) return;
    var errEl = document.getElementById('quickPostponeError');
    if (newDate < todayDateStr()) {
      if (errEl) errEl.classList.remove('hidden');
      return;
    }
    if (errEl) errEl.classList.add('hidden');
    t.dueDate = newDate;
    t.seen = true;
    saveTransactions();
    closeQuickPostponeModal();
    renderAll();
    scrollToMonthOfDate(newDate);
  }

  // ---------- Generic confirm modal (custom UI - native confirm()/alert() are blocked when this page runs inside a sandboxed viewer) ----------
  function showConfirm(message, onConfirm) {
    document.getElementById('confirmMessage').textContent = message;
    pendingConfirmCallback = onConfirm;
    document.getElementById('confirmModal').classList.remove('hidden');
  }

  function closeConfirmModal() {
    document.getElementById('confirmModal').classList.add('hidden');
    pendingConfirmCallback = null;
  }

  function handleConfirmYes() {
    var cb = pendingConfirmCallback;
    closeConfirmModal();
    if (cb) cb();
  }

  // ---------- Goal dropdown ----------
  function toggleGoalDropdown() {
    document.getElementById('goalDropdown').classList.toggle('hidden');
    resetCustomGoalUI();
  }

  function selectGoal(value) {
    state.settings.monthlyGoal = value;
    saveSettings();
    document.getElementById('goalDropdown').classList.add('hidden');
    renderAll();
  }

  function resetCustomGoalUI() {
    document.getElementById('customGoalToggle').classList.remove('hidden');
    document.getElementById('customGoalRow').classList.add('hidden');
  }

  function openCustomGoalInput() {
    document.getElementById('customGoalToggle').classList.add('hidden');
    document.getElementById('customGoalRow').classList.remove('hidden');
    var input = document.getElementById('customGoalInput');
    input.value = state.settings.monthlyGoal;
    input.focus();
    input.select();
  }

  function confirmCustomGoal() {
    var input = document.getElementById('customGoalInput');
    var val = Math.round(Number(input.value));
    if (!val || val <= 0) {
      input.focus();
      return;
    }
    selectGoal(val);
    resetCustomGoalUI();
  }

  // ---------- Months navigation ----------
  function getColumns() {
    return Array.prototype.slice.call(document.querySelectorAll('.month-column'));
  }

  // Finds whichever column currently sits at the scroll container's "start" edge
  // (the edge that scrollIntoView({inline:'start'}) aligns to - the right edge in
  // this RTL layout). Must match the alignment used by scrollMonths()/goToToday()
  // below, or repeated clicks drift: with several columns visible at once,
  // "closest to the visual center" is a *different* column than "the one currently
  // aligned to start", so re-deriving position from the center silently skips
  // forward on every click instead of stepping back.
  function getStartAlignedColumnIndex(columns, track) {
    var trackRect = track.getBoundingClientRect();
    var closest = 0;
    var closestDist = Infinity;
    columns.forEach(function (col, i) {
      var rect = col.getBoundingClientRect();
      var dist = Math.abs(rect.right - trackRect.right);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    });
    return closest;
  }

  function scrollMonths(direction) {
    var track = document.getElementById('monthsTrack');
    var columns = getColumns();
    if (!columns.length) return;

    var currentIndex = getStartAlignedColumnIndex(columns, track);
    var targetIndex = Math.max(0, Math.min(columns.length - 1, currentIndex + direction));
    columns[targetIndex].scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  }

  function goToToday() {
    var columns = getColumns();
    if (columns.length) {
      columns[0].scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    }
  }

  function scrollToMonthOfDate(dateStr) {
    var key = monthKeyFromDate(dateStr);
    var base = todayMonthStart();
    for (var i = 0; i < MONTHS_WINDOW; i++) {
      var d = addMonths(base, i);
      if (monthKey(d.getFullYear(), d.getMonth()) === key) {
        requestAnimationFrame(function () {
          var col = document.querySelector('.month-column[data-month-index="' + i + '"]');
          if (col) col.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
        });
        return;
      }
    }
  }

  // ---------- Modal overlay click-outside / escape ----------
  function bindOverlayDismiss(overlayId, closeFn) {
    var overlay = document.getElementById(overlayId);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeFn();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!document.getElementById('confirmModal').classList.contains('hidden')) closeConfirmModal();
    else if (!document.getElementById('legendModal').classList.contains('hidden')) closeLegendModal();
    else if (!document.getElementById('splitPaymentsModal').classList.contains('hidden')) handleBackFromSplit();
    else if (!document.getElementById('soloOverageModal').classList.contains('hidden')) closeSoloOverageModal();
    else if (!document.getElementById('feeExceedsGoalModal').classList.contains('hidden')) handleChangeDetails();
    else if (!document.getElementById('quickPostponeModal').classList.contains('hidden')) closeQuickPostponeModal();
    else if (!document.getElementById('moveModal').classList.contains('hidden')) closeMoveModal();
    else if (!document.getElementById('detailModal').classList.contains('hidden')) closeDetailModal();
    else if (!document.getElementById('addFormModal').classList.contains('hidden')) closeAddForm();
  });

  // ---------- Init ----------
  function populateTypeOptions() {
    var select = document.getElementById('type');
    TRANSACTION_TYPES.forEach(function (t) {
      var opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      select.appendChild(opt);
    });
  }

  function bindEvents() {
    document.getElementById('addTransactionBtn').addEventListener('click', openAddForm);
    document.getElementById('cancelAddBtn').addEventListener('click', closeAddForm);
    document.getElementById('closeAddFormModal').addEventListener('click', closeAddForm);
    document.getElementById('transactionForm').addEventListener('submit', handleAddSubmit);
    bindOverlayDismiss('addFormModal', closeAddForm);

    ['clientName', 'fee', 'dueDate'].forEach(function (id) {
      document.getElementById(id).addEventListener('input', function () {
        document.getElementById('field-' + id).classList.remove('invalid');
      });
    });

    document.getElementById('goalValue').addEventListener('click', toggleGoalDropdown);
    document.querySelectorAll('#goalDropdown button[data-goal]').forEach(function (btn) {
      btn.addEventListener('click', function () { selectGoal(Number(btn.dataset.goal)); });
    });
    document.getElementById('customGoalToggle').addEventListener('click', openCustomGoalInput);
    document.getElementById('confirmCustomGoalBtn').addEventListener('click', confirmCustomGoal);
    document.getElementById('customGoalInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); confirmCustomGoal(); }
    });
    document.addEventListener('click', function (e) {
      var wrap = document.getElementById('goalDropdown');
      var trigger = document.getElementById('goalValue');
      if (!wrap.classList.contains('hidden') && !wrap.contains(e.target) && e.target !== trigger) {
        wrap.classList.add('hidden');
        resetCustomGoalUI();
      }
    });

    document.getElementById('closeDetailModal').addEventListener('click', closeDetailModal);
    document.getElementById('markPaidBtn').addEventListener('click', handleMarkPaid);
    document.getElementById('editFeeBtn').addEventListener('click', handleEditFeeToggle);
    document.getElementById('saveFeeBtn').addEventListener('click', handleSaveFee);
    document.getElementById('postponeBtn').addEventListener('click', handlePostponeToggle);
    document.getElementById('confirmPostponeBtn').addEventListener('click', handleConfirmPostpone);
    document.getElementById('deleteTransactionBtn').addEventListener('click', handleDeleteTransaction);
    bindOverlayDismiss('detailModal', closeDetailModal);

    document.getElementById('closeMoveModal').addEventListener('click', closeMoveModal);
    document.getElementById('dontMoveBtn').addEventListener('click', closeMoveModal);
    bindOverlayDismiss('moveModal', closeMoveModal);

    document.getElementById('closeSoloOverageModal').addEventListener('click', closeSoloOverageModal);
    document.getElementById('soloLeaveBtn').addEventListener('click', closeSoloOverageModal);
    document.getElementById('soloSplitBtn').addEventListener('click', handleSoloSplit);
    bindOverlayDismiss('soloOverageModal', closeSoloOverageModal);

    document.getElementById('closeQuickPostponeModal').addEventListener('click', closeQuickPostponeModal);
    document.getElementById('cancelQuickPostponeBtn').addEventListener('click', closeQuickPostponeModal);
    document.getElementById('confirmQuickPostponeBtn').addEventListener('click', handleQuickPostponeConfirm);
    bindOverlayDismiss('quickPostponeModal', closeQuickPostponeModal);

    document.getElementById('confirmYesBtn').addEventListener('click', handleConfirmYes);
    document.getElementById('confirmNoBtn').addEventListener('click', closeConfirmModal);
    document.getElementById('closeConfirmModal').addEventListener('click', closeConfirmModal);
    bindOverlayDismiss('confirmModal', closeConfirmModal);

    document.getElementById('legendBtn').addEventListener('click', openLegendModal);
    document.getElementById('closeLegendModal').addEventListener('click', closeLegendModal);
    bindOverlayDismiss('legendModal', closeLegendModal);

    document.getElementById('closeFeeExceedsGoalModal').addEventListener('click', handleChangeDetails);
    document.getElementById('changeDetailsBtn').addEventListener('click', handleChangeDetails);
    document.getElementById('keepAsSingleBtn').addEventListener('click', handleKeepAsSingle);
    document.getElementById('splitPaymentsBtn').addEventListener('click', handleChooseSplit);
    bindOverlayDismiss('feeExceedsGoalModal', handleChangeDetails);

    document.getElementById('closeSplitPaymentsModal').addEventListener('click', handleBackFromSplit);
    document.getElementById('cancelSplitBtn').addEventListener('click', handleBackFromSplit);
    document.getElementById('addSplitRowBtn').addEventListener('click', function () { addSplitRow(null, pendingDraft ? pendingDraft.dueDate : ''); updateSplitTotal(); });
    document.getElementById('confirmSplitBtn').addEventListener('click', handleConfirmSplit);
    bindOverlayDismiss('splitPaymentsModal', handleBackFromSplit);

    document.getElementById('scrollForwardBtn').addEventListener('click', function () { scrollMonths(1); });
    document.getElementById('scrollBackBtn').addEventListener('click', function () { scrollMonths(-1); });
    document.getElementById('todayBtn').addEventListener('click', goToToday);

    document.getElementById('refreshBtn').addEventListener('click', function () { location.reload(); });
  }

  function init() {
    loadState();
    populateTypeOptions();
    bindEvents();
    tickClock();
    setInterval(tickClock, 1000);
    renderAll();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
