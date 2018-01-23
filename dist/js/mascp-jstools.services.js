//"use strict";

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

if (Object.defineProperty && ! MASCP.IE8 ) {
    (function() {
        var ready_callbacks = [];
        var is_ready = false;
        Object.defineProperty(MASCP,"ready", {
            get : function() {
                if ((ready_callbacks.length === 0) && (! is_ready )) {
                    return false;
                }
                return function() {
                    ready_callbacks.forEach(function(cb) {
                        cb.call();
                    });
                };
            },
            set : function(cb) {
                if (cb === false || cb === true) {
                    ready_callbacks = [];
                    if (cb) {
                        is_ready = true;
                    }
                    return is_ready;
                } else {
                    if (is_ready) {
                        cb.call();
                        return;
                    }
                    ready_callbacks.push(cb);
                }
            }
        });
    })();
}

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
                var urlpart = set.split('#')[0];
                var gatorURL = urlpart.slice(-1) == '/' ? urlpart+agi : urlpart+'/'+agi;
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

        if ( pref.type == "data" ) {
            var reader = new MASCP.UserdataReader();
            reader.map = function(data) {
                var results = {};
                for (var key in data) {
                    if (key == "retrieved" || key == "title") {
                        continue;
                    }
                    if ( ! data[key].data ) {
                        results[key] = {'data' : data[key]};
                    } else {
                        results[key] = data;
                    }
                    results[key].retrieved = data.retrieved;
                    results[key].title = data.title;

                }
                return results;
            };
            reader.bind('ready',function() {
                callback.call(null,null,pref,reader);
            });
            reader.setData(set,pref.data);
            return;
        }
        if ( pref.type == "reader" ) {
            callback.call(null,null,pref,pref.reader);
            return;
        }

        if (pref.type == 'dataset') {
            var a_reader = MASCP.GatorDataReader.createReader(set);
            a_reader.bind('ready',function() {
                if (parser) {
                    parser.terminate();
                }
                callback.call(null,null,pref,a_reader);
                callback = function() {};
            });
            a_reader.bind('error',function(err) {
                callback.call(null,{"error" : err },pref);
                callback = function() {};
            });
            return;
        }

        // If we wish to load complete datasets
        // and store them browser-side, we need
        // a parser function to grab the dataset.

        if ( ! pref.parser_function ) {
          return;
        }

        if (JSandbox && /^(https?:)?\/?\//.test(set)) {
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

MASCP.Service.prototype.once = function(type,func) {
    var self = this;
    var wrapped_func = function() {
        bean.remove(self,type,wrapped_func);
        func.apply(self,[].slice.call(arguments));
    };
    self.bind(type,wrapped_func);
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

var cached_requests = {};

var do_request = function(request_data) {
    
    request_data.async = true;

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
    if (request_data.type == 'GET' && request_data.session_cache) {
        if (cached_requests[request_data.url]) {
            cached_requests[request_data.url].then( function(data) {
                request_data.success.call(null,data);
            }).catch(function(error_args) {
                request_data.error.apply(null,[null,request,error_args]);
            });
            return;
        } else {
            var success_callback = request_data.success;
            var error_callback = request_data.error;
            cached_requests[request_data.url] = new Promise(function(resolve,reject) {
                request_data.success = function(data){
                    resolve(data);
                };
                request_data.error = function(message,req,error_obj) {
                    reject([message,req,error_obj]);
                    delete cached_requests[request_data.url];
                };
            });
            cached_requests[request_data.url].catch(function(error_args) {
                error_callback.apply(null,error_args);
            }).then(function(data) {
                success_callback.call(null,data);
            });
        }
    }


    request.open(request_data.type,request_data.url,request_data.async);

    if (request_data.type == 'POST') {
        request.setRequestHeader("Content-Type",request_data.content ? request_data.content : "application/x-www-form-urlencoded");
        datablock = request_data.content ? request_data.data : make_params(request_data.data);
    }

    if (request.customUA) {
        request.setRequestHeader('User-Agent',request.customUA);
    }

    if (request_data.auth) {
        request.setRequestHeader('Authorization','Bearer '+request_data.auth);
    }

    if (request_data.api_key) {
        request.setRequestHeader('x-api-key',request_data.api_key);
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
                        request.setRequestHeader("Content-Type",request_data.content ? request_data.content : "application/x-www-form-urlencoded");
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
    var params;
    if ( ! url ) {
        callback(null);
        return;
    }
    if (typeof url == 'string') {
        params =  { async: true, url: url, timeout: 5000, type : "GET",
                        error: function(response,req,status) {
                            callback.call(null,{"status" : status });
                        },
                        success:function(data,status,xhr) {
                            callback.call(null,null,data);
                        }
                    };
    } else if (url.hasOwnProperty('url')) {
        params = url;
        params.success = function(data) {
            callback.call(null,null,data);
        };
        params.error = function(resp,req,status) {
            callback.call(null,{"status": status});
        };
    }
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
                            bean.remove(self,"resultReceived",arguments.callee);
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

    var setup_idb = function(idb) {
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
                if (typeof data != 'object' || data.constructor.name !== 'Object' || (((typeof Document) != 'undefined') && data instanceof Document)) {
                    continue;
                }
                var dateobj = data.retrieved ? data.retrieved : (new Date());
                if (typeof dateobj === 'string' || typeof dateobj === 'number') {
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
            if (typeof dateobj === 'string' || typeof dateobj === 'number') {
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
                            max_stamp = ts;
                            result.retrieved = new Date(ts);
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
                        results.push(new Date(parseInt(cursor.key[1])));
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
    };
    var setup_websql = function(db) {
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
                        data.retrieved = new Date(parseInt(record.retrieved));
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
                        data.retrieved = new Date(parseInt(records[0].retrieved));
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
                        result.push(new Date(parseInt(records[i].retrieved)));
                    }
                }
                cback.call(null,result);
            });            
        };
    };
    var setup_localstorage = function() {
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
                datablock.retrieved = new Date(parseInt(datablock.retrieved));
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
        if ( ! process.env.SKIP_VACUUM) {
            db.exec("VACUUM;");
        }
        //db.open("cached.db",function() {});
    } else if ("openDatabase" in window || "indexedDB" in window) {

        if ("indexedDB" in window) {

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
                setup_idb(idb);

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
                setup_localstorage();
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
    if (typeof idb !== 'undefined') {
        // Do nothing
    } else if (typeof db != 'undefined') {
        setup_websql(db);
    } else if ("localStorage" in window) {
        setup_localstorage();
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
        
        begin_transaction = function(callback,trans) {
            // No support for transactions here. Do nothing.
            setTimeout(function(){
                callback({"transaction": trans});
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

MASCP.Service.prototype.resetOnResult = function(sequenceRenderer,rendered,track) {
    var self = this;
    var result_func = function() {
        self.unbind('resultReceived',result_func);
        sequenceRenderer.bind('resultsRendered',clear_func);
    };

    var clear_func = function(reader) {
        if (reader !== self) {
            return;
        }
        sequenceRenderer.unbind('resultsRendered',clear_func);
        rendered.forEach(function(obj) {
            sequenceRenderer.remove(track,obj);
        });
    };
    this.bind('resultReceived',result_func);
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
};
/** @fileOverview   Classes for reading data from the AtChloro database
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
};
/** @fileOverview   Classes for reading data from the AtPeptide database
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
};
/** @fileOverview   Classes for reading data from the Cdd tool
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


/** @fileOverview   Classes for reading data from the AtChloro database
 */
if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}


/*

  "accepted_domains" : {
    "type" : "gatorURL",
    "url"  : "http://localhost:3000/data/latest/spreadsheet:0Ai48KKDu9leCdHM5ZXRjdUdFWnQ4M2xYcjM3S0Izdmc" 
    },

*/

/*

  "accepted_domains" : {
    "type" : "googleFile",
    "file"  : "User specified domains"
    },


*/


(function() {

  var editing_enabled = false;

  MASCP.DomainRetriever = MASCP.buildService(function(data) {
    this._raw_data = data;
    return this;
  });

  MASCP.DomainRetriever.prototype.requestData = function() {
    var url = this._endpointURL;
    if (Array.isArray(url)) {
      return this.requestDataWithUniprot();
    }
    var agi = this.agi.toLowerCase();
    var gatorURL = url.slice(-1) == '/' ? url+agi : url+'/'+agi;
    return {
        type: "GET",
        dataType: "json",
        url : gatorURL,
        data: { 'agi'       : agi
        }
    };
  };

  MASCP.DomainRetriever.prototype.requestDataWithUniprot = function() {
      var self = this;
      var urls = this._endpointURL;
      var results = {};

      var merge_hash = function(h1,h2) {
          var key;
          for (key in h2.data) {
              h1.data[key] = h2.data[key];
          }
          return h1;
      };

      var check_result = function(err) {
          if (err && err !== "No data") {
              bean.fire(self,"error",[err]);
              bean.fire(MASCP.Service,'requestComplete');
              self.requestComplete();
              check_result = function() {};
              return;
          }
          if (results['uniprot'] && results['full']) {
              self._dataReceived(merge_hash(results['uniprot'],results['full']));
              self.gotResult();
              self.requestComplete();
          }
      };

      urls.forEach(function(url) {
        var self_runner;
        var type = 'uniprot';
        if (url.indexOf('uniprot') >= 0) {
          self_runner = new MASCP.UniprotDomainReader();
        } else {
          type = 'full';
          self_runner = new MASCP.DomainRetriever(null,url);
        }
        self_runner.retrieve(self.agi,function(err) {
          if ( ! err ) {
            results[type] = this.result._raw_data;
          } else {
            results[type] = {};
          }
          check_result(err);
        });
        return;
      });

      return false;
  };

  MASCP.DomainRetriever.getRawData = function(config,callback) {
    if (config.type === "gatorURL") {
      callback.call({"error" : "Can't get raw data from GATOR URL, missing accession"});
      // Unless this is an S3 url?
      return;
    }
    if (config.type === "googleFile") {
      get_syncable_file(config,function(err,file) {
        if (err) {
          callback.call(null,err);
          return;
        }
        callback.call(null,null,file.getData(),file.permissions,file.owner);
      });
      return;
    }
    if (config.type === "url") {
      if ( ! sessionStorage.wanted_domains ) {
        sessionStorage.wanted_domains = "{}";
      }
      var cached_files = JSON.parse(sessionStorage.wanted_domains);
      if (cached_files[config.url]) {
        callback.call(null, null, JSON.parse(cached_files[config.url]));
        return;
      }
      MASCP.Service.request(config.url,function(err,data) {
        if (err) {
          callback.call(null,err);
          return;
        }
        callback.call(null,null,data);
      });
    }
  };

  var retrieve_accepted_domains = function(config,acc,callback) {
    if (config && Array.isArray(config)) {
      var configs_array = [].concat(config);
      var current = configs_array.shift();
      retrieve_accepted_domains(current,acc,function(err,accepted) {
        if (! err ) {
          callback.call(null,err,accepted);
        } else {
          current = configs_array.shift();
          if (current) {
            retrieve_accepted_domains(current,acc,arguments.callee);
            return;
          }
          callback.call(null,err,accepted);
        }
      });
      return;
    }
    if (config.type === "gatorURL") {
      var datareader = new MASCP.UserdataReader(null, config.url);
      datareader.requestData = MASCP.DomainRetriever.prototype.requestData;

     // datareader.datasetname = "domains";
    // datareader.datasetname = "spreadsheet:0Ai48KKDu9leCdHM5ZXRjdUdFWnQ4M2xYcjM3S0Izdmc";
      datareader.retrieve(acc,function(err) {
        if (err) {
          if (typeof err == "string") {
            err = { "error" : err };
          }
          callback.call(null,err);
          return;
        }
        var wanted_domains = null;
        if (this.result) {
          wanted_domains = this.result._raw_data.data.domains;
        }
        callback.call(null,null,wanted_domains);
      });
    }
    if (config.type === "googleFile") {
      get_syncable_file(config,function(err,file) {
        if (err) {
          callback.call(null,err);
          return;
        }
        var user_wanted = file.getData();
        if (acc in user_wanted) {
          var wanted = [];
          var data_hash = JSON.parse(user_wanted[acc]);
          for (var key in data_hash) {
            if (data_hash.hasOwnProperty(key)) {
              wanted.push(key.replace("dom:",""));
            }
          }
          callback.call(null,null,data_hash ? wanted : null);
        } else {
          callback.call(null,{"error" : "No data" },null);
        }
      });
    }
    if (config.type === "url") {
      if ( ! sessionStorage.wanted_domains ) {
        sessionStorage.wanted_domains = "{}";
      }
      var cached_files = JSON.parse(sessionStorage.wanted_domains);
      if (cached_files[config.url]) {
        callback.call(null, null, JSON.parse(cached_files[config.url])[acc]);
        return;
      }
      MASCP.Service.request(config.url,function(err,data) {
        if (err) {
          callback.call(null,err);
          return;
        }
        callback.call(null,null,data ? data[acc] : null );
      });
    }
  };

  var check_accepted_domains_writable = function(config,callback) {

    // Only select the first file for writing domains to
    if (config && Array.isArray(config)) {
      config = config[0];
    }

    // We can only write to a googleFile

    if (config.type === "googleFile") {
      get_syncable_file(config,function(err,file) {
        if (err) {
          callback.call(null,err);
          return;
        }
        callback.call(null,null,file.permissions.write);
      });
      return;
    }

    callback.call(null,null,false);
  };

  var cached_file_blocks = {};

  var get_syncable_file = function(config,callback) {
    var id_string = "";
    var mime = "application/json";
    var file_block = {};
    if (typeof config.file == "string") {
      id_string = config.file;
      file_block = config.file;
    } else {
      id_string = config.file.file_id;
      file_block = { "id" : config.file.file_id };
      mime = "application/json; data-type=domaintool-domains";
    }
    var file = cached_file_blocks[id_string];
    if (file) {
      if (! file.ready) {
        bean.add(file,'ready',function() {
          bean.remove(file,'ready',arguments.callee);
          callback.call(null,null,file);
        });
        return;
      }
      callback.call(null,null,file);
      return;
    }
    cached_file_blocks[id_string] = (new MASCP.GoogledataReader()).getSyncableFile(file_block,callback,mime);
  };

  var update_accepted_domains = function(config,callback) {
    // Only select the first file for writing domains to
    if (config && Array.isArray(config)) {
      config = config[0];
    }

    if (config.type === "googleFile") {
      get_syncable_file(config,function(err,file) {
        if (err) {
          callback.call(null,err);
          return;
        }
        callback.call(null,null,file.getData());
        file.sync();
      });
      return;
    }

    callback.call();
  };


  var get_accepted_domains = function(acc,next) {
    var self = this;
    var next_call = function(accepted_domains) {
      return function() {
        // We should just pretend we got data back
        var all_domains = self.result._raw_data.data;
        filter_domains(all_domains,accepted_domains,acc,function(domains) {
          next(acc,domains);
        });
      };
    };

    var use_default_accepted = next_call([]);

    self.preferences.getPreferences(function(err,prefs) {
      if (prefs && prefs.accepted_domains) {
        retrieve_accepted_domains(prefs.accepted_domains,acc,function(err,wanted_domains) {
          if (err) {
            if (err.status == 403) {
              next_call([])();
              return;
            }
            if (err.error !== "No data") {
              console.log("Some problem");
              return;
            }
            wanted_domains = null;
          }
          next_call(wanted_domains)();
        });
      }
    });
  };

  var filter_domains = function(all_domains,wanted_domains,acc,callback) {
    var results = {};
    if (! wanted_domains ) {
      callback.call(null,all_domains);
      return all_domains;
    }
    all_domains = all_domains || {};
    for (var dom in all_domains) {
      if (! all_domains.hasOwnProperty(dom)) {
        continue;
      }
      var dom_key = dom.replace(/\s/g,'_');
      if (wanted_domains.indexOf(dom_key) >= 0) {
        results[dom] = all_domains[dom];
      }
      if (dom_key.match(/GlcNAc/)) {
        results[dom] = all_domains[dom];
      }
    }
    if (all_domains["tmhmm-TMhelix"]) {
      results["tmhmm-TMhelix"] = all_domains["tmhmm-TMhelix"];
    }
    callback.call(null,results);
    return results;
  };

  var render_domains = function(renderer,domains,acc,track,offset,height,namespace) {
      var target_layer = track || acc.toString();

      MASCP.registerLayer(target_layer, { 'fullname' : "All domains", 'color' : '#aaaaaa' },[renderer]);
      var domain_keys = [];
      for (var domain in domains) {
        domain_keys.push(domain);
      }
      domain_keys.sort(function(a,b) {
        if (a == 'SIGNALP') {
          return 1;
        }
        if (b == 'SIGNALP') {
          return -1;
        }
        if (a == 'tmhmm-TMhelix') {
          return 1;
        }
        if (b == 'tmhmm-TMhelix') {
          return -1;
        }
        return a.localeCompare(b);
      });
      var results = {};

      domain_keys.forEach(function(dom) {
        var lay_name = "dom:"+dom;
        lay_name = lay_name.replace(/\s/g,'_');
        if (dom == "KDEL") {
          domains[dom].peptides.push([ renderer.sequence.length - 3, renderer.sequence.length  ]);
        }
        var track_name = domains[dom].name;
        if ( dom == "tmhmm-TMhelix") {
          track_name = "TM Transmembrane";
        }
        if ( dom == "tmhmm-outside") {
          return;
        }
        if ( dom == "tmhmm-inside") {
          return;
        }

        MASCP.registerLayer(lay_name, { 'fullname' : track_name || dom, 'color' : '#aaaaaa' },[renderer]);
        renderer.trackOrder.push(lay_name);
        if (editing_enabled) {
          renderer.showLayer(lay_name);
        }
        var done_anno = false;
        var seen = {};
        domains[dom].peptides.forEach(function(pos) {
          var start = parseInt(pos[0]);
          var end = parseInt(pos[1]);
          if (isNaN(start)) {
            return;
          }
          if (seen[start]) {
            return;
          }

          if ((dom == "tmhmm-TMhelix") && domains["SIGNALP"]) {
            var signalp_end = parseInt(domains["SIGNALP"].peptides[0][1]);
            if ( (signalp_end >= end) || (start <= signalp_end) ) {
              return;
            }
          }
          seen[start] = true;
          if ( ! results[lay_name]) {
            results[lay_name] = [];
          }
          if ( ! results[target_layer]) {
            results[target_layer] = [];
          }
          if (start == end) {
            var shape_func   =  /N\-linked.*GlcNAc/.test(dom)    ? "glcnac(b1-4)glcnac" :
                                /GlcNAc/.test(dom)    ? "glcnac" :
                                /GalNAc/.test(dom)    ? "galnac"  :
                                /Fuc/.test(dom)       ? "fuc" :
                                /Man/.test(dom)       ? "man" :
                                /Glc\)/.test(dom)     ? "glc" :
                                /Gal[\.\)]/.test(dom) ? "gal" :
                                /Hex[\.\)]/.test(dom) ? "hex" :
                                /HexNAc/.test(dom)    ? "hexnac" :
                                /Xyl/.test(dom)       ? "xyl" : "?";
            var icon_height = 8;
            if (shape_func == "glcnac(b1-4)glcnac" || shape_func == renderer.small_galnac || shape_func == "xyl" || shape_func == renderer.fuc) {
              icon_height += 8;
            }
            if (/Potential/.test(dom) && (shape_func == "glcnac(b1-4)glcnac")) {
              shape_func += ".potential";
            }
            results[target_layer].push( { "aa" : start, "type" : "marker", "options" : { "height" : icon_height, "content" : '#'+namespace+'_'+shape_func, "offset" : offset+12, "angle": 0, "bare_element" : true  } });
            results[lay_name].push( { "aa" : start, "type" : "marker", "options" : { "height" : 8, "content" : '#'+namespace+'_'+shape_func, "offset" : 12, "bare_element" : true  } });
          } else {
            var all_box;
            var box;
            if (! domains[dom].name) {
              domains[dom].name = dom;
            }
            var dom_key = (domains[dom].name).replace(/\s/g,'_');
            if (window.DOMAIN_DEFINITIONS && window.DOMAIN_DEFINITIONS[dom_key]) {
                var dats = window.DOMAIN_DEFINITIONS[dom_key];
                var fill = (renderer.gradients.length > 0) ? "url('#grad_"+dats[1]+"')" : dats[1];
                results[target_layer].push( { "aa" : start, "type" : "shape", "width": end-start+1, "options" : { "offset" : offset, "height" : height, "shape" : dats[0], "fill" : fill, "rotate" : dats[2] || 0 } });
                results[lay_name].push( { "aa" : start, "type" : "shape", "width": end-start+1, "options" : { "shape" : dats[0], "fill" : 'url("#grad_'+dats[1]+'")' } });

                // all_box.setAttribute('stroke','#999999');
                // all_box.style.strokeWidth = '10px';
            } else {
                results[target_layer].push( { "aa" : start, "type" : "box", "width": end-start+1, "options" : { "offset" : offset, "height" : height } });
                results[lay_name].push( { "aa" : start, "type" : "box", "width": end-start+1, "options" : { } });
            }
            results[target_layer].push( { "aa" : start, "type" : "text", "width" : end-start+1, "options" :{ "txt" : domains[dom].name, "height" : height - 2, "offset" : offset + 1, 'fill' : '#111', 'stroke' : '#999' } });
          }
          done_anno = true;
        });

      });
      renderer.renderObjects(target_layer,results[target_layer]);

      renderer.showLayer(target_layer);
      renderer.trigger('resultsRendered');
      renderer.zoom -= 0.0001;

  };

  var write_sync_timeout = null;

  var edit_toggler = function(renderer,read_only) {
      var needs_edit = renderer.navigation.isEditing();

      if ( read_only ) {
        return;
      }
      renderer.trackOrder.forEach(function(track) {
        if (track.match(/^dom\:/)) {
          if (needs_edit) {
            renderer.showLayer(track);
          } else {
            renderer.hideLayer(track);
          }
        }
      });
      renderer.refresh();
  };

  var reset_protein = function(acc) {
    var self = this;
    self.preferences.getPreferences(function(err,prefs) {
      if ( ! prefs || ! prefs.accepted_domains ) {
        return;
      }
      update_accepted_domains(prefs.accepted_domains,function(err,datablock) {
        datablock[acc] = null;
      });
    });
  };



  MASCP.DomainRetriever.prototype.setupSequenceRenderer = function(renderer,options) {
    var self = this;
    setup_editing.call(self,renderer);
    self.bind('resultReceived',function() {
      self.acc = self.agi;
      get_accepted_domains.call(self,self.agi,function(acc,domains) {
          var temp_result = {
            'gotResult' : function() {
              render_domains(renderer,domains,acc,options.track,options.offset,options.height || 8,options.icons ? options.icons.namespace : null);

              bean.add(renderer.navigation,'toggleEdit',function() {
                if (edit_toggler.enabled) {
                  edit_toggler(renderer);
                }
              });

              // Not sure why we need this call here
              edit_toggler(renderer,true);

              renderer.trigger('domainsRendered');
            },
            'acc'       : acc
          };
          renderer.trigger('readerRegistered',[temp_result]);
          temp_result.gotResult();
      });
    });
  };


  var setup_editing = function(renderer) {
    var self = this;

    self.preferences.getPreferences(function(err,prefs) {

      renderer.clearDataFor = function(acc) {
      };

      check_accepted_domains_writable(prefs.accepted_domains,function(err,writable) {
        if (writable) {
          renderer.clearDataFor = function(acc) {
            reset_protein.call(self,acc);
          };

          edit_toggler.enabled = true;
          var order_changed_func = function(order) {
            console.log("Order changed");
            if ((order.indexOf((self.acc || "").toUpperCase()) == (order.length - 1) && order.length > 0) || ( order.length == 1 && order[0] == (self.acc.toUpperCase()) ) ) {
              console.log(self.acc);
              renderer.clearDataFor(self.acc);
              return;
            }
            if (renderer.trackOrder.length > 0) {
              console.log("Removed layer");
              update_domains.call(self,renderer,self.acc);
            }
          };
          bean.add(renderer,'sequenceChange',function() {
            bean.remove(renderer,'orderChanged',order_changed_func);
          });
          bean.add(renderer,'orderChanged',order_changed_func);
        }
      });
    });
  };

  var update_domains = function(renderer,acc) {
    var self = this;
    var wanted = {};
    renderer.trackOrder.forEach(function(track) {
      if (track.match(/^dom\:/) && renderer.isLayerActive(track)) {
        wanted[track] = 1;
      }
    });
    var wanted_domains = JSON.stringify(wanted);
    self.preferences.getPreferences(function(err,prefs) {
      if ( ! prefs || ! prefs.accepted_domains ) {
        return;
      }
      update_accepted_domains(prefs.accepted_domains,function(err,datablock) {
        datablock[acc] = wanted_domains;
      });
    });
  };


})();






if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

(function() {

  MASCP.EditableReader = MASCP.buildService(function(data) {
    this._raw_data = data;
    return this;
  });

  MASCP.EditableReader.prototype.retrieve = function(acc) {
    if (acc) {
      this.acc = acc;
      this.agi = acc;
    }
    bean.fire(this,'resultReceived');
  };

  var datablockToAnnotations = function(data) {
    var result = [];
    Object.keys(data).forEach(function(key) {
      if (key === 'symbol_map' || key === 'tag_map') {
        return;
      }
      if (data[key] && Array.isArray(data[key])) {
        var array_copy = data[key];
        data[key].forEach(function(anno) {
          anno.acc = key;
        });
        result = result.concat(data[key]);
      }
    });
    return result;
  };

  var annotationsToDatablock = function(annotations) {
    var result = {};
    annotations.forEach(function(anno) {
      if (anno.acc) {
        if ( ! result[anno.acc] ) {
          result[anno.acc] = [];
        }
        result[anno.acc].push(anno);
      }
    });
    return result;
  };

  var mousePosition = function(evt) {
      var posx = 0;
      var posy = 0;
      if (!evt) {
          evt = window.event;
      }

      if (evt.pageX || evt.pageY)     {
          posx = evt.pageX - (document.body.scrollLeft + document.documentElement.scrollLeft);
          posy = evt.pageY - (document.body.scrollTop + document.documentElement.scrollTop);
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

  var svgPosition = function(ev,svgel) {
      var positions = mousePosition(ev.changedTouches ? ev.changedTouches[0] : ev);
      var p = {};
      if (svgel.nodeName == 'svg') {
          p = svgel.createSVGPoint();
          var rootCTM = svgel.getScreenCTM();
          p.x = positions[0];
          p.y = positions[1];

          self.matrix = rootCTM.inverse();
          p = p.matrixTransform(self.matrix);
      } else {
          p.x = positions[0];
          p.y = positions[1];
      }
      return p;
  };

  var bindClick = function(element,handler) {
    if ("ontouchstart" in window) {
      element.addEventListener('touchstart',function(ev) {
        var startX = ev.touches[0].clientX;
        var startY = ev.touches[0].clientY;
        var reset = function() {
          document.body.removeEventListener('touchmove',move);
          element.removeEventListener('touchend',end);
        };
        var end = function(ev) {
          reset();
          ev.stopPropagation();
          ev.preventDefault();
          if (handler) {
            handler.call(null,ev);
          }
        };
        var move = function(ev) {
          if (Math.abs(ev.touches[0].clientX - startX) > 10 || Math.abs(ev.touches[0].clientY - startY) > 10) {
            reset();
          }
        };
        document.body.addEventListener('touchmove', move , false);
        element.addEventListener('touchend',end,false);
      },false);
    } else {
      element.addEventListener('click',handler,false);
    }
  };

  var mouse_start = function(ev) {
    var self = this;
    if (ev.event_data && ev.event_data.annotationid) {
      var annotation = self.getAnnotation(ev.event_data.annotationid);
      if (annotation) {
        self.pieMaker(self.getAnnotation(ev.event_data.annotationid)).call(ev.target,annotation.type !== 'symbol',ev);
        this.renderer._canvas.addEventListener('mousemove',mouse_move,true);
      }
    }
  };
  var mouse_move = function(ev) {
    ev.preventDefault();
    ev.stopPropagation();
  };

  var mouse_click = function(ev) {
    var self = this;
    if (ev.event_data && ev.event_data.annotationid && ev.event_data.annotationid === "potential") {
      var anno = self.potential_annos[0];
      self.potential_annos = [];
      anno.id = (new Date()).getTime();
      delete anno.class;
      self.annotations.push( anno );
      self.renderer.select();
    }
    ev.preventDefault();
    ev.stopPropagation();

  };

  var touch_end = function(ev) {
    var self = this;
    if (ev.event_data && ev.event_data.annotationid) {
      var annotation = self.getAnnotation(ev.event_data.annotationid);
      if (annotation && self.pie_map[ annotation.id ] ) {
        self.pie_map[ annotation.id].end();
        delete self.pie_map [ annotation.id ];
      }
      ev.preventDefault();
    }
  };

  var setup_mouse_events = function(canvas) {
    var self = this;
    this.pie_map = {};

    canvas.addEventListener('mousedown',mouse_start.bind(self),false);
    canvas.addEventListener('touchstart',mouse_start.bind(self),false);
    canvas.addEventListener('click',mouse_click.bind(self),false);
    canvas.addEventListener('touchend',touch_end.bind(self),false);
  };

  var color_content = function(self,annotation,color) {
    return {'symbol' : color, "hover_function" : function() { annotation.color = ""+color+""; } };
  };

  var icon_content = function(self,annotation,symbol) {
    return { 'symbol' : self.symbolTags[symbol], "hover_function" : function() { console.log("Set symbol to "+symbol); annotation.tag = symbol; }  };
  };

  var tag_content = function(self,annotation,tag) {
    return { 'text' : tag, "hover_function" : function() { annotation.tag = tag; }  };
  };

  var trash_content = function(self,annotation) {
    return { 'symbol' :  '#icon_trash', 'text_alt' : 'Delete', "select_function" : function() { self.demoteAnnotation('self',annotation); } };
  };

  MASCP.EditableReader.prototype.generatePieContent = function(type,annotation,vals) {
    var self = this;
    var contents = [];
    vals.forEach(function(val) {
      contents.push(type.call(null,self,annotation,val));
    });
    contents.push(trash_content(self,annotation));
    return contents;
  };

  MASCP.EditableReader.prototype.pieMaker = function(annotation) {
    var self = this;
    return function(set_col,ev) {
      if ( ! ev ) {
        ev = set_col;
        set_col = null;
      }
      ev.preventDefault();
      ev.stopPropagation();
      if (self.pie_map[ annotation.id ]) {
        return;
      }
      var canvas = self.renderer._canvas;
      var pie_contents;
      if ( ! set_col ) {
        if (annotation.type == 'symbol') {
          pie_contents = self.generatePieContent(icon_content,annotation,Object.keys(self.symbolTags));
        }
      } else {
        pie_contents = self.generatePieContent(tag_content,annotation,Object.keys(self.boxTags));
      }
      var click_point = svgPosition(ev,canvas);
      var pie = PieMenu.create(canvas,click_point.x/canvas.RS,click_point.y/canvas.RS,pie_contents,{ "size" : 7, "ellipse" : true });
      self.pie_map[ annotation.id ] = pie;

      var end_pie = function(ev) {
        canvas.removeEventListener('mouseout',end_pie);
        canvas.removeEventListener('mouseup',end_pie);
        canvas.removeEventListener('mousemove',mouse_move,true);
        if (self.pie_map[annotation.id]) {
          self.pie_map[annotation.id].destroy();
          delete self.pie_map[annotation.id];
        }
      };
      self.pie_map[annotation.id].end = end_pie;

      canvas.addEventListener('mouseup',end_pie,false);

    };
  };

  MASCP.EditableReader.prototype.setupSequenceRenderer = function(renderer,options) {
    var self = this;
    var empty_track = function() {
    };
    bean.add(MASCP.getLayer(options.track),'selection', function(start,end) {
      if ( ! start || ! end ) {
        return;
      }
      end += 1;
      self.potential_annos = [ { 'id' : 'potential', 'type' : Math.abs(start - end) <= 1 ? 'symbol' : 'box', 'acc' : self.acc, "length": Math.abs(start-end) ,"index" : Math.min(start,end), "class" : "potential" } ];
      bean.fire(self,'resultReceived');
    });
    if (renderer._canvas) {
      setup_mouse_events.call(self,renderer._canvas);
    }
    renderer.bind('sequenceChange',function() {
      setup_mouse_events.call(self,this._canvas);
    });

    self.renderer = renderer;

    if (! options.renderer ) {
      options.renderer = "var renderData = " + MASCP.EditableReader.renderer.toString();
    }
  };

  if (Object.defineProperty) {
      Object.defineProperty(MASCP.EditableReader.prototype,"result", {
        get: function() {
          var block = this.data;
          if (this.potential_annos && this.potential_annos[0]) {
            if ( ! block[this.potential_annos[0].acc]) {
              block[this.potential_annos[0].acc] = [];
            }
            block[this.potential_annos[0].acc].push(this.potential_annos[0]);
          }
          return { "_raw_data" : { "data" : block } };
        }
      });

      Object.defineProperty(MASCP.EditableReader.prototype,"annotations", {
          get : function() {
            if (! this._annotations ) {
              this._annotations = setupAnnotations(this);
            }
            return this._annotations;
          },
          set : function(annotations) {
            if (! this._annotations ) {
              this._annotations = setupAnnotations(this);
            }
            if (annotations) {
              Array.prototype.splice.apply(this._annotations,[0,this._annotations.length].concat(annotations));
            }
          }
      });
      Object.defineProperty(MASCP.EditableReader.prototype,"data", {
          get : function() {
            var datablock = annotationsToDatablock(this.annotations);
            datablock.symbol_map = this.symbolTags;
            datablock.tag_map = this.boxTags;
            return datablock;
          },
          set : function(data) {
            this.annotations = datablockToAnnotations(data);
          }
      });
      Object.defineProperty(MASCP.EditableReader.prototype,"symbolTags", {
        get: function() {
          return {
            "GalNAc": "#sugar_galnac",
            "Man" : "#sugar_man",
            "Xyl" : "#sugar_xyl",
            "Fuc" : "#sugar_fuc",
            "GlcNAc" : "#sugar_glcnac",
            "N-linked" : "#sugar_glcnac(b1-4)glcnac"
          };
        }
      });
      Object.defineProperty(MASCP.EditableReader.prototype,"boxTags", {
        get: function() {
          if ( ! this._box_tags) {
            this._box_tags = {
              "Red" : "#f00",
              "Green" : "#0f0",
              "Blue" : "#00f"
            };
          }
          return this._box_tags;
        },
        set: function(tags) {
          Object.keys(tags).forEach(function(tag) {
            this._box_tags[tag] = tags[tag];
          });
        }
      });

  }

  var setupAnnotations = function(self) {
    if (! self._annotations ) {
      self._annotations = [];
    }
    if (! self.potential_annos) {
      self.potential_annos = [];
    }

    var new_annotation = function(added,removed) {
      if ((added && added.pie) || (removed && ("pie" in removed) )) {
        return;
      }
      bean.fire(self,'resultReceived');
    };

    var arr_observer = new ArrayObserver(self._annotations);
    self._annotations.forEach(function(ann) {
      (new ObjectObserver(ann)).open(new_annotation);
    });

    arr_observer.open(function(splices) {
      var any_change = false;
      splices.forEach(function(splice) {
        while(splice.addedCount > 0) {
          var ann = self._annotations[splice.index + splice.addedCount - 1];
          (new ObjectObserver(ann)).open(new_annotation);

          if (ann.acc == self.acc) {
            any_change = true;
          }
          splice.addedCount -= 1;
        }
      });

      if (any_change) {
        new_annotation();
      }
    });

    return self._annotations;
  };

  MASCP.EditableReader.prototype.getAnnotation = function(id) {
    for (var type in this.annotations) {
      var annos = this.annotations.filter(function(anno) {
        return anno.id === id;
      });
      if (annos.length == 1) {
        return annos[0];
      }
    }
    return null;
  };

  MASCP.EditableReader.renderer = function(seq,data,acc) {
    var renderAnnotation = function(annotation,symbol_map,tag_map,top_offset) {
      var objects = [];
      var object;

      if (annotation.type == 'symbol' || annotation.length == 1) {
        object = {  'aa'    : annotation.index,
                    'type'  : 'marker',
                    'options':
                    { "content" : symbol_map[annotation.tag] ? symbol_map[annotation.tag] : "X" ,
                      "bare_element" : true,
                      "border" : "#f00",
                      "offset" : 6 + top_offset,
                      "height" : 12
                    }
                  };
        objects.push(object);
      } else {

        var added = [];
        object = { 'aa' : annotation.index, 'type' :'shape', 'width' : annotation.length, 'options' : {"shape" : "rectangle","height" : 4, "offset" : 0 + top_offset } };
        if (tag_map[annotation.tag]) {
          object.options.fill = tag_map[annotation.tag];
        }

        objects.push(object);

        if (annotation.tag) {
          object = { 'aa' : annotation.index+Math.floor(0.5*annotation.length),
                    'type' : 'marker',
                    'options' : {
                    'content' : { 'type' : 'text_circle',
                                  'text' : annotation.tag,
                                  'options' : {
                                    'stretch' : 'right',
                                    'weight' : 'normal',
                                    'fill' : '#000'
                                  },
                                  'opacity' : 0.8,
                                },
                    'offset' : 7.5 + top_offset,
                    'height' : 15,
                    'no_tracer' : true,
                    'bare_element' : true,
                    'tag_marker' : true,
                    'zoom_level' : 'text'
                    }
                   };
          objects.push(object);

        }
      }
      objects.forEach(function(obj) {
        obj.options.events = [{'type' : 'click', 'data' : {  'annotationid' : annotation.id, 'is_annotation' : ! obj.tag_marker } },
                              {'type' : 'mousedown','data' : { 'annotationid' : annotation.id, 'is_annotation' : ! obj.tag_marker } },
                              {'type' : 'touchstart','data' : { 'annotationid' : annotation.id, 'is_annotation' : ! obj.tag_marker } },
                              {'type' : 'touchend','data' : { 'annotationid' : annotation.id, 'is_annotation' : ! obj.tag_marker } }];
      });
      return objects;
    };

    var datablockToAnnotations = function(data) {
      var result = [];
      Object.keys(data).forEach(function(key) {
        if (key === 'symbol_map' || key === 'tag_map') {
          return;
        }
        if (data[key] && Array.isArray(data[key])) {
          var array_copy = data[key];
          data[key].forEach(function(anno) {
            anno.acc = key;
          });
          result = result.concat(data[key]);
        }
      });
      return result;
    };

    var intervalSortAnnotations = function(annotations) {
      var annos = annotations;
      var intervals = [];
      annos.forEach(function(annotation) {
        if (annotation.class === "potential") {
          return;
        }
        var start;
        var end;
        start = annotation.index;
        end = annotation.index + (annotation.length || 1);
        intervals.push({ "index" : start, "start" : true,  "annotation" : annotation });
        intervals.push({ "index" : end, "start" : false , "annotation" : annotation });
      });
      intervals.sort(function(a,b) {
        var sameAcc = (a.annotation.acc || "").localeCompare(b.annotation.acc);
        if (sameAcc !== 0 && a.annotation.acc && b.annotation.acc) {
          return sameAcc;
        }

        if (a.index < b.index ) {
          return -1;
        }
        if (a.index > b.index ) {
          return 1;
        }
        if (a.index == b.index) {
          return a.start ? -1 : 1;
        }
      });
      annos.forEach(function(annotation) {
        if (annotation.class !== 'potential') {
          return;
        }
        var start;
        var end;
        start = annotation.index;
        end = annotation.index + (annotation.length || 1);
        intervals.unshift({ "index" : end, "start" : false , "annotation" : annotation });
        intervals.unshift({ "index" : start, "start" : true,  "annotation" : annotation });
      });

      return intervals;
    };

    var drawAnnotations = function(annotations,symbol_map,tag_map,acc) {
      var wanted_accs = [acc];
      var to_draw = [];

      var sorted_intervals = intervalSortAnnotations(annotations);
      var current_end = -1;

      var needs_to_draw = true;
      var depth = 0;

      while ( needs_to_draw ) {
        needs_to_draw = false;
        for ( var i = 0; i < sorted_intervals.length; i++ ) {
          if ( ! sorted_intervals[i]) {
            continue;
          }
          var annotation = sorted_intervals[i].annotation;

          if (wanted_accs.indexOf(annotation.acc) < 0 ) {
            continue;
          }
          if (annotation.deleted) {
            continue;
          }
          if (sorted_intervals[i].start) {
            if (sorted_intervals[i].index > current_end) {
              current_end = annotation.index + (annotation.length || 1);
              to_draw = to_draw.concat(renderAnnotation(annotation,symbol_map,tag_map,(annotation.class == "potential") ? -1 : depth));
              sorted_intervals[i] = null;
            } else {
              needs_to_draw = true;
            }
          }
        }
        current_end = 0;
        depth += 10;
      }
      return to_draw;
    };
    return drawAnnotations(datablockToAnnotations(data),data.symbol_map,data.tag_map,acc);

  };

})();
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

/**
 * @fileOverview    Retrieve data from the Gator web service
 */

if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

(function() {

var localhosts = ['localhost','10.0.2.2'];
var url_base = localhosts.indexOf(window.location.hostname) >= 0 ? 'https://test.glycocode.com/api' : '/api';
var cloudfront_host = '';

var data_parser =   function(data) {
  var doc = this.datasetname || 'combined';
  if ( ! data || ! data.data ) {
    return this;
  }
  var actual_data = data.data.filter(function(set) {
    return set.dataset.indexOf(doc) >= 0;
  })[0] || {'data' : [] };

  if (doc.split(',').length > 1) {
    doc = doc.split(',');
    var data_by_mime = {};
    data.data.filter(function(set) {
      return doc.indexOf(set.dataset) >= 0;
    }).forEach(function(set) {
        var mimetype = set.metadata.mimetype;
        set.data.forEach(function(dat) {
            dat.dataset = set.dataset;
            dat.acc = set.acc;
            if (set.metadata.sample) {
              dat.species = set.metadata.sample.species;
            }
        })
        data_by_mime[mimetype] = (data_by_mime[mimetype] || []).concat(set.data);
    });
    actual_data = { 'data' : data_by_mime };
  }

  if (doc == 'glycodomain') {
      actual_data = data.data.filter(function(set) {
          return set.metadata.mimetype == 'application/json+glycodomain';
      })[0] || {'data' : [] };
      console.log(actual_data);
  }
  if (doc == 'combined' || doc == 'homology' || doc == 'predictions') {
      var data_by_mime = {};
      data.data.forEach(function(set) {
          var mimetype = set.metadata.mimetype;
          if ( ! mimetype ) {
            return;
          }
          set.data.forEach(function(dat) {
              dat.dataset = set.dataset;
              dat.acc = set.acc;
              if (set.metadata.sample) {
                dat.species = set.metadata.sample.species;
              }
          });
          data_by_mime[mimetype] = (data_by_mime[mimetype] || []).concat(set.data);
      });
      actual_data = { 'data' : data_by_mime };
  }
  if (doc == 'homology') {
    actual_data.alignments = data.data.filter(function(set) { return set.dataset == 'homology_alignment'; })[0].data;
  }
  this._raw_data = actual_data;
  return this;
};

/** Default class constructor
 */
MASCP.GatorDataReader = MASCP.buildService(data_parser);

MASCP.GatorDataReader.prototype.requestData = function() {
  var reader_conf = {
          type: "GET",
          dataType: "json",
          data: { }
      };
  var acc = ( this._requestset || 'combined' ) + '/' + (this.agi || this.acc).toLowerCase();
  var gatorURL = this._endpointURL.slice(-1) == '/' ? this._endpointURL+ acc : this._endpointURL+'/'+acc;
  reader_conf.auth = MASCP.GATOR_AUTH_TOKEN;
  reader_conf.api_key = MASCP.GATOR_CLIENT_ID;
  reader_conf.session_cache = true;
  reader_conf.url = gatorURL;
  return reader_conf;
};

var id_token;

Object.defineProperty(MASCP.GatorDataReader, 'ID_TOKEN', {
  get: function() {
    return id_token;
  },
  set: function(token) {
    id_token = token;
    authenticating_promise = null;
    bean.fire(MASCP.GatorDataReader,'idtoken');
  }
});

var is_anonymous;

Object.defineProperty(MASCP.GatorDataReader, 'anonymous', {
  get: function() {
    return is_anonymous;
  },
  set: function(anon) {
    is_anonymous = anon;
    id_token = null;
    authenticating_promise = null;
  }
});

var authenticating_promise;

var anonymous_login = function() {
  return new Promise(function(resolve,reject) {
      MASCP.Service.request({'url' : url_base + '/login?cachebuster='+(new Date()).getTime(),
                             'type' : 'GET'
                            },function(err,token) {
        if (err) {
          reject(err);
        } else {
          var auth_token = JSON.parse(token);
          if (typeof auth_token == 'string') {
            auth_token = { id_token: auth_token };
          }
          MASCP.GatorDataReader.ID_TOKEN = auth_token.id_token;
          resolve(url_base);
        }
      },true);
    });
};

var reading_was_ok = true;

var reauth_reader = function(reader_class) {
  var current_retrieve = reader_class.prototype.retrieve;
  reader_class.prototype.retrieve = function() {
    var current_arguments = [].slice.call(arguments);
    var self = this;
    this.bind('error',function(err) {
      if (err.status == 401 || err.status == 403) {
        if ( ! self.tried_auth ) {
          self.unbind('error');
          self.tried_auth = true;
          if (reading_was_ok) {
            delete MASCP.GATOR_AUTH_TOKEN;
            MASCP.GatorDataReader.ID_TOKEN = null;
            authenticating_promise = null;
            bean.fire(MASCP.GatorDataReader,'unauthorized');
            reading_was_ok = false;
          }
          authenticate_gator().catch(function(err) {
            console.log("Error after auth",err);
            throw err;
          }).then(function() {
            reading_was_ok = true;
            self.retrieve.apply(self,current_arguments);
          }).catch(function(err) {
            console.log("Died on doing the reauth",err);
          });
        }
      }
    });
    current_retrieve.apply(self,current_arguments);
  };
};

reauth_reader(MASCP.GatorDataReader);


window.addEventListener("unhandledrejection", function(err, promise) {
  if (err.reason && err.reason.message == 'Unauthorized' && ! err.reason.handled) {
    err.reason.handled = true;
    bean.fire(MASCP.GatorDataReader,'unauthorized');
    return;
  }
  console.log(err);
});

var authenticate_gator = function() {
    if (authenticating_promise) {
      return authenticating_promise;
    }
    // Need to put this somewhere for the moment
    // Temporary code until we move to a single host
    MASCP.ClustalRunner.SERVICE_URL = url_base + '/tools/clustal';
    MASCP.UniprotReader.SERVICE_URL = url_base + '/data/latest/uniprot';
    if ( ! MASCP.UniprotReader.reauthed ) {
      reauth_reader(MASCP.UniprotReader);
    }
    MASCP.UniprotReader.reauthed = true;

    if ( ! MASCP.GatorDataReader.ID_TOKEN && MASCP.GatorDataReader.anonymous ) {
      console.log("Doing an anonymous login");
      authenticating_promise = anonymous_login().then(function() { authenticating_promise = null; }).then(authenticate_gator);
      return authenticating_promise;
    }

    if ( ! MASCP.GatorDataReader.ID_TOKEN && ! MASCP.GatorDataReader.anonymous ) {
      console.log("We cannot log in without an ID TOKEN, waiting for token");

      authenticating_promise = new Promise(function(resolve,reject) {
        var resolver = function() {
          console.log("Got a new ID token");
          bean.remove(MASCP.GatorDataReader,'idtoken',resolver);
          MASCP.GATOR_AUTH_TOKEN = MASCP.GatorDataReader.ID_TOKEN;
          resolve(url_base);
        };
        bean.add(MASCP.GatorDataReader,'idtoken',resolver);
        setTimeout(function() {
          console.log("Timed out logging in");
          reject(new Error('Timed out'));
        },5000);
      });
      return authenticating_promise;
    }

    authenticating_promise = new Promise(function(resolve,reject) {
      setTimeout(function() {
        MASCP.GATOR_AUTH_TOKEN = MASCP.GatorDataReader.ID_TOKEN;
        bean.fire(MASCP.GatorDataReader,'auth',[url_base]);
        resolve(url_base);
      },0);
    });

    return authenticating_promise;
};

MASCP.GatorDataReader.prototype.setupSequenceRenderer = function(renderer) {
    var self = this;
    if (this.datasetname !== 'homology') {
      return;
    }
    renderer.forceTrackAccs = true;
    renderer.addAxisScale('homology',function(pos,accession,inverse) {
        if ( ! self.result || self.agi === accession.name || self.acc === accession.name ) {
          return pos;
        }
        if ( inverse ) {
            return self.result.calculateSequencePositionFromPosition(self.agi || self.acc,accession.name.toLowerCase(),pos);
        }
        return self.result.calculatePositionForSequence(self.agi || self.acc,accession.name.toLowerCase(),pos);
    });
};


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
};

MASCP.GatorDataReader.Result.prototype.makeSequences = function(ref_acc,alignments) {
  var seqs = [];
  var insertions = [];
  var accs = [];
  var ref_cigar = '';
  alignments.forEach(function(align) {
    if ( ! align.cigar && align.cigar_line) {
      align.cigar = align.cigar_line;
      delete align.cigar_line;
    }
    // If the cigar line hasn't already been revivified
    if (! align.cigar.match(/^[\-\.]*$/)) {
      // Expand out the cigar line replacing M with . and D with -
      align.cigar = align.cigar.match(/\d*[MD]/g)
                         .map(function(bit) {
                            return new Array((parseInt(bit.slice(0,-1)) || 1)+1).join( bit.slice(-1) == 'M' ? '.' : '-' );
                         }).join('');
    }
    if (align.uniprot !== ref_acc.toUpperCase()) {
      accs.push(align.uniprot);
      seqs.push(align.cigar)
    } else {
      ref_cigar = align.cigar;
    }
  });
  var aligning_seq = ref_cigar, i = aligning_seq.length - 1;
  for (i; i >= 0; i--) {
      if (aligning_seq.charAt(i) == '-') {
          splice_char(seqs,i,insertions);
      }
  }
  for (i = 0; i < seqs.length; i++) {
      if (insertions[i]) {
          insertions[i] = normalise_insertions(insertions[i]);
          var seq = seqs[i];
          seqs[i] = { 'sequence' : seq, 'insertions' : insertions[i] };
          seqs[i].toString = function() {
              return this.sequence;
          };
      }
  }
  var result = {};
  accs.forEach(function(acc,idx) {
    result[acc.toLowerCase()] = seqs[idx];
  });
  result[ref_acc.toLowerCase()] = ref_cigar.replace('-','');
  return result;
};
})();


MASCP.GatorDataReader.Result.prototype.calculatePositionForSequence = function(ref_acc,idx,pos) {
  if (ref_acc.toLowerCase() === idx.toLowerCase()) {
    return pos;
  }
  if ( ! this.sequences ) {
    this.sequences = this.makeSequences(ref_acc,this._raw_data.alignments);
  }

  var inserts = this.sequences[idx.toLowerCase()].insertions || {};
  var result = pos;
  var actual_position = 0;
  var seq = this.sequences[idx.toLowerCase()].toString();
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
              if (i == 0) {
                  i = 1;
              }
              return -1 * i;
          }
      }
  }
  return -1 * seq.length;
};

MASCP.GatorDataReader.Result.prototype.calculateSequencePositionFromPosition = function(ref_acc,idx,pos) {
  if (ref_acc.toLowerCase() === idx.toLowerCase()) {
    return pos;
  }
  if ( ! this.sequences ) {
    this.sequences = this.makeSequences(ref_acc,this._raw_data.alignments);
  }
  var inserts = this.sequences[idx.toLowerCase()].insertions || {};
  var result = pos;
  var actual_position = 0;
  var seq = this.sequences[idx.toLowerCase()].toString();
  for (var i = 0 ; i < pos; i++ ) {
      if (inserts[i]) {
          actual_position += inserts[i].length;
      }
      actual_position += 1;
      if (seq.charAt(i) == '-') {
          actual_position -= 1;
      }
  }
  if (actual_position == 0) {
      actual_position += 1;
  }
  return actual_position;
};




var default_result_proto = MASCP.GatorDataReader.Result.prototype;

Object.defineProperty(MASCP.GatorDataReader.prototype, 'datasetname', {
    get: function() {
      return this._datasetname;
    },
    set: function(value) {
      this._datasetname = value;
      this._requestset = (value === 'homology') ? 'homology' : 'combined';
      var alt_result = function(data) {
        this.datasetname = value;
        MASCP.GatorDataReader.Result.apply(this,[data]);
        return this;
      };
      alt_result.prototype = default_result_proto;
      this.__result_class = alt_result;
    }
});
MASCP.GatorDataReader.authenticate = function() {
  return authenticate_gator();
};

var running_promises = {};

var new_retrieve = function(acc) {
  var self = this;
  var orig_arguments = [].slice.call(arguments);
  if (running_promises[acc+'-'+this._requestset]) {
    running_promises[acc+'-'+this._requestset].then(function(result) {
      MASCP.GatorDataReader.prototype.retrieve.apply(self,orig_arguments);
    }).catch(function(err) {
      authenticate_gator().then(function(){
        new_retrieve.apply(self,orig_arguments);
      });
    });
    return;
  }
  running_promises[acc+'-'+this._requestset] = new Promise(function(resolve,reject) {
    self.bind('resultReceived',resolve);
    self.once('error',reject);
  });

  running_promises[acc+'-'+this._requestset].catch(function(err) {
    authenticate_gator().then(function(){ running_promises[acc+'-'+self._requestset] = null });
  });

  MASCP.GatorDataReader.prototype.retrieve.apply(self,orig_arguments);
};

MASCP.GatorDataReader.createReader = function(doc) {
    // Do the auth dance here

    var reader = new MASCP.GatorDataReader(null,url_base+'/data/latest/');
    console.log(doc);
    reader.datasetname = doc;
    // MASCP.Service.CacheService(reader);

    authenticate_gator().then(function() {
      reader.retrieve = new_retrieve;
      bean.fire(reader,'ready');
    });

    return reader;
};

})();
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

