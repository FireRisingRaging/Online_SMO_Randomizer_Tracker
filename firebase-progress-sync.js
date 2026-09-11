(function (global) {
  'use strict';

  // Live moon-count / capture / ability auto-tracking for the main tracker
  // (index.html), sibling to firebase-live-sync.js's door-transition sync
  // for map.html. Same Firebase project/config, same room code the player
  // already enters for the connection map - but a different document shape:
  // the mod overwrites a single fixed doc (rooms/{room}/progress/state) in
  // place every time something changes, rather than appending to a growing
  // events collection, since this is pure current-state (a dropped/replaced
  // snapshot is harmless - the next change just sends a fresh one).
  const FIREBASE_SDK_VERSION = '10.14.1';
  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyDO7jje5ZbN4qcFQHf36mkf1AnbEXKJrBM',
    authDomain: 'smo-randomizer-tracker.firebaseapp.com',
    projectId: 'smo-randomizer-tracker',
  };

  function FirebaseProgressSync() {
    this.room = null;
    this.statusListeners = [];
    this.progressListeners = [];
    this.status = 'disconnected';
    this._unsubscribe = null;
    this._sdk = null;
  }

  FirebaseProgressSync.prototype._setStatus = function (status) {
    this.status = status;
    this.statusListeners.forEach((cb) => cb(status));
  };

  FirebaseProgressSync.prototype._loadSdk = async function () {
    if (this._sdk) return this._sdk;
    const appMod = await import(
      `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`
    );
    const fsMod = await import(
      `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-firestore.js`
    );
    const app = appMod.initializeApp(FIREBASE_CONFIG, 'progress-sync');
    const db = fsMod.getFirestore(app);
    this._sdk = { db, doc: fsMod.doc, onSnapshot: fsMod.onSnapshot };
    return this._sdk;
  };

  FirebaseProgressSync.prototype.connect = async function (room) {
    this.disconnect();
    this.room = room || null;
    if (!this.room) {
      this._setStatus('disconnected');
      return;
    }

    this._setStatus('connecting');
    try {
      const sdk = await this._loadSdk();
      if (this.room !== room) return; // disconnect()/connect() raced while loading

      const stateDoc = sdk.doc(sdk.db, 'rooms', this.room, 'progress', 'state');
      this._unsubscribe = sdk.onSnapshot(
        stateDoc,
        (snapshot) => {
          this._setStatus('connected');
          if (!snapshot.exists()) {
            console.log('[tracker-progress] snapshot does not exist yet');
            return;
          }
          const data = snapshot.data();
          // Temporary diagnostic - shows exactly what Firestore actually
          // has for this room, straight from the doc, so a stuck tracker
          // and a stuck upload (mod-side) are distinguishable at a glance.
          console.log('[tracker-progress] snapshot', data);
          if (!data || typeof data.moons !== 'string' || typeof data.captures !== 'string'
            || typeof data.abilities !== 'string') {
            console.log('[tracker-progress] snapshot missing required string fields, ignoring', data);
            return;
          }
          this.progressListeners.forEach((cb) => cb(data));
        },
        (err) => {
          console.error('Firestore progress listen error:', err);
          this._setStatus('error');
        }
      );
    } catch (err) {
      console.error('Firebase progress connect failed:', err);
      this._setStatus('error');
    }
  };

  FirebaseProgressSync.prototype.disconnect = function () {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
    this.room = null;
    this._setStatus('disconnected');
  };

  FirebaseProgressSync.prototype.onStatus = function (callback) {
    this.statusListeners.push(callback);
    callback(this.status);
  };

  FirebaseProgressSync.prototype.onProgress = function (callback) {
    this.progressListeners.push(callback);
  };

  global.SMOFirebaseProgressSync = new FirebaseProgressSync();
})(typeof window !== 'undefined' ? window : this);
