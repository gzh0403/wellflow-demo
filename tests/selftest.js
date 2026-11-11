/* WellFlow P2 self-test. Run: node tests/selftest.js  (from project root) */
var fs = require("fs");
var path = require("path");
var vm = require("vm");

var root = path.resolve(__dirname, "..");
var sandbox = { console: console, Date: Date, Intl: Intl, JSON: JSON, Math: Math, parseInt: parseInt, parseFloat: parseFloat, isNaN: isNaN, Object: Object, Array: Array, String: String, Number: Number, Error: Error };
sandbox.global = sandbox;
sandbox.window = undefined;
sandbox.localStorage = (function () {
  var m = {};
  return {
    getItem: function (k) { return m[k] || null; },
    setItem: function (k, v) { m[k] = String(v); },
    removeItem: function (k) { delete m[k]; },
    clear: function () { m = {}; }
  };
})();

function load(file) {
  var code = fs.readFileSync(path.join(root, file), "utf8");
  vm.runInNewContext(code, sandbox, { filename: file });
}

load("js/utils.js");
load("js/seed.js");
load("js/rules.js");
load("js/store.js");

var WF = sandbox.WF;
var U = WF.utils;
var R = WF.rules;
var failed = 0;
var passed = 0;
var logs = [];

function assert(name, cond, detail) {
  if (cond) {
    passed++;
    logs.push("  PASS  " + name);
  } else {
    failed++;
    logs.push("  FAIL  " + name + (detail ? " — " + detail : ""));
  }
}

function fresh(now) {
  return WF.buildSeed(now || Date.now());
}

/* ---------- Time helpers ---------- */
(function () {
  var ms = U.zonedTimeToUtc(2026, 11, 11, 18, 39, 0);
  var p = U.partsOf(ms);
  assert("Asia/Shanghai parts keep 18:39", p.hour === 18 && p.minute === 39 && p.day === 11, JSON.stringify(p));
  assert("dateStr formats 2026-11-11", U.dateStr(ms) === "2026-11-11");
  assert("addMin 45 minutes", U.timeStr(U.addMin(ms, 45)) === "19:24");
  assert("overlaps half-open interval end-to-start is free", !U.overlaps(0, 45, 45, 90));
  assert("overlaps when intersecting", U.overlaps(0, 50, 45, 90));
})();

/* ---------- Seed integrity ---------- */
(function () {
  var now = U.zonedTimeToUtc(2026, 11, 11, 16, 20, 0);
  var st = fresh(now);
  assert("shopId reserved", st.shop.shopId === "shop_wellflow_demo");
  assert("confirm mode default manual", st.shop.confirmMode === "manual");
  assert("buffer default 15", st.shop.bufferMin === 15);
  assert("at least 3 technicians", st.staff.filter(function (s) { return s.role === "technician"; }).length >= 3);
  assert("at least 4 rooms", st.rooms.length >= 4);
  assert("has 45-min service", st.services.some(function (s) { return s.durationMin === 45; }));
  assert("has redeemable card", st.cards.some(function (c) { return c.customerId === "usr_lin" && c.remaining > 0; }));
  var statuses = {};
  st.appointments.forEach(function (a) { statuses[a.status] = true; });
  ["pending", "confirmed", "arrived", "in_service", "await_pay", "done"].forEach(function (s) {
    assert("seed has status " + s, !!statuses[s], "missing " + s);
  });
  /* no staff/room lock overlaps in seed */
  var bad = 0;
  for (var i = 0; i < st.locks.length; i++) {
    for (var j = i + 1; j < st.locks.length; j++) {
      var a = st.locks[i], b = st.locks[j];
      if (a.type === b.type && a.resourceId === b.resourceId && U.overlaps(a.startAt, a.endAt, b.startAt, b.endAt)) bad++;
    }
  }
  assert("seed locks do not overlap on same resource", bad === 0, "overlaps=" + bad);
  /* amounts stored in fen */
  assert("prices in fen", st.services[0].priceFen > 100);
})();

