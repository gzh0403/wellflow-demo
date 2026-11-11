/* WellFlow P2 — router, chrome, and event wiring. Classic script (no ES modules). */
(function (root) {
  var WF = root.WF = root.WF || {};
  WF.session = WF.session || { book: null, date: "", filterStaff: "", filterStatus: "", q: "", scheduleStaff: "" };

  var U, ui, store;

  function now() { return Date.now(); }

  function parseHash() {
    var raw = (location.hash || "#/customer/home").replace(/^#/, "");
    if (raw.charAt(0) === "/") raw = raw.slice(1);
    var parts = raw.split("?");
    var path = parts[0];
    var query = {};
    if (parts[1]) {
      parts[1].split("&").forEach(function (kv) {
        var p = kv.split("=");
        query[decodeURIComponent(p[0] || "")] = decodeURIComponent((p[1] || "").replace(/\+/g, " "));
      });
    }
    var segs = path.split("/").filter(Boolean);
    return { path: path, segs: segs, query: query, roleHint: segs[0] };
  }

  function goto(path) {
    if (path.charAt(0) === "#") location.hash = path;
    else location.hash = "#/" + path.replace(/^\//, "");
  }

  function roleToPrefix(role) {
    if (role === "owner") return "boss";
    if (role === "clerk") return "staff";
    return "customer";
  }

  function syncRoleFromRoute(route) {
    var state = store.get();
    if (route.roleHint === "boss" && state.currentRole !== "owner") store.setRole("owner");
    if (route.roleHint === "staff" && state.currentRole !== "clerk") store.setRole("clerk");
    if (route.roleHint === "customer" && state.currentRole !== "customer") store.setRole("customer");
  }

  function navItems(role) {
    if (role === "customer") {
      return [
        { path: "customer/home", label: "首页", icon: "home" },
        { path: "customer/services", label: "预约", icon: "book" },
        { path: "customer/member", label: "会员", icon: "member" },
        { path: "customer/me", label: "我的", icon: "me" }
      ];
    }
    if (role === "clerk") {
      return [
        { path: "staff/today", label: "今日", icon: "today" },
        { path: "staff/customers", label: "顾客", icon: "people" },
        { path: "staff/schedule", label: "排班", icon: "clock" },
        { path: "staff/me", label: "我的", icon: "me" }
      ];
    }
    return [
      { path: "boss/dashboard", label: "看板", icon: "board" },
      { path: "boss/appointments", label: "预约", icon: "book" },
      { path: "boss/manage", label: "经营", icon: "room" },
      { path: "boss/hub", label: "设置", icon: "gear" }
    ];
  }

  function isOn(itemPath, routePath) {
    if (routePath === itemPath) return true;
    var map = {
      "customer/services": ["customer/service/", "customer/staff", "customer/book"],
      "customer/member": ["customer/member"],
      "customer/me": ["customer/appointments", "customer/appointment/", "customer/share", "customer/shop", "customer/me"],
      "customer/home": ["customer/home"],
      "staff/today": ["staff/today", "staff/appointment/", "staff/settle", "staff/rooms"],
      "staff/customers": ["staff/customer"],
      "staff/schedule": ["staff/schedule"],
      "staff/me": ["staff/me"],
      "boss/dashboard": ["boss/dashboard"],
      "boss/appointments": ["boss/appointment"],
      "boss/manage": ["boss/manage", "boss/services", "boss/staff", "boss/schedule", "boss/rooms", "boss/customers", "boss/customer", "boss/cards", "boss/stats"],
      "boss/hub": ["boss/hub", "boss/settings", "boss/people", "guide"]
    };
    var list = map[itemPath] || [];
    for (var i = 0; i < list.length; i++) {
      if (routePath === list[i] || routePath.indexOf(list[i]) === 0) return true;
    }
    return false;
  }

  function renderChrome(state, route, inner) {
    var role = state.currentRole;
    var items = navItems(role);
    var tabs = items.map(function (it) {
      var on = isOn(it.path, route.path) ? " is-on" : "";
      return '<a class="' + on + '" href="#/' + it.path + '">' + ui.icon(it.icon) + "<span>" + it.label + "</span></a>";
    }).join("");
    var side = '<div class="side-brand"><div class="mark">' + ui.logoSvg() + "</div><h2>澄石养生馆</h2><p>WellFlow 演示样品</p></div>" +
      items.map(function (it) {
        var on = isOn(it.path, route.path) ? " is-on" : "";
        return '<a class="' + on + '" href="#/' + it.path + '">' + ui.icon(it.icon) + "<span>" + it.label + "</span></a>";
      }).join("") +
      '<div class="nav-group">工具</div>' +
      '<a href="#/guide"' + (route.path === "guide" ? ' class="is-on"' : "") + ">" + ui.icon("book") + "<span>体验说明</span></a>";

    var bar = '<div class="demo-bar">' +
      '<div class="demo-mark"><span class="demo-dot"></span><strong>演示样品 · 虚拟数据 · 非真实经营数据</strong></div>' +
      '<div class="spacer"></div>' +
      '<div class="role-switch">' +
        '<button type="button" data-action="role" data-role="customer"' + (role === "customer" ? ' class="is-on"' : "") + ">顾客 " + (WF.utils.byId(state.users, state.currentUserId) || {name:"林澄"}).name + "</button>" +
        '<button type="button" data-action="role" data-role="clerk"' + (role === "clerk" ? ' class="is-on"' : "") + ">店员 周晚白</button>" +
        '<button type="button" data-action="role" data-role="owner"' + (role === "owner" ? ' class="is-on"' : "") + ">老板 沈予安</button>" +
      "</div>" +
      '<div class="demo-actions">' +
        '<a href="#/guide">体验说明</a>' +
        '<button type="button" class="danger" data-action="reset">一键还原</button>' +
      "</div></div>";

    return bar +
      '<div class="app-shell">' +
        '<nav class="side-nav" aria-label="主导航">' + side + "</nav>" +
        '<main class="main" id="main">' + inner + "</main>" +
      "</div>" +
      '<nav class="tabbar" aria-label="底部导航">' + tabs + "</nav>";
  }

  function renderPage(state, route) {
    var segs = route.segs;
    var q = route.query;
    var t = now();
    WF.rules.applyTimeouts(state, t);
    store.save(true);

    if (!segs.length || segs[0] === "guide") return WF.views.guide(state);

    if (segs[0] === "customer") {
      if (state.currentRole !== "customer") store.setRole("customer");
      state = store.get();
      if (segs[1] === "shop") return WF.views.customer.shop(state);
      if (segs[1] === "services") return WF.views.customer.services(state);
      if (segs[1] === "service") return WF.views.customer.serviceDetail(state, segs[2]);
      if (segs[1] === "staff" && segs[2]) return WF.views.customer.staffDetail(state, segs[2], t);
      if (segs[1] === "staff") return WF.views.customer.staffList(state);
      if (segs[1] === "book" && segs[2] === "result") return WF.views.customer.result(state, segs[3], t);
      if (segs[1] === "book") return WF.views.customer.book(state, q, t);
      if (segs[1] === "appointments") return WF.views.customer.appointments(state, t);
      if (segs[1] === "appointment") return WF.views.customer.appointmentDetail(state, segs[2], t);
      if (segs[1] === "member") return WF.views.customer.member(state, t);
      if (segs[1] === "share") return WF.views.customer.share(state);
      if (segs[1] === "me") return WF.views.customer.me(state);
      return WF.views.customer.home(state, t);
    }

    if (segs[0] === "staff") {
      if (state.currentRole === "customer") {
        store.setRole("clerk");
        state = store.get();
      }
      /* owner may also open staff routes */
      if (segs[1] === "settle") return WF.views.staff.settle(state, t);
      if (segs[1] === "appointment") return WF.views.staff.appointmentDetail(state, segs[2], t);
      if (segs[1] === "customers") return WF.views.staff.customers(state);
      if (segs[1] === "customer") return WF.views.staff.customerDetail(state, segs[2], t);
      if (segs[1] === "schedule") return WF.views.staff.schedule(state, t);
      if (segs[1] === "rooms") return WF.views.staff.rooms(state, t);
      if (segs[1] === "me") return WF.views.staff.me(state);
      return WF.views.staff.today(state, t);
    }

    if (segs[0] === "boss") {
      if (state.currentRole !== "owner") {
        if (state.currentRole === "clerk") {
          return '<div class="callout warn">当前身份没有权限查看老板端。请用顶部工具条切换到「老板」，或返回店员工作台。</div>' +
            ui.go("staff/today", "返回店员端", "btn btn-primary");
        }
        store.setRole("owner");
        state = store.get();
      }
      if (segs[1] === "appointments") return WF.views.boss.appointments(state, t);
      if (segs[1] === "appointment") return WF.views.boss.appointmentDetail(state, segs[2], t);
      if (segs[1] === "services") return WF.views.boss.services(state);
      if (segs[1] === "staff") return WF.views.boss.staffPage(state);
      if (segs[1] === "schedule") return WF.views.boss.schedule(state, t);
      if (segs[1] === "rooms") return WF.views.boss.rooms(state, t);
      if (segs[1] === "customers" || segs[1] === "cards") return WF.views.boss.customers(state, t, q);
      if (segs[1] === "customer") return WF.views.boss.customerDetail(state, segs[2], t);
      if (segs[1] === "stats") return WF.views.boss.stats(state, t);
      if (segs[1] === "settings") return WF.views.boss.settings(state);
      if (segs[1] === "people") return WF.views.boss.people(state);
      if (segs[1] === "manage") return WF.views.boss.manage(state);
      if (segs[1] === "hub") return WF.views.boss.settingHub(state);
      return WF.views.boss.dashboard(state, t);
    }

    return WF.views.guide(state);
  }

  function render() {
    if (ui && ui.closeModal) ui.closeModal(false);
    var state = store.get();
    var route = parseHash();
    if (route.roleHint === "boss" || route.roleHint === "staff" || route.roleHint === "customer") {
      /* Keep role in sync when the user navigates via hash, except staff blocked from boss pages (handled in renderPage). */
      if (!(route.roleHint === "boss" && state.currentRole === "clerk")) {
        syncRoleFromRoute(route);
        state = store.get();
      }
    }
    var inner = renderPage(state, route);
    document.getElementById("app").innerHTML = renderChrome(store.get(), route, inner);
    tickCountdowns();
  }

  function tickCountdowns() {
    var nodes = document.querySelectorAll("[data-countdown]");
    var t = now();
    for (var i = 0; i < nodes.length; i++) {
      var dl = +nodes[i].getAttribute("data-countdown");
      var c = U.countdown(dl, t);
      nodes[i].textContent = c.expired ? "确认已超时" : ("确认剩余 " + c.text);
      if (c.expired) nodes[i].className = "pill pill-timeout";
    }
  }

  function resultToast(res, okMsg) {
    if (!res) return false;
    if (!res.ok) {
      ui.toast(res.error || "操作未完成", "err");
      return false;
    }
    if (okMsg) ui.toast(okMsg, "ok");
    return true;
  }

  function mutate(fn) {
    var res = store.mutate(fn);
    render();
    return res;
  }

  async function handle(action, el) {
    var state = store.get();
    var id = el && el.getAttribute("data-id");
    var verb = el && el.getAttribute("data-verb");

    if (action === "role") {
      ui.closeModal(false);
      var role = el.getAttribute("data-role");
      store.setRole(role);
      WF.session.book = null;
      goto(roleToPrefix(role) + (role === "owner" ? "/dashboard" : role === "clerk" ? "/today" : "/home"));
      return;
    }

    if (action === "switch-user") {
      store.setUser(id);
      WF.session.book = null;
      var who = WF.utils.byId(store.get().users, id);
      ui.toast("已切换演示顾客为 " + (who ? who.name : ""), "ok");
      render();
      return;
    }

    if (action === "reset") {
      ui.closeModal(false);
      var yes = await ui.modal({
        title: "还原演示数据？",
        body: "将清除本机审核过程中产生的预约、结算和次卡变动，恢复为初始虚构样品。",
        ok: "一键还原",
        danger: true
      });
      if (!yes) return;
      store.reset();
      WF.session = { book: null, date: "", filterStaff: "", filterStatus: "", q: "", scheduleStaff: "" };
      ui.toast("已恢复初始演示数据", "ok");
      goto("guide");
      return;
    }

    if (action === "toggle-service") {
      var d = WF.session.book || { serviceIds: [], staffId: "", date: U.dateStr(now()), startAt: 0, source: "" };
      var sid = id;
      var i = d.serviceIds.indexOf(sid);
      if (i === -1) d.serviceIds.push(sid);
      else d.serviceIds.splice(i, 1);
      d.staffId = "";
      d.startAt = 0;
      WF.session.book = d;
      render();
      return;
    }
    if (action === "set-date") {
      var date = el.getAttribute("data-date");
      if (WF.session.book) {
        WF.session.book.date = date;
        WF.session.book.staffId = WF.session.book.staffId || "";
        WF.session.book.startAt = 0;
      }
      WF.session.date = date;
      render();
      return;
    }
    if (action === "pick-staff") {
      WF.session.book = WF.session.book || { serviceIds: [], date: U.dateStr(now()), startAt: 0, source: "" };
      WF.session.book.staffId = id;
      WF.session.book.startAt = 0;
      render();
      return;
    }
    if (action === "pick-slot") {
      WF.session.book.startAt = +el.getAttribute("data-start");
      render();
      return;
    }
    if (action === "pick-source") {
      WF.session.book.source = el.getAttribute("data-source");
      render();
      return;
    }
    if (action === "submit-book") {
      var draft = WF.session.book;
      if (!draft || !draft.startAt) return;
      var res = mutate(function (st) {
        return WF.rules.createAppointment(st, {
          serviceIds: draft.serviceIds,
          staffId: draft.staffId,
          startAt: draft.startAt,
          source: draft.source
        }, { role: "customer" }, now());
      });
      if (!resultToast(res)) return;
      WF.session.book = null;
      ui.toast(res.autoConfirmed ? "预约已自动确认" : "预约已提交，等待门店确认", "ok");
      goto("customer/book/result/" + res.appointment.id);
      return;
    }

    if (action === "do" || action === "do-reason") {
      var payload = {};
      if (action === "do-reason") {
        var need = verb === "void_pay";
        var m = await ui.modal({
          title: verb === "noshow" ? "标记逾期未到" : verb === "cancel_arrived" ? "到店后取消" : "作废待结算",
          html: '<label class="field">原因' + (need ? "（必填）" : "") + '<input data-field="reason" placeholder="请填写原因"></label>',
          ok: "确认",
          danger: verb !== "noshow"
        });
        if (!m) return;
        if (need && !m.fields.reason) {
          ui.toast("作废待结算请填写原因。", "err");
          return;
        }
        payload.reason = m.fields.reason;
      }
      var r = mutate(function (st) {
        return WF.rules.transition(st, id, verb, payload, { role: st.currentRole }, now());
      });
      resultToast(r, "已更新为「" + (r.appointment ? WF.STATUS_LABEL[r.appointment.status] : "") + "」");
      return;
    }

    if (action === "cancel-appt") {
      var m2 = await ui.modal({
        title: "取消这张预约？",
        html: '<p class="soft">取消后将释放技师与房间占用。</p><label class="field" style="margin-top:8px">原因（可选）<input data-field="reason" placeholder="取消原因"></label>',
        ok: "确认取消",
        danger: true
      });
      if (!m2) return;
      var rc = mutate(function (st) {
        return WF.rules.transition(st, id, "cancel", { reason: m2.fields.reason }, { role: st.currentRole }, now());
      });
      resultToast(rc, "预约已取消，时段已释放");
      return;
    }

    if (action === "force-timeout") {
      var rt = mutate(function (st) {
        return WF.rules.forceTimeout(st, id, { role: st.currentRole }, now());
      });
      resultToast(rt, "已模拟确认超时，技师与房间占用已释放");
      return;
    }

    if (action === "open-settle") {
      await openSettle(id);
      return;
    }

    if (action === "filter-staff") {
      WF.session.filterStaff = el.getAttribute("data-id") || "";
      render();
      return;
    }
    if (action === "filter-status") {
      WF.session.filterStatus = el.getAttribute("data-id") || "";
      render();
      return;
    }
    if (action === "schedule-staff") {
      WF.session.scheduleStaff = id;
      render();
      return;
    }
    if (action === "search-cust") {
      var input = document.querySelector("[data-sync=q]");
      WF.session.q = input ? input.value : "";
      render();
      return;
    }
    if (action === "copy-share") {
      var text = (document.getElementById("share-text") || {}).textContent || "";
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { ui.toast("已复制分享文案", "ok"); }, function () { ui.toast(text); });
      } else {
        ui.toast("请手动复制页面中的文案");
      }
      return;
    }
    if (action === "buy-card") {
      var pack = el.getAttribute("data-pack");
      var packs = {
        foot: { name: "足部舒缓次卡", total: 5, serviceIds: ["svc_foot"], validMonths: 6 },
        neck: { name: "肩颈松解次卡", total: 3, serviceIds: ["svc_neck"], validMonths: 6 }
      };
      var rb = mutate(function (st) {
        return WF.rules.demoBuyCard(st, { pack: packs[pack] }, { role: "customer" }, now());
      });
      resultToast(rb, "演示购卡已入账，未发生真实支付");
      return;
    }

    if (action === "set-confirm") {
      var mode = el.getAttribute("data-mode");
      var rs = mutate(function (st) {
        return WF.rules.updateShop(st, { confirmMode: mode }, { role: "owner" });
      });
      resultToast(rs, mode === "auto" ? "已切换为自动确认" : "已切换为需要确认");
      return;
    }
    if (action === "save-shop") {
      var form = document.querySelector("[data-form=shop]");
      var patch = {};
      ["name", "slogan", "address", "phone", "announcement", "confirmTimeoutMin", "bufferMin", "cancelAdvanceMin", "slotStepMin"].forEach(function (k) {
        if (form[k]) patch[k] = form[k].value;
      });
      var rshop = mutate(function (st) { return WF.rules.updateShop(st, patch, { role: "owner" }); });
      resultToast(rshop, "营业规则已保存");
      return;
    }
    if (action === "save-schedule") {
      var wrap = document.querySelector("[data-form=schedule]");
      var staffId = wrap.getAttribute("data-staff");
      var spec = {};
      for (var w = 0; w <= 6; w++) {
        var off = wrap.querySelector('[data-sch=off][data-w="' + w + '"]');
        var start = wrap.querySelector('[data-sch=start][data-w="' + w + '"]');
        var end = wrap.querySelector('[data-sch=end][data-w="' + w + '"]');
        var brs = wrap.querySelector('[data-sch=brs][data-w="' + w + '"]');
        var bre = wrap.querySelector('[data-sch=bre][data-w="' + w + '"]');
        spec[w] = {
          off: off && off.checked,
          start: start.value || "10:00",
          end: end.value || "22:00",
          breaks: (brs && brs.value && bre && bre.value) ? [{ start: brs.value, end: bre.value }] : []
        };
      }
      var rsch = mutate(function (st) { return WF.rules.saveSchedule(st, staffId, spec, { role: "owner" }); });
      resultToast(rsch, "排班已保存");
      return;
    }
    if (action === "add-block") {
      var dateB = document.querySelector("[data-block=date]").value;
      var staffB = document.querySelector("[data-block=staff]").value;
      var stB = document.querySelector("[data-block=start]").value;
      var enB = document.querySelector("[data-block=end]").value;
      var reasonB = document.querySelector("[data-block=reason]").value;
      var rbk = mutate(function (st) {
        return WF.rules.addBlock(st, {
          staffId: staffB,
          startAt: U.atTime(dateB, stB),
          endAt: U.atTime(dateB, enB),
          reason: reasonB
        }, { role: "owner" });
      });
      resultToast(rbk, "已添加临时占用");
      return;
    }
    if (action === "save-date-schedule") {
      var dsDate = document.querySelector("[data-ds=date]").value;
      var dsStaff = document.querySelector("[data-ds=staff]").value;
      var dsStart = document.querySelector("[data-ds=start]").value;
      var dsEnd = document.querySelector("[data-ds=end]").value;
      var dsOff = document.querySelector("[data-ds=off]").checked;
      var rds = mutate(function (st) {
        return WF.rules.saveDateSchedule(st, dsStaff, dsDate, { start: dsStart, end: dsEnd, off: dsOff, breaks: [] }, { role: "owner" });
      });
      resultToast(rds, dsOff ? "已将该日设为休息" : "已保存该日排班（覆盖周循环）");
      return;
    }
    if (action === "issue-card") {
      var f = document.querySelector("[data-form=issue-card]");
      var svc = f.serviceId.value;
      var rcard = mutate(function (st) {
        return WF.rules.issueCard(st, {
          customerId: f.customerId.value,
          name: f.name.value,
          total: f.total.value,
          validMonths: f.validMonths.value,
          serviceIds: svc === "all" ? "all" : [svc]
        }, { role: "owner" }, now());
      });
      resultToast(rcard, "演示次卡已发放");
      return;
    }
    if (action === "add-clerk") {
      var name = (document.querySelector("[data-clerk-name]") || {}).value || "";
      var rck = mutate(function (st) { return WF.rules.addClerkAccount(st, { name: name }, { role: "owner" }); });
      resultToast(rck, "已添加店员");
      return;
    }
    if (action === "toggle-clerk") {
      var active = el.getAttribute("data-active") === "1";
      var rta = mutate(function (st) { return WF.rules.setClerkActive(st, id, active, { role: "owner" }); });
      resultToast(rta, active ? "已启用该店员" : "已停用该店员");
      return;
    }
    if (action === "edit-service") {
      await editService(id);
      return;
    }
    if (action === "edit-staff") {
      await editStaff(id);
      return;
    }
    if (action === "edit-room") {
      await editRoom(id);
      return;
    }
  }

  async function openSettle(apptId) {
    var state = store.get();
    var a = U.byId(state.appointments, apptId);
    if (!a) return;
    WF.session._settleChoice = "sim_pay";
    var cards = state.cards.filter(function (c) { return c.customerId === a.customerId && c.status === "active" && c.remaining > 0; });
    var cardOpts = cards.length
      ? cards.map(function (c) {
        return '<label class="option"><input type="radio" name="settle" value="card:' + c.id + '"> <div><strong>次卡核销 · ' + ui.h(c.name) + "</strong><div class=\"tiny muted\">余 " + c.remaining + " 次</div></div></label>";
      }).join("")
      : '<p class="tiny muted">该顾客没有可用于本次的在用次卡。</p>';
    var m = await ui.modal({
      title: "结算核销",
      html: '<p class="soft">预约 ' + ui.h(a.no) + " · " + ui.h(ui.serviceNames(state, a.serviceIds)) + " · " + ui.money(a.priceFen) + "</p>" +
        '<div class="stack" style="margin-top:10px">' +
        '<label class="option is-on"><input type="radio" name="settle" value="sim_pay" checked> <div><strong>模拟到店付款</strong><div class="tiny muted">不发生真实支付，只生成消费记录。</div></div></label>' +
        cardOpts + "</div>",
      ok: "确认核销"
    });
    if (!m) return;
    var chosen = (document.querySelector("input[name=settle]:checked") || { value: "sim_pay" }).value;
    /* modal already closed; query may be gone. Capture before close — fix: read inside modal resolve.
       We already closed. Need to capture in html handler. Workaround: parse from m is empty.
       Re-open is bad. Change approach: read in click handler before close.
       I'll use a data attribute set via a custom path: store lastSettleChoice while modal is open. */
    var method = "sim_pay";
    var cardId = "";
    if (WF.session._settleChoice) {
      chosen = WF.session._settleChoice;
      WF.session._settleChoice = "";
    }
    if (chosen && chosen.indexOf("card:") === 0) {
      method = "card";
      cardId = chosen.slice(5);
    } else if (chosen === "sim_pay") {
      method = "sim_pay";
    }
    var r = mutate(function (st) {
      return WF.rules.transition(st, apptId, "settle", { method: method, cardId: cardId }, { role: st.currentRole }, now());
    });
    resultToast(r, method === "card" ? "已用次卡核销，余次已扣减" : "已模拟结算，预约完成");
  }

  async function editService(id) {
    var state = store.get();
    var s = id ? U.byId(state.services, id) : { name: "", category: "养生", durationMin: 60, priceFen: 12800, desc: "", onSale: true };
    var m = await ui.modal({
      title: id ? "编辑项目" : "新增项目",
      html: '<label class="field">名称<input data-field="name" value="' + ui.h(s.name) + '"></label>' +
        '<label class="field" style="margin-top:8px">分类<input data-field="category" value="' + ui.h(s.category || "") + '"></label>' +
        '<div class="grid-2" style="margin-top:8px"><label class="field">时长（分钟）<input data-field="durationMin" value="' + (s.durationMin || 60) + '"></label>' +
        '<label class="field">价格（元）<input data-field="priceYuan" value="' + ((s.priceFen || 0) / 100) + '"></label></div>' +
        '<label class="field" style="margin-top:8px">介绍<textarea data-field="desc">' + ui.h(s.desc || "") + "</textarea></label>" +
        '<label class="cluster" style="margin-top:8px"><input type="checkbox" data-field="onSale" ' + (s.onSale !== false ? "checked" : "") + "> 在架上架</label>",
      ok: "保存"
    });
    if (!m) return;
    var onSaleBox = true;
    /* checkbox value via fields may be "on". We'll read flag from string. */
    var r = mutate(function (st) {
      return WF.rules.upsertService(st, {
        id: id || "",
        name: m.fields.name,
        category: m.fields.category,
        durationMin: m.fields.durationMin,
        priceYuan: m.fields.priceYuan,
        desc: m.fields.desc,
        onSale: WF.session._onSale !== false
      }, { role: "owner" });
    });
    WF.session._onSale = null;
    resultToast(r, "项目已保存");
  }

  async function editStaff(id) {
    var state = store.get();
    var t = id ? U.byId(state.staff, id) : { name: "", title: "技师", bio: "", defaultRoomId: state.rooms[0].id, specialties: [], active: true };
    var specs = state.services.filter(function (s) { return s.onSale; }).map(function (s) {
      var on = (t.specialties || []).indexOf(s.id) !== -1;
      return '<label class="tiny cluster"><input type="checkbox" data-spec="' + s.id + '"' + (on ? " checked" : "") + "> " + ui.h(s.name) + "</label>";
    }).join("");
    var rooms = state.rooms.map(function (r) {
      return '<option value="' + r.id + '"' + (t.defaultRoomId === r.id ? " selected" : "") + ">" + ui.h(r.name) + "</option>";
    }).join("");
    var m = await ui.modal({
      title: id ? "编辑技师" : "新增技师",
      html: '<label class="field">姓名<input data-field="name" value="' + ui.h(t.name) + '"></label>' +
        '<label class="field" style="margin-top:8px">头衔<input data-field="title" value="' + ui.h(t.title || "") + '"></label>' +
        '<label class="field" style="margin-top:8px">默认房间<select data-field="defaultRoomId">' + rooms + "</select></label>" +
        '<label class="field" style="margin-top:8px">简介<textarea data-field="bio">' + ui.h(t.bio || "") + "</textarea></label>" +
        '<div class="tiny soft" style="margin-top:8px">擅长项目</div><div class="stack">' + specs + "</div>" +
        (id ? '<label class="cluster" style="margin-top:8px"><input type="checkbox" data-field="active" ' + (t.active ? "checked" : "") + "> 在职</label>" : ""),
      ok: "保存"
    });
    if (!m) return;
    var specialties = [];
    /* Modal already closed — capture specs before close via session. */
    if (WF.session._specs && WF.session._specs.length) {
      specialties = WF.session._specs;
    } else if (id) specialties = t.specialties || [];
    WF.session._specs = null;
    var active = WF.session._staffActive;
    if (active == null) active = true;
    var r = mutate(function (st) {
      return WF.rules.upsertStaff(st, {
        id: id || "",
        name: m.fields.name,
        title: m.fields.title,
        defaultRoomId: m.fields.defaultRoomId,
        bio: m.fields.bio,
        specialties: specialties,
        role: "technician",
        active: !!active
      }, { role: "owner" });
    });
    WF.session._staffActive = null;
    resultToast(r, "技师资料已保存");
  }

  async function editRoom(id) {
    var state = store.get();
    var r0 = id ? U.byId(state.rooms, id) : { name: "", floor: "", note: "", enabled: true };
    var m = await ui.modal({
      title: id ? "编辑房间" : "新增房间",
      html: '<label class="field">名称<input data-field="name" value="' + ui.h(r0.name) + '"></label>' +
        '<label class="field" style="margin-top:8px">楼层<input data-field="floor" value="' + ui.h(r0.floor || "") + '"></label>' +
        '<label class="field" style="margin-top:8px">备注<input data-field="note" value="' + ui.h(r0.note || "") + '"></label>' +
        '<label class="cluster" style="margin-top:8px"><input type="checkbox" data-field="enabled" ' + (r0.enabled !== false ? "checked" : "") + "> 启用该房间（停用后不能被新预约占用）</label>",
      ok: "保存"
    });
    if (!m) return;
    var enabled = WF.session._roomEnabled;
    if (enabled == null) enabled = r0.enabled !== false;
    var r = mutate(function (st) {
      return WF.rules.upsertRoom(st, {
        id: id || "",
        name: m.fields.name,
        floor: m.fields.floor,
        note: m.fields.note,
        enabled: !!enabled
      }, { role: "owner" });
    });
    WF.session._roomEnabled = null;
    resultToast(r, "房间已保存");
  }

  function bind() {
  /* Improve settle: intercept radio before modal closes by binding document. */
  document.addEventListener("change", function (e) {
    if (e.target && e.target.name === "settle") WF.session._settleChoice = e.target.value;
  });

  /* Capture checkbox groups inside modal before it closes. */
  document.addEventListener("click", function (e) {
    var yes = e.target.closest("[data-modal=yes]");
    if (!yes) return;
    var modal = document.getElementById("wf-modal");
    if (!modal) return;
    var settle = modal.querySelector("input[name=settle]:checked");
    if (settle) WF.session._settleChoice = settle.value;
    var specs = modal.querySelectorAll("[data-spec]:checked");
    if (specs.length || modal.querySelector("[data-spec]")) {
      WF.session._specs = [];
      for (var i = 0; i < specs.length; i++) WF.session._specs.push(specs[i].getAttribute("data-spec"));
    }
    var onSale = modal.querySelector('[data-field=onSale]');
    if (onSale && onSale.type === "checkbox") WF.session._onSale = onSale.checked;
    var act = modal.querySelector('[data-field=active]');
    if (act && act.type === "checkbox") WF.session._staffActive = act.checked;
    var en = modal.querySelector('[data-field=enabled]');
    if (en && en.type === "checkbox") WF.session._roomEnabled = en.checked;
  }, true);

    document.getElementById("app").addEventListener("click", function (e) {
      var t = e.target.closest("[data-action]");
      if (!t) return;
      e.preventDefault();
      handle(t.getAttribute("data-action"), t);
    });
    document.getElementById("app").addEventListener("keydown", function (e) {
      if (e.key === "Enter" && e.target.getAttribute("data-sync") === "q") {
        e.preventDefault();
        handle("search-cust", e.target);
      }
    });
  }

  function boot() {
    U = WF.utils;
    ui = WF.ui;
    store = WF.store;
    store.load();
    bind();
    if (!location.hash) location.hash = "#/customer/home";
    render();
    window.addEventListener("hashchange", render);
    setInterval(function () {
      var changed = WF.rules.applyTimeouts(store.get(), Date.now());
      store.save(true);
      if (changed && changed.length) render();
      else tickCountdowns();
    }, 1000);
  }

  WF.app = { boot: boot, render: render, goto: goto };
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }
})(typeof window !== "undefined" ? window : global);
