var Signals = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // signals-entry.js
  var signals_entry_exports = {};
  __export(signals_entry_exports, {
    Demodulator: () => Demodulator,
    PushSource: () => PushSource,
    Radio: () => Radio,
    SimpleProvider: () => SimpleProvider,
    getMode: () => getMode,
    getSchemes: () => getSchemes,
    modeParameters: () => modeParameters
  });

  // node_modules/@jtarrio/signals/dist/dsp/buffers.js
  var Pool = class {
    make;
    /**
     * @param make A function that returns an array of the given length.
     * @param count The number of arrays to keep around. Having more than 1 lets you modify one array while you use another.
     * @param length An optional initial length for the arrays.
     */
    constructor(make, count, length) {
      this.make = make;
      this.buffers = [...Array(count).keys()].map(() => make(length || 0));
      this.current = 0;
    }
    buffers;
    current;
    /** Returns an array of the given size. You may need to clear it manually. */
    get(length) {
      let out = this.buffers[this.current];
      if (out.length < length) {
        out = this.make(length);
        this.buffers[this.current] = out;
      }
      this.current = (this.current + 1) % this.buffers.length;
      if (out.length == length)
        return out;
      return out.subarray(0, length);
    }
  };
  var Float32Pool = class extends Pool {
    /**
     * @param count The number of arrays to keep around. Having more than 1 lets you modify one array while you use another.
     * @param length An optional initial size for the arrays.
     */
    constructor(count, length) {
      super((l) => new Float32Array(l), count, length);
    }
  };
  var IqPool = class {
    /**
     * @param count The number of array pairs to keep around. Having more than 1 lets you modify one pair while you use another.
     * @param length An optional initial size for the arrays.
     */
    constructor(count, length) {
      this.pools = new Float32Pool(count * 2, length);
    }
    pools;
    /** Returns a pair of arrays of the given size. You may need to clear them manually. */
    get(length) {
      return [this.pools.get(length), this.pools.get(length)];
    }
  };
  var RingBuffer = class {
    buffer;
    constructor(buffer) {
      this.buffer = buffer;
      this.readPos = 0;
      this.writePos = 0;
      this.filled = 0;
    }
    readPos;
    writePos;
    filled;
    /** Returns the ring buffer's capacity. */
    get capacity() {
      return this.buffer.length;
    }
    /** Returns the number of values that can be accessed using moveTo. */
    get available() {
      return this.filled;
    }
    /** Empties the ring buffer. */
    clear() {
      this.readPos = 0;
      this.writePos = 0;
      this.filled = 0;
    }
    /**
     * Stores repeated copies of a value in the ring buffer.
     *
     * @param value the value to store.
     * @param count the number of copies to store. The whole ring buffer is filled if not specified.
     * */
    fill(value, count) {
      if (count === void 0 || count >= this.buffer.length) {
        this.buffer.fill(value);
        this.readPos = 0;
        this.writePos = 0;
        this.filled = this.buffer.length;
        return;
      }
      let remaining = count;
      let dstOffset = this.writePos;
      while (remaining > 0) {
        const copyCount = Math.min(remaining, this.buffer.length - this.writePos);
        this.buffer.subarray(dstOffset, dstOffset + copyCount).fill(value);
        dstOffset = (dstOffset + copyCount) % this.buffer.length;
        remaining -= copyCount;
      }
      this.writePos = dstOffset;
      this.filled = Math.min(this.buffer.length, this.filled + count);
      if (this.filled == this.buffer.length) {
        this.readPos = this.writePos;
      }
    }
    /** Copies the provided data into the ring buffer. */
    store(data) {
      let count = Math.min(data.length, this.buffer.length);
      let { dstOffset } = this.doCopy(count, data, data.length - count, this.buffer, this.writePos);
      this.writePos = dstOffset;
      this.filled = Math.min(this.buffer.length, this.filled + count);
      if (this.filled == this.buffer.length) {
        this.readPos = this.writePos;
      }
    }
    /**
     * Fills the provided array with values from the ring buffer,
     * consuming it in the same order as the values were written.
     * Returns the number of values copied.
     */
    moveTo(data) {
      let count = Math.min(data.length, this.buffer.length, this.filled);
      if (count == 0)
        return 0;
      let { srcOffset } = this.doCopy(count, this.buffer, this.readPos, data, 0);
      this.readPos = srcOffset;
      this.filled -= count;
      return count;
    }
    /**
     * Consumes a number of values from the ring buffer, as if they had been read through moveTo().
     * @param count the number of values to consume.
     */
    consume(count) {
      let discard = Math.min(this.filled, count);
      this.readPos = (this.readPos + discard) % this.buffer.length;
      this.filled -= discard;
    }
    /**
     * Fills the provided array with the latest values stored in the ring buffer,
     * without consuming it and without taking into account the values consumed
     * by moveTo.
     */
    copyTo(data) {
      let count = Math.min(data.length, this.buffer.length);
      let srcOffset = (this.writePos + this.buffer.length - count) % this.buffer.length;
      this.doCopy(count, this.buffer, srcOffset, data, 0);
    }
    doCopy(count, src, srcOffset, dst, dstOffset) {
      while (count > 0) {
        const copyCount = Math.min(count, src.length - srcOffset, dst.length - dstOffset);
        dst.set(src.subarray(srcOffset, srcOffset + copyCount), dstOffset);
        srcOffset = (srcOffset + copyCount) % src.length;
        dstOffset = (dstOffset + copyCount) % dst.length;
        count -= copyCount;
      }
      return { srcOffset, dstOffset };
    }
  };
  var Float32RingBuffer = class extends RingBuffer {
    constructor(size) {
      super(new Float32Array(size));
    }
  };
  var IqRingBuffer = class {
    constructor(size) {
      this.ringI = new Float32RingBuffer(size);
      this.ringQ = new Float32RingBuffer(size);
    }
    ringI;
    ringQ;
    /** Returns the ring buffer's capacity. */
    get capacity() {
      return this.ringI.capacity;
    }
    /** Returns the number of values that can be accessed using moveTo. */
    get available() {
      return this.ringI.available;
    }
    /** Empties the ring buffer. */
    clear() {
      this.ringI.clear();
      this.ringQ.clear();
    }
    /**
     * Stores repeated copies of a value in the ring buffer.
     *
     * @param real the real part of the value to store.
     * @param imag the imaginary part of the value to store.
     * @param count the number of copies to store. The whole ring buffer is filled if not specified.
     * */
    fill(real, imag, count) {
      this.ringI.fill(real, count);
      this.ringQ.fill(imag, count);
    }
    /** Copies the provided data into the ring buffer. */
    store(real, imag) {
      if (real.length == imag.length) {
        this.ringI.store(real);
        this.ringQ.store(imag);
      } else {
        let l = Math.min(real.length, imag.length);
        this.ringI.store(real.subarray(0, l));
        this.ringQ.store(imag.subarray(0, l));
      }
    }
    /**
     * Fills the provided array with values from the ring buffer,
     * consuming it in the same order as the values were written.
     * Returns the number of values copied.
     */
    moveTo(real, imag) {
      this.ringI.moveTo(real);
      return this.ringQ.moveTo(imag);
    }
    /**
     * Consumes a number of values from the ring buffer, as if they had been read through moveTo().
     * @param count the number of values to consume.
     */
    consume(count) {
      this.ringI.consume(count);
      this.ringQ.consume(count);
    }
    /**
     * Fills the provided array with the latest values stored in the ring buffer,
     * without consuming it and without taking into account the values consumed
     * by moveTo.
     */
    copyTo(real, imag) {
      this.ringI.copyTo(real);
      this.ringQ.copyTo(imag);
    }
  };

  // node_modules/@jtarrio/signals/dist/errors.js
  var RadioError = class extends Error {
    constructor(message, typeOrOptions, options) {
      super(message, options !== void 0 ? options : typeof typeOrOptions === "object" ? typeOrOptions : void 0);
      if (typeof typeOrOptions === "number") {
        this.type = typeOrOptions;
        this.name = `RadioError.${RadioErrorType[typeOrOptions]}`;
      }
    }
    type;
  };
  var RadioErrorType;
  (function(RadioErrorType2) {
    RadioErrorType2[RadioErrorType2["TransferError"] = 0] = "TransferError";
    RadioErrorType2[RadioErrorType2["DemodulationError"] = 1] = "DemodulationError";
  })(RadioErrorType || (RadioErrorType = {}));

  // node_modules/@jtarrio/signals/dist/sources/read_ring.js
  var PendingReadRing = class {
    constructor(length) {
      this.pending = new Array(length);
      this.writePtr = 0;
      this.readPtr = 0;
      this.size = 0;
    }
    pending;
    writePtr;
    readPtr;
    size;
    add(length) {
      if (this.size == this.pending.length) {
        throw new RadioError("Too many simultaneous reads", RadioErrorType.TransferError);
      }
      const { promise, resolve, reject } = Promise.withResolvers();
      this.pending[this.writePtr] = { length, resolve, reject };
      this.writePtr = (this.writePtr + 1) % this.pending.length;
      this.size++;
      return promise;
    }
    resolve(block) {
      if (this.size == 0)
        return;
      this.pending[this.readPtr].resolve(block);
      this.readPtr = (this.readPtr + 1) % this.pending.length;
      this.size--;
    }
    cancel() {
      while (this.size > 0) {
        this.pending[this.readPtr].reject(new RadioError("Transfer has been canceled", RadioErrorType.TransferError));
        this.readPtr = (this.readPtr + 1) % this.pending.length;
        this.size--;
      }
    }
    hasPendingRead() {
      return this.size > 0;
    }
    nextReadSize() {
      if (this.size == 0)
        return 0;
      return this.pending[this.readPtr].length;
    }
  };

  // node_modules/@jtarrio/signals/dist/sources/push.js
  var PushSource = class {
    constructor() {
      this.sampleRate = 1024e3;
      this.centerFrequency = 0;
      this.I = new Float32RingBuffer(Math.max(65536, this.sampleRate / 10));
      this.Q = new Float32RingBuffer(this.I.capacity);
      this.outPool = new IqPool(16, 65536);
      this.pendingReads = new PendingReadRing(8);
    }
    sampleRate;
    centerFrequency;
    I;
    Q;
    outPool;
    pendingReads;
    async setParameter(_property, _value) {
    }
    async setSampleRate(sampleRate) {
      this.sampleRate = sampleRate;
      this.I = new Float32RingBuffer(Math.max(65536, this.sampleRate / 10));
      this.Q = new Float32RingBuffer(this.I.capacity);
      return this.sampleRate;
    }
    async setCenterFrequency(freq) {
      this.centerFrequency = freq;
      return this.centerFrequency;
    }
    async startReceiving() {
      this.I.clear();
      this.Q.clear();
    }
    pushSamples(I, Q, frequency) {
      if (frequency !== void 0)
        this.centerFrequency = frequency;
      let pos = 0;
      while (this.pendingReads.hasPendingRead() && pos < I.length) {
        const remaining = I.length - pos;
        const readSize = this.pendingReads.nextReadSize();
        if (readSize > this.I.available + remaining)
          break;
        let [oI, oQ] = this.outPool.get(readSize);
        let copied = this.I.moveTo(oI);
        if (copied > 0)
          this.Q.moveTo(oQ);
        if (copied < oI.length) {
          const end = pos + oI.length - copied;
          oI.set(I.subarray(pos, end), copied);
          oQ.set(Q.subarray(pos, end), copied);
          pos = end;
        }
        this.pendingReads.resolve({
          I: oI,
          Q: oQ,
          frequency: this.centerFrequency
        });
      }
      if (pos < I.length) {
        this.I.store(I.subarray(pos));
        this.Q.store(Q.subarray(pos));
        return;
      }
    }
    readSamples(length) {
      if (this.I.available < length || this.pendingReads.hasPendingRead()) {
        return this.pendingReads.add(length);
      }
      let [oI, oQ] = this.outPool.get(length);
      this.I.moveTo(oI);
      this.Q.moveTo(oQ);
      return Promise.resolve({
        I: oI,
        Q: oQ,
        frequency: this.centerFrequency
      });
    }
    async close() {
      this.pendingReads.cancel();
    }
  };

  // node_modules/@jtarrio/signals/dist/sources/provider.js
  var SimpleProvider = class {
    instance;
    constructor(instance) {
      this.instance = instance;
    }
    async get() {
      return this.instance;
    }
  };

  // node_modules/@jtarrio/signals/dist/radio/single_thread.js
  var SingleThread = class {
    constructor() {
      this.promise = Promise.resolve();
    }
    promise;
    /**
     * Executes the provided async function.
     *
     * Functions passed to `run()` are executed in strict sequence: each function only starts after the previous one ends.
     *
     * Make sure your function doesn't throw, because then the behavior is undefined.
     */
    async run(fn) {
      this.promise = this.promise.then(() => fn());
      return this.promise;
    }
  };

  // node_modules/@jtarrio/signals/dist/radio/radio.js
  var RadioEvent = class extends CustomEvent {
    constructor(e) {
      super("radio", { detail: e });
    }
  };
  var State;
  (function(State2) {
    State2[State2["OFF"] = 0] = "OFF";
    State2[State2["PLAYING"] = 1] = "PLAYING";
  })(State || (State = {}));
  var Radio = class extends EventTarget {
    sourceProvider;
    sampleReceiver;
    options;
    /** @param sampleReceiver the object that will receive the radio samples. */
    constructor(sourceProvider, sampleReceiver, options) {
      super();
      this.sourceProvider = sourceProvider;
      this.sampleReceiver = sampleReceiver;
      this.options = options;
      this.sampleRate = 1024e3;
      this.state = State.OFF;
      this.frequency = 885e5;
      this.parameterValues = /* @__PURE__ */ new Map();
      this.singleThread = new SingleThread();
    }
    /** Current sample rate. */
    sampleRate;
    /** Current state. */
    state;
    /** Currently tuned frequency. */
    frequency;
    /** Current values of the properties. */
    parameterValues;
    /** Single thread to execute async functions. */
    singleThread;
    /** Handler for in-flight data transfers. */
    transfers;
    /** Current signal source. */
    source;
    /**
     * Starts playing the radio.
     *
     * @returns a promise that resolves after the command has been processed by the radio.
     */
    async start() {
      return this.singleThread.run(async () => {
        if (this.state != State.OFF)
          return;
        try {
          this.source = await this.sourceProvider.get();
          this.sampleRate = await this.source.setSampleRate(this.sampleRate);
          this.frequency = await this.source.setCenterFrequency(this.frequency);
          for (let [name, value] of this.parameterValues.entries()) {
            await this.source.setParameter(name, value);
          }
          await this.source.startReceiving();
          this.transfers = new Transfers(this.source, this.sampleReceiver, this, this.sampleRate, this.options);
          this.transfers.startStream();
          this.state = State.PLAYING;
          this.dispatchEvent(new RadioEvent({ type: "started" }));
        } catch (e) {
          this.dispatchEvent(new RadioEvent({ type: "error", exception: e }));
        }
      });
    }
    /**
     * Stops playing the radio.
     *
     * @returns a promise that resolves after the command has been processed by the radio.
     */
    async stop() {
      return this.singleThread.run(async () => {
        if (this.state != State.PLAYING)
          return;
        try {
          await this.transfers.stopStream();
          await this.source.close();
          this.state = State.OFF;
          this.dispatchEvent(new RadioEvent({ type: "stopped" }));
        } catch (e) {
          this.dispatchEvent(new RadioEvent({ type: "error", exception: e }));
        }
      });
    }
    /** Returns whether the radio is playing (or scanning). */
    isPlaying() {
      return this.state != State.OFF;
    }
    /**
     * Tunes the radio to this frequency.
     *
     * @returns a promise that resolves after the command has been processed by the radio.
     */
    async setFrequency(freq) {
      return this.singleThread.run(async () => {
        if (this.state == State.OFF) {
          this.frequency = freq;
        } else if (this.frequency != freq) {
          try {
            this.frequency = await this.source.setCenterFrequency(freq);
          } catch (e) {
            this.dispatchEvent(new RadioEvent({ type: "error", exception: e }));
          }
        }
      });
    }
    /** Returns the tuned frequency. */
    getFrequency() {
      return this.frequency;
    }
    /**
     * Changes the sample rate. This change only takes effect when the radio is started.
     *
     * @returns a promise that resolves after the command has been processed by the radio.
     */
    async setSampleRate(sampleRate) {
      this.sampleRate = sampleRate;
    }
    /** Returns the current sample rate. */
    getSampleRate() {
      return this.sampleRate;
    }
    /**
     * Sets the value of a parameter.
     *
     * @returns a promise that resolves after the command has been processed by the radio.
     */
    async setParameter(parameter, value) {
      return this.singleThread.run(async () => {
        if (this.state == State.OFF) {
          this.parameterValues.set(parameter, value);
        } else {
          try {
            this.parameterValues.set(parameter, await this.source.setParameter(parameter, value));
          } catch (e) {
            this.dispatchEvent(new RadioEvent({ type: "error", exception: e }));
          }
        }
      });
    }
    /** Returns the value of a parameter. */
    getParameter(parameter) {
      return this.parameterValues.get(parameter);
    }
    /** Override this function to do something when a sample block is received. */
    onReceiveSamples(block) {
    }
    addEventListener(type, callback, options) {
      super.addEventListener(type, callback, options);
    }
  };
  var Transfers = class _Transfers {
    source;
    sampleReceiver;
    radio;
    sampleRate;
    /** Receive this many buffers per second by default. */
    static DEFAULT_BUFS_PER_SEC = 20;
    constructor(source, sampleReceiver, radio, sampleRate, options) {
      this.source = source;
      this.sampleReceiver = sampleReceiver;
      this.radio = radio;
      this.sampleRate = sampleRate;
      let buffersPerSecond = options?.buffersPerSecond;
      if (buffersPerSecond === void 0 || buffersPerSecond <= 0)
        buffersPerSecond = _Transfers.DEFAULT_BUFS_PER_SEC;
      this.samplesPerBuf = 512 * Math.ceil(sampleRate / buffersPerSecond / 512);
      this.buffersWanted = 0;
      this.buffersRunning = 0;
      this.stopCallback = _Transfers.nilCallback;
    }
    samplesPerBuf;
    buffersWanted;
    buffersRunning;
    stopCallback;
    static PARALLEL_BUFFERS = 2;
    /** Starts the transfers as a stream. */
    async startStream() {
      this.sampleReceiver.setSampleRate(this.sampleRate);
      await this.source.startReceiving();
      this.buffersWanted = _Transfers.PARALLEL_BUFFERS;
      while (this.buffersRunning < this.buffersWanted) {
        ++this.buffersRunning;
        this.readStream();
      }
    }
    /**
     * Stops the transfer stream.
     * @returns a promise that resolves when the stream is stopped.
     */
    async stopStream() {
      if (this.buffersRunning == 0 && this.buffersWanted == 0)
        return;
      let promise = new Promise((r) => {
        this.stopCallback = r;
      });
      this.buffersWanted = 0;
      return promise;
    }
    /** Runs the transfer stream. */
    async readStream() {
      try {
        while (this.buffersRunning <= this.buffersWanted) {
          const b = await this.source.readSamples(this.samplesPerBuf);
          this.radio.onReceiveSamples(b);
          this.sampleReceiver.receiveSamples(b);
        }
      } catch (e) {
        let error = new RadioError("Sample transfer was interrupted. Did you unplug your device?", RadioErrorType.TransferError, { cause: e });
        let event = new RadioEvent({ type: "error", exception: error });
        this.radio.dispatchEvent(event);
      }
      --this.buffersRunning;
      if (this.buffersRunning == 0) {
        this.stopCallback();
        this.stopCallback = _Transfers.nilCallback;
      }
    }
    static nilCallback() {
    }
  };

  // node_modules/@jtarrio/signals/dist/demod/modes.js
  function registerDemod(name, demod, config) {
    registeredDemods.set(name, { demod, config });
  }
  function getSchemes() {
    return [...registeredDemods.keys()];
  }
  function getMode(scheme) {
    let reg = getRegisteredDemod(scheme);
    return new reg.config(scheme).mode;
  }
  function getDemod(inRate, outRate, mode, options) {
    let reg = getRegisteredDemod(mode);
    return new reg.demod(inRate, outRate, mode, options);
  }
  function modeParameters(mode) {
    let reg = getRegisteredDemod(mode);
    return new reg.config(mode);
  }
  var Configurator = class {
    base;
    constructor(base) {
      this.base = base;
    }
    get mode() {
      if (typeof this.base === "string") {
        this.base = this.create(this.base);
      }
      return this.base;
    }
    set mode(mode) {
      this.base = mode;
    }
    /** Returns whether stereo output is settable in this mode. */
    hasStereo() {
      return false;
    }
    /** Returns whether stereo output is enabled. */
    getStereo() {
      return false;
    }
    /** Enables or disables stereo output. */
    setStereo(stereo) {
      return this;
    }
    /** Returns whether the bandwidth is settable in this mode. */
    hasBandwidth() {
      return false;
    }
    /** Changes the bandwidth used by this mode. */
    setBandwidth(bandwidth) {
      return this;
    }
    /** Returns whether the squelch level is settable. */
    hasSquelch() {
      return false;
    }
    /** Returns the current squelch level. */
    getSquelch() {
      return 0;
    }
    /** Sets the squelch level. */
    setSquelch(squelch) {
      return this;
    }
  };
  var registeredDemods = /* @__PURE__ */ new Map();
  function getRegisteredDemod(mode) {
    let scheme = typeof mode === "string" ? mode : mode.scheme;
    let reg = registeredDemods.get(scheme);
    if (!reg)
      throw `Scheme "${scheme}" was not registered.`;
    return reg;
  }

  // node_modules/@jtarrio/signals/dist/players/audioplayer.js
  var AudioPlayer = class _AudioPlayer {
    static OUT_RATE = 48e3;
    constructor(options) {
      this.newAudioContext = options?.newAudioContext || (() => new AudioContext());
      this.timeBuffer = options?.timeBuffer || 0.05;
      this.pool = /* @__PURE__ */ new Map();
      this.lastPlayedAt = -1;
      this.ac = void 0;
      this.gainNode = void 0;
      this.gain = 0;
    }
    newAudioContext;
    timeBuffer;
    pool = /* @__PURE__ */ new Map();
    lastPlayedAt;
    ac;
    gainNode;
    gain;
    /**
     * Queues the given samples for playing at the appropriate time.
     * @param leftSamples The samples for the left speaker.
     * @param rightSamples The samples for the right speaker.
     */
    play(leftSamples, rightSamples) {
      if (this.ac === void 0 || this.gainNode === void 0) {
        this.ac = this.newAudioContext();
        this.gainNode = this.ac.createGain();
        this.gainNode.gain.value = this.gain;
        this.gainNode.connect(this.ac.destination);
      }
      let now = this.ac.currentTime;
      let next = this.lastPlayedAt + leftSamples.length / _AudioPlayer.OUT_RATE;
      this.lastPlayedAt = next > now ? next : now + this.timeBuffer;
      const buffer = this.getBuffer(leftSamples.length);
      buffer.copyToChannel(leftSamples, 0);
      buffer.copyToChannel(rightSamples, 1);
      let source = new AudioBufferSourceNode(this.ac, { buffer });
      source.connect(this.gainNode);
      source.onended = () => this.returnBuffer(buffer);
      source.start(this.lastPlayedAt);
    }
    /**
     * Sets the volume for playing samples.
     * @param volume The volume to set, between 0 and 1.
     */
    setVolume(volume) {
      this.gain = volume;
      if (this.gainNode !== void 0) {
        this.gainNode.gain.value = volume;
      }
    }
    getVolume() {
      return this.gain;
    }
    get sampleRate() {
      if (this.ac)
        return this.ac.sampleRate;
      return 48e3;
    }
    getBuffer(length) {
      let items = this.pool.get(length);
      if (items && items.length > 0) {
        return items.pop();
      }
      return new AudioBuffer({
        sampleRate: _AudioPlayer.OUT_RATE,
        numberOfChannels: 2,
        length
      });
    }
    returnBuffer(buffer) {
      let items = this.pool.get(buffer.length);
      if (!items) {
        items = [];
        this.pool.set(buffer.length, items);
      }
      items.push(buffer);
    }
  };

  // node_modules/@jtarrio/signals/dist/demod/empty-demodulator.js
  var Demodulator = class extends EventTarget {
    /**
     * @param options Options for the demodulator.
     */
    constructor(options) {
      super();
      this.inRate = 1024e3;
      this.player = options?.player || new AudioPlayer();
      this.squelchControl = new SquelchControl(this.player.sampleRate);
      this.modeOptions = options?.modeOptions || {};
      this.mode = getMode("WBFM");
      this.demod = this.getScheme(this.mode);
      this.frequencyOffset = 0;
      this.latestStereo = false;
    }
    /** The sample rate. */
    inRate;
    /** The audio output device. */
    player;
    /** Controller that silences the output if the SNR is low. */
    squelchControl;
    /** Options for the different modes. */
    modeOptions;
    /** The modulation parameters as a Mode object. */
    mode;
    /** The demodulator class. */
    demod;
    /** The frequency offset to demodulate from. */
    frequencyOffset;
    /** Whether the latest samples were in stereo. */
    latestStereo;
    /** A frequency change we are expecting. */
    expectingFrequency;
    /** Changes the modulation parameters. */
    setMode(mode) {
      this.demod = this.getScheme(mode, this.demod);
      this.mode = mode;
    }
    /** Returns the current modulation parameters. */
    getMode() {
      return this.mode;
    }
    /** Changes the frequency offset. */
    setFrequencyOffset(offset) {
      this.frequencyOffset = offset;
    }
    /** Returns the current frequency offset. */
    getFrequencyOffset() {
      return this.frequencyOffset;
    }
    /** Waits until samples arrive with the given center frequency and then sets the offset. */
    expectFrequencyAndSetOffset(center, offset) {
      this.expectingFrequency = { center, offset };
    }
    /** Sets the audio volume level, from 0 to 1. */
    setVolume(volume) {
      this.player.setVolume(volume);
    }
    /** Returns the current audio volume level. */
    getVolume() {
      return this.player.getVolume();
    }
    /** Returns an appropriate instance of Scheme for the requested mode. */
    getScheme(mode, demod) {
      if (mode.scheme == demod?.getMode().scheme) {
        demod.setMode(mode);
        return demod;
      }
      return getDemod(this.inRate, this.player.sampleRate, mode, this.modeOptions[mode.scheme]);
    }
    /** Changes the sample rate. */
    setSampleRate(sampleRate) {
      this.inRate = sampleRate;
      this.demod = this.getScheme(this.mode, void 0);
    }
    /** Receives radio samples. */
    receiveSamples(block) {
      if (this.expectingFrequency?.center === block.frequency) {
        this.frequencyOffset = this.expectingFrequency.offset;
        this.expectingFrequency = void 0;
      }
      let { left, right, stereo, snr } = this.demod.demodulate(block.I, block.Q, this.frequencyOffset);
      this.squelchControl.applySquelch(this.mode, left, right, snr);
      this.player.play(left, right);
      if (stereo != this.latestStereo) {
        this.dispatchEvent(new StereoStatusEvent(stereo));
        this.latestStereo = stereo;
      }
    }
    addEventListener(type, callback, options) {
      super.addEventListener(type, callback, options);
    }
  };
  var StereoStatusEvent = class extends CustomEvent {
    constructor(stereo) {
      super("stereo-status", { detail: stereo, bubbles: true, composed: true });
    }
  };
  var SquelchControl = class {
    sampleRate;
    constructor(sampleRate) {
      this.sampleRate = sampleRate;
    }
    countdown = 0;
    applySquelch(mode, left, right, snr) {
      const SQUELCH_TAIL = 0.1;
      let params = modeParameters(mode);
      if (!params.hasSquelch())
        return;
      if (params.getSquelch() < snr) {
        this.countdown = SQUELCH_TAIL * this.sampleRate;
        return;
      }
      if (this.countdown > 0) {
        this.countdown -= left.length;
        return;
      }
      left.fill(0);
      right.fill(0);
    }
  };

  // node_modules/@jtarrio/signals/dist/dsp/coefficients.js
  function makeLowPassKernel(sampleRate, cornerFreq, length, gain) {
    if (gain === void 0)
      gain = 1;
    length += (length + 1) % 2;
    const freq = cornerFreq / sampleRate;
    let coefs = new Float32Array(length);
    const center = Math.floor(length / 2);
    let sum = 0;
    for (let i = 0; i < length; ++i) {
      let val;
      if (i == center) {
        val = 2 * Math.PI * freq;
      } else {
        val = Math.sin(2 * Math.PI * freq * (i - center)) / (i - center);
        val *= 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (length - 1));
      }
      sum += val;
      coefs[i] = val;
    }
    sum /= gain;
    for (let i = 0; i < length; ++i) {
      coefs[i] /= sum;
    }
    return coefs;
  }
  function makeHilbertKernel(length) {
    length += (length + 1) % 2;
    const center = Math.floor(length / 2);
    let out = new Float32Array(length);
    for (let i = 0; i < out.length; ++i) {
      if ((center - i) % 2 != 0) {
        out[i] = 2 / (Math.PI * (center - i));
      }
    }
    return out;
  }

  // node_modules/@jtarrio/signals/dist/wasm/wasm-bytes.js
  var CONVOLVER = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 19, 3, 96, 1, 127, 1, 127, 96, 3, 127, 127, 127, 1, 127, 96, 2, 127, 127, 1, 127, 3, 7, 6, 2, 0, 0, 1, 0, 1, 5, 3, 1, 0, 0, 6, 26, 5, 127, 1, 65, 0, 11, 127, 1, 65, 0, 11, 127, 1, 65, 0, 11, 127, 1, 65, 0, 11, 127, 1, 65, 0, 11, 7, 113, 7, 8, 99, 111, 101, 102, 115, 80, 116, 114, 0, 0, 7, 100, 97, 116, 97, 80, 116, 114, 0, 1, 8, 99, 111, 110, 118, 111, 108, 118, 101, 0, 2, 18, 99, 111, 110, 118, 111, 108, 118, 101, 87, 105, 116, 104, 83, 116, 114, 105, 100, 101, 0, 3, 17, 99, 111, 110, 118, 111, 108, 118, 101, 69, 120, 112, 97, 110, 100, 105, 110, 103, 0, 4, 27, 99, 111, 110, 118, 111, 108, 118, 101, 69, 120, 112, 97, 110, 100, 105, 110, 103, 87, 105, 116, 104, 83, 116, 114, 105, 100, 101, 0, 5, 6, 109, 101, 109, 111, 114, 121, 2, 0, 10, 241, 12, 6, 88, 0, 32, 0, 36, 0, 35, 0, 65, 3, 107, 65, 0, 35, 0, 65, 4, 79, 27, 36, 1, 32, 1, 36, 2, 2, 127, 35, 0, 35, 2, 108, 65, 2, 116, 35, 3, 65, 2, 116, 106, 35, 4, 65, 2, 116, 106, 65, 255, 135, 6, 106, 65, 16, 118, 34, 0, 63, 0, 74, 4, 64, 32, 0, 63, 0, 107, 64, 0, 12, 1, 11, 65, 0, 11, 65, 0, 72, 4, 64, 65, 127, 15, 11, 65, 128, 136, 2, 11, 78, 0, 32, 0, 36, 3, 2, 127, 35, 0, 35, 2, 108, 65, 2, 116, 35, 3, 65, 2, 116, 106, 35, 4, 65, 2, 116, 106, 65, 255, 135, 6, 106, 65, 16, 118, 34, 0, 63, 0, 74, 4, 64, 32, 0, 63, 0, 107, 64, 0, 12, 1, 11, 65, 0, 11, 65, 0, 72, 4, 64, 65, 127, 15, 11, 35, 0, 35, 2, 108, 65, 2, 116, 65, 128, 136, 2, 106, 11, 211, 2, 3, 7, 127, 1, 123, 1, 125, 2, 127, 32, 0, 36, 4, 65, 127, 2, 127, 35, 0, 35, 2, 108, 65, 2, 116, 35, 3, 65, 2, 116, 106, 35, 4, 65, 2, 116, 106, 65, 255, 135, 6, 106, 65, 16, 118, 34, 1, 63, 0, 74, 4, 64, 32, 1, 63, 0, 107, 64, 0, 12, 1, 11, 65, 0, 11, 65, 0, 72, 13, 0, 26, 35, 0, 35, 2, 108, 65, 2, 116, 65, 128, 136, 2, 106, 35, 3, 65, 2, 116, 106, 11, 34, 4, 65, 0, 72, 4, 64, 65, 127, 15, 11, 35, 0, 35, 2, 108, 65, 2, 116, 65, 128, 136, 2, 106, 33, 3, 32, 4, 33, 2, 3, 64, 32, 0, 32, 7, 75, 4, 64, 65, 128, 136, 2, 33, 5, 32, 3, 33, 1, 65, 0, 33, 6, 35, 1, 4, 125, 253, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 33, 8, 3, 64, 32, 5, 253, 0, 4, 0, 32, 1, 253, 0, 4, 0, 32, 8, 253, 133, 2, 33, 8, 32, 5, 65, 16, 106, 33, 5, 32, 1, 65, 16, 106, 33, 1, 32, 6, 65, 4, 106, 34, 6, 35, 1, 73, 13, 0, 11, 32, 8, 253, 31, 0, 32, 8, 253, 31, 1, 146, 32, 8, 253, 31, 2, 146, 32, 8, 253, 31, 3, 146, 67, 0, 0, 0, 0, 146, 5, 67, 0, 0, 0, 0, 11, 33, 9, 3, 64, 32, 6, 35, 0, 73, 4, 64, 32, 9, 32, 5, 42, 2, 0, 32, 1, 42, 2, 0, 148, 146, 33, 9, 32, 5, 65, 4, 106, 33, 5, 32, 1, 65, 4, 106, 33, 1, 32, 6, 65, 1, 106, 33, 6, 12, 1, 11, 11, 32, 2, 32, 9, 56, 2, 0, 32, 2, 65, 4, 106, 33, 2, 32, 3, 65, 4, 106, 33, 3, 32, 7, 65, 1, 106, 33, 7, 12, 1, 11, 11, 32, 4, 11, 220, 2, 3, 6, 127, 1, 123, 1, 125, 2, 127, 32, 0, 36, 4, 65, 127, 2, 127, 35, 0, 35, 2, 108, 65, 2, 116, 35, 3, 65, 2, 116, 106, 35, 4, 65, 2, 116, 106, 65, 255, 135, 6, 106, 65, 16, 118, 34, 3, 63, 0, 74, 4, 64, 32, 3, 63, 0, 107, 64, 0, 12, 1, 11, 65, 0, 11, 65, 0, 72, 13, 0, 26, 35, 0, 35, 2, 108, 65, 2, 116, 65, 128, 136, 2, 106, 35, 3, 65, 2, 116, 106, 11, 34, 5, 65, 0, 72, 4, 64, 65, 127, 15, 11, 35, 0, 35, 2, 108, 65, 2, 116, 65, 128, 136, 2, 106, 32, 2, 65, 2, 116, 106, 33, 4, 32, 5, 33, 2, 3, 64, 32, 0, 32, 8, 75, 4, 64, 65, 128, 136, 2, 33, 6, 32, 4, 33, 3, 65, 0, 33, 7, 35, 1, 4, 125, 253, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 33, 9, 3, 64, 32, 6, 253, 0, 4, 0, 32, 3, 253, 0, 4, 0, 32, 9, 253, 133, 2, 33, 9, 32, 6, 65, 16, 106, 33, 6, 32, 3, 65, 16, 106, 33, 3, 32, 7, 65, 4, 106, 34, 7, 35, 1, 73, 13, 0, 11, 32, 9, 253, 31, 0, 32, 9, 253, 31, 1, 146, 32, 9, 253, 31, 2, 146, 32, 9, 253, 31, 3, 146, 67, 0, 0, 0, 0, 146, 5, 67, 0, 0, 0, 0, 11, 33, 10, 3, 64, 32, 7, 35, 0, 73, 4, 64, 32, 10, 32, 6, 42, 2, 0, 32, 3, 42, 2, 0, 148, 146, 33, 10, 32, 6, 65, 4, 106, 33, 6, 32, 3, 65, 4, 106, 33, 3, 32, 7, 65, 1, 106, 33, 7, 12, 1, 11, 11, 32, 2, 32, 10, 56, 2, 0, 32, 2, 65, 4, 106, 33, 2, 32, 4, 32, 1, 65, 2, 116, 106, 33, 4, 32, 8, 65, 1, 106, 33, 8, 12, 1, 11, 11, 32, 5, 11, 252, 2, 3, 9, 127, 1, 123, 1, 125, 2, 127, 32, 0, 35, 2, 108, 36, 4, 65, 127, 2, 127, 35, 0, 35, 2, 108, 65, 2, 116, 35, 3, 65, 2, 116, 106, 35, 4, 65, 2, 116, 106, 65, 255, 135, 6, 106, 65, 16, 118, 34, 1, 63, 0, 74, 4, 64, 32, 1, 63, 0, 107, 64, 0, 12, 1, 11, 65, 0, 11, 65, 0, 72, 13, 0, 26, 35, 0, 35, 2, 108, 65, 2, 116, 65, 128, 136, 2, 106, 35, 3, 65, 2, 116, 106, 11, 34, 5, 65, 0, 72, 4, 64, 65, 127, 15, 11, 35, 0, 35, 2, 108, 65, 2, 116, 65, 128, 136, 2, 106, 33, 3, 32, 5, 33, 1, 3, 64, 32, 0, 32, 9, 75, 4, 64, 32, 1, 33, 4, 65, 128, 136, 2, 33, 6, 65, 0, 33, 8, 3, 64, 32, 8, 35, 2, 73, 4, 64, 32, 3, 33, 2, 65, 0, 33, 7, 35, 1, 4, 125, 253, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 33, 10, 3, 64, 32, 6, 253, 0, 4, 0, 32, 2, 253, 0, 4, 0, 32, 10, 253, 133, 2, 33, 10, 32, 6, 65, 16, 106, 33, 6, 32, 2, 65, 16, 106, 33, 2, 32, 7, 65, 4, 106, 34, 7, 35, 1, 73, 13, 0, 11, 32, 10, 253, 31, 0, 32, 10, 253, 31, 1, 146, 32, 10, 253, 31, 2, 146, 32, 10, 253, 31, 3, 146, 67, 0, 0, 0, 0, 146, 5, 67, 0, 0, 0, 0, 11, 33, 11, 3, 64, 32, 7, 35, 0, 73, 4, 64, 32, 11, 32, 6, 42, 2, 0, 32, 2, 42, 2, 0, 148, 146, 33, 11, 32, 6, 65, 4, 106, 33, 6, 32, 2, 65, 4, 106, 33, 2, 32, 7, 65, 1, 106, 33, 7, 12, 1, 11, 11, 32, 4, 32, 11, 56, 2, 0, 32, 4, 65, 4, 106, 33, 4, 32, 8, 65, 1, 106, 33, 8, 12, 1, 11, 11, 32, 1, 35, 2, 65, 2, 116, 106, 33, 1, 32, 3, 65, 4, 106, 33, 3, 32, 9, 65, 1, 106, 33, 9, 12, 1, 11, 11, 32, 5, 11, 149, 3, 3, 7, 127, 1, 125, 1, 123, 2, 127, 32, 0, 35, 2, 108, 36, 4, 65, 127, 2, 127, 35, 0, 35, 2, 108, 65, 2, 116, 35, 3, 65, 2, 116, 106, 35, 4, 65, 2, 116, 106, 65, 255, 135, 6, 106, 65, 16, 118, 34, 3, 63, 0, 74, 4, 64, 32, 3, 63, 0, 107, 64, 0, 12, 1, 11, 65, 0, 11, 65, 0, 72, 13, 0, 26, 35, 0, 35, 2, 108, 65, 2, 116, 65, 128, 136, 2, 106, 35, 3, 65, 2, 116, 106, 11, 34, 6, 65, 0, 72, 4, 64, 65, 127, 15, 11, 35, 0, 35, 2, 108, 65, 2, 116, 65, 128, 136, 2, 106, 33, 4, 32, 6, 33, 3, 3, 64, 32, 2, 35, 2, 79, 4, 64, 32, 2, 35, 2, 107, 33, 2, 32, 4, 65, 4, 106, 33, 4, 12, 1, 11, 11, 3, 64, 32, 0, 32, 7, 75, 4, 64, 35, 0, 32, 2, 108, 65, 2, 116, 65, 128, 136, 2, 106, 33, 9, 32, 4, 33, 5, 65, 0, 33, 8, 35, 1, 4, 125, 253, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 33, 11, 3, 64, 32, 9, 253, 0, 4, 0, 32, 5, 253, 0, 4, 0, 32, 11, 253, 133, 2, 33, 11, 32, 9, 65, 16, 106, 33, 9, 32, 5, 65, 16, 106, 33, 5, 32, 8, 65, 4, 106, 34, 8, 35, 1, 73, 13, 0, 11, 32, 11, 253, 31, 0, 32, 11, 253, 31, 1, 146, 32, 11, 253, 31, 2, 146, 32, 11, 253, 31, 3, 146, 67, 0, 0, 0, 0, 146, 5, 67, 0, 0, 0, 0, 11, 33, 10, 3, 64, 32, 8, 35, 0, 73, 4, 64, 32, 10, 32, 9, 42, 2, 0, 32, 5, 42, 2, 0, 148, 146, 33, 10, 32, 9, 65, 4, 106, 33, 9, 32, 5, 65, 4, 106, 33, 5, 32, 8, 65, 1, 106, 33, 8, 12, 1, 11, 11, 32, 3, 32, 10, 56, 2, 0, 32, 3, 65, 4, 106, 33, 3, 32, 1, 32, 2, 106, 33, 2, 3, 64, 32, 2, 35, 2, 79, 4, 64, 32, 2, 35, 2, 107, 33, 2, 32, 4, 65, 4, 106, 33, 4, 12, 1, 11, 11, 32, 7, 65, 1, 106, 33, 7, 12, 1, 11, 11, 32, 6, 11]);
  var FFT = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 17, 4, 96, 0, 1, 127, 96, 0, 0, 96, 1, 127, 1, 127, 96, 1, 127, 0, 3, 11, 10, 0, 2, 0, 0, 0, 0, 0, 3, 1, 1, 5, 3, 1, 0, 0, 6, 16, 3, 127, 1, 65, 0, 11, 127, 1, 65, 0, 11, 127, 1, 65, 0, 11, 7, 155, 1, 11, 12, 103, 101, 116, 70, 102, 116, 76, 101, 110, 103, 116, 104, 0, 0, 8, 99, 111, 101, 102, 115, 80, 116, 114, 0, 1, 11, 114, 101, 97, 108, 68, 97, 116, 97, 80, 116, 114, 0, 2, 11, 105, 109, 97, 103, 68, 97, 116, 97, 80, 116, 114, 0, 3, 12, 101, 120, 112, 110, 67, 111, 101, 102, 115, 80, 116, 114, 0, 4, 15, 101, 120, 112, 110, 82, 101, 97, 108, 68, 97, 116, 97, 80, 116, 114, 0, 5, 15, 101, 120, 112, 110, 73, 109, 97, 103, 68, 97, 116, 97, 80, 116, 114, 0, 6, 3, 102, 102, 116, 0, 7, 13, 101, 120, 112, 97, 110, 100, 82, 101, 97, 108, 70, 102, 116, 0, 8, 15, 99, 111, 108, 108, 97, 112, 115, 101, 82, 101, 97, 108, 70, 102, 116, 0, 9, 6, 109, 101, 109, 111, 114, 121, 2, 0, 10, 171, 13, 10, 4, 0, 35, 0, 11, 94, 0, 32, 0, 36, 1, 32, 0, 65, 1, 118, 65, 4, 106, 36, 0, 2, 127, 35, 0, 65, 3, 116, 65, 0, 35, 2, 27, 34, 0, 32, 0, 32, 0, 35, 0, 65, 2, 116, 34, 0, 35, 1, 65, 2, 116, 32, 0, 106, 106, 106, 106, 106, 65, 255, 135, 6, 106, 65, 16, 118, 34, 0, 63, 0, 74, 4, 64, 32, 0, 63, 0, 107, 64, 0, 12, 1, 11, 65, 0, 11, 65, 0, 72, 4, 64, 65, 127, 15, 11, 65, 128, 136, 2, 11, 12, 0, 35, 1, 65, 2, 116, 65, 128, 136, 2, 106, 11, 18, 0, 35, 1, 65, 2, 116, 65, 128, 136, 2, 106, 35, 0, 65, 2, 116, 106, 11, 98, 1, 1, 127, 65, 1, 36, 2, 2, 127, 35, 0, 65, 2, 116, 34, 0, 35, 1, 65, 2, 116, 106, 32, 0, 106, 35, 0, 65, 3, 116, 34, 0, 106, 32, 0, 106, 32, 0, 106, 65, 255, 135, 6, 106, 65, 16, 118, 34, 0, 63, 0, 74, 4, 64, 32, 0, 63, 0, 107, 64, 0, 12, 1, 11, 65, 0, 11, 65, 0, 72, 4, 64, 65, 127, 15, 11, 35, 0, 65, 2, 116, 34, 0, 35, 1, 65, 2, 116, 65, 128, 136, 2, 106, 106, 32, 0, 106, 11, 36, 1, 1, 127, 35, 0, 65, 2, 116, 34, 0, 35, 1, 65, 2, 116, 65, 128, 136, 2, 106, 32, 0, 106, 106, 35, 0, 65, 3, 116, 65, 0, 35, 2, 27, 106, 11, 41, 1, 1, 127, 35, 0, 65, 3, 116, 65, 0, 35, 2, 27, 34, 0, 32, 0, 35, 0, 65, 2, 116, 34, 0, 35, 1, 65, 2, 116, 65, 128, 136, 2, 106, 32, 0, 106, 106, 106, 106, 11, 253, 4, 3, 13, 127, 8, 123, 10, 125, 67, 0, 0, 128, 191, 67, 0, 0, 128, 63, 32, 0, 27, 34, 29, 253, 19, 33, 20, 35, 1, 65, 2, 116, 65, 128, 136, 2, 106, 34, 12, 35, 0, 65, 2, 116, 106, 33, 9, 65, 0, 33, 0, 3, 64, 32, 0, 35, 0, 73, 4, 64, 32, 12, 32, 0, 65, 1, 106, 65, 2, 116, 34, 8, 106, 42, 2, 0, 33, 23, 32, 12, 32, 0, 65, 2, 106, 65, 2, 116, 34, 7, 106, 42, 2, 0, 33, 28, 32, 12, 32, 0, 65, 3, 106, 65, 2, 116, 34, 6, 106, 42, 2, 0, 33, 26, 32, 0, 65, 2, 116, 34, 1, 32, 9, 106, 34, 5, 42, 2, 0, 33, 27, 32, 8, 32, 9, 106, 34, 4, 42, 2, 0, 33, 25, 32, 7, 32, 9, 106, 34, 3, 42, 2, 0, 33, 31, 32, 6, 32, 9, 106, 34, 2, 42, 2, 0, 33, 30, 32, 1, 32, 12, 106, 34, 1, 42, 2, 0, 33, 22, 32, 1, 32, 22, 32, 23, 146, 34, 24, 32, 28, 146, 32, 26, 146, 56, 2, 0, 32, 8, 32, 12, 106, 32, 22, 32, 23, 147, 34, 23, 32, 29, 32, 30, 32, 31, 147, 148, 34, 22, 147, 56, 2, 0, 32, 7, 32, 12, 106, 32, 24, 32, 28, 147, 32, 26, 147, 56, 2, 0, 32, 6, 32, 12, 106, 32, 23, 32, 22, 146, 56, 2, 0, 32, 5, 32, 27, 32, 25, 146, 34, 24, 32, 31, 146, 32, 30, 146, 56, 2, 0, 32, 4, 32, 27, 32, 25, 147, 34, 23, 32, 29, 32, 28, 32, 26, 147, 148, 34, 22, 147, 56, 2, 0, 32, 3, 32, 24, 32, 31, 147, 32, 30, 147, 56, 2, 0, 32, 2, 32, 23, 32, 22, 146, 56, 2, 0, 32, 0, 65, 4, 106, 33, 0, 12, 1, 11, 11, 65, 8, 33, 13, 3, 64, 32, 13, 35, 0, 77, 4, 64, 32, 13, 65, 2, 116, 65, 224, 135, 2, 106, 34, 2, 32, 13, 65, 1, 118, 34, 6, 65, 2, 116, 106, 33, 1, 65, 0, 33, 8, 3, 64, 32, 8, 35, 0, 73, 4, 64, 32, 2, 33, 0, 32, 1, 33, 3, 32, 8, 65, 2, 116, 34, 5, 32, 12, 106, 34, 10, 32, 6, 65, 2, 116, 34, 4, 106, 33, 7, 32, 4, 32, 5, 32, 9, 106, 34, 11, 106, 33, 5, 65, 0, 33, 4, 3, 64, 32, 4, 32, 6, 73, 4, 64, 32, 11, 253, 0, 4, 0, 33, 21, 32, 10, 32, 10, 253, 0, 4, 0, 34, 15, 32, 0, 253, 0, 4, 0, 34, 14, 32, 7, 253, 0, 4, 0, 34, 19, 253, 230, 1, 32, 3, 253, 0, 4, 0, 32, 20, 253, 230, 1, 34, 18, 32, 5, 253, 0, 4, 0, 34, 17, 253, 230, 1, 253, 229, 1, 34, 16, 253, 228, 1, 253, 11, 4, 0, 32, 7, 32, 15, 32, 16, 253, 229, 1, 253, 11, 4, 0, 32, 11, 32, 21, 32, 14, 32, 17, 253, 230, 1, 32, 18, 32, 19, 253, 230, 1, 253, 228, 1, 34, 14, 253, 228, 1, 253, 11, 4, 0, 32, 5, 32, 21, 32, 14, 253, 229, 1, 253, 11, 4, 0, 32, 0, 65, 16, 106, 33, 0, 32, 3, 65, 16, 106, 33, 3, 32, 10, 65, 16, 106, 33, 10, 32, 11, 65, 16, 106, 33, 11, 32, 7, 65, 16, 106, 33, 7, 32, 5, 65, 16, 106, 33, 5, 32, 4, 65, 4, 106, 33, 4, 12, 1, 11, 11, 32, 8, 32, 13, 106, 33, 8, 12, 1, 11, 11, 32, 13, 65, 1, 116, 33, 13, 12, 1, 11, 11, 11, 175, 3, 2, 7, 125, 13, 127, 35, 0, 65, 2, 116, 34, 8, 35, 1, 65, 2, 116, 65, 128, 136, 2, 106, 34, 9, 106, 33, 11, 32, 9, 35, 0, 34, 14, 65, 1, 107, 65, 2, 116, 34, 7, 106, 33, 17, 32, 7, 32, 11, 106, 33, 16, 35, 0, 65, 1, 116, 65, 1, 107, 65, 2, 116, 34, 7, 32, 8, 32, 11, 106, 34, 10, 35, 0, 65, 3, 116, 65, 0, 35, 2, 27, 34, 12, 106, 34, 13, 106, 33, 15, 32, 7, 32, 12, 32, 13, 106, 34, 19, 106, 33, 18, 32, 13, 32, 9, 42, 2, 0, 34, 0, 32, 11, 42, 2, 0, 34, 1, 146, 67, 0, 0, 0, 63, 148, 56, 2, 0, 32, 19, 67, 0, 0, 0, 0, 56, 2, 0, 32, 14, 65, 2, 116, 34, 7, 32, 13, 106, 32, 0, 32, 1, 147, 67, 0, 0, 0, 63, 148, 56, 2, 0, 32, 7, 32, 19, 106, 67, 0, 0, 0, 0, 56, 2, 0, 32, 10, 65, 4, 106, 33, 7, 32, 8, 32, 10, 106, 65, 4, 106, 33, 10, 32, 9, 65, 4, 106, 33, 12, 32, 11, 65, 4, 106, 33, 11, 32, 13, 65, 4, 106, 33, 13, 32, 19, 65, 4, 106, 33, 9, 65, 1, 33, 8, 3, 64, 32, 8, 32, 14, 73, 4, 64, 32, 12, 42, 2, 0, 34, 0, 32, 17, 42, 2, 0, 34, 1, 147, 33, 4, 32, 13, 32, 0, 32, 1, 146, 32, 7, 42, 2, 0, 34, 5, 32, 11, 42, 2, 0, 34, 3, 32, 16, 42, 2, 0, 34, 2, 146, 34, 1, 148, 146, 32, 10, 42, 2, 0, 34, 0, 32, 4, 148, 146, 67, 0, 0, 128, 62, 148, 34, 6, 56, 2, 0, 32, 9, 32, 3, 32, 2, 147, 32, 5, 32, 4, 148, 147, 32, 0, 32, 1, 148, 146, 67, 0, 0, 128, 62, 148, 34, 0, 56, 2, 0, 32, 15, 32, 6, 56, 2, 0, 32, 18, 32, 0, 140, 56, 2, 0, 32, 7, 65, 4, 106, 33, 7, 32, 10, 65, 4, 106, 33, 10, 32, 12, 65, 4, 106, 33, 12, 32, 11, 65, 4, 106, 33, 11, 32, 17, 65, 4, 107, 33, 17, 32, 16, 65, 4, 107, 33, 16, 32, 13, 65, 4, 106, 33, 13, 32, 9, 65, 4, 106, 33, 9, 32, 15, 65, 4, 107, 33, 15, 32, 18, 65, 4, 107, 33, 18, 32, 8, 65, 1, 106, 33, 8, 12, 1, 11, 11, 11, 194, 2, 2, 6, 125, 10, 127, 35, 0, 34, 13, 65, 1, 107, 65, 2, 116, 34, 11, 35, 1, 65, 2, 116, 65, 128, 136, 2, 106, 34, 10, 35, 0, 65, 2, 116, 34, 9, 106, 34, 8, 32, 9, 106, 34, 7, 35, 0, 65, 3, 116, 65, 0, 35, 2, 27, 34, 6, 106, 34, 12, 106, 33, 14, 32, 6, 32, 12, 106, 34, 6, 32, 11, 106, 33, 11, 32, 10, 32, 12, 42, 2, 0, 34, 1, 32, 12, 32, 13, 65, 2, 116, 106, 42, 2, 0, 34, 0, 146, 56, 2, 0, 32, 8, 32, 1, 32, 0, 147, 56, 2, 0, 32, 7, 65, 4, 106, 33, 15, 32, 7, 32, 9, 106, 65, 4, 106, 33, 9, 32, 12, 65, 4, 106, 33, 12, 32, 6, 65, 4, 106, 33, 7, 32, 10, 65, 4, 106, 33, 10, 32, 8, 65, 4, 106, 33, 8, 65, 1, 33, 6, 3, 64, 32, 6, 32, 13, 73, 4, 64, 32, 12, 42, 2, 0, 34, 1, 32, 14, 42, 2, 0, 34, 0, 147, 33, 2, 32, 10, 32, 1, 32, 0, 146, 32, 15, 42, 2, 0, 34, 4, 32, 7, 42, 2, 0, 34, 3, 32, 11, 42, 2, 0, 34, 1, 146, 34, 0, 148, 147, 32, 9, 42, 2, 0, 34, 5, 32, 2, 148, 146, 56, 2, 0, 32, 8, 32, 3, 32, 1, 147, 32, 4, 32, 2, 148, 146, 32, 5, 32, 0, 148, 146, 56, 2, 0, 32, 15, 65, 4, 106, 33, 15, 32, 9, 65, 4, 106, 33, 9, 32, 12, 65, 4, 106, 33, 12, 32, 7, 65, 4, 106, 33, 7, 32, 14, 65, 4, 107, 33, 14, 32, 11, 65, 4, 107, 33, 11, 32, 10, 65, 4, 106, 33, 10, 32, 8, 65, 4, 106, 33, 8, 32, 6, 65, 1, 106, 33, 6, 12, 1, 11, 11, 11]);

  // node_modules/@jtarrio/signals/dist/wasm/convolver.js
  var convolverModule = new WebAssembly.Module(CONVOLVER);
  function checkPtr(ptr) {
    if (ptr < 0)
      throw "could not reserve memory";
    return ptr;
  }
  var Convolver = class {
    wasm;
    constructor(wasm) {
      this.wasm = wasm;
    }
    setCoefs(coefs) {
      const ptr = checkPtr(this.wasm.coefsPtr(coefs.length, 1));
      new Float32Array(this.wasm.memory.buffer, ptr, coefs.length).set(coefs);
    }
    setCoefArray(coefs) {
      const groupLen = coefs.map((e) => e.length).reduce((a, b) => Math.min(a, b));
      const groups = coefs.length;
      const ptr = checkPtr(this.wasm.coefsPtr(groupLen, groups));
      let arr = new Float32Array(this.wasm.memory.buffer, ptr, groups * groupLen);
      for (let i = 0; i < groups; i++) {
        arr.set(coefs[i].subarray(0, groupLen), i * groupLen);
      }
    }
    convolve(data, num) {
      const ptr = checkPtr(this.wasm.dataPtr(data.length));
      new Float32Array(this.wasm.memory.buffer, ptr, data.length).set(data);
      const outPtr = checkPtr(this.wasm.convolve(num));
      return new Float32Array(this.wasm.memory.buffer, outPtr, num);
    }
    convolveWithStride(data, num, stride, offset) {
      const ptr = checkPtr(this.wasm.dataPtr(data.length));
      new Float32Array(this.wasm.memory.buffer, ptr, data.length).set(data);
      const outPtr = checkPtr(this.wasm.convolveWithStride(num, stride, offset));
      return new Float32Array(this.wasm.memory.buffer, outPtr, num);
    }
    convolveExpanding(data, num, ratio) {
      const ptr = checkPtr(this.wasm.dataPtr(data.length));
      new Float32Array(this.wasm.memory.buffer, ptr, data.length).set(data);
      const outPtr = checkPtr(this.wasm.convolveExpanding(num));
      return new Float32Array(this.wasm.memory.buffer, outPtr, num * ratio);
    }
    convolveExpandingWithStride(data, num, stride, offset) {
      const ptr = checkPtr(this.wasm.dataPtr(data.length));
      new Float32Array(this.wasm.memory.buffer, ptr, data.length).set(data);
      const outPtr = checkPtr(this.wasm.convolveExpandingWithStride(num, stride, offset));
      return new Float32Array(this.wasm.memory.buffer, outPtr, num);
    }
  };
  function getConvolver() {
    return new Convolver(new WebAssembly.Instance(convolverModule).exports);
  }

  // node_modules/@jtarrio/signals/dist/wasm/fft.js
  var fftModule = new WebAssembly.Module(FFT);
  function checkPtr2(ptr) {
    if (ptr < 0)
      throw "could not reserve memory";
    return ptr;
  }
  var WasmFft = class {
    wasm;
    constructor(wasm) {
      this.wasm = wasm;
    }
    setCoefs(coefs) {
      const ptr = checkPtr2(this.wasm.coefsPtr(coefs.length));
      this.setArray(ptr, coefs.length, coefs);
    }
    setExpnCoefs(coefs) {
      const ptr = checkPtr2(this.wasm.expnCoefsPtr());
      this.setArray(ptr, coefs.length, coefs);
    }
    fft(real, imag, reverse) {
      const len = this.wasm.getFftLength();
      let r = this.setArray(this.wasm.realDataPtr(), len, real);
      let i = this.setArray(this.wasm.imagDataPtr(), len, imag);
      this.wasm.fft(reverse);
      return [r, i];
    }
    realFftPost() {
      let len = this.wasm.getFftLength();
      this.wasm.expandRealFft();
      let r = this.getArray(this.wasm.expnRealDataPtr(), len * 2);
      let i = this.getArray(this.wasm.expnImagDataPtr(), len * 2);
      return [r, i];
    }
    reverseRealFftPre(real, imag) {
      let len = this.wasm.getFftLength();
      this.setArray(this.wasm.expnRealDataPtr(), 2 * len, real);
      this.setArray(this.wasm.expnImagDataPtr(), 2 * len, imag);
      this.wasm.collapseRealFft();
      let e = this.getArray(this.wasm.realDataPtr(), len);
      let o = this.getArray(this.wasm.imagDataPtr(), len);
      return [e, o];
    }
    getArray(ptr, size) {
      return new Float32Array(this.wasm.memory.buffer, ptr, size);
    }
    setArray(ptr, size, value) {
      let a = this.getArray(ptr, size);
      if (value.length > size) {
        a.set(value.subarray(0, size));
        return a;
      }
      if (value.length < size)
        a.fill(0, value.length);
      a.set(value);
      return a;
    }
  };
  function getWasmFft() {
    return new WasmFft(new WebAssembly.Instance(fftModule).exports);
  }

  // node_modules/@jtarrio/signals/dist/dsp/fft.js
  function actualLength(minimumLength) {
    if (minimumLength < 4)
      minimumLength = 4;
    if ((minimumLength - 1 & minimumLength) == 0)
      return minimumLength;
    let realLength = 1;
    while (realLength < minimumLength)
      realLength <<= 1;
    return realLength;
  }
  var FFT2 = class _FFT {
    length;
    /**
     * Returns an FFT instance that fits the given length.
     *
     * The actual length may be greater than the given length if it
     * is not a power of 2.
     */
    static ofLength(minimumLength) {
      return new _FFT(actualLength(minimumLength));
    }
    constructor(length) {
      this.length = length;
      this.revIndex = reversedBitIndices(length);
      this.wasmFft = getWasmFft();
      this.wasmFft.setCoefs(makeFftCoefficients(length));
      this.out = new IqPool(4, length);
    }
    revIndex;
    wasmFft;
    out;
    transform(real, imag) {
      const length = this.length;
      let [outReal, outImag] = this.out.get(length);
      outReal.fill(0);
      outImag.fill(0);
      if (imag === void 0) {
        for (let i = 0; i < length && i < real.length; ++i) {
          const ri = this.revIndex[i];
          outReal[ri] = real[i] / length;
        }
      } else {
        for (let i = 0; i < length && i < real.length && i < imag.length; ++i) {
          const ri = this.revIndex[i];
          outReal[ri] = real[i] / length;
          outImag[ri] = imag[i] / length;
        }
      }
      let res = this.wasmFft.fft(outReal, outImag, false);
      outReal.set(res[0]);
      outImag.set(res[1]);
      return [outReal, outImag];
    }
    reverse(real, imag) {
      const length = this.length;
      let [outReal, outImag] = this.out.get(length);
      outReal.fill(0);
      outImag.fill(0);
      for (let i = 0; i < length && i < real.length && i < imag.length; ++i) {
        const ri = this.revIndex[i];
        outReal[ri] = real[i];
        outImag[ri] = imag[i];
      }
      let res = this.wasmFft.fft(outReal, outImag, true);
      outReal.set(res[0]);
      outImag.set(res[1]);
      return [outReal, outImag];
    }
  };
  var RealFFT = class _RealFFT {
    length;
    static ofLength(minimumLength) {
      return new _RealFFT(actualLength(minimumLength));
    }
    constructor(length) {
      this.length = length;
      const halfLen = length / 2;
      this.revIndex = reversedBitIndices(halfLen);
      this.wasmFft = getWasmFft();
      this.wasmFft.setCoefs(makeFftCoefficients(halfLen));
      this.wasmFft.setExpnCoefs(makeExpnFftCoefficients(halfLen));
      this.copyEven = new Float32Array(halfLen);
      this.copyOdd = new Float32Array(halfLen);
      this.out = new IqPool(2, halfLen);
      this.outReal = new Float32Pool(2, length);
    }
    revIndex;
    wasmFft;
    out;
    outReal;
    copyEven;
    copyOdd;
    /**
     * Transforms the given real time-domain input.
     * @param real An array of real numbers.
     * @return The output of the transform.
     */
    transform(real) {
      const len = this.length;
      const hlen = len / 2;
      this.copyEven.fill(0);
      this.copyOdd.fill(0);
      for (let i = 0; i < hlen; ++i) {
        const ri = this.revIndex[i];
        this.copyEven[ri] = real[2 * i] / hlen;
        this.copyOdd[ri] = real[2 * i + 1] / hlen;
      }
      this.wasmFft.fft(this.copyEven, this.copyOdd, false);
      const res = this.wasmFft.realFftPost();
      const out = this.out.get(len);
      out[0].set(res[0]);
      out[1].set(res[1]);
      return out;
    }
    /**
     * Does a reverse transform of the given frequency-domain input.
     * The input and output arrays must be at least half the FFT's length.
     * @param real An array of real parts.
     * @param imag An array of imaginary parts.
     * @return The real output of the reverse transform.
     */
    reverse(real, imag) {
      const len = this.length;
      const hlen = len / 2;
      const [preEven, preOdd] = this.wasmFft.reverseRealFftPre(real, imag);
      for (let i = 0; i < hlen; ++i) {
        const ri = this.revIndex[i];
        this.copyEven[ri] = preEven[i];
        this.copyOdd[ri] = preOdd[i];
      }
      const [outEven, outOdd] = this.wasmFft.fft(this.copyEven, this.copyOdd, true);
      const out = this.outReal.get(len);
      for (let i = 0; i < hlen; ++i) {
        out[2 * i] = outEven[i];
        out[2 * i + 1] = outOdd[i];
      }
      return out;
    }
  };
  function makeFftCoefficients(length) {
    let numBits = getNumBits(length);
    let coefsLen = 2 * length - 8;
    let coefs = new Float32Array(coefsLen);
    let offset = 0;
    for (let bin = 0, halfSize = 4; bin < numBits - 2; ++bin, halfSize *= 2) {
      for (let i = 0; i < halfSize; ++i) {
        coefs[offset++] = Math.cos(-Math.PI * i / halfSize);
      }
      for (let i = 0; i < halfSize; ++i) {
        coefs[offset++] = Math.sin(-Math.PI * i / halfSize);
      }
    }
    return coefs;
  }
  function makeExpnFftCoefficients(halfLen) {
    let coefs = new Float32Array(2 * (halfLen + 1));
    let offset = 0;
    for (let k = 0; k < halfLen; ++k) {
      coefs[offset++] = Math.cos(-Math.PI * k / halfLen);
    }
    for (let k = 0; k < halfLen; ++k) {
      coefs[offset++] = Math.sin(-Math.PI * k / halfLen);
    }
    return coefs;
  }
  function reversedBitIndices(length) {
    const numBits = getNumBits(length);
    let output = new Int32Array(length);
    for (let i = 0; i < length; ++i) {
      output[i] = reverseBits(i, numBits);
    }
    return output;
  }
  function getNumBits(length) {
    let numBits = 0;
    for (let shifted = length - 1; shifted > 0; shifted >>= 1)
      ++numBits;
    return numBits;
  }
  function reverseBits(num, bits) {
    let output = 0;
    for (let b = 0; b < bits; ++b) {
      output <<= 1;
      output |= num & 1;
      num >>= 1;
    }
    return output;
  }

  // node_modules/@jtarrio/signals/dist/dsp/math.js
  function atan2(imag, real) {
    if (real == 0 && imag == 0)
      return 0;
    let swap = Math.abs(real) < Math.abs(imag);
    let div = swap ? real / imag : imag / real;
    const divSq = div * div;
    let res = div * (0.9999993329 + divSq * (-0.3332985605 + divSq * (0.1994653599 + divSq * (-0.1390853351 + divSq * (0.0964200441 + divSq * (-0.0559098861 + divSq * (0.0218612288 + divSq * -4054058e-9)))))));
    if (swap) {
      if (div >= 0) {
        res = Math.PI / 2 - res;
      } else {
        res = -Math.PI / 2 - res;
      }
    }
    if (real >= 0)
      return res;
    if (imag >= 0)
      return res + Math.PI;
    return res - Math.PI;
  }

  // node_modules/@jtarrio/signals/dist/dsp/filters.js
  var BaseWasmFirFilter = class {
    offset;
    delay;
    /** @param coefs The coefficients of the filter to apply. */
    constructor(offset, delay) {
      this.offset = offset;
      this.delay = delay;
      this.pool = new Float32Pool(2, 2 * this.offset);
      this.curSamples = this.pool.get(this.offset);
      this.convolver = getConvolver();
    }
    pool;
    curSamples;
    convolver;
    getDelay() {
      return this.delay;
    }
    /**
     * Loads a new block of samples to filter.
     * @param samples The samples to load.
     */
    loadSamples(samples) {
      const len = samples.length + this.offset;
      if (this.curSamples.length != len) {
        let newSamples = this.pool.get(len);
        newSamples.set(this.curSamples.subarray(this.curSamples.length - this.offset));
        this.curSamples = newSamples;
      } else {
        this.curSamples.copyWithin(0, samples.length);
      }
      this.curSamples.set(samples, this.offset);
    }
  };
  var FIRFilter = class _FIRFilter extends BaseWasmFirFilter {
    coefs;
    /** @param coefs The coefficients of the filter to apply. */
    constructor(coefs) {
      super(coefs.length - 1, Math.floor(coefs.length / 2));
      this.coefs = coefs;
      this.convolver.setCoefs(coefs);
    }
    setCoefficients(coefs) {
      this.convolver.setCoefs(coefs);
      const oldSamples = this.curSamples;
      this.coefs = coefs;
      this.offset = this.coefs.length - 1;
      this.delay = Math.floor(this.coefs.length / 2);
      this.curSamples = this.pool.get(this.offset);
      this.loadSamples(oldSamples);
    }
    clone() {
      return new _FIRFilter(this.coefs);
    }
    getDelay() {
      return this.delay;
    }
    inPlace(samples) {
      this.loadSamples(samples);
      samples.set(this.convolver.convolve(this.curSamples, samples.length));
    }
  };
  var FFTFilter = class _FFTFilter {
    constructor(coefs) {
      this.fft = RealFFT.ofLength(coefs.length * 2);
      this.kernel = this.computeKernel(coefs);
      this.overlap = coefs.length - 1;
      this.input = new Float32RingBuffer(this.fft.length);
      this.input.fill(0, this.overlap);
      this.work = new Float32Array(this.fft.length);
      this.output = new Float32RingBuffer((this.fft.length - this.overlap) * 2);
      this.output.fill(0, this.fft.length - this.overlap);
    }
    fft;
    kernel;
    overlap;
    input;
    work;
    output;
    computeKernel(coefs) {
      let copy = new Float32Array(this.fft.length);
      copy.set(coefs);
      copy.subarray(0, coefs.length).reverse();
      for (let i = 0; i < copy.length; ++i) {
        copy[i] *= copy.length;
      }
      let kernel = this.fft.transform(copy);
      return [new Float32Array(kernel[0]), new Float32Array(kernel[1])];
    }
    setCoefficients(coefs) {
      let fftLength = actualLength(coefs.length * 2);
      let newOverlap = coefs.length - 1;
      if (fftLength == this.fft.length && newOverlap == this.overlap) {
        this.kernel = this.computeKernel(coefs);
        return;
      }
      this.fft = RealFFT.ofLength(fftLength);
      this.overlap = newOverlap;
      this.kernel = this.computeKernel(coefs);
      let oldInput = new Float32Array(this.input.available);
      this.input.moveTo(oldInput);
      this.input = new Float32RingBuffer(this.fft.length);
      if (newOverlap > oldInput.length) {
        this.input.fill(0, newOverlap - oldInput.length);
      }
      this.input.store(oldInput);
      this.work = new Float32Array(this.fft.length);
      this.output = new Float32RingBuffer((this.fft.length - this.overlap) * 2);
      this.output.fill(0, this.fft.length - this.overlap);
    }
    clone() {
      let newFilter = new _FFTFilter(new Float32Array(this.overlap + 1));
      newFilter.kernel = this.kernel;
      return newFilter;
    }
    getDelay() {
      return this.fft.length - this.overlap / 2;
    }
    inPlace(samples) {
      let readPos = 0;
      let writePos = 0;
      while (samples.length - readPos > 0) {
        if (this.input.available < this.input.capacity) {
          let toCopy = Math.min(samples.length - readPos, this.input.capacity - this.input.available);
          this.input.store(samples.subarray(readPos, readPos + toCopy));
          readPos += toCopy;
        }
        if (this.input.available == this.input.capacity) {
          this.input.copyTo(this.work);
          this.input.consume(this.input.capacity - this.overlap);
          let fd = this.fft.transform(this.work);
          for (let i = 0; i < fd[0].length; ++i) {
            let sI = fd[0][i];
            let sQ = fd[1][i];
            let kI = this.kernel[0][i];
            let kQ = this.kernel[1][i];
            fd[0][i] = sI * kI - sQ * kQ;
            fd[1][i] = sQ * kI + sI * kQ;
          }
          let td = this.fft.reverse(fd[0], fd[1]);
          this.output.store(td.subarray(this.overlap));
        }
        if (writePos < samples.length) {
          let moved = this.output.moveTo(samples.subarray(writePos, readPos));
          writePos += moved;
        }
      }
    }
  };
  var IqFIRFilter = class _IqFIRFilter {
    constructor(coefs) {
      this.filterI = new FIRFilter(coefs);
      this.filterQ = this.filterI.clone();
    }
    filterI;
    filterQ;
    /** Changes the filters' coefficients. */
    setCoefficients(coefs) {
      this.filterI.setCoefficients(coefs);
      this.filterQ.setCoefficients(coefs);
    }
    /** Returns a newly initialized clone of this filter. */
    clone() {
      let out = new _IqFIRFilter(new Float32Array(3));
      out.filterI = this.filterI.clone();
      out.filterQ = this.filterQ.clone();
      return out;
    }
    /** Returns this filter's delay, in samples. */
    getDelay() {
      return this.filterI.getDelay();
    }
    /** Applies the filter to the input samples, in place. */
    inPlace(I, Q) {
      this.filterI.inPlace(I);
      this.filterQ.inPlace(Q);
    }
  };
  var IqFFTFilter = class _IqFFTFilter {
    constructor(coefs) {
      this.fft = FFT2.ofLength(coefs.length * 2);
      this.kernel = this.computeKernel(coefs);
      this.overlap = coefs.length - 1;
      this.input = new IqRingBuffer(this.fft.length);
      this.input.fill(0, 0, this.overlap);
      this.workI = new Float32Array(this.fft.length);
      this.workQ = new Float32Array(this.fft.length);
      this.output = new IqRingBuffer((this.fft.length - this.overlap) * 2);
      this.output.fill(0, 0, this.fft.length - this.overlap);
    }
    fft;
    kernel;
    overlap;
    input;
    workI;
    workQ;
    output;
    computeKernel(coefs) {
      let copy = new Float32Array(this.fft.length);
      copy.set(coefs);
      copy.subarray(0, coefs.length).reverse();
      for (let i = 0; i < copy.length; ++i) {
        copy[i] *= copy.length;
      }
      let kernel = RealFFT.ofLength(this.fft.length).transform(copy);
      return [new Float32Array(kernel[0]), new Float32Array(kernel[1])];
    }
    setCoefficients(coefs) {
      let fftLength = actualLength(coefs.length * 2);
      let newOverlap = coefs.length - 1;
      if (fftLength == this.fft.length && newOverlap == this.overlap) {
        this.kernel = this.computeKernel(coefs);
        return;
      }
      this.fft = FFT2.ofLength(fftLength);
      this.overlap = newOverlap;
      this.kernel = this.computeKernel(coefs);
      let oldInputI = new Float32Array(this.input.available);
      let oldInputQ = new Float32Array(this.input.available);
      this.input.moveTo(oldInputI, oldInputQ);
      this.input = new IqRingBuffer(this.fft.length);
      if (newOverlap > oldInputI.length) {
        this.input.fill(0, 0, newOverlap - oldInputI.length);
      }
      this.input.store(oldInputI, oldInputQ);
      this.workI = new Float32Array(this.fft.length);
      this.workQ = new Float32Array(this.fft.length);
      this.output = new IqRingBuffer((this.fft.length - this.overlap) * 2);
      this.output.fill(0, 0, this.fft.length - this.overlap);
    }
    clone() {
      let newFilter = new _IqFFTFilter(new Float32Array(this.overlap + 1));
      newFilter.kernel = this.kernel;
      return newFilter;
    }
    getDelay() {
      return this.fft.length - this.overlap / 2;
    }
    inPlace(real, imag) {
      const length = Math.min(real.length, imag.length);
      let readPos = 0;
      let writePos = 0;
      while (length - readPos > 0) {
        if (this.input.available < this.input.capacity) {
          let toCopy = Math.min(length - readPos, this.input.capacity - this.input.available);
          this.input.store(real.subarray(readPos, readPos + toCopy), imag.subarray(readPos, readPos + toCopy));
          readPos += toCopy;
        }
        if (this.input.available == this.input.capacity) {
          this.input.copyTo(this.workI, this.workQ);
          this.input.consume(this.input.capacity - this.overlap);
          let fd = this.fft.transform(this.workI, this.workQ);
          for (let i = 0; i < fd[0].length; ++i) {
            let sI = fd[0][i];
            let sQ = fd[1][i];
            let kI = this.kernel[0][i];
            let kQ = this.kernel[1][i];
            fd[0][i] = sI * kI - sQ * kQ;
            fd[1][i] = sQ * kI + sI * kQ;
          }
          let td = this.fft.reverse(fd[0], fd[1]);
          this.output.store(td[0].subarray(this.overlap), td[1].subarray(this.overlap));
        }
        if (writePos < length) {
          let moved = this.output.moveTo(real.subarray(writePos, readPos), imag.subarray(writePos, readPos));
          writePos += moved;
        }
      }
    }
  };
  var DelayFilter = class _DelayFilter {
    /** @param delay The number of samples to delay the signal by */
    constructor(delay) {
      this.buffer = new Float32Array(delay);
      this.ptr = 0;
    }
    buffer;
    ptr;
    clone() {
      return new _DelayFilter(this.getDelay());
    }
    getDelay() {
      return this.buffer.length;
    }
    inPlace(samples) {
      for (let i = 0; i < samples.length; ++i) {
        let s = samples[i];
        samples[i] = this.buffer[this.ptr];
        this.buffer[this.ptr] = s;
        this.ptr = (this.ptr + 1) % this.buffer.length;
      }
    }
  };
  var AGC = class _AGC {
    sampleRate;
    constructor(sampleRate, timeConstantSeconds, maxGain) {
      this.sampleRate = sampleRate;
      this.dcBlocker = new DcBlocker(sampleRate);
      this.alpha = decay(sampleRate, timeConstantSeconds);
      this.counter = 0;
      this.maxPower = 0;
      this.maxGain = maxGain || 100;
    }
    dcBlocker;
    alpha;
    counter;
    maxPower;
    maxGain;
    clone() {
      let copy = new _AGC(this.sampleRate, 1, this.maxGain);
      copy.alpha = this.alpha;
      return copy;
    }
    getDelay() {
      return 0;
    }
    inPlace(samples) {
      const alpha = this.alpha;
      let maxPower = this.maxPower;
      let counter = this.counter;
      let gain;
      this.dcBlocker.inPlace(samples);
      for (let i = 0; i < samples.length; ++i) {
        const v = samples[i];
        const power = v * v;
        if (power > 0.9 * maxPower) {
          counter = this.sampleRate;
          if (power > maxPower) {
            maxPower = power;
          }
        } else if (counter > 0) {
          --counter;
        } else {
          maxPower -= alpha * maxPower;
        }
        gain = Math.min(this.maxGain, 1 / Math.sqrt(maxPower));
        samples[i] *= gain;
      }
      this.maxPower = maxPower;
      this.counter = counter;
    }
  };
  var DcBlocker = class _DcBlocker {
    constructor(sampleRate) {
      this.alpha = decay(sampleRate, 0.5);
      this.dc = 0;
    }
    alpha;
    dc;
    clone() {
      let copy = new _DcBlocker(1e3);
      copy.alpha = this.alpha;
      copy.dc = this.dc;
      return copy;
    }
    getDelay() {
      return 0;
    }
    inPlace(samples) {
      const alpha = this.alpha;
      let dc = this.dc;
      for (let i = 0; i < samples.length; ++i) {
        dc += alpha * (samples[i] - dc);
        samples[i] -= dc;
      }
      this.dc = dc;
    }
  };
  function decay(sampleRate, timeConstant) {
    return 1 - Math.exp(-1 / (sampleRate * timeConstant));
  }
  var IIRFilter21 = class _IIRFilter21 {
    sampleRate;
    constructor(sampleRate, b0, b1, a1) {
      this.sampleRate = sampleRate;
      this.q = [b0, b1, a1];
      this.v = [0, 0];
    }
    q;
    v;
    /** Returns a copy of this filter. */
    clone() {
      return new _IIRFilter21(this.sampleRate, ...this.q);
    }
    getDelay() {
      return 0;
    }
    /**
     * Filters the given samples in place.
     * @param samples The samples to filter.
     */
    inPlace(samples) {
      let q = this.q;
      let x1 = this.v[0];
      let y1 = this.v[1];
      for (let i = 0; i < samples.length; ++i) {
        const x0 = samples[i];
        samples[i] = y1 = q[0] * x0 + q[1] * x1 + q[2] * y1;
        x1 = x0;
      }
      this.v[0] = x1;
      this.v[1] = y1;
    }
  };
  var IIRFilter32 = class _IIRFilter32 {
    sampleRate;
    constructor(sampleRate, b0, b1, b2, a1, a2) {
      this.sampleRate = sampleRate;
      this.q = [b0, b1, b2, a1, a2];
      this.v = [0, 0, 0, 0];
    }
    q;
    v;
    /** Returns a copy of this filter. */
    clone() {
      return new _IIRFilter32(this.sampleRate, ...this.q);
    }
    getDelay() {
      return 0;
    }
    /**
     * Filters the given samples in place.
     * @param samples The samples to filter.
     */
    inPlace(samples) {
      let q = this.q;
      let x1 = this.v[0];
      let x2 = this.v[1];
      let y1 = this.v[2];
      let y2 = this.v[3];
      for (let i = 0; i < samples.length; ++i) {
        let x0 = samples[i];
        let y0 = samples[i] = q[0] * x0 + q[1] * x1 + q[2] * x2 + q[3] * y1 + q[4] * y2;
        y2 = y1;
        y1 = y0;
        x2 = x1;
        x1 = x0;
      }
      this.v[0] = x1;
      this.v[1] = x2;
      this.v[2] = y1;
      this.v[3] = y2;
    }
  };
  function lowPassCoeffs21(sampleRate, frequency) {
    const wd = 2 * Math.PI * frequency / sampleRate;
    const wa = 2 * sampleRate * Math.tan(wd / 2);
    const tau = 1 / wa;
    let a = 1 + 2 * tau * sampleRate;
    let b = 1 - 2 * tau * sampleRate;
    return [1 / a, 1 / a, -b / a];
  }
  function lowPassCoeffs32(sampleRate, frequency, Q) {
    let w = 2 * Math.PI * frequency / sampleRate;
    let alpha = Math.sin(w) / (2 * Q);
    let b0 = (1 - Math.cos(w)) / 2;
    let b1 = 1 - Math.cos(w);
    let b2 = (1 - Math.cos(w)) / 2;
    let a0 = 1 + alpha;
    let a1 = -2 * Math.cos(w);
    let a2 = 1 - alpha;
    return [b0 / a0, b1 / a0, b2 / a0, -a1 / a0, -a2 / a0];
  }
  var Deemphasis = class extends IIRFilter21 {
    /**
     * @param sampleRate The signal's sample rate.
     * @param timeConstant The filter's time constant, in seconds.
     */
    constructor(sampleRate, timeConstant) {
      super(sampleRate, ...lowPassCoeffs21(sampleRate, 1 / (2 * Math.PI * timeConstant)));
    }
  };
  var IIRLowPass2 = class extends IIRFilter32 {
    /**
     * @param sampleRate The signal's sample rate.
     * @param freq The filter's corner frequency.
     * @param Q The filter's Q factor.
     */
    constructor(sampleRate, freq, Q) {
      super(sampleRate, ...lowPassCoeffs32(sampleRate, freq, Q));
    }
  };
  var FrequencyShifter = class {
    sampleRate;
    constructor(sampleRate) {
      this.sampleRate = sampleRate;
      this.cosine = 1;
      this.sine = 0;
    }
    cosine;
    sine;
    inPlace(I, Q, freq) {
      let cosine = this.cosine;
      let sine = this.sine;
      const deltaCos = Math.cos(2 * Math.PI * freq / this.sampleRate);
      const deltaSin = Math.sin(2 * Math.PI * freq / this.sampleRate);
      for (let i = 0; i < I.length; ++i) {
        const newI = I[i] * cosine - Q[i] * sine;
        Q[i] = I[i] * sine + Q[i] * cosine;
        I[i] = newI;
        const newSine = cosine * deltaSin + sine * deltaCos;
        cosine = cosine * deltaCos - sine * deltaSin;
        sine = newSine;
      }
      const m = Math.hypot(cosine, sine);
      this.cosine = cosine / m;
      this.sine = sine / m;
    }
  };
  var PilotDetector = class {
    sampleRate;
    targetFreq;
    constructor(sampleRate, targetFreq, tolerance) {
      this.sampleRate = sampleRate;
      this.targetFreq = targetFreq;
      this.iqPool = new IqPool(2);
      this.downShifter = new FrequencyShifter(sampleRate);
      this.upShifter = new FrequencyShifter(sampleRate);
      this.filterI = new IIRLowPass2(sampleRate, tolerance * 100, 1);
      this.filterQ = this.filterI.clone();
      this.prev = [1, 0];
      this.tolerance = 2 * Math.PI * tolerance / sampleRate;
      this.speedEstimate = 0;
      this.speedDecay = decay(sampleRate, 0.25);
      this.isLocked = false;
    }
    iqPool;
    downShifter;
    upShifter;
    filterI;
    filterQ;
    prev;
    tolerance;
    speedEstimate;
    speedDecay;
    isLocked;
    get locked() {
      return this.isLocked;
    }
    extract(input) {
      const speedDecay = this.speedDecay;
      let lI = this.prev[0];
      let lQ = this.prev[1];
      let speedEstimate = this.speedEstimate;
      let out = this.iqPool.get(input.length);
      const I = out[0];
      const Q = out[1];
      I.set(input);
      Q.fill(0);
      this.downShifter.inPlace(I, Q, -this.targetFreq);
      this.filterI.inPlace(I);
      this.filterQ.inPlace(Q);
      for (let i = 0; i < I.length; ++i) {
        const m = Math.hypot(I[i], Q[i]);
        if (m > 0) {
          I[i] /= m;
          Q[i] /= m;
          speedEstimate += speedDecay * (atan2(Q[i] * lI - I[i] * lQ, I[i] * lI + Q[i] * lQ) - speedEstimate);
        } else {
          speedEstimate += speedDecay * (2 * this.tolerance - speedEstimate);
        }
        lI = I[i];
        lQ = Q[i];
      }
      this.upShifter.inPlace(I, Q, this.targetFreq);
      this.prev[0] = lI;
      this.prev[1] = lQ;
      this.speedEstimate = speedEstimate;
      this.isLocked = speedEstimate >= -this.tolerance && speedEstimate <= this.tolerance;
      return out;
    }
  };

  // node_modules/@jtarrio/signals/dist/dsp/demodulators.js
  var Sideband;
  (function(Sideband2) {
    Sideband2[Sideband2["Upper"] = 0] = "Upper";
    Sideband2[Sideband2["Lower"] = 1] = "Lower";
  })(Sideband || (Sideband = {}));
  var SSBDemodulator = class {
    /**
     * @param sideband The sideband to demodulate.
     * @param kernelLen The length of the Hilbert filter kernel to use.
     */
    constructor(sideband, kernelLen, options) {
      let hilbert = makeHilbertKernel(kernelLen);
      this.filterHilbert = options?.useFftFilter ? new FFTFilter(hilbert) : new FIRFilter(hilbert);
      this.filterDelay = new DelayFilter(this.filterHilbert.getDelay());
      this.hilbertMul = sideband == Sideband.Upper ? -1 : 1;
    }
    filterHilbert;
    filterDelay;
    hilbertMul;
    /** Switches the demodulator's sideband on the fly. */
    setSideband(sideband) {
      this.hilbertMul = sideband == Sideband.Upper ? -1 : 1;
    }
    /** Demodulates the given I/Q samples into the real output. */
    demodulate(I, Q, out) {
      this.filterDelay.inPlace(I);
      this.filterHilbert.inPlace(Q);
      for (let i = 0; i < out.length; ++i) {
        out[i] = (I[i] + Q[i] * this.hilbertMul) / 2;
      }
    }
  };
  var AMDemodulator = class {
    /**
     * @param sampleRate The signal's sample rate.
     */
    constructor(sampleRate) {
      this.alpha = decay(sampleRate, 0.5);
      this.carrierAmplitude = 0;
    }
    alpha;
    carrierAmplitude;
    /** Demodulates the given I/Q samples into the real output. */
    demodulate(I, Q, out) {
      const alpha = this.alpha;
      let carrierAmplitude = this.carrierAmplitude;
      for (let i = 0; i < out.length; ++i) {
        const vI = I[i];
        const vQ = Q[i];
        const power = vI * vI + vQ * vQ;
        const amplitude = Math.sqrt(power);
        carrierAmplitude += alpha * (amplitude - carrierAmplitude);
        out[i] = carrierAmplitude == 0 ? 0 : amplitude / carrierAmplitude - 1;
      }
      this.carrierAmplitude = carrierAmplitude;
    }
  };
  var FMDemodulator = class {
    /**
     * @param maxDeviation The maximum deviation for the signal, as a fraction of the sample rate.
     */
    constructor(maxDeviation) {
      this.mul = 1 / (2 * Math.PI * maxDeviation);
      this.lI = 0;
      this.lQ = 0;
    }
    mul;
    lI;
    lQ;
    /** Changes the maximum deviation. */
    setMaxDeviation(maxDeviation) {
      this.mul = 1 / (2 * Math.PI * maxDeviation);
    }
    /** Demodulates the given I/Q samples into the real output. */
    demodulate(I, Q, out) {
      const mul = this.mul;
      let lI = this.lI;
      let lQ = this.lQ;
      for (let i = 0; i < I.length; ++i) {
        let real = lI * I[i] + lQ * Q[i];
        let imag = lI * Q[i] - I[i] * lQ;
        lI = I[i];
        lQ = Q[i];
        out[i] = atan2(imag, real) * mul;
      }
      this.lI = lI;
      this.lQ = lQ;
    }
  };
  var StereoSeparator = class {
    /**
     * @param sampleRate The sample rate for the input signal.
     * @param pilotFreq The frequency of the pilot tone.
     */
    constructor(sampleRate, pilotFreq) {
      this.pool = new Float32Pool(4);
      this.detector = new PilotDetector(sampleRate, pilotFreq, 2);
    }
    pool;
    detector;
    /**
     * Locks on to the pilot tone and uses it to demodulate the stereo audio.
     * @param samples The original audio stream.
     * @returns An object with a key 'found' that tells whether a
     *     consistent stereo pilot tone was detected and a key 'diff'
     *     that contains the original stream demodulated with the
     *     reconstructed stereo carrier.
     */
    separate(samples) {
      let out = this.pool.get(samples.length);
      const pilot = this.detector.extract(samples);
      const I = pilot[0];
      const Q = pilot[1];
      for (let i = 0; i < samples.length; ++i) {
        out[i] = samples[i] * I[i] * Q[i] * 4;
      }
      return {
        found: this.detector.locked,
        diff: out
      };
    }
  };

  // node_modules/@jtarrio/signals/dist/dsp/power.js
  function getPower(I, Q) {
    let power = 0;
    for (let i = 0; i < I.length; ++i) {
      const vI = I[i];
      const vQ = Q[i];
      power += vI * vI + vQ * vQ;
    }
    return power / I.length;
  }

  // node_modules/@jtarrio/signals/dist/dsp/resamplers.js
  var Downsampler = class _Downsampler {
    ratio;
    constructor(ratio, kernel) {
      this.ratio = ratio;
      if (ratio != Math.floor(ratio))
        throw new RadioError(`Non-integer downsample ratio: ${ratio}`, RadioErrorType.DemodulationError);
      this.filter = new DownsamplingFilter(kernel);
      this.pool = new Float32Pool(2);
      this.residual = 0;
    }
    filter;
    pool;
    residual;
    resample(samples) {
      const ratio = this.ratio;
      const skip = (ratio - this.residual) % ratio;
      const outLen = Math.floor((this.residual + samples.length - 1) / ratio) - Math.floor((this.residual - 1) / ratio);
      let output = this.pool.get(outLen);
      output.set(this.filter.filter(samples, outLen, ratio, skip));
      this.residual = (this.residual + samples.length) % ratio;
      return output;
    }
    getDelay() {
      return this.filter.getDelay() / this.ratio;
    }
    clone() {
      let out = new _Downsampler(this.ratio, new Float32Array(1));
      out.filter = this.filter.clone();
      return out;
    }
  };
  var Upsampler = class _Upsampler {
    ratio;
    constructor(ratio, kernel) {
      this.ratio = ratio;
      if (ratio != Math.floor(ratio))
        throw new RadioError(`Non-integer upsample ratio: ${ratio}`, RadioErrorType.DemodulationError);
      this.filter = new UpsamplingFilter(kernel, ratio);
      this.pool = new Float32Pool(2);
    }
    filter;
    pool;
    resample(samples) {
      const ratio = this.ratio;
      const outLen = samples.length * ratio;
      let output = this.pool.get(outLen);
      output.set(this.filter.filter(samples));
      return output;
    }
    getDelay() {
      return this.filter.getDelay();
    }
    clone() {
      let out = new _Upsampler(this.ratio, new Float32Array(this.ratio));
      out.filter = this.filter.clone();
      return out;
    }
  };
  var Resampler = class _Resampler {
    upRatio;
    downRatio;
    constructor(upRatio, downRatio, kernel) {
      this.upRatio = upRatio;
      this.downRatio = downRatio;
      if (upRatio != Math.floor(upRatio))
        throw new RadioError(`Non-integer upsample ratio: ${upRatio}`, RadioErrorType.DemodulationError);
      if (downRatio != Math.floor(downRatio))
        throw new RadioError(`Non-integer downsample ratio: ${downRatio}`, RadioErrorType.DemodulationError);
      this.filter = new UpsamplingFilter(kernel, upRatio);
      this.pool = new Float32Pool(2);
      this.residual = 0;
    }
    filter;
    pool;
    residual;
    resample(samples) {
      const upRatio = this.upRatio;
      const downRatio = this.downRatio;
      const skip = (downRatio - this.residual) % downRatio;
      const midLen = samples.length * upRatio;
      const outLen = Math.floor((this.residual + midLen - 1) / downRatio) - Math.floor((this.residual - 1) / downRatio);
      let output = this.pool.get(outLen);
      output.set(this.filter.filterWithStride(samples, outLen, downRatio, skip));
      this.residual = (this.residual + midLen) % downRatio;
      return output;
    }
    getDelay() {
      return this.filter.getDelay() / this.downRatio;
    }
    clone() {
      let out = new _Resampler(this.upRatio, this.downRatio, new Float32Array(this.upRatio));
      out.filter = this.filter.clone();
      return out;
    }
  };
  var GenericIqResampler = class _GenericIqResampler {
    constructor(realResampler) {
      this.resampleI = realResampler.clone();
      this.resampleQ = realResampler.clone();
    }
    resampleI;
    resampleQ;
    resample(I, Q) {
      return [this.resampleI.resample(I), this.resampleQ.resample(Q)];
    }
    getDelay() {
      return this.resampleI.getDelay();
    }
    clone() {
      return new _GenericIqResampler(this.resampleI);
    }
  };
  function getRealResampler(inRate, outRate, options) {
    if (inRate > outRate && inRate % outRate == 0) {
      let downFactor2 = inRate / outRate;
      let corner2 = options?.lowPassFrequency || outRate / 2;
      let taps2 = options?.legacyTaps ? options?.legacyTaps : (options?.taps || 41) * downFactor2;
      let gain2 = options?.gain;
      let kernel2 = options?.kernel || makeLowPassKernel(inRate, corner2, taps2, gain2);
      return new Downsampler(inRate / outRate, kernel2);
    }
    if (inRate < outRate && outRate % inRate == 0) {
      let upFactor2 = outRate / inRate;
      let corner2 = options?.lowPassFrequency || inRate / 2;
      let taps2 = options?.legacyTaps ? Math.round(options?.legacyTaps * outRate / inRate) : options?.taps || 41;
      let gain2 = options?.gain;
      let kernel2 = options?.kernel || makeLowPassKernel(outRate, corner2, taps2, gain2);
      return new Upsampler(upFactor2, kernel2);
    }
    let gcd = greatestCommonDivisor(inRate, outRate);
    let upFactor = outRate / gcd;
    let downFactor = inRate / gcd;
    let interRate = inRate * outRate / gcd;
    let corner = options?.lowPassFrequency || Math.min(inRate, outRate) / 2;
    let taps = options?.legacyTaps ? Math.round(options?.legacyTaps * outRate / gcd) : (options?.taps || 41) * downFactor;
    let gain = options?.gain;
    let kernel = options?.kernel || makeLowPassKernel(interRate, corner, taps, gain);
    return new Resampler(upFactor, downFactor, kernel);
  }
  function getIqResampler(inRate, outRate, options) {
    return new GenericIqResampler(getRealResampler(inRate, outRate, options));
  }
  function greatestCommonDivisor(a, b) {
    if (a < b) {
      [a, b] = [b, a];
    }
    while (b != 0) {
      [a, b] = [b, a % b];
    }
    return a;
  }
  function splitKernel(kernel, ratio) {
    let delay = Math.floor(kernel.length / 2);
    if (kernel.length % ratio != 0) {
      const wantedLen = ratio * Math.ceil(kernel.length / ratio);
      const newKernel = new Float32Array(wantedLen);
      newKernel.subarray(wantedLen - kernel.length, wantedLen).set(kernel);
      kernel = newKernel;
    }
    const coefLen = kernel.length / ratio;
    let coefs = [];
    for (let i = 0; i < ratio; ++i) {
      const filterKernel = new Float32Array(coefLen);
      for (let j = 0; j < coefLen; ++j) {
        filterKernel[j] = kernel[(j + 1) * ratio - i - 1] * ratio;
      }
      coefs[i] = filterKernel;
    }
    return { delay, coefs };
  }
  var DownsamplingFilter = class _DownsamplingFilter extends BaseWasmFirFilter {
    coefs;
    constructor(coefs) {
      super(coefs.length - 1, Math.floor(coefs.length / 2));
      this.coefs = coefs;
      this.convolver.setCoefs(coefs);
    }
    setCoefficients(coefs) {
      this.convolver.setCoefs(coefs);
      const oldSamples = this.curSamples;
      this.coefs = coefs;
      this.offset = this.coefs.length - 1;
      this.delay = Math.floor(this.coefs.length / 2);
      this.curSamples = this.pool.get(this.offset);
      this.loadSamples(oldSamples);
    }
    clone() {
      return new _DownsamplingFilter(this.coefs);
    }
    getDelay() {
      return this.delay;
    }
    filter(samples, num, stride, offset) {
      this.loadSamples(samples);
      return this.convolver.convolveWithStride(this.curSamples, num, stride, offset);
    }
  };
  var UpsamplingFilter = class _UpsamplingFilter extends BaseWasmFirFilter {
    kernel;
    ratio;
    constructor(kernel, ratio) {
      const { delay, coefs } = splitKernel(kernel, ratio);
      super(coefs[0].length - 1, delay);
      this.kernel = kernel;
      this.ratio = ratio;
      this.convolver.setCoefArray(coefs);
    }
    clone() {
      return new _UpsamplingFilter(this.kernel, this.ratio);
    }
    filter(samples) {
      this.loadSamples(samples);
      return this.convolver.convolveExpanding(this.curSamples, samples.length, this.ratio);
    }
    filterWithStride(samples, num, stride, offset) {
      this.loadSamples(samples);
      return this.convolver.convolveExpandingWithStride(this.curSamples, num, stride, offset);
    }
  };

  // node_modules/@jtarrio/signals/dist/demod/demod-am.js
  var DemodAM = class {
    outRate;
    mode;
    /**
     * @param inRate The sample rate of the input samples.
     * @param outRate The sample rate of the output audio.
     * @param mode The mode to use initially.
     * @param options Options for the demodulator.
     */
    constructor(inRate, outRate, mode, options) {
      this.outRate = outRate;
      this.mode = mode;
      const downsamplerTaps = options?.downsamplerTaps || 151;
      this.rfTaps = options?.rfTaps || 151;
      this.shifter = new FrequencyShifter(inRate);
      this.downsampler = getIqResampler(inRate, outRate, {
        legacyTaps: downsamplerTaps
      });
      const kernel = makeLowPassKernel(outRate, this.mode.bandwidth / 2, this.rfTaps);
      this.filter = options?.useFftFilter ? new IqFFTFilter(kernel) : new IqFIRFilter(kernel);
      this.demodulator = new AMDemodulator(outRate);
      this.outPool = new Float32Pool(1);
    }
    rfTaps;
    shifter;
    downsampler;
    filter;
    demodulator;
    outPool;
    getMode() {
      return this.mode;
    }
    setMode(mode) {
      this.mode = mode;
      const kernel = makeLowPassKernel(this.outRate, mode.bandwidth / 2, this.rfTaps);
      this.filter.setCoefficients(kernel);
    }
    /**
     * Demodulates the signal.
     * @param samplesI The I components of the samples.
     * @param samplesQ The Q components of the samples.
     * @param freqOffset The offset of the signal in the samples.
     * @returns The demodulated audio signal.
     */
    demodulate(samplesI, samplesQ, freqOffset) {
      this.shifter.inPlace(samplesI, samplesQ, -freqOffset);
      const [I, Q] = this.downsampler.resample(samplesI, samplesQ);
      let allPower = getPower(I, Q);
      this.filter.inPlace(I, Q);
      let signalPower = getPower(I, Q) * this.outRate / this.mode.bandwidth;
      this.demodulator.demodulate(I, Q, I);
      let right = this.outPool.get(I.length);
      right.set(I);
      return {
        left: I,
        right,
        stereo: false,
        snr: signalPower / allPower
      };
    }
  };
  var ConfigAM = class extends Configurator {
    constructor(mode) {
      super(mode);
    }
    create() {
      return { scheme: "AM", bandwidth: 15e3, squelch: 0 };
    }
    hasBandwidth() {
      return true;
    }
    getBandwidth() {
      return this.mode.bandwidth;
    }
    setBandwidth(bandwidth) {
      this.mode = {
        ...this.mode,
        bandwidth: Math.max(250, Math.min(bandwidth, 3e4))
      };
      return this;
    }
    hasSquelch() {
      return true;
    }
    getSquelch() {
      return this.mode.squelch;
    }
    setSquelch(squelch) {
      this.mode = { ...this.mode, squelch: Math.max(0, Math.min(squelch, 6)) };
      return this;
    }
  };

  // node_modules/@jtarrio/signals/dist/demod/demod-cw.js
  var DemodCW = class {
    outRate;
    mode;
    /**
     * @param inRate The sample rate of the input samples.
     * @param outRate The sample rate of the output audio.
     * @param mode The mode to use initially.
     * @param options Options for the demodulator.
     */
    constructor(inRate, outRate, mode, options) {
      this.outRate = outRate;
      this.mode = mode;
      const downsamplerTaps = options?.downsamplerTaps || 151;
      this.audioTaps = options?.audioTaps || 351;
      const toneFrequency = options?.toneFrequency || 600;
      this.shifter = new FrequencyShifter(inRate);
      this.downsampler = getIqResampler(inRate, outRate, {
        legacyTaps: downsamplerTaps
      });
      const kernel = makeLowPassKernel(outRate, mode.bandwidth / 2, this.audioTaps);
      this.filter = options?.useFftFilter ? new IqFFTFilter(kernel) : new IqFIRFilter(kernel);
      this.toneShifter = new FrequencyShifter(outRate);
      this.toneFrequency = toneFrequency;
      this.agc = new AGC(outRate, 10);
      this.outPool = new Float32Pool(1);
    }
    audioTaps;
    shifter;
    downsampler;
    filter;
    toneShifter;
    toneFrequency;
    agc;
    outPool;
    getMode() {
      return this.mode;
    }
    setMode(mode) {
      this.mode = mode;
      const kernel = makeLowPassKernel(this.outRate, mode.bandwidth / 2, this.audioTaps);
      this.filter.setCoefficients(kernel);
    }
    /** Demodulates the given I/Q samples into the real output. */
    demodulate(samplesI, samplesQ, freqOffset) {
      this.shifter.inPlace(samplesI, samplesQ, -freqOffset);
      const [I, Q] = this.downsampler.resample(samplesI, samplesQ);
      let allPower = getPower(I, Q);
      this.filter.inPlace(I, Q);
      let signalPower = getPower(I, Q) * this.outRate / this.mode.bandwidth;
      this.toneShifter.inPlace(I, Q, this.toneFrequency);
      this.agc.inPlace(I);
      let right = this.outPool.get(I.length);
      right.set(I);
      return {
        left: I,
        right,
        stereo: false,
        snr: signalPower / allPower
      };
    }
  };
  var ConfigCW = class extends Configurator {
    constructor(mode) {
      super(mode);
    }
    create() {
      return { scheme: "CW", bandwidth: 50 };
    }
    hasBandwidth() {
      return true;
    }
    getBandwidth() {
      return this.mode.bandwidth;
    }
    setBandwidth(bandwidth) {
      this.mode = {
        ...this.mode,
        bandwidth: Math.max(5, Math.min(bandwidth, 1e3))
      };
      return this;
    }
  };

  // node_modules/@jtarrio/signals/dist/demod/demod-nbfm.js
  var DemodNBFM = class {
    outRate;
    mode;
    /**
     * @param inRate The sample rate of the input samples.
     * @param outRate The sample rate of the output audio.
     * @param mode The mode to use initially.
     * @param options Options for the demodulator.
     */
    constructor(inRate, outRate, mode, options) {
      this.outRate = outRate;
      this.mode = mode;
      const downsamplerTaps = options?.downsamplerTaps || 151;
      this.rfTaps = options?.rfTaps || 151;
      this.shifter = new FrequencyShifter(inRate);
      this.downsampler = getIqResampler(inRate, outRate, {
        legacyTaps: downsamplerTaps
      });
      const kernel = makeLowPassKernel(outRate, mode.maxF, this.rfTaps);
      this.filter = options?.useFftFilter ? new IqFFTFilter(kernel) : new IqFIRFilter(kernel);
      this.demodulator = new FMDemodulator(mode.maxF / outRate);
      this.outPool = new Float32Pool(1);
    }
    rfTaps;
    shifter;
    downsampler;
    filter;
    demodulator;
    outPool;
    getMode() {
      return this.mode;
    }
    setMode(mode) {
      this.mode = mode;
      const kernel = makeLowPassKernel(this.outRate, mode.maxF, this.rfTaps);
      this.filter.setCoefficients(kernel);
      this.demodulator.setMaxDeviation(mode.maxF / this.outRate);
    }
    /**
     * Demodulates the signal.
     * @param samplesI The I components of the samples.
     * @param samplesQ The Q components of the samples.
     * @param freqOffset The offset of the signal in the samples.
     * @returns The demodulated audio signal.
     */
    demodulate(samplesI, samplesQ, freqOffset) {
      this.shifter.inPlace(samplesI, samplesQ, -freqOffset);
      const [I, Q] = this.downsampler.resample(samplesI, samplesQ);
      let allPower = getPower(I, Q);
      this.filter.inPlace(I, Q);
      let signalPower = getPower(I, Q) * this.outRate / (this.mode.maxF * 2);
      this.demodulator.demodulate(I, Q, I);
      let right = this.outPool.get(I.length);
      right.set(I);
      return {
        left: I,
        right,
        stereo: false,
        snr: signalPower / allPower
      };
    }
  };
  var ConfigNBFM = class extends Configurator {
    constructor(mode) {
      super(mode);
    }
    create() {
      return { scheme: "NBFM", maxF: 5e3, squelch: 0 };
    }
    hasBandwidth() {
      return true;
    }
    getBandwidth() {
      return 2 * this.mode.maxF;
    }
    setBandwidth(bandwidth) {
      this.mode = {
        ...this.mode,
        maxF: Math.max(125, Math.min(bandwidth / 2, 15e3))
      };
      return this;
    }
    hasSquelch() {
      return true;
    }
    getSquelch() {
      return this.mode.squelch;
    }
    setSquelch(squelch) {
      this.mode = { ...this.mode, squelch: Math.max(0, Math.min(squelch, 6)) };
      return this;
    }
  };

  // node_modules/@jtarrio/signals/dist/demod/demod-ssb.js
  var DemodSSB = class {
    outRate;
    mode;
    /**
     * @param inRate The sample rate of the input samples.
     * @param outRate The sample rate of the output audio.
     * @param mode The mode to use initially.
     */
    constructor(inRate, outRate, mode, options) {
      this.outRate = outRate;
      this.mode = mode;
      const downsamplerTaps = options?.downsamplerTaps || 151;
      this.rfTaps = options?.rfTaps || 151;
      const hilbertTaps = options?.hilbertTaps || 351;
      this.shifter = new FrequencyShifter(inRate);
      this.downsampler = getIqResampler(inRate, outRate, {
        legacyTaps: downsamplerTaps
      });
      const kernel = makeLowPassKernel(this.outRate, mode.bandwidth, this.rfTaps);
      this.filter = options?.useFftFilter ? new FFTFilter(kernel) : new FIRFilter(kernel);
      this.demodulator = new SSBDemodulator(mode.scheme == "USB" ? Sideband.Upper : Sideband.Lower, hilbertTaps, { useFftFilter: options?.useFftFilter });
      this.agc = new AGC(outRate, 3);
      this.outPool = new Float32Pool(1);
    }
    rfTaps;
    shifter;
    downsampler;
    filter;
    demodulator;
    agc;
    outPool;
    getMode() {
      return this.mode;
    }
    setMode(mode) {
      this.mode = mode;
      const kernel = makeLowPassKernel(this.outRate, mode.bandwidth, this.rfTaps);
      this.filter.setCoefficients(kernel);
      this.demodulator.setSideband(mode.scheme == "USB" ? Sideband.Upper : Sideband.Lower);
    }
    /**
     * Demodulates the signal.
     * @param samplesI The I components of the samples.
     * @param samplesQ The Q components of the samples.
     * @param freqOffset The offset of the signal in the samples.
     * @returns The demodulated audio signal.
     */
    demodulate(samplesI, samplesQ, freqOffset) {
      this.shifter.inPlace(samplesI, samplesQ, -freqOffset);
      const [I, Q] = this.downsampler.resample(samplesI, samplesQ);
      let allPower = getPower(I, Q);
      this.demodulator.demodulate(I, Q, I);
      this.filter.inPlace(I);
      let signalPower = getPower(I, I) * this.outRate / this.mode.bandwidth;
      this.agc.inPlace(I);
      let right = this.outPool.get(I.length);
      right.set(I);
      return {
        left: I,
        right,
        stereo: false,
        snr: signalPower / allPower
      };
    }
  };
  var ConfigSSB = class extends Configurator {
    constructor(mode) {
      super(mode);
    }
    create(scheme) {
      return { scheme, bandwidth: 2800, squelch: 0 };
    }
    hasBandwidth() {
      return true;
    }
    getBandwidth() {
      return this.mode.bandwidth;
    }
    setBandwidth(bandwidth) {
      this.mode = {
        ...this.mode,
        bandwidth: Math.max(10, Math.min(bandwidth, 15e3))
      };
      return this;
    }
    hasSquelch() {
      return true;
    }
    getSquelch() {
      return this.mode.squelch;
    }
    setSquelch(squelch) {
      this.mode = { ...this.mode, squelch: Math.max(0, Math.min(squelch, 6)) };
      return this;
    }
  };

  // node_modules/@jtarrio/signals/dist/demod/demod-wbfm.js
  var DemodWBFM = class {
    mode;
    /**
     * @param inRate The sample rate of the input samples.
     * @param outRate The sample rate of the output samples.
     * @param mode The mode to use initially.
     * @param options Options for the demodulator.
     */
    constructor(inRate, outRate, mode, options) {
      this.mode = mode;
      let interRate = Math.min(inRate, 336e3);
      this.stage1 = new DemodWBFMStage1(inRate, interRate, mode, options);
      this.stage2 = new DemodWBFMStage2(interRate, outRate, mode, options);
    }
    stage1;
    stage2;
    getMode() {
      return this.mode;
    }
    setMode(mode) {
      this.mode = mode;
      this.stage1.setMode(mode);
      this.stage2.setMode(mode);
    }
    /**
     * Demodulates the signal.
     * @param samplesI The I components of the samples.
     * @param samplesQ The Q components of the samples.
     * @param freqOffset The offset of the signal in the samples.
     * @returns The demodulated audio signal.
     */
    demodulate(samplesI, samplesQ, freqOffset) {
      let o1 = this.stage1.demodulate(samplesI, samplesQ, freqOffset);
      let o2 = this.stage2.demodulate(o1.left);
      o2.snr = o1.snr;
      return o2;
    }
  };
  var DemodWBFMStage1 = class {
    outRate;
    mode;
    /**
     * @param inRate The sample rate of the input samples.
     * @param outRate The sample rate of the output audio.
     * @param mode The mode to use initially.
     * @param options Options for the demodulator.
     */
    constructor(inRate, outRate, mode, options) {
      this.outRate = outRate;
      this.mode = mode;
      const maxF = 75e3;
      const downsamplerTaps = options?.downsamplerTaps || 151;
      const rfTaps = options?.rfTaps || 151;
      this.shifter = new FrequencyShifter(inRate);
      if (inRate != outRate) {
        this.downsampler = getIqResampler(inRate, outRate, {
          legacyTaps: downsamplerTaps
        });
      }
      const kernel = makeLowPassKernel(outRate, maxF, rfTaps);
      this.filter = options?.useFftFilter ? new IqFFTFilter(kernel) : new IqFIRFilter(kernel);
      this.demodulator = new FMDemodulator(maxF / outRate);
    }
    shifter;
    downsampler;
    filter;
    demodulator;
    getMode() {
      return this.mode;
    }
    setMode(mode) {
      this.mode = mode;
    }
    /**
     * Demodulates the signal.
     * @param samplesI The I components of the samples.
     * @param samplesQ The Q components of the samples.
     * @param freqOffset The offset of the signal in the samples.
     * @returns The demodulated audio signal.
     */
    demodulate(samplesI, samplesQ, freqOffset) {
      this.shifter.inPlace(samplesI, samplesQ, -freqOffset);
      let [I, Q] = this.downsampler ? this.downsampler.resample(samplesI, samplesQ) : [samplesI, samplesQ];
      let allPower = getPower(I, Q);
      this.filter.inPlace(I, Q);
      let signalPower = getPower(I, Q) * this.outRate / 15e4;
      this.demodulator.demodulate(I, Q, I);
      return {
        left: I,
        right: new Float32Array(I),
        stereo: false,
        snr: signalPower / allPower
      };
    }
  };
  var DemodWBFMStage2 = class {
    mode;
    /**
     * @param inRate The sample rate of the input samples.
     * @param outRate The sample rate of the output audio.
     * @param mode The mode to use initially.
     * @param options Options for the demodulator.
     */
    constructor(inRate, outRate, mode, options) {
      this.mode = mode;
      const pilotF = 19e3;
      const deemphTc = (options?.deemphasizerTc === void 0 ? 50 : options.deemphasizerTc) / 1e6;
      const audioTaps = options?.audioTaps || 41;
      const filterF = Math.min(15e3, outRate / 2);
      this.monoSampler = getRealResampler(inRate, outRate, {
        lowPassFrequency: filterF,
        legacyTaps: audioTaps,
        gain: 1 / 0.9
      });
      this.stereoSampler = this.monoSampler.clone();
      this.stereoSeparator = new StereoSeparator(inRate, pilotF);
      this.leftDeemph = new Deemphasis(outRate, deemphTc);
      this.rightDeemph = new Deemphasis(outRate, deemphTc);
      this.outPool = new Float32Pool(2, 1024);
    }
    monoSampler;
    stereoSampler;
    stereoSeparator;
    leftDeemph;
    rightDeemph;
    outPool;
    getMode() {
      return this.mode;
    }
    setMode(mode) {
      this.mode = mode;
    }
    /**
     * Demodulates the signal.
     * @param samplesI The I components of the samples.
     * @returns The demodulated audio signal.
     */
    demodulate(samplesI) {
      let audio = this.monoSampler.resample(samplesI);
      if (this.mode.stereo) {
        const stereo = this.stereoSeparator.separate(samplesI);
        if (stereo.found) {
          const diffAudio = this.stereoSampler.resample(stereo.diff);
          let leftAudio = this.outPool.get(audio.length);
          let rightAudio = audio;
          for (let i = 0; i < diffAudio.length; ++i) {
            leftAudio[i] = audio[i] - diffAudio[i];
            rightAudio[i] = audio[i] + diffAudio[i];
          }
          this.leftDeemph.inPlace(leftAudio);
          this.rightDeemph.inPlace(rightAudio);
          return {
            left: leftAudio,
            right: rightAudio,
            stereo: true,
            snr: 1
          };
        }
      }
      this.leftDeemph.inPlace(audio);
      let right = this.outPool.get(audio.length);
      right.set(audio);
      return {
        left: audio,
        right,
        stereo: false,
        snr: 1
      };
    }
  };
  var ConfigWBFM = class extends Configurator {
    constructor(mode) {
      super(mode);
    }
    create() {
      return { scheme: "WBFM", stereo: true };
    }
    hasStereo() {
      return true;
    }
    getStereo() {
      return this.mode.stereo;
    }
    setStereo(stereo) {
      this.mode = { ...this.mode, stereo };
      return this;
    }
    getBandwidth() {
      return 15e4;
    }
  };

  // node_modules/@jtarrio/signals/dist/demod/demodulator.js
  registerDemod("WBFM", DemodWBFM, ConfigWBFM);
  registerDemod("NBFM", DemodNBFM, ConfigNBFM);
  registerDemod("AM", DemodAM, ConfigAM);
  registerDemod("USB", DemodSSB, ConfigSSB);
  registerDemod("LSB", DemodSSB, ConfigSSB);
  registerDemod("CW", DemodCW, ConfigCW);
  return __toCommonJS(signals_entry_exports);
})();