/* ---------- State machine happy path ---------- */
(function () {
  var now = U.zonedTimeToUtc(2026, 11, 11, 11, 0, 0);
  var st = fresh(now);
  st.shop.confirmMode = "manual";
  /* Pick a free staff/room/slot far from seed bookings: 岑白 morning may be busy; use a computed slot */
  var date = "2026-11-11";
  var slots = R.availableSlots(st, { serviceIds: ["svc_head"], staffId: "stf_pei", date: date }, now);
  assert("available slots exist for 裴暖/头部释压", slots.length > 0, "slots=" + slots.length);
  if (!slots.length) return;
  var created = R.createAppointment(st, {
    serviceIds: ["svc_head"],
    staffId: "stf_pei",
    startAt: slots[0].startAt,
    customerId: "usr_lin"
  }, { role: "customer" }, now);
  assert("create pending appointment", created.ok && created.appointment.status === "pending", created.error);
  var id = created.appointment && created.appointment.id;
  var staffLocks = st.locks.filter(function (l) { return l.appointmentId === id && l.type === "staff"; });
  var roomLocks = st.locks.filter(function (l) { return l.appointmentId === id && l.type === "room"; });
  assert("staff lock unique id present", staffLocks.length === 1 && !!staffLocks[0].id);
  assert("room lock unique id present and independent", roomLocks.length === 1 && roomLocks[0].id !== staffLocks[0].id);
  assert("room lock includes 15-min buffer", roomLocks[0].endAt === U.addMin(created.appointment.endAt, 15));
  assert("staff lock ends at service end (no buffer)", staffLocks[0].endAt === created.appointment.endAt);

  var r1 = R.transition(st, id, "confirm", {}, { role: "clerk" }, now);
  assert("pending -> confirmed", r1.ok && st.appointments.filter(function (a) { return a.id === id; })[0].status === "confirmed", r1.error);
  var t0 = created.appointment.startAt;
  var r2 = R.transition(st, id, "arrive", {}, { role: "clerk" }, t0);
  assert("confirmed -> arrived", r2.ok, r2.error);
  var r3 = R.transition(st, id, "start", {}, { role: "clerk" }, t0);
  assert("arrived -> in_service", r3.ok, r3.error);
  var finishAt = U.addMin(t0, 20);
  var r4 = R.transition(st, id, "finish", {}, { role: "clerk" }, finishAt);
  assert("in_service -> await_pay", r4.ok && r4.appointment.status === "await_pay", r4.error);
  var stillStaff = st.locks.some(function (l) { return l.appointmentId === id && l.type === "staff"; });
  var buf = st.locks.filter(function (l) { return l.appointmentId === id && l.purpose === "buffer"; });
  assert("finish releases staff lock", !stillStaff);
  assert("finish starts room cleaning buffer", buf.length === 1 && buf[0].startAt === finishAt && buf[0].endAt === U.addMin(finishAt, 15));
  var r5 = R.transition(st, id, "settle", { method: "sim_pay" }, { role: "clerk" }, finishAt);
  assert("await_pay -> done via sim pay", r5.ok && r5.appointment.status === "done", r5.error);
  assert("consumption recorded", !!r5.consumption && r5.consumption.amountFen === created.appointment.priceFen);
})();

/* ---------- Illegal transitions & permissions ---------- */
(function () {
  var now = U.zonedTimeToUtc(2026, 11, 11, 11, 0, 0);
  var st = fresh(now);
  var slots = R.availableSlots(st, { serviceIds: ["svc_head"], staffId: "stf_qiu", date: "2026-11-11" }, now);
  if (!slots.length) {
    assert("slot for permission tests", false, "no slots");
    return;
  }
  var created = R.createAppointment(st, { serviceIds: ["svc_head"], staffId: "stf_qiu", startAt: slots[0].startAt }, { role: "customer" }, now);
  var id = created.appointment.id;
  var bad = R.transition(st, id, "arrive", {}, { role: "clerk" }, now);
  assert("cannot arrive from pending", !bad.ok);
  var custConfirm = R.transition(st, id, "confirm", {}, { role: "customer" }, now);
  assert("customer cannot confirm", !custConfirm.ok && /没有权限/.test(custConfirm.error), custConfirm.error);
  var custSettle = R.transition(st, id, "settle", { method: "sim_pay" }, { role: "customer" }, now);
  assert("customer cannot settle", !custSettle.ok);
  var issue = R.issueCard(st, { customerId: "usr_lin", name: "x", total: 3 }, { role: "clerk" }, now);
  assert("clerk cannot issue card", !issue.ok && /没有权限/.test(issue.error), issue.error);
  var promo = R.promoteForbidden(st, { role: "clerk" });
  assert("clerk cannot self-promote", !promo.ok);
  var addOwner = R.upsertStaff(st, { name: "伪老板", role: "owner" }, { role: "owner" }, now);
  assert("cannot add a second owner via staff form", !addOwner.ok, addOwner.error);
})();

