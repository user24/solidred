/*
A more-or-less drop-in replacement for jQuery that only supports a handful of very basic features.

$$ supports basic chaining, so e.g. $$('.someClass').filter(':visible').on('keypress', fn).val('foo') works.

When you call $$ on an element, you get the native DOM element back, augmented with a few jQuery-like methods

So you can do this, as if you'd called getElementById:
$$('#foo').style.display, or $$('#foo').value

as well this, as if it's a jQuery object:
$$('#foo').hide(), or $$('#foo').attr(...)

Implementation Tips:

1) Make a first-pass look over your code to ensure the only parts of jQuery you make use of are supported (get supported list by hitting $$([{}]) in the console)

2) replace all instances of $ with $$

3) Change any $$(...).filter or .each to $$(...).$filter or .$each (to avoid conflicts with native Array methods)

4) Test the heck out of it. $$ is not as complex or nuanced as jQuery, intentionally. It covers the happy path only.

*/

var $$ = function jqueryLite(arg) {
  var displayDefaults = {};

  // Takes a DOM element and adds some methods to it
  // Setters return the element for chaining, getters obviously don't
  function wrapOne(el) {
    if (!el) {
      console.log('bad el', el);
      return;
    }
    el.hide = function () {
      el.style.display = 'none';
      return el;
    };
    el.show = function () {
      // Figure out what display value this type of element should have (inline/block/inline-block/etc)
      // Initially pinched from jQuery but then modified a bit
      function defaultDisplay(nodeName) {
        if (!displayDefaults[nodeName]) {
          var elem = document.createElement(nodeName);
          document.body.appendChild(elem);
          var display = (elem.currentStyle || window.getComputedStyle(elem)).display;
          document.body.removeChild(elem);
          if (display === "none" || display === "") {
            display = "block";
          }
          displayDefaults[nodeName] = display;
        }
        return displayDefaults[nodeName];
      }
      // Set it
      el.style.display = defaultDisplay(el.nodeName);
      return el;
    };
    el.val = function (newValue) {
      if (newValue) {
        el.value = newValue;
        return el;
      } else {
        return el.value;
      }
    };
    el.text = function (newValue) {
      var prop;
      if (el.textContent !== undefined) {
        prop = "textContent";
      } else {
        prop = "innerText";
      }
      if (newValue) {
        el[prop] = newValue;
        return el;
      } else {
        return el[prop];
      }
    };
    el.on = function (eventName, handler) {
      eventName.split(' ').map(function (eventName) {
        return eventName.trim();
      }).forEach(function (eventName) {
        if (el.addEventListener) {
          el.addEventListener(eventName, handler);
        } else {
          el.attachEvent('on' + eventName, function () {
            handler.call(el);
          });
        }
      });
      return el;
    };
    el.off = function (eventName, handler) {
      eventName.split(' ').map(function (eventName) {
        return eventName.trim();
      }).forEach(function (eventName) {
        if (el.removeEventListener) {
          el.removeEventListener(eventName, handler);
        } else {
          el.detachEvent('on' + eventName, handler);
        }
      });
      return el;
    };
    el.change = function (handler) {
      return el.on('change', handler);
    };
    el.attr = function (name, val) {
      if (val !== undefined) {
        el.setAttribute(name, val);
        return el;
      } else {
        return el.getAttribute(name);
      }
    };
    el.removeAttr = function (name) {
      el.removeAttribute(name);
      return el;
    };
    el.prop = function (name, value) {
      el[name] = value;
      return el;
    };
    el.removeProp = function (name) {
      // try/catch handles cases where IE balks (such as removing a property on window)
      try {
        this[name] = undefined;
        delete this[name];
      } catch (e) {}
      return el;
    };
    el.trigger = function (eventName) {
      if (document.createEvent) {
        var event = document.createEvent('HTMLEvents');
        event.initEvent(eventName, true, false);
        el.dispatchEvent(event);
      } else {
        el.fireEvent('on' + eventName);
      }
      return el;
    };
    return el;
  }

  // Takes a nodelist, turns into proper array, and augments each node with $$ methods
  // also provides $$ methods on the whole array
  function wrapMany(els) {

    // Turn into a real array
    els = Array.prototype.slice.call(els || []);

    // Augment each node with $$ methods
    els = els.map(wrapOne);

    // Add some collection-only methods
    els.$filter = function (selector) {
      function isVisible(el) {
        return (el.offsetWidth > 0 || el.offsetHeight > 0);
      }
      var matches = function (el, selector) {
        var match = (el.matches || el.matchesSelector || el.msMatchesSelector || el.mozMatchesSelector || el.webkitMatchesSelector || el.oMatchesSelector || function () {
          console.error('.$filter: no matchesSelector support in this browser!');
          return false;
        });
        try {
          return match.call(el, selector);
        } catch (e) {
          // mimic jQuery's fakeass :visible selector
          if (selector === ':visible') {
            return isVisible(el);
          } else if (selector === ':not(:visible)') {
            return !isVisible(el);
          } else {
            console.warn('.$filter: Unsupported selector ', selector);
            return false;
          }
        }
      };
      return wrapMany(els.filter(function (el) {
        return matches(el, selector);
      }));
    };
    els.$each = function (fn) {
      els.forEach(function (el, i) {
        fn.call(el, i, el);
      });
      return els;
    };

    // Augment entire array with $$ methods to allow $('.foo').hide() to hide all .foo elements
    // For each supported method;
    Object.keys(wrapOne({})).forEach(function (method) {
      // Apply this method to the whole group
      els[method] = function () {
        // When called, store the original arguments
        var originalArgs = Array.prototype.slice.call(arguments);
        // And then apply those arguments to each element
        // we also wrapMany on the mapped els, to allow further chaining (e.g. $().hide().$each )
        return wrapMany(els.map(function (el) {
          return wrapOne(el)[method].apply(undefined, originalArgs);
        }));
      }
    });

    return els;
  }

  function ready(fn) {
    if (document.readyState != 'loading') {
      fn();
    } else if (document.addEventListener) {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      document.attachEvent('onreadystatechange', function () {
        if (document.readyState != 'loading')
          fn();
      });
    }
  }

  var typeofArg = typeof arg;
  // Support $(function)
  if (typeofArg === 'function') {
    ready(arg);
  }

  // Support $([node]) type usage e.g. $(this)
  if (typeofArg === 'object') {
    if (arg.length) {
      return wrapMany(arg);
    } else {
      return wrapOne(arg);
    }
  }

  // Support $(selectors)
  if (typeofArg === 'string') {
    return wrapMany(document.querySelectorAll(arg));
  }

  // Support $(document).ready
  if (arg && arg.constructor === document.constructor) {
    return {
      'ready': function (callback) {
        ready(callback);
      }
    };
  }

  // Support some $. functions
  return {
    'getJSON': function getJSON() {

    }
  };
};
