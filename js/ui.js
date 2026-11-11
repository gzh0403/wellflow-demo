/* WellFlow P2 — shared presentational helpers. Classic script, no modules. */
(function (root) {
  var WF = root.WF = root.WF || {};
  var U = function () { return WF.utils; };

  function h(str) { return U().escapeHtml(str); }

  function icon(name) {
    var paths = {
      home: '<path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
      book: '<rect x="5" y="4" width="14" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 9h8M8 13h6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
      member: '<circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M5 19c1.5-3.2 3.8-4.8 7-4.8S17.5 15.8 19 19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
      me: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="10" r="2.4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 17.2c1.1-1.4 2.4-2 4-2s2.9.6 4 2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
      today: '<rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 3.5v3M16 3.5v3M4 9.5h16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
      people: '<circle cx="9" cy="9" r="2.6" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="16" cy="10" r="2.1" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4.5 18c.9-2.6 2.5-3.8 4.5-3.8s3.6 1.2 4.5 3.8M14 14.4c1.5-.2 2.8.6 3.8 2.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
      clock: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 7v5.5l3.5 2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
      board: '<path d="M5 6h14v12H5z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 10h8M8 14h5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
      gear: '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 4.5v2M12 17.5v2M4.5 12h2M17.5 12h2M6.4 6.4l1.4 1.4M16.2 16.2l1.4 1.4M6.4 17.6l1.4-1.4M16.2 7.8l1.4-1.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
      room: '<path d="M4 20V9l8-5 8 5v11" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M10 20v-6h4v6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
      card: '<rect x="3.5" y="6" width="17" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 10h17" stroke="currentColor" stroke-width="1.7"/>',
      check: '<path d="M5 12.5 10 17l9-10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
    };
    var d = paths[name] || paths.board;
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';
  }

  function logoSvg() {
    return '<svg viewBox="0 0 64 64" aria-hidden="true">' +
      '<ellipse cx="32" cy="44" rx="20" ry="8" fill="#C4A484" opacity=".55"/>' +
      '<ellipse cx="30" cy="34" rx="16" ry="8" fill="#5B6E5B"/>' +
      '<ellipse cx="36" cy="24" rx="11" ry="6.5" fill="#C9A46C"/>' +
      '<circle cx="42" cy="16" r="3" fill="#2C2A28" opacity=".7"/>' +
      '</svg>';
  }

  function decoSvg() {
    return '<svg class="stone-deco" viewBox="0 0 200 200" aria-hidden="true">' +
      '<ellipse cx="120" cy="140" rx="70" ry="24" fill="#C4A484" opacity=".35"/>' +
      '<ellipse cx="108" cy="108" rx="58" ry="26" fill="#5B6E5B" opacity=".35"/>' +
      '<ellipse cx="130" cy="76" rx="40" ry="20" fill="#C9A46C" opacity=".45"/>' +
      '</svg>';
  }

  var AV = ["av-0", "av-1", "av-2", "av-3", "av-4"];
  function avatar(name, size) {
    var ch = (name || "?").slice(-1);
    var idx = 0;
    for (var i = 0; i < (name || "").length; i++) idx += name.charCodeAt(i);
    return '<div class="avatar ' + (size || "") + ' ' + AV[idx % AV.length] + '">' + h(ch) + '</div>';
  }

  function pill(status) {
    var label = WF.STATUS_LABEL[status] || status;
    return '<span class="pill pill-' + h(status) + '">' + h(label) + '</span>';
  }

  function serviceNames(state, ids) {
    return (ids || []).map(function (id) {
      var s = U().byId(state.services, id);
      return s ? s.name : id;
    }).join("、");
  }

  function staffName(state, id) {
    var s = U().byId(state.staff, id);
    return s ? s.name : "未指定";
  }

  function roomName(state, id) {
    var r = U().byId(state.rooms, id);
    return r ? r.name : "未分配";
  }

  function customerName(state, id) {
    var c = U().byId(state.users, id);
    return c ? c.name : "顾客";
  }

  function money(fen) { return U().yuanLabel(fen); }

  function when(ms, now) {
    return U().friendlyDate(ms, now) + " " + U().timeStr(ms);
  }

  function range(a, now) {
    return U().friendlyDate(a.startAt, now) + " " + U().timeStr(a.startAt) + "–" + U().timeStr(a.endAt);
  }

  function countdownHtml(appt, now) {
    if (appt.status !== "pending" || !appt.confirmDeadlineAt) return "";
    var c = U().countdown(appt.confirmDeadlineAt, now);
    if (c.expired) return '<span class="pill pill-timeout">确认已超时</span>';
    return '<span class="pill pill-pending" data-countdown="' + appt.confirmDeadlineAt + '">确认剩余 ' + c.text + '</span>';
  }

  function btn(action, label, cls, extra) {
    extra = extra || "";
    return '<button type="button" class="btn ' + (cls || "") + '" data-action="' + h(action) + '" ' + extra + '>' + label + '</button>';
  }

  function go(path, label, cls, extra) {
    return '<a class="btn ' + (cls || "") + '" href="#/' + h(path.replace(/^\//, "")) + '" ' + (extra || "") + '>' + label + '</a>';
  }

  function link(path, label, cls) {
    return '<a class="' + (cls || "") + '" href="#/' + h(path.replace(/^\//, "")) + '">' + label + '</a>';
  }

  function empty(text) {
    return '<div class="empty">' + h(text || "暂时没有内容") + '</div>';
  }

  var toastTimer = null;
  function toast(msg, kind) {
    var wrap = document.getElementById("toast-wrap");
    if (!wrap) return;
    var el = document.createElement("div");
    el.className = "toast" + (kind ? " " + kind : "");
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 4200);
  }

  var modalResolve = null;

  function modal(opts) {
    closeModal(false);
    var back = document.createElement("div");
    back.className = "modal-back";
    back.id = "wf-modal";
    back.innerHTML = '<div class="modal" role="dialog" aria-modal="true">' +
      "<h3>" + h(opts.title || "请确认") + "</h3>" +
      '<div class="body">' + (opts.html || h(opts.body || "")) + "</div>" +
      '<div class="btn-row">' +
        '<button type="button" class="btn btn-ghost" data-modal="no">' + h(opts.cancel || "取消") + "</button>" +
        '<button type="button" class="btn ' + (opts.danger ? "btn-danger" : "btn-primary") + '" data-modal="yes">' + h(opts.ok || "确定") + "</button>" +
      "</div></div>";
    document.body.appendChild(back);
    return new Promise(function (resolve) {
      modalResolve = resolve;
      back.addEventListener("click", function (e) {
        if (e.target === back) return closeModal(false);
        var b = e.target.closest("[data-modal]");
        if (!b) return;
        if (b.getAttribute("data-modal") === "yes") {
          var formVals = {};
          var inputs = back.querySelectorAll("[data-field]");
          for (var i = 0; i < inputs.length; i++) formVals[inputs[i].getAttribute("data-field")] = inputs[i].value;
          closeModal({ ok: true, fields: formVals });
        } else closeModal(false);
      });
    });
  }

  function closeModal(result) {
    var m = document.getElementById("wf-modal");
    if (m && m.parentNode) m.parentNode.removeChild(m);
    if (modalResolve) {
      var r = modalResolve;
      modalResolve = null;
      r(result === undefined ? false : result);
    }
  }

  function pageHead(kicker, title, sub, extra) {
    return '<div class="page-head"><div>' +
      (kicker ? '<div class="page-kicker">' + h(kicker) + "</div>" : "") +
      "<h1>" + title + "</h1>" +
      (sub ? '<div class="page-sub">' + sub + "</div>" : "") +
      "</div>" + (extra || "") + "</div>";
  }

  function apptCard(state, a, now, opts) {
    opts = opts || {};
    var role = state.currentRole;
    var who = role === "customer" ? staffName(state, a.staffId) : customerName(state, a.customerId);
    var href = role === "customer"
      ? "customer/appointment/" + a.id
      : (role === "owner" ? "boss/appointment/" : "staff/appointment/") + a.id;
    return '<a class="card pressable appt-card" style="display:block;width:100%;box-sizing:border-box;text-decoration:none;color:inherit" href="#/' + href + '">' +
      '<div class="row-between"><div class="mono tiny muted">' + h(a.no) + "</div>" + pill(a.status) + "</div>" +
      "<h3 style=\"margin-top:8px;font-size:16px\">" + h(serviceNames(state, a.serviceIds)) + "</h3>" +
      '<div class="soft tiny" style="margin-top:6px">' + h(range(a, now)) + "</div>" +
      '<div class="soft tiny appt-who">' + h(who) + " · " + h(roomName(state, a.roomId)) + " · " + h(money(a.priceFen)) + "</div>" +
      (a.status === "pending" ? '<div style="margin-top:8px">' + countdownHtml(a, now) + "</div>" : "") +
      "</a>";
  }

  function draftHint(text) {
    return '<p class="tiny muted draft-hint">' + h(text) + "</p>";
  }

  function settledNotice(state, a) {
    if (!a || a.status !== "done") return "";
    if (state.currentRole !== "clerk" && state.currentRole !== "owner") return "";
    return '<div class="callout ok" style="margin-top:14px">已核销、不可重复核销。本单已完成结算，不能再次核销。</div>';
  }

  function actionButtons(state, a) {
    var role = state.currentRole;
    var out = [];
    if (role === "customer") {
      if (a.status === "pending" || a.status === "confirmed") {
        out.push(btn("cancel-appt", "取消预约", "btn-ghost", 'data-id="' + h(a.id) + '"'));
      }
      return out.join("");
    }
    if (role !== "clerk" && role !== "owner") return "";
    if (a.status === "pending") {
      out.push(btn("do", "确认预约", "btn-primary", 'data-verb="confirm" data-id="' + h(a.id) + '"'));
      out.push(btn("cancel-appt", "取消", "btn-ghost", 'data-id="' + h(a.id) + '"'));
      out.push(btn("force-timeout", "演示：模拟确认超时", "btn-amber btn-sm", 'data-id="' + h(a.id) + '"'));
    }
    if (a.status === "confirmed") {
      out.push(btn("do", "登记到店", "btn-primary", 'data-verb="arrive" data-id="' + h(a.id) + '"'));
      out.push(btn("do-reason", "标记逾期未到", "btn-ghost", 'data-verb="noshow" data-id="' + h(a.id) + '"'));
      out.push(btn("cancel-appt", "取消", "btn-ghost", 'data-id="' + h(a.id) + '"'));
    }
    if (a.status === "arrived") {
      out.push(btn("do", "开始服务", "btn-primary", 'data-verb="start" data-id="' + h(a.id) + '"'));
      out.push(btn("do-reason", "到店后取消", "btn-danger", 'data-verb="cancel_arrived" data-id="' + h(a.id) + '"'));
    }
    if (a.status === "in_service") {
      out.push(btn("do", "服务完成，进入待结算", "btn-primary", 'data-verb="finish" data-id="' + h(a.id) + '"'));
    }
    if (a.status === "await_pay") {
      out.push(btn("open-settle", "去结算核销", "btn-primary", 'data-id="' + h(a.id) + '"'));
      out.push(btn("do-reason", "作废待结算", "btn-danger", 'data-verb="void_pay" data-id="' + h(a.id) + '"'));
    }
    return '<div class="btn-row" style="margin-top:14px">' + out.join("") + "</div>";
  }

  function roomBoard(state, now) {
    var board = WF.rules.roomStatusAt(state, now);
    return '<div class="room-board">' + board.map(function (item) {
      var until = item.untilLabel || (item.until ? ("至 " + U().timeStr(item.until)) : "暂无下一档");
      var who = item.appointment ? (customerName(state, item.appointment.customerId) + " · " + staffName(state, item.appointment.staffId)) : "";
      return '<div class="room-plaque ' + item.status + '">' +
        '<div><div class="tiny muted">' + h(item.room.floor || "") + '</div><h3>' + h(item.room.name) + "</h3></div>" +
        '<div><div class="st">' + h(item.label) + "</div>" +
        '<div class="tiny soft room-who">' + h(until) + (who ? " · " + h(who) : "") + "</div></div>" +
        "</div>";
    }).join("") + "</div>" +
      draftHint("清扫缓冲 " + (state.shop.bufferMin || 0) + " 分钟、演示店名「澄石养生馆」与房态规则均为建议方案，尚未锁定。");
  }

  function dateTabs(selected, now) {
    var days = [];
    var start = U().startOfDay(now);
    for (var i = 0; i < 7; i++) {
      var ms = U().addDays(start, i);
      days.push({ date: U().dateStr(ms), ms: ms, label: i === 0 ? "今天" : (i === 1 ? "明天" : U().weekdayName(ms)), time: U().dateStr(ms).slice(5) });
    }
    return '<div class="date-tabs">' + days.map(function (d) {
      return '<button type="button" class="slot' + (d.date === selected ? " is-on" : "") + '" data-action="set-date" data-date="' + d.date + '">' +
        h(d.label) + '<div class="tiny">' + h(d.time) + "</div></button>";
    }).join("") + "</div>";
  }

  WF.ui = {
    h: h,
    icon: icon,
    logoSvg: logoSvg,
    decoSvg: decoSvg,
    avatar: avatar,
    pill: pill,
    serviceNames: serviceNames,
    staffName: staffName,
    roomName: roomName,
    customerName: customerName,
    money: money,
    when: when,
    range: range,
    countdownHtml: countdownHtml,
    btn: btn,
    go: go,
    link: link,
    empty: empty,
    toast: toast,
    modal: modal,
    closeModal: closeModal,
    pageHead: pageHead,
    apptCard: apptCard,
    actionButtons: actionButtons,
    settledNotice: settledNotice,
    draftHint: draftHint,
    roomBoard: roomBoard,
    dateTabs: dateTabs
  };
})(typeof window !== "undefined" ? window : global);