/* ---------- Auto confirm ---------- */
(function () {
  var now = U.zonedTimeToUtc(2026, 11, 11, 11, 0, 0);
  var st = fresh(now);
  st.shop.confirmMode = "auto";
  var slots = R.availableSlots(st, { serviceIds: ["svc_head"], staffId: "stf_pei", date: "2026-11-11" }, now);
  var created = R.createAppointment(st, { serviceIds: ["svc_head"], staffId: "stf_pei", startAt: slots[0].startAt }, { role: "customer" }, now);
  assert("auto confirm goes to confirmed", created.ok && created.appointment.status === "confirmed" && created.autoConfirmed, created.error);
})();

/* ---------- Timeout releases locks ---------- */
(function () {
  var now = U.zonedTimeToUtc(2026, 11, 11, 11, 0, 0);
  var st = fresh(now);
  st.shop.confirmMode = "manual";
  st.shop.confirmTimeoutMin = 15;
  var slots = R.availableSlots(st, { serviceIds: ["svc_head"], staffId: "stf_pei", date: "2026-11-11" }, now);
  var created = R.createAppointment(st, { serviceIds: ["svc_head"], staffId: "stf_pei", startAt: slots[0].startAt }, { role: "customer" }, now);
  var id = created.appointment.id;
  var later = U.addMin(now, 16);
  var changed = R.applyTimeouts(st, later);
  var appt = U.byId(st.appointments, id);
  assert("timeout changes status", changed.indexOf(id) !== -1 && appt.status === "timeout");
  assert("timeout releases staff and room locks", !st.locks.some(function (l) { return l.appointmentId === id; }));
  var confirmLate = R.transition(st, id, "confirm", {}, { role: "clerk" }, later);
  assert("cannot confirm after timeout", !confirmLate.ok && /确认时限/.test(confirmLate.error), confirmLate.error);
  /* slot should be free again */
  var slots2 = R.availableSlots(st, { serviceIds: ["svc_head"], staffId: "stf_pei", date: "2026-11-11" }, later);
  var same = slots2.some(function (s) { return s.startAt === slots[0].startAt; });
  assert("released interval can be booked again", same);
})();

/* ---------- Staff conflict ---------- */
(function () {
  var now = U.zonedTimeToUtc(2026, 11, 11, 11, 0, 0);
  var st = fresh(now);
  var slots = R.availableSlots(st, { serviceIds: ["svc_neck"], staffId: "stf_pei", date: "2026-11-11" }, now);
  var a = R.createAppointment(st, { serviceIds: ["svc_neck"], staffId: "stf_pei", startAt: slots[0].startAt }, { role: "customer" }, now);
  assert("first 45min booking ok", a.ok, a.error);
  st.currentUserId = "usr_mo";
  var b = R.createAppointment(st, { serviceIds: ["svc_neck"], staffId: "stf_pei", startAt: slots[0].startAt }, { role: "customer" }, now);
  assert("same technician same slot rejected", !b.ok && /技师/.test(b.error), b.error);
})();

/* ---------- Room conflict (different technicians, same default room) ---------- */
(function () {
  var now = U.zonedTimeToUtc(2026, 11, 11, 11, 0, 0);
  var st = fresh(now);
  /* Force two techs onto the same room. */
  var pei = U.byId(st.staff, "stf_pei");
  var jiang = U.byId(st.staff, "stf_jiang");
  jiang.defaultRoomId = pei.defaultRoomId;
  var peiSlots = R.availableSlots(st, { serviceIds: ["svc_neck"], staffId: "stf_pei", date: "2026-11-11" }, now);
  /* Pick a start time when 江朔 is also on shift, so the rejection is about the room, not his break. */
  var start = null;
  for (var i = 0; i < peiSlots.length; i++) {
    var shift = R.inStaffShift(st, "stf_jiang", peiSlots[i].startAt, peiSlots[i].endAt);
    if (shift.ok) { start = peiSlots[i].startAt; break; }
  }
  assert("found a shared on-shift slot for room-conflict test", !!start, "no shared slot");
  var a = R.createAppointment(st, { serviceIds: ["svc_neck"], staffId: "stf_pei", startAt: start }, { role: "customer" }, now);
  assert("room conflict setup booking ok", a.ok, a.error);
  st.currentUserId = "usr_mo";
  var b = R.createAppointment(st, { serviceIds: ["svc_neck"], staffId: "stf_jiang", startAt: start, roomId: pei.defaultRoomId }, { role: "customer" }, now);
  assert("same room same slot rejected even with different staff", !b.ok && /房间/.test(b.error), b.error);
})();