/** @fileOverview   Classes for reading data from MyGene.info */
if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

/** Default class constructor
 *  @class      Service class that will retrieve data from Mygene.info for given sequences
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.GenomeReader = MASCP.buildService(function(data) {
                        this._raw_data = data;
                        return this;
                    });

MASCP.GenomeReader.SERVICE_URL = 'http://mygene.info/v2/query';
MASCP.GenomeReader.prototype.requestData = function()
{
    this.acc = this.agi;

    if (! this.geneid ) {
        return {
            type: "GET",
            dataType: "json",
            url : 'http://mygene.info/v2/query',
            data: { 'q' : 'uniprot:'+this.acc.toUpperCase(),
                    'fields'   : 'entrezgene',
                    'email'    : 'joshi%40sund.ku.dk'
            }
        };
    } else if ( ! this.acc ) {
        this.acc = this.agi = ""+this.geneid;
    }

    if (! this.exons ) {
        return {
            type: "GET",
            url : 'http://mygene.info/v2/gene/'+this.geneid,
            dataType: "json",
            data: {
                'fields' : 'exons_hg19'
            }
        };
    }

    return {
        type: "GET",
        dataType: "txt",
        url: "http://www.uniprot.org/mapping/",
        data : {
            "from" : "REFSEQ_NT_ID",
            "to" : "ACC",
            "format" : "tab",
            "query" : Object.keys(this.exons).join(' ')
        }
    };
};

(function(serv) {
    var defaultDataReceived = serv.prototype._dataReceived;

    serv.prototype._dataReceived = function(data,status)
    {
        var self = this;
        if (data.data && status === "db") {
            self.sequences = [{ "agi" : "genome" }];
            Object.keys(data.data).forEach(function(uniprot) {
                self.sequences.push({ "agi" : uniprot.toLowerCase() });
            });
            return defaultDataReceived.call(this,data,status);
        }
        if (status < 200 || status >= 400) {
            return defaultDataReceived.call(this,null,status);
        }

        if ( ! this.geneid) {
            this.geneid = data.hits[0].entrezgene;
            this.retrieve(this.acc || this.agi);
            return;
        }
        if ( ! this.exons ) {
            this.exons = data.exons_hg19 || data.exons;
            if ( ! this.nt_mapping ) {
                this.retrieve(this.acc || this.agi);
                return;
            }
            data = this.nt_mapping.map(function(map) { return map.join('\t'); } ).join('\n');
        }
        var mapped = {};
        self.sequences = [{ "agi" : "genome" }];
        (data || "").split('\n').forEach(function(row) {
            var bits = row.split('\t');
            if ( ! bits[1]) {
                return;
            }
            var uniprot = bits[1].toLowerCase();
            var nuc = bits[0];
            nuc = nuc.replace(/\..*$/,'');
            if (! self.exons[nuc]) {
                return;
            }
            if (! self.agi || ! self.acc) {
                self.acc = uniprot;
                self.agi = uniprot;
            }

            if ( ! mapped[uniprot] ) {
                mapped[uniprot] = [];
            }
            self.exons[nuc]._id = nuc;
            mapped[uniprot].push(self.exons[nuc]);
            self.sequences.push({ "agi" : uniprot.toLowerCase() });
        });
        return defaultDataReceived.call(this,{"data":mapped},status);
    };
})(MASCP.GenomeReader);


MASCP.GenomeReader.Result.prototype.getSequences = function() {
    var results = [];
    var cds_data = this._raw_data.data;
    var uniprots = Object.keys(cds_data);
    var min = max = null;
    uniprots.forEach(function(uniprot) {
        var ends = cds_data[uniprot].map(function(cd) {
            if ( Array.isArray(cd) ) {
                cd = cd.filter(function(c) { return c.chr.match(/^[\dXx]+$/ ); })[0];
            }
            return [ cd.txstart, cd.txend ];
        });
        ends.forEach(function(cd) {
            if (! min || cd[0] < min) {
                min = cd[0];
            }
            if (! max || cd[1] > max) {
                max = cd[1];
            }
        });
    });
    results = [ Array( Math.floor( (max - min) / 3 ) ).join('.') ];
    this.min = min;
    this.max = max;
    return results;
};

MASCP.GenomeReader.Result.prototype.getIntrons = function(margin) {
    var self = this;
    var results = [];
    var uprots = Object.keys(self._raw_data.data);
    uprots.forEach(function(up) {
        var cds = self._raw_data.data[up];
        cds.forEach(function(target_cds) {
            if ( Array.isArray(target_cds) ) {
                target_cds = target_cds.filter(function(c) { return c.chr.match(/^[\dXx]+$/ ); })[0];
                if ( ! target_cds ) {
                    return null;
                }
            }

            var exons = target_cds.exons;
            var target_position;

            for (var i = 0; i < exons.length; i++) {
                if (i == 0) {
                    results.push([ self.min, exons[i][0] - margin ]);
                } else {
                    results.push([ exons[i-1][1] + margin, exons[i][0] - margin]);
                }
                if (i == (exons.length - 1)) {
                    results.push([ exons[i][1] + margin, self.max ]);
                }
                if (results.slice(-1)[0][0] > results.slice(-1)[0][1]) {
                    results.splice(results.length - 1,1);
                }
            }
        });
    });
    return results;
};

MASCP.GenomeReader.prototype.proteinLength = function(target_cds) {
    var exons = target_cds.exons;
    var total = 0;
    for (var i = 0; i < exons.length; i++) {
        if (target_cds.cdsstart > exons[i][1] & target_cds.cdsstart > exons[i][0]) {
            continue;
        }
        if (target_cds.cdsend < exons[i][0]) {
            continue;
        }

        var start = target_cds.cdsstart > exons[i][0] ? target_cds.cdsstart : exons[i][0];
        var end = target_cds.cdsend < exons[i][1] ? target_cds.cdsend : exons[i][1];
        total += (end - start);
    }
    return Math.floor(total/3)-1;
};

MASCP.GenomeReader.prototype.calculateSequencePositionFromProteinPosition = function(idx,pos) {
    var self = this;
    var wanted_identifier = idx;
    var cds = self.result._raw_data.data[wanted_identifier.toLowerCase()];
    if (! cds ) {
        return -1;
    }

    if (! cds.txstart ) {
        cds = cds.map( function(cd) {
            if ( Array.isArray(cd) ) {
                cd = cd.filter(function(c) { return c.chr.match(/^[\dXx]+$/ ); })[0];
                if ( ! cd ) {
                    return null;
                }
            }
            return cd;
        });
    }

    var target_cds = cds[0] || {};
    var exons = target_cds.exons || [];

    var position_genome = Math.floor(pos / 3);


    var target_position = 0;

    if (pos < target_cds.cdsstart) {
        target_position = 6;
        if (target_cds.strand == -1) {
            target_position = 3;
        }
    }

    if (pos > target_cds.cdsend) {
        target_position = self.proteinLength(target_cds) * 3;
        if (target_cds.strand == 1) {
            target_position += 3;
        }
    }
    if ( target_position == 0) {
        for (var i = 0; i < exons.length; i++) {
            if (target_cds.cdsstart > exons[i][1] & target_cds.cdsstart > exons[i][0]) {
                continue;
            }
            var start = target_cds.cdsstart > exons[i][0] ? target_cds.cdsstart : exons[i][0];
            var end = target_cds.cdsend < exons[i][1] ? target_cds.cdsend: exons[i][1];

            if (pos < start) {
                break;
            }

            if (pos <= end && pos >= start) {
                target_position += (pos - start);
                break;
            } else {
                target_position += end - start;
            }
        }
    }
    target_position = Math.floor(target_position / 3) - 1;

    if (target_cds.strand == -1) {
        target_position = self.proteinLength(target_cds) - target_position;
    }

    return target_position;
};

MASCP.GenomeReader.prototype.calculateProteinPositionForSequence = function(idx,pos) {
    var self = this;
    var wanted_identifier = idx;
    var cds = self.result._raw_data.data[wanted_identifier.toLowerCase()];
    if (! cds ) {
        return -1;
    }

    if (! cds.txstart ) {
        cds = cds.map( function(cd) {
            if ( Array.isArray(cd) ) {
                cd = cd.filter(function(c) { return c.chr.match(/^[\dXx]+$/ ); })[0];
                if ( ! cd ) {
                    return null;
                }
            }
            return cd;
        });
    }

    var target_cds = cds[0] || {};
    var exons = target_cds.exons || [];

    if (target_cds.strand == -1) {
        pos = self.proteinLength(target_cds) - pos;
    }
    var position_genome = pos * 3;


    var target_position;

    for (var i = 0; i < exons.length; i++) {
        if (target_cds.cdsstart > exons[i][1] & target_cds.cdsstart > exons[i][0]) {
            continue;
        }
        var start = target_cds.cdsstart > exons[i][0] ? target_cds.cdsstart : exons[i][0];
        var bases = (exons[i][1] - start);
        if (bases >= position_genome) {
            target_position = start + position_genome;
            break;
        } else {
            position_genome -= bases;
        }
    }
    return target_position;
};

MASCP.GenomeReader.prototype.calculatePositionForSequence = function(idx,pos) {
    var self = this;
    var wanted_identifier = self.sequences[idx].agi;
    var empty_regions =  [];
    var calculated_pos = pos;

    if (wanted_identifier == 'genome') {
    // Don't change the genome identifier
    } else {
        calculated_pos = self.calculateProteinPositionForSequence(idx,pos);
    }

    for (var i = 0; i < empty_regions.length; i++) {
        if (pos > empty_regions[i][1]) {
            calculated_pos -= (empty_regions[i][1] - empty_regions[i][0]);
        }
        if (pos < empty_regions[i][1] && pos > empty_regions[i][0]) {
            calculated_pos = -1;
        }
    }

    return (calculated_pos);
};

(function(serv) {
    var get_exon_boxes = function(result) {
        var cds_data = result._raw_data.data;
        var uniprots = Object.keys(cds_data);
        var max = result.max;
        var min = result.min;
        var return_data = [];
        var base_offset = 0;
        uniprots.forEach(function(uniprot) {
            var ends = cds_data[uniprot].map(function(cd,idx) {
                if ( Array.isArray(cd) ) {
                    cd = cd.filter(function(c) { return c.chr.match(/^[\dXx]+$/ ); })[0];
                    if ( ! cd ) {
                        return;
                    }
                }

                var exons = cd.exons;
                var color = (idx == 0) ? '#999' : '#f99';
                exons.forEach(function(exon) {
                    return_data.push({ "aa": 1+exon[0], "type" : "box" , "width" : exon[1] - exon[0], "options" : { "offset" : base_offset, "height_scale" : 1, "fill" : color, "merge" : false  }});
                    if (cd.strand  > 0) {
                        return_data.push({ "aa": exon[1] - 1, "type" : "marker", "options" : { "height" : 4, "content" : {"type" : "right_triangle", "fill" : '#aaa' }, "offset" : base_offset+2, "bare_element" : true }});
                    } else {
                        return_data.push({ "aa": exon[0] + 1, "type" : "marker", "options" : { "height" : 4, "content" : {"type" : "left_triangle", "fill" : '#aaa' }, "offset" : base_offset+2, "bare_element" : true }});
                    }
                });
                return_data.push({"aa" : cd.cdsstart, "type" : "box" , "width" : 1, "options" : { "fill" : "#0000ff", "height_scale" : 2, "offset" : base_offset - 2 , "merge" : false } });
                return_data.push({"aa" : cd.cdsend, "type" : "box" , "width" : 1, "options" : { "fill" : "#0000ff", "height_scale" : 2, "offset" : base_offset  - 2, "merge" : false } });
                base_offset += 1;

            });
            base_offset += 2;
        });
        return return_data;
    };

    var get_removed_labels = function(result) {
        var removed = result.removed_regions || [];
        var results = [];
        var max = result.max;
        var min = result.min;
        var cds_data = result._raw_data.data;
        var uniprots = Object.keys(cds_data);
        var total = uniprots.reduce(function(prev,up) { return prev + cds_data[up].length;  },0);
        removed.forEach(function(vals) {
            var start = vals[0];
            var end = vals[1];
            var start_txt = Math.floor ( (start % 1e6 ) / 1000)+"kb";
            var end_txt = Math.floor ( (end % 1e6 ) / 1000)+"kb";

            results.push({"aa" : start - 3, "type" : "text", "options" : {"txt" : start_txt, "fill" : "#000", "height" : 4, "offset" : -5*total, "align" : "right" } });
            results.push({"aa" : end + 3, "type" : "text", "options" : {"txt" : end_txt, "fill" : "#000", "height" : 4, "offset" : total*5, "align" : "left" } });
            results.push({"aa" : start - 1, "type" : "box", width : (end - start) + 3, "options" : {"fill" : "#999", "height_scale" : total*3, "offset" : -1*total } });
        });
        return results;
    };

    var calculate_removed_regions = function(result,margin) {
        var introns =  result.getIntrons(margin);

        var intervals = [{ "index" : result.min - 2, "start" : true, "idx" : -1 } , {"index" : result.min, "start" : false, "idx" : -1 }];
        introns.forEach(function(intron,idx) {
            intervals.push({ "index" : intron[0], "start" : true,  "idx" : idx });
            intervals.push({ "index" : intron[1], "start" : false , "idx" : idx });
        });

        intervals.sort(function(a,b) {
            if (a.index < b.index ) {
                return -1;
            }
            if (a.index > b.index ) {
                return 1;
            }
            if (a.index == b.index) {
                return a.start ? -1 : 1;
            }
        });
        var results = [];
        intervals.forEach(function(intr,idx) {
            if (intr.start && intervals[idx+1] && intervals[idx+1].start == false) {
                if (intr.index != intervals[idx+1].index && intervals[idx+1].index != result.min) {
                    results.push( [intr.index , intervals[idx+1].index ]);
                }
            }
        });
        result.removed_regions = results;
    };
    var generate_scaler_function = function(reader) {
        return function(in_pos,layer,inverse) {
            var pos = in_pos;

            if ( ! reader.result ) {
                return inverse ? (pos * 3) : Math.floor(pos / 3);
            }

            var introns = reader.result.removed_regions || [];

            if (inverse) {
                pos = (in_pos * 3);
                calculated_pos = pos;
                for (var i = 0; i < introns.length && pos > 0; i++) {
                    var left_exon = i > 0 ? introns[i-1] : [null,reader.result.min];
                    var right_exon = introns[i] || [reader.result.max,null];
                    pos -= (right_exon[0] - left_exon[1]);
                    if (pos > 0) {
                        calculated_pos += introns[i][1] - introns[i][0];
                    }
                }
                return calculated_pos + reader.result.min;
            }

            var calculated_pos = pos - reader.result.min;
            for (var i = 0; i < introns.length; i++) {
                if (pos > introns[i][1]) {
                    calculated_pos -= (introns[i][1] - introns[i][0]);
                }
                if (pos < introns[i][1] && pos > introns[i][0]) {
                    calculated_pos = (introns[i][1] - reader.result.min);
                }
            }
            if (calculated_pos < 3) {
                calculated_pos = 3;
            }
            return (Math.floor(calculated_pos / 3));
        };
    };
    Object.defineProperty(serv.prototype, 'exon_margin', {
        set: function(val) {
            this._exon_margin = val;
            if (this.result) {
                calculate_removed_regions(this.result,val);
                this.redrawIntrons();
            }
        },
        get: function() { return this._exon_margin; }
    });

    var redrawIntrons = function(renderer,controller_name,scaler_function) {
        var labs = [];
        var zoomCheck = function() {
            if (labs.length < 1 || ! labs[0].parentNode) {
                return;
            }
            var hidden = false;
            for (var i = 0 ; ! hidden && i < (labs.length - 3); i += 3) {
                if (labs[i].hasAttribute('display')) {
                    hidden = true;
                    continue;
                } 
                if (labs[i].getBoundingClientRect().right > labs[i+3].getBoundingClientRect().left) {
                    hidden = true;
                }
            }
            labs.forEach(function(lab) { if(lab.nodeName == 'rect') { return; } if (hidden) { lab.setAttribute('display','none') } else { lab.removeAttribute('display') } });
        };
        renderer.bind('zoomChange',zoomCheck);

        return function() {
            var result = this.result;
            renderer.sequence = Array( scaler_function(result.max)).join('.');

            if (labs.length > 0) {
                labs.forEach(function(lab) {
                    renderer.remove(controller_name,lab);
                });
                labs = [];
            }
            var proxy_reader = {
                agi: controller_name,
                gotResult: function() {
                    labs = renderer.renderObjects(controller_name,get_removed_labels(result));
                    renderer.refresh();
                    zoomCheck();
                }
            };
            MASCP.Service.prototype.registerSequenceRenderer.call(proxy_reader,renderer);
            proxy_reader.gotResult();
        };
    };

    serv.prototype.setupSequenceRenderer = function(renderer) {
        var self = this;
        renderer.addAxisScale('genome',function(pos,layer,inverse) {
            if (layer && layer.genomic) {
                return pos;
            }
            if (inverse) {
                return self.calculateSequencePositionFromProteinPosition(layer.name,pos);
            }
            return self.calculateProteinPositionForSequence(layer.name,pos);
        });
        var controller_name = 'cds';
        var redraw_alignments = function(sequence_index) {
            if ( ! sequence_index ) {
                sequence_index = 0;
            }
            MASCP.registerLayer(controller_name, { 'fullname' : 'Exons', 'color' : '#000000' });
            MASCP.getLayer(controller_name).genomic = true;

            if (renderer.trackOrder.indexOf(controller_name) < 0) {
                renderer.trackOrder.push(controller_name);
            }
            renderer.showLayer(controller_name);

            var result = this.result;

            var aligned = result.getSequences();
            var scaler_function = generate_scaler_function(self);

            renderer.addAxisScale('removeIntrons',scaler_function);

            calculate_removed_regions(self.result,self.exon_margin || 300);

            if ( ! renderer.sequence ) {
                // Not sure what to do with this bit here

                renderer.setSequence(Array( scaler_function(result.max) ).join('.'))(function() {
                    redraw_alignments(sequence_index);
                });
                return;
            } else {
                renderer.sequence = Array( scaler_function(result.max)).join('.');
                renderer.redrawAxis();
            }
            var proxy_reader = {
                agi: controller_name,
                gotResult: function() {
                    renderer.renderObjects(controller_name,get_exon_boxes(result));
                }
            };
            MASCP.Service.prototype.registerSequenceRenderer.call(proxy_reader,renderer);
            proxy_reader.gotResult();

            self.redrawIntrons = redrawIntrons(renderer,controller_name,scaler_function);
            self.redrawIntrons();
        };

        this.bind('resultReceived',redraw_alignments);

    };

})(MASCP.GenomeReader);




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

var url_base = '';
var cloudfront_host = '';

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
    var query = encodeURIComponent("title='"+filename+"' and 'appfolder' in parents");
    //# and mimeType = '"+mime+"' and trashed = false");
    do_request("www.googleapis.com","/drive/v2/files?q="+query,null,function(err,data) {

        if (cached_files[filename] && callback) {
            callback.call(null,null,cached_files[filename]);
            return;
        }

        if (err && err.status == 401) {
            delete MASCP["GOOGLE_AUTH_TOKEN"];
        }

        if (err) {
            if (callback) {
                callback.call(null,err);
            }
            return;
        }

        if (data.items.length == 0) {
            cached_files[filename] = {};
            if (callback) {
                callback.call(null,null,cached_files[filename]);
            }
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
        if ( ! loggedOut ) {
            var desired_scopes = MASCP.GOOGLE_SCOPES ? MASCP.GOOGLE_SCOPES : scope;
            var auth_settings = { client_id : MASCP.GOOGLE_CLIENT_ID, scope : desired_scopes, immediate : true, response_type: 'token id_token' };
            gapi.auth.authorize(auth_settings,function(result) {
                callback.call(null,null,! result.status.signed_in);
            });
        } else {
            callback.call(null,null,loggedOut);
        }
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
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";
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

    var request_body = delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify({'mimeType' : mime }) +
        delimiter +
        'Content-Type: ' + mime + '\r\n' +
        '\r\n' +
        string_rep +
        '\r\n' +
        close_delim;

    var req = gapi.client.request({
        'path' : "/upload/drive/v2/files/"+item_id,
        'method' : "PUT",
        'params' : { "uploadType" : "multipart" },
        'headers' : { 'Content-Type' : 'multipart/mixed; boundary="' + boundary + '"' }, //headers_block,
        'body' : request_body
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
    do_request("www.googleapis.com","/drive/v2/files/"+doc_id+"?fields=mimeType,title,fileExtension",null,function(err,data) {
        var mime = (data || {}).mimeType;
        if (mime) {
            mime = mime.replace(/\s+charset=[^\s]+/i,'');
        }
        callback.call(null,err,err ? null : mime ,err ? null : (data || {}).title, err? null : (data || {}).fileExtension );
    });
};

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
    // We should be tracking this bug here:
    // http://stackoverflow.com/questions/15579079/cannot-share-document-in-google-drive-with-per-file-auth-scope
    scope = "openid profile email https://www.googleapis.com/auth/drive.install https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive";

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
        var desired_scopes = MASCP.GOOGLE_SCOPES ? MASCP.GOOGLE_SCOPES : scope;
        var auth_settings = { client_id : MASCP.GOOGLE_CLIENT_ID, scope : desired_scopes, immediate : true, response_type: 'token id_token' };
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
            } else if (result && result.error && result.error !== 'immediate_failed') {
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
            if (etag && req_method !== 'PUT' && ! req_method.match(/:/)) {
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
    return get_file(prefs_domain,"application/json+domaintool-session",callback);
};

MASCP.GoogledataReader.prototype.writePreferences = function(prefs_domain,callback) {
    return write_file(prefs_domain,"application/json+domaintool-session",callback);
};

MASCP.GoogledataReader.prototype.createPreferences = function(folder,callback) {
    return create_file({ "parent" : folder, "content" : {}, "name" : "New annotation session.domaintoolsession" }, "application/json+domaintool-session",function(err,content,file_id) {
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
            return;
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
            if (datablock && datablock.metadata && datablock.metadata.length > 0 && datablock.metadata[0]['msdata-version']) {
                done_setup = true;
                prefs.user_datasets[reader.datasetname] = prefs.user_datasets[reader.datasetname] || {};
                prefs.user_datasets[reader.datasetname].parser_function = parser_function.toString();
                prefs.user_datasets[reader.datasetname].title = title;
                prefs.user_datasets[reader.datasetname].type = "dataset";
                if (datablock && datablock.defaults) {
                    prefs.user_datasets[reader.datasetname].render_options = datablock.defaults;
                } else {
                    prefs.user_datasets[reader.datasetname].render_options = {
                        'renderer' : 'msdata:default:'+datablock.metadata[0]['msdata-version'],
                        'track' : title,
                        'icons' : '/sugars.svg'
                    };
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

MASCP.GoogledataReader.prototype.newBackendReader = function(doc) {
    // Do the auth dance here

    var reader_conf = {
            type: "GET",
            dataType: "json",
            data: { }
        };

    var reader = new MASCP.UserdataReader(null,url_base+'/data/latest/combined/');

    reader.datasetname = 'combined';
    reader.requestData = function() {
        var agi = this.agi.toLowerCase();
        var gatorURL = this._endpointURL.slice(-1) == '/' ? this._endpointURL+agi : this._endpointURL+'/'+agi;
        reader_conf.url = gatorURL;
        return reader_conf;
    };
    reader._dataReceived = function(data,status) {
        var actual_data = data.data.filter(function(set) {
            return set.dataset.indexOf(doc) >= 0;
        })[0];
        if (doc == 'glycodomain') {
            actual_data = data.data.filter(function(set) {
                return set.metadata.mimetype == 'application/json+glycodomain';
            })[0];
            console.log(actual_data);
        }
        if (doc == 'combined') {
            var data_by_mime = {};
            data.data.forEach(function(set) {
                var mimetype = set.metadata.mimetype;
                set.data.forEach(function(dat) {
                    dat.dataset = set.dataset;
                })
                data_by_mime[mimetype] = (data_by_mime[mimetype] || []).concat(set.data);
            });
            actual_data = { 'data' : data_by_mime };
        }
        var return_value = Object.getPrototypeOf(reader)._dataReceived.call(reader,actual_data,status);
        if (return_value) {
            reader.result._raw_data = actual_data;
        }
        console.log(return_value);
        return return_value;
    };
    // MASCP.Service.CacheService(reader);

    MASCP.GatorDataReader.authenticate.then(function() {
        reader_conf.auth = MASCP.GATOR_AUTH_TOKEN;
        bean.fire(reader,'ready');
    });

    return reader;
};

/*
map = {
    "peptides" : "column_a",
    "sites"    : "column_b",
    "id"       : "uniprot_id"
}
*/
MASCP.GoogledataReader.prototype.createReader = function(doc, map) {
    return this.newBackendReader(doc);
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
};
/** @fileOverview   Classes for reading data from the P3db database
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
};
/**
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
};
/** @fileOverview   Classes for reading data from the Phosphat database
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
};
/** @fileOverview   Classes for reading data from the Promex database
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
};
/** @fileOverview   Classes for reading data from the Rippdb database
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
};
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
};
/**
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
};
/** @fileOverview   Classes for reading data from the Cdd tool
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
        var h2_keys = Object.keys(h2.data);
        h2_keys.forEach(function(key) {
            if (key == "tmhmm-TMhelix" && h1.data["uniprot-TMhelix"]) {
                delete h1.data["uniprot-TMhelix"];
            }
            h1.data[key] = h2.data[key];
        });
        if (h1.data["uniprot-TMhelix"]) {
            h1.data["tmhmm-TMhelix"] = h1.data["uniprot-TMhelix"];
            delete h1.data["uniprot-TMhelix"];
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
        dataType: "json",
        'auth' : MASCP.GATOR_AUTH_TOKEN,
        'api_key' : MASCP.GATOR_CLIENT_ID,
        'url'   : MASCP.UniprotReader.SERVICE_URL+'/'+(this.agi).toUpperCase()
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
    var domain_re = /FT\s+DOMAIN\s+(\d+)\s+(\d+)\s+(.*)/m;
    var carb_re = /FT\s+CARBOHYD\s+(\d+)\s+(\d+)\s+(.*)/m;
    var signal_re = /FT\s+SIGNAL\s+(\d+)\s+(\d+)\s+(.*)/m;
    var transmem_re = /FT\s+TRANSMEM\s+(\d+)\s+(\d+)\s+(.*)/m;

    datalines.forEach(function(data) {
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
            var name = match[3];
            name = name.replace(/;.*/,"");
            name = name.replace(/\.\s+\{.*\}?/,"");
            name = name.replace(/\.$/,"");
            name = name.replace(/\s+\d+$/,"");
            if ( ! results[name]) {
                results[name] = { "peptides" : [], "name" : name };
            }
            results[name].peptides.push([match[1],match[2]]);
        }
        match = signal_re.exec(data);
        if (match) {
            if ( ! results["SIGNALP"]) {
                results["SIGNALP"] = { "peptides" : [], "name" : "SIGNALP" };
            }
            results["SIGNALP"].peptides.push([ match[1], match[2] ]);
        }
        match = transmem_re.exec(data);
        if (match) {
            if ( ! results["uniprot-TMhelix"]) {
                results["uniprot-TMhelix"] = { "peptides" : [], "name" : "TMhelix" };
            }
            results["uniprot-TMhelix"].peptides.push([ match[1], match[2] ]);
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
                        } else if (data) {
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
// We don't have any default rendering for the UserDataReader
// since it's all going to be custom stuff anyway
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

MASCP.UserdataReader.datasets = function(cback,done) {
    MASCP.Service.FindCachedService(this,function(services) {
        var result = [];
        for (var i = 0, len = services.length; i < len; i++){
            result.push(services[i].replace(/MASCP.UserdataReader./,''));
        }
        if (result.forEach) {
            result.forEach(cback);
        }
        if (done) {
            done();
        }
    });
};

})();
/** @fileOverview   Classes for reading data from the Clustal tool
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
            api_key: MASCP.GATOR_CLIENT_ID,
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
                if (i == 0) {
                    i = 1;
                }
                return -1 * i;
            }
        }
    }
    return -1 * seq.length;
};

MASCP.ClustalRunner.Result.prototype.calculateSequencePositionFromPosition = function(idx,pos) {
    var inserts = this._raw_data.data.sequences[idx].insertions || {};
    var result = pos;
    var actual_position = 0;
    var seq = this._raw_data.data.sequences[idx].toString();
    for (var i = 0 ; i < pos; i++ ) {
        if (inserts[i]) {
            actual_position += inserts[i].length;
        }
        actual_position += 1;
        if (seq.charAt(i) == '-') {
            actual_position -= 1;
        }
    }
    if (actual_position == 0) {
        actual_position += 1;
    }
    return actual_position;
};


})();
//1265 (P)

MASCP.ClustalRunner.prototype.setupSequenceRenderer = function(renderer) {
    var self = this;

    renderer.sequences = self.sequences;

    renderer.addAxisScale('clustal',function(pos,layer,inverse) {
        var idx = self.sequences.map(function(seq) { return seq.agi; }).indexOf(layer.name.toLowerCase());
        if (layer.name === 'primarySequence') {
            idx = self.result.aligned_idx;
        }
        if (idx < 0) {
            return pos;
        }
        if ( inverse ) {
            return self.result.calculateSequencePositionFromPosition(idx,pos);
        }
        return self.result.calculatePositionForSequence(idx,pos);
    });

    renderer.forceTrackAccs = true;
    var rendered_bits = [];
    var controller_name = 'isoforms';
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

        var aligned = result.getSequences();

        if ( ! renderer.sequence ) {
            renderer.setSequence(aligned[sequence_index])(function() {
                renderer.sequences = self.sequences;
                MASCP.registerGroup(group_name, 'Aligned');
                MASCP.registerLayer(controller_name, { 'fullname' : 'Conservation', 'color' : '#000000' });
                if (renderer.trackOrder.indexOf(controller_name) < 0) {
                    renderer.trackOrder = renderer.trackOrder.concat([controller_name]);
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
            rendered_bits.push(renderer.getAA(i+1,controller_name).addBoxOverlay(controller_name,1,idxs.indexOf(alignments[i])/4,{"merge" : true}));
            rendered_bits.slice(-1)[0].layer = controller_name;
        }
        for (var i = 0 ; i < aligned.length; i++) {
            var layname = self.sequences[i].agi.toUpperCase() || "missing"+i;
            var lay = MASCP.registerLayer(layname,{'fullname': self.sequences[i].name || layname.toUpperCase(), 'group' : group_name, 'color' : '#ff0000'});
            lay.fullname = self.sequences[i].name || layname.toUpperCase();
            var text_array = renderer.renderTextTrack(layname,aligned[i].toString());
            rendered_bits = rendered_bits.concat(text_array);
            rendered_bits.slice(-1)[0].layer = layname;
            if (renderer.trackOrder.indexOf(layname.toUpperCase()) < 0) {
              console.log("Adding ",layname," to renderer");
              renderer.trackOrder = renderer.trackOrder.concat([group_name]);
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
                var an_anno = renderer.getAA(insert,controller_name).addToLayer(layname,
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
              }
            }
        }
        renderer.zoom = 1;
        renderer.showGroup(group_name);
        renderer.refresh();

    };

    this.bind('resultReceived',function() {
        var self = this;
        redraw_alignments(0);
        self.result.aligned_idx = 0;
        var accs = [];
        self.sequences.forEach(function(seq) {
            accs.push(seq.agi.toUpperCase());
        });
        var current_order = [];
        renderer.bind('orderChanged',function(order) {
            if (self.result) {
                var new_order = order.slice((order.indexOf(controller_name)+1),order.length).filter( function(track) {
                    return accs.indexOf(track) >= 0;
                });
                if (new_order.join(',') == current_order.join(',')) {
                    return;
                }
                current_order = new_order;
                self.result.aligned_idx = accs.indexOf(current_order[0]);

                redraw_alignments(self.result.aligned_idx);
                renderer.refreshScale();
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
}
if (typeof document !== 'undefined' && 'registerElement' in document) {
  (function() {

    var get_renderer = function(renderer_url,callback) {

      if (renderer_url.match(/^(https?:\/)?\//)) {
          MASCP.Service.request(renderer_url,callback,true);
      }

    };

    var get_cached_renderer = function(renderer_url,callback) {
      if ( ! sessionStorage.renderer_caches ) {
        sessionStorage.renderer_caches = JSON.stringify({});
      }
      var renderer_caches = JSON.parse(sessionStorage.renderer_caches);
      if (renderer_caches[renderer_url]) {
        console.log("Going to cache for renderer at "+renderer_url);
        callback.call(null,null,renderer_caches[renderer_url]);
        return;
      }
      get_renderer(renderer_url,function(err,data) {

        if ( err ) {
          callback.call(null,err);
          return;
        }
        var renderer_caches = JSON.parse(sessionStorage.renderer_caches);
        renderer_caches[renderer_url] = data;
        sessionStorage.renderer_caches = JSON.stringify(renderer_caches);
        callback.call(null,null,data);
      });
    };

    var iterate_readers = function(err,pref,reader,acc,renderer) {
      reader.preferences = { getPreferences: function(cb) {
        cb.call(reader,null,pref);
      } };
      var track_name = (pref.render_options || {})["track"] ? pref.render_options["track"] : acc;
      if (pref && pref.icons || (pref.render_options || {}).icons ) {
        var icon_block = pref.icons || (pref.render_options || {}).icons;
        MASCP.Service.request(icon_block.url,function(err,doc) {
          if (doc) {
            renderer.importIcons(icon_block.namespace,doc.documentElement);
          }
        },"xml");
      }
      if (pref.type == 'liveClass' || pref.type == 'reader') {
        reader.registerSequenceRenderer(renderer,pref.render_options || {} );
      }
      var render_func = function() {
        if ( ! this.result ) {
          return;
        }
        if ( renderer.trackOrder.indexOf(track_name) < 0 ) {
          MASCP.registerLayer(track_name, { "fullname" : track_name }, [renderer]);
          renderer.trackOrder.push(track_name);
          renderer.showLayer(track_name);
        }
        if ( ! MASCP.getLayer(track_name) || MASCP.getLayer(track_name).disabled ) {
          MASCP.registerLayer(track_name, {"fullname" : track_name }, [renderer]);
        }
        var datas = this.result._raw_data.data;
        if (pref.render_options["renderer"] && JSandbox) {
          (function(err,doc) {
            if (err) {
              window.notify.alert("Could not render "+pref.title);
              return;
            }
            var sandbox = new JSandbox();
            var seq = renderer.sequence;
            (function() {
              var obj = ({ "gotResult" : function() {
                seq = renderer.sequence;
              }, "agi" : acc });
              renderer.trigger('readerRegistered',[obj]);
              obj.gotResult();
            })();

            sandbox.eval(doc,function() {
              this.eval({ "data" : "renderData(input.sequence,input.data,input.acc)",
                          "input" : { "sequence" : seq, "data" : datas, "acc" : acc  },
                          "onerror" : function(message) { console.log(pref.title); console.log("Errored out"); console.log(message); },
                          "callback" : function(r) {
                            sandbox.terminate();
                            var obj = ({ "gotResult" : function() {
                              r.forEach(function(obj) {
                                var offset = parseInt((pref.render_options || {}).offset || 0);
                                if (obj.options) {
                                  if (obj.options.offset) {
                                    obj.options.offset += offset;
                                    return;
                                  }
                                  obj.options.offset = offset;
                                } else {
                                  obj.options = { "offset" : offset };
                                }
                              });
                              var objs = renderer.renderObjects(track_name,r);
                              reader.resetOnResult(renderer,objs,track_name);
                              renderer.trigger('resultsRendered',[reader]);
                              renderer.refresh();
                            }, "agi" : acc });
                            renderer.trigger('readerRegistered',[obj]);
                            obj.gotResult();
                          }
                        });
            });
          })(null,pref.render_options['renderer']);
          return;
        }
      };
      reader.bind('resultReceived',render_func);
      reader.retrieve(acc);
    };
    var gatorReaderProto = null;
    var gatorReader = (function() {
      var proto = Object.create(HTMLElement.prototype,{
        type: {
          get: function() { return this.readerType; },
          set: function(type) { this.readerType = type; this.setAttribute('type',type); }
        },
        track: {
          get: function() { return this.readerTrack; },
          set: function(track) { this.readerTrack = track; this.setAttribute('track',track); }
        },
        name: {
          get: function() { return this.readerTitle; },
          set: function(name) { this.readerTitle = name; this.setAttribute('name',name); }
        },
        rendererUrl: {
          set: function(url) { this.rendererUrl = url; },
          get: function() { return this.rendererUrl; }
        },
        renderer: {
          set: function(func) { this.renderFunc = func; },
          get: function() { return this.renderFunc }
        }
      });
      proto.createdCallback = function() {
        var self = this;
        this.renderFunc = "";
        if (this.getAttribute('type')) {
          this.type = this.getAttribute('type');
        }
        if (this.getAttribute('rendererurl')) {
          get_cached_renderer(this.getAttribute('rendererurl'),function(err,data) {
            if ( ! err ) {
              self.renderer = data;
            }
          });
        }
      };
      proto.attributeChangedCallback = function(attrName, oldVal, newVal) {
        if (attrName == "name" && this.name !== newVal) {
          this.name = newVal;
        }
        if (attrName == "type" && this.type !== newVal) {
          this.type = newVal;
        }
        if (attrName == "track" && this.track != newVal ) {
          this.track = newVal;
        }
        if (attrName == "rendererurl") {
          get_cached_renderer(newVal,function(err,data) {
            if ( ! err ) {
              this.renderer = data;
            }
          });
        }
      };
      proto._generateConfig = function() {
          var config = {};
          if ( ! this.config_id ) {
            return config;
          }
          config [ this.config_id ] = { type: this.type, title: this.name, render_options: { track: this.track, renderer: (this.renderFunc && typeof this.renderFunc === 'function') ? "var renderData = "+this.renderFunc.toString() : this.renderFunc, icons : { "url" : "/sugars.svg", "namespace" : "sugar" } }, data: this.data };
          return config;
      };

      Object.defineProperty(proto, 'configuration', {
        get: function() {
          return this._generateConfig();
        }
      });
      gatorReaderProto = proto;
      var readerClass = document.registerElement('gator-reader', { prototype: proto });
      return readerClass;
    })();

    var gatorUrl = (function() {
      var proto = Object.create( gatorReaderProto,{
        'href' : {
          get: function() { return this.config_id; },
          set: function(url) { this.config_id = url }
        },
        'type' : {
          get: function() { return "gatorURL" }
        }
      });

      proto.createdCallback = function() {
        var self = this;
        if (this.getAttribute('href')) {
          this.href = this.getAttribute('href');
        }
        gatorReaderProto.createdCallback.apply(this);
      };

      proto.attributeChangedCallback = function(attrName, oldVal, newVal) {
        if (attrName == "href" && newVal !== this.href ) {
          this.href = newVal;
        }
        gatorReaderProto.attributeChangedCallback.apply(this);

      };
      document.registerElement('gator-gatorurl', { prototype: proto });
      return proto;
    })();

    var localReader = (function() {
      var proto = Object.create( gatorReaderProto,{
        'type' : {
          get: function() { return "reader"; }
        },
        'config_id' : {
          get: function() { return this._config_id; }
        },
        'data' : {
          get: function() { return this._data; },
          set: function(data) {
            this._data = data;
            this.dataChanged();
          }
        }
      });

      var create_reader = function() {
            var reader = new MASCP.UserdataReader();
            var self = this;
            reader.map = function(data) {
                var results = {};
                for (var key in data) {
                    if (key == "retrieved" || key == "title") {
                        continue;
                    }
                    if ( ! data[key].data ) {
                        results[key] = {'data' : data[key]};
                    } else {
                        results[key] = data;
                    }
                    results[key].retrieved = data.retrieved;
                    results[key].title = data.title;

                }
                return results;
            };
            reader.datasetname = this.config_id;
            reader.setData(this.config_id,this.data);
            return reader;
      };

      proto.dataChanged = function() {
        if (this._reader) {
          this._reader.bind('ready',function() {
            this.unbind('ready',arguments.callee);
            if (this.agi) {
              this.retrieve(this.agi);
            }
          });
          this._reader.setData(this._reader.datasetname,this.data);
        }
      };

      proto.createdCallback = function() {
        var self = this;
        this._config_id = "local-"+((new Date()).getTime());
        gatorReaderProto.createdCallback.apply(this);
        this._reader = create_reader.call(this);
      };
      proto._generateConfig = function() {
        var config = gatorReaderProto._generateConfig.call(this);
        config[this._config_id].reader = this._reader;
        return config;
      };

      proto.attributeChangedCallback = function(attrName, oldVal, newVal) {
        gatorReaderProto.attributeChangedCallback.apply(this);
      };
      document.registerElement('gator-localdata', { prototype: proto });
      return proto;
    })();

    var editableReader = (function() {
      var proto = Object.create( gatorReaderProto,{
        'type' : {
          get: function() { return "reader"; }
        },
        'config_id' : {
          get: function() { return this._config_id; }
        },
        'data' : {
          get: function() { return this._reader.data; },
          set: function(data) {
            this._reader.data = data;
          }
        },
        'boxTags' : {
          get: function() { return this._reader.boxTags; },
          set: function(boxTags) {
            this._reader.boxTags = boxTags;
          }
        },
        'symbolTags' : {
          get: function() { return this._reader.symbolTags; },
          set: function(symbolTags) {
            this._reader.symbolTags = symbolTags;
          }
        }
      });

      var create_reader = function() {
        var reader = new MASCP.EditableReader();
        return reader;
      };

      proto.createdCallback = function() {
        var self = this;
        this._config_id = "editable-"+((new Date()).getTime());
        gatorReaderProto.createdCallback.apply(this);
        this._reader = create_reader.call(this);
      };
      proto._generateConfig = function() {
        var config = gatorReaderProto._generateConfig.call(this);
        config[this._config_id].reader = this._reader;
        return config;
      };

      proto.attributeChangedCallback = function(attrName, oldVal, newVal) {
        gatorReaderProto.attributeChangedCallback.apply(this);
      };

      document.registerElement('gator-editabledata', { prototype: proto });
      return proto;
    })();


    var domainReader = (function() {
      var proto = Object.create( gatorReaderProto,{
        'type' : {
          get: function() { return "liveClass"; }
        },
        'endpoint' : {
          get: function() { return this._endpoint },
          set: function(endpoint) { this._endpoint = endpoint }
        },
        'config_id' : {
          get: function() { return "DomainRetriever"; }
        }
      });

      proto.createdCallback = function() {
        var self = this;
        if (this.getAttribute('accepted')) {
          this.accepted = this.getAttribute('accepted');
        }
        if (this.getAttribute('href')) {
          this.endpoint = this.getAttribute('href');
        }

        gatorReaderProto.createdCallback.apply(this);
      };

      proto.attributeChangedCallback = function(attrName, oldVal, newVal) {
        gatorReaderProto.attributeChangedCallback.apply(this);
      };

      proto._generateConfig = function() {
        var config = gatorReaderProto._generateConfig.call(this);
        config['DomainRetriever'].accepted_domains = { 'type' : 'gatorURL', url : "http://glycodomain-data.glycocode.com/data/latest/spreadsheet:0Ai48KKDu9leCdHM5ZXRjdUdFWnQ4M2xYcjM3S0Izdmc" };
        if (this.endpoint) {
          config['DomainRetriever'].url = this.endpoint;
        }
        config['DomainRetriever']['render_options']['renderer'] = null;
        config['DomainRetriever']['render_options']['offset'] = -4;
        config['DomainRetriever']['render_options']['height'] = 8;

        return config;
      };

      document.registerElement('gator-domains', { prototype: proto });
      return proto;
    })();



    var readerRenderer = (function() {
      var proto = Object.create(HTMLElement.prototype,{
      });

      proto.attachedCallback = function() {
        var self = this;
      };

      proto.attributeChangedCallback = function(attrName, oldVal, newVal) {
      };

      proto.go = function() {
        var self = this;
        var config = this.readers.reduce(function(result,reader) {
          var confblock = reader.configuration;
          for(var key in confblock) {
            result[key] = confblock[key];
          }
          return result;
        },{});
        MASCP.IterateServicesFromConfig(config,function(err,pref,reader) {
          iterate_readers(err,pref,reader,self.parentNode.accession,self.parentNode.renderer);
        });
      };

      Object.defineProperty(proto, 'readers', {
        get: function() {
          var all_readers = [];
          var all_nodes = this.childNodes;
          for (var i = 0; i < all_nodes.length; i++) {
            if (all_nodes[i] instanceof gatorReader) {
              all_readers.push(all_nodes[i]);
            }
          }
          return all_readers;
        }
      });
      document.registerElement('gator-reader-renderer', { prototype: proto });
      return proto;
    })();

    var gatorTrack = (function() {
      var proto = Object.create(readerRenderer,{
        name: {
          get: function() { return this.trackName || this.parentNode.accession; },
          set: function(name) { this.trackName = name; this.setAttribute('name',name); update_readers.apply(this); }
        },
        genomic: {
          get: function() { return this.trackGenomic; },
          set: function(is) { if(is) { this.trackGenomic = true; this.setAttribute('genomic',true)} else { this.trackGenomic = false; this.removeAttribute('genomic'); } }
        }
      });
      proto.createdCallback = function() {
        var self = this;
        if (this.getAttribute('name')) {
          this.name = this.getAttribute('name');
        }
        if (this.getAttribute('genomic')) {
          this.genomic = this.getAttribute('genomic');
        }
      };
      proto.attributeChangedCallback = function(attrName, oldVal, newVal) {
        if (attrName == "name" && this.name !== newVal) {
          this.name = newVal;
        }
        if (attrName == "genomic") {
          if ( newVal ) {
            this.genomic = true;
          } else {
            this.genomic = false;
          }
        }
      };
      var update_readers = function() {
        var self = this;
        this.readers.forEach(function(reader) {
          if (! reader.track && self.name) {
            reader.track = self.name;
          }
        });
      };
      proto.go = function() {
        var self = this;
        var lay = MASCP.registerLayer(this.name, { fullname: this.name }, [self.parentNode.renderer] );
        if (this.genomic) {
          lay.genomic = this.genomic;
        } else {
          delete lay.genomic;
        }
        update_readers.apply(this);
        readerRenderer.go.apply(this);
      };
      document.registerElement('gator-track', { prototype: proto });
      return proto;
    })();



  })();


}