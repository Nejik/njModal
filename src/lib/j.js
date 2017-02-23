//syntax sugar like jquery
//ie 9-11 support

//you can't create elements with this function
let j = function (selector) {
    selector = selector || '';
    return new j.fn.init(selector);
};
// if(!window.$) window.$ = window.j;

j.match = function (el, selector) {
    if (el === document) el = document.documentElement;

    var matchesSelector = el.matches
        || el.matchesSelector
        || el.oMatchesSelector
        || el.mozMatchesSelector
        || el.webkitMatchesSelector
        || el.msMatchesSelector;

    return matchesSelector.call(el, selector);
}
j.fn = j.prototype;
j.fn.init = function (selector) {
    var query;

    if (typeof selector === 'string' && selector.length > 0) {
        //detect html input
        if (selector.charAt(0) === "<" && selector.charAt(selector.length - 1) === ">") {
            (j.str2dom) ? query = j.str2dom(selector) : query = [];
        } else {
            query = document.querySelectorAll(selector);
        }
    } else if (selector instanceof Array || selector instanceof NodeList || selector instanceof HTMLCollection || selector instanceof j) {
        query = selector;
    } else if (selector.nodeType || (window.Node && selector instanceof Node) || selector == selector.window || typeof selector === 'object') {
        query = [selector];
    } else if (typeof selector === 'function') {
        query = [document];
        document.addEventListener("DOMContentLoaded", selector);
    } else {
        query = [];
    }

    //save selector length
    this.length = query.length;

    for (var i = 0, l = this.length; i < l; i++) {
        this[i] = query[i];
    }

    // Return as object
    return this;
}
j.fn.init.prototype = j.fn;//maked for using instenceOf operator(example: j('#test') instanceOf j)
j.fn.each = function (callback) {
    for (var i = 0, l = this.length; i < l; i++) {
        if (callback.call(this[i], i, this[i]) === false) break;
    }
    return this;
}

j.str2dom = function (html) {
    var div = document.createElement('div');
    div.innerHTML = html;
    return div.childNodes;
}
//extend function from jQuery
j.isArray = function (a) { return j.type(a) === "array" };
j.isFunction = function (a) { return j.type(a) == "function" };
j.isPlainObject = function (f) { var b, c = {}, a = {}.hasOwnProperty; if (!f || j.type(f) !== "object" || f.nodeType || j.isWindow(f)) { return false } try { if (f.constructor && !a.call(f, "constructor") && !a.call(f.constructor.prototype, "isPrototypeOf")) { return false } } catch (d) { return false } if (c.ownLast) { for (b in f) { return a.call(f, b) } } for (b in f) { } return b === undefined || a.call(f, b) };
j.isWindow = function (a) { return a != null && a == a.window };
j.type = function (c) { var a = a = { "[object Array]": "array", "[object Boolean]": "boolean", "[object Date]": "date", "[object Error]": "error", "[object Function]": "function", "[object Number]": "number", "[object Object]": "object", "[object RegExp]": "regexp", "[object String]": "string" }, b = a.toString; if (c == null) { return c + "" } return typeof c === "object" || typeof c === "function" ? a[b.call(c)] || "object" : typeof c };
//for extend function we need: j.isArray, j.isFunction, j.isPlainObject, j.isWindow, j.type
j.extend = function () {
    var src, copyIsArray, copy, name, options, clone,
        target = arguments[0] || {},
        i = 1,
        length = arguments.length,
        deep = false;

    // Handle a deep copy situation
    if (typeof target === "boolean") {
        deep = target;

        // skip the boolean and the target
        target = arguments[i] || {};
        i++;
    }

    // Handle case when target is a string or something (possible in deep copy)
    if (typeof target !== "object" && !j.isFunction(target)) {
        target = {};
    }

    // extend jQuery itself if only one argument is passed
    if (i === length) {
        target = this;
        i--;
    }

    for (; i < length; i++) {
        // Only deal with non-null/undefined values
        if ((options = arguments[i]) != null) {
            // Extend the base object
            for (name in options) {
                src = target[name];
                copy = options[name];

                // Prevent never-ending loop
                if (target === copy) {
                    continue;
                }

                // Recurse if we're merging plain objects or arrays
                if (deep && copy && (j.isPlainObject(copy) || (copyIsArray = j.isArray(copy)))) {
                    if (copyIsArray) {
                        copyIsArray = false;
                        clone = src && j.isArray(src) ? src : [];

                    } else {
                        clone = src && j.isPlainObject(src) ? src : {};
                    }

                    // Never move original objects, clone them
                    target[name] = j.extend(deep, clone, copy);

                    // Don't bring in undefined values
                } else if (copy !== undefined) {
                    target[name] = copy;
                }
            }
        }
    }

    // Return the modified object
    return target;
};


//only in get mode
j.fn.attr = function (name) {
    return this[0].getAttribute(name);
}
j.fn.find = function (selector) {
    var newArray = [],
        tq;//temporary query

    this.each(function (i) {
        tq = Array.prototype.slice.call(this.querySelectorAll(selector), '')
        if (tq.length) {
            newArray = newArray.concat(tq);
        }
    })
    return j(newArray);
}
//only in get mode
j.fn.data = function (type, fn) {
    return this[0].dataset;
}
j.parseJSON = function (json) {
    return JSON.parse(json);
}





export default j;