/* ---------- 45-minute continuous interval (not rounded to 60) + buffer ---------- */
(function () {
  var now = U.zonedTimeToUtc(2026, 11, 11, 11, 0, 0);
  var st = fresh(now);
  var slots = R.availableSlots(st, { serviceIds: ["svc_neck"], staffId: "stf_pei", date: "2026-11-11" }, now);
  var a = R.createAppointment(st, { serviceIds: ["svc_neck"], staffId: "stf_pei", startAt: slots[0].startAt }, { role: "customer" }, now);
  var end = a.appointment.endAt;
  assert("45-min appointment length is 45", a.appointment.durationMin === 45 && end === U.addMin(slots[0].startAt, 45));
  /* Technician is free at exact end (no rounding to 60). */
  st.currentUserId = "usr_mo";
  var immediately = R.createAppointment(st, { serviceIds: ["svc_head"], staffId: "stf_pei", startAt: end }, { role: "customer" }, now);
  /* Room still in 15-min buffer, so if same default room, should fail. */
  assert("room buffer blocks booking in the 15 min after a 45-min service", !immediately.ok && /清扫缓冲|房间/.test(immediately.error), immediately.error);
  /* After buffer (15 min), room + technician should both be free.
     Technician was free at `end`, room free at end+15. */
  var afterBuf = R.createAppointment(st, { serviceIds: ["svc_head"], staffId: "stf_pei", startAt: U.addMin(end, 15) }, { role: "customer" }, now);
  assert("after buffer, same room can be booked again", afterBuf.ok, afterBuf.error);
  /* And a DIFFERENT room would allow the technician to start at exact end.
     Switch pei's next booking to another room? The default room is buffered, so we must pass another room — but rules use default room unless payload.roomId.
     Booking with a different roomId: */
  /* already used end+0 with default room failed. Try with another room. Recreate clean state. */
  var st2 = fresh(now);
  var slots2 = R.availableSlots(st2, { serviceIds: ["svc_neck"], staffId: "stf_pei", date: "2026-11-11" }, now);
  R.createAppointment(st2, { serviceIds: ["svc_neck"], staffId: "stf_pei", startAt: slots2[0].startAt }, { role: "customer" }, now);
  st2.currentUserId = "usr_mo";
  var otherRoom = st2.rooms.filter(function (r) { return r.id !== U.byId(st2.staff, "stf_pei").defaultRoomId; })[0];
  var techAtEnd = R.createAppointment(st2, {
    serviceIds: ["svc_head"],
    staffId: "stf_pei",
    startAt: U.addMin(slots2[0].startAt, 45),
    roomId: otherRoom.id
  }, { role: "customer" }, now);
  assert("technician can start next service at exact 45-min end if another room is used", techAtEnd.ok, techAtEnd.error);
})();

/* ---------- Card redeem, insufficient, duplicate ---------- */
(function () {
  var now = U.zonedTimeToUtc(2026, 11, 11, 16, 20, 0);
  var st = fresh(now);
  var awaitApt = U.byId(st.appointments, "apt_await");
  /* apt_await is 经络推拿 for 陈予 — 林澄's foot card shouldn't apply; use sim first path with a card-matched appointment. */
  var linCard = U.byId(st.cards, "card_lin_foot");
  var before = linCard.remaining;
  /* Build a foot appointment for 林澄 already in await_pay */
  var fake = {
    id: "apt_card_test",
    no: "WF-TEST",
    shopId: st.shop.shopId,
    customerId: "usr_lin",
    serviceIds: ["svc_foot"],
    staffId: "stf_pei",
    roomId: "room_chen",
    startAt: now,
    endAt: U.addMin(now, 60),
    durationMin: 60,
    priceFen: 16800,
    status: "await_pay",
    consumptionId: "",
    finishedAt: now
  };
  st.appointments.push(fake);
  var wrong = R.transition(st, fake.id, "settle", { method: "card", cardId: "card_lin_neck" }, { role: "clerk" }, now);
  assert("card not covering service is rejected", !wrong.ok && /不适用于|未覆盖/.test(wrong.error), wrong.error);
  var okCard = R.transition(st, fake.id, "settle", { method: "card", cardId: "card_lin_foot" }, { role: "clerk" }, now);
  assert("card redeem succeeds and deducts 1", okCard.ok && linCard.remaining === before - 1, okCard.error + " rem=" + linCard.remaining);
  assert("ledger written", st.cardLedger.some(function (l) { return l.consumptionId === okCard.consumption.id && l.delta === -1; }));
  var dup = R.transition(st, fake.id, "settle", { method: "card", cardId: "card_lin_foot" }, { role: "clerk" }, now);
  assert("duplicate redeem rejected", !dup.ok && /已经核销/.test(dup.error), dup.error);
  /* exhaust then fail */
  linCard.remaining = 0;
  linCard.status = "exhausted";
  var fake2 = JSON.parse(JSON.stringify(fake));
  fake2.id = "apt_card_test2";
  fake2.consumptionId = "";
  fake2.status = "await_pay";
  st.appointments.push(fake2);
  var empty = R.transition(st, fake2.id, "settle", { method: "card", cardId: "card_lin_foot" }, { role: "clerk" }, now);
  assert("insufficient times rejected", !empty.ok && /余次不足/.test(empty.error), empty.error);
})();

