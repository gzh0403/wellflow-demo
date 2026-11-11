/* WellFlow P2 demo — shared business rules for all three roles. Classic script. */
(function (root) {
  var WF = root.WF = root.WF || {};

  function U() { return WF.utils; }

  var ACTIONS = {
    confirm: { from: ["pending"], to: "confirmed", roles: ["clerk", "owner"] },
    cancel: { from: ["pending", "confirmed"], to: "cancelled", roles: ["customer", "clerk", "owner"] },
    timeout: { from: ["pending"], to: "timeout", roles: ["system"] },
    arrive: { from: ["confirmed"], to: "arrived", roles: ["clerk", "owner"] },
    noshow: { from: ["confirmed"], to: "no_show", roles: ["clerk", "owner"] },
    start: { from: ["arrived"], to: "in_service", roles: ["clerk", "owner"] },
    cancel_arrived: { from: ["arrived"], to: "cancel_arrived", roles: ["clerk", "owner"] },
    finish: { from: ["in_service"], to: "await_pay", roles: ["clerk", "owner"] },
    settle: { from: ["await_pay"], to: "done", roles: ["clerk", "owner"] },
    void_pay: { from: ["await_pay"], to: "void_pay", roles: ["clerk", "owner"] }
  };

  var RELEASE_ON = ["timeout", "cancelled", "no_show", "cancel_arrived", "await_pay", "void_pay", "done"];

  function fail(message, code) {
    var r = { ok: false, error: message };
    if (code) r.code = code;
    return r;
  }

  function ok(extra) {
    var r = { ok: true };
    if (extra) {
      for (var k in extra) r[k] = extra[k];
    }
    return r;
  }

  function roleOf(state, actor) {
    actor = actor || {};
    if (actor.role) return actor.role;
    return state.currentRole || "customer";
  }

  function currentCustomerId(state) {
    return state.currentUserId || "usr_lin";
  }

  function shopHoursFor(state, ms) {
    var u = U();
    var day = u.dateStr(ms);
    if (state.shop.closedDates && state.shop.closedDates.indexOf(day) !== -1) {
      return { off: true, open: null, close: null };
    }
    var wd = u.partsOf(ms).weekday;
    var wh = state.shop.weeklyHours[wd] || { open: "10:00", close: "22:00", off: false };
    if (wh.off) return { off: true, open: null, close: null };
    return {
      off: false,
      open: u.atTime(day, wh.open),
      close: u.atTime(day, wh.close),
      openHm: wh.open,
      closeHm: wh.close
    };
  }

  function scheduleFor(state, staffId, ms) {
    var u = U();
    var day = u.dateStr(ms);
    var wd = u.partsOf(ms).weekday;
    var dateOnes = (state.schedules || []).filter(function (s) {
      return s.staffId === staffId && s.type === "date" && s.date === day;
    });
    if (dateOnes.length) return dateOnes[0];
    var weekly = (state.schedules || []).filter(function (s) {
      return s.staffId === staffId && s.type === "weekly" && s.weekday === wd;
    });
    return weekly[0] || null;
  }

  function staffWindow(state, staffId, ms) {
    var u = U();
    var sch = scheduleFor(state, staffId, ms);
    if (!sch || sch.off) return { off: true };
    var day = u.dateStr(ms);
    return {
      off: false,
      start: u.atTime(day, sch.start),
      end: u.atTime(day, sch.end),
      breaks: (sch.breaks || []).map(function (b) {
        return { start: u.atTime(day, b.start), end: u.atTime(day, b.end) };
      })
    };
  }

  function staffCanDo(state, staffId, serviceIds) {
    var st = U().byId(state.staff, staffId);
    if (!st || !st.active || st.role !== "technician") return false;
    for (var i = 0; i < serviceIds.length; i++) {
      if (st.specialties.indexOf(serviceIds[i]) === -1) return false;
    }
    return true;
  }

  function serviceList(state, ids) {
    var u = U();
    var out = [];
    for (var i = 0; i < ids.length; i++) {
      var s = u.byId(state.services, ids[i]);
      if (s) out.push(s);
    }
    return out;
  }

  function totalsOf(state, serviceIds) {
    var list = serviceList(state, serviceIds);
    var dur = 0, price = 0;
    for (var i = 0; i < list.length; i++) {
      dur += list[i].durationMin;
      price += list[i].priceFen;
    }
    return { durationMin: dur, priceFen: price, services: list };
  }

  function defaultRoomFor(state, staffId) {
    var st = U().byId(state.staff, staffId);
    return st ? st.defaultRoomId : "";
  }

  function locksOf(state, type, resourceId) {
    return (state.locks || []).filter(function (l) {
      return l.type === type && l.resourceId === resourceId;
    });
  }

  function hasOverlap(locks, startAt, endAt, ignoreAppointmentId) {
    var u = U();
    for (var i = 0; i < locks.length; i++) {
      var l = locks[i];
      if (ignoreAppointmentId && l.appointmentId === ignoreAppointmentId) continue;
      if (u.overlaps(startAt, endAt, l.startAt, l.endAt)) return l;
    }
    return null;
  }

  function blockOverlap(state, staffId, startAt, endAt) {
    var u = U();
    var blocks = state.blocks || [];
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      if (b.staffId === staffId && u.overlaps(startAt, endAt, b.startAt, b.endAt)) return b;
    }
    return null;
  }

  function inStaffShift(state, staffId, startAt, endAt) {
    var win = staffWindow(state, staffId, startAt);
    if (win.off) return { ok: false, reason: "该技师当天未排班，请改选其他技师或日期。" };
    if (startAt < win.start || endAt > win.end) {
      return { ok: false, reason: "该时段不在技师排班时间内，请改选其他时段。" };
    }
    /* If the interval spans midnight (shouldn't), fail. */
    if (U().dateStr(startAt) !== U().dateStr(U().addMin(endAt, -1))) {
      return { ok: false, reason: "预约不能跨营业日，请改选开始时间。" };
    }
    for (var i = 0; i < (win.breaks || []).length; i++) {
      if (U().overlaps(startAt, endAt, win.breaks[i].start, win.breaks[i].end)) {
        return { ok: false, reason: "该时段与技师休息时间冲突，请改选其他时段。" };
      }
    }
    var blk = blockOverlap(state, staffId, startAt, endAt);
    if (blk) return { ok: false, reason: "该技师这一段时间有临时占用（" + (blk.reason || "不可预约") + "），请改选其他时段。" };
    return { ok: true };
  }

  function roomEnabled(state, roomId) {
    var r = U().byId(state.rooms, roomId);
    return r && r.enabled;
  }

  function occupyingAppointments(state, ignoreAppointmentId) {
    return (state.appointments || []).filter(function (a) {
      return a.id !== ignoreAppointmentId && (a.status === "arrived" || a.status === "in_service");
    });
  }

  function effectiveServiceStart(appt) {
    var start = appt.startAt;
    if (appt.arrivedAt && appt.arrivedAt < start) start = appt.arrivedAt;
    if (appt.startedAt && appt.startedAt < start) start = appt.startedAt;
    return start;
  }

  function effectiveServiceEnd(appt, now) {
    var end = appt.endAt;
    /* Only in-service extends past the scheduled end (overtime). Arrived ends at endAt. */
    if (appt.status === "in_service" && now != null && now > end) {
      return now;
    }
    return end;
  }

  function isCurrentlyOccupying(appt, now) {
    if (!appt) return false;
    if (appt.status === "in_service") return true;
    if (appt.status === "arrived") {
      return now < appt.endAt && now >= effectiveServiceStart(appt);
    }
    return false;
  }

  function syncLocksToActualStart(state, appt, now) {
    if (now == null || now >= appt.startAt) return;
    var locks = state.locks || [];
    for (var i = 0; i < locks.length; i++) {
      var l = locks[i];
      if (l.appointmentId === appt.id && l.purpose === "service" && now < l.startAt) {
        l.startAt = now;
      }
    }
  }

  function shiftFailCode(reason) {
    if (/未排班/.test(reason)) return "off";
    if (/休息/.test(reason)) return "break";
    if (/临时占用/.test(reason)) return "block";
    return "shift";
  }

  function checkConflicts(state, staffId, roomId, startAt, serviceEndAt, ignoreAppointmentId, opts) {
    opts = opts || {};
    var bufferEnd = U().addMin(serviceEndAt, state.shop.bufferMin || 0);
    var nowRef = opts.now != null ? opts.now : startAt;
    if (!roomEnabled(state, roomId)) {
      if (opts.audience === "customer") {
        return fail("该房间已停用，请改选技师或时段。", "room_disabled");
      }
      return fail("该房间已停用，请改选其他房间或技师。", "room_disabled");
    }
    var shift = inStaffShift(state, staffId, startAt, serviceEndAt);
    if (!shift.ok) return fail(shift.reason, shiftFailCode(shift.reason));

    var occ = occupyingAppointments(state, ignoreAppointmentId);
    for (var i = 0; i < occ.length; i++) {
      var o = occ[i];
      var oStart = effectiveServiceStart(o);
      var oEnd = effectiveServiceEnd(o, nowRef);
      if (o.staffId === staffId && U().overlaps(startAt, serviceEndAt, oStart, oEnd)) {
        return fail("该技师这一段时间已被预约，请改选其他时段。", "staff_busy");
      }
      if (o.roomId === roomId && U().overlaps(startAt, bufferEnd, oStart, oEnd)) {
        return fail("该房间这一段时间已被占用，请改选时段。", "room_busy");
      }
    }

    var staffHit = hasOverlap(locksOf(state, "staff", staffId), startAt, serviceEndAt, ignoreAppointmentId);
    if (staffHit) {
      return fail("该技师这一段时间已被预约，请改选其他时段。", "staff_busy");
    }
    var roomHit = hasOverlap(locksOf(state, "room", roomId), startAt, bufferEnd, ignoreAppointmentId);
    if (roomHit) {
      if (roomHit.purpose === "buffer") {
        return fail("该房间这一段时间处于清扫缓冲，暂不可再被预约或分配，请改选时段。", "buffer");
      }
      return fail("该房间这一段时间已被占用，请改选时段。", "room_busy");
    }
    var hours = shopHoursFor(state, startAt);
    if (hours.off) return fail("该日门店不营业，请改选其他日期。", "closed");
    if (startAt < hours.open || serviceEndAt > hours.close) {
      return fail("该时段不够完成本次服务，请改选开始时间。", "hours");
    }
    return ok({ bufferEnd: bufferEnd });
  }

  function checkTransitionConflicts(state, appt, action, now) {
    if (["arrive", "start", "finish"].indexOf(action) === -1) return ok();
    var others = occupyingAppointments(state, appt.id);
    for (var i = 0; i < others.length; i++) {
      var o = others[i];
      if (!isCurrentlyOccupying(o, now)) continue;
      var stLabel = (WF.STATUS_LABEL && WF.STATUS_LABEL[o.status]) || o.status;
      if (o.staffId === appt.staffId) {
        return fail("该技师上一单（" + o.no + "）仍在「" + stLabel + "」，不能继续推进本单。请先完成上一单。", "staff_busy");
      }
      if (o.roomId === appt.roomId) {
        return fail("该房间上一单（" + o.no + "）仍在「" + stLabel + "」，不能继续推进本单。请先完成上一单。", "room_busy");
      }
    }
    var start = appt.startAt;
    if (now < start) start = now;
    if (appt.startedAt && appt.startedAt < start) start = appt.startedAt;
    if (appt.arrivedAt && appt.arrivedAt < start) start = appt.arrivedAt;
    var end = appt.endAt;
    if (now > end) end = now;
    var staffHit = hasOverlap(locksOf(state, "staff", appt.staffId), start, end, appt.id);
    if (staffHit) {
      return fail("该技师这一段时间已被预约，无法开始或完成本单。", "staff_busy");
    }
    var bufferEnd = U().addMin(end, state.shop.bufferMin || 0);
    var roomHit = hasOverlap(locksOf(state, "room", appt.roomId), start, bufferEnd, appt.id);
    if (roomHit) {
      if (roomHit.purpose === "buffer") {
        return fail("该房间这一段时间处于清扫缓冲，无法开始或完成本单。", "buffer");
      }
      return fail("该房间这一段时间已被占用，无法开始或完成本单。", "room_busy");
    }
    return ok();
  }

  function nextNo(state) {
    state.seq = (state.seq || 1) + 1;
    var n = state.seq;
    var tag = U().dateStr(Date.now()).replace(/-/g, "").slice(2);
    var s = "00" + n;
    return "WF-" + tag + "-" + s.slice(-3);
  }

  function applyTimeouts(state, now) {
    now = now == null ? Date.now() : now;
    var changed = [];
    var list = state.appointments || [];
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      if (a.status !== "pending") continue;
      if (a.confirmDeadlineAt && a.confirmDeadlineAt <= now) {
        a.status = "timeout";
        a.timeoutAt = now;
        releaseLocks(state, a.id, { buffer: false });
        changed.push(a.id);
      }
    }
    return changed;
  }

  function releaseLocks(state, appointmentId, opts) {
    opts = opts || {};
    state.locks = (state.locks || []).filter(function (l) {
      return l.appointmentId !== appointmentId;
    });
    if (opts.buffer && opts.roomId && opts.from) {
      state.locks.push({
        id: U().uid("lock_buf"),
        shopId: state.shop.shopId,
        type: "room",
        purpose: "buffer",
        resourceId: opts.roomId,
        appointmentId: appointmentId,
        startAt: opts.from,
        endAt: U().addMin(opts.from, state.shop.bufferMin || 0)
      });
    }
  }

  function addServiceLocks(state, appt) {
    state.locks.push({
      id: U().uid("lock_stf"),
      shopId: state.shop.shopId,
      type: "staff",
      purpose: "service",
      resourceId: appt.staffId,
      appointmentId: appt.id,
      startAt: appt.startAt,
      endAt: appt.endAt
    });
    state.locks.push({
      id: U().uid("lock_room"),
      shopId: state.shop.shopId,
      type: "room",
      purpose: "service",
      resourceId: appt.roomId,
      appointmentId: appt.id,
      startAt: appt.startAt,
      endAt: U().addMin(appt.endAt, state.shop.bufferMin || 0)
    });
  }

  function canCustomerCancel(state, appt, now) {
    if (appt.status === "pending") return { ok: true };
    if (appt.status !== "confirmed") {
      return { ok: false, error: "当前状态不能取消，如需处理请联系门店。" };
    }
    var need = state.shop.cancelAdvanceMin || 0;
    if (appt.startAt - now < need * 60000) {
      return { ok: false, error: "距开始不足 " + need + " 分钟，已超过可自行取消的时间，请联系门店。" };
    }
    return { ok: true };
  }

  function assertPermission(role, action) {
    var def = ACTIONS[action];
    if (!def) return fail("未知操作。");
    if (def.roles.indexOf(role) === -1) {
      return fail("当前身份没有权限做这个操作。");
    }
    return ok();
  }

  function transition(state, appointmentId, action, payload, actor, now) {
    now = now == null ? Date.now() : now;
    payload = payload || {};
    applyTimeouts(state, now);
    var appt = U().byId(state.appointments, appointmentId);
    if (!appt) return fail("找不到这张预约。");
    var role = roleOf(state, actor);

    if (action === "cancel" && role === "customer") {
      if (appt.customerId !== currentCustomerId(state)) {
        return fail("当前身份没有权限做这个操作。");
      }
      var cc = canCustomerCancel(state, appt, now);
      if (!cc.ok) return cc;
    } else {
      var perm = assertPermission(role, action);
      if (!perm.ok) return perm;
    }

    var def = ACTIONS[action];
    if (!def || def.from.indexOf(appt.status) === -1) {
      if (action === "confirm" && appt.status === "timeout") {
        return fail("该预约已超过确认时限，时段已释放，请重新预约。");
      }
      if (action === "settle" && appt.status === "done") {
        return fail("这笔消费已经核销过了，不能重复操作。");
      }
      return fail("当前状态不能执行该操作（现为「" + (WF.STATUS_LABEL[appt.status] || appt.status) + "」）。");
    }

    if (action === "confirm") {
      appt.status = "confirmed";
      appt.confirmedAt = now;
      return ok({ appointment: appt });
    }

    if (action === "cancel") {
      appt.status = "cancelled";
      appt.cancelReason = payload.reason || (role === "customer" ? "顾客取消" : "门店取消");
      appt.cancelledAt = now;
      releaseLocks(state, appt.id, { buffer: false });
      return ok({ appointment: appt });
    }

    if (action === "timeout") {
      appt.status = "timeout";
      appt.timeoutAt = now;
      releaseLocks(state, appt.id, { buffer: false });
      return ok({ appointment: appt });
    }

    if (action === "arrive") {
      var arriveConflict = checkTransitionConflicts(state, appt, action, now);
      if (!arriveConflict.ok) return arriveConflict;
      appt.status = "arrived";
      appt.arrivedAt = now;
      syncLocksToActualStart(state, appt, now);
      return ok({ appointment: appt });
    }

    if (action === "noshow") {
      appt.status = "no_show";
      appt.noShowAt = now;
      appt.cancelReason = payload.reason || "逾期未到";
      releaseLocks(state, appt.id, { buffer: false });
      return ok({ appointment: appt });
    }

    if (action === "start") {
      var startConflict = checkTransitionConflicts(state, appt, action, now);
      if (!startConflict.ok) return startConflict;
      appt.status = "in_service";
      appt.startedAt = now;
      syncLocksToActualStart(state, appt, now);
      return ok({ appointment: appt });
    }

    if (action === "cancel_arrived") {
      appt.status = "cancel_arrived";
      appt.cancelReason = payload.reason || "到店后取消";
      appt.cancelledAt = now;
      releaseLocks(state, appt.id, { buffer: false });
      return ok({ appointment: appt });
    }

    if (action === "finish") {
      var finishConflict = checkTransitionConflicts(state, appt, action, now);
      if (!finishConflict.ok) return finishConflict;
      appt.status = "await_pay";
      appt.finishedAt = now;
      releaseLocks(state, appt.id, { buffer: true, roomId: appt.roomId, from: now });
      return ok({ appointment: appt });
    }

    if (action === "void_pay") {
      if (!payload.reason) return fail("作废待结算请填写原因。");
      appt.status = "void_pay";
      appt.voidReason = payload.reason;
      appt.voidedAt = now;
      return ok({ appointment: appt });
    }

    if (action === "settle") {
      return settle(state, appt, payload, role, now);
    }

    return fail("未知操作。");
  }

  function cardUsable(state, card, appt, now) {
    if (!card) return fail("找不到这张次卡。");
    if (card.customerId !== appt.customerId) return fail("这张次卡不属于该顾客。");
    if (card.status === "exhausted" || card.remaining <= 0) {
      return fail("次卡余次不足，请改用其他结算方式。");
    }
    if (card.expiresAt && card.expiresAt < now) {
      return fail("这张次卡已过期，请改用其他结算方式。");
    }
    if (card.status !== "active") return fail("这张次卡当前不可用。");
    var need = (appt.serviceIds || []).length;
    /* Per-item deduction: each listed service that is in scope costs 1 time. */
    var covered = 0;
    var scope = card.serviceIds;
    for (var i = 0; i < appt.serviceIds.length; i++) {
      if (scope === "all" || (scope && scope.indexOf(appt.serviceIds[i]) !== -1)) covered++;
    }
    if (covered <= 0) {
      return fail("这张次卡不适用于本次项目，请改用其他结算方式或选择模拟结算。");
    }
    if (covered < appt.serviceIds.length) {
      return fail("次卡未覆盖本次全部项目，请改用模拟结算，或拆分后重新预约。");
    }
    if (card.remaining < covered) {
      return fail("次卡余次不足，请改用其他结算方式。");
    }
    return ok({ times: covered });
  }

  function settle(state, appt, payload, role, now) {
    if (role !== "clerk" && role !== "owner") {
      return fail("当前身份没有权限做这个操作。");
    }
    if (appt.status !== "await_pay") {
      if (appt.status === "done") return fail("这笔消费已经核销过了，不能重复操作。");
      return fail("只有待结算的预约可以核销。");
    }
    if (appt.consumptionId) return fail("这笔消费已经核销过了，不能重复操作。");

    var method = payload.method || "sim_pay";
    var consumption = {
      id: U().uid("con"),
      shopId: state.shop.shopId,
      appointmentId: appt.id,
      customerId: appt.customerId,
      amountFen: method === "card" ? 0 : appt.priceFen,
      method: method,
      cardId: "",
      timesUsed: 0,
      createdAt: now,
      items: appt.serviceIds.slice()
    };

    if (method === "card") {
      var card = U().byId(state.cards, payload.cardId);
      var usable = cardUsable(state, card, appt, now);
      if (!usable.ok) return usable;
      card.remaining -= usable.times;
      if (card.remaining <= 0) {
        card.remaining = 0;
        card.status = "exhausted";
      }
      consumption.cardId = card.id;
      consumption.timesUsed = usable.times;
      consumption.amountFen = 0;
      state.cardLedger.push({
        id: U().uid("led"),
        cardId: card.id,
        appointmentId: appt.id,
        consumptionId: consumption.id,
        delta: -usable.times,
        createdAt: now
      });
    } else if (method !== "sim_pay") {
      return fail("未知的结算方式。");
    }

    state.consumptions.push(consumption);
    appt.status = "done";
    appt.settledAt = now;
    appt.settleMethod = method;
    appt.consumptionId = consumption.id;

    var cust = U().byId(state.users, appt.customerId);
    if (cust && !cust.firstConsumedAt) cust.firstConsumedAt = now;

    return ok({ appointment: appt, consumption: consumption });
  }

  function createAppointment(state, payload, actor, now) {
    now = now == null ? Date.now() : now;
    applyTimeouts(state, now);
    var role = roleOf(state, actor);
    var customerId = payload.customerId;
    if (role === "customer") customerId = currentCustomerId(state);
    if (!customerId) return fail("请选择顾客。");
    var cust = U().byId(state.users, customerId);
    if (!cust) return fail("找不到该顾客。");

    var serviceIds = payload.serviceIds || [];
    if (!serviceIds.length) return fail("请选择至少一个项目。");
    for (var i = 0; i < serviceIds.length; i++) {
      var sv = U().byId(state.services, serviceIds[i]);
      if (!sv || !sv.onSale) return fail("所选项目不可预约。");
    }
    var staffId = payload.staffId;
    if (!staffId) return fail("请选择技师。首版需指定技师，不做随机派钟。");
    if (!staffCanDo(state, staffId, serviceIds)) {
      return fail("该技师无法完成所选的全部项目，请改选技师或项目。");
    }
    var tot = totalsOf(state, serviceIds);
    if (!payload.startAt) return fail("请选择开始时间。");
    var startAt = +payload.startAt;
    var endAt = U().addMin(startAt, tot.durationMin);
    if (startAt < now - 30000) return fail("不能预约已经过去的时段，请改选开始时间。");

    var roomId = payload.roomId || defaultRoomFor(state, staffId);
    if (!roomId) return fail("该技师未绑定默认房间，请由老板在员工资料中设置。");

    var conflict = checkConflicts(state, staffId, roomId, startAt, endAt, null, {
      audience: role === "customer" ? "customer" : "staff",
      now: now
    });
    if (!conflict.ok) return conflict;

    /* Referral source: only when the customer has none; cannot set self as referrer. */
    var source = cust.source || "";
    if (!cust.sourceLocked && payload.source) {
      if (payload.source === cust.name || payload.source === "自己" || payload.source === cust.id) {
        return fail("不能把自己设为推荐人。");
      }
      source = payload.source;
      cust.source = source;
      cust.sourceLocked = true;
    }

    var auto = state.shop.confirmMode === "auto";
    var appt = {
      id: U().uid("apt"),
      no: nextNo(state),
      shopId: state.shop.shopId,
      customerId: customerId,
      serviceIds: serviceIds.slice(),
      staffId: staffId,
      roomId: roomId,
      startAt: startAt,
      endAt: endAt,
      durationMin: tot.durationMin,
      priceFen: tot.priceFen,
      status: auto ? "confirmed" : "pending",
      confirmDeadlineAt: auto ? null : U().addMin(now, state.shop.confirmTimeoutMin || 15),
      createdAt: now,
      confirmedAt: auto ? now : null,
      source: source,
      cancelReason: "",
      voidReason: "",
      settledAt: null,
      settleMethod: "",
      consumptionId: "",
      finishedAt: null,
      arrivedAt: null,
      startedAt: null
    };
    state.appointments.push(appt);
    addServiceLocks(state, appt);
    return ok({ appointment: appt, autoConfirmed: auto });
  }

  var SLOT_REASON_SHORT = {
    staff_busy: "技师已约",
    room_busy: "房间占用",
    buffer: "清扫缓冲",
    room_disabled: "房间停用",
    off: "未排班",
    break: "休息时段",
    block: "临时占用",
    shift: "不在排班",
    closed: "当日不营业",
    hours: "超出营业时间"
  };

  function listSlots(state, opts, now) {
    now = now == null ? Date.now() : now;
    applyTimeouts(state, now);
    var u = U();
    var serviceIds = opts.serviceIds || [];
    var staffId = opts.staffId;
    var date = opts.date;
    if (!serviceIds.length || !staffId || !date) return [];
    var tot = totalsOf(state, serviceIds);
    if (!tot.durationMin) return [];
    if (!staffCanDo(state, staffId, serviceIds)) return [];
    var roomId = opts.roomId || defaultRoomFor(state, staffId);
    var hours = shopHoursFor(state, u.atTime(date, "12:00"));
    if (hours.off) return [];
    var win = staffWindow(state, staffId, u.atTime(date, "12:00"));
    if (win.off) return [];
    var step = state.shop.slotStepMin || 15;
    var startMin = Math.max(hours.open, win.start);
    var endLimit = Math.min(hours.close, win.end);
    /* If today, first slot should be in the future, rounded up to step. */
    if (date === u.dateStr(now)) {
      var rounded = now;
      var p = u.partsOf(now);
      var rem = p.minute % step;
      if (rem !== 0 || p.second > 0) {
        rounded = u.addMin(u.atTime(date, u.pad(p.hour) + ":" + u.pad(p.minute - rem)), step);
      }
      if (rounded > startMin) startMin = rounded;
    }
    var slots = [];
    var cursor = startMin;
    /* Align cursor to step from 00:00. */
    var day0 = u.startOfDay(u.atTime(date, "00:00"));
    var minsFromDay = Math.ceil((cursor - day0) / 60000);
    var aligned = Math.ceil(minsFromDay / step) * step;
    cursor = u.addMin(day0, aligned);
    var audience = opts.audience || "customer";

    while (u.addMin(cursor, tot.durationMin) <= endLimit) {
      var endAt = u.addMin(cursor, tot.durationMin);
      var chk = checkConflicts(state, staffId, roomId, cursor, endAt, opts.ignoreAppointmentId || null, {
        audience: audience,
        now: now
      });
      var item = {
        startAt: cursor,
        endAt: endAt,
        roomId: roomId,
        label: u.timeStr(cursor) + "–" + u.timeStr(endAt),
        available: !!chk.ok,
        reason: chk.ok ? "" : (chk.error || "此时段不可预约"),
        reasonCode: chk.ok ? "" : (chk.code || "busy"),
        reasonShort: chk.ok ? "" : (SLOT_REASON_SHORT[chk.code] || "不可预约")
      };
      slots.push(item);
      cursor = u.addMin(cursor, step);
    }
    return slots;
  }

  function availableSlots(state, opts, now) {
    return listSlots(state, opts, now).filter(function (s) { return s.available; });
  }

  function eligibleStaff(state, serviceIds, date, now) {
    now = now == null ? Date.now() : now;
    var list = [];
    var techs = (state.staff || []).filter(function (s) { return s.role === "technician" && s.active; });
    for (var i = 0; i < techs.length; i++) {
      var t = techs[i];
      if (!staffCanDo(state, t.id, serviceIds)) continue;
      var at = U().atTime(date, "12:00");
      var win = staffWindow(state, t.id, at);
      if (win.off) continue;
      var slots = availableSlots(state, { serviceIds: serviceIds, staffId: t.id, date: date }, now);
      list.push({ staff: t, slotCount: slots.length, hasSlot: slots.length > 0 });
    }
    return list;
  }

  function roomStatusAt(state, now) {
    now = now == null ? Date.now() : now;
    applyTimeouts(state, now);
    var u = U();
    return (state.rooms || []).map(function (room) {
      if (!room.enabled) {
        return { room: room, status: "disabled", label: "已停用", until: null, appointment: null, lock: null };
      }
      var occList = occupyingAppointments(state, null);
      var live = null;
      for (var oi = 0; oi < occList.length; oi++) {
        if (occList[oi].roomId === room.id && isCurrentlyOccupying(occList[oi], now)) { live = occList[oi]; break; }
      }
      if (live) {
        return {
          room: room,
          status: "occupied",
          label: "已占用",
          until: live.endAt,
          untilLabel: now >= live.endAt ? "直至本单完成" : ("至 " + u.timeStr(live.endAt)),
          appointment: live,
          lock: null
        };
      }
      var locks = locksOf(state, "room", room.id);
      var hit = null;
      for (var i = 0; i < locks.length; i++) {
        if (now >= locks[i].startAt && now < locks[i].endAt) {
          hit = locks[i];
          break;
        }
      }
      if (!hit) {
        /* upcoming? */
        var next = null;
        for (var j = 0; j < locks.length; j++) {
          if (locks[j].startAt >= now && (!next || locks[j].startAt < next.startAt)) next = locks[j];
        }
        return {
          room: room,
          status: "idle",
          label: "空闲",
          until: next ? next.startAt : null,
          appointment: next ? u.byId(state.appointments, next.appointmentId) : null,
          lock: null
        };
      }
      var appt = u.byId(state.appointments, hit.appointmentId);
      if (hit.purpose === "buffer") {
        return { room: room, status: "buffer", label: "清扫缓冲", until: hit.endAt, appointment: appt, lock: hit };
      }
      return { room: room, status: "occupied", label: "已占用", until: hit.endAt, appointment: appt, lock: hit };
    });
  }

  function issueCard(state, payload, actor, now) {
    now = now == null ? Date.now() : now;
    var role = roleOf(state, actor);
    if (role !== "owner") return fail("当前身份没有权限做这个操作。");
    var customerId = payload.customerId;
    if (!U().byId(state.users, customerId)) return fail("找不到该顾客。");
    if (!payload.name) return fail("请填写次卡名称。");
    var total = parseInt(payload.total, 10);
    if (!total || total < 1) return fail("次卡次数至少为 1。");
    var months = parseInt(payload.validMonths, 10) || 6;
    var serviceIds = payload.serviceIds && payload.serviceIds.length ? payload.serviceIds : "all";
    var card = {
      id: U().uid("card"),
      shopId: state.shop.shopId,
      customerId: customerId,
      name: payload.name,
      remaining: total,
      total: total,
      serviceIds: serviceIds,
      issuedAt: now,
      expiresAt: U().addDays(now, months * 30),
      status: "active",
      note: "由老板在演示中发放，非真实售卡。"
    };
    state.cards.push(card);
    return ok({ card: card });
  }

  function demoBuyCard(state, payload, actor, now) {
    now = now == null ? Date.now() : now;
    var role = roleOf(state, actor);
    if (role !== "customer") return fail("请从顾客端走演示购卡。");
    var customerId = currentCustomerId(state);
    var pack = payload.pack || {};
    var total = pack.total || 5;
    var card = {
      id: U().uid("card"),
      shopId: state.shop.shopId,
      customerId: customerId,
      name: pack.name || "演示次卡",
      remaining: total,
      total: total,
      serviceIds: pack.serviceIds || "all",
      issuedAt: now,
      expiresAt: U().addDays(now, (pack.validMonths || 6) * 30),
      status: "active",
      note: "顾客演示购卡，未发生真实支付。"
    };
    state.cards.push(card);
    return ok({ card: card });
  }

  function updateShop(state, patch, actor) {
    if (roleOf(state, actor) !== "owner") return fail("当前身份没有权限做这个操作。");
    var allowed = [
      "name", "slogan", "address", "phone", "hoursText", "announcement", "intro",
      "confirmMode", "confirmTimeoutMin", "bufferMin", "cancelAdvanceMin",
      "slotStepMin", "displayIntervalMin"
    ];
    for (var i = 0; i < allowed.length; i++) {
      var k = allowed[i];
      if (patch[k] !== undefined) {
        var v = patch[k];
        if (["confirmTimeoutMin", "bufferMin", "cancelAdvanceMin", "slotStepMin", "displayIntervalMin"].indexOf(k) !== -1) {
          v = parseInt(v, 10);
          if (isNaN(v) || v < 0) return fail("请填写有效的分钟数。");
        }
        if (k === "confirmMode" && v !== "manual" && v !== "auto") return fail("确认方式只能是需要确认或自动确认。");
        state.shop[k] = v;
      }
    }
    if (patch.weeklyHours) state.shop.weeklyHours = patch.weeklyHours;
    return ok({ shop: state.shop });
  }

  function saveSchedule(state, staffId, weeklySpec, actor) {
    if (roleOf(state, actor) !== "owner") return fail("当前身份没有权限做这个操作。");
    if (!U().byId(state.staff, staffId)) return fail("找不到该技师。");
    state.schedules = (state.schedules || []).filter(function (s) {
      return !(s.staffId === staffId && s.type === "weekly");
    });
    for (var w = 0; w <= 6; w++) {
      var spec = weeklySpec[w] || { off: true, start: "10:00", end: "22:00", breaks: [] };
      state.schedules.push({
        id: U().uid("sch"),
        shopId: state.shop.shopId,
        staffId: staffId,
        type: "weekly",
        weekday: w,
        start: spec.start || "10:00",
        end: spec.end || "22:00",
        breaks: spec.breaks || [],
        off: !!spec.off
      });
    }
    return ok();
  }

  function saveDateSchedule(state, staffId, date, spec, actor) {
    if (roleOf(state, actor) !== "owner") return fail("当前身份没有权限做这个操作。");
    state.schedules = (state.schedules || []).filter(function (s) {
      return !(s.staffId === staffId && s.type === "date" && s.date === date);
    });
    state.schedules.push({
      id: U().uid("schd"),
      shopId: state.shop.shopId,
      staffId: staffId,
      type: "date",
      date: date,
      weekday: U().partsOf(U().atTime(date, "12:00")).weekday,
      start: spec.start || "10:00",
      end: spec.end || "22:00",
      breaks: spec.breaks || [],
      off: !!spec.off
    });
    return ok();
  }

  function addBlock(state, payload, actor) {
    if (roleOf(state, actor) !== "owner") return fail("当前身份没有权限做这个操作。");
    var startAt = +payload.startAt;
    var endAt = +payload.endAt;
    if (!payload.staffId || !startAt || !endAt || endAt <= startAt) return fail("请完整填写临时占用的技师与时段。");
    var hit = hasOverlap(locksOf(state, "staff", payload.staffId), startAt, endAt, null);
    if (hit) return fail("该技师这一段时间已被预约，无法再标记为临时占用。");
    state.blocks.push({
      id: U().uid("blk"),
      shopId: state.shop.shopId,
      staffId: payload.staffId,
      startAt: startAt,
      endAt: endAt,
      reason: payload.reason || "临时占用"
    });
    return ok();
  }

  function upsertService(state, payload, actor) {
    if (roleOf(state, actor) !== "owner") return fail("当前身份没有权限做这个操作。");
    if (!payload.name) return fail("请填写项目名称。");
    var durationMin = parseInt(payload.durationMin, 10);
    var priceFen = payload.priceFen != null ? parseInt(payload.priceFen, 10) : Math.round(parseFloat(payload.priceYuan) * 100);
    if (!durationMin || durationMin < 5) return fail("请填写有效的项目时长。");
    if (isNaN(priceFen) || priceFen < 0) return fail("请填写有效价格。");
    var existing = payload.id ? U().byId(state.services, payload.id) : null;
    if (existing) {
      existing.name = payload.name;
      existing.category = payload.category || existing.category;
      existing.durationMin = durationMin;
      existing.priceFen = priceFen;
      existing.desc = payload.desc != null ? payload.desc : existing.desc;
      if (payload.onSale != null) existing.onSale = !!payload.onSale;
      if (payload.featured != null) existing.featured = !!payload.featured;
      return ok({ service: existing });
    }
    var svc = {
      id: U().uid("svc"),
      shopId: state.shop.shopId,
      name: payload.name,
      category: payload.category || "养生",
      durationMin: durationMin,
      priceFen: priceFen,
      desc: payload.desc || "",
      onSale: payload.onSale !== false,
      featured: !!payload.featured
    };
    state.services.push(svc);
    return ok({ service: svc });
  }

  function upsertStaff(state, payload, actor) {
    if (roleOf(state, actor) !== "owner") return fail("当前身份没有权限做这个操作。");
    if (!payload.name) return fail("请填写姓名。");
    var existing = payload.id ? U().byId(state.staff, payload.id) : null;
    if (existing) {
      if (existing.role === "owner" && payload.active === false) {
        return fail("不能停用当前馆主账号。");
      }
      existing.name = payload.name;
      existing.title = payload.title || existing.title;
      existing.bio = payload.bio != null ? payload.bio : existing.bio;
      if (payload.specialties) existing.specialties = payload.specialties;
      if (payload.defaultRoomId != null) existing.defaultRoomId = payload.defaultRoomId;
      if (payload.active != null) existing.active = !!payload.active;
      return ok({ staff: existing });
    }
    var role = payload.role || "technician";
    if (role === "owner") return fail("不能通过此页直接新增馆主。门店已有馆主，避免空表自称。");
    var st = {
      id: U().uid("stf"),
      shopId: state.shop.shopId,
      name: payload.name,
      role: role,
      title: payload.title || (role === "clerk" ? "店员" : "技师"),
      specialties: payload.specialties || [],
      defaultRoomId: payload.defaultRoomId || "",
      bio: payload.bio || "虚构演示角色。",
      active: true
    };
    state.staff.push(st);
    if (role === "technician") {
      /* default weekly schedule */
      var spec = {};
      for (var w = 0; w <= 6; w++) spec[w] = { off: false, start: "10:00", end: "22:00", breaks: [] };
      saveSchedule(state, st.id, spec, actor);
    }
    return ok({ staff: st });
  }

  function upsertRoom(state, payload, actor) {
    if (roleOf(state, actor) !== "owner") return fail("当前身份没有权限做这个操作。");
    if (!payload.name) return fail("请填写房间名称。");
    var existing = payload.id ? U().byId(state.rooms, payload.id) : null;
    if (existing) {
      existing.name = payload.name;
      if (payload.floor != null) existing.floor = payload.floor;
      if (payload.note != null) existing.note = payload.note;
      if (payload.enabled != null) existing.enabled = !!payload.enabled;
      return ok({ room: existing });
    }
    var room = {
      id: U().uid("room"),
      shopId: state.shop.shopId,
      name: payload.name,
      floor: payload.floor || "",
      enabled: payload.enabled !== false,
      note: payload.note || ""
    };
    state.rooms.push(room);
    return ok({ room: room });
  }

  function addClerkAccount(state, payload, actor) {
    if (roleOf(state, actor) !== "owner") return fail("当前身份没有权限做这个操作。");
    if (!payload.name) return fail("请填写店员姓名。");
    /* Only add clerk, never owner — no empty-table self promotion. */
    var stRes = upsertStaff(state, { name: payload.name, role: "clerk", title: "店员", bio: "由馆主添加的演示店员。" }, actor);
    if (!stRes.ok) return stRes;
    var acct = {
      id: U().uid("acct"),
      staffId: stRes.staff.id,
      role: "clerk",
      name: payload.name,
      active: true
    };
    state.staffAccounts.push(acct);
    return ok({ account: acct, staff: stRes.staff });
  }

  function setClerkActive(state, accountId, active, actor) {
    if (roleOf(state, actor) !== "owner") return fail("当前身份没有权限做这个操作。");
    var acct = U().byId(state.staffAccounts, accountId);
    if (!acct) return fail("找不到该账号。");
    if (acct.role === "owner") return fail("不能停用馆主账号。");
    acct.active = !!active;
    var st = U().byId(state.staff, acct.staffId);
    if (st && st.role === "clerk") st.active = !!active;
    return ok({ account: acct });
  }

  function promoteForbidden(state, actor) {
    return fail("当前身份没有权限做这个操作。店员不能把自己提成管理员或馆主。");
  }

  function dashboard(state, now) {
    now = now == null ? Date.now() : now;
    applyTimeouts(state, now);
    var u = U();
    var day = u.dateStr(now);
    var start = u.startOfDay(now);
    var end = u.addDays(start, 1);
    var apts = state.appointments || [];
    var todayApts = apts.filter(function (a) { return a.startAt >= start && a.startAt < end; });
    var statusCount = {};
    for (var k in WF.STATUS_LABEL) statusCount[k] = 0;
    todayApts.forEach(function (a) { statusCount[a.status] = (statusCount[a.status] || 0) + 1; });

    var arrivedLike = ["arrived", "in_service", "await_pay", "done"];
    var arrived = todayApts.filter(function (a) { return arrivedLike.indexOf(a.status) !== -1; }).length;

    var cons = (state.consumptions || []).filter(function (c) { return c.createdAt >= start && c.createdAt < end; });
    var revenue = 0;
    var cardRedeem = 0;
    var newCustIds = {};
    cons.forEach(function (c) {
      revenue += c.amountFen || 0;
      if (c.method === "card") cardRedeem += 1;
    });
    (state.users || []).forEach(function (c) {
      if (c.firstConsumedAt && c.firstConsumedAt >= start && c.firstConsumedAt < end) {
        newCustIds[c.id] = true;
      }
    });

    var pendingAll = apts.filter(function (a) { return a.status === "pending"; }).length;
    var awaitAll = apts.filter(function (a) { return a.status === "await_pay"; }).length;

    var sourceMap = {};
    (state.users || []).forEach(function (c) {
      var key = c.source || "未填写";
      if (!sourceMap[key]) sourceMap[key] = { source: key, people: 0, converted: 0 };
      sourceMap[key].people += 1;
      if (c.firstConsumedAt) sourceMap[key].converted += 1;
    });

    return {
      date: day,
      appointmentCount: todayApts.length,
      arrivedCount: arrived,
      doneCount: cons.length,
      revenueFen: revenue,
      pendingCount: pendingAll,
      awaitPayCount: awaitAll,
      newCustomerCount: Object.keys(newCustIds).length,
      cardRedeemCount: cardRedeem,
      statusCount: statusCount,
      todayAppointments: todayApts,
      sources: sourceMap,
      consumptionsToday: cons
    };
  }

  function forceTimeout(state, appointmentId, actor, now) {
    now = now == null ? Date.now() : now;
    var role = roleOf(state, actor);
    if (role !== "clerk" && role !== "owner") return fail("当前身份没有权限做这个操作。");
    var appt = U().byId(state.appointments, appointmentId);
    if (!appt) return fail("找不到这张预约。");
    if (appt.status !== "pending") return fail("只有待确认的预约可以演示超时。");
    appt.confirmDeadlineAt = now - 1000;
    applyTimeouts(state, now);
    return ok({ appointment: U().byId(state.appointments, appointmentId) });
  }

  WF.rules = {
    ACTIONS: ACTIONS,
    fail: fail,
    ok: ok,
    applyTimeouts: applyTimeouts,
    createAppointment: createAppointment,
    transition: transition,
    settle: settle,
    availableSlots: availableSlots,
    listSlots: listSlots,
    eligibleStaff: eligibleStaff,
    roomStatusAt: roomStatusAt,
    checkConflicts: checkConflicts,
    checkTransitionConflicts: checkTransitionConflicts,
    occupyingAppointments: occupyingAppointments,
    isCurrentlyOccupying: isCurrentlyOccupying,
    syncLocksToActualStart: syncLocksToActualStart,
    staffCanDo: staffCanDo,
    staffWindow: staffWindow,
    scheduleFor: scheduleFor,
    shopHoursFor: shopHoursFor,
    totalsOf: totalsOf,
    defaultRoomFor: defaultRoomFor,
    issueCard: issueCard,
    demoBuyCard: demoBuyCard,
    cardUsable: cardUsable,
    updateShop: updateShop,
    saveSchedule: saveSchedule,
    saveDateSchedule: saveDateSchedule,
    addBlock: addBlock,
    upsertService: upsertService,
    upsertStaff: upsertStaff,
    upsertRoom: upsertRoom,
    addClerkAccount: addClerkAccount,
    setClerkActive: setClerkActive,
    promoteForbidden: promoteForbidden,
    dashboard: dashboard,
    forceTimeout: forceTimeout,
    inStaffShift: inStaffShift,
    locksOf: locksOf
  };
})(typeof window !== "undefined" ? window : global);
