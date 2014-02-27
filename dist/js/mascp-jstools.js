/*!
  * bean.js - copyright Jacob Thornton 2011
  * https://github.com/fat/bean
  * MIT License
  * special thanks to:
  * dean edwards: http://dean.edwards.name/
  * dperini: https://github.com/dperini/nwevents
  * the entire mootools team: github.com/mootools/mootools-core
  */
!function (context) {
  var __uid = 1,
      registry = {},
      collected = {},
      overOut = /over|out/,
      namespace = /[^\.]*(?=\..*)\.|.*/,
      stripName = /\..*/,
      addEvent = 'addEventListener',
      attachEvent = 'attachEvent',
      removeEvent = 'removeEventListener',
      detachEvent = 'detachEvent',
      doc = context.document || {},
      root = doc.documentElement || {},
      W3C_MODEL = root[addEvent],
      eventSupport = W3C_MODEL ? addEvent : attachEvent,

  isDescendant = function (parent, child) {
    var node = child.parentNode;
    while (node !== null) {
      if (node == parent) {
        return true;
      }
      node = node.parentNode;
    }
  },

  retrieveUid = function (obj, uid) {
    return (obj.__uid = uid && (uid + '::' + __uid++) || obj.__uid || __uid++);
  },

  retrieveEvents = function (element) {
    var uid = retrieveUid(element);
    return (registry[uid] = registry[uid] || {});
  },

  listener = W3C_MODEL ? function (element, type, fn, add) {
    element[add ? addEvent : removeEvent](type, fn, false);
  } : function (element, type, fn, add, custom) {
    custom && add && (element['_on' + custom] = element['_on' + custom] || 0);
    element[add ? attachEvent : detachEvent]('on' + type, fn);
  },

  nativeHandler = function (element, fn,args) {
    return function (event,arg) {
      event = fixEvent(event || ((this.ownerDocument || this.document || this).parentWindow || context).event);
      return fn.apply(element, [event].concat(args).concat(arg));
    };
  },

  customHandler = function (element, fn, type, condition, args) {
    return function (e) {
      if (condition ? condition.apply(this, arguments) : W3C_MODEL ? true : e && e.propertyName == '_on' + type || !e) {
        fn.apply(element, Array.prototype.slice.call(arguments, e ? 0 : 1).concat(args));
      }
    };
  },

  addListener = function (element, orgType, fn, args) {
    var type = orgType.replace(stripName, ''),
        events = retrieveEvents(element),
        handlers = events[type] || (events[type] = {}),
        originalFn = fn,
        uid = retrieveUid(fn, orgType.replace(namespace, ''));
    if (handlers[uid]) {
      return element;
    }
    var custom = customEvents[type];
    if (custom) {
      fn = custom.condition ? customHandler(element, fn, type, custom.condition) : fn;
      type = custom.base || type;
    }
    var isNative = nativeEvents[type];
    fn = isNative ? nativeHandler(element, fn, args) : customHandler(element, fn, type, false, args);
    isNative = W3C_MODEL || isNative;
    if (type == 'unload') {
      var org = fn;
      fn = function () {
        removeListener(element, type, fn) && org();
      };
    }
    element[eventSupport] && listener(element, isNative ? type : 'propertychange', fn, true, !isNative && type);
    handlers[uid] = fn;
    fn.__uid = uid;
    fn.__originalFn = originalFn;
    return type == 'unload' ? element : (collected[retrieveUid(element)] = element);
  },

  removeListener = function (element, orgType, handler) {
    var uid, names, uids, i, events = retrieveEvents(element), type = orgType.replace(stripName, '');
    if (!events || !events[type]) {
      return element;
    }
    names = orgType.replace(namespace, '');
    uids = names ? names.split('.') : [handler.__uid];

    function destroyHandler(uid) {
      handler = events[type][uid];
      if (!handler) {
        return;
      }
      delete events[type][uid];
      if (element[eventSupport]) {
        type = customEvents[type] ? customEvents[type].base : type;
        var isNative = W3C_MODEL || nativeEvents[type];
        listener(element, isNative ? type : 'propertychange', handler, false, !isNative && type);
      }
    }

    destroyHandler(names); //get combos
    for (i = uids.length; i--; destroyHandler(uids[i])) {} //get singles

    return element;
  },

  del = function (selector, fn, $) {
    return function (e) {
      var array = typeof selector == 'string' ? $(selector, this) : selector;
      for (var target = e.target; target && target != this; target = target.parentNode) {
        for (var i = array.length; i--;) {
          if (array[i] == target) {
            return fn.apply(target, arguments);
          }
        }
      }
    };
  },

  add = function (element, events, fn, delfn, $) {
    if (typeof events == 'object' && !fn) {
      for (var type in events) {
        events.hasOwnProperty(type) && add(element, type, events[type]);
      }
    } else {
      var isDel = typeof fn == 'string', types = (isDel ? fn : events).split(' ');
      fn = isDel ? del(events, delfn, $) : fn;
      for (var i = types.length; i--;) {
        addListener(element, types[i], fn, Array.prototype.slice.call(arguments, isDel ? 4 : 3));
      }
    }
    return element;
  },

  remove = function (element, orgEvents, fn) {
    var k, m, type, events, i,
        isString = typeof(orgEvents) == 'string',
        names = isString && orgEvents.replace(namespace, ''),
        names = names && names.split('.'),
        rm = removeListener,
        attached = retrieveEvents(element);
    if (isString && /\s/.test(orgEvents)) {
      orgEvents = orgEvents.split(' ');
      i = orgEvents.length - 1;
      while (remove(element, orgEvents[i]) && i--) {}
      return element;
    }
    events = isString ? orgEvents.replace(stripName, '') : orgEvents;
    if (!attached || names || (isString && !attached[events])) {
      for (k in attached) {
        if (attached.hasOwnProperty(k)) {
          for (i in attached[k]) {
            for (m = names.length; m--;) {
              attached[k].hasOwnProperty(i) && new RegExp('^' + names[m] + '::\\d*(\\..*)?$').test(i) && rm(element, [k, i].join('.'));
            }
          }
        }
      }
      return element;
    }
    if (typeof fn == 'function') {
      rm(element, events, fn);
    } else if (names) {
      rm(element, orgEvents);
    } else {
      rm = events ? rm : remove;
      type = isString && events;
      events = events ? (fn || attached[events] || events) : attached;
      for (k in events) {
        if (events.hasOwnProperty(k)) {
          rm(element, type || k, events[k]);
          delete events[k]; // remove unused leaf keys
        }
      }
    }
    return element;
  },

  fire = function (element, type, args) {
    var evt, k, i, m, types = type.split(' ');
    for (i = types.length; i--;) {
      type = types[i].replace(stripName, '');
      var isNative = nativeEvents[type],
          isNamespace = types[i].replace(namespace, ''),
          handlers = retrieveEvents(element)[type];
      if (isNamespace) {
        isNamespace = isNamespace.split('.');
        for (k = isNamespace.length; k--;) {
          for (m in handlers) {
            handlers.hasOwnProperty(m) && new RegExp('^' + isNamespace[k] + '::\\d*(\\..*)?$').test(m) && handlers[m].apply(element, [false].concat(args));
          }
        }
      } else if (!args && element[eventSupport]) {
        fireListener(isNative, type, element);
      } else {
        for (k in handlers) {
          handlers.hasOwnProperty(k) && handlers[k].apply(element, [false].concat(args));
        }
      }
    }
    return element;
  },

  fireListener = W3C_MODEL ? function (isNative, type, element) {
    evt = document.createEvent(isNative ? "HTMLEvents" : "UIEvents");
    evt[isNative ? 'initEvent' : 'initUIEvent'](type, true, true, context, 1);
    element.dispatchEvent(evt);
  } : function (isNative, type, element) {
    isNative ? element.fireEvent('on' + type, document.createEventObject()) : element['_on' + type]++;
  },

  clone = function (element, from, type) {
    var events = retrieveEvents(from), obj, k;
    var uid = retrieveUid(element);
    obj = type ? events[type] : events;
    for (k in obj) {
      obj.hasOwnProperty(k) && (type ? add : clone)(element, type || from, type ? obj[k].__originalFn : k);
    }
    return element;
  },

  fixEvent = function (e) {
    var result = {};
    if (!e) {
      return result;
    }
    var type = e.type, target = e.target || e.srcElement;
    result.preventDefault = fixEvent.preventDefault(e);
    result.stopPropagation = fixEvent.stopPropagation(e);
    result.target = target && target.nodeType == 3 ? target.parentNode : target;
    if (type && type.indexOf('key')) {
      result.keyCode = e.which || e.keyCode;
    } else if ((/click|mouse|menu/i).test(type)) {
      result.rightClick = e.which == 3 || e.button == 2;
      result.pos = { x: 0, y: 0 };
      if (e.pageX || e.pageY) {
        result.clientX = e.pageX;
        result.clientY = e.pageY;
      } else if (e.clientX || e.clientY) {
        result.clientX = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
        result.clientY = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
      }
      overOut.test(type) && (result.relatedTarget = e.relatedTarget || e[(type == 'mouseover' ? 'from' : 'to') + 'Element']);
    }
    for (var k in e) {
      if (!(k in result)) {
        result[k] = e[k];
      }
    }
    return result;
  };

  fixEvent.preventDefault = function (e) {
    return function () {
      if (e.preventDefault) {
        e.preventDefault();
      }
      else {
        e.returnValue = false;
      }
    };
  };

  fixEvent.stopPropagation = function (e) {
    return function () {
      if (e.stopPropagation) {
        e.stopPropagation();
      } else {
        e.cancelBubble = true;
      }
    };
  };

  var nativeEvents = { click: 1, dblclick: 1, mouseup: 1, mousedown: 1, contextmenu: 1, //mouse buttons
    mousewheel: 1, DOMMouseScroll: 1, //mouse wheel
    mouseover: 1, mouseout: 1, mousemove: 1, selectstart: 1, selectend: 1, //mouse movement
    keydown: 1, keypress: 1, keyup: 1, //keyboard
    orientationchange: 1, // mobile
    touchstart: 1, touchmove: 1, touchend: 1, touchcancel: 1, // touch
    gesturestart: 1, gesturechange: 1, gestureend: 1, // gesture
    focus: 1, blur: 1, change: 1, reset: 1, select: 1, submit: 1, //form elements
    load: 1, unload: 1, beforeunload: 1, resize: 1, move: 1, DOMContentLoaded: 1, readystatechange: 1, //window
    error: 0, abort: 1, scroll: 1 }; //misc

  function check(event) {
    var related = event.relatedTarget;
    if (!related) {
      return related === null;
    }
    return (related != this && related.prefix != 'xul' && !/document/.test(this.toString()) && !isDescendant(this, related));
  }

  var customEvents = {
    mouseenter: { base: 'mouseover', condition: check },
    mouseleave: { base: 'mouseout', condition: check }
//    mousewheel: { base: /Firefox/.test(navigator.userAgent) ? 'DOMMouseScroll' : 'mousewheel' }
  };

  var bean = { add: add, remove: remove, clone: clone, fire: fire };

  var clean = function (el) {
    var uid = remove(el).__uid;
    if (uid) {
      delete collected[uid];
      delete registry[uid];
    }
  };

  if (context[attachEvent]) {
    add(context, 'unload', function () {
      for (var k in collected) {
        collected.hasOwnProperty(k) && clean(collected[k]);
      }
      context.CollectGarbage && CollectGarbage();
    });
  }

  var oldBean = context.bean;
  bean.noConflict = function () {
    context.bean = oldBean;
    return this;
  };

  (typeof module !== 'undefined' && module.exports) ?
    (module.exports = bean) :
    (context['bean'] = bean);

}(this);//"use strict";

/**
 *  @fileOverview   Basic classes and defitions for the MASCP services
 */

/** Convenience logging function. If there is no log function defined, add a log method that simply
 *  forwards the message on to the console.log.
 *  @function
 *  @param  {Object}    message Message to log
 */

/**
 *  @namespace MASCP namespace
 */
var MASCP = MASCP || {};


/** Default constructor for Services
 *  @class      Super-class for all MASCP services to retrieve data from
 *              proteomic databases. Sub-classes of this class override methods
 *              to change how requests are built, and how the data is parsed.
 *  @param      {String}    agi             AGI to retrieve data for
 *  @param      {String}    endpointURL     Endpoint for the service
 */
MASCP.Service = function(agi,endpointURL) {};


if (typeof module != 'undefined' && module.exports){
    var events = require('events');
    
    // MASCP.Service.prototype = new events.EventEmitter();

    singletonemitter = new events.EventEmitter();

    MASCP.Service.emit = function(targ,args) {
        singletonemitter.emit(targ,args);
    };

    MASCP.Service.removeAllListeners = function(ev,cback) {
        if (cback) {
            singletonemitter.removeListeners(ev,cback);
        } else {
            singletonemitter.removeAllListeners(ev);
        }
    };

    MASCP.Service.removeListener = function(ev,cback) {
        singletonemitter.removeListener(ev,cback);
    };

    MASCP.Service.addListener = function(ev,cback) {
        singletonemitter.addListener(ev,cback);
    };
    
    var bean = {
        'add' : function(targ,ev,cback) {
            if (ev == "error") {
                ev = "MASCP.error";
            }
            if (targ.addListener) {
                targ.addListener(ev,cback);
            } else {
                var callback_func = function() {
                    var args = Array.prototype.slice.call(arguments);
                    if (args[0] === targ) {
                        args.shift();
                        cback.apply(targ,args);
                    }
                };

                targ._listeners = targ._listeners || {};
                if ( ! targ._listeners[ev] ) {
                    targ._listeners[ev] = {};
                }
                if ( ! targ._listener ) {
                    targ._listener = new events.EventEmitter();
                }
                if (targ._listeners[ev][cback]) {
                    callback_func = targ._listeners[ev][cback];
                }
                targ._listener.addListener(ev,callback_func);
                targ._listeners[ev][cback] = callback_func;
            }
        },
        'remove' : function(targ,ev,cback) {
            var self = this;
            if (ev == "error") {
                ev = "MASCP.error";
            }
            if (cback && targ.removeListener) {
                targ.removeListener(ev,cback);
            } else if (cback) {
                if (targ._listeners && targ._listeners[ev] && targ._listeners[ev][cback]) {
                    targ._listener.removeListener(ev,targ._listeners[ev][cback]);
                    delete targ._listeners[ev][cback];
                }
                if (targ._listener.listeners(ev).length == 0) {
                    targ._listeners[ev] = {};
                }
            } else if (targ.removeAllListeners && typeof cback == 'undefined') {
                targ.removeAllListeners(ev);
            }
        },
        'fire' : function(targ,ev,args) {
            if (ev == "error") {
                ev = "MASCP.error";
            }
            if (targ.emit) {
                targ.emit.apply(targ,[ev].concat(args));
            } else {
                if (targ._listener) {
                    targ._listener.emit.apply(targ._listener,[ev,targ].concat(args));
                }
            }
        }
    };
    
    MASCP.events = new events.EventEmitter();
    module.exports = MASCP;
    var parser = require('jsdom').jsdom;
    
    var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
    Object.defineProperty(XMLHttpRequest.prototype,"responseXML", {
        get: function() { return parser((this.responseText || '').replace(/&/g,'&amp;')); },
        set: function() {}

    });
    XMLHttpRequest.prototype.customUA = 'MASCP Gator crawler (+http://gator.masc-proteomics.org/)';
} else {
    window.MASCP = MASCP;
    var ie = (function(){

        var undef,
            v = 3,
            div = document.createElement('div'),
            all = div.getElementsByTagName('i');

            do {
                div.innerHTML = '<!--[if gt IE ' + (++v) + ']><i></i><![endif]-->';
            } while (all[0]);

        return v > 4 ? v : undef;

    }());
    if (ie) {
        if (ie === 7) {
            MASCP.IE = true;
            MASCP.IE7 = true;
        }
        if (ie === 8) {
            MASCP.IE = true;
            MASCP.IE8 = true;
        }
        if (ie == 9) {
            MASCP.IE = true;
            MASCP.IE9 = true;
        }
        MASCP.IE = true;
    }
}

/** Build a data retrieval class that uses the given function to extract result data.
 *  @static
 *  @param  {Function}  dataExtractor   Function to extract data from the resultant data (passed as an argument
 *                                      to the function), and then populate the result object. The function is
 *                                      bound to a hash to populate data in to. When no data is passed to the
 *                                      function, the hash should be populated with default values.
 */
MASCP.buildService = function(dataExtractor)
{
    var clazz = function(agi,endpointURL)
    {
        if (typeof endpointURL != 'undefined') {
            this._endpointURL = endpointURL;
        } else {
            this._endpointURL = clazz.SERVICE_URL;
        }
        this.agi = agi;
        return this;
    };

    clazz.Result = function(data)
    {
        dataExtractor.apply(this,[data]);
        return this;
    };
    
    
    clazz.prototype = MASCP.extend(new MASCP.Service(),{
        '__class__'       :       clazz,
        '__result_class'  :       clazz.Result,
        '_endpointURL'    :       null
    });
    
    clazz.Result.prototype = MASCP.extend(new MASCP.Service.Result(),{
       '__class__'        :       clazz.Result
    });

    clazz.Result.prototype = MASCP.extend(clazz.Result.prototype,dataExtractor.apply({},[]));
        
    clazz.toString = function() {
        for (var serv in MASCP) {
            if (this === MASCP[serv]) {
                return "MASCP."+serv;
            }
        }
    };
    
    return clazz;
};

MASCP.cloneService = function(service,name) {
    var new_service = MASCP.buildService(function() { return this; });
    new_service.Result = service.Result;
    new_service.prototype = new service();
    MASCP[name] = new_service;
    new_service.prototype['__class__'] = new_service;
    return new_service;
};


(function() {
    var already_seen_set = {};
    var service_from_config = function(set,pref,callback) {
        if ( ! pref ) {
            return;
        }
        if ( pref.type == "liveClass" ) {
            var reader_class = MASCP[set];
            callback.call(null,null,pref,new reader_class(null,pref.url));
            return;
        }
        if ( pref.type == "gatorURL" ) {
            var reader = new MASCP.UserdataReader(null, set);
            reader.datasetname = pref.title;
            reader.requestData = function() {
                var agi = this.agi.toLowerCase();
                var gatorURL = set.slice(-1) == '/' ? set+agi : set+'/'+agi;
                return {
                    type: "GET",
                    dataType: "json",
                    url : gatorURL,
                    data: { 'agi'       : agi,
                            'service'   : this.datasetname
                    }
                };
            };
            callback.call(null,null,pref,reader);
            return;
        }


        // If we wish to load complete datasets
        // and store them browser-side, we need
        // a parser function to grab the dataset.

        if ( ! pref.parser_function ) {
          return;
        }

        if (JSandbox) {
          var sandbox = new JSandbox();
          var parser;
          sandbox.eval('var sandboxed_parser = '+pref.parser_function+';',function() {
            var box = this;
            parser = function(datablock,cback) {
                box.eval({ "data" : "sandboxed_parser(input.datablock)",
                            "input" : {"datablock" : datablock },
                            "callback" : function(r) {
                                cback.call(null,r);
                                box.terminate();
                            },
                            "onerror" : function(err) {
                                console.log("Parser error");
                                cback.call(null,null);
                            }
                        });
            };
            parser.callback = true;
            parser.terminate = function() {
                if (sandbox) {
                    sandbox.terminate();
                }
            };


            // Right now we only download stuff from Google Drive
            // We should be able to download stuff from other datasources too
            if (/^(https?:)?\/?\//.test(set)) {
                MASCP.Service.request(set,function(err,data) {
                    if (err) {
                        callback.call(null,{"error" : err},pref);
                        return;
                    }

                    var reader = new MASCP.UserdataReader(null,null);

                    reader.datasetname = pref.title;

                    if (already_seen_set[set]) {
                        MASCP.Service.CacheService(reader);
                        callback.call(null,null,pref,reader);
                        return;
                    }
                    already_seen_set[set] = true;


                    reader.bind('ready',function() {
                        if (parser) {
                            parser.terminate();
                        }
                        callback.call(null,null,pref,reader);
                    });

                    reader.bind('error',function(err) {
                        if (parser) {
                            parser.terminate();
                        }
                        callback.call(null,{"error" : err},pref);
                    });

                    MASCP.Service.ClearCache(reader,null,function(error) {
                        if (error) {
                            bean.fire(reader,"error",[error]);
                            return;
                        }
                        reader.map = parser;
                        reader.setData(pref.title,data);
                    });

                });
                return;
            }
            var a_reader = (new MASCP.GoogledataReader()).createReader(set,parser);

            a_reader.bind('ready',function() {
                if (parser) {
                    parser.terminate();
                }
                callback.call(null,null,pref,a_reader);
            });
            a_reader.bind('error',function(err) {
                callback.call(null,{"error" : err },pref);
            });


          });

        } else {
            console.log("No sandbox support - not trying to get data for "+pref.title);
            callback.call(null,{"error" : "No sandbox support"});
            return;
        }

    };

    MASCP.IterateServicesFromConfig = function(configuration,callback) {
        if (! configuration ) {
            return;
        }
        for (var set in configuration) {
            service_from_config(set,configuration[set],callback);
        }
    };
})();

MASCP.extend = function(in_hsh,hsh) {
    for (var i in hsh) {
        if (true) {
            in_hsh[i] = hsh[i];
        }
    }
    return in_hsh;        
};

/**
 *  @lends MASCP.Service.prototype
 *  @property   {String}  agi               AGI to retrieve data for
 *  @property   {MASCP.Service.Result}  result  Result from the query
 *  @property   {Boolean} async             Flag for using asynchronous requests - defaults to true
 */
MASCP.extend(MASCP.Service.prototype,{
  'agi'     : null,
  'result'  : null, 
  '__result_class' : null,
  'async'   : true
});


/*
 * Internal callback for new data coming in from a XHR
 * @private
 */

MASCP.Service.prototype._dataReceived = function(data,status)
{
    if (! data ) {
        return false;
    }
    var clazz = this.__result_class;
    if (data && data.error && data.error != '' && data.error !== null ) {
        bean.fire(this,'error',[data.error]);
        return false;
    }
    if (Object.prototype.toString.call(data) === '[object Array]') {
        for (var i = 0; i < data.length; i++ ) {
            arguments.callee.call(this,data[i],status);
        }
        if (i === 0) {
            this.result = new clazz();
        }
        this.result._raw_data = { 'data' : data };
    } else if ( ! this.result ) {
        var result;
        try {
            result = new clazz(data);
        } catch(err2) {
            bean.fire(this,'error',[err2]);
            return false;
        }
        if ( ! result._raw_data ) {
            result._raw_data = data;
        }
        this.result = result;
    } else {
        // var new_result = {};
        try {
            clazz.call(this.result,data);
        } catch(err3) {
            bean.fire(this,'error',[err3]);
            return false;
        }
        // for(var field in new_result) {
        //     if (true && new_result.hasOwnProperty(field)) {
        //         this.result[field] = new_result[field];
        //     }
        // }
        if (! this.result._raw_data) {
            this.result._raw_data = data;
        }
        // this.result._raw_data = data;
    }

    if (data && data.retrieved) {
        this.result.retrieved = data.retrieved;
        this.result._raw_data.retrieved = data.retrieved;
    }

    this.result.agi = this.agi;
    
    
    
    return true;
};

MASCP.Service.prototype.gotResult = function()
{
    var self = this;
    
    var reader_cache = function(thing) {
        if ( ! thing.readers ) {
            thing.readers = [];
        }
        thing.readers.push(self.toString());
    };
    
    bean.add(MASCP,'layerRegistered', reader_cache);
    bean.add(MASCP,'groupRegistered', reader_cache);
    bean.fire(self,"resultReceived");
    try {
        bean.remove(MASCP,'layerRegistered',reader_cache);
        bean.remove(MASCP,'groupRegistered',reader_cache);
    } catch (e) {
    }

    bean.fire(MASCP.Service,"resultReceived");
};

MASCP.Service.prototype.requestComplete = function()
{
    bean.fire(this,'requestComplete');
    bean.fire(MASCP.Service,'requestComplete',[this]);
};

MASCP.Service.prototype.requestIncomplete = function()
{
    bean.fire(this,'requestIncomplete');
    bean.fire(MASCP.Service,'requestIncomplete',[this]);
};


MASCP.Service.registeredLayers = function(service) {
    var result = [];
    for (var layname in MASCP.layers) {
        if (MASCP.layers.hasOwnProperty(layname)) {
            var layer = MASCP.layers[layname];
            if (layer.readers && layer.readers.indexOf(service.toString()) >= 0) {
                result.push(layer);
            }
        }
    }
    return result;
};

MASCP.Service.registeredGroups = function(service) {
    var result = [];
    for (var nm in MASCP.groups) {
        if (MASCP.groups.hasOwnProperty(nm)) {
            var group = MASCP.groups[nm];
            if (group.readers && group.readers.indexOf(service.toString()) >= 0) {
                result.push(group);
            }            
        }
    }
    return result;  
};

/**
 *  Binds a handler to one or more events. Returns a reference to self, so this method
 *  can be chained.
 *
 *  @param  {String}    type        Event type to bind
 *  @param  {Function}  function    Handler to execute on event
 */

MASCP.Service.prototype.bind = function(type,func)
{
    bean.add(this,type,func);
    return this;
};

/**
 *  Unbinds a handler from one or more events. Returns a reference to self, so this method
 *  can be chained.
 *
 *  @param  {String}    type        Event type to unbind
 *  @param  {Function}  function    Handler to unbind from event
 */
MASCP.Service.prototype.unbind = function(type,func)
{
    bean.remove(this,type,func);
    return this;    
};

/**
 * @name    MASCP.Service#resultReceived
 * @event
 * @param   {Object}    e
 */

/**
 * @name    MASCP.Service#error
 * @event
 * @param   {Object}    e
 */

/**
 *  Asynchronously retrieves data from the remote source. When data is received, a 
 *  resultReceived.mascp event is triggered upon this service, while an error.mascp
 *  event is triggered when an error occurs. This method returns a reference to self
 *  so it can be chained.
 */
(function(base) {

var make_params = function(params) {
    var qpoints = [];
    for(var fieldname in params) {
        if (params.hasOwnProperty(fieldname)) {
            qpoints.push(fieldname +'='+params[fieldname]);
        }
    }
    return qpoints.join('&');
};

var do_request = function(request_data) {
    
    
    var datablock = null;
    
    if ( ! request_data.url ) {
        request_data.success.call(null,null);
        return;
    }

    var request = new XMLHttpRequest();
    
    if (request_data.type == 'GET' && request_data.data) {
        var index_of_quest = request_data.url.indexOf('?');

        if (index_of_quest == (request_data.url.length - 1)) {
            request_data.url = request_data.url.slice(0,-1);
            index_of_quest = -1;
        }
        var has_question =  (index_of_quest >= 0) ? '&' : '?';
        request_data.url = request_data.url.replace(/\?$/,'') + has_question + make_params(request_data.data);
    }
    request.open(request_data.type,request_data.url,request_data.async);
    if (request_data.type == 'POST') {
        request.setRequestHeader("Content-Type","application/x-www-form-urlencoded");
        datablock = make_params(request_data.data);
    }

    if (request.customUA) {
        request.setRequestHeader('User-Agent',request.customUA);
    }
    
    var redirect_counts = 5;

    request.onreadystatechange = function(evt) {
        if (request.readyState == 4) {
            if (request.status >= 300 && request.status < 400 && redirect_counts > 0) {
                var loc = (request.getResponseHeader('location')).replace(/location:\s+/,'');
                redirect_counts = redirect_counts - 1;
                request.open('GET',loc,request_data.async);
                request.send();
                return;
            }
            if (request.status == 503) {
                // Let's encode an exponential backoff
                request.last_wait = (request_data.last_wait || 500) * 2;
                setTimeout(function(){
                    request.open(request_data.type,request_data.url,request_data.async);
                    if (request_data.type == 'POST') {
                        request.setRequestHeader("Content-Type","application/x-www-form-urlencoded");
                    }
                    if (request.customUA) {
                        request.setRequestHeader('User-Agent',request.customUA);
                    }
                    request.send(datablock);
                },request_data.last_wait);
                return;
            }
            if (request.status == 403) {
                // Make sure our S3 buckets expose the Server header cross-origin
                var server = request.getResponseHeader('Server');
                if (server === 'AmazonS3') {
                    request_data.success.call(null,{"error" : "No data"},403,request);
                    return;
                }
            }
            if (request.status >= 200 && request.status < 300) {
                var data_block;
                if (request_data.dataType == 'xml') {
                    data_block = typeof(document) !== 'undefined' ? document.implementation.createDocument(null, "nodata", null) : { 'getElementsByTagName' : function() { return []; } };
                } else {
                    data_block = {};
                }
                try {
                    var text = request.responseText;
                    data_block = request_data.dataType == 'xml' ? request.responseXML || MASCP.importNode(request.responseText) :
                                 request_data.dataType == 'txt' ? request.responseText : JSON.parse(request.responseText);
                } catch (e) {
                    if (e.type == 'unexpected_eos') {
                        request_data.success.call(null,{},request.status,request);
                        return;
                    } else {
                        request_data.error.call(null,request.responseText,request,{'error' : e.type || e.message, 'stack' : e });
                        return;
                    }
                }
                if (request.status == 202 && data_block.status == "RUNNING") {
                    setTimeout(function(){
                        request.open(request_data.type,request_data.url,request_data.async);
                        if (request_data.type == 'POST') {
                            request.setRequestHeader("Content-Type","application/x-www-form-urlencoded");
                        }
                        if (request.customUA) {
                            request.setRequestHeader('User-Agent',request.customUA);
                        }
                        request.send(datablock);
                    },5000);
                    return;
                }
                request_data.success.call(null,data_block,request.status,request);
                data_block = null;
            } else {
                request_data.error.call(null,request.responseText,request,request.status);
            }
        }
    };
    if (MASCP.NETWORK_FAIL && MASCP.NETWORK_FAIL.enabled) {
        setTimeout(function() {
            console.log("Causing network failure");
            request = { 'onreadystatechange' : request.onreadystatechange};
            request.readyState = 4;
            request.status = MASCP.NETWORK_FAIL.status || 500;
            request.responseText = "Intercepted by Network Failure simulator";
            request.onreadystatechange();
        },1000);
        return;
    }

    request.send(datablock);
};

MASCP.Service.request = function(url,callback,noparse) {
    var method =  MASCP.IE ? do_request_ie : do_request;
    if (MASCP.IE && ! url.match(/^https?\:/)) {
        method = do_request;
    }
    var params =  { async: true, url: url, timeout: 5000, type : "GET",
                    error: function(response,req,status) {
                        callback.call(null,{"status" : status });
                    },
                    success:function(data,status,xhr) {
                        callback.call(null,null,data);
                    }
                };
    if (noparse) {
        params.dataType = 'txt';
        if (noparse === "xml") {
            params.dataType = 'xml';
        }
    }
    method.call(null,params);
};

/**
 * Private method for performing a cross-domain request using Internet Explorer 8 and up. Adapts the 
 * parameters passed, and builds an XDR object. There is no support for a locking
 * synchronous method to do these requests (that is required for Unit testing) so an alert box is used
 * to provide the locking.
 * @private
 * @param {Object} dataHash Hash with the data and settings used to build the query.
 */


var do_request_ie = function(dataHash)
{
    // Use XDR
    var xdr = new XDomainRequest();
    var loaded = false;
    var counter = 0;
    xdr.onerror = function(ev) {
        dataHash.error(xdr,xdr,{"message" : "XDomainRequest error"});
    };
    xdr.onprogress = function() { };
    xdr.open("GET",dataHash.url+"?"+make_params(dataHash.data));
    xdr.onload = function() {
        loaded = true;
        if (dataHash.dataType == 'xml') {
            var dom = new ActiveXObject("Microsoft.XMLDOM");
            dom.async = false;
            dom.loadXML(xdr.responseText);
            dataHash.success(dom, 'success',xdr);
        } else if (dataHash.dataType == 'json') {
            var parsed = null;
            try {
                parsed = JSON.parse(xdr.responseText);
            } catch(err) {
                dataHash.error(xdr,xdr,{"message" : "JSON parsing error"});
            }
            if (parsed) {
                dataHash.success(parsed,'success',xdr);
            }
        } else {
            dataHash.success(xdr.responseText, 'success', xdr);
        }
    };
    // We can't set the content-type on the parameters here to url-encoded form data.
    setTimeout(function () {
        xdr.send();
    }, 0);
    while (! dataHash.async && ! loaded && counter < 3) {
        alert("This browser does not support synchronous requests, click OK while we're waiting for data");
        counter += 1;
    }
    if ( ! dataHash.async && ! loaded ) {
        alert("No data");
    }
};

base.retrieve = function(agi,callback)
{
    var self = this;

    MASCP.Service._current_reqs = MASCP.Service._current_reqs || 0;
    MASCP.Service._waiting_reqs = MASCP.Service._waiting_reqs || 0;
    
    if (MASCP.Service.MAX_REQUESTS) {
        var my_func = arguments.callee;
        if (MASCP.Service._current_reqs > MASCP.Service.MAX_REQUESTS) {
            MASCP.Service._waiting_reqs += 1;
            bean.add(MASCP.Service,'requestComplete',function() {
                bean.remove(this,'requestComplete',arguments.callee);
                setTimeout(function() {
                    MASCP.Service._waiting_reqs -= 1;
                    my_func.call(self,agi,callback);
                },0);
            });
            return this;
        }
    }
    if (agi) {
        this.agi = agi;
    }

    if (agi && callback) {
        this.agi = agi;

        this.result = null;
        
        var done_result = false;
        var done_func = function(err,obj) {
            bean.remove(self,"resultReceived",done_func);
            bean.remove(self,"error",done_func);
            bean.remove(self,"requestComplete",done_func);
            if ( ! done_result ) {
                if (err) {
                    callback.call(self,err);
                } else {
                    callback.call(self);
                }
            }
            done_result = true;
        };
        bean.add(self,"resultReceived",done_func);
        bean.add(self,"error",done_func);
        bean.add(self,"requestComplete",done_func);
    }
    var request_data = this.requestData();

    if (request_data === false) {
        return;
    }

    if (! request_data ) {
        bean.fire(self,"error",["No request data"]);
        bean.fire(MASCP.Service,"requestComplete",[self]);
        this.requestComplete();
        return this;
    }
        
    var default_params = {
    async:      this.async,
    url:        request_data.url || this._endpointURL,
    timeout:    5000,
    error:      function(response,req,status) {
                    MASCP.Service._current_reqs -= 1;
                    if (typeof status == 'string') {
                        status = { 'error' : status , 'request' : req };
                    }
                    if (! isNaN(status) ) {
                        status = { "error" : "Reqeust error", "status" : status, 'request' : req };
                    }
                    bean.fire(self,"error",[status]);
                    bean.fire(MASCP.Service,'requestComplete');
                    self.requestComplete();
                    //throw "Error occurred retrieving data for service "+self._endpointURL;
                },
    success:    function(data,status,xhr) {
                    MASCP.Service._current_reqs -= 1;
                    if ( xhr && xhr.status !== null && xhr.status === 0 ) {
                        bean.fire(self,"error",[{"error": "Zero return status from request "}]);
                        self.requestComplete();
                        return;
                    }
                    var received_flag = self._dataReceived(data,status);

                    if (received_flag) {
                        self.gotResult();
                    }

                    if (received_flag !== null && typeof received_flag !== 'undefined') {
                        self.requestComplete();
                    } else {
                        self.requestIncomplete();
                    }
                }
    };
    MASCP.extend(default_params,request_data);
    if (MASCP.IE) {
        do_request_ie(default_params);
    } else {
        do_request(default_params);
    }
    
    MASCP.Service._current_reqs += 1;

    return this;
};

})(MASCP.Service.prototype);

(function(clazz) {

    var get_db_data, store_db_data, search_service, clear_service, find_latest_data, data_timestamps, sweep_cache, cached_accessions, begin_transaction, end_transaction,first_accession;
    
    var max_age = 0, min_age = 0;

    clazz.BeginCaching = function() {
        clazz.CacheService(clazz.prototype);
    };

    // To do 7 days ago, you do
    // var date = new Date();
    // date.setDate(date.getDate() - 1);
    // MASCP.Service.SetMinimumFreshnessAge(date);
    
    // Set the minimum age if you want nothing OLDER than this date
    clazz.SetMinimumAge = function(date) {
        if (date === 0) {
            min_age = 0;
        } else {
            min_age = date.getTime();
        }
    };

    // Set the maximum age if you want nothing NEWER than this date
    clazz.SetMaximumAge = function(date) {
        if (date === 0) {
            max_age = 0;
        } else {
            max_age = date.getTime();
        }
    };

    clazz.SweepCache = function(date) {
        if (! date) {
            date = (new Date());
        }
        sweep_cache(date.getTime());
    };

    clazz.CacheService = function(reader) {
        if ((reader.prototype && reader.prototype.retrieve.caching) || reader.retrieve.caching) {
            return;
        }
        var _oldRetrieve = reader.retrieve;
        var has_avoid;
        reader.retrieve = function(agi,cback) {
            var self = this;
            var id = agi ? agi : self.agi;
            if ( ! id ) {
                _oldRetrieve.call(self,id,cback);
                return self;
            }

            id = id.toLowerCase();
            self.agi = id;

            if (self.avoid_database) {
                if (has_avoid) {
                    return;
                }
                has_avoid = self._dataReceived;
                self._dataReceived = (function() { return function(dat) {
                        var res = has_avoid.call(this,dat);
                        var id = self.agi;
                        if (res && this.result && this.result._raw_data !== null) {
                            store_db_data(id,this.toString(),this.result._raw_data || {});
                        }
                        dat = {};
                        return res;
                    };})();
                cback.call(self);
                return;
            }
            if (has_avoid && ! self.avoid_database) {
                self._dataReceived = has_avoid;
                has_avoid = null;
                cback.call(self);
                return;
            }

            get_db_data(id,self.toString(),function(err,data) {
                if (data) {
                    if (cback) {
                        self.result = null;
                        var done_func = function(err) {
                            bean.remove(self,"resultRecieved",arguments.callee);
                            bean.remove(self,"error",arguments.callee);
                            cback.call(self,err);
                        };
                        bean.add(self,"resultReceived",done_func);
                        bean.add(self,"error", done_func);
                    }

                    var received_flag = self._dataReceived(data,"db");

                    if (received_flag) {
                        self.gotResult();
                    }

                    if (received_flag !== null) {
                        self.requestComplete();
                    } else {
                        self.requestIncomplete();
                    }

                } else {
                    var old_received = self._dataReceived;
                    self._dataReceived = (function() { return function(dat,source) {
                        var res = old_received.call(this,dat,source);
                        if (res && this.result && this.result._raw_data !== null) {
                            store_db_data(id,this.toString(),this.result._raw_data || {});
                        }
                        this._dataReceived = null;
                        this._dataReceived = old_received;
                        dat = {};
                        return res;
                    };})();
                    var old_url = self._endpointURL;
                    // If we have a maximum age, i.e. we don't want anything newer than a date
                    // we should not actually do a request that won't respect that.
                    // We can set a minimum age, since the latest data will be, by definition be the latest!
                    if ((max_age !== 0)) {
                        self._endpointURL = null;
                    }
                    _oldRetrieve.call(self,id,cback);
                    self._endpointURL = old_url;
                }             
            });
            return self;
        };
        reader.retrieve.caching = true;
    };

    clazz.FindCachedService = function(service,cback) {
        var serviceString = service.toString();
        search_service(serviceString,cback);
        return true;
    };

    clazz.CachedAgis = function(service,cback) {
        var serviceString = service.toString();
        cached_accessions(serviceString,cback);
        return true;
    };

    clazz.FirstAgi = function(service,cback) {
        var serviceString = service.toString();
        first_accession(serviceString,cback);
        return true;
    };

    clazz.ClearCache = function(service,agi,callback) {
        var serviceString = service.toString();
        if ( ! callback ) {
            callback = function() {};
        }
        clear_service(serviceString,agi,callback);
        return true;
    };

    clazz.HistoryForService = function(service,cback) {
        var serviceString = service.toString();
        data_timestamps(serviceString,null,cback);
    };

    clazz.Snapshot = function(service,date,wanted,cback) {
        var serviceString = service.toString();
        get_snapshot(serviceString,null,wanted,cback);
    };

    var transaction_ref_count = 0;
    var waiting_callbacks = [];
    clazz.BulkOperation = function(callback) {
        transaction_ref_count++;
        var trans = function(callback) {
            if ( ! callback ) {
                callback = function() {};
            }
            transaction_ref_count--;
            waiting_callbacks.push(callback);
            if (transaction_ref_count == 0) {
                end_transaction(function(err) {
                    waiting_callbacks.forEach(function(cback) {
                        cback(err);
                    });
                    waiting_callbacks = [];
                });
            }
        };
        begin_transaction(callback,trans);
        return trans;
    };

    var db,idb;

    if (typeof window != 'undefined') {
        window.indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.msIndexedDB;
        if ( ! window.indexedDB ) {
            delete window.indexedDB;
        }
    }

    if (typeof module != 'undefined' && module.exports) {
        var sqlite = require('sqlite3');
        db = new sqlite.Database("cached.db");
        db.exec("VACUUM;");
        //db.open("cached.db",function() {});
    } else if ("openDatabase" in window || "indexedDB" in window) {

        if ("indexedDB" in window) {
            // Handle the prefix of Chrome to IDBTransaction/IDBKeyRange.
            if ('webkitIndexedDB' in window) {
                window.IDBTransaction = window.webkitIDBTransaction;
                window.IDBKeyRange = window.webkitIDBKeyRange;
                window.IDBCursor = window.webkitIDBCursor;
            }

            /* Versioning of DB schema */

            var change_func = function(version,transaction) {
                var db = transaction.db;
                if (db.objectStoreNames && db.objectStoreNames.contains("cached")) {
                    db.deleteObjectStore("cached");
                }
                var keypath = window.msIndexedDB ? "serviceacc" : "id";
                var store = db.createObjectStore("cached", { keyPath: keypath });
                store.createIndex("entries", [ "acc" , "service" ], { unique : false });
                if (window.msIndexedDB) {
                    store.createIndex("entries-ms","serviceacc", { unique : false });
                }
                store.createIndex("timestamps", [ "service" , "retrieved" ], { unique : false });
                store.createIndex("services", "service", { unique : false });
                transaction.oncomplete = function() {
                    database_ready(db);
                    database_ready = function() {};
                };
            };


            idb = true;
            var db_version = 2;
            var req = indexedDB.open("datacache",db_version);

            req.onupgradeneeded = function (e) {
              var transaction = req.transaction;
              change_func(e.oldVersion, transaction);
            };

            var database_ready = function(db) {
                if (db) {
                    idb = db;
                }
                if (MASCP.events) {
                    MASCP.events.emit("ready");
                }
                if (MASCP.ready) {
                    MASCP.ready();
                    MASCP.ready = true;
                } else {
                    MASCP.ready = true;
                }
            };
            req.onerror = function(e) {
                console.log("Error loading Database");
                // setTimeout(function() {
                //     indexedDB.deleteDatabase("datacache").onsuccess = function() {

                //     }
                // },0);
            }
            req.onsuccess = function(e) {
                idb = e.target.result;
                var version = db_version;
                if (idb.version != Number(version)) {
                    var versionRequest = db.setVersion(ver);
                    versionRequest.onsuccess = function (e) {
                        var transaction = versionRequest.result;
                        change_func(oldVersion, transaction);
                    };
                } else {
                    database_ready();
                }
            };
        } else {
            try {
                db = openDatabase("cached","","MASCP Gator cache",1024*1024);
            } catch (err) {
                throw err;
            }
            db.all = function(sql,args,callback) {
                this.exec(sql,args,callback);
            };
            db.exec = function(sql,args,callback) {
                var self = this;
                var sqlargs = args;
                var cback = callback;
                if (typeof cback == 'undefined' && sqlargs && Object.prototype.toString.call(sqlargs) != '[object Array]') {
                    cback = args;
                    sqlargs = null;
                }
                self.transaction(function(tx) {
                    tx.executeSql(sql,sqlargs,function(tx,result) {
                        var res = [];
                        for (var i = 0; i < result.rows.length; i++) {
                            res.push(result.rows.item(i));
                        }
                        if (cback) {
                            cback.call(db,null,res);
                        }
                    },function(tx,err) {
                        if (cback) {
                            cback.call(db,err);
                        }
                    });
                });
            };
        }
    }

    if (typeof idb != 'undefined') {
        var transaction_store_db;
        var transaction_find_latest;
        var transaction_data = [];
        begin_transaction = function(callback,trans) {
            if (transaction_store_db != null) {
                setTimeout(function() {
                    callback.call({ "transaction" : trans });
                },0);
                return false;
            }
            transaction_store_db = store_db_data;
            store_db_data = function(acc,service,data) {
                transaction_data.push([acc,service,data]);
            };
            setTimeout(function() {
                callback.call({ "transaction" : trans });
            },0);
            return true;
        };

        end_transaction = function(callback) {
            if (transaction_store_db === null) {
                callback(null);
                return;
            }
            store_db_data = transaction_store_db;
            transaction_store_db = null;
            var trans = idb.transaction(["cached"], "readwrite");
            var store = trans.objectStore("cached");
            trans.oncomplete = function(event) {
                callback(null);
            };
            trans.onerror = function(event) {
                callback(event.target.errorCode);
            };
            while (transaction_data.length > 0) {
                var row = transaction_data.shift();
                var acc = row[0];
                var service = row[1];
                var data = row[2];
                if (typeof data != 'object' || (((typeof Document) != 'undefined') && data instanceof Document)) {
                    continue;
                }
                var dateobj = data.retrieved ? data.retrieved : (new Date());
                if (typeof dateobj == 'string') {
                    dateobj = new Date(dateobj);
                }
                dateobj.setUTCHours(0);
                dateobj.setUTCMinutes(0);
                dateobj.setUTCSeconds(0);
                dateobj.setUTCMilliseconds(0);
                var reporter = insert_report_func(acc,service);
                var datetime = dateobj.getTime();
                data.id = [acc,service,datetime];
                data.acc = acc;
                data.service = service;
                if (window.msIndexedDB) {
                    data.serviceacc = service+acc;
                }
                data.retrieved = datetime;
                var req = store.put(data);
                req.onerror = reporter;
            }
        };

        var insert_report_func = function(acc,service) {
            return function(err,rows) {
                if ( ! err && rows) {
                }
            };
        };

        store_db_data = function(acc,service,data) {
            var trans = idb.transaction(["cached"], "readwrite");
            var store = trans.objectStore("cached");
            if (typeof data != 'object' || (((typeof Document) != 'undefined') && data instanceof Document)) {
                return;
            }
            var dateobj = data.retrieved ? data.retrieved : (new Date());
            if (typeof dateobj == 'string') {
                dateobj = new Date(dateobj);
            }
            dateobj.setUTCHours(0);
            dateobj.setUTCMinutes(0);
            dateobj.setUTCSeconds(0);
            dateobj.setUTCMilliseconds(0);
            var reporter = insert_report_func(acc,service);
            var datetime = dateobj.getTime();
            data.id = [acc,service,datetime];
            data.acc = acc;
            if (window.msIndexedDB) {
                data.serviceacc = service+acc;
            }
            data.service = service;
            data.retrieved = datetime;
            var req = store.put(data);
            // req.onsuccess = reporter;
            req.onerror = reporter;
        };

        get_db_data = function(acc,service,cback) {
            var timestamps = max_age ? [min_age,max_age] : [min_age, (new Date()).getTime()];
            return find_latest_data(acc,service,timestamps,cback);
        };

        find_latest_data = function(acc,service,timestamps,cback) {
            if ( ! acc ) {
                cback.call();
                return;
            }
            var trans = idb.transaction(["cached"],"readonly");
            var store = trans.objectStore("cached");
            var idx = store.index(window.msIndexedDB ? "entries-ms" : "entries");
            var max_stamp = -1;
            var result = null;
            var range = IDBKeyRange.only(window.msIndexedDB ? service+acc : [acc,service]);
            idx.openCursor(range).onsuccess = function(event) {
                var cursor = event.target.result;
                if (cursor) {
                    var ts = window.msIndexedDB ? cursor.value.retrieved : cursor.primaryKey[2];
                    var c_acc = window.msIndexedDB ? cursor.value.acc : cursor.primaryKey[0];
                    var serv = window.msIndexedDB ? cursor.value.service : cursor.primaryKey[1];
                    if (ts >= timestamps[0] && ts <= timestamps[1] ) {
                        if (ts > max_stamp && c_acc == acc && serv == service) {
                            result = cursor.value;
                            max_stamp = cursor.primaryKey.retrieved;
                            result.retrieved = new Date(cursor.primaryKey.retrieved);
                        }
                    }
                    cursor.continue();
                } else {
                    if (result) {
                        // result = result.data
                    }
                    cback.call(null,null,result);
                }
            };
        };

        sweep_cache = function(timestamp) {
            var trans = idb.transaction(["cached"],"readwrite");
            var store = trans.objectStore("cached");
            var idx = store.index("timestamps");
            var results = [];
            idx.openKeyCursor(null, "nextunique").onsuccess = function(event) {
                var cursor = event.target.result;
                if (cursor) {
                    if ( timestamp >= cursor.key[1] ) {
                        store.delete(cursor.primaryKey);
                    }
                    cursor.continue();
                }
            };
        };

        data_timestamps = function(service,timestamps,cback) {

            if (! timestamps || typeof timestamps != 'object' || ! timestamps.length ) {
                timestamps = [0,(new Date()).getTime()];
            }

            var trans = idb.transaction(["cached"],"readonly");
            var store = trans.objectStore("cached");
            var idx = store.index("timestamps");
            var results = [];
            idx.openKeyCursor(null, "nextunique").onsuccess = function(event) {
                var cursor = event.target.result;
                if (cursor) {
                    if (cursor.key[0] == service && timestamps[0] <= cursor.key[1] && timestamps[1] >= cursor.key[1] ) {
                        results.push(new Date(cursor.key[1]));
                    }
                    cursor.continue();
                } else {
                    cback.call(null,results);
                }
            };
        };

        clear_service = function(service,acc,callback) {
            var trans = idb.transaction(["cached"],"readwrite");
            var store = trans.objectStore("cached");
            var idx = store.index("services");
            var range = IDBKeyRange.only(service);
            idx.openCursor(range).onsuccess = function(event) {
                var cursor = event.target.result;
                if (cursor) {
                    if ((! acc || (cursor.value.acc == acc) )) {
                        if (window.msIndexedDB) {
                            store.delete(cursor.value.serviceacc);
                        } else {
                            store.delete(cursor.value.id ? cursor.value.id : cursor.primaryKey );
                        }
                    }
                    cursor.continue();
                }
            };
            trans.oncomplete = function() {
                callback.call(MASCP.Service);
            };
        };

        search_service = function(service,cback) {
            var trans = idb.transaction(["cached"],"readonly");
            var store = trans.objectStore("cached");
            var idx = store.index("services");
            var results = [];
            var range = IDBKeyRange.only(service);
            idx.openKeyCursor(range, "nextunique").onsuccess = function(event) {
                var cursor = event.target.result;
                if (cursor) {
                    results.push(cursor.key);
                    cursor.continue();
                } else {
                    cback.call(MASCP.Service,results);
                }
            };
        };
        first_accession = function(service,cback) {
            var trans = idb.transaction(["cached"],"readonly");
            var store = trans.objectStore("cached");
            var idx = store.index("services");
            var range = IDBKeyRange.only(service);
            idx.openCursor(range,"nextunique").onsuccess = function(event) {
                var cursor = event.target.result;
                if (cursor) {
                    cback.call(MASCP.Service,cursor.value.acc);
                } else {
                    cback.call(MASCP.Service,null);
                }
            };
        };
        cached_accessions = function(service,cback) {
            var trans = idb.transaction(["cached"],"readonly");
            var store = trans.objectStore("cached");
            var idx = store.index("services");
            var results = [];
            var range = IDBKeyRange.only(service);
            idx.openCursor(range).onsuccess = function(event) {
                var cursor = event.target.result;
                if (cursor) {
                    results.push(cursor.value.acc);
                    cursor.continue();
                } else {
                    cback.call(MASCP.Service,results);
                }
            };
        };
    } else if (typeof db != 'undefined') {

        db.all('SELECT version from versions where tablename = "datacache"',function(err,rows) { 
            var version = (rows && rows.length > 0) ? rows[0].version : null;
            if (version == 1.3) {
                if (MASCP.events) {
                    MASCP.events.emit('ready');            
                }
                if (MASCP.ready) {
                    MASCP.ready();
                    MASCP.ready = true;
                } else {
                    MASCP.ready = true;
                }
                return;                
            }
            
            if (! version || version == "" || version < 1.0 ) {
                db.exec('CREATE TABLE if not exists versions (version REAL, tablename TEXT);');
                db.exec('CREATE TABLE if not exists "datacache" (agi TEXT,service TEXT,retrieved REAL,data TEXT);',function(err) { if (err && err != "Error: not an error") { throw err; } });
                db.exec('DELETE FROM versions where tablename = "datacache"');
                db.exec('INSERT INTO versions(version,tablename) VALUES(1.1,"datacache");',function(err,rows) {
                    if ( ! err ) {
//                        console.log("Upgrade to 1.1 completed");
                    }
                });
                version = 1.1;
            }
            if (version < 1.2) {
                db.exec('DROP TABLE if exists datacache_tmp;');
                db.exec('CREATE TABLE if not exists datacache_tmp (acc TEXT,service TEXT,retrieved REAL,data TEXT);');
                db.exec('INSERT INTO datacache_tmp(acc,service,retrieved,data) SELECT agi,service,retrieved,data FROM datacache;');
                db.exec('DROP TABLE datacache;');
                db.exec('ALTER TABLE datacache_tmp RENAME TO datacache;');
                db.exec('CREATE INDEX accessions on datacache(acc);');
                db.exec('CREATE INDEX accessions_service on datacache(acc,service);');
                db.exec('DELETE FROM versions where tablename = "datacache"');
                db.exec('INSERT INTO versions(version,tablename) VALUES(1.2,"datacache");',function(err,rows) {
                    if ( ! err ) {
//                          console.log("Upgrade to 1.2 completed");
                    }
                });
                version = 1.2;
            }
            if (version < 1.3) {
                db.exec('CREATE INDEX if not exists services on datacache(service);');
                db.exec('DELETE FROM versions where tablename = "datacache"');
                db.exec('INSERT INTO versions(version,tablename) VALUES(1.3,"datacache");',function(err,rows) {
                    if ( ! err ) {
                        if (MASCP.events) {
                            MASCP.events.emit('ready');            
                        }
                        if (MASCP.ready) {
                            MASCP.ready();
                            MASCP.ready = true;
                        } else {
                            MASCP.ready  = true;
                        }
                    }
                });
                version = 1.3;                
            }
        });
        if (typeof module != 'undefined' && module.exports) {
            var old_get_db_data = null;

            begin_transaction = function(callback,trans) {
                if (old_get_db_data !== null) {
                    callback.call({ "transaction" : trans });
                    return false;
                }
                db.exec("PRAGMA synchronous=OFF; PRAGMA journal_mode=OFF;",function(err) {
                    if ( err ) {
                        callback.call(null,err);
                        return;
                    }
                    old_get_db_data = get_db_data;

                    get_db_data = function(id,clazz,cback) {
                         setTimeout(function() {
                             cback.call(null,null);
                         },0);
                    };
                    callback.call({ "transaction" : trans });
                });
                return true;
            };

            end_transaction = function(callback) {
                if (old_get_db_data === null) {
                    callback();
                    return;
                }
                db.exec("PRAGMA synchronous=FULL; PRAGMA journal_mode=DELETE;",function(err) {
                    get_db_data = old_get_db_data;
                    old_get_db_data = null;
                    callback(err);
                });
            };
        } else {
            begin_transaction = function(callback,trans) {
                callback.call({ "transaction" : trans });
            };
            end_transaction = function(callback) {
                callback();
            };
        }

        sweep_cache = function(timestamp) {
            db.all("DELETE from datacache where retrieved <= ? ",[timestamp],function() {});
        };
        
        clear_service = function(service,acc,callback) {
            var servicename = service;
            servicename += "%";
            if ( ! acc ) {
                db.all("DELETE from datacache where service like ? ",[servicename],function() { callback.call(MASCP.Service); });
            } else {
                db.all("DELETE from datacache where service like ? and acc = ?",[servicename,acc.toLowerCase()],function() { callback.call(MASCP.Service); });
            }
            
        };
        
        search_service = function(service,cback) {
            db.all("SELECT distinct service from datacache where service like ? ",[service+"%"],function(err,records) {
                var results = {};
                if (records && records.length > 0) {
                    records.forEach(function(record) {
                        results[record.service] = true;
                    });
                }
                var uniques = [];
                for (var k in results) {
                    if (results.hasOwnProperty(k)) {                    
                        uniques.push(k);
                    }
                }
                cback.call(MASCP.Service,uniques);
                return uniques;
            });
        };

        first_accession = function(service,cback) {
            db.all("SELECT distinct acc from datacache where service = ? limit 1",[service],function(err,records) {
                if (! records || records.length < 1) {
                    cback.call(MASCP.Service,null);
                } else {
                    cback.call(MASCP.Service,records[0].acc);
                }
            });
        };

        
        cached_accessions = function(service,cback) {
            db.all("SELECT distinct acc from datacache where service = ?",[service],function(err,records) {
                var results = [];
                for (var i = 0; i < records.length; i++ ){
                    results.push(records[i].acc);
                }
                cback.call(MASCP.Service,results);
            });
        };
        
        get_snapshot = function(service,timestamps,wanted,cback) {
            if (! timestamps || typeof timestamps != 'object' || ! timestamps.length ) {
                timestamps = [0,(new Date()).getTime()];
            }
            var sql;
            var args = [service,timestamps[0],timestamps[1]];
            if (wanted && Array.isArray(wanted)) {
                var question_marks = (new Array(wanted.length+1).join(',?')).substring(1);
                args = args.concat(wanted);
                sql = "SELECT * from datacache where service = ? AND retrieved >= ? AND retrieved <= ? AND acc in ("+question_marks+") ORDER BY retrieved ASC";
            } else {
                if (wanted && /^\d+$/.test(wanted.toString())) {
                    sql = "SELECT * from datacache where service = ? AND retrieved >= ? AND retrieved <= ? LIMIT ? ORDER BY retrieved ASC";
                    args = args.concat(parseInt(wanted.toString()));
                } else {
                    sql = "SELECT * from datacache where service = ? AND retrieved >= ? AND retrieved <= ? ORDER BY retrieved ASC";
                }
            }
            db.all(sql,args,function(err,records) {
                records = records || [];
                var results = {};
                records.forEach(function(record) {
                    var data = typeof record.data === 'string' ? JSON.parse(record.data) : record.data;
                    if (data) {
                        data.retrieved = new Date(record.retrieved);
                    }
                    if (results[record.acc] && results[record.acc].retrieved > record.retrieved) {
                        return;
                    }
                    results[record.acc] = record;
                });
                cback.call(null,null,results);
            });
        };

        get_db_data = function(acc,service,cback) {
            var timestamps = max_age ? [min_age,max_age] : [min_age, (new Date()).getTime()];
            return find_latest_data(acc,service,timestamps,cback);
        };

        var insert_report_func = function(acc,service) {
            return function(err,rows) {
                if ( ! err && rows) {
//                    console.log("Caching result for "+acc+" in "+service);
                }
            };
        };

        store_db_data = function(acc,service,data) {
            if (typeof data != 'object' || (((typeof Document) != 'undefined') && data instanceof Document)) {
                return;
            }
            var str_rep;
            try {
                str_rep = JSON.stringify(data);
            } catch (err) {
                return;
            }
            var dateobj = data.retrieved ? data.retrieved : (new Date());
            if (typeof dateobj == 'string') {
                dateobj = new Date();
            }
            dateobj.setUTCHours(0);
            dateobj.setUTCMinutes(0);
            dateobj.setUTCSeconds(0);
            dateobj.setUTCMilliseconds(0);
            var datetime = dateobj.getTime();
            data = {};
            db.all("INSERT INTO datacache(acc,service,retrieved,data) VALUES(?,?,?,?)",[acc,service,datetime,str_rep],insert_report_func(acc,service));
        };

        find_latest_data = function(acc,service,timestamps,cback) {
            var sql = "SELECT * from datacache where acc=? and service=? and retrieved >= ? and retrieved <= ? ORDER BY retrieved DESC LIMIT 1";
            var args = [acc,service,timestamps[0],timestamps[1]];            
            db.all(sql,args,function(err,records) {
                if (records && records.length > 0 && typeof records[0] != "undefined") {
                    var data = typeof records[0].data === 'string' ? JSON.parse(records[0].data) : records[0].data;
                    if (data) {
                        data.retrieved = new Date(records[0].retrieved);
                    }
                    cback.call(null,null,data);
                } else {
                    cback.call(null,null,null);
                }
            });
        };
        
        data_timestamps = function(service,timestamps,cback) {
            if (! timestamps || typeof timestamps != 'object' || ! timestamps.length ) {
                timestamps = [0,(new Date()).getTime()];
            }
            var sql = "SELECT distinct retrieved from datacache where service=? and retrieved >= ? and retrieved <= ? ORDER BY retrieved ASC";
            var args = [service,timestamps[0],timestamps[1]];
            db.all(sql,args,function(err,records) {
                var result = [];
                if (records && records.length > 0 && typeof records[0] != "undefined") {
                    for (var i = records.length - 1; i >= 0; i--) {
                        result.push(new Date(records[i].retrieved));
                    }
                }
                cback.call(null,result);
            });            
        };
        
    } else if ("localStorage" in window) {

        sweep_cache = function(timestamp) {
            if ("localStorage" in window) {
                var keys = [];
                for (var i = 0, len = localStorage.length; i < len; i++) {
                    keys.push(localStorage.key(i));
                }
                var key = keys.shift();
                while (key) {
                    if (new RegExp("^MASCP.*").test(key)) {
                        var data = localStorage[key];
                        if (data && typeof data === 'string') {
                            var datablock = JSON.parse(data);
                            datablock.retrieved = timestamp;
                            localStorage.removeItem(key);
                        }
                    }
                    key = keys.shift();
                }
            }
        };
        
        clear_service = function(service,acc,callback) {
            if ("localStorage" in window) {
                var keys = [];
                for (var i = 0, len = localStorage.length; i < len; i++) {
                    keys.push(localStorage.key(i));
                }
                var key = keys.shift();
                while (key) {
                    if ((new RegExp("^"+service+".*"+(acc?"#"+acc.toLowerCase()+"$" : ""))).test(key)) {
                        localStorage.removeItem(key);
                        if (acc) {
                            return;
                        }
                    }
                    key = keys.shift();
                }
                callback.call(MASCP.Service);
            }            
        };
        
        search_service = function(service,cback) {
            var results = {};
            if ("localStorage" in window) {
                var key;
                var re = new RegExp("^"+service+".*");
                for (var i = 0, len = localStorage.length; i < len; i++){
                    key = localStorage.key(i);
                    if (re.test(key)) {                        
                        results[key.replace(/\.#.*$/g,'')] = true;
                    }
                }
            }

            var uniques = [];
            for (var k in results) {
                if (results.hasOwnProperty(k)) {
                    uniques.push(k);
                }
            }

            cback.call(clazz,uniques);

            return uniques;
        };

        first_accession = function(service,cback) {
            if ("localStorage" in window) {
                var key;
                var re = new RegExp("^"+service);
                for (var i = 0, len = localStorage.length; i < len; i++){
                    key = localStorage.key(i);
                    if (re.test(key)) {
                        key = key.replace(service,'');
                        cback.call(clazz,key);
                        return;
                    }
                }
            }
            cback.call(clazz,null);
        };

        cached_accessions = function(service,cback) {
            if ("localStorage" in window) {
                var key;
                var re = new RegExp("^"+service);
                for (var i = 0, len = localStorage.length; i < len; i++){
                    key = localStorage.key(i);
                    if (re.test(key)) {
                        key = key.replace(service,'');
                        results[key] = true;
                    }
                }
            }

            var uniques = [];
            for (var k in results) {
                if (results.hasOwnProperty(k)) {
                    uniques.push(k);
                }
            }

            cback.call(clazz,uniques);
        };

        get_db_data = function(acc,service,cback) {
            var data = localStorage[service.toString()+".#"+(acc || '').toLowerCase()];
            if (data && typeof data === 'string') {
                var datablock = JSON.parse(data);
                datablock.retrieved = new Date(datablock.retrieved);
                cback.call(null,null,datablock);
            } else {
                cback.call(null,null,null);
            }
            
        };
        
        store_db_data = function(acc,service,data) {
            if (data && (typeof data !== 'object' || data instanceof Document || data.nodeName)){
                return;
            }
            data.retrieved = (new Date()).getTime();
            localStorage[service.toString()+".#"+(acc || '').toLowerCase()] = JSON.stringify(data);
        };

        find_latest_data = function(acc,service,timestamp,cback) {
            // We don't actually retrieve historical data for this
            return get_db_data(acc,service,cback);
        };

        data_timestamps = function(service,timestamp,cback) {
            cback.call(null,[]);
        };
        
        begin_transaction = function(callback) {
            // No support for transactions here. Do nothing.
            setTimeout(function() {
                callback.call();
            },0);
        };
        end_transaction = function(callback) {
            // No support for transactions here. Do nothing.
            setTimeout(function(){
                callback();
            },0);
        };

        if (MASCP.events) {
            MASCP.events.emit('ready');
        }
        setTimeout(function() {
            if (MASCP.ready) {
                MASCP.ready();
                MASCP.ready = true;
            } else {
                MASCP.ready = true;
            }
        },100);


    } else {

        sweep_cache = function(timestamp) {
        };
        
        clear_service = function(service,acc) {
        };
        
        search_service = function(service,cback) {
        };

        cached_accessions = function(service,cback) {
            cback.call(clazz,[]);
        };

        get_db_data = function(acc,service,cback) {
            cback.call(null,null,null);
        };
        
        store_db_data = function(acc,service,data) {
        };

        find_latest_data = function(acc,service,timestamp,cback) {
            // We don't actually retrieve historical data for this
            cback.call(null,[]);
        };

        data_timestamps = function(service,timestamp,cback) {
            cback.call(null,[]);
        };
        
        begin_transaction = function(callback) {
            // No support for transactions here. Do nothing.
            setTimeout(function(){
                callback();
            },0);
        };
        end_transaction = function(callback) {
            // No support for transactions here. Do nothing.
            setTimeout(function(){
                callback();
            },0);
        };
    }
    
    
    

})(MASCP.Service);

/**
 * Set the async parameter for this service.
 * @param {Boolean} asyncFlag   Asynchronous flag - true for asynchronous action, false for asynchronous
 * @returns Reference to self
 * @type MASCP.Service.prototype
 */
MASCP.Service.prototype.setAsync = function(asyncFlag)
{
    this.async = asyncFlag;
    return this;
};

/**
 *  Get the parameters that will be used to build this request. Implementations of services will
 *  override this method, returning the parameters to be used to build the XHR.
 */

MASCP.Service.prototype.requestData = function()
{
    
};

MASCP.Service.prototype.toString = function()
{
    for (var clazz in MASCP) {
        if (this.__class__ == MASCP[clazz]) {
            return "MASCP."+clazz;
        }
    }
};

/**
 * For this service, register a sequence rendering view so that the results can be marked up directly
 * on to a sequence. This method will do nothing if the service does not know how to render the 
 * results onto the sequence.
 * @param {MASCP.SequenceRenderer} sequenceRenderer Sequence renderer object to render results upon
 */
MASCP.Service.prototype.registerSequenceRenderer = function(sequenceRenderer,options)
{
    if (this.setupSequenceRenderer) {
        this.renderers = this.renderers || [];
        this.setupSequenceRenderer(sequenceRenderer,options);
        this.renderers.push(sequenceRenderer);
    }
    sequenceRenderer.trigger('readerRegistered',[this]);
    return this;
};

/**
 * For this service, set up a sequence renderer so that the events are connected up with receiving data.
 * This method should be overridden to wire up the sequence renderer to the service.
 * @param {MASCP.SequenceRenderer} sequenceRenderer Sequence renderer object to render results upon
 */
MASCP.Service.prototype.setupSequenceRenderer = function(sequenceRenderer)
{
    return this;
};


/**
 *  Move a node from an externally retrieved document into this current document.
 *  @static
 *  @param  {Node}  externalNode    Node from XHR data source that is to be imported into the current document.
 */
MASCP.Service.importNode = function(external_node)
{
    if (typeof document == 'undefined') {
        return external_node;
    }
    var new_data;    
    if (typeof external_node == 'string') {
        new_data = document.createElement('div');
        new_data.innerHTML = external_node;
        return new_data.firstChild;        
    }
    
    if ( document.importNode ) {
        return document.importNode(external_node,true);
    } else {
        new_data = document.createElement('div');
        new_data.innerHTML = external_node.xml;
        return new_data.firstChild;
    }    
};

/** Default constructor
 *  @class  Super-class for all results from MASCP services.
 */
MASCP.Service.Result = function()
{  
};

MASCP.Service.Result.prototype = {
    agi     :   null,
    reader  :   null
};


MASCP.Service.Result.prototype.render = function() {
};
/**
 * @fileOverview    Classes for reading data from TAIR database
 */

if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}



/** Default class constructor
 *  @class      Service class that will retrieve sequence data for a given AGI from a given ecotype
 *  @param      {String} agi            Agi to look up
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.AccessionReader = MASCP.buildService(function(data) {
                        this._data = data || { 'data' : ['',''] };
                        return this;
                    });

MASCP.AccessionReader.SERVICE_URL = 'http://gator.masc-proteomics.org/tair.pl';

MASCP.AccessionReader.prototype.requestData = function()
{
    var self = this;
    return {
        type: "GET",
        dataType: "json",
        data: { 'agi'   : this.agi,
                'accession' : this.accession,
                'service' : 'tair' 
        }
    };
};

MASCP.AccessionReader.Result.prototype.getDeletions = function() {
    /* This doesn't work any more */
    return [];
    /*
    var old_sequence = this.reader.reference;

    var new_sequence = this.getSequence();

    var diffs = (new diff_match_patch()).diff_main(old_sequence,new_sequence);
    var deletions = [];
    var last_index = 1;
    for (var i = 0; i < diffs.length; i++ ){
        if (i > 0 && diffs[i-1][0] <= 0) {
            last_index += diffs[i-1][1].length;
        }
        if (diffs[i][0] == -1) {
            deletions.push(last_index);
            var length = diffs[i][1].length - 1;
            while (length > 0) {
                deletions.push(last_index + length);
                length -= 1;
            }
        }
    }
    return deletions;
    */
};

MASCP.AccessionReader.prototype.setupSequenceRenderer = function(renderer) {
    var reader = this;
    this.bind('resultReceived', function() {

        var accessions = reader.accession.split(',');
        
        
        var an_accession = accessions.shift();
        var a_result = reader.result.length ? reader.result.shift() : reader.result;

        MASCP.registerGroup('all_insertions');
        MASCP.registerGroup('all_deletions');
        renderer.registerLayer('insertions',{'fullname' : 'Accession','color' : '#ff0000'});

        if (renderer.createGroupController) {
            renderer.createGroupController('insertions','all_insertions');
        }
        console.log(a_result);
        
        while(a_result) {
            var old_sequence = renderer.sequence;
            var new_sequence = a_result.getSequence();

            var diffs = (new diff_match_patch()).diff_main(old_sequence,new_sequence);
            var last_index = 1;
            var ins = [];
            var outs = [];

            if (diffs.length <= 1) {
                a_result = reader.result.length ? reader.result.shift() : null;
                an_accession = accessions.shift();
                continue;
            }


            var in_layer = 'all_'+an_accession;

            renderer.registerLayer(in_layer, {'fullname' : an_accession, 'group' : 'all_insertions' });

            var i;
            for (i = diffs.length - 1; i >= 0; i-- ){
                if (i > 0 && diffs[i-1][0] <= 0) {
                    last_index += diffs[i-1][1].length;
                    if (last_index > renderer.sequence.length) {
                        last_index = renderer.sequence.length;
                    }
                }
                if (diffs[i][0] == -1) {
                    outs.push( { 'index' : last_index, 'delta' : diffs[i][1] });
                }
                if (diffs[i][0] == 1) {
                    ins.push( { 'insertBefore' : last_index, 'delta' : diffs[i][1] });
                }
            }
            for (i = ins.length - 1; i >= 0; i-- ) {
                renderer.getAA(ins[i].insertBefore - 1).addAnnotation(in_layer,1, { 'border' : 'rgb(150,0,0)', 'content' : ins[i].delta });
                renderer.getAA(ins[i].insertBefore - 1).addAnnotation('insertions',1, { 'border' : 'rgb(150,0,0)', 'content' : ins[i].delta });
            }
        
            for (i = outs.length - 1; i >= 0; i--) {
                renderer.getAA(outs[i].index).addAnnotation(in_layer,1, {'angle' : 90, 'border' : 'rgb(0,0,150)', 'content' : outs[i].delta });
                renderer.getAA(outs[i].index).addAnnotation('insertions',1, {'angle' : 90, 'border' : 'rgb(0,0,150)', 'content' : outs[i].delta });
            }
            
            a_result = reader.result.length ? reader.result.shift() : null;
            an_accession = accessions.shift();            
        }
        
    });
};

MASCP.AccessionReader.Result.prototype.getDescription = function() {
    return this._data.data[1];
};

MASCP.AccessionReader.Result.prototype.getSequence = function() {    
    return (typeof(this._data) == 'object' && this._data.length) ? this._data[0].data[2] : this._data.data[2];
};

/** @fileOverview   Classes for reading data from the ArbitraryData database
 */
if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

/** Default class constructor
 *  @class      Service class that will retrieve data from ArbitraryData for a given AGI.
 *  @param      {String} agi            Agi to look up
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.ArbitraryDataReader = MASCP.buildService(function(data) {
                        this._raw_data = data;
                        return this;
                    });

MASCP.ArbitraryDataReader.SERVICE_URL = 'http://gator.masc-proteomics.org/datasets.pl?';

MASCP.ArbitraryDataReader.prototype.requestData = function()
{
    var agi = this.agi;
    var dataset = this._dataset();
    if (dataset) {
        return {
            type: "GET",
            dataType: "json",
            data: { 'agi'       : agi,
                    'dataset'   : dataset,
                    'service'   : 'ArbitraryData' 
            }
        };
    } else {
        return {
            type: "GET",
            dataType: "json",
            data: {'service' : 'ArbitraryData'}
        };
    }
};

MASCP.ArbitraryDataReader.prototype._extend = function(setName)
{
    if (this === null || typeof(this) != 'object' || typeof(setName) === 'undefined' || ! setName ) {
        return this;
    }

    var temp = new MASCP.ArbitraryDataReader(); // changed

    temp._endpointURL = this._endpointURL;
    temp.agi = this.agi;
    
    temp.toString = function() {
        var curr_name = MASCP.Service.prototype.toString.call(temp);
        return curr_name+"."+setName;
    };
    
    temp._dataset = function() {
        return setName;
    };
    temp.layer = function() {
        return "arbitrary_"+setName;
    };
    
    return temp;
};

MASCP.ArbitraryDataReader.prototype._dataset = function()
{
    return null;
};

MASCP.ArbitraryDataReader.prototype.retrieve = function(in_agi,cback)
{
    var self = this;
    var agi = this.agi || in_agi;
    
    
    if (agi && this._dataset()) {
        MASCP.Service.prototype.retrieve.call(self,in_agi,cback);
        return;        
    }
    
    // If we are just doing a call, defer the rest of the retrieve
    // until the server datasets are loaded.
    
    if ((! this._SERVER_DATASETS) && agi && agi != "dummy") {
        var read = new MASCP.ArbitraryDataReader("",self._endpointURL);
        read.retrieve("dummy",function() {
            if (this.result) {
                self._SERVER_DATASETS = this.result._raw_data.data;
            } else {
                self._SERVER_DATASETS = [];
            }
            self.retrieve(in_agi,cback);
        });
        return;
    }
    
    // Populate the server datasets if there is no accession given and
    // we don't have the server datasets retrieved already for this object
    
    if ( ! this._SERVER_DATASETS ) {
        MASCP.Service.FindCachedService(self.toString(),function(services) {
            // If we're on the server side, we should have the list
            // of services cached.
            if (services.length >= 0) {
                var datasets = [];
                services.forEach(function(service) {
                    datasets.push(service.replace(self.toString()+".",""))
                });
                self._SERVER_DATASETS = datasets;
                self.result = {};
                self.result._raw_data = { 'data' : datasets };
            }
            
            //If we are requesting from a remote source, remove the current
            //cached results
            if (self._endpointURL && self._endpointURL.length) {
                MASCP.Service.ClearCache(self);
            }
            //Make the request to the server to get the datasets
            //Put a dummy agi in so that the callback is called if
            //this is being run on a server with no datasets.
            //This will trigger the execution of the callback.
            MASCP.Service.prototype.retrieve.call(self,"dummy",cback);
        });
        return;
    }
    if (this._SERVER_DATASETS.length == 0){
        MASCP.Service.prototype.retrieve.call(self,"dummy",cback);
        (self.renderers || []).forEach(function(rrend) {
            rrend.trigger('resultsRendered',[self]);
        });
        return;
    }
    this._SERVER_DATASETS.forEach(function(set) {
        var reader = self._extend(set);
        (self.renderers || []).forEach(function(rrend) {
            reader.setupSequenceRenderer(rrend);
            rrend.bind('resultsRendered',function(rdr) {
                if (rdr == reader) {
                    rrend.trigger('resultsRendered',[self]);
                }
            });
        });
        reader.bind('resultReceived',function() {
            self.gotResult();
        })
        reader.bind('requestComplete',function() {
            self.requestComplete();
        });
        reader.retrieve(agi,cback);
    });
};

/**
 *  @class   Container class for results from the ArbitraryData service
 *  @extends MASCP.Service.Result
 */
// We need this line for the JsDoc to pick up this class
MASCP.ArbitraryDataReader.Result = MASCP.ArbitraryDataReader.Result;

/** Retrieve the peptides for this particular entry from the ArbitraryData service
 *  @returns Array of peptide strings
 *  @type [String]
 */
MASCP.ArbitraryDataReader.Result.prototype.getPeptides = function()
{
    var content = null;

    if (this._peptides) {
        return this._peptides;
    }

    if (! this._raw_data || ! this._raw_data.data ) {
        return [];
    }

    return this._raw_data.data;
};

MASCP.ArbitraryDataReader.prototype.setupSequenceRenderer = function(sequenceRenderer)
{
    var reader = this;


    if (! this._dataset()) {
        return;
    }

    var css_block = '.active .overlay { background: #ff5533; } .active a { color: #000000; text-decoration: none !important; }  :indeterminate { background: #ff0000; } .tracks .active { background: #0000ff; } .inactive a { text-decoration: none; } .inactive { display: none; }';


    this.bind('resultReceived', function() {
                
        var peps = this.result.getPeptides();
        if (peps.length <= 0) {
            sequenceRenderer.trigger('resultsRendered',[reader]);
            return;
        }
        MASCP.registerGroup('arbitrary_datasets', {'fullname' : 'Other data', 'color' : '#ff5533' });
        MASCP.registerLayer('arbitrary_controller',{ 'fullname' : 'Other data', 'color' : '#ff5533', 'css' : css_block });

        var overlay_name = this.layer();
        MASCP.registerLayer(overlay_name,{ 'group' : 'arbitrary_datasets', 'fullname' : this._dataset(), 'color' : this.result._raw_data.color || '#ff5533', 'css' : css_block });
        
        if (this.result._raw_data.url) {
            MASCP.getLayer(overlay_name).href = this.result._raw_data.url;
        }
        
        for(var i = 0; i < peps.length; i++) {
            var peptide = peps[i], peptide_bits;
            if (typeof peptide == 'string') {
                peptide_bits = sequenceRenderer.getAminoAcidsByPeptide(peptide);                
                peptide_bits.addToLayer(overlay_name);
            } else if (peptide.length == 2) {
                sequenceRenderer.getAA(peptide[0]).addBoxOverlay(overlay_name,peptide[1]-peptide[0]);
            }
        }
        
        if (sequenceRenderer.createGroupController) {
            sequenceRenderer.createGroupController('arbitrary_controller','arbitrary_datasets');
        }
        
        sequenceRenderer.trigger('resultsRendered',[reader]);
    });
    return this;
};

MASCP.ArbitraryDataReader.Result.prototype.render = function()
{
};/** @fileOverview   Classes for reading data from the AtChloro database
 */
if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

/** Default class constructor
 *  @class      Service class that will retrieve data from AtChloro for a given AGI.
 *  @param      {String} agi            Agi to look up
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.AtChloroReader = MASCP.buildService(function(data) {
                        this._raw_data = data;                        
                        return this;
                    });

MASCP.AtChloroReader.SERVICE_URL = 'http://prabi2.inrialpes.fr/at_chloro/annotation/';

MASCP.AtChloroReader.prototype.requestData = function()
{
    var agi = this.agi;
    
    return {
        type: "GET",
        url: this._endpointURL + agi.toUpperCase(),
        dataType: "json",
        data: { 'agi'       : agi.toUpperCase(),
                'service'   : 'atchloro' 
        }
    };
};


/**
 *  @class   Container class for results from the AtChloro service
 *  @extends MASCP.Service.Result
 */
// We need this line for the JsDoc to pick up this class
MASCP.AtChloroReader.Result = MASCP.AtChloroReader.Result;

/** Retrieve the peptides for this particular entry from the AtChloro service
 *  @returns Array of peptide strings
 *  @type [String]
 */
MASCP.AtChloroReader.Result.prototype.getPeptides = function()
{
    var content = null;

    if (this._peptides) {
        return this._peptides;
    }

    this._long_name_map = {};
    
    if (! this._raw_data || ! this._raw_data.peptides ) {
        return [];
    }

        
    var peptides = [];
    
    for (var i = 0; i < this._raw_data.peptides.length; i++ ) {
        var a_peptide = this._raw_data.peptides[i];
        var the_pep = { 'sequence' : this._cleanSequence(a_peptide.sequence) };
        peptides.push(the_pep);
    }
    this._peptides = peptides;
    return peptides;
};

MASCP.AtChloroReader.Result.prototype._cleanSequence = function(sequence)
{
    return sequence.replace(/[^A-Z]/g,'');
};

MASCP.AtChloroReader.prototype.setupSequenceRenderer = function(sequenceRenderer)
{
    var reader = this;

    var css_block = '.active .overlay { background: #55ff33; } .active a { color: #000000; text-decoration: none !important; }  :indeterminate { background: #ff0000; } .tracks .active { background: #0000ff; } .inactive a { text-decoration: none; } .inactive { display: none; }';
    

    this.bind('resultReceived', function() {
        var peps = this.result.getPeptides();
        if (peps.length > 0) {
            MASCP.registerLayer('atchloro_experimental',{ 'fullname' : 'AT_CHLORO MS/MS', 'color' : '#55ff33', 'css' : css_block });
            MASCP.getLayer('atchloro_experimental').href = 'http://prabi2.inrialpes.fr/at_chloro/protein/'+reader.agi.toUpperCase();
        }
        for(var i = 0; i < peps.length; i++) {
            var peptide = peps[i].sequence;
            var peptide_bits = sequenceRenderer.getAminoAcidsByPeptide(peptide);
            peptide_bits.addToLayer('atchloro_experimental');
        }
        sequenceRenderer.trigger('resultsRendered',[reader]);
    });
    return this;
};

MASCP.AtChloroReader.Result.prototype.render = function()
{
};/** @fileOverview   Classes for reading data from the AtPeptide database
 */
if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

/** Default class constructor
 *  @class      Service class that will retrieve data from AtPeptide for a given AGI.
 *  @param      {String} agi            Agi to look up
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.AtPeptideReader = MASCP.buildService(function(data) {
                        this._raw_data = data;                        
                        return this;
                    });

MASCP.AtPeptideReader.SERVICE_URL = 'http://gator.masc-proteomics.org/atpeptide.pl?';

MASCP.AtPeptideReader.prototype.requestData = function()
{
    var agi = this.agi;
    
    return {
        type: "GET",
        dataType: "json",
        data: { 'agi'       : agi,
                'service'   : 'atpeptide' 
        }
    };
};

/**
 * The list of tissue names that are used by AtPeptide for this particular AGI
 *  @returns {[String]} Tissue names
 */
MASCP.AtPeptideReader.Result.prototype.tissues = function()
{
    return this._tissues;
};

/**
 *  @class   Container class for results from the AtPeptide service
 *  @extends MASCP.Service.Result
 */
// We need this line for the JsDoc to pick up this class
MASCP.AtPeptideReader.Result = MASCP.AtPeptideReader.Result;

/** Retrieve the peptides for this particular entry from the AtPeptide service
 *  @returns Array of peptide strings
 *  @type [String]
 */
MASCP.AtPeptideReader.Result.prototype.getPeptides = function()
{
    var content = null;

    if (this._peptides) {
        return this._peptides;
    }

    this._tissues = [];
    this.spectra = {};
    this._long_name_map = {};
    
    if (! this._raw_data || ! this._raw_data.peptides ) {
        return [];
    }

        
    var peptides = [];
    var toString = function() {
        return this.sequence;
    };
    
    for (var i = this._raw_data.peptides.length - 1; i >= 0; i-- ) {
        var a_peptide = this._raw_data.peptides[i];
        var the_pep = { 'sequence' : this._cleanSequence(a_peptide.sequence), 'tissues' : [] };
        the_pep.toString = toString;
        peptides.push(the_pep);
        for (var j = a_peptide.tissues.length - 1; j >= 0 ; j-- ) {
            var a_tissue = a_peptide.tissues[j];
            if ( this._tissues.indexOf(a_tissue['PO:tissue']) < 0 ) {
                var some_tiss = a_tissue['PO:tissue'];
                this._tissues.push(some_tiss);
                some_tiss.long_name = a_tissue.tissue;
                this._long_name_map[some_tiss] = a_tissue.tissue;
            }
            the_pep.tissues.push(a_tissue['PO:tissue']);
            if ( ! this.spectra[a_tissue['PO:tissue']]) {
                this.spectra[a_tissue['PO:tissue']] = 0;
            }
            this.spectra[a_tissue['PO:tissue']] += 1;
        }

    }
    this._peptides = peptides;
    return peptides;
};

MASCP.AtPeptideReader.Result.prototype._cleanSequence = function(sequence)
{
    return sequence.replace(/[^A-Z]/g,'');
};

MASCP.AtPeptideReader.prototype.setupSequenceRenderer = function(sequenceRenderer)
{
    var reader = this;

    this.bind('resultReceived', function() {

        MASCP.registerGroup('atpeptide_experimental', {'fullname' : 'AtPeptide MS/MS', 'hide_member_controllers' : true, 'hide_group_controller' : true, 'color' : '#ff5533' });

        var overlay_name = 'atpeptide_controller';

        var css_block = '.active .overlay { background: #ff5533; } .active a { color: #000000; text-decoration: none !important; }  :indeterminate { background: #ff0000; } .tracks .active { background: #0000ff; } .inactive a { text-decoration: none; } .inactive { display: none; }';

        MASCP.registerLayer(overlay_name,{ 'fullname' : 'AtPeptide MS/MS', 'color' : '#ff5533', 'css' : css_block });

        if (sequenceRenderer.createGroupController) {
            sequenceRenderer.createGroupController('atpeptide_controller','atpeptide_experimental');
        }
                
        var peps = this.result.getPeptides();
        for (var j = 0; j < this.result.tissues().length; j++ ) {
            var a_tissue = this.result.tissues()[j];
            MASCP.registerLayer('atpeptide_peptide_'+a_tissue, { 'fullname': this.result._long_name_map[a_tissue], 'group' : 'atpeptide_experimental', 'color' : '#ff5533', 'css' : css_block });
            for(var i = 0; i < peps.length; i++) {
                var peptide = peps[i].sequence;
                if ( peps[i].tissues.indexOf(a_tissue+'') < 0 ) {
                    continue;
                }
                var peptide_bits = sequenceRenderer.getAminoAcidsByPeptide(peptide);
                var layer_name = 'atpeptide_peptide_'+a_tissue;
                peptide_bits.addToLayer(layer_name);
                peptide_bits.addToLayer(overlay_name);
            }
        }
        sequenceRenderer.trigger('resultsRendered',[reader]);
    });
    return this;
};

MASCP.AtPeptideReader.Result.prototype.render = function()
{
};/** @fileOverview   Classes for reading data from the Cdd tool
 */
if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

/* We don't need to query the web service any more

./ncbi-blast-2.2.28+/bin/rpsblast -db mycdd -evalue 0.01 -query foo.fasta -outfmt "6 sstart send stitle"

http://blastedbio.blogspot.dk/2012/05/blast-tabular-missing-descriptions.html

*/

/** Default class constructor
 *  @class      Service class that will retrieve data from Cdd for given sequences
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */

(function() {
    var read_csv = function(text_data) {
            var lines = text_data.split("\n");
            var data = [];
            for (var i = lines.length - 1; i >= 0; i-- ) {
                if (lines[i].match(/^#/)) {
                    continue;
                }
                data.push(lines[i].replace(/"/g,'').split(/\t/));
            }
            return data.reverse();
    };

    MASCP.CddRunner = MASCP.buildService(function(data) {
                            this._raw_data = data;
                            if (data && typeof data == 'string') {
                                var self = this;
                                var rows = read_csv(data);
                                var header_seen = false;
                                self._raw_data = { 'data' : {} };
                                rows.forEach(function(row) {
                                    if (row.length != 12) {
                                        return;
                                    }
                                    if ( ! header_seen ) {
                                        header_seen = true;
                                        return;
                                    }
                                    if ( ! self._raw_data.data[row[7]]) {
                                        self._raw_data.data[row[7]] = { 'peptides' : [] };
                                    }
                                    var domain = self._raw_data.data[row[7]];
                                    domain.peptides.push([row[3],row[4]]);
                                    domain.name = row[8];
                                    domain.description = row[11];
                                });
                            }
                            return this;
                        });
})();
MASCP.CddRunner.SERVICE_URL = 'http://www.ncbi.nlm.nih.gov/Structure/bwrpsb/bwrpsb.cgi?';

MASCP.CddRunner.prototype.requestData = function()
{   
    var self = this;
    bean.fire(self,"error",["CDD live retrieving is disabled"]);
    return;

    // var sequences = [].concat(self.sequences || []);

    if (! MASCP.CddRunner.SERVICE_URL.match(/ncbi/)) {
        return {
            // type: "POST",
            // dataType: "json",
            // data : {
            //     'sequences' : sequences.join(",")
            // }
        };
    }
    bean.fire(self,'running');
    if (this.job_id) {
        return {
            type: "GET",
            dataType: "txt",
            url: 'http://www.ncbi.nlm.nih.gov/Structure/bwrpsb/bwrpsb.cgi?cddefl=true&dmode=all&tdata=hits&cdsid='+this.job_id
        };
    }
    
    // for (var i = 0; i < sequences.length; i++ ) {
    //     sequences[i] = ">seq"+i+"\n"+sequences[i];
    // }
    // console.log(sequences);
    sequences  = [ self.agi ];
    return {
        type: "POST",
        dataType: "txt",
        data: { 'queries'   : escape(sequences.join("\n")+"\n\n"),
                'db'        : 'cdd',
                'smode'     : 'live',
                'tdata'     : 'hits',
                'dmode'     : 'all',
                'cddefl'    : 'true'
        }
    };
};

(function(serv) {
    var defaultDataReceived = serv.prototype._dataReceived;

    serv.prototype._dataReceived = function(data,status)
    {
        if (data === null) {
            return defaultDataReceived.call(this,null,status);
        }
        if (typeof data == "object") {
            if (data.status && data.status == "RUNNING") {
                var self = this;
                bean.fire(self,"running");
                setTimeout(function() {
                    self.retrieve(self.agi);
                },5000);
                console.log("Got back running status");
                return;
            }
            return defaultDataReceived.call(this,data,status);
        }
        var re = /^#cdsid\t([a-zA-Z0-9-]+)/m;
        var match;
        if (typeof data == "string" && ! this.job_id ) {
            match = re.exec(data);
            if (match) {
                var self = this;
                this.job_id = match[1];
                self.retrieve(this.agi);
                return;
            }
        }
        re = /^#status\tsuccess/m;
        if (re.exec(data)) {
            this.job_id = null;
            return defaultDataReceived.call(this,data,status);
        }
        re = /#status\t3/m;
        if (re.exec(data)) {
            var self = this;
            setTimeout(function() {
                self.retrieve(self.agi);
            },5000);
            return;
        }
        
        return defaultDataReceived.call(this,data,status);
    };
    
})(MASCP.CddRunner);
/*
http://uniprot.org/mapping/?from=ACC+ID&to=REFSEQ_NT_ID&format=list&query=Q9UNA3
 */

/**
 * @fileOverview    Classes for reading SNP data
 */

if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}



/** Default class constructor
 *  @class      Service class that will retrieve sequence data for a given AGI from a given ecotype
 *  @param      {String} agi            Agi to look up
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.ExomeReader = MASCP.buildService(function(data) {
                         this._raw_data = data || {};
                         return this;
                     });

MASCP.ExomeReader.SERVICE_URL = 'http://localhost:3000/data/latest/gator';

(function(serv) {
    var defaultDataReceived = serv.prototype._dataReceived;

    serv.prototype._dataReceived = function(data,status)
    {
        if (data === null) {
            return defaultDataReceived.call(this,null,status);
        }
        if (typeof data == "object") {
            return defaultDataReceived.call(this,data,status);
        }

        if (typeof data == "string" && data.match(/^NM/)) {
            this.agi = data.replace(/(\n|\r)+$/,'');
            this.retrieve(this.agi);
            return;
        }
    };
})(MASCP.ExomeReader);

MASCP.ExomeReader.prototype.requestData = function()
{
    var self = this;
    var agi = this.agi || '';
    if (! agi.match(/NM/)) {
        return {
            type: "GET",
            dataType: "txt",
            url: "http://uniprot.org/mapping/",
            data : {
                "from" : "ACC+ID",
                "to" : "REFSEQ_NT_ID",
                "format" : "list",
                "query" : agi
            }
        }
    }
    return {
        type: "GET",
        dataType: "json",
        data: { 'agi'   : agi,
                'service' : 'exome'
        }
    };
};

MASCP.ExomeReader.prototype.setupSequenceRenderer = function(renderer) {
 var reader = this;

 reader.bind('resultReceived', function() {
     var a_result = reader.result;
     renderer.withoutRefresh(function() {
     var insertions_layer;

     var accessions = a_result.getAccessions();
     while (accessions.length > 0) {

         var acc = accessions.shift();
         var acc_fullname = acc;

         var diffs = a_result.getSnp(acc);

         if (diffs.length < 1) {
             continue;
         }

         var in_layer = 'rnaedit';

         var ins = [];
         var outs = [];
         var acc_layer = renderer.registerLayer(in_layer, {'fullname' : 'RNA Edit (mod)' });

         MASCP.getLayer(in_layer).icon = null;
         var i;

         for (i = diffs.length - 1; i >= 0 ; i-- ){
             outs.push( { 'index' : diffs[i][0] + 1, 'delta' : diffs[i][1] });
             ins.push( { 'insertBefore' : diffs[i][0] + 1, 'delta' : diffs[i][2] });
         }

         for (i = ins.length - 1; i >= 0 ; i-- ) {
             var pos = ins[i].insertBefore - 1;
             if (pos > renderer.sequence.length) {
                 pos = renderer.sequence.length;
             }
             renderer.getAA(pos).addAnnotation('rnaedit',1, { 'border' : 'rgb(150,0,0)', 'content' : ins[i].delta, 'angle': 'auto' });
         }
     }

     });
     renderer.trigger('resultsRendered',[reader]);
 });
};
/** @fileOverview   Classes for reading data from the AtPeptide database
 */
if ( typeof MASCP === 'undefined' || typeof MASCP.Service === 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

/** Default class constructor
 *  @class      Service class that will retrieve data from AtPeptide for a given AGI.
 *  @param      {String} agi            Agi to look up
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.GelMapReader = MASCP.buildService(function(data) {
                        this._raw_data = data;
                        if (! data) {
                            return this;
                        }
                        if ( ! data.Maps ) {
                            return this;
                        }
                        var maps = [];
                        for (var i = data.Maps.length - 1; i >= 0; i--) {
                            var map = data.Maps[i];
                            map.sequence = "";
                            maps.push(map);
                        }
                        this.maps = maps;
                        return this;
                    });

MASCP.GelMapReader.SERVICE_URL = 'http://gelmap.de/gator2.php?';

MASCP.GelMapReader.prototype.requestData = function()
{
    var agi = this.agi.toUpperCase();
    
    return {
        type: "GET",
        dataType: "json",
        data: { 'agi'       : agi,
                'service'   : 'gelmap' 
        }
    };
};

/**
 *  @class   Container class for results from the service
 *  @extends MASCP.Service.Result
 */
// We need this line for the JsDoc to pick up this class
MASCP.GelMapReader.Result = MASCP.GelMapReader.Result;

/** Retrieve the peptides for this particular entry from the service
 *  @returns Array of peptide strings
 *  @type [String]
 */
MASCP.GelMapReader.Result.prototype.getPeptides = function()
{
    var content = null;

    if (this._peptides) {
        return this._peptides;
    }
    
    
    this._peptides = peptides;
    
    return peptides;
};

MASCP.GelMapReader.Result.prototype._cleanSequence = function(sequence)
{
    return sequence.replace(/[^A-Z]/g,'');
};

MASCP.GelMapReader.prototype.setupSequenceRenderer = function(sequenceRenderer)
{
    var reader = this;
    MASCP.registerGroup('gelmap_experimental', {'fullname' : 'GelMap', 'hide_member_controllers' : true, 'hide_group_controller' : true, 'color' : '#aaaaff' });

    var controller_name = 'gelmap_controller';

    var css_block = '.active .overlay { background: #ff5533; } .active a { color: #000000; text-decoration: none !important; }  :indeterminate { background: #ff0000; } .tracks .active { background: #0000ff; } .inactive a { text-decoration: none; } .inactive { display: none; }';
    
    MASCP.registerLayer(controller_name,{ 'fullname' : 'GelMap', 'color' : '#aaaaff', 'css' : css_block });

    if (sequenceRenderer.createGroupController) {
        sequenceRenderer.createGroupController('gelmap_controller','gelmap_experimental');
    }

    var sort_unique = function(arr) {
        arr = arr.sort(function (a, b) { return a*1 - b*1; });
        var ret = [arr[0]];
        for (var i = 1; i < arr.length; i++) { // start loop at 1 as element 0 can never be a duplicate
            if (arr[i-1] !== arr[i]) {
                ret.push(arr[i]);
            }
        }
        return ret;
    };

    this.bind('resultReceived', function() {
        for (var maps = this.result.maps, j = maps.length - 1; j >= 0; j--) {
            var a_map = maps[j];
            MASCP.registerLayer('gelmap_map_'+a_map.id, { 'fullname': a_map.title, 'group' : 'gelmap_experimental', 'color' : '#aaaaff', 'css' : css_block });
            MASCP.getLayer('gelmap_map_'+a_map.id).href = a_map.url;
            var peps = sort_unique(maps[j].peptides);

            for(var i = peps.length - 1; i >= 0; i--) {
                var peptide = peps[i];
                var peptide_bits = sequenceRenderer.getAminoAcidsByPeptide(peptide);
                var layer_name = 'gelmap_map_'+a_map.id;
                peptide_bits.addToLayer(layer_name);
                peptide_bits.addToLayer(controller_name);
            }
        }
        sequenceRenderer.trigger('resultsRendered',[reader]);
    });
    return this;
};

MASCP.GelMapReader.Result.prototype.render = function()
{
};
/**
 * @fileOverview    Retrieve data from a Google data source
 */

if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

/** Default class constructor
 */
MASCP.GoogledataReader =    MASCP.buildService(function(data) {
                                return this;
                            });

(function() {

var scope = "https://docs.google.com/feeds/ https://spreadsheets.google.com/feeds/";

var parsedata = function ( data ){
    /* the content of this function is not important to the question */
    var entryidRC = /.*\/R(\d*)C(\d*)/;
    var retdata = {};
    retdata.data = [];
    var max_rows = 0;
    for( var l in data.feed.entry )
    {
        var entry = data.feed.entry[ l ];
        var id = entry.id.$t;
        var m = entryidRC.exec( id );
        var R,C;
        if( m != null )
        {
            R = m[ 1 ] - 1;
            C = m[ 2 ] - 1;
        }
        var row = retdata.data[ R ];
        if( typeof( row ) == 'undefined' ) {
            retdata.data[ R ] = [];
        }
        retdata.data[ R ][ C ] = entry.content.$t;
    }
    retdata.retrieved = new Date((new Date(data.feed.updated.$t)).getTime());

    /* When we cache this data, we don't want to
       wipe out the hour/minute/second accuracy so
       that we can eventually do some clever updating
       on this data.
     */
    retdata.retrieved.setUTCHours = function(){};
    retdata.retrieved.setUTCMinutes = function(){};
    retdata.retrieved.setUTCSeconds = function(){};
    retdata.retrieved.setUTCMilliseconds = function(){};
    retdata.etag = data.feed.gd$etag;
    retdata.title = data.feed.title.$t;

    return retdata;
};

var get_document, get_document_list, get_permissions, get_permissions_id, get_mimetype, authenticate, do_request, update_or_insert_row, insert_row;

update_or_insert_row = function(doc,query,new_data,callback) {
    if ( ! doc.match(/^spreadsheet/ ) ) {
        console.log("No support for retrieving things that aren't spreadsheets yet");
        return;
    }
    var doc_id = doc.replace(/^spreadsheet:/,'');
    do_request("spreadsheets.google.com","/feeds/list/"+doc_id+"/1/private/full?sq="+encodeURIComponent(query)+"&alt=json",null,function(err,json) {
        if (json.feed.entry) {
            var last_entry = json.feed.entry.reverse().shift();
            var edit_url;
            last_entry.link.forEach(function(link) {
                if (link.rel == 'edit') {
                    edit_url = link.href;
                }
            });
            var reg = /.+?\:\/\/.+?(\/.+?)(?:#|\?|$)/;
            var path = reg.exec(edit_url)[1];
            do_request("spreadsheets.google.com",path+"?alt=json",last_entry['gd$etag'],function(err,json) {
                if (! err) {
                    insert_row(doc,new_data,callback);
                }
            },"DELETE");
        } else {
            insert_row(doc,new_data,callback);
        }
    });
};

insert_row = function(doc,new_data,callback) {
    if ( ! doc.match(/^spreadsheet/ ) ) {
        console.log("No support for retrieving things that aren't spreadsheets yet");
        return;
    }
    var doc_id = doc.replace(/^spreadsheet:/,'');

    var data = ['<entry xmlns="http://www.w3.org/2005/Atom" xmlns:gsx="http://schemas.google.com/spreadsheets/2006/extended">'];
    for (var key in new_data) {
        data.push("<gsx:"+key+">");
        if (new_data[key] === null) {
            data.push('');
        } else {
            data.push(new_data[key]);
        }
        data.push("</gsx:"+key+">");
    }
    data.push("</entry>");
    do_request("spreadsheets.google.com","/feeds/list/"+doc_id+"/1/private/full",null,function(err,json) {
        if ( ! err ) {
            callback.call(null);
        } else {
            callback.call(null,err);
        }
    },"POST",data.join(''));
};

get_document_list = function(callback) {
    do_request("docs.google.com", "/feeds/default/private/full/-/spreadsheet?alt=json",null,function(err,data) {
        var results = [];
        if (data) {
            var entries = data.feed.entry;
            var i;
            for ( i = entries.length - 1; i >= 0; i-- ) {
                results.push( [ entries[i].title.$t,
                                entries[i]['gd$resourceId'].$t,
                                new Date(entries[i]['updated'].$t) ]
                            );
            }
        }
        callback.call(null,null,results);
    });
};

get_permissions_id = function(callback) {
    do_request("www.googleapis.com","/drive/v2/about",null,function(err,data) {
        if (err) {
            callback.call(null,err);
            return;
        }
        callback.call(null,null,data.permissionId);
    });
}

// parseUri 1.2.2
// (c) Steven Levithan <stevenlevithan.com>
// MIT License

function parseUri (str) {
    var o   = parseUri.options,
        m   = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
        uri = {},
        i   = 14;

    while (i--) uri[o.key[i]] = m[i] || "";

    uri[o.q.name] = {};
    uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
        if ($1) uri[o.q.name][$1] = $2;
    });

    return uri;
};

parseUri.options = {
    strictMode: false,
    key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
    q:   {
        name:   "queryKey",
        parser: /(?:^|&)([^&=]*)=?([^&]*)/g
    },
    parser: {
        strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
        loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
    }
};


// We want to store the locally cached files
// for all instances
var cached_files = {};
var etags = {};

var get_file_by_filename = function(filename,mime,callback) {
    if (cached_files[filename] && callback && MASCP["GOOGLE_AUTH_TOKEN"]) {
        callback.call(null,null,cached_files[filename]);
        return;
    }
    var query = encodeURIComponent("title='"+filename+"' and 'appdata' in parents and mimeType = '"+mime+"' and trashed = false");
    do_request("www.googleapis.com","/drive/v2/files?q="+query,null,function(err,data) {

        if (cached_files[filename] && callback) {
            callback.call(null,null,cached_files[filename]);
            return;
        }

        if (err && err.status == 401) {
            delete MASCP["GOOGLE_AUTH_TOKEN"];
        }

        if (err) {
            callback.call(null,err);
            return;
        }

        if (data.items.length == 0) {
            cached_files[filename] = {};
            callback.call(null,null,cached_files[filename]);
            return;
        }

        var item_id = data.items[0].id;
        etags[filename] = data.items[0].etag;
        if ( ! callback ) {
            return;
        }
        get_file({ "id" : item_id },null,function(err,data) {
            if (cached_files[filename]) {
                callback.call(null,null,cached_files[filename]);
                return;
            }
            if ( err ) {
                callback.call(null,err);
            }
            cached_files[filename] = data;
            callback.call(null,null,cached_files[filename],item_id);
        });
    });
};

var check_current_session = function(callback) {
    if (! gapi || ! gapi.auth || ! gapi.auth.authorize) {
        callback.call(null,{ "cause" : "No google auth library"});
        return;
    }
    if (! MASCP.GOOGLE_CLIENT_ID) {
        // We can't have a valid login here, so lets just say we don't
        // have a valid session.
        callback.call(null,null,false);
    }
    gapi.auth.checkSessionState({'client_id' : MASCP.GOOGLE_CLIENT_ID, 'session_state' : null},function(loggedOut) {
        callback.call(null,null,loggedOut);
    });
};


var get_file = function(file,mime,callback) {
    if (! gapi || ! gapi.auth || ! gapi.auth.authorize) {
        callback.call(null,{ "cause" : "No google auth library"});
        return;
    }

    check_current_session(function(err,loggedOut) {
        if (err) {
            callback.call(null,err);
            return;
        }
        if (loggedOut) {
            callback.call(null,{"cause" : "No user event"});
            return;
        }

        if ( typeof(file) === 'string' ) {
            get_file_by_filename(file,mime,callback);
            return;
        }
        if (! file.id) {
            callback.call(null,{"error" : "No file id"});
            return;
        }
        var item_id = file.id;
        do_request("www.googleapis.com","/drive/v2/files/"+item_id,file.etag,function(err,data) {

            if ( err ) {
                callback.call(null,err);
                return;
            }

            var uri = parseUri(data.downloadUrl);
            file.etag = data.etag;
            file.modified = new Date(data.modifiedDate);
            file.owner = (data.ownerNames || [])[0];

            do_request(uri.host,uri.relative,null,function(err,data) {
                if ( err ) {
                    callback.call(null,err);
                    return;
                }
                if ( ! data ) {
                    data = {};
                }
                var ret_data;
                if (typeof data !== 'string') {
                    ret_data = data;
                } else {
                    ret_data = JSON.parse(data);
                }
                callback.call(null,null,ret_data,item_id);
            });
        });

    });


};

var write_file_by_filename = function(filename,mime,callback) {
    if (! cached_files[filename]) {
        callback.call(null,{"error" : "No file to save"});
        return;
    }
    var query = encodeURIComponent("title='"+filename+"' and 'appdata' in parents and mimeType = '"+mime+"' and trashed = false");
    do_request("www.googleapis.com","/drive/v2/files?q="+query,null,function(err,data) {
        if ( ! cached_files[filename]) {
            return;
        }
        if (err) {
            callback.call(null,err);
            return;
        }
        var item_id = null;
        if (data.items && data.items.length == 0) {
            do_request("www.googleapis.com","/drive/v2/files/",null,arguments.callee, "POST:application/json",JSON.stringify({
                'parents': [{'id': 'appdata'}],
                "title" : filename,
                "mimeType" : mime,
                "description" : filename
            }));
            return;
        }
        if (data.items) {
            item_id = data.items[0].id;
        } else {
            item_id = data.id;
        }
        if (etags[filename] && data.items && etags[filename] !== data.items[0].etag ) {
            cached_files[filename] = null;
            etags[filename] = null;
            get_file(filename,mime,function() { });
            callback.call(null,{"cause" : "File too old"});
            return;
        }

        if ( ! cached_files[filename]) {
            return;
        }
        write_file( { "id" : item_id, "content" : cached_files[filename] },mime,function(err,data) {
            if (err) {
                if (err.status && err.status == 412) {
                    cached_files[filename] = null;
                    etags[filename] = null;
                    get_file(filename,mime,callback);
                }
                callback.call(null,err);
                return;
            }

            // cached_files[filename] = null;
            etags[filename] = null;
            get_file(filename,mime,null);
            callback.call(null,null,cached_files[filename]);

        });
    });
}

var create_file = function(file,mime,callback) {
    if ( typeof(file) === 'string' ) {
        write_file_by_filename(file,mime,callback);
        return;
    }
    if (file.id) {
        write_file(file,mime,callback);
        return;
    }
    var req_body = JSON.stringify({
        'parents': [{'id': file.parent }],
        "title" : file.name,
        "mimeType" : mime,
        "description" : file.name
    });

    do_request("www.googleapis.com","/drive/v2/files/",null,
        function(err,data) {
            if (err) {
                callback.call(null,err);
                return;
            }
            file.id = data.id;
            write_file(file,mime,callback);
        },
        "POST:application/json",req_body);
};

var write_file = function(file,mime,callback) {
    if ( typeof(file) === 'string' ) {
        write_file_by_filename(file,mime,callback);
        return;
    }
    if ( ! file.id ) {
        callback.call(null,{"error" : "No file id"});
        return;
    }
    var item_id = file.id;
    var string_rep;

    if ( ! file.content ) {
        callback.call();
        return;
    }

    try {
        string_rep = JSON.stringify(file.content);
    } catch (e) {
        callback.call(null,{"status" : "JSON error", "error" : e });
        return;
    }

    item_id = file.id;

    // CORS requests are not allowed on this domain for uploads for some reason, we need to use
    // the wacky Google uploader, but the commented out bit should work for when they finally
    // allow the CORS request to go through

    var headers_block = {
        'Content-Type' : mime
    };

    if (file.etag) {
        // headers_block['If-Match'] = file.etag;
    }

    var req = gapi.client.request({
        'path' : "/upload/drive/v2/files/"+item_id,
        'method' : "PUT",
        'params' : { "uploadType" : "media"},
        'headers' : headers_block,
        'body' : string_rep
    });

    req.execute(function(isjson,data) {
        if (isjson && isjson.error && isjson.error.code == 412) {
            callback.call(null,{"status" : 412, "message" : "E-tag mismatch" });
            return;
        }
        if ( ! isjson ) {
            callback.call(null,{"status" : "Google error", "response" : response});
            return;
        }
        callback.call(null,null,file.content,file.id);
    });

    // do_request("www.googleapis.com","/upload/drive/v2/files/"+item_id+"?uploadType=media",null,function(err,data) {

    //     if ( err ) {
    //         callback.call(null,err);
    //         return;
    //     }
    //     callback.call(null,null,cached_files[filename]);
    // }, "PUT:"+mime,JSON.stringify(cached_files[filename]));
};

get_permissions = function(doc,callback) {
    var doc_id = doc.replace(/^file:/,'');
    get_permissions_id(function(error,permissionId) {
        if ( error ) {
            callback.call(null,error);
            return;
        }
        do_request("www.googleapis.com","/drive/v2/files/"+doc_id+"/permissions",null,function(err,data){
            if (err) {
                if (err.cause && err.cause.status == '400') {
                    callback.call(null,null,{"write" : false, "read" : false});
                    return;
                }
                callback.call(null,err);
                return;
            }
            var writable = false;
            if ( ! data ) {
                callback.call(null,null,{"write" : false, "read" : false});
                return;
            }
            data.items.forEach(function(item) {
                if (item.id == permissionId && (item.role == 'owner' || item.role == 'writer')) {
                    writable = true;
                }
            });
            callback.call(null,null,{"write": writable, "read" : true});
        });
    });
};

get_mimetype = function(doc_id,callback) {
    do_request("www.googleapis.com","/drive/v2/files/"+doc_id+"?fields=mimeType,title",null,function(err,data) {
        var mime = (data || {}).mimeType;
        if (mime) {
            mime = mime.replace(/\s+charset=[^\s]+/i,'');
        }
        callback.call(null,err,err ? null : mime ,err ? null : (data || {}).title );
    });
}

get_document = function(doc,etag,callback) {
    var is_spreadsheet = true;
    if ( ! doc.match(/^spreadsheet/ ) ) {
        is_spreadsheet = false;
        // console.log("No support for retrieving things that aren't spreadsheets yet");
        // return;
    }
    var doc_id = doc.replace(/^spreadsheet:/,'');

    var headers_block = { 'GData-Version' : '3.0' };

    var feed_type = 'private';
    if (is_spreadsheet) {
        do_request("spreadsheets.google.com","/feeds/cells/"+doc_id+"/1/"+feed_type+"/basic?alt=json",etag,function(err,json) {
            if ( ! err ) {
                if (json) {
                    callback.call(null,null,parsedata(json));
                } else {
                    callback.call(null,{ "cause" : "No data" } );
                }
            } else {
                callback.call(null,err);
            }
        });
    } else {
        do_request("www.googleapis.com","/drive/v2/files/"+doc_id,etag,function(err,data) {
            if ( ! err ) {
                var uri = parseUri(data.downloadUrl);
                var title = data.title;
                var etag = data.etag;
                do_request(uri.host,uri.relative,null,function(err,json) {
                    if (err) {
                        callback.call(null,err);
                    } else {
                        json.etag = etag;
                        json.title = title || doc_id;
                        callback.call(null,null,json);
                    }
                });
            } else {
                if (err.cause && err.cause.status == 401) {
                    delete MASCP["GOOGLE_AUTH_TOKEN"];
                }
                callback.call(null,err);
            }
        });
    }
};

if (typeof module != 'undefined' && module.exports){

    var nconf = require('nconf');
    nconf.env('__').argv();
    nconf.file('config.json');

    var google_client_id = nconf.get('google:client_id');
    var google_client_secret = nconf.get('google:client_secret');

    var access_token = null;
    var refresh_token = nconf.get('google:refresh_token');

    var with_google_authentication = function(callback) {
        if (access_token) {
            if (access_token.expiration < (new Date()) ) {
                access_token = null;
            }
        }

        if (access_token) {
            callback(access_token);
            return;
        }
        if (refresh_token) {
            refresh_authenticate(refresh_token,function(auth_details) {
                if ( ! auth_details ) {
                    console.log("Problems with auth details");
                    callback(null);
                    return;
                }
                if ( auth_details.error && auth_details.error == 'invalid_grant') {
                    nconf.clear('google:refresh_token');
                    nconf.save(function(err) {
                        if (err) {
                            console.log("Could not write config");
                        }
                    });

                    refresh_token = null;
                    with_google_authentication(callback);
                    return;
                }
                var expiration = new Date();
                expiration.setSeconds(expiration.getSeconds() + auth_details.expires_in);
                access_token = {
                    "token": auth_details.access_token,
                    "expiration": expiration
                };
                callback(access_token);
            });
            return;
        }
        new_authenticate(function(auth_details) {
            if ( ! auth_details ) {
                console.log("We didn't get back auth details");
                callback(null);
                return;
            }
            var expiration = new Date();
            expiration.setSeconds(expiration.getSeconds() + auth_details.expires_in);
            access_token = {
                "token": auth_details.access_token,
                "expiration": expiration
            };
            refresh_token = auth_details.refresh_token;
            nconf.set('google:refresh_token',refresh_token);
            nconf.save(function(err) {
                if (err) {
                    console.log("Could not write config");
                } else {
                    console.log("Successful retrieval of auth details");
                }
            });
            callback(access_token);
        });
    };

    var new_authenticate = function(auth_done) {
        var base = "https://accounts.google.com/o/oauth2/auth?";
        var enc_scope = encodeURIComponent(scope);
        var redirect_uri = encodeURIComponent("urn:ietf:wg:oauth:2.0:oob");
        var client_id = encodeURIComponent(google_client_id);
        var old_eval;

        if ( ! google_client_id || ! google_client_secret ) {
            console.log("Missing important authorisation information. Check that google:client_id and google:client_secret are set.");
            if ( ! repl || ! repl.repl ) {
                console.log("Not running in an interactive session - returning");
                auth_done(null);
                return;
            }
            old_eval = repl.repl.eval;
            console.log("Set client ID now? : [yN] ");
            repl.repl.eval = function(cmd,context,filename,callback) {
                var re = /\n.*/m;
                cmd = (cmd || "").replace(/\(/,'');
                cmd = cmd.replace(re,'');
                if (cmd.match(/[yY]/)) {
                    console.log("Enter client ID: ");
                    repl.repl.eval = function(cmd) {
                        cmd = (cmd || "").replace(/\(/,'');
                        cmd = cmd.replace(re,'');
                        google_client_id = cmd;
                        console.log("Enter client secret: ");
                        repl.repl.eval = function(cmd) {
                            cmd = (cmd || "").replace(/\(/,'');
                            cmd = cmd.replace(re,'');
                            repl.repl.eval = old_eval;
                            google_client_secret = cmd;
                            nconf.set('google:client_id',google_client_id);
                            nconf.set('google:client_secret',google_client_secret);
                            nconf.save(function(err) {
                                if (! err) {
                                    new_authenticate(auth_done);
                                } else {
                                    console.log("Error saving configuration");
                                    auth_done(null);
                                }
                            });
                        }
                    };
                } else {
                    repl.repl.prompt = "Gator data server > ";
                    repl.repl.eval = old_eval;
                    auth_done(null);
                }
                return;
            }
            return;
        }
        if ( ! repl || ! repl.repl ) {
            console.log("Not running in an interactive session - returning");
            auth_done(null);
            return;
        }
        if (repl.repl.running) {
            console.log("Already asking for auth info");
            auth_done(null);
            return;
        }
        console.log("Go to this URL:");
        console.log(base+"scope="+enc_scope+"&redirect_uri="+redirect_uri+"&response_type=code&client_id="+client_id);
        console.log("Authentication code : ");
        repl.repl.running = true;
        old_eval = repl.repl.eval;
        repl.repl.eval = function(cmd,context,filename,callback) {
            repl.repl.eval = old_eval;

            var re = /\n.*/m;
            cmd = cmd.replace(/\(/,'');
            cmd = cmd.replace(re,'');
            var querystring = require('querystring');
            var post_data = querystring.stringify({
                'code' : cmd,
                'client_id' : google_client_id,
                'client_secret' : google_client_secret,
                'redirect_uri' : "urn:ietf:wg:oauth:2.0:oob",
                'grant_type' : 'authorization_code'
            });
            var req = require('https').request(
                {
                    host: "accounts.google.com",
                    path: "/o/oauth2/token",
                    method: "POST",

                    headers: {
                      'Content-Type': 'application/x-www-form-urlencoded',
                      'Content-Length': post_data.length
                    }
                },function(res) {
                    res.setEncoding('utf8');
                    var data = "";
                    res.on('data',function(chunk) {
                        data += chunk;
                    });
                    res.on('end',function() {
                        var response = JSON.parse(data);

                        if (response.error) {
                            console.log("Error validating authentication code");
                            delete repl.repl.running;
                            auth_done(null);
                        } else {
                            callback(null,"Authentication code validated");
                            delete repl.repl.running;
                            auth_done(response);
                        }
                    });
                }
            );
            req.write(post_data);
            req.end();
        }
    };

    var refresh_authenticate = function(refresh_token,auth_done) {
        var querystring = require('querystring');
        var post_data = querystring.stringify({
            'client_id' : google_client_id,
            'client_secret' : google_client_secret,
            'refresh_token' : refresh_token,
            'grant_type' : 'refresh_token'
        });
        var req = require('https').request(
            {
                host: "accounts.google.com",
                path: "/o/oauth2/token",
                method: "POST",

                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                  'Content-Length': post_data.length
                }
            },function(res) {
                res.setEncoding('utf8');
                var data = "";
                res.on('data',function(chunk) {
                    data += chunk;
                });
                res.on('end',function() {
                    var response = JSON.parse(data);
                    auth_done(response);
                });
            }
        );
        req.write(post_data);
        req.end();
    };

    authenticate = function(cback) {
        with_google_authentication(function(auth_details) {
            if (auth_details) {
                MASCP.GOOGLE_AUTH_TOKEN = auth_details.token;
                if (cback) {
                    cback.call(null);
                }
            } else {
                console.log("Could not authorize");
                if (cback) {
                    cback.call(null,{"cause" : "Could not authorize"});
                }
            }
        });
    }

    do_request = function(host,path,etag,callback,method,data) {
        var headers_block = { 'GData-Version' : '3.0' };
        var req_method = method || 'GET';
        if (req_method != 'GET') {
            headers_block = {};
        }
        if (req_method == "POST") {
            headers_block["Content-Type"] = "application/atom+xml";
        }

        if (req_method.match(/:/)) {
            headers_block['Content-Type'] = req_method.split(':')[1];
            req_method = req_method.split(':')[0];
        }

        if (MASCP.GOOGLE_AUTH_TOKEN) {
            headers_block['Authorization'] = 'Bearer '+MASCP.GOOGLE_AUTH_TOKEN;
        } else {
            var self_func = arguments.callee;
            authenticate(function(err) {
                if ( ! err ) {
                    self_func.call(null,host,path,etag,callback);
                } else {
                    callback.call(null,err);
                }
            });
            return;
        }
        if (etag) {
            headers_block["If-None-Match"] = etag;
        }
        var https = require('https');
        var req = https.request(
            {
                host: host,
                path: path,
                headers: headers_block,
                method: req_method
            },function(res) {
                res.setEncoding('utf8');
                var response = "";
                res.on('data',function(chunk) {
                    response += chunk;
                });
                res.on('end',function() {
                    if (res.statusCode > 300) {
                        callback.call(null,{ 'cause' : { 'status' : res.statusCode } } );
                        return;
                    }
                    var data = response.length > 0 ? (res.headers['content-type'].match(/json/) ? JSON.parse(response) : response ) : null;
                    callback.call(null,null,data);
                });
            }
        );
        if (data) {
            req.write(data);
        }
        req.end();
        req.on('error',function(err) {
            callback.call(null,{cause: err});
        });
    };

    MASCP.GoogledataReader.authenticate = authenticate;

} else {
    scope = "https://www.googleapis.com/auth/drive.install https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive https://spreadsheets.google.com/feeds/";

    var get_document_using_script = function(doc_id,callback,tryauth) {
        var head = document.getElementsByTagName('head')[0];
        var script = document.createElement('script');
        var type = "public";
        var auth = "";
        script.type = 'text/javascript';
        script.setAttribute('id','ssheet-'+doc_id);
        if (MASCP.GOOGLE_AUTH_TOKEN && tryauth ) {
            auth = "&access_token="+MASCP.GOOGLE_AUTH_TOKEN;
            type = "private";
        }
        script.src = "https://spreadsheets.google.com/feeds/cells/"+doc_id+"/1/"+type+"/basic?alt=json-in-script&callback=cback"+doc_id+""+auth;
        var error_function = function(e) {
            if (e.target !== script) {
                return;
            }
            if (window.removeEventListener) {
                window.removeEventListener('error',error_function);
            }
            if (script.parentNode) {
                script.parentNode.removeChild(script);
                callback.call(null,{ "cause" : { "status" : "" }, "message" : "Could not load data via script tag" } ,doc_id);
            }
        };
        script.addEventListener('error', error_function ,false);
        window.addEventListener('error', error_function, false);

        window["cback"+doc_id] = function(dat) {
            delete window["cback"+doc_id];
            if (window.removeEventListener) {
                window.removeEventListener('error',error_function);
            }
            callback.call(null,null,parsedata(dat));
        }
        try {
            head.appendChild(script);
        } catch (e) {
            callback.call(null,{"cause" : { "status" : "" }, "object" : e});
        }
    };
    var initing_auth = false;
    var waiting_callbacks = [];
    var has_failed_once = false;

    authenticate = function(cback,noevent) {
        if ( ! ("withCredentials" in (new XMLHttpRequest()))) {
            cback.call(null,{"cause" : "Browser not supported"});
            return;
        }

        if (MASCP.GOOGLE_AUTH_TOKEN) {
            cback.call(null);
            return;
        }
        if (initing_auth) {
            waiting_callbacks.push(cback);
            return;
        }
        if (! gapi || ! gapi.auth || ! gapi.auth.authorize) {
            cback.call(null,{ "cause" : "No google auth library"});
            return;
        }
        if ( ! MASCP.GOOGLE_CLIENT_ID ) {
            cback.call(null, { "cause" : "No client ID set (MASCP.GOOGLE_CLIENT_ID)"});
            return;
        }
        var auth_settings = { client_id : MASCP.GOOGLE_CLIENT_ID, scope : scope, immediate : true };
        //gapi.auth.authorize({immediate: true},function(){});
        initing_auth = true;
        var user_action = true;
        if (noevent) {
            user_action = false;
        }
        if (window.event) {
            user_action = window.event ? window.event.which : null;
        }

        if (! window.event && "event" in window) {
            user_action = false;
        }
        if (! user_action && has_failed_once) {
            initing_auth = false;
            cback.call(null,{"cause" : "No user event" });
            return;
        }
        setTimeout(function() {

        var timeout = setTimeout(function() {
            initing_auth = false;
            var error = { "cause" : "Failed to return from auth" };
            cback.call(null,error);
            waiting_callbacks.forEach(function(cb){
                if (cb !== cback) {
                    cb.call(null,error);
                }
            });
            waiting_callbacks = [];
            return;
        },3000);

        gapi.auth.authorize(auth_settings,function(result) {
            clearTimeout(timeout);
            if (result && ! result.error) {
                MASCP.GOOGLE_AUTH_TOKEN = result.access_token;
                window.setTimeout(function(){
                    console.log("Google token has timed out, forcing refresh");
                    delete MASCP["GOOGLE_AUTH_TOKEN"];
                    authenticate(function() {});
                },parseInt(result.expires_in)*1000);
                initing_auth = false;
                cback.call(null);
                waiting_callbacks.forEach(function(cb){
                    if (cb !== cback) {
                        cb.call(null);
                    }
                });
                waiting_callbacks = [];
                return;
            } else if (result && result.error) {
                initing_auth = false;
                var error = { "cause" : result.error };
                cback.call(null,error);
                waiting_callbacks.forEach(function(cb){
                    if (cb !== cback) {
                        cb.call(null,error);
                    }
                });
                waiting_callbacks = [];
            } else {
                initing_auth = false;
                if ( auth_settings.immediate ) {
                    if (! user_action ) {
                        var auth_func = function(success) {
                            auth_settings.immediate = false;
                            gapi.auth.authorize(auth_settings,function(result) {
                                if (result && ! result.error) {
                                    MASCP.GOOGLE_AUTH_TOKEN = result.access_token;
                                    window.setTimeout(function(){
                                        console.log("Google token has timed out, forcing refresh");
                                        delete MASCP["GOOGLE_AUTH_TOKEN"];
                                        authenticate(function() {});
                                    },parseInt(result.expires_in)*1000);
                                    success.call(null);
                                } else {
                                    success.call(null,{ "cause" : result ? result.error : "No auth result" });
                                }
                            });
                        };
                        has_failed_once = true;
                        cback.call(null,{"cause" : "No user event", "authorize" : auth_func });
                        if (waiting_callbacks) {
                            waiting_callbacks.forEach(function(cb) {
                                if (cb !== cback) {
                                    cb.call(null, {"cause" : "No user event", "authorize" : auth_func });
                                }
                            });
                            waiting_callbacks = [];
                        }
                        return;
                    }
                    auth_settings.immediate = false;
                    gapi.auth.authorize(auth_settings,arguments.callee);
                    return;
                }
            }
        });
        },1);
        return;
    };

    do_request = function(host,path,etag,callback,method,data,backoff) {
        authenticate(function(err) {
            if (err) {
                callback.call(null,err);
                return;
            }

            var request = new XMLHttpRequest();
            if (! ('withCredentials' in request) ) {
                callback.call(null, {'cause' : 'Browser not supported'});
                return;
            }
            var req_method = method || 'GET';
            try {
                request.open(req_method.replace(/:.*/,''),"https://"+host+path);
            } catch (e) {
                callback.call(null,{ 'cause' : "Access is denied.", 'error' : e, 'status' : 0 });
                return;
            }
            request.setRequestHeader('Authorization','Bearer '+MASCP.GOOGLE_AUTH_TOKEN);
            if (req_method == 'GET') {
                request.setRequestHeader('GData-Version','3.0');
            }
            if (req_method == 'POST') {
                request.setRequestHeader('Content-Type','application/atom+xml');
            }
            if (req_method.match(/:/)) {
                request.setRequestHeader('Content-Type',req_method.split(':')[1]);
                req_method = req_method.split(':')[0];
            }
            if (etag && req_method !== 'PUT') {
                request.setRequestHeader('If-None-Match',etag);
            }
            if (etag && req_method == 'PUT' ) {
                request.setRequestHeader('If-Match',etag);
            }
            request.onreadystatechange = function(evt) {
                if (request.readyState == 4) {
                    if (request.status < 300 && request.status >= 200) {
                        var datablock = request.responseText.length > 0 ? (request.getResponseHeader('Content-Type').match(/json/) ? JSON.parse(request.responseText) : request.responseText) : null;
                        if (callback !== null) {
                            callback.call(null,null,datablock);
                        }
                        callback = null;
                    } else if (request.status >= 500 && ((! backoff ) || (backoff < 1000))  ) {
                        if ( ! backoff ) {
                            backoff = 100;
                        } else {
                            backoff = 2*backoff;
                        }
                        setTimeout(function() {
                            do_request(host,path,etag,callback,method,data,backoff);
                        },backoff);
                    } else {
                        if (callback !== null) {
                            callback.call(null,{'cause' : { 'status' : request.status }});
                        }
                        callback =  null;
                    }
                }
            };
            request.onerror = function(evt) {
                if (callback) {
                    callback.call(null,{'cause' : { 'status' : request.status }});
                }
            };
            request.send(data);
        });
    };

    var basic_get_document = get_document;
    get_document = function(doc,etag,callback) {
        if ( ! doc && callback ) {
            authenticate(callback,true);
            return;
        }
        var is_spreadsheet = true;
        if ( ! doc.match(/^spreadsheet/ ) ) {
            is_spreadsheet = false;
        }
        var doc_id = doc.replace(/^spreadsheet:/g,'');
        if (! is_spreadsheet || etag || MASCP.GOOGLE_AUTH_TOKEN) {
            basic_get_document(doc,etag,function(err,dat) {
                if (err) {
                    if (err.cause && err.cause.status == 304) {
                        callback.call(null,err);
                        return;
                    }
                    if ( is_spreadsheet ) {
                        get_document_using_script(doc_id,function(err,dat) {
                            if (err) {
                                get_document_using_script(doc_id,callback,true);
                            } else {
                                callback.call(null,err,dat);
                            }
                        },false);
                    } else {
                        callback.call(null,err);
                    }
                } else {
                    callback.call(null,null,dat);
                }
            });
        } else {
            get_document_using_script(doc_id,function(err,dat){
                if (err) {
                    check_current_session(function(err,loggedOut) {
                        if (err) {
                            callback.call(null,err);
                            return;
                        }

                        // If we have a current session active
                        // we can continue trying the super-authed
                        // document retrieval
                        if (loggedOut == false) {
                            basic_get_document(doc,etag,function(err,dat) {
                                if (err) {
                                    if (err.cause == "No user event" || err.cause == "Access is denied.") {
                                        callback.call(null,err);
                                        return;
                                    }
                                    get_document_using_script(doc_id,callback,true);
                                } else {
                                    callback.call(null,null,dat);
                                }
                            });
                        } else {
                            // If we don't have a valid session AND we failed to retrieve
                            // the document using the script tag, we're in that semi-logged-in state
                            // We need to give up, and get the user to log in again.
                            callback.call(null,{"cause" : "Google session timed out"});
                        }
                    });
                } else {
                    callback.call(null,null,dat);
                }
            });
        }
    };
}

var render_site = function(renderer) {
    var self = this;
    var sites = self.result._raw_data.data.sites || [], i = 0, match = null;
    MASCP.registerLayer(self.datasetname,{ 'fullname' : self.result._raw_data.title });
    for (i = sites.length - 1; i >= 0; i--) {
        if (match = sites[i].match(/(\d+)/g)) {
            renderer.getAminoAcidsByPosition([parseInt(match[0])])[0].addToLayer(self.datasetname);
        }
    }
};

var render_peptides = function(renderer) {
    var self = this;
    var peptides = self.result._raw_data.data.peptides || [], i = 0, match = null;
    MASCP.registerLayer(self.datasetname,{ 'fullname' : self.result._raw_data.title });
    for (i = peptides.length - 1; i >= 0; i--) {
        if (match = peptides [i].match(/(\d+)/g)) {
            renderer.getAminoAcidsByPosition(parseInt(match[0])).addToLayer(self.datasetname);
        }
    }
};

var setup = function(renderer) {
    this.bind('resultReceived',function(e) {
        render_peptides.call(this,renderer);
        render_site.call(this,renderer);
    });
};

MASCP.GoogledataReader.isLoggedOut = check_current_session;

MASCP.GoogledataReader.prototype.getDocumentList = get_document_list;

MASCP.GoogledataReader.prototype.getDocument = get_document;

MASCP.GoogledataReader.prototype.getPermissions = get_permissions;

MASCP.GoogledataReader.prototype.getMimetype = get_mimetype;

MASCP.GoogledataReader.prototype.updateOrInsertRow = update_or_insert_row;

MASCP.GoogledataReader.prototype.getPreferences = function(prefs_domain,callback) {
    if ( ! prefs_domain ) {
        prefs_domain = "MASCP GATOR PREFS";
    }
    return get_file(prefs_domain,"application/json; data-type=domaintool-session",callback);
};

MASCP.GoogledataReader.prototype.writePreferences = function(prefs_domain,callback) {
    return write_file(prefs_domain,"application/json; data-type=domaintool-session",callback);
};

MASCP.GoogledataReader.prototype.createPreferences = function(folder,callback) {
    return create_file({ "parent" : folder, "content" : {}, "name" : "New annotation session.domaintoolsession" }, "application/json; data-type=domaintool-session",function(err,content,file_id) {
        callback.call(null,err,content,file_id,"New annotation session");
    });
};

MASCP.GoogledataReader.prototype.createFile = function(folder,content,title,mime,callback) {
    return create_file({ "parent" : folder, "content" : content, "name" : title }, mime,function(err,content,file_id) {
        callback.call(null,err,content,file_id,title);
    });
};

MASCP.GoogledataReader.prototype.getSyncableFile = function(file,callback,mime) {
    if ( ! mime ) {
        mime = "application/json";
    }
    var file_block = { "getData" : function() { return "Not ready"; } , "ready" : false };
    get_file(file,mime,function(err,filedata,file_id) {
        if (err) {
            callback.call(null,err);
        }
        file_block.getData = function() {
            return filedata;
        };
        var timeout = null;
        var original_sync;
        file_block.sync = function() {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
            timeout = setTimeout(function() {
                var wanting_new_sync = false;
                file_block.sync = function() {
                    wanting_new_sync = true;
                };
                if (typeof file !== "string") {
                    file.content = filedata;
                }
                write_file(file,mime,function(err) {
                    timeout = null;
                    file_block.sync = original_sync;
                    if (wanting_new_sync) {
                        file_block.sync();
                    }
                });
            },1000);
        };
        original_sync = file_block.sync;
        file_block.owner = file.owner;
        // Anything in app settings uses a string for the filename, since we will have to search for the file
        // by filename anyway. As such, we can detect if we are after a real file or not.
        if (typeof file !== "string" && file_id) {
            get_permissions(file_id,function(err,permissions) {
                file.permissions = permissions;
                file_block.permissions = permissions;
                bean.fire(file_block,'ready');
                file_block.ready = true;
                callback.call(null,null,file_block);
            });
        } else {
            file_block.permissions = { "read" : true, "write" : true };
            bean.fire(file_block,'ready');
            file_block.ready = true;
            callback.call(null,null,file_block);
        }
    });
    return file_block;
};

MASCP.GoogledataReader.prototype.addWatchedDocument = function(prefs_domain,doc_id,parser_function,callback) {
    var self = this;

    if (! parser_function) {
        parser_function = function(datablock){
            for (var key in datablock.data) {
              if (key == "" || key.match(/\s/)) {
                delete datablock.data[key];
              } else {
                var dat = datablock.data[key];
                delete datablock.data[key];
                datablock.data[key.toLowerCase()] = {
                  "data" : dat,
                  "retrieved" : datablock.retrieved,
                  "etag" : datablock.etag,
                  "title" : datablock.title
                };
              }
            }
            delete datablock.retrieved;
            delete datablock.etag;
            delete datablock.title;
            return datablock.data;
        };
    }

    var reader = (new MASCP.GoogledataReader()).createReader(doc_id,parser_function);

    reader.bind('error',function(err) {
        callback.call(null,err);
    });


    reader.bind('ready',function(datablock) {
        var title = this.title;
        self.getPreferences(prefs_domain,function(err,prefs) {
            if (err) {
                callback.call(null,{ "status" : "preferences", "original_error" : err });
                return;
            }

            if ( ! prefs.user_datasets ) {
                prefs.user_datasets = {};
            }
            var done_setup = false;

            if (datablock && datablock.liveClass) {
                done_setup = true;
                prefs.user_datasets[datablock.liveClass] = prefs.user_datasets[datablock.liveClass] || {};
                prefs.user_datasets[datablock.liveClass].render_options = {};
                prefs.user_datasets[datablock.liveClass].title = title;
                prefs.user_datasets[datablock.liveClass].type = "liveClass";
            }

            if (datablock && datablock.gatorURL) {
                done_setup = true;
                prefs.user_datasets[datablock.gatorURL] = prefs.user_datasets[datablock.gatorURL] || {};
                prefs.user_datasets[datablock.gatorURL].title = title;
                prefs.user_datasets[datablock.gatorURL].type = "gatorURL";
                if (datablock && datablock.defaults) {
                    prefs.user_datasets[datablock.gatorURL].render_options = datablock.defaults;
                }
            }

            if ( ! done_setup ) {
                prefs.user_datasets[reader.datasetname] = prefs.user_datasets[reader.datasetname] || {};
                prefs.user_datasets[reader.datasetname].parser_function = parser_function.toString();
                prefs.user_datasets[reader.datasetname].title = title;
                prefs.user_datasets[reader.datasetname].type = "dataset";
                if (datablock && datablock.defaults) {
                    prefs.user_datasets[reader.datasetname].render_options = datablock.defaults;
                }
            }

            self.writePreferences(prefs_domain,function(err,prefs) {
                if (err) {
                    callback.call(null,{ "status" : "preferences", "original_error" : err });
                    return;
                }
                callback.call(null,null,title);
            });
        });
    });
};

MASCP.GoogledataReader.prototype.removeWatchedDocument = function(prefs_domain,doc_id,callback) {
    var self = this;
    self.getPreferences(prefs_domain,function(err,prefs) {
        if (err) {
            callback.call(null,{ "status" : "preferences", "original_error" : err });
            return;
        }

        if ( ! prefs.user_datasets ) {
            prefs.user_datasets = {};
        }
        if (doc_id in prefs.user_datasets) {
            delete prefs.user_datasets[doc_id];
        } else {
            callback.call();
        }

        self.writePreferences(prefs_domain,function(err,prefs) {
            if (err) {
                callback.call(null,{ "status" : "preferences", "original_error" : err });
                return;
            }
            callback.call();
        });
    });
};

MASCP.GoogledataReader.prototype.listWatchedDocuments = function(prefs_domain,callback) {
    this.getPreferences(prefs_domain,function(err,prefs) {
        if (err) {
          if (err.cause === "No user event") {
            console.log("Consuming no user event");
            return;
          }
          callback.call(null,{ "status" : "preferences", "original_error" : err });
          return;
        }
        var sets = prefs.user_datasets;
        callback.call(null,null,sets);
    });
};

MASCP.GoogledataReader.prototype.readWatchedDocuments = function(prefs_domain,callback) {
    var self = this;
    self.getPreferences(prefs_domain,function(err,prefs) {
        if (err) {
          if (err.cause === "No user event") {
            console.log("Consuming no user event");
            return;
          }
          if (err.cause == "Browser not supported") {
            console.log("Consuming no browser support");
            return;
          }
          callback.call(null,{ "status" : "preferences", "original_error" : err });
          return;
        }
        MASCP.IterateServicesFromConfig(prefs.user_datasets,callback);
    });
};

/*
map = {
    "peptides" : "column_a",
    "sites"    : "column_b",
    "id"       : "uniprot_id"
}
*/
MASCP.GoogledataReader.prototype.createReader = function(doc, map) {
    var self = this;
    var reader = new MASCP.UserdataReader(null,null);
    reader.datasetname = doc;
    reader.setupSequenceRenderer = setup;

    MASCP.Service.CacheService(reader);

    var trans;

    var get_data = function(etag) {

        var update_timestamps = {};

        if (typeof module == 'undefined' || ! module.exports && typeof window != 'undefined'){
            if (window.sessionStorage) {
                update_timestamps = JSON.parse(window.sessionStorage.getItem("update_timestamps") || "{}");
            }
        }

        update_timestamps[doc] = new Date().getTime();

        if (typeof module == 'undefined' || ! module.exports && typeof window != 'undefined'){
            if (window.sessionStorage) {
                update_timestamps = window.sessionStorage.setItem("update_timestamps",JSON.stringify(update_timestamps));
            }
        }

        self.getDocument(doc,etag,function(e,data) {
            if (e) {
                if (e.cause.status == 304) {
                    // We don't do anything - the cached data is fine.
                    console.log("Matching e-tag for "+doc);
                    bean.fire(reader,'ready');
                    return;
                }
                reader.retrieve = null;
                bean.fire(reader,"error",[e]);
                return;
            }
            if ( ! map ) {
                return;
            }
            // Clear out the cache since we have new data coming in
            console.log("Wiping out data on "+data.title+" ("+doc+")");
            MASCP.Service.ClearCache(reader,null,function(error) {
                if (error) {
                    bean.fire(reader,"error",[error]);
                    return;
                }
                reader.map = map;
                reader.setData(doc,data);
            });
        });
    };

    (function() {
        var a_temp_reader = new MASCP.UserdataReader();
        a_temp_reader.datasetname = doc;
        MASCP.Service.CacheService(a_temp_reader);
        MASCP.Service.FirstAgi(a_temp_reader,function(entry) {
            if ( ! entry ) {
                get_data(null);
                return;
            }

            var update_timestamps = {};
            if (typeof module == 'undefined' || ! module.exports && typeof window != 'undefined'){
                if (window.sessionStorage) {
                    update_timestamps = JSON.parse(window.sessionStorage.getItem("update_timestamps") || "{}");
                }
            }

            if (update_timestamps[doc] && ((new Date().getTime()) - update_timestamps[doc]) < 1000*60*120) {
                console.log("Update timestamp < 2 hours, not refreshing data for "+doc);
                bean.fire(reader,'ready');
                return;
            }
            a_temp_reader.retrieve(entry,function() {
                get_data( (this.result && this.result._raw_data) ? this.result._raw_data.etag : null);
            });
        });
    })();

    return reader;
};

})();
/** @fileOverview   Classes for reading domains from Interpro 
 */
if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

/** Default class constructor
 *  @class      Service class that will retrieve data from Interpro for a given AGI.
 *              Data is transferred using XML.
 *  @param      {String} agi            Agi to look up
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.InterproReader = MASCP.buildService(function(data) {
                        if (data) {
                            if (! this._raw_data && ! data.data ) {
                                this._raw_data = { 'data' : [] };
                                this._raw_data.data.push(data);
                            } else {
                                this._raw_data = data;
                            }
                        }
                        return this;
                    });

MASCP.InterproReader.SERVICE_URL = 'http://gator.masc-proteomics.org/interpro.pl?';

MASCP.InterproReader.prototype.requestData = function()
{    
    return {
        type: "GET",
        dataType: "json",
        data: { 'agi'       : this.agi,
                'service'   : 'interpro' 
        }
    };
};

/* We need to ensure that the sequence is populated before the retrieve */

(function() {
var old_retrieve = MASCP.InterproReader.prototype.retrieve;
MASCP.InterproReader.prototype.retrieve = function(agi,func) {
    var self = this;
    if ( ! this.agi ) {
        this.agi = agi;
    }
    var self_func = arguments.callee;
    var cback = func;
    if ( this.sequence === null || typeof this.sequence == 'undefined' ) {
        (new MASCP.TairReader(self.agi)).bind('resultReceived',function() {
            self.sequence = this.result.getSequence() || '';
            self_func.call(self,self.agi,cback);
        }).bind('error',function(err) { self.trigger('error',[err]); }).retrieve();
        return this;
    }
    if (old_retrieve !== MASCP.Service.prototype.retrieve) {
        old_retrieve = MASCP.Service.prototype.retrieve;
    }
    old_retrieve.call(self,self.agi,cback);
    return this;
};
})();

/**
 *  @class   Container class for results from the Interpro service
 *  @extends MASCP.Service.Result
 */
// We need this line for the JsDoc to pick up this class
MASCP.InterproReader.Result = MASCP.InterproReader.Result;


/** Retrieve the peptides for this particular entry from the Interpro service
 *  @returns Array of peptide strings
 *  @type [String]
 */
MASCP.InterproReader.Result.prototype.getDomains = function()
{
    var content = null;
    
    if (! this._raw_data || this._raw_data.data.length === 0 ) {
        return {};
    }    
    
    if (this._peptides_by_domain) {
        return this._peptides_by_domain;
    }
    
    var peptides_by_domain = {};
    var domain_descriptions = {};
    var datablock = this._raw_data.data;
    for (var i = 0; i < datablock.length; i++ ) {
        var peptides = peptides_by_domain[datablock[i].interpro] || [];
        peptides.push(this.sequence.substring(datablock[i].start, datablock[i].end));
        domain_descriptions[datablock[i].interpro] = datablock[i].description;
        peptides_by_domain[datablock[i].interpro] = peptides;
    }
    
    this._peptides_by_domain = peptides_by_domain;
    return peptides_by_domain;
};

MASCP.InterproReader.prototype.setupSequenceRenderer = function(sequenceRenderer)
{
    var reader = this;

    this.bind('resultReceived', function() {
        var agi = this.agi;
        
        MASCP.registerGroup('interpro_domains', {'fullname' : 'Interpro domains', 'color' : '#000000' });

        var overlay_name = 'interpro_controller';

        var css_block = '.active .overlay { background: #000000; } .active a { color: #000000; text-decoration: none !important; }  :indeterminate { background: #ff0000; } .tracks .active { background: #0000ff; } .inactive a { text-decoration: none; } .inactive { display: none; }';

        MASCP.registerLayer(overlay_name,{ 'fullname' : 'Interpro domains', 'color' : '#000000', 'css' : css_block });

        MASCP.getLayer('interpro_controller').href = '';
        this.result.sequence = sequenceRenderer.sequence;
        var domains = this.result.getDomains();
        for (var dom in domains) {            
            if (domains.hasOwnProperty(dom)) {
                var domain = null;
                domain = dom;
                var lay = MASCP.registerLayer('interpro_domain_'+domain, { 'fullname': domain, 'group' : 'interpro_domains', 'color' : '#000000', 'css' : css_block });
                lay.href = "http://www.ebi.ac.uk/interpro/IEntry?ac="+domain;
                var peptides = domains[domain];
                for(var i = 0; i < peptides.length; i++ ) {
                    var peptide_bits = sequenceRenderer.getAminoAcidsByPeptide(peptides[i]);
                    var layer_name = 'interpro_domain_'+domain;
                    peptide_bits.addToLayer(layer_name);
                    peptide_bits.addToLayer(overlay_name);
                }
            }
        }
        if (sequenceRenderer.createGroupController) {
            sequenceRenderer.createGroupController('interpro_controller','interpro_domains');
        }

        sequenceRenderer.trigger('resultsRendered',[reader]);

    });
    return this;
};

MASCP.InterproReader.Result.prototype.render = function()
{
};/** @fileOverview   Classes for reading data from the P3db database
 */
if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

/** Default class constructor
 *  @class      Service class that will retrieve data from P3DB for a given AGI.
 *  @param      {String} agi            Agi to look up
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.P3dbReader = MASCP.buildService(function(data) {
                        this._raw_data = data;                        
                        return this;
                    });

MASCP.P3dbReader.SERVICE_URL = 'http://p3db.org/gator.php?';

MASCP.P3dbReader.prototype.requestData = function()
{
    var agi = this.agi.toLowerCase();
    
    return {
        type: "GET",
        dataType: "json",
        data: { 'agi'       : agi,
                'service'   : 'p3db' 
        }
    };
};


/**
 *  @class   Container class for results from the P3DB service
 *  @extends MASCP.Service.Result
 */
// We need this line for the JsDoc to pick up this class
MASCP.P3dbReader.Result = MASCP.P3dbReader.Result;

/** Retrieve the peptides for this particular entry from the P3db service
 *  @returns Array of peptide strings
 *  @type [String]
 */
MASCP.P3dbReader.Result.prototype.getPeptides = function()
{
    if (this._peptides) {
        return this._peptides;
    }

    this._long_name_map = {};
    
    if (! this._raw_data || ! this._raw_data.peptides ) {
        return [];
    }

        
    var peptides = [];
    
    for (var i = 0; i < this._raw_data.peptides.length; i++ ) {
        var a_peptide = this._raw_data.peptides[i];
        var the_pep = { 'sequence' : this._cleanSequence(a_peptide) };
        peptides.push(the_pep);
    }
    this._peptides = peptides;
    return peptides;
};

MASCP.P3dbReader.Result.prototype.getOrthologousPeptides = function(organism)
{
    var self = this;
    if ( ! this._raw_data.orthologs) {
        return [];
    }
    var peptides = [];
    this._raw_data.orthologs.forEach(function(orth) {
        if (orth.organism === organism && orth.peptides) {
            for (var i = 0; i < orth.peptides.length; i++ ) {
                var a_peptide = orth.peptides[i];
                var the_pep = { 'sequence' : self._cleanSequence(a_peptide) };
                peptides.push(the_pep);
            }
        }
    });
    return peptides;
};

MASCP.P3dbReader.Result.prototype.getOrganisms = function()
{
    var self = this;
    if ( ! this._raw_data.orthologs) {
        return [];
    }
    var organisms = [];
    this._raw_data.orthologs.forEach(function(orth) {
        organisms.push({ 'id' : orth.organism, 'name' : orth.name });
    });
    return organisms;
};


MASCP.P3dbReader.Result.prototype._cleanSequence = function(sequence)
{
    return sequence.replace(/[^A-Z]/g,'');
};

MASCP.P3dbReader.prototype.setupSequenceRenderer = function(sequenceRenderer)
{
    var reader = this;

    var color = '#5533ff';
    
    MASCP.registerGroup('p3db_experimental', {'fullname' : 'P3DB (mod)', 'color' : color });

    this.bind('resultReceived', function() {
        var res = this.result;
        var peps = res.getPeptides();
        if (peps.length > 0) {
            MASCP.registerLayer('p3db_controller',{ 'fullname' : 'P3DB (mod)', 'color' : color });
        }
        for(var i = 0; i < peps.length; i++) {
            var peptide = peps[i].sequence;
            var peptide_bits = sequenceRenderer.getAminoAcidsByPeptide(peptide);
            peptide_bits.addToLayer('p3db_controller');
        }
        res.getOrganisms().forEach(function(organism) {
            if (organism.id === 3702) {
                return;
            }
            var layer_name = 'p3db_tax_'+organism.id;
            var peps = res.getOrthologousPeptides(organism.id);
            if (peps.length > 0) {
                MASCP.registerLayer(layer_name,{ 'fullname' : organism.name, 'group' : 'p3db_experimental', 'color' : color });
            }
            for(var i = 0; i < peps.length; i++) {
                var peptide = peps[i].sequence;
                var peptide_bits = sequenceRenderer.getAminoAcidsByPeptide(peptide);
                peptide_bits.addToLayer(layer_name);
            }
        });
        
        if (sequenceRenderer.createGroupController) {
            sequenceRenderer.createGroupController('p3db_controller','p3db_experimental');
        }        
        
        sequenceRenderer.trigger('resultsRendered',[reader]);
    });
    return this;
};

MASCP.P3dbReader.Result.prototype.render = function()
{
};/**
 *  @fileOverview Classes for reading data from the Pep2Pro database using JSON data
 */

/**
 * @class   Service class that will retrieve Pep2Pro data for this entry given an AGI.
 *          Data is received in JSON format.
 * @description Default class constructor
 * @param   {String} agi            Agi to look up
 * @param   {String} endpointURL    Endpoint URL for this service
 * @extends MASCP.Service
 */
 
/*
+------------+-----------------+
| poid       | pocv            |
+------------+-----------------+
| PO:0000005 | cell suspension |
| PO:0009046 | flower          |
| PO:0000056 | floral bud      |
| PO:0020030 | cotyledon       |
| PO:0006339 | juvenile leaf   |
| PO:0009010 | seed            |
| PO:0009005 | root            |
| PO:0009030 | carpel          |
| PO:0009001 | silique         |
| PO:0009006 | shoot           |
| PO:0020091 | pollen          |
| PO:0009025 | leaf            |
+------------+-----------------+
*/ 
MASCP.Pep2ProReader = MASCP.buildService(function(data) {
                        this._raw_data = data;
                        if (data) {
                            this._populate_spectra(data);
                            this._populate_peptides(data);
                        }
                        return this;
                    });

MASCP.Pep2ProReader.prototype.requestData = function()
{
    var self = this;
    var agi = this.agi;
    return {
        type: "GET",
        dataType: "json",
        data: { 'agi'       : agi,
                'service'   : 'pep2pro' 
        }
    };
};


MASCP.Pep2ProReader.SERVICE_URL = 'http://fgcz-pep2pro.uzh.ch/mascp_gator.php?';

/**
 * @class   Container class for results from the Pep2Pro service
 * @extends MASCP.Service.Result
 */
// We need this line for the JsDoc to pick up this class
MASCP.Pep2ProReader.Result = MASCP.Pep2ProReader.Result;

/**
 * The list of tissue names that are used by Pep2Pro for this particular AGI
 *  @returns {[String]} Tissue names
 */
MASCP.Pep2ProReader.Result.prototype.tissues = function()
{
    return this._tissues;
};

MASCP.Pep2ProReader.Result.prototype.getPeptides = function()
{
    return this._peptides;
};


MASCP.Pep2ProReader.Result.prototype = MASCP.extend(MASCP.Pep2ProReader.Result.prototype,
/** @lends MASCP.Pep2ProReader.Result.prototype */
{
    /** @field 
     *  @description Hash keyed by tissue name containing the number of spectra for each tissue for this AGI */
    spectra :   null,
    /** @field
     *  @description Hash keyed by the Plant Ontology ID containing the number of spectra for each peptide (keyed by "start-end" position) */
    peptide_counts_by_tissue : null,
    /** @field
     *  @description String containing the sequence for the retrieved AGI */
    sequence : null
});

MASCP.Pep2ProReader.Result.prototype._populate_spectra = function(data)
{
    this.spectra = {};
    this._tissues = [];
    this._long_name_map = {};
    if ( ! data || ! data.tissues ) {
        return;
    }
    for (var i = 0; i < data.tissues.length; i++ ) {
        this._tissues[i] = data.tissues[i]['PO:tissue'] || {};
        this._tissues[i].long_name = data.tissues[i].tissue;
        this._long_name_map[this._tissues[i]] = data.tissues[i].tissue;
        
        this.spectra[data.tissues[i]['PO:tissue']] = parseInt(data.tissues[i].qty_spectra,10);
    }
};

MASCP.Pep2ProReader.Result.prototype._populate_peptides = function(data)
{
    this.peptide_counts_by_tissue = {};
    if ( ! data || ! data.peptides ) {
        return;
    }
        
    this.sequence = data.sequence;
    this._peptides = [];
    
    for (var i = 0; i < data.peptides.length; i++ ) {
        var a_peptide = data.peptides[i];
        this._peptides.push(a_peptide.sequence);
        var peptide_position = a_peptide.position+'-'+(parseInt(a_peptide.position,10)+parseInt(a_peptide.sequence.length,10));
        for (var j = 0; j < a_peptide.tissues.length; j++ ) {
            var a_tissue = a_peptide.tissues[j];
            if (! this.peptide_counts_by_tissue[a_tissue['PO:tissue']]) {
                this.peptide_counts_by_tissue[a_tissue['PO:tissue']] = {};
            }
            this.peptide_counts_by_tissue[a_tissue['PO:tissue']][peptide_position] = parseInt(a_tissue.qty_spectra,10);
        }
    }
};

MASCP.Pep2ProReader.Result.prototype.render = function()
{
};

MASCP.Pep2ProReader.prototype._rendererRunner = function(sequenceRenderer) {
    var tissues = this.result? this.result.tissues() : [];
    for (var i = (tissues.length - 1); i >= 0; i-- ) {
        var tissue = tissues[i];
        if (this.result.spectra[tissue] < 1) {
            continue;
        }
        var peptide_counts = this.result.peptide_counts_by_tissue[tissue];

        var overlay_name = 'pep2pro_by_tissue_'+tissue;
    
        // var css_block = ' .overlay { display: none; } .active .overlay { display: block; top: 0px; background: #000099; } ';
    
        var css_block = ' .overlay { display: none; } .tracks .active { fill: #000099; } .inactive { display: none; } .active .overlay { display: block; top: 0px; background: #000099; } ';
    
        MASCP.registerLayer(overlay_name,{ 'fullname' : this.result._long_name_map[tissue], 'group' : 'pep2pro', 'color' : '#000099', 'css' : css_block, 'data' : { 'po' : tissue, 'count' : peptide_counts } });
            
        var positions = this._normalise(this._mergeCounts(peptide_counts));
        var index = 1;
        var last_start = null;
        while (index <= positions.length) {
            if ( last_start !== null ) {
                if ((typeof positions[index] === 'undefined') || (index == positions.length)) {
                    sequenceRenderer.getAminoAcidsByPosition([last_start])[0].addBoxOverlay(overlay_name,index-1-last_start);
                    last_start = null;                    
                }
            }
            if (positions[index] > 0 && last_start === null) {
                last_start = index;
            }
            index += 1;
        }
    }
};

MASCP.Pep2ProReader.prototype._groupSummary = function(sequenceRenderer)
{
    var tissues = this.result? this.result.tissues() : [];
    var positions = [];
    
    var tissue_func = function() {
        var tissues = [];
        for (var tiss in this) {
            if (this.hasOwnProperty(tiss)) {
                tissues.push(tiss);
            }
        }
        return tissues.sort().join(',');
    };
    
    for (var tiss in tissues) {
        if (tissues.hasOwnProperty(tiss)) {
            var tissue = tissues[tiss];
            if (this.result.spectra[tissue] < 1) {
                continue;
            }

            var peptide_counts = this._mergeCounts(this.result.peptide_counts_by_tissue[tissue]);

            for (var i = 0; i < peptide_counts.length; i++ ) {
                if ( peptide_counts[i] > 0 ) {
                    if (! positions[i]) {
                        positions[i] = {};
                        positions[i].tissue = tissue_func;
                    }
                    positions[i][tissue] = true;              
                }
            }
        }
    }    

    var index = 0;
    var last_start = null;
    var last_tissue = null;
    
    var overlay_name = 'pep2pro_controller';

    var css_block = ' .overlay { display: none; } .tracks .active { fill: #000099; } .inactive { display: none; } .active .overlay { display: block; top: 0px; background: #000099; } ';
    
    MASCP.registerLayer(overlay_name,{ 'fullname' : 'Pep2Pro MS/MS', 'color' : '#000099', 'css' : css_block });


    var an_agi = this.result.agi;
    var a_locus = an_agi.replace(/\.\d/,'');

    MASCP.getLayer('pep2pro_controller').href = 'http://fgcz-pep2pro.uzh.ch/locus.php?'+a_locus;
    while (index <= positions.length) {
        if ( index <= 0 ) {
            index += 1;
            continue;
        }
        if ((! positions[index] || positions[index].tissue() != last_tissue || (index == positions.length) ) && last_start !== null) {
            var endpoint = index - last_start;
            if ( ! positions[index] ) {
                endpoint -= 1;
            }
            sequenceRenderer.getAminoAcidsByPosition([last_start])[0].addBoxOverlay(overlay_name,endpoint);
            last_start = null;
        }
        if (positions[index] && last_start === null) {
            last_tissue = positions[index].tissue();
            last_start = index;
        }
        index += 1;
    }
    
    if (sequenceRenderer.createGroupController) {
        sequenceRenderer.createGroupController('pep2pro_controller','pep2pro');
    }
};

MASCP.Pep2ProReader.prototype.setupSequenceRenderer = function(sequenceRenderer)
{

    var reader = this;

    this.bind('resultReceived', function() {
        MASCP.registerGroup('pep2pro',{ 'fullname' : 'Pep2Pro data','hide_member_controllers' : true, 'hide_group_controller' : true, 'color' : '#000099' });

        if ( sequenceRenderer.sequence != this.result.sequence && this.result.sequence != '' ) {
            sequenceRenderer.bind('sequenceChange',function() {
                sequenceRenderer.unbind('sequenceChange',arguments.callee);
                reader._groupSummary(sequenceRenderer);
                reader._rendererRunner(sequenceRenderer);
                sequenceRenderer.trigger('resultsRendered',[reader]);
            });
            sequenceRenderer.setSequence(this.result.sequence);
            return;
        } else {
            reader._groupSummary(sequenceRenderer);
            reader._rendererRunner(sequenceRenderer);
            sequenceRenderer.trigger('resultsRendered',[reader]);
        }
    });

    return this;
};

MASCP.Pep2ProReader.prototype._normalise = function(array)
{
    var max_val = 0, i = 0;
    for (i = 0; i < array.length; i++)
    {
        if (array[i] && array[i] > max_val) {
            max_val = array[i];
        }
    }
    for (i = 0; i < array.length; i++)
    {
        if (array[i] && array[i] > 0) {
            array[i] = (array[i] * 1.0) / max_val;
        }
    }
    return array;
};

MASCP.Pep2ProReader.prototype._mergeCounts = function(hash)
{
    var counts = [];
    for (var position in hash) {
        if (hash.hasOwnProperty(position)) {        
            var ends = position.split('-');
            var start = parseInt(ends[0],10);
            var end = parseInt(ends[1],10);
            for (var i = start; i <= end; i++) {
                if ( ! counts[i] ) {
                    counts[i] = 0;
                }
                counts[i] += hash[position];
            }
        }
    }
    return counts;
};/** @fileOverview   Classes for reading data from the Phosphat database
 */
if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

/* http://phosphat.mpimp-golm.mpg.de/PhosPhAtHost30/productive/views/Prediction.php?start=0&limit=50&id=IAMINURDBHACKING&method=getRelatives&sort=sequence&dir=ASC&params=%5B%22atcg00480.1%22%5D */


/** Default class constructor
 *  @class      Service class that will retrieve data from Phosphat for a given AGI.
 *              Data is transferred using the JSON format.
 *  @param      {String} agi            Agi to look up
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */

MASCP.PhosphatReader =  MASCP.buildService(function(data) {
                            if (data && data.result && ! this._sequence) {
                                for (var i = 0; i < data.result.length; i++) {
                                    if (data.result[i].prot_sequence == 'Imported protein - no info') {
                                        var agi = data.result[i].code;
                                        agi = agi.replace(/\s+$/,'');
                                        this._sequence = MASCP.getSequence(agi);
                                        break;
                                    }
                                }
                            }

                            if (data && data.experimental && data.relatives && data.predicted ) {
                                this._raw_data = data;
                                return this;
                            }


                            if (data && data.request_method == 'getPredictedAa') {
                                if (! this._raw_data ) {
                                    this._raw_data = {};
                                }
                                this._raw_data.predicted = data;
                            }
                            if (data && data.request_method == 'getExperimentsModAa') {
                                if (! this._raw_data ) {
                                    this._raw_data = {};
                                }
                                this._raw_data.experimental = data;
                            }
                            if (data && data.request_method == 'getRelatives') {
                                if (! this._raw_data ) {
                                    this._raw_data = {};
                                }
                                this._raw_data.relatives = data;
                            }


                            return this;
                        });

MASCP.PhosphatReader.SERVICE_URL = 'http://gator.masc-proteomics.org/proxy.pl?';

MASCP.PhosphatReader.prototype.requestData = function()
{
    var data = [null,this.agi];

        
    if ( ! this.method && ! this._methods ) {
        this._methods = ['getPredictedAa','getExperimentsModAa','getRelatives'];
    }
    if (this.combine) {
        this._methods = [];
    }

    var method = this._methods[0];

    
    if (method == 'getRelatives') {
        data = [this.agi];
    }

    return {
        type: "POST",
        dataType: "json",
        data: { 'id'        : 1,
                'method'    : method,
                'agi'       : this.agi,
                'params'    : encodeURI(data.toJSON ? data.toJSON() : JSON.stringify(data)),
                'service'   : 'phosphat' 
        }
    };
};

(function(mpr) {
    var defaultDataReceived = mpr.prototype._dataReceived;

    mpr.prototype._dataReceived = function(data,status)
    {
        if (data === null) {
            return defaultDataReceived.call(this,null,status);
        }
        data.request_method = this._methods ? this._methods[0] : null;
        if (this._methods) {
            this._methods.shift();
        }

        if (data.error && data.error.indexOf('SELECT') === 0) {
            data.error = null;
        }
        var res = defaultDataReceived.call(this,data,status);
        if (this.result && this.result._raw_data && this.result._raw_data.experimental && this.result._raw_data.relatives && this.result._raw_data.predicted) {
            this._methods = null;
            return res;
        } else {
            if (res) {
                this.retrieve();
            }
        }
        return;
    };
    
    // var oldToString = mpr.prototype.toString;
    // mpr.prototype.toString = function()
    // {
    //     if ( ! this._methods ) {
    //         this._methods = ['getPredictedAa','getExperimentsModAa','getRelatives'];
    //     }
    //     var string = oldToString.call(this);
    //     string += this._methods[0] ? "."+this._methods[0] : "";
    //     return string;
    // };
    
})(MASCP.PhosphatReader);

/**
 *  @class   Container class for results from the Phosphat service
 *  @extends MASCP.Service.Result
 */
// We need this line for the JsDoc to pick up this class
MASCP.PhosphatReader.Result = MASCP.PhosphatReader.Result;


/** Retrieve an array of positions that phosphorylation has been predicted to occur upon
 *  @returns {Array}    Phosphorylation positions upon the full protein
 */
MASCP.PhosphatReader.Result.prototype.getAllPredictedPositions = function()
{
    var positions = [];
    var result = this._raw_data.predicted.result;
    for ( var prediction_idx in result ) {
        if (result.hasOwnProperty(prediction_idx)) {
            var prediction = this._raw_data.predicted.result[prediction_idx];
            if (prediction.prd_score > 0) {
                positions.push(prediction.prd_position);
            }
        }
    }
    return positions;
};

/** Retrieve an array of positions that phosphorylation has been experimentally verified to occur upon
 *  @returns {Array}    Phosphorylation positions upon the full protein
 */
MASCP.PhosphatReader.Result.prototype.getAllExperimentalPositions = function()
{
    var exp_sites = {};
    var result = this._raw_data.experimental.result;
    for ( var site_idx in result ) {
        if (result.hasOwnProperty(site_idx)) {
            var site = this._raw_data.experimental.result[site_idx];
            var pep_seq = site.pep_sequence || '';
            pep_seq = pep_seq.replace(/[^A-Z]/g,'');
            if (site.modificationType != 'phos') {
                continue;
            }
            var prot_seq = this._sequence || site.prot_sequence;
            var site_id = prot_seq.indexOf(pep_seq);
            if (site_id < 0) {
                continue;
            }
            site_id += site.position;
            exp_sites[site_id] = 1;
        }
    }
    var positions = [];
    for ( var i in exp_sites ) {
        if (exp_sites.hasOwnProperty(i)) {
            positions.push(parseInt(i,10));
        }
    }
    return positions;
};

MASCP.PhosphatReader.Result.prototype.getAllExperimentalPhosphoPeptides = function()
{
    var results = {};
    var result = this._raw_data.experimental.result;
    for ( var site_idx in result ) {
        if (result.hasOwnProperty(site_idx)) {
            var site = this._raw_data.experimental.result[site_idx];
            var pep_seq = site.pep_sequence || '';
            pep_seq = pep_seq.replace(/[^A-Z]/g,'');
        
            if (site.modificationType != 'phos') {
                continue;
            }
            var prot_seq = this._sequence || site.prot_sequence;
            var site_id = prot_seq.indexOf(pep_seq);
            if (site_id >= 0) {
                var id =''+site_id+"-"+pep_seq.length;
                results[id] = results[id] || [site_id,pep_seq.length];
                if (results[id].indexOf(site.position+site_id,2) <= 0) {
                    results[id].push(site.position+site_id);
                }
            }
        }
    }
    var results_arr = [];
    for (var a_site in results ) {
        if (results.hasOwnProperty(a_site)) {
            results_arr.push(results[a_site]);
        }
    }
    return results_arr;
};

MASCP.PhosphatReader.Result.prototype.getSpectra = function()
{
    if (! this._raw_data.relatives || ! this._raw_data.relatives.result) {
        return {};
    }
    var results = {};
    var experiments = this._raw_data.relatives.result;
    for (var i = 0; i < experiments.length; i++ ) {
        var tiss = experiments[i].Tissue;
        if ( ! results[tiss] ) {
            results[tiss] = 0;
        }
        results[tiss] += 1;
    }
    return results;
};

MASCP.PhosphatReader.Result.prototype.render = function()
{
    return null;
};

MASCP.PhosphatReader.prototype.setupSequenceRenderer = function(sequenceRenderer)
{
    var reader = this;
    
    this.bind('resultReceived', function() {
        var icons = [];

        var exp_peptides = this.result.getAllExperimentalPhosphoPeptides();
        if (exp_peptides.length === 0) {
            sequenceRenderer.trigger('resultsRendered',[reader]);
            return;         
        }

        MASCP.registerLayer('phosphat_experimental', { 'fullname': 'PhosPhAt (mod)', 'color' : '#000000', 'css' : '.active { background: #999999; color: #000000; font-weight: bolder; } .tracks .active { background: #000000; fill: #000000; } .inactive { display: none; }' });
        MASCP.registerGroup('phosphat_peptides', { 'fullname' : 'PhosPhAt peptides' });

        if (sequenceRenderer.createGroupController) {
            sequenceRenderer.createGroupController('phosphat_experimental','phosphat_peptides');
        }
        exp_peptides.forEach(function(pep,i) {
            MASCP.registerLayer('phosphat_peptide_'+i, { 'fullname': 'PhosPhAt MS/MS', 'group':'phosphat_peptides', 'color' : '#000000', 'css' : '.active { background: #999999; color: #000000; } .tracks .active { background: #000000; fill: #000000; } .inactive { display: none; }' });

            var start = pep.shift();
            var end = pep.shift();
            var aa = sequenceRenderer.getAminoAcidsByPosition([start+1])[0];
            if (aa) {
                aa.addBoxOverlay('phosphat_peptide_'+i,end,0.5);
                icons.push(aa.addBoxOverlay('phosphat_experimental',end,0.5));
            }
	        sequenceRenderer.getAminoAcidsByPosition(this).forEach(function(aa) {
	            aa.addToLayer('phosphat_peptide_'+i, { 'height' : 20, 'offset': -2.5 });
	            icons = icons.concat(aa.addToLayer('phosphat_experimental',{ 'height' : 20, 'offset': -2.5}));
	        });
        });


        bean.add(MASCP.getGroup('phosphat_peptides'),'visibilityChange',function(rend,vis) {
            if (rend != sequenceRenderer) {
                return;
            }
            icons.forEach(function(el) {
                if (! el.style ) {
                    el.setAttribute('style','');
                }
                el.style.display = vis ? 'none' : 'inline';
            });
        });
        
        if (MASCP.getLayer('phosphat_experimental')) {
            MASCP.getLayer('phosphat_experimental').href = 'http://phosphat.mpimp-golm.mpg.de/app.html?agi='+this.result.agi;        
        }
        
        sequenceRenderer.trigger('resultsRendered',[reader]);
    });
    return this;
};
/**
 *  @fileOverview Classes for reading data from the PlantsP database using XML data
 */

/**
 * @class   Service class that will retrieve PlantsP data for this entry given an AGI.
 * @description Default class constructor
 * @param   {String} agi            Agi to look up
 * @param   {String} endpointURL    Endpoint URL for this service
 * @extends MASCP.Service
 */
 
MASCP.PpdbReader = MASCP.buildService(function(data) {
                        if (! data ) {
                            return this;
                        }
                        var extractData = function()
                        {
                            var features = this._raw_data.getElementsByTagName('FEATURE');

                            var peptides = [];

                            var peps_by_seq = {};
                            var all_experiments = {};
                            for (var i = 0 ; i < features.length; i++ ) {
                                var type = features[i].getElementsByTagName('TYPE')[0];
                                var textcontent = type.textContent || type.text || type.nodeValue;
                                if ( textcontent == 'Peptide') {
                                    var seq = features[i].getAttribute('label');
                                    if ( ! peps_by_seq[seq] ) {
                                        peps_by_seq[seq] = { 'experiments' : [] };
                                    }
                                    var exp_id = parseInt(features[i].getElementsByTagName('GROUP')[0].getAttribute('id'),10);
                                    peps_by_seq[seq].experiments.push(exp_id);
                                    all_experiments[exp_id] = true;            
                                }
                            }
                            for (var pep in peps_by_seq) {
                                if (peps_by_seq.hasOwnProperty(pep)) {
                                    var pep_obj =  { 'sequence' : pep , 'experiments' : peps_by_seq[pep].experiments };
                                    peptides.push(pep_obj);
                                }
                            }

                            this._experiments = [];
                            for (var expid in all_experiments) {
                                if (all_experiments.hasOwnProperty(expid)) {
                                    this._experiments.push(parseInt(expid,10));
                                }
                            }

                            return peptides;
                        };
                        this._raw_data = data;
                        if (data.getElementsByTagName) {
                            var peps = extractData.call(this);
                            this._raw_data = {
                                'experiments' : this._experiments,
                                'peptides'    : peps
                            };
                        }
                        this._experiments = this._raw_data.experiments;
                        this._peptides    = this._raw_data.peptides;
                        return this;
                    });

MASCP.PpdbReader.prototype.requestData = function()
{
    var self = this;
    var agi = (this.agi+"").replace(/\..*$/,'');
    var dataType = 'json';
    if ((this._endpointURL || '').indexOf('xml') >= 0) {
        dataType = 'xml';
    }
    return {
        type: "GET",
        dataType: dataType,
        data: { 'segment'   : agi,
                'agi'       : this.agi,
                'service'   : 'ppdb'
        }
    };
};


MASCP.PpdbReader.SERVICE_URL = 'http://ppdb.tc.cornell.edu/das/arabidopsis/features/?output=xml'; /* ?segment=locusnumber */

/**
 * @class   Container class for results from the Ppdb service
 * @extends MASCP.Service.Result
 */
// We need this line for the JsDoc to pick up this class
MASCP.PpdbReader.Result = MASCP.PpdbReader.Result;

MASCP.PpdbReader.Result.prototype = MASCP.extend(MASCP.PpdbReader.Result.prototype,
/** @lends MASCP.PpdbReader.Result.prototype */
{
    /** @field 
     *  @description Hash keyed by tissue name containing the number of spectra for each tissue for this AGI */
    spectra :   null,
    /** @field
     *  @description Hash keyed by the Plant Ontology ID containing the number of spectra for each peptide (keyed by "start-end" position) */
    peptide_counts_by_tissue : null,
    /** @field
     *  @description String containing the sequence for the retrieved AGI */
    sequence : null
});

MASCP.PpdbReader.Result.prototype.render = function()
{
    return null;
};

MASCP.PpdbReader.Result.prototype.getExperiments = function()
{
    return this._experiments || [];
};

MASCP.PpdbReader.Result.prototype.getPeptides = function()
{
    var peps = this._peptides || [];
    peps.forEach(function(pep_obj) {
        pep_obj.toString = function(p) {
            return function() {
                return p.sequence;
            };
        }(pep_obj);
    });
    return peps;
};


MASCP.PpdbReader.prototype.setupSequenceRenderer = function(sequenceRenderer)
{
    var reader = this;
    
    this.bind('resultReceived', function() {
        
//        
        MASCP.registerGroup('ppdb', {'fullname' : 'PPDB spectra data', 'hide_member_controllers' : true, 'hide_group_controller' : true, 'color' : '#aa9900' });

        var overlay_name = 'ppdb_controller';

        var css_block = '.active .overlay { background: #aa9900; } .active a { color: #000000; text-decoration: none !important; }  :indeterminate { background: #ff0000; } .tracks .active { background: #0000ff; } .inactive a { text-decoration: none; } .inactive { display: none; }';

        MASCP.registerLayer(overlay_name,{ 'fullname' : 'PPDB MS/MS', 'color' : '#aa9900', 'css' : css_block });

        if (sequenceRenderer.createGroupController) {
            sequenceRenderer.createGroupController('ppdb_controller','ppdb');
        }
        
        var peps = this.result.getPeptides();
        var experiments = this.result.getExperiments();
        for(var i = 0; i < experiments.length; i++) {
            var layer_name = 'ppdb_experiment'+experiments[i];
            MASCP.registerLayer(layer_name, { 'fullname': 'Experiment '+experiments[i], 'group' : 'ppdb', 'color' : '#aa9900', 'css' : css_block });
            MASCP.getLayer(layer_name).href = 'http://ppdb.tc.cornell.edu/dbsearch/searchsample.aspx?exprid='+experiments[i];
            for (var j = 0 ; j < peps.length; j++) {
                var peptide = peps[j];
                if (peps[j].experiments.indexOf(experiments[i]) < 0) {
                    continue;
                }
                var peptide_bits = sequenceRenderer.getAminoAcidsByPeptide(peptide.sequence);
                peptide_bits.addToLayer(layer_name);
                peptide_bits.addToLayer(overlay_name);
            }
        }
        sequenceRenderer.trigger('resultsRendered',[reader]);        



    });
    return this;
};
/** @fileOverview   Classes for reading data from the Processing data
 */
if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

/** Default class constructor
 *  @class      Service class that will retrieve data from the Processing data for a given AGI.
 *  @param      {String} agi            Agi to look up
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.ProcessingReader = MASCP.buildService(function(data) {
                        this._raw_data = data;
                        return this;
                    });

MASCP.ProcessingReader.SERVICE_URL = '?';

MASCP.ProcessingReader.prototype.requestData = function()
{
    var agi = this.agi;
    
    return {
        type: "GET",
        dataType: "json",
        data: { 'agi'       : agi,
                'service'   : 'processing' 
        }
    };
};

/**
 *  @class   Container class for results from the Processing service
 *  @extends MASCP.Service.Result
 */
// We need this line for the JsDoc to pick up this class
MASCP.ProcessingReader.Result = MASCP.ProcessingReader.Result;

/** Retrieve the peptides for this particular entry from the Processing service
 *  @returns Array of peptide strings
 *  @type [String]
 */
MASCP.ProcessingReader.Result.prototype.getProcessing = function()
{
    var content = null;
    if (! this._raw_data || ! this._raw_data.data || ! this._raw_data.data.processing ) {
        return [];
    }

    return this._raw_data.data.processing;
};

MASCP.ProcessingReader.Result.prototype._cleanSequence = function(sequence)
{
    return sequence.replace(/[^A-Z]/g,'');
};

MASCP.ProcessingReader.prototype.setupSequenceRenderer = function(sequenceRenderer)
{
    var reader = this;

    var css_block = '.active .overlay { background: #666666; } .active a { color: #000000; text-decoration: none !important; }  :indeterminate { background: #ff0000; } .tracks .active { background: #0000ff; } .inactive a { text-decoration: none; } .inactive { display: none; }';
    
    this.bind('resultReceived', function() {
        var pep = this.result.getProcessing();
        var pos = sequenceRenderer.sequence.indexOf(pep);
        if (pos < 0) {
            return;
        }
        MASCP.registerLayer('processing',{ 'fullname' : 'N-Terminal (mod)', 'color' : '#ffEEEE', 'css' : css_block });
        var aa = sequenceRenderer.getAA(pos+1+pep.length);
        if (aa) {
            aa.addAnnotation('processing',1, { 'border' : 'rgb(150,0,0)', 'content' : 'Mat', 'angle': 0 });
        }

        sequenceRenderer.trigger('resultsRendered',[reader]);
    });
    return this;
};

MASCP.ProcessingReader.Result.prototype.render = function()
{
};/** @fileOverview   Classes for reading data from the Promex database
 */
if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

/** Default class constructor
 *  @class      Service class that will retrieve data from Promex for a given AGI.
 *              Data is transferred using XML.
 *  @param      {String} agi            Agi to look up
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.PromexReader = MASCP.buildService(function(data) {
                        this._raw_data = data;                        
                        return this;
                    });

MASCP.PromexReader.SERVICE_URL = 'http://131.130.57.242/json/?';

MASCP.PromexReader.prototype.requestData = function()
{
    var agi = (this.agi+"").replace(/\..*$/,'');
    
    return {
        type: "GET",
        dataType: "json",
        data: { 'agi'       : this.agi,
                'ac'        : agi,
                'service'   : 'promex' 
        }
    };
};

/**
 *  @class   Container class for results from the Promex service
 *  @extends MASCP.Service.Result
 */
// We need this line for the JsDoc to pick up this class
MASCP.PromexReader.Result = MASCP.PromexReader.Result;

/** Retrieve the peptides for this particular entry from the Promex service
 *  @returns Array of peptide strings
 *  @type [String]
 */
MASCP.PromexReader.Result.prototype.getPeptides = function()
{
    var content = null;
    
    if (! this._raw_data || ! this._raw_data.peptides ) {
        return [];
    }    
    var peptides = [];
    for (var i = 0; i < this._raw_data.peptides.length; i++ ) {
        peptides.push(this._cleanSequence(this._raw_data.peptides[i].sequence));
    }
    return peptides;
};

MASCP.PromexReader.Result.prototype._cleanSequence = function(sequence)
{
    return sequence.replace(/[^A-Z]/g,'');
};

MASCP.PromexReader.prototype.setupSequenceRenderer = function(sequenceRenderer)
{
    var reader = this;
    MASCP.registerGroup('promex_experimental', {'fullname' : 'ProMex spectra data', 'hide_member_controllers' : true, 'hide_group_controller' : true, 'color' : '#ff9900' });

    var overlay_name = 'promex_controller';

    var css_block = '.active .overlay { background: #ff9900; } .active a { color: #000000; text-decoration: none !important; }  :indeterminate { background: #ff0000; } .tracks .active { background: #0000ff; } .inactive a { text-decoration: none; } .inactive { display: none; }';
    
    MASCP.registerLayer(overlay_name,{ 'fullname' : 'ProMEX MS/MS', 'color' : '#ff9900', 'css' : css_block });


    this.bind('resultReceived', function() {
        var agi = (this.result.agi+"").replace(/\..*$/,'');
        
        MASCP.getLayer('promex_controller').href = 'http://promex.pph.univie.ac.at/promex/?ac='+agi;
        
        // var css_block = '.active { background: #ff9900; color: #ffffff;} :indeterminate { background: #ff0000; } .active a:hover { background: transparent !important; } .inactive { }';
        var peps = this.result.getPeptides();
        for(var i = 0; i < peps.length; i++) {
            MASCP.registerLayer('promex_experimental_spectrum_'+i, { 'fullname': 'Spectrum', 'group' : 'promex_experimental', 'color' : '#ff9900', 'css' : css_block });
            var peptide = peps[i];
            var peptide_bits = sequenceRenderer.getAminoAcidsByPeptide(peptide);
            if ( ! peptide_bits || peptide_bits.length === 0 ) {
                continue;
            }
            var layer_name = 'promex_experimental_spectrum_'+i;
            peptide_bits.addToLayer(layer_name);
            peptide_bits.addToLayer(overlay_name);
        }
        sequenceRenderer.trigger('resultsRendered',[reader]);        

        if (sequenceRenderer.createGroupController) {
            sequenceRenderer.createGroupController('promex_controller','promex_experimental');
        }


    });
    return this;
};

MASCP.PromexReader.Result.prototype.render = function()
{
};/** @fileOverview   Classes for reading data from the Rippdb database
 */
if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

/** Default class constructor
 *  @class      Service class that will retrieve data from Rippdb for a given AGI.
 *  @param      {String} agi            Agi to look up
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.RippdbReader = MASCP.buildService(function(data) {
                        this._raw_data = data;                        
                        return this;
                    });

MASCP.RippdbReader.SERVICE_URL = 'http://gator.masc-proteomics.org/rippdb.pl?';

MASCP.RippdbReader.prototype.requestData = function()
{
    var agi = this.agi;
    
    return {
        type: "GET",
        dataType: "json",
        data: { 'agi'       : agi,
                'service'   : 'rippdb' 
        }
    };
};

/**
 *  @class   Container class for results from the Rippdb service
 *  @extends MASCP.Service.Result
 */
// We need this line for the JsDoc to pick up this class
MASCP.RippdbReader.Result = MASCP.RippdbReader.Result;

/** Retrieve the peptides for this particular entry from the Rippdb service
 *  @returns Array of peptide strings
 *  @type [String]
 */
MASCP.RippdbReader.Result.prototype.getSpectra = function()
{

    if (! this._raw_data || ! this._raw_data.spectra ) {
        return [];
    }


    return this._raw_data.spectra;
};

MASCP.RippdbReader.Result.prototype._cleanSequence = function(sequence)
{
    return sequence.replace(/[^A-Z]/g,'');
};

MASCP.RippdbReader.prototype.setupSequenceRenderer = function(sequenceRenderer)
{
    var reader = this;

    var css_block = '.active .overlay { background: #666666; } .active a { color: #000000; text-decoration: none !important; }  :indeterminate { background: #ff0000; } .tracks .active { background: #0000ff; } .inactive a { text-decoration: none; } .inactive { display: none; }';
    
    this.bind('resultReceived', function() {
        var specs = this.result.getSpectra();

        var overlay_name = 'prippdb_experimental';
        var icons = [];
        
        if (specs.length > 0) {
            MASCP.registerLayer(overlay_name,{ 'fullname' : 'RIPP-DB (mod)', 'color' : '#666666', 'css' : css_block });

            MASCP.registerGroup('prippdb_peptides', {'fullname' : 'Phosphorylation Rippdb', 'hide_member_controllers' : true, 'hide_group_controller' : true, 'color' : '#666666' });
            if (sequenceRenderer.createGroupController) {
                sequenceRenderer.createGroupController('prippdb_experimental','prippdb_peptides');
            }
            
            bean.add(MASCP.getGroup('prippdb_peptides'),'visibilityChange',function(rend,vis) {
                if (rend != sequenceRenderer) {
                    return;
                }
                icons.forEach(function(el) {
                    el.style.display = vis ? 'none' : 'inline';
                });
            });
            
            
        }

        for (var j = 0; j < specs.length; j++ ) {
            var spec = specs[j];
            
            var peps = spec.peptides;
            if (peps.length === 0) {
                continue;
            }
            var layer_name = 'prippdb_spectrum_'+spec.spectrum_id;
            MASCP.registerLayer(layer_name, { 'fullname': 'Spectrum '+spec.spectrum_id, 'group' : 'prippdb_peptides', 'color' : '#666666', 'css' : css_block });
            for(var i = 0; i < peps.length; i++) {
                var peptide = peps[i].sequence;
                var peptide_bits = sequenceRenderer.getAminoAcidsByPeptide(peptide);
                if (peptide_bits.length === 0){
                    continue;
                }
                peptide_bits.addToLayer(layer_name);
                icons.push(peptide_bits.addToLayer('prippdb_experimental'));

                for (var k = 0; k < peps[i].positions.length; k++ ) {
                    icons = icons.concat(peptide_bits[peps[i].positions[k] - 1].addToLayer('prippdb_experimental',{ 'height' : 20, 'offset': -2.5 }));
                    peptide_bits[peps[i].positions[k] - 1].addToLayer(layer_name,{ 'height' : 20, 'offset': -2.5 });
                }

            }
        }
        sequenceRenderer.trigger('resultsRendered',[reader]);
    });
    return this;
};
/** Retrieve an array of positions that phosphorylation has been experimentally verified to occur upon
 *  @returns {Array}    Phosphorylation positions upon the full protein
 */
MASCP.RippdbReader.Result.prototype.getAllExperimentalPositions = function()
{
    var specs = this.getSpectra();
    var results = [];
    var seen = {};
    specs.forEach(function(spec) {
        var peps = spec.peptides;
        peps.forEach(function(pep) {
            pep.positions.forEach(function(pos) {
                if ( ! seen[pos] ) {
                    results.push(pos);
                    seen[pos] = true;
                }
            });
        });
    });
    return results;
}
MASCP.RippdbReader.Result.prototype.render = function()
{
};/**
 * @fileOverview    Classes for reading SNP data
 */

if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}



/** Default class constructor
 *  @class      Service class that will retrieve sequence data for a given AGI from a given ecotype
 *  @param      {String} agi            Agi to look up
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.SnpReader = MASCP.buildService(function(data) {
                        this._raw_data = data || {};
                        return this;
                    });

MASCP.SnpReader.SERVICE_URL = 'http://gator.masc-proteomics.org/snps.pl?';

MASCP.SnpReader.prototype.requestData = function()
{
    var self = this;
    return {
        type: "GET",
        dataType: "json",
        data: { 'agi'   : this.agi,
                'service' : 'nssnps' 
        }
    };
};

MASCP.SnpReader.prototype.showSnp = function(renderer,acc) {
    var diffs = this.result.getSnp(acc);
    if (diffs.length < 1) {
        return;
    }


    var in_layer = 'all'+acc;

    var ins = [];
    var outs = [];

//    renderer.registerLayer(in_layer, {'fullname' : acc, 'group' : 'all_insertions' });

    var i;
    for (i = diffs.length - 1 ; i >= 0 ; i-- ){
        outs.push( { 'index' : diffs[i][0], 'delta' : diffs[i][1] });
        ins.push( { 'insertBefore' : diffs[i][0] + 1, 'delta' : diffs[i][2] });
    }

    for (i = ins.length - 1; i >= 0 ; i-- ) {
        renderer.getAA(ins[i].insertBefore - 1).addAnnotation(in_layer,1, { 'border' : 'rgb(150,0,0)', 'content' : ins[i].delta });
    }

    // for (var i = 0; i < outs.length; i++) {
    //     renderer.getAA(outs[i].index).addAnnotation(in_layer,1, {'angle' : 90, 'border' : 'rgb(0,0,150)', 'content' : outs[i].delta });
    // }
    
};

MASCP.SnpReader.ALL_ACCESSIONS = ["AGU","BAK2","BAY","BUR0","CDM0","COL0","DEL10","DOG4","DON0","EY152","FEI0","HKT24","ICE1","ICE102","ICE104","ICE106","ICE107","ICE111","ICE112","ICE119","ICE120","ICE127","ICE130","ICE134","ICE138","ICE150","ICE152","ICE153","ICE163","ICE169","ICE173","ICE181","ICE21","ICE212","ICE213","ICE216","ICE226","ICE228","ICE29","ICE33","ICE36","ICE49","ICE50","ICE60","ICE61","ICE63","ICE7","ICE70","ICE71","ICE72","ICE73","ICE75","ICE79","ICE91","ICE92","ICE93","ICE97","ICE98","ISTISU1","KASTEL1","KOCH1","KRO0","LAG22","LEO1","LER1","LERIK13","MER6","NEMRUT1","NIE12","PED0","PRA6","QUI0","RI0","RUE3131","SHA","STAR8","TUESB303","TUESCHA9","TUEV13","TUEWA12","VASH1","VIE0","WALHAESB4","XAN1"];


MASCP.SnpReader.prototype.setupSequenceRenderer = function(renderer) {
    var reader = this;
    
    reader.bind('resultReceived', function() {
        var a_result = reader.result;

        MASCP.registerGroup('insertions');
        MASCP.registerGroup('deletions');

        renderer.withoutRefresh(function() {        
        var insertions_layer;

        var accessions = a_result.getAccessions();
        
        while (accessions.length > 0) {

            var acc = accessions.shift();
            var acc_fullname = acc;

            var diffs = a_result.getSnp(acc);

            if (diffs.length < 1) {
                continue;
            }
            if ( ! insertions_layer ) {
                insertions_layer = renderer.registerLayer('insertions_controller',{'fullname' : 'nsSNPs','color' : '#ff0000'});                
            }


            var in_layer = 'all'+acc;
            var group_layer = acc.indexOf('_') >= 0 ? (acc.split('_')[0]).toUpperCase() : null;

            if (['SALK','MPICAO','GMI','MPISCHNEE','MPICOLLAB', 'JGI'].indexOf(group_layer) < 0) {
                group_layer = null;
            } else {
                if (group_layer.match(/^MPI/)) {
                    group_layer = 'MPI';
                }
                acc_fullname = acc.replace(/^[^_]+_/,'');
            }

            var ins = [];
            var outs = [];

            if (group_layer) {
                MASCP.registerGroup(group_layer, {'group' : 'insertions'});
                renderer.registerLayer(group_layer+'_controller', {'fullname' : group_layer, 'group' : 'insertions' , 'color' : '#ff0000'});
                if (renderer.createGroupController && group_layer) {
                    renderer.createGroupController(group_layer+'_controller',group_layer);
                }
                
            }

            var acc_layer = renderer.registerLayer(in_layer, {'fullname' : acc_fullname, 'group' : group_layer || 'insertions' });
            
            (function(this_acc) {
                return function() {
                    var visible = false;
                    var tempname = in_layer;
                    acc_layer.href = function(is_visible) {
                        visible = (typeof is_visible == 'boolean') ? is_visible : ! visible;
                        if (visible) {
                            MASCP.getLayer(tempname).icon = '#minus_icon';
                            reader.showSnp(MASCP.renderer,this_acc);
                        } else {
                            MASCP.getLayer(tempname).icon = '#plus_icon';
                            MASCP.renderer.removeAnnotations(tempname);
                            MASCP.renderer.redrawAnnotations();
                        }
                        MASCP.renderer.refresh();
                        return false;
                    };
                };
            }(acc))();
            
            MASCP.getLayer(in_layer).icon = null;
            var i;
            for (i = diffs.length - 1; i >= 0 ; i-- ){
                outs.push( { 'index' : diffs[i][0] + 1, 'delta' : diffs[i][1] });
                ins.push( { 'insertBefore' : diffs[i][0] + 1, 'delta' : diffs[i][2] });
            }

            for (i = ins.length - 1; i >= 0 ; i-- ) {
                var pos = ins[i].insertBefore - 1;
                if (pos > renderer.sequence.length) {
                    pos = renderer.sequence.length;
                }
                var ann = renderer.getAA(pos).addAnnotation('insertions_controller',1, { 'border' : 'rgb(150,0,0)', 'content' : ins[i].delta, 'angle': 0 });
                if (! ann._click) {
                    ann.addEventListener('click',(function(posn) {
                        var visible = false;
                        return function() {
                            visible = ! visible;
                            renderer.withoutRefresh(function() {
                                reader.result.getSnpsForPosition(posn).forEach(function(an_acc) {
                                    reader.showSnp(MASCP.renderer,an_acc);
                                    MASCP.getLayer('all'+an_acc).href(visible);
                                });
                            });
                            renderer.refresh();
                        };
                    })(pos),false);
                    ann.style.cursor = 'pointer';
                    ann._click = true;
                }
            }
        
        }
        
        if (MASCP.getGroup('insertions').size() > 0) {
        
            if (renderer.createGroupController) {
                renderer.createGroupController('insertions_controller','insertions');
            }
        }
        });
        renderer.redrawAnnotations('insertions_controller');
        renderer.trigger('resultsRendered',[reader]);
        
    });
};

MASCP.SnpReader.Result.prototype.getAccessions = function() {
    var snps_data = this._raw_data.data;
    var results = [];
    for (var acc in snps_data) {
        if (snps_data.hasOwnProperty(acc)) {
            results.push(acc);
        }
    }
    return results;
};

MASCP.SnpReader.Result.prototype.getSnp = function(accession) {
    var snps_data = this._raw_data.data[accession];
    var results = [];
    for (var pos in snps_data) {
        if (snps_data.hasOwnProperty(pos)) {
            var position = parseInt(pos,10)+1;
            var changes = snps_data[pos];
            var a_result = [ position, changes.charAt(0), changes.charAt(1)];
            results.push(a_result);
        }
    }
    return results;
};

MASCP.SnpReader.Result.prototype.getSnpsForPosition = function(position) {
    var self = this;
    this._cached = this._cached || {};
    if (this._cached[position]) {
        return this._cached[position];
    }
    var results = [];
    this.getAccessions().forEach(function(acc) {
        self.getSnp(acc).forEach(function(snp) {
            if (snp[0] == position) {
                results.push(acc);
                return;
            }
        });
    });
    this._cached[position] = results;
    return results;
};

MASCP.cloneService(MASCP.SnpReader,"RnaEditReader");

MASCP.RnaEditReader.SERVICE_URL = '?';

MASCP.RnaEditReader.prototype.requestData = function()
{
    var self = this;
    return {
        type: "GET",
        dataType: "json",
        data: { 'agi'   : this.agi,
                'service' : 'rnaedit' 
        }
    };
};

MASCP.RnaEditReader.prototype.setupSequenceRenderer = function(renderer) {
    var reader = this;
    
    reader.bind('resultReceived', function() {
        var a_result = reader.result;
        renderer.withoutRefresh(function() {        
        var insertions_layer;

        var accessions = a_result.getAccessions();
        while (accessions.length > 0) {

            var acc = accessions.shift();
            var acc_fullname = acc;

            var diffs = a_result.getSnp(acc);

            if (diffs.length < 1) {
                continue;
            }

            var in_layer = 'rnaedit';

            var ins = [];
            var outs = [];
            var acc_layer = renderer.registerLayer(in_layer, {'fullname' : 'RNA Edit (mod)' });

            MASCP.getLayer(in_layer).icon = null;
            var i;

            for (i = diffs.length - 1; i >= 0 ; i-- ){
                outs.push( { 'index' : diffs[i][0] + 1, 'delta' : diffs[i][1] });
                ins.push( { 'insertBefore' : diffs[i][0] + 1, 'delta' : diffs[i][2] });
            }
            
            for (i = ins.length - 1; i >= 0 ; i-- ) {
                var pos = ins[i].insertBefore - 1;
                if (pos > renderer.sequence.length) {
                    pos = renderer.sequence.length;
                }
                renderer.getAA(pos).addAnnotation('rnaedit',1, { 'border' : 'rgb(150,0,0)', 'content' : ins[i].delta, 'angle': 'auto' });
            }
        }
        
        });
        renderer.trigger('resultsRendered',[reader]);
    });
};

/**
 * @fileOverview    Classes for reading data from the Suba database
 */

if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}


/** Default class constructor
 *  @class      Service class that will retrieve data from SUBA for a given AGI.
 *              Data is transferred using JSON.
 *  @param      {String} agi            Agi to look up
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.SubaReader = MASCP.buildService(function(data) {
                        this._raw_data = data;
                        return this;
                    });

MASCP.SubaReader.SERVICE_URL = 'http://suba.plantenergy.uwa.edu.au/services/byAGI.php?';

MASCP.SubaReader.prototype.requestData = function()
{
    return {
        type: "GET",
        dataType: "json",
        data: { 'agi'       : this.agi,
                'service'   : 'suba' 
        }
    };
};

/**
 *  @class   Container class for results from the Promex service
 *  @extends MASCP.Service.Result
 */
// We need this line for the JsDoc to pick up this class
MASCP.SubaReader.Result = MASCP.SubaReader.Result;

/**#@+
 * @memberOf MASCP.SubaReader.Result.prototype
 */
MASCP.SUBA_FIELDS =
{
    /** @name location_gfp */
    location_gfp        :   null,
    /** @name location_ipsort */
    location_ipsort     :   null,
    /** @name location_loctree */
    location_loctree    :   null,
    /** @name location_mitopred */
    location_mitopred   :   null,
    /** @name location_mitoprot2 */
    location_mitoprot2  :   null,
    /** @name location_ms */
    location_ms         :   null,
    /** @name location_multiloc */
    location_multiloc   :   null,
    /** @name location_preoxp */
    location_preoxp     :   null,
    /** @name location_predotar */
    location_predotar   :   null,
    /** @name location_subloc */
    location_subloc     :   null,
    /** @name location_swissprot */
    location_swissprot  :   null,
    /** @name location_targetp */
    location_targetp    :   null,
    /** @name location_wolfpsort */
    location_wolfpsort  :   null
};

/**#@-*/


MASCP.SubaReader.Result.prototype._getLocalisation = function(localisation)
{
    var results = {};
    var any_data = false;
    for (var i = 0; i < this._raw_data.observed.length; i++) {
        var obs = this._raw_data.observed[i];
        if (obs[2] == localisation) {
            if (! results[obs[0]]) {
                results[obs[0]] = [];
            }
            results[obs[0]].push(obs[1]);
            any_data = true;
        }
    }
    if ( ! any_data ) {
        return null;
    }
    return results;
};

MASCP.SubaReader.Result.prototype._parseLocalisation = function(localisation)
{
    if (localisation === null || localisation.length === 0 )
    {
        return null;
    }
    var experiments = localisation.split(';');
    var tissues = {};
    var i;
    for (i = experiments.length - 1; i >= 0; i--) {
        var data = experiments[i].split(':');
        tissues[data[0]] = tissues[data[0]] || [];
        tissues[data[0]].push(data[1]);
    }
    return tissues;
};

MASCP.SubaReader.Result.prototype._sortLocalisation = function(loc_data)
{
    var loc_keys = [];
    for (var i in loc_data) {
        if (loc_data.hasOwnProperty(i)) {
            loc_keys.push(i);
        }
    }
    loc_keys = loc_keys.sort(function(a,b) {
        return loc_data[a].length - loc_data[b].length;
    });
    
    return loc_keys;    
};

/** Retrieve the mass spec localisation for this AGI
 *  @returns [ { String : [String] } ]   Mass Spec localisation and array of Pubmed IDs
 */
MASCP.SubaReader.Result.prototype.getMassSpecLocalisation = function()
{
    return this._getLocalisation('ms');
};


/** Retrieve the GFP localisation for this AGI
 *  @returns [ {String : [String] }  ]   GFP localisation and array of Pubmed IDs
 */
MASCP.SubaReader.Result.prototype.getGfpLocalisation = function()
{
    return this._getLocalisation('gfp');
};

MASCP.SubaReader.Result.prototype.getWinnerTakesAllGfp = function()
{
    var vals = this.getGfpLocalisation();
    var locs = (this._sortLocalisation(vals));
    var results = [];
    var last_val = -1;
    var i;
    for ( i = locs.length - 1; i >= 0; i-- ) {
        if (last_val && vals[locs[i]] == last_val) {
            results.push(locs[i]);
        } else if (last_val < 0) {
            last_val = vals[locs[i]];
            results.push(locs[i]);
        } else {
            break;
        }
    }
    results._values = [];
    for (i = results.length - 1; i >= 0; i-- ) {
        results._values.push(vals[results[i]].length);
    }
    return results;
};

MASCP.SubaReader.Result.prototype.getWinnerTakesAllMassSpec = function()
{
    var vals = this.getMassSpecLocalisation();
    var locs = (this._sortLocalisation(vals));
    var results = [];
    var last_val = -1;
    var i;
    for (i = locs.length - 1; i >= 0; i-- ) {
        if (last_val && vals[locs[i]] == last_val) {
            results.push(locs[i]);
        } else if (last_val < 0) {
            last_val = vals[locs[i]];
            results.push(locs[i]);
        } else {
            break;
        }
    }
    results._values = [];
    for ( i = results.length - 1; i >= 0; i-- ) {
        results._values.push(vals[results[i]].length);
    }
    return results;
};

/** Retrieve the set of predicted localisations for this AGI
 *  @returns [ { String : [String] } ]   Predicted localisation and array of methods
 */
MASCP.SubaReader.Result.prototype.getPredictedLocalisations = function()
{
    var results = {};
    for (var i = 0; i < this._raw_data.predicted.length; i++) {
        if ( ! results[this._raw_data.predicted[i][0]]) {
            results[this._raw_data.predicted[i][0]] = [];
        }
        results[this._raw_data.predicted[i][0]].push(this._raw_data.predicted[i][1]);        
    }
    return results;    
};

MASCP.SubaReader.Result.prototype.mapController = function(inputElement)
{
    console.log("Deprecated mapController");
};

MASCP.SubaReader.Result.prototype.render = function()
{
    return null;
};/**
 * @fileOverview    Classes for reading data from TAIR database
 */

if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}



/** Default class constructor
 *  @class      Service class that will retrieve data from TAIR for a given AGI.
 *  @param      {String} agi            Agi to look up
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.TairReader = MASCP.buildService(function(data) {
                        this._data = data || {};
                        if ( ! this._data.data ) {
                            this._data = { 'data' : ['',''] };
                        }
                        return this;
                    });

MASCP.TairReader.SERVICE_URL = 'http://gator.masc-proteomics.org/tair.pl?';

MASCP.TairReader.prototype.requestData = function()
{
    var self = this;
    return {
        type: "GET",
        dataType: "json",
        data: { 'agi'   : this.agi,
                'service' : 'tair' 
        }
    };
};

MASCP.TairReader.Result.prototype.getDescription = function() {
    return this._data.data[1];
};

MASCP.TairReader.Result.prototype.getSequence = function() {
    return this._data.data[2];
};

MASCP.getSequence = function(agi) {
    var self = arguments.callee;
    if (! self._reader ) {
        self._reader = new MASCP.TairReader();
        self._reader.async = false;
    }
    self._reader.result = null;
    self._reader.agi = agi;
    self._reader.retrieve();
    if ( ! self._reader.result ) {
        return "";
    }
    return self._reader.result.getSequence(); 
};
/** @fileOverview   Classes for reading data from the Ubiquitin data
 */
if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

/** Default class constructor
 *  @class      Service class that will retrieve data from the Ubiquitin data for a given AGI.
 *  @param      {String} agi            Agi to look up
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.UbiquitinReader = MASCP.buildService(function(data) {
                        this._raw_data = data;
                        return this;
                    });

MASCP.UbiquitinReader.SERVICE_URL = '?';

MASCP.UbiquitinReader.prototype.requestData = function()
{
    var agi = this.agi;
    
    return {
        type: "GET",
        dataType: "json",
        data: { 'agi'       : agi,
                'service'   : 'ubiquitin' 
        }
    };
};

/**
 *  @class   Container class for results from the Ubiquitin service
 *  @extends MASCP.Service.Result
 */
// We need this line for the JsDoc to pick up this class
MASCP.UbiquitinReader.Result = MASCP.UbiquitinReader.Result;

/** Retrieve the peptides for this particular entry from the Ubiquitin service
 *  @returns Array of peptide strings
 *  @type [String]
 */
MASCP.UbiquitinReader.Result.prototype.getPeptides = function()
{
    var content = null;
    if (! this._raw_data || ! this._raw_data.data  || ! this._raw_data.data.peptides ) {
        return [];
    }

    return this._raw_data.data.peptides;
};

MASCP.UbiquitinReader.Result.prototype._cleanSequence = function(sequence)
{
    return sequence.replace(/[^A-Z]/g,'');
};

MASCP.UbiquitinReader.prototype.setupSequenceRenderer = function(sequenceRenderer)
{
    var reader = this;

    var css_block = '.active .overlay { background: #666666; } .active a { color: #000000; text-decoration: none !important; }  :indeterminate { background: #ff0000; } .tracks .active { background: #0000ff; } .inactive a { text-decoration: none; } .inactive { display: none; }';
    
    this.bind('resultReceived', function() {
        var peps = this.result.getPeptides();

        var overlay_name = 'ubiquitin_experimental';
        var group_name = 'ubiquitin_peptides';
        var icons = [];
        
        if (peps.length > 0) {
            MASCP.registerLayer(overlay_name,{ 'fullname' : 'UBQ (mod)', 'color' : '#666666', 'css' : css_block });

            MASCP.registerGroup(group_name, {'fullname' : 'UBQ', 'hide_member_controllers' : true, 'hide_group_controller' : true, 'color' : '#666666' });
            if (sequenceRenderer.createGroupController) {
                sequenceRenderer.createGroupController(overlay_name,group_name);
            }
            
            bean.add(MASCP.getGroup(group_name),'visibilityChange',function(e,rend,vis) {
                if (rend != sequenceRenderer) {
                    return;
                }
                icons.forEach(function(el) {
                    el.style.display = vis ? 'none' : 'inline';
                });
            });
            
            
        }

        for (var i = 0; i < peps.length; i++) {
            var layer_name = 'ubiquitin_peptide_'+i;
            MASCP.registerLayer(layer_name, { 'fullname': 'Peptide', 'group' : group_name, 'color' : '#666666', 'css' : css_block });
            var peptide = peps[i].sequence;
            var peptide_bits = sequenceRenderer.getAminoAcidsByPeptide(peptide);
            if (peptide_bits.length === 0){
                continue;
            }
            peptide_bits.addToLayer(layer_name);
            icons.push(peptide_bits.addToLayer(layer_name));

            for (var k = 0; k < peps[i].positions.length; k++ ) {
                icons = icons.concat(peptide_bits[peps[i].positions[k] - 1].addToLayer(overlay_name));
                peptide_bits[peps[i].positions[k] - 1].addToLayer(layer_name);
            }
        }
        sequenceRenderer.trigger('resultsRendered',[reader]);
    });
    return this;
};
/** Retrieve an array of positions that ubiquitin has been experimentally verified to occur upon
 *  @returns {Array}    Ubiquitin positions upon the full protein
 */
MASCP.UbiquitinReader.Result.prototype.getAllExperimentalPositions = function()
{
    var peps = this.getPeptides();
    var results = [];
    var seen = {};
    peps.forEach(function(pep) {
        pep.positions.forEach(function(pos) {
            if ( ! seen[pos] ) {
                results.push(pos);
                seen[pos] = true;
            }
        });
    });
    return results;
}
MASCP.UbiquitinReader.Result.prototype.render = function()
{
};/** @fileOverview   Classes for reading data from the Cdd tool
 */
if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

/** Default class constructor
 *  @class      Service class that will retrieve data from Cdd for given sequences
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.UnionDomainReader = MASCP.buildService(function(data) {
    if (data) {
        if ( ! this._raw_data ) {
            this._raw_data = {'data' : {}};
        }
        for (var key in data.data) {
            this._raw_data.data[key] = data.data[key];
        }
    }
    return this;
});

MASCP.UnionDomainReader.prototype.requestData = function() {
    var self = this;
    var uprot = new MASCP.UniprotDomainReader();
    var cdd = new MASCP.CddRunner();
    MASCP.Service.CacheService(cdd);
    var uprot_result;
    var cdd_result;
    cdd.bind('running',function() {
        bean.fire(self,'running');
    });
    var merge_hash = function(h1,h2) {
        var key;
        for (key in h2.data) {
            h1.data[key] = h2.data[key];
        }
        return h1;
    }
    var check_result = function(err) {
        if (err) {
            bean.fire(self,"error",[err]);
            bean.fire(MASCP.Service,'requestComplete');
            self.requestComplete();
            check_result = function() {};
            return;
        }
        if (uprot_result && cdd_result) {
            self._dataReceived(merge_hash(uprot_result,cdd_result));
            self.gotResult();
            self.requestComplete();
        }
    };
    uprot.retrieve(this.agi,function(err) {
        if ( ! err ) {
            uprot_result = this.result._raw_data;
        }
        check_result(err);
    });
    cdd.retrieve(this.agi,function(err) {
        if ( ! err ) {
            cdd_result = this.result._raw_data;
        }
        check_result(err);
    });
    return false;
};
/**
 * @fileOverview    Classes for reading data from Uniprot database
 */

if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}



/** Default class constructor
 *  @class      Service class that will retrieve data from Uniprot for a given AGI.
 *  @param      {String} agi            Agi to look up
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.UniprotReader = MASCP.buildService(function(data) {
                        if ( data && typeof(data) === 'string' ) {
                            var dats = MASCP.UniprotReader.parseFasta(data);
                            var key;
                            for (key in dats) {
                                if (dats.hasOwnProperty(key)) {
                                    data = { 'data' : dats[key] };
                                    this._raw_data = data;
                                }
                            }
                        }
                        this._data = data || {};
                        if ( ! this._data.data ) {
                            this._data = { 'data' : ['',''] };
                        }
                        return this;
                    });

MASCP.UniprotReader.SERVICE_URL = 'http://gator.masc-proteomics.org/uniprot.pl?';

MASCP.UniprotReader.prototype.requestData = function()
{
    var self = this;
    return {
        type: "GET",
        dataType: "txt",
        'url'   : 'http://www.uniprot.org/uniprot/'+(this.agi).toUpperCase()+'.fasta',
        data: { 'acc'   : this.agi,
                'service' : 'uniprot' 
        }
    };
};

MASCP.UniprotReader.Result.prototype.getDescription = function() {
    return this._data.data[1];
};

MASCP.UniprotReader.Result.prototype.getSequence = function() {
    return this._data.data[0];
};

MASCP.UniprotReader.parseFasta = function(datablock) {
    var chunks = (datablock.split('>'));
    var datas = {};
    chunks.forEach(function(entry) {
        var lines = entry.split(/\n/);
        if (lines.length <= 1) {
            return;
        }
        var header = lines.shift();
        var seq = lines.join("");
        var header_data = header.split('|');
        var acc = header_data[1];
        var desc = header_data[2];
        datas[acc] = [seq,desc];
    });
    return datas;
}

MASCP.UniprotReader.readFastaFile = function(datablock,callback) {

    var datas = MASCP.UniprotReader.parseFasta(datablock);

    var writer = new MASCP.UserdataReader();
    writer.toString = function() {
        return "MASCP.UniprotReader";
    };
    writer.map = function(dat) {
        return dat.data;
    };
    writer.datasetname = "UniprotReader";
    callback(writer);
    setTimeout(function() {
        writer.avoid_database = true;
        writer.setData("UniprotReader",{"data" : datas});
    },0);
    return writer;
};

MASCP.UniprotReader.parseDomains = function(datalines) {
    var results = {};
    datalines = datalines.split(/\n/);
    datalines.forEach(function(data) {
        var domain_re = /FT\s+DOMAIN\s+(\d+)\s+(\d+)\s+(.*)/m;
        var carb_re = /FT\s+CARBOHYD\s+(\d+)\s+(\d+)\s+(.*)/m;
        var match = carb_re.exec(data);
        if (match) {
            var name = match[3];
            name = name.replace('...','..');
            if ( ! results[name]) {
                results[name] = { "peptides" : [], "name" : name };
            }
            results[name].peptides.push([match[1],match[2]]);
        }
        var match = domain_re.exec(data);
        if (match) {
            if ( ! results[match[3]]) {
                results[match[3]] = { "peptides" : [] };
            }
            results[match[3]].peptides.push([match[1],match[2]]);
        }
    });

    return results;
};

MASCP.UniprotReader.parseSecondaryStructure = function(datalines) {
    var results;
    datalines = datalines.split(/\n/);
    datalines.forEach(function(data) {
        var strand_re = /FT\s+(STRAND)\s+(\d+)\s+(\d+)/m;
        var helix_re = /FT\s+(HELIX)\s+(\d+)\s+(\d+)/m;
        var turn_re = /FT\s+(TURN)\s+(\d+)\s+(\d+)/m;
        [strand_re,helix_re,turn_re].forEach(function(re) {
            var match = re.exec(data);
            if ( ! match ) {
                return;
            }
            if ( ! results || ! results[match[1]] ) {
                results = { "STRAND" : {"peptides" : [ ]},  "HELIX" : {"peptides" : []}, "TURN" : {"peptides" : [] } };
            }
            if (match) {
                results[match[1]].peptides.push([match[2],match[3]]);
            }
        });
    });

    return results;
};


MASCP.UniprotDomainReader = MASCP.buildService(function(data) {
                        if ( data && typeof(data) === 'string' ) {
                            var dats = MASCP.UniprotReader.parseDomains(data);
                            data = { 'data' : dats };
                            this._raw_data = data;
                        }
                        return this;
                    });

MASCP.UniprotDomainReader.prototype.requestData = function()
{
    var self = this;
    return {
        type: "GET",
        dataType: "txt",
        'url'   : 'http://www.uniprot.org/uniprot/'+(this.agi).toUpperCase()+'.txt',
        data: { 'acc'   : this.agi,
                'service' : 'uniprot'
        }
    };
};


MASCP.UniprotSecondaryStructureReader = MASCP.buildService(function(data) {
                        if ( data && typeof(data) === 'string' ) {
                            var dats = MASCP.UniprotReader.parseSecondaryStructure(data);
                            if (dats) {
                                data = { 'data' : dats };
                            } else {
                                return null;
                            }
                            this._raw_data = data;
                        }
                        return this;
                    });

MASCP.UniprotSecondaryStructureReader.prototype.requestData = function()
{
    var self = this;
    return {
        type: "GET",
        dataType: "txt",
        'url'   : 'http://www.uniprot.org/uniprot/'+(this.agi).toUpperCase()+'.txt',
        data: { 'acc'   : this.agi,
                'service' : 'uniprot'
        }
    };
};


MASCP.UniprotSecondaryStructureReader.prototype.setupSequenceRenderer = function(renderer,options) {
    this.bind('resultReceived',function() {
        if (this.result && this.result._raw_data.data) {
            if ( ! options.track ) {
                MASCP.registerLayer('secstructure',{ 'fullname' : 'Secondary structure', 'color' : '#0f0' });
            }
            this.result._raw_data.data['STRAND'].peptides.forEach(function(pos) {
                var start = parseInt(pos[0]);
                var end = parseInt(pos[1]);
                renderer.getAA(start).addBoxOverlay(options.track || 'secstructure',end-start,1,{"fill" : "#9AFF9A"});
            });
            this.result._raw_data.data['HELIX'].peptides.forEach(function(pos) {
                var start = parseInt(pos[0]);
                var end = parseInt(pos[1]);
                renderer.getAA(start).addBoxOverlay(options.track || 'secstructure',end-start,1,{"fill" : "#7EB6FF"});
            });
            this.result._raw_data.data['TURN'].peptides.forEach(function(pos) {
                var start = parseInt(pos[0]);
                var end = parseInt(pos[1]);
                renderer.getAA(start).addBoxOverlay(options.track || 'secstructure',end-start,1,{"fill" : "#F0A"});
            });
        }
        renderer.trigger('resultsRendered',[this]);
    });
};

/**
 * @fileOverview    Classes for getting arbitrary user data onto the GATOR
 */

if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

/** Default class constructor
 *  @class      Service class that will retrieve sequence data for a given AGI from a given ecotype
 *  @param      {String} agi            Agi to look up
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.UserdataReader = MASCP.buildService(function(data) {
                        if ( ! data ) {
                            return this;
                        }
                        this._raw_data = data;
                        return this;
                    });

MASCP.UserdataReader.prototype.toString = function() {
    return 'MASCP.UserdataReader.'+this.datasetname;
};

MASCP.UserdataReader.prototype.requestData = function()
{
    var agi = this.agi.toUpperCase();
    return {
        type: "GET",
        dataType: "json",
        data: { 'agi'       : agi,
                'service'   : this.datasetname 
        }
    };
};


MASCP.UserdataReader.prototype.setupSequenceRenderer = function(renderer) {
    var reader = this;
    
    var is_array = function(arr) {
        return Object.prototype.toString.call(arr) == '[object Array]';
    };
    
    reader.bind('resultReceived',function() {
        var results = [].concat(this.result.data);
        while(results.length > 0) {
            var my_data = results.shift();
            if ( ! my_data ) {
                continue;
            }
            MASCP.registerLayer(reader.datasetname,{'fullname' : reader.datasetname,'color' : '#00ff00'});
            var data_func = function() { return function(row) {
                renderer.getAminoAcidsByPeptide(row).addToLayer(reader.datasetname);
            }; }();
            if (is_array(my_data) && (! (is_array(my_data[0])))) {
                data_func = function() { return function(row) {
                    var start = parseInt(row[0],10);
                    var end = parseInt(row[1],10);
                    if (! isNaN(start) && ! isNaN(end)) {
                        renderer.getAA(start).addBoxOverlay(reader.datasetname,end-start);
                    } else {
                        row.forEach(function(cell) {
                            renderer.getAminoAcidsByPeptide(cell).addToLayer(reader.datasetname);                            
                        });
                    }
                }; }();
            } else if (is_array(my_data) && ( is_array(my_data[0]) )) {
                data_func = function() { return function(peps) {
                    peps.forEach(function(row) {
                        var start = parseInt(row[0],10);
                        var end = parseInt(row[1],10);
                        renderer.getAA(start).addBoxOverlay(reader.datasetname,end-start);
                    });
                }; }();                
            } else if (my_data === parseInt(my_data[0],10)) {
                data_func = function() { return function(row) {
                    var pos = row;
                    renderer.getAA(pos).addAnnotation(reader.datasetname,1);
                }; }();
            }
            data_func.call(this,my_data);
        }
        renderer.trigger('resultsRendered',[reader]);        
    });
};

(function() {

var apply_map = function(data_block) {
    var map = this.map;
    var databits = data_block.data;
    var headers = databits.shift();
    var dataset = {};
    var id_col = headers.indexOf(map.id);
    var cols_to_add = [];
    for (var col in map) {
        if (col == "id") {
            continue;
        }
        if (map.hasOwnProperty(col)) {
            cols_to_add.push({ "name" : col, "index" : headers.indexOf(map[col]) });
        }
    }
    while (databits.length > 0) {
        var row = databits.shift();
        var id = row[id_col].toLowerCase();
        if ( ! dataset[id] ) {
            dataset[id] = {"data" : {}};
        }
        var obj = dataset[id];
        var i;
        for (i = cols_to_add.length - 1; i >= 0; i--) {
            if ( ! obj.data[cols_to_add[i].name] ) {
                obj.data[cols_to_add[i].name] = [];
            }
            obj.data[cols_to_add[i].name] = obj.data[cols_to_add[i].name].concat((row[cols_to_add[i].index] || '').split(','));
        }
        obj.retrieved = data_block.retrieved;
        obj.title = data_block.title;
        if (data_block.etag) {
            obj.etag = data_block.etag;
        }
    }
    return dataset;
};

MASCP.UserdataReader.prototype.setData = function(name,data) {
    
    if ( ! data ) {
        return;
    }

    var self = this;
    
    // Call CacheService on this object/class
    // just to make sure that it has access
    // to the cache retrieval mechanisms

    MASCP.Service.CacheService(this);
    
    this.datasetname = name;

    if ( ! data.retrieved ) {
        data.retrieved = new Date();
    }
    if ( ! data.title ) {
        data.title = name;
    }

    self.title = data.title;

    var dataset = {}; // Format is { "accession" : { "data" : {}, "retrieved" : "" , "title" : ""  } };

    if (typeof this.map == 'object') {
        dataset = apply_map.call(this,data);
    }
    if (typeof this.map == 'function') {

        if (this.map.callback) {
            var self_func = arguments.callee;
            this.map(data,function(parsed) {
                self.map = function(d) { return (d); };
                self_func.call(self,name,parsed);
            });
            return;
        }
        dataset = this.map(data);
    }

    if ( ! this.map ) {
        return;
    }
    this.data = dataset;
    
    var inserter = new MASCP.UserdataReader();

    inserter.toString = function() {
        return self.toString();
    };

    inserter.data = dataset;
    
    inserter.retrieve = function(an_acc,cback) {
        this.agi = an_acc;
        // this._dataReceived(dataset[this.agi]);
        cback.call(this);
    };
    
    MASCP.Service.CacheService(inserter);

    var accs = [];
    var acc;
    for (acc in dataset) {
        if (dataset.hasOwnProperty(acc)) {
            if (acc.match(/[A-Z]/)) {
                dataset[acc.toLowerCase()] = dataset[acc];
                delete dataset[acc];
                acc = acc.toLowerCase();
            }
            accs.push(acc);
        }
    }
    var total = accs.length;

    var retrieve = this.retrieve;

    this.retrieve = function(id,cback) {
        console.log("Data not ready! Waiting for ready state");
        var self = this;        
        bean.add(self,'ready',function() {
            bean.remove(self,'ready',arguments.callee);
            self.retrieve(id,cback);
        });
    };
    if (accs.length < 1) {
        setTimeout(function() {
            self.retrieve = retrieve;
            bean.fire(self,'ready',[data]);
        },0);
        return;
    }
    MASCP.Service.BulkOperation(function(err) {
        if (err) {
            bean.fire(self,'error',[err]);
            return;
        }
        var trans = this.transaction;
        inserter.avoid_database = true;
        inserter.retrieve(accs[0],function() {
            while (accs.length > 0) {
                var acc = accs.shift();
                bean.fire(self,'progress',[100 * ((total - accs.length) / total), total - accs.length, total]);
                inserter.agi = acc;
                inserter._dataReceived(dataset[acc]);
                if (accs.length === 0) {
                    self.retrieve = retrieve;
                    trans(function(err) {
                        if ( ! err ) {
                            bean.fire(self,'ready',[data]);
                        } else {
                            bean.fire(self,'error');
                        }
                    });
                    return;
                }
            }
        });
    });


};

MASCP.UserdataReader.datasets = function(cback) {
    MASCP.Service.FindCachedService(this,function(services) {
        var result = [];
        for (var i = 0, len = services.length; i < len; i++){
            result.push(services[i].replace(/MASCP.UserdataReader./,''));
        }
        if (result.forEach) {
            result.forEach(cback);
        }
    });
};

})();/** @fileOverview   Classes for reading data from the Clustal tool
 */
if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

/** Default class constructor
 *  @class      Service class that will retrieve data from Clustal for given sequences
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.ClustalRunner = MASCP.buildService(function(data) {
                        this._raw_data = data;
                        if (data && typeof data == 'string') {
                            this._raw_data = { 'data' : { 'sequences' : this.getSequences(), 'alignment' : this.getAlignment() } };
                        }
                        return this;
                    });

MASCP.ClustalRunner.SERVICE_URL = 'http://www.ebi.ac.uk/Tools/services/rest/clustalw2/run/';

MASCP.ClustalRunner.hash = function(str){
    var hash = 0;
    for (i = 0; i < str.length; i++) {
        char = str.charCodeAt(i);
        hash = char + (hash << 6) + (hash << 16) - hash;
    }
    return hash;
};

MASCP.ClustalRunner.prototype.requestData = function()
{   
    var sequences = [].concat(this.sequences || []);
    var self = this;
    this.agi = MASCP.ClustalRunner.hash(this.sequences.join(','))+'';
    if (! MASCP.ClustalRunner.SERVICE_URL.match(/ebi/)) {
        return {
            type: "POST",
            dataType: "json",
            data : {
                'sequences' : sequences.join(",")
            }
        };
    }
    bean.fire(self,'running');
    if (this.job_id) {
        return {
            type: "GET",
            dataType: "txt",
            url: 'http://www.ebi.ac.uk/Tools/services/rest/clustalw2/status/'+this.job_id
        };
    }
    if (this.result_id) {
        return {
            type: "GET",
            dataType: "txt",
            url: 'http://www.ebi.ac.uk/Tools/services/rest/clustalw2/result/'+this.result_id+'/aln-clustalw'
        };        
    }
    
    for (var i = 0; i < sequences.length; i++ ) {
        sequences[i] = ">seq"+i+"\n"+sequences[i];
    }
    return {
        type: "POST",
        dataType: "txt",
        data: { 'sequence' : escape(sequences.join("\n")+"\n"),
                'email'    : 'joshi%40sund.ku.dk'
        }
    };
};

(function(serv) {
    var defaultDataReceived = serv.prototype._dataReceived;

    serv.prototype._dataReceived = function(data,status)
    {
        if (data === null) {
            return defaultDataReceived.call(this,null,status);
        }
        if (typeof data == "object") {
            if (data.status && data.status == "RUNNING") {
                var self = this;
                bean.fire(self,"running");
                setTimeout(function() {
                    self.retrieve(self.agi);
                },5000);
                console.log("Got back running status");
                return;
            }
            return defaultDataReceived.call(this,data,status);
        }
        
        if (typeof data == "string" && data.match(/^clustalw/)) {
            this.job_id = data;
            this.retrieve(this.agi);
            return;
        }
        if (data.match(/FINISHED/)) {
            this.result_id = this.job_id;
            this.job_id = null;
            var self = this;
            setTimeout(function() {
                self.retrieve(self.agi);
            },500);
            return;
        }
        if (data.match(/RUNNING/)) {
            var self = this;
            setTimeout(function() {
                self.retrieve(self.agi);
            },500);
            return;
        }
        
        return defaultDataReceived.call(this,data,status);
    };
    
})(MASCP.ClustalRunner);

(function() {
var normalise_insertions = function(inserts) {
    var pos;
    var positions = [];
    var result_data = {};
    for (pos in inserts) {
        if (inserts.hasOwnProperty(pos) && parseInt(pos) >= -1) {
            positions.push(parseInt(pos));
        }
    }
    positions = positions.sort(function sortfunction(a, b){
        return (a - b);
    });
    
    // From highest to lowest position, loop through and 
    // subtract the lengths of previous subtratctions from
    // the final position value.

    for (var i = positions.length - 1; i >= 0; i--) {
        var j = i - 1;
        pos = parseInt(positions[i]);
        var value = inserts[pos];
        while (j >= 0) {
            pos -= inserts[positions[j]].length;
            j--;
        }
        if (! value.match(/^\s+$/)) {
            result_data[pos+1] = value + (result_data[pos+1] || '');
        }
    }
//    delete result_data[0];
    return result_data;
};

var splice_char = function(seqs,index,insertions) {
    for (var i = 0; i < seqs.length; i++) {
        var seq = seqs[i].toString();
        if (seq.charAt(index) != '-') {
            if ( ! insertions[i] ) {
                insertions[i] = {};
                insertions[i][-1] = '';
            }
            insertions[i][index - 1] = seq.charAt(index);
            if (insertions[i][index] && insertions[i][index].match(/\w/)) {
                insertions[i][index-1] += insertions[i][index];
                delete insertions[i][index];
            }
        } else {
            if ( insertions[i] ) {
                insertions[i][index - 1] = ' ';
                if ((insertions[i][index] || '').match(/^\s+$/)) {
                    insertions[i][index-1] += insertions[i][index];
                    delete insertions[i][index];
                }
            }
        }
        seqs[i] = seq.slice(0,index) + seq.slice(index+1);
    }
}

MASCP.ClustalRunner.Result.prototype.alignToSequence = function(seq_index) {
    if ( ! this._orig_raw_data ) {
        this._orig_raw_data = JSON.stringify(this._raw_data);
    } else {
        this._raw_data = JSON.parse(this._orig_raw_data);
    }
    var seqs = this._raw_data.data.sequences.concat([this._raw_data.data.alignment]);
    var insertions = [];
    var aligning_seq = seqs[seq_index], i = aligning_seq.length - 1;
    for (i; i >= 0; i--) {
        if (aligning_seq.charAt(i) == '-') {
            splice_char(seqs,i,insertions);
        }
    }
    for (i = 0; i < seqs.length; i++) {
        if (insertions[i] && i != seq_index) {
            insertions[i] = normalise_insertions(insertions[i]);
            var seq = seqs[i];
            seqs[i] = { 'sequence' : seq, 'insertions' : insertions[i] };
            seqs[i].toString = function() {
                return this.sequence;
            };
        }
    }
    this._raw_data.data.alignment = seqs.pop();
    this._raw_data.data.sequences = seqs;
};

/*

Test suite for calculating positions

var aligner = 0;
foo = new MASCP.ClustalRunner.Result();
foo._raw_data = {"data" : { "alignment" : "****************" , "sequences" : [ "----12345678----", "XXXXXXXXXXXXXXXX", "ABCDABC---ABCDAB" ] }};
foo.alignToSequence(aligner);
console.log(foo.getSequences());
console.log(foo.calculatePositionForSequence(0,1));
console.log(foo.calculatePositionForSequence(0,2));
console.log(foo.calculatePositionForSequence(0,3));
console.log(foo.calculatePositionForSequence(0,4));
console.log(foo.calculatePositionForSequence(0,5));
console.log(foo.calculatePositionForSequence(0,6));
console.log(foo.calculatePositionForSequence(0,7));
console.log(foo.calculatePositionForSequence(0,8));

*/
MASCP.ClustalRunner.Result.prototype.calculatePositionForSequence = function(idx,pos) {
    var inserts = this._raw_data.data.sequences[idx].insertions || {};
    var result = pos;
    var actual_position = 0;
    var seq = this._raw_data.data.sequences[idx].toString();
    for (var i = 0 ; i < seq.length; i++ ) {
        if (inserts[i]) {
            actual_position += inserts[i].length;
        }
        actual_position += 1;
        if (seq.charAt(i) == '-') {
            actual_position -= 1;
        }
        if (pos <= actual_position) {
            if (pos == actual_position) {
                return (i+1);
            } else {
                return -1 * i;
            }
        }
    }
    return -1 * seq.length;
};


})();
//1265 (P)

MASCP.ClustalRunner.prototype.setupSequenceRenderer = function(renderer) {
    var self = this;

    var elements_to_move = [];

    renderer.bind('readerRegistered',function(reader) {
        if (self == reader) {
            return;
        }
        if ( ! self.result ) {
            return;
        }
        var old = reader.gotResult;
        reader.getSequence = function() {
            var wanted_id = reader.acc || reader.agi || "";
            for (var i = 0; i < self.sequences.length; i++) {
                if (self.sequences[i].agi && self.sequences[i].agi.toUpperCase() == wanted_id.toUpperCase()) {
                    return self.sequences[i].toString();
                }
            }
            return renderer.sequence;
        };

        reader.gotResult = function() {
            var index = 0;
            var wanted_id = reader.acc || reader.agi || "";
            var curr_sequence = renderer.sequence;
            for (var i = 0; i < self.sequences.length; i++) {
                if (self.sequences[i].agi && self.sequences[i].agi.toUpperCase() == wanted_id.toUpperCase()) {
                    renderer.sequence = self.sequences[i].toString();
                    index = i;
                }
            }
            var old_get_aas = renderer.getAminoAcidsByPosition;
            var old_get_pep = renderer.getAminoAcidsByPeptide;
            var orig_functions = {};
            renderer._extendElement(orig_functions);
            var extender = function(aas) {
                return function(el) {
                    var result = {};
                    result.original_index = aas.shift();
                    if ( ! el ) {
                        el = { "_index" : -100, "_renderer" : renderer };
                    }
                    if ( ! el['_renderer']) {
                        el['_renderer'] = renderer;
                    }

                    result._index = el._index;

                    result.addShapeOverlay = function(layername,width,opts) {
                        elements_to_move.push(orig_functions['addShapeOverlay'].call(el,layername,Math.abs(self.result.calculatePositionForSequence(index,result.original_index+width)) - el._index,opts));
                        elements_to_move.slice(-1)[0].layer_idx = index;
                        elements_to_move.slice(-1)[0].aa = result.original_index;
                        elements_to_move.slice(-1)[0].aa_width = width;
                        return elements_to_move.slice(-1)[0];
                    };
                    result.addBoxOverlay = function(layername,width,fraction,opts) {
                        elements_to_move.push(orig_functions['addBoxOverlay'].call(el,layername,Math.abs(self.result.calculatePositionForSequence(index,result.original_index+width)) - el._index,fraction,opts));
                        elements_to_move.slice(-1)[0].layer_idx = index;
                        elements_to_move.slice(-1)[0].aa_width = width;
                        elements_to_move.slice(-1)[0].aa = result.original_index;
                        return elements_to_move.slice(-1)[0];
                    };
                    result.addTextOverlay = function(layername,width,opts) {
                        elements_to_move.push(orig_functions['addTextOverlay'].call(el,layername,Math.abs(self.result.calculatePositionForSequence(index,result.original_index+width)) - el._index,opts));
                        elements_to_move.slice(-1)[0].layer_idx = index;
                        elements_to_move.slice(-1)[0].aa = result.original_index;
                        elements_to_move.slice(-1)[0].aa_width = width;
                        return elements_to_move.slice(-1)[0];
                    };
                    result.addToLayerWithLink = function(layername,url,width) {
                        elements_to_move.push(orig_functions['addToLayerWithLink'].call(el,layername,url,Math.abs(self.result.calculatePositionForSequence(index,result.original_index+width)) - el._index));
                        elements_to_move.slice(-1)[0].layer_idx = index;
                        return elements_to_move.slice(-1)[0];
                    };
                    result.addToLayer = function(layername,opts) {
                        elements_to_move.push(orig_functions['addToLayer'].call(el,layername,opts));
                        elements_to_move.slice(-1)[0].layer_idx = index;
                        elements_to_move.slice(-1)[0].aa = result.original_index;
                        elements_to_move.slice(-1)[0].aa_width = 1;
                        return elements_to_move.slice(-1)[0];
                    };
                    for (var method in orig_functions) {
                        if ( ! result[method] ) {
                            result[method] = (function(method){
                                return function() {
                                elements_to_move.push(orig_functions[method].apply(el,arguments));
                                // console.log(elements_to_move.slice(-1)[0]);
                                // console.log(elements_to_move.slice(-1)[0].move);
                                // console.log(method);
                                return elements_to_move.slice(-1)[0];
                                };
                            })(method);
                        }
                    }
                    return result;
                };
            };
            renderer.getAminoAcidsByPosition = function(aas) {
                var new_aas = aas.map(function(aa) { return Math.abs(self.result.calculatePositionForSequence(index,aa)); });
                return old_get_aas.call(this,new_aas).map(extender(aas));
            };
            renderer.getAminoAcidsByPeptide = function(peptide) {
                var positions = [];
                var start = self.sequences[index].toString().indexOf(peptide);
                for (var i = 0; i < peptide.length; i++ ) {
                    positions.push(start+i);
                }
                var results = this.getAminoAcidsByPosition(positions);
                if (results.length) {
                    results.addToLayer = function(layername, fraction, options) {
                        return results[0].addBoxOverlay(layername,results.length,fraction,options);
                    };
                } else {
                    results.addToLayer = function() {};
                }
                return results;
            };
            old.call(reader);
            renderer.sequence = curr_sequence;
            renderer.getAminoAcidsByPosition = old_get_aas;
            renderer.getAminoAcidsByPeptide = old_get_pep;
        }
    });

    var rendered_bits = [];
    var controller_name = 'isoform_controller';
    var group_name = 'isoforms';

    var draw_discontinuity = function(canvas,size) {
        var top = -3;
        var left = -2;
        var group = canvas.group();
        var line;
        line = canvas.line(left+1,top+4,left+3,top+1);
        line.setAttribute('stroke','#fcc');
        line.setAttribute('stroke-width','10');
        group.push(line);
        line = canvas.line(left+1,top+6,left+3,top+3);
        line.setAttribute('stroke','#fcc');
        line.setAttribute('stroke-width','10');
        group.push(line);
        line = canvas.line(left+1,top+4,left+3,top+3);
        line.setAttribute('stroke','#fcc');
        line.setAttribute('stroke-width','5');
        group.push(line);
        line = canvas.line(left+1,top+5.3,left+1,top+5.8);
        line.setAttribute('stroke','#fcc');
        line.setAttribute('stroke-width','10');
        group.push(line);
        line = canvas.line(left+1,top+5.9,left+1.5,top+5.9);
        line.setAttribute('stroke','#fcc');
        line.setAttribute('stroke-width','10');
        group.push(line);
        var circle = canvas.circle(left+2.8,top+1.75,1);
        circle.setAttribute('fill','#fff');
        circle.setAttribute('stroke','#ccc');
        circle.setAttribute('stroke-width','10');
        group.push(circle);
        var minus = canvas.text(left+2.25,top+2.25,(size || '÷')+"");
        minus.setAttribute('fill','#ccc');
        minus.setAttribute('font-size',75);
        group.push(minus);
        canvas.firstChild.nextSibling.appendChild(group);
        return group;
    };

    var check_values = function(seq,idx,seqs) {
        var positives = 0;
        var aa = seq.toString().charAt(idx);
        for (var i = 1; i < seqs.length; i++) {
          if (seqs[i].toString().charAt(idx) == aa) {
            positives += 1;
          }
        }
        return (positives / (seqs.length - 1));
    };


    var redraw_alignments = function(sequence_index) {
        var result = self.result;

        while (rendered_bits.length > 0) {
            var bit = rendered_bits.shift();
            renderer.remove(bit.layer,bit);
        }
        result.alignToSequence(sequence_index || 0);
        elements_to_move.forEach(function(el) {
            if (el.move) {
                var aa = result.calculatePositionForSequence(el.layer_idx,el.aa);
                var aa_width = result.calculatePositionForSequence(el.layer_idx,el.aa+el.aa_width);
                if (aa < 0) {
                    aa *= -1;
                }
                if (aa_width < 0) {
                    aa_width *= -1;
                }
                el.move(aa,aa_width-aa);
            }
        });
        var aligned = result.getSequences();
        if ( ! renderer.sequence ) {
            renderer.setSequence(aligned[sequence_index])(function() {
                MASCP.registerGroup(group_name, 'Aligned');
                MASCP.registerLayer(controller_name, { 'fullname' : 'Conservation', 'color' : '#000000' });
                if (renderer.trackOrder.indexOf(controller_name) < 0) {
                    renderer.trackOrder.push(controller_name);
                }
                renderer.showLayer(controller_name);
                renderer.createGroupController(controller_name,group_name);
                redraw_alignments(sequence_index);
            });
            return;
        } else {
            renderer.sequence = aligned[sequence_index];
            renderer.redrawAxis();
        }
        var alignments = result.getAlignment().split('');
        rendered_bits = rendered_bits.concat(renderer.renderTextTrack(controller_name,result.getAlignment().replace(/ /g,' ')));
        rendered_bits.slice(-1)[0].setAttribute('data-spaces','true');
        rendered_bits.slice(-1)[0].layer = controller_name;
        var idxs = ["*",":","."," "].reverse();
        for (var i = 0 ; i < alignments.length; i++ ) {
            rendered_bits.push(renderer.getAA(i+1).addBoxOverlay(controller_name,1,idxs.indexOf(alignments[i])/4,{"merge" : true}));
            rendered_bits.slice(-1)[0].layer = controller_name;
        }
        for (var i = 0 ; i < aligned.length; i++) {
            var layname = self.sequences[i].agi.toUpperCase() || "missing"+i;
            var lay = MASCP.registerLayer(layname,{'fullname': self.sequences[i].name || layname.toUpperCase(), 'group' : group_name, 'color' : '#ff0000'});
            lay.fullname = self.sequences[i].name || layname.toUpperCase();
            var text_array = renderer.renderTextTrack(layname,aligned[i].toString());
            text_array[0].setAttribute('dy','-1ex');
            rendered_bits = rendered_bits.concat(text_array);
            rendered_bits.slice(-1)[0].layer = layname;
            if (renderer.trackOrder.indexOf(layname.toUpperCase()) < 0) {
              renderer.trackOrder.push(layname.toUpperCase());
            }
            var name = "Isoform "+(i+1);
            if (aligned[i].insertions) {
              for (var insert in aligned[i].insertions) {
                var insertions = aligned[i].insertions;
                if (insert == 0 && insertions[insert] == "") {
                  continue;
                }
                if (insertions[insert].length < 1) {
                    continue;
                }
                var size = insertions[insert].length;
                if (insert == 0) {
                  insert = 1;
                }
                var content = draw_discontinuity(renderer._canvas,size);
                content.setAttribute('fill','#ffff00');
                var an_anno = renderer.getAA(insert).addToLayer(layname,
                  { 'content' : content,//'+'+insertions[insert].length,
                    'bare_element': true,
                    'height' : 10,
                    'offset' : -5,
                    'no_tracer' : true
                  })[1];
                an_anno.container.setAttribute('height','300');
                an_anno.container.setAttribute('viewBox','-50 -100 200 300');
                rendered_bits.push(an_anno);
                rendered_bits.slice(-1)[0].layer = layname;

                // (function(layname,insert,insertions,nm) {
                // an_anno.addEventListener('click',function() {
                //   if (seq_callout !== null && seq_callout.parentNode !== null) {
                //     seq_callout.parentNode.removeChild(seq_callout);
                //   }
                //   seq_callout = null;
                //   seq_callout = renderer.getAA(insert).callout(layname,'insertion_tmpl', { 'width' : insertions[insert].length, 'height' : 10, 'insert' : insertions[insert].match(/(\w{1,10})/g).join(' ')});
                //   seq_callout.addEventListener('click',function() {
                //     this.parentNode.removeChild(this);
                //   });
                //   renderer.refresh();
                // });
                // })(layname,insert,insertions,name);
               // var an_anno = widget_rend.getAA(insert).callout('lay'+i,'insertion_tmpl', { 'width' : aligned[i].insertions[insert].length*10, 'height' : 12, 'insert' : aligned[i].insertions[insert]});
                // console.log(an_anno);
              }
            }
        }
        renderer.zoom = 1;
        bean.fire(MASCP.getGroup(group_name),'visibilityChange',[renderer,true]);
        renderer.refresh();

    };

    this.bind('resultReceived',function() {
        var self = this;
        redraw_alignments(0);
        var accs = [];
        self.sequences.forEach(function(seq) {
            accs.push(seq.agi.toUpperCase());
        });

        renderer.bind('orderChanged',function(order) {
            if (self.result) {
                redraw_alignments(accs.indexOf(order[(order.indexOf(controller_name)+1)]));
            }
        });
    });

}

MASCP.ClustalRunner.Result.prototype.getSequences = function() {
    if (this._raw_data && this._raw_data.data && this._raw_data.data.sequences) {
        return [].concat(this._raw_data.data.sequences);
    }
    var bits = this._raw_data.match(/seq\d+(.*)/g);
    var results = [];
    for (var i = 0; i < bits.length; i++) {
        var seqbits = bits[i].match(/seq(\d+)\s+(.*)/);
        if (! results[seqbits[1]]) {
            results[seqbits[1]] = '';
        }
        results[seqbits[1]] += seqbits[2];
    }
    return results;
};

MASCP.ClustalRunner.Result.prototype.getAlignment = function() {
    if (this._raw_data && this._raw_data.data && this._raw_data.data.alignment) {
        return this._raw_data.data.alignment.toString();
    }
    this._text_data = this._raw_data;
    var re = / {16}(.*)/g;
    var result = "";
    var match = re.exec(this._raw_data);
    while (match !== null) {
        result += match[1];
        match = re.exec(this._raw_data);
    }

    return result;
};
/** @fileOverview   Classes for reading data from PRIDE */
if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

/** Default class constructor
 *  @class      Service class that will retrieve data from Clustal for given sequences
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.HydropathyRunner = MASCP.buildService(function(data) {
                        this._raw_data = data;
                        return this;
                    });

MASCP.HydropathyRunner.prototype.retrieve = function()
{
    bean.fire(this,'resultReceived');
};

MASCP.HydropathyRunner.prototype.setupSequenceRenderer = function(renderer,options) {
    this.bind('resultReceived',function() {
        var windowSize = 5;
        options = options || {};
        var kd = { 'A': 1.8,'R':-4.5,'N':-3.5,'D':-3.5,'C': 2.5,
               'Q':-3.5,'E':-3.5,'G':-0.4,'H':-3.2,'I': 4.5,
               'L': 3.8,'K':-3.9,'M': 1.9,'F': 2.8,'P':-1.6,
               'S':-0.8,'T':-0.7,'W':-0.9,'Y':-1.3,'V': 4.2 };
        var values = [];
        for (var i = 0; i < windowSize; i++) {
            values[i] = 0;
        }
        for (var i = windowSize; i < (renderer._sequence_els.length - windowSize); i++ ) {
            var value = 0;
            for (var j = -1*windowSize; j <= windowSize; j++) {
                value += kd[renderer._sequence_els[i+j].amino_acid[0]] / (windowSize * 2 + 1);
            }
            values.push(value);
        }
        if ( ! options.track ) {
            MASCP.registerLayer('hydropathy',{ 'fullname' : 'Hydropathy plot', 'color' : '#f00' });
        }
        renderer.addValuesToLayer(options.track || 'hydropathy',values,options);
        renderer.trigger('resultsRendered',[this]);
    });
};


/** @fileOverview   Classes for reading data from PRIDE */
if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

/** Default class constructor
 *  @class      Service class that will retrieve data from Clustal for given sequences
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.PrideRunner = MASCP.buildService(function(data) {
                        this._raw_data = data;
                        return this;
                    });

MASCP.PrideRunner.SERVICE_URL = 'http://www.ebi.ac.uk/pride/biomart/martservice';

MASCP.PrideRunner.prototype.requestData = function()
{
    var identifiers = [].concat(this.identifiers || []);
    var self = this;
    if (! this._endpointURL.match(/ebi\.ac/)) {
        return {
            type: "GET",
            dataType: "json",
            data : {
                'agi' : self.agi,
                'service' : 'pride'
            }
        };
    }
    var nl = "\n";
    bean.fire(self,'running');
    return {
        type: "GET",
        dataType: "txt",
        data : {
            "query" :   encodeURIComponent('<?xml version="1.0" encoding="UTF-8"?>' +
                        '<!DOCTYPE Query>' +
                        '<Query  virtualSchemaName = "default" formatter = "CSV" header = "0" uniqueRows = "0" count = "" datasetConfigVersion = "0.6" >'+
                        '<Dataset name = "pride" interface = "default" ><Filter name = "submitted_accession_option" value = "'+self.agi+'"/>'+
                        '<Attribute name = "peptide_sequence" /><Attribute name = "start_coord" /><Attribute name = "end_coord" />'+
                        '</Dataset>'+
                        '</Query>')
        }
    }
};

MASCP.PrideRunner.prototype.setupSequenceRenderer = function(renderer,options) {
    if ( ! options ) {
        options = {};
    }
    this.bind('resultReceived',function() {
      var raw_values = [];
      var max_val = 0;
      this.result._raw_data.data.forEach(function(pep) {
        if (pep.peptide.length < 1) {
          return;
        }
        var aas = renderer.getAminoAcidsByPeptide(pep.peptide);
        if (! aas || aas.length < pep.peptide.length ) {
          return;
        }
        renderer.getAminoAcidsByPeptide(pep.peptide).forEach(function(aa) {
          raw_values[aa._index] = raw_values[aa._index] || 0;
          raw_values[aa._index] += pep.count;
          if (raw_values[aa._index] > max_val) {
            max_val = raw_values[aa._index];
          }
        });
      });
      var values = [];
      for (var i = 0; i < renderer.sequence.length; i++ ) {
        if (raw_values[i]) {
          values.push(raw_values[i]/max_val);
        } else {
          values.push(0);
        }
      }
      var plot = renderer.addValuesToLayer(options.track || this.agi,values,{'height' : 12, 'offset' : isNaN(options.offset) ? 0 : options.offset, 'label' : { 'max' : max_val+' PRIDE peptides' } });
      plot.setAttribute('stroke','#00f');
      renderer.trigger('resultsRendered',[this]);
    });
};


(function(serv) {
    var defaultDataReceived = serv.prototype._dataReceived;

    serv.prototype._dataReceived = function(data,status)
    {
        if (data === null) {
            return defaultDataReceived.call(this,null,status);
        }
        if (typeof data == "object") {
            if (data.status && data.status == "RUNNING") {
                var self = this;
                bean.fire(self,"running");
                setTimeout(function() {
                    self.retrieve(self.agi);
                },5000);
                console.log("Got back running status");
                return;
            }
        }
        if (typeof data == "string") {
            var results = [];
            var peptide_hash = {};
            data.split('\n').forEach(function(row) {
                var bits = row.split(',');
                if (bits.length < 1) {
                    return;
                }
                if ( peptide_hash[ bits[0] ]) {
                    peptide_hash[ bits[0] ].count++;
                    if (bits[1]) {
                        peptide_hash[ bits[0] ].start = bits[1];
                        peptide_hash[ bits[0] ].end = bits[2];
                    }
                } else {
                    peptide_hash[ bits[0] ] = { "peptide" : bits[0], "start" : bits[1], "end" : bits[2], "count" : 1 };
                    results.push( peptide_hash[bits[0]] );
                }
            });
            data = results;
        }
        return defaultDataReceived.call(this,data,status);
    };
})(MASCP.PrideRunner);


MascotToJSON = function() {
};

(function() {

var mascot_params = {
    /** Parameters that can be changed */
    'file'          : '',

    /** Required parameters */

    'do_export'     : '1',
    'export_format' : 'CSV',
    'protein_master': '1',
    'peptide_master': '1',
    'pep_seq'       : '1',
    'pep_score'     : '0',
    'REPORT'        : 'AUTO',
    'show_same_sets': '1',
    '_requireboldred': '1',
    '_ignoreionsscorebelow':'0.05',
    
    /** optional parameters */
    
    'prot_hit_num'  : '0',
    'pep_end'       : '0',
    'pep_miss'      : '0',
    'pep_homol'     : '0',
    'pep_ident'     : '0',
    'pep_frame'     : '0',
    'pep_var_mod'   : '0',
    'pep_num_match' : '0',
    'pep_scan_title': '0',
    'pep_query'     : '0',
    'pep_rank'      : "0",
    'pep_isbold'    : '0',
    'pep_exp_mz'    : '0',
    'pep_calc_mr'   : '0',
    'pep_exp_z'     : '0',
    'pep_exp_mr'    : '0',
    'pep_delta'     : '0',
    '_sigthreshold' : '0.05',
    '_showallfromerrortolerant':'0',
    '_onlyerrortolerant':'0',
    '_noerrortolerant':'0',
    '_show_decoy_report':'0',
    '_showsubsets'  : '0',
    '_server_mudpit_switch':'0.000000001'
};

var clone = function(obj){
    if(obj === null || typeof(obj) != 'object') {
        return obj;
    }

    var temp = obj.constructor(); // changed

    for(var key in obj) {
        if (obj.hasOwnProperty(key)) {
            temp[key] = clone(obj[key]);
        }
    }
    return temp;
};

var params_to_url = function(params) {
    var result = [];
    for (var nam in params) {
        if (params.hasOwnProperty(nam)) {
            result.push(nam +'='+params[nam]);
        }
    }
    return result.join('&');
};

var CSVToArray = function( strData, strDelimiter ){
    strDelimiter = (strDelimiter || ",");

    var objPattern = new RegExp(
    (
    "(\\" + strDelimiter + "|\\r?\\n|\\r|^)" +
    "(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +
    "([^\"\\" + strDelimiter + "\\r\\n]*))"
    ),
    "gi"
    );

    var arrData = [[]];
    var arrMatches = null;
    while ((arrMatches = objPattern.exec( strData )) !== null){
        var strMatchedDelimiter = arrMatches[ 1 ];
        if (
        strMatchedDelimiter.length &&
        (strMatchedDelimiter != strDelimiter)
        ){
            arrData.push( [] );
        }
        var strMatchedValue;
        if (arrMatches[ 2 ]){
            strMatchedValue = arrMatches[ 2 ].replace(
            new RegExp( "\"\"", "g" ),
            "\""
            );
        } else {
            strMatchedValue = arrMatches[ 3 ];
        }
        arrData[ arrData.length - 1 ].push( strMatchedValue );
    }
    return( arrData );
};

var data_matrix_to_summary = function(data) {
    var results = [];
    var agi = null;
    var seen = {};
    data.forEach(function(row) {
        if (row[1] && row[1] !== '') {
            agi = row[1];
        }
        var pep_seq = row[6]+row[7]+row[8];
        if ( pep_seq && ! seen[agi+pep_seq]) {
            results.push([agi,pep_seq]);            
        }
        seen[agi+pep_seq] = 1;
    });
    return results;
};


MascotToJSON.prototype.convertReport = function(report,callback) {
    var self = this;
    var xhr = new window.XMLHttpRequest();
    var report_base = report.replace(/master_results(_2)?.pl.*/,'export_dat_2.pl');
    var file_url = (/file=([^&]*)/.exec(report) || []).shift();
    var params = clone(mascot_params);
    params.file = file_url;
    
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
            if(xhr.status == 200) {
                var response = xhr.responseText;
                // Remove the header lines from the mascot response
                response = response.replace(/(.+\n)+\n.*\n/m,'');
                if (callback) {
                    callback.call(self,data_matrix_to_summary(CSVToArray(response)));
                }
            } else if (xhr.status === 0) {
                if (callback) {
                    callback.call(self,[],new Error("Could not load page"));
                }
            }
        }        
    };
    xhr.open("GET", report_base+'?'+params_to_url(params), true);
    xhr.send(null);
};

})();


if (typeof module != 'undefined' && module.exports){
    module.exports.MascotToJSON = MascotToJSON;
}/*! Hammer.JS - v1.0.7dev - 2014-01-15
 * http://eightmedia.github.com/hammer.js
 *
 * Copyright (c) 2014 Jorik Tangelder <j.tangelder@gmail.com>;
 * Licensed under the MIT license */

(function(window, undefined) {
  'use strict';

/**
 * Hammer
 * use this to create instances
 * @param   {HTMLElement}   element
 * @param   {Object}        options
 * @returns {Hammer.Instance}
 * @constructor
 */
var Hammer = function(element, options) {
  return new Hammer.Instance(element, options || {});
};

// default settings
Hammer.defaults = {
  // add styles and attributes to the element to prevent the browser from doing
  // its native behavior. this doesnt prevent the scrolling, but cancels
  // the contextmenu, tap highlighting etc
  // set to false to disable this
  stop_browser_behavior: {
    // this also triggers onselectstart=false for IE
    userSelect       : 'none',
    // this makes the element blocking in IE10 >, you could experiment with the value
    // see for more options this issue; https://github.com/EightMedia/hammer.js/issues/241
    touchAction      : 'none',
    touchCallout     : 'none',
    contentZooming   : 'none',
    userDrag         : 'none',
    tapHighlightColor: 'rgba(0,0,0,0)'
  }

  //
  // more settings are defined per gesture at gestures.js
  //
};

// detect touchevents
Hammer.HAS_POINTEREVENTS = window.navigator.pointerEnabled || window.navigator.msPointerEnabled;
Hammer.HAS_TOUCHEVENTS = ('ontouchstart' in window);

// dont use mouseevents on mobile devices
Hammer.MOBILE_REGEX = /mobile|tablet|ip(ad|hone|od)|android|silk/i;
Hammer.NO_MOUSEEVENTS = Hammer.HAS_TOUCHEVENTS && window.navigator.userAgent.match(Hammer.MOBILE_REGEX);

// eventtypes per touchevent (start, move, end)
// are filled by Hammer.event.determineEventTypes on setup
Hammer.EVENT_TYPES = {};

// direction defines
Hammer.DIRECTION_DOWN = 'down';
Hammer.DIRECTION_LEFT = 'left';
Hammer.DIRECTION_UP = 'up';
Hammer.DIRECTION_RIGHT = 'right';

// pointer type
Hammer.POINTER_MOUSE = 'mouse';
Hammer.POINTER_TOUCH = 'touch';
Hammer.POINTER_PEN = 'pen';

// touch event defines
Hammer.EVENT_START = 'start';
Hammer.EVENT_MOVE = 'move';
Hammer.EVENT_END = 'end';

// hammer document where the base events are added at
Hammer.DOCUMENT = window.document;

// plugins and gestures namespaces
Hammer.plugins = Hammer.plugins || {};
Hammer.gestures = Hammer.gestures || {};

// if the window events are set...
Hammer.READY = false;

/**
 * setup events to detect gestures on the document
 */
function setup() {
  if(Hammer.READY) {
    return;
  }

  // find what eventtypes we add listeners to
  Hammer.event.determineEventTypes();

  // Register all gestures inside Hammer.gestures
  Hammer.utils.each(Hammer.gestures, function(gesture){
    Hammer.detection.register(gesture);
  });

  // Add touch events on the document
  Hammer.event.onTouch(Hammer.DOCUMENT, Hammer.EVENT_MOVE, Hammer.detection.detect);
  Hammer.event.onTouch(Hammer.DOCUMENT, Hammer.EVENT_END, Hammer.detection.detect);

  // Hammer is ready...!
  Hammer.READY = true;
}

Hammer.utils = {
  /**
   * extend method,
   * also used for cloning when dest is an empty object
   * @param   {Object}    dest
   * @param   {Object}    src
   * @parm  {Boolean}  merge    do a merge
   * @returns {Object}    dest
   */
  extend: function extend(dest, src, merge) {
    for(var key in src) {
      if(dest[key] !== undefined && merge) {
        continue;
      }
      dest[key] = src[key];
    }
    return dest;
  },


  /**
   * for each
   * @param obj
   * @param iterator
   */
  each: function(obj, iterator, context) {
    var i, length;
    // native forEach on arrays
    if ('forEach' in obj) {
      obj.forEach(iterator, context);
    }
    // arrays
    else if(obj.length !== undefined) {
      for (i = 0, length = obj.length; i < length; i++) {
        if (iterator.call(context, obj[i], i, obj) === false) {
          return;
        }
      }
    }
    // objects
    else {
      for (i in obj) {
        if (obj.hasOwnProperty(i) && iterator.call(context, obj[i], i, obj) === false) {
          return;
        }
      }
    }
  },

  /**
   * find if a node is in the given parent
   * used for event delegation tricks
   * @param   {HTMLElement}   node
   * @param   {HTMLElement}   parent
   * @returns {boolean}       has_parent
   */
  hasParent: function(node, parent) {
    while(node) {
      if(node == parent) {
        return true;
      }
      node = node.parentNode;
    }
    return false;
  },


  /**
   * get the center of all the touches
   * @param   {Array}     touches
   * @returns {Object}    center
   */
  getCenter: function getCenter(touches) {
    var valuesX = [], valuesY = [];

    Hammer.utils.each(touches, function(touch) {
      // I prefer clientX because it ignore the scrolling position
      valuesX.push(typeof touch.clientX !== 'undefined' ? touch.clientX : touch.pageX );
      valuesY.push(typeof touch.clientY !== 'undefined' ? touch.clientY : touch.pageY );
    });

    return {
      pageX: ((Math.min.apply(Math, valuesX) + Math.max.apply(Math, valuesX)) / 2),
      pageY: ((Math.min.apply(Math, valuesY) + Math.max.apply(Math, valuesY)) / 2)
    };
  },


  /**
   * calculate the velocity between two points
   * @param   {Number}    delta_time
   * @param   {Number}    delta_x
   * @param   {Number}    delta_y
   * @returns {Object}    velocity
   */
  getVelocity: function getVelocity(delta_time, delta_x, delta_y) {
    return {
      x: Math.abs(delta_x / delta_time) || 0,
      y: Math.abs(delta_y / delta_time) || 0
    };
  },


  /**
   * calculate the angle between two coordinates
   * @param   {Touch}     touch1
   * @param   {Touch}     touch2
   * @returns {Number}    angle
   */
  getAngle: function getAngle(touch1, touch2) {
    var y = touch2.pageY - touch1.pageY,
      x = touch2.pageX - touch1.pageX;
    return Math.atan2(y, x) * 180 / Math.PI;
  },


  /**
   * angle to direction define
   * @param   {Touch}     touch1
   * @param   {Touch}     touch2
   * @returns {String}    direction constant, like Hammer.DIRECTION_LEFT
   */
  getDirection: function getDirection(touch1, touch2) {
    var x = Math.abs(touch1.pageX - touch2.pageX),
      y = Math.abs(touch1.pageY - touch2.pageY);

    if(x >= y) {
      return touch1.pageX - touch2.pageX > 0 ? Hammer.DIRECTION_LEFT : Hammer.DIRECTION_RIGHT;
    }
    else {
      return touch1.pageY - touch2.pageY > 0 ? Hammer.DIRECTION_UP : Hammer.DIRECTION_DOWN;
    }
  },


  /**
   * calculate the distance between two touches
   * @param   {Touch}     touch1
   * @param   {Touch}     touch2
   * @returns {Number}    distance
   */
  getDistance: function getDistance(touch1, touch2) {
    var x = touch2.pageX - touch1.pageX,
      y = touch2.pageY - touch1.pageY;
    return Math.sqrt((x * x) + (y * y));
  },


  /**
   * calculate the scale factor between two touchLists (fingers)
   * no scale is 1, and goes down to 0 when pinched together, and bigger when pinched out
   * @param   {Array}     start
   * @param   {Array}     end
   * @returns {Number}    scale
   */
  getScale: function getScale(start, end) {
    // need two fingers...
    if(start.length >= 2 && end.length >= 2) {
      return this.getDistance(end[0], end[1]) /
        this.getDistance(start[0], start[1]);
    }
    return 1;
  },


  /**
   * calculate the rotation degrees between two touchLists (fingers)
   * @param   {Array}     start
   * @param   {Array}     end
   * @returns {Number}    rotation
   */
  getRotation: function getRotation(start, end) {
    // need two fingers
    if(start.length >= 2 && end.length >= 2) {
      return this.getAngle(end[1], end[0]) -
        this.getAngle(start[1], start[0]);
    }
    return 0;
  },


  /**
   * boolean if the direction is vertical
   * @param    {String}    direction
   * @returns  {Boolean}   is_vertical
   */
  isVertical: function isVertical(direction) {
    return (direction == Hammer.DIRECTION_UP || direction == Hammer.DIRECTION_DOWN);
  },


  /**
   * stop browser default behavior with css props
   * @param   {HtmlElement}   element
   * @param   {Object}        css_props
   */
  stopDefaultBrowserBehavior: function stopDefaultBrowserBehavior(element, css_props) {
    if(!css_props || !element || !element.style) {
      return;
    }

    // with css properties for modern browsers
    Hammer.utils.each(['webkit', 'khtml', 'moz', 'Moz', 'ms', 'o', ''], function(vendor) {
      Hammer.utils.each(css_props, function(value, prop) {
          // vender prefix at the property
          if(vendor) {
            prop = vendor + prop.substring(0, 1).toUpperCase() + prop.substring(1);
          }
          // set the style
          if(prop in element.style) {
            element.style[prop] = value;
          }
      });
    });

    // also the disable onselectstart
    if(css_props.userSelect == 'none') {
      element.onselectstart = function() {
        return false;
      };
    }

    // and disable ondragstart
    if(css_props.userDrag == 'none') {
      element.ondragstart = function() {
        return false;
      };
    }
  }
};


/**
 * create new hammer instance
 * all methods should return the instance itself, so it is chainable.
 * @param   {HTMLElement}       element
 * @param   {Object}            [options={}]
 * @returns {Hammer.Instance}
 * @constructor
 */
Hammer.Instance = function(element, options) {
  var self = this;

  // setup HammerJS window events and register all gestures
  // this also sets up the default options
  setup();

  this.element = element;

  // start/stop detection option
  this.enabled = true;

  // merge options
  this.options = Hammer.utils.extend(
    Hammer.utils.extend({}, Hammer.defaults),
    options || {});

  // add some css to the element to prevent the browser from doing its native behavoir
  if(this.options.stop_browser_behavior) {
    Hammer.utils.stopDefaultBrowserBehavior(this.element, this.options.stop_browser_behavior);
  }

  // start detection on touchstart
  Hammer.event.onTouch(element, Hammer.EVENT_START, function(ev) {
    if(self.enabled) {
      Hammer.detection.startDetect(self, ev);
    }
  });

  // return instance
  return this;
};


Hammer.Instance.prototype = {
  /**
   * bind events to the instance
   * @param   {String}      gesture
   * @param   {Function}    handler
   * @returns {Hammer.Instance}
   */
  on: function onEvent(gesture, handler) {
    var gestures = gesture.split(' ');
    Hammer.utils.each(gestures, function(gesture) {
      this.element.addEventListener(gesture, handler, false);
    }, this);
    return this;
  },


  /**
   * unbind events to the instance
   * @param   {String}      gesture
   * @param   {Function}    handler
   * @returns {Hammer.Instance}
   */
  off: function offEvent(gesture, handler) {
    var gestures = gesture.split(' ');
    Hammer.utils.each(gestures, function(gesture) {
      this.element.removeEventListener(gesture, handler, false);
    }, this);
    return this;
  },


  /**
   * trigger gesture event
   * @param   {String}      gesture
   * @param   {Object}      [eventData]
   * @returns {Hammer.Instance}
   */
  trigger: function triggerEvent(gesture, eventData) {
    // optional
    if(!eventData) {
      eventData = {};
    }

    // create DOM event
    var event = Hammer.DOCUMENT.createEvent('Event');
    event.initEvent(gesture, true, true);
    event.gesture = eventData;

    // trigger on the target if it is in the instance element,
    // this is for event delegation tricks
    var element = this.element;
    if(Hammer.utils.hasParent(eventData.target, element)) {
      element = eventData.target;
    }

    element.dispatchEvent(event);
    return this;
  },


  /**
   * enable of disable hammer.js detection
   * @param   {Boolean}   state
   * @returns {Hammer.Instance}
   */
  enable: function enable(state) {
    this.enabled = state;
    return this;
  }
};


/**
 * this holds the last move event,
 * used to fix empty touchend issue
 * see the onTouch event for an explanation
 * @type {Object}
 */
var last_move_event = null;


/**
 * when the mouse is hold down, this is true
 * @type {Boolean}
 */
var enable_detect = false;


/**
 * when touch events have been fired, this is true
 * @type {Boolean}
 */
var touch_triggered = false;


Hammer.event = {
  /**
   * simple addEventListener
   * @param   {HTMLElement}   element
   * @param   {String}        type
   * @param   {Function}      handler
   */
  bindDom: function(element, type, handler) {
    var types = type.split(' ');
    Hammer.utils.each(types, function(type){
      element.addEventListener(type, handler, false);
    });
  },


  /**
   * touch events with mouse fallback
   * @param   {HTMLElement}   element
   * @param   {String}        eventType        like Hammer.EVENT_MOVE
   * @param   {Function}      handler
   */
  onTouch: function onTouch(element, eventType, handler) {
    var self = this;

    this.bindDom(element, Hammer.EVENT_TYPES[eventType], function bindDomOnTouch(ev) {
      var sourceEventType = ev.type.toLowerCase();

      // onmouseup, but when touchend has been fired we do nothing.
      // this is for touchdevices which also fire a mouseup on touchend
      if(sourceEventType.match(/mouse/) && touch_triggered) {
        return;
      }

      // mousebutton must be down or a touch event
      else if(sourceEventType.match(/touch/) ||   // touch events are always on screen
        sourceEventType.match(/pointerdown/) || // pointerevents touch
        (sourceEventType.match(/mouse/) && ev.which === 1)   // mouse is pressed
        ) {
        enable_detect = true;
      }

      // mouse isn't pressed
      else if(sourceEventType.match(/mouse/) && !ev.which) {
        enable_detect = false;
      }


      // we are in a touch event, set the touch triggered bool to true,
      // this for the conflicts that may occur on ios and android
      if(sourceEventType.match(/touch|pointer/)) {
        touch_triggered = true;
      }

      // count the total touches on the screen
      var count_touches = 0;

      // when touch has been triggered in this detection session
      // and we are now handling a mouse event, we stop that to prevent conflicts
      if(enable_detect) {
        // update pointerevent
        if(Hammer.HAS_POINTEREVENTS && eventType != Hammer.EVENT_END) {
          count_touches = Hammer.PointerEvent.updatePointer(eventType, ev);
        }
        // touch
        else if(sourceEventType.match(/touch/)) {
          count_touches = ev.touches.length;
        }
        // mouse
        else if(!touch_triggered) {
          count_touches = sourceEventType.match(/up/) ? 0 : 1;
        }

        // if we are in a end event, but when we remove one touch and
        // we still have enough, set eventType to move
        if(count_touches > 0 && eventType == Hammer.EVENT_END) {
          eventType = Hammer.EVENT_MOVE;
        }
        // no touches, force the end event
        else if(!count_touches) {
          eventType = Hammer.EVENT_END;
        }

        // store the last move event
        if(count_touches || last_move_event === null) {
          last_move_event = ev;
        }

        // trigger the handler
        handler.call(Hammer.detection, self.collectEventData(element, eventType, self.getTouchList(last_move_event, eventType), ev));

        // remove pointerevent from list
        if(Hammer.HAS_POINTEREVENTS && eventType == Hammer.EVENT_END) {
          count_touches = Hammer.PointerEvent.updatePointer(eventType, ev);
        }
      }

      // on the end we reset everything
      if(!count_touches) {
        last_move_event = null;
        enable_detect = false;
        touch_triggered = false;
        Hammer.PointerEvent.reset();
      }
    });
  },


  /**
   * we have different events for each device/browser
   * determine what we need and set them in the Hammer.EVENT_TYPES constant
   */
  determineEventTypes: function determineEventTypes() {
    // determine the eventtype we want to set
    var types;

    // pointerEvents magic
    if(Hammer.HAS_POINTEREVENTS) {
      types = Hammer.PointerEvent.getEvents();
    }
    // on Android, iOS, blackberry, windows mobile we dont want any mouseevents
    else if(Hammer.NO_MOUSEEVENTS) {
      types = [
        'touchstart',
        'touchmove',
        'touchend touchcancel'];
    }
    // for non pointer events browsers and mixed browsers,
    // like chrome on windows8 touch laptop
    else {
      types = [
        'touchstart mousedown',
        'touchmove mousemove',
        'touchend touchcancel mouseup'];
    }

    Hammer.EVENT_TYPES[Hammer.EVENT_START] = types[0];
    Hammer.EVENT_TYPES[Hammer.EVENT_MOVE] = types[1];
    Hammer.EVENT_TYPES[Hammer.EVENT_END] = types[2];
  },


  /**
   * create touchlist depending on the event
   * @param   {Object}    ev
   * @param   {String}    eventType   used by the fakemultitouch plugin
   */
  getTouchList: function getTouchList(ev/*, eventType*/) {
    // get the fake pointerEvent touchlist
    if(Hammer.HAS_POINTEREVENTS) {
      return Hammer.PointerEvent.getTouchList();
    }
    // get the touchlist
    else if(ev.touches) {
      return ev.touches;
    }
    // make fake touchlist from mouse position
    else {
      ev.identifier = 1;
      return [ev];
    }
  },


  /**
   * collect event data for Hammer js
   * @param   {HTMLElement}   element
   * @param   {String}        eventType        like Hammer.EVENT_MOVE
   * @param   {Object}        eventData
   */
  collectEventData: function collectEventData(element, eventType, touches, ev) {
    // find out pointerType
    var pointerType = Hammer.POINTER_TOUCH;
    if(ev.type.match(/mouse/) || Hammer.PointerEvent.matchType(Hammer.POINTER_MOUSE, ev)) {
      pointerType = Hammer.POINTER_MOUSE;
    }

    return {
      center     : Hammer.utils.getCenter(touches),
      timeStamp  : new Date().getTime(),
      target     : ev.target,
      touches    : touches,
      eventType  : eventType,
      pointerType: pointerType,
      srcEvent   : ev,

      /**
       * prevent the browser default actions
       * mostly used to disable scrolling of the browser
       */
      preventDefault: function() {
        if(this.srcEvent.preventManipulation) {
          this.srcEvent.preventManipulation();
        }

        if(this.srcEvent.preventDefault) {
          this.srcEvent.preventDefault();
        }
      },

      /**
       * stop bubbling the event up to its parents
       */
      stopPropagation: function() {
        this.srcEvent.stopPropagation();
      },

      /**
       * immediately stop gesture detection
       * might be useful after a swipe was detected
       * @return {*}
       */
      stopDetect: function() {
        return Hammer.detection.stopDetect();
      }
    };
  }
};

Hammer.PointerEvent = {
  /**
   * holds all pointers
   * @type {Object}
   */
  pointers: {},

  /**
   * get a list of pointers
   * @returns {Array}     touchlist
   */
  getTouchList: function() {
    var self = this;
    var touchlist = [];

    // we can use forEach since pointerEvents only is in IE10
    Hammer.utils.each(self.pointers, function(pointer){
      touchlist.push(pointer);
    });
    
    return touchlist;
  },

  /**
   * update the position of a pointer
   * @param   {String}   type             Hammer.EVENT_END
   * @param   {Object}   pointerEvent
   */
  updatePointer: function(type, pointerEvent) {
    if(type == Hammer.EVENT_END) {
      this.pointers = {};
    }
    else {
      pointerEvent.identifier = pointerEvent.pointerId;
      this.pointers[pointerEvent.pointerId] = pointerEvent;
    }

    return Object.keys(this.pointers).length;
  },

  /**
   * check if ev matches pointertype
   * @param   {String}        pointerType     Hammer.POINTER_MOUSE
   * @param   {PointerEvent}  ev
   */
  matchType: function(pointerType, ev) {
    if(!ev.pointerType) {
      return false;
    }

    var pt = ev.pointerType,
      types = {};
    types[Hammer.POINTER_MOUSE] = (pt === ev.MSPOINTER_TYPE_MOUSE || pt === Hammer.POINTER_MOUSE);
    types[Hammer.POINTER_TOUCH] = (pt === ev.MSPOINTER_TYPE_TOUCH || pt === Hammer.POINTER_TOUCH);
    types[Hammer.POINTER_PEN] = (pt === ev.MSPOINTER_TYPE_PEN || pt === Hammer.POINTER_PEN);
    return types[pointerType];
  },


  /**
   * get events
   */
  getEvents: function() {
    return [
      'pointerdown MSPointerDown',
      'pointermove MSPointerMove',
      'pointerup pointercancel MSPointerUp MSPointerCancel'
    ];
  },

  /**
   * reset the list
   */
  reset: function() {
    this.pointers = {};
  }
};


Hammer.detection = {
  // contains all registred Hammer.gestures in the correct order
  gestures: [],

  // data of the current Hammer.gesture detection session
  current : null,

  // the previous Hammer.gesture session data
  // is a full clone of the previous gesture.current object
  previous: null,

  // when this becomes true, no gestures are fired
  stopped : false,


  /**
   * start Hammer.gesture detection
   * @param   {Hammer.Instance}   inst
   * @param   {Object}            eventData
   */
  startDetect: function startDetect(inst, eventData) {
    // already busy with a Hammer.gesture detection on an element
    if(this.current) {
      return;
    }

    this.stopped = false;

    this.current = {
      inst      : inst, // reference to HammerInstance we're working for
      startEvent: Hammer.utils.extend({}, eventData), // start eventData for distances, timing etc
      lastEvent : false, // last eventData
      name      : '' // current gesture we're in/detected, can be 'tap', 'hold' etc
    };

    this.detect(eventData);
  },


  /**
   * Hammer.gesture detection
   * @param   {Object}    eventData
   */
  detect: function detect(eventData) {
    if(!this.current || this.stopped) {
      return;
    }

    // extend event data with calculations about scale, distance etc
    eventData = this.extendEventData(eventData);

    // instance options
    var inst_options = this.current.inst.options;

    // call Hammer.gesture handlers
    Hammer.utils.each(this.gestures, function(gesture) {
      // only when the instance options have enabled this gesture
      if(!this.stopped && inst_options[gesture.name] !== false) {
        // if a handler returns false, we stop with the detection
        if(gesture.handler.call(gesture, eventData, this.current.inst) === false) {
          this.stopDetect();
          return false;
        }
      }
    }, this);

    // store as previous event event
    if(this.current) {
      this.current.lastEvent = eventData;
    }

    // endevent, but not the last touch, so dont stop
    if(eventData.eventType == Hammer.EVENT_END && !eventData.touches.length - 1) {
      this.stopDetect();
    }

    return eventData;
  },


  /**
   * clear the Hammer.gesture vars
   * this is called on endDetect, but can also be used when a final Hammer.gesture has been detected
   * to stop other Hammer.gestures from being fired
   */
  stopDetect: function stopDetect() {
    // clone current data to the store as the previous gesture
    // used for the double tap gesture, since this is an other gesture detect session
    this.previous = Hammer.utils.extend({}, this.current);

    // reset the current
    this.current = null;

    // stopped!
    this.stopped = true;
  },


  /**
   * extend eventData for Hammer.gestures
   * @param   {Object}   ev
   * @returns {Object}   ev
   */
  extendEventData: function extendEventData(ev) {
    var startEv = this.current.startEvent;

    // if the touches change, set the new touches over the startEvent touches
    // this because touchevents don't have all the touches on touchstart, or the
    // user must place his fingers at the EXACT same time on the screen, which is not realistic
    // but, sometimes it happens that both fingers are touching at the EXACT same time
    if(startEv && (ev.touches.length != startEv.touches.length || ev.touches === startEv.touches)) {
      // extend 1 level deep to get the touchlist with the touch objects
      startEv.touches = [];
      Hammer.utils.each(ev.touches, function(touch) {
        startEv.touches.push(Hammer.utils.extend({}, touch));
      });
    }

    var delta_time = ev.timeStamp - startEv.timeStamp
      , delta_x = ev.center.pageX - startEv.center.pageX
      , delta_y = ev.center.pageY - startEv.center.pageY
      , velocity = Hammer.utils.getVelocity(delta_time, delta_x, delta_y)
      , interimAngle
      , interimDirection;

    // end events (e.g. dragend) don't have useful values for interimDirection & interimAngle
    // because the previous event has exactly the same coordinates
    // so for end events, take the previous values of interimDirection & interimAngle
    // instead of recalculating them and getting a spurious '0'
    if(ev.eventType === 'end') {
      interimAngle = this.current.lastEvent && this.current.lastEvent.interimAngle;
      interimDirection = this.current.lastEvent && this.current.lastEvent.interimDirection;
    }
    else {
      interimAngle = this.current.lastEvent && Hammer.utils.getAngle(this.current.lastEvent.center, ev.center);
      interimDirection = this.current.lastEvent && Hammer.utils.getDirection(this.current.lastEvent.center, ev.center);
    }

    Hammer.utils.extend(ev, {
      deltaTime: delta_time,

      deltaX: delta_x,
      deltaY: delta_y,

      velocityX: velocity.x,
      velocityY: velocity.y,

      distance: Hammer.utils.getDistance(startEv.center, ev.center),

      angle: Hammer.utils.getAngle(startEv.center, ev.center),
      interimAngle: interimAngle,

      direction: Hammer.utils.getDirection(startEv.center, ev.center),
      interimDirection: interimDirection,

      scale: Hammer.utils.getScale(startEv.touches, ev.touches),
      rotation: Hammer.utils.getRotation(startEv.touches, ev.touches),

      startEvent: startEv
    });

    return ev;
  },


  /**
   * register new gesture
   * @param   {Object}    gesture object, see gestures.js for documentation
   * @returns {Array}     gestures
   */
  register: function register(gesture) {
    // add an enable gesture options if there is no given
    var options = gesture.defaults || {};
    if(options[gesture.name] === undefined) {
      options[gesture.name] = true;
    }

    // extend Hammer default options with the Hammer.gesture options
    Hammer.utils.extend(Hammer.defaults, options, true);

    // set its index
    gesture.index = gesture.index || 1000;

    // add Hammer.gesture to the list
    this.gestures.push(gesture);

    // sort the list by index
    this.gestures.sort(function(a, b) {
      if(a.index < b.index) { return -1; }
      if(a.index > b.index) { return 1; }
      return 0;
    });

    return this.gestures;
  }
};


/**
 * Drag
 * Move with x fingers (default 1) around on the page. Blocking the scrolling when
 * moving left and right is a good practice. When all the drag events are blocking
 * you disable scrolling on that area.
 * @events  drag, drapleft, dragright, dragup, dragdown
 */
Hammer.gestures.Drag = {
  name     : 'drag',
  index    : 50,
  defaults : {
    drag_min_distance            : 10,

    // Set correct_for_drag_min_distance to true to make the starting point of the drag
    // be calculated from where the drag was triggered, not from where the touch started.
    // Useful to avoid a jerk-starting drag, which can make fine-adjustments
    // through dragging difficult, and be visually unappealing.
    correct_for_drag_min_distance: true,

    // set 0 for unlimited, but this can conflict with transform
    drag_max_touches             : 1,

    // prevent default browser behavior when dragging occurs
    // be careful with it, it makes the element a blocking element
    // when you are using the drag gesture, it is a good practice to set this true
    drag_block_horizontal        : false,
    drag_block_vertical          : false,

    // drag_lock_to_axis keeps the drag gesture on the axis that it started on,
    // It disallows vertical directions if the initial direction was horizontal, and vice versa.
    drag_lock_to_axis            : false,

    // drag lock only kicks in when distance > drag_lock_min_distance
    // This way, locking occurs only when the distance has become large enough to reliably determine the direction
    drag_lock_min_distance       : 25
  },

  triggered: false,
  handler  : function dragGesture(ev, inst) {
    // current gesture isnt drag, but dragged is true
    // this means an other gesture is busy. now call dragend
    if(Hammer.detection.current.name != this.name && this.triggered) {
      inst.trigger(this.name + 'end', ev);
      this.triggered = false;
      return;
    }

    // max touches
    if(inst.options.drag_max_touches > 0 &&
      ev.touches.length > inst.options.drag_max_touches) {
      return;
    }

    switch(ev.eventType) {
      case Hammer.EVENT_START:
        this.triggered = false;
        break;

      case Hammer.EVENT_MOVE:
        // when the distance we moved is too small we skip this gesture
        // or we can be already in dragging
        if(ev.distance < inst.options.drag_min_distance &&
          Hammer.detection.current.name != this.name) {
          return;
        }

        // we are dragging!
        if(Hammer.detection.current.name != this.name) {
          Hammer.detection.current.name = this.name;
          if(inst.options.correct_for_drag_min_distance && ev.distance > 0) {
            // When a drag is triggered, set the event center to drag_min_distance pixels from the original event center.
            // Without this correction, the dragged distance would jumpstart at drag_min_distance pixels instead of at 0.
            // It might be useful to save the original start point somewhere
            var factor = Math.abs(inst.options.drag_min_distance / ev.distance);
            Hammer.detection.current.startEvent.center.pageX += ev.deltaX * factor;
            Hammer.detection.current.startEvent.center.pageY += ev.deltaY * factor;

            // recalculate event data using new start point
            ev = Hammer.detection.extendEventData(ev);
          }
        }

        // lock drag to axis?
        if(Hammer.detection.current.lastEvent.drag_locked_to_axis || (inst.options.drag_lock_to_axis && inst.options.drag_lock_min_distance <= ev.distance)) {
          ev.drag_locked_to_axis = true;
        }
        var last_direction = Hammer.detection.current.lastEvent.direction;
        if(ev.drag_locked_to_axis && last_direction !== ev.direction) {
          // keep direction on the axis that the drag gesture started on
          if(Hammer.utils.isVertical(last_direction)) {
            ev.direction = (ev.deltaY < 0) ? Hammer.DIRECTION_UP : Hammer.DIRECTION_DOWN;
          }
          else {
            ev.direction = (ev.deltaX < 0) ? Hammer.DIRECTION_LEFT : Hammer.DIRECTION_RIGHT;
          }
        }

        // first time, trigger dragstart event
        if(!this.triggered) {
          inst.trigger(this.name + 'start', ev);
          this.triggered = true;
        }

        // trigger normal event
        inst.trigger(this.name, ev);

        // direction event, like dragdown
        inst.trigger(this.name + ev.direction, ev);

        // block the browser events
        if((inst.options.drag_block_vertical && Hammer.utils.isVertical(ev.direction)) ||
          (inst.options.drag_block_horizontal && !Hammer.utils.isVertical(ev.direction))) {
          ev.preventDefault();
        }
        break;

      case Hammer.EVENT_END:
        // trigger dragend
        if(this.triggered) {
          inst.trigger(this.name + 'end', ev);
        }

        this.triggered = false;
        break;
    }
  }
};

/**
 * Hold
 * Touch stays at the same place for x time
 * @events  hold
 */
Hammer.gestures.Hold = {
  name    : 'hold',
  index   : 10,
  defaults: {
    hold_timeout  : 500,
    hold_threshold: 1
  },
  timer   : null,
  handler : function holdGesture(ev, inst) {
    switch(ev.eventType) {
      case Hammer.EVENT_START:
        // clear any running timers
        clearTimeout(this.timer);

        // set the gesture so we can check in the timeout if it still is
        Hammer.detection.current.name = this.name;

        // set timer and if after the timeout it still is hold,
        // we trigger the hold event
        this.timer = setTimeout(function() {
          if(Hammer.detection.current.name == 'hold') {
            inst.trigger('hold', ev);
          }
        }, inst.options.hold_timeout);
        break;

      // when you move or end we clear the timer
      case Hammer.EVENT_MOVE:
        if(ev.distance > inst.options.hold_threshold) {
          clearTimeout(this.timer);
        }
        break;

      case Hammer.EVENT_END:
        clearTimeout(this.timer);
        break;
    }
  }
};

/**
 * Release
 * Called as last, tells the user has released the screen
 * @events  release
 */
Hammer.gestures.Release = {
  name   : 'release',
  index  : Infinity,
  handler: function releaseGesture(ev, inst) {
    if(ev.eventType == Hammer.EVENT_END) {
      inst.trigger(this.name, ev);
    }
  }
};

/**
 * Swipe
 * triggers swipe events when the end velocity is above the threshold
 * @events  swipe, swipeleft, swiperight, swipeup, swipedown
 */
Hammer.gestures.Swipe = {
  name    : 'swipe',
  index   : 40,
  defaults: {
    // set 0 for unlimited, but this can conflict with transform
    swipe_min_touches: 1,
    swipe_max_touches: 1,
    swipe_velocity   : 0.7
  },
  handler : function swipeGesture(ev, inst) {
    if(ev.eventType == Hammer.EVENT_END) {
      // max touches
      if(inst.options.swipe_max_touches > 0 &&
        ev.touches.length < inst.options.swipe_min_touches &&
        ev.touches.length > inst.options.swipe_max_touches) {
        return;
      }

      // when the distance we moved is too small we skip this gesture
      // or we can be already in dragging
      if(ev.velocityX > inst.options.swipe_velocity ||
        ev.velocityY > inst.options.swipe_velocity) {
        // trigger swipe events
        inst.trigger(this.name, ev);
        inst.trigger(this.name + ev.direction, ev);
      }
    }
  }
};

/**
 * Tap/DoubleTap
 * Quick touch at a place or double at the same place
 * @events  tap, doubletap
 */
Hammer.gestures.Tap = {
  name    : 'tap',
  index   : 100,
  defaults: {
    tap_max_touchtime : 250,
    tap_max_distance  : 10,
    tap_always        : true,
    doubletap_distance: 20,
    doubletap_interval: 300
  },
  handler : function tapGesture(ev, inst) {
    if(ev.eventType == Hammer.EVENT_END && ev.srcEvent.type != 'touchcancel') {
      // previous gesture, for the double tap since these are two different gesture detections
      var prev = Hammer.detection.previous,
        did_doubletap = false;

      // when the touchtime is higher then the max touch time
      // or when the moving distance is too much
      if(ev.deltaTime > inst.options.tap_max_touchtime ||
        ev.distance > inst.options.tap_max_distance) {
        return;
      }

      // check if double tap
      if(prev && prev.name == 'tap' &&
        (ev.timeStamp - prev.lastEvent.timeStamp) < inst.options.doubletap_interval &&
        ev.distance < inst.options.doubletap_distance) {
        inst.trigger('doubletap', ev);
        did_doubletap = true;
      }

      // do a single tap
      if(!did_doubletap || inst.options.tap_always) {
        Hammer.detection.current.name = 'tap';
        inst.trigger(Hammer.detection.current.name, ev);
      }
    }
  }
};

/**
 * Touch
 * Called as first, tells the user has touched the screen
 * @events  touch
 */
Hammer.gestures.Touch = {
  name    : 'touch',
  index   : -Infinity,
  defaults: {
    // call preventDefault at touchstart, and makes the element blocking by
    // disabling the scrolling of the page, but it improves gestures like
    // transforming and dragging.
    // be careful with using this, it can be very annoying for users to be stuck
    // on the page
    prevent_default    : false,

    // disable mouse events, so only touch (or pen!) input triggers events
    prevent_mouseevents: false
  },
  handler : function touchGesture(ev, inst) {
    if(inst.options.prevent_mouseevents && ev.pointerType == Hammer.POINTER_MOUSE) {
      ev.stopDetect();
      return;
    }

    if(inst.options.prevent_default) {
      ev.preventDefault();
    }

    if(ev.eventType == Hammer.EVENT_START) {
      inst.trigger(this.name, ev);
    }
  }
};


/**
 * Transform
 * User want to scale or rotate with 2 fingers
 * @events  transform, pinch, pinchin, pinchout, rotate
 */
Hammer.gestures.Transform = {
  name     : 'transform',
  index    : 45,
  defaults : {
    // factor, no scale is 1, zoomin is to 0 and zoomout until higher then 1
    transform_min_scale   : 0.01,
    // rotation in degrees
    transform_min_rotation: 1,
    // prevent default browser behavior when two touches are on the screen
    // but it makes the element a blocking element
    // when you are using the transform gesture, it is a good practice to set this true
    transform_always_block: false
  },
  triggered: false,
  handler  : function transformGesture(ev, inst) {
    // current gesture isnt drag, but dragged is true
    // this means an other gesture is busy. now call dragend
    if(Hammer.detection.current.name != this.name && this.triggered) {
      inst.trigger(this.name + 'end', ev);
      this.triggered = false;
      return;
    }

    // atleast multitouch
    if(ev.touches.length < 2) {
      return;
    }

    // prevent default when two fingers are on the screen
    if(inst.options.transform_always_block) {
      ev.preventDefault();
    }

    switch(ev.eventType) {
      case Hammer.EVENT_START:
        this.triggered = false;
        break;

      case Hammer.EVENT_MOVE:
        var scale_threshold = Math.abs(1 - ev.scale);
        var rotation_threshold = Math.abs(ev.rotation);

        // when the distance we moved is too small we skip this gesture
        // or we can be already in dragging
        if(scale_threshold < inst.options.transform_min_scale &&
          rotation_threshold < inst.options.transform_min_rotation) {
          return;
        }

        // we are transforming!
        Hammer.detection.current.name = this.name;

        // first time, trigger dragstart event
        if(!this.triggered) {
          inst.trigger(this.name + 'start', ev);
          this.triggered = true;
        }

        inst.trigger(this.name, ev); // basic transform event

        // trigger rotate event
        if(rotation_threshold > inst.options.transform_min_rotation) {
          inst.trigger('rotate', ev);
        }

        // trigger pinch event
        if(scale_threshold > inst.options.transform_min_scale) {
          inst.trigger('pinch', ev);
          inst.trigger('pinch' + ((ev.scale < 1) ? 'in' : 'out'), ev);
        }
        break;

      case Hammer.EVENT_END:
        // trigger dragend
        if(this.triggered) {
          inst.trigger(this.name + 'end', ev);
        }

        this.triggered = false;
        break;
    }
  }
};

  // Based off Lo-Dash's excellent UMD wrapper (slightly modified) - https://github.com/bestiejs/lodash/blob/master/lodash.js#L5515-L5543
  // some AMD build optimizers, like r.js, check for specific condition patterns like the following:
  if(typeof define == 'function' && define.amd) {
    // define as an anonymous module
    define(function() { return Hammer; });
  }

  // check for `exports` after `define` in case a build optimizer adds an `exports` object
  else if(typeof module === 'object' && module.exports) {
    module.exports = Hammer;
  }

  else {
    window.Hammer = Hammer;
  }

})(window);
/*
 * JSandbox JavaScript Library v0.2.3
 *
 * With modifications to create a worker function inline so that
 * we can just include this single file
 *
 * 2009-01-25
 * By Elijah Grey, http://eligrey.com
 * Licensed under the X11/MIT License
 *   See LICENSE.md
 */

/*global self */

/*jslint undef: true, nomen: true, eqeqeq: true, bitwise: true, regexp: true,
newcap: true, immed: true, maxerr: 1000, strict: true */

/*! @source http://purl.eligrey.com/github/jsandbox/blob/master/src/jsandbox.js*/

"use strict";

var JSandbox = (function (self) {
	var undef_type = "undefined",
	doc            = self.document,
	Worker         = self.Worker;
	
	if (typeof Worker === undef_type) {
		return;
	}
	
	var
	// repeatedly used properties/strings (for minification)
	$eval       = "eval",
	$exec       = "exec",
	$load       = "load",
	$requests   = "requests",
	$input      = "input",
	$terminate  = "terminate",
	$data       = "data",
	$callback   = "callback",
	$onerror    = "onerror",
	$worker     = "worker",
	$onresponse = "onresponse",
	$prototype  = "prototype",
	$call       = "call",
	
	str_type   = "string",
	fun_type   = "function",
	
	
	Sandbox = function () {
		var sandbox = this;
		
		if (!(sandbox instanceof Sandbox)) {
			return new Sandbox();
		}
		
		sandbox[$worker] = new Worker(Sandbox.url);
		sandbox[$requests] = {};
		
		sandbox[$worker].onmessage = function (event) {
			var data = event[$data], request;
			if (typeof data !== "object") {
				return;
			}
			if (data.id == "log") {
				console.log(data.message);
				return;
			}
			request = sandbox[$requests][data.id];
			if (request) {
				if (data.error) {
					if (typeof sandbox[$onerror] === fun_type) {
						sandbox[$onerror](data, request);
					}
					if (typeof request[$onerror] === fun_type) {
						request[$onerror][$call](sandbox, data.error);
					}
				} else {
					if (typeof sandbox[$onresponse] === fun_type) {
						sandbox[$onresponse](data, request);
					}
				
					if (typeof request[$callback] === fun_type) {
						request[$callback][$call](sandbox, data.results);
					}
				}
				delete sandbox[$requests][data.id];
			}
		};
	},
	proto = Sandbox[$prototype],
	
	createRequestMethod = function (method) {
		proto[method] = function (options, callback, input, onerror) {
			if (typeof options === str_type ||
			    Object[$prototype].toString[$call](options) === "[object Array]" ||
			    arguments.length > 1)
			{ // called in (data, callback, input, onerror) style
				options = {
					data     : options,
					input    : input,
					callback : callback,
					onerror  : onerror
				};
			}
			
			if (method === $load && typeof options[$data] === str_type) {
				options[$data] = [options[$data]];
			}
			
			var data  = options[$data],
				id    = this.createRequestID();
			
			input = options[$input];
			
			delete options[$data];
			delete options[$input];
			
			this[$requests][id] = options;
			
			this[$worker].postMessage({
				id       : id,
				method   : method,
				data     : data,
				input    : input
			});
		
			return id;
		};
		Sandbox[method] = function () {
			var sandbox = new Sandbox();
		
			sandbox[$onresponse] = sandbox[$onerror] = function () {
				sandbox[$terminate]();
				sandbox = null;
			};
		
			Sandbox[$prototype][method].apply(
				sandbox,
				Array[$prototype].slice[$call](arguments)
			);
			return Sandbox;
		};
	},
	methods = [$eval, $load, $exec],
	i = 3; // methods.length
	
	while (i--) {
		createRequestMethod(methods[i]);
	}
	
	proto[$terminate] = function () {
		this[$requests] = {};
		this[$worker].onmessage = null;
		this[$worker][$terminate]();
	};
	
	proto.abort = function (id) {
		delete this[$requests][id];
	};
	
	proto.createRequestID = function () {
		var id = Math.random().toString();
		if (id in this[$requests]) {
			return this.createRequestID();
		}
		return id;
	};
	
	if (typeof doc !== undef_type) {
		var linkElems = doc.getElementsByTagName("link");
		i = linkElems.length;
		while (i--) {
			if (linkElems[i].getAttribute("rel") === "jsandbox")
			{
				Sandbox.url = linkElems[i].getAttribute("href");
				break;
			}
		}
	}

	var default_worker_function = function (self, globalEval) {
		"use strict";
		
		var
		postMessage   = self.postMessage,
		importScripts = self.importScripts,
		
		messageEventType  = "message",
		
		messageHandler = function (event) {
			var request = event.data,
			response = {
			};
			
			response.id = request.id;
			
			var data = request.data;
			self.input = request.input || {};
			
			try {
				switch (request.method) {
				
				case "eval": // JSLint has something against indenting cases
					response.results = globalEval(data);
					break;
				case "exec":
					importScripts("data:application/javascript," +
					              encodeURIComponent(data));
					break;
				case "load":
					importScripts.apply(self, data);
					break;
				
				}
			} catch (e) {
				response.code = e.message;
				response.error = e.stack;
				response.line = e.lineNumber;
				response.fileName = e.fileName;
			}
			
			delete self.input;
			try {
				delete self.onmessage; // in case the code defined it
			} catch (e) {
			}
			
			postMessage(response);
		};
		
		if (self.addEventListener) {
			self.addEventListener(messageEventType, messageHandler, false);
		} else if (self.attachEvent) { // for future compatibility with IE
			self.attachEvent("on" + messageEventType, messageHandler);
		}
		
		self.window = self; // provide a window object for scripts
		self.console = { log : function(message) { postMessage({ "id" : "log", "message" : message  }); } };
		
		// dereference unsafe functions
		// some might not be dereferenced: https://bugzilla.mozilla.org/show_bug.cgi?id=512464
		self.Worker              =
		self.addEventListener    = 
		self.removeEventListener =
		self.importScripts       =
		self.XMLHttpRequest      =
		self.postMessage         =
		//self.dispatchEvent       =
		// in case IE implements web workers
		self.attachEvent         =
		self.detachEvent         =
		self.ActiveXObject       =
		
		undefined;
	
	};


	if ( ! Sandbox.url ) {
		Sandbox.url = window.URL.createObjectURL(new Blob(['('+default_worker_function.toString()+'(self,eval))'], {'type' : 'text/javascript'}));
	}
	return Sandbox;
}(self)),
Sandbox = JSandbox;
/**
 * @fileOverview    Read in sequences to be re-rendered in a block that can be easily annotated.
 */

if ( typeof MASCP == 'undefined' ) {
    MASCP = {};
    var ie = (function(){

        var undef,
            v = 3,
            div = document.createElement('div'),
            all = div.getElementsByTagName('i');

            do {
                div.innerHTML = '<!--[if gt IE ' + (++v) + ']><i></i><![endif]-->';
            } while (all[0]);

        return v > 4 ? v : undef;

    }());
    if (ie) {
        if (ie === 7) {
            MASCP.IE = true;
            MASCP.IE7 = true;
        }
        if (ie === 8) {
            MASCP.IE = true;
            MASCP.IE8 = true;
        }
    }
}


/**
 *  @lends MASCP.Group.prototype
 *  @property   {String}        name                        Name for this group to be used as an identifier
 *  @property   {String}        fullname                    The full (long) name for this group, that can be used in UI widgets for labelling
 *  @property   {String}        color                       Color string to apply to this group
 *  @property   {Boolean}       hide_member_controllers     For controllers for this group, do not show the layer controllers for this group
 *  @property   {Boolean}       hide_group_controller       For controllers for this group do not show the parent group controller
 */

/**
 * Register a group with metadata for all sequence renderers.
 * @static
 * @param {String} groupName    Name to give to this group
 * @param {Hash} options        Options to apply to this group - see MASCP.Group for all the fields
 * @returns New group object
 * @type MASCP.Group
 * @see MASCP.event:groupRegistered
 * @see MASCP.Group
 */
MASCP.registerGroup = function(groupName, options)
{
    if ( ! this.groups ) {
        this.groups = {};
    }
    if (this.groups[groupName]) {
        return;
    }
    
    var group = new MASCP.Group();
    
    group.name = groupName;
    
    options = options || {};
    
    if (options.hide_member_controllers) {
        group.hide_member_controllers = true;
    }

    if (options.hide_group_controller) {
        group.hide_group_controller = true;
    }

    if (options.fullname) {
        group.fullname = options.fullname;
    }
    
    if (options.color) {
        group.color = options.color;
    }

    if (options.group) {
        group.group = this.getGroup(options.group);
        if ( ! group.group ) {
            throw "Cannot register this layer with the given group - the group has not been registered yet";
        }
        group.group._layers.push(group);
    }

    group._layers = [];

    group.group_id = new Date().getMilliseconds();
    
    this.groups[groupName] = group;
    
    bean.fire(MASCP,'groupRegistered',[group]);
    
    return group;
};

/**
 *  @lends MASCP.Layer.prototype
 *  @property   {String}        name        Name for this layer to be used as an identifier
 *  @property   {String}        fullname    The full (long) name for this layer, that can be used in UI widgets for labelling
 *  @property   {String}        color       Color string to apply to this layer
 *  @property   {MASCP.Group}   group       Group that this layer is part of. Either a group object, or the name for the group.
 *  @property   {String}        css         CSS block for this layer. Active and inactive layers are children of the .active and .inactive classes respectively. To target a track-based rendering, use the .tracks class first, and to target overlays, use the .overlay class last
 *  @property   {Object}        data        Data for this layer
 */

/**
 * Register a layer with metadata for all sequence renderers.
 * @static
 * @param {String} layerName    Name to give to this layer
 * @param {Hash} options        Options to set field values for this layer - see the fields for MASCP.Layer.
 * @returns New layer object
 * @type MASCP.Layer
 * @see MASCP.Layer
 * @see MASCP.event:layerRegistered
 */
MASCP.registerLayer = function(layerName, options, renderers)
{
    if ( ! this.layers ) {
        this.layers = {};
    }
    if ( ! renderers ) {
        renderers = [];
    }
    var layer;
    if (this.layers[layerName]) {
        if (this.layers[layerName].disabled || renderers.length > 0) {
            this.layers[layerName].disabled = false;
            bean.fire(MASCP,'layerRegistered',[this.layers[layerName]].concat(renderers));
        }
        layer = this.layers[layerName];
    }

    if (layer && options.group) {
        layer.group = this.getGroup(options.group);
        if ( ! layer.group ) {
            throw "Cannot register this layer with the given group - the group has not been registered yet";
        }
        layer.group._layers.push(layer);
    }
    
    if (layer) {
        return layer;
    }

    layer = new MASCP.Layer();
    
    layer.name = layerName;
    
    options = options || {};
    
    if (options.fullname) {
        layer.fullname = options.fullname;
    }
    
    if (options.color) {
        layer.color = options.color;
    }

    if (options.data) {
        layer.data = options.data;
    }
    
    if (layer && options.group) {
        layer.group = this.getGroup(options.group);
        if ( ! layer.group ) {
            throw "Cannot register this layer with the given group - the group has not been registered yet";
        }
        layer.group._layers.push(layer);
    }
    
    this.layers[layerName] = layer;
    
    if (options.css) {
        console.log("options.css is deprecated");
    }
    layer.layer_id = new Date().getMilliseconds();
    bean.fire(MASCP,'layerRegistered',[layer].concat(renderers));
    
    return layer;
};

/**
 * @class
 * Metadata for a group of layers to be rendered
 */
MASCP.Group = function() {
    return;
};

/**
 * Describe what this method does
 * @private
 * @param {String|Object|Array|Boolean|Number} paramName Describe this parameter
 * @returns Describe what it returns
 * @type String|Object|Array|Boolean|Number
 */
MASCP.Group.prototype.size = function() {
    var counter = 0;
    for (var i = 0 ; i < this._layers.length; i++ ) {
        if (! this._layers[i].disabled) {
            counter += 1;
        }
    }
    return counter;
};

MASCP.Group.prototype.eachLayer = function(func) {
    for (var i = 0 ; i < this._layers.length; i++ ) {
        if (! this._layers[i].disabled) {
            func.call(this._layers[i],this._layers[i]);
        }
    }    
};

/**
 * @class
 * Metadata for a single layer to be rendered
 */
MASCP.Layer = function() {
    return;
};

/**
 * @class   Reformatter for sequences in html pages. The object retrieves the amino acid sequence from the 
 *          given element, and then reformats the display of the sequence so that rendering layers can be
 *          applied to it. 
 * @author  hjjoshi
 * @param   {Element} sequenceContainer Container element that the sequence currently is found in, and also 
 *                                      the container that data will be re-inserted into.
 */
MASCP.SequenceRenderer = (function() {

    /**
     *  @lends MASCP.SequenceRenderer.prototype
     *  @property   {Array}     trackOrder  The order of tracks on the renderer, an array of layer/group names.
     */
    var setupTrackOrder = function(renderer) {
        var renderer_track_order = [];

        var accessors = {

            getTrackOrder: function() {
                return renderer_track_order;
            },

            setTrackOrder: function(in_order) {
                var track_order = [];
                var order = in_order;
                if ( ! order instanceof Array ) {
                    order = [ in_order ];
                }

                for (var i = 0; i < order.length; i++) {
                    var a_track = order[i];
                    if (MASCP.getLayer(a_track)) {
                        track_order.push(a_track);                        
                    } else if (MASCP.getGroup(a_track)) {
                        MASCP.getGroup(order[i]).eachLayer(function(grp_lay) {
                            order.splice(i+1,0,grp_lay.name);
                        });
                    }
                }
                for (i = ((renderer_track_order || []).length - 1); i >= 0; i--) {
                    if (track_order.indexOf(renderer_track_order[i]) < 0) {
                        this.hideLayer(renderer_track_order[i]);
                        this.hideGroup(renderer_track_order[i]);
                        if (MASCP.getLayer(renderer_track_order[i])) {
                            bean.fire(MASCP.getLayer(renderer_track_order[i]),'removed',[renderer]);
                        }
                        if (MASCP.getGroup(renderer_track_order[i])) {
                            bean.fire(MASCP.getGroup(renderer_track_order[i]),'removed',[renderer]);
                        }
                    }
                }
                renderer_track_order = track_order;

                if (this.refresh) {
                    this.refresh(true);
                }
                bean.fire(renderer,'orderChanged', [ track_order ] );

            }
        };

        if (MASCP.IE) {
            renderer.setTrackOrder = accessors.setTrackOrder;
        }

        if ((typeof Object.defineProperty == 'function') && ! MASCP.IE8 ) {
            Object.defineProperty(renderer,"trackOrder", {
                get : accessors.getTrackOrder,
                set : accessors.setTrackOrder
            });
        }
    };

    return function(sequenceContainer) {
        if (typeof sequenceContainer !== 'undefined') {
            this._container = sequenceContainer;
            if ( ! this._container.style.position) {
                this._container.style.position = 'relative';
            }
    //        this._container.style.width = '100%';

            bean.add(this,'sequenceChange', function(e){
                while (sequenceContainer.firstChild) {
                    sequenceContainer.removeChild(sequenceContainer.firstChild);
                }
                this._sequence_els.forEach(function(el) {
                    sequenceContainer.appendChild(el);
                });
                var float_clear = document.createElement('div');
                float_clear.setAttribute('style','clear: both; float: none; height: 0px; width: 100%;');
                sequenceContainer.appendChild(float_clear);
                sequenceContainer.style.width = (this._sequence_els.length)+'em';
    //            this.showRowNumbers();            
            });

            this.setSequence(sequenceContainer.textContent);
        }
        
        setupTrackOrder(this);
        
        return this;
    };
})();

/**
 * Event fired when a layer is registered with the global layer registry
 * @name    MASCP.layerRegistered
 * @event
 * @param   {Object}    e
 * @param   {Object}    layer Layer just registered
 */

/**
 * Event fired when a group is registered with the global group registry
 * @name    MASCP.groupRegistered
 * @event
 * @param   {Object}    e
 * @param   {Object}    group Group just registered
 */

/**
 * Event fired when the sequence is changed in a sequence renderer
 * @name    MASCP.SequenceRenderer#sequenceChange
 * @event
 * @param   {Object}    e
 */

/**
 * Event fired when a result is rendered on this renderer
 * @name    MASCP.SequenceRenderer#resultsRendered
 * @event
 * @param   {Object}    e
 * @param   {MASCP.Service} reader  Reader that rendered the result.
 */

/**
 * @name    MASCP.Group#visibilityChange
 * @event
 * @param   {Object}    e
 * @param   {Object}    renderer
 * @param   {Boolean}   visibility
 */

/**
 * @name    MASCP.Layer#visibilityChange
 * @event
 * @param   {Object}    e
 * @param   {Object}    renderer
 * @param   {Boolean}   visibility
 */



/**
 *  @lends MASCP.SequenceRenderer.prototype
 *  @property   {String}  sequence  Sequence to mark up.
 */
MASCP.SequenceRenderer.prototype = {
    sequence: null 
};
 
if ( MASCP.IE ) {
    MASCP.SequenceRenderer.prototype.prototype = document.createElement('div');
}


/**
 * Set the sequence for this renderer. Fires the sequenceChange event when the sequence is set.
 * @param {String} sequence Sequence to render
 * @see MASCP.SequenceRenderer#event:sequenceChange
 */
MASCP.SequenceRenderer.prototype.setSequence = function(sequence)
{
    this.sequence = this._cleanSequence(sequence);
    var sequence_els = [];
    var renderer = this;
    if ( ! this.sequence ) {
        return;
    }
    var seq_chars = this.sequence.split('');
    for (var i =0; i < seq_chars.length; i++) {
        var aa = seq_chars[i];
        if (aa.match(/[A-Za-z]/)) {
            var span_el = document.createElement('span');
            span_el.textContent = aa;
            sequence_els.push(span_el);
        }
    }

    sequence_els.forEach( function(el,i) {
        // if ( (i % 10) == 0 && i > 0 && ((i % 50) != 0)) {
        //     this.style.margin = '0px 0px 0px 1em';
        // }
        // if ( (i % 50) == 0 && i > 0 ) {
        //     if (MASCP.IE7) {
        //         sequence_els[i-1].style.styleFloat = 'none';
        //         sequence_els[i-1].style.width = '1em';
        //     }
        //     this.style.clear = 'both';
        // }
        
        el._index = i;
        
        el.style.display = 'block';
        el.style.cssFloat = 'left';
        el.style.styleFloat = 'left';
        el.style.height = '1.1em';
        el.style.position = 'relative';

        el.addToLayer = MASCP.SequenceRenderer.addElementToLayer;
        el.addBoxOverlay = MASCP.SequenceRenderer.addBoxOverlayToElement;
        el.addToLayerWithLink = MASCP.SequenceRenderer.addElementToLayerWithLink;
        el._renderer = renderer;
    });
    this._sequence_els = sequence_els;   
    bean.fire(this,'sequenceChange');
};

/**
 * Color some residues on this residue
 * @param {Array} indexes Indexes to apply the given color to
 * @param {String} color Color to use to highlight the residues
 * @returns ID for the layer that is created
 * @type String
 */
MASCP.SequenceRenderer.prototype.colorResidues = function(indexes, color) {
    var layer_id = Math.floor(Math.random()*1000).toString();
    MASCP.registerLayer(layer_id, { 'color' : (color || '#ff0000') });
    var aas = this.getAminoAcidsByPosition(indexes);
    for (var i = 0; i < aas.length; i++ ) {
        aas[i].addToLayer(layer_id);
    }
    return MASCP.getLayer(layer_id);
};


MASCP.SequenceRenderer.prototype._cleanSequence = function(sequence) {
    if ( ! sequence ) {
        return sequence;
    }
    var cleaned_sequence = sequence;
    cleaned_sequence = cleaned_sequence.replace(new RegExp(String.fromCharCode(160),"g"),'');
    cleaned_sequence = cleaned_sequence.replace(/[\n\t\s\d]+/mgi,'');
    cleaned_sequence = cleaned_sequence.replace(/\(.*\)/g,'');
    return cleaned_sequence;
};

/**
 * Retrieve the HTML Elements that contain the amino acids at the given positions. The first amino acid is found at position 1.
 * @param {Array} indexes Indexes to retrieve elements for
 * @returns Elements representing each amino acid at the given positions
 * @type Array
 */
MASCP.SequenceRenderer.prototype.getAminoAcidsByPosition = function(indexes) {
    var sequence_els = this._sequence_els;
    return indexes.map(function(index) {
        if (index < 0) {
            return null;
        }
        return sequence_els[index-1];
    });
};

MASCP.SequenceRenderer.prototype.getAA = function(index) {
    return this.getAminoAcidsByPosition([index]).shift();
};


/**
 * Retrieve the HTML Elements that contain the amino acids contained in the given peptide sequence.
 * @param {String} peptideSequence Peptide sequence used to look up the amino acids
 * @returns Elements representing each amino acid at the given positions
 * @type Array
 */
MASCP.SequenceRenderer.prototype.getAminoAcidsByPeptide = function(peptideSequence) {
    var start = this.sequence.indexOf(peptideSequence);
    var results = [];

    if (start < 0) {
        results.addToLayer = function() {};
        return results;
    }
    results = results.concat(this._sequence_els.slice(start,start+(peptideSequence.length)));
    if (results.length) {
        results.addToLayer = function(layername, fraction, options) {
            return results[0].addBoxOverlay(layername,results.length,fraction,options);
        };
    } else {
        results.addToLayer = function() {};
    }
        
    return results;
};

/**
 * Toggle the display of the given layer
 * @param {String|Object} layer Layer name, or layer object
 * @see MASCP.Layer#event:visibilityChange
 */
MASCP.SequenceRenderer.prototype.toggleLayer = function(layer,consumeChange) {
    var layerName = layer;
    if (typeof layer != 'string') {
        layerName = layer.name;
    } else {
        layer = MASCP.layers[layer];
    }
    this._container.classList.toggle(layerName+'_active');
    this._container.classList.toggle(layerName+'_inactive');
    if ( ! consumeChange ) {
        bean.fire(layer,'visibilityChange',[this,this.isLayerActive(layer)]);
    }
    return this;
};

/**
 * Show the given layer
 * @param {String|Object} layer Layer name, or layer object
 * @see MASCP.Layer#event:visibilityChange
 */
MASCP.SequenceRenderer.prototype.showLayer = function(lay,consumeChange) {
    var layer = MASCP.getLayer(lay);

    if (! layer || layer.disabled) {
        return;
    }
    this._container.classList.add(layer.name+'_active');
    this._container.classList.add('active_layer');    
    this._container.classList.remove(layer.name+'_inactive');
    if ( ! consumeChange ) {
        bean.fire(layer,'visibilityChange',[this,true]);
    }
    return this;
};

/**
 * Hide the given layer
 * @param {String|Object} layer Layer name, or layer object
 * @see MASCP.Layer#event:visibilityChange
 */
MASCP.SequenceRenderer.prototype.hideLayer = function(lay,consumeChange) {
    var layer = MASCP.getLayer(lay);

    if (! layer || layer.disabled) {
        return;
    }
        
    this._container.classList.remove(layer.name+'_active');
    this._container.classList.remove('active_layer');
    this._container.classList.add(layer.name+'_inactive');
    if (! consumeChange ) {
        bean.fire(layer,'visibilityChange',[this,false]);
    }
    return this;
};

/**
 * Register a layer with this renderer. Actually is a proxy on to the global registry method
 * @see MASCP#registerLayer
 */
MASCP.SequenceRenderer.prototype.registerLayer = function(layer,options) {
    return MASCP.registerLayer(layer,options);
};

/**
 * Hide or show a group. Fires an event when this method is called.
 * @param {Object} grp Group to set the visibility for
 * @param {Boolean} visibility True for visible, false for hidden
 * @see MASCP.Group#event:visibilityChange
 */
MASCP.SequenceRenderer.prototype.setGroupVisibility = function(grp,visibility,consumeChange) {
    var group = MASCP.getGroup(grp);
    if ( ! group ) {
        return;
    }
    var groupName = group.name;
    
    var renderer = this;

    group.eachLayer(function(layer) {
        if (MASCP.getGroup(layer) === layer) {
            // We can skip explicitly setting the visibility of groups here, since
            // any sub-groups should have a controller.
            return;
        }
        if (this.disabled && visibility) {
            renderer.hideLayer(layer.name);
            return;
        }
        if (visibility === true) {
            renderer.showLayer(layer.name);
        } else if (visibility === false) {
            renderer.hideLayer(layer.name);                
        } else {
            renderer.toggleLayer(layer.name);
        }
    });
    if (visibility !== null && ! consumeChange) {
        bean.fire(group,'visibilityChange',[renderer,visibility]);
    }
};

/**
 * Hide a group. Fires an event when this method is called.
 * @param {Object} grp Group to set the visibility for
 * @see MASCP.Group#event:visibilityChange
 */
MASCP.SequenceRenderer.prototype.hideGroup = function(group,consumeChange) {
    this.setGroupVisibility(group,false,consumeChange);
};

/**
 * Show a group. Fires an event when this method is called.
 * @param {Object} grp Group to set the visibility for
 * @see MASCP.Group#event:visibilityChange
 */
MASCP.SequenceRenderer.prototype.showGroup = function(group,consumeChange) {
    this.setGroupVisibility(group,true,consumeChange);
};

/**
 * Toggle the visibility for a group. Fires an event when this method is called.
 * @param {Object} grp Group to set the visibility for
 * @see MASCP.Group#event:visibilityChange
 */
MASCP.SequenceRenderer.prototype.toggleGroup = function(group,consumeChange) {
    this.setGroupVisibility(group,consumeChange);
};

/**
 * Check if the given layer is active
 * @param {String|Object} layer Layer name, or layer object
 * @returns Whether this layer is active on this renderer
 * @type Boolean
 */
MASCP.SequenceRenderer.prototype.isLayerActive = function(layer) {
    var layerName = layer;
    if (typeof layer != 'string') {
        layerName = layer.name;
    }
    return (! layer.disabled) && this._container.classList.contains(layerName+'_active');
};

/**
 * Deprecated until there's a better implementation for the CondensedSequenceRenderer
 * @private
 */

MASCP.SequenceRenderer.prototype._setHighlight = function(layer,isHighlighted) {
    return;
};

/**
 * Create a layer controller for this sequence renderer. Attach the controller to the containing box, and shift the box across 20px.
 */
MASCP.SequenceRenderer.prototype.createLayerController = function() {
    console.log("createLayerController is deprected");
    return;
};

/**
 * Create a checkbox that is used to control the given layer
 * @param {String|Object} layer Layer name or layer object that a controller should be generated for
 * @param {Object} inputElement Optional input element to bind events to. If no element is given, a new one is created.
 * @returns Checkbox element that when checked will toggle on the layer, and toggle it off when unchecked
 * @type Object
 */
MASCP.SequenceRenderer.prototype.createLayerCheckbox = function(layer,inputElement,exclusive) {
    console.log("createLayerCheckbox is deprecated");
    return;
};

/**
 * Retrieve a layer object from the layer registry. If a layer object is passed to this method, the same layer is returned.
 * @param {String} layer    Layer name
 * @returns Layer object
 * @type Object
 * @see MASCP.Layer
 */
MASCP.getLayer = function(layer) {
    if ( ! MASCP.layers ) {
        return;
    }
    return (typeof layer == 'string') ? MASCP.layers[layer] : layer;    
};

/**
 * Retrieve a group object from the group registry. If a grop object is passed to this method, the same group is returned.
 * @param {String} group    Group name
 * @returns Group object
 * @type Object
 * @see MASCP.Group
 */
MASCP.getGroup = function(group) {
    if (typeof group == 'undefined') {
        return;
    }
    if ( ! MASCP.groups ) {
        return;
    }
    if (typeof group == 'string') {
        return MASCP.groups[group];
    }
    return (group == MASCP.groups[group.name]) ? group : null;
};

MASCP.SequenceRenderer.prototype._removeOtherBindings = function(object,inputElement) {
    var renderer = this;
    
    for (var i = 0; i < inputElement._current_bindings.length; i++) {
        if ( inputElement._current_bindings[i].renderer != renderer ) {
            continue;
        }
        var cb = inputElement._current_bindings[i];
        
        if ( cb.layer && cb.layer != object.name ) {
            bean.remove(MASCP.getLayer(cb.layer),'visibilityChange',cb.object_function);
            bean.remove(inputElement,'change',cb.input_function);
        }
        
        if ( cb.group && cb.group != object.name ) {
            bean.remove(MASCP.getGroup(cb.group),'visibilityChange',cb.object_function);
            bean.remove(inputElement,'change',cb.input_function);
        }
        cb.group = null;
        cb.layer = null;
    }
};

/**
 * Create a checkbox that is used to control the given group
 * @param {String|Object} group Group name or group object that a controller should be generated for
 * @param {Object} inputElement Optional input element to bind events to. If no element is given, a new one is created.
 * @returns Checkbox element that when checked will toggle on the group, and toggle it off when unchecked
 * @type Object
 */
MASCP.SequenceRenderer.prototype.createGroupCheckbox = function(group,inputElement,exclusive) {
    console.log("createGroupCheckbox is deprecated");
    return;
};

/**
 * Create a layer based controller for a group. This layer can act as a proxy for the other layers
 * @param {Object} lay Layer to turn into a group controller
 * @param {Object} grp Group to be controlled by this layer.
 */

MASCP.SequenceRenderer.prototype.createGroupController = function(lay,grp) {
    var layer = MASCP.getLayer(lay);
    var group = MASCP.getGroup(grp);

    var self = this;
    bean.add(layer,'visibilityChange',function(rend,visible) {
        if (rend == self) {
            self.setGroupVisibility(group, visible);
            self.refresh();
        }
    });
};

/**
 * Function to be added to Amino acid elements to facilitate adding elements to layers
 * @private
 * @param {String} layerName The layer that this amino acid should be added to
 * @returns Itself
 * @type Element
 */
MASCP.SequenceRenderer.addElementToLayer = function(layerName)
{
    this.addBoxOverlay(layerName,1);
    return this;
};

/**
 * Function to be added to Amino acid elements to facilitate adding elements to layers with a link
 * @private
 * @param {String} layerName The layer that this amino acid should be added to
 * @param {String} url URL to link to
 * @returns Itself
 * @type Element
 */
MASCP.SequenceRenderer.addElementToLayerWithLink = function(layerName, url, width)
{
    this.classList.add(layerName);
    var anchor = document.createElement('a');
    anchor.setAttribute('href',url);
    anchor.classList.add(layerName+'_overlay');
    anchor.setAttribute('style','display: box; left: 0px; top: 0px; width: 100%; position: absolute; height: 100%;');
    anchor.textContent = '&nbsp;';
    this.appendChild(anchor);
    while (width && width > 0) {
        this._renderer._sequence_els[this._index + width].addToLayerWithLink(layerName,url);
        width -= 1;
    }
    if (this._z_indexes && this._z_indexes[layerName]) {
        anchor.style.zIndex = this._z_indexes[layerName];
    }
    return this;    
};

/**
 * Function to be added to Amino acid elements to facilitate adding box overlays to elements
 * @private
 * @param {String} layerName The layer that this amino acid should be added to, as well as the fraction opacity to use for this overlay
 * @returns Itself
 * @type Element
 */
MASCP.SequenceRenderer.addBoxOverlayToElement = function(layerName, width, fraction)
{
    if (typeof fraction == 'undefined') {
        fraction = 1;
    }

    this.classList.add(layerName);
    var new_el = document.createElement('div');
    new_el.classList.add(layerName+'_overlay');
    new_el.setAttribute('style','top: 0px; width: 100%; position: absolute; height: 100%; opacity:'+fraction+';');
    this.appendChild(new_el);
    while (width && width > 1) {
        this._renderer._sequence_els[this._index + width - 1].addBoxOverlay(layerName,0,fraction);
        width -= 1;
    }
    if (this._z_indexes && this._z_indexes[layerName]) {
        new_el.style.zIndex = this._z_indexes[layerName];
    }
    var event_names = ['mouseover','mousedown','mousemove','mouseout','click','dblclick','mouseup','mouseenter','mouseleave'];
    for (var i = 0 ; i < event_names.length; i++) {
        bean.add(new_el,event_names[i],function() { return function(e) {
            bean.fire(MASCP.getLayer(layerName),e.type,[e,'SequenceRenderer']);
        };}(i));
    }    
    return this;
};


/**
 * Reset this renderer. Hide all groups and layers, disabling them in the registry.
 */
MASCP.SequenceRenderer.prototype.reset = function()
{
    while(this._container.classList.length > 0) {
        this._container.classList.remove(this._container.classList.item(0));
    }
    for ( var group in MASCP.groups) {
        if (MASCP.groups.hasOwnProperty(group)) {
            this.hideGroup(group);
        }
    }    
    for ( var layer in MASCP.layers) {
        if (MASCP.layers.hasOwnProperty(layer)) {
            this.hideLayer(layer,true);
            MASCP.layers[layer].disabled = true;
        }
    }
    
    if (this.resetAnnotations) {
        this.resetAnnotations();
    }
    
};

/**
 * Execute the given block of code (in the renderer context) moving the refresh method away so that it is not called
 * @param {Function} func Function that contains operations to run without refreshing the renderer
 */
MASCP.SequenceRenderer.prototype.withoutRefresh = function(func)
{
    var curr_refresh = this.refresh;
    this.refresh = function() {};
    this.refresh.suspended = true;
    func.apply(this);
    this.refresh = curr_refresh;
};

/**
 * Refresh the display for this sequence renderer
 */
MASCP.SequenceRenderer.prototype.refresh = function()
{
    var z_index = -2;
    if ( ! this._z_indexes) {
        this._z_indexes = {};
    }
    for (var i = 0; i < (this.trackOrder || []).length; i++ ) {
        if (! this.isLayerActive(this.trackOrder[i])) {
            continue;
        }
        Array.prototype.slice.call(document.querySelectorAll('.'+this.trackOrder[i]+'_overlay')).forEach(function(el) {
            el.style.zIndex = z_index;
        });
        this._z_indexes[this.trackOrder[i]] = z_index;
        z_index -= 1;
    }
};

/**
 * Bind a function to execute on a particular event for this object
 * @param {String} ev Event name
 * @param {Function} func Function to execute
 */

MASCP.SequenceRenderer.prototype.bind = function(ev,func)
{
    bean.add(this,ev,func);
};

MASCP.SequenceRenderer.prototype.unbind = function(ev,func)
{
    bean.remove(this,ev,func);
};


MASCP.SequenceRenderer.prototype.trigger = function(ev,args)
{
    bean.fire(this,ev,args);
};

var SVGCanvas = SVGCanvas || (function() {
    
    var extended_elements = [];
    var DEFAULT_RS = 1;
    var svgns = 'http://www.w3.org/2000/svg';
    
    function extend_array(an_array,RS) {
        var curr_x, curr_y, curr_transform, targ_disp, a_disp;
        
        an_array.visibility = function() {
            var curr_disp = 'hidden';

            for (var i = 0 ; i < an_array.length; i++ ) {
                a_disp = an_array[i].getAttribute('visibility');
                if (a_disp && a_disp != 'hidden') {
                    curr_disp = a_disp;
                    break;
                }
            }
            return curr_disp;
        };
        
        an_array.currenty = function() {
            var a_y;
            
            if (an_array[0] && an_array[0].getAttribute('transform')) {
                a_y = /translate\((-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)\)/.exec(an_array[0].getAttribute('transform'));
                if (a_y !== null && (typeof(a_y) !== 'undefined')) {
                    a_y = a_y[2];
                }
            }
            return an_array[0] ? parseInt( a_y || an_array[0].getAttribute('y') || 0,10) : 0;
        };
        
        an_array.animate = function(hsh) {
            if (typeof hsh.y == 'undefined') {
                attr(hsh);
                return;
            }
            if (an_array.length === 0) {
                return;
            }

            var hash = {};
            var key;
            
            for (key in hsh) {
                if (hsh.hasOwnProperty(key)) {
                    hash[key] = hsh[key];
                }
            }
            
            setup_anim_clocks();
                        
            if (an_array.animating) {
                for (var i = 0; i < (anim_clock_funcs || []).length; i++ ) {                    
                    if (anim_clock_funcs[i].target_set != an_array) {
                        continue;
                    }
                    an_array.animating = false;
                    anim_clock_funcs.splice(i,1);
                }
            }
            

            
            var curr_disp = an_array.visibility();

            var target_disp = hash.visibility;
            if (curr_disp == target_disp && target_disp == 'hidden') {
                attr(hsh);
                return;
            }

            var curr_y = an_array.currenty();

            if (isNaN(parseInt(curr_y,10))) {
                console.log("Have a NaN y value, skipping");
                return;
            }

            var target_y = parseInt(hash.y,10);

            delete hash.y;

            if (curr_disp == target_disp && target_disp == 'visible' ) {
                delete hash.visibility;
                target_disp = null;                    
                attr({'visibility' : 'visible'});
            }

            if (hash.visibility == 'hidden') {
                delete hash.visibility;
            }

            attr(hash);
            var counter = 0;

            if (target_y != curr_y) {
                var anim_steps = 1 * (Math.abs(parseInt(((target_y - curr_y)/(50*RS)),10)/rate) + 1);
                var diff = (target_y - curr_y) / anim_steps;
                hash.y = curr_y || 0;
                var orig_func = arguments.callee;
                an_array.animating = true;
                hash.y = curr_y + diff*1;
                
                anim_clock_funcs.push(
                    function(step) {
                        if (diff < 0 && (hash.y < target_y) ) {
                            hash.y = target_y;
                        }
                        if (diff > 0 && (hash.y > target_y) ) {
                            hash.y = target_y;
                        }
                        attr(hash);
                        counter += (step || 1);
                        if (hash.y != target_y) {
                            hash.y = curr_y + diff*(counter+1);
                            return;
                        }
                        an_array.animating = false;
                        if (target_disp) {
                            attr({'visibility' : target_disp});
                        }
                        anim_clock_funcs.splice(anim_clock_funcs.indexOf(arguments.callee),1);
                    }
                );
                anim_clock_funcs[anim_clock_funcs.length - 1].target_set = an_array;
            }
            return;
        };
        
        an_array.attr = function(hsh) {
            if (in_anim) {
                return this.animate(hsh);
            }
            return attr(hsh);
        };
        
        var attr = function(hsh) {
            var hash = {};
            var key;
            for (key in hsh) {
                if (hsh.hasOwnProperty(key)) {
                    hash[key] = hsh[key];
                }
            }
            
            var curr_disp = an_array.visibility();
            
            var targ_y = parseInt(hash.y,10);
            targ_disp = hash.visibility;
            
            for (key in hash) {
                if (hash.hasOwnProperty(key)) {
                    for (var i = 0; i < an_array.length; i++) {
                        if ( ! an_array[i]) {
                            continue;
                        }
                        if ( an_array[i].style.display == 'none' ){
                            continue;
                        }
                        var value = hash[key];
                        if (key == 'style' && an_array[i].hasAttribute('style')) {
                            var curr_style = an_array[i].getAttribute('style');
                            curr_style += '; '+hash[key];
                            value = curr_style;
                        }
                        var has_translate = an_array[i].hasAttribute('transform') && (an_array[i].getAttribute('transform').indexOf('translate') >= 0);

                        if (key == 'height' && an_array[i].setHeight ) { //hasAttribute('transform') && ! an_array[i].no_scale) {
                            an_array[i].setHeight(hash[key]);
                        } else if  (! (has_translate && (key == 'y' || key == 'x'))) {
                            an_array[i].setAttribute(key, value);                        
                        }
                        if (key == 'y' && an_array[i].hasAttribute('d')) {
                            var curr_path = an_array[i].getAttribute('d');
                            var re = /M\s*([\d\.]+) ([\d\.]+)/;
                            curr_path = curr_path.replace(re,'');
                            if (isNaN(parseInt(value,10))) {
                                throw "Error "+key+" is "+hash[key];
                            }
                            an_array[i].setAttribute('d', 'M0 '+parseInt(value,10)+' '+curr_path);
                        }
                        if (key == 'y' && an_array[i].hasAttribute('cy')) {
                            an_array[i].setAttribute('cy', hash[key]);
                        }
                    
                    
                        if (key == 'y' && an_array[i].hasAttribute('transform')) {
                            curr_transform = an_array[i].getAttribute('transform');
                        
                            curr_x = /translate\((-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)?\)/.exec(an_array[i].getAttribute('transform'));
                            if (curr_x === null) {
                                continue;
                            }
                            curr_x = curr_x[1];
                            curr_transform = curr_transform.replace(/translate\((-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)?\)/,'translate('+curr_x+','+value+')');
                            an_array[i].setAttribute('transform',curr_transform);                        
                        }
                        if (key == 'x' && an_array[i].hasAttribute('transform')) {
                            curr_transform = an_array[i].getAttribute('transform');
                        
                            curr_y = /translate\((-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)\)/.exec(an_array[i].getAttribute('transform'));
                            if (curr_y === null) {
                                continue;
                            }
                            curr_y = curr_y[2];
                            curr_transform = curr_transform.replace(/translate\((-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)\)/,'translate('+value+','+curr_y+')');
                            an_array[i].setAttribute('transform',curr_transform);                        
                        }
                        if (key == 'text-anchor' && an_array[i].hasAttribute('style')) {
                            an_array[i].style.textAnchor = hash[key];
                        };
                    }
                }
            }
        };
        an_array.hide = function() {
            this.attr({ 'visibility' : 'hidden'});
        };
        an_array.show = function() {
            this.attr({ 'visibility' : 'visible'});
        };

        an_array.refresh_zoom = function() {
            for (var i = 0; i < an_array.length; i++ ) {
                if (an_array[i].zoom_level && an_array[i].zoom_level == 'text') {
                    if (an_array[i].ownerSVGElement && an_array[i].ownerSVGElement.zoom > 3.5) {
                        an_array[i].setAttribute('display', 'inline');
                        an_array[i].setAttribute('opacity', 1);
                    } else {
                        an_array[i].setAttribute('display', 'none');                            
                    }                        
                }
            
                if (an_array[i].zoom_level && an_array[i].zoom_level == 'summary') {
                    if (an_array[i].ownerSVGElement && an_array[i].ownerSVGElement.zoom <= 3.5) {
                        an_array[i].setAttribute('display', 'inline');
                        an_array[i].setAttribute('opacity', 1);
                    } else {
                        an_array[i].setAttribute('display', 'none');                            
                    }
                }
            }
        };
        
        return an_array;
    }

    var anim_clock_funcs = null, in_anim = false;
    var anim_clock = null;
    var rate = 75;
    var new_rate = null;
    
    var setup_anim_clocks = function() {
        if (anim_clock_funcs === null) {
            anim_clock_funcs = [];
        } else {
            anim_clock_funcs.forEach(function(func) {
                func._last_step = null;
            });
            clearInterval(anim_clock);
        }
        if ( ! in_anim ) {
            extended_elements.forEach(function(canv) {
                bean.fire(canv,'_anim_begin');
            });
            in_anim = true;
        }
        var start = null;
        anim_clock = setInterval(function() {
            if ( ! anim_clock_funcs || anim_clock_funcs.length === 0 ) {
                clearInterval(anim_clock);
                anim_clock = null;
                anim_clock_funcs = null;
                in_anim = false;
                extended_elements.forEach(function(canv) {
                    bean.fire(canv,'_anim_end');
                });
                return;
            }
            
            var suspended_ids = [];
            
            extended_elements.forEach(function(canv) {
                suspended_ids.push(canv.suspendRedraw(5000));
            });
            var tic = (new Date()).getTime();
                                                
            if (! start) {
                start = (new Date()).getTime();
            }
            
            for (var i = 0; i < (anim_clock_funcs || []).length; i++ ) {
                var end = (new Date()).getTime();
                var step_id = parseInt((end - start)/rate,10);
                if ( new_rate === null && (step_id - anim_clock_funcs[i]._last_step) > 2) {
                    new_rate = Math.round(1.6*rate);
                }
                anim_clock_funcs[i].apply(null,[step_id - (anim_clock_funcs[i]._last_step || step_id)]);
                if (anim_clock_funcs && anim_clock_funcs[i]) {
                    anim_clock_funcs[i]._last_step = step_id;
                }
            }
            var toc = (new Date()).getTime();

            extended_elements.forEach(function(canv) {
                canv.unsuspendRedraw(suspended_ids.shift());
            });
            
            var actual_speed = (toc - tic);
            if (( actual_speed < rate) && (new_rate === null) && actual_speed >= 1 ) {
                rate = Math.round(1.5*(toc - tic));
                setup_anim_clocks();
            } else if (new_rate !== null && new_rate != rate) {
                rate = new_rate;
                setup_anim_clocks();
            }
            
            
        },rate);
    };
    var scale_re = /scale\((-?\d+\.?\d*)\)/;
    var setHeight = function(height) {
        var curr_transform = this.getAttribute('transform').toString();

        var curr_scale = scale_re.exec(curr_transform);
    
        var curr_height = parseFloat(this.getAttribute('height') || 1);

        var new_scale = 1;
        if (curr_scale === null) {
            curr_transform += ' scale(1) ';
            curr_scale = 1;
        } else {
            curr_scale = parseFloat(curr_scale[1]);
        }
        new_scale = ( parseFloat(height) / curr_height ) * curr_scale;

        curr_transform = curr_transform.replace(scale_re,'scale('+new_scale+')');

        this.setAttribute('transform',curr_transform);
        this.setAttribute('height',height);
        return new_scale;
    };

    return (function(canvas) {
        
        var RS = canvas.RS || DEFAULT_RS;
        canvas.RS = RS;
        canvas.font_order = 'Helvetica, Verdana, Arial, Sans-serif'
        extended_elements.push(canvas);
        
        canvas.makeEl = function(name,attributes) {
            var result = canvas.ownerDocument.createElementNS(svgns,name);
            for (var attribute in attributes) {
                if (attributes.hasOwnProperty(attribute)) {
                    result.setAttribute(attribute, attributes[attribute]);
                }
            }
            return result;
        };

        canvas.make_gradient = function(id,x2,y2,stops,opacities) {
            var gradient = this.makeEl('linearGradient',{
                'id': id,
                'x1':'0%',
                'x2': x2,
                'y1':'0%',
                'y2': y2
            });
            var total_stops = stops.length;
            while(stops.length > 0) {
                var stop_id = Math.round( ((total_stops - stops.length) / total_stops) * 100 );
                var stop = stops.shift();
                var opacity = opacities.shift();
                gradient.appendChild(this.makeEl('stop',{
                    'offset': stop_id+'%',
                    'style':'stop-color:'+stop+';stop-opacity:'+opacity
                }));
            }
            return gradient;
        };


        canvas.path = function(pathdesc) {
            var a_path = document.createElementNS(svgns,'path');
            a_path.setAttribute('d', pathdesc);
            a_path.setAttribute('stroke','#000000');
            a_path.setAttribute('stroke-width','1');
            this.appendChild(a_path);
            return a_path;
        };

        canvas.poly = function(points) {
            var a_poly = document.createElementNS(svgns,'polygon');
            a_poly.setAttribute('points',points);
            this.appendChild(a_poly);
            return a_poly;
        };

        canvas.circle = function(x,y,radius) {
            var a_circle = document.createElementNS(svgns,'circle');
            a_circle.setAttribute('cx', typeof x == 'string' ? x : x * RS);
            a_circle.setAttribute('cy', typeof y == 'string' ? y : y * RS);
            a_circle.setAttribute('r', typeof radius == 'string' ? radius : radius * RS);
            a_circle.move = function(new_x) {
                a_circle.setAttribute('cx',new_x*RS);
            };
            this.appendChild(a_circle);
            return a_circle;
        };

        canvas.group = function() {
            var a_g = document.createElementNS(svgns,'g');
            this.appendChild(a_g);
            a_g.push = function(new_el) {
                a_g.appendChild(new_el);
            };

            return a_g;
        };

        canvas.line = function(x,y,x2,y2) {
            var a_line = document.createElementNS(svgns,'line');
            a_line.setAttribute('x1', typeof x == 'string' ? x : x * RS);
            a_line.setAttribute('y1', typeof y == 'string' ? y : y * RS);
            a_line.setAttribute('x2', typeof x2 == 'string' ? x2 : x2 * RS);
            a_line.setAttribute('y2', typeof y2 == 'string' ? y2 : y2 * RS);
            this.appendChild(a_line);
            return a_line;        
        };

        canvas.rect = function(x,y,width,height,opts) {
            if ( ! opts ) {
                opts = {};
            }
            var a_rect = document.createElementNS(svgns,'rect');
            a_rect.setAttribute('x', typeof x == 'string' ? x : x * RS);
            a_rect.setAttribute('y', typeof y == 'string' ? y : y * RS);
            a_rect.setAttribute('width', typeof width == 'string' ? width : width * RS);
            a_rect.setAttribute('height', typeof height == 'string' ? height : height * RS);
            a_rect.setAttribute('stroke','#000000');
            this.appendChild(a_rect);
            if ( typeof(opts.offset) !== "undefined" ) {
                a_rect.offset = opts.offset;
                a_rect.setAttribute('transform','translate('+a_rect.getAttribute('x')+','+a_rect.getAttribute('y')+')');
                a_rect.setAttribute('x','0');
                a_rect.setAttribute('y',a_rect.offset*RS);
            }

            a_rect.move = function(new_x,new_width) {
                if ((typeof(this.offset) !== "undefined") && this.getAttribute('transform')) {
                    var transform_attr = this.getAttribute('transform');
                    var matches = /translate\(.*[,\s](.*)\)/.exec(transform_attr);
                    if (matches[1]) {
                      this.setAttribute('transform','translate('+(new_x*RS)+','+matches[1]+')');
                    }
                    this.setAttribute('width',new_width*RS);
                } else {
                    this.setAttribute('x',new_x*RS);
                    this.setAttribute('width',new_width*RS);
                }
            };
            return a_rect;
        };

        canvas.roundRect = function(x,y,width,height,r,opts) {
            var a_rect = this.rect(x,y,width,height,opts);
            if (typeof r != 'object' || ! r.x ) {
                r = { 'x' : r, 'y' : r };
            }
            a_rect.setAttribute('rx',r.x*RS);
            a_rect.setAttribute('ry',r.y*RS);
            return a_rect;
        };

        canvas.ellipticalRect = function(x,y,width,height) {
            return this.roundRect(x,y,width,height,{'x' : 0.25*width, 'y' : 0.5*height});
        };
        canvas.pentagon = function(x,y,width,height,rotate) {
            return this.nagon(x,y,width,height,5,rotate);
        }
        canvas.hexagon = function(x,y,width,height,rotate) {
            return this.nagon(x,y,width,height,6,rotate);
        }
        canvas.nagon = function(x,y,width,height,n,rotate) {
            var a = 0.5*width*RS;
            var shape = this.poly("");
            shape.setAttribute('transform','translate('+(x*RS)+','+(RS*y)+')');
            shape.setHeight = function(hght) {
                var b = 0.5*hght;
                var points = [];
                var min_x = null;
                var max_x = null;
                for (var i = 0 ; i < n; i++) {
                    var angle = (rotate/360 * 2*Math.PI) + 2/n*Math.PI*i;
                    var a_x = parseInt(a+a*Math.cos(angle));
                    var a_y = parseInt(b+b*Math.sin(angle));
                    points.push( [a_x, a_y] );
                    if (min_x === null || a_x < min_x ) {
                        min_x = a_x;
                    }
                    if (max_x === null || a_x > max_x) {
                        max_x = a_x;
                    }
                }
                points.map(function(points) {
                    if (points[0] == min_x) {
                        points[0] = 0;
                    }
                    if (points[0] == max_x) {
                        points[0] = a*2;
                    }
                    return points.join(",");
                });
                this.setAttribute('points',points.join(" "));
            };
            shape.move = function(new_x,new_width) {
                var curr_y = /translate\((-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)\)/.exec(this.getAttribute('transform'));
                if (curr_y === null) {
                    return;
                }
                curr_y = curr_y[2];
                var curr_transform = this.getAttribute('transform').replace(/translate\((-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)\)/,'translate('+(new_x*RS)+','+curr_y+')');
                this.setAttribute('transform',curr_transform);
                a = 0.5*new_width*RS;
            };
            shape.setHeight(height*RS);
            return shape;
        };

        canvas.use = function(ref,x,y,width,height) {
            var a_use = document.createElementNS(svgns,'use');
            a_use.setAttribute('x', typeof x == 'string' ? x : x * RS);
            a_use.setAttribute('y', typeof y == 'string' ? y : y * RS);
            a_use.setAttribute('width', typeof width == 'string' ? width : width * RS);
            a_use.setAttribute('height', typeof height == 'string' ? height : height * RS);
            a_use.setAttributeNS('http://www.w3.org/1999/xlink','href',ref);
            this.appendChild(a_use);

            return a_use;        
        };

        canvas.a = function(href) {
            var a_anchor = document.createElementNS(svgns,'a');
            a_anchor.setAttribute('target','_new');        
            a_anchor.setAttributeNS('http://www.w3.org/1999/xlink','href',href);
            this.appendChild(a_anchor);
            return a_anchor;
        };

        canvas.button = function(x,y,width,height,text) {
            var fo = document.createElementNS(svgns,'foreignObject');
            fo.setAttribute('x',0);
            fo.setAttribute('y',0);
            fo.setAttribute('width',x+width);
            fo.setAttribute('height',y+height);
            if ( ! fo.style ) {
                fo.setAttribute('style','position: absolute;');
            } else {
                fo.style.position = 'absolute';
            }
            this.appendChild(fo);
            var button = document.createElement('button');
            button.style.display = 'block';
            button.style.position = 'relative';
            button.style.top = y+'px';
            button.style.left = x+'px';
            button.textContent = text;
            fo.appendChild(button);
            return button;
        };

        canvas.svgbutton = function(x,y,width,height,txt) {
            var button = this.group();
            var back = this.rect(x,y,width,height);
            back.setAttribute('rx','10');
            back.setAttribute('ry','10');
            back.setAttribute('stroke','#ffffff');
            back.setAttribute('stroke-width','2');
            back.setAttribute('fill','url(#simple_gradient)');
            x = back.x.baseVal.value;
            y = back.y.baseVal.value;
            width = back.width.baseVal.value;
            height = back.height.baseVal.value;

            var text = this.text(x+width/2,y+(height/3),txt);        
            text.setAttribute('text-anchor', 'middle');
            text.firstChild.setAttribute('dy', '1.5ex');
            text.setAttribute('font-size',0.5*height);
            text.setAttribute('fill','#ffffff');
            button.push(back);
            button.push(text);
            button.background_element = back;
            button.text_element = text;

            button.setAttribute('cursor','pointer');
            var button_trigger = function() {
                back.setAttribute('fill','#999999');
                back.setAttribute('stroke','#000000');
            };
            button.addEventListener('mousedown',button_trigger,false);
            button.addEventListener('touchstart',button_trigger,false);
            var button_reset = function() {
                back.setAttribute('stroke','#ffffff');
                back.setAttribute('fill','url(#simple_gradient)');
            };
            button.addEventListener('mouseup',button_reset,false);
            button.addEventListener('mouseout',button_reset,false);
            button.addEventListener('touchend',button_reset,false);
            return button;
        };

        canvas.callout = function(x,y,content,opts) {
            var callout = this.group();
            var back = this.roundRect(-0.5*(opts.width+4),20,opts.width+4,opts.height+4,4);
            back.setAttribute('fill','#000000');
            var pres_box = this.roundRect(-0.5*(opts.width+1),22,opts.width+1,opts.height,4);
            pres_box.setAttribute('fill','#eeeeee');
            callout.push(back);
            callout.push(pres_box);
            var poly = this.poly('0,500 500,1000 -500,1000');
            poly.setAttribute('fill','#000000');
            callout.push(poly);
            var fo = document.createElementNS(svgns,'foreignObject');
            fo.setAttribute('x',-0.5*(opts.width+1)*RS);
            fo.setAttribute('y',22*RS);
            fo.setAttribute('width',opts.width*RS);
            fo.setAttribute('height',opts.height*RS);
            callout.push(fo);
            var html = document.createElementNS('http://www.w3.org/1999/xhtml','html');
            html.setAttribute('xmlns','http://www.w3.org/1999/xhtml');
            var body = document.createElementNS('http://www.w3.org/1999/xhtml','body');
            body.style.fontSize = ((opts['font-size'] || 15)*RS) +'px';
            body.style.margin = (5*RS)+'px';
            body.style.height = opts.height*RS*10+'px';
            html.appendChild(body);
            body.appendChild(content);
            fo.appendChild(html);
            var scale = opts.height/15;
            callout.setAttribute('transform','translate('+(x*RS)+','+((y+20)*RS)+') scale('+scale+')');
            callout.setHeight = setHeight;
            if ( ! opts.align ) {
                var currVbox = parseFloat(this.getAttribute('viewBox').split(/\s+/)[2]);
                if (((x + 10) + 0.5*opts.width)*RS > currVbox ) {
                    opts.align = 'right';
                }
                if ((x - 0.5*opts.width)*RS < 0) {
                    opts.align = 'left';
                }
            }
            if (opts.align) {
                var shifter = opts.align == "right" ? -0.5 : 0.5;
                back.setAttribute('transform', 'translate('+(shifter*opts.width*RS)+',0)');
                pres_box.setAttribute('transform', 'translate('+(shifter*opts.width*RS)+',0)');
                poly.setAttribute('transform', 'translate('+(0*shifter*opts.width*RS)+',0)');
                poly.setAttribute('points', shifter > 0 ? "0,500 500,1000 0,1000" : "0,500 0,1000 -500,1000");
                fo.setAttribute('transform', 'translate('+(shifter*opts.width*RS)+',0)');
            }
            callout.setAttribute('height',(opts.height)*RS);
            return callout;
        };

        canvas.growingMarker = function(x,y,symbol,opts) {
            var container = document.createElementNS(svgns,'svg');
            if ( ! opts.stretch && ! (Array.isArray && Array.isArray(opts.content)) ) {
                container.setAttribute('viewBox', '-50 -100 200 250');
                container.setAttribute('preserveAspectRatio', 'xMinYMin meet');
            } else {
                container = this.group();
            }
            container.setAttribute('x',x);
            container.setAttribute('y',y);
            var the_marker = this.marker(50/RS,(50)/RS,50/RS,symbol,opts);
            container.appendChild(the_marker);
            container.contentElement = the_marker.contentElement;
            var result = this.group();
            var positioning_group = this.group();
            result.appendChild(positioning_group);
            positioning_group.appendChild(container);
            if ( ! opts.stretch && ! (Array.isArray && Array.isArray(opts.content)) ) {
                container.setAttribute('width','200');
                container.setAttribute('height','250');
            }
            // var rect = document.createElementNS(svgns,'rect');
            // rect.setAttribute('stroke','#f00');
            // rect.setAttribute('stroke-width','10');
            // rect.setAttribute('x','-50');
            // rect.setAttribute('y','-100');
            // rect.setAttribute('width','100%');
            // rect.setAttribute('height','100%');
            // rect.setAttribute('fill','none');
            // container.appendChild(rect);

            // var rect = document.createElementNS(svgns,'rect');
            // rect.setAttribute('stroke','#0f0');
            // rect.setAttribute('stroke-width','10');
            // rect.setAttribute('x','50');
            // rect.setAttribute('y','25');
            // rect.setAttribute('width','50%');
            // rect.setAttribute('height','50%');
            // rect.setAttribute('fill','none');

            // container.appendChild(rect);

            result.setAttribute('height','250');
            result.setAttribute('transform','scale(1)');
            result.setHeight = function(height) {
                // this.setAttribute('height',height);
                var scale_val = setHeight.call(this,height);
                this.setAttribute('height',height);
                var top_offset = this.offset || 0;
                if ( ! this.angle ) {
                    this.angle = 0;
                }
                this.firstChild.setAttribute('transform','translate(-100,'+(top_offset*RS)+') rotate('+this.angle+',100,0)');
            };
            result.container = container;
            return result;
        };

        canvas.marker = function(cx,cy,r,symbol,opts) {
            var units = 0;
            if (typeof cx == 'string') {
                var parts = new RegExp(/(\d+)(.*)/g).exec(cx);
                units = parts[2];
                cx = parseFloat(parts[1]);

                parts = new RegExp(/(\d+)(.*)/g).exec(cy);
                cy = parseFloat(parts[1]);

                parts = new RegExp(/(\d+)(.*)/g).exec(r);
                r = parseFloat(parts[1]);        

            }

            var dim = {
                CX      : cx+units,
                CY      : cy+units,
                R       : r+units,
                MIN_X   : (cx-r)+units,
                MAX_X   : (cx+r)+units,
                MIN_Y   : (cy-r)+units,
                MAX_Y   : (cy+r)+units,
                MID_X1  : (cx-(r/2))+units,
                MID_X2  : (cx+(r/2))+units,
                MID_Y1  : (cy-(r/2))+units,
                MID_Y2  : (cy+(r/2))+units
            };

            var marker = this.group();
            if (! opts ) {
                opts = {};
            }
            var fill_color = (opts && opts.border) ? opts.border : 'rgb(0,0,0)';
            if ( ! opts.bare_element ) {
                marker.push(this.circle(0,-0.5*r,r));

                marker.lastChild.style.fill = fill_color;

                marker.push(this.circle(0,1.5*r,r));

                marker.lastChild.style.fill = fill_color;

                var arrow = this.poly((-0.9*r*RS)+','+(0*r*RS)+' 0,'+(-2.5*r*RS)+' '+(0.9)*r*RS+','+(0*r*RS));


                arrow.setAttribute('style','fill:'+fill_color+';stroke-width: 0;');
                marker.push(arrow);
            }
            marker.setAttribute('transform','translate('+((cx)*RS)+','+0.5*cy*RS+') scale(1)');
            marker.setHeight = setHeight;
            marker.setAttribute('height', dim.R*RS);
            if (typeof symbol == 'string') {
                if (symbol.match(/^(:?https?:)?\/?.*#/)) {
                    marker.contentElement = this.use(symbol,-r,0,r,r);
                } else {
                    marker.contentElement = this.text_circle(0,0,2*r,symbol,opts);
                }
                marker.push(marker.contentElement);
            } else if (Array.isArray && Array.isArray(symbol)) {
                marker.contentElement = this.group();
                var phase = (2 * Math.PI / symbol.length);
//                phase -= (Math.PI / 2);
                var needs_stretch = opts.stretch;
                symbol.forEach(function(symb,i) {
                    var new_el;
                    var x_pos = r + (r*symbol.length * Math.cos(i*phase - Math.PI/2));
                    var y_pos = 0 + (r*symbol.length * Math.sin(i*phase - Math.PI/2));

                    var rotate_amount = 360*i/symbol.length;
                    rotate_amount -= 90;
                    if (needs_stretch) {
                        if (rotate_amount >= -90 && rotate_amount <= 90 ) {
                            opts.stretch = 'right';
                        } else {
                            opts.stretch = 'left';
                        }
                        if ((rotate_amount % 90) == 0 && rotate_amount != 90 && rotate_amount != -90) {
                            opts.stretch = true;
                        }

                    }

                    if (rotate_amount > 90 && rotate_amount < 270) {
                        rotate_amount = 180 + rotate_amount;
                    }
                    if (symb.match(/^(:?https?:)?\/?.*#/)) {
                        new_el = canvas.use(symb,(x_pos - 0.5)*r,(y_pos - 0.5)*r,r,r);
                        new_el.setAttribute('pointer-events','none');
                    } else {
                        var opts_copy = JSON.parse(JSON.stringify(opts));
                        opts_copy.no_tracer = true;
                        delete opts_copy.offset;
                        delete opts_copy.height;
                        new_el = canvas.text_circle(x_pos*r,y_pos*r,1.75*r,symb,opts_copy);
                    }
                    var curr_transform = new_el.getAttribute('transform');
                    curr_transform = curr_transform + ' rotate('+(rotate_amount)+','+0*r*RS+','+y_pos*r*RS+')';
                    new_el.setAttribute('transform',curr_transform);
                    marker.contentElement.push(new_el);
                });
                marker.push(marker.contentElement);
            } else {
                marker.contentElement = this.group();
                if (! opts.bare_element ) {
                    marker.contentElement.push(this.text_circle(0,0.5*r,1.75*r,"",opts));
                }
                if (symbol) {
                    if ( ! opts.bare_element ) {
                        symbol.setAttribute('transform','translate(0,'+(0.5*r*RS)+')');
                    }
                    marker.contentElement.push(symbol);
                }
                marker.push(marker.contentElement);
            }
            return marker;
        };

        canvas.text_circle = function(cx,cy,r,txt,opts) {

            if ( ! opts ) {
                opts = {};
            }        

            var units = 0;

            if (typeof cx == 'string') {
                var parts = new RegExp(/(\d+)(.*)/g).exec(cx);
                units = parts[2];
                cx = parseFloat(parts[1]);

                parts = new RegExp(/(\d+)(.*)/g).exec(cy);
                cy = parseFloat(parts[1]);

                parts = new RegExp(/(\d+)(.*)/g).exec(r);
                r = parseFloat(parts[1]);        

            }
            var dim = {
                CX      : cx+units,
                CY      : cy+units,
                R       : r+units,
                MIN_X   : (cx-r)+units,
                MAX_X   : (cx+r)+units,
                MIN_Y   : (cy-r)+units,
                MAX_Y   : (cy+r)+units,
                MID_X1  : (cx-(r/2))+units,
                MID_X2  : (cx+(r/2))+units,
                MID_Y1  : (cy-(r/2))+units,
                MID_Y2  : (cy+(r/2))+units
            };

            var marker_group = this.group();


            var text = this.text(0,dim.CY-0.5*dim.R,txt);
            text.setAttribute('font-size',10*RS);
            text.setAttribute('font-weight',opts.weight || 'bolder');
            text.setAttribute('fill',opts.text_fill || '#ffffff');
            text.setAttribute('style','font-family: sans-serif; text-anchor: middle;');
            text.firstChild.setAttribute('dy','1.5ex');
            text.setAttribute('text-anchor','middle');
            var back;

            if ( ! opts.stretch ) {
                back = this.circle(0,dim.CY,9/10*dim.R);
            } else {
                var text_width = 1.2 * (opts.font_size || r) * text.getBBox().width / (10 * RS);
                var text_height = 3/2 * dim.R;
                var left_pos = -0.5*text_width;
                if (text_width > (3*dim.R)) {
                    left_pos = -0.5*text_width;

                    if (opts.stretch == 'right') {
                        left_pos = -0.1*text_width;
                    }
                    if (opts.stretch == 'left') {
                        left_pos = -0.9*text_width;
                    }
                } else {
                    text_width = 3 * dim.R;
                    left_pos = -0.5*text_width;
                }
                text.setAttribute('x',(0.5*text_width + left_pos)*RS);
                back = this.roundRect(left_pos,dim.CY-0.5*text_height,text_width,text_height,{'x' : 0.5*dim.R, 'y' : 0.5*text_height },{});
            }
            text.setAttribute('font-size',(opts.font_size || r)*RS);

            back.setAttribute('fill',opts.fill || 'url(#simple_gradient)');
            window.matchMedia('print').addListener(function(match) {
                back.setAttribute('fill',match.matches ? '#aaaaaa': (opts.fill || 'url(#simple_gradient)'));
            });
            back.setAttribute('stroke', opts.border || '#000000');
            back.setAttribute('stroke-width', (r/10)*RS);

            marker_group.push(back);

            marker_group.push(text);

            marker_group.setAttribute('transform','translate('+dim.CX*RS+', 1) scale(1)');
            marker_group.setAttribute('height', (dim.R/2)*RS );
            marker_group.setHeight = setHeight;
            return marker_group;
        };

        canvas.crossed_circle = function(cx,cy,r) {

            var units = 0;


            if (typeof cx == 'string') {
                var parts = new RegExp(/(\d+)(.*)/g).exec(cx);
                units = parts[2];
                cx = parseFloat(parts[1]);

                parts = new RegExp(/(\d+)(.*)/g).exec(cy);
                cy = parseFloat(parts[1]);

                parts = new RegExp(/(\d+)(.*)/g).exec(r);
                r = parseFloat(parts[1]);        

            }
            var dim = {
                CX      : cx+units,
                CY      : cy+units,
                R       : r+units,
                MIN_X   : (cx-r)+units,
                MAX_X   : (cx+r)+units,
                MIN_Y   : (cy-r)+units,
                MAX_Y   : (cy+r)+units,
                MID_X1  : (cx-(r/2))+units,
                MID_X2  : (cx+(r/2))+units,
                MID_Y1  : (cy-(r/2))+units,
                MID_Y2  : (cy+(r/2))+units
            };

            var close_group = this.group();

            var close_button = this.circle(dim.CX,dim.CY,dim.R);
            close_button.setAttribute('fill','#000000');
            close_button.setAttribute('stroke', '#ffffff');
            close_button.setAttribute('stroke-width', '2');

            close_group._button = close_button;

            close_group.push(close_button);

            var a_line = this.line(dim.MID_X1,dim.MID_Y1,dim.MID_X2,dim.MID_Y2);
            a_line.setAttribute('stroke', '#ffffff');
            a_line.setAttribute('stroke-width', '2');

            close_group.push(a_line);

            a_line = this.line(dim.MID_X1,dim.MID_Y2,dim.MID_X2,dim.MID_Y1);
            a_line.setAttribute('stroke', '#ffffff');
            a_line.setAttribute('stroke-width', '2');

            close_group.push(a_line);

            return close_group;        
        };
        canvas.text = function(x,y,text) {
            var a_text = document.createElementNS(svgns,'text');
            var a_tspan = document.createElementNS(svgns, 'tspan');
            if (typeof text != 'string') {
                a_text.appendChild(text);
            } else {
                a_text.appendChild(a_tspan);
                a_tspan.textContent = text;
                a_tspan.setAttribute('dy','0');
            }
            a_text.style.fontFamily = this.font_order || 'Helvetica, Verdana, Arial, Sans-serif';
            a_text.setAttribute('x',typeof x == 'string' ? x : x * RS);
            a_text.setAttribute('y',typeof y == 'string' ? y : y * RS);        
            a_text.move = function(new_x,new_width) {
                this.setAttribute('x',new_x*RS);
            };

            this.appendChild(a_text);
            return a_text;
        };
        canvas.plus = function(x,y,height) {
            var g = this.group();
            g.appendChild(this.makeEl('rect', {
                'x' : Math.round((0.4)*height*RS).toString(),
                'y' : Math.round((0.1)*height*RS).toString(),
                'stroke-width' : '1',
                'width' : Math.round((0.2)*height*RS).toString(),
                'height': Math.round((0.8)*height*RS).toString(),
                'stroke': '#ffffff',
                'fill'  : '#ffffff'            
            }));

            g.appendChild(this.makeEl('rect', {
                'x' : Math.round((0.1)*height*RS).toString(),
                'y' : Math.round((0.4)*height*RS).toString(),
                'stroke-width' : '1',
                'width' : Math.round((0.8)*height*RS).toString(),
                'height': Math.round((0.2)*height*RS).toString(),
                'stroke': '#ffffff',
                'fill'  : '#ffffff'            
            }));
            g.setAttribute('transform','translate('+x*RS+','+y*RS+')');
            return g;
        };
        canvas.minus = function(x,y,height) {
            var g = this.group();

            g.appendChild(this.makeEl('rect', {
                'x' : Math.round((0.1)*height*RS).toString(),
                'y' : Math.round((0.4)*height*RS).toString(),
                'stroke-width' : '1',
                'width' : Math.round((0.8)*height*RS).toString(),
                'height': Math.round((0.2)*height*RS).toString(),
                'stroke': '#ffffff',
                'fill'  : '#ffffff'            
            }));
            g.setAttribute('transform','translate('+x*RS+','+y*RS+')');
            return g;
        };

        // Calculate the bounding box of an element with respect to its parent element
        // Thanks to http://stackoverflow.com/questions/10623809/get-bounding-box-of-element-accounting-for-its-transform
        canvas.transformedBoundingBox = function(el){
            var bb  = el.getBBox(),
                svg = el.ownerSVGElement,
                m   = el.getTransformToElement(el.parentNode);
            // Create an array of all four points for the original bounding box
            var pts = [
                svg.createSVGPoint(), svg.createSVGPoint(),
                svg.createSVGPoint(), svg.createSVGPoint()
            ];
            pts[0].x=bb.x;          pts[0].y=bb.y;
            pts[1].x=bb.x+bb.width; pts[1].y=bb.y;
            pts[2].x=bb.x+bb.width; pts[2].y=bb.y+bb.height;
            pts[3].x=bb.x;          pts[3].y=bb.y+bb.height;

            // Transform each into the space of the parent,
            // and calculate the min/max points from that.
            var xMin=Infinity,xMax=-Infinity,yMin=Infinity,yMax=-Infinity;
            pts.forEach(function(pt){
                pt = pt.matrixTransform(m);
                xMin = Math.min(xMin,pt.x);
                xMax = Math.max(xMax,pt.x);
                yMin = Math.min(yMin,pt.y);
                yMax = Math.max(yMax,pt.y);
            });

            // Update the bounding box with the new values
            try {
                bb.x = xMin; bb.width  = xMax-xMin;
                bb.y = yMin; bb.height = yMax-yMin;
            } catch (e) {
                bb = { 'x' : xMin, 'y' : yMin, 'width' : xMax-xMin, 'height' : yMax-yMin };
            }
            return bb;
        };
        
        canvas.set = function() {
            var an_array = [];
            extend_array(an_array,RS);
            return an_array;
        };
        canvas.hide = function() {
            this.setAttribute('display','none');
        };
        canvas.show = function() {
            this.setAttribute('display','inline');
        };
    });

})();/**
 *  @fileOverview   Basic classes and definitions for an SVG-based sequence renderer
 */

/** Default class constructor
 *  @class      Renders a sequence using a condensed track-based display
 *  @param      {Element} sequenceContainer Container element that the sequence currently is found in, and also 
 *              the container that data will be re-inserted into.
 *  @extends    MASCP.SequenceRenderer
 */
MASCP.CondensedSequenceRenderer = function(sequenceContainer) {
    this._RS = 50;
    MASCP.SequenceRenderer.apply(this,arguments);
    var self = this;

    MASCP.CondensedSequenceRenderer.Zoom(self);
    window.addEventListener('resize',function() {
        sequenceContainer.cached_width = sequenceContainer.getBoundingClientRect().width;
    },true);
    sequenceContainer.cached_width = sequenceContainer.getBoundingClientRect().width;

    // We want to unbind the default handler for sequence change that we get from
    // inheriting from CondensedSequenceRenderer
    bean.remove(this,'sequenceChange');

    bean.add(this,'sequenceChange',function() {
        for (var layername in MASCP.layers) {
            if (MASCP.layers.hasOwnProperty(layername)) {
                MASCP.layers[layername].disabled = true;
            }
        }
        self.zoom = self.zoom;
    });

    return this;
};

MASCP.CondensedSequenceRenderer.prototype = new MASCP.SequenceRenderer();

(function() {
    var scripts = document.getElementsByTagName("script");
    var src = scripts[scripts.length-1].src;
    src = src.replace(/[^\/]+$/,'');
    MASCP.CondensedSequenceRenderer._BASE_PATH = src;
})();

(function(clazz) {
    var createCanvasObject = function() {
        var renderer = this;
        this.win = function() {
            if (this._container && this._container.ownerDocument && this._container.ownerDocument.defaultView) {
                return this._container.ownerDocument.defaultView;
            }
            return null;
        };

        if (this._object) {
            if (typeof svgweb != 'undefined') {
                svgweb.removeChild(this._object, this._object.parentNode);
            } else {
                this._object.parentNode.removeChild(this._object);
            }
            this._canvas = null;
            this._object = null;
        }
        var canvas;
        if ( document.implementation.hasFeature("http://www.w3.org/TR/SVG11/feature#BasicStructure", "1.1") ) {
            var native_canvas = this.win().document.createElementNS(svgns,'svg');
            native_canvas.setAttribute('width','100%');
            native_canvas.setAttribute('height','100%');
            this._container.appendChild(native_canvas);
            this._canvas = native_canvas;
            canvas = {
                'addEventListener' : function(name,load_func) {
                    native_canvas.contentDocument = { 'rootElement' : native_canvas };
                    load_func.call(native_canvas);
                }            
            };
        }

        canvas.addEventListener('load',function() {
            var container_canv = this;
            SVGCanvas(container_canv);
            if (renderer.font_order) {
                container_canv.font_order = renderer.font_order;
            }
            var group = container_canv.makeEl('g');
        
            var canv = container_canv.makeEl('svg');
            canv.RS = renderer._RS;
            SVGCanvas(canv);
            if (renderer.font_order) {
                canv.font_order = renderer.font_order;
            }
            group.appendChild(canv);
            container_canv.appendChild(group);

            var supports_events = true;

            try {
                var noop = canv.addEventListener;
            } catch (err) {
                supports_events = false;
            }

            if (false && supports_events) {
                var oldAddEventListener = canv.addEventListener;
        
                // We need to track all the mousemove functions that are bound to this event
                // so that we can switch off all the mousemove bindings during an animation event
        
                var mouse_moves = [];

                canv.addEventListener = function(ev,func,bubbling) {
                    if (ev == 'mousemove') {
                        if (mouse_moves.indexOf(func) < 0) {
                            mouse_moves.push(func);
                        } else {
                            return;
                        }
                    }
                    return oldAddEventListener.apply(canv,[ev,func,bubbling]);
                };

                bean.add(canv,'_anim_begin',function() {
                    for (var i = 0; i < mouse_moves.length; i++ ) {
                        canv.removeEventListener('mousemove', mouse_moves[i], false );
                    }
                    bean.add(canv,'_anim_end',function() {
                        for (var j = 0; j < mouse_moves.length; j++ ) {
                            oldAddEventListener.apply(canv,['mousemove', mouse_moves[j], false] );
                        }                        
                        bean.remove(canv,'_anim_end',arguments.callee);
                    });
                });
            }
        
        
            var canvas_rect = canv.makeEl('rect', {  'x':'-10%',
                                                    'y':'-10%',
                                                    'width':'120%',
                                                    'height':'120%',
                                                    'style':'fill: #ffffff;'});
        
        
        
            var left_fade = container_canv.makeEl('rect',{      'x':'0',
                                                                'y':'0',
                                                                'width':'50',
                                                                'height':'100%',
                                                                'style':'fill: url(#left_fade);'});

            var right_fade = container_canv.makeEl('rect',{     'x':'100%',
                                                                'y':'0',
                                                                'width':'50',
                                                                'height':'100%',
                                                                'transform':'translate(-50,0)',
                                                                'style':'fill: url(#right_fade);'});


            bean.add(canv,'pan',function() {
                if (canv.currentTranslate.x >= 0) {
                    left_fade.setAttribute('visibility','hidden');
                } else {
                    left_fade.setAttribute('visibility','visible');
                }
            });
        
            bean.add(canv,'_anim_begin',function() {
                left_fade.setAttribute('visibility','hidden');
            });
        
            bean.add(canv,'_anim_end',function() {
                bean.fire(canv,'pan');
            });

            if (canv.currentTranslate.x >= 0) {
                left_fade.setAttribute('visibility','hidden');
            }
            var nav_group = container_canv.makeEl('g');
            container_canv.appendChild(nav_group);
            var nav_canvas = container_canv.makeEl('svg');
            nav_group.appendChild(nav_canvas);



           canv.setCurrentTranslateXY = function(x,y) {
                    var curr_transform = (group.getAttribute('transform') || '').replace(/translate\([^\)]+\)/,'');
                    curr_transform = curr_transform + ' translate('+x+', '+y+') ';
                    group.setAttribute('transform',curr_transform);
                    this.currentTranslate.x = x;
                    this.currentTranslate.y = y;
            };
            canv.setCurrentTranslateXY(0,0);
        
            nav_canvas.setCurrentTranslateXY = function(x,y) {
                    var curr_transform = (nav_group.getAttribute('transform') || '').replace(/translate\([^\)]+\)/,'');
                    curr_transform = curr_transform + ' translate('+x+', '+y+') ';
                    nav_group.setAttribute('transform',curr_transform);
                    this.currentTranslate.x = x;
                    this.currentTranslate.y = y;
            };
            nav_canvas.setCurrentTranslateXY(0,0);
        

        
            addNav.call(renderer,nav_canvas);

            var nav = renderer.navigation;
            var old_show = nav.show, old_hide = nav.hide;
            nav.show = function() {
                old_show.apply(nav,arguments);
                canv.style.GomapScrollLeftMargin = 100 * renderer._RS / renderer.zoom;
            };
        
            nav.hide = function() {
                old_hide.apply(nav,arguments);
                canv.style.GomapScrollLeftMargin = 1000;
            };
        
            renderer._container_canvas = container_canv;
            container_canv.setAttribute('preserveAspectRatio','xMinYMin meet');
            container_canv.setAttribute('width','100%');
            container_canv.setAttribute('height','100%');
            canv.appendChild(canv.makeEl('rect', {'x':0,'y':0,'width':'100%','height':'100%','stroke-width':'0','fill':'#ffffff'}));
            renderer._object = this;
            renderer._canvas = canv;
            renderer._canvas._canvas_height = 0;
            bean.fire(renderer,'svgready');
        },false);
    
        return canvas;
    };

    var wheel_fn = function(e) {
        e.stopPropagation();
        return true;
    };

    var addNav = function(nav_canvas) {
        this.navigation = new MASCP.CondensedSequenceRenderer.Navigation(nav_canvas,this);
        var nav = this.navigation;
        var self = this;
    
        var hide_chrome = function() {
            nav.demote(); 
        };
    
        var show_chrome = function() {
            nav.promote(); 
        };

        if ( ! MASCP.IE ) {
        bean.add(this._canvas,'panstart',hide_chrome);
        bean.add(this._canvas,'panend',show_chrome);
        bean.add(this._canvas,'_anim_begin',hide_chrome);
        bean.add(this._canvas,'_anim_end',show_chrome);
        nav_canvas.addEventListener('DOMMouseScroll',wheel_fn,false);
        nav_canvas.addEventListener('wheel',wheel_fn,false);
        nav_canvas.onmousewheel = wheel_fn;

        }
    };
    var drawAminoAcids = function() {
        var renderer = this;
        var aas = renderer.addTextTrack(this.sequence,this._canvas.set());
        aas.attr({'y' : 0.5*renderer._axis_height*renderer._RS});
        renderer.select = function() {
            var vals = Array.prototype.slice.call(arguments);
            var from = vals[0];
            var to = vals[1];
            this.moveHighlight.apply(this,vals);
        };
        var zoomchange = function() {
            aas.attr({'y' : 0.5*renderer._axis_height*renderer._RS});
        };
        var canvas = renderer._canvas;
        bean.add(canvas,'zoomChange', zoomchange);
        bean.add(aas,'removed',function() {
            bean.remove(canvas,'zoomChange',zoomchange);
        });
        return aas;
    };

    var drawAxis = function(canvas,lineLength) {
        var RS = this._RS;
        var self = this;
        var x = 0, i = 0;
    
    
        var axis = canvas.set();

        var axis_back = canvas.rect(0,0,lineLength,1.5);
        axis_back.setAttribute('fill',"url('#axis_pattern')");
        axis_back.removeAttribute('stroke');
        axis_back.removeAttribute('stroke-width');
        axis_back.setAttribute('id','axis_back');

        var base_axis_height = 30;

        var all_labels = canvas.set();
        var major_mark_labels = canvas.set();
        var minor_mark_labels = canvas.set();
        var thousand_mark_labels = canvas.set();
        var minor_mark = 10;
        var major_mark = 20;
        
        if (this.sequence.length > 5000) {
            minor_mark = 100;
            major_mark = 200;
        }
        if (this.sequence.length > 1000) {
            minor_mark = 20;
            major_mark = 40;
        }
        for ( i = 0; i < (lineLength/5); i++ ) {

            var a_text = canvas.text(x,0,""+(x));
            all_labels.push(a_text);

            if ( (x % major_mark) === 0 && x !== 0) {
                major_mark_labels.push(a_text);
            } else if (( x % minor_mark ) === 0 && x !== 0) {
                minor_mark_labels.push(a_text);
            }
            if ( (x % (250*parseInt(this.sequence.length / 500))) === 0 && x !== 0) {
                thousand_mark_labels.push(a_text);
            }
            x += 5;
        }
    
        for ( i = 0; i < all_labels.length; i++ ) {
            all_labels[i].style.textAnchor = 'middle';
            all_labels[i].firstChild.setAttribute('dy','1.5ex');
        }
    
        all_labels.attr({'pointer-events' : 'none', 'text-anchor' : 'middle', 'font-size' : 7*RS+'pt'});
        all_labels.hide();

       self._axis_height = parseInt( base_axis_height / self.zoom);

    
        var zoom_status = null;
        var zoomchange = function() {
            var renderer = self;
               renderer._axis_height = parseInt( base_axis_height / renderer.zoom);
               var pattern = renderer._canvas.ownerDocument.getElementById('axis_pattern');
               thousand_mark_labels.forEach(function(label) {
                label.setAttribute('visibility','hidden');
               });

               if (this.zoom > 3.6) {

                   axis_back.setAttribute('transform','translate(-5,'+(0.3*renderer._axis_height*RS)+')');
                   axis_back.setAttribute('height',0.25*renderer._axis_height*RS);
                   pattern.setAttribute('width',10*RS);
                   pattern.firstChild.setAttribute('width',RS / renderer.zoom);

                   minor_mark_labels.show();
                   major_mark_labels.show();
                   var text_scale = 0.15*self._axis_height;
                   if (text_scale < 1) {
                    text_scale = 1;
                   }
                   minor_mark_labels.attr({ 'font-size' : (text_scale*RS)+'pt', 'text-anchor' : 'end' });
                   major_mark_labels.attr({ 'font-size' : (text_scale*RS)+'pt', 'text-anchor' : 'end' });
                   if (this._visibleTracers && this._visibleTracers()) {
                       this._visibleTracers().show();
                   }
               } else if (this.zoom > 1.8) {

                   minor_mark_labels.hide();
                   major_mark_labels.show();
                   major_mark_labels.attr({ 'font-size' : (0.5*RS*self._axis_height)+'pt', 'text-anchor' : 'middle' });
                   axis_back.setAttribute('transform','translate(-25,'+(0.5*renderer._axis_height*RS)+')');
                   axis_back.setAttribute('height',0.3*renderer._axis_height*RS);
                   pattern.setAttribute('width',20*RS);
                   pattern.firstChild.setAttribute('width',RS / renderer.zoom );
                   if (this.tracers) {
                       this.tracers.hide();
                   }
               } else if (this.zoom > 0.2) {

                   if (this.tracers) {
                       this.tracers.hide();
                   }
                   minor_mark_labels.hide();
                   major_mark_labels.show();
                   major_mark_labels.attr({ 'font-size' : (0.5*RS*self._axis_height)+'pt', 'text-anchor' : 'middle' });
                   axis_back.setAttribute('transform','translate(-25,'+(0.5*renderer._axis_height*RS)+')');
                   axis_back.setAttribute('height',0.3*renderer._axis_height*RS);
                   pattern.setAttribute('width',50*RS);
                   pattern.firstChild.setAttribute('width',RS / renderer.zoom);



                   var last_right = -10000;
                   var changed = false;
                   major_mark_labels.forEach(function(label) {

                    if (label.getBBox().x <= (last_right+(RS*10)) || (parseInt(label.textContent) % 50) != 0) {
                        label.setAttribute('visibility','hidden');
                        changed = true;
                    } else {
                        label.setAttribute('visibility','visible');
                        last_right = label.getBBox().x + label.getBBox().width;
                    }
                   });
                   if (changed) {
                    major_mark_labels[0].setAttribute('visibility','hidden');
                   }
               } else {
                   if (this.tracers) {
                       this.tracers.hide();
                   }
                   minor_mark_labels.hide();
                   major_mark_labels.hide();
                   thousand_mark_labels.show();
                   thousand_mark_labels.attr({ 'font-size' : (0.5*RS*self._axis_height)+'pt', 'text-anchor' : 'middle' });

                   axis_back.setAttribute('transform','translate(-50,'+(0.85*renderer._axis_height*RS)+')');
                   axis_back.setAttribute('height',0.1*renderer._axis_height*RS);
                   pattern.setAttribute('width',250*RS);
                   pattern.firstChild.setAttribute('width',RS / renderer.zoom);


                   var last_right = -10000;
                   var changed = false;
                   thousand_mark_labels.forEach(function(label) {
                    if (label.getBBox().x <= (last_right+(RS*10)) || (parseInt(label.textContent) % 250) != 0) {
                        label.setAttribute('visibility','hidden');
                    } else {
                        label.setAttribute('visibility','visible');
                        last_right = label.getBBox().x + label.getBBox().width;
                    }
                   });
                   if (changed) {
                    thousand_mark_labels[0].setAttribute('visibility','hidden');
                   }
               }
        };
        bean.add(canvas,'zoomChange', zoomchange);
        bean.add(axis,'removed',function() {
            bean.remove(canvas,'zoomChange',zoomchange);
            var remover = function(el) {
                if (el.parentNode) {
                    el.parentNode.removeChild(el);
                }
            };
            axis_back.parentNode.removeChild(axis_back);
            all_labels.forEach(remover);

        });
        return axis;
    };

    clazz.prototype.panTo = function(end,callback) {
        var renderer = this;
        var pos = renderer.leftVisibleResidue();
        var delta = 1;
        if (pos == end) {
            if (callback) {
                callback.call(null);
            }
            return;
        }
        if (pos > end) {
            delta = -1;
        }
        requestAnimationFrame(function() {
            renderer.setLeftVisibleResidue(pos);
            pos += delta;
            bean.fire(renderer._canvas,'panend');
            if (pos !== end) {
                requestAnimationFrame(arguments.callee);
            } else {
                if (callback) {
                    callback.call(null);
                }
            }
        });
    };

    clazz.prototype.zoomTo = function(zoom,residue,callback) {
        var renderer = this;
        var curr = renderer.zoom;
        var delta = (zoom - curr)/50;
        bean.add(renderer,'zoomChange',function() {
            bean.remove(renderer,'zoomChange',arguments.callee);
            delete renderer.zoomCenter;
            if (callback) {
                callback.call(null);
            }
        });
        if (residue) {
            renderer.zoomCenter = (residue == 'center') ? residue : { 'x' : renderer._RS*residue };
        } else {
            renderer.zoom = zoom;
            return;
        }
        requestAnimationFrame(function() {
            renderer.zoom = curr;
            curr += delta;
            if (Math.abs(curr - zoom) > 0.01) {
                requestAnimationFrame(arguments.callee);
            }
        });
    };

    clazz.prototype.setLeftVisibleResidue = function(val) {
        var self = this;
        self._canvas.setCurrentTranslateXY((self._canvas.width.baseVal.value * (1 - (val / (self.sequence.length+self.padding+2)))) - self._canvas.width.baseVal.value,0);
    };

    clazz.prototype.leftVisibleResidue = function() {
        var self = this;
        var val = Math.floor((self.sequence.length+self.padding+2)*(1-((self._canvas.width.baseVal.value + self._canvas.currentTranslate.x) / self._canvas.width.baseVal.value)))-1;
        if (val < 0) {
            val = 0;
        }
        return val;
    };

    clazz.prototype.rightVisibleResidue = function() {
        var self = this;
        var container_width = self._container_canvas.parentNode.cached_width;
        if ( ! container_width ) {
            container_width = self._container_canvas.parentNode.getBoundingClientRect().width;
        }
        var val = Math.floor(self.leftVisibleResidue() + (self.sequence.length+self.padding+2)*(container_width/ self._canvas.width.baseVal.value));
        if (val > self.sequence.length) {
            val = self.sequence.length;
        }
        return val;
    };

    clazz.prototype.setSequence = function(sequence) {
        var new_sequence = this._cleanSequence(sequence);
        if (new_sequence == this.sequence && new_sequence !== null) {
            bean.fire(this,'sequenceChange');
            return;
        }
    
        if (! new_sequence) {
            return;
        }
    
        this.sequence = new_sequence;
    
        var seq_chars = this.sequence.split('');
        var line_length = seq_chars.length;

        if (line_length === 0) {
            return;
        }

        var renderer = this;


        var build_sequence_els = function() {
            var seq_els = [];
            renderer.sequence.split('').forEach( function(aa,i) {
                var el = {};
                el._index = i;
                el._renderer = renderer;
                renderer._extendElement(el);
                el.amino_acid = aa;
                seq_els.push(el);
            });
            renderer._sequence_els = seq_els;
        };

        build_sequence_els();

        var RS = this._RS;

        bean.remove(this,'svgready');
        bean.add(this,'svgready',function(cnv) {
            var canv = renderer._canvas;
            canv.RS = RS;
            canv.setAttribute('background', '#000000');
            canv.setAttribute('preserveAspectRatio','xMinYMin meet');
        
            var defs = canv.makeEl('defs');
            renderer._container_canvas.appendChild(defs);


            defs.appendChild(canv.make_gradient('track_shine','0%','100%',['#111111','#aaaaaa','#111111'], [0.5,0.5,0.5]));
            defs.appendChild(canv.make_gradient('simple_gradient','0%','100%',['#aaaaaa','#888888'], [1,1]));
            defs.appendChild(canv.make_gradient('left_fade','100%','0%',['#ffffff','#ffffff'], [1,0]));
            defs.appendChild(canv.make_gradient('right_fade','100%','0%',['#ffffff','#ffffff'], [0,1]));
            defs.appendChild(canv.make_gradient('red_3d','0%','100%',['#CF0000','#540000'], [1,1]));
        
            renderer.gradients = [];
            renderer.add3dGradient = function(color) {
                defs.appendChild(canv.make_gradient('grad_'+color,'0%','100%',[color,'#ffffff',color],[1,1,1] ));
                renderer.gradients.push(color);
            };

            var shadow = canv.makeEl('filter',{
                'id':'drop_shadow',
                'filterUnits':'objectBoundingBox',
                'x': '0',
                'y': '0',
                'width':'150%',
                'height':'130%'
            });

            shadow.appendChild(canv.makeEl('feGaussianBlur',{'in':'SourceGraphic', 'stdDeviation':'4', 'result' : 'blur_out'}));
            shadow.appendChild(canv.makeEl('feOffset',{'in':'blur_out', 'result':'the_shadow', 'dx':'3','dy':'1'}));
            shadow.appendChild(canv.makeEl('feBlend',{'in':'SourceGraphic', 'in2':'the_shadow', 'mode':'normal'}));
        
            defs.appendChild(shadow);

            var link_icon = canv.makeEl('svg',{
                'width' : '100%',
                'height': '100%',
                'id'    : 'new_link_icon',
                'viewBox': '0 0 100 100',
                'preserveAspectRatio' : 'xMinYMin meet'
            });

            defs.appendChild(link_icon);

            link_icon.appendChild(canv.makeEl('rect', {
                'x' : '12.5',
                'y' : '37.5',
                'stroke-width' : '3',
                'width' : '50',
                'height': '50',
                'stroke': '#ffffff',
                'fill'  : 'none'            
            }));
            link_icon.appendChild(canv.makeEl('path', {
                'd' : 'M 50.0,16.7 L 83.3,16.7 L 83.3,50.0 L 79.2,56.2 L 68.8,39.6 L 43.8,66.7 L 33.3,56.2 L 60.4,31.2 L 43.8,20.8 L 50.0,16.7 z',
                'stroke-width' : '3',
                'stroke': '#999999',
                'fill'  : '#ffffff'            
            }));

            var plus_icon = canv.makeEl('svg',{
                'width' : '100%',
                'height': '100%',
                'id'    : 'plus_icon',
                'viewBox': '0 0 100 100',
                'preserveAspectRatio' : 'xMinYMin meet'
            });
            plus_icon.appendChild(canv.plus(0,0,100/canv.RS));
            
            defs.appendChild(plus_icon);

            var minus_icon = canv.makeEl('svg',{
                'width' : '100%',
                'height': '100%',
                'id'    : 'minus_icon',
                'viewBox': '0 0 100 100',
                'preserveAspectRatio' : 'xMinYMin meet'
            });
            minus_icon.appendChild(canv.minus(0,0,100/canv.RS));

            defs.appendChild(minus_icon);

            var pattern = canv.makeEl('pattern', {
                'patternUnits' : 'userSpaceOnUse',
                'x'            : '0',
                'y'            : '0',
                'width'        : 10*canv.RS,
                'height'       : 2*canv.RS,
                'id'           : 'axis_pattern'
            });
            var line = canv.makeEl('rect',{
                'x'     : '0',
                'y'     : '0',
                'width' : '10%',
                'height': '100%',
                'fill'  : '#000'
            });
            pattern.appendChild(line);

            defs.appendChild(pattern);

            var self = this;
            var axis = drawAxis.call(self,canv,line_length);
            var aas = drawAminoAcids.call(self,canv);
            renderer.redrawAxis = function() {
                bean.fire(axis,'removed');
                aas.forEach(function(aa) {
                    if (aa.parentNode) {
                        aa.parentNode.removeChild(aa);
                    }
                });
                bean.fire(aas,'removed');
                axis = drawAxis.call(self,canv,renderer.sequence.length);
                aas = drawAminoAcids.call(self,canv);

                build_sequence_els();
                renderer.refresh();
            };
            renderer._layer_containers = {};
            renderer.enablePrintResizing();

            // When we have a layer registered with the global MASCP object
            // add a track within this rendererer.
            bean.add(MASCP,'layerRegistered', function(layer,rend) {
                if (! rend || rend === renderer) {
                    renderer.addTrack(layer);
                }
            });

            bean.fire(renderer,'sequenceChange');
        });
        var canvas = createCanvasObject.call(this);
        if (! this._canvas) {
            if (typeof svgweb != 'undefined') {
                svgweb.appendChild(canvas,this._container);
            } else {
                this._container.appendChild(canvas);
            }
        }
    
        var rend = this;
        this.EnableHighlights();
    
        var seq_change_func = function(other_func) {
            if ( ! rend._canvas ) {
                bean.add(rend,'sequenceChange',function() {
                    bean.remove(rend,'sequenceChange',arguments.callee);
                    other_func.apply();
                });
            } else {
                other_func.apply();
            }
        };
    
        seq_change_func.ready = function(other_func) {
            this.call(this,other_func);
        };
    
        return seq_change_func;
    
    };

})(MASCP.CondensedSequenceRenderer);


(function() {
    var svgns = 'http://www.w3.org/2000/svg';
    var add_import = function(ownerdoc) {
        if (!ownerdoc.ELEMENT_NODE) {
          ownerdoc.ELEMENT_NODE = 1;
          ownerdoc.ATTRIBUTE_NODE = 2;
          ownerdoc.TEXT_NODE = 3;
          ownerdoc.CDATA_SECTION_NODE = 4;
          ownerdoc.ENTITY_REFERENCE_NODE = 5;
          ownerdoc.ENTITY_NODE = 6;
          ownerdoc.PROCESSING_INSTRUCTION_NODE = 7;
          ownerdoc.COMMENT_NODE = 8;
          ownerdoc.DOCUMENT_NODE = 9;
          ownerdoc.DOCUMENT_TYPE_NODE = 10;
          ownerdoc.DOCUMENT_FRAGMENT_NODE = 11;
          ownerdoc.NOTATION_NODE = 12;
        }

        ownerdoc._importNode = function(node, allChildren) {
          switch (node.nodeType) {
            case ownerdoc.ELEMENT_NODE:
              var newNode = ownerdoc.createElementNS(svgns,node.nodeName);
              /* does the node have any attributes to add? */
              if (node.attributes && node.attributes.length > 0)
                for (var i = 0, il = node.attributes.length; i < il;) {
                  if (! /^on/.test(node.attributes[i].nodeName)) {
                      newNode.setAttribute(node.attributes[i].nodeName, node.getAttribute(node.attributes[i++].nodeName));
                  }
                }
              /* are we going after children too, and does the node have any? */
              if (allChildren && node.childNodes && node.childNodes.length > 0)
                for (var i = 0, il = node.childNodes.length; i < il;) {
                  if (node.childNodes[i].nodeName !== 'USE' && node.childNodes[i].nodeName !== 'SCRIPT') {
                      newNode.appendChild(ownerdoc._importNode(node.childNodes[i++], allChildren));
                  }
                }
              return newNode;
              break;
            case ownerdoc.TEXT_NODE:
            case ownerdoc.CDATA_SECTION_NODE:
            case ownerdoc.COMMENT_NODE:
              return ownerdoc.createTextNode(node.nodeValue);
              break;
          }
        };
    };

    MASCP.CondensedSequenceRenderer.prototype.importIcons = function(namespace,doc) {
        var new_owner = this._container_canvas.ownerDocument;
        if (this._container_canvas.getElementById('defs_'+namespace)){
            return;
        }
        this._container_canvas.appendChild(new_owner.createElement('defs'));
        this._container_canvas.lastChild.setAttribute('id','defs_'+namespace);
        var defs_block = this._container_canvas.lastChild;

        if ( ! new_owner._importNode ) {
            add_import(new_owner);
        }
        var new_nodes = new_owner._importNode(doc,true);
        if (typeof XPathResult !== 'undefined') {
            var iterator = new_owner.evaluate('//svg:defs/*',new_nodes,function(ns) { return svgns; } ,XPathResult.ANY_TYPE,null);
            var el = iterator.iterateNext();
            var to_append = [];
            while (el) {
                to_append.push(el);
                el = iterator.iterateNext();
            }
            to_append.forEach(function(el) {
                el.setAttribute('id',namespace+'_'+el.getAttribute('id'));
                defs_block.appendChild(el);
            });
        } else {
            var els = new_nodes.querySelectorAll('defs > *');
            for (var i = 0 ; i < els.length; i++ ) {
                els[i].setAttribute('id',namespace+'_'+els[i].getAttribute('id'));
                defs_block.appendChild(els[i]);
            }
        }
    };

})();


MASCP.CondensedSequenceRenderer.prototype.addValuesToLayer = function(layerName,values,options) {
    var RS = this._RS;
    
    var canvas = this._canvas;
    
    if ( ! canvas ) {        
        var orig_func = arguments.callee;
        var self = this;
        bean.add(this._renderer,'sequencechange',function() {
            bean.remove(this._renderer,'sequencechange',arguments.callee);
            orig_func.call(self,layerName,values);
        });
        log("Delaying rendering, waiting for sequence change");
        return;
    }

    var max_value;
    var min_value;
    var height_scale = 1;
    
    options = options || {};

    if (options.height) {
        height_scale = options.height / this._layer_containers[layerName].track_height;
    }

    var offset_scale = 0;
    if (options.offset) {
        offset_scale = options.offset / this._layer_containers[layerName].track_height;
    }
    var recalculate_plot  = function(scale) {
        var plot_path = 'm0 0';
        var last_value = null;
        values.forEach(function(value) {
            if ( typeof(last_value) == 'undefined' ) {
            } else {
                plot_path += ' l'+RS+' '+(-1 *RS*scale*height_scale*(value - last_value));
            }
            last_value = value;
            if (isNaN(max_value) || (value > max_value)) {
                max_value = value;            
            }
            if (isNaN(min_value) || (value < min_value)) {
                min_value = value;
            }
        });
        return plot_path;
    };
    var axis = this._canvas.path('M0 0 m0 '+(RS*((max_value || 0) - (min_value || 0)))+' l'+this._sequence_els.length*RS+' 0');
    var plot = this._canvas.path('M0 0 M0 0 m0 '+((max_value || 0))*RS+' '+recalculate_plot(1));
    var abs_min_val = min_value;
    var abs_max_val = max_value;
    plot.setAttribute('stroke','#ff0000');
    plot.setAttribute('stroke-width', 0.35*RS);
    plot.setAttribute('fill', 'none');
    plot.setAttribute('visibility','hidden');
    axis.setAttribute('stroke-width',0.2*RS);
    axis.setAttribute('visibility','hidden');
    axis.setAttribute('transform','translate(1,0)');
    plot.setAttribute('pointer-events','none');
    axis.setAttribute('pointer-events','none');
    
    this._layer_containers[layerName].push(plot);
    plot.setAttribute('transform','translate(1,10) scale(1,1)');
    this._layer_containers[layerName].push(axis);
    var renderer = this;

    if (options.label) {
        var text = this._canvas.text(0,0, options.label.max || options.label.min );
        text.setAttribute('transform','translate(0,0)');
        text.setAttribute('font-size', (4*RS)+'pt');
        text.setHeight = function(height) {
            text.setAttribute('y',height*offset_scale);
            text.setAttribute('font-size',(4*RS/renderer.zoom)+'pt');
        };
        this._layer_containers[layerName].push(text);
    }

    plot.setHeight = function(height) {
        var path_vals = recalculate_plot(0.5*height/RS);
        plot.setAttribute('d','M0 0 M0 0 m0 '+height*offset_scale+'m0 '+0.5*height*height_scale+' '+path_vals);
        plot.setAttribute('stroke-width',RS/renderer.zoom);
    };
    axis.setHeight = function(height) {
        if (abs_min_val < 0 && abs_max_val > 0) {
            axis.setAttribute('d','M0 0 M0 0 m0 '+height*offset_scale+'m0 '+0.5*height*height_scale+' l'+renderer._sequence_els.length*RS+' 0');
        } else {
            axis.setAttribute('d','M0 0 M0 0 m0 '+height*offset_scale+'m0 '+0.5*(1-abs_min_val)*height*height_scale+' l'+renderer._sequence_els.length*RS+' 0');
        }
        axis.setAttribute('stroke-width',0.2*RS/renderer.zoom);
    }
    return plot;
};

(function() {
var addElementToLayer = function(layerName,opts) {
    var canvas = this._renderer._canvas;

    if ( ! canvas ) {        
        var orig_func = arguments.callee;
        var self = this;
        bean.add(this._renderer,'sequencechange',function() {
            bean.remove(this._renderer,'sequencechange',arguments.callee);            
            orig_func.call(self,layerName);
        });
        log("Delaying rendering, waiting for sequence change");
        return;
    }

    var tracer = null;
    var tracer_marker = null;
    var renderer = this._renderer;

    if ( ! opts ) {
        opts = {};
    }

    var scale = 1;
    if (opts.height) {
        opts.height = parseFloat(opts.height);
        if (typeof(opts.height) !== 'undefined' && opts.bare_element ) {
            opts.height *= 2;
        }
        scale = opts.height / this._renderer._layer_containers[layerName].track_height;
        if (typeof(opts.offset) !== 'undefined') {
            opts.offset  = -1.25 -1.25 + (opts.offset / opts.height) * 5;// ( -250/4 + (x / height) * 250 ) where 250 is growing marker height
        }
    }

    var tracer_marker = canvas.growingMarker(0,0,opts.content || layerName.charAt(0).toUpperCase(),opts);
    tracer_marker.setAttribute('transform','translate('+((this._index + 0.5) * this._renderer._RS) +',0.01) scale('+scale+')');
    tracer_marker.setAttribute('height','250');
    tracer_marker.firstChild.setAttribute('transform', 'translate(-100,0) rotate(0,100,0.001)');

    if (! opts.no_tracer ) {

        var bobble = canvas.circle(this._index+0.5,10,0.25);
        bobble.setAttribute('visibility','hidden');
        bobble.style.opacity = '0.4';
        tracer = canvas.rect(this._index+0.5,10,0.05,0);
        tracer._index = this._index;
        tracer.style.strokeWidth = '0';
        tracer.style.fill = MASCP.layers[layerName].color;
        tracer.setAttribute('visibility','hidden');
        canvas.insertBefore(tracer,canvas.firstChild.nextSibling);
        var renderer = this._renderer;

        if ( ! this._renderer._layer_containers[layerName].tracers) {
            this._renderer._layer_containers[layerName].tracers = canvas.set();
        }
        if ( ! canvas.tracers ) {
            canvas.tracers = canvas.set();
            canvas._visibleTracers = function() {
                return renderer._visibleTracers();
            };
        }
        tracer.setHeight = function(height) {
            if (tracer.getAttribute('visibility') == 'hidden') {
                return;
            }

            var transform_attr = tracer_marker.getAttribute('transform');
            var matches = /translate\(.*[,\s](.*)\) scale\((.*)\)/.exec(transform_attr);
            if (matches[1] && matches[2]) {
                var scale = parseFloat(matches[2]);
                var y = parseFloat(matches[1]);
                var new_height = y + scale*(((tracer_marker.offset || 0) * 50) + 125) - parseInt(this.getAttribute('y'));
                this.setAttribute('height',new_height < 0 ? 0 : new_height );
            } else {
                this.setAttribute('height',height);
            }
        };
        this._renderer._layer_containers[layerName].tracers.push(tracer);
        this._renderer._layer_containers[layerName].tracers.push(bobble);
        canvas.tracers.push(tracer);
    }
    if (typeof opts.offset == 'undefined' || opts.offset === null) {
        // tracer_marker.offset = 2.5*this._renderer._layer_containers[layerName].track_height;
    } else {
        tracer_marker.offset = opts.offset;
    }


    // tracer_marker.setAttribute('transform','scale(0.5)');
    // tracer_marker.zoom_level = 'text';
    tracer_marker.setAttribute('visibility','hidden');

    this._renderer._layer_containers[layerName].push(tracer_marker);
    var result = [tracer,tracer_marker,bobble];
    result.move = function(x,width) {
        var transform_attr = tracer_marker.getAttribute('transform');
        var matches = /translate\(.*[,\s](.*)\) scale\((.*)\)/.exec(transform_attr);
        if (matches[1] && matches[2]) {
            tracer_marker.setAttribute('transform','translate('+((x-0.5)*renderer._RS)+','+matches[1]+') scale('+matches[2]+')');
        }
        if (tracer) {
            tracer.move(x-0.5,0.05);
            bobble.move(x-0.5);
        }
    };
    return result;
};

var addBoxOverlayToElement = function(layerName,width,fraction,opts) {
    
    var canvas = this._renderer._canvas;
    var renderer = this._renderer;
    if ( ! opts ) {
        opts = { };
    }
    if ( ! canvas ) {
        var orig_func = arguments.callee;
        var self = this;
        bean.add(this._renderer,'sequencechange',function() {
            bean.remove(this._renderer,'sequencechange',arguments.callee);            
            orig_func.call(self,layerName,width,opts);
        });
        log("Delaying rendering, waiting for sequence change");
        return;
    }


    var rect =  canvas.rect(-0.25+this._index,60,width || 1,4,opts);
    var rect_x = parseFloat(rect.getAttribute('x'));
    var rect_max_x = rect_x + parseFloat(rect.getAttribute('width'));
    var container = this._renderer._layer_containers[layerName];
    if ( typeof(opts.merge) !== 'undefined' && opts.merge ) {
        for (var i = 0; i < container.length; i++) {
            if (container[i].value != fraction ) {
                continue;
            }
            var el_x = parseFloat(container[i].getAttribute('x'));
            var el_max_x = el_x + parseFloat(container[i].getAttribute('width'));
            if ((el_x <= rect_x && rect_x <= el_max_x) ||
                (rect_x <= el_x && el_x <= rect_max_x)) {
                    container[i].setAttribute('x', ""+Math.min(el_x,rect_x));
                    container[i].setAttribute('width', ""+(Math.max(el_max_x,rect_max_x)-Math.min(el_x,rect_x)) );
                    rect.parentNode.removeChild(rect);
                    return container[i];
                }
        }
    }
    this._renderer._layer_containers[layerName].push(rect);
    rect.setAttribute('class',layerName);
    rect.style.strokeWidth = '0px';
    rect.setAttribute('visibility', 'hidden');
    if (typeof(fraction) !== 'undefined') {
        rect.setAttribute('opacity',fraction);
        rect.value = fraction;
    }
    rect.setAttribute('fill',opts.fill || MASCP.layers[layerName].color);
    rect.position_start = this._index;
    rect.position_end = this._index + width;
    if ((typeof(opts.offset) !== "undefined") || opts.height_scale) {
        var offset_val = opts.offset;
        rect.setHeight = function(hght) {
            this.setAttribute('y',offset_val*renderer._RS/renderer.zoom);
            this.setAttribute('height',hght*(opts.height_scale || 1));
        };
    }
    return rect;
};

var addTextToElement = function(layerName,width,opts) {
    var canvas = this._renderer._canvas;
    var renderer = this._renderer;
    if ( ! canvas ) {
        var orig_func = arguments.callee;
        var self = this;
        bean.add(this._renderer,'sequencechange',function() {
            bean.remove(this._renderer,'sequencechange',arguments.callee);
            orig_func.call(self,layerName,width,opts);
        });
        log("Delaying rendering, waiting for sequence change");
        return;
    }
    if ( ! opts ) {
        opts = {};
    }
    var height = this._renderer._layer_containers[layerName].trackHeight || 4;
    var text = canvas.text(this._index,0,opts.txt || "Text");
    text.setAttribute('font-size',0.75*height*this._renderer._RS);
    text.setAttribute('font-weight','bolder');
    text.setAttribute('fill','#ffffff');
    text.setAttribute('stroke','#000000');
    text.setAttribute('stroke-width','5');
    text.setAttribute('style','font-family: '+canvas.font_order);
    text.firstChild.setAttribute('dy','2ex');
    text.setAttribute('text-anchor','middle');
    if (opts.offset) {
        text.setAttribute('transform','translate('+text.getAttribute('x')+','+text.getAttribute('y')+')');
        text.offset = opts.offset;
        text.setHeight = function(height) {
            var top_offset = this.offset;
            this.setAttribute('x',0);
            this.setAttribute('y',top_offset*renderer._RS / renderer.zoom);
            text.setAttribute('stroke-width', 5/renderer.zoom);
            text.setAttribute('font-size', 0.75*height);
        };
    } else {
        text.setHeight = function(height) {
            text.setAttribute('stroke-width', 5/renderer.zoom);
            text.setAttribute('font-size', 0.75*height);
        };
    }
    this._renderer._layer_containers[layerName].push(text);
    return text;
}

var addShapeToElement = function(layerName,width,opts) {
    var canvas = this._renderer._canvas;
    var renderer = this._renderer;

    if ( ! canvas ) {
        var orig_func = arguments.callee;
        var self = this;
        bean.add(this._renderer,'sequencechange',function() {
            bean.remove(this._renderer,'sequencechange',arguments.callee);
            orig_func.call(self,layerName,width,opts);
        });
        log("Delaying rendering, waiting for sequence change");
        return;
    }

    var methods = {
        "pentagon" : canvas.pentagon,
        "hexagon"  : canvas.hexagon,
        "rectangle": canvas.rect,
        "ellipse"  : canvas.ellipticalRect,
        "roundrect": function(x,y,width,height) {
            return canvas.roundRect(x,y,width,height,0.25*height);
        }
    }
    if ( ! opts.rotate ) {
        opts.rotate = 0;
    }
    var shape = null;
    if (opts.shape in methods) {
        shape = methods[opts.shape].call(canvas,this._index,60,width || 1,opts.height || 4,opts.rotate);
    } else {
        return;
    }
    if (((typeof opts.offset) !== 'undefined') && (opts.shape == "roundrect" || opts.shape == "rectangle" || opts.shape == "ellipse" )) {
        var x_pos = shape.getAttribute('x');
        var y_pos = shape.getAttribute('y');
        shape.setAttribute('transform','translate('+x_pos+','+y_pos+')');
        shape.setAttribute('x','0');
        var offset_val = opts.offset || 0;
        var orig_height = opts.height || 4;
        shape.setAttribute('y',offset_val*this._renderer._RS);
        shape.setHeight = function(height) {
            if ( ! this._orig_stroke_width ) {
                this._orig_stroke_width = parseInt(this.getAttribute('stroke-width'));
            }
            shape.setAttribute('y', (offset_val*renderer._RS/renderer.zoom));
            shape.setAttribute('height',(orig_height*renderer._RS)/renderer.zoom);
            shape.setAttribute('stroke-width',this._orig_stroke_width/renderer.zoom);
        };
        shape.move = function(new_x,new_width) {
            var transform_attr = this.getAttribute('transform');
            var matches = /translate\(.*[,\s](.*)\)/.exec(transform_attr);
            if (matches[1]) {
                this.setAttribute('transform','translate('+(new_x*renderer._RS)+','+matches[1]+')');
            }
            this.setAttribute('width',new_width*renderer._RS);
        };
    }

    this._renderer._layer_containers[layerName].push(shape);
    shape.setAttribute('class',layerName);
    shape.setAttribute('visibility', 'hidden');
    shape.setAttribute('fill',opts.fill || MASCP.layers[layerName].color);
    if (opts.stroke) {
        shape.setAttribute('stroke',opts.stroke);
    }
    if (opts.stroke_width) {
        shape.setAttribute('stroke-width',renderer._RS*opts.stroke_width);
    } else {
        shape.style.strokeWidth = '0';
    }
    shape.position_start = this._index;
    shape.position_end = this._index + width;
    return shape;
};

var addElementToLayerWithLink = function(layerName,url,width) {
    var canvas = this._renderer._canvas;

    if ( ! canvas ) {
        var orig_func = arguments.callee;
        var self = this;
        bean.add(this._renderer,'sequencechange',function() {
            bean.remove(this._renderer,'sequencechange',arguments.callee);            
            orig_func.call(self,layerName,url,width);
        });
        log("Delaying rendering, waiting for sequence change");
        return;
    }


    var rect =  canvas.rect(-0.25+this._index,60,width || 1,4);
    this._renderer._layer_containers[layerName].push(rect);
    rect.style.strokeWidth = '0px';    
    rect.setAttribute('fill',MASCP.layers[layerName].color);
    rect.setAttribute('visibility', 'hidden');
    rect.setAttribute('class',layerName);
    return rect;
};

var addCalloutToLayer = function(layerName,element,opts) {
    var canvas = this._renderer._canvas;

    var renderer = this._renderer;
    
    if (typeof element == 'string') {
        var a_el = document.createElement('div');
        renderer.fillTemplate(element,opts,function(err,el) {
            a_el.innerHTML = el;
        });
        element = a_el;
    }
    
    if ( ! canvas ) {
        var orig_func = arguments.callee;
        var self = this;
        bean.add(this._renderer,'sequencechange',function() {
            bean.remove(this._renderer,'sequencechange',arguments.callee);            
            orig_func.call(self,layerName,width,opts);
        });
        log("Delaying rendering, waiting for sequence change");
        return;
    }
    var callout = canvas.callout(this._index+0.5,0.01,element,{'width' : (10*opts.width) || 100 ,'height': (opts.height * 10) || 100, 'align' : opts.align, 'font-size' : opts['font-size'] });
    callout.setHeight(opts.height*this._renderer._RS);
    this._renderer._canvas_callout_padding = Math.max(((10*opts.height) || 100),this._renderer._canvas_callout_padding||0);
    this._renderer._layer_containers[layerName].push(callout);
    callout.clear = function() {
        var cont = renderer._layer_containers[layerName];
        if (cont.indexOf(callout) > 0) {
            cont.splice(cont.indexOf(callout),1);
        }
        callout.parentNode.removeChild(callout);
    };
    return callout;
};

var all_annotations = {};
var default_annotation_height = 8;

var addAnnotationToLayer = function(layerName,width,opts) {
    var canvas = this._renderer._canvas;
    
    var renderer = this._renderer;
    
    if ( ! canvas ) {
        var orig_func = arguments.callee;
        var self = this;
        bean.add(this._renderer,'sequencechange',function() {
            bean.remove(this._renderer,'sequencechange',arguments.callee);            
            orig_func.call(self,layerName,width,opts);
        });
        log("Delaying rendering, waiting for sequence change");
        return;
    }

    if (typeof opts == 'undefined') {
        opts = { 'angle' : 0,
                'border' : 'rgb(255,0,0)',
                'content': 'A'
         };
    } else {
        if ( typeof opts.angle == 'undefined' ) {
            opts.angle = 0;
        }
    }
    
    if ( ! all_annotations[layerName]) {
        all_annotations[layerName] = {};
    }
    
    var blob_id = this._index+'_'+opts.angle;

    if (opts.angle == 'auto') {
        if ( ! all_annotations[layerName][blob_id] ) {
            all_annotations[layerName][blob_id] = {};
        }
    }

    var blob_exists = (typeof all_annotations[layerName][blob_id]) !== 'undefined';

    var height = opts.height || this._renderer._layer_containers[layerName].track_height;

    var offset = height / 2; //this._renderer._RS * height / 2;
    var blob = all_annotations[layerName][blob_id] ? all_annotations[layerName][blob_id] : canvas.growingMarker(0,0,opts.content,opts);

    if (opts.angle == 'auto') {
        if ( ! blob.contents ) {
            blob.contents = [opts.content];
        } else {
            if (blob.contents.indexOf(opts.content) < 0) {
                blob.contents.push(opts.content);
            }
        }

        opts.angle = blob.contents.length == 1 ? 0 : (-45 + 90*((blob.contents.indexOf(opts.content))/(blob.contents.length-1)));
        blob_id = this._index+'_'+opts.content;
        blob_exists = (typeof all_annotations[layerName][blob_id]) !== 'undefined';
        blob = all_annotations[layerName][blob_id] ? all_annotations[layerName][blob_id] : canvas.growingMarker(0,offset,opts.content,opts);
    }
    
    blob.setAttribute('transform','translate('+((this._index + 0.5) * this._renderer._RS) +',0.01) scale(1)');
    blob.setAttribute('height','250');
    blob.firstChild.setAttribute('transform', 'translate(-100,0) rotate('+opts.angle+',100,0.001)');

    blob.angle = opts.angle;
    all_annotations[layerName][blob_id] = blob;
    if ( ! blob_exists ) {
        blob._value = 0;
        this._renderer._layer_containers[layerName].push(blob);
        if (typeof opts.offset == 'undefined' || opts.offset === null) {
            blob.offset = 0*height;
        } else {
            blob.offset = opts.offset;
            if (opts.height) {
                blob.offset = opts.offset / opts.height;
            }
        }

        blob.height = height;
        if ( ! opts.height ) {
            this._renderer._layer_containers[layerName].fixed_track_height = height;
        } else {
            var old_set_height = blob.setHeight;
            blob.setHeight = function(hght) {
                if (arguments.callee.caller != renderer.redrawAnnotations) {
                    return;
                }
                return old_set_height.call(this,hght);
            };
        }
    }
    
    blob._value += width;
    if ( ! blob_exists ) {
        var bobble = canvas.circle(this._index+0.5,10+height,0.25);
        bobble.setAttribute('visibility','hidden');
        bobble.style.opacity = '0.4';

        var tracer = canvas.rect(this._index+0.5,10+height,0.05,0);
        tracer._index = this._index;
        tracer.style.strokeWidth = '0px';
        tracer.style.fill = '#777777';
        tracer.setAttribute('visibility','hidden');
        var theight = this._renderer._layer_containers[layerName].track_height;
        tracer.setHeight = function(hght) {
            if (this.getAttribute('visibility') == 'hidden') {
                return;
            }
            var transform_attr = blob.getAttribute('transform');
            var matches = /translate\(.*[,\s](.*)\) scale\((.*)\)/.exec(transform_attr);
            if (matches[1] && matches[2]) {
                var scale = parseFloat(matches[2]);
                var y = parseFloat(matches[1]);
                var new_height = y + scale*(((blob.offset || 0) * 50)) - parseInt(this.getAttribute('y'));
                this.setAttribute('height',new_height);
            } else {
                this.setAttribute('height',height);
            }

        }
        canvas.insertBefore(tracer,canvas.firstChild.nextSibling);
    
        if ( ! this._renderer._layer_containers[layerName].tracers) {
            this._renderer._layer_containers[layerName].tracers = canvas.set();
        }
        if ( ! canvas.tracers ) {
            canvas.tracers = canvas.set();
            canvas._visibleTracers = function() {
                return renderer._visibleTracers();
            };
        }

        this._renderer._layer_containers[layerName].tracers.push(tracer);
        this._renderer._layer_containers[layerName].tracers.push(bobble);
        canvas.tracers.push(tracer);
    }
    
    this._renderer.redrawAnnotations(layerName,height);
    return blob;
};

MASCP.CondensedSequenceRenderer.prototype._extendElement = function(el) {
    el.addToLayer = addElementToLayer;
    el.addBoxOverlay = addBoxOverlayToElement;
    el.addShapeOverlay = addShapeToElement;
    el.addTextOverlay = addTextToElement;
    el.addToLayerWithLink = addElementToLayerWithLink;
    el.addAnnotation = addAnnotationToLayer;
    el.callout = addCalloutToLayer;
};

MASCP.CondensedSequenceRenderer.prototype.remove = function(lay,el) {
    if (this._layer_containers[lay] && this._layer_containers[lay].indexOf(el) >= 0) {
        this._layer_containers[lay].splice(this._layer_containers[lay].indexOf(el),1);
        bean.fire(el,'removed');
        if (el.parentNode) {
            el.parentNode.removeChild(el);
        }
    }
};

var zoomFunctions = [];

MASCP.CondensedSequenceRenderer.prototype.addUnderlayRenderer = function(underlayFunc) {
    if (zoomFunctions.length == 0) {
        bean.add(this,'zoomChange',function() {
            for (var i = zoomFunctions.length - 1; i >=0; i--) {
                zoomFunctions[i].call(this, this.zoom, this._canvas);
            }
        });
    }
    zoomFunctions.push(underlayFunc);
};

/*
          var group = [];
          for (i = 0; i < sites.length; i++) {
              var current = sites[i], next = null;
              if ( ! current ) {
                continue;
              }
              if (sites[i+1]) {
                next = sites[i+1];
              }
              if ( ! do_grouping || (! next || ((next - current) > 10) || renderer.sequence.substring(current,next-1).match(/[ST]/)) ) {
                if (group.length < 3) {
                  group.push(current);
                  group.forEach(function(site){
                    renderer.getAA(site).addToLayer(layer,{"content" : (offset < 1) ? renderer.galnac() : renderer.light_galnac(), "offset" : offset, "height" : 9,  "bare_element" : true });
                  });
                } else {
                  group.push(current);
                  group.forEach(function(site){
                    renderer.getAA(site).addToLayer(layer,{"content" : (offset < 1) ? renderer.galnac() : renderer.light_galnac(), "offset" : offset, "height" : 9,  "bare_element" : true })[1].zoom_level = 'text';
                  });
                  var rect = renderer.getAA(group[0]).addShapeOverlay(layer,current-group[0]+1,{ "shape" : "roundrect", "offset" : offset - 4.875, "height" : 9.75 });
                  var a_galnac = (offset < 1) ? renderer.galnac() : renderer.light_galnac();
                  rect.setAttribute('fill',a_galnac.getAttribute('fill'));
                  rect.setAttribute('stroke',a_galnac.getAttribute('stroke'));
                  rect.setAttribute('stroke-width',70);
                  a_galnac.parentNode.removeChild(a_galnac);
                  rect.removeAttribute('style');
                  rect.setAttribute('rx','120');
                  rect.setAttribute('ry','120');
                  rect.zoom_level = 'summary';
                }
                group = [];
              } else {
                group.push(current);
              }
          }
*/

var mark_groups = function(renderer,objects) {
    var group = [];
    var new_objects = [];
    for (i = 0; i < objects.length; i++) {
      var current = objects[i], next = null;
      if ( ! current ) {
        continue;
      }
      if (objects[i+1]) {
        next = objects[i+1];
      }
      if ( (! next || (parseInt(next.aa) - parseInt(current.aa) > 10) || renderer.sequence.substring(current,next-1).match(/[ST]/)) ) {
        if (group.length < 3) {
          group.push(current);
          group.forEach(function(site){
            // We don't want to do anything to these guys, render as usual.
//            renderer.getAA(site).addToLayer(layer,{"content" : (offset < 1) ? renderer.galnac() : renderer.light_galnac(), "offset" : offset, "height" : 9,  "bare_element" : true });
          });
        } else {
          group.push(current);
          group.forEach(function(site){
            site.options.zoom_level = 'text';
          });
          new_objects.push({
            'aa' : group[0].aa,
            'type' : 'shape',
            'width' : parseInt(current.aa)-parseInt(group[0].aa)+1,
            'options' : {   'zoom_level' : 'summary',
                            'shape' : 'roundrect',
                            'fill' : group[0].coalesce.fill,
                            'stroke' : group[0].coalesce.stroke,
                            'stroke_width' : group[0].coalesce.stroke_width,
                            'height' : group[0].options.height,
                            'offset' : group[0].options.offset
                        }
            });
          // var rect = renderer.getAA(group[0]).addShapeOverlay(layer,current-group[0]+1,{ "shape" : "roundrect", "offset" : offset - 4.875, "height" : 9.75 });
          // var a_galnac = (offset < 1) ? renderer.galnac() : renderer.light_galnac();
          // rect.setAttribute('fill',a_galnac.getAttribute('fill'));
          // rect.setAttribute('stroke',a_galnac.getAttribute('stroke'));
          // rect.setAttribute('stroke-width',70);
          // a_galnac.parentNode.removeChild(a_galnac);
          // rect.removeAttribute('style');
          // rect.setAttribute('rx','120');
          // rect.setAttribute('ry','120');
          // rect.zoom_level = 'summary';
        }
        group = [];
      } else {
        group.push(current);
      }
    }
    new_objects.forEach(function(obj) {
        objects.push(obj);
    });
};


MASCP.CondensedSequenceRenderer.prototype.renderObjects = function(track,objects) {
    var renderer = this;
    if (objects.length > 0 && objects[0].coalesce ) {
        mark_groups(renderer,objects);
    }
    objects.forEach(function(object) {
        var click_reveal;
        var rendered;
        if (object.aa && ( ! renderer.getAA(parseInt(object.aa))) ) {
            return;
        }
        if ((typeof object.aa !== 'undefined') && isNaN(object.aa)) {
            return;
        }
        if (object.type === "box") {
            if (object.aa) {
                rendered = renderer.getAA(parseInt(object.aa)).addBoxOverlay(track,parseInt(object.width),1,object.options);
            } else if (object.peptide) {
                rendered = renderer.getAminoAcidsByPeptide(object.peptide).addToLayer(track,1,object.options);
            }
        }
        if (object.type == "shape") {
            if (object.aa) {
                rendered = renderer.getAA(parseInt(object.aa)).addShapeOverlay(track,parseInt(object.width),object.options);
            } else if (object.peptide) {
                rendered = renderer.getAminoAcidsByPeptide(object.peptide)[0].addShapeOverlay(track, object.peptide.length, object.options);
            }
        }
        if (object.type == "marker") {
            var content = (object.options || {}).content;
            var wanted_height = object.options.height;

            if (Array.isArray && Array.isArray(content)) {
                var cloned_options_array = {};
                for( var key in object.options ) {
                    if (object.options.hasOwnProperty(key)) {
                        cloned_options_array[key] = object.options[key];
                    }
                }

                click_reveal = renderer.getAA(parseInt(object.aa)).addToLayer(track,cloned_options_array);
                click_reveal = click_reveal[1];
                click_reveal.style.display = 'none';
                object.options.content = object.options.alt_content;
                // delete object.options.stretch;
            } else if (typeof(content) == 'object') {
                var content_el;
                if (content.type == "circle") {
                    content_el = renderer._canvas.circle(-0.5,-0.5,1,1);
                }
                ["fill","stroke","stroke-width","fill-opacity","stroke-opacity"].forEach(function(prop) {
                    if (content[prop]) {
                        content_el.setAttribute(prop,content[prop]);
                    }
                });
                object.options.content = content_el;
            }
            var cloned_options = {};
            for( var key in object.options ) {
                if (object.options.hasOwnProperty(key)) {
                    cloned_options[key] = object.options[key];
                }
            }
            var added = renderer.getAA(parseInt(object.aa)).addToLayer(track,cloned_options);
            if (click_reveal) {
                added[1].addEventListener('click',function() {
                    if (click_reveal.style.display === 'none') {
                        click_reveal.parentNode.appendChild(click_reveal);
                        click_reveal.style.display = 'block';
                    } else {
                        click_reveal.style.display = 'none';
                    }
                    renderer.refresh();
                },false);
            }
            rendered = added[1];
        }
        if ((object.options || {}).zoom_level) {
            rendered.zoom_level = object.options.zoom_level;
        }
    });
};

MASCP.CondensedSequenceRenderer.prototype.addTextTrack = function(seq,container) {
    var RS = this._RS;
    var renderer = this;
    var max_length = 300;
    var canvas = renderer._canvas;
    var seq_chars = seq.split('');

    var amino_acids = canvas.set();
    var amino_acids_shown = false;
    var x = 0;

    var has_textLength = true;
    var no_op = function() {};
    try {
        var test_el = document.createElementNS(svgns,'text');
        test_el.setAttribute('textLength',10);
        no_op(test_el.textLength);
    } catch (e) {
        has_textLength = false;
    }

    /* We used to test to see if there was a touch event
       when doing the textLength method of amino acid
       layout, but iOS seems to support this now.
       
       Test case for textLength can be found here
       
       http://jsfiddle.net/nkmLu/11/embedded/result/
    */

    /* We also need to test for support for adjusting textLength
       while also adjusting the dx value. Internet Explorer 10
       squeezes text when setting a dx value as well as a textLength.
       I.e. the right-most position of the character is calculated to
       be x + textLength, rather than x + dx + textLength.
     */

    var supports_dx = false;
    if (typeof MASCP.supports_dx != 'undefined') {
        supports_dx = MASCP.supports_dx;
    } else {
        (function(supports_textLength) {
            if (! supports_textLength) {
                supports_dx = false;
                return;
            }
            var test_el = document.createElementNS(svgns,'text');
            test_el.setAttribute('textLength',30);

            if ( ! test_el.getExtentOfChar ) {
                return;
            }
            test_el.setAttribute('x','0');
            test_el.setAttribute('y','0');
            test_el.textContent = 'ABC';
            canvas.appendChild(test_el);
            var extent = test_el.getExtentOfChar(2).x;
            test_el.setAttribute('dx','10');
            if (Math.abs(test_el.getExtentOfChar(2).x - extent) < 9.5) {
                supports_dx = false;
            } else {
                supports_dx = true;
            }
            MASCP.supports_dx = supports_dx;
            test_el.parentNode.removeChild(test_el);
        })(has_textLength);
    }

    var a_text;

    if (has_textLength && ('lengthAdjust' in document.createElementNS(svgns,'text')) && ('textLength' in document.createElementNS(svgns,'text'))) {
        if (seq.length <= max_length) {
            a_text = canvas.text(0,12,document.createTextNode(seq));
            a_text.setAttribute('textLength',RS*seq.length);
        } else {
            a_text = canvas.text(0,12,document.createTextNode(seq.substr(0,max_length)));
            a_text.setAttribute('textLength',RS*max_length);
        }
        canvas.insertBefore(a_text,canvas.firstChild.nextSibling);

        a_text.style.fontFamily = "'Lucida Console', 'Courier New', Monaco, monospace";
        a_text.setAttribute('lengthAdjust','spacing');
        a_text.setAttribute('text-anchor', 'start');
        a_text.setAttribute('dx',5);
        a_text.setAttribute('dy','1.5ex');
        a_text.setAttribute('font-size', RS);
        a_text.setAttribute('fill', '#000000');
        amino_acids.push(a_text);
        container.push(a_text);
    } else {    
        for (var i = 0; i < seq_chars.length; i++) {
            a_text = canvas.text(x,12,seq_chars[i]);
            a_text.firstChild.setAttribute('dy','1.5ex');
            amino_acids.push(a_text);
            container.push(a_text);
            a_text.style.fontFamily = "'Lucida Console', Monaco, monospace";
            x += 1;
        }
        amino_acids.attr( { 'width': RS,'text-anchor':'start','height': RS,'font-size':RS,'fill':'#000000'});
    }
    var update_sequence = function() {
        if (seq.length <= max_length) {
            return;
        }
        var container_width = renderer._container_canvas.parentNode.cached_width;
        if ( ! container_width ) {
            container_width = renderer._container_canvas.parentNode.getBoundingClientRect().width;
            var docwidth = document.documentElement.clientWidth;
            if (docwidth > container_width) {
                container_width = docwidth;
            }
        }
        max_size = Math.ceil(10*container_width / RS);
        if (max_size > seq.length) {
            max_size = seq.length;
        }

        a_text.setAttribute('textLength',RS*max_size);

        var start = parseInt(renderer.leftVisibleResidue());
        start -= 50;
        if (start < 0) { 
            start = 0;
        }
        if ((start + max_size) >= seq.length) {
            start = seq.length - max_size;
            if (start < 0) {
                start = 0;
            }
        }
        a_text.replaceChild(document.createTextNode(seq.substr(start,max_size)),a_text.firstChild);
        a_text.setAttribute(supports_dx ? 'dx' : 'x',5+((start)*RS));
    };
    var panstart = function() {
                        if (amino_acids_shown) {
                            amino_acids.attr( { 'display' : 'none'});
                        }
                    };
    var panend = function() {
                        if (amino_acids_shown) {
                            amino_acids.attr( {'display' : 'block'} );
                            update_sequence();
                        }
                    };
    var zoomchange = function() {
                       if (canvas.zoom > 3.6) {
                           amino_acids.attr({'display' : 'block'});
                           amino_acids_shown = true;
                           update_sequence();
                       } else if (canvas.zoom > 0.2) {
                           amino_acids.attr({'display' : 'none'});
                           amino_acids_shown = false;
                       } else {
                           amino_acids.attr({'display' : 'none'});
                           amino_acids_shown = false;
                       }
                   };
    if ( ! container.panevents ) {
        canvas.addEventListener('panstart', panstart,false);
        bean.add(canvas,'panend', panend);
        container.panevents = true;
    }
       
    bean.add(canvas,'zoomChange', zoomchange,false);
    bean.add(amino_acids[0],'removed',function() {
        canvas.removeEventListener('panstart',panstart);
        bean.remove(canvas,'panend',panend);
        bean.remove(canvas,'zoomChange',zoomchange);
        delete container.panevents;
    });
    return amino_acids;
};

MASCP.CondensedSequenceRenderer.prototype.renderTextTrack = function(lay,in_text) {
    var layerName = lay;
    if (typeof layerName !== 'string') {
        layerName = lay.name;
    }
    var canvas = this._canvas;
    if ( ! canvas || typeof layerName == 'undefined') {
        return;
    }
    var renderer = this;
    var container = this._layer_containers[layerName];
    var result = this.addTextTrack(in_text,container);
    return result;
};

MASCP.CondensedSequenceRenderer.prototype.resetAnnotations = function() {
    all_annotations = {};
};

MASCP.CondensedSequenceRenderer.prototype.removeAnnotations = function(lay) {
    var layerName = lay;
    if (typeof layerName !== 'string') {
        layerName = lay.name;
    }
    var canvas = this._canvas;
    if ( ! canvas || typeof layerName == 'undefined') {
        return;
    }

    for (var blob_idx in all_annotations[layerName]) {
        if (all_annotations[layerName].hasOwnProperty(blob_idx)) {
            var blob = all_annotations[layerName][blob_idx];
            var container = this._layer_containers[layerName];
            if (container.indexOf(blob) >= 0) {
                container.splice(container.indexOf(blob),1);
            }
            if (canvas.tracers && container.tracers) {
                for (var i = 0; i < container.tracers.length; i++ ) {
                    var tracer = container.tracers[i];
                    tracer.parentNode.removeChild(tracer);
                    if (canvas.tracers.indexOf(tracer) >= 0) {                    
                        canvas.tracers.splice(canvas.tracers.indexOf(tracer),1);
                    }
                }
                container.tracers = canvas.set();
            }
            if (blob.parentNode) {
                blob.parentNode.removeChild(blob);
            }
            all_annotations[layerName][blob_idx] = null;
        }
    }
    all_annotations[layerName] = null;
    delete all_annotations[layerName];
    delete this._layer_containers[layerName].fixed_track_height;

};

MASCP.CondensedSequenceRenderer.prototype.redrawAnnotations = function(layerName) {
    var canvas = this._canvas, a_parent = null, blob_idx = 0;
    var susp_id = canvas.suspendRedraw(10000);
    
    var max_value = 0;
    // var height = this._layer_containers[layerName].fixed_track_height || this._layer_containers[layerName].track_height;
    for (blob_idx in all_annotations[layerName]) {
        if (all_annotations[layerName].hasOwnProperty(blob_idx)) {
            if ( all_annotations[layerName][blob_idx]._value > max_value ) {
                max_value = all_annotations[layerName][blob_idx]._value;
            }
            a_parent = all_annotations[layerName][blob_idx].parentNode;
            if ( ! a_parent ) {
                continue;
            }
            a_parent.removeChild(all_annotations[layerName][blob_idx]);
            all_annotations[layerName][blob_idx]._parent = a_parent;
        }
    }
    for (blob_idx in all_annotations[layerName]) {
        if (all_annotations[layerName].hasOwnProperty(blob_idx)) {
            var a_blob = all_annotations[layerName][blob_idx];

            var height = a_blob.height;
            var track_height = this._layer_containers[layerName].fixed_track_height || this._layer_containers[layerName].track_height;

            if ( ! a_blob.setHeight ) {
                continue;
            }
            var size_val = (0.4 + ((0.6 * a_blob._value) / max_value))*(this._RS * height * 1);
            a_blob.setHeight(size_val);
        }
    }
    
    for (blob_idx in all_annotations[layerName]) {
        if (all_annotations[layerName].hasOwnProperty(blob_idx)) {
            a_parent = all_annotations[layerName][blob_idx]._parent;
            if ( ! a_parent ) {
                continue;
            }
            a_parent.appendChild(all_annotations[layerName][blob_idx]);
        }
    }
    canvas.unsuspendRedraw(susp_id);
};

// Simple JavaScript Templating
// John Resig - http://ejohn.org/ - MIT Licensed
(function(mpr){
    var cache = {};
    var needs_sandbox = false;

    var template_func = function tmpl(str, data){
        // Figure out if we're getting a template, or if we need to
        // load the template - and be sure to cache the result.
        var fn = !/\W/.test(str) ?
          cache[str] = cache[str] ||
            tmpl(document.getElementById(str).innerHTML) :

          // Generate a reusable function that will serve as a template
          // generator (and which will be cached).
          new Function("obj",
            "var p=[],print=function(){p.push.apply(p,arguments);};" +

            // Introduce the data as local variables using with(){}
            "with(obj){p.push('" +

            // Convert the template into pure JavaScript
            str
              .replace(/[\r\t\n]/g, " ")
              .split(/\x3c\%/g).join("\t")
              .replace(/((^|%>)[^\t]*)'/g, "$1\r")
              .replace(/\t=(.*?)%>/g, "',$1,'")
              .split("\t").join("');")
              .split("%>").join("p.push('")
              .split("\r").join("\\'")
          + "');}return p.join('');");
        
        // Provide some basic currying to the user
        return data ? fn( data ) : fn;
    };

    try {
        var foo = new Function("return;");
    } catch (exception) {
        needs_sandbox = true;
    }
    if (needs_sandbox) {
        mpr.fillTemplate = function tmpl(str,data,callback) {
            MASCP.SANDBOX.contentWindow.postMessage({ "template" : document.getElementById(str).innerHTML, "data" : data },"*");
            var return_func = function(event) {
                bean.remove(window,'message',return_func);
                if (event.data.html) {
                    callback.call(null,null,event.data.html);
                }
            };
            bean.add(window,'message',return_func);

        }
        return;
    }

  mpr.fillTemplate = function(str,data,callback) {
    callback.call(null,null,template_func(str,data));
  };
})(MASCP.CondensedSequenceRenderer.prototype);

})();

/**
 * Mouseover event for a layer
 * @name    MASCP.Layer#mouseover
 * @event
 * @param   {Object}    e
 */
 
/**
 * Mouseout event for a layer
 * @name    MASCP.Layer#mouseout
 * @event
 * @param   {Object}    e
 */
  
/**
 * Mousemove event for a layer
 * @name    MASCP.Layer#mousemove
 * @event
 * @param   {Object}    e
 */

/**
 * Mousedown event for a layer
 * @name    MASCP.Layer#mousedown
 * @event
 * @param   {Object}    e
 */
 
/**
 * Mouseup event for a layer
 * @name    MASCP.Layer#mouseup
 * @event
 * @param   {Object}    e
 */

/**
 * Click event for a layer
 * @name    MASCP.Layer#click
 * @event
 * @param   {Object}    e
 */

 /**
  * Long click event for a layer
  * @name    MASCP.Layer#longclick
  * @event
  * @param   {Object}    e
  */

MASCP.CondensedSequenceRenderer.prototype.EnableHighlights = function() {
    var renderer = this;
    var highlights = [];
    var createNewHighlight = function() {
        var highlight = renderer._canvas.rect(0,0,0,'100%');
        highlight.setAttribute('fill','#ffdddd');
        highlight.removeAttribute('stroke');
        var pnode = highlight.parentNode;
        pnode.insertBefore(highlight,pnode.firstChild.nextSibling);
        highlights.push(highlight);
    };
    createNewHighlight();

    renderer.moveHighlight = function() {
        var vals = Array.prototype.slice.call(arguments);
        var RS = this._RS;
        var i = 0, idx = 0;
        for (i = 0; i < vals.length; i+= 2) {
            var from = vals[i];
            var to = vals[i+1];
            var highlight = highlights[idx];
            if ( ! highlight ) {
                createNewHighlight();
                highlight = highlights[idx];
            }
            if ( highlight.previousSibling.previousSibling && highlights.indexOf(highlight.previousSibling.previousSibling) < 0 ) {
                highlight.parentNode.insertBefore(highlight,highlight.parentNode.firstChild.nextSibling);
            }
            highlight.setAttribute('x',(from - 1) * RS );
            highlight.setAttribute('width',(to - (from - 1)) * RS );
            highlight.setAttribute('visibility','visible');
            idx += 1;
        }
        for (i = idx; i < highlights.length; i++){
            highlights[i].setAttribute('visibility','hidden');
        }
    };
};

/*
 * Get a canvas set of the visible tracers on this renderer
 */
MASCP.CondensedSequenceRenderer.prototype._visibleTracers = function() {
    var tracers = null;
    for (var i in MASCP.layers) {
        if (this.isLayerActive(i) && this._layer_containers[i] && this._layer_containers[i].tracers) {
            if ( ! tracers ) {
                tracers = this._layer_containers[i].tracers;
            } else {
                tracers.concat(this._layer_containers[i].tracers);
            }
        }
    }
    return tracers;
};

MASCP.CondensedSequenceRenderer.prototype._resizeContainer = function() {
    var RS = this._RS;
    if (this._container && this._canvas) {
        
        var width = (this.zoom || 1)*2*this.sequence.length;
        var height = (this.zoom || 1)*2*(this._canvas._canvas_height/this._RS);
        if (this._canvas_callout_padding) {
            height += this._canvas_callout_padding;
        }
        this._canvas.setAttribute('width', width);
        this._canvas.setAttribute('height',height);
        this.navigation.setDimensions(width,height);
        
        if (this.grow_container) {
            this._container_canvas.setAttribute('height',height);
            this._container.style.height = height+'px';        
        } else {
            this._container_canvas.setAttribute('height','100%');
            this._container_canvas.setAttribute('width','100%');
            this.navigation.setZoom(this.zoom);
        }        
    }
};

(function(clazz) {

var vis_change_event = function(renderer,visibility) {
    var self = this;
    if ( ! renderer._layer_containers[self.name] || renderer._layer_containers[self.name].length <= 0 ) {
        return;
    }
    
    if (! visibility) {
        if (renderer._layer_containers[self.name].tracers) {
            renderer._layer_containers[self.name].tracers.hide();
        }
    }
};

/**
 * Add a layer to this renderer.
 * @param {Object} layer    Layer object to add. The layer data is used to create a track that can be independently shown/hidden.
 *                          The track itself is by default hidden.
 */
clazz.prototype.addTrack = function(layer) {
    var RS = this._RS;
    var renderer = this;
    
    if ( ! this._canvas ) {
        bean.add(this,'sequencechange',function() {
            this.addTrack(layer);
            bean.remove(this,'sequencechange',arguments.callee);
        });
        console.log("No canvas, cannot add track, waiting for sequencechange event");
        return;
    }

    var layer_containers = this._layer_containers || [];

    if ( ! layer_containers[layer.name] || layer_containers[layer.name] === null) {
        layer_containers[layer.name] = this._canvas.set();
        if ( ! layer_containers[layer.name].track_height) {
            layer_containers[layer.name].track_height = renderer.trackHeight || 4;
        }
        bean.remove(layer,'visibilityChange',vis_change_event);
        bean.add(layer,'visibilityChange',vis_change_event);
        var event_names = ['click','mouseover','mousedown','mousemove','mouseout','mouseup','mouseenter','mouseleave'];
        var ev_function = function(ev,original_event,element) {
            bean.fire(layer,ev.type,[original_event,element.position_start,element.position_end]);
        };
        // for (var i = 0 ; i < event_names.length; i++) {
        //     bean.add(layer_containers[layer.name]._event_proxy,event_names[i],ev_function);
        // }
        bean.remove(layer,'removed');
        bean.add(layer,'removed',function(e,rend) {
            if (rend) {
                rend.removeTrack(this);
            } else{
                renderer.removeTrack(this);
            }
        });
    }
    
    this._layer_containers = layer_containers;
    
};

clazz.prototype.removeTrack = function(layer) {
    if (! this._layer_containers ) {
        return;
    }
    var layer_containers = this._layer_containers || [];
    if ( layer_containers[layer.name] ) {                
        layer_containers[layer.name].forEach(function(el) {
            if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
        });
        this.removeAnnotations(layer);
        this._layer_containers[layer.name] = null;
        layer.disabled = true;
    }
    
};
var refresh_id = 0;
clazz.prototype.enablePrintResizing = function() {
    if ( ! (this.win() || window).matchMedia ) {
        return;
    }
    if (this._media_func) {
        return this._media_func;
    }
    var old_zoom;
    var old_translate;
    var old_viewbox;
    this._media_func = function(matcher) {
        var self = this;
        if ( self.grow_container ) {
            if (matcher.matches) {
                var left_pos = 10*parseInt(self.leftVisibleResidue() / 10)+10;
                self._canvas.ownerDocument.getElementById('axis_pattern').setAttribute('x',(left_pos*self._RS));
                delete self._container_canvas.parentNode.cached_width;
                bean.fire(self._canvas,'panend');
            } else {
                self._canvas.ownerDocument.getElementById('axis_pattern').setAttribute('x','0');
            }
            return;
        }
        var match=matcher;
        if (! match.matches ) {
            if (self.old_zoom) {
                var a_zoom = self.old_zoom;
                self.old_zoom = null;
                self.zoomCenter = null;
                self.withoutRefresh(function() {
                  self.zoom = a_zoom;
                });
                self._canvas.setCurrentTranslateXY(old_translate,0);
                self._container_canvas.setAttribute('viewBox',old_viewbox);
                // self._container.style.height = 'auto';
                self.old_zoom = null;
                self.old_translate = null;
                self.refresh();
                bean.fire(self._canvas,'zoomChange');
            }
            return;
        }
        try {
            var container = self._container;
            self.old_translate = self._canvas.currentTranslate.x;
            self._canvas.setCurrentTranslateXY(0,0);
            var zoomFactor = 0.95 * (container.clientWidth) / (self.sequence.length);
            if ( ! self.old_zoom ) {
              self.old_zoom = self.zoom;
              self.old_viewbox = self._container_canvas.getAttribute('viewBox');
            }
            self.zoomCenter = null;
            self._container_canvas.removeAttribute('viewBox');
            self.withoutRefresh(function() {
                self.zoom = zoomFactor;
            });
            self.refresh();
        } catch (err) {
            console.log(err);
            console.log(err.stack);
        }
        // self.grow_container = false;
    };
    var rend = this;
    (this.win() || window).matchMedia('print').addListener(function(matcher) {
        rend._media_func(matcher);
    });
};

clazz.prototype.wireframe = function() {
    var order = this.trackOrder || [];
    var y_val = 0;
    var track_heights = 0;
    if ( ! this.wireframes ) {
        return;
    }
    while (this.wireframes.length > 0) {
        this._canvas.removeChild(this.wireframes.shift());
    }
    for (var i = 0; i < order.length; i++ ) {
        
        var name = order[i];
        var container = this._layer_containers[name];
        if (! this.isLayerActive(name)) {
            continue;
        }
        if (container.fixed_track_height) {

            var track_height = container.fixed_track_height;

            y_val = this._axis_height + (track_heights  - track_height*0.3) / this.zoom;
            var a_rect = this._canvas.rect(0,y_val,10000,0.5*track_height);
            a_rect.setAttribute('stroke','#ff0000');
            a_rect.setAttribute('fill','none');
            this.wireframes.push(a_rect);
            var a_rect = this._canvas.rect(0,y_val,10000,track_height);
            a_rect.setAttribute('stroke','#ff0000');
            a_rect.setAttribute('fill','none');
            this.wireframes.push(a_rect);

            track_heights += (this.zoom * track_height) + this.trackGap;
        } else {
            y_val = this._axis_height + track_heights / this.zoom;
            var a_rect = this._canvas.rect(0,y_val,10000,0.5*container.track_height / this.zoom );
            a_rect.setAttribute('stroke','#ff0000');
            a_rect.setAttribute('fill','none');
            this.wireframes.push(a_rect);
            a_rect = this._canvas.rect(0,y_val,10000,container.track_height / this.zoom);
            a_rect.setAttribute('stroke','#ff0000');
            a_rect.setAttribute('fill','none');
            this.wireframes.push(a_rect);
            if (this.navigation) {
                track_heights += container.track_height;
            }
            track_heights += container.track_height + this.trackGap;
        }

    }    
};

/**
 * Cause a refresh of the renderer, re-arranging the tracks on the canvas, and resizing the canvas if necessary.
 * @param {Boolean} animateds Cause this refresh to be an animated refresh
 */
clazz.prototype.refresh = function(animated) {
    if ( ! this._canvas ) {
        return;
    }

    var layer_containers = this._layer_containers || [];

    var RS = this._RS;
    var track_heights = 0;
    var order = this.trackOrder || [];
    var fixed_font_scale = this.fixedFontScale;
    
    if (this.navigation) {
        this.navigation.reset();
    }
    for (var i = 0; i < order.length; i++ ) {
        
        var name = order[i];
        var container = layer_containers[name];
        if ( ! container ) {
            continue;
        }
        var y_val;
        if (! this.isLayerActive(name)) {
            var attrs = { 'y' : -1*(this._axis_height)*RS, 'height' :  RS * container.track_height / this.zoom ,'visibility' : 'hidden' };
//            var attrs = { 'y' : (this._axis_height  + (track_heights - container.track_height )/ this.zoom)*RS, 'height' :  RS * container.track_height / this.zoom ,'visibility' : 'hidden' };
            if (MASCP.getLayer(name).group) {
                var controller_track = this.navigation.getController(MASCP.getLayer(name).group);
                if (controller_track && this.isLayerActive(controller_track)) {
                    attrs.y = layer_containers[controller_track.name].currenty();
                }
            }
            
            if (container.fixed_track_height) {
                delete attrs.height;
            }

            if (animated) {                
                container.animate(attrs);
            } else {
                container.attr(attrs);
            }
            if (container.tracers) {
            }
            continue;
        } else {
            // container.attr({ 'opacity' : '1' });
        }

        var tracer_top = track_heights;

        if (container.fixed_track_height) {

            var track_height = container.fixed_track_height;

            y_val = this._axis_height + track_heights  / this.zoom;

            if (animated) {
                container.animate({ 'visibility': 'visible', 'y' : y_val*RS, 'height' :  RS * container.track_height / this.zoom });
            } else {
                container.attr({ 'visibility': 'visible', 'y' : y_val*RS, 'height' :  RS * container.track_height / this.zoom });
            }
            if (this.navigation) {
                y_val -= 1*container.track_height/this.zoom;
                this.navigation.renderTrack(MASCP.getLayer(name), y_val*RS , RS * container.fixed_track_height / this.zoom, { 'font-scale' : ((fixed_font_scale || 1) * 3 *container.track_height) / container.fixed_track_height } );
            }
            track_heights += container.fixed_track_height + this.trackGap - container.track_height;

        } else {
            y_val = this._axis_height + track_heights / this.zoom;
            if (animated) {
                container.animate({ 'visibility': 'visible', 'y' : y_val*RS, 'height' :  RS * container.track_height / this.zoom });
            } else {
                container.attr({ 'visibility': 'visible', 'y' : y_val*RS, 'height' :  RS * container.track_height / this.zoom });                
            }
            if (this.navigation) {
                y_val -= 1*container.track_height/this.zoom;
                this.navigation.renderTrack(MASCP.getLayer(name), y_val*RS , RS * 3 * container.track_height / this.zoom, fixed_font_scale ? { 'font-scale' : fixed_font_scale } : null );
                track_heights += container.track_height;
            }
            track_heights += container.track_height + this.trackGap;
        }
        container.refresh_zoom();

        if (container.tracers) {
            var disp_style = (this.isLayerActive(name) && (this.zoom > 3.6)) ? 'visible' : 'hidden';
            var height = (1.5 + tracer_top / this.zoom )*RS;

            if(animated) {
                container.tracers.animate({'visibility' : disp_style , 'y' : 0.65*(this._axis_height)*RS,'height' : height });
            } else {
                container.tracers.attr({'visibility' : disp_style , 'y' : 0.65*(this._axis_height)*RS,'height' : height });
            }
        }


    }
    this.wireframe();
    
    var viewBox = [-1,0,0,0];
    viewBox[0] = -2*RS;
    viewBox[2] = (this.sequence.split('').length+(this.padding)+2)*RS;
    viewBox[3] = (this._axis_height + (track_heights / this.zoom)+ (this.padding / this.zoom))*RS;
    this._canvas.setAttribute('viewBox', viewBox.join(' '));
    this._canvas._canvas_height = viewBox[3];


    var outer_viewbox = [].concat(viewBox);

    outer_viewbox[0] = 0;
    outer_viewbox[2] = (this.zoom)*(2*this.sequence.length)+(this.padding);
    outer_viewbox[3] = (this.zoom)*2*(this._axis_height + (track_heights / this.zoom)+ (this.padding / this.zoom));
    if (! this.grow_container ) {
        this._container_canvas.setAttribute('viewBox', outer_viewbox.join(' '));
    }

    this._resizeContainer();

    viewBox[0] = 0;
    if (this.navigation) {

        if (this.navigation.visible()) {
            this._canvas.style.GomapScrollLeftMargin = 100 * RS / this.zoom;
        } else {
            this._canvas.style.GomapScrollLeftMargin = 1000;            
        }
        this.navigation.setViewBox(viewBox.join(' '));
    }

    if (this.navigation) {
        this.navigation.refresh();
    }

};


/*

Modified from:

http://stackoverflow.com/questions/5433806/convert-embedded-svg-to-png-in-place

None of the Safari browsers work with this, giving DOM Exception 18

http://stackoverflow.com/questions/8158312/rasterizing-an-in-document-svg-to-canvas

I think this is the relevant bug.

https://bugs.webkit.org/show_bug.cgi?id=119492

*/

var svgDataURL = function(svg) {
  svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
  svg.setAttribute('xmlns:xlink','http://www.w3.org/1999/xlink');

  var svgAsXML = (new XMLSerializer).serializeToString(svg);
  return "data:image/svg+xml," + encodeURIComponent(svgAsXML);
};

clazz.prototype.pngURL = function(pngReady,out_width) {
    //var svg = document.getElementById('foobar');//this._canvas;
    var svg_data = this._canvas.cloneNode(true);
    var sequences = svg_data.querySelectorAll('text[data-spaces]');
    for (var i = 0; i < sequences.length; i++) {
        sequences[i].parentNode.removeChild(sequences[i]);
    }

    // Set up the aspect ratio of the output element
    var svg = document.createElementNS(svgns,'svg');
    svg.setAttribute('width',this._container_canvas.getBoundingClientRect().width);
    svg.setAttribute('height',this._container_canvas.getBoundingClientRect().height);
    svg.setAttribute('preserveAspectRatio','xMinYMin meet');

    var transform_group = document.createElementNS(svgns,'g');
    transform_group.setAttribute('transform',this._canvas.parentNode.getAttribute('transform'));
    svg.appendChild(transform_group);
    transform_group.appendChild(svg_data);

    // We are missing the defs elements from the containing node

    var all_defs = this._container_canvas.querySelectorAll('defs');
    for (var i = 0; i < all_defs.length; i++) {
        svg.appendChild(all_defs[i].cloneNode(true));
    }
    var can = document.createElement('canvas');
    var total_width = 2*parseInt(svg.getAttribute('width'));
    var total_height = 2*parseInt(svg.getAttribute('height'));
    if (out_width) {
        if (total_width > out_width) {
            var ratio = total_width / out_width;
            total_width = out_width;
            total_height = parseInt(total_height / ratio);
        }
    }
    can.width = total_width;
    can.height = total_height;
    var svgImg = new Image;
    svgImg.width  = 1;
    svgImg.height = 1;
    var ctx = can.getContext('2d');
    svgImg.onload = function(){
      ctx.drawImage(svgImg,0,0,can.width,can.height);
      pngReady(can.toDataURL());
    };
    svgImg.onerror = function() {
      console.log("Got an error");
    };
    var dataurl = svgDataURL(svg);
    svgImg.src = dataurl;
};

})(MASCP.CondensedSequenceRenderer);

/**
 * Zoom level has changed for this renderer
 * @name    MASCP.CondensedSequenceRenderer#zoomChange
 * @event
 * @param   {Object}    e
 */

MASCP.CondensedSequenceRenderer.Zoom = function(renderer) {

/**
 *  @lends MASCP.CondensedSequenceRenderer.prototype
 *  @property   {Number}    zoom        The zoom level for a renderer. Minimum zoom level is zero, and defaults to the default zoom value
 *  @property   {Array}     trackOrder  The order of tracks on the renderer, an array of layer/group names.
 *  @property   {Number}    padding     Padding to apply to the right and top of plots (default 10).
 *  @property   {Number}    trackGap    Vertical gap between tracks (default 10)
 */
    var timeout = null;
    var start_zoom = null;
    var zoom_level = null;
    var center_residue = null;
    var start_x = null;
    var accessors = { 
        setZoom: function(zoomLevel) {
            var container_width = renderer._container.cached_width;
            if ( ! container_width ) {
                container_width = renderer._container.clientWidth;
            }
            var min_zoom_level = renderer.sequence ? (0.3 / 2) * container_width / renderer.sequence.length : 0.5;
            if (zoomLevel < min_zoom_level) {
                zoomLevel = min_zoom_level;
            }
            if (zoomLevel > 10) {
                zoomLevel = 10;
            }

            if (zoomLevel == zoom_level) {
                return;
            }

            var self = this;

            if (! self._canvas) {
                return;
            }

            var no_touch_center = false;

            if (self.zoomCenter == 'center') {
                no_touch_center = true;
                self.zoomCenter = {'x' : self._RS*0.5*(self.leftVisibleResidue()+self.rightVisibleResidue()) };
            }
            
            if ( self.zoomCenter && ! center_residue ) {
                start_x = self._canvas.currentTranslate.x || 0;
                center_residue = self.zoomCenter ? self.zoomCenter.x : 0;
            } else if (center_residue && ! self.zoomCenter ) {
                // We should not be zooming if there is a center residue and no zoomCenter;
                return;
            }

            if ( timeout ) {
                clearTimeout(timeout);
            } else {
                start_zoom = parseFloat(zoom_level || 1);
            }

            zoom_level = parseFloat(zoomLevel);        


            var curr_transform = self._canvas.parentNode.getAttribute('transform') || '';
            curr_transform = curr_transform.replace(/scale\([^\)]+\)/,'');
            var scale_value = Math.abs(parseFloat(zoomLevel)/start_zoom);
            curr_transform = 'scale('+scale_value+') '+(curr_transform || '');
            self._canvas.parentNode.setAttribute('transform',curr_transform);
            bean.fire(self._canvas,'_anim_begin');
            if (document.createEvent) {
                var evObj = document.createEvent('Events');
                evObj.initEvent('panstart',false,true);
                self._canvas.dispatchEvent(evObj);
            }
            var old_x = self._canvas.currentTranslate.x;
            if (center_residue) {
                var delta = ((start_zoom - zoom_level)/(scale_value*25))*center_residue;
                delta += start_x/(scale_value);
                self._canvas.setCurrentTranslateXY(delta,((start_zoom - zoom_level)/(scale_value))*self._axis_height*2);
            }
        
            var end_function = function() {
                timeout = null;
                var scale_value = Math.abs(parseFloat(zoom_level)/start_zoom);

                var curr_transform = self._canvas.parentNode.getAttribute('transform') || '';
                curr_transform = curr_transform.replace(/scale\([^\)]+\)/,'');
                self._canvas.parentNode.setAttribute('transform',curr_transform);

                bean.fire(self._canvas,'panend');
                bean.fire(self._canvas,'_anim_end');

                bean.add(self._canvas,'zoomChange',function() {
                    bean.remove(self._canvas,'zoomChange',arguments.callee);
                    self.refresh();
                    if (typeof center_residue != 'undefined') {
                        var delta = ((start_zoom - zoom_level)/(25))*center_residue;
                        delta += start_x;

                        self._resizeContainer();

                        if (self._canvas.shiftPosition) {
                            self._canvas.shiftPosition(delta,0);
                        } else {
                            self._canvas.setCurrentTranslateXY(delta,0);
                        }
                    }
                    center_residue = null;
                    start_x = null;              
                });
            
                if (self._canvas) {
                    self._canvas.zoom = parseFloat(zoom_level);
                    bean.fire(self._canvas,'zoomChange');
                }
                bean.fire(self,'zoomChange');
            };
        
            if (("ontouchend" in document) && self.zoomCenter && ! no_touch_center ) {
                bean.remove(self,'gestureend');
                bean.add(self,'gestureend',function(){
                    bean.remove(self,'gestureend',arguments.callee);
                    end_function();
                });
                timeout = 1;
            } else {
                if (! this.refresh.suspended) {
                    timeout = setTimeout(end_function,100);
                } else {
                    end_function();
                }
            }
        },

        getZoom: function() {
            return zoom_level || 1;
        }
    };

    if (Object.defineProperty && ! MASCP.IE8) {
        Object.defineProperty(renderer,"zoom", {
            get : accessors.getZoom,
            set : accessors.setZoom
        });
    }

};

/* Add some properties that will trigger a refresh on the renderer when they are changed.
   These are all stateless
 */

(function(clazz) {

    var accessors = {
        getPadding: function() {
            return this._padding || 10;
        },

        setPadding: function(padding) {
            this._padding = padding;
            this.refresh();
        },

        getTrackGap: function() {
            if (! this._track_gap){
                var default_value = ("ontouchend" in document) ? 20 : 10;
                this._track_gap = this._track_gap || default_value;
            }

            return this._track_gap;
        },

        setTrackGap: function(trackGap) {
            this._track_gap = trackGap;
            this.refresh();
        }
    };

    if (Object.defineProperty && ! MASCP.IE8 ) {
        Object.defineProperty(clazz.prototype,"padding", {
            get : accessors.getPadding,
            set : accessors.setPadding
        });
        Object.defineProperty(clazz.prototype,"trackGap", {
            get : accessors.getTrackGap,
            set : accessors.setTrackGap
        });
    }
    
})(MASCP.CondensedSequenceRenderer);
MASCP.CondensedSequenceRenderer.Navigation = (function() {

    var touch_scale = 1, touch_enabled = false;
    if ("ontouchend" in document) {
        touch_scale = window.devicePixelRatio ;
        touch_enabled = true;
    }

    var Navigation = function(parent_canvas,renderer) {
        SVGCanvas(parent_canvas);

        this.win = function() {
            return renderer.win();
        };

        buildNavPane.call(this,parent_canvas);

        var track_group = parent_canvas.group();

        parent_canvas.insertBefore(track_group,parent_canvas.lastChild);

        var track_canvas = document.createElementNS(svgns,'svg');    
        buildTrackPane.call(this,track_canvas,connectRenderer.call(this,renderer));

        track_group.appendChild(track_canvas);

        track_group.setAttribute('clip-path','url(#nav_clipping)');

        this.disable = function() {
            parent_canvas.style.display = 'none';
            track_canvas.style.display = 'none';

        };

        this.enable = function() {
            parent_canvas.style.display = 'block';
            track_canvas.style.display = 'block';
        }

        this.demote = function() {
            track_canvas.hide();
            return;
        };

        this.promote = function() {
            if (this.visible()) {
                track_canvas.show();
            } else {
                track_canvas.hide();
            }
        };
        
        this.setDimensions = function(width,height) {
            parent_canvas.setAttribute('width',width);
            parent_canvas.setAttribute('height',height);
        };
        
    };

    var connectRenderer = function(renderer) {

        /**
         * Create a layer based controller for a group. Clicking on the nominated layer will animate out the expansion of the
         * group.
         * @param {Object} lay Layer to turn into a group controller
         * @param {Object} grp Group to be controlled by this layer.
         */
        
        var controller_map = {};
        var expanded_map = {};
        
        var old_remove_track = renderer.removeTrack;

        renderer.removeTrack = function(layer) {
            old_remove_track.call(this,layer);
            delete controller_map[layer.name];
            delete expanded_map[layer.name];
        };


        this.isController = function(layer) {
            if (controller_map[layer.name]) {
                return true;
            } else {
                return false;
            }
        };
        
        this.getController = function(group) {
            for (var lay in controller_map) {
                if (controller_map.hasOwnProperty(lay) && controller_map[lay] == group) {
                    return MASCP.getLayer(lay);
                }
            }
            return null;
        };
        
        this.isControllerExpanded = function(layer) {
            return expanded_map[layer.name];
        };
        
        renderer.createGroupController = function(lay,grp) {
            var layer = MASCP.getLayer(lay);
            var group = MASCP.getGroup(grp);

            if ( ! layer || ! group) {
                return;
            }

            if (controller_map[layer.name]) {
                return;
            }

            controller_map[layer.name] = group;
            
            expanded_map[layer.name] = false;
            
            var self = this;

            bean.add(layer,'removed',function(ev,rend) {
                self.setGroupVisibility(group);
            });

            bean.add(layer,'visibilityChange',function(rend,visible) {
                if (group.size() > 0) {            
                    self.setGroupVisibility(group, expanded_map[layer.name] && visible,true);
                    renderer.refresh();
                }
            });
            bean.add(group,'visibilityChange',function(rend,visible) {
                if (visible) {
                    self.showLayer(layer,true);
                    expanded_map[layer.name] = true;
                }
            });
            bean.remove(layer,'_expandevent')
            bean.add(layer,'_expandevent',function(ev) {
                expanded_map[layer.name] = ! expanded_map[layer.name];
                self.withoutRefresh(function() {
                    self.setGroupVisibility(group,expanded_map[layer.name]);
                });
                self.refresh(true);
            });
        };

        return DragAndDrop(function(track,before,after){
            var t_order = renderer.trackOrder;

            t_order.trackIndex = function(tr) {
                if (! tr ) {
                    return this.length;
                }
                return this.indexOf(tr.name);
            };
        
            if (after && ! before) {
                before = MASCP.getLayer(t_order[t_order.trackIndex(after) + 1]);
            }
        
            t_order.splice(t_order.trackIndex(track),1);
            var extra_to_push = [];
            if (controller_map[track.name]) {
                MASCP.getGroup(controller_map[track.name]).eachLayer(function(lay) {
                    if (MASCP.getGroup(lay) === lay) {
                        MASCP.getGroup(lay).eachLayer(arguments.callee);
                    }
                    if (t_order.trackIndex(lay) >= 0) {
                        extra_to_push = [t_order.splice(t_order.trackIndex(lay),1)[0]].concat(extra_to_push);
                    }
                });
            }
            if (before) {
                t_order.splice(t_order.trackIndex(before),1,track.name, before ? before.name : undefined );
                for (var i = 0; i < extra_to_push.length; i++ ) {
                    if (extra_to_push[i]) {
                        t_order.splice(t_order.trackIndex(before),0,extra_to_push[i]);
                    }
                }
            } else {
                renderer.hideLayer(track);
                MASCP.getLayer(track).disabled = true;                

                extra_to_push.forEach(function(lay) {
                    
                    renderer.hideLayer(lay);
                    MASCP.getLayer(lay).disabled = true;                    
                });
                t_order.push(track.name);
                t_order = t_order.concat(extra_to_push);
            }
        
            renderer.trackOrder = t_order;
        });
    };
    
    var DragAndDrop = function(spliceFunction) {    
        var targets = [];
        var in_drag = false, drag_el;
        
        var splice_before, splice_after, trackToSplice;
        
        var last_target;

        var timeouts = {};
        
        var nav_reset_set = null;

        var drag_func = function(handle,element,track,canvas) {
            var nav = this;

            var old_reset = nav.reset;
            if (nav_reset_set === null) {
                nav.reset = function() {
                    targets = [];
                    old_reset.call(this);
                };
                nav_reset_set = true;
            }
            var resetDrag = function() {
                window.clearTimeout(timeouts.anim);
                window.clearTimeout(timeouts.hover);
                for (var i = 0; i < targets.length; i++) {
                    if (targets[i] != drag_el) {
                        targets[i].removeAttribute('transform');
                        targets[i].setAttribute('pointer-events','all');
                    }
                }
            };
        
            targets.push(element);
            element.track = track;

            var single_touch_event = function(fn) {
                return function(e) {
                    if (e.touches && e.touches.length == 1) {
                        fn.call(this,e);
                    }
                };
            };

            var beginDragging = function(ev,tr,lbl_grp) {
            
                if (drag_disabled()) {
                    return;
                }

                var target = canvas.nearestViewportElement;

                if (in_drag) {
                    return;                
                }


                spliceBefore = null;
                spliceAfter = null;

                var p_orig = lbl_grp.nearestViewportElement.createSVGPoint();

                p_orig.x = ev.clientX || (window.pageXOffset + ev.touches[0].clientX);
                p_orig.y = ev.clientY || (window.pageYOffset + ev.touches[0].clientY);

                var rootCTM = lbl_grp.nearestViewportElement.getScreenCTM();
                var matrix = rootCTM.inverse();

                p_orig = p_orig.matrixTransform(matrix);

                var oX = p_orig.x;
                var oY = p_orig.y;

                var dragfn = function(e) {
                    var p = lbl_grp.nearestViewportElement.createSVGPoint();
                    p.x = e.clientX || (window.pageXOffset + e.touches[0].clientX);
                    p.y = e.clientY || (window.pageYOffset + e.touches[0].clientY);
                    p = p.matrixTransform(matrix);

                    var dX = (p.x - oX);
                    var dY = (p.y - oY);
                    var curr_transform = lbl_grp.getAttribute('transform') || '';
                    curr_transform = curr_transform.replace(/\s?translate\([^\)]+\)/,'');
                    curr_transform += ' translate('+dX+','+dY+') ';
                    curr_transform = curr_transform.replace(/\s*$/,'');
                    lbl_grp.setAttribute('transform',curr_transform);
                    targets.forEach(function(targ){
                        var bb = targ.getBBox();
                        if (bb.y < p.y && bb.y > (p.y - bb.height) && bb.x < p.x && bb.x > (p.x - bb.width)) {
                            el_move.call(targ,e,targ.track);
                        }
                    });
                    e.stopPropagation();
                    e.preventDefault();
                    return false;
                };
                if (touch_enabled) {
                    dragfn = single_touch_event(dragfn);
                }

                var enddrag = function(e) {
                    if (e.relatedTarget && (e.relatedTarget == lbl_grp || e.relatedTarget.nearestViewportElement == lbl_grp.nearestViewportElement || e.relatedTarget.nearestViewportElement == target)) {
                        if (in_drag && targets.indexOf(e.relatedTarget) >= 0) {                        
                            resetDrag();
                        }
                        return;
                    }

                    if (in_drag && (e.type == 'mouseup' || e.type == 'touchend')) {
                        if (spliceBefore || spliceAfter) {
                            spliceFunction(trackToSplice, spliceBefore, spliceAfter);
                        }
                    }
                    target.removeEventListener('touchmove',dragfn,false);
                    target.removeEventListener('mousemove',dragfn,false);
                    target.removeEventListener('touchend',arguments.callee,false);
                    target.removeEventListener('mouseup',arguments.callee,false);
                    target.removeEventListener('mouseout',arguments.callee,false);
                    if (in_drag) {
                        lbl_grp.setAttributeNS(null, 'pointer-events', 'all');
                        lbl_grp.removeAttribute('transform');
                        resetDrag();
                        in_drag = false;
                        last_target = null;
                    }
                };
                lbl_grp.setAttributeNS(null, 'pointer-events', 'none');
                lbl_grp.addEventListener('touchmove',dragfn,false);
                lbl_grp.addEventListener('touchend',enddrag,false);
                target.addEventListener('mousemove',dragfn,false);
                target.addEventListener('mouseup',enddrag,false);
                target.addEventListener('mouseout',enddrag,false);
            
                in_drag = track;
                drag_el = lbl_grp;
            };

            var handle_start = function(e) {
                beginDragging(e,track,element);
            };

            var el_move = function(e,trk) {
                var trck = trk ? trk : track;
                var elem = this ? this : element;
            
                if ( in_drag && in_drag != trck && trck != last_target) {
                    last_target = trck;
                    if (timeouts.hover) {
                        window.clearTimeout(timeouts.hover);
                    }
                    timeouts.hover = window.setTimeout(function() {
                        if ( (in_drag.group || trck.group) &&                    
                             (in_drag.group ? trck.group :  ! trck.group ) ) {
                            if (in_drag.group.name != trck.group.name) {
                                return;
                            }
                        } else {
                            if ( in_drag.group || trck.group ) {
                                return;
                            }
                        }

                        if (timeouts.anim) {
                            window.clearInterval(timeouts.anim);
                            timeouts.anim = null;
                        }
                    
                        resetDrag();
                    
                        var current_sibling = elem;
                    
                        var elements_to_shift = [];

                        while (current_sibling !== null) {
                            if (current_sibling != drag_el && targets.indexOf(current_sibling) >= 0) {
                                elements_to_shift.push(current_sibling);
                            }
                            current_sibling = current_sibling.nextSibling;
                            if (current_sibling == drag_el) {
                                break;
                            }
                        }
                    
                        current_sibling = elem.previousSibling;
                    
                        var elements_to_shift_up = [];
                    
                        while (current_sibling !== null) {
                            if (current_sibling != drag_el && targets.indexOf(current_sibling) >= 0) {
                                elements_to_shift_up.push(current_sibling);
                            }
                            current_sibling = current_sibling.previousSibling;
                            if (current_sibling == drag_el) {
                                break;
                            }
                        }
                        var anim_steps = 1;
                        var height = drag_el.getBBox().height / 4;
                        timeouts.anim = window.setInterval(function() {
                            var curr_transform, i = 0;
                        
                            if (anim_steps < 5) {
                                for (i = 0; i < elements_to_shift.length; i++ ) {
                                    curr_transform = elements_to_shift[i].getAttribute('transform') || '';
                                    curr_transform = curr_transform.replace(/\s?translate\([^\)]+\)/,'');
                                    curr_transform += ' translate(0,'+anim_steps*height+')';
                                    elements_to_shift[i].setAttribute('transform',curr_transform);
                                }

                                for (i = 0; (elements_to_shift.length > 0) && i < elements_to_shift_up.length; i++ ) {

                                    curr_transform = elements_to_shift_up[i].getAttribute('transform') || '';
                                    curr_transform = curr_transform.replace(/\s?translate\([^\)]+\)/,'');
                                    curr_transform += ' translate(0,'+anim_steps*-1*height+')';
                                    elements_to_shift_up[i].setAttribute('transform',curr_transform);
                                }


                                anim_steps += 1;
                            } else {
                                spliceBefore = trck;
                                trackToSplice = in_drag;
                                window.clearInterval(timeouts.anim);
                                timeouts.anim = null;
                            }
                        },30);

                    },300);
                }
            };
        
            handle.addEventListener('mousedown', handle_start,false);
            handle.addEventListener('touchstart',single_touch_event(handle_start),false);
        };

        var drag_disabled = function() {
            return drag_func.disabled;
        };

        drag_func.spliceFunction = spliceFunction;
        
        return drag_func;
    };

    var buildNavPane = function(back_canvas) {
        var self = this;
        var nav_width = 200+(touch_scale - 1)*100;
        var panel_back = back_canvas.group();
        var button_group = back_canvas.group();
        
        var rect = back_canvas.rect(-10,0,nav_width.toString(),'100%');
        var base_rounded_corner = [12*touch_scale,10*touch_scale];
        rect.setAttribute('rx',base_rounded_corner[0].toString());
        rect.setAttribute('ry',base_rounded_corner[1].toString());    
        if (! touch_enabled) {
            rect.setAttribute('opacity','0.8');
        }
        rect.style.stroke = '#000000';
        rect.style.strokeWidth = '2px';
        rect.style.fill = '#000000';
        rect.id = 'nav_back';

        panel_back.push(rect);

        var clipping = document.createElementNS(svgns,'clipPath');
        clipping.id = 'nav_clipping';
        var rect2 = document.createElementNS(svgns,'use');
        rect2.setAttributeNS('http://www.w3.org/1999/xlink','href','#nav_back');
    
        back_canvas.insertBefore(clipping,back_canvas.firstChild);
        clipping.appendChild(rect2);

        var close_group = back_canvas.crossed_circle(nav_width-(10 + touch_scale*11),(12*touch_scale),(10*touch_scale));

        close_group.style.cursor = 'pointer';
        if (typeof matchMedia !== 'undefined') {
            (this.win() || window).matchMedia('print').addListener(function(match) {
                if (match.matches) {
                    close_group.setAttribute('display','none');
                    tracks_button.setAttribute('display','none');
                } else {
                    close_group.setAttribute('display','block'); 
                    tracks_button.setAttribute('display','none');
                }
            });
        }

        button_group.push(close_group);

        var tracks_button = MASCP.IE ? back_canvas.svgbutton(10,5,65,25,'Edit') : back_canvas.button(10,5,65,25,'Edit');
        tracks_button.id = 'controls';
        tracks_button.parentNode.setAttribute('clip-path','url(#nav_clipping)');

        panel_back.push(MASCP.IE ? tracks_button : tracks_button.parentNode);

        tracks_button.addEventListener('click',function() {
            bean.fire(self,'toggleEdit');
            bean.fire(self,'click');
        },false);
    

        panel_back.setAttribute('style','transition: all 0.25s;');

        var old_tracks_style = tracks_button.getAttribute('style');
        var transform_origin = ""+(nav_width-(10 + touch_scale*11))+"px "+(12*touch_scale)+"px;";
        var transform_origin_statement = " -webkit-transform-origin: "+transform_origin+" -ms-transform-origin: "+transform_origin+" -moz-transform-origin: "+transform_origin+" transform-origin: "+transform_origin;
        var translate = function(amount,rotate) {
            var trans = " translate3d("+amount+"px,0px,0px)";
            if (rotate) {
                trans = trans + " rotate("+rotate+")";
            }
            return "-webkit-transform:"+trans+"; -moz-transform:"+trans+"; -ms-transform:"+trans.replace('3d','').replace(',0px)',')')+"; transform: "+trans+";";
        };


        tracks_button.setAttribute('style',old_tracks_style+" transition: all 0.25s;");
        close_group.setAttribute('style',"transition: all 0.25s; "+transform_origin_statement);

        var visible = true;

        
        var toggler = function(vis,interactive) {
            visible = ( vis === false || vis === true ) ? vis : ! visible;
            var close_transform;
            var needs_transition = interactive ? "transition: all ease-in-out 0.4s;" : "";

            if (visible) {
                self.promote();
                panel_back.setAttribute('visibility','visible');
                panel_back.setAttribute('style',needs_transition+translate(0));
                tracks_button.setAttribute('style',old_tracks_style + " "+needs_transition);


                close_group._button.removeAttribute('filter');
                if ("ontouchend" in window || window.getComputedStyle(close_group).getPropertyValue("-ms-transform")) {
                    close_transform = close_group.getAttribute('transform') || ' ';
                    close_transform = close_transform.replace(/translate\(.*\)/,'');
                    close_transform = close_transform.replace(/rotate\(.*\)/,'');
                    close_group.setAttribute('transform',close_transform);
                }
                close_group.setAttribute('style',needs_transition+translate(0)+transform_origin_statement);
                self.refresh();
            } else {
                self.demote();

                close_group._button.setAttribute('filter','url(#drop_shadow)');            
                close_group.setAttribute('style',needs_transition+transform_origin_statement+translate(-0.75*nav_width,"405deg"));
                if ("ontouchend" in window || window.getComputedStyle(close_group).getPropertyValue("-ms-transform")) {
                    close_transform = close_group.getAttribute('transform') || ' ';
                    close_transform = close_transform + ' translate('+-0.75*nav_width+',0) rotate(45,'+(nav_width-(10 + touch_scale*11))+','+(12*touch_scale)+') ';
                    close_group.setAttribute('transform',close_transform);
                    panel_back.setAttribute('visibility','hidden');
                } else {
                    panel_back.setAttribute('style',needs_transition+translate(-1*nav_width));
                    tracks_button.setAttribute('style',old_tracks_style + " "+needs_transition+translate(-1*nav_width));
                }
            }
            return true;
        };
    
        self.hide = function(interactive) {
            toggler.call(this,false,interactive);
        };
        self.show = function(interactive) {
            toggler.call(this,true,interactive);
        };

        self.visible = function() {
            return visible;
        };

        self.setZoom = function(zoom) {
            close_group.setAttribute('transform','scale('+zoom+','+zoom+') ');
            rect.setAttribute('transform','scale('+zoom+',1) ');
            rect.setAttribute('ry', (zoom*base_rounded_corner[1]).toString());
            self.refresh();
        };

        close_group.addEventListener('click',function() {
            if (visible) {
                self.hide(true);
            } else {
                self.show(true);
            }
        },false);
    };

    var buildTrackPane = function(track_canvas,draganddrop) {
        var self = this;

        var close_buttons, controller_buttons, edit_enabled;

        var nav_width_track_canvas_ctm = 0;

        SVGCanvas(track_canvas);
        track_canvas.setAttribute('preserveAspectRatio','xMinYMin meet');



        var track_rects = [];

        self.reset = function() {
            while (track_canvas.firstChild) {
                track_canvas.removeChild(track_canvas.firstChild);
            }
            track_rects = [];
            ctm_refresh = [];
//            self.refresh();
        };

        var ctm_refresh = [];

        self.isEditing = function() {
            return edit_enabled;
        };

        self.refresh = function() {
            (close_buttons || []).forEach(function(button) {
                button.setAttribute('visibility', edit_enabled ? 'visible' : 'hidden');
            });
            (controller_buttons || []).forEach(function(button) {
                button.setAttribute('visibility', edit_enabled ? 'hidden' : 'visible');
            });
            if (edit_enabled) {
                toggleMouseEvents.call(this,true);
            } else {
                toggleMouseEvents.call(this,false);
            }

            if (track_canvas.getAttribute('display') == 'none' || track_canvas.style.display == 'none') {
                return;
            }

            var ctm = document.getElementById('nav_back').getTransformToElement(track_canvas);
            var back_width = (document.getElementById('nav_back').getBBox().width + document.getElementById('nav_back').getBBox().x);
            var point = track_canvas.createSVGPoint();
            point.x = back_width;
            point.y = 0;
            nav_width_track_canvas_ctm = point.matrixTransform(ctm).x;
            ctm_refresh.forEach(function(el) {
                var width = 0;
                try {
                    width = el.getBBox().width;
                } catch (err) {
                    // This is a bug with Firefox on some elements getting
                    // the bounding box. We silently fail here, as I can't
                    // figure out why the call to getBBox fails.
                }
                if ( width > 0) {
                    var a_y = /translate\((-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)\)/.exec(el.getAttribute('transform') || '');
                    if (typeof a_y != 'undefined') {
                        a_y = a_y[2];
                    } else {
                        return;
                    }
                    
                    var new_x = nav_width_track_canvas_ctm- 1.5*parseInt(el.getAttribute('width'),10);
                    el.setAttribute('transform','translate('+new_x+','+a_y+')');
                }
            });
        };

        var toggleMouseEvents = function(on) {
            if (track_rects) {
                (track_rects || []).forEach(function(el) {
                    el.setAttribute('opacity',on ? '1': (touch_enabled ? "0.5" : "0.1") );
                    el.setAttribute('pointer-events', on ? 'all' : 'none');
                });
            }
        };

        bean.add(self,'toggleEdit',function() {
            edit_enabled = typeof edit_enabled == 'undefined' ? true : ! edit_enabled;
            draganddrop.disabled = ! edit_enabled;
            toggleMouseEvents.call(self,edit_enabled);
        
            self.hide();
            self.show();
            
            (close_buttons || []).forEach(function(button) {
                button.setAttribute('visibility', edit_enabled ? 'visible' : 'hidden');
            });
            (controller_buttons || []).forEach(function(button) {
                button.setAttribute('visibility', edit_enabled ? 'hidden' : 'visible');
            });

        });
        
        this.setViewBox = function(viewBox) {
            track_canvas.setAttribute('viewBox',viewBox);
        };
    
        track_canvas.style.height = '100%';
        track_canvas.style.width = '100%';
        track_canvas.setAttribute('height','100%');        
        track_canvas.setAttribute('width','100%');


        this.renderTrack = function(track,y,height,options) {
            var label_group = track_canvas.group();
            var a_rect = track_canvas.rect(0,y,'100%',height);
            a_rect.setAttribute('stroke','#000000');
            a_rect.setAttribute('stroke-width','2');
            a_rect.setAttribute('fill','url(#simple_gradient)');
            a_rect.setAttribute('opacity',touch_enabled ? '0.5' : '0.1');
            a_rect.setAttribute('pointer-events','none');
            track_rects = track_rects || [];
        
            track_rects.push(a_rect);
        
            label_group.push(a_rect);

            // Use these for debugging positioning
        
            // var r = track_canvas.rect(0,y-height,height,height);
            // r.setAttribute('fill','#ff0000');
            // label_group.push(r);
            // 
            // r = track_canvas.rect(0,y+height,height,height);
            // r.setAttribute('fill','#ff0000');
            // label_group.push(r);
        
        
            var text_scale = (options && options['font-scale']) ? options['font-scale'] : 1;
            var text_left = 4/3*touch_scale*height*text_scale;            
            var a_text = track_canvas.text(text_left,y+0.5*height,track.fullname);
            a_text.setAttribute('height', height);
            a_text.setAttribute('width', height);
            a_text.setAttribute('font-size',0.6*height*text_scale);
            a_text.setAttribute('fill','#ffffff');
            a_text.setAttribute('stroke','#ffffff');
            a_text.setAttribute('stroke-width','0');
            a_text.firstChild.setAttribute('dy', '0.5ex');

            // r = track_canvas.rect(3*height*text_scale,y+0.5*height,2*height,2*height);
            // r.setAttribute('fill','#00ff00');
            // label_group.push(r);

            label_group.push(a_text);
        
            a_text.setAttribute('pointer-events','none');
        
            var circ;
        
            if (track.href ) {
                a_anchor = track_canvas.a(track.href);
                var icon_name = null;
                var icon_metrics = [0.5*height*text_scale,0,height*text_scale*touch_scale];
                icon_metrics[1] = -0.5*(icon_metrics[2] - height);

                circ = track_canvas.circle(icon_metrics[0]+0.5*icon_metrics[2],0.5*height,0.5*icon_metrics[2]);
                circ.setAttribute('fill','#ffffff');
                circ.setAttribute('opacity','0.1');
                a_anchor.appendChild(circ);
            
                var url_type = track.href;
                if (typeof url_type === 'string' && url_type.match(/^javascript\:/)) {
                    icon_name = '#plus_icon';
                } else if (typeof url_type === 'function') {
                    icon_name = '#plus_icon';
                    a_anchor.setAttribute('href','#');
                    a_anchor.removeAttribute('target');
                    a_anchor.addEventListener('click',function(e) {
                        url_type.call();

                        if (e.preventDefault) {
                            e.preventDefault();
                        } else {
                            e.returnResult = false;
                        }
                        if (e.stopPropagation) {
                            e.stopPropagation();
                        } else {
                            e.cancelBubble = true;
                        }

                        return false;
                    },false);
                } else {
                    icon_name = '#new_link_icon';
                }
                if (track.icon) {
                    icon_name = track.icon;
                }
                var a_use = track_canvas.use(icon_name,icon_metrics[0],icon_metrics[1],icon_metrics[2],icon_metrics[2]);
                a_use.style.cursor = 'pointer';
                a_anchor.appendChild(a_use);
                a_anchor.setAttribute('transform','translate('+(nav_width_track_canvas_ctm - 1.5*icon_metrics[2])+','+y+')');
                a_anchor.setAttribute('width',icon_metrics[2].toString());
                ctm_refresh.push(a_anchor);
            }
        
            label_group.addEventListener('touchstart',function() {
                label_group.onmouseover = undefined;
                label_group.onmouseout = undefined;
            },false);

            label_group.addEventListener('touchend',function() {
                label_group.onmouseover = undefined;
                label_group.onmouseout = undefined;
            },false);
        
            draganddrop.call(this,a_rect,label_group,track,track_canvas);
        
            (function() {
            
                if (track.group) {
                    return;
                }
            
                var t_height = 0.5*height*touch_scale;            

                if ( ! close_buttons) {
                    close_buttons = [];
                }
            
                var closer = track_canvas.crossed_circle(1.5*t_height,0,t_height);
                closer.setAttribute('transform','translate(0,'+(y+0.5*height)+') scale('+text_scale+')');
                closer.firstChild.setAttribute('fill','url(#red_3d)');
                for (var nodes = closer.childNodes, i = 0, len = nodes.length; i < len; i++) {
                    nodes[i].setAttribute('stroke-width',(t_height/4).toString());
                }
                closer.addEventListener('click',function() {
                    draganddrop.spliceFunction(track);
                },false);
                label_group.push(closer);
                close_buttons.push(closer);
                closer.setAttribute('visibility', 'hidden');
            
            })();
            if (this.isController(track)) {
                if ( ! controller_buttons) {
                    controller_buttons = [];
                }

                var t_height = 0.5*height*touch_scale;
                var expander = track_canvas.group();
                circ = track_canvas.circle(1.5*t_height,0,t_height);
                circ.setAttribute('fill','#ffffff');
                circ.setAttribute('opacity','0.1');
                expander.push(circ);

                var t_metrics = [1.1*t_height,-1.25*t_height,2.25*t_height,(-0.5*t_height),1.1*t_height,0.25*t_height];
            
                t_metrics[1] += 0.5*(t_height - 0*height);
                t_metrics[3] += 0.5*(t_height - 0*height);
                t_metrics[5] += 0.5*(t_height - 0*height);

            
                var group_toggler = track_canvas.poly(''+t_metrics[0]+','+t_metrics[1]+' '+t_metrics[2]+','+t_metrics[3]+' '+t_metrics[4]+','+t_metrics[5]);
                if (this.isControllerExpanded(track)) {
                    expander.setAttribute('transform','translate(0,'+(y+0.5*height)+') scale('+text_scale+') rotate(90,'+(1.5*t_height)+','+t_metrics[3]+')');
                } else {
                    expander.setAttribute('transform','translate(0,'+(y+0.5*height)+') scale('+text_scale+')');
                }
                group_toggler.setAttribute('height', 1.75*t_height);
                group_toggler.setAttribute('font-size',1.5*t_height);
                group_toggler.setAttribute('fill','#ffffff');
                group_toggler.setAttribute('pointer-events','none');
            
                expander.push(group_toggler);

                expander.style.cursor = 'pointer';
                expander.addEventListener('click',function(e) {
                    e.stopPropagation();
                    bean.fire(track,'_expandevent');
                    if (self.isControllerExpanded(track)) {
                        expander.setAttribute('transform','translate(0,'+(y+0.5*height)+') scale('+text_scale+') rotate(90,'+(1.5*t_height)+','+t_metrics[3]+')');                
                    } else {
                        expander.setAttribute('transform','translate(0,'+(y+0.5*height)+') scale('+text_scale+')');
                    }
                },false);
                label_group.push(expander);

                controller_buttons.push(expander);
                expander.setAttribute('visibility', 'hidden');
            }
        };
    };

    return Navigation;
})();// Copyright Hiren Joshi - tobe LGPLed
/**
 * @fileoverview    Tag visualisation class
 * @author          hirenj
 */

if ( typeof(MASCP) == 'undefined' ) {
    MASCP = {};
}

/**

*/
if ( typeof(MASCP.TagVisualisation) == 'undefined' ) {
    MASCP.TagVisualisation = {};
}

/**
 * MASCP.TagVisualisation. Provides a set of visualisations which can be used
 * to render tables of tags.
 * e.g:
 *
 * <pre>
 * ***************************************
 * * Row *  Surname * Number of children *
 * ***************************************
 * *  1  *  Smith   *   25               *
 * *  2  *  Jones   *   12               *
 * *  3  *  Wesson  *   8                *
 * ***************************************
 * </pre>
 * 
 * This javascript will replace this table with a tag cloud, and set the sizes
 * of each of the tags (in this case Surname would be appropriate to use) to
 * correspond to the number of children.
 *
 * It is important the markup for the table contain thead and tbody elements, 
 * as these are required to distinguish between header and data sections within
 * the table.
 * 
 * <h3>Usage</h3>
 * <pre>
 *  var tagvis;
 *  tagvis = new MASCP.TagVisualisation("table_identifier",[MASCP.TagVisualisation.TagCloud]);
 *
 *  // Set the tag column to 2
 *  tagvis.tagColumn = 2;
 *
 *  // Optionally set the tagFactory method to return A elements instead of SPANS
 *  foobar.visualisations[0].tagFactory = function(tagId,tag,row) {
 *      var md = MochiKit.DOM;
 *      var tagEl = md.A({ "id" : MASCP.TagVisualisation.TagCloud.TAG_ELEMENT_ID_PREFIX+tagId
 *                  }, tag);
 *      return tagEl;
 *  };
 *
 *  // Call an update on the visualisation, using data column 1
 *  foobar.visualisations[0].update(1);
 * </pre>
 *
 * @param {String} datasetName The id of the table containing the dataset.
 * @param {Class[]} visClasses The classes of the visualisations to be used in this visualiser
 * @constructor 
 */
MASCP.TagVisualisation = function(datasetName,visClasses) {
    this.datasetName = datasetName;
    this._buildRichTableView(visClasses);
    
};

MASCP.TagVisualisation.prototype = {
    __class__: MASCP.TagVisualisation,
    /** The visualisations
     *  @type Visualisation[]
     */
    visualisations: null,
    /** The id of the element used for data
     * @type String
     */
    datasetName: "",
    /** The column number in the data set for tag names
     *  @type int
     */
    tagColumn: ""
};

MASCP.TagVisualisation.prototype._buildRichTableView = function(visClasses) {
    var datasetName = this.datasetName;
    var dataTable = document.getElementById(datasetName);
    if (dataTable.getAttributeNS) {
        var newColumn = parseInt(dataTable.getAttributeNS("MASCP.TagVisualisation","tagcolumn"),10);
        this.tagColumn = newColumn ? newColumn : this._getTagColumn();
    } else {
        this.tagColumn = this._getTagColumn();
    }
    var dataTableContainer = dataTable.parentNode;
    var containingElement = null;

    // Place the Table element within a containing DIV
    // just in case it's not in one already
    // containingElement will then contain a sized div
    // which is the dataTableContainer. The dataTableContainer
    // contains the table itself.
    
    if (dataTableContainer.nodeName == "BODY") {
        containingElement = dataTableContainer;
        var container_div = document.createElement('div');
        dataTable.parentNode.replaceChild(container_div,dataTable);     
        container_div.appendChild(dataTable);
        dataTableContainer = dataTable.parentNode;
    } else {
        containingElement = dataTableContainer.parentNode;
    }

    this._dataTableContainer = dataTableContainer;

    var richDiv = this._buildRichTagInfoContainer(dataTableContainer);
    containingElement.insertBefore( richDiv, dataTableContainer);   
    this._displayElement = richDiv;

    for (var i = 0; i < visClasses.length; i++ ) {
        this.addVisualisation(new visClasses[i](this));
    }
    // Hide away the existing table
    dataTable.old_style = dataTable.style.display;
    dataTable.style.display = "none";
    
};

MASCP.TagVisualisation.prototype._getDisplayWidth = function(el) {
    var computedStyle;

    // If the default method of obtaining the
    // computed style works, use that
    if ( window.getComputedStyle !== undefined ) {
        computedStyle = getComputedStyle(el,"");

    // We need to use a different method to get the computed style
    // from Safari
    } else if (document.defaultView.getComputedStyle !== undefined) {
        computedStyle = document.defaultView.getComputedStyle(el,"");
    }

    // Use a default width just in case we can't find a computed style
    if (computedStyle !== undefined) {
        return parseInt(computedStyle.getPropertyValue("width").replace(/px/, ""),10); 
    } else {
        return undefined;
    }
};

MASCP.TagVisualisation.prototype._buildRichTagInfoContainer = function(currentElement) {
    var a_div = document.createElement('div');
    a_div.setAttribute('id', "rich_"+this.datasetName );
    a_div.setAttribute('class', "rich_as_data "+currentElement.className );
    a_div.style.width = currentElement.style.width;
    a_div.style.height = currentElement.style.height;
    a_div.style.display = currentElement.style.display;
    a_div.style.position = currentElement.style.position;
    return a_div;
};

/**
 * Toggle the usage of this visualisation. Returns the original 
 * table to the data flow if has been hidden.
 */
MASCP.TagVisualisation.prototype.toggleTagView = function() {
    var dataTable = document.getElementById(this.datasetName);
    if ( dataTable.style.display == "none" ) {
        dataTable.style.display = dataTable.old_style;
        this.getDisplayElement().style.display = "none";
    } else {
        dataTable.style.display = "none";
        this.getDisplayElement().style.display = "block";       
    }
};

/**
 * Returns the element in the document which act as the container to the visualisation
 * @return {HTMLElement} Container element
 */
MASCP.TagVisualisation.prototype.getDisplayElement = function() {
    return this._displayElement;
};

/**
 * Add a visualisation to the visualiser
 * @param Visualisation (such as instance of TagCloud)
 */
MASCP.TagVisualisation.prototype.addVisualisation = function(visObject) {
    if ( ! this.visualisations ) {
        this.visualisations = [];
    }
    this.getDisplayElement().appendChild(visObject.getDisplayElement());
    this.visualisations.push(visObject);
};
/**
 * Get all the tags found in this data set
 * @return {String[]} Array of tag names
 */
MASCP.TagVisualisation.prototype.getAllTags = function() {
    var dataTable = document.getElementById(this.datasetName);
    var tableRows = dataTable.getElementsByTagName("tbody")[0].getElementsByTagName("tr");
    var maxValue = 0;

    var alltags = {};

    for ( var i = 0; i < tableRows.length ; i++ ) {
        tagname = tableRows[i].getElementsByTagName("td")[this.tagColumn].childNodes[0].data;
        alltags[tableRows[i].id] = tagname;
    }
    return alltags;
};

MASCP.TagVisualisation.prototype._getTagColumn = function() {
    var dataTable = document.getElementById(this.datasetName);
    var headers = dataTable.getElementsByTagName("thead")[0].getElementsByTagName("tr")[0].getElementsByTagName("th");
    for ( var i = 0; i < headers.length ; i++ ) {
        if ( headers[i].childNodes[0].data.toLowerCase() == "tag" ) {
            return i;
        }
    }
    return 1;
};
MASCP.TagVisualisation.prototype._getColumnCount = function() {
    var dataTable = document.getElementById(this.datasetName);
    var headers = dataTable.getElementsByTagName("thead")[0].getElementsByTagName("tr")[0].getElementsByTagName("th");
    return (headers.length - this._getTagColumn() - 1);
};

/**
 * MASCP.TagVisualisation::TagCloud class
 * @class
 */
if ( typeof(MASCP.TagVisualisation.TagCloud) === undefined ) {
    MASCP.TagVisualisation.TagCloud = {};
}

/**
 * Create a new TagCloud visualisation
 * @param {TagVisualiser} tagVisualiser The TagVisualiser object to attach this visualisation to
 * @constructor 
 */
MASCP.TagVisualisation.TagCloud = function(tagVisualiser) {
    this._tagVisualiser = tagVisualiser;
    this._initElements();
};

MASCP.TagVisualisation.TagCloud.prototype = {
    __class__: MASCP.TagVisualisation.TagCloud
};
/**
 * Class appended to the element which contains the tags. Defaults to "rich_tagcloud"
 */
MASCP.TagVisualisation.TagCloud.ELEMENT_CSS_CLASS = "rich_tagcloud";
/**
 * Prefix appended to the id of the element which contains the tags. Defaults to "rich_tagcloud_"
 */
MASCP.TagVisualisation.TagCloud.ELEMENT_ID_PREFIX = "rich_tagcloud_";
/**
 * Class appended to the tag element. Defaults to "rich_tagcloud_tag"
 */
MASCP.TagVisualisation.TagCloud.TAG_ELEMENT_CSS_CLASS = "rich_tagcloud_tag";
/**
 * Prefix appended to the id of the tag element. Defaults to "rich_tagcloud_tag_"
 */
MASCP.TagVisualisation.TagCloud.TAG_ELEMENT_ID_PREFIX = "rich_tagcloud_tag_";

MASCP.TagVisualisation.TagCloud.prototype._initElements = function() {
    this._displayElement = document.createElement('div');
    this._displayElement.setAttribute("id",MASCP.TagVisualisation.TagCloud.ELEMENT_ID_PREFIX+this._tagVisualiser.datasetName);
    this._displayElement.setAttribute("class",MASCP.TagVisualisation.TagCloud.ELEMENT_CSS_CLASS);
    return this._displayElement;
};

/**
 * Get the element used to contain the tags
 * @return {HTMLElement} Generated element acting as tag container
 */
MASCP.TagVisualisation.TagCloud.prototype.getDisplayElement = function() {
    return this._displayElement;
};

/**
 * Update this visualisation using the given data column number, which is an offset
 * from the base of the tag column number.
 * @param {int} dataColumn Data column offset (e.g. 1 for the next column after the tag column)
 */
MASCP.TagVisualisation.TagCloud.prototype.update = function(dataColumn) {
    var container = this.getDisplayElement();
    var dataTable = document.getElementById(this._tagVisualiser.datasetName);
    var values = {};
    var all_values = {};
    var tableRows = dataTable.getElementsByTagName("tbody")[0].getElementsByTagName("tr");
    var maxValue = 0;

    var alltags = [];
    var i;
    for (i = 0; i < tableRows.length ; i++ ) {
        var row_values = tableRows[i].getElementsByTagName("td"); 
        var value = parseFloat(row_values[this._tagVisualiser.tagColumn+dataColumn].childNodes[0].data);
        if (row_values[this._tagVisualiser.tagColumn].childNodes.length === 0) {
            continue;
        }
        var tagname = row_values[this._tagVisualiser.tagColumn].childNodes[0].data;
        values[tagname] = value;
        all_values[tagname] = row_values;
        maxValue = Math.max(maxValue,value);
        alltags[i] = tagname;
    }
    alltags.sort();
    for (i = 0; i < alltags.length; i++ )  {
        var tag = alltags[i];
        if ( ! tag ) {
            continue;
        }
        var tagId = tag.replace(/\s+/,"_");
        var tagSpan;
        if ( document.getElementById(MASCP.TagVisualisation.TagCloud.TAG_ELEMENT_ID_PREFIX+tagId) !== null ) {
            tagSpan = document.getElementById(MASCP.TagVisualisation.TagCloud.TAG_ELEMENT_ID_PREFIX+tagId);
            tagSpan.parentNode.removeChild(tagSpan);
        }

        tagSpan = this.tagFactory(tagId,tag,all_values[tag]);
        container.appendChild(tagSpan);

        var fontsize = Math.floor(30 * Math.log(1.5 + (values[tag] / maxValue)));
        tagSpan.style.fontSize = fontsize+"px";
        tagSpan.setAttribute('class',  MASCP.TagVisualisation.TagCloud.TAG_ELEMENT_CSS_CLASS );
    }
    if ( ! container.hasSpacer ) {
        var a_div = document.createElement('div');
        a_div.setAttribute('class','spacer');
        a_div.setAttribute('style','width: 100%; height: 0px; clear: both;');
        container.appendChild(a_div);
        container.hasSpacer = true;
    }
};
/**
 * Factory method for creating tags. Override this method to specify your own tags
 * @param {String}          tagId       Identifier for the new element
 * @param {String}          tag         The actual tag to be displayed
 * @param {HTMLElement[]}   row         The full data row (from the table) for this tag  
 */
MASCP.TagVisualisation.TagCloud.prototype.tagFactory = function(tagId,tag,row) {
    var a_span = document.createElement('span');
    a_span.setAttribute('id', MASCP.TagVisualisation.TagCloud.TAG_ELEMENT_ID_PREFIX+tagId );
    a_span.textContent = tag;
    return a_span;
};
/**
 *  @fileOverview   Basic classes and defitions for a Gene Ontology ID based map
 */


if ( typeof GOMap == 'undefined' ) {
 /**
  *  @namespace GOMap namespace
  */
  GOMap = {};
}

 /* 
  * Convenience environment detection – see if the browser is Internet Explorer and set variables to mark browser
  * version.
  */
 (function() {
  var ie = (function(){

      var undef,
          v = 3,
          div = document.createElement('div'),
          all = div.getElementsByTagName('i');

          do {
              div.innerHTML = '<!--[if gt IE ' + (++v) + ']><i></i><![endif]-->';
          } while (all[0]);

      return v > 4 ? v : undef;

  }());
  if (ie) {
      if (ie === 7) {
          GOMap.IE = true;
          GOMap.IE7 = true;
      }
      if (ie === 8) {
          GOMap.IE = true;
          GOMap.IE8 = true;
      }
  }
 })();


/*
 *  Include the svgweb library when we include this script. Set the SVGWEB_PATH environment variable if
 *  you wish to retrieve svgweb from a relative path other than ./svgweb/src
 */
if (GOMap.IE && (typeof svgweb === 'undefined') && (typeof SVGWEB_LOADING === 'undefined') && ! window.svgns ) {

    var svg_path = 'svgweb/';
    if (typeof SVGWEB_PATH != 'undefined') {
        svg_path = SVGWEB_PATH;
    }
    var scriptTag = document.createElement("script");
    scriptTag.src = svg_path + 'svg.js';
    scriptTag.type="text/javascript";
    scriptTag.setAttribute('data-path',svg_path);
    document.getElementsByTagName("head")[0].insertBefore(scriptTag, document.getElementsByTagName("head")[0].firstChild);

    SVGWEB_LOADING = true;
}

/** Convenience logging function. If there is no log function defined, add a log method that simply
 *  forwards the message on to the console.log.
 *  @function
 *  @param  {Object}    message Message to log
 */
log = (typeof log == 'undefined') ? (typeof console == 'undefined') ? function() {} : function(msg) {    
    if (typeof msg == 'String' && arguments.length == 1) {
        console.log("%s", msg);
    } else {
        console.log("%o: %o", msg, this);
    }
    return this;
} : log ;


// shim layer with setTimeout fallback
window.requestAnimFrame = (function(){
return  window.requestAnimationFrame       || 
        window.webkitRequestAnimationFrame || 
        window.mozRequestAnimationFrame    || 
        window.oRequestAnimationFrame      || 
        window.msRequestAnimationFrame     || 
        function(/* function */ callback, /* DOMElement */ element){
          window.setTimeout(callback, 1000 / 60);
        };
})();


if (window.attachEvent) { //&& svgweb.getHandlerType() == 'flash') {
    window.onload = function() {
        GOMap.LOADED = true;
    };
} else {
    GOMap.LOADED = true;
}


/**
 * @class       A diagram that can be marked up with keywords.
 * @param       image   Image to be used for the diagram. Either an url to an svg file, an existing object element with a src attribute, or a reference to an SVG element if the SVG has been inlined.
 * @param       params  Params to be passed into initialisation. Possible values include 'load', which is a function to be executed when the diagram is loaded.
 * @author      hjjoshi
 * @requires    svgweb
 */
GOMap.Diagram = function(image,params) {
    if (image === null) {
        return;
    }
    this._highlighted = {};
    this._styles_cache = {};
    this.enabled = true;

    var self = this;
    
    var url = null;
    if (typeof image == 'string') {
        url = image;
        image = null;
    } else if (image.nodeName && image.nodeName.toLowerCase() == 'object') {
        url = image.getAttribute('src') || image.getAttribute('data');
    } else if (image.nodeName && image.nodeName.toLowerCase() == 'svg') {        
        (function() {
            if ( ! GOMap.LOADED ) {
                window.attachEvent('onload',arguments.callee);
                return;
            }
            self._container = image.parentNode;
            self.element = image;
            self._svgLoaded();
            self.loaded = true;
            if (params.load) {
                params.load.apply(self);
            }
            if ( self.onload ) {
                self.onload.apply(self);
            }
        })();
        return;
    }

    this.element = document.createElement('object',true);
    
    this.element.setAttribute('data',url);
    this.element.setAttribute('type','image/svg+xml');
    this.element.setAttribute('width','100%');
    this.element.setAttribute('height','100%');
    this.element.setAttribute('style','background: transparent;');
    
    if ( ! this.element.addEventListener ) {
        this.element.addEventListener = function(ev,func) {
            this.attachEvent(ev,func);
        };
    }

    var has_svgweb = typeof svgweb != 'undefined';

    this.element.addEventListener(has_svgweb ? 'SVGLoad' : 'load',function() {
        var object_el = this;
        if (! this.nodeName) {
            console.log("The SVG hasn't been loaded properly");
            return;
        }
        if (object_el.contentDocument !== null) {
            self.element = object_el.contentDocument.rootElement;
        } else {
            self.element = object_el.getAttribute('contentDocument').rootElement;
        }
        
        // Make the destroy function an anonymous function, so it can access this new
        // element without having to store it in a field
        
        var svg_object = object_el;
        self.destroy = function() {
            if ( svg_object && svg_object.parentNode) {
                if (typeof svgweb != 'undefined') {
                    svgweb.removeChild(svg_object, svg_object.parentNode);
                } else {
                    svg_object.parentNode.removeChild(svg_object);
                }
            }
        };

        self._svgLoaded();

        self.loaded = true;
        if (params.load) {
            params.load.apply(self);
        }
        if ( self.onload ) {
            self.onload.apply(self);
        }

    },false);

    if (image) {
        this.appendTo(image.parentNode);
        image.parentNode.removeChild(image);
    }
};

/**
 * Retrieve the SVG element for this diagram
 * @returns SVG element used to render the diagram
 * @type Element
 */

/**
 * Append this diagram to the given parent node
 * @param {Element} parent Parent node to append this element to
 */
GOMap.Diagram.prototype.appendTo = function(parent) {
    this._container = parent;
    if (typeof svgweb != 'undefined') {
        svgweb.appendChild(this.element,parent);
    } else {
        parent.appendChild(this.element);
    }
    return this;
};


/**
 * Highlight a given keyword on the diagram
 * @param {String} keyword  GO keyword to highlight
 * @param {String} color    CSS color string to use as the highlighting colour. Defaults to #ff0000.
 * @returns True if keyword is found, False if keyword is not in map
 * @type Boolean
 */
GOMap.Diagram.prototype.showKeyword = function(keyword,color) {
    var els = this._elementsForKeyword(keyword);
    
    if (els.length === 0) {
        return false;
    }
    
    if (this._highlighted[keyword] && ! color) {
        return true;
    }
    
    color = color || '#ff0000';
    
    this._highlighted[keyword] = true;

    for (var i = 0; i < els.length; i++ ) {
        els[i]._highlighted = els[i]._highlighted || {};
        els[i]._highlighted[color] = true;
        if (els[i].nodeName == 'path' || els[i].nodeName == 'circle' || els[i].nodeName == 'ellipse') {
            this._outlineElement(els[i]);
        }
    }
    var self = this;
    this._recurse(els, function(el) {
        self._highlightElement(el);
        return true;
    });
    
    return true;
};

/**
 * Set the viewport for the image to be centered around a single keyword. This method picks the first
 * group element matching the keyword, and modifies the viewBox attribute to center around that group
 * only. Using currentTranslate/currentScale yields unpredictable results, so viewBox manipulation has
 * to be performed.
 * @param {String} keyword Keyword to zoom in to
 */
GOMap.Diagram.prototype.zoomToKeyword = function(keyword) {
    var self = this;
    var root = this.element;
    
    var els = this._elementsForKeyword(keyword);
    var targetEl = null;
    for (var i = 0; i < els.length; i++ ) {
        if (els[i].nodeName == 'g') {
            targetEl = els[i];
            break;
        }
    }
    if ( ! targetEl ) {
        if (root._baseViewBox) {
            root.setAttribute('viewBox',root._baseViewBox);
        }
        return;
    }
    
    if (! targetEl.getBBox) {
        return;
    }
    
    var bbox = targetEl.getBBox();    
    var root_bbox = root.getBBox();
    
    if ( ! root._baseViewBox) {
        root._baseViewBox = root.getAttribute('viewBox');
    }
    var location = [bbox.x-10,bbox.y-10,bbox.width+20,bbox.height+20];
    root.setAttribute('viewBox',location.join(' '));
};

/**
 * Hide all the keywords currently being highlighted on this diagram
 */
GOMap.Diagram.prototype.hideAllKeywords = function() {    
    for (var key in this._highlighted) {
        if (this._highlighted.hasOwnProperty(key)) {
            this.hideKeyword(key);
        }
    }
};

/**
 * Hide a given keyword on the diagram
 * @param {String} keyword  GO keyword to turn highlighting off for
 */
GOMap.Diagram.prototype.hideKeyword = function(keyword,color) {
    var els = this._elementsForKeyword(keyword);
    var self = this;

    this._highlighted[keyword] = false;
    
    this._recurse(els, function(el) {
        if (color !== null && el._highlighted) {
            el._highlighted[color] = false;
        } else {
            el._highlighted = {};
        }

        for (var col in el._highlighted) {
            if (el._highlighted[col] === true) {
                if (el.nodeName == 'path' || el.nodeName == 'circle' || el.nodeName == 'ellipse') {
                    self._outlineElement(el);
                }
                return false;
            }
        }
        self._restoreStyle(el);
        return true;
    });
};


/**
 * Toggle the highlight for a given keyword on the diagram
 * @param {String} keyword  GO keyword to highlight
 * @param {String} color    CSS color string to use as the highlighting colour. Defaults to #ff0000.
 */
GOMap.Diagram.prototype.toggleKeyword = function(keyword,color) {
    if (this._highlighted[keyword]) {
        this.hideKeyword(keyword);
        return false;
    } else {
        return this.showKeyword(keyword,color);
    }
};

GOMap.Diagram.prototype.clearMarkers = function(keyword) {
    if ( ! this.markers ) {
        return;
    }
    if (keyword) {
        this._clearMarkers(this.markers[keyword]);
        return;
    }
    for (var key in this.markers) {
        if (this.markers.hasOwnProperty(key)) {
            this._clearMarkers(this.markers[key]);
        }
    }
    this.markers = {};
};

GOMap.Diagram.prototype._clearMarkers = function(elements) {
    if ( ! elements ) {
        return;
    }
    for (var i = 0 ; i < elements.length ; i++ ) {
        elements[i].parentNode.removeChild(elements[i]);
    }
};

GOMap.Diagram.prototype.addMarker = function(keyword,value) {
    if ( ! this.markers ) {
        this.markers = {};
    }
    
    if ( ! value ) {
        value = 1;
    }
    
    var root_svg = this.element,i;
    
    if ( this.markers[keyword]) {
        this.markers[keyword].current_radius += value;
        for (i = 0; i < this.markers[keyword].length ; i++ ) {
            this.markers[keyword][i].setAttribute('r',this.markers[keyword].current_radius);
        }
        return;
    }

    var els = this._elementsForKeyword(keyword);

    this.markers[keyword] = [];
    
    this.markers[keyword].current_radius = value;
    for ( i = 0 ; i < els.length; i++ ) {
        var node = els[i];
        if ( node.nodeName != 'g' ) {
            continue;
        }
        var bbox = node.getBBox();
        var mid_x = bbox.x + (bbox.width / 2);
        var mid_y = bbox.y + (bbox.height / 2);
        circle = document.createElementNS(svgns,'circle');
        circle.setAttribute('cx',mid_x);
        circle.setAttribute('cy',mid_y);
        circle.setAttribute('r',this.markers[keyword].current_radius);
        circle.setAttribute('fill','#ff0000');
        this.markers[keyword].push(circle);
        root_svg.appendChild(circle);
    }
};


/**
 *  Register a function callback for an event with this object. Actually binds the event to the container
 *  element associated with this Diagram using addEventListener
 *  @param  {Object}    evt     Event name to bind to
 *  @param  {Function}  func    Function to call when event occurs
 */
GOMap.Diagram.prototype.addEventListener = function(evt,func) {
    if ( ! this._events ) {
        this._events = {};
    }
    if ( ! this._events[evt] ) {
        this._events[evt] = [];
    }
    
    this._events[evt].push(func);
};

/**
 * Event fired when the zoom property is changed
 * @name    GOMap.Diagram#zoomChange
 * @param   {Object}    e
 * @event
 * @see     #zoom
 */

/**
 *  @lends GOMap.Diagram.prototype
 *  @property   {Number}    zoom        The zoom level for a diagram. Minimum zoom level is zero, and defaults to 1
 *  @see GOMap.Diagram#event:zoomChange
 */
(function() {

var zoomChange = function() {
    if ( ! this._events || ! this._events.zoomChange ) {
        return;
    }
    for ( var i = 0; i < this._events.zoomChange.length; i++ ) {
        this._events.zoomChange[i].apply(this,[{'type' : 'zoomChange'}]);
    }        
};

var accessors = {
        
    setZoom: function(zoomLevel) {
        if (zoomLevel < 0) {
            zoomLevel = 0;
        }
        // if (zoomLevel > 2) {
        //     zoomLevel = 2;
        // }
        
        if (this.element) {
            this.element.currentScale = zoomLevel;
        }
        
        zoomChange.apply(this);

    },

    getZoom: function() {
        return this.element.currentScale;
    }
};



if (Object.defineProperty && ! MASCP.IE8) {
    Object.defineProperty(GOMap.Diagram.prototype,"zoom", {
        get : accessors.getZoom,
        set : accessors.setZoom
    });
}

})();

/**
 * Allow for zooming and panning on the diagram
 */
GOMap.Diagram.prototype.makeInteractive = function() {
    
    var root = this.element;
    var container = this._container;
    
    var diagram = this;
    
    try {
        var foo = root.addEventListener;
    } catch(err) {
        console.log("Browser does not support addEventListener");
        return;
    }
    (new GOMap.Diagram.Dragger()).applyToElement(root);
    var controls = GOMap.Diagram.addZoomControls(this,0.1,2,0.1,1);
    container.appendChild(controls);
    controls.style.position = 'absolute';
    controls.style.top = '0px';
    controls.style.left = '0px';
    controls.style.height = '30%';
};

/*
 * Set the opacity of all the elements for the diagram to translucent
 */
GOMap.Diagram.prototype._svgLoaded = function() {
    this._forceOpacity();
};

/*
 * Retrieve all the SVG elements that match the given keyword. The SVG document
 * should have elements marked up with a keyword attribute.
 * @param {String}  keyword     Keyword to use to search for elements
 */
GOMap.Diagram.prototype._elementsForKeyword = function(keyword) {
    var root_svg = this.element;
    var els = [];

    if (! GOMap.IE ) {
        els = this._execute_xpath(root_svg,"//*[@keyword = '"+keyword+"']",root_svg.ownerDocument);
    } else {
        var some_els = root_svg.ownerDocument.getElementsByTagNameNS(svgns,'*');
        for (var i = 0; i < some_els.length; i++) {
            var el_key = some_els[i].getAttribute('keyword');
            if (el_key == keyword) {                
                els.push(some_els[i]);
            }
        }
    }
    return els;
};

/* 
 * Execute an xpath query upon a document, pulling the results into an array of elements
 * @param {Element} element Start element
 * @param {String} xpath Xpath query to execute
 * @param {Document} document Parent document
 */
GOMap.Diagram.prototype._execute_xpath = function(element, xpath, doc) {
    var results = [],i=0;
    if (doc.evaluate) {
        xpath_result = doc.evaluate(xpath,element,null,XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE,null);
        while ( (a_result = xpath_result.snapshotItem(i)) !== null ) {
            results.push(a_result);
            i++;
        }
    } else {
        xpath_result = element.selectNodes(xpath);
        for (i = 0; i < xpath_result.length; i++ ){
            results[i] = xpath_result.item(i);
        }
    }
    return results;
};
/*
 * Perform a breadth-first traversal of the nodelist.
 * @param {Array} nodelist Starting list of nodes to perform traversal over
 * @param {Function} function Callback for this traversal. Callback function takes a single argument, which is the currently inspected node.
 */
GOMap.Diagram.prototype._recurse = function(nodelist,callback) {
    for (var i = 0; i < nodelist.length; i++) {
        var return_val = callback.call(this,nodelist[i]);
        if ( ! return_val ) {
            continue;
        }
        if (nodelist[i].childNodes.length > 0) {
            this._recurse(nodelist[i].childNodes,callback);
        }
    }
};
/*
 * Cache the old style for this element. We need to cache the style for the element so that we can restore the
 * element style when it is active.
 * @param {Element} el Element to store the style for
 */
GOMap.Diagram.prototype._cacheStyle = function(el) {    
    if ( ! el.id ) {
        var an_id = 'svg'+(new Date()).getTime().toString()+Math.floor(Math.random()*1000);
        el.setAttribute('id',an_id);
    }

    if (this._styles_cache[el.id] !== null || ! el.style || ! el.id ) {
        return;
    }
    
    if (el.style.stroke && ! el.style.strokeWidth && ! el.style.getPropertyValue('stroke-width')) {
        el.style.strokeWidth = '1';
    }
    
    this._styles_cache[el.id] = {
        'stroke'         : el.style.stroke || el.style.getPropertyValue('stroke'),
        'stroke-width'   : el.style.strokeWidth || el.style.getPropertyValue('stroke-width') || '0px',
        'opacity'        : el.style.getPropertyValue('opacity'),
        'fill-opacity'   : el.style.fillOpacity || el.style.getPropertyValue('fill-opacity'),
        'stroke-opacity' : el.style.strokeOpacity || el.style.getPropertyValue('stroke-opacity')
    };
};

/*
 * Restore the style for an element from the cache
 * @param {Element} element Element to restore the style for. This element must have cache data.
 */

GOMap.Diagram.prototype._restoreStyle = function(element) {
    if ( ! element.style ) {
        return;
    }
    if (this._styles_cache[element.id]) {
        var cacher = this._styles_cache[element.id];
        for (var prop in {'stroke-width':null,'opacity':null,'stroke':null,'fill-opacity':null,'stroke-opacity':null}) {
            // We don't set null properties in IE because they cause the wrong styles to be displayed
            if ( (! GOMap.IE) || cacher[prop] ) {
                element.style.setProperty(prop,cacher[prop],null);
            }
        }
    }
};

/*
 * Draw an outline around the given element
 * @param {Element} element Element to outline
 */
GOMap.Diagram.prototype._outlineElement = function(element) {
    if ( ! element.style ) {
        return;
    }
    this._cacheStyle(element);
    
    var target_color = this._calculateColorForElement(element);
    
    element.style.setProperty('stroke',target_color,null);
    element.style.setProperty('stroke-width',1,null);
    element.style.setProperty('stroke-opacity',1,null);
};

/*
 * Calculate the color fill. Since there may be more than one color highlighted
 * on this element, we build the pattern if needed, and return a reference to 
 * that pattern if a pattern is to be used.
 */

GOMap.Diagram.prototype._calculateColorForElement = function(element) {
    var pattern = "pat";
    var total_keywords = 0,i;
    
    if (element._animates) {
        for (i = 0; i < element._animates.length; i++ ) {
            element.removeChild(element._animates[i]);
        }
        element._animates = null;
    }
    
    for (var col in element._highlighted) {
        if (element._highlighted && element._highlighted[col] === true) {
            pattern += "_"+col;
            total_keywords++;
        }
    }
    
    // Internet Explorer is waiting on support for this http://code.google.com/p/svgweb/issues/detail?id=145
    // Firefox needs at least v 3.7 to support this
    
    var animation_supported = document.createElementNS(svgns,'animate').beginElement;
    
    if (total_keywords == 1) {
        return pattern.split(/_/)[1];
    } else {        
        if (animation_supported) {        
            var animates = this._buildAnimatedColor(pattern,element.id);
            for (i = 0 ; i < animates.length; i++ ) {            
                element.appendChild(animates[i]);
            }
            animates[0].beginElement();
            element._animates = animates;
            return pattern.split(/_/)[1];
        } else {
            return this._buildPattern(pattern);
        }
    }
    
};
/*
 * Create a pattern element under the defs element for the svg. If there isn't a defs element
 * there already, create one and append it to the document.
 * @param {String} pattern_name Underscore separated pattern name - each component of the pattern should be represented. e.g. ff0000_00ff00_0000ff
 * @returns The color name that can be used to reference this pattern
 * @type String
 */
GOMap.Diagram.prototype._buildPattern = function(pattern_name) {
    var pattern_els = pattern_name.split('_');
    pattern_els.shift();
    this._cached_patterns = this._cached_patterns || {};
    var cleaned_name = pattern_name.replace(/#/g,'');
    if (this._cached_patterns[cleaned_name]) {
        return 'url(#'+cleaned_name+')';
    }
    
    var root_svg = this.element;
    var defs_el = root_svg.ownerDocument.getElementsByTagNameNS(svgns,'defs')[0];

    if ( ! defs_el ) {
        defs_el = document.createElementNS(svgns,'defs');
        root_svg.appendChild(defs_el);
    }

    var new_pattern = document.createElementNS(svgns,'pattern');
    new_pattern.setAttribute('x','0');
    new_pattern.setAttribute('y','0');
    new_pattern.setAttribute('width','30');
    new_pattern.setAttribute('height','30');
    new_pattern.setAttribute('viewBox', '0 0 100 100');
    new_pattern.setAttribute('patternUnits','userSpaceOnUse');
    new_pattern.setAttribute('patternTransform','rotate(45)');
    new_pattern.setAttribute('id',cleaned_name);
    
    var pattern_width = 100.0 / (pattern_els.length);
    var start_pos = 0;
    
    for (var i = 0; i < pattern_els.length; i++ ) {
        var a_box = document.createElementNS(svgns, 'rect');
        a_box.setAttribute('x', start_pos);
        start_pos += pattern_width;
        a_box.setAttribute('y', 0);
        a_box.setAttribute('width', pattern_width);
        a_box.setAttribute('height', 100);
        a_box.setAttribute('fill', pattern_els[i]);
        new_pattern.appendChild(a_box);
    }

    defs_el.appendChild(new_pattern);
    this._cached_patterns[cleaned_name] = true;
    return 'url(#'+cleaned_name+')';
};

GOMap.Diagram.prototype._buildAnimatedColor = function(pattern_name,id_prefix) {
    var pattern_els = pattern_name.split('_');
    pattern_els.shift();
    this._cached_patterns = this._cached_patterns || {};
    var cleaned_name = pattern_name.replace(/#/g,'');
    if (this._cached_patterns[cleaned_name]) {
        return 'url(#'+cleaned_name+')';
    }
    
    cleaned_name = id_prefix+cleaned_name;
    
    var root_svg = this.element;
    var defs_el = root_svg.ownerDocument.getElementsByTagNameNS(svgns,'defs')[0];

    if ( ! defs_el ) {
        defs_el = document.createElementNS(svgns,'defs');
        root_svg.appendChild(defs_el);
    }
    
    var animates = [];

    for ( var i = 0; i < pattern_els.length; i++ ) {
        var an_anim = document.createElementNS(svgns,'animate');
        an_anim.setAttribute('id',cleaned_name+i);
        an_anim.setAttribute('from',pattern_els[i]);
        var to_string = '';
        if ( pattern_els.length <= (i+1) ) {
            to_string = pattern_els[0];
        } else {
            to_string = pattern_els[i+1];
        }
        an_anim.setAttribute('to',to_string);
        var begin_string = '';
        if ( i === 0 ) {
            begin_string = 'SVGLoad;indefinite;'+(cleaned_name+(pattern_els.length-1))+'.end';
        } else {
            begin_string = cleaned_name+(i-1)+'.end';
        }
        an_anim.setAttribute('attributeType','CSS');
        an_anim.setAttribute('attributeName','stroke');
        an_anim.setAttribute('begin',begin_string);
        an_anim.setAttribute('dur','1s');
        animates.push(an_anim);
    }

    return animates;
};

/* Highlight an element by making it opaque
 * @param {Element} element Element to make opaque
 */
GOMap.Diagram.prototype._highlightElement = function(element) {
    // Skip this if we don't have a style or has no id and isn't a group
    if ( (! element.style) || (element.nodeName != 'g' && element.id === null)) {
        return;
    }
    
    this._cacheStyle(element);

    if (element.nodeName == 'path' || element.nodeName == 'circle' || element.nodeName == 'ellipse') {
        element.setAttribute('opacity','1');
        element.style.setProperty('opacity',1,null);
    }
    element.setAttribute('fill-opacity','1');
    element.setAttribute('stroke-opacity','1');
    if (element.style.setProperty) {
        element.style.setProperty('fill-opacity',1,null);
        element.style.setProperty('stroke-opacity',1,null);
    }
};

/* Go through all the elements in the svg document and force the opacity to be translucent. Since
 * svgweb doesn't support the referencing of extrinsic stylesheets, we need to go through and 
 * explicitly set the opacity for all the elements. This is really slow on Internet Explorer.
 * We've got different behaviour for the different svg element types as they all react differently
 * to having their opacity set.
 */
GOMap.Diagram.prototype._forceOpacity = function() {
    var root_svg = this.element;
    var suspend_id = root_svg.suspendRedraw(5000);
    var els = root_svg.ownerDocument.getElementsByTagNameNS(svgns,'*');
    for (var i = 0; i < els.length; i++ ) {
        if (els[i].nodeName == 'svg') {
            continue;
        }
        if (els[i].parentNode && els[i].parentNode.parentNode && els[i].parentNode.parentNode.nodeName == 'defs') {
            continue;
        }
        if (els[i].nodeName == 'defs' || (els[i].parentNode && els[i].parentNode.nodeName == 'defs')) {
            continue;
        }
        if (els[i].nodeName == 'path') {
            els[i].setAttribute('opacity','0.4');
            els[i].style.opacity = 0.4;
        } else {
            els[i].setAttribute('fill-opacity','0.3');
            els[i].setAttribute('stroke-opacity','0.2');
            if (els[i].style) {
                els[i].style.fillOpacity = 0.3;
                els[i].style.strokeOpacity = 0.2;
            }
        }
    }
    root_svg.unsuspendRedraw(suspend_id);
};


/**
 * @class       State class for adding panning functionality to an element. Each element that is to be panned needs a new instance
 *              of the Dragger to store state.
 * @author      hjjoshi
 * @requires    svgweb
 */
GOMap.Diagram.Dragger = function() {
  this.oX = 0;
  this.oY = 0;
  this.dX = 0;
  this.dY = 0;
  this.dragging = false;
  this.targetElement = null;
};

/**
 * Connect this dragger to a particular element. If an SVG element is given, panning occurs within the bounding box of the SVG, and
 * the image is shifted by using the currentTranslate property. If a regular HTML element is given, the scrollLeft and scrollTop attributes
 * are used to move the viewport around. 
 * @param {Element} targetElement Element to enable panning upon.
 */
GOMap.Diagram.Dragger.prototype.applyToElement = function(targetElement) {
    var self = this;
    self.enabled = true;
    
    var momentum = [];

    if (targetElement.nodeName == 'svg') {
        targetElement.getPosition = function() {
            var dX = targetElement.currentTranslate.x;
            var dY = targetElement.currentTranslate.y;

            return [dX, dY];
        };
        
        targetElement.shiftPosition = function(x,y) {
            var p = {'x' : x, 'y' : y };
            var viewBoxScale = 1;
            var vbox = this.getAttribute('viewBox');

            var min_x,min_y,width,height;

            if (vbox) {
                var viewBox = this.getAttribute('viewBox').split(' ');
                viewBoxScale = parseFloat(this.width.baseVal.value) / parseFloat(viewBox[2]);
                min_x = 0;
                min_y = parseInt(viewBox[1],10);
                width = parseInt(viewBox[2],10);
                height = parseInt(viewBox[3],10);
            } else {
                min_x = 0;
                min_y = 0;
                width = targetElement.width;
                height = targetElement.height;
            }

            if (targetElement.style.GomapScrollLeftMargin) {
                min_x += targetElement.style.GomapScrollLeftMargin;
            }
            
            if ( self.dragging ) {
                p.x = viewBoxScale*(p.x - self.oX);
                p.y = viewBoxScale*(p.y - self.oY);

                p.x += self.dX;
                p.y += self.dY;
                p.y = 0;
            }

            if (targetElement._snapback) {
                clearTimeout(targetElement._snapback);
                targetElement._snapback = null;
            }
            
            if (p.x > viewBoxScale * min_x) {
                /* Element has shifted too far to the right
                   Induce some gravity towards the left side
                   of the screen
                */
                targetElement._snapback = setTimeout(function() {
                    var evObj;
                    if (Math.abs(targetElement.currentTranslate.x - (viewBoxScale * min_x)) > 35 ) {
                        var new_pos = 0.95*(targetElement.currentTranslate.x - (viewBoxScale * min_x));
                        if (new_pos < (viewBoxScale * min_x)) {
                            new_pos = (viewBoxScale * min_x);
                        }
                        
                        targetElement.setCurrentTranslateXY( new_pos, 0);
                        window.requestAnimFrame(arguments.callee, targetElement);
//                        targetElement._snapback = setTimeout(arguments.callee,10);
                        if (document.createEvent) {
                            var evObj = document.createEvent('Events');
                            evObj.initEvent('panstart',false,true);
                            targetElement.dispatchEvent(evObj);
                        }
                    } else {
                        targetElement.setCurrentTranslateXY( (viewBoxScale * min_x), 0 );
                        if (document.createEvent) {
                            var evObj = document.createEvent('Events');
                            evObj.initEvent('pan',false,true);
                            targetElement.dispatchEvent(evObj);
                        }
                        if (! self.dragging) {
                            bean.fire(targetElement,'panend');
                        }
                        targetElement._snapback = null;
                    }
                },300);
            }
            
            var min_val = viewBoxScale * ( width - 2 * min_x );
            
            if (min_x === 0) {
                min_val *= 0.90;
            }
            if (p.x < 0 && Math.abs(p.x) > min_val) {
                /* Element has shifted too far to the left
                   Induce some gravity to the right side of the screen
                */
                targetElement._snapback = setTimeout(function() {
                    var evObj;
                    
                    if (Math.abs(targetElement.currentTranslate.x - (-1 * min_val)) > 35 ) {
                        var new_pos = 0.95*(targetElement.currentTranslate.x);
                        if (new_pos > (-1*min_val)) {
                            new_pos = -1*min_val;
                        }
                        targetElement.setCurrentTranslateXY( new_pos, 0);
                        window.requestAnimFrame(arguments.callee, targetElement);
//                        targetElement._snapback = setTimeout(arguments.callee,10);
                        if (document.createEvent) {
                            evObj = document.createEvent('Events');
                            evObj.initEvent('panstart',false,true);
                            targetElement.dispatchEvent(evObj);
                        }
                    } else {
                        targetElement.setCurrentTranslateXY( -1*min_val, 0);                        
                        if (document.createEvent) {
                            evObj = document.createEvent('Events');
                            evObj.initEvent('pan',false,true);
                            targetElement.dispatchEvent(evObj);
                        }
                        if (! self.dragging) {
                            bean.fire(targetElement,'panend');
                        }
                        targetElement._snapback = null;
                    }
                },300);
            }

            if (p.y > viewBoxScale * min_y) {
                p.y = viewBoxScale * min_y;
            }
            if (Math.abs(p.y) > 0.50*viewBoxScale * height ) {
                p.y = -0.50 * viewBoxScale * height;
            }
            if (this.setCurrentTranslateXY) {
                this.setCurrentTranslateXY(p.x,p.y);
            } else if (this.currentTranslate.setXY) {
                this.currentTranslate.setXY(p.x,p.y);
            } else {
                this.currentTranslate.x = p.x;
                this.currentTranslate.y = p.y;          
            }            

            if (document.createEvent) {
                var evObj = document.createEvent('Events');
                evObj.initEvent('pan',false,true);
                this.dispatchEvent(evObj);
            }
        };
    } else {
        targetElement.getPosition = function() {
            return [this.scrollLeft, this.scrollTop];
        };
        targetElement.shiftPosition = function(x,y) {
            this.scrollLeft = self.dX + (self.oX - x);
            this.scrollTop = self.dY + (self.oY - y);

            if (document.createEvent) {
                var evObj = document.createEvent('Events');
                evObj.initEvent('pan',false,true);
                this.dispatchEvent(evObj);
            }
        };
    }

    var stationary;

    var svgMouseDown = function(evt) {
      if ( ! self.enabled ) {
          return true;
      }

      var targ = self.targetElement ? self.targetElement : targetElement;
      var positions = mousePosition(evt);
      self.dragging = true;

      if (self.targetElement) {

          self.oX = positions[0];
          self.oY = positions[1];
          self.dX = self.targetElement.scrollLeft;
          self.dY = self.targetElement.scrollTop;
          evt.preventDefault(true);
          return;
      }

      var p = targetElement.createSVGPoint();
      positions = mousePosition(evt);
      p.x = positions[0];
      p.y = positions[1];

      var rootCTM = this.firstElementChild.getScreenCTM();
      self.matrix = rootCTM.inverse();
      
      p = p.matrixTransform(self.matrix);

      self.dX = targetElement.getPosition()[0];
      self.dY = targetElement.getPosition()[1];

      self.oX = p.x;
      self.oY = p.y;

      evt.preventDefault(true);
      
      if (document.createEvent) {
          self.clicktimeout = setTimeout(function() {
              var evObj = document.createEvent('Events');
              self.clicktimeout = null;
              evObj.initEvent('panstart',false,true);
              targ.dispatchEvent(evObj);
          },200);
      }

    };
    
    var mousePosition = function(evt) {
        var posx = 0;
        var posy = 0;
        if (!evt) {
            evt = window.event;
        }
        if (evt.pageX || evt.pageY)     {
            posx = evt.pageX;
            posy = evt.pageY;
        } else if (evt.clientX || evt.clientY)  {
            posx = evt.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
            posy = evt.clientY + document.body.scrollTop + document.documentElement.scrollTop;
        }
        if (self.targetElement) {
            posx = evt.screenX;
            posy = evt.screenY;
        }
        return [ posx, posy ];
    };
    
    var mouseMove = function(evt) {
        this.style.cursor = 'url(http://maps.gstatic.com/intl/en_us/mapfiles/openhand_8_8.cur)';
        var positions = mousePosition(evt);
        if (self.clicktimeout && Math.abs(positions[0] - self.oX) < 10 ) {
            mouseUp();
        }
        if (!self.dragging) {
           return;
        }
        this.style.cursor = 'url(http://maps.gstatic.com/intl/en_us/mapfiles/closedhand_8_8.cur)';

        targetElement.shiftPosition(positions[0],positions[1]);
        
        evt.preventDefault(true);
    };
    
    var mouseDown = function(evt) {
        self.dragging = true;
        var positions = mousePosition(evt);
        self.oX = positions[0];
        self.oY = positions[1];
        self.dX = targetElement.getPosition()[0];
        self.dY = targetElement.getPosition()[1];
        evt.preventDefault(true);
        var targ = self.targetElement ? self.targetElement : targetElement;
        if (document.createEvent) {
            var evObj = document.createEvent('Events');
            evObj.initEvent('panstart',false,true);
            targ.dispatchEvent(evObj);
        }
    };
    
    var svgMouseMove = function(evt) {
        if (!self.enabled) {
            this.style.cursor = 'pointer';
            return true;
        }
        // this.style.cursor = 'url(http://maps.gstatic.com/intl/en_us/mapfiles/openhand_8_8.cur), move';
        if (!self.dragging) {
            return;
        }

        // if (stationary) {
        //     clearTimeout(stationary);
        //     stationary = null;
        // }
        // 
        // stationary = window.setTimeout(function() {
        //     self.dragging = false;
        // },200);        
        
        doMouseMove.call(this,evt);
    };

    var doMouseMove = function(evt) {        
        var positions = mousePosition(evt);
        // this.style.cursor = 'url(http://maps.gstatic.com/intl/en_us/mapfiles/closedhand_8_8.cur), -moz-grabbing';

        if (self.targetElement) {
            self.targetElement.shiftPosition(positions[0],positions[1]);
            return;
        }

        
        var p = targetElement._cachedpoint || targetElement.createSVGPoint();
        targetElement._cachedpoint = p;
        
        positions = mousePosition(evt);

        p.x = positions[0];
        p.y = positions[1];

        var rootCTM = targetElement._cachedrctm || targetElement.firstElementChild.getScreenCTM();
        targetElement._cachedrctm = rootCTM;
        
        p = p.matrixTransform(self.matrix);
        targetElement.shiftPosition(p.x,p.y);
//        momentum = p.x;        
    };

    var mouseUp = function(evt) { 
      if (self.clicktimeout) {
          clearTimeout(self.clicktimeout);
          self.clicktimeout = null;
      }
      if ( ! self.enabled ) {
          return true;
      }
      self.oX = 0;
      self.oY = 0;
      self.dX = null;
      self.dY = null;
      self.dragging = false;
      evt.preventDefault(true);
      
      var targ = self.targetElement ? self.targetElement : targetElement;      
      
      if (! targ._snapback) {
        bean.fire(targ,'panend',true);
      }
    };

    var mouseOut = function(e) {
        if (!self.dragging || ! self.enabled) {
            return true;
        }
        if (this == self.targetElement) {
            mouseUp(e);
        }
        
        
        if ( e.target != this && ! e.currentTarget ) {
            return;
        }

        var toTarget = e.relatedTarget ? e.relatedTarget : e.toElement;
        
        while (toTarget !== null) {
            if (toTarget == this) {
                return;
            }
            toTarget = toTarget.parentNode;
        }
        mouseUp(e);
    };
        
    targetElement.setAttribute('cursor','pointer');    
    
    if ( ! targetElement.addEventListener) {
        targetElement.addEventListener = function(name,func,bool) {
            this.attachEvent(name,func);
        };
    }
    
    targetElement.addEventListener('touchstart',function(e) {
        if ( ! self.enabled ) {
            return;
        }
        var targ = self.targetElement ? self.targetElement : targetElement;
        if (self.momentum) {
            window.clearTimeout(self.momentum);
            self.momentum = null;
        }
        if (e.touches.length == 1) {
            var positions = mousePosition(e.touches[0]);
            var p;
            if (targ.nodeName == 'svg') {
                p = targ.createSVGPoint();
                p.x = positions[0];
                p.y = positions[1];
                var rootCTM = this.getScreenCTM();
                self.matrix = rootCTM.inverse();
                p = p.matrixTransform(self.matrix);
            } else {
                p.x = positions[0];
                p.y = positions[1];
            }
            self.oX = p.x;
            self.oY = p.y;
            
            self.dragging = true;
            self.dX = targ.getPosition()[0];
            self.dY = targ.getPosition()[1];
            
            self._momentum_shrinker = setInterval(function() {
                momentum.shift();
            },20);
            if (document.createEvent) {
                var evObj = document.createEvent('Events');
                evObj.initEvent('panstart',false,true);
                targ.dispatchEvent(evObj);
            }
            e.preventDefault();
        }
    },false);


    // document.addEventListener('touchmove',function(e) {
    //     console.log('touchmove for the document');
    //     console.log(self.dragging);
    //     if ( ! self.dragging ) {
    //         return;
    //     }
    //     console.log("Ending the drag for document move");
    //     self.oX = 0;
    //     self.oY = 0;
    //     self.dX = null;
    //     self.dY = null;
    //     self.dragging = false;
    // 
    //     var targ = self.targetElement ? self.targetElement : targetElement;      
    // 
    //     if (document.createEvent) {
    //         var evObj = document.createEvent('Events');
    //         evObj.initEvent('panend',false,true);
    //         targ.dispatchEvent(evObj);
    //     }      
    // },false);

    targetElement.addEventListener('touchmove',function(e) {
        if (self.momentum) {
            window.clearTimeout(self.momentum);
            self.momentum = null;
        }

        if (e.touches.length != 1) {
            self.dragging = false;
        }

        var targ = self.targetElement ? self.targetElement : targetElement;

        var positions = mousePosition(e.touches[0]);

        if (! positions || ! self.matrix) {
            return;
        }

        var p;
        if (targ.nodeName == 'svg') {
            p = targ.createSVGPoint();
            p.x = positions[0];
            p.y = positions[1];
            p = p.matrixTransform(self.matrix);
        } else {
            p.x = positions[0];
            p.y = positions[1];
        }
        
        if (self.dragging && ((6*Math.abs(self.oX - p.x)) > Math.abs(self.oY - p.y))) {
            e.preventDefault();
        }

        if (!self.dragging) {
            self.oX = 0;
            self.oY = 0;
            self.dX = null;
            self.dY = null;
            return;
        }
        if (momentum.length > 3) {
            momentum.splice(2);
        }
        targ.shiftPosition(p.x,p.y);
        momentum.push(targ.getPosition()[0] - self.dX);
    },false);
    
    var momentum_func = function(e) {
        if ( ! self.enabled ) {
            return true;
        }
        if ( ! self.dragging ) {
            clearInterval(self._momentum_shrinker);
            mouseUp(e);
            return;
        }
        var targ = self.targetElement ? self.targetElement : targetElement;
        var delta = 0;
        
        if (momentum.length > 0) {
            var last_val = momentum[0];
            momentum.forEach(function(m) {
                if ((typeof last_val) != 'undefined') {
                    delta += m - last_val;
                }
                last_val = m;
            });
            delta = delta / momentum.length;
        }
        var start = targ.getPosition()[0];
        var start_delta = delta;
        self.dragging = false;
        if (self.momentum) {
            window.clearTimeout(self.momentum);
        }
        self.momentum = 1;
        (function() {
            start = targ.getPosition()[0];
            if (self.dragging) {
                start += self.oX - self.dX;
            } else {
                self.oX = 0;
                self.dX = 0;
            }
            targ.shiftPosition(start+delta,0);
            start = start+delta;
            delta = delta * 0.5;
            
            if (delta > 0 && Math.abs(start_delta / delta) < 10) {
                window.requestAnimFrame(arguments.callee, targ);
//                window.setTimeout(arguments.callee,50);
            } else {
                self.momentum = null;
                clearInterval(self._momentum_shrinker);
                mouseUp(e);
            }
        })();
    };
    
    targetElement.addEventListener('touchend',momentum_func,false);


    if (targetElement.nodeName == 'svg') {
        targetElement.addEventListener('mousedown', svgMouseDown, false);
        targetElement.addEventListener('mousemove', svgMouseMove, false);        
        targetElement.addEventListener('mouseup',mouseUp,false);
        targetElement.addEventListener('mouseout',mouseOut, false); 
        if (self.targetElement) {
            self.targetElement.addEventListener('mouseout',mouseOut,false);
        }
        // targetElement.addEventListener('click',function(ev) { ev.preventDefault(); ev.stopPropagation(); },false);
    } else {
        targetElement.addEventListener('mousedown', mouseDown, false);
        targetElement.addEventListener('mousemove', mouseMove, false);        
        targetElement.addEventListener('mouseup', mouseUp, false);        
        targetElement.addEventListener('mouseout',mouseOut, false);
    }

};


GOMap.Diagram.addTouchZoomControls = function(zoomElement,touchElement) {
    GOMap.Diagram.Dragger.prototype.addTouchZoomControls.call({"enabled" : true },zoomElement,touchElement);
};

GOMap.Diagram.Dragger.prototype.addTouchZoomControls = function(zoomElement,touchElement) {
    var self = this;
    var mousePosition = function(evt) {
        var posx = 0;
        var posy = 0;
        if (!evt) {
            evt = window.event;
        }
        if (evt.pageX || evt.pageY)     {
            posx = evt.pageX;
            posy = evt.pageY;
        } else if (evt.clientX || evt.clientY)  {
            posx = evt.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
            posy = evt.clientY + document.body.scrollTop + document.documentElement.scrollTop;
        }
        if (self.targetElement) {
            posx = evt.screenX;
            posy = evt.screenY;
        }
        return [ posx, posy ];
    };
    touchElement.addEventListener('touchstart',function(e) {
        if ( ! self.enabled ) {
            return;
        }
        if (e.touches.length == 2) {
            var positions = mousePosition(e.touches[0]);
            var positions2 = mousePosition(e.touches[1]);
            var p;
            if (touchElement.nodeName == 'svg') {
                p = touchElement.createSVGPoint();
                p.x = 0.5*(positions[0] + positions2[0]);
                p.y = 0.5*(positions[1] + positions2[1]);
                var rootCTM = this.getScreenCTM();
                self.matrix = rootCTM.inverse();
                p = p.matrixTransform(self.matrix);
            } else {
                p.x = 0.5*(positions[0] + positions2[0]);
                p.y = 0.5*(positions[1] + positions2[1]);
            }
            zoomElement.zoomCenter = p;  
            e.preventDefault();
        }
    },false);


    // touchElement.addEventListener('gesturestart',function(e) {
    Hammer(touchElement).on("touch",function(e) {
        if ( ! self.enabled ) {
            return;
        }
        // zoomElement.zoomLeft = null;
        var zoomStart = zoomElement.zoom;

        var zoomscale = function(ev) {
            if ( zoomElement.zoomCenter ) {
                zoomElement.zoom = zoomStart * ev.gesture.scale;
            }
            ev.preventDefault();
        };
        Hammer(touchElement).on('pinch',zoomscale,false);
        Hammer(touchElement).on('release',function(ev) {
            Hammer(touchElement).off('pinch',zoomscale);
            Hammer(touchElement).off('release',arguments.callee);
            zoomElement.zoomCenter = null;
            zoomElement.zoomLeft = null;
            bean.fire(zoomElement,'gestureend')
        },false);
        e.preventDefault();
    },false);

};

/**
 * Given an element that implements a zoom attribute, creates a div that contains controls for controlling the zoom attribute. The
 * zoomElement must have a zoom attribute, and can fire the zoomChange event whenever the zoom value is changed on the object. The
 * scrollwheel is connected to this element so that when the mouse hovers over the controls, it can control the zoom using only
 * the scroll wheel.
 * @param {Object} zoomElement Element to control the zooming for.
 * @param {Number} min Minimum value for the zoom attribute (default 0)
 * @param {Number} max Maximum value for the zoom attribute (default 10)
 * @param {Number} precision Step precision for the zoom control (default 0.5)
 * @param {Number} value Default value for this control
 * @returns DIV element containing the controls
 * @type Element
 * @see GOMap.Diagram#event:zoomChange
 */
GOMap.Diagram.addZoomControls = function(zoomElement,min,max,precision,value) {
    min = min || 0;
    max = max || 10;
    precision = precision || 0.5;
    value = value || zoomElement.zoom || min; 
    
    var controls_container = document.createElement('div');
    
    var zoomIn = document.createElement('input');
    zoomIn.setAttribute('type','button');
    zoomIn.setAttribute('value','+');
    var zoomOut = document.createElement('input');
    zoomOut.setAttribute('type','button');
    zoomOut.setAttribute('value','-');
    var reset = document.createElement('input');
    reset.setAttribute('type','button');
    reset.setAttribute('value','Reset');

    controls_container.appendChild(reset);    

    reset.addEventListener('click',function() {
        zoomElement.zoom = zoomElement.defaultZoom || value;
    },false);
    
    var range = document.createElement('input');
    range.setAttribute('min',min);
    range.setAttribute('max',max);
    range.setAttribute('step',precision);
    range.setAttribute('value',value); 
    range.setAttribute('type','range');
    range.setAttribute('style','-webkit-appearance: slider-horizontal; width: 100%; position: absolute; top: 0px; bottom: 0px; margin-top: 0.5em; left: 100%; margin-left: -0.5em;');

    if (range.type == 'range') {
        
        range.addEventListener('change',function() {
            zoomElement.zoom = this.value;
        },false);
        
        var evFunction = null;
        if (zoomElement.addEventListener) {
            evFunction = zoomElement.addEventListener;
        } else if (zoomElement.bind){
            evFunction = zoomElement.bind;
        }
        
        evFunction.apply(zoomElement,['zoomChange',function() {
            range.value = zoomElement.zoom;
        },false]);
        

        reset.style.margin = '0px';
        reset.style.display = 'block';
        reset.style.position = 'absolute';
        reset.style.top = '0px';
        
        controls_container.appendChild(range);
        controls_container.style.height = '100%';
    } else {
        if (! zoomIn.addEventListener) {
            var addevlis = function(name,func) {
                this.attachEvent(name,func);
            };
            zoomIn.addEventListener = addevlis;
            reset.addEventListener = addevlis;
            zoomOut.addEventListener = addevlis;        
        }
        zoomIn.addEventListener('click',function() {
            zoomElement.zoom += precision;
        },false);
        zoomOut.addEventListener('click',function() {
            zoomElement.zoom -= precision;
        },false);

        zoomIn.style.margin = '0px';
        zoomIn.style.display = 'block';
        zoomIn.style.position = 'absolute';
        zoomIn.style.top = '0px';
        zoomIn.style.left = '29px';

        zoomOut.style.margin = '0px';
        zoomOut.style.display = 'block';
        zoomOut.style.position = 'absolute';
        zoomOut.style.top = '0px';

        reset.style.margin = '0px';
        reset.style.display = 'block';
        reset.style.position = 'absolute';
        reset.style.top = '23px';
        reset.style.left = '3px';

        controls_container.appendChild(zoomOut);
        controls_container.appendChild(zoomIn);
        controls_container.appendChild(reset);
    }

    this.addScrollZoomControls(zoomElement,controls_container,precision);

    return controls_container;
};

GOMap.Diagram.addScrollBar = function(target,controlElement,scrollContainer) {
    var scroller = document.createElement('div');
    while (scrollContainer.childNodes.length > 0) {
        scrollContainer.removeChild(scrollContainer.firstChild);
    }
    scrollContainer.appendChild(scroller);
    if ( ! scrollContainer.style.position ) {
        scrollContainer.style.position = 'relative';
    }
    scrollContainer.style.overflowX = 'scroll';
    scrollContainer.style.overflowY = 'hidden';

    scroller.style.position = 'absolute';
    scroller.style.left = '0px';
    scroller.style.width = '100%';
    scroller.style.height= '100%';

    bean.remove(scrollContainer,'scroll');
    bean.remove(scrollContainer,'mouseenter');
    bean.add(scrollContainer,'mouseenter',function() {

        disabled = true;
        scrollContainer.scrollLeft += 1;
        scrollContainer.scrollLeft -= 1;
        setTimeout(function() {
            disabled = false;
        },0);
        bean.remove(scrollContainer,'scroll',scroll_func);
        bean.add(scrollContainer,'scroll',scroll_func);

        scroller.cached_width = scroller.clientWidth;
    });
    var disabled = false;

    if (window.matchMedia) {
        window.matchMedia('print').addListener(function(matcher) {
            disabled = true;
            setTimeout(function() {
                disabled = false;
            },0);
        });
    }
    var scroll_func = function() {
        if (disabled || ! console) {
            return;
        }
        if (document.createEvent) {
            var evObj = document.createEvent('Events');
            evObj.initEvent('panstart',false,true);
            controlElement.dispatchEvent(evObj);
        }
        var width = scroller.cached_width || scroller.clientWidth;
        target.setLeftPosition(parseInt(scrollContainer.scrollLeft * target.getTotalLength() / width));
        bean.fire(controlElement,'panend');
    };

    bean.add(scrollContainer,'scroll',scroll_func);

    bean.add(controlElement,'pan',function() {
        var size = 100*target.getTotalLength() / (target.getVisibleLength());
        scroller.style.width = parseInt(size)+'%';
        var width = scroller.cached_width || scroller.clientWidth;
        var left_shift = parseInt(width * (target.getLeftPosition() / target.getTotalLength() ));
        bean.remove(scrollContainer,'scroll',scroll_func);
        setTimeout(function() {
            scrollContainer.scrollLeft = left_shift;
        },0);
    });
};

/**
 * Connect the scroll wheel to the controls to control zoom
 */
GOMap.Diagram.addScrollZoomControls = function(target,controlElement,precision) {
    precision = precision || 0.5;

    var self = this;

    var hookEvent = function(element, eventName, callback) {
      if (typeof(element) == 'string') {
        element = document.getElementById(element);
      }

      if (element === null) {
        return;
      }

      if (element.addEventListener) {
        if (eventName == 'mousewheel') {
          element.addEventListener('DOMMouseScroll', callback, false);  
          element.addEventListener('wheel', callback, false);
        }
        element.addEventListener(eventName, callback, false);
      } else if (element.attachEvent) {
        element.attachEvent("on" + eventName, callback);
      }
    };


    var mousePosition = function(evt) {
          var posx = 0;
          var posy = 0;
          if (!evt) {
              evt = window.event;
          }
          if (evt.pageX || evt.pageY)   {
              posx = evt.pageX;
              posy = evt.pageY;
          } else if (evt.clientX || evt.clientY)    {
              posx = evt.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
              posy = evt.clientY + document.body.scrollTop + document.documentElement.scrollTop;
          }

          var p = {};

          if (controlElement.nodeName == 'svg') {
              p = controlElement.createSVGPoint();
              p.x = posx;
              p.y = posy;
              /* Fix for mouse position in firefox - http://jsfiddle.net/JNKgR/6/ */
              var rootCTM = controlElement.firstElementChild.getScreenCTM();
              self.matrix = rootCTM.inverse();
              p = p.matrixTransform(self.matrix);
          } else {
              p.x = posx;
              p.y = posy;
          }
          return p;
    };

    var mouseWheel = function(e) {
      e = e ? e : window.event;
      var wheelData = e.detail ? e.detail * -1 : e.wheelDelta;
      if ( ! wheelData ) {
        wheelData = e.deltaY;
      }
      target.zoomCenter = mousePosition(e);

      if (wheelData > 0) {
        target.zoom = target.zoom += precision;
      } else {
        target.zoom = target.zoom -= precision;
      }
      
      
      if (e.preventDefault) {
        e.preventDefault();
      }

      e.returnValue = false;
      e.stopPropagation();

      return false;
    };

    var isFF = false;

    if (navigator.userAgent.indexOf('Gecko') >= 0) {
      isFF = parseFloat(navigator.userAgent.split('Firefox/')[1]) || undefined;
    }                         

    if (isFF && (typeof svgweb != 'undefined')&& svgweb.getHandlerType() == 'native') {
      hookEvent(controlElement, 'mousewheel',
                mouseWheel);
    } else {
      hookEvent(controlElement, 'mousewheel', mouseWheel);
    }

    hookEvent(controlElement,'mousemove', function(e) {
        if (target.zoomCenter && Math.abs(target.zoomCenter.x - mousePosition(e).x) > 100) {
            target.zoomCenter = null;
            target.zoomLeft = null;
        }
    });
};