/* ---------- Self referral ---------- */
(function () {
  var now = U.zonedTimeToUtc(2026, 11, 11, 11, 0, 0);
  var st = fresh(now);
  st.currentUserId = "usr_mo"; /* no source yet */
  var slots = R.availableSlots(st, { serviceIds: ["svc_head"], staffId: "stf_qiu", date: "2026-11-11" }, now);
  var bad = R.createAppointment(st, {
    serviceIds: ["svc_head"],
    staffId: "stf_qiu",
    startAt: slots[0].startAt,
    source: "莫轻舟"
  }, { role: "customer" }, now);
  assert("cannot set self as referral source", !bad.ok && /推荐人/.test(bad.error), bad.error);
  var okS = R.createAppointment(st, {
    serviceIds: ["svc_head"],
    staffId: "stf_qiu",
    startAt: slots[0].startAt,
    source: "朋友推荐"
  }, { role: "customer" }, now);
  assert("first source can be written", okS.ok && U.byId(st.users, "usr_mo").source === "朋友推荐" && U.byId(st.users, "usr_mo").sourceLocked, okS.error);
})();

/* ---------- Reset restores seed ---------- */
(function () {
  sandbox.localStorage.clear();
  WF.store.reset(U.zonedTimeToUtc(2026, 11, 11, 16, 20, 0));
  var a = WF.store.get();
  var n = a.appointments.length;
  a.appointments.push({ id: "tmp" });
  WF.store.save(true);
  WF.store.reset(U.zonedTimeToUtc(2026, 11, 11, 16, 20, 0));
  var b = WF.store.get();
  assert("reset restores appointment count", b.appointments.length === n && !b.appointments.some(function (x) { return x.id === "tmp"; }));
  assert("reset keeps fictional shop name", b.shop.name === "澄石养生馆");
})();

/* ---------- Dashboard is computed, not hardcoded ---------- */
(function () {
  var now = U.zonedTimeToUtc(2026, 11, 11, 16, 20, 0);
  var st = fresh(now);
  var d1 = R.dashboard(st, now);
  var before = d1.revenueFen;
  /* add a consumption today */
  st.consumptions.push({
    id: "con_x", shopId: st.shop.shopId, appointmentId: "x", customerId: "usr_lin",
    amountFen: 12800, method: "sim_pay", createdAt: now, items: ["svc_neck"], timesUsed: 0, cardId: ""
  });
  var d2 = R.dashboard(st, now);
  assert("dashboard revenue is dynamic", d2.revenueFen === before + 12800, d1.revenueFen + " -> " + d2.revenueFen);
})();

/* ---------- Room status board ---------- */
(function () {
  var now = U.zonedTimeToUtc(2026, 11, 11, 16, 20, 0);
  var st = fresh(now);
  var board = R.roomStatusAt(st, now);
  var kinds = {};
  board.forEach(function (x) { kinds[x.status] = true; });
  assert("room board returns all rooms", board.length === st.rooms.length);
  assert("seed around now includes a cleaning buffer room", !!kinds.buffer, "statuses=" + Object.keys(kinds).join(","));
})();

