(function (global) {
  'use strict';

  const DEFAULT_WS_URL = 'wss://smo-rand.johnnycyan.com/ws';

  function normalizeWsUrl(url) {
    if (!url) return DEFAULT_WS_URL;
    url = url.trim();
    if (!/^wss?:\/\//i.test(url)) {
      url = 'wss://' + url;
    }
    if (!/\/ws$/i.test(url)) {
      url = url.replace(/\/$/, '') + '/ws';
    }
    return url;
  }

  function generateRoomCode(length) {
    length = length || 12;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    const crypto = global.crypto || global.msCrypto;
    if (crypto && crypto.getRandomValues) {
      const nums = new Uint32Array(length);
      crypto.getRandomValues(nums);
      for (let i = 0; i < length; i++) {
        code += chars[nums[i] % chars.length];
      }
    } else {
      for (let i = 0; i < length; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
    }
    return code;
  }

  function Sync() {
    this.room = null;
    this.wsUrl = DEFAULT_WS_URL;
    this.socket = null;
    this.stateListeners = [];
    this.statusListeners = [];
    this.joinedListeners = [];
    this.status = 'disconnected';
    this.reconnectTimer = null;
    this.intentionalClose = false;
  }

  Sync.prototype._setStatus = function (status) {
    this.status = status;
    this.statusListeners.forEach((cb) => cb(status));
  };

  Sync.prototype._connect = function () {
    if (this.socket) return;
    if (!this.room) return;

    this._setStatus('connecting');
    this.intentionalClose = false;

    try {
      this.socket = new WebSocket(this.wsUrl);
    } catch (e) {
      console.error('WebSocket construction failed:', e);
      this._scheduleReconnect();
      return;
    }

    this.socket.addEventListener('open', () => {
      this._setStatus('connected');
      this.socket.send(JSON.stringify({ type: 'join', room: this.room }));
    });

    this.socket.addEventListener('message', (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch (e) {
        return;
      }
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'joined' && msg.room === this.room) {
        this.joinedListeners.forEach((cb) => cb(msg.room));
      }

      if (msg.type === 'state' && msg.room === this.room && msg.data) {
        this.stateListeners.forEach((cb) => cb(msg.data));
      }
    });

    this.socket.addEventListener('close', () => {
      this.socket = null;
      this._setStatus('disconnected');
      if (!this.intentionalClose) {
        this._scheduleReconnect();
      }
    });

    this.socket.addEventListener('error', (err) => {
      console.error('WebSocket error:', err);
      this._setStatus('error');
    });
  };

  Sync.prototype._scheduleReconnect = function () {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.room && !this.intentionalClose) {
        this._connect();
      }
    }, 3000);
  };

  Sync.prototype.connect = function (room, wsUrl) {
    this.disconnect();
    this.room = room || null;
    this.wsUrl = normalizeWsUrl(wsUrl);
    if (!this.room) {
      this._setStatus('disconnected');
      return;
    }
    this._connect();
  };

  Sync.prototype.disconnect = function () {
    this.intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.room = null;
    this._setStatus('disconnected');
  };

  Sync.prototype.broadcast = function (state) {
    if (!this.room || !this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ type: 'state', room: this.room, data: state }));
  };

  Sync.prototype.onState = function (callback) {
    this.stateListeners.push(callback);
  };

  Sync.prototype.onStatus = function (callback) {
    this.statusListeners.push(callback);
    callback(this.status);
  };

  Sync.prototype.onJoined = function (callback) {
    this.joinedListeners.push(callback);
  };

  Sync.prototype.getRoom = function () {
    return this.room;
  };

  Sync.prototype.getWsUrl = function () {
    return this.wsUrl;
  };

  const sync = new Sync();
  sync.generateRoomCode = generateRoomCode;
  sync.normalizeWsUrl = normalizeWsUrl;
  global.SMOSync = sync;
})(typeof window !== 'undefined' ? window : this);
