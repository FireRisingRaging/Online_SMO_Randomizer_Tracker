(function (global) {
  'use strict';

  // Alternative to sync.js's WebSocket relay for Live Tracking: Firestore
  // directly, no local relay process needed at all. Same public interface
  // shape as window.SMOSync (connect/disconnect/onStatus/onLiveEvent) so
  // map.html can swap between the two without touching its own logic.
  //
  // Firebase v10 modular SDK, loaded as ES modules straight from Google's
  // CDN - no build step, works from a static GitHub Pages deploy as-is.
  const FIREBASE_SDK_VERSION = '10.14.1';

  // Fill these in after creating the Firebase project - see the tracker
  // README's "Cloud Live Tracking" section for the setup steps. These are
  // all PUBLIC, safe-to-commit values: Firebase's client config identifies
  // which project to talk to, it is not a secret. Access control lives
  // entirely in Firestore's security rules (room-code-scoped, no user auth -
  // same trust model the local relay's room codes already use), not in
  // hiding these values.
  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyDO7jje5ZbN4qcFQHf36mkf1AnbEXKJrBM',
    authDomain: 'smo-randomizer-tracker.firebaseapp.com',
    projectId: 'smo-randomizer-tracker',
  };

  // The mod writes raw stage names (exitId/from/to/debugArrivalDoorId), not
  // resolved map_node ids - it has no copy of this dictionary to resolve
  // them with itself (that's tracker-server.js's job for the local relay
  // path). In cloud mode this same resolution has to happen here instead,
  // once per received event, mirroring tracker-server.js's resolveStage()
  // and lastKnownNode-bridging logic exactly (see that file for the fuller
  // explanation of why untracked intermediate stages like boss painting
  // rooms need bridging over rather than just dropping the event).
  let stageToNodePromise = null;
  function loadStageToNode() {
    if (!stageToNodePromise) {
      stageToNodePromise = fetch('loading_zone_dictionary.json')
        .then((r) => r.json())
        .then((dict) => {
          const map = new Map();
          // Ambiguous stages (a handful, listed in _meta.ambiguous_stages -
          // e.g. Sand Kingdom's shop building covers both the public shop
          // counter and the employees-only back room, both the same
          // loading_zone_name) must resolve to their documented first-listed
          // candidate, seeded before the general zones loop below so its
          // "if (!map.has(...))" skips them rather than letting whichever
          // candidate happens to appear first in dict.zones win by accident.
          const preferred = (dict._meta && dict._meta.ambiguous_stages) || {};
          for (const [stageName, nodes] of Object.entries(preferred)) {
            if (nodes && nodes.length) map.set(stageName, nodes[0]);
          }
          for (const zone of dict.zones) {
            if (!map.has(zone.loading_zone_name)) map.set(zone.loading_zone_name, zone.map_node);
          }
          return map;
        });
    }
    return stageToNodePromise;
  }

  function FirebaseSync() {
    this.room = null;
    this.statusListeners = [];
    this.liveEventListeners = [];
    this.status = 'disconnected';
    this._unsubscribe = null;
    this._sdk = null;
    this._hasSeenInitialSnapshot = false;
    this._lastKnownNode = null;
  }

  FirebaseSync.prototype._setStatus = function (status) {
    this.status = status;
    this.statusListeners.forEach((cb) => cb(status));
  };

  FirebaseSync.prototype._loadSdk = async function () {
    if (this._sdk) return this._sdk;
    const appMod = await import(
      `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`
    );
    const fsMod = await import(
      `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-firestore.js`
    );
    const app = appMod.initializeApp(FIREBASE_CONFIG);
    const db = fsMod.getFirestore(app);
    this._sdk = {
      db,
      collection: fsMod.collection,
      onSnapshot: fsMod.onSnapshot,
    };
    return this._sdk;
  };

  // Same resolution + bridging rule tracker-server.js applies: an event
  // whose "from" doesn't resolve (an untracked intermediate stage) falls
  // back to the last node that DID resolve, so e.g. a painting-room hop
  // still draws one continuous edge instead of silently dropping.
  FirebaseSync.prototype._resolveEvent = function (stageToNode, raw) {
    if (!raw) return null;
    const resolvedSrc = stageToNode.get(raw.from) || null;
    const resolvedTgt = stageToNode.get(raw.to) || null;
    const effectiveSrc = resolvedSrc || this._lastKnownNode;

    // Temporary diagnostic - remove once the kingdom-home-arrival mislink is
    // actually confirmed fixed. Shows the raw stage names straight off the
    // event alongside what they resolved to, so a bad resolution and a bad
    // downstream draw (map.html's dedup, etc.) are distinguishable at a
    // glance in the browser console.
    console.log('[tracker] event', {
      from: raw.from, to: raw.to, exitId: raw.exitId, debugArrivalDoorId: raw.debugArrivalDoorId,
      resolvedSrc, resolvedTgt, effectiveSrc, lastKnownNodeBefore: this._lastKnownNode,
    });

    if (resolvedSrc) this._lastKnownNode = resolvedSrc;
    if (!effectiveSrc || !resolvedTgt) return null;
    this._lastKnownNode = resolvedTgt;

    return { src: effectiveSrc, sPart: 'out', tgt: resolvedTgt, tPart: 'in' };
  };

  FirebaseSync.prototype.connect = async function (room) {
    this.disconnect();
    this.room = room || null;
    if (!this.room) {
      this._setStatus('disconnected');
      return;
    }

    this._setStatus('connecting');
    try {
      const [sdk, stageToNode] = await Promise.all([this._loadSdk(), loadStageToNode()]);
      if (this.room !== room) return; // disconnect()/connect() raced while loading

      this._hasSeenInitialSnapshot = false;
      this._lastKnownNode = null;
      // No orderBy/limit: events carry no timestamp field (the mod has no
      // reliable wall clock - see firestore.rules), so there's nothing to
      // order by. A room's event volume is a single testing session's worth,
      // not large enough to need windowing.
      const eventsCollection = sdk.collection(sdk.db, 'rooms', this.room, 'events');
      this._unsubscribe = sdk.onSnapshot(
        eventsCollection,
        (snapshot) => {
          this._setStatus('connected');
          // Mirrors the local relay's liveEvent behavior: a late joiner
          // should not get the whole room history replayed as if it just
          // happened, only react to changes that arrive AFTER this listener
          // attached.
          if (!this._hasSeenInitialSnapshot) {
            this._hasSeenInitialSnapshot = true;
            return;
          }
          snapshot.docChanges().forEach((change) => {
            if (change.type !== 'added') return;
            const resolved = this._resolveEvent(stageToNode, change.doc.data());
            if (resolved) this.liveEventListeners.forEach((cb) => cb(resolved));
          });
        },
        (err) => {
          console.error('Firestore listen error:', err);
          this._setStatus('error');
        }
      );
    } catch (err) {
      console.error('Firebase connect failed:', err);
      this._setStatus('error');
    }
  };

  FirebaseSync.prototype.disconnect = function () {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
    this.room = null;
    this._setStatus('disconnected');
  };

  FirebaseSync.prototype.onStatus = function (callback) {
    this.statusListeners.push(callback);
    callback(this.status);
  };

  FirebaseSync.prototype.onLiveEvent = function (callback) {
    this.liveEventListeners.push(callback);
  };

  global.SMOFirebaseSync = new FirebaseSync();
})(typeof window !== 'undefined' ? window : this);