/* ---------- Room status: arrived / early start / overtime / off hours ---------- */
(function () {
  var now = U.zonedTimeToUtc(2026, 11, 11, 16, 20, 0);
  var st = fresh(now);
  /* Seed: 云水房 (room_yun) has apt_arrived starting later than now. Must be occupied already. */
  var arrived = U.byId(st.appointments, "apt_arrived");
  assert("seed arrived appointment exists", !!arrived && arrived.status === "arrived", "missing apt_arrived");
  if (arrived) {
    /* Force the known early-arrive case: start is still in the future. */
    arrived.startAt = U.addMin(now, 30);
    arrived.endAt = U.addMin(arrived.startAt, arrived.durationMin || 45);
    arrived.arrivedAt = U.addMin(now, -8);
    st.locks.forEach(function (l) {
      if (l.appointmentId === arrived.id && l.purpose === "service") {
        l.startAt = arrived.startAt;
        l.endAt = l.type === "room" ? U.addMin(arrived.endAt, 15) : arrived.endAt;
      }
    });
    var board = R.roomStatusAt(st, now);
    var yun = board.filter(function (x) { return x.room.id === arrived.roomId; })[0];
    assert("arrived room is occupied before scheduled start", yun && yun.status === "occupied", yun ? yun.status + " " + yun.label : "no room");
  }

  /* Early start of a confirmed appointment advances locks and occupies the room. */
  var st2 = fresh(now);
  var conf = U.byId(st2.appointments, "apt_conf");
  assert("seed confirmed appointment exists", !!conf && conf.status === "confirmed");
  if (conf) {
    conf.startAt = U.addMin(now, 90);
    conf.endAt = U.addMin(conf.startAt, conf.durationMin || 45);
    st2.locks.forEach(function (l) {
      if (l.appointmentId === conf.id && l.purpose === "service") {
        l.startAt = conf.startAt;
        l.endAt = l.type === "room" ? U.addMin(conf.endAt, 15) : conf.endAt;
      }
    });
    var a1 = R.transition(st2, conf.id, "arrive", {}, { role: "clerk" }, now);
    assert("can arrive early for confirmed appointment", a1.ok, a1.error);
    var s1 = R.transition(st2, conf.id, "start", {}, { role: "clerk" }, now);
    assert("can start early for arrived appointment", s1.ok, s1.error);
    var staffLock = st2.locks.filter(function (l) { return l.appointmentId === conf.id && l.type === "staff"; })[0];
    var roomLock = st2.locks.filter(function (l) { return l.appointmentId === conf.id && l.type === "room" && l.purpose === "service"; })[0];
    assert("early start advances staff lock start", staffLock && staffLock.startAt === now, staffLock ? String(staffLock.startAt) : "no lock");
    assert("early start advances room lock start", roomLock && roomLock.startAt === now, roomLock ? String(roomLock.startAt) : "no lock");
    var board2 = R.roomStatusAt(st2, now);
    var room2 = board2.filter(function (x) { return x.room.id === conf.roomId; })[0];
    assert("early-started room is not idle", room2 && room2.status === "occupied", room2 ? room2.status : "missing");
  }

  /* Overtime: in_service past scheduled end must not be idle. */
  var st3 = fresh(now);
  var lateId = "apt_overtime";
  st3.appointments.push({
    id: lateId, no: "WF-OT", shopId: st3.shop.shopId, customerId: "usr_lin",
    serviceIds: ["svc_head"], staffId: "stf_pei", roomId: "room_chen",
    startAt: U.addMin(now, -90), endAt: U.addMin(now, -30), durationMin: 60,
    priceFen: 9800, status: "in_service", startedAt: U.addMin(now, -90), arrivedAt: U.addMin(now, -90)
  });
  st3.locks.push({
    id: "lock_ot_stf", shopId: st3.shop.shopId, type: "staff", purpose: "service",
    resourceId: "stf_pei", appointmentId: lateId, startAt: U.addMin(now, -90), endAt: U.addMin(now, -30)
  });
  st3.locks.push({
    id: "lock_ot_room", shopId: st3.shop.shopId, type: "room", purpose: "service",
    resourceId: "room_chen", appointmentId: lateId, startAt: U.addMin(now, -90), endAt: U.addMin(now, -15)
  });
  var ot = R.roomStatusAt(st3, now).filter(function (x) { return x.room.id === "room_chen"; })[0];
  assert("overtime in-service room is not idle", ot && ot.status === "occupied", ot ? ot.status : "missing");

  /* Before open / after close, in_service room must not be idle. */
  var beforeOpen = U.zonedTimeToUtc(2026, 11, 11, 8, 30, 0);
  var afterClose = U.zonedTimeToUtc(2026, 11, 11, 22, 30, 0);
  var st4 = fresh(now);
  st4.appointments.push({
    id: "apt_offhours", no: "WF-OH", shopId: st4.shop.shopId, customerId: "usr_mo",
    serviceIds: ["svc_head"], staffId: "stf_qiu", roomId: "room_yun",
    startAt: U.zonedTimeToUtc(2026, 11, 11, 9, 0, 0),
    endAt: U.zonedTimeToUtc(2026, 11, 11, 10, 0, 0),
    durationMin: 60, priceFen: 9800, status: "in_service",
    startedAt: U.zonedTimeToUtc(2026, 11, 11, 8, 0, 0),
    arrivedAt: U.zonedTimeToUtc(2026, 11, 11, 8, 0, 0)
  });
  var pre = R.roomStatusAt(st4, beforeOpen).filter(function (x) { return x.room.id === "room_yun"; })[0];
  assert("in-service room is not idle before opening", pre && pre.status === "occupied", pre ? pre.status : "missing");
  /* Keep it in service past close */
  var still = U.byId(st4.appointments, "apt_offhours");
  still.endAt = U.zonedTimeToUtc(2026, 11, 11, 21, 30, 0);
  var post = R.roomStatusAt(st4, afterClose).filter(function (x) { return x.room.id === "room_yun"; })[0];
  assert("in-service room is not idle after closing", post && post.status === "occupied", post ? post.status : "missing");
})();

