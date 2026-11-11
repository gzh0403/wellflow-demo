/* WellFlow P2 demo — localStorage persistence and reset. Classic script. */
(function (root) {
  var WF = root.WF = root.WF || {};
  var memory = null;
  var listeners = [];

  function storage() {
    try {
      if (typeof localStorage !== "undefined") return localStorage;
    } catch (e) {}
    return null;
  }

  function load() {
    var s = storage();
    if (s) {
      try {
        var raw = s.getItem(WF.STORAGE_KEY);
        if (raw) {
          var data = JSON.parse(raw);
          if (data && data.version === WF.DATA_VERSION) {
            memory = data;
            WF.rules.applyTimeouts(memory, Date.now());
            return memory;
          }
        }
      } catch (e) {
        memory = null;
      }
    }
    memory = WF.buildSeed(Date.now());
    persist();
    return memory;
  }

  function persist() {
    var s = storage();
    if (s && memory) {
      try { s.setItem(WF.STORAGE_KEY, JSON.stringify(memory)); } catch (e) {}
    }
  }

  function get() {
    if (!memory) load();
    return memory;
  }

  function save(silent) {
    persist();
    if (!silent) notify();
  }

  function reset(now) {
    memory = WF.buildSeed(now == null ? Date.now() : now);
    persist();
    notify();
    return memory;
  }

  function mutate(fn, actor, now) {
    var state = get();
    WF.rules.applyTimeouts(state, now == null ? Date.now() : now);
    var result = fn(state);
    if (result && result.ok !== false) persist();
    else persist();
    notify();
    return result;
  }

  function subscribe(fn) {
    listeners.push(fn);
    return function () {
      listeners = listeners.filter(function (x) { return x !== fn; });
    };
  }

  function notify() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](memory); } catch (e) {}
    }
  }

  function setRole(role) {
    var state = get();
    if (role !== "customer" && role !== "clerk" && role !== "owner") return;
    state.currentRole = role === "clerk" ? "clerk" : role;
    if (role === "owner") state.currentRole = "owner";
    persist();
    notify();
  }

  function setUser(userId) {
    var state = get();
    var found = false;
    for (var i = 0; i < (state.users || []).length; i++) {
      if (state.users[i].id === userId) found = true;
    }
    if (!found) return;
    state.currentUserId = userId;
    persist();
    notify();
  }

  WF.store = {
    load: load,
    get: get,
    save: save,
    reset: reset,
    mutate: mutate,
    subscribe: subscribe,
    setRole: setRole,
    setUser: setUser
  };
})(typeof window !== "undefined" ? window : global);
