/* WellFlow P2 — staff views. Classic script. */
(function (root) {
  var WF = root.WF = root.WF || {};
  function U() { return WF.utils; }
  function ui() { return WF.ui; }

  function dayList(state, date) {
    var start = U().atTime(date, "00:00");
    var end = U().addDays(start, 1);
    return state.appointments.filter(function (a) {
      return a.startAt >= start && a.startAt < end;
    }).sort(function (a, b) { return a.startAt - b.startAt; });
  }

  function today(state, now) {
    var date = WF.session.date || U().dateStr(now);
    var staffId = WF.session.filterStaff || "";
    var list = dayList(state, date);
    if (staffId) list = list.filter(function (a) { return a.staffId === staffId; });
    var pending = list.filter(function (a) { return a.status === "pending"; });
    var awaitPay = state.appointments.filter(function (a) { return a.status === "await_pay"; });
    var techs = state.staff.filter(function (s) { return s.role === "technician" && s.active; });
    return ui().pageHead("店员", "今日预约", "可切换日期；待确认有倒计时，待结算需核销。") +
      ui().dateTabs(date, now) +
      '<div class="filter-row" style="margin-top:12px">' +
        '<button type="button" class="slot' + (!staffId ? " is-on" : "") + '" data-action="filter-staff" data-id="">全部技师</button>' +
        techs.map(function (t) {
          return '<button type="button" class="slot' + (staffId === t.id ? " is-on" : "") + '" data-action="filter-staff" data-id="' + t.id + '">' + ui().h(t.name) + "</button>";
        }).join("") +
      "</div>" +
      (pending.length ? '<div class="notice-strip">有 ' + pending.length + " 张待确认预约，超时将自动释放技师与房间。</div>" : "") +
      (awaitPay.length ? '<div class="notice-strip" style="background:var(--amber-soft);color:#7A5520">有 ' + awaitPay.length + " 张待结算。" +
        ui().link("staff/settle", "去处理") + "</div>" : "") +
      '<div class="section-title"><h2>房间状态</h2>' + ui().link("staff/rooms", "查看房态板") + "</div>" +
      ui().roomBoard(state, now) +
      '<div class="section-title"><h2>' + (date === U().dateStr(now) ? "今日预约" : date + "的预约") + "</h2></div>" +
      (list.length ? '<div class="stack">' + list.map(function (a) { return ui().apptCard(state, a, now); }).join("") + "</div>"
        : ui().empty("这一天暂无预约。"));
  }

  function settle(state, now) {
    var list = state.appointments.filter(function (a) { return a.status === "await_pay"; })
      .sort(function (a, b) { return (a.finishedAt || a.endAt) - (b.finishedAt || b.endAt); });
    return ui().pageHead("店员", "待结算清单", "服务已完成，等待核销。同一笔不能重复核销。") +
      (list.length ? '<div class="stack">' + list.map(function (a) { return ui().apptCard(state, a, now); }).join("") + "</div>"
        : ui().empty("当前没有待结算的预约。"));
  }

  function appointmentDetail(state, id, now) {
    return WF.views.customer.appointmentDetail(state, id, now) +
      (function () {
        var a = U().byId(state.appointments, id);
        if (!a) return "";
        var cust = U().byId(state.users, a.customerId);
        var cards = state.cards.filter(function (c) { return c.customerId === a.customerId; });
        return '<div class="card" style="margin-top:12px"><h3>顾客</h3>' +
          '<div class="soft" style="margin-top:6px">' + ui().h(cust ? cust.name + " · " + cust.phone : "") + "</div>" +
          '<div class="tiny muted">来源：' + ui().h(cust && cust.source ? cust.source : "未填写") + "（写入后店员不可改）</div>" +
          (cards.length ? '<div class="tiny" style="margin-top:8px">次卡：' + cards.map(function (c) {
            return ui().h(c.name) + " 余 " + c.remaining + " 次";
          }).join("；") + "</div>" : '<div class="tiny muted" style="margin-top:8px">该顾客暂无可用次卡</div>') +
          "</div>";
      })();
  }

  function customers(state) {
    var q = (WF.session.q || "").trim();
    var list = state.users.filter(function (c) {
      if (!q) return true;
      return c.name.indexOf(q) !== -1 || c.phone.indexOf(q) !== -1;
    });
    return ui().pageHead("店员", "查询顾客", "可按姓名或手机号查找。店员不能发放或直接改次卡次数。") +
      '<div class="card"><label class="field">姓名或手机号<input class="input" data-sync="q" value="' + ui().h(q) + '" placeholder="例如 林澄 或 13800001001"></label>' +
      '<div style="margin-top:10px">' + ui().btn("search-cust", "查询", "btn-primary") + "</div></div>" +
      '<div class="stack" style="margin-top:12px">' + list.map(function (c) {
        return '<a class="card pressable card-row" href="#/staff/customer/' + c.id + '">' + ui().avatar(c.name) +
          '<div class="grow"><h3>' + ui().h(c.name) + "</h3><div class=\"tiny muted\">" + ui().h(c.phone) + "</div></div></a>";
      }).join("") + "</div>";
  }

  function customerDetail(state, id, now) {
    var c = U().byId(state.users, id);
    if (!c) return ui().empty("找不到该顾客");
    var cards = state.cards.filter(function (x) { return x.customerId === id; });
    var apts = state.appointments.filter(function (a) { return a.customerId === id; })
      .sort(function (a, b) { return b.startAt - a.startAt; });
    var cons = state.consumptions.filter(function (x) { return x.customerId === id; });
    var prefix = state.currentRole === "owner" ? "boss" : "staff";
    return ui().pageHead("顾客档案", c.name, c.phone) +
      '<div class="card"><div class="kvs">' +
      '<div class="k">来源</div><div>' + ui().h(c.source || "未填写") + (c.sourceLocked ? "（已锁定）" : "") + "</div>" +
      '<div class="k">首次消费</div><div>' + (c.firstConsumedAt ? U().dateTimeStr(c.firstConsumedAt) : "尚未转化") + "</div>" +
      "</div></div>" +
      '<div class="section-title"><h2>次卡余次</h2></div>' +
      (cards.length ? '<div class="stack">' + cards.map(function (card) {
        return '<div class="card"><div class="row-between"><strong>' + ui().h(card.name) + "</strong><span class=\"price\">余 " + card.remaining + " / " + card.total + "</span></div>" +
          '<div class="tiny muted">有效期至 ' + U().dateStr(card.expiresAt) + "</div></div>";
      }).join("") + "</div>" : ui().empty("暂无次卡")) +
      (state.currentRole === "owner" ? '<div style="margin-top:12px">' + ui().go("boss/cards?customer=" + id, "发放演示次卡", "btn btn-primary") + "</div>" : "") +
      '<div class="section-title"><h2>历史预约</h2></div>' +
      (apts.length ? '<div class="stack">' + apts.slice(0, 8).map(function (a) { return ui().apptCard(state, a, now); }).join("") + "</div>" : ui().empty("暂无预约")) +
      '<div class="section-title"><h2>消费记录</h2></div>' +
      (cons.length ? '<div class="stack">' + cons.map(function (x) {
        return '<div class="card"><div class="row-between"><span>' + ui().h(ui().serviceNames(state, x.items)) + "</span><span class=\"price\">" +
          (x.method === "card" ? "次卡 ×" + x.timesUsed : ui().money(x.amountFen)) + "</span></div></div>";
      }).join("") + "</div>" : ui().empty("暂无消费"));
  }

  function schedule(state, now) {
    var me = U().byId(state.staff, state.currentStaffId);
    var techs = state.staff.filter(function (s) { return s.role === "technician" && s.active; });
    var start = U().startOfDay(now);
    var days = [];
    for (var i = 0; i < 7; i++) days.push(U().addDays(start, i));
    var rows = techs.map(function (t) {
      var cells = days.map(function (ms) {
        var win = WF.rules.staffWindow(state, t.id, ms);
        if (win.off) return '<td class="tiny muted">休</td>';
        return '<td class="tiny">' + U().timeStr(win.start) + "–" + U().timeStr(win.end) + "</td>";
      }).join("");
      return "<tr><th>" + ui().h(t.name) + "</th>" + cells + "</tr>";
    }).join("");
    var myApts = state.appointments.filter(function (a) {
      return a.staffId === state.currentStaffId && a.startAt >= start;
    });
    var intro = (me && me.role === "clerk")
      ? "当前身份为前台店员，无技师排班。以下为全店技师本周排班（只读）。店员不能修改排班规则。"
      : "查看自己的排班与已接预约。修改排班请到老板端。";
    return ui().pageHead("店员", "我的工作安排", intro) +
      '<div class="card" style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">' +
      "<thead><tr><th></th>" + days.map(function (ms) {
        return "<th class=\"tiny\">" + (U().dateStr(ms) === U().dateStr(now) ? "今天" : U().weekdayName(ms)) + "</th>";
      }).join("") + "</tr></thead><tbody>" + rows + "</tbody></table></div>" +
      (me && me.role !== "clerk" ? '<div class="section-title"><h2>我已接的预约</h2></div>' +
        (myApts.length ? '<div class="stack">' + myApts.map(function (a) { return ui().apptCard(state, a, now); }).join("") + "</div>" : ui().empty("暂无")) : "");
  }

  function rooms(state, now) {
    return ui().pageHead("店员", "房间状态板", "空闲 / 已占用 / 清扫缓冲。已到店或服务中的房间会显示「已占用」，直到完成并进入清扫缓冲。默认缓冲 " + state.shop.bufferMin + " 分钟（建议方案，尚未锁定）。") +
      ui().roomBoard(state, now) +
      '<p class="tiny muted" style="margin-top:14px">房间与技师锁相互独立，各有唯一占用 ID。店员可查看房态，但不能改房间配置。</p>';
  }

  function me(state) {
    var s = U().byId(state.staff, state.currentStaffId);
    return ui().pageHead("店员", s ? s.name : "店员", "当前为店员演示身份，不能把自己提成馆主。") +
      '<div class="card stack">' +
        ui().link("staff/today", "今日预约", "btn") +
        ui().link("staff/settle", "待结算清单", "btn") +
        ui().link("staff/rooms", "房间状态板", "btn") +
        ui().link("staff/customers", "查询顾客", "btn") +
        ui().link("staff/schedule", "工作安排", "btn") +
        ui().link("guide", "体验说明（给审核人）", "btn btn-amber") +
      "</div>" +
      '<div class="callout warn" style="margin-top:16px">店员不能修改项目价格、排班、房间配置，也不能发放次卡或查看全店经营看板的写操作入口。老板功能不会在此露出。</div>';
  }

  WF.views = WF.views || {};
  WF.views.staff = {
    today: today,
    settle: settle,
    appointmentDetail: appointmentDetail,
    customers: customers,
    customerDetail: customerDetail,
    schedule: schedule,
    rooms: rooms,
    me: me
  };
})(typeof window !== "undefined" ? window : global);