/* ---------- Transition conflicts: cannot start/finish later job while earlier is in service ---------- */
(function () {
  var now = U.zonedTimeToUtc(2026, 11, 11, 16, 20, 0);
  function clearLive(state) {
    (state.appointments || []).forEach(function (a) {
      if (a.status === "arrived" || a.status === "in_service") a.status = "confirmed";
    });
  }
  var st = fresh(now);
  clearLive(st);
  /* Same technician: earlier in_service, later confirmed. */
  var first = {
    id: "apt_first", no: "WF-F01", shopId: st.shop.shopId, customerId: "usr_xu",
    serviceIds: ["svc_neck"], staffId: "stf_pei", roomId: "room_chen",
    startAt: U.addMin(now, -20), endAt: U.addMin(now, 25), durationMin: 45,
    priceFen: 12800, status: "in_service", startedAt: U.addMin(now, -20), arrivedAt: U.addMin(now, -20)
  };
  var later = {
    id: "apt_later", no: "WF-L02", shopId: st.shop.shopId, customerId: "usr_lin",
    serviceIds: ["svc_head"], staffId: "stf_pei", roomId: "room_jing",
    startAt: U.addMin(now, 40), endAt: U.addMin(now, 70), durationMin: 30,
    priceFen: 9800, status: "confirmed"
  };
  st.appointments.push(first, later);
  st.locks.push(
    { id: "l_f_s", shopId: st.shop.shopId, type: "staff", purpose: "service", resourceId: "stf_pei", appointmentId: "apt_first", startAt: first.startAt, endAt: first.endAt },
    { id: "l_f_r", shopId: st.shop.shopId, type: "room", purpose: "service", resourceId: "room_chen", appointmentId: "apt_first", startAt: first.startAt, endAt: U.addMin(first.endAt, 15) },
    { id: "l_l_s", shopId: st.shop.shopId, type: "staff", purpose: "service", resourceId: "stf_pei", appointmentId: "apt_later", startAt: later.startAt, endAt: later.endAt },
    { id: "l_l_r", shopId: st.shop.shopId, type: "room", purpose: "service", resourceId: "room_jing", appointmentId: "apt_later", startAt: later.startAt, endAt: U.addMin(later.endAt, 15) }
  );
  var arr = R.transition(st, "apt_later", "arrive", {}, { role: "clerk" }, now);
  assert("cannot arrive later job while same staff still in service", !arr.ok && /技师/.test(arr.error), arr.error);
  later.status = "arrived";
  later.arrivedAt = now;
  var startLater = R.transition(st, "apt_later", "start", {}, { role: "clerk" }, now);
  assert("cannot start later job while same staff still in service", !startLater.ok && /技师/.test(startLater.error), startLater.error);

  /* Same room, different staff. */
  var stR = fresh(now);
  clearLive(stR);
  var aRoom = {
    id: "apt_room_a", no: "WF-RA", shopId: stR.shop.shopId, customerId: "usr_xu",
    serviceIds: ["svc_neck"], staffId: "stf_pei", roomId: "room_chen",
    startAt: U.addMin(now, -15), endAt: U.addMin(now, 30), durationMin: 45,
    priceFen: 12800, status: "in_service", startedAt: U.addMin(now, -15), arrivedAt: U.addMin(now, -15)
  };
  var bRoom = {
    id: "apt_room_b", no: "WF-RB", shopId: stR.shop.shopId, customerId: "usr_lin",
    serviceIds: ["svc_head"], staffId: "stf_qiu", roomId: "room_chen",
    startAt: U.addMin(now, 50), endAt: U.addMin(now, 80), durationMin: 30,
    priceFen: 9800, status: "confirmed"
  };
  stR.appointments.push(aRoom, bRoom);
  stR.locks.push(
    { id: "l_ra_s", shopId: stR.shop.shopId, type: "staff", purpose: "service", resourceId: "stf_pei", appointmentId: "apt_room_a", startAt: aRoom.startAt, endAt: aRoom.endAt },
    { id: "l_ra_r", shopId: stR.shop.shopId, type: "room", purpose: "service", resourceId: "room_chen", appointmentId: "apt_room_a", startAt: aRoom.startAt, endAt: U.addMin(aRoom.endAt, 15) },
    { id: "l_rb_s", shopId: stR.shop.shopId, type: "staff", purpose: "service", resourceId: "stf_qiu", appointmentId: "apt_room_b", startAt: bRoom.startAt, endAt: bRoom.endAt },
    { id: "l_rb_r", shopId: stR.shop.shopId, type: "room", purpose: "service", resourceId: "room_chen", appointmentId: "apt_room_b", startAt: bRoom.startAt, endAt: U.addMin(bRoom.endAt, 15) }
  );
  var arrR = R.transition(stR, "apt_room_b", "arrive", {}, { role: "clerk" }, now);
  assert("cannot arrive later job while same room still in service", !arrR.ok && /房间/.test(arrR.error), arrR.error);
  bRoom.status = "in_service";
  bRoom.startedAt = now;
  var finR = R.transition(stR, "apt_room_b", "finish", {}, { role: "clerk" }, now);
  assert("cannot finish later job while same room still in service", !finR.ok && /房间/.test(finR.error), finR.error);
})();

