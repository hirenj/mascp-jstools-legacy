/*! Hammer.JS - v1.0.7dev - 2014-01-15
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
    },{passive:true});
    // FIXME - PASSIVE
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
		try {
			sandbox[$worker] = new Worker(Sandbox.url);
		} catch(exception) {
			// Internet Explorer closes the BLOB before we can use it
			if (exception.name === "SecurityError") {
				sandbox[$worker] = new Worker(window.URL.createObjectURL(new Blob(['('+default_worker_function.toString()+'(self,eval))'], {'type' : 'text/javascript'})));
			}
		}
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

(function(win) {

var PieMenu = function() {

};

PieMenu.zoomIn = function(el,canvas,x,y) {
    var props = {
            "TransformOriginX" : canvas.RS*x + 'px',
            "TransformOriginY" : canvas.RS*y + 'px',
            "Transform" : 'scale(0)',
            "webkitTransition" : '-webkit-transform 0.2s',
            "mozTransition" : '-moz-transform 0.2s;',
            "transition" : 'transform 0.2s;'
        };
    for (var key in props) {
        if (key.match(/^[a-z]/)) {
            el.style[key] = props[key];
        }
        ["webkit","moz","ms",null].forEach(function(browser) {
            el.style[browser ? browser+key : (key.charAt(0).toLowerCase() + key.slice(1))] = props[key];
        });
    }
    setTimeout(function() {
        el.style.webkitTransform = '';
        el.style.msTransform = '';
        el.style.mozTransform = '';
        el.style.transform = '';
    },10);
};

var rational_tanh = function(x)
{
    if( x < -3 )
        return -1;
    else if( x > 3 )
        return 1;
    else
        return x * ( 27 + x * x ) / ( 27 + 9 * x * x );
};

PieMenu.create = function(canvas,x,y,contents,opts) {
    if (typeof canvas.supports_use == 'undefined') {
        (function() {
            canvas.supports_use = true;
            // var use = canvas.use('#sugar_glcnac',-1000,-1000,100,100);
            // setTimeout(function() {
            //     if (use.instanceRoot) {
            //         canvas.supports_use = true;
            //     } else {
            //         canvas.supports_use = false;
            //     }
            //     use.parentNode.removeChild(use);
            // },1000);
        })();
    }
    var i = 0;
    var center = { 'x' : x, 'y' : y };
    if ( ! opts ) {
        opts = {};
    }
    var radius = ("ontouchstart" in window) ? (3 * (opts.size || 10) / canvas.zoom) : (2 * (opts.size || 10) / canvas.zoom);
    var icon_size = (opts.size || 10) / canvas.zoom;
    if ("ontouchstart" in window) {
        icon_size *= 1.4;
    }
    var phase = contents ? (2 * Math.PI / contents.length) : 0;
    var menu = new PieMenu();
    var els = [];
    menu.container = canvas.group();
    if (window.MutationObserver || window.webkitMutationObserver || window.MozMutationObserver) {
        var MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type == "childList" && menu.container.nextSibling !== null) {
                    menu.container.parentNode.appendChild(menu.container);
                }
            });
        });
        observer.observe(canvas,{ childList : true });
        menu.observer = observer;
    }
    var last_target = null;
    var touch_dispatcher = function(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var rpos = canvas.createSVGRect();
        var boundingRect = canvas.getBoundingClientRect();
        rpos.x = ev.touches[0].clientX - boundingRect.left;
        rpos.y = ev.touches[0].clientY - boundingRect.top;
        rpos.width = rpos.height = 1;
        var target;
        var list = canvas.getIntersectionList(rpos, null);
        for (var i = 0 ; ! target && i < list.length ; i++) {
            if (list[i].move_func) {
                target = list[i];
            }
        }
        if (! target) {
            return;
        }
        if (last_target !== null && target !== last_target) {
            if (last_target.moveout_func) {
                last_target.moveout_func();
            }
        }
        if (target.move_func) {
            target.move_func(ev);
            last_target = target;
        }
    };
    canvas.addEventListener('touchmove',touch_dispatcher,true);

    canvas.addEventListener('touchend',function(ev) {
        if (last_target && last_target.end_func) {
            last_target.end_func();
            ev.stopPropagation();
        }
        canvas.removeEventListener('touchmove',touch_dispatcher,true);
        canvas.removeEventListener('touchend',arguments.callee);
    },false);

    (contents || []).forEach(function(item) {
        var x_pos;
        var y_pos;
        x_pos = center.x + radius * Math.cos(i*phase);
        y_pos = center.y + radius * 1.3 * Math.sin(i*phase);
        if (opts.ellipse) {
            var content_diff = contents.length - 5;
            if (content_diff < 0) {
                content_diff = 0;
            }
            var rot =  -1*(Math.PI/3 + (7/18*Math.PI - Math.PI/3)*rational_tanh(content_diff*content_diff/100));
            var scale = 1 + (content_diff / 6);
            var scale_x = 1 + (content_diff / 15);
            x_pos = center.x + radius * scale_x * Math.cos(i*phase)*Math.cos(rot) - radius * scale * Math.sin(i*phase) * Math.sin(rot);
            y_pos = center.y + radius * scale_x * Math.cos(i*phase)*Math.sin(rot) + radius * scale * Math.sin(i*phase) * Math.cos(rot);
        }

        i++;
        var circ = canvas.circle(x_pos,y_pos,icon_size);
        circ.setAttribute('fill','#eed');
        circ.setAttribute('stroke','#eee');
        circ.setAttribute('stroke-width', 1.5 * canvas.RS / canvas.zoom );
        PieMenu.zoomIn(circ,canvas,x,y);
        els.push(circ);
        var symbol = item.symbol;
        if (typeof symbol == 'string') {
            if (symbol.match(/^#[0123456789ABCDEF]{3,6}$/) || symbol.match(/^url/)) {
                circ.setAttribute('fill',symbol);
            } else if (symbol.match(/^(:?https?:)?\/?.*#/)) {
                if (false && ! canvas.supports_use ) {
                    item.text = item.text_alt || item.symbol;
                } else {
                    var g = canvas.group();
                    var next_g = canvas.group();
                    g.push(next_g);
                    var use = canvas.use(symbol,0,0,100,100);
                    var icon_scale = 0.8;
                    next_g.setAttribute('transform','translate('+(((x_pos-icon_scale*icon_size)*canvas.RS))+','+((y_pos-icon_scale*icon_size)*canvas.RS)+') scale('+(icon_scale*icon_size)+')');
                    next_g.push(use);
                    g.setAttribute('pointer-events','none');
                    els.push(g);
                }
            } else {
                symbol = canvas.text_circle(x_pos,y_pos,icon_size,symbol);
                var g = canvas.group();
                g.push(symbol);
                els.push(g);
                g.setAttribute('pointer-events','none');
            }
        } else if (symbol) {
            var g = canvas.group();
            var next_g = canvas.group();
            next_g.setAttribute('transform','translate('+(((x_pos)*canvas.RS))+','+((y_pos)*canvas.RS)+') scale('+(0.75*icon_size)+')');
            next_g.push(symbol);
            g.push(next_g);
            els.push(g);
            g.setAttribute('pointer-events','none');
        }

        if (item.text) {
            symbol = canvas.text_circle(x_pos,y_pos,0.8*icon_size,item.text,{"stretch" : (x_pos > (center.x + icon_size)) ? 'right' : ((Math.abs(x_pos - center.x) < icon_size ) ? true : 'left'), 'weight' : 'normal', 'fill' : '#000'});
            var g = canvas.group();
            g.push(symbol);
            els.push(g);
            g.setAttribute('pointer-events','none');
            circ.setAttribute('opacity','0.5');
        }

        circ.move_func = function(ev) {
            this.setAttribute('stroke','#0f0');
            if (item.hover_function) {
                item.hover_function();
            }
            ev.stopPropagation();
        };
        circ.end_func = function(ev) {
            if (item.select_function) {
                item.select_function();
            }
        };
        circ.moveout_func = function(ev) {
            this.setAttribute('stroke','#eee');
        };
        circ.addEventListener('mouseover',circ.move_func,true);
        circ.addEventListener('mouseup',circ.end_func);
        circ.addEventListener('mouseout',circ.moveout_func);
    });
    menu.elements = els;
    menu.elements.forEach(function(el) {
        PieMenu.zoomIn(el,canvas,x,y);
        menu.container.push(el);
    });
    return menu;
};


PieMenu.prototype.destroy = function() {
    var self = this;
    if (this.elements) {
        if (this.observer) {
            this.observer.disconnect();
        }
        this.elements.forEach(function(el) {
            if (el.setAttribute) {
                el.setAttribute('pointer-events','none');
            }
            if (el.style) {
                var style_dec = 'scale(0)';
                el.style.webkitTransform = style_dec;
                el.style.msTransform = style_dec;
                el.style.mozTransform = style_dec;
                el.style.transform = style_dec;
            }
            setTimeout(function() {
                if (el && el.parentNode) {
                    el.parentNode.removeChild(el);
                }
            },750);
        });
        this.elements = [];
    }
    setTimeout(function() {
        if (self.container && self.container.parentNode) {
            self.container.parentNode.removeChild(self.container);
        }
    },1000);
};

win.PieMenu = PieMenu;

})(window);
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
        if (layer.group !== this.getGroup(options.group)) {
            layer.group = this.getGroup(options.group);
            layer.group._layers.push(layer);
        }
        if ( ! layer.group ) {
            throw "Cannot register this layer with the given group - the group has not been registered yet";
        }
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
                        while (track_order.indexOf(a_track) >= 0) {
                            track_order.splice(track_order.indexOf(a_track),1);
                        }
                        track_order.push(a_track);
                    }
                    if (MASCP.getGroup(a_track)) {
                        MASCP.getGroup(order[i]).eachLayer(function(grp_lay) {
                            while (track_order.indexOf(grp_lay.name) >= 0) {
                                track_order.splice(track_order.indexOf(grp_lay.name),1);
                            }
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
        if (! sequenceContainer) {
            return this;
        }
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

            this.setSequence(sequenceContainer.textContent || '');
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
    delete this._scalers;
    delete this.forceTrackAccs;

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
                if (Array.isArray(an_array[i])) {
                    continue;
                }

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
            var filtered = an_array.filter(function(el) { return el && ! Array.isArray(el); });
            if (filtered[0] && filtered[0].getAttribute('transform')) {
                a_y = /translate\((-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)\)/.exec(filtered[0].getAttribute('transform'));
                if (a_y !== null && (typeof(a_y) !== 'undefined')) {
                    a_y = a_y[2];
                }
            }
            return filtered[0] ? parseInt( a_y || filtered[0].getAttribute('y') || 0,10) : 0;
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
                        if (Array.isArray(an_array[i])) {
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
                if (Array.isArray(an_array[i])) {
                    continue;
                }

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

        canvas.clipPath = function() {
            var el = document.createElementNS(svgns,'clipPath');
            this.appendChild(el);
            el.push = function(new_el) {
                el.appendChild(new_el);
            };
            return el;
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
        };

        var shape_set_attribute = function(attr,val) {
            this.constructor.prototype.setAttribute.call(this,attr,val);
            if (attr == 'height' || attr == 'width' || attr == 'x' || attr == 'y') {
                this.redraw(Math.floor(parseFloat(this.getAttribute('height'))));
            }
        };

        canvas.nagon = function(x,y,width,height,n,rotate) {
            var shape = this.poly("");
            // shape.setAttribute('transform','translate('+(x*RS)+','+(RS*y)+')');
            shape.setAttribute('x',x*RS);
            shape.setAttribute('y',y*RS);
            shape.setAttribute('width',width*RS);
            shape.redraw = function(hght) {
                if (hght) {
                    this.last_height = hght;
                } else {
                    hght = this.last_height;
                }
                var a = 0.5*Math.floor(parseFloat(shape.getAttribute('width')));
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
                var x_pos = Math.floor(parseFloat(shape.getAttribute('x')));
                var y_pos = Math.floor(parseFloat(shape.getAttribute('y')));
                points.map(function(points) {
                    if (points[0] == min_x) {
                        points[0] = 0;
                    }
                    if (points[0] == max_x) {
                        points[0] = a*2;
                    }
                    points[0] += x_pos;
                    points[1] = y_pos + 0.5*hght*(points[1] / b);
                    return points.join(",");
                });
                this.setAttribute('points',points.join(" "));
            };
            shape.setHeight = shape.redraw;
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
            shape.setAttribute = shape_set_attribute;
            shape.redraw(height*RS);
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
            fo.setAttribute('x',x);
            fo.setAttribute('y',y);
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
            if (opts.angle) {
                result.angle = opts.angle;
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
                if ( opts.width ) {
                    marker.push(this.roundRect(-0.5*opts.width-1,-0.5,opts.width+2,3,1.5));
                    marker.lastChild.setAttribute('fill',fill_color);
                } else {
                    marker.push(this.circle(0,-0.5*r,r));

                    marker.lastChild.setAttribute('fill',fill_color);
                    marker.lastChild.setAttribute('border','true');

                    marker.push(this.circle(0,1.5*r,r));

                    marker.lastChild.setAttribute('fill',fill_color);
                    marker.lastChild.setAttribute('border','true');
                    var arrow = this.poly((-0.9*r*RS)+','+(0*r*RS)+' 0,'+(-2.5*r*RS)+' '+(0.9)*r*RS+','+(0*r*RS));

                    arrow.setAttribute('fill',fill_color);
                    arrow.setAttribute('stroke-width','0');

                    marker.push(arrow);
                    marker.lastChild.setAttribute('border','true');
                }
            }
            marker.setAttribute('transform','translate('+((cx)*RS)+','+0.5*cy*RS+') scale(1)');
            marker.setHeight = setHeight;
            marker.setAttribute('height', dim.R*RS);
            if (typeof symbol == 'string') {
                if (symbol.match(/^(:?https?:)?\/?.*#/)) {
                    marker.contentElement = this.use(symbol,-r,0,r,r);
                    marker.contentElement.setAttribute('content','true');

                } else {
                    marker.contentElement = this.text_circle(0,0,2*r,symbol,opts);
                    marker.contentElement.firstChild.setAttribute('content','true');
                }
                marker.push(marker.contentElement);
            } else if (Array.isArray && Array.isArray(symbol)) {
                marker.contentElement = this.group();
                var phase = ( Math.PI / symbol.length);
                // phase -= (Math.PI / 2);
                var needs_stretch = opts.stretch;
                symbol.forEach(function(symb,i) {
                    var new_el;
                    var x_pos = 1.2*r + (r*symbol.length * Math.cos(i*phase - 0*Math.PI/2));
                    var y_pos = r + (r*(4*r/symbol.length)*symbol.length * Math.sin(i*phase - 0*Math.PI/2));

                    var rotate_amount = 180*i/symbol.length;
                    rotate_amount -= 0*90;
                    if (needs_stretch) {
                        if (rotate_amount >= -90 && rotate_amount <= 90 ) {
                            opts.stretch = 'right';
                        } else {
                            opts.stretch = 'left';
                        }
                        if ((rotate_amount % 90) == 0 && rotate_amount != 90 && rotate_amount != -90) {
                            if (rotate_amount == 0) {
                                opts.stretch = 'right';
                            }
                            if (symbol.length == 1) {
                                opts.stretch = true;
                            }
                        }

                    }

                    if (rotate_amount > 90 && rotate_amount < 270) {
                        rotate_amount = 180 + rotate_amount;
                    }
                    if (symb.match(/^(:?https?:)?\/?.*#/)) {
                        new_el = canvas.use(symb,(x_pos - 0.5)*r,(y_pos - 0.5)*r,r,r);
                        new_el.setAttribute('pointer-events','none');
                        new_el.setAttribute('content','true');
                    } else {
                        var opts_copy = JSON.parse(JSON.stringify(opts));
                        opts_copy.no_tracer = true;
                        delete opts_copy.offset;
                        delete opts_copy.height;
                        new_el = canvas.text_circle(x_pos*r,y_pos*r,1.75*r,symb,opts_copy);
                        new_el.firstChild.setAttribute('content','true');
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
                    marker.contentElement.lastChild.firstChild.setAttribute('content','true');
                }
                if (symbol) {
                    if ( ! opts.bare_element ) {
                        symbol.setAttribute('transform','translate(0,'+(0.5*r*RS)+')');
                    }
                    symbol.setAttribute('content','true');
                    marker.contentElement.push(symbol);
                }
                marker.push(marker.contentElement);
            }
            marker.setAttribute('marker','true');
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


            var text = this.text(0,dim.CY,txt);
            text.setAttribute('font-size',10*RS);
            text.setAttribute('font-weight',opts.weight || 'bolder');
            text.setAttribute('fill',opts.text_fill || '#ffffff');
            text.setAttribute('style','font-family: sans-serif; text-anchor: middle;');
            text.firstChild.setAttribute('dy','0.35em');
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

            var first_line = a_line;

            var a_line = this.line(dim.MID_X1,dim.MID_Y2,dim.MID_X2,dim.MID_Y1);
            a_line.setAttribute('stroke', '#ffffff');
            a_line.setAttribute('stroke-width', '2');

            close_group.push(a_line);

            close_group.move = function(cx,cy) {
                close_button.setAttribute('cx',cx);
                dim.MID_X1 = (cx-(r/2));
                dim.MID_X2 = (cx+(r/2));
                dim.MID_Y1 = (cy-(r/2));
                dim.MID_Y2 = (cy+(r/2));
                first_line.setAttribute('x1',dim.MID_X1);
                first_line.setAttribute('y1',dim.MID_Y1);
                first_line.setAttribute('x2',dim.MID_X2);
                first_line.setAttribute('y2',dim.MID_Y2);
                a_line.setAttribute('x1',dim.MID_X1);
                a_line.setAttribute('y1',dim.MID_Y2);
                a_line.setAttribute('x2',dim.MID_X2);
                a_line.setAttribute('y2',dim.MID_Y1);
            };
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
                if ((typeof(this.offset) !== "undefined") && this.getAttribute('transform')) {
                    var transform_attr = this.getAttribute('transform');
                    var matches = /translate\(.*[,\s](.*)\)/.exec(transform_attr);
                    if (matches[1]) {
                      this.setAttribute('transform','translate('+(new_x*RS)+','+matches[1]+')');
                    }
                } else {
                    this.setAttribute('x',new_x*RS);
                }
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
                m   = el.parentNode.getScreenCTM().inverse().multiply(el.getScreenCTM()).inverse();
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

})();
/**
 *  @fileOverview   Basic classes and definitions for an SVG-based sequence renderer
 */
