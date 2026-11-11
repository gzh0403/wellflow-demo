/* WellFlow P2 demo — fictional seed data. Rebuilt around Asia/Shanghai "now". */
(function (root) {
  var WF = root.WF = root.WF || {};
  var U = null;

  function u() {
    U = U || WF.utils;
    return U;
  }

  WF.DATA_VERSION = 1;
  WF.STORAGE_KEY = "wellflow-p2-demo-v1";

  var STATUS = {
    PENDING: "pending",
    CONFIRMED: "confirmed",
    ARRIVED: "arrived",
    IN_SERVICE: "in_service",
    AWAIT_PAY: "await_pay",
    DONE: "done",
    TIMEOUT: "timeout",
    CANCELLED: "cancelled",
    NO_SHOW: "no_show",
    CANCEL_ARRIVED: "cancel_arrived",
    VOID_PAY: "void_pay"
  };

  var STATUS_LABEL = {
    pending: "待确认",
    confirmed: "已确认",
    arrived: "已到店",
    in_service: "服务中",
    await_pay: "待结算",
    done: "已完成",
    timeout: "超时未确认",
    cancelled: "已取消",
    no_show: "逾期未到",
    cancel_arrived: "到店后取消",
    void_pay: "结算作废"
  };

  var ACTIVE_LOCK_STATUSES = ["pending", "confirmed", "arrived", "in_service"];

  function weekly(staffId, start, end, brStart, brEnd) {
    var days = [];
    for (var w = 1; w <= 7; w++) {
      days.push({
        id: "sch_" + staffId + "_w" + w,
        shopId: "shop_wellflow_demo",
        staffId: staffId,
        type: "weekly",
        weekday: w === 7 ? 0 : w,
        start: start,
        end: end,
        breaks: brStart ? [{ start: brStart, end: brEnd }] : [],
        off: false
      });
    }
    return days;
  }

  function placeAroundNow(now) {
    var U = u();
    var today = U.dateStr(now);
    var open = U.atTime(today, "10:00");
    var close = U.atTime(today, "22:00");
    var tomorrow = U.dateStr(U.addDays(U.startOfDay(now), 1));
    var tOpen = U.atTime(tomorrow, "10:00");

    /* Prefer a working "anchor" inside business hours for placing live statuses.
       Actual clock (timeouts, countdowns) always uses real now. */
    var anchor = now;
    if (now < open) anchor = U.atTime(today, "14:30");
    if (now >= close) anchor = U.atTime(today, "18:30");

    function clampStart(ms, duration, latestEnd) {
      latestEnd = latestEnd || close;
      if (ms < open) ms = open;
      if (U.addMin(ms, duration) > latestEnd) {
        return null;
      }
      return ms;
    }

    var plan = {
      done: { start: U.addMin(anchor, -180), dur: 60 },
      await_pay: { start: U.addMin(anchor, -65), dur: 60 },
      in_service: { start: U.addMin(anchor, -20), dur: 60 },
      arrived: { start: U.addMin(anchor, 15), dur: 45 },
      confirmed: { start: U.addMin(anchor, 120), dur: 45 },
      pending: { start: U.addMin(anchor, 210), dur: 60 },
      confirmed2: { start: U.addMin(anchor, 300), dur: 50 }
    };

    /* If live items fall after close, slide them to tomorrow morning. */
    ["arrived", "confirmed", "pending", "confirmed2"].forEach(function (k) {
      var item = plan[k];
      var s = item.start;
      if (U.addMin(s, item.dur) > close || s >= close) {
        var offsetFromOpen = 30;
        if (k === "arrived") offsetFromOpen = 0;
        if (k === "confirmed") offsetFromOpen = 90;
        if (k === "pending") offsetFromOpen = 180;
        if (k === "confirmed2") offsetFromOpen = 260;
        item.start = U.addMin(tOpen, offsetFromOpen);
        item.dayShifted = true;
      } else if (s < open && now < open) {
        /* Before opening: keep afternoon story on today using the anchor. */
        item.start = clampStart(s, item.dur) || item.start;
      }
    });

    /* Past items: keep on today if they fit; otherwise yesterday. */
    ["done", "await_pay", "in_service"].forEach(function (k) {
      var item = plan[k];
      if (item.start < open && now >= open) {
        var yest = U.dateStr(U.addDays(U.startOfDay(now), -1));
        var yOpen = U.atTime(yest, "16:00");
        if (k === "done") item.start = yOpen;
        if (k === "await_pay") item.start = U.addMin(yOpen, 90);
        if (k === "in_service") item.start = U.addMin(anchor, -20);
      }
      if (k === "in_service" && U.addMin(item.start, item.dur) > close) {
        item.start = U.addMin(close, -70);
      }
    });

    /* Ensure await_pay finished recently so the room is still in the cleaning buffer. */
    plan.await_pay.finishedAt = U.addMin(now, -5);
    if (plan.await_pay.finishedAt <= plan.await_pay.start) {
      plan.await_pay.start = U.addMin(plan.await_pay.finishedAt, -60);
    }

    plan.in_service.willEnd = U.addMin(plan.in_service.start, plan.in_service.dur);
    return plan;
  }

  function buildSeed(now) {
    var U = u();
    now = now == null ? Date.now() : now;
    var plan = placeAroundNow(now);
    var shopId = "shop_wellflow_demo";

    var shop = {
      shopId: shopId,
      name: "澄石养生馆",
      brand: "WellFlow",
      slogan: "以温润之力，安放身体",
      address: "演示市云岚路 88 号（虚构地址，非真实门店）",
      phone: "010-0000-0000（演示号码）",
      hoursText: "每日 10:00–22:00",
      announcement: "演示公告：本店预约无需提前付款，到店完成服务后再结算。新客可了解次卡权益。所有数据均为虚构演示样品。",
      intro: "澄石养生馆是 WellFlow 原型中的虚构门店，不是真实经营场所。馆内以足疗、推拿与身心放松为主要服务，强调房间与技师的妥善安排，让每一位到店的客人不必在走廊等候或被临时改期。",
      confirmMode: "manual",
      confirmTimeoutMin: 15,
      bufferMin: 15,
      cancelAdvanceMin: 60,
      slotStepMin: 15,
      displayIntervalMin: 15,
      weeklyHours: {
        0: { open: "10:00", close: "22:00", off: false },
        1: { open: "10:00", close: "22:00", off: false },
        2: { open: "10:00", close: "22:00", off: false },
        3: { open: "10:00", close: "22:00", off: false },
        4: { open: "10:00", close: "22:00", off: false },
        5: { open: "10:00", close: "22:00", off: false },
        6: { open: "10:00", close: "22:00", off: false }
      },
      closedDates: [],
      visualNote: "视觉方向「温润矿石 × 当代养生馆」仅为讨论起点，色板在确认前不定稿。"
    };

    var services = [
      { id: "svc_foot", shopId: shopId, name: "足部舒缓护理", category: "足疗", durationMin: 60, priceFen: 16800, desc: "从足底到小腿的舒缓护理，帮助一天的走动慢慢落下来。适合晚间到店。", onSale: true, featured: true },
      { id: "svc_neck", shopId: shopId, name: "肩颈深层松解", category: "按摩", durationMin: 45, priceFen: 12800, desc: "针对长时间伏案的肩颈僵紧。时长 45 分钟，不是 30 分钟的整数倍，预约将按实际连续区间占用。", onSale: true, featured: true },
      { id: "svc_meridian", shopId: shopId, name: "经络推拿", category: "推拿", durationMin: 90, priceFen: 26800, desc: "全身经络梳理，节奏更完整，适合想把身体彻底放慢的客人。", onSale: true, featured: true },
      { id: "svc_moxa", shopId: shopId, name: "艾草温灸足浴", category: "足浴", durationMin: 50, priceFen: 14800, desc: "艾草足浴与小腿温养，时长 50 分钟。", onSale: true, featured: false },
      { id: "svc_head", shopId: shopId, name: "头部释压", category: "养生", durationMin: 30, priceFen: 9800, desc: "头皮与颈侧的轻缓释压，适合午后短暂停留。", onSale: true, featured: false },
      { id: "svc_oil", shopId: shopId, name: "精油全身舒缓", category: "养生", durationMin: 120, priceFen: 39800, desc: "以植物精油做全身放松护理，需预留完整两小时与清扫缓冲。", onSale: true, featured: true },
      { id: "svc_ear", shopId: shopId, name: "舒耳护理（已下架示例）", category: "采耳", durationMin: 30, priceFen: 8800, desc: "此项目用于演示下架状态，顾客端默认不展示。", onSale: false, featured: false }
    ];

    var rooms = [
      { id: "room_chen", shopId: shopId, name: "澄心房", floor: "2F", enabled: true, note: "主理足疗与肩颈" },
      { id: "room_nuan", shopId: shopId, name: "暖石房", floor: "2F", enabled: true, note: "适合经络与全身护理" },
      { id: "room_yun", shopId: shopId, name: "云水房", floor: "3F", enabled: true, note: "较安静，适合长时长项目" },
      { id: "room_jing", shopId: shopId, name: "静谷房", floor: "3F", enabled: true, note: "短项目与足浴" }
    ];

    var staff = [
      { id: "stf_pei", shopId: shopId, name: "裴暖", role: "technician", title: "资深技师", specialties: ["svc_foot", "svc_neck", "svc_moxa", "svc_head"], defaultRoomId: "room_chen", bio: "擅长足部与肩颈，手法沉稳。此人为虚构演示角色。", active: true },
      { id: "stf_jiang", shopId: shopId, name: "江朔", role: "technician", title: "推拿技师", specialties: ["svc_meridian", "svc_oil", "svc_neck", "svc_foot"], defaultRoomId: "room_nuan", bio: "专注经络推拿与全身舒缓。此人为虚构演示角色。", active: true },
      { id: "stf_qiu", shopId: shopId, name: "秋禾", role: "technician", title: "养生技师", specialties: ["svc_oil", "svc_head", "svc_moxa", "svc_neck"], defaultRoomId: "room_yun", bio: "擅长精油与头部释压，节奏偏慢。此人为虚构演示角色。", active: true },
      { id: "stf_cen", shopId: shopId, name: "岑白", role: "technician", title: "足浴技师", specialties: ["svc_foot", "svc_moxa", "svc_head"], defaultRoomId: "room_jing", bio: "主要负责足浴与短项目。此人为虚构演示角色。", active: true },
      { id: "stf_zhou", shopId: shopId, name: "周晚白", role: "clerk", title: "前台店员", specialties: [], defaultRoomId: "", bio: "前台接待与预约确认。此人为虚构演示角色。", active: true },
      { id: "stf_shen", shopId: shopId, name: "沈予安", role: "owner", title: "馆主", specialties: [], defaultRoomId: "", bio: "演示门店馆主。此人为虚构演示角色。", active: true }
    ];

    var schedules = []
      .concat(weekly("stf_pei", "10:00", "22:00", "14:00", "15:00"))
      .concat(weekly("stf_jiang", "10:00", "22:00", "15:00", "16:00"))
      .concat(weekly("stf_qiu", "12:00", "21:00"))
      .concat(weekly("stf_cen", "10:00", "18:00", "13:00", "13:30"));

    var users = [
      { id: "usr_lin", shopId: shopId, name: "林澄", phone: "13800001001", source: "朋友推荐", sourceLocked: true, firstConsumedAt: null, note: "演示主顾客，持有可核销次卡" },
      { id: "usr_xu", shopId: shopId, name: "许南", phone: "13800001002", source: "路过", sourceLocked: true, firstConsumedAt: null, note: "" },
      { id: "usr_mo", shopId: shopId, name: "莫轻舟", phone: "13800001003", source: "", sourceLocked: false, firstConsumedAt: null, note: "尚无推荐来源，可用于演示填写来源" },
      { id: "usr_chen", shopId: shopId, name: "陈予", phone: "13800001004", source: "微信", sourceLocked: true, firstConsumedAt: null, note: "" }
    ];

    var cards = [
      {
        id: "card_lin_foot",
        shopId: shopId,
        customerId: "usr_lin",
        name: "足部舒缓次卡",
        remaining: 3,
        total: 5,
        serviceIds: ["svc_foot"],
        issuedAt: U.addDays(now, -40),
        expiresAt: U.addDays(now, 140),
        status: "active",
        note: "按券化：限定足部舒缓护理，剩余 3 次，可供结算核销。"
      },
      {
        id: "card_lin_neck",
        shopId: shopId,
        customerId: "usr_lin",
        name: "肩颈松解次卡",
        remaining: 1,
        total: 3,
        serviceIds: ["svc_neck"],
        issuedAt: U.addDays(now, -20),
        expiresAt: U.addDays(now, 70),
        status: "active",
        note: "剩余 1 次，可演示扣次或余次不足。"
      },
      {
        id: "card_xu_exp",
        shopId: shopId,
        customerId: "usr_xu",
        name: "足部舒缓次卡（已用尽）",
        remaining: 0,
        total: 5,
        serviceIds: ["svc_foot"],
        issuedAt: U.addDays(now, -120),
        expiresAt: U.addDays(now, 10),
        status: "exhausted",
        note: "余次为 0，用于演示次卡不足。"
      }
    ];

    function appt(cfg) {
      var endAt = U.addMin(cfg.start, cfg.dur);
      var item = {
        id: cfg.id,
        no: cfg.no,
        shopId: shopId,
        customerId: cfg.customerId,
        serviceIds: cfg.serviceIds,
        staffId: cfg.staffId,
        roomId: cfg.roomId,
        startAt: cfg.start,
        endAt: endAt,
        durationMin: cfg.dur,
        priceFen: cfg.priceFen,
        status: cfg.status,
        confirmDeadlineAt: cfg.confirmDeadlineAt || null,
        createdAt: cfg.createdAt || U.addMin(cfg.start, -1440),
        source: cfg.source || "",
        cancelReason: "",
        voidReason: "",
        settledAt: cfg.settledAt || null,
        settleMethod: cfg.settleMethod || "",
        consumptionId: cfg.consumptionId || "",
        finishedAt: cfg.finishedAt || (cfg.status === "await_pay" || cfg.status === "done" || cfg.status === "void_pay" ? endAt : null),
        arrivedAt: cfg.arrivedAt || null,
        startedAt: cfg.startedAt || null
      };
      return item;
    }

    function priceOf(ids) {
      var sum = 0;
      for (var i = 0; i < ids.length; i++) {
        var s = null;
        for (var j = 0; j < services.length; j++) if (services[j].id === ids[i]) s = services[j];
        if (s) sum += s.priceFen;
      }
      return sum;
    }

    var appointments = [
      appt({
        id: "apt_done",
        no: "WF-D01",
        customerId: "usr_xu",
        serviceIds: ["svc_foot"],
        staffId: "stf_pei",
        roomId: "room_chen",
        start: plan.done.start,
        dur: plan.done.dur,
        priceFen: priceOf(["svc_foot"]),
        status: "done",
        settledAt: U.addMin(plan.done.start, plan.done.dur + 5),
        settleMethod: "sim_pay",
        consumptionId: "con_done",
        finishedAt: U.addMin(plan.done.start, plan.done.dur),
        arrivedAt: plan.done.start,
        startedAt: plan.done.start,
        createdAt: U.addMin(plan.done.start, -800)
      }),
      appt({
        id: "apt_await",
        no: "WF-A02",
        customerId: "usr_chen",
        serviceIds: ["svc_meridian"],
        staffId: "stf_jiang",
        roomId: "room_nuan",
        start: plan.await_pay.start,
        dur: plan.await_pay.dur,
        priceFen: priceOf(["svc_meridian"]),
        status: "await_pay",
        finishedAt: plan.await_pay.finishedAt,
        arrivedAt: plan.await_pay.start,
        startedAt: plan.await_pay.start,
        createdAt: U.addMin(plan.await_pay.start, -900)
      }),
      appt({
        id: "apt_ing",
        no: "WF-S03",
        customerId: "usr_xu",
        serviceIds: ["svc_foot"],
        staffId: "stf_cen",
        roomId: "room_jing",
        start: plan.in_service.start,
        dur: plan.in_service.dur,
        priceFen: priceOf(["svc_foot"]),
        status: "in_service",
        arrivedAt: plan.in_service.start,
        startedAt: plan.in_service.start,
        createdAt: U.addMin(plan.in_service.start, -600)
      }),
      appt({
        id: "apt_arrived",
        no: "WF-R04",
        customerId: "usr_mo",
        serviceIds: ["svc_neck"],
        staffId: "stf_qiu",
        roomId: "room_yun",
        start: plan.arrived.start,
        dur: plan.arrived.dur,
        priceFen: priceOf(["svc_neck"]),
        status: "arrived",
        arrivedAt: U.addMin(now, -8),
        createdAt: U.addMin(plan.arrived.start, -1200)
      }),
      appt({
        id: "apt_conf",
        no: "WF-C05",
        customerId: "usr_lin",
        serviceIds: ["svc_neck"],
        staffId: "stf_pei",
        roomId: "room_chen",
        start: plan.confirmed.start,
        dur: plan.confirmed.dur,
        priceFen: priceOf(["svc_neck"]),
        status: "confirmed",
        createdAt: U.addMin(now, -90)
      }),
      appt({
        id: "apt_pend",
        no: "WF-P06",
        customerId: "usr_lin",
        serviceIds: ["svc_foot"],
        staffId: "stf_cen",
        roomId: "room_jing",
        start: plan.pending.start,
        dur: plan.pending.dur,
        priceFen: priceOf(["svc_foot"]),
        status: "pending",
        confirmDeadlineAt: U.addMin(now, 12),
        createdAt: U.addMin(now, -3)
      }),
      appt({
        id: "apt_conf2",
        no: "WF-C07",
        customerId: "usr_chen",
        serviceIds: ["svc_moxa"],
        staffId: "stf_qiu",
        roomId: "room_yun",
        start: plan.confirmed2.start,
        dur: plan.confirmed2.dur,
        priceFen: priceOf(["svc_moxa"]),
        status: "confirmed",
        createdAt: U.addMin(now, -200)
      })
    ];

    /* If a technician would be outside their shift, nudge the appointment into a working window
       rather than shipping a broken demo. */
    function staffWorks(staffId, start, end) {
      var p = U.partsOf(start);
      var wd = p.weekday;
      var list = schedules.filter(function (s) { return s.staffId === staffId && s.type === "weekly" && s.weekday === wd; });
      if (!list.length || list[0].off) return false;
      var sch = list[0];
      var day = U.dateStr(start);
      var s0 = U.atTime(day, sch.start);
      var s1 = U.atTime(day, sch.end);
      if (start < s0 || end > s1) return false;
      for (var i = 0; i < (sch.breaks || []).length; i++) {
        var b0 = U.atTime(day, sch.breaks[i].start);
        var b1 = U.atTime(day, sch.breaks[i].end);
        if (U.overlaps(start, end, b0, b1)) return false;
      }
      return true;
    }

    /* 秋禾 starts at 12:00 — if arrived/confirmed2 falls before shift, move to her default room later or switch technician. */
    appointments.forEach(function (a) {
      if (staffWorks(a.staffId, a.startAt, a.endAt)) return;
      var fallbacks = ["stf_pei", "stf_jiang", "stf_qiu", "stf_cen"];
      for (var i = 0; i < fallbacks.length; i++) {
        var sid = fallbacks[i];
        if (sid === a.staffId) continue;
        var tech = null;
        for (var k = 0; k < staff.length; k++) if (staff[k].id === sid) tech = staff[k];
        var canAll = a.serviceIds.every(function (sv) {
          return tech && tech.specialties.indexOf(sv) !== -1;
        });
        if (!canAll) continue;
        if (staffWorks(sid, a.startAt, a.endAt)) {
          a.staffId = sid;
          a.roomId = tech.defaultRoomId;
          return;
        }
      }
    });

    /* Resolve accidental staff/room collisions in the seed by shifting the later one +15m up to a few tries. */
    function collide(a, b, kind) {
      if (a.id === b.id) return false;
      var aEnd = a.endAt;
      var bEnd = b.endAt;
      if (kind === "room") {
        var buf = shop.bufferMin;
        var aLockEnd = (a.status === "await_pay" || a.status === "done") ? U.addMin(a.finishedAt || a.endAt, buf) : U.addMin(a.endAt, buf);
        var bLockEnd = (b.status === "await_pay" || b.status === "done") ? U.addMin(b.finishedAt || b.endAt, buf) : U.addMin(b.endAt, buf);
        if (a.status === "done") aLockEnd = U.addMin(a.finishedAt || a.endAt, buf);
        return a.roomId === b.roomId && U.overlaps(a.startAt, aLockEnd, b.startAt, bLockEnd);
      }
      var aOcc = ACTIVE_LOCK_STATUSES.indexOf(a.status) !== -1;
      var bOcc = ACTIVE_LOCK_STATUSES.indexOf(b.status) !== -1;
      if (!aOcc || !bOcc) return false;
      return a.staffId === b.staffId && U.overlaps(a.startAt, aEnd, b.startAt, bEnd);
    }
    for (var pass = 0; pass < 8; pass++) {
      var moved = false;
      for (var i = 0; i < appointments.length; i++) {
        for (var j = i + 1; j < appointments.length; j++) {
          var a = appointments[i], b = appointments[j];
          if (collide(a, b, "staff") || collide(a, b, "room")) {
            b.startAt = U.addMin(b.startAt, 30);
            b.endAt = U.addMin(b.startAt, b.durationMin);
            moved = true;
          }
        }
      }
      if (!moved) break;
    }

    var locks = [];
    appointments.forEach(function (a) {
      if (ACTIVE_LOCK_STATUSES.indexOf(a.status) !== -1) {
        locks.push({
          id: "lock_stf_" + a.id,
          shopId: shopId,
          type: "staff",
          purpose: "service",
          resourceId: a.staffId,
          appointmentId: a.id,
          startAt: a.startAt,
          endAt: a.endAt
        });
        locks.push({
          id: "lock_room_" + a.id,
          shopId: shopId,
          type: "room",
          purpose: "service",
          resourceId: a.roomId,
          appointmentId: a.id,
          startAt: a.startAt,
          endAt: U.addMin(a.endAt, shop.bufferMin)
        });
      }
      if (a.status === "await_pay") {
        var fin = a.finishedAt || a.endAt;
        locks.push({
          id: "lock_buf_" + a.id,
          shopId: shopId,
          type: "room",
          purpose: "buffer",
          resourceId: a.roomId,
          appointmentId: a.id,
          startAt: fin,
          endAt: U.addMin(fin, shop.bufferMin)
        });
      }
    });

    /* Historical consumption for the completed appointment; unlock first-consume conversion. */
    var consumptions = [
      {
        id: "con_done",
        shopId: shopId,
        appointmentId: "apt_done",
        customerId: "usr_xu",
        amountFen: priceOf(["svc_foot"]),
        method: "sim_pay",
        cardId: "",
        timesUsed: 0,
        createdAt: U.addMin(plan.done.start, plan.done.dur + 5),
        items: ["svc_foot"]
      }
    ];
    users.forEach(function (c) {
      if (c.id === "usr_xu") c.firstConsumedAt = consumptions[0].createdAt;
    });

    var cardLedger = [];
    var blocks = [];
    var staffAccounts = [
      { id: "acct_shen", staffId: "stf_shen", role: "owner", name: "沈予安", active: true },
      { id: "acct_zhou", staffId: "stf_zhou", role: "clerk", name: "周晚白", active: true }
    ];

    var seq = 8;

    return {
      version: WF.DATA_VERSION,
      seededAt: now,
      shop: shop,
      services: services,
      rooms: rooms,
      staff: staff,
      schedules: schedules,
      blocks: blocks,
      users: users,
      cards: cards,
      appointments: appointments,
      locks: locks,
      consumptions: consumptions,
      cardLedger: cardLedger,
      staffAccounts: staffAccounts,
      seq: seq,
      currentRole: "customer",
      currentUserId: "usr_lin",
      currentStaffId: "stf_zhou",
      currentOwnerId: "stf_shen"
    };
  }

  WF.STATUS = STATUS;
  WF.STATUS_LABEL = STATUS_LABEL;
  WF.ACTIVE_LOCK_STATUSES = ACTIVE_LOCK_STATUSES;
  WF.buildSeed = buildSeed;
})(typeof window !== "undefined" ? window : global);