/* ---------- Disabled room cannot be booked; customer copy vs staff copy ---------- */
(function () {
  var now = U.zonedTimeToUtc(2026, 11, 11, 11, 0, 0);
  var st = fresh(now);
  var pei = U.byId(st.staff, "stf_pei");
  U.byId(st.rooms, pei.defaultRoomId).enabled = false;
  var slots = R.availableSlots(st, { serviceIds: ["svc_head"], staffId: "stf_pei", date: "2026-11-11", audience: "customer" }, now);
  assert("disabled default room yields no bookable slots", slots.length === 0, "slots=" + slots.length);
  var listed = R.listSlots(st, { serviceIds: ["svc_head"], staffId: "stf_pei", date: "2026-11-11", audience: "customer" }, now);
  assert("disabled room slots remain visible as blocked", listed.length > 0 && listed.every(function (s) { return !s.available && s.reasonCode === "room_disabled"; }), "listed=" + listed.length);
  assert("customer sees '技师或时段' for disabled room", listed[0] && /技师或时段/.test(listed[0].reason) && !/其他房间或技师/.test(listed[0].reason), listed[0] && listed[0].reason);
  var cust = R.createAppointment(st, { serviceIds: ["svc_head"], staffId: "stf_pei", startAt: U.atTime("2026-11-11", "16:00") }, { role: "customer" }, now);
  assert("customer booking disabled room rejected with customer copy", !cust.ok && /技师或时段/.test(cust.error) && !/其他房间或技师/.test(cust.error), cust.error);
  var st2 = fresh(now);
  U.byId(st2.rooms, pei.defaultRoomId).enabled = false;
  var staffBook = R.createAppointment(st2, {
    serviceIds: ["svc_head"], staffId: "stf_pei", startAt: U.atTime("2026-11-11", "16:00"), customerId: "usr_lin"
  }, { role: "clerk" }, now);
  assert("staff booking disabled room rejected with room-or-staff copy", !staffBook.ok && /房间或技师/.test(staffBook.error), staffBook.error);

  /* Conflict slots stay listed with reasons (staff busy). */
  var st3 = fresh(now);
  var open = R.availableSlots(st3, { serviceIds: ["svc_neck"], staffId: "stf_pei", date: "2026-11-11" }, now);
  var made = R.createAppointment(st3, { serviceIds: ["svc_neck"], staffId: "stf_pei", startAt: open[0].startAt }, { role: "customer" }, now);
  assert("setup booking for listed conflict slots", made.ok, made.error);
  var all = R.listSlots(st3, { serviceIds: ["svc_neck"], staffId: "stf_pei", date: "2026-11-11", audience: "customer" }, now);
  var blocked = all.filter(function (s) { return !s.available && s.startAt === open[0].startAt; });
  assert("conflict start time remains listed as blocked with staff reason", blocked.length === 1 && blocked[0].reasonCode === "staff_busy", blocked[0] ? blocked[0].reasonCode + " " + blocked[0].reason : "not listed");
})();

console.log("WellFlow P2 self-test");
console.log(logs.join("\n"));
console.log("\n" + passed + " passed, " + failed + " failed, " + (passed + failed) + " total");
process.exit(failed ? 1 : 0);
