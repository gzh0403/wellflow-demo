/* WellFlow P2 demo — time, money, and small helpers. Classic script, no modules. */
(function (root) {
  var WF = root.WF = root.WF || {};
  var TZ = "Asia/Shanghai";

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function partsOf(ms) {
    var dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
      hourCycle: "h23"
    });
    var map = {};
    var chunks = dtf.formatToParts(new Date(ms));
    for (var i = 0; i < chunks.length; i++) {
      map[chunks[i].type] = chunks[i].value;
    }
    var weekMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return {
      year: +map.year,
      month: +map.month,
      day: +map.day,
      hour: +map.hour,
      minute: +map.minute,
      second: +map.second,
      weekday: weekMap[map.weekday]
    };
  }

  /* Convert a Shanghai wall time to epoch ms, without depending on host TZ. */
  function zonedTimeToUtc(year, month, day, hour, minute, second) {
    hour = hour || 0;
    minute = minute || 0;
    second = second || 0;
    var guess = Date.UTC(year, month - 1, day, hour, minute, second);
    var p = partsOf(guess);
    var asIf = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    var wanted = Date.UTC(year, month - 1, day, hour, minute, second);
    return guess + (wanted - asIf);
  }

  function startOfDay(ms) {
    var p = partsOf(ms);
    return zonedTimeToUtc(p.year, p.month, p.day, 0, 0, 0);
  }

  function addDays(ms, days) {
    var p = partsOf(ms);
    return zonedTimeToUtc(p.year, p.month, p.day + days, p.hour, p.minute, p.second);
  }

  function atTime(msOrDate, hhmm) {
    var p = typeof msOrDate === "string" ? null : partsOf(msOrDate);
    var bits = hhmm.split(":");
    if (typeof msOrDate === "string") {
      var d = msOrDate.split("-");
      return zonedTimeToUtc(+d[0], +d[1], +d[2], +bits[0], +bits[1], 0);
    }
    return zonedTimeToUtc(p.year, p.month, p.day, +bits[0], +bits[1], 0);
  }

  function dateStr(ms) {
    var p = partsOf(ms);
    return p.year + "-" + pad(p.month) + "-" + pad(p.day);
  }

  function timeStr(ms) {
    var p = partsOf(ms);
    return pad(p.hour) + ":" + pad(p.minute);
  }

  function dateTimeStr(ms) {
    return dateStr(ms) + " " + timeStr(ms);
  }

  function weekdayName(ms) {
    var names = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    return names[partsOf(ms).weekday];
  }

  function friendlyDate(ms, now) {
    now = now == null ? Date.now() : now;
    var d = dateStr(ms);
    var t = dateStr(now);
    var tom = dateStr(addDays(startOfDay(now), 1));
    var yest = dateStr(addDays(startOfDay(now), -1));
    if (d === t) return "今天";
    if (d === tom) return "明天";
    if (d === yest) return "昨天";
    return d + " " + weekdayName(ms);
  }

  function addMin(ms, minutes) {
    return ms + minutes * 60 * 1000;
  }

  function minutesBetween(a, b) {
    return Math.round((b - a) / 60000);
  }

  function parseHm(hhmm) {
    var bits = hhmm.split(":");
    return (+bits[0]) * 60 + (+bits[1]);
  }

  function overlaps(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && bStart < aEnd;
  }

  function uid(prefix) {
    prefix = prefix || "id";
    return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatYuan(fen) {
    var n = (Number(fen) || 0) / 100;
    var sign = n < 0 ? "-" : "";
    n = Math.abs(n);
    var s = n.toFixed(2);
    return sign + "¥" + s;
  }

  function yuanLabel(fen) {
    var n = (Number(fen) || 0) / 100;
    if (Math.round(n * 100) % 100 === 0) return "¥" + Math.round(n);
    return formatYuan(fen);
  }

  function plural(n, one, many) {
    return n + (n === 1 ? one : many);
  }

  function countdown(deadline, now) {
    now = now == null ? Date.now() : now;
    var left = deadline - now;
    if (left <= 0) return { expired: true, text: "已超时", ms: 0, m: 0, s: 0 };
    var totalSec = Math.floor(left / 1000);
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    return { expired: false, text: m + "分" + pad(s) + "秒", ms: left, m: m, s: s };
  }

  function byId(list, id) {
    if (!list) return null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function where(list, fn) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
      if (fn(list[i], i)) out.push(list[i]);
    }
    return out;
  }

  WF.TZ_NAME = TZ;
  WF.utils = {
    pad: pad,
    partsOf: partsOf,
    zonedTimeToUtc: zonedTimeToUtc,
    startOfDay: startOfDay,
    addDays: addDays,
    atTime: atTime,
    dateStr: dateStr,
    timeStr: timeStr,
    dateTimeStr: dateTimeStr,
    weekdayName: weekdayName,
    friendlyDate: friendlyDate,
    addMin: addMin,
    minutesBetween: minutesBetween,
    parseHm: parseHm,
    overlaps: overlaps,
    uid: uid,
    clone: clone,
    escapeHtml: escapeHtml,
    formatYuan: formatYuan,
    yuanLabel: yuanLabel,
    countdown: countdown,
    byId: byId,
    where: where
  };
})(typeof window !== "undefined" ? window : global);
