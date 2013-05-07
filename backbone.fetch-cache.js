/*!
  backbone.fetch-cache v0.1.4
  by Andy Appleton - https://github.com/mrappleton/backbone-fetch-cache.git
 */

// AMD wrapper from https://github.com/umdjs/umd/blob/master/amdWebGlobal.js

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module and set browser global
    define(['underscore', 'backbone'], function (_, Backbone) {
      return (root.Backbone = factory(_, Backbone));
    });
  } else {
    // Browser globals
    root.Backbone = factory(root._, root.Backbone);
  }
}(this, function (_, Backbone) {

  // Setup
  var modelFetch = Backbone.Model.prototype.fetch,
      collectionFetch = Backbone.Collection.prototype.fetch,
      supportLocalStorage = typeof window.localStorage !== 'undefined';

  Backbone.fetchCache = (Backbone.fetchCache || {});
  Backbone.fetchCache._cache = (Backbone.fetchCache._cache || {});

  Backbone.fetchCache.priorityFn = function(a, b) {
    if (!a || !a.expires || !b || !b.expires) {
      return a;
    }

    return a.expires - b.expires;
  };

  Backbone.fetchCache._prioritize = function() {
    var sorted = _.values(this._cache).sort(this.priorityFn);
    var index = _.indexOf(_.values(this._cache), sorted[0]);
    return _.keys(this._cache)[index];
  };

  Backbone.fetchCache._deleteCacheWithPriority = function() {
    Backbone.fetchCache._cache[this._prioritize()] = null;
    delete Backbone.fetchCache._cache[this._prioritize()];
    Backbone.fetchCache.setLocalStorage();
  };

  if (typeof Backbone.fetchCache.localStorage === 'undefined') {
    Backbone.fetchCache.localStorage = true;
  }

  // Shared methods
  function setCache(instance, opts, attrs) {
    opts = (opts || {});
    var url = _.isFunction(instance.url) ? instance.url() : instance.url,
        expires = false;

    // need url to use as cache key so return if we can't get it
    if (!url) { return; }

    if (opts.expires !== false) {
      expires = (new Date()).getTime() + ((opts.expires || 5 * 60) * 1000);
    }

    Backbone.fetchCache._cache[url] = {
      expires: expires,
      value: attrs
    };

    Backbone.fetchCache.setLocalStorage();
  }

  function setLocalStorage() {
    if (!supportLocalStorage || !Backbone.fetchCache.localStorage) { return; }
    try {
      localStorage.setItem('backboneCache', JSON.stringify(Backbone.fetchCache._cache));
    } catch (err) {
      var code = err.code || err.number || err.message;
      if (code === 22) {
        this._deleteCacheWithPriority();
      } else {
        throw(err);
      }
    }
  }

  function getLocalStorage() {
    if (!supportLocalStorage || !Backbone.fetchCache.localStorage) { return; }
    var json = localStorage.getItem('backboneCache') || '{}';
    Backbone.fetchCache._cache = JSON.parse(json);
  }

  // Instance methods
  Backbone.Model.prototype.fetch = function(opts) {
    opts = (opts || {});
    var url = _.isFunction(this.url) ? this.url() : this.url,
        data = Backbone.fetchCache._cache[url],
        expired = false,
        attributes = false,
        promise = new $.Deferred();

    if (data) {
      expired = data.expires;
      expired = expired && data.expires < (new Date()).getTime();
      attributes = data.value;
    }

    if (!expired && (opts.cache || opts.prefill) && attributes) {
      this.set(attributes, opts);
      if (_.isFunction(opts.prefillSuccess)) { opts.prefillSuccess(this); }

      // Notify progress if we're still waiting for an AJAX call to happen...
      if (opts.prefill) { promise.notify(this); }
      // ...finish and return if we're not
      else {
        if (_.isFunction(opts.success)) { opts.success(this); }
        // Mimic actual fetch behaviour buy returning a fulfilled promise
        return promise.resolve(this);
      }
    }

    // Delegate to the actual fetch method and store the attributes in the cache
    modelFetch.apply(this, arguments)
      // resolve the returned promise when the AJAX call completes
      .done( _.bind(promise.resolve, this, this) )
      // Set the new data in the cache
      .done( _.bind(Backbone.fetchCache.setCache, null, this, opts) );

    // return a promise which provides the same methods as a jqXHR object
    return promise;
  };

  Backbone.Collection.prototype.fetch = function(opts) {
    opts = (opts || {});
    var url = _.isFunction(this.url) ? this.url() : this.url,
        data = Backbone.fetchCache._cache[url],
        expired = false,
        attributes = false,
        promise = new $.Deferred();

    if (data) {
      expired = data.expires;
      expired = expired && data.expires < (new Date()).getTime();
      attributes = data.value;
    }

    if (!expired && (opts.cache || opts.prefill) && attributes) {
      this[opts.add ? 'add' : 'reset'](this.parse(attributes), opts);
      if (_.isFunction(opts.prefillSuccess)) { opts.prefillSuccess(this); }

      // Notify progress if we're still waiting for an AJAX call to happen...
      if (opts.prefill) { promise.notify(this); }
      // ...finish and return if we're not
      else {
        if (_.isFunction(opts.success)) { opts.success(this); }
        // Mimic actual fetch behaviour buy returning a fulfilled promise
        return promise.resolve(this);
      }
    }

    // Delegate to the actual fetch method and store the attributes in the cache
    collectionFetch.apply(this, arguments)
      // resolve the returned promise when the AJAX call completes
      .done( _.bind(promise.resolve, this, this) )
      // Set the new data in the cache
      .done( _.bind(Backbone.fetchCache.setCache, null, this, opts) );

    // return a promise which provides the same methods as a jqXHR object
    return promise;
  };

  // Prime the cache from localStorage on initialization
  getLocalStorage();

  // Exports
  Backbone.fetchCache.setCache = setCache;
  Backbone.fetchCache.setLocalStorage = setLocalStorage;
  Backbone.fetchCache.getLocalStorage = getLocalStorage;

  return Backbone;
}));
