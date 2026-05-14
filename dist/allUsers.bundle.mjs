var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

function commonjsRequire(path) {
	throw new Error('Could not dynamically require "' + path + '". Please configure the dynamicRequireTargets or/and ignoreDynamicRequires option of @rollup/plugin-commonjs appropriately for this require call to work.');
}

var localforage$1 = {exports: {}};

/*!
    localForage -- Offline Storage, Improved
    Version 1.10.0
    https://localforage.github.io/localForage
    (c) 2013-2017 Mozilla, Apache License 2.0
*/

var hasRequiredLocalforage;

function requireLocalforage () {
	if (hasRequiredLocalforage) return localforage$1.exports;
	hasRequiredLocalforage = 1;
	(function (module, exports$1) {
		(function(f){{module.exports=f();}})(function(){return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof commonjsRequire=="function"&&commonjsRequire;if(!u&&a)return a(o,true);if(i)return i(o,true);var f=new Error("Cannot find module '"+o+"'");throw (f.code="MODULE_NOT_FOUND", f)}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r);}return n[o].exports}var i=typeof commonjsRequire=="function"&&commonjsRequire;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports$1){
		(function (global){
		var Mutation = global.MutationObserver || global.WebKitMutationObserver;

		var scheduleDrain;

		{
		  if (Mutation) {
		    var called = 0;
		    var observer = new Mutation(nextTick);
		    var element = global.document.createTextNode('');
		    observer.observe(element, {
		      characterData: true
		    });
		    scheduleDrain = function () {
		      element.data = (called = ++called % 2);
		    };
		  } else if (!global.setImmediate && typeof global.MessageChannel !== 'undefined') {
		    var channel = new global.MessageChannel();
		    channel.port1.onmessage = nextTick;
		    scheduleDrain = function () {
		      channel.port2.postMessage(0);
		    };
		  } else if ('document' in global && 'onreadystatechange' in global.document.createElement('script')) {
		    scheduleDrain = function () {

		      // Create a <script> element; its readystatechange event will be fired asynchronously once it is inserted
		      // into the document. Do so, thus queuing up the task. Remember to clean up once it's been called.
		      var scriptEl = global.document.createElement('script');
		      scriptEl.onreadystatechange = function () {
		        nextTick();

		        scriptEl.onreadystatechange = null;
		        scriptEl.parentNode.removeChild(scriptEl);
		        scriptEl = null;
		      };
		      global.document.documentElement.appendChild(scriptEl);
		    };
		  } else {
		    scheduleDrain = function () {
		      setTimeout(nextTick, 0);
		    };
		  }
		}

		var draining;
		var queue = [];
		//named nextTick for less confusing stack traces
		function nextTick() {
		  draining = true;
		  var i, oldQueue;
		  var len = queue.length;
		  while (len) {
		    oldQueue = queue;
		    queue = [];
		    i = -1;
		    while (++i < len) {
		      oldQueue[i]();
		    }
		    len = queue.length;
		  }
		  draining = false;
		}

		module.exports = immediate;
		function immediate(task) {
		  if (queue.push(task) === 1 && !draining) {
		    scheduleDrain();
		  }
		}

		}).call(this,typeof commonjsGlobal !== "undefined" ? commonjsGlobal : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {});
		},{}],2:[function(_dereq_,module,exports$1){
		var immediate = _dereq_(1);

		/* istanbul ignore next */
		function INTERNAL() {}

		var handlers = {};

		var REJECTED = ['REJECTED'];
		var FULFILLED = ['FULFILLED'];
		var PENDING = ['PENDING'];

		module.exports = Promise;

		function Promise(resolver) {
		  if (typeof resolver !== 'function') {
		    throw new TypeError('resolver must be a function');
		  }
		  this.state = PENDING;
		  this.queue = [];
		  this.outcome = void 0;
		  if (resolver !== INTERNAL) {
		    safelyResolveThenable(this, resolver);
		  }
		}

		Promise.prototype["catch"] = function (onRejected) {
		  return this.then(null, onRejected);
		};
		Promise.prototype.then = function (onFulfilled, onRejected) {
		  if (typeof onFulfilled !== 'function' && this.state === FULFILLED ||
		    typeof onRejected !== 'function' && this.state === REJECTED) {
		    return this;
		  }
		  var promise = new this.constructor(INTERNAL);
		  if (this.state !== PENDING) {
		    var resolver = this.state === FULFILLED ? onFulfilled : onRejected;
		    unwrap(promise, resolver, this.outcome);
		  } else {
		    this.queue.push(new QueueItem(promise, onFulfilled, onRejected));
		  }

		  return promise;
		};
		function QueueItem(promise, onFulfilled, onRejected) {
		  this.promise = promise;
		  if (typeof onFulfilled === 'function') {
		    this.onFulfilled = onFulfilled;
		    this.callFulfilled = this.otherCallFulfilled;
		  }
		  if (typeof onRejected === 'function') {
		    this.onRejected = onRejected;
		    this.callRejected = this.otherCallRejected;
		  }
		}
		QueueItem.prototype.callFulfilled = function (value) {
		  handlers.resolve(this.promise, value);
		};
		QueueItem.prototype.otherCallFulfilled = function (value) {
		  unwrap(this.promise, this.onFulfilled, value);
		};
		QueueItem.prototype.callRejected = function (value) {
		  handlers.reject(this.promise, value);
		};
		QueueItem.prototype.otherCallRejected = function (value) {
		  unwrap(this.promise, this.onRejected, value);
		};

		function unwrap(promise, func, value) {
		  immediate(function () {
		    var returnValue;
		    try {
		      returnValue = func(value);
		    } catch (e) {
		      return handlers.reject(promise, e);
		    }
		    if (returnValue === promise) {
		      handlers.reject(promise, new TypeError('Cannot resolve promise with itself'));
		    } else {
		      handlers.resolve(promise, returnValue);
		    }
		  });
		}

		handlers.resolve = function (self, value) {
		  var result = tryCatch(getThen, value);
		  if (result.status === 'error') {
		    return handlers.reject(self, result.value);
		  }
		  var thenable = result.value;

		  if (thenable) {
		    safelyResolveThenable(self, thenable);
		  } else {
		    self.state = FULFILLED;
		    self.outcome = value;
		    var i = -1;
		    var len = self.queue.length;
		    while (++i < len) {
		      self.queue[i].callFulfilled(value);
		    }
		  }
		  return self;
		};
		handlers.reject = function (self, error) {
		  self.state = REJECTED;
		  self.outcome = error;
		  var i = -1;
		  var len = self.queue.length;
		  while (++i < len) {
		    self.queue[i].callRejected(error);
		  }
		  return self;
		};

		function getThen(obj) {
		  // Make sure we only access the accessor once as required by the spec
		  var then = obj && obj.then;
		  if (obj && (typeof obj === 'object' || typeof obj === 'function') && typeof then === 'function') {
		    return function appyThen() {
		      then.apply(obj, arguments);
		    };
		  }
		}

		function safelyResolveThenable(self, thenable) {
		  // Either fulfill, reject or reject with error
		  var called = false;
		  function onError(value) {
		    if (called) {
		      return;
		    }
		    called = true;
		    handlers.reject(self, value);
		  }

		  function onSuccess(value) {
		    if (called) {
		      return;
		    }
		    called = true;
		    handlers.resolve(self, value);
		  }

		  function tryToUnwrap() {
		    thenable(onSuccess, onError);
		  }

		  var result = tryCatch(tryToUnwrap);
		  if (result.status === 'error') {
		    onError(result.value);
		  }
		}

		function tryCatch(func, value) {
		  var out = {};
		  try {
		    out.value = func(value);
		    out.status = 'success';
		  } catch (e) {
		    out.status = 'error';
		    out.value = e;
		  }
		  return out;
		}

		Promise.resolve = resolve;
		function resolve(value) {
		  if (value instanceof this) {
		    return value;
		  }
		  return handlers.resolve(new this(INTERNAL), value);
		}

		Promise.reject = reject;
		function reject(reason) {
		  var promise = new this(INTERNAL);
		  return handlers.reject(promise, reason);
		}

		Promise.all = all;
		function all(iterable) {
		  var self = this;
		  if (Object.prototype.toString.call(iterable) !== '[object Array]') {
		    return this.reject(new TypeError('must be an array'));
		  }

		  var len = iterable.length;
		  var called = false;
		  if (!len) {
		    return this.resolve([]);
		  }

		  var values = new Array(len);
		  var resolved = 0;
		  var i = -1;
		  var promise = new this(INTERNAL);

		  while (++i < len) {
		    allResolver(iterable[i], i);
		  }
		  return promise;
		  function allResolver(value, i) {
		    self.resolve(value).then(resolveFromAll, function (error) {
		      if (!called) {
		        called = true;
		        handlers.reject(promise, error);
		      }
		    });
		    function resolveFromAll(outValue) {
		      values[i] = outValue;
		      if (++resolved === len && !called) {
		        called = true;
		        handlers.resolve(promise, values);
		      }
		    }
		  }
		}

		Promise.race = race;
		function race(iterable) {
		  var self = this;
		  if (Object.prototype.toString.call(iterable) !== '[object Array]') {
		    return this.reject(new TypeError('must be an array'));
		  }

		  var len = iterable.length;
		  var called = false;
		  if (!len) {
		    return this.resolve([]);
		  }

		  var i = -1;
		  var promise = new this(INTERNAL);

		  while (++i < len) {
		    resolver(iterable[i]);
		  }
		  return promise;
		  function resolver(value) {
		    self.resolve(value).then(function (response) {
		      if (!called) {
		        called = true;
		        handlers.resolve(promise, response);
		      }
		    }, function (error) {
		      if (!called) {
		        called = true;
		        handlers.reject(promise, error);
		      }
		    });
		  }
		}

		},{"1":1}],3:[function(_dereq_,module,exports$1){
		(function (global){
		if (typeof global.Promise !== 'function') {
		  global.Promise = _dereq_(2);
		}

		}).call(this,typeof commonjsGlobal !== "undefined" ? commonjsGlobal : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {});
		},{"2":2}],4:[function(_dereq_,module,exports$1){

		var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

		function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

		function getIDB() {
		    /* global indexedDB,webkitIndexedDB,mozIndexedDB,OIndexedDB,msIndexedDB */
		    try {
		        if (typeof indexedDB !== 'undefined') {
		            return indexedDB;
		        }
		        if (typeof webkitIndexedDB !== 'undefined') {
		            return webkitIndexedDB;
		        }
		        if (typeof mozIndexedDB !== 'undefined') {
		            return mozIndexedDB;
		        }
		        if (typeof OIndexedDB !== 'undefined') {
		            return OIndexedDB;
		        }
		        if (typeof msIndexedDB !== 'undefined') {
		            return msIndexedDB;
		        }
		    } catch (e) {
		        return;
		    }
		}

		var idb = getIDB();

		function isIndexedDBValid() {
		    try {
		        // Initialize IndexedDB; fall back to vendor-prefixed versions
		        // if needed.
		        if (!idb || !idb.open) {
		            return false;
		        }
		        // We mimic PouchDB here;
		        //
		        // We test for openDatabase because IE Mobile identifies itself
		        // as Safari. Oh the lulz...
		        var isSafari = typeof openDatabase !== 'undefined' && /(Safari|iPhone|iPad|iPod)/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent) && !/BlackBerry/.test(navigator.platform);

		        var hasFetch = typeof fetch === 'function' && fetch.toString().indexOf('[native code') !== -1;

		        // Safari <10.1 does not meet our requirements for IDB support
		        // (see: https://github.com/pouchdb/pouchdb/issues/5572).
		        // Safari 10.1 shipped with fetch, we can use that to detect it.
		        // Note: this creates issues with `window.fetch` polyfills and
		        // overrides; see:
		        // https://github.com/localForage/localForage/issues/856
		        return (!isSafari || hasFetch) && typeof indexedDB !== 'undefined' &&
		        // some outdated implementations of IDB that appear on Samsung
		        // and HTC Android devices <4.4 are missing IDBKeyRange
		        // See: https://github.com/mozilla/localForage/issues/128
		        // See: https://github.com/mozilla/localForage/issues/272
		        typeof IDBKeyRange !== 'undefined';
		    } catch (e) {
		        return false;
		    }
		}

		// Abstracts constructing a Blob object, so it also works in older
		// browsers that don't support the native Blob constructor. (i.e.
		// old QtWebKit versions, at least).
		// Abstracts constructing a Blob object, so it also works in older
		// browsers that don't support the native Blob constructor. (i.e.
		// old QtWebKit versions, at least).
		function createBlob(parts, properties) {
		    /* global BlobBuilder,MSBlobBuilder,MozBlobBuilder,WebKitBlobBuilder */
		    parts = parts || [];
		    properties = properties || {};
		    try {
		        return new Blob(parts, properties);
		    } catch (e) {
		        if (e.name !== 'TypeError') {
		            throw e;
		        }
		        var Builder = typeof BlobBuilder !== 'undefined' ? BlobBuilder : typeof MSBlobBuilder !== 'undefined' ? MSBlobBuilder : typeof MozBlobBuilder !== 'undefined' ? MozBlobBuilder : WebKitBlobBuilder;
		        var builder = new Builder();
		        for (var i = 0; i < parts.length; i += 1) {
		            builder.append(parts[i]);
		        }
		        return builder.getBlob(properties.type);
		    }
		}

		// This is CommonJS because lie is an external dependency, so Rollup
		// can just ignore it.
		if (typeof Promise === 'undefined') {
		    // In the "nopromises" build this will just throw if you don't have
		    // a global promise object, but it would throw anyway later.
		    _dereq_(3);
		}
		var Promise$1 = Promise;

		function executeCallback(promise, callback) {
		    if (callback) {
		        promise.then(function (result) {
		            callback(null, result);
		        }, function (error) {
		            callback(error);
		        });
		    }
		}

		function executeTwoCallbacks(promise, callback, errorCallback) {
		    if (typeof callback === 'function') {
		        promise.then(callback);
		    }

		    if (typeof errorCallback === 'function') {
		        promise["catch"](errorCallback);
		    }
		}

		function normalizeKey(key) {
		    // Cast the key to a string, as that's all we can set as a key.
		    if (typeof key !== 'string') {
		        console.warn(key + ' used as a key, but it is not a string.');
		        key = String(key);
		    }

		    return key;
		}

		function getCallback() {
		    if (arguments.length && typeof arguments[arguments.length - 1] === 'function') {
		        return arguments[arguments.length - 1];
		    }
		}

		// Some code originally from async_storage.js in
		// [Gaia](https://github.com/mozilla-b2g/gaia).

		var DETECT_BLOB_SUPPORT_STORE = 'local-forage-detect-blob-support';
		var supportsBlobs = void 0;
		var dbContexts = {};
		var toString = Object.prototype.toString;

		// Transaction Modes
		var READ_ONLY = 'readonly';
		var READ_WRITE = 'readwrite';

		// Transform a binary string to an array buffer, because otherwise
		// weird stuff happens when you try to work with the binary string directly.
		// It is known.
		// From http://stackoverflow.com/questions/14967647/ (continues on next line)
		// encode-decode-image-with-base64-breaks-image (2013-04-21)
		function _binStringToArrayBuffer(bin) {
		    var length = bin.length;
		    var buf = new ArrayBuffer(length);
		    var arr = new Uint8Array(buf);
		    for (var i = 0; i < length; i++) {
		        arr[i] = bin.charCodeAt(i);
		    }
		    return buf;
		}

		//
		// Blobs are not supported in all versions of IndexedDB, notably
		// Chrome <37 and Android <5. In those versions, storing a blob will throw.
		//
		// Various other blob bugs exist in Chrome v37-42 (inclusive).
		// Detecting them is expensive and confusing to users, and Chrome 37-42
		// is at very low usage worldwide, so we do a hacky userAgent check instead.
		//
		// content-type bug: https://code.google.com/p/chromium/issues/detail?id=408120
		// 404 bug: https://code.google.com/p/chromium/issues/detail?id=447916
		// FileReader bug: https://code.google.com/p/chromium/issues/detail?id=447836
		//
		// Code borrowed from PouchDB. See:
		// https://github.com/pouchdb/pouchdb/blob/master/packages/node_modules/pouchdb-adapter-idb/src/blobSupport.js
		//
		function _checkBlobSupportWithoutCaching(idb) {
		    return new Promise$1(function (resolve) {
		        var txn = idb.transaction(DETECT_BLOB_SUPPORT_STORE, READ_WRITE);
		        var blob = createBlob(['']);
		        txn.objectStore(DETECT_BLOB_SUPPORT_STORE).put(blob, 'key');

		        txn.onabort = function (e) {
		            // If the transaction aborts now its due to not being able to
		            // write to the database, likely due to the disk being full
		            e.preventDefault();
		            e.stopPropagation();
		            resolve(false);
		        };

		        txn.oncomplete = function () {
		            var matchedChrome = navigator.userAgent.match(/Chrome\/(\d+)/);
		            var matchedEdge = navigator.userAgent.match(/Edge\//);
		            // MS Edge pretends to be Chrome 42:
		            // https://msdn.microsoft.com/en-us/library/hh869301%28v=vs.85%29.aspx
		            resolve(matchedEdge || !matchedChrome || parseInt(matchedChrome[1], 10) >= 43);
		        };
		    })["catch"](function () {
		        return false; // error, so assume unsupported
		    });
		}

		function _checkBlobSupport(idb) {
		    if (typeof supportsBlobs === 'boolean') {
		        return Promise$1.resolve(supportsBlobs);
		    }
		    return _checkBlobSupportWithoutCaching(idb).then(function (value) {
		        supportsBlobs = value;
		        return supportsBlobs;
		    });
		}

		function _deferReadiness(dbInfo) {
		    var dbContext = dbContexts[dbInfo.name];

		    // Create a deferred object representing the current database operation.
		    var deferredOperation = {};

		    deferredOperation.promise = new Promise$1(function (resolve, reject) {
		        deferredOperation.resolve = resolve;
		        deferredOperation.reject = reject;
		    });

		    // Enqueue the deferred operation.
		    dbContext.deferredOperations.push(deferredOperation);

		    // Chain its promise to the database readiness.
		    if (!dbContext.dbReady) {
		        dbContext.dbReady = deferredOperation.promise;
		    } else {
		        dbContext.dbReady = dbContext.dbReady.then(function () {
		            return deferredOperation.promise;
		        });
		    }
		}

		function _advanceReadiness(dbInfo) {
		    var dbContext = dbContexts[dbInfo.name];

		    // Dequeue a deferred operation.
		    var deferredOperation = dbContext.deferredOperations.pop();

		    // Resolve its promise (which is part of the database readiness
		    // chain of promises).
		    if (deferredOperation) {
		        deferredOperation.resolve();
		        return deferredOperation.promise;
		    }
		}

		function _rejectReadiness(dbInfo, err) {
		    var dbContext = dbContexts[dbInfo.name];

		    // Dequeue a deferred operation.
		    var deferredOperation = dbContext.deferredOperations.pop();

		    // Reject its promise (which is part of the database readiness
		    // chain of promises).
		    if (deferredOperation) {
		        deferredOperation.reject(err);
		        return deferredOperation.promise;
		    }
		}

		function _getConnection(dbInfo, upgradeNeeded) {
		    return new Promise$1(function (resolve, reject) {
		        dbContexts[dbInfo.name] = dbContexts[dbInfo.name] || createDbContext();

		        if (dbInfo.db) {
		            if (upgradeNeeded) {
		                _deferReadiness(dbInfo);
		                dbInfo.db.close();
		            } else {
		                return resolve(dbInfo.db);
		            }
		        }

		        var dbArgs = [dbInfo.name];

		        if (upgradeNeeded) {
		            dbArgs.push(dbInfo.version);
		        }

		        var openreq = idb.open.apply(idb, dbArgs);

		        if (upgradeNeeded) {
		            openreq.onupgradeneeded = function (e) {
		                var db = openreq.result;
		                try {
		                    db.createObjectStore(dbInfo.storeName);
		                    if (e.oldVersion <= 1) {
		                        // Added when support for blob shims was added
		                        db.createObjectStore(DETECT_BLOB_SUPPORT_STORE);
		                    }
		                } catch (ex) {
		                    if (ex.name === 'ConstraintError') {
		                        console.warn('The database "' + dbInfo.name + '"' + ' has been upgraded from version ' + e.oldVersion + ' to version ' + e.newVersion + ', but the storage "' + dbInfo.storeName + '" already exists.');
		                    } else {
		                        throw ex;
		                    }
		                }
		            };
		        }

		        openreq.onerror = function (e) {
		            e.preventDefault();
		            reject(openreq.error);
		        };

		        openreq.onsuccess = function () {
		            var db = openreq.result;
		            db.onversionchange = function (e) {
		                // Triggered when the database is modified (e.g. adding an objectStore) or
		                // deleted (even when initiated by other sessions in different tabs).
		                // Closing the connection here prevents those operations from being blocked.
		                // If the database is accessed again later by this instance, the connection
		                // will be reopened or the database recreated as needed.
		                e.target.close();
		            };
		            resolve(db);
		            _advanceReadiness(dbInfo);
		        };
		    });
		}

		function _getOriginalConnection(dbInfo) {
		    return _getConnection(dbInfo, false);
		}

		function _getUpgradedConnection(dbInfo) {
		    return _getConnection(dbInfo, true);
		}

		function _isUpgradeNeeded(dbInfo, defaultVersion) {
		    if (!dbInfo.db) {
		        return true;
		    }

		    var isNewStore = !dbInfo.db.objectStoreNames.contains(dbInfo.storeName);
		    var isDowngrade = dbInfo.version < dbInfo.db.version;
		    var isUpgrade = dbInfo.version > dbInfo.db.version;

		    if (isDowngrade) {
		        // If the version is not the default one
		        // then warn for impossible downgrade.
		        if (dbInfo.version !== defaultVersion) {
		            console.warn('The database "' + dbInfo.name + '"' + " can't be downgraded from version " + dbInfo.db.version + ' to version ' + dbInfo.version + '.');
		        }
		        // Align the versions to prevent errors.
		        dbInfo.version = dbInfo.db.version;
		    }

		    if (isUpgrade || isNewStore) {
		        // If the store is new then increment the version (if needed).
		        // This will trigger an "upgradeneeded" event which is required
		        // for creating a store.
		        if (isNewStore) {
		            var incVersion = dbInfo.db.version + 1;
		            if (incVersion > dbInfo.version) {
		                dbInfo.version = incVersion;
		            }
		        }

		        return true;
		    }

		    return false;
		}

		// encode a blob for indexeddb engines that don't support blobs
		function _encodeBlob(blob) {
		    return new Promise$1(function (resolve, reject) {
		        var reader = new FileReader();
		        reader.onerror = reject;
		        reader.onloadend = function (e) {
		            var base64 = btoa(e.target.result || '');
		            resolve({
		                __local_forage_encoded_blob: true,
		                data: base64,
		                type: blob.type
		            });
		        };
		        reader.readAsBinaryString(blob);
		    });
		}

		// decode an encoded blob
		function _decodeBlob(encodedBlob) {
		    var arrayBuff = _binStringToArrayBuffer(atob(encodedBlob.data));
		    return createBlob([arrayBuff], { type: encodedBlob.type });
		}

		// is this one of our fancy encoded blobs?
		function _isEncodedBlob(value) {
		    return value && value.__local_forage_encoded_blob;
		}

		// Specialize the default `ready()` function by making it dependent
		// on the current database operations. Thus, the driver will be actually
		// ready when it's been initialized (default) *and* there are no pending
		// operations on the database (initiated by some other instances).
		function _fullyReady(callback) {
		    var self = this;

		    var promise = self._initReady().then(function () {
		        var dbContext = dbContexts[self._dbInfo.name];

		        if (dbContext && dbContext.dbReady) {
		            return dbContext.dbReady;
		        }
		    });

		    executeTwoCallbacks(promise, callback, callback);
		    return promise;
		}

		// Try to establish a new db connection to replace the
		// current one which is broken (i.e. experiencing
		// InvalidStateError while creating a transaction).
		function _tryReconnect(dbInfo) {
		    _deferReadiness(dbInfo);

		    var dbContext = dbContexts[dbInfo.name];
		    var forages = dbContext.forages;

		    for (var i = 0; i < forages.length; i++) {
		        var forage = forages[i];
		        if (forage._dbInfo.db) {
		            forage._dbInfo.db.close();
		            forage._dbInfo.db = null;
		        }
		    }
		    dbInfo.db = null;

		    return _getOriginalConnection(dbInfo).then(function (db) {
		        dbInfo.db = db;
		        if (_isUpgradeNeeded(dbInfo)) {
		            // Reopen the database for upgrading.
		            return _getUpgradedConnection(dbInfo);
		        }
		        return db;
		    }).then(function (db) {
		        // store the latest db reference
		        // in case the db was upgraded
		        dbInfo.db = dbContext.db = db;
		        for (var i = 0; i < forages.length; i++) {
		            forages[i]._dbInfo.db = db;
		        }
		    })["catch"](function (err) {
		        _rejectReadiness(dbInfo, err);
		        throw err;
		    });
		}

		// FF doesn't like Promises (micro-tasks) and IDDB store operations,
		// so we have to do it with callbacks
		function createTransaction(dbInfo, mode, callback, retries) {
		    if (retries === undefined) {
		        retries = 1;
		    }

		    try {
		        var tx = dbInfo.db.transaction(dbInfo.storeName, mode);
		        callback(null, tx);
		    } catch (err) {
		        if (retries > 0 && (!dbInfo.db || err.name === 'InvalidStateError' || err.name === 'NotFoundError')) {
		            return Promise$1.resolve().then(function () {
		                if (!dbInfo.db || err.name === 'NotFoundError' && !dbInfo.db.objectStoreNames.contains(dbInfo.storeName) && dbInfo.version <= dbInfo.db.version) {
		                    // increase the db version, to create the new ObjectStore
		                    if (dbInfo.db) {
		                        dbInfo.version = dbInfo.db.version + 1;
		                    }
		                    // Reopen the database for upgrading.
		                    return _getUpgradedConnection(dbInfo);
		                }
		            }).then(function () {
		                return _tryReconnect(dbInfo).then(function () {
		                    createTransaction(dbInfo, mode, callback, retries - 1);
		                });
		            })["catch"](callback);
		        }

		        callback(err);
		    }
		}

		function createDbContext() {
		    return {
		        // Running localForages sharing a database.
		        forages: [],
		        // Shared database.
		        db: null,
		        // Database readiness (promise).
		        dbReady: null,
		        // Deferred operations on the database.
		        deferredOperations: []
		    };
		}

		// Open the IndexedDB database (automatically creates one if one didn't
		// previously exist), using any options set in the config.
		function _initStorage(options) {
		    var self = this;
		    var dbInfo = {
		        db: null
		    };

		    if (options) {
		        for (var i in options) {
		            dbInfo[i] = options[i];
		        }
		    }

		    // Get the current context of the database;
		    var dbContext = dbContexts[dbInfo.name];

		    // ...or create a new context.
		    if (!dbContext) {
		        dbContext = createDbContext();
		        // Register the new context in the global container.
		        dbContexts[dbInfo.name] = dbContext;
		    }

		    // Register itself as a running localForage in the current context.
		    dbContext.forages.push(self);

		    // Replace the default `ready()` function with the specialized one.
		    if (!self._initReady) {
		        self._initReady = self.ready;
		        self.ready = _fullyReady;
		    }

		    // Create an array of initialization states of the related localForages.
		    var initPromises = [];

		    function ignoreErrors() {
		        // Don't handle errors here,
		        // just makes sure related localForages aren't pending.
		        return Promise$1.resolve();
		    }

		    for (var j = 0; j < dbContext.forages.length; j++) {
		        var forage = dbContext.forages[j];
		        if (forage !== self) {
		            // Don't wait for itself...
		            initPromises.push(forage._initReady()["catch"](ignoreErrors));
		        }
		    }

		    // Take a snapshot of the related localForages.
		    var forages = dbContext.forages.slice(0);

		    // Initialize the connection process only when
		    // all the related localForages aren't pending.
		    return Promise$1.all(initPromises).then(function () {
		        dbInfo.db = dbContext.db;
		        // Get the connection or open a new one without upgrade.
		        return _getOriginalConnection(dbInfo);
		    }).then(function (db) {
		        dbInfo.db = db;
		        if (_isUpgradeNeeded(dbInfo, self._defaultConfig.version)) {
		            // Reopen the database for upgrading.
		            return _getUpgradedConnection(dbInfo);
		        }
		        return db;
		    }).then(function (db) {
		        dbInfo.db = dbContext.db = db;
		        self._dbInfo = dbInfo;
		        // Share the final connection amongst related localForages.
		        for (var k = 0; k < forages.length; k++) {
		            var forage = forages[k];
		            if (forage !== self) {
		                // Self is already up-to-date.
		                forage._dbInfo.db = dbInfo.db;
		                forage._dbInfo.version = dbInfo.version;
		            }
		        }
		    });
		}

		function getItem(key, callback) {
		    var self = this;

		    key = normalizeKey(key);

		    var promise = new Promise$1(function (resolve, reject) {
		        self.ready().then(function () {
		            createTransaction(self._dbInfo, READ_ONLY, function (err, transaction) {
		                if (err) {
		                    return reject(err);
		                }

		                try {
		                    var store = transaction.objectStore(self._dbInfo.storeName);
		                    var req = store.get(key);

		                    req.onsuccess = function () {
		                        var value = req.result;
		                        if (value === undefined) {
		                            value = null;
		                        }
		                        if (_isEncodedBlob(value)) {
		                            value = _decodeBlob(value);
		                        }
		                        resolve(value);
		                    };

		                    req.onerror = function () {
		                        reject(req.error);
		                    };
		                } catch (e) {
		                    reject(e);
		                }
		            });
		        })["catch"](reject);
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		// Iterate over all items stored in database.
		function iterate(iterator, callback) {
		    var self = this;

		    var promise = new Promise$1(function (resolve, reject) {
		        self.ready().then(function () {
		            createTransaction(self._dbInfo, READ_ONLY, function (err, transaction) {
		                if (err) {
		                    return reject(err);
		                }

		                try {
		                    var store = transaction.objectStore(self._dbInfo.storeName);
		                    var req = store.openCursor();
		                    var iterationNumber = 1;

		                    req.onsuccess = function () {
		                        var cursor = req.result;

		                        if (cursor) {
		                            var value = cursor.value;
		                            if (_isEncodedBlob(value)) {
		                                value = _decodeBlob(value);
		                            }
		                            var result = iterator(value, cursor.key, iterationNumber++);

		                            // when the iterator callback returns any
		                            // (non-`undefined`) value, then we stop
		                            // the iteration immediately
		                            if (result !== void 0) {
		                                resolve(result);
		                            } else {
		                                cursor["continue"]();
		                            }
		                        } else {
		                            resolve();
		                        }
		                    };

		                    req.onerror = function () {
		                        reject(req.error);
		                    };
		                } catch (e) {
		                    reject(e);
		                }
		            });
		        })["catch"](reject);
		    });

		    executeCallback(promise, callback);

		    return promise;
		}

		function setItem(key, value, callback) {
		    var self = this;

		    key = normalizeKey(key);

		    var promise = new Promise$1(function (resolve, reject) {
		        var dbInfo;
		        self.ready().then(function () {
		            dbInfo = self._dbInfo;
		            if (toString.call(value) === '[object Blob]') {
		                return _checkBlobSupport(dbInfo.db).then(function (blobSupport) {
		                    if (blobSupport) {
		                        return value;
		                    }
		                    return _encodeBlob(value);
		                });
		            }
		            return value;
		        }).then(function (value) {
		            createTransaction(self._dbInfo, READ_WRITE, function (err, transaction) {
		                if (err) {
		                    return reject(err);
		                }

		                try {
		                    var store = transaction.objectStore(self._dbInfo.storeName);

		                    // The reason we don't _save_ null is because IE 10 does
		                    // not support saving the `null` type in IndexedDB. How
		                    // ironic, given the bug below!
		                    // See: https://github.com/mozilla/localForage/issues/161
		                    if (value === null) {
		                        value = undefined;
		                    }

		                    var req = store.put(value, key);

		                    transaction.oncomplete = function () {
		                        // Cast to undefined so the value passed to
		                        // callback/promise is the same as what one would get out
		                        // of `getItem()` later. This leads to some weirdness
		                        // (setItem('foo', undefined) will return `null`), but
		                        // it's not my fault localStorage is our baseline and that
		                        // it's weird.
		                        if (value === undefined) {
		                            value = null;
		                        }

		                        resolve(value);
		                    };
		                    transaction.onabort = transaction.onerror = function () {
		                        var err = req.error ? req.error : req.transaction.error;
		                        reject(err);
		                    };
		                } catch (e) {
		                    reject(e);
		                }
		            });
		        })["catch"](reject);
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		function removeItem(key, callback) {
		    var self = this;

		    key = normalizeKey(key);

		    var promise = new Promise$1(function (resolve, reject) {
		        self.ready().then(function () {
		            createTransaction(self._dbInfo, READ_WRITE, function (err, transaction) {
		                if (err) {
		                    return reject(err);
		                }

		                try {
		                    var store = transaction.objectStore(self._dbInfo.storeName);
		                    // We use a Grunt task to make this safe for IE and some
		                    // versions of Android (including those used by Cordova).
		                    // Normally IE won't like `.delete()` and will insist on
		                    // using `['delete']()`, but we have a build step that
		                    // fixes this for us now.
		                    var req = store["delete"](key);
		                    transaction.oncomplete = function () {
		                        resolve();
		                    };

		                    transaction.onerror = function () {
		                        reject(req.error);
		                    };

		                    // The request will be also be aborted if we've exceeded our storage
		                    // space.
		                    transaction.onabort = function () {
		                        var err = req.error ? req.error : req.transaction.error;
		                        reject(err);
		                    };
		                } catch (e) {
		                    reject(e);
		                }
		            });
		        })["catch"](reject);
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		function clear(callback) {
		    var self = this;

		    var promise = new Promise$1(function (resolve, reject) {
		        self.ready().then(function () {
		            createTransaction(self._dbInfo, READ_WRITE, function (err, transaction) {
		                if (err) {
		                    return reject(err);
		                }

		                try {
		                    var store = transaction.objectStore(self._dbInfo.storeName);
		                    var req = store.clear();

		                    transaction.oncomplete = function () {
		                        resolve();
		                    };

		                    transaction.onabort = transaction.onerror = function () {
		                        var err = req.error ? req.error : req.transaction.error;
		                        reject(err);
		                    };
		                } catch (e) {
		                    reject(e);
		                }
		            });
		        })["catch"](reject);
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		function length(callback) {
		    var self = this;

		    var promise = new Promise$1(function (resolve, reject) {
		        self.ready().then(function () {
		            createTransaction(self._dbInfo, READ_ONLY, function (err, transaction) {
		                if (err) {
		                    return reject(err);
		                }

		                try {
		                    var store = transaction.objectStore(self._dbInfo.storeName);
		                    var req = store.count();

		                    req.onsuccess = function () {
		                        resolve(req.result);
		                    };

		                    req.onerror = function () {
		                        reject(req.error);
		                    };
		                } catch (e) {
		                    reject(e);
		                }
		            });
		        })["catch"](reject);
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		function key(n, callback) {
		    var self = this;

		    var promise = new Promise$1(function (resolve, reject) {
		        if (n < 0) {
		            resolve(null);

		            return;
		        }

		        self.ready().then(function () {
		            createTransaction(self._dbInfo, READ_ONLY, function (err, transaction) {
		                if (err) {
		                    return reject(err);
		                }

		                try {
		                    var store = transaction.objectStore(self._dbInfo.storeName);
		                    var advanced = false;
		                    var req = store.openKeyCursor();

		                    req.onsuccess = function () {
		                        var cursor = req.result;
		                        if (!cursor) {
		                            // this means there weren't enough keys
		                            resolve(null);

		                            return;
		                        }

		                        if (n === 0) {
		                            // We have the first key, return it if that's what they
		                            // wanted.
		                            resolve(cursor.key);
		                        } else {
		                            if (!advanced) {
		                                // Otherwise, ask the cursor to skip ahead n
		                                // records.
		                                advanced = true;
		                                cursor.advance(n);
		                            } else {
		                                // When we get here, we've got the nth key.
		                                resolve(cursor.key);
		                            }
		                        }
		                    };

		                    req.onerror = function () {
		                        reject(req.error);
		                    };
		                } catch (e) {
		                    reject(e);
		                }
		            });
		        })["catch"](reject);
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		function keys(callback) {
		    var self = this;

		    var promise = new Promise$1(function (resolve, reject) {
		        self.ready().then(function () {
		            createTransaction(self._dbInfo, READ_ONLY, function (err, transaction) {
		                if (err) {
		                    return reject(err);
		                }

		                try {
		                    var store = transaction.objectStore(self._dbInfo.storeName);
		                    var req = store.openKeyCursor();
		                    var keys = [];

		                    req.onsuccess = function () {
		                        var cursor = req.result;

		                        if (!cursor) {
		                            resolve(keys);
		                            return;
		                        }

		                        keys.push(cursor.key);
		                        cursor["continue"]();
		                    };

		                    req.onerror = function () {
		                        reject(req.error);
		                    };
		                } catch (e) {
		                    reject(e);
		                }
		            });
		        })["catch"](reject);
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		function dropInstance(options, callback) {
		    callback = getCallback.apply(this, arguments);

		    var currentConfig = this.config();
		    options = typeof options !== 'function' && options || {};
		    if (!options.name) {
		        options.name = options.name || currentConfig.name;
		        options.storeName = options.storeName || currentConfig.storeName;
		    }

		    var self = this;
		    var promise;
		    if (!options.name) {
		        promise = Promise$1.reject('Invalid arguments');
		    } else {
		        var isCurrentDb = options.name === currentConfig.name && self._dbInfo.db;

		        var dbPromise = isCurrentDb ? Promise$1.resolve(self._dbInfo.db) : _getOriginalConnection(options).then(function (db) {
		            var dbContext = dbContexts[options.name];
		            var forages = dbContext.forages;
		            dbContext.db = db;
		            for (var i = 0; i < forages.length; i++) {
		                forages[i]._dbInfo.db = db;
		            }
		            return db;
		        });

		        if (!options.storeName) {
		            promise = dbPromise.then(function (db) {
		                _deferReadiness(options);

		                var dbContext = dbContexts[options.name];
		                var forages = dbContext.forages;

		                db.close();
		                for (var i = 0; i < forages.length; i++) {
		                    var forage = forages[i];
		                    forage._dbInfo.db = null;
		                }

		                var dropDBPromise = new Promise$1(function (resolve, reject) {
		                    var req = idb.deleteDatabase(options.name);

		                    req.onerror = function () {
		                        var db = req.result;
		                        if (db) {
		                            db.close();
		                        }
		                        reject(req.error);
		                    };

		                    req.onblocked = function () {
		                        // Closing all open connections in onversionchange handler should prevent this situation, but if
		                        // we do get here, it just means the request remains pending - eventually it will succeed or error
		                        console.warn('dropInstance blocked for database "' + options.name + '" until all open connections are closed');
		                    };

		                    req.onsuccess = function () {
		                        var db = req.result;
		                        if (db) {
		                            db.close();
		                        }
		                        resolve(db);
		                    };
		                });

		                return dropDBPromise.then(function (db) {
		                    dbContext.db = db;
		                    for (var i = 0; i < forages.length; i++) {
		                        var _forage = forages[i];
		                        _advanceReadiness(_forage._dbInfo);
		                    }
		                })["catch"](function (err) {
		                    (_rejectReadiness(options, err) || Promise$1.resolve())["catch"](function () {});
		                    throw err;
		                });
		            });
		        } else {
		            promise = dbPromise.then(function (db) {
		                if (!db.objectStoreNames.contains(options.storeName)) {
		                    return;
		                }

		                var newVersion = db.version + 1;

		                _deferReadiness(options);

		                var dbContext = dbContexts[options.name];
		                var forages = dbContext.forages;

		                db.close();
		                for (var i = 0; i < forages.length; i++) {
		                    var forage = forages[i];
		                    forage._dbInfo.db = null;
		                    forage._dbInfo.version = newVersion;
		                }

		                var dropObjectPromise = new Promise$1(function (resolve, reject) {
		                    var req = idb.open(options.name, newVersion);

		                    req.onerror = function (err) {
		                        var db = req.result;
		                        db.close();
		                        reject(err);
		                    };

		                    req.onupgradeneeded = function () {
		                        var db = req.result;
		                        db.deleteObjectStore(options.storeName);
		                    };

		                    req.onsuccess = function () {
		                        var db = req.result;
		                        db.close();
		                        resolve(db);
		                    };
		                });

		                return dropObjectPromise.then(function (db) {
		                    dbContext.db = db;
		                    for (var j = 0; j < forages.length; j++) {
		                        var _forage2 = forages[j];
		                        _forage2._dbInfo.db = db;
		                        _advanceReadiness(_forage2._dbInfo);
		                    }
		                })["catch"](function (err) {
		                    (_rejectReadiness(options, err) || Promise$1.resolve())["catch"](function () {});
		                    throw err;
		                });
		            });
		        }
		    }

		    executeCallback(promise, callback);
		    return promise;
		}

		var asyncStorage = {
		    _driver: 'asyncStorage',
		    _initStorage: _initStorage,
		    _support: isIndexedDBValid(),
		    iterate: iterate,
		    getItem: getItem,
		    setItem: setItem,
		    removeItem: removeItem,
		    clear: clear,
		    length: length,
		    key: key,
		    keys: keys,
		    dropInstance: dropInstance
		};

		function isWebSQLValid() {
		    return typeof openDatabase === 'function';
		}

		// Sadly, the best way to save binary data in WebSQL/localStorage is serializing
		// it to Base64, so this is how we store it to prevent very strange errors with less
		// verbose ways of binary <-> string data storage.
		var BASE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

		var BLOB_TYPE_PREFIX = '~~local_forage_type~';
		var BLOB_TYPE_PREFIX_REGEX = /^~~local_forage_type~([^~]+)~/;

		var SERIALIZED_MARKER = '__lfsc__:';
		var SERIALIZED_MARKER_LENGTH = SERIALIZED_MARKER.length;

		// OMG the serializations!
		var TYPE_ARRAYBUFFER = 'arbf';
		var TYPE_BLOB = 'blob';
		var TYPE_INT8ARRAY = 'si08';
		var TYPE_UINT8ARRAY = 'ui08';
		var TYPE_UINT8CLAMPEDARRAY = 'uic8';
		var TYPE_INT16ARRAY = 'si16';
		var TYPE_INT32ARRAY = 'si32';
		var TYPE_UINT16ARRAY = 'ur16';
		var TYPE_UINT32ARRAY = 'ui32';
		var TYPE_FLOAT32ARRAY = 'fl32';
		var TYPE_FLOAT64ARRAY = 'fl64';
		var TYPE_SERIALIZED_MARKER_LENGTH = SERIALIZED_MARKER_LENGTH + TYPE_ARRAYBUFFER.length;

		var toString$1 = Object.prototype.toString;

		function stringToBuffer(serializedString) {
		    // Fill the string into a ArrayBuffer.
		    var bufferLength = serializedString.length * 0.75;
		    var len = serializedString.length;
		    var i;
		    var p = 0;
		    var encoded1, encoded2, encoded3, encoded4;

		    if (serializedString[serializedString.length - 1] === '=') {
		        bufferLength--;
		        if (serializedString[serializedString.length - 2] === '=') {
		            bufferLength--;
		        }
		    }

		    var buffer = new ArrayBuffer(bufferLength);
		    var bytes = new Uint8Array(buffer);

		    for (i = 0; i < len; i += 4) {
		        encoded1 = BASE_CHARS.indexOf(serializedString[i]);
		        encoded2 = BASE_CHARS.indexOf(serializedString[i + 1]);
		        encoded3 = BASE_CHARS.indexOf(serializedString[i + 2]);
		        encoded4 = BASE_CHARS.indexOf(serializedString[i + 3]);

		        /*jslint bitwise: true */
		        bytes[p++] = encoded1 << 2 | encoded2 >> 4;
		        bytes[p++] = (encoded2 & 15) << 4 | encoded3 >> 2;
		        bytes[p++] = (encoded3 & 3) << 6 | encoded4 & 63;
		    }
		    return buffer;
		}

		// Converts a buffer to a string to store, serialized, in the backend
		// storage library.
		function bufferToString(buffer) {
		    // base64-arraybuffer
		    var bytes = new Uint8Array(buffer);
		    var base64String = '';
		    var i;

		    for (i = 0; i < bytes.length; i += 3) {
		        /*jslint bitwise: true */
		        base64String += BASE_CHARS[bytes[i] >> 2];
		        base64String += BASE_CHARS[(bytes[i] & 3) << 4 | bytes[i + 1] >> 4];
		        base64String += BASE_CHARS[(bytes[i + 1] & 15) << 2 | bytes[i + 2] >> 6];
		        base64String += BASE_CHARS[bytes[i + 2] & 63];
		    }

		    if (bytes.length % 3 === 2) {
		        base64String = base64String.substring(0, base64String.length - 1) + '=';
		    } else if (bytes.length % 3 === 1) {
		        base64String = base64String.substring(0, base64String.length - 2) + '==';
		    }

		    return base64String;
		}

		// Serialize a value, afterwards executing a callback (which usually
		// instructs the `setItem()` callback/promise to be executed). This is how
		// we store binary data with localStorage.
		function serialize(value, callback) {
		    var valueType = '';
		    if (value) {
		        valueType = toString$1.call(value);
		    }

		    // Cannot use `value instanceof ArrayBuffer` or such here, as these
		    // checks fail when running the tests using casper.js...
		    //
		    // TODO: See why those tests fail and use a better solution.
		    if (value && (valueType === '[object ArrayBuffer]' || value.buffer && toString$1.call(value.buffer) === '[object ArrayBuffer]')) {
		        // Convert binary arrays to a string and prefix the string with
		        // a special marker.
		        var buffer;
		        var marker = SERIALIZED_MARKER;

		        if (value instanceof ArrayBuffer) {
		            buffer = value;
		            marker += TYPE_ARRAYBUFFER;
		        } else {
		            buffer = value.buffer;

		            if (valueType === '[object Int8Array]') {
		                marker += TYPE_INT8ARRAY;
		            } else if (valueType === '[object Uint8Array]') {
		                marker += TYPE_UINT8ARRAY;
		            } else if (valueType === '[object Uint8ClampedArray]') {
		                marker += TYPE_UINT8CLAMPEDARRAY;
		            } else if (valueType === '[object Int16Array]') {
		                marker += TYPE_INT16ARRAY;
		            } else if (valueType === '[object Uint16Array]') {
		                marker += TYPE_UINT16ARRAY;
		            } else if (valueType === '[object Int32Array]') {
		                marker += TYPE_INT32ARRAY;
		            } else if (valueType === '[object Uint32Array]') {
		                marker += TYPE_UINT32ARRAY;
		            } else if (valueType === '[object Float32Array]') {
		                marker += TYPE_FLOAT32ARRAY;
		            } else if (valueType === '[object Float64Array]') {
		                marker += TYPE_FLOAT64ARRAY;
		            } else {
		                callback(new Error('Failed to get type for BinaryArray'));
		            }
		        }

		        callback(marker + bufferToString(buffer));
		    } else if (valueType === '[object Blob]') {
		        // Conver the blob to a binaryArray and then to a string.
		        var fileReader = new FileReader();

		        fileReader.onload = function () {
		            // Backwards-compatible prefix for the blob type.
		            var str = BLOB_TYPE_PREFIX + value.type + '~' + bufferToString(this.result);

		            callback(SERIALIZED_MARKER + TYPE_BLOB + str);
		        };

		        fileReader.readAsArrayBuffer(value);
		    } else {
		        try {
		            callback(JSON.stringify(value));
		        } catch (e) {
		            console.error("Couldn't convert value into a JSON string: ", value);

		            callback(null, e);
		        }
		    }
		}

		// Deserialize data we've inserted into a value column/field. We place
		// special markers into our strings to mark them as encoded; this isn't
		// as nice as a meta field, but it's the only sane thing we can do whilst
		// keeping localStorage support intact.
		//
		// Oftentimes this will just deserialize JSON content, but if we have a
		// special marker (SERIALIZED_MARKER, defined above), we will extract
		// some kind of arraybuffer/binary data/typed array out of the string.
		function deserialize(value) {
		    // If we haven't marked this string as being specially serialized (i.e.
		    // something other than serialized JSON), we can just return it and be
		    // done with it.
		    if (value.substring(0, SERIALIZED_MARKER_LENGTH) !== SERIALIZED_MARKER) {
		        return JSON.parse(value);
		    }

		    // The following code deals with deserializing some kind of Blob or
		    // TypedArray. First we separate out the type of data we're dealing
		    // with from the data itself.
		    var serializedString = value.substring(TYPE_SERIALIZED_MARKER_LENGTH);
		    var type = value.substring(SERIALIZED_MARKER_LENGTH, TYPE_SERIALIZED_MARKER_LENGTH);

		    var blobType;
		    // Backwards-compatible blob type serialization strategy.
		    // DBs created with older versions of localForage will simply not have the blob type.
		    if (type === TYPE_BLOB && BLOB_TYPE_PREFIX_REGEX.test(serializedString)) {
		        var matcher = serializedString.match(BLOB_TYPE_PREFIX_REGEX);
		        blobType = matcher[1];
		        serializedString = serializedString.substring(matcher[0].length);
		    }
		    var buffer = stringToBuffer(serializedString);

		    // Return the right type based on the code/type set during
		    // serialization.
		    switch (type) {
		        case TYPE_ARRAYBUFFER:
		            return buffer;
		        case TYPE_BLOB:
		            return createBlob([buffer], { type: blobType });
		        case TYPE_INT8ARRAY:
		            return new Int8Array(buffer);
		        case TYPE_UINT8ARRAY:
		            return new Uint8Array(buffer);
		        case TYPE_UINT8CLAMPEDARRAY:
		            return new Uint8ClampedArray(buffer);
		        case TYPE_INT16ARRAY:
		            return new Int16Array(buffer);
		        case TYPE_UINT16ARRAY:
		            return new Uint16Array(buffer);
		        case TYPE_INT32ARRAY:
		            return new Int32Array(buffer);
		        case TYPE_UINT32ARRAY:
		            return new Uint32Array(buffer);
		        case TYPE_FLOAT32ARRAY:
		            return new Float32Array(buffer);
		        case TYPE_FLOAT64ARRAY:
		            return new Float64Array(buffer);
		        default:
		            throw new Error('Unkown type: ' + type);
		    }
		}

		var localforageSerializer = {
		    serialize: serialize,
		    deserialize: deserialize,
		    stringToBuffer: stringToBuffer,
		    bufferToString: bufferToString
		};

		/*
		 * Includes code from:
		 *
		 * base64-arraybuffer
		 * https://github.com/niklasvh/base64-arraybuffer
		 *
		 * Copyright (c) 2012 Niklas von Hertzen
		 * Licensed under the MIT license.
		 */

		function createDbTable(t, dbInfo, callback, errorCallback) {
		    t.executeSql('CREATE TABLE IF NOT EXISTS ' + dbInfo.storeName + ' ' + '(id INTEGER PRIMARY KEY, key unique, value)', [], callback, errorCallback);
		}

		// Open the WebSQL database (automatically creates one if one didn't
		// previously exist), using any options set in the config.
		function _initStorage$1(options) {
		    var self = this;
		    var dbInfo = {
		        db: null
		    };

		    if (options) {
		        for (var i in options) {
		            dbInfo[i] = typeof options[i] !== 'string' ? options[i].toString() : options[i];
		        }
		    }

		    var dbInfoPromise = new Promise$1(function (resolve, reject) {
		        // Open the database; the openDatabase API will automatically
		        // create it for us if it doesn't exist.
		        try {
		            dbInfo.db = openDatabase(dbInfo.name, String(dbInfo.version), dbInfo.description, dbInfo.size);
		        } catch (e) {
		            return reject(e);
		        }

		        // Create our key/value table if it doesn't exist.
		        dbInfo.db.transaction(function (t) {
		            createDbTable(t, dbInfo, function () {
		                self._dbInfo = dbInfo;
		                resolve();
		            }, function (t, error) {
		                reject(error);
		            });
		        }, reject);
		    });

		    dbInfo.serializer = localforageSerializer;
		    return dbInfoPromise;
		}

		function tryExecuteSql(t, dbInfo, sqlStatement, args, callback, errorCallback) {
		    t.executeSql(sqlStatement, args, callback, function (t, error) {
		        if (error.code === error.SYNTAX_ERR) {
		            t.executeSql('SELECT name FROM sqlite_master ' + "WHERE type='table' AND name = ?", [dbInfo.storeName], function (t, results) {
		                if (!results.rows.length) {
		                    // if the table is missing (was deleted)
		                    // re-create it table and retry
		                    createDbTable(t, dbInfo, function () {
		                        t.executeSql(sqlStatement, args, callback, errorCallback);
		                    }, errorCallback);
		                } else {
		                    errorCallback(t, error);
		                }
		            }, errorCallback);
		        } else {
		            errorCallback(t, error);
		        }
		    }, errorCallback);
		}

		function getItem$1(key, callback) {
		    var self = this;

		    key = normalizeKey(key);

		    var promise = new Promise$1(function (resolve, reject) {
		        self.ready().then(function () {
		            var dbInfo = self._dbInfo;
		            dbInfo.db.transaction(function (t) {
		                tryExecuteSql(t, dbInfo, 'SELECT * FROM ' + dbInfo.storeName + ' WHERE key = ? LIMIT 1', [key], function (t, results) {
		                    var result = results.rows.length ? results.rows.item(0).value : null;

		                    // Check to see if this is serialized content we need to
		                    // unpack.
		                    if (result) {
		                        result = dbInfo.serializer.deserialize(result);
		                    }

		                    resolve(result);
		                }, function (t, error) {
		                    reject(error);
		                });
		            });
		        })["catch"](reject);
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		function iterate$1(iterator, callback) {
		    var self = this;

		    var promise = new Promise$1(function (resolve, reject) {
		        self.ready().then(function () {
		            var dbInfo = self._dbInfo;

		            dbInfo.db.transaction(function (t) {
		                tryExecuteSql(t, dbInfo, 'SELECT * FROM ' + dbInfo.storeName, [], function (t, results) {
		                    var rows = results.rows;
		                    var length = rows.length;

		                    for (var i = 0; i < length; i++) {
		                        var item = rows.item(i);
		                        var result = item.value;

		                        // Check to see if this is serialized content
		                        // we need to unpack.
		                        if (result) {
		                            result = dbInfo.serializer.deserialize(result);
		                        }

		                        result = iterator(result, item.key, i + 1);

		                        // void(0) prevents problems with redefinition
		                        // of `undefined`.
		                        if (result !== void 0) {
		                            resolve(result);
		                            return;
		                        }
		                    }

		                    resolve();
		                }, function (t, error) {
		                    reject(error);
		                });
		            });
		        })["catch"](reject);
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		function _setItem(key, value, callback, retriesLeft) {
		    var self = this;

		    key = normalizeKey(key);

		    var promise = new Promise$1(function (resolve, reject) {
		        self.ready().then(function () {
		            // The localStorage API doesn't return undefined values in an
		            // "expected" way, so undefined is always cast to null in all
		            // drivers. See: https://github.com/mozilla/localForage/pull/42
		            if (value === undefined) {
		                value = null;
		            }

		            // Save the original value to pass to the callback.
		            var originalValue = value;

		            var dbInfo = self._dbInfo;
		            dbInfo.serializer.serialize(value, function (value, error) {
		                if (error) {
		                    reject(error);
		                } else {
		                    dbInfo.db.transaction(function (t) {
		                        tryExecuteSql(t, dbInfo, 'INSERT OR REPLACE INTO ' + dbInfo.storeName + ' ' + '(key, value) VALUES (?, ?)', [key, value], function () {
		                            resolve(originalValue);
		                        }, function (t, error) {
		                            reject(error);
		                        });
		                    }, function (sqlError) {
		                        // The transaction failed; check
		                        // to see if it's a quota error.
		                        if (sqlError.code === sqlError.QUOTA_ERR) {
		                            // We reject the callback outright for now, but
		                            // it's worth trying to re-run the transaction.
		                            // Even if the user accepts the prompt to use
		                            // more storage on Safari, this error will
		                            // be called.
		                            //
		                            // Try to re-run the transaction.
		                            if (retriesLeft > 0) {
		                                resolve(_setItem.apply(self, [key, originalValue, callback, retriesLeft - 1]));
		                                return;
		                            }
		                            reject(sqlError);
		                        }
		                    });
		                }
		            });
		        })["catch"](reject);
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		function setItem$1(key, value, callback) {
		    return _setItem.apply(this, [key, value, callback, 1]);
		}

		function removeItem$1(key, callback) {
		    var self = this;

		    key = normalizeKey(key);

		    var promise = new Promise$1(function (resolve, reject) {
		        self.ready().then(function () {
		            var dbInfo = self._dbInfo;
		            dbInfo.db.transaction(function (t) {
		                tryExecuteSql(t, dbInfo, 'DELETE FROM ' + dbInfo.storeName + ' WHERE key = ?', [key], function () {
		                    resolve();
		                }, function (t, error) {
		                    reject(error);
		                });
		            });
		        })["catch"](reject);
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		// Deletes every item in the table.
		// TODO: Find out if this resets the AUTO_INCREMENT number.
		function clear$1(callback) {
		    var self = this;

		    var promise = new Promise$1(function (resolve, reject) {
		        self.ready().then(function () {
		            var dbInfo = self._dbInfo;
		            dbInfo.db.transaction(function (t) {
		                tryExecuteSql(t, dbInfo, 'DELETE FROM ' + dbInfo.storeName, [], function () {
		                    resolve();
		                }, function (t, error) {
		                    reject(error);
		                });
		            });
		        })["catch"](reject);
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		// Does a simple `COUNT(key)` to get the number of items stored in
		// localForage.
		function length$1(callback) {
		    var self = this;

		    var promise = new Promise$1(function (resolve, reject) {
		        self.ready().then(function () {
		            var dbInfo = self._dbInfo;
		            dbInfo.db.transaction(function (t) {
		                // Ahhh, SQL makes this one soooooo easy.
		                tryExecuteSql(t, dbInfo, 'SELECT COUNT(key) as c FROM ' + dbInfo.storeName, [], function (t, results) {
		                    var result = results.rows.item(0).c;
		                    resolve(result);
		                }, function (t, error) {
		                    reject(error);
		                });
		            });
		        })["catch"](reject);
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		// Return the key located at key index X; essentially gets the key from a
		// `WHERE id = ?`. This is the most efficient way I can think to implement
		// this rarely-used (in my experience) part of the API, but it can seem
		// inconsistent, because we do `INSERT OR REPLACE INTO` on `setItem()`, so
		// the ID of each key will change every time it's updated. Perhaps a stored
		// procedure for the `setItem()` SQL would solve this problem?
		// TODO: Don't change ID on `setItem()`.
		function key$1(n, callback) {
		    var self = this;

		    var promise = new Promise$1(function (resolve, reject) {
		        self.ready().then(function () {
		            var dbInfo = self._dbInfo;
		            dbInfo.db.transaction(function (t) {
		                tryExecuteSql(t, dbInfo, 'SELECT key FROM ' + dbInfo.storeName + ' WHERE id = ? LIMIT 1', [n + 1], function (t, results) {
		                    var result = results.rows.length ? results.rows.item(0).key : null;
		                    resolve(result);
		                }, function (t, error) {
		                    reject(error);
		                });
		            });
		        })["catch"](reject);
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		function keys$1(callback) {
		    var self = this;

		    var promise = new Promise$1(function (resolve, reject) {
		        self.ready().then(function () {
		            var dbInfo = self._dbInfo;
		            dbInfo.db.transaction(function (t) {
		                tryExecuteSql(t, dbInfo, 'SELECT key FROM ' + dbInfo.storeName, [], function (t, results) {
		                    var keys = [];

		                    for (var i = 0; i < results.rows.length; i++) {
		                        keys.push(results.rows.item(i).key);
		                    }

		                    resolve(keys);
		                }, function (t, error) {
		                    reject(error);
		                });
		            });
		        })["catch"](reject);
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		// https://www.w3.org/TR/webdatabase/#databases
		// > There is no way to enumerate or delete the databases available for an origin from this API.
		function getAllStoreNames(db) {
		    return new Promise$1(function (resolve, reject) {
		        db.transaction(function (t) {
		            t.executeSql('SELECT name FROM sqlite_master ' + "WHERE type='table' AND name <> '__WebKitDatabaseInfoTable__'", [], function (t, results) {
		                var storeNames = [];

		                for (var i = 0; i < results.rows.length; i++) {
		                    storeNames.push(results.rows.item(i).name);
		                }

		                resolve({
		                    db: db,
		                    storeNames: storeNames
		                });
		            }, function (t, error) {
		                reject(error);
		            });
		        }, function (sqlError) {
		            reject(sqlError);
		        });
		    });
		}

		function dropInstance$1(options, callback) {
		    callback = getCallback.apply(this, arguments);

		    var currentConfig = this.config();
		    options = typeof options !== 'function' && options || {};
		    if (!options.name) {
		        options.name = options.name || currentConfig.name;
		        options.storeName = options.storeName || currentConfig.storeName;
		    }

		    var self = this;
		    var promise;
		    if (!options.name) {
		        promise = Promise$1.reject('Invalid arguments');
		    } else {
		        promise = new Promise$1(function (resolve) {
		            var db;
		            if (options.name === currentConfig.name) {
		                // use the db reference of the current instance
		                db = self._dbInfo.db;
		            } else {
		                db = openDatabase(options.name, '', '', 0);
		            }

		            if (!options.storeName) {
		                // drop all database tables
		                resolve(getAllStoreNames(db));
		            } else {
		                resolve({
		                    db: db,
		                    storeNames: [options.storeName]
		                });
		            }
		        }).then(function (operationInfo) {
		            return new Promise$1(function (resolve, reject) {
		                operationInfo.db.transaction(function (t) {
		                    function dropTable(storeName) {
		                        return new Promise$1(function (resolve, reject) {
		                            t.executeSql('DROP TABLE IF EXISTS ' + storeName, [], function () {
		                                resolve();
		                            }, function (t, error) {
		                                reject(error);
		                            });
		                        });
		                    }

		                    var operations = [];
		                    for (var i = 0, len = operationInfo.storeNames.length; i < len; i++) {
		                        operations.push(dropTable(operationInfo.storeNames[i]));
		                    }

		                    Promise$1.all(operations).then(function () {
		                        resolve();
		                    })["catch"](function (e) {
		                        reject(e);
		                    });
		                }, function (sqlError) {
		                    reject(sqlError);
		                });
		            });
		        });
		    }

		    executeCallback(promise, callback);
		    return promise;
		}

		var webSQLStorage = {
		    _driver: 'webSQLStorage',
		    _initStorage: _initStorage$1,
		    _support: isWebSQLValid(),
		    iterate: iterate$1,
		    getItem: getItem$1,
		    setItem: setItem$1,
		    removeItem: removeItem$1,
		    clear: clear$1,
		    length: length$1,
		    key: key$1,
		    keys: keys$1,
		    dropInstance: dropInstance$1
		};

		function isLocalStorageValid() {
		    try {
		        return typeof localStorage !== 'undefined' && 'setItem' in localStorage &&
		        // in IE8 typeof localStorage.setItem === 'object'
		        !!localStorage.setItem;
		    } catch (e) {
		        return false;
		    }
		}

		function _getKeyPrefix(options, defaultConfig) {
		    var keyPrefix = options.name + '/';

		    if (options.storeName !== defaultConfig.storeName) {
		        keyPrefix += options.storeName + '/';
		    }
		    return keyPrefix;
		}

		// Check if localStorage throws when saving an item
		function checkIfLocalStorageThrows() {
		    var localStorageTestKey = '_localforage_support_test';

		    try {
		        localStorage.setItem(localStorageTestKey, true);
		        localStorage.removeItem(localStorageTestKey);

		        return false;
		    } catch (e) {
		        return true;
		    }
		}

		// Check if localStorage is usable and allows to save an item
		// This method checks if localStorage is usable in Safari Private Browsing
		// mode, or in any other case where the available quota for localStorage
		// is 0 and there wasn't any saved items yet.
		function _isLocalStorageUsable() {
		    return !checkIfLocalStorageThrows() || localStorage.length > 0;
		}

		// Config the localStorage backend, using options set in the config.
		function _initStorage$2(options) {
		    var self = this;
		    var dbInfo = {};
		    if (options) {
		        for (var i in options) {
		            dbInfo[i] = options[i];
		        }
		    }

		    dbInfo.keyPrefix = _getKeyPrefix(options, self._defaultConfig);

		    if (!_isLocalStorageUsable()) {
		        return Promise$1.reject();
		    }

		    self._dbInfo = dbInfo;
		    dbInfo.serializer = localforageSerializer;

		    return Promise$1.resolve();
		}

		// Remove all keys from the datastore, effectively destroying all data in
		// the app's key/value store!
		function clear$2(callback) {
		    var self = this;
		    var promise = self.ready().then(function () {
		        var keyPrefix = self._dbInfo.keyPrefix;

		        for (var i = localStorage.length - 1; i >= 0; i--) {
		            var key = localStorage.key(i);

		            if (key.indexOf(keyPrefix) === 0) {
		                localStorage.removeItem(key);
		            }
		        }
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		// Retrieve an item from the store. Unlike the original async_storage
		// library in Gaia, we don't modify return values at all. If a key's value
		// is `undefined`, we pass that value to the callback function.
		function getItem$2(key, callback) {
		    var self = this;

		    key = normalizeKey(key);

		    var promise = self.ready().then(function () {
		        var dbInfo = self._dbInfo;
		        var result = localStorage.getItem(dbInfo.keyPrefix + key);

		        // If a result was found, parse it from the serialized
		        // string into a JS object. If result isn't truthy, the key
		        // is likely undefined and we'll pass it straight to the
		        // callback.
		        if (result) {
		            result = dbInfo.serializer.deserialize(result);
		        }

		        return result;
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		// Iterate over all items in the store.
		function iterate$2(iterator, callback) {
		    var self = this;

		    var promise = self.ready().then(function () {
		        var dbInfo = self._dbInfo;
		        var keyPrefix = dbInfo.keyPrefix;
		        var keyPrefixLength = keyPrefix.length;
		        var length = localStorage.length;

		        // We use a dedicated iterator instead of the `i` variable below
		        // so other keys we fetch in localStorage aren't counted in
		        // the `iterationNumber` argument passed to the `iterate()`
		        // callback.
		        //
		        // See: github.com/mozilla/localForage/pull/435#discussion_r38061530
		        var iterationNumber = 1;

		        for (var i = 0; i < length; i++) {
		            var key = localStorage.key(i);
		            if (key.indexOf(keyPrefix) !== 0) {
		                continue;
		            }
		            var value = localStorage.getItem(key);

		            // If a result was found, parse it from the serialized
		            // string into a JS object. If result isn't truthy, the
		            // key is likely undefined and we'll pass it straight
		            // to the iterator.
		            if (value) {
		                value = dbInfo.serializer.deserialize(value);
		            }

		            value = iterator(value, key.substring(keyPrefixLength), iterationNumber++);

		            if (value !== void 0) {
		                return value;
		            }
		        }
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		// Same as localStorage's key() method, except takes a callback.
		function key$2(n, callback) {
		    var self = this;
		    var promise = self.ready().then(function () {
		        var dbInfo = self._dbInfo;
		        var result;
		        try {
		            result = localStorage.key(n);
		        } catch (error) {
		            result = null;
		        }

		        // Remove the prefix from the key, if a key is found.
		        if (result) {
		            result = result.substring(dbInfo.keyPrefix.length);
		        }

		        return result;
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		function keys$2(callback) {
		    var self = this;
		    var promise = self.ready().then(function () {
		        var dbInfo = self._dbInfo;
		        var length = localStorage.length;
		        var keys = [];

		        for (var i = 0; i < length; i++) {
		            var itemKey = localStorage.key(i);
		            if (itemKey.indexOf(dbInfo.keyPrefix) === 0) {
		                keys.push(itemKey.substring(dbInfo.keyPrefix.length));
		            }
		        }

		        return keys;
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		// Supply the number of keys in the datastore to the callback function.
		function length$2(callback) {
		    var self = this;
		    var promise = self.keys().then(function (keys) {
		        return keys.length;
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		// Remove an item from the store, nice and simple.
		function removeItem$2(key, callback) {
		    var self = this;

		    key = normalizeKey(key);

		    var promise = self.ready().then(function () {
		        var dbInfo = self._dbInfo;
		        localStorage.removeItem(dbInfo.keyPrefix + key);
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		// Set a key's value and run an optional callback once the value is set.
		// Unlike Gaia's implementation, the callback function is passed the value,
		// in case you want to operate on that value only after you're sure it
		// saved, or something like that.
		function setItem$2(key, value, callback) {
		    var self = this;

		    key = normalizeKey(key);

		    var promise = self.ready().then(function () {
		        // Convert undefined values to null.
		        // https://github.com/mozilla/localForage/pull/42
		        if (value === undefined) {
		            value = null;
		        }

		        // Save the original value to pass to the callback.
		        var originalValue = value;

		        return new Promise$1(function (resolve, reject) {
		            var dbInfo = self._dbInfo;
		            dbInfo.serializer.serialize(value, function (value, error) {
		                if (error) {
		                    reject(error);
		                } else {
		                    try {
		                        localStorage.setItem(dbInfo.keyPrefix + key, value);
		                        resolve(originalValue);
		                    } catch (e) {
		                        // localStorage capacity exceeded.
		                        // TODO: Make this a specific error/event.
		                        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
		                            reject(e);
		                        }
		                        reject(e);
		                    }
		                }
		            });
		        });
		    });

		    executeCallback(promise, callback);
		    return promise;
		}

		function dropInstance$2(options, callback) {
		    callback = getCallback.apply(this, arguments);

		    options = typeof options !== 'function' && options || {};
		    if (!options.name) {
		        var currentConfig = this.config();
		        options.name = options.name || currentConfig.name;
		        options.storeName = options.storeName || currentConfig.storeName;
		    }

		    var self = this;
		    var promise;
		    if (!options.name) {
		        promise = Promise$1.reject('Invalid arguments');
		    } else {
		        promise = new Promise$1(function (resolve) {
		            if (!options.storeName) {
		                resolve(options.name + '/');
		            } else {
		                resolve(_getKeyPrefix(options, self._defaultConfig));
		            }
		        }).then(function (keyPrefix) {
		            for (var i = localStorage.length - 1; i >= 0; i--) {
		                var key = localStorage.key(i);

		                if (key.indexOf(keyPrefix) === 0) {
		                    localStorage.removeItem(key);
		                }
		            }
		        });
		    }

		    executeCallback(promise, callback);
		    return promise;
		}

		var localStorageWrapper = {
		    _driver: 'localStorageWrapper',
		    _initStorage: _initStorage$2,
		    _support: isLocalStorageValid(),
		    iterate: iterate$2,
		    getItem: getItem$2,
		    setItem: setItem$2,
		    removeItem: removeItem$2,
		    clear: clear$2,
		    length: length$2,
		    key: key$2,
		    keys: keys$2,
		    dropInstance: dropInstance$2
		};

		var sameValue = function sameValue(x, y) {
		    return x === y || typeof x === 'number' && typeof y === 'number' && isNaN(x) && isNaN(y);
		};

		var includes = function includes(array, searchElement) {
		    var len = array.length;
		    var i = 0;
		    while (i < len) {
		        if (sameValue(array[i], searchElement)) {
		            return true;
		        }
		        i++;
		    }

		    return false;
		};

		var isArray = Array.isArray || function (arg) {
		    return Object.prototype.toString.call(arg) === '[object Array]';
		};

		// Drivers are stored here when `defineDriver()` is called.
		// They are shared across all instances of localForage.
		var DefinedDrivers = {};

		var DriverSupport = {};

		var DefaultDrivers = {
		    INDEXEDDB: asyncStorage,
		    WEBSQL: webSQLStorage,
		    LOCALSTORAGE: localStorageWrapper
		};

		var DefaultDriverOrder = [DefaultDrivers.INDEXEDDB._driver, DefaultDrivers.WEBSQL._driver, DefaultDrivers.LOCALSTORAGE._driver];

		var OptionalDriverMethods = ['dropInstance'];

		var LibraryMethods = ['clear', 'getItem', 'iterate', 'key', 'keys', 'length', 'removeItem', 'setItem'].concat(OptionalDriverMethods);

		var DefaultConfig = {
		    description: '',
		    driver: DefaultDriverOrder.slice(),
		    name: 'localforage',
		    // Default DB size is _JUST UNDER_ 5MB, as it's the highest size
		    // we can use without a prompt.
		    size: 4980736,
		    storeName: 'keyvaluepairs',
		    version: 1.0
		};

		function callWhenReady(localForageInstance, libraryMethod) {
		    localForageInstance[libraryMethod] = function () {
		        var _args = arguments;
		        return localForageInstance.ready().then(function () {
		            return localForageInstance[libraryMethod].apply(localForageInstance, _args);
		        });
		    };
		}

		function extend() {
		    for (var i = 1; i < arguments.length; i++) {
		        var arg = arguments[i];

		        if (arg) {
		            for (var _key in arg) {
		                if (arg.hasOwnProperty(_key)) {
		                    if (isArray(arg[_key])) {
		                        arguments[0][_key] = arg[_key].slice();
		                    } else {
		                        arguments[0][_key] = arg[_key];
		                    }
		                }
		            }
		        }
		    }

		    return arguments[0];
		}

		var LocalForage = function () {
		    function LocalForage(options) {
		        _classCallCheck(this, LocalForage);

		        for (var driverTypeKey in DefaultDrivers) {
		            if (DefaultDrivers.hasOwnProperty(driverTypeKey)) {
		                var driver = DefaultDrivers[driverTypeKey];
		                var driverName = driver._driver;
		                this[driverTypeKey] = driverName;

		                if (!DefinedDrivers[driverName]) {
		                    // we don't need to wait for the promise,
		                    // since the default drivers can be defined
		                    // in a blocking manner
		                    this.defineDriver(driver);
		                }
		            }
		        }

		        this._defaultConfig = extend({}, DefaultConfig);
		        this._config = extend({}, this._defaultConfig, options);
		        this._driverSet = null;
		        this._initDriver = null;
		        this._ready = false;
		        this._dbInfo = null;

		        this._wrapLibraryMethodsWithReady();
		        this.setDriver(this._config.driver)["catch"](function () {});
		    }

		    // Set any config values for localForage; can be called anytime before
		    // the first API call (e.g. `getItem`, `setItem`).
		    // We loop through options so we don't overwrite existing config
		    // values.


		    LocalForage.prototype.config = function config(options) {
		        // If the options argument is an object, we use it to set values.
		        // Otherwise, we return either a specified config value or all
		        // config values.
		        if ((typeof options === 'undefined' ? 'undefined' : _typeof(options)) === 'object') {
		            // If localforage is ready and fully initialized, we can't set
		            // any new configuration values. Instead, we return an error.
		            if (this._ready) {
		                return new Error("Can't call config() after localforage " + 'has been used.');
		            }

		            for (var i in options) {
		                if (i === 'storeName') {
		                    options[i] = options[i].replace(/\W/g, '_');
		                }

		                if (i === 'version' && typeof options[i] !== 'number') {
		                    return new Error('Database version must be a number.');
		                }

		                this._config[i] = options[i];
		            }

		            // after all config options are set and
		            // the driver option is used, try setting it
		            if ('driver' in options && options.driver) {
		                return this.setDriver(this._config.driver);
		            }

		            return true;
		        } else if (typeof options === 'string') {
		            return this._config[options];
		        } else {
		            return this._config;
		        }
		    };

		    // Used to define a custom driver, shared across all instances of
		    // localForage.


		    LocalForage.prototype.defineDriver = function defineDriver(driverObject, callback, errorCallback) {
		        var promise = new Promise$1(function (resolve, reject) {
		            try {
		                var driverName = driverObject._driver;
		                var complianceError = new Error('Custom driver not compliant; see ' + 'https://mozilla.github.io/localForage/#definedriver');

		                // A driver name should be defined and not overlap with the
		                // library-defined, default drivers.
		                if (!driverObject._driver) {
		                    reject(complianceError);
		                    return;
		                }

		                var driverMethods = LibraryMethods.concat('_initStorage');
		                for (var i = 0, len = driverMethods.length; i < len; i++) {
		                    var driverMethodName = driverMethods[i];

		                    // when the property is there,
		                    // it should be a method even when optional
		                    var isRequired = !includes(OptionalDriverMethods, driverMethodName);
		                    if ((isRequired || driverObject[driverMethodName]) && typeof driverObject[driverMethodName] !== 'function') {
		                        reject(complianceError);
		                        return;
		                    }
		                }

		                var configureMissingMethods = function configureMissingMethods() {
		                    var methodNotImplementedFactory = function methodNotImplementedFactory(methodName) {
		                        return function () {
		                            var error = new Error('Method ' + methodName + ' is not implemented by the current driver');
		                            var promise = Promise$1.reject(error);
		                            executeCallback(promise, arguments[arguments.length - 1]);
		                            return promise;
		                        };
		                    };

		                    for (var _i = 0, _len = OptionalDriverMethods.length; _i < _len; _i++) {
		                        var optionalDriverMethod = OptionalDriverMethods[_i];
		                        if (!driverObject[optionalDriverMethod]) {
		                            driverObject[optionalDriverMethod] = methodNotImplementedFactory(optionalDriverMethod);
		                        }
		                    }
		                };

		                configureMissingMethods();

		                var setDriverSupport = function setDriverSupport(support) {
		                    if (DefinedDrivers[driverName]) {
		                        console.info('Redefining LocalForage driver: ' + driverName);
		                    }
		                    DefinedDrivers[driverName] = driverObject;
		                    DriverSupport[driverName] = support;
		                    // don't use a then, so that we can define
		                    // drivers that have simple _support methods
		                    // in a blocking manner
		                    resolve();
		                };

		                if ('_support' in driverObject) {
		                    if (driverObject._support && typeof driverObject._support === 'function') {
		                        driverObject._support().then(setDriverSupport, reject);
		                    } else {
		                        setDriverSupport(!!driverObject._support);
		                    }
		                } else {
		                    setDriverSupport(true);
		                }
		            } catch (e) {
		                reject(e);
		            }
		        });

		        executeTwoCallbacks(promise, callback, errorCallback);
		        return promise;
		    };

		    LocalForage.prototype.driver = function driver() {
		        return this._driver || null;
		    };

		    LocalForage.prototype.getDriver = function getDriver(driverName, callback, errorCallback) {
		        var getDriverPromise = DefinedDrivers[driverName] ? Promise$1.resolve(DefinedDrivers[driverName]) : Promise$1.reject(new Error('Driver not found.'));

		        executeTwoCallbacks(getDriverPromise, callback, errorCallback);
		        return getDriverPromise;
		    };

		    LocalForage.prototype.getSerializer = function getSerializer(callback) {
		        var serializerPromise = Promise$1.resolve(localforageSerializer);
		        executeTwoCallbacks(serializerPromise, callback);
		        return serializerPromise;
		    };

		    LocalForage.prototype.ready = function ready(callback) {
		        var self = this;

		        var promise = self._driverSet.then(function () {
		            if (self._ready === null) {
		                self._ready = self._initDriver();
		            }

		            return self._ready;
		        });

		        executeTwoCallbacks(promise, callback, callback);
		        return promise;
		    };

		    LocalForage.prototype.setDriver = function setDriver(drivers, callback, errorCallback) {
		        var self = this;

		        if (!isArray(drivers)) {
		            drivers = [drivers];
		        }

		        var supportedDrivers = this._getSupportedDrivers(drivers);

		        function setDriverToConfig() {
		            self._config.driver = self.driver();
		        }

		        function extendSelfWithDriver(driver) {
		            self._extend(driver);
		            setDriverToConfig();

		            self._ready = self._initStorage(self._config);
		            return self._ready;
		        }

		        function initDriver(supportedDrivers) {
		            return function () {
		                var currentDriverIndex = 0;

		                function driverPromiseLoop() {
		                    while (currentDriverIndex < supportedDrivers.length) {
		                        var driverName = supportedDrivers[currentDriverIndex];
		                        currentDriverIndex++;

		                        self._dbInfo = null;
		                        self._ready = null;

		                        return self.getDriver(driverName).then(extendSelfWithDriver)["catch"](driverPromiseLoop);
		                    }

		                    setDriverToConfig();
		                    var error = new Error('No available storage method found.');
		                    self._driverSet = Promise$1.reject(error);
		                    return self._driverSet;
		                }

		                return driverPromiseLoop();
		            };
		        }

		        // There might be a driver initialization in progress
		        // so wait for it to finish in order to avoid a possible
		        // race condition to set _dbInfo
		        var oldDriverSetDone = this._driverSet !== null ? this._driverSet["catch"](function () {
		            return Promise$1.resolve();
		        }) : Promise$1.resolve();

		        this._driverSet = oldDriverSetDone.then(function () {
		            var driverName = supportedDrivers[0];
		            self._dbInfo = null;
		            self._ready = null;

		            return self.getDriver(driverName).then(function (driver) {
		                self._driver = driver._driver;
		                setDriverToConfig();
		                self._wrapLibraryMethodsWithReady();
		                self._initDriver = initDriver(supportedDrivers);
		            });
		        })["catch"](function () {
		            setDriverToConfig();
		            var error = new Error('No available storage method found.');
		            self._driverSet = Promise$1.reject(error);
		            return self._driverSet;
		        });

		        executeTwoCallbacks(this._driverSet, callback, errorCallback);
		        return this._driverSet;
		    };

		    LocalForage.prototype.supports = function supports(driverName) {
		        return !!DriverSupport[driverName];
		    };

		    LocalForage.prototype._extend = function _extend(libraryMethodsAndProperties) {
		        extend(this, libraryMethodsAndProperties);
		    };

		    LocalForage.prototype._getSupportedDrivers = function _getSupportedDrivers(drivers) {
		        var supportedDrivers = [];
		        for (var i = 0, len = drivers.length; i < len; i++) {
		            var driverName = drivers[i];
		            if (this.supports(driverName)) {
		                supportedDrivers.push(driverName);
		            }
		        }
		        return supportedDrivers;
		    };

		    LocalForage.prototype._wrapLibraryMethodsWithReady = function _wrapLibraryMethodsWithReady() {
		        // Add a stub for each driver API method that delays the call to the
		        // corresponding driver method until localForage is ready. These stubs
		        // will be replaced by the driver methods as soon as the driver is
		        // loaded, so there is no performance impact.
		        for (var i = 0, len = LibraryMethods.length; i < len; i++) {
		            callWhenReady(this, LibraryMethods[i]);
		        }
		    };

		    LocalForage.prototype.createInstance = function createInstance(options) {
		        return new LocalForage(options);
		    };

		    return LocalForage;
		}();

		// The actual localForage object that we expose as a module or via a
		// global. It's extended by pulling in one of our other libraries.


		var localforage_js = new LocalForage();

		module.exports = localforage_js;

		},{"3":3}]},{},[4])(4)
		}); 
	} (localforage$1));
	return localforage$1.exports;
}

var localforageExports = requireLocalforage();
var localforage = /*@__PURE__*/getDefaultExportFromCjs(localforageExports);

var jszip_min = {exports: {}};

/*!

JSZip v3.10.1 - A JavaScript class for generating and reading zip files
<http://stuartk.com/jszip>

(c) 2009-2016 Stuart Knightley <stuart [at] stuartk.com>
Dual licenced under the MIT license or GPLv3. See https://raw.github.com/Stuk/jszip/main/LICENSE.markdown.

JSZip uses the library pako released under the MIT license :
https://github.com/nodeca/pako/blob/main/LICENSE
*/

var hasRequiredJszip_min;

function requireJszip_min () {
	if (hasRequiredJszip_min) return jszip_min.exports;
	hasRequiredJszip_min = 1;
	(function (module, exports$1) {
		!function(e){module.exports=e();}(function(){return function s(a,o,h){function u(r,e){if(!o[r]){if(!a[r]){var t="function"==typeof commonjsRequire&&commonjsRequire;if(!e&&t)return t(r,true);if(l)return l(r,true);var n=new Error("Cannot find module '"+r+"'");throw n.code="MODULE_NOT_FOUND",n}var i=o[r]={exports:{}};a[r][0].call(i.exports,function(e){var t=a[r][1][e];return u(t||e)},i,i.exports,s,a,o,h);}return o[r].exports}for(var l="function"==typeof commonjsRequire&&commonjsRequire,e=0;e<h.length;e++)u(h[e]);return u}({1:[function(e,t,r){var d=e("./utils"),c=e("./support"),p="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";r.encode=function(e){for(var t,r,n,i,s,a,o,h=[],u=0,l=e.length,f=l,c="string"!==d.getTypeOf(e);u<e.length;)f=l-u,n=c?(t=e[u++],r=u<l?e[u++]:0,u<l?e[u++]:0):(t=e.charCodeAt(u++),r=u<l?e.charCodeAt(u++):0,u<l?e.charCodeAt(u++):0),i=t>>2,s=(3&t)<<4|r>>4,a=1<f?(15&r)<<2|n>>6:64,o=2<f?63&n:64,h.push(p.charAt(i)+p.charAt(s)+p.charAt(a)+p.charAt(o));return h.join("")},r.decode=function(e){var t,r,n,i,s,a,o=0,h=0,u="data:";if(e.substr(0,u.length)===u)throw new Error("Invalid base64 input, it looks like a data url.");var l,f=3*(e=e.replace(/[^A-Za-z0-9+/=]/g,"")).length/4;if(e.charAt(e.length-1)===p.charAt(64)&&f--,e.charAt(e.length-2)===p.charAt(64)&&f--,f%1!=0)throw new Error("Invalid base64 input, bad content length.");for(l=c.uint8array?new Uint8Array(0|f):new Array(0|f);o<e.length;)t=p.indexOf(e.charAt(o++))<<2|(i=p.indexOf(e.charAt(o++)))>>4,r=(15&i)<<4|(s=p.indexOf(e.charAt(o++)))>>2,n=(3&s)<<6|(a=p.indexOf(e.charAt(o++))),l[h++]=t,64!==s&&(l[h++]=r),64!==a&&(l[h++]=n);return l};},{"./support":30,"./utils":32}],2:[function(e,t,r){var n=e("./external"),i=e("./stream/DataWorker"),s=e("./stream/Crc32Probe"),a=e("./stream/DataLengthProbe");function o(e,t,r,n,i){this.compressedSize=e,this.uncompressedSize=t,this.crc32=r,this.compression=n,this.compressedContent=i;}o.prototype={getContentWorker:function(){var e=new i(n.Promise.resolve(this.compressedContent)).pipe(this.compression.uncompressWorker()).pipe(new a("data_length")),t=this;return e.on("end",function(){if(this.streamInfo.data_length!==t.uncompressedSize)throw new Error("Bug : uncompressed data size mismatch")}),e},getCompressedWorker:function(){return new i(n.Promise.resolve(this.compressedContent)).withStreamInfo("compressedSize",this.compressedSize).withStreamInfo("uncompressedSize",this.uncompressedSize).withStreamInfo("crc32",this.crc32).withStreamInfo("compression",this.compression)}},o.createWorkerFrom=function(e,t,r){return e.pipe(new s).pipe(new a("uncompressedSize")).pipe(t.compressWorker(r)).pipe(new a("compressedSize")).withStreamInfo("compression",t)},t.exports=o;},{"./external":6,"./stream/Crc32Probe":25,"./stream/DataLengthProbe":26,"./stream/DataWorker":27}],3:[function(e,t,r){var n=e("./stream/GenericWorker");r.STORE={magic:"\0\0",compressWorker:function(){return new n("STORE compression")},uncompressWorker:function(){return new n("STORE decompression")}},r.DEFLATE=e("./flate");},{"./flate":7,"./stream/GenericWorker":28}],4:[function(e,t,r){var n=e("./utils");var o=function(){for(var e,t=[],r=0;r<256;r++){e=r;for(var n=0;n<8;n++)e=1&e?3988292384^e>>>1:e>>>1;t[r]=e;}return t}();t.exports=function(e,t){return void 0!==e&&e.length?"string"!==n.getTypeOf(e)?function(e,t,r,n){var i=o,s=n+r;e^=-1;for(var a=n;a<s;a++)e=e>>>8^i[255&(e^t[a])];return  -1^e}(0|t,e,e.length,0):function(e,t,r,n){var i=o,s=n+r;e^=-1;for(var a=n;a<s;a++)e=e>>>8^i[255&(e^t.charCodeAt(a))];return  -1^e}(0|t,e,e.length,0):0};},{"./utils":32}],5:[function(e,t,r){r.base64=false,r.binary=false,r.dir=false,r.createFolders=true,r.date=null,r.compression=null,r.compressionOptions=null,r.comment=null,r.unixPermissions=null,r.dosPermissions=null;},{}],6:[function(e,t,r){var n=null;n="undefined"!=typeof Promise?Promise:e("lie"),t.exports={Promise:n};},{lie:37}],7:[function(e,t,r){var n="undefined"!=typeof Uint8Array&&"undefined"!=typeof Uint16Array&&"undefined"!=typeof Uint32Array,i=e("pako"),s=e("./utils"),a=e("./stream/GenericWorker"),o=n?"uint8array":"array";function h(e,t){a.call(this,"FlateWorker/"+e),this._pako=null,this._pakoAction=e,this._pakoOptions=t,this.meta={};}r.magic="\b\0",s.inherits(h,a),h.prototype.processChunk=function(e){this.meta=e.meta,null===this._pako&&this._createPako(),this._pako.push(s.transformTo(o,e.data),false);},h.prototype.flush=function(){a.prototype.flush.call(this),null===this._pako&&this._createPako(),this._pako.push([],true);},h.prototype.cleanUp=function(){a.prototype.cleanUp.call(this),this._pako=null;},h.prototype._createPako=function(){this._pako=new i[this._pakoAction]({raw:true,level:this._pakoOptions.level||-1});var t=this;this._pako.onData=function(e){t.push({data:e,meta:t.meta});};},r.compressWorker=function(e){return new h("Deflate",e)},r.uncompressWorker=function(){return new h("Inflate",{})};},{"./stream/GenericWorker":28,"./utils":32,pako:38}],8:[function(e,t,r){function A(e,t){var r,n="";for(r=0;r<t;r++)n+=String.fromCharCode(255&e),e>>>=8;return n}function n(e,t,r,n,i,s){var a,o,h=e.file,u=e.compression,l=s!==O.utf8encode,f=I.transformTo("string",s(h.name)),c=I.transformTo("string",O.utf8encode(h.name)),d=h.comment,p=I.transformTo("string",s(d)),m=I.transformTo("string",O.utf8encode(d)),_=c.length!==h.name.length,g=m.length!==d.length,b="",v="",y="",w=h.dir,k=h.date,x={crc32:0,compressedSize:0,uncompressedSize:0};t&&!r||(x.crc32=e.crc32,x.compressedSize=e.compressedSize,x.uncompressedSize=e.uncompressedSize);var S=0;t&&(S|=8),l||!_&&!g||(S|=2048);var z=0,C=0;w&&(z|=16),"UNIX"===i?(C=798,z|=function(e,t){var r=e;return e||(r=t?16893:33204),(65535&r)<<16}(h.unixPermissions,w)):(C=20,z|=function(e){return 63&(e||0)}(h.dosPermissions)),a=k.getUTCHours(),a<<=6,a|=k.getUTCMinutes(),a<<=5,a|=k.getUTCSeconds()/2,o=k.getUTCFullYear()-1980,o<<=4,o|=k.getUTCMonth()+1,o<<=5,o|=k.getUTCDate(),_&&(v=A(1,1)+A(B(f),4)+c,b+="up"+A(v.length,2)+v),g&&(y=A(1,1)+A(B(p),4)+m,b+="uc"+A(y.length,2)+y);var E="";return E+="\n\0",E+=A(S,2),E+=u.magic,E+=A(a,2),E+=A(o,2),E+=A(x.crc32,4),E+=A(x.compressedSize,4),E+=A(x.uncompressedSize,4),E+=A(f.length,2),E+=A(b.length,2),{fileRecord:R.LOCAL_FILE_HEADER+E+f+b,dirRecord:R.CENTRAL_FILE_HEADER+A(C,2)+E+A(p.length,2)+"\0\0\0\0"+A(z,4)+A(n,4)+f+b+p}}var I=e("../utils"),i=e("../stream/GenericWorker"),O=e("../utf8"),B=e("../crc32"),R=e("../signature");function s(e,t,r,n){i.call(this,"ZipFileWorker"),this.bytesWritten=0,this.zipComment=t,this.zipPlatform=r,this.encodeFileName=n,this.streamFiles=e,this.accumulate=false,this.contentBuffer=[],this.dirRecords=[],this.currentSourceOffset=0,this.entriesCount=0,this.currentFile=null,this._sources=[];}I.inherits(s,i),s.prototype.push=function(e){var t=e.meta.percent||0,r=this.entriesCount,n=this._sources.length;this.accumulate?this.contentBuffer.push(e):(this.bytesWritten+=e.data.length,i.prototype.push.call(this,{data:e.data,meta:{currentFile:this.currentFile,percent:r?(t+100*(r-n-1))/r:100}}));},s.prototype.openedSource=function(e){this.currentSourceOffset=this.bytesWritten,this.currentFile=e.file.name;var t=this.streamFiles&&!e.file.dir;if(t){var r=n(e,t,false,this.currentSourceOffset,this.zipPlatform,this.encodeFileName);this.push({data:r.fileRecord,meta:{percent:0}});}else this.accumulate=true;},s.prototype.closedSource=function(e){this.accumulate=false;var t=this.streamFiles&&!e.file.dir,r=n(e,t,true,this.currentSourceOffset,this.zipPlatform,this.encodeFileName);if(this.dirRecords.push(r.dirRecord),t)this.push({data:function(e){return R.DATA_DESCRIPTOR+A(e.crc32,4)+A(e.compressedSize,4)+A(e.uncompressedSize,4)}(e),meta:{percent:100}});else for(this.push({data:r.fileRecord,meta:{percent:0}});this.contentBuffer.length;)this.push(this.contentBuffer.shift());this.currentFile=null;},s.prototype.flush=function(){for(var e=this.bytesWritten,t=0;t<this.dirRecords.length;t++)this.push({data:this.dirRecords[t],meta:{percent:100}});var r=this.bytesWritten-e,n=function(e,t,r,n,i){var s=I.transformTo("string",i(n));return R.CENTRAL_DIRECTORY_END+"\0\0\0\0"+A(e,2)+A(e,2)+A(t,4)+A(r,4)+A(s.length,2)+s}(this.dirRecords.length,r,e,this.zipComment,this.encodeFileName);this.push({data:n,meta:{percent:100}});},s.prototype.prepareNextSource=function(){this.previous=this._sources.shift(),this.openedSource(this.previous.streamInfo),this.isPaused?this.previous.pause():this.previous.resume();},s.prototype.registerPrevious=function(e){this._sources.push(e);var t=this;return e.on("data",function(e){t.processChunk(e);}),e.on("end",function(){t.closedSource(t.previous.streamInfo),t._sources.length?t.prepareNextSource():t.end();}),e.on("error",function(e){t.error(e);}),this},s.prototype.resume=function(){return !!i.prototype.resume.call(this)&&(!this.previous&&this._sources.length?(this.prepareNextSource(),true):this.previous||this._sources.length||this.generatedError?void 0:(this.end(),true))},s.prototype.error=function(e){var t=this._sources;if(!i.prototype.error.call(this,e))return  false;for(var r=0;r<t.length;r++)try{t[r].error(e);}catch(e){}return  true},s.prototype.lock=function(){i.prototype.lock.call(this);for(var e=this._sources,t=0;t<e.length;t++)e[t].lock();},t.exports=s;},{"../crc32":4,"../signature":23,"../stream/GenericWorker":28,"../utf8":31,"../utils":32}],9:[function(e,t,r){var u=e("../compressions"),n=e("./ZipFileWorker");r.generateWorker=function(e,a,t){var o=new n(a.streamFiles,t,a.platform,a.encodeFileName),h=0;try{e.forEach(function(e,t){h++;var r=function(e,t){var r=e||t,n=u[r];if(!n)throw new Error(r+" is not a valid compression method !");return n}(t.options.compression,a.compression),n=t.options.compressionOptions||a.compressionOptions||{},i=t.dir,s=t.date;t._compressWorker(r,n).withStreamInfo("file",{name:e,dir:i,date:s,comment:t.comment||"",unixPermissions:t.unixPermissions,dosPermissions:t.dosPermissions}).pipe(o);}),o.entriesCount=h;}catch(e){o.error(e);}return o};},{"../compressions":3,"./ZipFileWorker":8}],10:[function(e,t,r){function n(){if(!(this instanceof n))return new n;if(arguments.length)throw new Error("The constructor with parameters has been removed in JSZip 3.0, please check the upgrade guide.");this.files=Object.create(null),this.comment=null,this.root="",this.clone=function(){var e=new n;for(var t in this)"function"!=typeof this[t]&&(e[t]=this[t]);return e};}(n.prototype=e("./object")).loadAsync=e("./load"),n.support=e("./support"),n.defaults=e("./defaults"),n.version="3.10.1",n.loadAsync=function(e,t){return (new n).loadAsync(e,t)},n.external=e("./external"),t.exports=n;},{"./defaults":5,"./external":6,"./load":11,"./object":15,"./support":30}],11:[function(e,t,r){var u=e("./utils"),i=e("./external"),n=e("./utf8"),s=e("./zipEntries"),a=e("./stream/Crc32Probe"),l=e("./nodejsUtils");function f(n){return new i.Promise(function(e,t){var r=n.decompressed.getContentWorker().pipe(new a);r.on("error",function(e){t(e);}).on("end",function(){r.streamInfo.crc32!==n.decompressed.crc32?t(new Error("Corrupted zip : CRC32 mismatch")):e();}).resume();})}t.exports=function(e,o){var h=this;return o=u.extend(o||{},{base64:false,checkCRC32:false,optimizedBinaryString:false,createFolders:false,decodeFileName:n.utf8decode}),l.isNode&&l.isStream(e)?i.Promise.reject(new Error("JSZip can't accept a stream when loading a zip file.")):u.prepareContent("the loaded zip file",e,true,o.optimizedBinaryString,o.base64).then(function(e){var t=new s(o);return t.load(e),t}).then(function(e){var t=[i.Promise.resolve(e)],r=e.files;if(o.checkCRC32)for(var n=0;n<r.length;n++)t.push(f(r[n]));return i.Promise.all(t)}).then(function(e){for(var t=e.shift(),r=t.files,n=0;n<r.length;n++){var i=r[n],s=i.fileNameStr,a=u.resolve(i.fileNameStr);h.file(a,i.decompressed,{binary:true,optimizedBinaryString:true,date:i.date,dir:i.dir,comment:i.fileCommentStr.length?i.fileCommentStr:null,unixPermissions:i.unixPermissions,dosPermissions:i.dosPermissions,createFolders:o.createFolders}),i.dir||(h.file(a).unsafeOriginalName=s);}return t.zipComment.length&&(h.comment=t.zipComment),h})};},{"./external":6,"./nodejsUtils":14,"./stream/Crc32Probe":25,"./utf8":31,"./utils":32,"./zipEntries":33}],12:[function(e,t,r){var n=e("../utils"),i=e("../stream/GenericWorker");function s(e,t){i.call(this,"Nodejs stream input adapter for "+e),this._upstreamEnded=false,this._bindStream(t);}n.inherits(s,i),s.prototype._bindStream=function(e){var t=this;(this._stream=e).pause(),e.on("data",function(e){t.push({data:e,meta:{percent:0}});}).on("error",function(e){t.isPaused?this.generatedError=e:t.error(e);}).on("end",function(){t.isPaused?t._upstreamEnded=true:t.end();});},s.prototype.pause=function(){return !!i.prototype.pause.call(this)&&(this._stream.pause(),true)},s.prototype.resume=function(){return !!i.prototype.resume.call(this)&&(this._upstreamEnded?this.end():this._stream.resume(),true)},t.exports=s;},{"../stream/GenericWorker":28,"../utils":32}],13:[function(e,t,r){var i=e("readable-stream").Readable;function n(e,t,r){i.call(this,t),this._helper=e;var n=this;e.on("data",function(e,t){n.push(e)||n._helper.pause(),r&&r(t);}).on("error",function(e){n.emit("error",e);}).on("end",function(){n.push(null);});}e("../utils").inherits(n,i),n.prototype._read=function(){this._helper.resume();},t.exports=n;},{"../utils":32,"readable-stream":16}],14:[function(e,t,r){t.exports={isNode:"undefined"!=typeof Buffer,newBufferFrom:function(e,t){if(Buffer.from&&Buffer.from!==Uint8Array.from)return Buffer.from(e,t);if("number"==typeof e)throw new Error('The "data" argument must not be a number');return new Buffer(e,t)},allocBuffer:function(e){if(Buffer.alloc)return Buffer.alloc(e);var t=new Buffer(e);return t.fill(0),t},isBuffer:function(e){return Buffer.isBuffer(e)},isStream:function(e){return e&&"function"==typeof e.on&&"function"==typeof e.pause&&"function"==typeof e.resume}};},{}],15:[function(e,t,r){function s(e,t,r){var n,i=u.getTypeOf(t),s=u.extend(r||{},f);s.date=s.date||new Date,null!==s.compression&&(s.compression=s.compression.toUpperCase()),"string"==typeof s.unixPermissions&&(s.unixPermissions=parseInt(s.unixPermissions,8)),s.unixPermissions&&16384&s.unixPermissions&&(s.dir=true),s.dosPermissions&&16&s.dosPermissions&&(s.dir=true),s.dir&&(e=g(e)),s.createFolders&&(n=_(e))&&b.call(this,n,true);var a="string"===i&&false===s.binary&&false===s.base64;r&&void 0!==r.binary||(s.binary=!a),(t instanceof c&&0===t.uncompressedSize||s.dir||!t||0===t.length)&&(s.base64=false,s.binary=true,t="",s.compression="STORE",i="string");var o=null;o=t instanceof c||t instanceof l?t:p.isNode&&p.isStream(t)?new m(e,t):u.prepareContent(e,t,s.binary,s.optimizedBinaryString,s.base64);var h=new d(e,o,s);this.files[e]=h;}var i=e("./utf8"),u=e("./utils"),l=e("./stream/GenericWorker"),a=e("./stream/StreamHelper"),f=e("./defaults"),c=e("./compressedObject"),d=e("./zipObject"),o=e("./generate"),p=e("./nodejsUtils"),m=e("./nodejs/NodejsStreamInputAdapter"),_=function(e){"/"===e.slice(-1)&&(e=e.substring(0,e.length-1));var t=e.lastIndexOf("/");return 0<t?e.substring(0,t):""},g=function(e){return "/"!==e.slice(-1)&&(e+="/"),e},b=function(e,t){return t=void 0!==t?t:f.createFolders,e=g(e),this.files[e]||s.call(this,e,null,{dir:true,createFolders:t}),this.files[e]};function h(e){return "[object RegExp]"===Object.prototype.toString.call(e)}var n={load:function(){throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.")},forEach:function(e){var t,r,n;for(t in this.files)n=this.files[t],(r=t.slice(this.root.length,t.length))&&t.slice(0,this.root.length)===this.root&&e(r,n);},filter:function(r){var n=[];return this.forEach(function(e,t){r(e,t)&&n.push(t);}),n},file:function(e,t,r){if(1!==arguments.length)return e=this.root+e,s.call(this,e,t,r),this;if(h(e)){var n=e;return this.filter(function(e,t){return !t.dir&&n.test(e)})}var i=this.files[this.root+e];return i&&!i.dir?i:null},folder:function(r){if(!r)return this;if(h(r))return this.filter(function(e,t){return t.dir&&r.test(e)});var e=this.root+r,t=b.call(this,e),n=this.clone();return n.root=t.name,n},remove:function(r){r=this.root+r;var e=this.files[r];if(e||("/"!==r.slice(-1)&&(r+="/"),e=this.files[r]),e&&!e.dir)delete this.files[r];else for(var t=this.filter(function(e,t){return t.name.slice(0,r.length)===r}),n=0;n<t.length;n++)delete this.files[t[n].name];return this},generate:function(){throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.")},generateInternalStream:function(e){var t,r={};try{if((r=u.extend(e||{},{streamFiles:!1,compression:"STORE",compressionOptions:null,type:"",platform:"DOS",comment:null,mimeType:"application/zip",encodeFileName:i.utf8encode})).type=r.type.toLowerCase(),r.compression=r.compression.toUpperCase(),"binarystring"===r.type&&(r.type="string"),!r.type)throw new Error("No output type specified.");u.checkSupport(r.type),"darwin"!==r.platform&&"freebsd"!==r.platform&&"linux"!==r.platform&&"sunos"!==r.platform||(r.platform="UNIX"),"win32"===r.platform&&(r.platform="DOS");var n=r.comment||this.comment||"";t=o.generateWorker(this,r,n);}catch(e){(t=new l("error")).error(e);}return new a(t,r.type||"string",r.mimeType)},generateAsync:function(e,t){return this.generateInternalStream(e).accumulate(t)},generateNodeStream:function(e,t){return (e=e||{}).type||(e.type="nodebuffer"),this.generateInternalStream(e).toNodejsStream(t)}};t.exports=n;},{"./compressedObject":2,"./defaults":5,"./generate":9,"./nodejs/NodejsStreamInputAdapter":12,"./nodejsUtils":14,"./stream/GenericWorker":28,"./stream/StreamHelper":29,"./utf8":31,"./utils":32,"./zipObject":35}],16:[function(e,t,r){t.exports=e("stream");},{stream:void 0}],17:[function(e,t,r){var n=e("./DataReader");function i(e){n.call(this,e);for(var t=0;t<this.data.length;t++)e[t]=255&e[t];}e("../utils").inherits(i,n),i.prototype.byteAt=function(e){return this.data[this.zero+e]},i.prototype.lastIndexOfSignature=function(e){for(var t=e.charCodeAt(0),r=e.charCodeAt(1),n=e.charCodeAt(2),i=e.charCodeAt(3),s=this.length-4;0<=s;--s)if(this.data[s]===t&&this.data[s+1]===r&&this.data[s+2]===n&&this.data[s+3]===i)return s-this.zero;return  -1},i.prototype.readAndCheckSignature=function(e){var t=e.charCodeAt(0),r=e.charCodeAt(1),n=e.charCodeAt(2),i=e.charCodeAt(3),s=this.readData(4);return t===s[0]&&r===s[1]&&n===s[2]&&i===s[3]},i.prototype.readData=function(e){if(this.checkOffset(e),0===e)return [];var t=this.data.slice(this.zero+this.index,this.zero+this.index+e);return this.index+=e,t},t.exports=i;},{"../utils":32,"./DataReader":18}],18:[function(e,t,r){var n=e("../utils");function i(e){this.data=e,this.length=e.length,this.index=0,this.zero=0;}i.prototype={checkOffset:function(e){this.checkIndex(this.index+e);},checkIndex:function(e){if(this.length<this.zero+e||e<0)throw new Error("End of data reached (data length = "+this.length+", asked index = "+e+"). Corrupted zip ?")},setIndex:function(e){this.checkIndex(e),this.index=e;},skip:function(e){this.setIndex(this.index+e);},byteAt:function(){},readInt:function(e){var t,r=0;for(this.checkOffset(e),t=this.index+e-1;t>=this.index;t--)r=(r<<8)+this.byteAt(t);return this.index+=e,r},readString:function(e){return n.transformTo("string",this.readData(e))},readData:function(){},lastIndexOfSignature:function(){},readAndCheckSignature:function(){},readDate:function(){var e=this.readInt(4);return new Date(Date.UTC(1980+(e>>25&127),(e>>21&15)-1,e>>16&31,e>>11&31,e>>5&63,(31&e)<<1))}},t.exports=i;},{"../utils":32}],19:[function(e,t,r){var n=e("./Uint8ArrayReader");function i(e){n.call(this,e);}e("../utils").inherits(i,n),i.prototype.readData=function(e){this.checkOffset(e);var t=this.data.slice(this.zero+this.index,this.zero+this.index+e);return this.index+=e,t},t.exports=i;},{"../utils":32,"./Uint8ArrayReader":21}],20:[function(e,t,r){var n=e("./DataReader");function i(e){n.call(this,e);}e("../utils").inherits(i,n),i.prototype.byteAt=function(e){return this.data.charCodeAt(this.zero+e)},i.prototype.lastIndexOfSignature=function(e){return this.data.lastIndexOf(e)-this.zero},i.prototype.readAndCheckSignature=function(e){return e===this.readData(4)},i.prototype.readData=function(e){this.checkOffset(e);var t=this.data.slice(this.zero+this.index,this.zero+this.index+e);return this.index+=e,t},t.exports=i;},{"../utils":32,"./DataReader":18}],21:[function(e,t,r){var n=e("./ArrayReader");function i(e){n.call(this,e);}e("../utils").inherits(i,n),i.prototype.readData=function(e){if(this.checkOffset(e),0===e)return new Uint8Array(0);var t=this.data.subarray(this.zero+this.index,this.zero+this.index+e);return this.index+=e,t},t.exports=i;},{"../utils":32,"./ArrayReader":17}],22:[function(e,t,r){var n=e("../utils"),i=e("../support"),s=e("./ArrayReader"),a=e("./StringReader"),o=e("./NodeBufferReader"),h=e("./Uint8ArrayReader");t.exports=function(e){var t=n.getTypeOf(e);return n.checkSupport(t),"string"!==t||i.uint8array?"nodebuffer"===t?new o(e):i.uint8array?new h(n.transformTo("uint8array",e)):new s(n.transformTo("array",e)):new a(e)};},{"../support":30,"../utils":32,"./ArrayReader":17,"./NodeBufferReader":19,"./StringReader":20,"./Uint8ArrayReader":21}],23:[function(e,t,r){r.LOCAL_FILE_HEADER="PK",r.CENTRAL_FILE_HEADER="PK",r.CENTRAL_DIRECTORY_END="PK",r.ZIP64_CENTRAL_DIRECTORY_LOCATOR="PK",r.ZIP64_CENTRAL_DIRECTORY_END="PK",r.DATA_DESCRIPTOR="PK\b";},{}],24:[function(e,t,r){var n=e("./GenericWorker"),i=e("../utils");function s(e){n.call(this,"ConvertWorker to "+e),this.destType=e;}i.inherits(s,n),s.prototype.processChunk=function(e){this.push({data:i.transformTo(this.destType,e.data),meta:e.meta});},t.exports=s;},{"../utils":32,"./GenericWorker":28}],25:[function(e,t,r){var n=e("./GenericWorker"),i=e("../crc32");function s(){n.call(this,"Crc32Probe"),this.withStreamInfo("crc32",0);}e("../utils").inherits(s,n),s.prototype.processChunk=function(e){this.streamInfo.crc32=i(e.data,this.streamInfo.crc32||0),this.push(e);},t.exports=s;},{"../crc32":4,"../utils":32,"./GenericWorker":28}],26:[function(e,t,r){var n=e("../utils"),i=e("./GenericWorker");function s(e){i.call(this,"DataLengthProbe for "+e),this.propName=e,this.withStreamInfo(e,0);}n.inherits(s,i),s.prototype.processChunk=function(e){if(e){var t=this.streamInfo[this.propName]||0;this.streamInfo[this.propName]=t+e.data.length;}i.prototype.processChunk.call(this,e);},t.exports=s;},{"../utils":32,"./GenericWorker":28}],27:[function(e,t,r){var n=e("../utils"),i=e("./GenericWorker");function s(e){i.call(this,"DataWorker");var t=this;this.dataIsReady=false,this.index=0,this.max=0,this.data=null,this.type="",this._tickScheduled=false,e.then(function(e){t.dataIsReady=true,t.data=e,t.max=e&&e.length||0,t.type=n.getTypeOf(e),t.isPaused||t._tickAndRepeat();},function(e){t.error(e);});}n.inherits(s,i),s.prototype.cleanUp=function(){i.prototype.cleanUp.call(this),this.data=null;},s.prototype.resume=function(){return !!i.prototype.resume.call(this)&&(!this._tickScheduled&&this.dataIsReady&&(this._tickScheduled=true,n.delay(this._tickAndRepeat,[],this)),true)},s.prototype._tickAndRepeat=function(){this._tickScheduled=false,this.isPaused||this.isFinished||(this._tick(),this.isFinished||(n.delay(this._tickAndRepeat,[],this),this._tickScheduled=true));},s.prototype._tick=function(){if(this.isPaused||this.isFinished)return  false;var e=null,t=Math.min(this.max,this.index+16384);if(this.index>=this.max)return this.end();switch(this.type){case "string":e=this.data.substring(this.index,t);break;case "uint8array":e=this.data.subarray(this.index,t);break;case "array":case "nodebuffer":e=this.data.slice(this.index,t);}return this.index=t,this.push({data:e,meta:{percent:this.max?this.index/this.max*100:0}})},t.exports=s;},{"../utils":32,"./GenericWorker":28}],28:[function(e,t,r){function n(e){this.name=e||"default",this.streamInfo={},this.generatedError=null,this.extraStreamInfo={},this.isPaused=true,this.isFinished=false,this.isLocked=false,this._listeners={data:[],end:[],error:[]},this.previous=null;}n.prototype={push:function(e){this.emit("data",e);},end:function(){if(this.isFinished)return  false;this.flush();try{this.emit("end"),this.cleanUp(),this.isFinished=!0;}catch(e){this.emit("error",e);}return  true},error:function(e){return !this.isFinished&&(this.isPaused?this.generatedError=e:(this.isFinished=true,this.emit("error",e),this.previous&&this.previous.error(e),this.cleanUp()),true)},on:function(e,t){return this._listeners[e].push(t),this},cleanUp:function(){this.streamInfo=this.generatedError=this.extraStreamInfo=null,this._listeners=[];},emit:function(e,t){if(this._listeners[e])for(var r=0;r<this._listeners[e].length;r++)this._listeners[e][r].call(this,t);},pipe:function(e){return e.registerPrevious(this)},registerPrevious:function(e){if(this.isLocked)throw new Error("The stream '"+this+"' has already been used.");this.streamInfo=e.streamInfo,this.mergeStreamInfo(),this.previous=e;var t=this;return e.on("data",function(e){t.processChunk(e);}),e.on("end",function(){t.end();}),e.on("error",function(e){t.error(e);}),this},pause:function(){return !this.isPaused&&!this.isFinished&&(this.isPaused=true,this.previous&&this.previous.pause(),true)},resume:function(){if(!this.isPaused||this.isFinished)return  false;var e=this.isPaused=false;return this.generatedError&&(this.error(this.generatedError),e=true),this.previous&&this.previous.resume(),!e},flush:function(){},processChunk:function(e){this.push(e);},withStreamInfo:function(e,t){return this.extraStreamInfo[e]=t,this.mergeStreamInfo(),this},mergeStreamInfo:function(){for(var e in this.extraStreamInfo)Object.prototype.hasOwnProperty.call(this.extraStreamInfo,e)&&(this.streamInfo[e]=this.extraStreamInfo[e]);},lock:function(){if(this.isLocked)throw new Error("The stream '"+this+"' has already been used.");this.isLocked=true,this.previous&&this.previous.lock();},toString:function(){var e="Worker "+this.name;return this.previous?this.previous+" -> "+e:e}},t.exports=n;},{}],29:[function(e,t,r){var h=e("../utils"),i=e("./ConvertWorker"),s=e("./GenericWorker"),u=e("../base64"),n=e("../support"),a=e("../external"),o=null;if(n.nodestream)try{o=e("../nodejs/NodejsStreamOutputAdapter");}catch(e){}function l(e,o){return new a.Promise(function(t,r){var n=[],i=e._internalType,s=e._outputType,a=e._mimeType;e.on("data",function(e,t){n.push(e),o&&o(t);}).on("error",function(e){n=[],r(e);}).on("end",function(){try{var e=function(e,t,r){switch(e){case "blob":return h.newBlob(h.transformTo("arraybuffer",t),r);case "base64":return u.encode(t);default:return h.transformTo(e,t)}}(s,function(e,t){var r,n=0,i=null,s=0;for(r=0;r<t.length;r++)s+=t[r].length;switch(e){case "string":return t.join("");case "array":return Array.prototype.concat.apply([],t);case "uint8array":for(i=new Uint8Array(s),r=0;r<t.length;r++)i.set(t[r],n),n+=t[r].length;return i;case "nodebuffer":return Buffer.concat(t);default:throw new Error("concat : unsupported type '"+e+"'")}}(i,n),a);t(e);}catch(e){r(e);}n=[];}).resume();})}function f(e,t,r){var n=t;switch(t){case "blob":case "arraybuffer":n="uint8array";break;case "base64":n="string";}try{this._internalType=n,this._outputType=t,this._mimeType=r,h.checkSupport(n),this._worker=e.pipe(new i(n)),e.lock();}catch(e){this._worker=new s("error"),this._worker.error(e);}}f.prototype={accumulate:function(e){return l(this,e)},on:function(e,t){var r=this;return "data"===e?this._worker.on(e,function(e){t.call(r,e.data,e.meta);}):this._worker.on(e,function(){h.delay(t,arguments,r);}),this},resume:function(){return h.delay(this._worker.resume,[],this._worker),this},pause:function(){return this._worker.pause(),this},toNodejsStream:function(e){if(h.checkSupport("nodestream"),"nodebuffer"!==this._outputType)throw new Error(this._outputType+" is not supported by this method");return new o(this,{objectMode:"nodebuffer"!==this._outputType},e)}},t.exports=f;},{"../base64":1,"../external":6,"../nodejs/NodejsStreamOutputAdapter":13,"../support":30,"../utils":32,"./ConvertWorker":24,"./GenericWorker":28}],30:[function(e,t,r){if(r.base64=true,r.array=true,r.string=true,r.arraybuffer="undefined"!=typeof ArrayBuffer&&"undefined"!=typeof Uint8Array,r.nodebuffer="undefined"!=typeof Buffer,r.uint8array="undefined"!=typeof Uint8Array,"undefined"==typeof ArrayBuffer)r.blob=false;else {var n=new ArrayBuffer(0);try{r.blob=0===new Blob([n],{type:"application/zip"}).size;}catch(e){try{var i=new(self.BlobBuilder||self.WebKitBlobBuilder||self.MozBlobBuilder||self.MSBlobBuilder);i.append(n),r.blob=0===i.getBlob("application/zip").size;}catch(e){r.blob=false;}}}try{r.nodestream=!!e("readable-stream").Readable;}catch(e){r.nodestream=false;}},{"readable-stream":16}],31:[function(e,t,s){for(var o=e("./utils"),h=e("./support"),r=e("./nodejsUtils"),n=e("./stream/GenericWorker"),u=new Array(256),i=0;i<256;i++)u[i]=252<=i?6:248<=i?5:240<=i?4:224<=i?3:192<=i?2:1;u[254]=u[254]=1;function a(){n.call(this,"utf-8 decode"),this.leftOver=null;}function l(){n.call(this,"utf-8 encode");}s.utf8encode=function(e){return h.nodebuffer?r.newBufferFrom(e,"utf-8"):function(e){var t,r,n,i,s,a=e.length,o=0;for(i=0;i<a;i++)55296==(64512&(r=e.charCodeAt(i)))&&i+1<a&&56320==(64512&(n=e.charCodeAt(i+1)))&&(r=65536+(r-55296<<10)+(n-56320),i++),o+=r<128?1:r<2048?2:r<65536?3:4;for(t=h.uint8array?new Uint8Array(o):new Array(o),i=s=0;s<o;i++)55296==(64512&(r=e.charCodeAt(i)))&&i+1<a&&56320==(64512&(n=e.charCodeAt(i+1)))&&(r=65536+(r-55296<<10)+(n-56320),i++),r<128?t[s++]=r:(r<2048?t[s++]=192|r>>>6:(r<65536?t[s++]=224|r>>>12:(t[s++]=240|r>>>18,t[s++]=128|r>>>12&63),t[s++]=128|r>>>6&63),t[s++]=128|63&r);return t}(e)},s.utf8decode=function(e){return h.nodebuffer?o.transformTo("nodebuffer",e).toString("utf-8"):function(e){var t,r,n,i,s=e.length,a=new Array(2*s);for(t=r=0;t<s;)if((n=e[t++])<128)a[r++]=n;else if(4<(i=u[n]))a[r++]=65533,t+=i-1;else {for(n&=2===i?31:3===i?15:7;1<i&&t<s;)n=n<<6|63&e[t++],i--;1<i?a[r++]=65533:n<65536?a[r++]=n:(n-=65536,a[r++]=55296|n>>10&1023,a[r++]=56320|1023&n);}return a.length!==r&&(a.subarray?a=a.subarray(0,r):a.length=r),o.applyFromCharCode(a)}(e=o.transformTo(h.uint8array?"uint8array":"array",e))},o.inherits(a,n),a.prototype.processChunk=function(e){var t=o.transformTo(h.uint8array?"uint8array":"array",e.data);if(this.leftOver&&this.leftOver.length){if(h.uint8array){var r=t;(t=new Uint8Array(r.length+this.leftOver.length)).set(this.leftOver,0),t.set(r,this.leftOver.length);}else t=this.leftOver.concat(t);this.leftOver=null;}var n=function(e,t){var r;for((t=t||e.length)>e.length&&(t=e.length),r=t-1;0<=r&&128==(192&e[r]);)r--;return r<0?t:0===r?t:r+u[e[r]]>t?r:t}(t),i=t;n!==t.length&&(h.uint8array?(i=t.subarray(0,n),this.leftOver=t.subarray(n,t.length)):(i=t.slice(0,n),this.leftOver=t.slice(n,t.length))),this.push({data:s.utf8decode(i),meta:e.meta});},a.prototype.flush=function(){this.leftOver&&this.leftOver.length&&(this.push({data:s.utf8decode(this.leftOver),meta:{}}),this.leftOver=null);},s.Utf8DecodeWorker=a,o.inherits(l,n),l.prototype.processChunk=function(e){this.push({data:s.utf8encode(e.data),meta:e.meta});},s.Utf8EncodeWorker=l;},{"./nodejsUtils":14,"./stream/GenericWorker":28,"./support":30,"./utils":32}],32:[function(e,t,a){var o=e("./support"),h=e("./base64"),r=e("./nodejsUtils"),u=e("./external");function n(e){return e}function l(e,t){for(var r=0;r<e.length;++r)t[r]=255&e.charCodeAt(r);return t}e("setimmediate"),a.newBlob=function(t,r){a.checkSupport("blob");try{return new Blob([t],{type:r})}catch(e){try{var n=new(self.BlobBuilder||self.WebKitBlobBuilder||self.MozBlobBuilder||self.MSBlobBuilder);return n.append(t),n.getBlob(r)}catch(e){throw new Error("Bug : can't construct the Blob.")}}};var i={stringifyByChunk:function(e,t,r){var n=[],i=0,s=e.length;if(s<=r)return String.fromCharCode.apply(null,e);for(;i<s;)"array"===t||"nodebuffer"===t?n.push(String.fromCharCode.apply(null,e.slice(i,Math.min(i+r,s)))):n.push(String.fromCharCode.apply(null,e.subarray(i,Math.min(i+r,s)))),i+=r;return n.join("")},stringifyByChar:function(e){for(var t="",r=0;r<e.length;r++)t+=String.fromCharCode(e[r]);return t},applyCanBeUsed:{uint8array:function(){try{return o.uint8array&&1===String.fromCharCode.apply(null,new Uint8Array(1)).length}catch(e){return  false}}(),nodebuffer:function(){try{return o.nodebuffer&&1===String.fromCharCode.apply(null,r.allocBuffer(1)).length}catch(e){return  false}}()}};function s(e){var t=65536,r=a.getTypeOf(e),n=true;if("uint8array"===r?n=i.applyCanBeUsed.uint8array:"nodebuffer"===r&&(n=i.applyCanBeUsed.nodebuffer),n)for(;1<t;)try{return i.stringifyByChunk(e,r,t)}catch(e){t=Math.floor(t/2);}return i.stringifyByChar(e)}function f(e,t){for(var r=0;r<e.length;r++)t[r]=e[r];return t}a.applyFromCharCode=s;var c={};c.string={string:n,array:function(e){return l(e,new Array(e.length))},arraybuffer:function(e){return c.string.uint8array(e).buffer},uint8array:function(e){return l(e,new Uint8Array(e.length))},nodebuffer:function(e){return l(e,r.allocBuffer(e.length))}},c.array={string:s,array:n,arraybuffer:function(e){return new Uint8Array(e).buffer},uint8array:function(e){return new Uint8Array(e)},nodebuffer:function(e){return r.newBufferFrom(e)}},c.arraybuffer={string:function(e){return s(new Uint8Array(e))},array:function(e){return f(new Uint8Array(e),new Array(e.byteLength))},arraybuffer:n,uint8array:function(e){return new Uint8Array(e)},nodebuffer:function(e){return r.newBufferFrom(new Uint8Array(e))}},c.uint8array={string:s,array:function(e){return f(e,new Array(e.length))},arraybuffer:function(e){return e.buffer},uint8array:n,nodebuffer:function(e){return r.newBufferFrom(e)}},c.nodebuffer={string:s,array:function(e){return f(e,new Array(e.length))},arraybuffer:function(e){return c.nodebuffer.uint8array(e).buffer},uint8array:function(e){return f(e,new Uint8Array(e.length))},nodebuffer:n},a.transformTo=function(e,t){if(t=t||"",!e)return t;a.checkSupport(e);var r=a.getTypeOf(t);return c[r][e](t)},a.resolve=function(e){for(var t=e.split("/"),r=[],n=0;n<t.length;n++){var i=t[n];"."===i||""===i&&0!==n&&n!==t.length-1||(".."===i?r.pop():r.push(i));}return r.join("/")},a.getTypeOf=function(e){return "string"==typeof e?"string":"[object Array]"===Object.prototype.toString.call(e)?"array":o.nodebuffer&&r.isBuffer(e)?"nodebuffer":o.uint8array&&e instanceof Uint8Array?"uint8array":o.arraybuffer&&e instanceof ArrayBuffer?"arraybuffer":void 0},a.checkSupport=function(e){if(!o[e.toLowerCase()])throw new Error(e+" is not supported by this platform")},a.MAX_VALUE_16BITS=65535,a.MAX_VALUE_32BITS=-1,a.pretty=function(e){var t,r,n="";for(r=0;r<(e||"").length;r++)n+="\\x"+((t=e.charCodeAt(r))<16?"0":"")+t.toString(16).toUpperCase();return n},a.delay=function(e,t,r){setImmediate(function(){e.apply(r||null,t||[]);});},a.inherits=function(e,t){function r(){}r.prototype=t.prototype,e.prototype=new r;},a.extend=function(){var e,t,r={};for(e=0;e<arguments.length;e++)for(t in arguments[e])Object.prototype.hasOwnProperty.call(arguments[e],t)&&void 0===r[t]&&(r[t]=arguments[e][t]);return r},a.prepareContent=function(r,e,n,i,s){return u.Promise.resolve(e).then(function(n){return o.blob&&(n instanceof Blob||-1!==["[object File]","[object Blob]"].indexOf(Object.prototype.toString.call(n)))&&"undefined"!=typeof FileReader?new u.Promise(function(t,r){var e=new FileReader;e.onload=function(e){t(e.target.result);},e.onerror=function(e){r(e.target.error);},e.readAsArrayBuffer(n);}):n}).then(function(e){var t=a.getTypeOf(e);return t?("arraybuffer"===t?e=a.transformTo("uint8array",e):"string"===t&&(s?e=h.decode(e):n&&true!==i&&(e=function(e){return l(e,o.uint8array?new Uint8Array(e.length):new Array(e.length))}(e))),e):u.Promise.reject(new Error("Can't read the data of '"+r+"'. Is it in a supported JavaScript type (String, Blob, ArrayBuffer, etc) ?"))})};},{"./base64":1,"./external":6,"./nodejsUtils":14,"./support":30,setimmediate:54}],33:[function(e,t,r){var n=e("./reader/readerFor"),i=e("./utils"),s=e("./signature"),a=e("./zipEntry"),o=e("./support");function h(e){this.files=[],this.loadOptions=e;}h.prototype={checkSignature:function(e){if(!this.reader.readAndCheckSignature(e)){this.reader.index-=4;var t=this.reader.readString(4);throw new Error("Corrupted zip or bug: unexpected signature ("+i.pretty(t)+", expected "+i.pretty(e)+")")}},isSignature:function(e,t){var r=this.reader.index;this.reader.setIndex(e);var n=this.reader.readString(4)===t;return this.reader.setIndex(r),n},readBlockEndOfCentral:function(){this.diskNumber=this.reader.readInt(2),this.diskWithCentralDirStart=this.reader.readInt(2),this.centralDirRecordsOnThisDisk=this.reader.readInt(2),this.centralDirRecords=this.reader.readInt(2),this.centralDirSize=this.reader.readInt(4),this.centralDirOffset=this.reader.readInt(4),this.zipCommentLength=this.reader.readInt(2);var e=this.reader.readData(this.zipCommentLength),t=o.uint8array?"uint8array":"array",r=i.transformTo(t,e);this.zipComment=this.loadOptions.decodeFileName(r);},readBlockZip64EndOfCentral:function(){this.zip64EndOfCentralSize=this.reader.readInt(8),this.reader.skip(4),this.diskNumber=this.reader.readInt(4),this.diskWithCentralDirStart=this.reader.readInt(4),this.centralDirRecordsOnThisDisk=this.reader.readInt(8),this.centralDirRecords=this.reader.readInt(8),this.centralDirSize=this.reader.readInt(8),this.centralDirOffset=this.reader.readInt(8),this.zip64ExtensibleData={};for(var e,t,r,n=this.zip64EndOfCentralSize-44;0<n;)e=this.reader.readInt(2),t=this.reader.readInt(4),r=this.reader.readData(t),this.zip64ExtensibleData[e]={id:e,length:t,value:r};},readBlockZip64EndOfCentralLocator:function(){if(this.diskWithZip64CentralDirStart=this.reader.readInt(4),this.relativeOffsetEndOfZip64CentralDir=this.reader.readInt(8),this.disksCount=this.reader.readInt(4),1<this.disksCount)throw new Error("Multi-volumes zip are not supported")},readLocalFiles:function(){var e,t;for(e=0;e<this.files.length;e++)t=this.files[e],this.reader.setIndex(t.localHeaderOffset),this.checkSignature(s.LOCAL_FILE_HEADER),t.readLocalPart(this.reader),t.handleUTF8(),t.processAttributes();},readCentralDir:function(){var e;for(this.reader.setIndex(this.centralDirOffset);this.reader.readAndCheckSignature(s.CENTRAL_FILE_HEADER);)(e=new a({zip64:this.zip64},this.loadOptions)).readCentralPart(this.reader),this.files.push(e);if(this.centralDirRecords!==this.files.length&&0!==this.centralDirRecords&&0===this.files.length)throw new Error("Corrupted zip or bug: expected "+this.centralDirRecords+" records in central dir, got "+this.files.length)},readEndOfCentral:function(){var e=this.reader.lastIndexOfSignature(s.CENTRAL_DIRECTORY_END);if(e<0)throw !this.isSignature(0,s.LOCAL_FILE_HEADER)?new Error("Can't find end of central directory : is this a zip file ? If it is, see https://stuk.github.io/jszip/documentation/howto/read_zip.html"):new Error("Corrupted zip: can't find end of central directory");this.reader.setIndex(e);var t=e;if(this.checkSignature(s.CENTRAL_DIRECTORY_END),this.readBlockEndOfCentral(),this.diskNumber===i.MAX_VALUE_16BITS||this.diskWithCentralDirStart===i.MAX_VALUE_16BITS||this.centralDirRecordsOnThisDisk===i.MAX_VALUE_16BITS||this.centralDirRecords===i.MAX_VALUE_16BITS||this.centralDirSize===i.MAX_VALUE_32BITS||this.centralDirOffset===i.MAX_VALUE_32BITS){if(this.zip64=true,(e=this.reader.lastIndexOfSignature(s.ZIP64_CENTRAL_DIRECTORY_LOCATOR))<0)throw new Error("Corrupted zip: can't find the ZIP64 end of central directory locator");if(this.reader.setIndex(e),this.checkSignature(s.ZIP64_CENTRAL_DIRECTORY_LOCATOR),this.readBlockZip64EndOfCentralLocator(),!this.isSignature(this.relativeOffsetEndOfZip64CentralDir,s.ZIP64_CENTRAL_DIRECTORY_END)&&(this.relativeOffsetEndOfZip64CentralDir=this.reader.lastIndexOfSignature(s.ZIP64_CENTRAL_DIRECTORY_END),this.relativeOffsetEndOfZip64CentralDir<0))throw new Error("Corrupted zip: can't find the ZIP64 end of central directory");this.reader.setIndex(this.relativeOffsetEndOfZip64CentralDir),this.checkSignature(s.ZIP64_CENTRAL_DIRECTORY_END),this.readBlockZip64EndOfCentral();}var r=this.centralDirOffset+this.centralDirSize;this.zip64&&(r+=20,r+=12+this.zip64EndOfCentralSize);var n=t-r;if(0<n)this.isSignature(t,s.CENTRAL_FILE_HEADER)||(this.reader.zero=n);else if(n<0)throw new Error("Corrupted zip: missing "+Math.abs(n)+" bytes.")},prepareReader:function(e){this.reader=n(e);},load:function(e){this.prepareReader(e),this.readEndOfCentral(),this.readCentralDir(),this.readLocalFiles();}},t.exports=h;},{"./reader/readerFor":22,"./signature":23,"./support":30,"./utils":32,"./zipEntry":34}],34:[function(e,t,r){var n=e("./reader/readerFor"),s=e("./utils"),i=e("./compressedObject"),a=e("./crc32"),o=e("./utf8"),h=e("./compressions"),u=e("./support");function l(e,t){this.options=e,this.loadOptions=t;}l.prototype={isEncrypted:function(){return 1==(1&this.bitFlag)},useUTF8:function(){return 2048==(2048&this.bitFlag)},readLocalPart:function(e){var t,r;if(e.skip(22),this.fileNameLength=e.readInt(2),r=e.readInt(2),this.fileName=e.readData(this.fileNameLength),e.skip(r),-1===this.compressedSize||-1===this.uncompressedSize)throw new Error("Bug or corrupted zip : didn't get enough information from the central directory (compressedSize === -1 || uncompressedSize === -1)");if(null===(t=function(e){for(var t in h)if(Object.prototype.hasOwnProperty.call(h,t)&&h[t].magic===e)return h[t];return null}(this.compressionMethod)))throw new Error("Corrupted zip : compression "+s.pretty(this.compressionMethod)+" unknown (inner file : "+s.transformTo("string",this.fileName)+")");this.decompressed=new i(this.compressedSize,this.uncompressedSize,this.crc32,t,e.readData(this.compressedSize));},readCentralPart:function(e){this.versionMadeBy=e.readInt(2),e.skip(2),this.bitFlag=e.readInt(2),this.compressionMethod=e.readString(2),this.date=e.readDate(),this.crc32=e.readInt(4),this.compressedSize=e.readInt(4),this.uncompressedSize=e.readInt(4);var t=e.readInt(2);if(this.extraFieldsLength=e.readInt(2),this.fileCommentLength=e.readInt(2),this.diskNumberStart=e.readInt(2),this.internalFileAttributes=e.readInt(2),this.externalFileAttributes=e.readInt(4),this.localHeaderOffset=e.readInt(4),this.isEncrypted())throw new Error("Encrypted zip are not supported");e.skip(t),this.readExtraFields(e),this.parseZIP64ExtraField(e),this.fileComment=e.readData(this.fileCommentLength);},processAttributes:function(){this.unixPermissions=null,this.dosPermissions=null;var e=this.versionMadeBy>>8;this.dir=!!(16&this.externalFileAttributes),0==e&&(this.dosPermissions=63&this.externalFileAttributes),3==e&&(this.unixPermissions=this.externalFileAttributes>>16&65535),this.dir||"/"!==this.fileNameStr.slice(-1)||(this.dir=true);},parseZIP64ExtraField:function(){if(this.extraFields[1]){var e=n(this.extraFields[1].value);this.uncompressedSize===s.MAX_VALUE_32BITS&&(this.uncompressedSize=e.readInt(8)),this.compressedSize===s.MAX_VALUE_32BITS&&(this.compressedSize=e.readInt(8)),this.localHeaderOffset===s.MAX_VALUE_32BITS&&(this.localHeaderOffset=e.readInt(8)),this.diskNumberStart===s.MAX_VALUE_32BITS&&(this.diskNumberStart=e.readInt(4));}},readExtraFields:function(e){var t,r,n,i=e.index+this.extraFieldsLength;for(this.extraFields||(this.extraFields={});e.index+4<i;)t=e.readInt(2),r=e.readInt(2),n=e.readData(r),this.extraFields[t]={id:t,length:r,value:n};e.setIndex(i);},handleUTF8:function(){var e=u.uint8array?"uint8array":"array";if(this.useUTF8())this.fileNameStr=o.utf8decode(this.fileName),this.fileCommentStr=o.utf8decode(this.fileComment);else {var t=this.findExtraFieldUnicodePath();if(null!==t)this.fileNameStr=t;else {var r=s.transformTo(e,this.fileName);this.fileNameStr=this.loadOptions.decodeFileName(r);}var n=this.findExtraFieldUnicodeComment();if(null!==n)this.fileCommentStr=n;else {var i=s.transformTo(e,this.fileComment);this.fileCommentStr=this.loadOptions.decodeFileName(i);}}},findExtraFieldUnicodePath:function(){var e=this.extraFields[28789];if(e){var t=n(e.value);return 1!==t.readInt(1)?null:a(this.fileName)!==t.readInt(4)?null:o.utf8decode(t.readData(e.length-5))}return null},findExtraFieldUnicodeComment:function(){var e=this.extraFields[25461];if(e){var t=n(e.value);return 1!==t.readInt(1)?null:a(this.fileComment)!==t.readInt(4)?null:o.utf8decode(t.readData(e.length-5))}return null}},t.exports=l;},{"./compressedObject":2,"./compressions":3,"./crc32":4,"./reader/readerFor":22,"./support":30,"./utf8":31,"./utils":32}],35:[function(e,t,r){function n(e,t,r){this.name=e,this.dir=r.dir,this.date=r.date,this.comment=r.comment,this.unixPermissions=r.unixPermissions,this.dosPermissions=r.dosPermissions,this._data=t,this._dataBinary=r.binary,this.options={compression:r.compression,compressionOptions:r.compressionOptions};}var s=e("./stream/StreamHelper"),i=e("./stream/DataWorker"),a=e("./utf8"),o=e("./compressedObject"),h=e("./stream/GenericWorker");n.prototype={internalStream:function(e){var t=null,r="string";try{if(!e)throw new Error("No output type specified.");var n="string"===(r=e.toLowerCase())||"text"===r;"binarystring"!==r&&"text"!==r||(r="string"),t=this._decompressWorker();var i=!this._dataBinary;i&&!n&&(t=t.pipe(new a.Utf8EncodeWorker)),!i&&n&&(t=t.pipe(new a.Utf8DecodeWorker));}catch(e){(t=new h("error")).error(e);}return new s(t,r,"")},async:function(e,t){return this.internalStream(e).accumulate(t)},nodeStream:function(e,t){return this.internalStream(e||"nodebuffer").toNodejsStream(t)},_compressWorker:function(e,t){if(this._data instanceof o&&this._data.compression.magic===e.magic)return this._data.getCompressedWorker();var r=this._decompressWorker();return this._dataBinary||(r=r.pipe(new a.Utf8EncodeWorker)),o.createWorkerFrom(r,e,t)},_decompressWorker:function(){return this._data instanceof o?this._data.getContentWorker():this._data instanceof h?this._data:new i(this._data)}};for(var u=["asText","asBinary","asNodeBuffer","asUint8Array","asArrayBuffer"],l=function(){throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.")},f=0;f<u.length;f++)n.prototype[u[f]]=l;t.exports=n;},{"./compressedObject":2,"./stream/DataWorker":27,"./stream/GenericWorker":28,"./stream/StreamHelper":29,"./utf8":31}],36:[function(e,l,t){(function(t){var r,n,e=t.MutationObserver||t.WebKitMutationObserver;if(e){var i=0,s=new e(u),a=t.document.createTextNode("");s.observe(a,{characterData:true}),r=function(){a.data=i=++i%2;};}else if(t.setImmediate||void 0===t.MessageChannel)r="document"in t&&"onreadystatechange"in t.document.createElement("script")?function(){var e=t.document.createElement("script");e.onreadystatechange=function(){u(),e.onreadystatechange=null,e.parentNode.removeChild(e),e=null;},t.document.documentElement.appendChild(e);}:function(){setTimeout(u,0);};else {var o=new t.MessageChannel;o.port1.onmessage=u,r=function(){o.port2.postMessage(0);};}var h=[];function u(){var e,t;n=true;for(var r=h.length;r;){for(t=h,h=[],e=-1;++e<r;)t[e]();r=h.length;}n=false;}l.exports=function(e){1!==h.push(e)||n||r();};}).call(this,"undefined"!=typeof commonjsGlobal?commonjsGlobal:"undefined"!=typeof self?self:"undefined"!=typeof window?window:{});},{}],37:[function(e,t,r){var i=e("immediate");function u(){}var l={},s=["REJECTED"],a=["FULFILLED"],n=["PENDING"];function o(e){if("function"!=typeof e)throw new TypeError("resolver must be a function");this.state=n,this.queue=[],this.outcome=void 0,e!==u&&d(this,e);}function h(e,t,r){this.promise=e,"function"==typeof t&&(this.onFulfilled=t,this.callFulfilled=this.otherCallFulfilled),"function"==typeof r&&(this.onRejected=r,this.callRejected=this.otherCallRejected);}function f(t,r,n){i(function(){var e;try{e=r(n);}catch(e){return l.reject(t,e)}e===t?l.reject(t,new TypeError("Cannot resolve promise with itself")):l.resolve(t,e);});}function c(e){var t=e&&e.then;if(e&&("object"==typeof e||"function"==typeof e)&&"function"==typeof t)return function(){t.apply(e,arguments);}}function d(t,e){var r=false;function n(e){r||(r=true,l.reject(t,e));}function i(e){r||(r=true,l.resolve(t,e));}var s=p(function(){e(i,n);});"error"===s.status&&n(s.value);}function p(e,t){var r={};try{r.value=e(t),r.status="success";}catch(e){r.status="error",r.value=e;}return r}(t.exports=o).prototype.finally=function(t){if("function"!=typeof t)return this;var r=this.constructor;return this.then(function(e){return r.resolve(t()).then(function(){return e})},function(e){return r.resolve(t()).then(function(){throw e})})},o.prototype.catch=function(e){return this.then(null,e)},o.prototype.then=function(e,t){if("function"!=typeof e&&this.state===a||"function"!=typeof t&&this.state===s)return this;var r=new this.constructor(u);this.state!==n?f(r,this.state===a?e:t,this.outcome):this.queue.push(new h(r,e,t));return r},h.prototype.callFulfilled=function(e){l.resolve(this.promise,e);},h.prototype.otherCallFulfilled=function(e){f(this.promise,this.onFulfilled,e);},h.prototype.callRejected=function(e){l.reject(this.promise,e);},h.prototype.otherCallRejected=function(e){f(this.promise,this.onRejected,e);},l.resolve=function(e,t){var r=p(c,t);if("error"===r.status)return l.reject(e,r.value);var n=r.value;if(n)d(e,n);else {e.state=a,e.outcome=t;for(var i=-1,s=e.queue.length;++i<s;)e.queue[i].callFulfilled(t);}return e},l.reject=function(e,t){e.state=s,e.outcome=t;for(var r=-1,n=e.queue.length;++r<n;)e.queue[r].callRejected(t);return e},o.resolve=function(e){if(e instanceof this)return e;return l.resolve(new this(u),e)},o.reject=function(e){var t=new this(u);return l.reject(t,e)},o.all=function(e){var r=this;if("[object Array]"!==Object.prototype.toString.call(e))return this.reject(new TypeError("must be an array"));var n=e.length,i=false;if(!n)return this.resolve([]);var s=new Array(n),a=0,t=-1,o=new this(u);for(;++t<n;)h(e[t],t);return o;function h(e,t){r.resolve(e).then(function(e){s[t]=e,++a!==n||i||(i=true,l.resolve(o,s));},function(e){i||(i=true,l.reject(o,e));});}},o.race=function(e){var t=this;if("[object Array]"!==Object.prototype.toString.call(e))return this.reject(new TypeError("must be an array"));var r=e.length,n=false;if(!r)return this.resolve([]);var i=-1,s=new this(u);for(;++i<r;)a=e[i],t.resolve(a).then(function(e){n||(n=true,l.resolve(s,e));},function(e){n||(n=true,l.reject(s,e));});var a;return s};},{immediate:36}],38:[function(e,t,r){var n={};(0, e("./lib/utils/common").assign)(n,e("./lib/deflate"),e("./lib/inflate"),e("./lib/zlib/constants")),t.exports=n;},{"./lib/deflate":39,"./lib/inflate":40,"./lib/utils/common":41,"./lib/zlib/constants":44}],39:[function(e,t,r){var a=e("./zlib/deflate"),o=e("./utils/common"),h=e("./utils/strings"),i=e("./zlib/messages"),s=e("./zlib/zstream"),u=Object.prototype.toString,l=0,f=-1,c=0,d=8;function p(e){if(!(this instanceof p))return new p(e);this.options=o.assign({level:f,method:d,chunkSize:16384,windowBits:15,memLevel:8,strategy:c,to:""},e||{});var t=this.options;t.raw&&0<t.windowBits?t.windowBits=-t.windowBits:t.gzip&&0<t.windowBits&&t.windowBits<16&&(t.windowBits+=16),this.err=0,this.msg="",this.ended=false,this.chunks=[],this.strm=new s,this.strm.avail_out=0;var r=a.deflateInit2(this.strm,t.level,t.method,t.windowBits,t.memLevel,t.strategy);if(r!==l)throw new Error(i[r]);if(t.header&&a.deflateSetHeader(this.strm,t.header),t.dictionary){var n;if(n="string"==typeof t.dictionary?h.string2buf(t.dictionary):"[object ArrayBuffer]"===u.call(t.dictionary)?new Uint8Array(t.dictionary):t.dictionary,(r=a.deflateSetDictionary(this.strm,n))!==l)throw new Error(i[r]);this._dict_set=true;}}function n(e,t){var r=new p(t);if(r.push(e,true),r.err)throw r.msg||i[r.err];return r.result}p.prototype.push=function(e,t){var r,n,i=this.strm,s=this.options.chunkSize;if(this.ended)return  false;n=t===~~t?t:true===t?4:0,"string"==typeof e?i.input=h.string2buf(e):"[object ArrayBuffer]"===u.call(e)?i.input=new Uint8Array(e):i.input=e,i.next_in=0,i.avail_in=i.input.length;do{if(0===i.avail_out&&(i.output=new o.Buf8(s),i.next_out=0,i.avail_out=s),1!==(r=a.deflate(i,n))&&r!==l)return this.onEnd(r),!(this.ended=true);0!==i.avail_out&&(0!==i.avail_in||4!==n&&2!==n)||("string"===this.options.to?this.onData(h.buf2binstring(o.shrinkBuf(i.output,i.next_out))):this.onData(o.shrinkBuf(i.output,i.next_out)));}while((0<i.avail_in||0===i.avail_out)&&1!==r);return 4===n?(r=a.deflateEnd(this.strm),this.onEnd(r),this.ended=true,r===l):2!==n||(this.onEnd(l),!(i.avail_out=0))},p.prototype.onData=function(e){this.chunks.push(e);},p.prototype.onEnd=function(e){e===l&&("string"===this.options.to?this.result=this.chunks.join(""):this.result=o.flattenChunks(this.chunks)),this.chunks=[],this.err=e,this.msg=this.strm.msg;},r.Deflate=p,r.deflate=n,r.deflateRaw=function(e,t){return (t=t||{}).raw=true,n(e,t)},r.gzip=function(e,t){return (t=t||{}).gzip=true,n(e,t)};},{"./utils/common":41,"./utils/strings":42,"./zlib/deflate":46,"./zlib/messages":51,"./zlib/zstream":53}],40:[function(e,t,r){var c=e("./zlib/inflate"),d=e("./utils/common"),p=e("./utils/strings"),m=e("./zlib/constants"),n=e("./zlib/messages"),i=e("./zlib/zstream"),s=e("./zlib/gzheader"),_=Object.prototype.toString;function a(e){if(!(this instanceof a))return new a(e);this.options=d.assign({chunkSize:16384,windowBits:0,to:""},e||{});var t=this.options;t.raw&&0<=t.windowBits&&t.windowBits<16&&(t.windowBits=-t.windowBits,0===t.windowBits&&(t.windowBits=-15)),!(0<=t.windowBits&&t.windowBits<16)||e&&e.windowBits||(t.windowBits+=32),15<t.windowBits&&t.windowBits<48&&0==(15&t.windowBits)&&(t.windowBits|=15),this.err=0,this.msg="",this.ended=false,this.chunks=[],this.strm=new i,this.strm.avail_out=0;var r=c.inflateInit2(this.strm,t.windowBits);if(r!==m.Z_OK)throw new Error(n[r]);this.header=new s,c.inflateGetHeader(this.strm,this.header);}function o(e,t){var r=new a(t);if(r.push(e,true),r.err)throw r.msg||n[r.err];return r.result}a.prototype.push=function(e,t){var r,n,i,s,a,o,h=this.strm,u=this.options.chunkSize,l=this.options.dictionary,f=false;if(this.ended)return  false;n=t===~~t?t:true===t?m.Z_FINISH:m.Z_NO_FLUSH,"string"==typeof e?h.input=p.binstring2buf(e):"[object ArrayBuffer]"===_.call(e)?h.input=new Uint8Array(e):h.input=e,h.next_in=0,h.avail_in=h.input.length;do{if(0===h.avail_out&&(h.output=new d.Buf8(u),h.next_out=0,h.avail_out=u),(r=c.inflate(h,m.Z_NO_FLUSH))===m.Z_NEED_DICT&&l&&(o="string"==typeof l?p.string2buf(l):"[object ArrayBuffer]"===_.call(l)?new Uint8Array(l):l,r=c.inflateSetDictionary(this.strm,o)),r===m.Z_BUF_ERROR&&true===f&&(r=m.Z_OK,f=false),r!==m.Z_STREAM_END&&r!==m.Z_OK)return this.onEnd(r),!(this.ended=true);h.next_out&&(0!==h.avail_out&&r!==m.Z_STREAM_END&&(0!==h.avail_in||n!==m.Z_FINISH&&n!==m.Z_SYNC_FLUSH)||("string"===this.options.to?(i=p.utf8border(h.output,h.next_out),s=h.next_out-i,a=p.buf2string(h.output,i),h.next_out=s,h.avail_out=u-s,s&&d.arraySet(h.output,h.output,i,s,0),this.onData(a)):this.onData(d.shrinkBuf(h.output,h.next_out)))),0===h.avail_in&&0===h.avail_out&&(f=true);}while((0<h.avail_in||0===h.avail_out)&&r!==m.Z_STREAM_END);return r===m.Z_STREAM_END&&(n=m.Z_FINISH),n===m.Z_FINISH?(r=c.inflateEnd(this.strm),this.onEnd(r),this.ended=true,r===m.Z_OK):n!==m.Z_SYNC_FLUSH||(this.onEnd(m.Z_OK),!(h.avail_out=0))},a.prototype.onData=function(e){this.chunks.push(e);},a.prototype.onEnd=function(e){e===m.Z_OK&&("string"===this.options.to?this.result=this.chunks.join(""):this.result=d.flattenChunks(this.chunks)),this.chunks=[],this.err=e,this.msg=this.strm.msg;},r.Inflate=a,r.inflate=o,r.inflateRaw=function(e,t){return (t=t||{}).raw=true,o(e,t)},r.ungzip=o;},{"./utils/common":41,"./utils/strings":42,"./zlib/constants":44,"./zlib/gzheader":47,"./zlib/inflate":49,"./zlib/messages":51,"./zlib/zstream":53}],41:[function(e,t,r){var n="undefined"!=typeof Uint8Array&&"undefined"!=typeof Uint16Array&&"undefined"!=typeof Int32Array;r.assign=function(e){for(var t=Array.prototype.slice.call(arguments,1);t.length;){var r=t.shift();if(r){if("object"!=typeof r)throw new TypeError(r+"must be non-object");for(var n in r)r.hasOwnProperty(n)&&(e[n]=r[n]);}}return e},r.shrinkBuf=function(e,t){return e.length===t?e:e.subarray?e.subarray(0,t):(e.length=t,e)};var i={arraySet:function(e,t,r,n,i){if(t.subarray&&e.subarray)e.set(t.subarray(r,r+n),i);else for(var s=0;s<n;s++)e[i+s]=t[r+s];},flattenChunks:function(e){var t,r,n,i,s,a;for(t=n=0,r=e.length;t<r;t++)n+=e[t].length;for(a=new Uint8Array(n),t=i=0,r=e.length;t<r;t++)s=e[t],a.set(s,i),i+=s.length;return a}},s={arraySet:function(e,t,r,n,i){for(var s=0;s<n;s++)e[i+s]=t[r+s];},flattenChunks:function(e){return [].concat.apply([],e)}};r.setTyped=function(e){e?(r.Buf8=Uint8Array,r.Buf16=Uint16Array,r.Buf32=Int32Array,r.assign(r,i)):(r.Buf8=Array,r.Buf16=Array,r.Buf32=Array,r.assign(r,s));},r.setTyped(n);},{}],42:[function(e,t,r){var h=e("./common"),i=true,s=true;try{String.fromCharCode.apply(null,[0]);}catch(e){i=false;}try{String.fromCharCode.apply(null,new Uint8Array(1));}catch(e){s=false;}for(var u=new h.Buf8(256),n=0;n<256;n++)u[n]=252<=n?6:248<=n?5:240<=n?4:224<=n?3:192<=n?2:1;function l(e,t){if(t<65537&&(e.subarray&&s||!e.subarray&&i))return String.fromCharCode.apply(null,h.shrinkBuf(e,t));for(var r="",n=0;n<t;n++)r+=String.fromCharCode(e[n]);return r}u[254]=u[254]=1,r.string2buf=function(e){var t,r,n,i,s,a=e.length,o=0;for(i=0;i<a;i++)55296==(64512&(r=e.charCodeAt(i)))&&i+1<a&&56320==(64512&(n=e.charCodeAt(i+1)))&&(r=65536+(r-55296<<10)+(n-56320),i++),o+=r<128?1:r<2048?2:r<65536?3:4;for(t=new h.Buf8(o),i=s=0;s<o;i++)55296==(64512&(r=e.charCodeAt(i)))&&i+1<a&&56320==(64512&(n=e.charCodeAt(i+1)))&&(r=65536+(r-55296<<10)+(n-56320),i++),r<128?t[s++]=r:(r<2048?t[s++]=192|r>>>6:(r<65536?t[s++]=224|r>>>12:(t[s++]=240|r>>>18,t[s++]=128|r>>>12&63),t[s++]=128|r>>>6&63),t[s++]=128|63&r);return t},r.buf2binstring=function(e){return l(e,e.length)},r.binstring2buf=function(e){for(var t=new h.Buf8(e.length),r=0,n=t.length;r<n;r++)t[r]=e.charCodeAt(r);return t},r.buf2string=function(e,t){var r,n,i,s,a=t||e.length,o=new Array(2*a);for(r=n=0;r<a;)if((i=e[r++])<128)o[n++]=i;else if(4<(s=u[i]))o[n++]=65533,r+=s-1;else {for(i&=2===s?31:3===s?15:7;1<s&&r<a;)i=i<<6|63&e[r++],s--;1<s?o[n++]=65533:i<65536?o[n++]=i:(i-=65536,o[n++]=55296|i>>10&1023,o[n++]=56320|1023&i);}return l(o,n)},r.utf8border=function(e,t){var r;for((t=t||e.length)>e.length&&(t=e.length),r=t-1;0<=r&&128==(192&e[r]);)r--;return r<0?t:0===r?t:r+u[e[r]]>t?r:t};},{"./common":41}],43:[function(e,t,r){t.exports=function(e,t,r,n){for(var i=65535&e|0,s=e>>>16&65535|0,a=0;0!==r;){for(r-=a=2e3<r?2e3:r;s=s+(i=i+t[n++]|0)|0,--a;);i%=65521,s%=65521;}return i|s<<16|0};},{}],44:[function(e,t,r){t.exports={Z_NO_FLUSH:0,Z_PARTIAL_FLUSH:1,Z_SYNC_FLUSH:2,Z_FULL_FLUSH:3,Z_FINISH:4,Z_BLOCK:5,Z_TREES:6,Z_OK:0,Z_STREAM_END:1,Z_NEED_DICT:2,Z_ERRNO:-1,Z_STREAM_ERROR:-2,Z_DATA_ERROR:-3,Z_BUF_ERROR:-5,Z_NO_COMPRESSION:0,Z_BEST_SPEED:1,Z_BEST_COMPRESSION:9,Z_DEFAULT_COMPRESSION:-1,Z_FILTERED:1,Z_HUFFMAN_ONLY:2,Z_RLE:3,Z_FIXED:4,Z_DEFAULT_STRATEGY:0,Z_BINARY:0,Z_TEXT:1,Z_UNKNOWN:2,Z_DEFLATED:8};},{}],45:[function(e,t,r){var o=function(){for(var e,t=[],r=0;r<256;r++){e=r;for(var n=0;n<8;n++)e=1&e?3988292384^e>>>1:e>>>1;t[r]=e;}return t}();t.exports=function(e,t,r,n){var i=o,s=n+r;e^=-1;for(var a=n;a<s;a++)e=e>>>8^i[255&(e^t[a])];return  -1^e};},{}],46:[function(e,t,r){var h,c=e("../utils/common"),u=e("./trees"),d=e("./adler32"),p=e("./crc32"),n=e("./messages"),l=0,f=4,m=0,_=-2,g=-1,b=4,i=2,v=8,y=9,s=286,a=30,o=19,w=2*s+1,k=15,x=3,S=258,z=S+x+1,C=42,E=113,A=1,I=2,O=3,B=4;function R(e,t){return e.msg=n[t],t}function T(e){return (e<<1)-(4<e?9:0)}function D(e){for(var t=e.length;0<=--t;)e[t]=0;}function F(e){var t=e.state,r=t.pending;r>e.avail_out&&(r=e.avail_out),0!==r&&(c.arraySet(e.output,t.pending_buf,t.pending_out,r,e.next_out),e.next_out+=r,t.pending_out+=r,e.total_out+=r,e.avail_out-=r,t.pending-=r,0===t.pending&&(t.pending_out=0));}function N(e,t){u._tr_flush_block(e,0<=e.block_start?e.block_start:-1,e.strstart-e.block_start,t),e.block_start=e.strstart,F(e.strm);}function U(e,t){e.pending_buf[e.pending++]=t;}function P(e,t){e.pending_buf[e.pending++]=t>>>8&255,e.pending_buf[e.pending++]=255&t;}function L(e,t){var r,n,i=e.max_chain_length,s=e.strstart,a=e.prev_length,o=e.nice_match,h=e.strstart>e.w_size-z?e.strstart-(e.w_size-z):0,u=e.window,l=e.w_mask,f=e.prev,c=e.strstart+S,d=u[s+a-1],p=u[s+a];e.prev_length>=e.good_match&&(i>>=2),o>e.lookahead&&(o=e.lookahead);do{if(u[(r=t)+a]===p&&u[r+a-1]===d&&u[r]===u[s]&&u[++r]===u[s+1]){s+=2,r++;do{}while(u[++s]===u[++r]&&u[++s]===u[++r]&&u[++s]===u[++r]&&u[++s]===u[++r]&&u[++s]===u[++r]&&u[++s]===u[++r]&&u[++s]===u[++r]&&u[++s]===u[++r]&&s<c);if(n=S-(c-s),s=c-S,a<n){if(e.match_start=t,o<=(a=n))break;d=u[s+a-1],p=u[s+a];}}}while((t=f[t&l])>h&&0!=--i);return a<=e.lookahead?a:e.lookahead}function j(e){var t,r,n,i,s,a,o,h,u,l,f=e.w_size;do{if(i=e.window_size-e.lookahead-e.strstart,e.strstart>=f+(f-z)){for(c.arraySet(e.window,e.window,f,f,0),e.match_start-=f,e.strstart-=f,e.block_start-=f,t=r=e.hash_size;n=e.head[--t],e.head[t]=f<=n?n-f:0,--r;);for(t=r=f;n=e.prev[--t],e.prev[t]=f<=n?n-f:0,--r;);i+=f;}if(0===e.strm.avail_in)break;if(a=e.strm,o=e.window,h=e.strstart+e.lookahead,u=i,l=void 0,l=a.avail_in,u<l&&(l=u),r=0===l?0:(a.avail_in-=l,c.arraySet(o,a.input,a.next_in,l,h),1===a.state.wrap?a.adler=d(a.adler,o,l,h):2===a.state.wrap&&(a.adler=p(a.adler,o,l,h)),a.next_in+=l,a.total_in+=l,l),e.lookahead+=r,e.lookahead+e.insert>=x)for(s=e.strstart-e.insert,e.ins_h=e.window[s],e.ins_h=(e.ins_h<<e.hash_shift^e.window[s+1])&e.hash_mask;e.insert&&(e.ins_h=(e.ins_h<<e.hash_shift^e.window[s+x-1])&e.hash_mask,e.prev[s&e.w_mask]=e.head[e.ins_h],e.head[e.ins_h]=s,s++,e.insert--,!(e.lookahead+e.insert<x)););}while(e.lookahead<z&&0!==e.strm.avail_in)}function Z(e,t){for(var r,n;;){if(e.lookahead<z){if(j(e),e.lookahead<z&&t===l)return A;if(0===e.lookahead)break}if(r=0,e.lookahead>=x&&(e.ins_h=(e.ins_h<<e.hash_shift^e.window[e.strstart+x-1])&e.hash_mask,r=e.prev[e.strstart&e.w_mask]=e.head[e.ins_h],e.head[e.ins_h]=e.strstart),0!==r&&e.strstart-r<=e.w_size-z&&(e.match_length=L(e,r)),e.match_length>=x)if(n=u._tr_tally(e,e.strstart-e.match_start,e.match_length-x),e.lookahead-=e.match_length,e.match_length<=e.max_lazy_match&&e.lookahead>=x){for(e.match_length--;e.strstart++,e.ins_h=(e.ins_h<<e.hash_shift^e.window[e.strstart+x-1])&e.hash_mask,r=e.prev[e.strstart&e.w_mask]=e.head[e.ins_h],e.head[e.ins_h]=e.strstart,0!=--e.match_length;);e.strstart++;}else e.strstart+=e.match_length,e.match_length=0,e.ins_h=e.window[e.strstart],e.ins_h=(e.ins_h<<e.hash_shift^e.window[e.strstart+1])&e.hash_mask;else n=u._tr_tally(e,0,e.window[e.strstart]),e.lookahead--,e.strstart++;if(n&&(N(e,false),0===e.strm.avail_out))return A}return e.insert=e.strstart<x-1?e.strstart:x-1,t===f?(N(e,true),0===e.strm.avail_out?O:B):e.last_lit&&(N(e,false),0===e.strm.avail_out)?A:I}function W(e,t){for(var r,n,i;;){if(e.lookahead<z){if(j(e),e.lookahead<z&&t===l)return A;if(0===e.lookahead)break}if(r=0,e.lookahead>=x&&(e.ins_h=(e.ins_h<<e.hash_shift^e.window[e.strstart+x-1])&e.hash_mask,r=e.prev[e.strstart&e.w_mask]=e.head[e.ins_h],e.head[e.ins_h]=e.strstart),e.prev_length=e.match_length,e.prev_match=e.match_start,e.match_length=x-1,0!==r&&e.prev_length<e.max_lazy_match&&e.strstart-r<=e.w_size-z&&(e.match_length=L(e,r),e.match_length<=5&&(1===e.strategy||e.match_length===x&&4096<e.strstart-e.match_start)&&(e.match_length=x-1)),e.prev_length>=x&&e.match_length<=e.prev_length){for(i=e.strstart+e.lookahead-x,n=u._tr_tally(e,e.strstart-1-e.prev_match,e.prev_length-x),e.lookahead-=e.prev_length-1,e.prev_length-=2;++e.strstart<=i&&(e.ins_h=(e.ins_h<<e.hash_shift^e.window[e.strstart+x-1])&e.hash_mask,r=e.prev[e.strstart&e.w_mask]=e.head[e.ins_h],e.head[e.ins_h]=e.strstart),0!=--e.prev_length;);if(e.match_available=0,e.match_length=x-1,e.strstart++,n&&(N(e,false),0===e.strm.avail_out))return A}else if(e.match_available){if((n=u._tr_tally(e,0,e.window[e.strstart-1]))&&N(e,false),e.strstart++,e.lookahead--,0===e.strm.avail_out)return A}else e.match_available=1,e.strstart++,e.lookahead--;}return e.match_available&&(n=u._tr_tally(e,0,e.window[e.strstart-1]),e.match_available=0),e.insert=e.strstart<x-1?e.strstart:x-1,t===f?(N(e,true),0===e.strm.avail_out?O:B):e.last_lit&&(N(e,false),0===e.strm.avail_out)?A:I}function M(e,t,r,n,i){this.good_length=e,this.max_lazy=t,this.nice_length=r,this.max_chain=n,this.func=i;}function H(){this.strm=null,this.status=0,this.pending_buf=null,this.pending_buf_size=0,this.pending_out=0,this.pending=0,this.wrap=0,this.gzhead=null,this.gzindex=0,this.method=v,this.last_flush=-1,this.w_size=0,this.w_bits=0,this.w_mask=0,this.window=null,this.window_size=0,this.prev=null,this.head=null,this.ins_h=0,this.hash_size=0,this.hash_bits=0,this.hash_mask=0,this.hash_shift=0,this.block_start=0,this.match_length=0,this.prev_match=0,this.match_available=0,this.strstart=0,this.match_start=0,this.lookahead=0,this.prev_length=0,this.max_chain_length=0,this.max_lazy_match=0,this.level=0,this.strategy=0,this.good_match=0,this.nice_match=0,this.dyn_ltree=new c.Buf16(2*w),this.dyn_dtree=new c.Buf16(2*(2*a+1)),this.bl_tree=new c.Buf16(2*(2*o+1)),D(this.dyn_ltree),D(this.dyn_dtree),D(this.bl_tree),this.l_desc=null,this.d_desc=null,this.bl_desc=null,this.bl_count=new c.Buf16(k+1),this.heap=new c.Buf16(2*s+1),D(this.heap),this.heap_len=0,this.heap_max=0,this.depth=new c.Buf16(2*s+1),D(this.depth),this.l_buf=0,this.lit_bufsize=0,this.last_lit=0,this.d_buf=0,this.opt_len=0,this.static_len=0,this.matches=0,this.insert=0,this.bi_buf=0,this.bi_valid=0;}function G(e){var t;return e&&e.state?(e.total_in=e.total_out=0,e.data_type=i,(t=e.state).pending=0,t.pending_out=0,t.wrap<0&&(t.wrap=-t.wrap),t.status=t.wrap?C:E,e.adler=2===t.wrap?0:1,t.last_flush=l,u._tr_init(t),m):R(e,_)}function K(e){var t=G(e);return t===m&&function(e){e.window_size=2*e.w_size,D(e.head),e.max_lazy_match=h[e.level].max_lazy,e.good_match=h[e.level].good_length,e.nice_match=h[e.level].nice_length,e.max_chain_length=h[e.level].max_chain,e.strstart=0,e.block_start=0,e.lookahead=0,e.insert=0,e.match_length=e.prev_length=x-1,e.match_available=0,e.ins_h=0;}(e.state),t}function Y(e,t,r,n,i,s){if(!e)return _;var a=1;if(t===g&&(t=6),n<0?(a=0,n=-n):15<n&&(a=2,n-=16),i<1||y<i||r!==v||n<8||15<n||t<0||9<t||s<0||b<s)return R(e,_);8===n&&(n=9);var o=new H;return (e.state=o).strm=e,o.wrap=a,o.gzhead=null,o.w_bits=n,o.w_size=1<<o.w_bits,o.w_mask=o.w_size-1,o.hash_bits=i+7,o.hash_size=1<<o.hash_bits,o.hash_mask=o.hash_size-1,o.hash_shift=~~((o.hash_bits+x-1)/x),o.window=new c.Buf8(2*o.w_size),o.head=new c.Buf16(o.hash_size),o.prev=new c.Buf16(o.w_size),o.lit_bufsize=1<<i+6,o.pending_buf_size=4*o.lit_bufsize,o.pending_buf=new c.Buf8(o.pending_buf_size),o.d_buf=1*o.lit_bufsize,o.l_buf=3*o.lit_bufsize,o.level=t,o.strategy=s,o.method=r,K(e)}h=[new M(0,0,0,0,function(e,t){var r=65535;for(r>e.pending_buf_size-5&&(r=e.pending_buf_size-5);;){if(e.lookahead<=1){if(j(e),0===e.lookahead&&t===l)return A;if(0===e.lookahead)break}e.strstart+=e.lookahead,e.lookahead=0;var n=e.block_start+r;if((0===e.strstart||e.strstart>=n)&&(e.lookahead=e.strstart-n,e.strstart=n,N(e,false),0===e.strm.avail_out))return A;if(e.strstart-e.block_start>=e.w_size-z&&(N(e,false),0===e.strm.avail_out))return A}return e.insert=0,t===f?(N(e,true),0===e.strm.avail_out?O:B):(e.strstart>e.block_start&&(N(e,false),e.strm.avail_out),A)}),new M(4,4,8,4,Z),new M(4,5,16,8,Z),new M(4,6,32,32,Z),new M(4,4,16,16,W),new M(8,16,32,32,W),new M(8,16,128,128,W),new M(8,32,128,256,W),new M(32,128,258,1024,W),new M(32,258,258,4096,W)],r.deflateInit=function(e,t){return Y(e,t,v,15,8,0)},r.deflateInit2=Y,r.deflateReset=K,r.deflateResetKeep=G,r.deflateSetHeader=function(e,t){return e&&e.state?2!==e.state.wrap?_:(e.state.gzhead=t,m):_},r.deflate=function(e,t){var r,n,i,s;if(!e||!e.state||5<t||t<0)return e?R(e,_):_;if(n=e.state,!e.output||!e.input&&0!==e.avail_in||666===n.status&&t!==f)return R(e,0===e.avail_out?-5:_);if(n.strm=e,r=n.last_flush,n.last_flush=t,n.status===C)if(2===n.wrap)e.adler=0,U(n,31),U(n,139),U(n,8),n.gzhead?(U(n,(n.gzhead.text?1:0)+(n.gzhead.hcrc?2:0)+(n.gzhead.extra?4:0)+(n.gzhead.name?8:0)+(n.gzhead.comment?16:0)),U(n,255&n.gzhead.time),U(n,n.gzhead.time>>8&255),U(n,n.gzhead.time>>16&255),U(n,n.gzhead.time>>24&255),U(n,9===n.level?2:2<=n.strategy||n.level<2?4:0),U(n,255&n.gzhead.os),n.gzhead.extra&&n.gzhead.extra.length&&(U(n,255&n.gzhead.extra.length),U(n,n.gzhead.extra.length>>8&255)),n.gzhead.hcrc&&(e.adler=p(e.adler,n.pending_buf,n.pending,0)),n.gzindex=0,n.status=69):(U(n,0),U(n,0),U(n,0),U(n,0),U(n,0),U(n,9===n.level?2:2<=n.strategy||n.level<2?4:0),U(n,3),n.status=E);else {var a=v+(n.w_bits-8<<4)<<8;a|=(2<=n.strategy||n.level<2?0:n.level<6?1:6===n.level?2:3)<<6,0!==n.strstart&&(a|=32),a+=31-a%31,n.status=E,P(n,a),0!==n.strstart&&(P(n,e.adler>>>16),P(n,65535&e.adler)),e.adler=1;}if(69===n.status)if(n.gzhead.extra){for(i=n.pending;n.gzindex<(65535&n.gzhead.extra.length)&&(n.pending!==n.pending_buf_size||(n.gzhead.hcrc&&n.pending>i&&(e.adler=p(e.adler,n.pending_buf,n.pending-i,i)),F(e),i=n.pending,n.pending!==n.pending_buf_size));)U(n,255&n.gzhead.extra[n.gzindex]),n.gzindex++;n.gzhead.hcrc&&n.pending>i&&(e.adler=p(e.adler,n.pending_buf,n.pending-i,i)),n.gzindex===n.gzhead.extra.length&&(n.gzindex=0,n.status=73);}else n.status=73;if(73===n.status)if(n.gzhead.name){i=n.pending;do{if(n.pending===n.pending_buf_size&&(n.gzhead.hcrc&&n.pending>i&&(e.adler=p(e.adler,n.pending_buf,n.pending-i,i)),F(e),i=n.pending,n.pending===n.pending_buf_size)){s=1;break}s=n.gzindex<n.gzhead.name.length?255&n.gzhead.name.charCodeAt(n.gzindex++):0,U(n,s);}while(0!==s);n.gzhead.hcrc&&n.pending>i&&(e.adler=p(e.adler,n.pending_buf,n.pending-i,i)),0===s&&(n.gzindex=0,n.status=91);}else n.status=91;if(91===n.status)if(n.gzhead.comment){i=n.pending;do{if(n.pending===n.pending_buf_size&&(n.gzhead.hcrc&&n.pending>i&&(e.adler=p(e.adler,n.pending_buf,n.pending-i,i)),F(e),i=n.pending,n.pending===n.pending_buf_size)){s=1;break}s=n.gzindex<n.gzhead.comment.length?255&n.gzhead.comment.charCodeAt(n.gzindex++):0,U(n,s);}while(0!==s);n.gzhead.hcrc&&n.pending>i&&(e.adler=p(e.adler,n.pending_buf,n.pending-i,i)),0===s&&(n.status=103);}else n.status=103;if(103===n.status&&(n.gzhead.hcrc?(n.pending+2>n.pending_buf_size&&F(e),n.pending+2<=n.pending_buf_size&&(U(n,255&e.adler),U(n,e.adler>>8&255),e.adler=0,n.status=E)):n.status=E),0!==n.pending){if(F(e),0===e.avail_out)return n.last_flush=-1,m}else if(0===e.avail_in&&T(t)<=T(r)&&t!==f)return R(e,-5);if(666===n.status&&0!==e.avail_in)return R(e,-5);if(0!==e.avail_in||0!==n.lookahead||t!==l&&666!==n.status){var o=2===n.strategy?function(e,t){for(var r;;){if(0===e.lookahead&&(j(e),0===e.lookahead)){if(t===l)return A;break}if(e.match_length=0,r=u._tr_tally(e,0,e.window[e.strstart]),e.lookahead--,e.strstart++,r&&(N(e,false),0===e.strm.avail_out))return A}return e.insert=0,t===f?(N(e,true),0===e.strm.avail_out?O:B):e.last_lit&&(N(e,false),0===e.strm.avail_out)?A:I}(n,t):3===n.strategy?function(e,t){for(var r,n,i,s,a=e.window;;){if(e.lookahead<=S){if(j(e),e.lookahead<=S&&t===l)return A;if(0===e.lookahead)break}if(e.match_length=0,e.lookahead>=x&&0<e.strstart&&(n=a[i=e.strstart-1])===a[++i]&&n===a[++i]&&n===a[++i]){s=e.strstart+S;do{}while(n===a[++i]&&n===a[++i]&&n===a[++i]&&n===a[++i]&&n===a[++i]&&n===a[++i]&&n===a[++i]&&n===a[++i]&&i<s);e.match_length=S-(s-i),e.match_length>e.lookahead&&(e.match_length=e.lookahead);}if(e.match_length>=x?(r=u._tr_tally(e,1,e.match_length-x),e.lookahead-=e.match_length,e.strstart+=e.match_length,e.match_length=0):(r=u._tr_tally(e,0,e.window[e.strstart]),e.lookahead--,e.strstart++),r&&(N(e,false),0===e.strm.avail_out))return A}return e.insert=0,t===f?(N(e,true),0===e.strm.avail_out?O:B):e.last_lit&&(N(e,false),0===e.strm.avail_out)?A:I}(n,t):h[n.level].func(n,t);if(o!==O&&o!==B||(n.status=666),o===A||o===O)return 0===e.avail_out&&(n.last_flush=-1),m;if(o===I&&(1===t?u._tr_align(n):5!==t&&(u._tr_stored_block(n,0,0,false),3===t&&(D(n.head),0===n.lookahead&&(n.strstart=0,n.block_start=0,n.insert=0))),F(e),0===e.avail_out))return n.last_flush=-1,m}return t!==f?m:n.wrap<=0?1:(2===n.wrap?(U(n,255&e.adler),U(n,e.adler>>8&255),U(n,e.adler>>16&255),U(n,e.adler>>24&255),U(n,255&e.total_in),U(n,e.total_in>>8&255),U(n,e.total_in>>16&255),U(n,e.total_in>>24&255)):(P(n,e.adler>>>16),P(n,65535&e.adler)),F(e),0<n.wrap&&(n.wrap=-n.wrap),0!==n.pending?m:1)},r.deflateEnd=function(e){var t;return e&&e.state?(t=e.state.status)!==C&&69!==t&&73!==t&&91!==t&&103!==t&&t!==E&&666!==t?R(e,_):(e.state=null,t===E?R(e,-3):m):_},r.deflateSetDictionary=function(e,t){var r,n,i,s,a,o,h,u,l=t.length;if(!e||!e.state)return _;if(2===(s=(r=e.state).wrap)||1===s&&r.status!==C||r.lookahead)return _;for(1===s&&(e.adler=d(e.adler,t,l,0)),r.wrap=0,l>=r.w_size&&(0===s&&(D(r.head),r.strstart=0,r.block_start=0,r.insert=0),u=new c.Buf8(r.w_size),c.arraySet(u,t,l-r.w_size,r.w_size,0),t=u,l=r.w_size),a=e.avail_in,o=e.next_in,h=e.input,e.avail_in=l,e.next_in=0,e.input=t,j(r);r.lookahead>=x;){for(n=r.strstart,i=r.lookahead-(x-1);r.ins_h=(r.ins_h<<r.hash_shift^r.window[n+x-1])&r.hash_mask,r.prev[n&r.w_mask]=r.head[r.ins_h],r.head[r.ins_h]=n,n++,--i;);r.strstart=n,r.lookahead=x-1,j(r);}return r.strstart+=r.lookahead,r.block_start=r.strstart,r.insert=r.lookahead,r.lookahead=0,r.match_length=r.prev_length=x-1,r.match_available=0,e.next_in=o,e.input=h,e.avail_in=a,r.wrap=s,m},r.deflateInfo="pako deflate (from Nodeca project)";},{"../utils/common":41,"./adler32":43,"./crc32":45,"./messages":51,"./trees":52}],47:[function(e,t,r){t.exports=function(){this.text=0,this.time=0,this.xflags=0,this.os=0,this.extra=null,this.extra_len=0,this.name="",this.comment="",this.hcrc=0,this.done=false;};},{}],48:[function(e,t,r){t.exports=function(e,t){var r,n,i,s,a,o,h,u,l,f,c,d,p,m,_,g,b,v,y,w,k,x,S,z,C;r=e.state,n=e.next_in,z=e.input,i=n+(e.avail_in-5),s=e.next_out,C=e.output,a=s-(t-e.avail_out),o=s+(e.avail_out-257),h=r.dmax,u=r.wsize,l=r.whave,f=r.wnext,c=r.window,d=r.hold,p=r.bits,m=r.lencode,_=r.distcode,g=(1<<r.lenbits)-1,b=(1<<r.distbits)-1;e:do{p<15&&(d+=z[n++]<<p,p+=8,d+=z[n++]<<p,p+=8),v=m[d&g];t:for(;;){if(d>>>=y=v>>>24,p-=y,0===(y=v>>>16&255))C[s++]=65535&v;else {if(!(16&y)){if(0==(64&y)){v=m[(65535&v)+(d&(1<<y)-1)];continue t}if(32&y){r.mode=12;break e}e.msg="invalid literal/length code",r.mode=30;break e}w=65535&v,(y&=15)&&(p<y&&(d+=z[n++]<<p,p+=8),w+=d&(1<<y)-1,d>>>=y,p-=y),p<15&&(d+=z[n++]<<p,p+=8,d+=z[n++]<<p,p+=8),v=_[d&b];r:for(;;){if(d>>>=y=v>>>24,p-=y,!(16&(y=v>>>16&255))){if(0==(64&y)){v=_[(65535&v)+(d&(1<<y)-1)];continue r}e.msg="invalid distance code",r.mode=30;break e}if(k=65535&v,p<(y&=15)&&(d+=z[n++]<<p,(p+=8)<y&&(d+=z[n++]<<p,p+=8)),h<(k+=d&(1<<y)-1)){e.msg="invalid distance too far back",r.mode=30;break e}if(d>>>=y,p-=y,(y=s-a)<k){if(l<(y=k-y)&&r.sane){e.msg="invalid distance too far back",r.mode=30;break e}if(S=c,(x=0)===f){if(x+=u-y,y<w){for(w-=y;C[s++]=c[x++],--y;);x=s-k,S=C;}}else if(f<y){if(x+=u+f-y,(y-=f)<w){for(w-=y;C[s++]=c[x++],--y;);if(x=0,f<w){for(w-=y=f;C[s++]=c[x++],--y;);x=s-k,S=C;}}}else if(x+=f-y,y<w){for(w-=y;C[s++]=c[x++],--y;);x=s-k,S=C;}for(;2<w;)C[s++]=S[x++],C[s++]=S[x++],C[s++]=S[x++],w-=3;w&&(C[s++]=S[x++],1<w&&(C[s++]=S[x++]));}else {for(x=s-k;C[s++]=C[x++],C[s++]=C[x++],C[s++]=C[x++],2<(w-=3););w&&(C[s++]=C[x++],1<w&&(C[s++]=C[x++]));}break}}break}}while(n<i&&s<o);n-=w=p>>3,d&=(1<<(p-=w<<3))-1,e.next_in=n,e.next_out=s,e.avail_in=n<i?i-n+5:5-(n-i),e.avail_out=s<o?o-s+257:257-(s-o),r.hold=d,r.bits=p;};},{}],49:[function(e,t,r){var I=e("../utils/common"),O=e("./adler32"),B=e("./crc32"),R=e("./inffast"),T=e("./inftrees"),D=1,F=2,N=0,U=-2,P=1,n=852,i=592;function L(e){return (e>>>24&255)+(e>>>8&65280)+((65280&e)<<8)+((255&e)<<24)}function s(){this.mode=0,this.last=false,this.wrap=0,this.havedict=false,this.flags=0,this.dmax=0,this.check=0,this.total=0,this.head=null,this.wbits=0,this.wsize=0,this.whave=0,this.wnext=0,this.window=null,this.hold=0,this.bits=0,this.length=0,this.offset=0,this.extra=0,this.lencode=null,this.distcode=null,this.lenbits=0,this.distbits=0,this.ncode=0,this.nlen=0,this.ndist=0,this.have=0,this.next=null,this.lens=new I.Buf16(320),this.work=new I.Buf16(288),this.lendyn=null,this.distdyn=null,this.sane=0,this.back=0,this.was=0;}function a(e){var t;return e&&e.state?(t=e.state,e.total_in=e.total_out=t.total=0,e.msg="",t.wrap&&(e.adler=1&t.wrap),t.mode=P,t.last=0,t.havedict=0,t.dmax=32768,t.head=null,t.hold=0,t.bits=0,t.lencode=t.lendyn=new I.Buf32(n),t.distcode=t.distdyn=new I.Buf32(i),t.sane=1,t.back=-1,N):U}function o(e){var t;return e&&e.state?((t=e.state).wsize=0,t.whave=0,t.wnext=0,a(e)):U}function h(e,t){var r,n;return e&&e.state?(n=e.state,t<0?(r=0,t=-t):(r=1+(t>>4),t<48&&(t&=15)),t&&(t<8||15<t)?U:(null!==n.window&&n.wbits!==t&&(n.window=null),n.wrap=r,n.wbits=t,o(e))):U}function u(e,t){var r,n;return e?(n=new s,(e.state=n).window=null,(r=h(e,t))!==N&&(e.state=null),r):U}var l,f,c=true;function j(e){if(c){var t;for(l=new I.Buf32(512),f=new I.Buf32(32),t=0;t<144;)e.lens[t++]=8;for(;t<256;)e.lens[t++]=9;for(;t<280;)e.lens[t++]=7;for(;t<288;)e.lens[t++]=8;for(T(D,e.lens,0,288,l,0,e.work,{bits:9}),t=0;t<32;)e.lens[t++]=5;T(F,e.lens,0,32,f,0,e.work,{bits:5}),c=false;}e.lencode=l,e.lenbits=9,e.distcode=f,e.distbits=5;}function Z(e,t,r,n){var i,s=e.state;return null===s.window&&(s.wsize=1<<s.wbits,s.wnext=0,s.whave=0,s.window=new I.Buf8(s.wsize)),n>=s.wsize?(I.arraySet(s.window,t,r-s.wsize,s.wsize,0),s.wnext=0,s.whave=s.wsize):(n<(i=s.wsize-s.wnext)&&(i=n),I.arraySet(s.window,t,r-n,i,s.wnext),(n-=i)?(I.arraySet(s.window,t,r-n,n,0),s.wnext=n,s.whave=s.wsize):(s.wnext+=i,s.wnext===s.wsize&&(s.wnext=0),s.whave<s.wsize&&(s.whave+=i))),0}r.inflateReset=o,r.inflateReset2=h,r.inflateResetKeep=a,r.inflateInit=function(e){return u(e,15)},r.inflateInit2=u,r.inflate=function(e,t){var r,n,i,s,a,o,h,u,l,f,c,d,p,m,_,g,b,v,y,w,k,x,S,z,C=0,E=new I.Buf8(4),A=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];if(!e||!e.state||!e.output||!e.input&&0!==e.avail_in)return U;12===(r=e.state).mode&&(r.mode=13),a=e.next_out,i=e.output,h=e.avail_out,s=e.next_in,n=e.input,o=e.avail_in,u=r.hold,l=r.bits,f=o,c=h,x=N;e:for(;;)switch(r.mode){case P:if(0===r.wrap){r.mode=13;break}for(;l<16;){if(0===o)break e;o--,u+=n[s++]<<l,l+=8;}if(2&r.wrap&&35615===u){E[r.check=0]=255&u,E[1]=u>>>8&255,r.check=B(r.check,E,2,0),l=u=0,r.mode=2;break}if(r.flags=0,r.head&&(r.head.done=false),!(1&r.wrap)||(((255&u)<<8)+(u>>8))%31){e.msg="incorrect header check",r.mode=30;break}if(8!=(15&u)){e.msg="unknown compression method",r.mode=30;break}if(l-=4,k=8+(15&(u>>>=4)),0===r.wbits)r.wbits=k;else if(k>r.wbits){e.msg="invalid window size",r.mode=30;break}r.dmax=1<<k,e.adler=r.check=1,r.mode=512&u?10:12,l=u=0;break;case 2:for(;l<16;){if(0===o)break e;o--,u+=n[s++]<<l,l+=8;}if(r.flags=u,8!=(255&r.flags)){e.msg="unknown compression method",r.mode=30;break}if(57344&r.flags){e.msg="unknown header flags set",r.mode=30;break}r.head&&(r.head.text=u>>8&1),512&r.flags&&(E[0]=255&u,E[1]=u>>>8&255,r.check=B(r.check,E,2,0)),l=u=0,r.mode=3;case 3:for(;l<32;){if(0===o)break e;o--,u+=n[s++]<<l,l+=8;}r.head&&(r.head.time=u),512&r.flags&&(E[0]=255&u,E[1]=u>>>8&255,E[2]=u>>>16&255,E[3]=u>>>24&255,r.check=B(r.check,E,4,0)),l=u=0,r.mode=4;case 4:for(;l<16;){if(0===o)break e;o--,u+=n[s++]<<l,l+=8;}r.head&&(r.head.xflags=255&u,r.head.os=u>>8),512&r.flags&&(E[0]=255&u,E[1]=u>>>8&255,r.check=B(r.check,E,2,0)),l=u=0,r.mode=5;case 5:if(1024&r.flags){for(;l<16;){if(0===o)break e;o--,u+=n[s++]<<l,l+=8;}r.length=u,r.head&&(r.head.extra_len=u),512&r.flags&&(E[0]=255&u,E[1]=u>>>8&255,r.check=B(r.check,E,2,0)),l=u=0;}else r.head&&(r.head.extra=null);r.mode=6;case 6:if(1024&r.flags&&(o<(d=r.length)&&(d=o),d&&(r.head&&(k=r.head.extra_len-r.length,r.head.extra||(r.head.extra=new Array(r.head.extra_len)),I.arraySet(r.head.extra,n,s,d,k)),512&r.flags&&(r.check=B(r.check,n,d,s)),o-=d,s+=d,r.length-=d),r.length))break e;r.length=0,r.mode=7;case 7:if(2048&r.flags){if(0===o)break e;for(d=0;k=n[s+d++],r.head&&k&&r.length<65536&&(r.head.name+=String.fromCharCode(k)),k&&d<o;);if(512&r.flags&&(r.check=B(r.check,n,d,s)),o-=d,s+=d,k)break e}else r.head&&(r.head.name=null);r.length=0,r.mode=8;case 8:if(4096&r.flags){if(0===o)break e;for(d=0;k=n[s+d++],r.head&&k&&r.length<65536&&(r.head.comment+=String.fromCharCode(k)),k&&d<o;);if(512&r.flags&&(r.check=B(r.check,n,d,s)),o-=d,s+=d,k)break e}else r.head&&(r.head.comment=null);r.mode=9;case 9:if(512&r.flags){for(;l<16;){if(0===o)break e;o--,u+=n[s++]<<l,l+=8;}if(u!==(65535&r.check)){e.msg="header crc mismatch",r.mode=30;break}l=u=0;}r.head&&(r.head.hcrc=r.flags>>9&1,r.head.done=true),e.adler=r.check=0,r.mode=12;break;case 10:for(;l<32;){if(0===o)break e;o--,u+=n[s++]<<l,l+=8;}e.adler=r.check=L(u),l=u=0,r.mode=11;case 11:if(0===r.havedict)return e.next_out=a,e.avail_out=h,e.next_in=s,e.avail_in=o,r.hold=u,r.bits=l,2;e.adler=r.check=1,r.mode=12;case 12:if(5===t||6===t)break e;case 13:if(r.last){u>>>=7&l,l-=7&l,r.mode=27;break}for(;l<3;){if(0===o)break e;o--,u+=n[s++]<<l,l+=8;}switch(r.last=1&u,l-=1,3&(u>>>=1)){case 0:r.mode=14;break;case 1:if(j(r),r.mode=20,6!==t)break;u>>>=2,l-=2;break e;case 2:r.mode=17;break;case 3:e.msg="invalid block type",r.mode=30;}u>>>=2,l-=2;break;case 14:for(u>>>=7&l,l-=7&l;l<32;){if(0===o)break e;o--,u+=n[s++]<<l,l+=8;}if((65535&u)!=(u>>>16^65535)){e.msg="invalid stored block lengths",r.mode=30;break}if(r.length=65535&u,l=u=0,r.mode=15,6===t)break e;case 15:r.mode=16;case 16:if(d=r.length){if(o<d&&(d=o),h<d&&(d=h),0===d)break e;I.arraySet(i,n,s,d,a),o-=d,s+=d,h-=d,a+=d,r.length-=d;break}r.mode=12;break;case 17:for(;l<14;){if(0===o)break e;o--,u+=n[s++]<<l,l+=8;}if(r.nlen=257+(31&u),u>>>=5,l-=5,r.ndist=1+(31&u),u>>>=5,l-=5,r.ncode=4+(15&u),u>>>=4,l-=4,286<r.nlen||30<r.ndist){e.msg="too many length or distance symbols",r.mode=30;break}r.have=0,r.mode=18;case 18:for(;r.have<r.ncode;){for(;l<3;){if(0===o)break e;o--,u+=n[s++]<<l,l+=8;}r.lens[A[r.have++]]=7&u,u>>>=3,l-=3;}for(;r.have<19;)r.lens[A[r.have++]]=0;if(r.lencode=r.lendyn,r.lenbits=7,S={bits:r.lenbits},x=T(0,r.lens,0,19,r.lencode,0,r.work,S),r.lenbits=S.bits,x){e.msg="invalid code lengths set",r.mode=30;break}r.have=0,r.mode=19;case 19:for(;r.have<r.nlen+r.ndist;){for(;g=(C=r.lencode[u&(1<<r.lenbits)-1])>>>16&255,b=65535&C,!((_=C>>>24)<=l);){if(0===o)break e;o--,u+=n[s++]<<l,l+=8;}if(b<16)u>>>=_,l-=_,r.lens[r.have++]=b;else {if(16===b){for(z=_+2;l<z;){if(0===o)break e;o--,u+=n[s++]<<l,l+=8;}if(u>>>=_,l-=_,0===r.have){e.msg="invalid bit length repeat",r.mode=30;break}k=r.lens[r.have-1],d=3+(3&u),u>>>=2,l-=2;}else if(17===b){for(z=_+3;l<z;){if(0===o)break e;o--,u+=n[s++]<<l,l+=8;}l-=_,k=0,d=3+(7&(u>>>=_)),u>>>=3,l-=3;}else {for(z=_+7;l<z;){if(0===o)break e;o--,u+=n[s++]<<l,l+=8;}l-=_,k=0,d=11+(127&(u>>>=_)),u>>>=7,l-=7;}if(r.have+d>r.nlen+r.ndist){e.msg="invalid bit length repeat",r.mode=30;break}for(;d--;)r.lens[r.have++]=k;}}if(30===r.mode)break;if(0===r.lens[256]){e.msg="invalid code -- missing end-of-block",r.mode=30;break}if(r.lenbits=9,S={bits:r.lenbits},x=T(D,r.lens,0,r.nlen,r.lencode,0,r.work,S),r.lenbits=S.bits,x){e.msg="invalid literal/lengths set",r.mode=30;break}if(r.distbits=6,r.distcode=r.distdyn,S={bits:r.distbits},x=T(F,r.lens,r.nlen,r.ndist,r.distcode,0,r.work,S),r.distbits=S.bits,x){e.msg="invalid distances set",r.mode=30;break}if(r.mode=20,6===t)break e;case 20:r.mode=21;case 21:if(6<=o&&258<=h){e.next_out=a,e.avail_out=h,e.next_in=s,e.avail_in=o,r.hold=u,r.bits=l,R(e,c),a=e.next_out,i=e.output,h=e.avail_out,s=e.next_in,n=e.input,o=e.avail_in,u=r.hold,l=r.bits,12===r.mode&&(r.back=-1);break}for(r.back=0;g=(C=r.lencode[u&(1<<r.lenbits)-1])>>>16&255,b=65535&C,!((_=C>>>24)<=l);){if(0===o)break e;o--,u+=n[s++]<<l,l+=8;}if(g&&0==(240&g)){for(v=_,y=g,w=b;g=(C=r.lencode[w+((u&(1<<v+y)-1)>>v)])>>>16&255,b=65535&C,!(v+(_=C>>>24)<=l);){if(0===o)break e;o--,u+=n[s++]<<l,l+=8;}u>>>=v,l-=v,r.back+=v;}if(u>>>=_,l-=_,r.back+=_,r.length=b,0===g){r.mode=26;break}if(32&g){r.back=-1,r.mode=12;break}if(64&g){e.msg="invalid literal/length code",r.mode=30;break}r.extra=15&g,r.mode=22;case 22:if(r.extra){for(z=r.extra;l<z;){if(0===o)break e;o--,u+=n[s++]<<l,l+=8;}r.length+=u&(1<<r.extra)-1,u>>>=r.extra,l-=r.extra,r.back+=r.extra;}r.was=r.length,r.mode=23;case 23:for(;g=(C=r.distcode[u&(1<<r.distbits)-1])>>>16&255,b=65535&C,!((_=C>>>24)<=l);){if(0===o)break e;o--,u+=n[s++]<<l,l+=8;}if(0==(240&g)){for(v=_,y=g,w=b;g=(C=r.distcode[w+((u&(1<<v+y)-1)>>v)])>>>16&255,b=65535&C,!(v+(_=C>>>24)<=l);){if(0===o)break e;o--,u+=n[s++]<<l,l+=8;}u>>>=v,l-=v,r.back+=v;}if(u>>>=_,l-=_,r.back+=_,64&g){e.msg="invalid distance code",r.mode=30;break}r.offset=b,r.extra=15&g,r.mode=24;case 24:if(r.extra){for(z=r.extra;l<z;){if(0===o)break e;o--,u+=n[s++]<<l,l+=8;}r.offset+=u&(1<<r.extra)-1,u>>>=r.extra,l-=r.extra,r.back+=r.extra;}if(r.offset>r.dmax){e.msg="invalid distance too far back",r.mode=30;break}r.mode=25;case 25:if(0===h)break e;if(d=c-h,r.offset>d){if((d=r.offset-d)>r.whave&&r.sane){e.msg="invalid distance too far back",r.mode=30;break}p=d>r.wnext?(d-=r.wnext,r.wsize-d):r.wnext-d,d>r.length&&(d=r.length),m=r.window;}else m=i,p=a-r.offset,d=r.length;for(h<d&&(d=h),h-=d,r.length-=d;i[a++]=m[p++],--d;);0===r.length&&(r.mode=21);break;case 26:if(0===h)break e;i[a++]=r.length,h--,r.mode=21;break;case 27:if(r.wrap){for(;l<32;){if(0===o)break e;o--,u|=n[s++]<<l,l+=8;}if(c-=h,e.total_out+=c,r.total+=c,c&&(e.adler=r.check=r.flags?B(r.check,i,c,a-c):O(r.check,i,c,a-c)),c=h,(r.flags?u:L(u))!==r.check){e.msg="incorrect data check",r.mode=30;break}l=u=0;}r.mode=28;case 28:if(r.wrap&&r.flags){for(;l<32;){if(0===o)break e;o--,u+=n[s++]<<l,l+=8;}if(u!==(4294967295&r.total)){e.msg="incorrect length check",r.mode=30;break}l=u=0;}r.mode=29;case 29:x=1;break e;case 30:x=-3;break e;case 31:return  -4;case 32:default:return U}return e.next_out=a,e.avail_out=h,e.next_in=s,e.avail_in=o,r.hold=u,r.bits=l,(r.wsize||c!==e.avail_out&&r.mode<30&&(r.mode<27||4!==t))&&Z(e,e.output,e.next_out,c-e.avail_out)?(r.mode=31,-4):(f-=e.avail_in,c-=e.avail_out,e.total_in+=f,e.total_out+=c,r.total+=c,r.wrap&&c&&(e.adler=r.check=r.flags?B(r.check,i,c,e.next_out-c):O(r.check,i,c,e.next_out-c)),e.data_type=r.bits+(r.last?64:0)+(12===r.mode?128:0)+(20===r.mode||15===r.mode?256:0),(0==f&&0===c||4===t)&&x===N&&(x=-5),x)},r.inflateEnd=function(e){if(!e||!e.state)return U;var t=e.state;return t.window&&(t.window=null),e.state=null,N},r.inflateGetHeader=function(e,t){var r;return e&&e.state?0==(2&(r=e.state).wrap)?U:((r.head=t).done=false,N):U},r.inflateSetDictionary=function(e,t){var r,n=t.length;return e&&e.state?0!==(r=e.state).wrap&&11!==r.mode?U:11===r.mode&&O(1,t,n,0)!==r.check?-3:Z(e,t,n,n)?(r.mode=31,-4):(r.havedict=1,N):U},r.inflateInfo="pako inflate (from Nodeca project)";},{"../utils/common":41,"./adler32":43,"./crc32":45,"./inffast":48,"./inftrees":50}],50:[function(e,t,r){var D=e("../utils/common"),F=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258,0,0],N=[16,16,16,16,16,16,16,16,17,17,17,17,18,18,18,18,19,19,19,19,20,20,20,20,21,21,21,21,16,72,78],U=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577,0,0],P=[16,16,16,16,17,17,18,18,19,19,20,20,21,21,22,22,23,23,24,24,25,25,26,26,27,27,28,28,29,29,64,64];t.exports=function(e,t,r,n,i,s,a,o){var h,u,l,f,c,d,p,m,_,g=o.bits,b=0,v=0,y=0,w=0,k=0,x=0,S=0,z=0,C=0,E=0,A=null,I=0,O=new D.Buf16(16),B=new D.Buf16(16),R=null,T=0;for(b=0;b<=15;b++)O[b]=0;for(v=0;v<n;v++)O[t[r+v]]++;for(k=g,w=15;1<=w&&0===O[w];w--);if(w<k&&(k=w),0===w)return i[s++]=20971520,i[s++]=20971520,o.bits=1,0;for(y=1;y<w&&0===O[y];y++);for(k<y&&(k=y),b=z=1;b<=15;b++)if(z<<=1,(z-=O[b])<0)return  -1;if(0<z&&(0===e||1!==w))return  -1;for(B[1]=0,b=1;b<15;b++)B[b+1]=B[b]+O[b];for(v=0;v<n;v++)0!==t[r+v]&&(a[B[t[r+v]]++]=v);if(d=0===e?(A=R=a,19):1===e?(A=F,I-=257,R=N,T-=257,256):(A=U,R=P,-1),b=y,c=s,S=v=E=0,l=-1,f=(C=1<<(x=k))-1,1===e&&852<C||2===e&&592<C)return 1;for(;;){for(p=b-S,_=a[v]<d?(m=0,a[v]):a[v]>d?(m=R[T+a[v]],A[I+a[v]]):(m=96,0),h=1<<b-S,y=u=1<<x;i[c+(E>>S)+(u-=h)]=p<<24|m<<16|_|0,0!==u;);for(h=1<<b-1;E&h;)h>>=1;if(0!==h?(E&=h-1,E+=h):E=0,v++,0==--O[b]){if(b===w)break;b=t[r+a[v]];}if(k<b&&(E&f)!==l){for(0===S&&(S=k),c+=y,z=1<<(x=b-S);x+S<w&&!((z-=O[x+S])<=0);)x++,z<<=1;if(C+=1<<x,1===e&&852<C||2===e&&592<C)return 1;i[l=E&f]=k<<24|x<<16|c-s|0;}}return 0!==E&&(i[c+E]=b-S<<24|64<<16|0),o.bits=k,0};},{"../utils/common":41}],51:[function(e,t,r){t.exports={2:"need dictionary",1:"stream end",0:"","-1":"file error","-2":"stream error","-3":"data error","-4":"insufficient memory","-5":"buffer error","-6":"incompatible version"};},{}],52:[function(e,t,r){var i=e("../utils/common"),o=0,h=1;function n(e){for(var t=e.length;0<=--t;)e[t]=0;}var s=0,a=29,u=256,l=u+1+a,f=30,c=19,_=2*l+1,g=15,d=16,p=7,m=256,b=16,v=17,y=18,w=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0],k=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13],x=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,3,7],S=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15],z=new Array(2*(l+2));n(z);var C=new Array(2*f);n(C);var E=new Array(512);n(E);var A=new Array(256);n(A);var I=new Array(a);n(I);var O,B,R,T=new Array(f);function D(e,t,r,n,i){this.static_tree=e,this.extra_bits=t,this.extra_base=r,this.elems=n,this.max_length=i,this.has_stree=e&&e.length;}function F(e,t){this.dyn_tree=e,this.max_code=0,this.stat_desc=t;}function N(e){return e<256?E[e]:E[256+(e>>>7)]}function U(e,t){e.pending_buf[e.pending++]=255&t,e.pending_buf[e.pending++]=t>>>8&255;}function P(e,t,r){e.bi_valid>d-r?(e.bi_buf|=t<<e.bi_valid&65535,U(e,e.bi_buf),e.bi_buf=t>>d-e.bi_valid,e.bi_valid+=r-d):(e.bi_buf|=t<<e.bi_valid&65535,e.bi_valid+=r);}function L(e,t,r){P(e,r[2*t],r[2*t+1]);}function j(e,t){for(var r=0;r|=1&e,e>>>=1,r<<=1,0<--t;);return r>>>1}function Z(e,t,r){var n,i,s=new Array(g+1),a=0;for(n=1;n<=g;n++)s[n]=a=a+r[n-1]<<1;for(i=0;i<=t;i++){var o=e[2*i+1];0!==o&&(e[2*i]=j(s[o]++,o));}}function W(e){var t;for(t=0;t<l;t++)e.dyn_ltree[2*t]=0;for(t=0;t<f;t++)e.dyn_dtree[2*t]=0;for(t=0;t<c;t++)e.bl_tree[2*t]=0;e.dyn_ltree[2*m]=1,e.opt_len=e.static_len=0,e.last_lit=e.matches=0;}function M(e){8<e.bi_valid?U(e,e.bi_buf):0<e.bi_valid&&(e.pending_buf[e.pending++]=e.bi_buf),e.bi_buf=0,e.bi_valid=0;}function H(e,t,r,n){var i=2*t,s=2*r;return e[i]<e[s]||e[i]===e[s]&&n[t]<=n[r]}function G(e,t,r){for(var n=e.heap[r],i=r<<1;i<=e.heap_len&&(i<e.heap_len&&H(t,e.heap[i+1],e.heap[i],e.depth)&&i++,!H(t,n,e.heap[i],e.depth));)e.heap[r]=e.heap[i],r=i,i<<=1;e.heap[r]=n;}function K(e,t,r){var n,i,s,a,o=0;if(0!==e.last_lit)for(;n=e.pending_buf[e.d_buf+2*o]<<8|e.pending_buf[e.d_buf+2*o+1],i=e.pending_buf[e.l_buf+o],o++,0===n?L(e,i,t):(L(e,(s=A[i])+u+1,t),0!==(a=w[s])&&P(e,i-=I[s],a),L(e,s=N(--n),r),0!==(a=k[s])&&P(e,n-=T[s],a)),o<e.last_lit;);L(e,m,t);}function Y(e,t){var r,n,i,s=t.dyn_tree,a=t.stat_desc.static_tree,o=t.stat_desc.has_stree,h=t.stat_desc.elems,u=-1;for(e.heap_len=0,e.heap_max=_,r=0;r<h;r++)0!==s[2*r]?(e.heap[++e.heap_len]=u=r,e.depth[r]=0):s[2*r+1]=0;for(;e.heap_len<2;)s[2*(i=e.heap[++e.heap_len]=u<2?++u:0)]=1,e.depth[i]=0,e.opt_len--,o&&(e.static_len-=a[2*i+1]);for(t.max_code=u,r=e.heap_len>>1;1<=r;r--)G(e,s,r);for(i=h;r=e.heap[1],e.heap[1]=e.heap[e.heap_len--],G(e,s,1),n=e.heap[1],e.heap[--e.heap_max]=r,e.heap[--e.heap_max]=n,s[2*i]=s[2*r]+s[2*n],e.depth[i]=(e.depth[r]>=e.depth[n]?e.depth[r]:e.depth[n])+1,s[2*r+1]=s[2*n+1]=i,e.heap[1]=i++,G(e,s,1),2<=e.heap_len;);e.heap[--e.heap_max]=e.heap[1],function(e,t){var r,n,i,s,a,o,h=t.dyn_tree,u=t.max_code,l=t.stat_desc.static_tree,f=t.stat_desc.has_stree,c=t.stat_desc.extra_bits,d=t.stat_desc.extra_base,p=t.stat_desc.max_length,m=0;for(s=0;s<=g;s++)e.bl_count[s]=0;for(h[2*e.heap[e.heap_max]+1]=0,r=e.heap_max+1;r<_;r++)p<(s=h[2*h[2*(n=e.heap[r])+1]+1]+1)&&(s=p,m++),h[2*n+1]=s,u<n||(e.bl_count[s]++,a=0,d<=n&&(a=c[n-d]),o=h[2*n],e.opt_len+=o*(s+a),f&&(e.static_len+=o*(l[2*n+1]+a)));if(0!==m){do{for(s=p-1;0===e.bl_count[s];)s--;e.bl_count[s]--,e.bl_count[s+1]+=2,e.bl_count[p]--,m-=2;}while(0<m);for(s=p;0!==s;s--)for(n=e.bl_count[s];0!==n;)u<(i=e.heap[--r])||(h[2*i+1]!==s&&(e.opt_len+=(s-h[2*i+1])*h[2*i],h[2*i+1]=s),n--);}}(e,t),Z(s,u,e.bl_count);}function X(e,t,r){var n,i,s=-1,a=t[1],o=0,h=7,u=4;for(0===a&&(h=138,u=3),t[2*(r+1)+1]=65535,n=0;n<=r;n++)i=a,a=t[2*(n+1)+1],++o<h&&i===a||(o<u?e.bl_tree[2*i]+=o:0!==i?(i!==s&&e.bl_tree[2*i]++,e.bl_tree[2*b]++):o<=10?e.bl_tree[2*v]++:e.bl_tree[2*y]++,s=i,u=(o=0)===a?(h=138,3):i===a?(h=6,3):(h=7,4));}function V(e,t,r){var n,i,s=-1,a=t[1],o=0,h=7,u=4;for(0===a&&(h=138,u=3),n=0;n<=r;n++)if(i=a,a=t[2*(n+1)+1],!(++o<h&&i===a)){if(o<u)for(;L(e,i,e.bl_tree),0!=--o;);else 0!==i?(i!==s&&(L(e,i,e.bl_tree),o--),L(e,b,e.bl_tree),P(e,o-3,2)):o<=10?(L(e,v,e.bl_tree),P(e,o-3,3)):(L(e,y,e.bl_tree),P(e,o-11,7));s=i,u=(o=0)===a?(h=138,3):i===a?(h=6,3):(h=7,4);}}n(T);var q=false;function J(e,t,r,n){P(e,(s<<1)+(n?1:0),3),function(e,t,r,n){M(e),(U(e,r),U(e,~r)),i.arraySet(e.pending_buf,e.window,t,r,e.pending),e.pending+=r;}(e,t,r);}r._tr_init=function(e){q||(function(){var e,t,r,n,i,s=new Array(g+1);for(n=r=0;n<a-1;n++)for(I[n]=r,e=0;e<1<<w[n];e++)A[r++]=n;for(A[r-1]=n,n=i=0;n<16;n++)for(T[n]=i,e=0;e<1<<k[n];e++)E[i++]=n;for(i>>=7;n<f;n++)for(T[n]=i<<7,e=0;e<1<<k[n]-7;e++)E[256+i++]=n;for(t=0;t<=g;t++)s[t]=0;for(e=0;e<=143;)z[2*e+1]=8,e++,s[8]++;for(;e<=255;)z[2*e+1]=9,e++,s[9]++;for(;e<=279;)z[2*e+1]=7,e++,s[7]++;for(;e<=287;)z[2*e+1]=8,e++,s[8]++;for(Z(z,l+1,s),e=0;e<f;e++)C[2*e+1]=5,C[2*e]=j(e,5);O=new D(z,w,u+1,l,g),B=new D(C,k,0,f,g),R=new D(new Array(0),x,0,c,p);}(),q=true),e.l_desc=new F(e.dyn_ltree,O),e.d_desc=new F(e.dyn_dtree,B),e.bl_desc=new F(e.bl_tree,R),e.bi_buf=0,e.bi_valid=0,W(e);},r._tr_stored_block=J,r._tr_flush_block=function(e,t,r,n){var i,s,a=0;0<e.level?(2===e.strm.data_type&&(e.strm.data_type=function(e){var t,r=4093624447;for(t=0;t<=31;t++,r>>>=1)if(1&r&&0!==e.dyn_ltree[2*t])return o;if(0!==e.dyn_ltree[18]||0!==e.dyn_ltree[20]||0!==e.dyn_ltree[26])return h;for(t=32;t<u;t++)if(0!==e.dyn_ltree[2*t])return h;return o}(e)),Y(e,e.l_desc),Y(e,e.d_desc),a=function(e){var t;for(X(e,e.dyn_ltree,e.l_desc.max_code),X(e,e.dyn_dtree,e.d_desc.max_code),Y(e,e.bl_desc),t=c-1;3<=t&&0===e.bl_tree[2*S[t]+1];t--);return e.opt_len+=3*(t+1)+5+5+4,t}(e),i=e.opt_len+3+7>>>3,(s=e.static_len+3+7>>>3)<=i&&(i=s)):i=s=r+5,r+4<=i&&-1!==t?J(e,t,r,n):4===e.strategy||s===i?(P(e,2+(n?1:0),3),K(e,z,C)):(P(e,4+(n?1:0),3),function(e,t,r,n){var i;for(P(e,t-257,5),P(e,r-1,5),P(e,n-4,4),i=0;i<n;i++)P(e,e.bl_tree[2*S[i]+1],3);V(e,e.dyn_ltree,t-1),V(e,e.dyn_dtree,r-1);}(e,e.l_desc.max_code+1,e.d_desc.max_code+1,a+1),K(e,e.dyn_ltree,e.dyn_dtree)),W(e),n&&M(e);},r._tr_tally=function(e,t,r){return e.pending_buf[e.d_buf+2*e.last_lit]=t>>>8&255,e.pending_buf[e.d_buf+2*e.last_lit+1]=255&t,e.pending_buf[e.l_buf+e.last_lit]=255&r,e.last_lit++,0===t?e.dyn_ltree[2*r]++:(e.matches++,t--,e.dyn_ltree[2*(A[r]+u+1)]++,e.dyn_dtree[2*N(t)]++),e.last_lit===e.lit_bufsize-1},r._tr_align=function(e){P(e,2,3),L(e,m,z),function(e){16===e.bi_valid?(U(e,e.bi_buf),e.bi_buf=0,e.bi_valid=0):8<=e.bi_valid&&(e.pending_buf[e.pending++]=255&e.bi_buf,e.bi_buf>>=8,e.bi_valid-=8);}(e);};},{"../utils/common":41}],53:[function(e,t,r){t.exports=function(){this.input=null,this.next_in=0,this.avail_in=0,this.total_in=0,this.output=null,this.next_out=0,this.avail_out=0,this.total_out=0,this.msg="",this.state=null,this.data_type=2,this.adler=0;};},{}],54:[function(e,t,r){(function(e){!function(r,n){if(!r.setImmediate){var i,s,t,a,o=1,h={},u=false,l=r.document,e=Object.getPrototypeOf&&Object.getPrototypeOf(r);e=e&&e.setTimeout?e:r,i="[object process]"==={}.toString.call(r.process)?function(e){process.nextTick(function(){c(e);});}:function(){if(r.postMessage&&!r.importScripts){var e=true,t=r.onmessage;return r.onmessage=function(){e=false;},r.postMessage("","*"),r.onmessage=t,e}}()?(a="setImmediate$"+Math.random()+"$",r.addEventListener?r.addEventListener("message",d,false):r.attachEvent("onmessage",d),function(e){r.postMessage(a+e,"*");}):r.MessageChannel?((t=new MessageChannel).port1.onmessage=function(e){c(e.data);},function(e){t.port2.postMessage(e);}):l&&"onreadystatechange"in l.createElement("script")?(s=l.documentElement,function(e){var t=l.createElement("script");t.onreadystatechange=function(){c(e),t.onreadystatechange=null,s.removeChild(t),t=null;},s.appendChild(t);}):function(e){setTimeout(c,0,e);},e.setImmediate=function(e){"function"!=typeof e&&(e=new Function(""+e));for(var t=new Array(arguments.length-1),r=0;r<t.length;r++)t[r]=arguments[r+1];var n={callback:e,args:t};return h[o]=n,i(o),o++},e.clearImmediate=f;}function f(e){delete h[e];}function c(e){if(u)setTimeout(c,0,e);else {var t=h[e];if(t){u=true;try{!function(e){var t=e.callback,r=e.args;switch(r.length){case 0:t();break;case 1:t(r[0]);break;case 2:t(r[0],r[1]);break;case 3:t(r[0],r[1],r[2]);break;default:t.apply(n,r);}}(t);}finally{f(e),u=false;}}}}function d(e){e.source===r&&"string"==typeof e.data&&0===e.data.indexOf(a)&&c(+e.data.slice(a.length));}}("undefined"==typeof self?void 0===e?this:e:self);}).call(this,"undefined"!=typeof commonjsGlobal?commonjsGlobal:"undefined"!=typeof self?self:"undefined"!=typeof window?window:{});},{}]},{},[10])(10)}); 
	} (jszip_min));
	return jszip_min.exports;
}

var jszip_minExports = requireJszip_min();
var JSZip = /*@__PURE__*/getDefaultExportFromCjs(jszip_minExports);

/**
 * Fetches 23andMe participant data from Personal Genome Project (PGP) and Openhumans with a cache-first strategy and multi-proxy fallback to bypass CORS restrictions.
 * 
 * Features:
 * - Cache-first loading: Checks local cache before making network requests, and caches successful responses for future use.
 * - Multi-proxy fallback: Tries multiple proxy endpoints (Cloudflare Worker, local proxy, AllOrigins, CORSProxy) to fetch data, increasing chances of success despite CORS issues.
 * - HTML parsing: Parses HTML responses from PGP to extract structured participant data, including IDs, profile URLs, published dates, data types, sources, names, and download links.
 * - Source tracking: Keeps track of where data was loaded from (cache or which proxy) for debugging and transparency.
 */


// Helper to check for supported genome version labels (v3, v4, v5)
function hasSupportedGenomeVersionLabel(value = "") {
  return /(^|[^a-z0-9])v(?:3|4|5)(?=[^a-z0-9]|$)/i.test(String(value));
}

//PGP search results page (HTML) for 23andMe datasets—not an API endpoint
const dataType = "23andMe";
const PGP_BASE_URL = "https://my.pgp-hms.org";
const PGP_23ANDME_URL = `${PGP_BASE_URL}/public_genetic_data?utf8=%E2%9C%93&data_type=${dataType}&commit=Search`;

const WORKER_BASE = "https://lorena-api.lorenasandoval88.workers.dev/?url=";
const PARTICIPANT_CACHE_PREFIX = `Genome:${dataType}-participant-`; // per-participant cache (full metadata + resolved filename)
const PROFILE_CACHE_PREFIX = `Genome:${dataType}-profile-`;
const ALL_PARTICIPANT_CACHE_PREFIX = `Genome:${dataType}-allParticipants-`; // per-participant cache (full metadata + resolved filename)
const ALL_PARTICIPANT_CACHE_FAST_KEY = `${ALL_PARTICIPANT_CACHE_PREFIX}fast`;
const ALL_PARTICIPANT_CACHE_STANDARD_KEY = `${ALL_PARTICIPANT_CACHE_PREFIX}standard`;



let lastAllUsersSource = null;
const lastProfileSourceById = new Map();


// begin data types
async function fetchAvailableDataTypes({
  base_url = `${PGP_BASE_URL}/public_genetic_data`,
      url = `${WORKER_BASE}${encodeURIComponent(base_url)}`,

  fetchImpl = fetch
} = {}) {
  const res = await fetchImpl(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch PGP data types: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");

  // 1) Best case: actual <select name="data_type"> options
  const selectOptions = [
    ...doc.querySelectorAll('select[name="data_type"] option')
  ]
    .map(opt => ({
      value: (opt.getAttribute("value") || "").trim(),
      label: (opt.textContent || "").trim()
    }))
    .filter(d => d.label && d.value);

  if (selectOptions.length) {
    return dedupeByValue(selectOptions);
  }

  // 2) Fallback: links containing ?data_type=...
  const linkOptions = [
    ...doc.querySelectorAll('a[href*="data_type="]')
  ]
    .map(a => {
      try {
        const href = a.getAttribute("href");
        const full = new URL(href, url);
        const value = (full.searchParams.get("data_type") || "").trim();
        const label = (a.textContent || "").trim();
        return { value, label: label || value };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter(d => d.value);

  if (linkOptions.length) {
    return dedupeByValue(linkOptions);
  }

  // 3) Last resort: parse visible text labels
  const text = doc.body?.textContent || "";
  const start = text.indexOf("All data types");
  const end = text.indexOf("Participant Published Data type Source Name Download Report");

  if (start !== -1 && end !== -1 && end > start) {
    const block = text
      .slice(start + "All data types".length, end)
      .replace(/\s+/g, " ")
      .trim();

    const labels = splitDatatypeBlock(block);

    return labels.map(label => ({
      label,
      value: normalizeDataTypeValue(label)
    }));
  }

  return [];
}

function dedupeByValue(items) {
  const seen = new Map();

  for (const item of items) {
    const key = item.value;
    if (!seen.has(key)) {
      seen.set(key, item);
    }
  }

  return [...seen.values()];
}

function splitDatatypeBlock(block) {
  const knownPrefixes = [
    "biometric data - ",
    "genetic data - ",
    "health records - ",
    "image - ",
    "microbiome data",
    "other"
  ];

  const labels = [];
  let i = 0;

  while (i < block.length) {
    let nextPrefix = null;
    let nextIndex = Infinity;

    for (const prefix of knownPrefixes) {
      const idx = block.indexOf(prefix, i);
      if (idx !== -1 && idx < nextIndex) {
        nextIndex = idx;
        nextPrefix = prefix;
      }
    }

    if (nextPrefix == null) break;

    let followingIndex = Infinity;
    for (const prefix of knownPrefixes) {
      const idx = block.indexOf(prefix, nextIndex + nextPrefix.length);
      if (idx !== -1 && idx < followingIndex) {
        followingIndex = idx;
      }
    }

    const label = block
      .slice(nextIndex, followingIndex === Infinity ? block.length : followingIndex)
      .trim();

    if (label) labels.push(label);
    i = nextIndex + label.length;
  }

  return [...new Set(labels)];
}

function normalizeDataTypeValue(label) {
  // Converts visible labels into likely query values.
  // You can expand this map if PGP uses different internal values.
  const explicitMap = {
    "genetic data - 23andMe": "23andMe",
    "genetic data - Complete Genomics": "Complete Genomics",
    "genetic data - Counsyl": "Counsyl",
    "genetic data - DeCode": "DeCode",
    "genetic data - Family Tree DNA": "Family Tree DNA",
    "genetic data - Gencove low-pass": "Gencove low-pass",
    "genetic data - Illumina": "Illumina",
    "genetic data - Knome": "Knome",
    "genetic data - Navigenics": "Navigenics",
    "genetic data - Pathway Genomics": "Pathway Genomics",
    "genetic data - Veritas Genetics": "Veritas Genetics",
    "biometric data - CSV or similar": "CSV or similar",
    "health records - CCR XML": "CCR XML",
    "health records - PDF or text": "PDF or text",
    "image - PNG or JPEG or similar": "PNG or JPEG or similar",
    "microbiome data": "microbiome data",
    "other": "other"
  };

  if (explicitMap[label]) return explicitMap[label];

  // Generic fallback: remove category prefix
  return label
    .replace(/^genetic data - /i, "")
    .replace(/^biometric data - /i, "")
    .replace(/^health records - /i, "")
    .replace(/^image - /i, "")
    .trim();
}
//   end data types


function getStorage() {
    return localforage;
}

function isCacheWithinMonths(savedAt, months = 3) {
    if (!savedAt) return false;
    const savedDate = new Date(savedAt);
    if (Number.isNaN(savedDate.getTime())) return false;

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    return savedDate >= cutoff;
}

// Per-participant cache helpers
async function getCachedParticipant(id) {
    if (!id) return null;
    const storage = getStorage();
    if (!storage) return null;
    try {
        const cached = await storage.getItem(PARTICIPANT_CACHE_PREFIX + id);
        return cached || null;
    } catch (error) {
        return null;
    }
}

async function setCachedParticipant(id, participant) {
    if (!id) return;
    const storage = getStorage();
    if (!storage) return;
    try {
        await storage.setItem(PARTICIPANT_CACHE_PREFIX + id, {
            ...participant,
            cachedAt: Date.now()
        });
    } catch (error) {
        console.warn(`Failed to cache participant ${id}:`, error);
    }
}

// Bulk cache helpers for fast version (all participants under one key)
async function getCachedAllParticipants_fast(key = ALL_PARTICIPANT_CACHE_FAST_KEY) {
    const storage = getStorage();
    if (!storage) return null;
    try {
        const cached = await storage.getItem(key);
        if (!cached || !Array.isArray(cached.participants)) return null;
        // console.log(`getCachedAllParticipants: found ${cached.participants.length} cached participants`);
        return cached.participants;
    } catch (error) {
        console.warn("Failed to read bulk participants cache:", error);
        return null;
    }
}

async function setCachedAllParticipants(participants, key = ALL_PARTICIPANT_CACHE_FAST_KEY) {
    const storage = getStorage();
    if (!storage) return;
    try {
        await storage.setItem(key, {
            participants,
            cachedAt: Date.now()
        });
        // console.log(`setCachedAllParticipants: saved ${participants.length} participants`);
    } catch (error) {
        console.warn("Failed to save bulk participants cache:", error);
    }
}

// Bulk cache helpers for standard version (all participants under one key)
async function getCachedAllParticipantsStandard(limit) {
    const storage = getStorage();
    if (!storage) return null;
    try {
        const cached = await storage.getItem(ALL_PARTICIPANT_CACHE_STANDARD_KEY);
        if (!cached || !Array.isArray(cached.participants)) return null;
        // console.log(`getCachedAllParticipantsStandard: found ${cached.participants.length} cached participants`);
        return cached.participants.slice(0, limit);
    } catch (error) {
        console.warn("Failed to read standard bulk participants cache:", error);
        return null;
    }
}

async function setCachedAllParticipantsStandard(participants) {
    const storage = getStorage();
    if (!storage) return;
    try {
        await storage.setItem(ALL_PARTICIPANT_CACHE_STANDARD_KEY, {
            participants,
            cachedAt: Date.now()
        });
        // console.log(`setCachedAllParticipantsStandard: saved ${participants.length} participants`);
    } catch (error) {
        console.warn("Failed to save standard bulk participants cache:", error);
    }
}

/**
 * Parse HTML to extract participant data with per-participant caching
 * @param {string} html - HTML content from PGP
 * @param {number} limit - Number of participants to return
 * @param {string} source - Source identifier
 * @param {Object} options - Options for callbacks
 * @param {number} options.batchSize - Log progress every N participants (default: 10)
 * @param {Function} options.onBatchComplete - Callback when a batch is processed
 * @returns {Promise<Array>} Array of participant objects
 */
async function parseParticipants(html, limit, source = "unknown", options = {}) {
    const { batchSize = 10, onBatchComplete = null } = options;
    
    //console.log("parseParticipants(html): Parsing participants from HTML source:", source);
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    let rows = [...doc.querySelectorAll("tr[data-file-row]")];
    if (rows.length === 0) {
        rows = [...doc.querySelectorAll("table tr")];
    }

    // console.log(`parseParticipants(html): Parsing participants from HTML source: ${source}. Found ${rows.length} participant rows, first 5 rows:`, rows.slice(0, 5));

    const participants = [];

    for (const row of rows) {
        if (participants.length >= limit) break;

        const cells = row.querySelectorAll("td");
        if (cells.length < 7) continue;

        const participantLink = cells[1].querySelector("a");
        const downloadLink = cells[6].querySelector("a");

        if (!participantLink) continue;

        const id = participantLink.textContent.trim();
        const downloadUrl = downloadLink ? `https://my.pgp-hms.org${downloadLink.getAttribute("href")}` : null;
        
        // Check per-participant cache first
        const cachedParticipant = await getCachedParticipant(id);
        
        if (cachedParticipant) {
            participants.push(cachedParticipant);
            // console.log(`parseParticipants(html): [CACHE HIT] id: ${id}, filename: ${cachedParticipant.fileName}`,cachedParticipant);
        } else {
            // Resolve actual filename from download URL
            const resolved = await resolveDownloadFilename(downloadUrl);
            
            const participant = {
                id,
                profileUrl: `https://my.pgp-hms.org${participantLink.getAttribute("href")}`,
                publishedDate: cells[2].textContent.trim(),
                dataType: cells[3].textContent.trim(),
                dataSource: source,
                name: cells[5].textContent.trim(),
                fileName: resolved.fileName,
                fileExtension: resolved.fileExtension,
                finalUrl: resolved.finalUrl,
                downloadUrl
            };
            
            // Cache the participant
            await setCachedParticipant(id, participant);
            participants.push(participant);
            // console.log(`parseParticipants [NETWORK] id: ${id}, filename: ${resolved.fileName}`);
        }
        
        // Progress callback every batchSize participants
        if (participants.length % batchSize === 0) {
            // console.log(`parseParticipants: Progress ${participants.length}/${limit} (cache: ${resolvedFromCache}, network: ${resolvedFromNetwork})`);
            if (onBatchComplete) {
                await onBatchComplete([...participants]);
            }
        }
    }
    
    // console.log(`Parsed ${participants.length} participants (cache: ${resolvedFromCache}, network: ${resolvedFromNetwork}):`);
 
    return participants;
}

/**
 * Parse HTML to extract participant data (fast version - no network calls per participant)
 * @param {string} html - HTML content from PGP
 * @param {number} limit - Number of participants to return
 * @returns {Array} Array of participant objects
 */
function parseParticipants_fast(html, source = "unknown") {
    // console.log("***************Parsing participants (fast) from HTML source:", source);
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    let rows = [...doc.querySelectorAll("tr[data-file-row]")];
    if (rows.length === 0) {
        rows = [...doc.querySelectorAll("table tr")];
    }

    // console.log("Found rows:", rows.length);

    const participants = [];

    for (const row of rows) {

        const cells = row.querySelectorAll("td");
        if (cells.length < 7) continue;

        const participantLink = cells[1].querySelector("a");
        const downloadLink = cells[6].querySelector("a");

        if (!participantLink) continue;

        const fileName = cells[5].textContent.trim();
        const fileExtension = fileName.match(/\.(txt|zip)$/i)?.[1]?.toLowerCase() || null;
        // console.log(`parseParticipants_fast  filename: ${fileName} (download URL: ${downloadLink ? `https://my.pgp-hms.org${downloadLink.getAttribute("href")}` : "no download link"})`);
        const participant = {
            id: participantLink.textContent.trim(),
            profileUrl: `https://my.pgp-hms.org${participantLink.getAttribute("href")}`,
            publishedDate: cells[2].textContent.trim(),
            dataType: cells[3].textContent.trim(),
            dataSource: source,
            name: fileName,
            fileName,
            fileExtension,
            finalUrl: null, // Not resolved in fast version
            downloadUrl: downloadLink ? `https://my.pgp-hms.org${downloadLink.getAttribute("href")}` : null
        };
        participants.push(participant);
    }
    // console.log(`Parsed ${participants.length} participants (fast):`, participants[0]);
    return participants;
}

/**
 * Fetch a list of PGP 23andMe participants (fast version - no filename resolution)
 * Uses bulk cache under ALL_PARTICIPANT_CACHE_PREFIX - all participants stored under one key.
 * Returns cached data if available and sufficient, otherwise fetches fresh HTML.
 * @param {number} limit - Number of participants to return (default: 1100)
 * @returns {Promise<Array>} Array of participant objects
 */
async function allUsersMetaDataByType_fast(dataType = "23andMe") {
/**
 * Fetch a list of PGP 23andMe participants (fast version - no filename resolution)
 * Uses bulk cache under ALL_PARTICIPANT_CACHE_PREFIX - all participants stored under one key.
 * Returns cached data if available and sufficient, otherwise fetches fresh HTML.
 * @param {number} limit - Number of participants to return (default: 1100)
 * @returns {Promise<Array>} Array of participant objects
 */
    const pgpUrl = `${PGP_BASE_URL}/public_genetic_data?utf8=%E2%9C%93&data_type=${encodeURIComponent(dataType)}&commit=Search`;
    const cacheKey = `Genome:${dataType}-allParticipants-fast`;

    // Check bulk cache first
    const cached = await getCachedAllParticipants_fast(cacheKey);
    if (cached && cached.length > 0) {
        lastAllUsersSource = "cache";
        // console.log(`fetch23andMeParticipants_fast(): Found ${cached.length} participants from bulk cache:`, cached);
        return cached;
    }

    const candidates = [
        { name: "cf-worker", url: `${WORKER_BASE}${encodeURIComponent(pgpUrl)}` },
        { name: "local-proxy", url: "http://localhost:3000/pgp-participants" },
        { name: "allorigins", url: `https://api.allorigins.win/raw?url=${encodeURIComponent(pgpUrl)}` },
        { name: "corsproxy", url: `https://corsproxy.io/?${pgpUrl}` }
    ];
    let html = null;
    let usedSource = null;
    const errors = [];

    for (const candidate of candidates) {
        try {
            // console.log(`fetch23andMeParticipants_fast(): Trying to fetch participants from ${candidate.name}...`);
            const response = await fetch(candidate.url);
            if (response.ok) {
                // console.log(`fetch23andMeParticipants_fast(): Successfully fetched from ${candidate.name}`);
                html = await response.text();
                usedSource = candidate.name;
                break;
            }
            errors.push(`${candidate.name}: HTTP ${response.status}`);
        } catch (error) {
            errors.push(`${candidate.name}: ${error.message}`);
        }
    }
    if (!html) {
        throw new Error(`Failed to fetch PGP data: ${errors.join(", ")}`);
    }
    lastAllUsersSource = usedSource;
    
    const participants = parseParticipants_fast(html, lastAllUsersSource);
    
    // Save to bulk cache
    await setCachedAllParticipants(participants, cacheKey);
    
    return participants;
}

/**
 * Fetch a list of PGP 23andMe participants with per-participant caching.
 * Uses cache-first loading from a standard bulk cache and falls back to HTML fetching.
 * Parsed participants are cached in bulk and also cached individually for filename resolution.
 * Each participant is cached individually - "Load more" naturally works.
 * @param {number} limit - Number of participants to return (default: 10)
 * @param {Object} options - Options
 * @param {number} options.batchSize - Log progress every N participants (default: 10)
 * @returns {Promise<Array>} Array of participant objects
 */
async function fetch23andMeParticipants(limit = 10, options = {}) {
    // const types = await fetchAvailableDataTypes();
    // console.log("types-------------------:", types);


    const { batchSize = 10 } = options;

    const cached = await getCachedAllParticipantsStandard(limit);
    if (cached && cached.length >= limit) {
        lastAllUsersSource = "cache";
        // console.log(`fetch23andMeParticipants(): Found ${cached.length} participants from standard bulk cache`);
        return cached;
    }
    
    //console.log("fetch23andMeParticipants-------------------")

    const candidates = [
        { name: "cf-worker", url: `${WORKER_BASE}${encodeURIComponent(PGP_23ANDME_URL)}` },
        { name: "local-proxy", url: "http://localhost:3000/pgp-participants" },
        { name: "allorigins", url: `https://api.allorigins.win/raw?url=${encodeURIComponent(PGP_23ANDME_URL)}` },
        { name: "corsproxy", url: `https://corsproxy.io/?${PGP_23ANDME_URL}` }
    ];
    let html = null;
    let usedSource = null;
    const errors = [];

    for (const candidate of candidates) {
        try {
            // console.log(`fetch23andMeParticipants(): Trying to fetch participants from ${candidate.name}...`);
            const response = await fetch(candidate.url);
            if (response.ok) {
                html = await response.text();
                // console.log(`fetch23andMeParticipants(): Successfully fetched participants from ${candidate.name},`, `response.text()...:`, html.slice(0, 500));

                usedSource = candidate.name;
                break;
            }
            errors.push(`${candidate.name}: HTTP ${response.status}`);
        } catch (error) {
            errors.push(`${candidate.name}: ${error.message}`);
        }
    }

    if (!html) {
        throw new Error(`Failed to fetch PGP data: ${errors.join(", ")}`);
    }

    lastAllUsersSource = usedSource;
    
    // Parse - each participant is cached individually
    const participants = await parseParticipants(html, limit, lastAllUsersSource, { batchSize });
    await setCachedAllParticipantsStandard(participants);
    return participants;
}

// Fetch a PGP profile by ID using cache if available, otherwise try multiple proxy endpoints until successful, then cache and return the result.
// 1. Cache-first strategy 2. Multi-proxy fallback 3. Source tracking
// Example: fetchProfile("hu416394").then(console.log);
async function fetchProfile(id) {
    console.log(`fetchProfile(): Fetching profile for ID: ${id}...`);
    const resolvedId = typeof id === "string" && id.trim() ? id.trim() : "hu09B28E";

    const cachedProfile = await getCachedProfile(resolvedId);
    if (cachedProfile) {
        console.log(`fetchProfile(): Cache hit for ID: ${resolvedId}, profile:`, cachedProfile);
        lastProfileSourceById.set(resolvedId, "cache");
        return cachedProfile;
    }
    console.log(`fetchProfile(): Cache miss for ID: ${resolvedId}, trying network...`);
    const profileUrl = `https://my.pgp-hms.org/profile/${resolvedId}.json`;
    const candidates = [
        { name: "cf-worker", url: `${WORKER_BASE}${encodeURIComponent(profileUrl)}` },
        { name: "local-proxy", url: `http://localhost:3000/pgp-profile/${resolvedId}` },
        { name: "allorigins", url: `https://api.allorigins.win/raw?url=${encodeURIComponent(profileUrl)}` },
        { name: "corsproxy", url: `https://corsproxy.io/?${profileUrl}` }
    ];

    const errors = [];
    for (const candidate of candidates) {
        // console.log(`fetchProfile(): Trying to fetch profile ${resolvedId} from ${candidate.name}...`);

        try {
            const res = await fetch(candidate.url, {
                headers: {
                    "Accept": "application/json"
                }
            });

            if (!res.ok) {
                errors.push(`${candidate.name}: HTTP ${res.status}`);
                continue;
            }
            const data = await res.json();
            console.log(`fetchProfile(): Successfully fetched profile ${resolvedId} from ${candidate.name}`,data);

            lastProfileSourceById.set(resolvedId, candidate.name);
            await setCachedProfile(resolvedId, data);
            //console.log(`fetchProfile(): Saving profile cache in localforage: ${resolvedId}`);

            return data;
        } catch (error) {
            errors.push(`${candidate.name}: ${error.message}`);
        }
    }

    throw new Error(`Failed to fetch profile ${resolvedId}: ${errors.join(", ")}`);
}

// Helper functions for fetchProfile(id) cache management
async function getCachedProfile(id) {
    const storage = getStorage();
    if (!storage) return null;

    try {
        const cached = await storage.getItem(PROFILE_CACHE_PREFIX + id);
        if (!cached) return null;

        const { savedAt, profile } = cached;
        if (isCacheWithinMonths(savedAt)) {
            return profile;
        }
        return null;
    } catch (error) {
        return null;
    }
}

// Helper functions for fetchProfile(id) cache management
async function setCachedProfile(id, profile) {
    const storage = getStorage();
    if (!storage) return;
    await storage.setItem(PROFILE_CACHE_PREFIX + id, {
        savedAt: new Date().toISOString(),
        profile
    });
}
function getLastAllUsersSource() {
    // console.log("getLastAllUsersSource:", lastAllUsersSource);
    return lastAllUsersSource;
}

function getLastProfileSource(id) {
    // console.log("getLastProfileSource:", lastProfileSourceById.get(id));
    return lastProfileSourceById.get(id) || null;
}


/**
 * Resolve the actual filename from a PGP download URL by following redirects.
 * Uses multi-proxy fallback to bypass CORS, similar to loadTxts.js.
 * @param {string} downloadUrl - The download URL (e.g., https://my.pgp-hms.org/user_file/download/4187)
 * @returns {Promise<{finalUrl: string, fileName: string, fileExtension: string|null}>}
 */
async function resolveDownloadFilename(downloadUrl) {
    if (!downloadUrl) {
        return { finalUrl: null, fileName: null, fileExtension: null };
    }

    const candidates = [
        { name: "cf-worker", url: `${WORKER_BASE}${encodeURIComponent(downloadUrl)}` },
        { name: "local-proxy", url: `http://localhost:3000/pgp-resolve?url=${encodeURIComponent(downloadUrl)}` },
        { name: "allorigins", url: `https://api.allorigins.win/raw?url=${encodeURIComponent(downloadUrl)}` },
        { name: "corsproxy", url: `https://corsproxy.io/?${downloadUrl}` }
    ];

    let finalUrl = null;
    let finalResponse = null;
    let successSource = null;
    let lastError = null;

    for (const candidate of candidates) {
        try {
            // console.log(`resolveDownloadFilename(): Trying ${candidate.name}...from url ${candidate.url}`);
            const response = await fetch(candidate.url);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            // Get final URL from header or response.url
            finalUrl =
                response.headers.get("x-final-url") ||
                response.headers.get("X-Final-URL") ||
                response.url;

            finalResponse = response;
            successSource = candidate.name;
            // console.log(`resolveDownloadFilename(): Success with ${candidate.name}. Final URL: ${finalUrl}`);
            break;
        } catch (err) {
            console.warn(`resolveDownloadFilename(): ${candidate.name} failed: ${err.message}`);
            lastError = err;
        }
    }

    if (!finalUrl || !finalResponse) {
        console.warn(`resolveDownloadFilename(): All proxies failed for ${downloadUrl}: ${lastError?.message}`);
        return { finalUrl: null, fileName: null, fileExtension: null };
    }

    // ------------------------------------------------------------
    // Route by final URL type
    // ------------------------------------------------------------

    // 1) Direct TXT
    if (finalUrl.endsWith(".txt")) {
        const fileName = finalUrl.split("/").pop()?.split("?")[0] || null;
        const fileExtension = "txt";
        // console.log(`resolveDownloadFilename(): Direct TXT - filename: ${fileName}`);
        return { finalUrl, fileName, fileExtension };
    }

    // 2) Direct ZIP - extract inner TXT filename
    else if (finalUrl.endsWith(".zip")) {
        try {
            const buffer = await finalResponse.arrayBuffer();

            if (!buffer || buffer.byteLength === 0) {
                throw new Error(`ZIP response from ${successSource} is empty`);
            }

            const bytes = new Uint8Array(buffer);
            const isZipBuffer = bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;

            if (!isZipBuffer) {
                const preview = new TextDecoder("utf-8").decode(bytes.slice(0, 300));
                console.error("resolveDownloadFilename(): Response is not a ZIP file. Preview:", preview);
                throw new Error(`Response from ${successSource} is not a ZIP archive`);
            }

            const zip = await JSZip.loadAsync(buffer);
            const zipNames = Object.keys(zip.files);
            // console.log("resolveDownloadFilename(): ZIP entries:", zipNames);

            const targetFile = zipNames
                .map(name => zip.files[name])
                .find(file => !file.dir && file.name.toLowerCase().endsWith(".txt") && hasSupportedGenomeVersionLabel(file.name));

            if (!targetFile) {
                // Fallback to ZIP filename itself
                const zipFileName = finalUrl.split("/").pop()?.split("?")[0] || null;
                // console.log(`resolveDownloadFilename(): No v3/v4/v5 .txt found in ZIP, using ZIP filename: ${zipFileName}`);
                return { finalUrl, fileName: zipFileName, fileExtension: "zip" };
            }

            // console.log(`resolveDownloadFilename(): Found TXT inside ZIP: ${targetFile.name}`);
            return { finalUrl, fileName: targetFile.name, fileExtension: "txt" };
        } catch (err) {
            console.warn(`resolveDownloadFilename(): Failed to parse ZIP: ${err.message}`);
            const zipFileName = finalUrl.split("/").pop()?.split("?")[0] || null;
            return { finalUrl, fileName: zipFileName, fileExtension: "zip" };
        }
    }

    // 3) Directory listing / collection root
    else if (finalUrl.endsWith("/_/")) {
        try {
            const html = await finalResponse.text();

            if (!html || !html.trim()) {
                throw new Error(`Directory listing from ${successSource} is empty`);
            }

            // Extract hrefs from HTML listing
            const hrefs = [...html.matchAll(/href="([^"]+)"/gi)].map(m => m[1]);

            // Prefer .zip first, then .txt
            const preferredHref =
                hrefs.find(h => /\.zip$/i.test(h) && hasSupportedGenomeVersionLabel(h)) ||
                hrefs.find(h => /\.txt$/i.test(h) && hasSupportedGenomeVersionLabel(h));

            if (!preferredHref) {
                console.warn("resolveDownloadFilename(): No v3/v4/v5 .zip or .txt found in directory listing");
                return { finalUrl, fileName: null, fileExtension: null };
            }

            const resolvedFileUrl = new URL(preferredHref, finalUrl).href;
            const fileName = resolvedFileUrl.split("/").pop()?.split("?")[0] || null;
            const fileExtension = fileName?.match(/\.(txt|zip)$/i)?.[1]?.toLowerCase() || null;

            // console.log(`resolveDownloadFilename(): Directory listing resolved to: ${fileName}`);
            return { finalUrl: resolvedFileUrl, fileName, fileExtension };
        } catch (err) {
            console.warn(`resolveDownloadFilename(): Failed to parse directory listing: ${err.message}`);
            return { finalUrl, fileName: null, fileExtension: null };
        }
    }

    // 4) Fallback - extract filename from URL
    const fileName = finalUrl.split("/").pop()?.split("?")[0] || null;
    const fileExtension = fileName?.match(/\.(txt|zip)$/i)?.[1]?.toLowerCase() || null;

    // console.log(`resolveDownloadFilename(): Fallback - extracted filename: ${fileName}, extension: ${fileExtension}`);
    return { finalUrl, fileName, fileExtension };
}



// Expose for dev console
if (typeof window !== "undefined") {
    window.fetchAvailableDataTypes = fetchAvailableDataTypes;
    window.fetch23andMeParticipants = fetch23andMeParticipants;
    window.allUsersMetaDataByType_fast = allUsersMetaDataByType_fast;
    window.parseParticipants = parseParticipants;
    window.parseParticipants_fast = parseParticipants_fast;
    window.fetchProfile = fetchProfile;
    window.getLastAllUsersSource = getLastAllUsersSource;
    window.getLastProfileSource = getLastProfileSource;
    window.resolveDownloadFilename = resolveDownloadFilename;
}


// ALL USERS ENDPOINT (VCF 23ANDME ETC METADATA, WITHOUT FILES) - PAGINATED JSON (NO HTML PARSING, MORE STABLE)
// without web crawling, so we dont rely on the HTML structure of the page, which can change 
// and break our code. Instead, we can use the JSON endpoint that provides structured data about 
// users. This endpoint is paginated, so we can fetch all pages to get the complete list of 
// participants.
// Get all 6214 users: paginate the JSON endpoint
// https://my.pgp-hms.org/users.json?page=1
// https://my.pgp-hms.org/users.json?page=2
// https://my.pgp-hms.org/users.json?page=3
// ...

// async function fetchAllUsersJson() {
//   const all = [];
//   let page = 1;
//   let total = Infinity;

//   while (all.length < total) {
//     const url = `https://my.pgp-hms.org/users.json?page=${page}`;
//     const res = await fetch(url);
//     const json = await res.json();

//     const chunk = json.aaData || [];

//     if (total === Infinity) {
//       total = json.iTotalRecords || Infinity;
//       console.log("Total records:", total);
//     }

//     if (!chunk.length) break;

//     all.push(...chunk);

//     page++;
//     await new Promise(r => setTimeout(r, 150));
//   }

//   return all;
// }

export { allUsersMetaDataByType_fast, fetch23andMeParticipants, fetchAvailableDataTypes, fetchProfile, getLastAllUsersSource, getLastProfileSource, parseParticipants, parseParticipants_fast, resolveDownloadFilename };
//# sourceMappingURL=allUsers.bundle.mjs.map
