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
