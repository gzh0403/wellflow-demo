/* WellFlow P2 — owner / boss views. Classic script. */
(function (root) {
  var WF = root.WF = root.WF || {};
  function U() { return WF.utils; }
  function ui() { return WF.ui; }

  function dashboard(state, now) {
    var d = WF.rules.dashboard(state, now);
    var metrics = [
      { n: d.appointmentCount, l: "今日预约" },
      { n: d.arrivedCount, l: "今日已到店" },
      { n: d.doneCount, l: "今日已完成（核销）" },
      { n: ui().money(d.revenueFen), l: "今日营收（模拟）" },
      { n: d.pendingCount, l: "当前待确认" },
      { n: d.awaitPayCount, l: "当前待结算" },
      { n: d.newCustomerCount, l: "今日新客（首次核销）" },
      { n: d.cardRedeemCount, l: "今日次卡核销笔数" }
    ];
    var labels = WF.STATUS_LABEL;
    var sc = Object.keys(labels).map(function (k) {
      var n = (d.statusCount && d.statusCount[k]) || 0;
      if (!n) return "";
      return '<span class="pill pill-' + k + '">' + ui().h(labels[k]) + " " + n + "</span>";
    }).join(" ");
    return ui().pageHead("老板", "经营看板", "八项指标均按演示数据动态计算，禁止写死。日期以 Asia/Shanghai 为准。") +
      '<div class="grid-4">' + metrics.map(function (m) {
        return '<div class="metric"><div class="n">' + m.n + '</div><div class="l">' + ui().h(m.l) + "</div></div>";
      }).join("") + "</div>" +
      '<div class="section-title"><h2>今日预约状态分布</h2></div>' +
      '<div class="cluster">' + (sc || '<span class="muted">今日暂无预约</span>') + "</div>" +
      '<div class="section-title"><h2>房间状态</h2>' + ui().link("boss/rooms", "房间管理") + "</div>" +
      ui().roomBoard(state, now) +
      '<div class="section-title"><h2>今日预约</h2>' + ui().link("boss/appointments", "全部预约") + "</div>" +
      (d.todayAppointments.length
        ? '<div class="stack">' + d.todayAppointments.map(function (a) { return ui().apptCard(state, a, now); }).join("") + "</div>"
        : ui().empty("今日暂无预约"));
  }

  function appointments(state, now) {
    var date = WF.session.date || U().dateStr(now);
    var stFilter = WF.session.filterStatus || "";
    var staffId = WF.session.filterStaff || "";
    var start = U().atTime(date, "00:00");
    var end = U().addDays(start, 1);
    var list = state.appointments.filter(function (a) { return a.startAt >= start && a.startAt < end; });
    if (stFilter) list = list.filter(function (a) { return a.status === stFilter; });
    if (staffId) list = list.filter(function (a) { return a.staffId === staffId; });
    list.sort(function (a, b) { return a.startAt - b.startAt; });
    var techs = state.staff.filter(function (s) { return s.role === "technician"; });
    return ui().pageHead("老板", "预约管理", "与店员共用同一处理流程，数据三端共享。") +
      ui().dateTabs(date, now) +
      '<div class="filter-row" style="margin-top:12px">' +
        '<button type="button" class="slot' + (!stFilter ? " is-on" : "") + '" data-action="filter-status" data-id="">全部状态</button>' +
        Object.keys(WF.STATUS_LABEL).map(function (k) {
          return '<button type="button" class="slot' + (stFilter === k ? " is-on" : "") + '" data-action="filter-status" data-id="' + k + '">' + ui().h(WF.STATUS_LABEL[k]) + "</button>";
        }).join("") +
      "</div>" +
      '<div class="filter-row">' +
        '<button type="button" class="slot' + (!staffId ? " is-on" : "") + '" data-action="filter-staff" data-id="">全部技师</button>' +
        techs.map(function (t) {
          return '<button type="button" class="slot' + (staffId === t.id ? " is-on" : "") + '" data-action="filter-staff" data-id="' + t.id + '">' + ui().h(t.name) + "</button>";
        }).join("") +
      "</div>" +
      (list.length ? '<div class="stack">' + list.map(function (a) { return ui().apptCard(state, a, now); }).join("") + "</div>" : ui().empty("没有符合筛选的预约。"));
  }

  function services(state) {
    return ui().pageHead("经营", "服务项目", "可新增、编辑、上下架、调价与时长。") +
      '<div style="margin-bottom:12px">' + ui().btn("edit-service", "新增项目", "btn-primary", 'data-id=""') + "</div>" +
      '<div class="stack">' + state.services.map(function (s) {
        return '<div class="card"><div class="row-between"><div><div class="cluster"><span class="chip chip-cat">' + ui().h(s.category) + "</span>" +
          (s.onSale ? '<span class="chip chip-on">在架</span>' : '<span class="chip">已下架</span>') + "</div>" +
          "<h3 style=\"margin-top:6px\">" + ui().h(s.name) + "</h3>" +
          '<div class="tiny muted">' + s.durationMin + " 分钟 · " + ui().money(s.priceFen) + "</div></div>" +
          ui().btn("edit-service", "编辑", "btn-sm", 'data-id="' + s.id + '"') +
          "</div></div>";
      }).join("") + "</div>";
  }

  function staffPage(state) {
    return ui().pageHead("经营", "员工与技师", "可编辑资料、擅长项目与默认房间。排班在下一页。") +
      '<div style="margin-bottom:12px">' + ui().btn("edit-staff", "新增技师", "btn-primary", 'data-id="" data-role="technician"') + "</div>" +
      '<div class="stack">' + state.staff.filter(function (s) { return s.role === "technician"; }).map(function (t) {
        return '<div class="card card-row">' + ui().avatar(t.name) +
          '<div class="grow"><h3>' + ui().h(t.name) + (t.active ? "" : " <span class=\"tiny muted\">已停用</span>") + "</h3>" +
          '<div class="tiny soft">' + ui().h(t.title) + " · 默认 " + ui().h(ui().roomName(state, t.defaultRoomId)) + "</div></div>" +
          ui().btn("edit-staff", "编辑", "btn-sm", 'data-id="' + t.id + '"') + "</div>";
      }).join("") + "</div>" +
      '<div class="section-title"><h2>排班</h2></div>' +
      ui().go("boss/schedule", "进入排班与临时占用", "btn");
  }

  function schedule(state, now) {
    var staffId = WF.session.scheduleStaff || (state.staff.filter(function (s) { return s.role === "technician"; })[0] || {}).id;
    var t = U().byId(state.staff, staffId);
    var techs = state.staff.filter(function (s) { return s.role === "technician"; });
    var days = [{ name: "周一", w: 1 }, { name: "周二", w: 2 }, { name: "周三", w: 3 }, { name: "周四", w: 4 }, { name: "周五", w: 5 }, { name: "周六", w: 6 }, { name: "周日", w: 0 }];
    var rows = days.map(function (day) {
      var name = day.name, w = day.w;
      var sch = (state.schedules || []).filter(function (s) { return s.staffId === staffId && s.type === "weekly" && s.weekday === w; })[0]
        || { off: true, start: "10:00", end: "22:00", breaks: [] };
      var br = (sch.breaks && sch.breaks[0]) || { start: "", end: "" };
      return '<div class="card" style="padding:12px"><div class="row-between"><strong>' + name + "</strong>" +
        '<label class="tiny cluster"><input type="checkbox" data-sch="off" data-w="' + w + '"' + (sch.off ? " checked" : "") + "> 休息</label></div>" +
        '<div class="grid-2" style="margin-top:8px">' +
        '<label class="field tiny">开始<input data-sch="start" data-w="' + w + '" value="' + ui().h(sch.start) + '" placeholder="10:00"></label>' +
        '<label class="field tiny">结束<input data-sch="end" data-w="' + w + '" value="' + ui().h(sch.end) + '" placeholder="22:00"></label>' +
        '<label class="field tiny">休息开始<input data-sch="brs" data-w="' + w + '" value="' + ui().h(br.start) + '" placeholder="可选"></label>' +
        '<label class="field tiny">休息结束<input data-sch="bre" data-w="' + w + '" value="' + ui().h(br.end) + '" placeholder="可选"></label>' +
        "</div></div>";
    }).join("");
    return ui().pageHead("经营", "技师排班", "按星期设置上班与休息。预约只能选择在排班内且无冲突的时段。") +
      '<div class="filter-row">' + techs.map(function (x) {
        return '<button type="button" class="slot' + (staffId === x.id ? " is-on" : "") + '" data-action="schedule-staff" data-id="' + x.id + '">' + ui().h(x.name) + "</button>";
      }).join("") + "</div>" +
      (t ? "<h3 style=\"margin:8px 0 12px\">" + ui().h(t.name) + "的周排班</h3>" : "") +
      '<form data-form="schedule" data-staff="' + ui().h(staffId) + '">' + rows +
      '<div style="margin-top:12px">' + ui().btn("save-schedule", "保存排班", "btn-primary btn-block") + "</div></form>" +
      '<div class="section-title"><h2>临时占用</h2></div>' +
      '<div class="card"><p class="tiny soft">用于请假或培训等，占用时段内该技师不可被预约。</p>' +
      '<div class="grid-2" style="margin-top:10px">' +
      '<label class="field">日期<input data-block="date" type="text" placeholder="YYYY-MM-DD" value="' + U().dateStr(now) + '"></label>' +
      '<label class="field">技师<select data-block="staff">' + techs.map(function (x) {
        return '<option value="' + x.id + '">' + ui().h(x.name) + "</option>";
      }).join("") + "</select></label>" +
      '<label class="field">开始<input data-block="start" placeholder="14:00" value="14:00"></label>' +
      '<label class="field">结束<input data-block="end" placeholder="16:00" value="16:00"></label>' +
      '</div><label class="field" style="margin-top:8px">原因<input data-block="reason" placeholder="例如：培训"></label>' +
      '<div style="margin-top:10px">' + ui().btn("add-block", "添加临时占用", "btn") + "</div></div>" +
      ((state.blocks || []).length ? '<div class="stack" style="margin-top:12px">' + state.blocks.map(function (b) {
        return '<div class="card tiny">' + ui().h(ui().staffName(state, b.staffId)) + " · " +
          U().dateTimeStr(b.startAt) + "–" + U().timeStr(b.endAt) + " · " + ui().h(b.reason) + "</div>";
      }).join("") + "</div>" : "") +
      '<div class="section-title"><h2>指定日期排班（覆盖周循环）</h2></div>' +
      '<div class="card"><p class="tiny soft">用于某天休息或临时调整上下班时间，将覆盖该技师当天的周排班。</p>' +
      '<div class="grid-2" style="margin-top:10px">' +
      '<label class="field">日期<input data-ds="date" value="' + U().dateStr(now) + '"></label>' +
      '<label class="field">技师<select data-ds="staff">' + techs.map(function (x) {
        return '<option value="' + x.id + '">' + ui().h(x.name) + "</option>";
      }).join("") + "</select></label>" +
      '<label class="field">开始<input data-ds="start" value="10:00"></label>' +
      '<label class="field">结束<input data-ds="end" value="22:00"></label></div>' +
      '<label class="cluster" style="margin-top:8px"><input type="checkbox" data-ds="off"> 这一天休息</label>' +
      '<div style="margin-top:10px">' + ui().btn("save-date-schedule", "保存该日排班", "btn") + "</div></div>";
  }

  function rooms(state, now) {
    return ui().pageHead("经营", "房间管理", "首版一间房一把锁。可维护名称与启用状态。已到店或服务中显示「已占用」。清扫缓冲为建议方案，尚未锁定。") +
      ui().roomBoard(state, now) +
      '<div class="section-title"><h2>房间资料</h2></div>' +
      '<div style="margin-bottom:12px">' + ui().btn("edit-room", "新增房间", "btn-primary", 'data-id=""') + "</div>" +
      '<div class="stack">' + state.rooms.map(function (r) {
        return '<div class="card row-between"><div><h3>' + ui().h(r.name) + "</h3>" +
          '<div class="tiny muted">' + ui().h(r.floor || "") + (r.enabled ? " · 启用中" : " · 已停用") +
          (r.note ? " · " + ui().h(r.note) : "") + "</div></div>" +
          ui().btn("edit-room", "编辑", "btn-sm", 'data-id="' + r.id + '"') + "</div>";
      }).join("") + "</div>";
  }

  function customers(state, now, query) {
    query = query || {};
    var preselect = query.customer || "";
    return ui().pageHead("经营", "顾客与次卡", "可查看档案、发放演示次卡与流水。不提供无凭证的直接改次数。") +
      '<div class="stack">' + state.users.map(function (c) {
        var cards = state.cards.filter(function (x) { return x.customerId === c.id && x.status === "active"; });
        var rem = cards.reduce(function (n, x) { return n + x.remaining; }, 0);
        return '<a class="card pressable card-row" href="#/boss/customer/' + c.id + '">' + ui().avatar(c.name) +
          '<div class="grow"><h3>' + ui().h(c.name) + "</h3>" +
          '<div class="tiny muted">' + ui().h(c.phone) + " · 来源 " + ui().h(c.source || "未填写") + " · 在用次卡余次 " + rem + "</div></div></a>";
      }).join("") + "</div>" +
      '<div class="section-title"><h2>发放演示次卡</h2></div>' +
      '<div class="card"><form data-form="issue-card">' +
      '<label class="field">顾客<select name="customerId">' + state.users.map(function (c) {
        return '<option value="' + c.id + '"' + (preselect === c.id ? " selected" : "") + ">" + ui().h(c.name) + "</option>";
      }).join("") + "</select></label>" +
      '<label class="field" style="margin-top:8px">次卡名称<input name="name" value="足部舒缓次卡"></label>' +
      '<div class="grid-2" style="margin-top:8px">' +
      '<label class="field">次数<input name="total" value="5"></label>' +
      '<label class="field">有效月数<input name="validMonths" value="6"></label></div>' +
      '<label class="field" style="margin-top:8px">适用项目<select name="serviceId">' +
        '<option value="svc_foot">足部舒缓护理</option>' +
        '<option value="svc_neck">肩颈深层松解</option>' +
        '<option value="all">全部在架项目</option></select></label>' +
      '<div style="margin-top:12px">' + ui().btn("issue-card", "发放演示次卡", "btn-primary btn-block") + "</div>" +
      '<p class="tiny muted" style="margin-top:8px">此操作只写入演示数据，不是真实售卡。</p></form></div>';
  }

  function stats(state, now) {
    var d = WF.rules.dashboard(state, now);
    var sources = Object.keys(d.sources).map(function (k) { return d.sources[k]; });
    var cons = (state.consumptions || []).slice().sort(function (a, b) { return b.createdAt - a.createdAt; });
    var converted = state.users.filter(function (u) { return !!u.firstConsumedAt; }).length;
    return ui().pageHead("经营", "消费与统计", "推荐来源仅在首次核销后计为有效转化；不能推荐自己。") +
      '<div class="grid-2"><div class="metric"><div class="n">' + converted + '</div><div class="l">已转化顾客</div></div>' +
      '<div class="metric"><div class="n">' + (state.users.length - converted) + '</div><div class="l">尚未转化</div></div></div>' +
      '<div class="section-title"><h2>推荐来源</h2></div>' +
      '<div class="stack">' + sources.map(function (s) {
        return '<div class="card row-between"><div><strong>' + ui().h(s.source) + "</strong>" +
          '<div class="tiny muted">' + s.people + " 人记录来源，" + s.converted + " 人已首次核销</div></div></div>";
      }).join("") + "</div>" +
      '<div class="section-title"><h2>全店消费清单</h2></div>' +
      (cons.length ? '<div class="stack">' + cons.map(function (c) {
        return '<div class="card"><div class="row-between"><div>' + ui().h(ui().customerName(state, c.customerId)) + " · " +
          ui().h(ui().serviceNames(state, c.items)) + "</div><div class=\"price\">" +
          (c.method === "card" ? "次卡 ×" + c.timesUsed : ui().money(c.amountFen)) + "</div></div>" +
          '<div class="tiny muted">' + U().dateTimeStr(c.createdAt) + "</div></div>";
      }).join("") + "</div>" : ui().empty("暂无消费记录"));
  }

  function settings(state) {
    var s = state.shop;
    return ui().pageHead("设置", "营业规则与门店资料", "确认方式与清扫缓冲可在演示中切换，两种确认路径都要能走通。") +
      ui().draftHint("演示店名「澄石养生馆」、视觉方向、默认需要确认、清扫缓冲 15 分钟均为建议方案，尚未锁定。可在本页试用，不代表已定稿。") +
      '<div class="card"><form data-form="shop">' +
      '<label class="field">门店名称<input name="name" value="' + ui().h(s.name) + '"></label>' +
      '<label class="field" style="margin-top:8px">口号<input name="slogan" value="' + ui().h(s.slogan) + '"></label>' +
      '<label class="field" style="margin-top:8px">地址<input name="address" value="' + ui().h(s.address) + '"></label>' +
      '<label class="field" style="margin-top:8px">电话<input name="phone" value="' + ui().h(s.phone) + '"></label>' +
      '<label class="field" style="margin-top:8px">公告<textarea name="announcement">' + ui().h(s.announcement) + "</textarea></label>" +
      '<div class="divider"></div>' +
      "<h3>确认方式</h3>" +
      '<div class="stack" style="margin:10px 0">' +
        '<button type="button" class="option' + (s.confirmMode === "manual" ? " is-on" : "") + '" data-action="set-confirm" data-mode="manual">' +
          '<span class="check">' + (s.confirmMode === "manual" ? ui().icon("check") : "") + "</span>" +
          "<div><strong>需要确认</strong><div class=\"tiny muted\">提交后进入待确认，超时将释放技师与房间。此为建议默认，尚未锁定。</div></div></button>" +
        '<button type="button" class="option' + (s.confirmMode === "auto" ? " is-on" : "") + '" data-action="set-confirm" data-mode="auto">' +
          '<span class="check">' + (s.confirmMode === "auto" ? ui().icon("check") : "") + "</span>" +
          "<div><strong>自动确认</strong><div class=\"tiny muted\">提交后直接变为已确认。</div></div></button>" +
      "</div>" +
      '<div class="grid-2">' +
      '<label class="field">确认超时（分钟）<input name="confirmTimeoutMin" value="' + s.confirmTimeoutMin + '"></label>' +
      '<label class="field">清扫缓冲（分钟）<input name="bufferMin" value="' + s.bufferMin + '"></label>' +
      '<label class="field">顾客取消提前量（分钟）<input name="cancelAdvanceMin" value="' + s.cancelAdvanceMin + '"></label>' +
      '<label class="field">可选开始步长（分钟）<input name="slotStepMin" value="' + s.slotStepMin + '"></label>' +
      "</div>" +
      '<p class="tiny muted" style="margin:10px 0">清扫缓冲建议为 15 分钟（尚未锁定）：服务结束后房间进入缓冲，缓冲期内不可再被预约或分配。技师锁不含缓冲，房间锁与技师锁相互独立。</p>' +
      ui().btn("save-shop", "保存设置", "btn-primary btn-block") +
      "</form></div>" +
      '<p class="tiny muted" style="margin-top:12px">' + ui().h(s.visualNote) + "</p>";
  }

  function people(state) {
    return ui().pageHead("设置", "身份与权限", "禁止空表自称。店员不能把自己提成馆主。正式环境不会用演示角色切换开通。") +
      '<div class="stack">' + state.staffAccounts.map(function (a) {
        return '<div class="card row-between"><div><h3>' + ui().h(a.name) + "</h3>" +
          '<div class="tiny muted">' + (a.role === "owner" ? "馆主" : "店员") + (a.active ? " · 启用" : " · 已停用") + "</div></div>" +
          (a.role === "owner" ? '<span class="tiny muted">馆主不可停用</span>' :
            ui().btn("toggle-clerk", a.active ? "停用" : "启用", "btn-sm", 'data-id="' + a.id + '" data-active="' + (a.active ? "0" : "1") + '"')) +
          "</div>";
      }).join("") + "</div>" +
      '<div class="section-title"><h2>添加店员</h2></div>' +
      '<div class="card"><label class="field">姓名<input data-clerk-name placeholder="虚构店员姓名"></label>' +
      '<div style="margin-top:10px">' + ui().btn("add-clerk", "添加店员（仅店员身份）", "btn-primary") + "</div>" +
      '<p class="tiny muted" style="margin-top:8px">此处只能添加店员，不能添加或自封馆主。</p></div>' +
      '<div class="callout warn">不采用「管理员名单还是空的时候，第一个打开页面的人自动成为老板」。本演示用顶部角色切换预置虚拟账号，这不是正式产品的开通方式。</div>';
  }

  function manage(state) {
    return ui().pageHead("经营", "经营配置", "项目、员工排班、房间、顾客次卡与统计。") +
      '<div class="stack">' +
        ui().link("boss/services", "服务项目管理", "btn") +
        ui().link("boss/staff", "员工资料", "btn") +
        ui().link("boss/schedule", "技师排班与临时占用", "btn") +
        ui().link("boss/rooms", "房间管理与房态", "btn") +
        ui().link("boss/customers", "顾客、会员与次卡", "btn") +
        ui().link("boss/stats", "消费记录与推荐来源", "btn") +
      "</div>";
  }

  function settingHub(state) {
    return ui().pageHead("设置", "设置", "") +
      '<div class="stack">' +
        ui().link("boss/settings", "营业规则与门店资料", "btn") +
        ui().link("boss/people", "身份与权限", "btn") +
        ui().link("guide", "体验说明（给审核人）", "btn btn-amber") +
      "</div>";
  }

  WF.views = WF.views || {};
  WF.views.boss = {
    dashboard: dashboard,
    appointments: appointments,
    appointmentDetail: function (state, id, now) { return WF.views.staff.appointmentDetail(state, id, now); },
    services: services,
    staffPage: staffPage,
    schedule: schedule,
    rooms: rooms,
    customers: customers,
    customerDetail: function (state, id, now) { return WF.views.staff.customerDetail(state, id, now); },
    stats: stats,
    settings: settings,
    people: people,
    manage: manage,
    settingHub: settingHub
  };
})(typeof window !== "undefined" ? window : global);
