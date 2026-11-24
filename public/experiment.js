// node_modules/@flagsmith/flagsmith/index.mjs
var t = { getItemSync: function(t3) {
  try {
    return localStorage.getItem(t3) || null;
  } catch (t4) {
    return null;
  }
}, getItem: function(t3, e2) {
  var n2 = this;
  return new Promise(function(i2, a2) {
    try {
      var r2 = n2.getItemSync(t3);
      null == e2 || e2(null, r2), i2(r2);
    } catch (t4) {
      e2 && e2(t4, null), a2(t4);
    }
  });
}, setItem: function(t3, e2, n2) {
  return new Promise(function(i2, a2) {
    try {
      localStorage.setItem(t3, e2), n2 && n2(null, e2), i2(e2);
    } catch (t4) {
      n2 && n2(t4, null), a2(t4);
    }
  });
} };
var e = function() {
  return e = Object.assign || function(t3) {
    for (var e2, n2 = 1, i2 = arguments.length; n2 < i2; n2++) for (var a2 in e2 = arguments[n2]) Object.prototype.hasOwnProperty.call(e2, a2) && (t3[a2] = e2[a2]);
    return t3;
  }, e.apply(this, arguments);
};
function n(t3, e2, n2, i2) {
  return new (n2 || (n2 = Promise))(function(a2, r2) {
    function o2(t4) {
      try {
        l2(i2.next(t4));
      } catch (t5) {
        r2(t5);
      }
    }
    function s2(t4) {
      try {
        l2(i2.throw(t4));
      } catch (t5) {
        r2(t5);
      }
    }
    function l2(t4) {
      var e3;
      t4.done ? a2(t4.value) : (e3 = t4.value, e3 instanceof n2 ? e3 : new n2(function(t5) {
        t5(e3);
      })).then(o2, s2);
    }
    l2((i2 = i2.apply(t3, e2 || [])).next());
  });
}
function i(t3, e2) {
  var n2, i2, a2, r2, o2 = { label: 0, sent: function() {
    if (1 & a2[0]) throw a2[1];
    return a2[1];
  }, trys: [], ops: [] };
  return r2 = { next: s2(0), throw: s2(1), return: s2(2) }, "function" == typeof Symbol && (r2[Symbol.iterator] = function() {
    return this;
  }), r2;
  function s2(r3) {
    return function(s3) {
      return (function(r4) {
        if (n2) throw new TypeError("Generator is already executing.");
        for (; o2; ) try {
          if (n2 = 1, i2 && (a2 = 2 & r4[0] ? i2.return : r4[0] ? i2.throw || ((a2 = i2.return) && a2.call(i2), 0) : i2.next) && !(a2 = a2.call(i2, r4[1])).done) return a2;
          switch (i2 = 0, a2 && (r4 = [2 & r4[0], a2.value]), r4[0]) {
            case 0:
            case 1:
              a2 = r4;
              break;
            case 4:
              return o2.label++, { value: r4[1], done: false };
            case 5:
              o2.label++, i2 = r4[1], r4 = [0];
              continue;
            case 7:
              r4 = o2.ops.pop(), o2.trys.pop();
              continue;
            default:
              if (!(a2 = o2.trys, (a2 = a2.length > 0 && a2[a2.length - 1]) || 6 !== r4[0] && 2 !== r4[0])) {
                o2 = 0;
                continue;
              }
              if (3 === r4[0] && (!a2 || r4[1] > a2[0] && r4[1] < a2[3])) {
                o2.label = r4[1];
                break;
              }
              if (6 === r4[0] && o2.label < a2[1]) {
                o2.label = a2[1], a2 = r4;
                break;
              }
              if (a2 && o2.label < a2[2]) {
                o2.label = a2[2], o2.ops.push(r4);
                break;
              }
              a2[2] && o2.ops.pop(), o2.trys.pop();
              continue;
          }
          r4 = e2.call(t3, o2);
        } catch (t4) {
          r4 = [6, t4], i2 = 0;
        } finally {
          n2 = a2 = 0;
        }
        if (5 & r4[0]) throw r4[1];
        return { value: r4[0] ? r4[1] : void 0, done: true };
      })([r3, s3]);
    };
  }
}
var a = function t2(e2, n2) {
  if (e2 === n2) return true;
  if (e2 && n2 && "object" == typeof e2 && "object" == typeof n2) {
    if (e2.constructor !== n2.constructor) return false;
    var i2, a2, r2;
    if (Array.isArray(e2)) {
      if ((i2 = e2.length) != n2.length) return false;
      for (a2 = i2; 0 !== a2--; ) if (!t2(e2[a2], n2[a2])) return false;
      return true;
    }
    if (e2.constructor === RegExp) return e2.source === n2.source && e2.flags === n2.flags;
    if (e2.valueOf !== Object.prototype.valueOf) return e2.valueOf() === n2.valueOf();
    if (e2.toString !== Object.prototype.toString) return e2.toString() === n2.toString();
    if ((i2 = (r2 = Object.keys(e2)).length) !== Object.keys(n2).length) return false;
    for (a2 = i2; 0 !== a2--; ) if (!Object.prototype.hasOwnProperty.call(n2, r2[a2])) return false;
    for (a2 = i2; 0 !== a2--; ) {
      var o2 = r2[a2];
      if (!t2(e2[o2], n2[o2])) return false;
    }
    return true;
  }
  return e2 != e2 && n2 != n2;
};
function r(t3, e2) {
  var n2 = Object.keys(e2 || {}).filter(function(n3) {
    var i2 = null == t3 ? void 0 : t3[n3], r2 = null == e2 ? void 0 : e2[n3];
    return !a(i2, r2);
  });
  return Object.keys(t3 || {}).filter(function(t4) {
    Object.keys(e2 || {}).includes(t4) || n2.push(t4);
  }), Object.keys(n2).length ? n2 : null;
}
function o(t3, e2, n2) {
  var i2 = "shortString", a2 = true;
  "number" == typeof n2 && (i2 = "javaDouble", a2 = false), t3[i2] = t3[i2] || {}, t3[i2][e2] = a2 ? n2 + "" : n2;
}
function s(t3) {
  return !!t3 && "object" == typeof t3 && void 0 !== t3.value;
}
function l(t3) {
  return Object.fromEntries(Object.entries(t3).map(function(t4) {
    var e2 = t4[0], n2 = t4[1];
    return [e2, s(n2) ? n2 : { value: n2 }];
  }));
}
function u(t3) {
  return e(e({}, t3), { identity: t3.identity ? e(e({}, t3.identity), { traits: l(t3.identity.traits || {}) }) : void 0 });
}
function c(t3) {
  if (!t3) return null;
  var e2 = Object.entries(t3).filter(function(t4) {
    var e3 = t4[1];
    return null != e3;
  });
  return e2.length ? Object.fromEntries(e2.map(function(t4) {
    var e3 = t4[0], n2 = t4[1];
    return [e3, s(n2) ? n2.value : n2];
  })) : null;
}
function h(t3) {
  return t3.endsWith("/") ? t3 : t3 + "/";
}
var d;
var v;
var f = "12.5.0";
var g = "$flag_exposure";
var p = [408, 429, 502, 503, 504];
var y = (function() {
  function t3(t4) {
    var a2, r2, o2, s2, l2 = this;
    this.buffer = [], this.dedupeKeys = /* @__PURE__ */ new Map(), this.timer = null, this.sending = null, this.held = false, this.disabled = false, this.closed = false, this.abortRequest = null, this.flush = function() {
      return n(l2, void 0, void 0, function() {
        var t5, e2 = this;
        return i(this, function(n2) {
          switch (n2.label) {
            case 0:
              this.held = false, n2.label = 1;
            case 1:
              return this.sending ? [4, this.sending] : [3, 3];
            case 2:
              return n2.sent() ? [2] : [3, 1];
            case 3:
              return !this.buffer.length || this.disabled ? [2] : (t5 = this.buffer, this.buffer = [], this.dedupeKeys.clear(), this.sending = this.send(t5).then(function(t6) {
                return e2.sending = null, t6 || e2.flushIfFull(), t6;
              }), [4, this.sending]);
            case 4:
              return n2.sent(), [2];
          }
        });
      });
    }, this.close = function(t5) {
      return n(l2, void 0, void 0, function() {
        var e2, n2;
        return i(this, function(i2) {
          switch (i2.label) {
            case 0:
              return this.stopTimer(), [4, Promise.race([this.drain(), new Promise(function(n3) {
                e2 = setTimeout(n3, t5);
              })])];
            case 1:
              return i2.sent(), e2 && clearTimeout(e2), this.closed = true, null === (n2 = this.abortRequest) || void 0 === n2 || n2.call(this), this.buffer.length && (this.log("Events: closed with ".concat(this.buffer.length, " events unsent, dropping them")), this.buffer = []), [2];
          }
        });
      });
    }, this.drain = function() {
      return n(l2, void 0, void 0, function() {
        return i(this, function(t5) {
          switch (t5.label) {
            case 0:
              return [4, this.flush()];
            case 1:
              t5.sent(), t5.label = 2;
            case 2:
              return !this.buffer.length || this.disabled || this.closed ? [3, 4] : [4, this.flush()];
            case 3:
              return t5.sent(), [3, 2];
            case 4:
              return [2];
          }
        });
      });
    }, this.send = function(t5) {
      return n(l2, void 0, void 0, function() {
        var e2, n2, a3, r3 = this;
        return i(this, function(i2) {
          switch (i2.label) {
            case 0:
              try {
                e2 = JSON.stringify({ events: t5 });
              } catch (e3) {
                return this.log("Events: dropped ".concat(t5.length, " events, which cannot be serialised to JSON"), e3), [2, false];
              }
              a3 = 1, i2.label = 1;
            case 1:
              return [4, this.attempt(e2)];
            case 2:
              return n2 = i2.sent(), !("transient" === n2 || "server_error" === n2) || a3 >= 3 || this.closed ? [3, 5] : [4, this.sleep(Math.random() * this.retryBackoffMs * Math.pow(2, a3 - 1))];
            case 3:
              if (i2.sent(), this.closed) return [3, 5];
              i2.label = 4;
            case 4:
              return a3++, [3, 1];
            case 5:
              switch (n2) {
                case "delivered":
                  return this.log("Events: flush successful"), [2, false];
                case "unauthorised":
                  return this.disable(t5.length), [2, false];
                case "transient":
                  if (!this.closed && !this.disabled) return t5.filter(function(t6) {
                    return t6.event === g;
                  }).forEach(function(t6) {
                    return r3.rememberExposure(t6);
                  }), this.buffer = t5.concat(this.buffer), this.dropOverflow(), this.held = null !== this.timer, this.log("Events: flush failed, kept ".concat(t5.length, " events for the next flush")), [2, true];
              }
              return this.log("Events: flush failed, dropped ".concat(t5.length, " events")), [2, false];
          }
        });
      });
    }, this.attempt = function(t5) {
      return n(l2, void 0, void 0, function() {
        var n2, a3, r3, o3, s3, l3, u3 = this;
        return i(this, function(i2) {
          switch (i2.label) {
            case 0:
              n2 = "undefined" != typeof AbortController ? new AbortController() : null, r3 = new Promise(function(t6, e2) {
                var i3 = function(t7) {
                  null == n2 || n2.abort(), e2(new Error("Events: ".concat(t7)));
                };
                u3.abortRequest = function() {
                  return i3("request abandoned on close");
                }, a3 = setTimeout(function() {
                  return i3("no response within ".concat(u3.requestTimeoutMs, "ms"));
                }, u3.requestTimeoutMs);
              }), i2.label = 1;
            case 1:
              return i2.trys.push([1, 3, 4, 5]), [4, Promise.race([this.fetch(this.endpoint, e({ method: "POST", body: t5, headers: e({ "Content-Type": "application/json; charset=utf-8", "X-Environment-Key": this.environmentKey }, { "Flagsmith-SDK-User-Agent": "flagsmith-js-sdk/".concat(f) }) }, n2 ? { signal: n2.signal } : {})), r3])];
            case 2:
              return o3 = i2.sent(), (s3 = o3.status || 0) >= 200 && s3 < 300 ? [2, "delivered"] : (this.log("Events: unexpected status ".concat(s3)), 401 === s3 || 403 === s3 ? [2, "unauthorised"] : p.includes(s3) ? [2, "transient"] : [2, s3 >= 500 ? "server_error" : "rejected"]);
            case 3:
              return l3 = i2.sent(), this.log("Events: request failed", l3), [2, "transient"];
            case 4:
              return a3 && clearTimeout(a3), this.abortRequest = null, [7];
            case 5:
              return [2];
          }
        });
      });
    };
    var u2 = h(t4.eventsApiUrl || "https://events.api.flagsmith.com/");
    this.endpoint = "".concat(u2, "v1/events"), this.environmentKey = t4.environmentKey, this.fetch = t4.fetch, this.log = t4.log || function() {
    }, this.maxBuffer = Math.max(1, null !== (a2 = t4.maxBuffer) && void 0 !== a2 ? a2 : 1e3), this.flushInterval = null !== (r2 = t4.flushInterval) && void 0 !== r2 ? r2 : 1e4, this.retryBackoffMs = null !== (o2 = t4.retryBackoffMs) && void 0 !== o2 ? o2 : 1e3, this.requestTimeoutMs = null !== (s2 = t4.requestTimeoutMs) && void 0 !== s2 ? s2 : 3e3;
  }
  return t3.prototype.trackEvent = function(t4) {
    this.bufferEvent(t4.event, null, t4.identifier, t4.value, t4.traits, t4.metadata, false);
  }, t3.prototype.trackExposureEvent = function(t4) {
    this.bufferEvent(g, t4.featureName, t4.identifier, t4.value, t4.traits, t4.metadata, true);
  }, t3.prototype.bufferEvent = function(t4, n2, i2, a2, r2, o2, s2) {
    if (!this.disabled && !this.closed) {
      var l2 = { event: t4, feature_name: n2, identifier: i2, value: null != a2 ? String(a2) : null, traits: r2, metadata: e(e({}, o2 || {}), { sdk_version: f }), timestamp: Date.now() };
      try {
        JSON.stringify(l2);
      } catch (e2) {
        return void this.log('Events: dropped event "'.concat(t4, '", which cannot be serialised to JSON'), e2);
      }
      if (s2) {
        if (this.dedupeKeys.has(this.dedupeKey(l2))) return;
        this.rememberExposure(l2);
      }
      this.buffer.push(l2), this.dropOverflow(), this.flushIfFull();
    }
  }, t3.prototype.dedupeKey = function(t4) {
    var e2, n2;
    return JSON.stringify([t4.event, t4.feature_name, t4.identifier, t4.value, null !== (n2 = null === (e2 = t4.metadata) || void 0 === e2 ? void 0 : e2.experiment_id) && void 0 !== n2 ? n2 : null]);
  }, t3.prototype.rememberExposure = function(t4) {
    var e2, n2 = this.dedupeKey(t4);
    this.dedupeKeys.set(n2, (null !== (e2 = this.dedupeKeys.get(n2)) && void 0 !== e2 ? e2 : 0) + 1);
  }, t3.prototype.forgetExposure = function(t4) {
    var e2, n2 = this.dedupeKey(t4), i2 = (null !== (e2 = this.dedupeKeys.get(n2)) && void 0 !== e2 ? e2 : 0) - 1;
    i2 > 0 ? this.dedupeKeys.set(n2, i2) : this.dedupeKeys.delete(n2);
  }, t3.prototype.flushIfFull = function() {
    this.buffer.length >= this.maxBuffer && !this.held && !this.sending && this.flush();
  }, t3.prototype.start = function() {
    var t4, e2;
    this.stop(), this.flushInterval > 0 && (this.timer = setInterval(this.flush, this.flushInterval), null === (e2 = null === (t4 = this.timer) || void 0 === t4 ? void 0 : t4.unref) || void 0 === e2 || e2.call(t4));
  }, t3.prototype.stop = function() {
    this.stopTimer(), this.flush();
  }, t3.prototype.stopTimer = function() {
    this.timer && (clearInterval(this.timer), this.timer = null);
  }, t3.prototype.dropOverflow = function() {
    var t4 = this.buffer.length - this.maxBuffer;
    if (t4 > 0) {
      for (var e2 = 0, n2 = this.buffer.splice(0, t4); e2 < n2.length; e2++) {
        var i2 = n2[e2];
        i2.event === g && this.forgetExposure(i2);
      }
      this.log("Events: buffer full, dropped the ".concat(t4, " oldest events"));
    }
  }, t3.prototype.disable = function(t4) {
    this.log("Events: environment key refused, dropping ".concat(t4 + this.buffer.length, " events and stopping event tracking")), this.disabled = true, this.buffer = [], this.dedupeKeys.clear(), this.stopTimer();
  }, t3.prototype.sleep = function(t4) {
    return new Promise(function(e2) {
      var n2, i2 = setTimeout(e2, t4);
      null === (n2 = null == i2 ? void 0 : i2.unref) || void 0 === n2 || n2.call(i2);
    });
  }, t3;
})();
!(function(t3) {
  t3.NONE = "NONE", t3.DEFAULT_FLAGS = "DEFAULT_FLAGS", t3.CACHE = "CACHE", t3.SERVER = "SERVER";
})(d || (d = {}));
var m;
var S = null;
var b = "FLAGSMITH_EVENT";
var E = b;
var C = "https://edge.api.flagsmith.com/api/v1/";
var x = "flagsmith_value_";
var _ = "flagsmith_enabled_";
var w = "flagsmith_trait_";
var O = (function() {
  function t3(t4) {
    var a2 = this;
    this._trigger = null, this._triggerLoadingState = null, this.timestamp = null, this.isLoading = false, this.eventSource = null, this.getFlags = function() {
      var t5 = a2, n2 = t5.api, i2 = t5.evaluationContext;
      a2.log("Get Flags"), a2.isLoading = true, a2.loadingState.isFetching || a2.setLoadingState(e(e({}, a2.loadingState), { isFetching: true }));
      var s2 = "".concat(a2.getContext().identity), l2 = function(t6) {
        var n3, i3, l3, u2;
        if (t6 && s2 === "".concat(a2.getContext().identity)) {
          var c2 = t6.flags, h2 = t6.traits, v2 = t6.identifier;
          a2.isLoading = false;
          var f2 = {}, g2 = {};
          h2 = h2 || [], (c2 = c2 || []).forEach(function(t7) {
            var n4, i4 = null === (n4 = t7.metadata) || void 0 === n4 ? void 0 : n4.experiment;
            f2[t7.feature.name.toLowerCase().replace(/ /g, "_")] = e(e(e({ id: t7.feature.id, enabled: t7.enabled, value: t7.feature_state_value }, t7.variant ? { variant: t7.variant } : {}), t7.reason ? { reason: t7.reason } : {}), i4 ? { experiment: { id: i4.id, name: i4.name, inExperiment: !!i4.in_experiment } } : {});
          }), h2.forEach(function(t7) {
            g2[t7.trait_key.replace(/ /g, "_")] = { transient: t7.transient, value: t7.trait_value };
          }), a2.oldFlags = e({}, a2.flags);
          var p2 = r(a2.oldFlags, f2), y2 = r(null === (n3 = a2.evaluationContext.identity) || void 0 === n3 ? void 0 : n3.traits, g2);
          if ((v2 || Object.keys(g2).length) && (a2.evaluationContext.identity = e(e({}, a2.evaluationContext.identity), { traits: g2 }), v2 && (a2.evaluationContext.identity.identifier = v2, a2.identity = v2)), a2.flags = f2, a2.updateStorage(), a2._onChange(a2.oldFlags, { isFromServer: true, flagsChanged: p2, traitsChanged: y2 }, a2._loadedState(null, d.SERVER)), a2.datadogRum) try {
            if (a2.datadogRum.trackTraits) {
              var m2 = {};
              Object.keys((null === (i3 = a2.evaluationContext.identity) || void 0 === i3 ? void 0 : i3.traits) || {}).map(function(t7) {
                m2[w + t7] = a2.getTrait(t7);
              });
              var S2 = e(e(e({}, a2.datadogRum.client.getUser()), { id: a2.datadogRum.client.getUser().id || (null === (l3 = a2.evaluationContext.identity) || void 0 === l3 ? void 0 : l3.identifier) }), m2);
              a2.log("Setting Datadog user", S2), a2.datadogRum.client.setUser(S2);
            }
          } catch (t7) {
            console.error(t7);
          }
          if (a2.dtrum) try {
            var b2 = { javaDouble: {}, date: {}, shortString: {}, javaLongOrObject: {} };
            Object.keys(a2.flags).map(function(t7) {
              o(b2, x + t7, a2.getValue(t7, { skipAnalytics: true })), o(b2, _ + t7, a2.hasFeature(t7, { skipAnalytics: true }));
            }), Object.keys((null === (u2 = a2.evaluationContext.identity) || void 0 === u2 ? void 0 : u2.traits) || {}).map(function(t7) {
              o(b2, w + t7, a2.getTrait(t7));
            }), a2.log("Sending javaLongOrObject traits to dynatrace", b2.javaLongOrObject), a2.log("Sending date traits to dynatrace", b2.date), a2.log("Sending shortString traits to dynatrace", b2.shortString), a2.log("Sending javaDouble to dynatrace", b2.javaDouble), a2.dtrum.sendSessionProperties(b2.javaLongOrObject, b2.date, b2.shortString, b2.javaDouble);
          } catch (t7) {
            console.error(t7);
          }
        }
      };
      return i2.identity ? Promise.all([i2.identity.traits && Object.keys(i2.identity.traits).length || !i2.identity.identifier ? a2.getJSON(n2 + "identities/", "POST", JSON.stringify({ identifier: i2.identity.identifier, transient: i2.identity.transient, traits: Object.entries(i2.identity.traits).map(function(t6) {
        var e2 = t6[0], n3 = t6[1];
        return { trait_key: e2, trait_value: null == n3 ? void 0 : n3.value, transient: null == n3 ? void 0 : n3.transient };
      }).filter(function(t6) {
        return void 0 !== t6.trait_value || (a2.log("Warning - attempted to set an undefined trait value for key", t6.trait_key), false);
      }) })) : a2.getJSON(n2 + "identities/?identifier=" + encodeURIComponent(i2.identity.identifier) + (i2.identity.transient ? "&transient=true" : ""))]).then(function(t6) {
        return a2.evaluationContext.identity = e(e({}, a2.evaluationContext.identity), { traits: {} }), l2(null == t6 ? void 0 : t6[0]);
      }).catch(function(t6) {
        var e2 = t6.message, n3 = new Error(e2);
        return Promise.reject(n3);
      }) : a2.getJSON(n2 + "flags/").then(function(t6) {
        return l2({ flags: t6, traits: void 0 });
      });
    }, this.analyticsFlags = function() {
      var t5 = a2.api;
      if (a2.evaluationEvent && a2.evaluationContext.environment && a2.evaluationEvent[a2.evaluationContext.environment.apiKey]) return a2.evaluationEvent && 0 !== Object.getOwnPropertyNames(a2.evaluationEvent).length && 0 !== Object.getOwnPropertyNames(a2.evaluationEvent[a2.evaluationContext.environment.apiKey]).length ? a2.getJSON(t5 + "analytics/flags/", "POST", JSON.stringify(a2.evaluationEvent[a2.evaluationContext.environment.apiKey])).then(function(t6) {
        if (a2.evaluationContext.environment) {
          var n2 = a2.getState();
          a2.evaluationEvent || (a2.evaluationEvent = {}), a2.evaluationEvent[a2.evaluationContext.environment.apiKey] = {}, a2.setState(e(e({}, n2), { evaluationEvent: a2.evaluationEvent })), a2.updateEventStorage();
        }
      }).catch(function(t6) {
        a2.log("Exception fetching evaluationEvent", t6);
      }) : void 0;
    }, this.datadogRum = null, this.loadingState = { isLoading: true, isFetching: true, error: null, source: d.NONE }, this.canUseStorage = false, this.analyticsInterval = null, this.api = null, this.cacheFlags = false, this.enableAnalytics = false, this.enableLogs = false, this.evaluationContext = {}, this.evaluationEvent = null, this.flags = null, this.getFlagInterval = null, this.headers = null, this.identity = null, this.initialised = false, this.oldFlags = null, this.onChange = null, this.onError = null, this.ticks = null, this.timer = null, this.dtrum = null, this.sentryClient = null, this.withTraits = null, this.cacheOptions = { ttl: 0, skipAPI: false, loadStale: false, storageKey: void 0 }, this.eventProcessor = null, this.closed = false, this.eventsEnabled = false, this.getValue = function(t5, e2, n2) {
      var i2 = a2.flags && a2.flags[t5.toLowerCase().replace(/ /g, "_")], r2 = null;
      if (i2 && (r2 = i2.value), (null == e2 ? void 0 : e2.skipAnalytics) || n2 || a2.evaluateFlag(t5, "VALUE"), null === r2 && void 0 !== (null == e2 ? void 0 : e2.fallback)) return e2.fallback;
      if (null == e2 ? void 0 : e2.json) try {
        return null === r2 ? (a2.log("Tried to parse null flag as JSON: " + t5), null) : JSON.parse(r2);
      } catch (t6) {
        return e2.fallback;
      }
      return r2;
    }, this.getTrait = function(t5) {
      var e2, n2, i2, r2 = null === (e2 = a2.evaluationContext.identity) || void 0 === e2 ? void 0 : e2.traits;
      if (r2) {
        var o2 = t5.replace(/ /g, "_");
        if (o2 in r2) return null === (n2 = r2[o2]) || void 0 === n2 ? void 0 : n2.value;
        var s2 = o2.toLowerCase(), l2 = Object.keys(r2).find(function(t6) {
          return t6.toLowerCase() === s2;
        });
        return void 0 === l2 || null === (i2 = r2[l2]) || void 0 === i2 ? void 0 : i2.value;
      }
    }, this.getAllTraits = function() {
      var t5;
      return Object.fromEntries(Object.entries((null === (t5 = a2.evaluationContext.identity) || void 0 === t5 ? void 0 : t5.traits) || {}).map(function(t6) {
        var e2 = t6[0], n2 = t6[1];
        return [e2, null == n2 ? void 0 : n2.value];
      }));
    }, this.setContext = function(t5) {
      var n2, i2, r2 = u(t5);
      return a2.evaluationContext = e(e({}, r2), { environment: r2.environment || a2.evaluationContext.environment }), a2.identity = null === (i2 = null === (n2 = a2.getContext()) || void 0 === n2 ? void 0 : n2.identity) || void 0 === i2 ? void 0 : i2.identifier, a2.initialised ? a2.getFlags() : Promise.resolve();
    }, this.getContext = function() {
      return a2.evaluationContext;
    }, this.updateContext = function(t5) {
      return a2.setContext(e(e({}, a2.getContext()), t5));
    }, this.setTrait = function(t5, n2) {
      var i2;
      if (a2.api) return a2.setContext(e(e({}, a2.evaluationContext), { identity: e(e({}, a2.evaluationContext.identity), { traits: e(e({}, null === (i2 = a2.evaluationContext.identity) || void 0 === i2 ? void 0 : i2.traits), l(Object.fromEntries([[t5, n2]]))) }) }));
    }, this.setTraits = function(t5) {
      var n2;
      if (a2.api) return a2.setContext(e(e({}, a2.evaluationContext), { identity: e(e({}, a2.evaluationContext.identity), { traits: e(e({}, null === (n2 = a2.evaluationContext.identity) || void 0 === n2 ? void 0 : n2.traits), Object.fromEntries(Object.entries(t5).map(function(t6) {
        var e2 = t6[0], n3 = t6[1];
        return [e2, s(n3) ? n3 : { value: n3 }];
      }))) }) }));
      console.error("Attempted to setTraits a user before calling flagsmith.init. Call flagsmith.init first, if you wish to prevent it sending a request for flags, call init with preventFetch:true.");
    }, this.hasFeature = function(t5, e2) {
      var n2, i2, r2 = "object" == typeof e2, o2 = a2.flags && a2.flags[t5.toLowerCase().replace(/ /g, "_")], s2 = false;
      if (!o2 && r2 && void 0 !== e2.fallback ? s2 = null == e2 ? void 0 : e2.fallback : o2 && o2.enabled && (s2 = true), (r2 && !e2.skipAnalytics || !e2) && a2.evaluateFlag(t5, "ENABLED"), a2.sentryClient) try {
        null === (i2 = null === (n2 = a2.sentryClient.getIntegrationByName("FeatureFlags")) || void 0 === n2 ? void 0 : n2.addFeatureFlag) || void 0 === i2 || i2.call(n2, t5, s2);
      } catch (t6) {
        console.error(t6);
      }
      return s2;
    }, this.getStorageKey = function() {
      var t5, e2;
      return (null === (t5 = a2.cacheOptions) || void 0 === t5 ? void 0 : t5.storageKey) || "FLAGSMITH_DB_" + (null === (e2 = a2.evaluationContext.environment) || void 0 === e2 ? void 0 : e2.apiKey);
    }, this.getJSON = function(t5, e2, n2) {
      var i2, r2, o2, s2 = a2.headers, l2 = { method: e2 || "GET", body: n2, cache: "no-cache", headers: {} };
      a2.evaluationContext.environment && (l2.headers["X-Environment-Key"] = a2.evaluationContext.environment.apiKey), e2 && "GET" !== e2 && (l2.headers["Content-Type"] = "application/json; charset=utf-8"), (null === (i2 = a2.applicationMetadata) || void 0 === i2 ? void 0 : i2.name) && (l2.headers["Flagsmith-Application-Name"] = a2.applicationMetadata.name), (null === (r2 = a2.applicationMetadata) || void 0 === r2 ? void 0 : r2.version) && (l2.headers["Flagsmith-Application-Version"] = a2.applicationMetadata.version), l2.headers["Flagsmith-SDK-User-Agent"] = "flagsmith-js-sdk/".concat(f), s2 && Object.assign(l2.headers, s2), v || console.error("Flagsmith: fetch is undefined, please specify a fetch implementation into flagsmith.init to support SSR.");
      var u2 = "".concat(null === (o2 = a2.evaluationContext.identity) || void 0 === o2 ? void 0 : o2.identifier);
      return v(t5, l2).then(function(n3) {
        var i3, r3, o3 = "".concat(null === (i3 = a2.evaluationContext.identity) || void 0 === i3 ? void 0 : i3.identifier);
        if (u2 === o3) {
          var s3 = null === (r3 = n3.headers) || void 0 === r3 ? void 0 : r3.get("x-flagsmith-document-updated-at");
          if (s3) try {
            var l3 = parseFloat(s3);
            if (isNaN(l3)) return Promise.reject("Failed to parse x-flagsmith-document-updated-at");
            a2.timestamp = l3;
          } catch (t6) {
            a2.log(t6, "Failed to parse x-flagsmith-document-updated-at", s3);
          }
          return a2.log("Fetch response: " + n3.status + " " + (e2 || "GET") + 0 + t5), n3.text().then(function(t6) {
            var e3 = t6;
            try {
              e3 = JSON.parse(t6);
            } catch (t7) {
            }
            return !e3 && n3.status && (e3 = "API Response: ".concat(n3.status)), n3.status && n3.status >= 200 && n3.status < 300 ? e3 : Promise.reject(new Error(e3));
          });
        }
        a2.log("Received response with identity mismatch, ignoring response. Requested: ".concat(u2, ", Current: ").concat(o3));
      });
    }, this.evaluateFlag = function(t5, e2) {
      if (a2.datadogRum && (a2.datadogRum.client.addFeatureFlagEvaluation ? "VALUE" === e2 ? a2.datadogRum.client.addFeatureFlagEvaluation(x + t5, a2.getValue(t5, {}, true)) : a2.datadogRum.client.addFeatureFlagEvaluation(_ + t5, a2.hasFeature(t5, true)) : console.error("Flagsmith: Your datadog RUM client does not support the function addFeatureFlagEvaluation, please update it.")), a2.enableAnalytics) {
        if (!a2.evaluationEvent || !a2.evaluationContext.environment) return;
        a2.evaluationEvent[a2.evaluationContext.environment.apiKey] || (a2.evaluationEvent[a2.evaluationContext.environment.apiKey] = {}), void 0 === a2.evaluationEvent[a2.evaluationContext.environment.apiKey][t5] && (a2.evaluationEvent[a2.evaluationContext.environment.apiKey][t5] = 0), a2.evaluationEvent[a2.evaluationContext.environment.apiKey][t5] += 1;
      }
      a2.updateEventStorage();
    }, this.trackEvent = function(t5, e2) {
      var n2, i2, r2, o2, s2, l2, u2;
      if (a2.eventProcessor) {
        if (t5.startsWith("$")) throw new Error('Flagsmith: event names starting with "$" are reserved; use trackExposureEvent to record "'.concat(g, '".'));
        a2.eventProcessor.trackEvent({ event: t5, identifier: null !== (r2 = null !== (n2 = null == e2 ? void 0 : e2.identifier) && void 0 !== n2 ? n2 : null === (i2 = a2.evaluationContext.identity) || void 0 === i2 ? void 0 : i2.identifier) && void 0 !== r2 ? r2 : null, value: null !== (o2 = null == e2 ? void 0 : e2.value) && void 0 !== o2 ? o2 : null, traits: c(null !== (s2 = null == e2 ? void 0 : e2.traits) && void 0 !== s2 ? s2 : null === (l2 = a2.evaluationContext.identity) || void 0 === l2 ? void 0 : l2.traits), metadata: null !== (u2 = null == e2 ? void 0 : e2.metadata) && void 0 !== u2 ? u2 : null });
      }
    }, this.trackExposureEvent = function(t5, e2) {
      var n2, i2, r2, o2, s2, l2, u2;
      if (a2.eventProcessor) {
        var h2 = null !== (r2 = null !== (n2 = null == e2 ? void 0 : e2.identifier) && void 0 !== n2 ? n2 : null === (i2 = a2.evaluationContext.identity) || void 0 === i2 ? void 0 : i2.identifier) && void 0 !== r2 ? r2 : null;
        h2 ? a2.eventProcessor.trackExposureEvent({ featureName: t5, identifier: h2, value: null !== (o2 = null == e2 ? void 0 : e2.value) && void 0 !== o2 ? o2 : null, traits: c(null !== (s2 = null == e2 ? void 0 : e2.traits) && void 0 !== s2 ? s2 : null === (l2 = a2.evaluationContext.identity) || void 0 === l2 ? void 0 : l2.traits), metadata: null !== (u2 = null == e2 ? void 0 : e2.metadata) && void 0 !== u2 ? u2 : null }) : a2.log('Flagsmith: trackExposureEvent called for "'.concat(t5, '" without an identity; call identify() (optionally with transient: true) or pass opts.identifier. No exposure recorded.'));
      }
    }, this.flushEvents = function() {
      return a2.eventProcessor ? a2.eventProcessor.flush() : Promise.resolve();
    }, this.close = function(t5) {
      return n(a2, void 0, void 0, function() {
        var e2, n2;
        return i(this, function(i2) {
          switch (i2.label) {
            case 0:
              return this.closed = true, this.stopListening(), this.analyticsInterval && (clearInterval(this.analyticsInterval), this.analyticsInterval = null), null === (n2 = this.eventSource) || void 0 === n2 || n2.close(), this.eventSource = null, e2 = this.eventProcessor, this.eventProcessor = null, [4, null == e2 ? void 0 : e2.close(t5)];
            case 1:
              return i2.sent(), [2];
          }
        });
      });
    }, this.getExperimentFlag = function(t5) {
      var e2, n2, i2 = t5.toLowerCase().replace(/ /g, "_"), r2 = a2.flags && a2.flags[i2] || null;
      return a2.eventProcessor ? (null === (e2 = a2.evaluationContext.identity) || void 0 === e2 ? void 0 : e2.identifier) ? r2 ? r2.enabled ? (null === (n2 = r2.experiment) || void 0 === n2 ? void 0 : n2.inExperiment) ? (a2.loadingState.source !== d.SERVER || a2.trackExposureEvent(t5, { value: r2.variant, metadata: { experiment_id: r2.experiment.id } }), r2) : (a2.log('Flagsmith: getExperimentFlag called for "'.concat(t5, '" but this identity is not enrolled in a running experiment for it. No exposure recorded.')), r2) : (a2.log('Flagsmith: getExperimentFlag called for "'.concat(t5, '" which is disabled. No exposure recorded.')), r2) : (a2.log('Flagsmith: getExperimentFlag called for "'.concat(t5, '" which does not exist. No exposure recorded.')), null) : (a2.log("Flagsmith: getExperimentFlag called without an identity; call identify() (optionally with transient: true) before using experiments to record an exposure. Returning environment flags; no exposure recorded."), r2) : r2;
    }, this._onChange = function(t5, e2, n2) {
      var i2, r2;
      a2.setLoadingState(n2), null === (i2 = a2.onChange) || void 0 === i2 || i2.call(a2, t5, e2, a2.loadingState), null === (r2 = a2._trigger) || void 0 === r2 || r2.call(a2);
    }, v = t4.fetch ? t4.fetch : "undefined" != typeof fetch ? fetch : null === global || void 0 === global ? void 0 : global.fetch, this.canUseStorage = "undefined" != typeof window || !!t4.browserlessStorage, this.applicationMetadata = t4.applicationMetadata, this.log("Constructing flagsmith instance " + t4), t4.eventSource && (m = t4.eventSource), t4.AsyncStorage && (S = t4.AsyncStorage);
  }
  return t3.prototype.init = function(t4) {
    var a2, o2, s2, l2, c2;
    return n(this, void 0, void 0, function() {
      var f2, g2, p2, m2, x2, _2, w2, O2, F2, I2, j2, k2, A2, L2, P2, T2, N2, K2, R, D, M, U, J, G, q, V, B, H, W, $2, X, Y, z, Q, Z, tt, et, nt = this;
      return i(this, function(it) {
        switch (it.label) {
          case 0:
            if (t4.eventProcessorConfig && !t4.enableEvents) throw new Error("Flagsmith: eventProcessorConfig requires enableEvents: true.");
            f2 = u(t4.evaluationContext || this.evaluationContext), it.label = 1;
          case 1:
            if (it.trys.push([1, 13, , 14]), g2 = t4.AsyncStorage, p2 = t4._trigger, m2 = t4._triggerLoadingState, x2 = t4.angularHttpClient, _2 = t4.api, w2 = void 0 === _2 ? C : _2, O2 = t4.applicationMetadata, F2 = t4.cacheFlags, I2 = t4.cacheOptions, j2 = t4.datadogRum, k2 = t4.defaultFlags, A2 = t4.enableAnalytics, L2 = t4.enableDynatrace, P2 = t4.enableLogs, T2 = t4.environmentID, N2 = t4.enableEvents, K2 = t4.eventProcessorConfig, R = t4.eventSourceUrl, D = void 0 === R ? "https://realtime.flagsmith.com/" : R, M = t4.fetch, U = t4.headers, J = t4.identity, G = t4.onChange, q = t4.onError, V = t4.preventFetch, B = t4.realtime, H = t4.sentryClient, W = t4.state, $2 = t4.traits, f2.environment = T2 ? { apiKey: T2 } : f2.environment, !f2.environment || !f2.environment.apiKey) throw new Error("Please provide `evaluationContext.environment` with non-empty `apiKey`");
            if (f2.identity = J || $2 ? { identifier: J, traits: $2 ? Object.fromEntries(Object.entries($2).map(function(t5) {
              return [t5[0], { value: t5[1] }];
            })) : {} } : f2.identity, this.evaluationContext = f2, this.api = h(w2), this.headers = U, this.analyticsInterval && clearInterval(this.analyticsInterval), this.analyticsInterval = null, this.closed = false, this.onChange = G, X = "Wrong Flagsmith Configuration: preventFetch is true and no defaulFlags provided", this._trigger = p2 || this._trigger, this._triggerLoadingState = m2 || this._triggerLoadingState, this.onError = function(t5) {
              nt.setLoadingState(e(e({}, nt.loadingState), { isFetching: false, isLoading: false, error: t5 })), null == q || q(t5);
            }, this.enableLogs = P2 || false, this.cacheOptions = I2 ? { skipAPI: !!I2.skipAPI, ttl: I2.ttl || 0, storageKey: I2.storageKey, loadStale: !!I2.loadStale } : this.cacheOptions, !this.cacheOptions.ttl && this.cacheOptions.skipAPI && console.warn("Flagsmith: you have set a cache ttl of 0 and are skipping API calls, this means the API will not be hit unless you clear local storage."), M && (v = M), this.enableAnalytics = A2 || false, this.flags = Object.assign({}, k2) || {}, this.datadogRum = j2 || null, this.initialised = true, this.ticks = 1e4, this.timer = this.enableLogs ? (/* @__PURE__ */ new Date()).valueOf() : null, this.cacheFlags = void 0 !== S && !!F2, this.applicationMetadata = O2, E = b + "_" + f2.environment.apiKey, g2 && (S = g2), B && "undefined" != typeof window && this.setupRealtime(D, f2.environment.apiKey), Object.keys(this.flags).length && (this.loadingState = e(e({}, this.loadingState), { isLoading: false, source: d.DEFAULT_FLAGS })), this.setState(W), this.log("Initialising with properties", t4, this), L2 && ("undefined" == typeof dtrum ? console.error("You have attempted to enable dynatrace but dtrum is undefined, please check you have the Dynatrace RUM JavaScript API installed.") : this.dtrum = dtrum), H && (this.sentryClient = H), x2 && (v = /* @__PURE__ */ (function(t5) {
              return function(e2, n2) {
                var i2 = n2.headers, a3 = n2.method, r2 = n2.body, o3 = { headers: i2, observe: "response", responseType: "text" }, s3 = function(t6, e3) {
                  var n3 = t6.status, i3 = t6.headers, a4 = t6.body, r3 = t6.error, o4 = t6.message;
                  return { status: null != n3 ? n3 : e3 ? 200 : 500, ok: e3, headers: { get: function(t7) {
                    var e4, n4;
                    return null !== (n4 = null === (e4 = null == i3 ? void 0 : i3.get) || void 0 === e4 ? void 0 : e4.call(i3, t7)) && void 0 !== n4 ? n4 : null;
                  } }, text: function() {
                    var t7, e4, n4 = null !== (e4 = null !== (t7 = null != a4 ? a4 : r3) && void 0 !== t7 ? t7 : o4) && void 0 !== e4 ? e4 : "";
                    return Promise.resolve("string" != typeof n4 ? JSON.stringify(n4) : n4);
                  } };
                };
                return new Promise(function(n3) {
                  var i3 = function(t6) {
                    return n3(s3(t6, !t6.status || t6.status >= 200 && t6.status < 300));
                  }, l3 = function(t6) {
                    return n3(s3(t6, false));
                  };
                  switch (a3) {
                    case "GET":
                      return t5.get(e2, o3).subscribe(i3, l3);
                    case "POST":
                    case "PUT":
                      return t5.post(e2, null != r2 ? r2 : "", o3).subscribe(i3, l3);
                    default:
                      return l3({ status: 405, message: "Unsupported method: ".concat(a3) });
                  }
                });
              };
            })(x2)), S && this.canUseStorage && S.getItem(E).then(function(t5) {
              try {
                nt.evaluationEvent = JSON.parse(t5) || {};
              } catch (t6) {
                nt.evaluationEvent = {};
              }
              nt.closed || (nt.analyticsInterval && clearInterval(nt.analyticsInterval), nt.analyticsInterval = setInterval(nt.analyticsFlags, nt.ticks));
            }), this.enableAnalytics && (this.analyticsInterval && clearInterval(this.analyticsInterval), S && this.canUseStorage && S.getItem(E, function(t5, n2) {
              if (n2 && nt.evaluationContext.environment) {
                var i2 = JSON.parse(n2);
                if (i2[nt.evaluationContext.environment.apiKey]) {
                  var a3 = nt.getState();
                  nt.log("Retrieved events from cache", n2), nt.setState(e(e({}, a3), { evaluationEvent: i2[nt.evaluationContext.environment.apiKey] }));
                }
              }
            })), null === (a2 = this.eventProcessor) || void 0 === a2 || a2.stop(), this.eventProcessor = null, N2 && (this.eventProcessor = new y(e(e({}, K2 || {}), { environmentKey: this.evaluationContext.environment.apiKey, fetch: v, log: function() {
              for (var t5 = [], e2 = 0; e2 < arguments.length; e2++) t5[e2] = arguments[e2];
              return nt.log.apply(nt, t5);
            } })), this.eventProcessor.start()), this.eventsEnabled = !!N2, !F2) return [3, 9];
            if (!S || !this.canUseStorage) return [3, 8];
            Y = function(t5, a3) {
              return n(nt, void 0, void 0, function() {
                var t6, n2, o3, s3, l3, c3, h2, v2, f3, g3, p3, y2, m3, S2, b2, E2, C2, x3, _3, w3 = this;
                return i(this, function(i2) {
                  switch (i2.label) {
                    case 0:
                      if (!a3) return [3, 7];
                      t6 = null, n2 = null, i2.label = 1;
                    case 1:
                      return i2.trys.push([1, 5, , 6]), o3 = JSON.parse(a3), s3 = false, l3 = false, o3 && o3.api === this.api && (null === (g3 = null === (f3 = o3.evaluationContext) || void 0 === f3 ? void 0 : f3.environment) || void 0 === g3 ? void 0 : g3.apiKey) === (null === (p3 = this.evaluationContext.environment) || void 0 === p3 ? void 0 : p3.apiKey) && (c3 = true, this.evaluationContext.identity && (null === (m3 = null === (y2 = o3.evaluationContext) || void 0 === y2 ? void 0 : y2.identity) || void 0 === m3 ? void 0 : m3.identifier) !== this.evaluationContext.identity.identifier && (this.log("Ignoring cache, identity has changed from " + (null === (b2 = null === (S2 = o3.evaluationContext) || void 0 === S2 ? void 0 : S2.identity) || void 0 === b2 ? void 0 : b2.identifier) + " to " + this.evaluationContext.identity.identifier), c3 = false), this.cacheOptions.ttl && (!o3.ts || (/* @__PURE__ */ new Date()).valueOf() - o3.ts > this.cacheOptions.ttl) && (o3.ts && !this.cacheOptions.loadStale ? (this.log("Ignoring cache, timestamp is too old ts:" + o3.ts + " ttl: " + this.cacheOptions.ttl + " time elapsed since cache: " + ((/* @__PURE__ */ new Date()).valueOf() - o3.ts) + "ms"), c3 = false) : o3.ts && this.cacheOptions.loadStale && (this.log("Loading stale cache, timestamp ts:" + o3.ts + " ttl: " + this.cacheOptions.ttl + " time elapsed since cache: " + ((/* @__PURE__ */ new Date()).valueOf() - o3.ts) + "ms"), l3 = true, c3 = true)), c3 && (s3 = true, t6 = r(this.flags, o3.flags), this.setState(e(e({}, o3), { evaluationContext: u(e(e({}, o3.evaluationContext), { identity: (null === (E2 = o3.evaluationContext) || void 0 === E2 ? void 0 : E2.identity) ? e(e({}, null === (C2 = o3.evaluationContext) || void 0 === C2 ? void 0 : C2.identity), { traits: e({}, $2 || {}) }) : void 0 })) })), this.log("Retrieved flags from cache", o3))), s3 ? (h2 = !V && (!this.cacheOptions.skipAPI || l3), this._onChange(null, { isFromServer: false, flagsChanged: t6, traitsChanged: n2 }, this._loadedState(null, d.CACHE, h2)), this.oldFlags = this.flags, this.cacheOptions.skipAPI && s3 && !l3 && this.log("Skipping API, using cache"), h2 && this.getFlags().catch(function(t7) {
                        var e2;
                        null === (e2 = w3.onError) || void 0 === e2 || e2.call(w3, t7);
                      }), [3, 4]) : [3, 2];
                    case 2:
                      return V ? [3, 4] : [4, this.getFlags()];
                    case 3:
                      i2.sent(), i2.label = 4;
                    case 4:
                      return [3, 6];
                    case 5:
                      throw v2 = i2.sent(), this.log("Exception fetching cached logs", v2), v2;
                    case 6:
                      return [3, 10];
                    case 7:
                      return V ? [3, 9] : [4, this.getFlags()];
                    case 8:
                      return i2.sent(), [3, 10];
                    case 9:
                      if (k2) this._onChange(null, { isFromServer: false, flagsChanged: r({}, this.flags), traitsChanged: r({}, null === (x3 = this.evaluationContext.identity) || void 0 === x3 ? void 0 : x3.traits) }, this._loadedState(null, d.DEFAULT_FLAGS));
                      else {
                        if (!this.flags) throw new Error(X);
                        this._onChange(null, { isFromServer: false, flagsChanged: r({}, this.flags), traitsChanged: r({}, null === (_3 = this.evaluationContext.identity) || void 0 === _3 ? void 0 : _3.traits) }, this._loadedState(null, d.DEFAULT_FLAGS));
                      }
                      i2.label = 10;
                    case 10:
                      return [2];
                  }
                });
              });
            }, it.label = 2;
          case 2:
            return it.trys.push([2, 7, , 8]), S.getItemSync ? (z = S.getItemSync(this.getStorageKey()), [3, 5]) : [3, 3];
          case 3:
            return [4, S.getItem(this.getStorageKey())];
          case 4:
            z = it.sent(), it.label = 5;
          case 5:
            return [4, Y(null, z)];
          case 6:
            return it.sent(), [3, 8];
          case 7:
            if (Q = it.sent(), !this.flags || 0 === Object.keys(this.flags).length) throw Q;
            return et = Q instanceof Error ? Q : new Error("".concat(Q)), null === (o2 = this.onError) || void 0 === o2 || o2.call(this, et), [3, 8];
          case 8:
            return [3, 12];
          case 9:
            return V ? [3, 11] : [4, this.getFlags()];
          case 10:
            return it.sent(), [3, 12];
          case 11:
            if (k2) this._onChange(null, { isFromServer: false, flagsChanged: r({}, k2), traitsChanged: r({}, null === (s2 = f2.identity) || void 0 === s2 ? void 0 : s2.traits) }, this._loadedState(null, d.DEFAULT_FLAGS));
            else if (this.flags && (Z = null, 0 === Object.keys(this.flags).length && (Z = X), this._onChange(null, { isFromServer: false, flagsChanged: r({}, this.flags), traitsChanged: r({}, null === (l2 = f2.identity) || void 0 === l2 ? void 0 : l2.traits) }, this._loadedState(Z, d.DEFAULT_FLAGS)), Z)) throw new Error(Z);
            it.label = 12;
          case 12:
            return [3, 14];
          case 13:
            throw tt = it.sent(), this.log("Error during initialisation ", tt), et = tt instanceof Error ? tt : new Error("".concat(tt)), null === (c2 = this.onError) || void 0 === c2 || c2.call(this, et), tt;
          case 14:
            return [2];
        }
      });
    });
  }, t3.prototype.getAllFlags = function() {
    return this.flags;
  }, t3.prototype.identify = function(t4, e2, n2) {
    return this.identity = t4, this.evaluationContext.identity = { identifier: t4, transient: n2, traits: this.evaluationContext.identity && this.evaluationContext.identity.identifier == t4 ? this.evaluationContext.identity.traits : {} }, this.evaluationContext.identity.identifier = t4, this.log("Identify: " + this.evaluationContext.identity.identifier), e2 && (this.evaluationContext.identity.traits = Object.fromEntries(Object.entries(e2).map(function(t5) {
      var e3 = t5[0], n3 = t5[1];
      return [e3, s(n3) ? n3 : { value: n3 }];
    }))), this.initialised ? this.getFlags() : Promise.resolve();
  }, t3.prototype.getState = function() {
    return { api: this.api, flags: this.flags, ts: this.ts, evaluationContext: this.evaluationContext, identity: this.identity, evaluationEvent: this.evaluationEvent };
  }, t3.prototype.setState = function(t4) {
    var e2, n2;
    t4 && (this.initialised = true, this.api = t4.api || this.api || C, this.flags = t4.flags || this.flags, this.evaluationContext = t4.evaluationContext || this.evaluationContext, this.evaluationEvent = t4.evaluationEvent || this.evaluationEvent, this.identity = null === (n2 = null === (e2 = this.getContext()) || void 0 === e2 ? void 0 : e2.identity) || void 0 === n2 ? void 0 : n2.identifier, this.log("setState called", this), this.loadingState.source === d.NONE && this.flags && Object.keys(this.flags).length > 0 && this.setLoadingState(this._loadedState(null, d.SERVER)));
  }, t3.prototype.logout = function() {
    return this.identity = null, this.evaluationContext.identity = null, this.initialised ? this.getFlags() : Promise.resolve();
  }, t3.prototype.startListening = function(t4) {
    void 0 === t4 && (t4 = 1e3), this.getFlagInterval && clearInterval(this.getFlagInterval), this.getFlagInterval = setInterval(this.getFlags, t4);
  }, t3.prototype.stopListening = function() {
    this.getFlagInterval && (clearInterval(this.getFlagInterval), this.getFlagInterval = null);
  }, t3.prototype._loadedState = function(t4, e2, n2) {
    return void 0 === t4 && (t4 = null), void 0 === n2 && (n2 = false), { error: t4, isFetching: n2, isLoading: false, source: e2 };
  }, t3.prototype.log = function() {
    for (var t4 = [], e2 = 0; e2 < arguments.length; e2++) t4[e2] = arguments[e2];
    this.enableLogs && console.log.apply(this, (function(t5, e3, n2) {
      if (n2 || 2 === arguments.length) for (var i2, a2 = 0, r2 = e3.length; a2 < r2; a2++) !i2 && a2 in e3 || (i2 || (i2 = Array.prototype.slice.call(e3, 0, a2)), i2[a2] = e3[a2]);
      return t5.concat(i2 || Array.prototype.slice.call(e3));
    })(["FLAGSMITH:", (/* @__PURE__ */ new Date()).valueOf() - (this.timer || 0), "ms"], t4, true));
  }, t3.prototype.updateStorage = function() {
    if (this.cacheFlags) {
      this.ts = (/* @__PURE__ */ new Date()).valueOf();
      var t4 = JSON.stringify(this.getState());
      this.log("Setting storage", t4), S.setItem(this.getStorageKey(), t4);
    }
  }, t3.prototype.updateEventStorage = function() {
    if (this.enableAnalytics) {
      var t4 = JSON.stringify(this.getState().evaluationEvent);
      S.setItem(E, t4).catch(function(t5) {
        return console.error("Flagsmith: Error setting item in async storage", t5);
      });
    }
  }, t3.prototype.setLoadingState = function(t4) {
    var n2;
    a(t4, this.loadingState) || (this.loadingState = e({}, t4), this.log("Loading state changed", t4), null === (n2 = this._triggerLoadingState) || void 0 === n2 || n2.call(this));
  }, t3.prototype.setupRealtime = function(t4, e2) {
    var n2 = this, i2 = t4 + "sse/environments/" + e2 + "/stream";
    m ? this.eventSource || (this.log("Creating event source with url " + i2), this.eventSource = new m(i2), this.eventSource.addEventListener("environment_updated", function(t5) {
      var e3;
      try {
        e3 = JSON.parse(t5.data).updated_at;
      } catch (t6) {
        n2.log("Could not parse sse event", t6);
      }
      e3 ? !n2.timestamp || e3 > n2.timestamp ? n2.isLoading ? n2.log("updated_at is new, but flags are loading", t5.data, n2.timestamp) : (n2.log("updated_at is new, fetching flags", t5.data, n2.timestamp), n2.getFlags()) : n2.log("updated_at is outdated, skipping get flags", t5.data, n2.timestamp) : n2.log("No updated_at received, fetching flags", t5);
    })) : this.log("Error, EventSource is undefined");
  }, t3;
})();
function F(t3) {
  var e2 = t3.fetch, n2 = t3.AsyncStorage, i2 = t3.eventSource;
  return new O({ fetch: e2, AsyncStorage: n2, eventSource: i2 });
}
var I;
var j = (I = function(t3, e2) {
  return I = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(t4, e3) {
    t4.__proto__ = e3;
  } || function(t4, e3) {
    for (var n2 in e3) Object.prototype.hasOwnProperty.call(e3, n2) && (t4[n2] = e3[n2]);
  }, I(t3, e2);
}, function(t3, e2) {
  if ("function" != typeof e2 && null !== e2) throw new TypeError("Class extends value " + String(e2) + " is not a constructor or null");
  function n2() {
    this.constructor = t3;
  }
  I(t3, e2), t3.prototype = null === e2 ? Object.create(e2) : (n2.prototype = e2.prototype, new n2());
});
var k = function(t3) {
  var e2 = "function" == typeof Symbol && Symbol.iterator, n2 = e2 && t3[e2], i2 = 0;
  if (n2) return n2.call(t3);
  if (t3 && "number" == typeof t3.length) return { next: function() {
    return t3 && i2 >= t3.length && (t3 = void 0), { value: t3 && t3[i2++], done: !t3 };
  } };
  throw new TypeError(e2 ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var A = function(t3, e2) {
  var n2 = "function" == typeof Symbol && t3[Symbol.iterator];
  if (!n2) return t3;
  var i2, a2, r2 = n2.call(t3), o2 = [];
  try {
    for (; (void 0 === e2 || e2-- > 0) && !(i2 = r2.next()).done; ) o2.push(i2.value);
  } catch (t4) {
    a2 = { error: t4 };
  } finally {
    try {
      i2 && !i2.done && (n2 = r2.return) && n2.call(r2);
    } finally {
      if (a2) throw a2.error;
    }
  }
  return o2;
};
var L = function(t3, e2, n2) {
  if (n2 || 2 === arguments.length) for (var i2, a2 = 0, r2 = e2.length; a2 < r2; a2++) !i2 && a2 in e2 || (i2 || (i2 = Array.prototype.slice.call(e2, 0, a2)), i2[a2] = e2[a2]);
  return t3.concat(i2 || Array.prototype.slice.call(e2));
};
var P = (function(t3) {
  function e2() {
    return t3.call(this, "EventSource not available.\nConsider loading an EventSource polyfill and making it available globally as EventSource, or passing one in as eventSourceClass to the ReconnectingEventSource constructor.") || this;
  }
  return j(e2, t3), e2;
})(Error);
var T = (function() {
  function t3(t4, e2) {
    var n2 = this;
    if (this.CONNECTING = 0, this.OPEN = 1, this.CLOSED = 2, this._configuration = null != e2 ? Object.assign({}, e2) : void 0, this.withCredentials = false, this._eventSource = null, this._lastEventId = null, this._timer = null, this._listeners = { open: [], error: [], message: [] }, this.url = t4.toString(), this.readyState = this.CONNECTING, this.max_retry_time = 3e3, this.eventSourceClass = globalThis.FlagsmithEventSource, null != this._configuration && (this._configuration.lastEventId && (this._lastEventId = this._configuration.lastEventId, delete this._configuration.lastEventId), this._configuration.max_retry_time && (this.max_retry_time = this._configuration.max_retry_time, delete this._configuration.max_retry_time), this._configuration.eventSourceClass && (this.eventSourceClass = this._configuration.eventSourceClass, delete this._configuration.eventSourceClass)), null == this.eventSourceClass || "function" != typeof this.eventSourceClass) throw new P();
    this._onevent_wrapped = function(t5) {
      n2._onevent(t5);
    }, this._start();
  }
  return t3.prototype.dispatchEvent = function(t4) {
    throw new Error("Method not implemented.");
  }, t3.prototype._start = function() {
    var t4, e2, n2 = this, i2 = this.url;
    this._lastEventId && (-1 === i2.indexOf("?") ? i2 += "?" : i2 += "&", i2 += "lastEventId=" + encodeURIComponent(this._lastEventId)), this._eventSource = new this.eventSourceClass(i2, this._configuration), this._eventSource.onopen = function(t5) {
      n2._onopen(t5);
    }, this._eventSource.onerror = function(t5) {
      n2._onerror(t5);
    }, this._eventSource.onmessage = function(t5) {
      n2.onmessage(t5);
    };
    try {
      for (var a2 = k(Object.keys(this._listeners)), r2 = a2.next(); !r2.done; r2 = a2.next()) {
        var o2 = r2.value;
        this._eventSource.addEventListener(o2, this._onevent_wrapped);
      }
    } catch (e3) {
      t4 = { error: e3 };
    } finally {
      try {
        r2 && !r2.done && (e2 = a2.return) && e2.call(a2);
      } finally {
        if (t4) throw t4.error;
      }
    }
  }, t3.prototype._onopen = function(t4) {
    0 === this.readyState && (this.readyState = 1, this.onopen(t4));
  }, t3.prototype._onerror = function(t4) {
    var e2 = this;
    if (1 === this.readyState && (this.readyState = 0, this.onerror(t4)), this._eventSource) {
      this._eventSource.close(), this._eventSource = null;
      var n2 = Math.round(this.max_retry_time * Math.random());
      this._timer = setTimeout(function() {
        return e2._start();
      }, n2);
    }
  }, t3.prototype._onevent = function(t4) {
    var e2, n2;
    t4 && t4.lastEventId && (this._lastEventId = t4.lastEventId);
    var i2 = this._listeners[t4.type];
    if (null != i2) try {
      for (var a2 = k(L([], A(i2), false)), r2 = a2.next(); !r2.done; r2 = a2.next()) {
        r2.value.call(this, t4);
      }
    } catch (t5) {
      e2 = { error: t5 };
    } finally {
      try {
        r2 && !r2.done && (n2 = a2.return) && n2.call(a2);
      } finally {
        if (e2) throw e2.error;
      }
    }
    "message" === t4.type && this.onmessage(t4);
  }, t3.prototype.onopen = function(t4) {
  }, t3.prototype.onerror = function(t4) {
  }, t3.prototype.onmessage = function(t4) {
  }, t3.prototype.close = function() {
    this._timer && (clearTimeout(this._timer), this._timer = null), this._eventSource && (this._eventSource.close(), this._eventSource = null), this.readyState = 2;
  }, t3.prototype.addEventListener = function(t4, e2, n2) {
    null == this._listeners[t4] && (this._listeners[t4] = [], null != this._eventSource && this._eventSource.addEventListener(t4, this._onevent_wrapped));
    var i2 = this._listeners[t4];
    i2.includes(e2) || (this._listeners[t4] = L(L([], A(i2), false), [e2], false));
  }, t3.prototype.removeEventListener = function(t4, e2, n2) {
    var i2 = this._listeners[t4];
    this._listeners[t4] = i2.filter(function(t5) {
      return t5 !== e2;
    });
  }, t3;
})();
globalThis.FlagsmithEventSource = "undefined" != typeof EventSource ? EventSource : null;
var N = function(t3, e2) {
  return e2 = e2 || {}, new Promise(function(n2, i2) {
    var a2 = new XMLHttpRequest(), r2 = [], o2 = [], s2 = {}, l2 = function() {
      return { ok: 2 == (a2.status / 100 | 0), statusText: a2.statusText, status: a2.status, url: a2.responseURL, text: function() {
        return Promise.resolve(a2.responseText);
      }, json: function() {
        return Promise.resolve(a2.responseText).then(JSON.parse);
      }, blob: function() {
        return Promise.resolve(new Blob([a2.response]));
      }, clone: l2, headers: { keys: function() {
        return r2;
      }, entries: function() {
        return o2;
      }, get: function(t4) {
        return s2[t4.toLowerCase()];
      }, has: function(t4) {
        return t4.toLowerCase() in s2;
      } } };
    };
    for (var u2 in a2.open(e2.method || "get", t3, true), a2.onload = function() {
      a2.getAllResponseHeaders().replace(/^(.*?):[^\S\n]*([\s\S]*?)$/gm, function(t4, e3, n3) {
        r2.push(e3 = e3.toLowerCase()), o2.push([e3, n3]), s2[e3] = s2[e3] ? s2[e3] + "," + n3 : n3;
      }), n2(l2());
    }, a2.onerror = i2, a2.withCredentials = "include" == e2.credentials, e2.headers) a2.setRequestHeader(u2, e2.headers[u2]);
    a2.send(e2.body || null);
  });
};
var K = F({ AsyncStorage: t, fetch: N, eventSource: T });
"undefined" != typeof window && (window.flagsmith = K);

// src/experiment-config.mjs
var EXPERIMENT_FLAG = "checkout_cta_copy";
var EXPERIMENT_EVENT = "checkout_completed";
var EXPERIMENT_VARIANTS = Object.freeze([
  { key: "control", label: "Control", copy: "Checkout", conversionRate: 0.32 },
  { key: "buy_now", label: "Buy now", copy: "Buy now", conversionRate: 0.46 },
  { key: "get_it_today", label: "Get it today", copy: "Get it today", conversionRate: 0.38 }
]);

// src/experiment-browser.js
var $ = (s2) => document.querySelector(s2);
function pickStubVariation(identity) {
  let h2 = 0;
  for (const c2 of identity) h2 = h2 * 31 + c2.charCodeAt(0) >>> 0;
  return EXPERIMENT_VARIANTS[h2 % EXPERIMENT_VARIANTS.length].key;
}
function showVariation({ key, identity, live }) {
  const variant = EXPERIMENT_VARIANTS.find((v2) => v2.key === key);
  window.experimentVariant = key;
  window.flagproofReady = true;
  $("#variant").textContent = `Variation: ${variant.label}`;
  const cta = $("#cta");
  cta.textContent = variant.copy;
  cta.disabled = false;
  $("#resolved").textContent = JSON.stringify({ flag: EXPERIMENT_FLAG, variation: key, identity, metricEvent: EXPERIMENT_EVENT, mode: live ? "live" : "stub" }, null, 2);
  cta.onclick = async () => {
    cta.disabled = true;
    $("#confirmation").hidden = false;
    if (!live) {
      $("#event-note").textContent = "Stub preview: no conversion event was sent to Flagsmith. No money charged.";
      return;
    }
    try {
      await K.trackEvent(EXPERIMENT_EVENT, { value: 105 });
      await K.flushEvents();
      $("#event-note").textContent = `Conversion event "${EXPERIMENT_EVENT}" sent to Flagsmith for this variation. No money charged.`;
    } catch {
      $("#event-note").textContent = "Order confirmed locally; the conversion event could not be sent. No money charged.";
    }
  };
}
try {
  const config = await fetch("/api/demo-config", { cache: "no-store" }).then((r2) => r2.json());
  let identity = localStorage.getItem("fp-experiment-identity");
  if (!identity) {
    identity = `visitor-${crypto.randomUUID()}`;
    localStorage.setItem("fp-experiment-identity", identity);
  }
  if (config.mode !== "flagsmith") {
    $("#mode").textContent = "SYNTHETIC PREVIEW \xB7 variation stubbed, no live Flagsmith traffic";
    $("#intro").textContent = "This stub preview shows how the experiment shop behaves. No Flagsmith environment is connected: the variation below is chosen locally, and no exposure or conversion events are sent. No payment or real order is created.";
    showVariation({ key: pickStubVariation(identity), identity, live: false });
  } else {
    await K.init({ environmentID: config.environmentID, api: config.api, cacheFlags: false, enableEvents: true });
    await K.identify(identity);
    const flag = K.getExperimentFlag(EXPERIMENT_FLAG);
    const key = EXPERIMENT_VARIANTS.some((v2) => v2.key === flag?.value) ? flag.value : "control";
    $("#mode").textContent = config.label;
    showVariation({ key, identity, live: true });
  }
} catch (error) {
  $("#mode").textContent = "Experiment setup failed";
  $("#setup-error").textContent = error.message;
  window.flagproofReady = false;
}
