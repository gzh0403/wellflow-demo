/* WellFlow P2 — customer views. Classic script. */
(function (root) {
  var WF = root.WF = root.WF || {};

  function U() { return WF.utils; }
  function ui() { return WF.ui; }

  function saleServices(state) {
    return (state.services || []).filter(function (s) { return s.onSale; });
  }

  function home(state, now) {
    var shop = state.shop;
    var featured = saleServices(state).filter(function (s) { return s.featured; });
    var techs = state.staff.filter(function (s) { return s.role === "technician" && s.active; });
    var mine = state.appointments.filter(function (a) {
      return a.customerId === state.currentUserId && ["pending", "confirmed", "arrived", "in_service", "await_pay"].indexOf(a.status) !== -1;
    }).sort(function (a, b) { return a.startAt - b.startAt; });
    var upcoming = "";
    if (mine.length) {
      upcoming = '<div class="stack">' +
        '<div class="notice-strip">您有 ' + mine.length + " 张进行中的预约。" +
        ui().link("customer/appointments", "查看我的预约") + "</div>" +
        mine.map(function (a) { return ui().apptCard(state, a, now); }).join("") +
        "</div>";
    }
    return ui().pageHead("WELLFLOW 演示样品", shop.name, "建议方案，尚未锁定") +
      '<div class="hero">' + ui().decoSvg() +
      '<div class="badge-demo">演示样品 · 虚拟数据 · 非真实经营数据</div>' +
      "<h1 style=\"margin-top:12px\">" + ui().h(shop.name) + "</h1>" +
      '<div class="slogan">' + ui().h(shop.slogan) + "</div>" +
      ui().draftHint("演示店名「澄石养生馆」、视觉方向与默认营业规则均为建议方案，尚未锁定。") +
      '<div class="meta">' + ui().h(shop.hoursText) + "<br>" + ui().h(shop.address) + "</div>" +
      '<div class="hero-actions">' +
        ui().go("customer/book", "开始预约", "btn btn-primary") +
        ui().go("customer/shop", "了解门店", "btn btn-ghost") +
      "</div></div>" +
      (shop.announcement ? '<div class="card" style="margin-top:14px"><div class="tiny muted">公告</div><div>' + ui().h(shop.announcement) + "</div></div>" : "") +
      (upcoming ? '<div class="section-title"><h2>进行中的预约</h2></div>' + upcoming : "") +
      '<div class="section-title"><h2>推荐项目</h2>' + ui().link("customer/services", "全部项目") + "</div>" +
      '<div class="stack">' + featured.map(function (s) {
        return '<a class="card pressable card-row" href="#/customer/service/' + s.id + '">' +
          '<div class="grow"><div class="cluster"><span class="chip chip-cat">' + ui().h(s.category) + "</span><span class=\"tiny muted\">" + s.durationMin + " 分钟</span></div>" +
          "<h3 style=\"margin-top:6px\">" + ui().h(s.name) + "</h3></div>" +
          '<div class="price">' + ui().money(s.priceFen) + "</div></a>";
      }).join("") + "</div>" +
      '<div class="section-title"><h2>在职技师</h2>' + ui().link("customer/staff", "全部技师") + "</div>" +
      '<div class="grid-2">' + techs.map(function (t) {
        return '<a class="card pressable" href="#/customer/staff/' + t.id + '"><div class="card-row">' +
          ui().avatar(t.name) + '<div class="grow"><h3>' + ui().h(t.name) + "</h3>" +
          '<div class="tiny soft">' + ui().h(t.title) + "</div></div></div></a>";
      }).join("") + "</div>";
  }

  function shop(state) {
    var s = state.shop;
    return ui().pageHead("门店", "馆址与介绍", "虚构演示门店，非真实地址；店名与视觉为建议方案，尚未锁定") +
      '<div class="card"><div class="kvs">' +
      '<div class="k">品牌</div><div>WellFlow · ' + ui().h(s.name) + "</div>" +
      '<div class="k">地址</div><div>' + ui().h(s.address) + "</div>" +
      '<div class="k">电话</div><div>' + ui().h(s.phone) + "</div>" +
      '<div class="k">营业</div><div>' + ui().h(s.hoursText) + "</div>" +
      "</div><div class=\"divider\"></div><p class=\"soft\">" + ui().h(s.intro) + "</p>" +
      '<p class="tiny muted" style="margin-top:10px">' + ui().h(s.visualNote) + "</p></div>" +
      '<div style="margin-top:14px">' + ui().go("customer/book", "开始预约", "btn btn-primary btn-block") + "</div>";
  }

  function services(state) {
    var list = saleServices(state);
    var cats = [];
    list.forEach(function (s) { if (cats.indexOf(s.category) === -1) cats.push(s.category); });
    return ui().pageHead("预约", "服务项目", "先选项目，再选技师与时段。预约无需提前付款。") +
      cats.map(function (cat) {
        var items = list.filter(function (s) { return s.category === cat; });
        return '<div class="section-title"><h2>' + ui().h(cat) + "</h2></div><div class=\"stack\">" +
          items.map(function (s) {
            return '<a class="card pressable card-row" href="#/customer/service/' + s.id + '">' +
              '<div class="grow"><h3>' + ui().h(s.name) + "</h3>" +
              '<div class="tiny soft">' + s.durationMin + " 分钟</div></div>" +
              '<div class="price">' + ui().money(s.priceFen) + "</div></a>";
          }).join("") + "</div>";
      }).join("");
  }

  function serviceDetail(state, id) {
    var s = U().byId(state.services, id);
    if (!s) return ui().empty("找不到该项目");
    return ui().pageHead(s.category, s.name, s.durationMin + " 分钟 · " + ui().money(s.priceFen)) +
      '<div class="card"><p class="soft">' + ui().h(s.desc) + "</p>" +
      (s.durationMin % 30 !== 0 ? '<p class="tiny" style="margin-top:10px;color:#7A5520">此时长不是 30 分钟的整数倍。预约将按实际连续区间占用技师，房间在结束后另加清扫缓冲。</p>' : "") +
      "</div>" +
      '<div class="btn-row" style="margin-top:16px">' +
        ui().go("customer/book?service=" + s.id, "预约此项目", "btn btn-primary") +
        ui().go("customer/services", "返回列表", "btn btn-ghost") +
      "</div>";
  }

  function staffList(state) {
    var techs = state.staff.filter(function (s) { return s.role === "technician" && s.active; });
    return ui().pageHead("预约", "在职技师", "首版预约必须指定技师，不做随机派钟。") +
      '<div class="stack">' + techs.map(function (t) {
        var specs = t.specialties.map(function (id) {
          var s = U().byId(state.services, id);
          return s ? s.name : "";
        }).filter(Boolean).join("、");
        return '<a class="card pressable card-row" href="#/customer/staff/' + t.id + '">' +
          ui().avatar(t.name) +
          '<div class="grow"><h3>' + ui().h(t.name) + "</h3>" +
          '<div class="tiny soft">' + ui().h(t.title) + " · 默认 " + ui().h(ui().roomName(state, t.defaultRoomId)) + "</div>" +
          '<div class="tiny muted" style="margin-top:4px">擅长：' + ui().h(specs) + "</div></div></a>";
      }).join("") + "</div>";
  }

  function staffDetail(state, id, now) {
    var t = U().byId(state.staff, id);
    if (!t) return ui().empty("找不到该技师");
    var win = WF.rules.staffWindow(state, t.id, now);
    var hours = win.off ? "今日休息" : (U().timeStr(win.start) + "–" + U().timeStr(win.end));
    var specs = t.specialties.map(function (sid) {
      var s = U().byId(state.services, sid);
      return s && s.onSale ? '<a class="chip chip-cat" href="#/customer/service/' + s.id + '">' + ui().h(s.name) + "</a>" : "";
    }).join(" ");
    return ui().pageHead(t.title, t.name, "默认房间：" + ui().roomName(state, t.defaultRoomId) + " · " + hours) +
      '<div class="card card-row">' + ui().avatar(t.name, "lg") +
      '<div class="grow"><p class="soft">' + ui().h(t.bio) + "</p>" +
      '<div class="cluster" style="margin-top:10px">' + specs + "</div></div></div>" +
      '<div class="btn-row" style="margin-top:16px">' +
        ui().go("customer/book?staff=" + t.id, "预约这位技师", "btn btn-primary") +
        ui().go("customer/staff", "返回列表", "btn btn-ghost") +
      "</div>";
  }

  function draftOf(state, params) {
    var d = WF.session.book || { serviceIds: [], staffId: "", date: "", startAt: 0, source: "" };
    if (params.service && d.serviceIds.indexOf(params.service) === -1) {
      d.serviceIds = d.serviceIds.concat([params.service]);
    }
    if (params.staff) d.staffId = params.staff;
    if (!d.date) d.date = U().dateStr(Date.now());
    WF.session.book = d;
    return d;
  }

  function book(state, params, now) {
    var d = draftOf(state, params);
    var list = saleServices(state);
    var tot = WF.rules.totalsOf(state, d.serviceIds);
    var date = d.date;
    var techs = d.serviceIds.length ? WF.rules.eligibleStaff(state, d.serviceIds, date, now) : [];
    var slots = (d.staffId && d.serviceIds.length) ? WF.rules.listSlots(state, {
      serviceIds: d.serviceIds, staffId: d.staffId, date: date, audience: "customer"
    }, now) : [];
    var openSlots = slots.filter(function (s) { return s.available; });
    var cust = U().byId(state.users, state.currentUserId);
    var needSource = cust && !cust.sourceLocked;

    var step = 1;
    if (d.serviceIds.length) step = 2;
    if (d.serviceIds.length && d.staffId) step = 3;
    if (d.startAt) step = 4;

    var srcOpts = ["朋友推荐", "路过", "微信", "其他"];

    return ui().pageHead("预约", "填写预约", "先预约，后到店结算。无需提前付款。") +
      '<div class="progress"><span class="' + (step >= 1 ? "on" : "") + '"></span><span class="' + (step >= 2 ? "on" : "") + '"></span><span class="' + (step >= 3 ? "on" : "") + '"></span><span class="' + (step >= 4 ? "on" : "") + '"></span></div>' +
      '<div class="card"><h3>1. 选择项目</h3><div class="tiny soft" style="margin:4px 0 10px">可多选，将由同一位技师连续完成。</div>' +
      '<div class="stack">' + list.map(function (s) {
        var on = d.serviceIds.indexOf(s.id) !== -1;
        return '<button type="button" class="option' + (on ? " is-on" : "") + '" data-action="toggle-service" data-id="' + s.id + '">' +
          '<span class="check">' + (on ? ui().icon("check") : "") + "</span>" +
          '<div class="grow"><div class="row-between"><strong>' + ui().h(s.name) + "</strong><span class=\"price\">" + ui().money(s.priceFen) + "</span></div>" +
          '<div class="tiny muted">' + s.durationMin + " 分钟 · " + ui().h(s.category) + "</div></div></button>";
      }).join("") + "</div>" +
      (tot.durationMin ? '<div class="row-between" style="margin-top:12px"><span class="soft">合计 ' + tot.durationMin + " 分钟</span><span class=\"price lg\">" + ui().money(tot.priceFen) + "</span></div>" : "") +
      "</div>" +
      '<div class="card" style="margin-top:12px"><h3>2. 选择日期与技师</h3>' +
      '<div style="margin:12px 0">' + ui().dateTabs(date, now) + "</div>" +
      (d.serviceIds.length ? (techs.length ? '<div class="stack">' + techs.map(function (row) {
        var t = row.staff;
        var on = d.staffId === t.id;
        return '<button type="button" class="option' + (on ? " is-on" : "") + '" data-action="pick-staff" data-id="' + t.id + '">' +
          ui().avatar(t.name, "sm") +
          '<div class="grow"><div class="row-between"><strong>' + ui().h(t.name) + "</strong>" +
          (row.hasSlot ? '<span class="tiny chip chip-on">' + row.slotCount + " 个可约时段</span>" : '<span class="tiny muted">当日无可约空档，可点开查看占用原因</span>') +
          "</div><div class=\"tiny muted\">默认 " + ui().h(ui().roomName(state, t.defaultRoomId)) + "</div></div></button>";
      }).join("") + "</div>" : ui().empty("没有技师能完成所选的全部项目，请减少项目或改选。"))
        : '<p class="tiny muted">请先选择项目。</p>') +
      "</div>" +
      '<div class="card" style="margin-top:12px"><h3>3. 选择开始时间</h3>' +
      '<p class="tiny soft" style="margin:6px 0 10px">按实际时长占用连续区间；房间在服务结束后另有 ' + state.shop.bufferMin + " 分钟清扫缓冲（建议方案，尚未锁定）。被技师预约、房间占用或清扫缓冲挡住的时段仍会列在下面，并标明原因，不会从列表里消失。</p>" +
      (d.staffId ? (slots.length ? '<div class="slots">' + slots.map(function (s) {
        var on = d.startAt === s.startAt;
        if (!s.available) {
          return '<button type="button" class="slot is-blocked" disabled title="' + ui().h(s.reason) + '">' +
            ui().h(s.label) + '<div class="tiny">' + ui().h(s.reasonShort || "不可预约") + "</div></button>";
        }
        return '<button type="button" class="slot' + (on ? " is-on" : "") + '" data-action="pick-slot" data-start="' + s.startAt + '">' + ui().h(s.label) + "</button>";
      }).join("") + "</div>" + (openSlots.length ? "" : '<p class="tiny muted" style="margin-top:8px">该技师当日已无可选空档，上方禁用时段标明了占用或缓冲原因。</p>')
        : ui().empty("该技师当日已无符合时长的空档，请改选日期或技师。"))
        : '<p class="tiny muted">请先选择技师。</p>') +
      "</div>" +
      (needSource ? '<div class="card" style="margin-top:12px"><h3>推荐来源（选填）</h3><p class="tiny soft">仅在尚未记录来源时填写一次，不能推荐自己。</p>' +
        '<div class="slots" style="margin-top:8px">' + srcOpts.map(function (s) {
          return '<button type="button" class="slot' + (d.source === s ? " is-on" : "") + '" data-action="pick-source" data-source="' + ui().h(s) + '">' + ui().h(s) + "</button>";
        }).join("") + "</div></div>" : "") +
      '<div class="card" style="margin-top:12px"><h3>4. 确认提交</h3>' +
      (d.startAt && tot.durationMin && openSlots.some(function (s) { return s.startAt === d.startAt; }) ? '<div class="kvs" style="margin-top:8px">' +
        '<div class="k">项目</div><div>' + ui().h(ui().serviceNames(state, d.serviceIds)) + "</div>" +
        '<div class="k">技师</div><div>' + ui().h(ui().staffName(state, d.staffId)) + "</div>" +
        '<div class="k">房间</div><div>' + ui().h(ui().roomName(state, WF.rules.defaultRoomFor(state, d.staffId))) + "（技师默认房间）</div>" +
        '<div class="k">时间</div><div>' + ui().h(U().friendlyDate(d.startAt, now) + " " + U().timeStr(d.startAt) + "–" + U().timeStr(U().addMin(d.startAt, tot.durationMin))) + "</div>" +
        '<div class="k">时长 / 价格</div><div>' + tot.durationMin + " 分钟 · " + ui().money(tot.priceFen) + "</div>" +
        '<div class="k">确认方式</div><div>' + (state.shop.confirmMode === "auto" ? "本店当前为自动确认" : "本店当前需门店确认，待确认将在 " + state.shop.confirmTimeoutMin + " 分钟后超时释放") + "</div>" +
        '<div class="k">付款</div><div>先预约后结算，本次不需付款</div></div>' : '<p class="tiny muted">请完成前面的选择。</p>') +
      '<div style="margin-top:14px">' +
        ui().btn("submit-book", "提交预约", "btn-primary btn-block", (d.startAt && openSlots.some(function (s) { return s.startAt === d.startAt; })) ? "" : "disabled") +
      "</div></div>";
  }

  function result(state, id, now) {
    var a = U().byId(state.appointments, id);
    if (!a) return ui().empty("找不到预约");
    var auto = a.status === "confirmed" && !a.confirmDeadlineAt;
    return ui().pageHead("提交成功", "预约已收下", auto ? "门店已自动确认。" : "等待门店确认。") +
      '<div class="card" style="text-align:center;padding:28px 16px">' +
      '<div class="mark" style="margin:0 auto 12px">' + ui().icon("check") + "</div>" +
      "<h2>" + (a.status === "confirmed" ? "已确认" : "待门店确认") + "</h2>" +
      '<div class="mono muted" style="margin:8px 0">' + ui().h(a.no) + "</div>" +
      (a.status === "pending" ? ui().countdownHtml(a, now) : "") +
      '<div class="soft" style="margin-top:12px">' + ui().h(ui().serviceNames(state, a.serviceIds)) + "<br>" +
      ui().h(ui().range(a, now)) + "<br>" + ui().h(ui().staffName(state, a.staffId)) + " · " + ui().h(ui().roomName(state, a.roomId)) +
      "</div></div>" +
      '<div class="btn-row" style="margin-top:16px">' +
        ui().go("customer/appointment/" + a.id, "查看详情", "btn btn-primary") +
        ui().go("customer/appointments", "我的预约", "btn btn-ghost") +
      "</div>";
  }

  function appointments(state, now) {
    var list = state.appointments.filter(function (a) { return a.customerId === state.currentUserId; })
      .sort(function (a, b) { return b.startAt - a.startAt; });
    return ui().pageHead("我的", "我的预约", "可查看状态；符合规则时可取消。") +
      (list.length ? '<div class="stack">' + list.map(function (a) { return ui().apptCard(state, a, now); }).join("") + "</div>" : ui().empty("还没有预约。可从项目或技师页开始。"));
  }

  function appointmentDetail(state, id, now) {
    var a = U().byId(state.appointments, id);
    if (!a || (state.currentRole === "customer" && a.customerId !== state.currentUserId)) {
      return ui().empty("找不到这张预约，或当前身份无权查看。");
    }
    return ui().pageHead(a.no, ui().serviceNames(state, a.serviceIds), "") +
      '<div class="card">' +
      '<div class="row-between">' + ui().pill(a.status) + (a.status === "pending" ? ui().countdownHtml(a, now) : "") + "</div>" +
      '<div class="kvs" style="margin-top:14px">' +
      '<div class="k">时间</div><div>' + ui().h(ui().range(a, now)) + "</div>" +
      '<div class="k">技师</div><div>' + ui().h(ui().staffName(state, a.staffId)) + "</div>" +
      '<div class="k">房间</div><div>' + ui().h(ui().roomName(state, a.roomId)) + "</div>" +
      '<div class="k">时长</div><div>' + a.durationMin + " 分钟</div>" +
      '<div class="k">金额</div><div>' + ui().money(a.priceFen) + "（到店结算）</div>" +
      (a.cancelReason ? '<div class="k">原因</div><div>' + ui().h(a.cancelReason) + "</div>" : "") +
      (a.settleMethod ? '<div class="k">结算</div><div>' + (a.settleMethod === "card" ? "次卡核销" : "模拟到店付款") + "</div>" : "") +
      "</div>" + ui().actionButtons(state, a) + ui().settledNotice(state, a) + "</div>";
  }

  function member(state, now) {
    var cust = U().byId(state.users, state.currentUserId);
    var cards = state.cards.filter(function (c) { return c.customerId === state.currentUserId; });
    var cons = state.consumptions.filter(function (c) { return c.customerId === state.currentUserId; })
      .sort(function (a, b) { return b.createdAt - a.createdAt; });
    return ui().pageHead("会员", "次卡与权益", "演示购卡不会发生真实支付。") +
      '<div class="card card-row">' + ui().avatar(cust.name, "lg") +
      '<div><h2>' + ui().h(cust.name) + "</h2>" +
      '<div class="tiny soft">' + ui().h(cust.phone) + "</div>" +
      '<div class="tiny muted">推荐来源：' + ui().h(cust.source || "尚未填写") +
      (cust.firstConsumedAt ? " · 已产生首次消费" : " · 尚未形成有效转化") + "</div></div></div>" +
      '<div class="section-title"><h2>我的次卡</h2></div>' +
      (cards.length ? '<div class="stack">' + cards.map(function (c) {
        var scope = c.serviceIds === "all" ? "全部在架项目" : ui().serviceNames(state, c.serviceIds);
        return '<div class="card"><div class="row-between"><h3>' + ui().h(c.name) + "</h3>" +
          '<div class="price lg">' + c.remaining + "<span class=\"tiny muted\"> / " + c.total + "</span></div></div>" +
          '<div class="tiny soft" style="margin-top:6px">适用范围：' + ui().h(scope) + "</div>" +
          '<div class="tiny muted">有效期至 ' + U().dateStr(c.expiresAt) + (c.status === "exhausted" ? " · 已用尽" : "") + "</div></div>";
      }).join("") + "</div>" : ui().empty("暂无次卡")) +
      '<div class="section-title"><h2>演示购卡</h2></div>' +
      '<div class="card"><p class="soft">以下为演示套餐，点击后直接入账到您的次卡余额，不会扣款。</p>' +
      '<div class="stack" style="margin-top:12px">' +
        '<div class="row-between"><div><strong>足部舒缓 5 次卡</strong><div class="tiny muted">限足部舒缓护理 · 6 个月</div></div>' +
          ui().btn("buy-card", "演示购入", "btn-primary btn-sm", 'data-pack="foot"') + "</div>" +
        '<div class="row-between"><div><strong>肩颈松解 3 次卡</strong><div class="tiny muted">限肩颈深层松解 · 6 个月</div></div>' +
          ui().btn("buy-card", "演示购入", "btn-primary btn-sm", 'data-pack="neck"') + "</div>" +
      "</div></div>" +
      '<div class="section-title"><h2>消费记录</h2></div>' +
      (cons.length ? '<div class="stack">' + cons.map(function (c) {
        return '<div class="card"><div class="row-between"><div>' + ui().h(ui().serviceNames(state, c.items)) +
          '</div><div class="price">' + (c.method === "card" ? "次卡 ×" + c.timesUsed : ui().money(c.amountFen)) + "</div></div>" +
          '<div class="tiny muted">' + ui().h(U().dateTimeStr(c.createdAt)) + "</div></div>";
      }).join("") + "</div>" : ui().empty("暂无消费记录"));
  }

  function share(state) {
    return ui().pageHead("我的", "分享门店", "仅模拟复制文案，不会调用外部平台。") +
      '<div class="card"><p class="soft">澄石养生馆是 WellFlow 的虚构演示门店。您可以把下面这段说明复制给同事体验。</p>' +
      '<div class="card" style="margin-top:12px;background:#F4F0EA"><div class="tiny muted">模拟分享文案</div>' +
      "<p id=\"share-text\">我正在体验 WellFlow 演示样品「澄石养生馆」：可预约项目与技师、查看次卡余次。这是虚构门店与虚拟数据，不是真实经营。</p></div>" +
      '<div style="margin-top:12px">' + ui().btn("copy-share", "复制文案", "btn-primary btn-block") + "</div></div>";
  }

  function me(state) {
    var c = U().byId(state.users, state.currentUserId);
    return ui().pageHead("我的", c.name, "当前为顾客演示身份") +
      '<div class="card stack">' +
        ui().link("customer/appointments", "我的预约", "btn") +
        ui().link("customer/member", "次卡与消费", "btn") +
        ui().link("customer/share", "分享门店", "btn") +
        ui().link("customer/shop", "门店介绍", "btn") +
        ui().link("guide", "体验说明（给审核人）", "btn btn-amber") +
      "</div>" +
      '<div class="section-title"><h2>演示：切换体验顾客</h2></div>' +
      '<div class="card"><p class="tiny soft">仅用于演示冲突、推荐来源等场景，不是正式登录。当前是 ' + ui().h(c.name) + "。</p>" +
      '<div class="slots" style="margin-top:10px">' + state.users.map(function (u) {
        return ui().btn("switch-user", u.name, u.id === state.currentUserId ? "btn-primary btn-sm" : "btn-sm", 'data-id="' + u.id + '"');
      }).join("") + "</div></div>" +
      '<p class="tiny muted" style="margin-top:16px">演示顾客手机号：' + ui().h(c.phone) + "。切换角色请用顶部工具条，不会要求登录。</p>";
  }

  WF.views = WF.views || {};
  WF.views.customer = {
    home: home,
    shop: shop,
    services: services,
    serviceDetail: serviceDetail,
    staffList: staffList,
    staffDetail: staffDetail,
    book: book,
    result: result,
    appointments: appointments,
    appointmentDetail: appointmentDetail,
    member: member,
    share: share,
    me: me
  };
})(typeof window !== "undefined" ? window : global);