MASCP.svgns = 'http://www.w3.org/2000/svg';

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
    var resizeTimeout;
    var resize_callback = function() {
        sequenceContainer.cached_width = sequenceContainer.getBoundingClientRect().width;
    };
    window.addEventListener('resize',function() {
        clearTimeout(resizeTimeout);
        if (window.requestAnimationFrame) {
            window.requestAnimationFrame(resize_callback)
        } else {
            resizeTimeout = setTimeout(resize_callback,100);
        }
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
            var native_canvas = this.win().document.createElementNS(MASCP.svgns,'svg');
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
                                                                'width':'25',
                                                                'height':'100%',
                                                                'transform':'translate(-15,0)',
                                                                'style':'fill: url(#right_fade);'});

            container_canv.appendChild(left_fade);
            container_canv.appendChild(right_fade);

            bean.add(canv,'pan',function() {
                if (canv.currentTranslateCache.x >= 0) {
                    left_fade.setAttribute('visibility','hidden');
                } else {
                    left_fade.setAttribute('visibility','visible');
                }
                if (renderer.rightVisibleResidue() < renderer.sequence.length) {
                    right_fade.setAttribute('visibility','visible');
                } else {
                    right_fade.setAttribute('visibility','hidden');
                }
            });
        
            bean.add(canv,'_anim_begin',function() {
                left_fade.setAttribute('visibility','hidden');
                right_fade.setAttribute('visibility','hidden');
            });
        
            bean.add(canv,'_anim_end',function() {
                bean.fire(canv,'pan');
            });


            canv.currentTranslateCache = { x: 0, y: 0 };

            if (canv.currentTranslateCache.x >= 0) {
                left_fade.setAttribute('visibility','hidden');
            }
            right_fade.setAttribute('visibility','hidden');

            var nav_group = container_canv.makeEl('g');
            container_canv.appendChild(nav_group);
            var nav_canvas = container_canv.makeEl('svg');
            nav_group.appendChild(nav_canvas);

            group.style.willChange = 'transform';

           canv.setScale = function(scale) {
                var curr_transform = (group._cached_transform || '' ).replace(/scale\([^\)]+\)/,'');
                if (scale !== null) {
                    curr_transform = (curr_transform + ' scale('+scale+') ').replace(/\s+/g,' ');
                }
                group._cached_transform = curr_transform;
                group.style.transform = curr_transform;
            };

           canv.setCurrentTranslateXY = function(x,y) {
                var curr_transform = group._cached_transform || '';
                curr_transform = (curr_transform.replace(/translate\([^\)]+\)/,'') + ' translate('+x+'px, '+y+'px) ').replace(/\s+/g,' ');
                group._cached_transform = curr_transform;
                group.style.transform = curr_transform;

                this.currentTranslateCache.x = x;
                this.currentTranslateCache.y = y;
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
            canv.appendChild(canv.makeEl('rect', {'x':0,'y':0,'opacity': 0,'width':'100%','height':'100%','stroke-width':'0','fill':'#ffffff'}));
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
            nav.refresh();
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

    var drawAxis = mainDrawAxis = function(canvas,lineLength) {
        var RS = this._RS;
        var self = this;
        var x = 0, i = 0;
    
    
        var axis = canvas.set();

        var axis_back = canvas.rect(0,0,lineLength,1.5);
        axis_back.setAttribute('fill',"url('#"+self.axis_pattern_id+"')");
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

            var a_text = canvas.text(x-0.5,0,""+(x));
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
               var pattern = renderer._canvas.ownerSVGElement.getElementById(renderer.axis_pattern_id);

               thousand_mark_labels.forEach(function(label) {
                label.setAttribute('visibility','hidden');
               });

               if (this.zoom > 3.6) {
                   axis_back.setAttribute('transform','translate(-5,'+(0.3*renderer._axis_height*RS)+')');
                   axis_back.setAttribute('height',0.25*renderer._axis_height*RS);
                   pattern.setAttribute('width',10*RS);
                   pattern.firstChild.setAttribute('x',9.5*RS);
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
                   pattern.firstChild.setAttribute('x','0');
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
                    if ( ! label.cached_bbox) {
                        label.cached_bbox = label.getBBox();
                    }
                    if (label.cached_bbox.x <= (last_right+(RS*10)) || (parseInt(label.textContent) % 50) != 0) {
                        label.setAttribute('visibility','hidden');
                        changed = true;
                    } else {
                        label.setAttribute('visibility','visible');
                        last_right = label.cached_bbox.x + label.cached_bbox.width;
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
                    if ( ! label.cached_bbox) {
                        label.cached_bbox = label.getBBox();
                    }
                    if (label.cached_bbox.x <= (last_right+(RS*10)) || (parseInt(label.textContent) % 250) != 0) {
                        label.setAttribute('visibility','hidden');
                    } else {
                        label.setAttribute('visibility','visible');
                        last_right = label.cached_bbox.x + label.cached_bbox.width;
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
        var val = Math.floor((self.sequence.length+self.padding+2)*(1-((self._canvas.width.baseVal.value + self._canvas.currentTranslateCache.x) / self._canvas.width.baseVal.value)))-1;
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

    clazz.prototype.addAxisScale = function(identifier,scaler) {
        if ( ! this._scalers ) {
            this._scalers = [];
        }
        this._scalers.push(scaler);
        scaler.identifier = identifier;
        return scaler;
    };

    clazz.prototype.refreshScale = function() {
        var self = this;
        var lays = Object.keys(this._layer_containers);
        lays.forEach(function(lay) {
            self._layer_containers[lay].forEach(function(el) {
                if (el.move && el.aa) {
                    var wanted = (self.forceTrackAccs && el.acc) ? el.acc : lay;
                    var aa = self.scalePosition(el.aa,wanted);
                    var aa_width = self.scalePosition(el.aa+el.aa_width,wanted) ;
                    if (aa < 0) {
                        aa *= -1;
                    }
                    if (aa_width < 0) {
                        aa_width *= -1;
                    }
                    el.move(aa-1,aa_width-aa);
                }
            });
        });
    };

    clazz.prototype.scalePosition = function(aa,layer,inverse) {
        var layer_obj = MASCP.getLayer(layer);
        var new_aa = (inverse ? (this._scalers || []).concat([]).reverse() : (this._scalers || [])).reduce(function(val,fn) {  return fn(val,layer_obj || { 'name' : layer },inverse); },aa);
        return new_aa;
    };

    clazz.prototype.getAA = function(aa,layer,acc) {
        return this.getAminoAcidsByPosition([aa],layer,acc).shift();
    };

    clazz.prototype.getAminoAcidsByPosition = function(aas,layer,acc) {
        var self = this;
        var new_aas = aas.map(function(aa) { return Math.abs(self.scalePosition(aa,layer ? layer : acc)); });
        var results = MASCP.SequenceRenderer.prototype.getAminoAcidsByPosition.call(this,new_aas);

        for (var i = 0; i < new_aas.length; i++) {
            if (results[i]) {
                results[i].original_index = aas[i];
                results[i].accession = layer ? layer : acc;
            }
        }
        return results;
    };

    clazz.prototype.getAminoAcidsByPeptide = function(peptide,layer,acc) {
        var self = this;
        var positions = [];
        var self_seq;
        var identifier = acc ? acc : layer;
        if (self.sequences) {
            self_seq = self.sequences [ ( self.sequences.map(function(seq) {  return (seq.agi || seq.acc || "").toLowerCase();  }) ).indexOf(identifier.toLowerCase()) ].toString();
        } else {
            self_seq = self.sequence;
        }
        var start = self_seq.indexOf(peptide);
        for (var i = 0; i < peptide.length; i++ ) {
            positions.push(start+i);
        }
        var results = self.getAminoAcidsByPosition(positions,layer,acc);
        if (results.length) {
            results.addToLayer = function(layername, fraction, options) {
                return results[0].addBoxOverlay(layername,results.length,fraction,options);
            };
        } else {
            results.addToLayer = function() {};
        }
        return results;
    };

    clazz.prototype.win = function() {
        if (this._container && this._container.ownerDocument && this._container.ownerDocument.defaultView) {
            var return_val = this._container.ownerDocument.defaultView;
            if (typeof return_val === 'object' && return_val.constructor !== Window ) {
                return_val = return_val[Object.keys(return_val)[0]];
            }
            return return_val;
        }
        return null;
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

        delete this.sequences;

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
                'x': '-50%',
                'y': '-50%',
                'width':'200%',
                'height':'200%'
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
            var axis_pattern_id = 'axis_pattern_'+(new Date()).getTime();
            var pattern = canv.makeEl('pattern', {
                'patternUnits' : 'userSpaceOnUse',
                'x'            : '0',
                'y'            : '0',
                'width'        : 10*canv.RS,
                'height'       : 2*canv.RS,
                'id'           : axis_pattern_id
            });
            renderer.axis_pattern_id = axis_pattern_id;

            var line = canv.makeEl('rect',{
                'x'     : '0',
                'y'     : '0',
                'width' : '10%',
                'height': '1000%',
                'fill'  : '#000',
                'stroke': '0',
            });
            pattern.appendChild(line);

            defs.appendChild(pattern);

            var self = this;
            renderer._axis_height = 10;
            var aas = drawAminoAcids.call(self,canv);
            renderer.hideAxis = function() {
                drawAxis = function(canv) {
                    bean.add(canv, 'zoomChange', function() {
                        self._axis_height = 10 / self.zoom;
                    });
                    return {};
                };
                self._axis_height = 10 / self.zoom;
                this.redrawAxis();
            };
            renderer.showAxis = function() {
                drawAxis = mainDrawAxis;
                this.redrawAxis();
            };

            var axis = drawAxis.call(self,canv,line_length);
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
            if ( ! renderer.hide_axis ) {
                this.showAxis();
            } else {
                this.hideAxis();
            }

            renderer._layer_containers = {};
            renderer.enablePrintResizing();
            renderer.enableScaling();
            renderer.enableSelection();

            // When we have a layer registered with the global MASCP object
            // add a track within this renderer.
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
            var iterator = new_owner.evaluate('//svg:defs/*',new_nodes,function(ns) { return MASCP.svgns; } ,XPathResult.ANY_TYPE,null);
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
        var plot_path = ' m'+(-0.5*RS)+' 0';
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
    var plot = this._canvas.path('M0 0 M0 0 m0 '+((max_value || 0))*RS+' '+recalculate_plot(1));
    var abs_min_val = min_value;
    var abs_max_val = max_value;
    plot.setAttribute('stroke',options.color || '#ff0000');
    plot.setAttribute('stroke-width', (options.thickness || 0.35)*RS);
    plot.setAttribute('fill', 'none');
    plot.setAttribute('visibility','hidden');
    plot.setAttribute('pointer-events','none');
    this._layer_containers[layerName].push(plot);
    plot.setAttribute('transform','translate(1,10) scale(1,1)');
    if (! options.hide_axis) {
        var axis = this._canvas.path('M0 0 m0 '+(RS*((max_value || 0) - (min_value || 0)))+' l'+this._sequence_els.length*RS+' 0');
        axis.setAttribute('stroke-width',0.2*RS);
        axis.setAttribute('visibility','hidden');
        axis.setAttribute('transform','translate(1,0)');
        axis.setAttribute('pointer-events','none');
        axis.setHeight = function(height) {
            if (abs_min_val < 0 && abs_max_val > 0) {
                axis.setAttribute('d','M0 0 M0 0 m0 '+(height*offset_scale)+' m0 '+(0.5*height*height_scale)+' l'+renderer._sequence_els.length*RS+' 0');
            } else {
                axis.setAttribute('d','M0 0 M0 0 m0 '+(height*offset_scale)+' m0 '+(0.5*(1-abs_min_val)*height*height_scale)+' l'+renderer._sequence_els.length*RS+' 0');
            }
            axis.setAttribute('stroke-width',0.2*RS/renderer.zoom);
        };
        this._layer_containers[layerName].push(axis);
    }
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
        plot.setAttribute('d','M0 0 M0 0 m0 '+(height*offset_scale)+' m0 '+(0.5*height*height_scale)+' '+path_vals);
        plot.setAttribute('stroke-width',((options.thickness || 0.35)*RS)/renderer.zoom);
    };
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
    if ( opts.break_viewbox ) {
        tracer_marker.container.removeAttribute('viewBox');
        tracer_marker.container.setAttribute('width', '100%');
        tracer_marker.container.setAttribute('height','100%');
    }
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
        tracer.setAttribute('pointer-events','none');
        bobble.setAttribute('pointer-events','none');
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
    tracer_marker.setAttribute('class',layerName);
    result.move = function(x,width) {
        var transform_attr = tracer_marker.getAttribute('transform');
        var matches = /translate\(.*[,\s](.*)\) scale\((.*)\)/.exec(transform_attr);
        if (matches[1] && matches[2]) {
            tracer_marker.setAttribute('transform','translate('+((x+0.5)*renderer._RS)+','+matches[1]+') scale('+matches[2]+')');
        }
        if (tracer) {
            tracer.move(x+0.5,0.05);
            bobble.move(x+0.5);
        }
    };
    if (tracer) {
        tracer_marker.tracer = tracer;
        tracer_marker.bobble = bobble;
    }
    this._renderer._layer_containers[layerName].push(result);
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


    var rect =  canvas.rect(-0.25+this._index,60,width || 1, opts.height || 4 ,opts);
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
    rect.setAttribute('visibility', 'hidden');
    rect.setAttribute('stroke-width','0px');
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
            var height_val = opts.height ? (opts.height*renderer._RS/renderer.zoom) : hght*(opts.height_scale || 1);
            if (opts.align == 'bottom') {
                this.setAttribute('y',(offset_val*renderer._RS/renderer.zoom)-(hght*(opts.height_scale || 1)) );
                this.setAttribute('height',height_val);
            } else {
                this.setAttribute('y',offset_val*renderer._RS/renderer.zoom);
                this.setAttribute('height',height_val);
            }
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
    if (opts.height) {
        opts.height = opts.height * this._renderer._RS;
    }
    var height = opts.height || this._renderer._layer_containers[layerName].trackHeight || 4;
    var position = this._index;
    if (width > 1) {
        position = position + Math.floor(0.5*width);
    }
    var text_scale = (4/3);
    var text = canvas.text(position,0,opts.txt || opts.content || "Text");
    text.setAttribute('font-size',text_scale*height);
    text.cached_width = text.getComputedTextLength() / height;
    text.setAttribute('font-weight','bolder');
    text.setAttribute('fill', opts.fill || '#ffffff');
    text.setAttribute('stroke','#000000');
    if (! ("stroke_width" in opts)) {
        opts.stroke_width = 5;
    }
    text.setAttribute('stroke-width',opts.stroke_width+'');
    text.setAttribute('style','font-family: '+canvas.font_order);
    text.firstChild.setAttribute('dy','1.3ex');
    text.setAttribute('text-anchor','middle');
    if (opts.align) {
        if (opts.align == "left") {
            text.setAttribute('text-anchor', 'start');
        }
        if (opts.align == 'right') {
            text.setAttribute('text-anchor', 'end');
        }
    }
    if (width > 1) {
        var clip = canvas.clipPath();
        var mask = canvas.rect(-0.5*width,opts.offset || 0,width,height);
        clip.push(mask);
        mask.removeAttribute('y');
        var mask_id = 'id' + (new Date()).getTime()+"_"+clip.parentNode.childNodes.length;
        clip.setAttribute('id',mask_id);
        text.setAttribute('clip-path','url(#'+mask_id+')');
    }
    if (typeof opts.offset !== 'undefined') {
        text.setAttribute('transform','translate('+text.getAttribute('x')+','+text.getAttribute('y')+')');
        text.offset = opts.offset;
        text.setHeight = function(height) {
            var top_offset = this.offset;
            this.setAttribute('x',0);
            this.setAttribute('y',top_offset*renderer._RS / renderer.zoom);
            if (mask) mask.setAttribute('y',this.getAttribute('y'));
            this.setAttribute('stroke-width', 5/renderer.zoom);
            if (opts.height) {
                this.setAttribute('font-size', text_scale*opts.height/renderer.zoom);
                if (mask) mask.setAttribute('height',opts.height/renderer.zoom);
            } else {
                this.setAttribute('font-size', text_scale*height);
                if (mask) mask.setAttribute('height',height);
            }
            // If we have a mask, we want to move the text to the left.
            if ( mask ) {
                if ((this.cached_width*height) > (width *50)) {
                    this.setAttribute('x',(-0.5*width*50));
                    this.setAttribute('text-anchor','start');
                } else {
                    this.setAttribute('x','0');
                    this.setAttribute('text-anchor','middle');
                }
            } else {
                this.setAttribute('x','0');
                this.setAttribute('text-anchor','middle');
            }
        };
    } else {
        text.setHeight = function(height) {
            text.setAttribute('stroke-width', 5/renderer.zoom);
            if (opts.height) {
                text.setAttribute('font-size', text_scale*opts.height/renderer.zoom);
                if (mask) mask.setAttribute('height',opts.height/renderer.zoom);
            } else {
                text.setAttribute('font-size', text_scale*height);
                if (mask) mask.setAttribute('height',height);
            }
        };
    }
    if (width > 1) {
        text.move = function(new_x,new_width) {
            if (mask) mask.setAttribute('x',(-1*new_width*renderer._RS*0.5));
            if (mask) mask.setAttribute('width',new_width*renderer._RS);
            text.setAttribute('x',(new_x + parseInt(0.5*new_width))*renderer._RS );
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
    var shape_name = (opts.shape.split('-') || '')[0];
    if (shape_name in methods) {
        var is_rotated = opts.shape.split('-')[1];
        if (is_rotated == 'left' && ! opts.rotate) {
            opts.rotate = 90;
        }
        if (is_rotated == 'right' && ! opts.rotate) {
            opts.rotate = 270;
        }
        if (is_rotated == 'flip' && ! opts.rotate) {
            opts.rotate = 180;
        }
        shape = methods[shape_name].call(canvas,this._index,60,width || 1,opts.height || 4,opts.rotate);
    } else {
        return;
    }
    if ((typeof opts.offset) !== 'undefined') {
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
            if ( opts.shape == 'ellipse' ) {
                shape.setAttribute('ry', 0.5*(orig_height*renderer._RS)/renderer.zoom );
            }
            if (opts.shape == 'roundrect') {
                shape.setAttribute('rx', 0.25*(orig_height*renderer._RS)/renderer.zoom );
                shape.setAttribute('ry', 0.25*(orig_height*renderer._RS)/renderer.zoom );
            }
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

    if (((typeof opts.offset) !== 'undefined') && (opts.shape == "hexagon" || opts.shape == "pentagon" )) {
        var offset_val = opts.offset || 0;
        var orig_height = opts.height || 4;
        var adjustment_g = canvas.group();
        adjustment_g.setAttribute('transform',shape.getAttribute('transform'));
        adjustment_g.push(shape);
        shape.setAttribute('transform','translate(0,0)');
        adjustment_g.setHeight = function(height) {
            if ( ! shape._orig_stroke_width ) {
                shape._orig_stroke_width = parseInt(shape.getAttribute('stroke-width')) || 0;
            }
            shape.setHeight(orig_height*renderer._RS/renderer.zoom);
            shape.setAttribute('stroke-width',this._orig_stroke_width/renderer.zoom);
            shape.setAttribute('transform','translate(0,0)');
        };
        this._renderer._layer_containers[layerName].push(adjustment_g);
        adjustment_g.setAttribute('visibility', 'hidden');
        adjustment_g.setAttribute('class',layerName);
        adjustment_g.position_start = this._index;
        adjustment_g.position_end = this._index + width;

    } else {
        this._renderer._layer_containers[layerName].push(shape);
        shape.setAttribute('visibility', 'hidden');
        shape.setAttribute('class',layerName);
        shape.position_start = this._index;
        shape.position_end = this._index + width;

    }
    shape.setAttribute('fill',opts.fill || MASCP.layers[layerName].color);
    if (opts.stroke) {
        shape.setAttribute('stroke',opts.stroke);
    }
    if (opts.stroke_width) {
        shape.setAttribute('stroke-width',renderer._RS*opts.stroke_width);
    } else {
        shape.style.strokeWidth = '0';
    }
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

var scaledAddShapeOverlay = function(layername,width,opts) {
    var start = this._index;
    var end = Math.abs(this._renderer.scalePosition(this.original_index+width,this.accession ? this.accession : layername)) - 1;
    var res = addShapeToElement.call(start < end ? this : this._renderer._sequence_els[end],layername, Math.abs(end - start),opts);
    res.aa = this.original_index;
    res.aa_width = width;
    res.acc = this.acc;
    return res;
};

var scaledAddBoxOverlay = function(layername,width,fraction,opts) {
    var start = this._index;
    var end = Math.abs(this._renderer.scalePosition(this.original_index+width,this.accession ? this.accession : layername)) - 1;

    var res = addBoxOverlayToElement.call(start < end ? this : this._renderer._sequence_els[end],layername,Math.abs(end - start),fraction,opts);

    if (! (opts || {}).merge ) {
        res.aa_width = width;
        res.aa = this.original_index;
    } else {
        res.aa_width = parseInt(res.getAttribute('width')) / this._renderer._RS;
        if (res.aa_width == width) {
            res.aa = this.original_index;
        }
    }
    res.acc = this.accession;
    return res;
};

var scaledAddTextOverlay = function(layername,width,opts) {
    var start = this._index;
    var end = Math.abs(this._renderer.scalePosition(this.original_index+width,this.accession ? this.accession : layername)) - 1;
    var res = addTextToElement.call(start < end ? this : this._renderer._sequence_els[end],layername,Math.abs(end - start),opts);
    res.aa = this.original_index;
    res.aa_width = width;
    res.acc = this.accession;
    return res;
};

var scaledAddToLayerWithLink = function(layername,url,width) {
    var start = this._index;
    var end = Math.abs(this._renderer.scalePosition(this.original_index+width,this.accession ? this.accession : layername)) - 1;
    var res = addElementToLayerWithLink.call(start < end ? this : this._renderer._sequence_els[end],layername,url,Math.abs(end - start));
    res.aa = this.original_index;
    res.acc = this.accession;
    return res;
};

var scaledAddToLayer = function(layername,opts) {
    var res = addElementToLayer.call(this,layername,opts);
    res.aa = this.original_index;
    res.acc = this.accession;
    res.aa_width = 1;
    return res;
};

MASCP.CondensedSequenceRenderer.prototype.enableScaling = function() {
    bean.add(this,'readerRegistered',function(reader) {
        var old_result = reader.gotResult;
        var renderer = this;
        reader.gotResult = function() {
            var wanted_id = reader.acc || reader.agi || "";

            var old_get_aas = MASCP.CondensedSequenceRenderer.prototype.getAminoAcidsByPosition;
            var old_get_pep = MASCP.CondensedSequenceRenderer.prototype.getAminoAcidsByPeptide;
            var old_sequence = renderer.sequence;
            if (renderer.sequences) {
                renderer.sequence = (renderer.sequences [ ( renderer.sequences.map(function(seq) {  return (seq.agi || seq.acc || "").toLowerCase();  }) ).indexOf(wanted_id.toLowerCase()) ] || "").toString();
            } else {
                old_sequence = null;
            }
            renderer.getAminoAcidsByPosition = function(aas,lay,accession) {
                if (renderer.forceTrackAccs) {
                    return old_get_aas.call(this,aas,wanted_id,wanted_id);
                } else {
                    return old_get_aas.call(this,aas,lay || wanted_id,accession || wanted_id);
                }
            };
            renderer.getAminoAcidsByPeptide = function(peptide,lay,accession) {
                if (renderer.forceTrackAccs) {
                    return old_get_pep.call(this,peptide,wanted_id,wanted_id);
                } else {
                    return old_get_pep.call(this,peptide,lay || wanted_id,accession || wanted_id);
                }
            };
            old_result.call(reader);

            if (old_sequence) {
                renderer.sequence = old_sequence;
            }

            renderer.getAminoAcidsByPosition = old_get_aas;
            renderer.getAminoAcidsByPeptide = old_get_pep;
        };
    });
};


MASCP.CondensedSequenceRenderer.prototype._extendElement = function(el) {
    el.addToLayer = scaledAddToLayer;
    el.addBoxOverlay = scaledAddBoxOverlay;
    el.addShapeOverlay = scaledAddShapeOverlay;
    el.addTextOverlay = scaledAddTextOverlay;
    el.addToLayerWithLink = scaledAddToLayerWithLink;
    el.addAnnotation = addAnnotationToLayer;
    el.callout = addCalloutToLayer;
    el['_renderer'] = this;
};

MASCP.CondensedSequenceRenderer.prototype.remove = function(lay,el) {
    if ( ! el ) {
        return false;
    }
    if (this._layer_containers[lay] && this._layer_containers[lay].indexOf(el) >= 0) {
        this._layer_containers[lay].splice(this._layer_containers[lay].indexOf(el),1);
        bean.fire(el,'removed');
        if (el.parentNode) {
            el.parentNode.removeChild(el);
        }
        if (el.tracer && el.tracer.parentNode) {
            el.tracer.parentNode.removeChild(el.tracer);
        }
        if (el.bobble && el.bobble.parentNode) {
            el.bobble.parentNode.removeChild(el.bobble);
        }
        return true;
    }
    return false;
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
          var coalesce_options = group[0].coalesce || objects[0].coalesce;
          new_objects.push({
            'aa' : group[0].aa,
            'type' : 'shape',
            'width' : parseInt(current.aa)-parseInt(group[0].aa)+1,
            'options' : {   'zoom_level' : 'summary',
                            'shape' : 'roundrect',
                            'fill' : coalesce_options.fill,
                            'stroke' : coalesce_options.stroke,
                            'stroke_width' : coalesce_options.stroke_width,
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
    var results = [];
    objects.forEach(function(object) {
        var potential_height = object.options ? (object.options.height || renderer._layer_containers[track].track_height) + (object.options.offset + object.options.height || 0) : 0;
        if (object.options && (potential_height > renderer._layer_containers[track].track_height) ) {
            var new_height = renderer._layer_containers[track].track_height + object.options.offset + (object.options.height || renderer._layer_containers[track].track_height);
            if ((renderer._layer_containers[track].fixed_track_height || 0) < new_height) {
                renderer._layer_containers[track].fixed_track_height = new_height;
            }
        }

        var click_reveal;
        var rendered;
        if (object.aa && ( ! renderer.getAA(parseInt(object.aa),track)) ) {
            return;
        }
        if ((typeof object.aa !== 'undefined') && isNaN(object.aa)) {
            return;
        }
        if (object.type == "text") {
            if (object.aa) {
                if (object.width) {
                    rendered = renderer.getAA(parseInt(object.aa),track).addTextOverlay(track,object.width,object.options);
                } else {
                    rendered = renderer.getAA(parseInt(object.aa),track).addTextOverlay(track,1,object.options);
                }
            } else if (object.peptide) {
                rendered = renderer.getAminoAcidsByPeptide(object.peptide,track).addTextOverlay(track,1,object.options);
            }
        }
        if (object.type === "box") {
            if (object.aa) {
                rendered = renderer.getAA(parseInt(object.aa),track).addBoxOverlay(track,parseInt(object.width),1,object.options);
            } else if (object.peptide) {
                rendered = renderer.getAminoAcidsByPeptide(object.peptide,track).addToLayer(track,1,object.options);
            }
        }
        if (object.type == "shape") {
            if (object.aa) {
                rendered = renderer.getAA(parseInt(object.aa),track).addShapeOverlay(track,parseInt(object.width),object.options);
            } else if (object.peptide) {
                rendered = renderer.getAminoAcidsByPeptide(object.peptide,track)[0].addShapeOverlay(track, object.peptide.length, object.options);
            }
        }
        if (object.type == 'line') {
            rendered = renderer.addValuesToLayer(track,object.values,object.options);
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

                click_reveal = renderer.getAA(parseInt(object.aa),track).addToLayer(track,cloned_options_array);
                click_reveal = click_reveal[1];
                click_reveal.style.display = 'none';
                object.options.content = object.options.alt_content;
                content = object.options.content;
            }
            if (typeof(content) == 'object') {
                var content_el;
                if (content.type == "circle") {
                    content_el = renderer._canvas.circle(-0.5,-0.5,1,1);
                }
                if (content.type == 'text_circle') {
                    content_el = renderer._canvas.text_circle(0.5,0.5,1,content.text,content.options || {});
                    object.options.break_viewbox = true;
                }
                if (content.type == "left_triangle") {
                    content_el = renderer._canvas.poly('-100,0 0,-100 0,100');
                }
                if (content.type == "right_triangle") {
                    content_el = renderer._canvas.poly('0,100 100,0 0,-100');
                }

                ["fill","stroke","stroke-width","fill-opacity","stroke-opacity","opacity"].forEach(function(prop) {
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
            var added = renderer.getAA(parseInt(object.aa),track).addToLayer(track,cloned_options);
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
        if (object.identifier) {
            rendered.setAttribute('identifier',object.identifier);
        }
        if ((object.options || {}).events && rendered ) {
            object.options.events.forEach(function(ev) {
                (ev.type || "").split(",").forEach(function(evtype) {
                    if (evtype == 'click' && rendered.style ) {
                        rendered.style.cursor = 'pointer';
                    }
                    rendered.addEventListener(evtype,function(e) {
                        e.event_data = ev.data;
                        e.layer = track;
                        e.aa = object.aa;
                    });
                });
            });
        }
        results.push(rendered);
    });
    return results;
};

MASCP.CondensedSequenceRenderer.prototype.addTextTrack = function(seq,container) {
    var RS = this._RS;
    var svgns = MASCP.svgns;
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
        max_size = Math.ceil(10*container_width * renderer.zoom / RS);
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

(function() {

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
                //FIXME - PASSIVE
                document.body.addEventListener('touchmove', move , {passive:true});
                element.addEventListener('touchend',end,false);
            },{passive : true});
            //FIXME - PASSIVE
        } else {
            element.addEventListener('click',handler,false);
        }
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

  var notifySelectionToLayers = function(start,end,renderer) {
    for (var layname in MASCP.layers) {
        var lay = MASCP.getLayer(layname);
        if (start && end) {
            bean.fire(lay,'selection', [ renderer.scalePosition(start,layname,true), renderer.scalePosition(end,layname,true) ]);
        } else {
            bean.fire(lay,'selection', [ null,null ]);
        }
    }
  };

MASCP.CondensedSequenceRenderer.prototype.enableSelection = function(callback) {
    var self = this;

    if ( ! self._canvas) {
      bean.add(self,'sequenceChange',function() {
        self.enableSelection();
      });
      return;
    }

    var canvas = self._canvas;
    var start;
    var end;
    var end_func;
    var local_start;
    var local_end;


    var moving_func = function(evt) {
        evt.preventDefault();

        var p = svgPosition(evt,canvas);
        end = p.x;

        if (start > end) {
            local_end = parseInt(start / 50);
            local_start = parseInt(end / 50);
        } else {
            local_end = parseInt(end/50);
            local_start = parseInt(start/50);
        }
        self.select(local_start+1,local_end);
    };

    // Do not send the click event to the canvas
    // this screws up with doing things on the selection
    // Need alternative method to clear selection
    //
    bindClick(canvas,function(evt) {
        if (! self.selecting) {
            self.select();
            notifySelectionToLayers(null,null,self);
            local_start = null;
            local_end = null;
        }
    });

    canvas.addEventListener('mousedown',function(evt) {
        if (! self.selecting ) {
            return;
        }
        var positions = mousePosition(evt);
        var p = {};
        if (canvas.nodeName == 'svg') {
                p = canvas.createSVGPoint();
                var rootCTM = this.getScreenCTM();
                p.x = positions[0];
                p.y = positions[1];

                self.matrix = rootCTM.inverse();
                p = p.matrixTransform(self.matrix);
        } else {
                p.x = positions[0];
                p.y = positions[1];
        }
        start = p.x;
        end = p.x;
        canvas.addEventListener('mousemove',moving_func,false);
        evt.preventDefault();
    },false);

    canvas.addEventListener('mouseup',function(evt) {
        if (self.selecting) {
            notifySelectionToLayers(local_start+1,local_end,self);
            local_start = null;
            local_end = null;
        }
        canvas.removeEventListener('mousemove',moving_func);
        evt.preventDefault();
    });

    canvas.addEventListener('touchend',function() {
        if (self.selecting) {
            setTimeout(function() {
                notifySelectionToLayers(local_start+1,local_end,self);
                local_start = null;
                local_end = null;
            },500);
        }
        canvas.removeEventListener('touchmove',moving_func);
    });

    canvas.addEventListener('touchstart',function(evt) {
        if (! self.selecting ) {
            return;
        }
        if (evt.changedTouches.length == 1) {
            evt.preventDefault();
            var positions = mousePosition(evt.changedTouches[0]);
            var p = {};
            if (canvas.nodeName == 'svg') {
                    p = canvas.createSVGPoint();
                    var rootCTM = this.getScreenCTM();
                    p.x = positions[0];
                    p.y = positions[1];

                    self.matrix = rootCTM.inverse();
                    p = p.matrixTransform(self.matrix);
            } else {
                    p.x = positions[0];
                    p.y = positions[1];
            }
            start = p.x;
            end = p.x;
            canvas.addEventListener('touchmove',moving_func,false);
        }
    },{passive:true});
    //FIXME - PASSIVE
};

})();

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
            // this._container.style.height = height+'px';        
        } else {
            this._container_canvas.setAttribute('height','100%');
            this._container_canvas.setAttribute('width','100%');
            // this._container.style.height = 'auto';
            this.navigation.setZoom(this.zoom);
        }        
    }
};

(function(clazz) {

var svgns = MASCP.svgns;

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
        bean.add(layer,'removed',function(rend) {
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
        this.removeAnnotations(layer);
        this._layer_containers[layer.name] = null;
        layer.disabled = true;
    }

};

var refresh_id = 0;
clazz.prototype.disablePrintResizing = function() {
    delete this._media_func;
};

clazz.prototype.enablePrintResizing = function() {
    if ( ! (this.win() || window).matchMedia ) {
        return;
    }
    if (this._media_func) {
        return this._media_func;
    }
    this._media_func = function(matcher) {
        var self = this;
        if ( ! self._canvas ) {
            return;
        }
        if ( self.grow_container ) {
            if (matcher.matches) {
                delete self._container_canvas.parentNode.cached_width;
                bean.fire(self._canvas,'panend');
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
                self._canvas.setCurrentTranslateXY(self.old_translate,0);
                self._container_canvas.setAttribute('viewBox',self.old_viewbox);
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
            self.old_translate = self._canvas.currentTranslateCache.x;
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
    };
    var rend = this;
    if ( ! rend._bound_media ) {
        (this.win() || window).matchMedia('print').addListener(function(matcher) {
            if (rend._media_func) {
                rend._media_func(matcher);
            }
        });
    }
    rend._bound_media = true;
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
    } else {
        this._container_canvas.removeAttribute('viewBox');
    }

    this._resizeContainer();

    viewBox[0] = 0;
    if (this.navigation) {
        this.navigation.nav_width_base = outer_viewbox[3] < 200 ? outer_viewbox[3] : 200;
        this.navigation.move_closer();
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
    var transformer;
    var shifter;
    var accessors = { 
        setZoom: function(zoomLevel) {
            var container_width = renderer._container.cached_width;
            if ( ! container_width ) {
                container_width = renderer._container.clientWidth;
            }
            if ( ! renderer.sequence ) {
                zoom_level = zoomLevel;
                return;
            }
            var min_zoom_level = container_width / (2 * renderer.sequence.length);
            if  (! renderer.grow_container ) {
                min_zoom_level = 0.3 / 2 * min_zoom_level;
            }

            // var min_zoom_level = renderer.sequence ? (0.3 / 2) * container_width / renderer.sequence.length : 0.5;
            if (zoomLevel < min_zoom_level) {
                zoomLevel = min_zoom_level;
            }
            if (zoomLevel > 10) {
                zoomLevel = 10;
            }

            var self = this;

            if (zoomLevel == zoom_level) {
                if (this.refresh.suspended && self._canvas && self._canvas.zoom !== parseFloat(zoom_level)) {
                    self._canvas.zoom = parseFloat(zoom_level);
                    self._canvas.setScale(1);

                    bean.fire(self._canvas,'zoomChange');
                }
                return;
            }


            if (! self._canvas) {
                zoom_level = zoomLevel;
                return;
            }

            var no_touch_center = false;

            if (self.zoomCenter == 'center') {
                no_touch_center = true;
                self.zoomCenter = {'x' : self._RS*0.5*(self.leftVisibleResidue()+self.rightVisibleResidue()) };
            }
            
            if ( self.zoomCenter && ! center_residue ) {
                start_x = self._canvas.currentTranslateCache.x || 0;
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

            var scale_value = Math.abs(parseFloat(zoomLevel)/start_zoom);

            window.cancelAnimationFrame(transformer);
            transformer = window.requestAnimationFrame(function() {
                // Rendering bottleneck
                self._canvas.setScale(scale_value);

            });

            bean.fire(self._canvas,'_anim_begin');
            if (document.createEvent) {
                var evObj = document.createEvent('Events');
                evObj.initEvent('panstart',false,true);
                self._canvas.dispatchEvent(evObj);
            }
            var old_x = self._canvas.currentTranslateCache.x;
            if (center_residue) {
                var delta = ((start_zoom - zoom_level)/(scale_value*25))*center_residue;
                delta += start_x/(scale_value);
                cancelAnimationFrame(shifter);
                shifter = window.requestAnimationFrame(function() {

                    // Rendering bottleneck
                    self._canvas.setCurrentTranslateXY(delta,((start_zoom - zoom_level)/(scale_value))*self._axis_height*2);

                });
            }
        
            var end_function = function() {
                timeout = null;
                var scale_value = Math.abs(parseFloat(zoom_level)/start_zoom);

                self._canvas.setScale(null);

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
        fitZoom: function() {
            var container_width = renderer._container.cached_width;
            if ( ! container_width ) {
                container_width = renderer._container.clientWidth;
            }
            var min_zoom_level = 0.5;
            if (renderer.sequence) {
                min_zoom_level = container_width / (2 * renderer.sequence.length);
            }
            renderer.zoom = min_zoom_level;
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

    renderer.fitZoom = accessors.fitZoom;

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
    var svgns = MASCP.svgns;

    var touch_scale = 1, touch_enabled = false;
    if ("ontouchend" in document) {
        touch_scale = window.devicePixelRatio > 1 ? 2 : 1;
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

        track_group.setAttribute('clip-path','url(#'+this.clipping_id+')');

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
                    if (! expanded_map.hasOwnProperty(layer.name)) {
                        expanded_map[layer.name] = false;
                    }
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
                        targets[i].removeAttribute('dragging');
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
                lbl_grp.setAttribute('dragging','true');

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
        self.zoom = 1;
        self.nav_width_base = 200;
        var nav_width = self.nav_width_base;
        self.nav_width = self.nav_width_base;
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

        self.clipping_id = 'nav_clipping'+(new Date()).getTime();
        var clipping = document.createElementNS(svgns,'clipPath');
        clipping.id = self.clipping_id;
        var rect2 = rect.cloneNode();
        rect2.removeAttribute('id');
        rect2.removeAttribute('opacity');
        rect2.setAttribute('x','0');
        rect2.setAttribute('width',""+(parseInt(rect2.getAttribute('width')) - 10));
        rect2.removeAttribute('style');
        rect2.setAttribute('height','10000');
    
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
        tracks_button.parentNode.setAttribute('clip-path','url(#'+self.clipping_id+')');

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
            var needs_transition = interactive ? "all ease-in-out 0.4s" : "";

            if (visible) {
                self.promote();
                panel_back.style.transform = 'translate(0,0)';
                panel_back.style.transition = needs_transition;

                close_group._button.removeAttribute('filter');
                if ("ontouchend" in window || window.getComputedStyle(close_group).getPropertyValue("-ms-transform")) {
                    close_group.style.transform='';
                }
                close_group.style.transform = 'translate(0,0)';
                close_group.style.transition = needs_transition;
                close_group.style.transformOrigin = transform_origin;
                close_group.style.webkitTransformOrigin = transform_origin;
                self.refresh();
            } else {
                self.demote();
                // Chrome bug Jan 2015 with the drop shadow
                //close_group._button.setAttribute('filter','url(#drop_shadow)');
                close_group.style.transition = needs_transition;
                close_group.style.transition = needs_transition;
                close_group.style.transformOrigin = transform_origin;
                close_group.style.transform = 'translate('+-0.75*self.nav_width_base+'px,0) rotate(405deg)';
                if ("ontouchend" in window) {
                    // No longer special casing IE
                    close_group.style.transform = 'translate('+-0.75*self.nav_width_base+'px,0) rotate(45,'+(self.nav_width_base-(10 + touch_scale*11))+'px,'+(12*touch_scale)+'px)';
                    panel_back.style.transform = 'translate('+(-1*self.nav_width*self.zoom)+'px,0)';
                    panel_back.style.transition = needs_transition;
                } else {
                    panel_back.style.transform = 'translate('+(-1*self.nav_width*self.zoom)+'px,0)';
                    panel_back.style.transition = needs_transition;
                    tracks_button.style.transform = 'translate('+(-1*self.nav_width*self.zoom)+'px,0)';
                    tracks_button.style.transition = needs_transition;
                }
            }
            return true;
        };

        self.move_closer = function() {
            if (visible) {
                return;
            }
            close_group.style.transform = 'translate('+-0.75*self.nav_width_base+'px,0) rotate(405deg)';
            if ("ontouchend" in window) {
                // No longer special casing IE
                close_group.style.transform = 'translate('+-0.75*self.nav_width_base+'px,0) rotate(45,'+(self.nav_width_base-(10 + touch_scale*11))+'px,'+(12*touch_scale)+'px)';
            }
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
            self.nav_width = self.nav_width_base / zoom;
            close_group.setAttribute('transform','scale('+zoom+','+zoom+') ');

            var transform_origin = ""+(self.nav_width_base-(10 + touch_scale*11))+"px "+(12*touch_scale)+"px;";
            transform_origin_statement = " -webkit-transform-origin: "+transform_origin+" -ms-transform-origin: "+transform_origin+" -moz-transform-origin: "+transform_origin+" transform-origin: "+transform_origin;
            close_group.move(self.nav_width_base-(10 + touch_scale*11),12*touch_scale);
            rect.setAttribute('transform','scale('+zoom+',1) ');
            rect.setAttribute('ry', (base_rounded_corner[1]).toString());
            rect.setAttribute('rx', (base_rounded_corner[0]/zoom).toString());
            rect.setAttribute('x', parseInt(-10 / zoom).toString());
            rect.setAttribute('width', (self.nav_width).toString());
            self.zoom = zoom;
            toggler.call(this,visible);
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
            if (ctm_refresh.length < 1) {
                return;
            }
            var nav_back = track_canvas.ownerSVGElement.getElementById('nav_back');

            var ctm = nav_back.getScreenCTM().inverse().multiply(track_canvas.getScreenCTM()).inverse();
            var back_width = (nav_back.getBBox().width + nav_back.getBBox().x);
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
                    on ? el.parentNode.setAttribute('dragenabled','true') : el.parentNode.removeAttribute('dragenabled');
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
            var a_text = track_canvas.text(text_left,y+0.5*height,track.fullname || track.name);
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
})();

// Copyright Hiren Joshi - tobe LGPLed
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

if (typeof document !== 'undefined' && 'registerElement' in document) {
  (function() {
    var gatorViewer = (function() {
      var proto = Object.create(HTMLElement.prototype,{
          sequence: {
            set: function(sequence) { this.renderer.setSequence(sequence); },
            get: function() { return this.renderer.sequence; }
          },
          trackmargin: {
            set: function(margin) { this.renderer.trackGap = margin + 4; },
            get: function(margin) { return this.renderer.trackGap - 4;}
          },
          zoom : {
            set: function(zoom) {
              this.zoomval = zoom;
              if (zoom === "auto") {
                this.renderer.enablePrintResizing();
                this.renderer.fitZoom();
              } else if (zoom !== null && zoom !== "null") {
                this.renderer.disablePrintResizing();
                this.renderer.zoom = parseFloat(zoom);
                this.zoomval = parseFloat(zoom);
              }
            },
            get: function(zoom) { return this.renderer.zoom; }
          }
      });
      proto.createdCallback = function() {
        var self = this;
        var shadow = this.createShadowRoot();
        shadow.appendChild(shadow.ownerDocument.createElement('div'));
        this.style.display = 'block';
        shadow.firstChild.style.overflow = 'hidden';
        self.renderer = new MASCP.CondensedSequenceRenderer(shadow.firstChild);

        var dragger = new GOMap.Diagram.Dragger();
        shadow.appendChild(shadow.ownerDocument.createElement('style'));
        shadow.lastChild.textContent = '[dragenabled] { cursor: move; cursor: -webkit-grab; cursor: -moz-grab; cursor: grab; }' + '\n' + '[dragging] { cursor: move; cursor: -webkit-grabbing; cursor: -moz-grabbing; cursor: grabbing; }'


        Object.defineProperty(dragger,"enabled",{
          get: function() { return this._enabled; },
          set: function(enabled) {
            if (self.renderer._canvas) {
              if (enabled) {
                self.renderer._canvas.setAttribute('dragenabled','true');
              } else {
                self.renderer._canvas.removeAttribute('dragenabled');
              }
            }
            this._enabled = enabled;
          }
        });

        dragger.enabled = true;

        var scroll_box = shadow.ownerDocument.createElement('div');
        scroll_box.style.height = '24px';
        shadow.appendChild(scroll_box);

        self.renderer.getVisibleLength = function() {
          return this.rightVisibleResidue() - this.leftVisibleResidue();
        };
        self.renderer.getTotalLength = function() {
          return this.sequence.length;
        };
        self.renderer.getLeftPosition = function() {
          return this.leftVisibleResidue();
        };
        self.renderer.setLeftPosition = function(pos) {
          return this.setLeftVisibleResidue(pos);
        };

        Object.defineProperty(this.renderer,"grow_container",{
          get: function() { return self.style.overflow == "auto"; },
          set: function() { }
        });

        Object.defineProperty(self,"interactive",{
          get: function() { if (self.getAttribute('interactive')) { return true } else { return false }},
          set: function(val) { is_interactive.enabled = val }
        });

        Object.defineProperty(this.renderer,"selecting",{
          get: function() { return ! dragger.enabled; },
          set: function(val) { dragger.enabled = ! val; return val; }
        });


        var is_interactive = {'enabled' : self.interactive };
        var observer = new MutationObserver(function() {
          if (self.renderer.grow_container) {
            dragger.enabled = true;
          } else {
            dragger.enabled = false;
            self.renderer.setLeftVisibleResidue(0);
          }
          self.renderer.refresh();
        });
        observer.observe(self, {
            attributes:    true,
            attributeFilter: ["style"]
        });

        if ( ! this.getAttribute('zoom')) {
          this.setAttribute('zoom','auto');
        } else {
          this.zoom = this.getAttribute('zoom');
        }
        if (this.getAttribute('trackmargin')) {
          this.trackmargin = parseInt(this.getAttribute('trackmargin'));
        }

        this.renderer.bind('sequenceChange',function() {
          dragger.applyToElement(self.renderer._canvas);
          dragger.enabled = self.renderer.grow_container;
          GOMap.Diagram.addScrollBar(self.renderer, self.renderer._canvas,scroll_box);

          dragger.addTouchZoomControls(self.renderer, self.renderer._canvas,is_interactive);
          GOMap.Diagram.addScrollZoomControls.call(is_interactive,self.renderer, self.renderer._canvas,0.001);

          self.setAttribute('sequence',self.renderer.sequence);
          if (self.zoomval == "auto") {
            self.renderer.fitZoom();
          }
        });
        this.renderer.bind('zoomChange',function() {
          if (self.zoomval !== 'auto') {
            self.setAttribute('zoom',self.renderer.zoom);
          }
        });
        if (self.getAttribute('sequence')) {
          self.sequence = self.getAttribute('sequence');
        }
      };
      proto.attributeChangedCallback = function(attrName, oldVal, newVal) {
        if (attrName == 'sequence' && this.sequence !== newVal) {
          this.sequence = newVal;
        }
        if (attrName == 'zoom' && this.zoomval !== newVal) {
          this.zoom = newVal;
        }
        if (attrName == 'trackmargin' && this.trackmargin !== newVal ) {
          this.trackmargin = parseInt(newVal);
        }
        if (attrName == 'interactive') {
          this.interactive = newVal ? true : false;
        }
      };
      document.registerElement('gator-viewer', { prototype: proto });
      return proto;
    })();

    var get_reader = function(clazz,caching) {
      var reader = new clazz();
      if (caching) {
        MASCP.Service.BeginCaching(reader);
      }
      return reader;
    };

    var fire_event = function(targ,name) {
      var ev = document.createEvent("Events");
      ev.initEvent(name, false, true);
      targ.dispatchEvent(ev);
    };

    var gatorUniprot = (function() {
        var uniprot_proto = document.registerElement('gator-uniprot', {
        prototype: Object.create(gatorViewer, {
          createdCallback : {
            value : function() {
              gatorViewer.createdCallback.apply(this);
              if (this.getAttribute('caching')) {
                this.caching = this.getAttribute('caching');
              }
              if (this.getAttribute('auto')) {
                this.auto = this.getAttribute('auto');
              }

              if (this.getAttribute('accession')) {
                this.accession = this.getAttribute('accession');
              }

            }
          },
          attributeChangedCallback: {
            value : function (attrName,oldVal,newVal) {
              gatorViewer.attributeChangedCallback.call(this,attrName,oldVal,newVal);
              if (attrName == 'accession' && this.accession !== newVal) {
                this.accession = newVal;
              }
              if (attrName == "auto") {
                if (newVal && !this.auto) {
                  this.auto = true;
                } else if ( ! newVal && this.auto ) {
                  this.auto = false;
                }
              }
              if (attrName == 'caching') {
                if (newVal && ! this.caching) {
                  this.caching = newVal;
                } else if (! newVal && this.caching) {
                  this.caching = false;
                }
              }
            }
          },
          auto : {
            get: function() { return this.autoRun; },
            set: function(auto) { this.autoRun = auto; }
          },
          accession: {
            set: function(acc) {
              var self = this;
              self.acc = acc;
              self.setAttribute('accession',acc);
              if (self.auto) {
                self.go();
              }
            },
            get: function() { return this.acc; }
          },
          go: { value : function() {
            var self = this;
            MASCP.ready = function() {
              get_reader(MASCP.UniprotReader,self.caching).retrieve(self.accession, function(err) {
                if (!err) {
                  self.renderer.bind('sequenceChange',function() {
                    self.renderer.unbind('sequenceChange',arguments.callee);
                    fire_event(self,'ready');
                  });
                  self.renderer.setSequence(this.result.getSequence());
                }
              });
            };
          }},
          caching: {
            set: function(val) {
              if (val) {
                this.cachingval = true;
                this.setAttribute('caching',true);
              } else {
                this.removeAttribute('caching');
              }
            },
            get: function() {
              return this.cachingval;
            }
          }
        })
      });
      return uniprot_proto.prototype;
    })();
    var gatorGene = (function() {

        var gene_proto = document.registerElement('gator-gene', {
        prototype: Object.create(gatorUniprot, {
          createdCallback : {
            value : function() {
              gatorUniprot.createdCallback.apply(this);
              this.renderer.hide_axis = true;
              if (this.getAttribute('exonmargin')) {
                this.exonmargin = parseInt(this.getAttribute('exonmargin'));
              }
            }
          },
          attributeChangedCallback: {
            value : function (attrName,oldVal,newVal) {
              gatorUniprot.attributeChangedCallback.call(this,attrName,oldVal,newVal);
              if (attrName == 'geneid' && this.geneid !== newVal) {
                this.geneid = newVal;
              }
              if (attrName == 'exonmargin' && this.exonmargin != newVal) {
                this.exonmargin = parseInt(newVal);
                if (this._genomereader) {
                  this._genomereader.exon_margin = this.exonmargin;
                  this.renderer.refreshScale();
                  if (this.getAttribute('zoom') == 'auto') {
                    this.renderer.fitZoom();
                  }
                }
              }
            }
          },
          accession : {
            set: function(acc) {
              this.acc = acc;
              if (acc) {
                this.setAttribute('accession',acc);
              } else {
                this.removeAttribute('accession');
              }
            },
            get : function() {
              return this.acc;
            }
          },
          go : { value: function() {
            var self = this;
            self.renderer.trackOrder = [];
            self.renderer.reset();
            var old_zoom = self.getAttribute('zoom') || 'auto';
            self.removeAttribute('zoom');
            self.renderer.bind('sequenceChange',function() {
              self.renderer.unbind('sequenceChange',arguments.callee);
              var reader = get_reader(MASCP.GenomeReader,self.caching);
              reader.geneid = self.geneid;
              reader.exon_margin = self.exonmargin;
              if (self.nt_mapping) {
                reader.nt_mapping = self.nt_mapping;
              }
              self._genomereader = reader;
              reader.registerSequenceRenderer(self.renderer);
              reader.bind('requestComplete',function() {
                self.renderer.hideAxis();
                self.setAttribute('zoom',old_zoom);
                fire_event(self,'ready');
              });
              reader.retrieve(self.accession || ""+self.geneid);
            });
            MASCP.ready = function() {
              self.renderer.setSequence('M');
            };
          }},
          geneid: {
            set: function(geneid) {
              var self = this;
              self.ncbigene = geneid;
              self.setAttribute('geneid',geneid);
              if (self.auto) {
                self.go();
              }
            },
            get: function() { return this.ncbigene; }
          }
        })
      });
      return gene_proto.prototype;
    })();

  })();


}