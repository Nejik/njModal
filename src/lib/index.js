/*!
 * njModal - v2.0.0
 * nejikrofl@gmail.com
 * Copyright (c) 2017 N.J.
*/
import j from 'lib/j'
//by default we use jQuery, it makes possible to run plugin with jQuery (low ie support for example)
const $ = window.jQuery || j;

import {
  getDefaultInfo,
  defaults
} from 'lib/utils.js';

class njModal {
  constructor(el, options) {//el can be a string, selector/dom/j/jQuery element
    if (!arguments.length) {
      console.error('njModal, arguments not passed.');
      return;
    }
    let opts;

    if (!options && el) {//if we have only one argument
      if ($.isPlainObject(el)) {//if this argument is plain object, it is options
        opts = el;
      } else {//if it's not options, it is dom/j/jQuery element or selector
        opts = { elem: el }
      }
    } else {//if we have two arguments
      opts = options;
      opts.elem = el;
    }

    opts = opts || {};

    this._init(opts);
  }

  //we make array like object with all active instances of plugin
  static instances = { length: 0 };
  //array with all opened instances
  static opened = [];

  //addons
  static a = {};

  //default settings
  static defaults = defaults;

  _init(opts) {
    let o = this.o = $.extend({}, njModal.defaults, opts),
      that = this;

    // this.items = [];//list of all slides
    this.active = 0;

    //inner options, current state of app
    this.state = {};

    //inner options, this settings alive throughout the life cycle of the plugin(until destroy)
    this._globals = {
      //todo, вынести в аддон галереи
      // canChange: true//flag, that shows we can change slide
    }
    this._handlers = {};//all callback functions we used in event listeners lives here

    this.v = {
      document: $(document),
      window: $(window),
      html: $(document.documentElement),
      body: $(document.body)

      //... other will be added later
    }

    //we should have dom element or at least content option for creating slide
    if (!o.elem && !o.content) {
      this._error('njModal, no elements or content for modal.');
      return;
    }

    //gather options for every slide
    this.items = this._createItems(this.els || [this.o]);
  }
  _createItems = function (els) {
    let items = [];
    for (let i = 0, l = els.length; i < l; i++) {
      items.push(this._createItem(els[i]))
    }
    return items;
  }
  _createItem = function (item) {
    let normalizedItem = this._normalizeItem(item);

    normalizedItem.dom = this._createDomForItem(normalizedItem);
    
    this._cb('slide_created', normalizedItem);
    return normalizedItem;
  }
  _normalizeItem = function (item) {
    let normalizedItem = {
      content: item.content || this.o.text._missedContent,
      type: item.type || this._type(item.content),
      header: item.header,
      footer: item.footer,
      title: item.title,
      el: item.dom,
      template: item.template,
      o: {}
    };

    return normalizedItem;
  }
  _createDomForItem = function (item) {
    var o = this.o,
        that = this,
        dom = {};
    
    dom.modal = $(o.templates.modal);
    dom.modal[0].setAttribute('tabindex', '-1');
    dom.modal[0].njModal = that;
    if (!dom.modal.length) {
      that._error('njModal, error in o.templates.modal');
      return;
    }
    
    if(o.template) {
      this._createContentFromTemplate(item);
    } else {
      this._createContentFromOptions(item);
    }
    console.log(dom.modal[0].outerHTML);
    
    return dom;
  }
  _createContentFromTemplate = function() {
    return '';
  }
  _createContentFromOptions = function() {
    return '';
  }
  _type = function (content) {//detect content type
    var type = 'html';

    if (typeof content === 'object') {
      if ((window.jQuery && content instanceof window.jQuery) || (window.j && content instanceof window.j)) {
        return 'selector';
      }
    } else
      if (/^[#.]\w/.test(content)) {
        return 'selector';
      } else if (/\.(png|jpg|jpeg|gif|tiff|bmp|webp)(\?\S*)?$/i.test(content)) {
        return 'image';
      }


    return type;
  }

  _gatherElements = function (elem) {
    let that = this,
      $elem;
    if (!elem) {
      this._cb('elements_gathered', elem);
      return;
    }

    $elem = $(elem);

    if ($elem.length > 1) {
      $elem = $($elem[0])
    }

    if ($elem[0].njModal) {
      this._error('njModal, already inited on this element', true);
      return;
    }
    $elem[0].njModal = this; //prevent multiple initialization on one element

    //extend global options with gathered from dom element
    $.extend(true, this.o, this._gatherData($elem[0]))

    this._cb('elements_gathered', $elem[0]);
    return $elem;
  }

  _gatherData = function (el) {
    let o = this.o,
      $el = $(el),
      dataO = $el.data(),//data original
      dataProcessed = {};//data processed

    if (dataO.njmOptions) {
      try {
        dataProcessed = $.parseJSON(dataO.njmOptions);
        delete dataO.njmOptions;
      }
      catch (e) {
        this._error('njModal, fail to parse json from njm-options', true);
        return;
      }
    }

    //try to get href from original attributes
    if ($el[0].tagName.toLowerCase() === 'a') {
      let href = $el.attr('href');
      if (href && href !== '#' && href !== '#!' && !(/^(?:javascript)/i).test(href)) {//test href for real info, not placeholder
        dataProcessed.content = href;
      }
    }

    //get title
    if (o.titleAttr) {
      let titleAttr = $el.attr(o.titleAttr);
      if (titleAttr) dataProcessed.title = titleAttr;
    }

    $.extend(true, dataProcessed, choosePrefixedData(dataO))

    function choosePrefixedData(data) {
      var prefixedData = {};

      for (var p in data) {//use only data properties with njm prefix
        if (data.hasOwnProperty(p) && /^njm[A-Z]+/.test(p)) {
          var shortName = p.match(/^njm(.*)/)[1],
            shortNameLowerCase = shortName.charAt(0).toLowerCase() + shortName.slice(1);

          prefixedData[shortNameLowerCase] = transformType(data[p]);
        }
      }

      return prefixedData;
    }


    function transformType(val) {//transform string from data attributes to boolean and number
      var parsedFloat = parseFloat(val);
      if (val === 'true') {
        return true;
      } else if (val === 'false') {
        return false;
      } else if (!isNaN(parsedFloat)) {
        return parsedFloat;
      } else {
        return val;
      }
    }

    this._cb('data_gathered', dataProcessed, $el[0]);
    return dataProcessed;
  }

  //todo, check clear method
  _clear = function () {
    var o = this.o,
      that = this;

    this.v.container[0].njm_instances--;
    this.v.container.removeClass('njm_open');//remove only from last closing instance

    if (o['class']) this.v.wrap.removeClass(o['class']);

    that._scrollbar('show');


    if (this.v.wrap && this.v.wrap.length) this.v.wrap[0].parentNode.removeChild(this.v.wrap[0]);

    this._removeSelectorItemsElement();

    //todo, clear only in gallery
    //todo, do this if not tooltip/popover
    //clear inline position
    // for (var i = 0, l = that.items.length; i < l ;i++) {
    //     that.items[i].dom.modalOuter[0].style.cssText = '';
    // }


    //todo, remove in gallery addon
    // if(o.delegate) {//we should remove this info, because of delegate mode, it will be created again on next show
    //     if(that.els && that.els.length) that.els.each(function (i,el) {
    //         delete el.njBox;
    //     })
    //     delete that.els;
    //     that.items = [];//list of all items
    // }
    this.active = 0;

    if (this.v.items && this.v.items.length) empty(this.v.items[0]);//we can't use innerHTML="" here, for IE(even 11) we need remove method

    function empty(el) {
      while (el.firstChild) {
        el.removeChild(el.firstChild);
      }
    }
    this._o = {};

    that._cb('clear');
  }
  _error = function (msg, clear) {
    if (!msg) return;

    if (clear) this._clear();

    console.error(msg);
  }
  _cb = function (type) {//cb - callback
    var o = this.o,
      that = this,
      callbackResult;

    if (type === 'inited' ||
      type === 'show' ||
      type === 'shown' ||
      type === 'hide' ||
      type === 'hidden' ||
      type === 'change' ||
      type === 'changed' ||
      type === 'destroy' ||
      type === 'destroyed'
    ) {
      this.state = type;
    }
    //do some dirty stuff on callbacks
    this._cbStuff(type);

    //trigger callbacks

    //trigger on modal instance
    this.trigger.apply(this, arguments);


    //trigger common callback function from options
    var cbArgs = Array.prototype.slice.call(arguments);
    if (o['oncb'] && typeof o['oncb'] === 'function') {
      callbackResult = o['oncb'].apply(this, cbArgs);
    }
    //trigger common callback on document
    // cbArgs.push(this);
    // this.v.document.triggerHandler('njm_cb', cbArgs);

    //trigger common callback on instance
    this.trigger.apply(this, ['cb'].concat(cbArgs));


    //trigger callback from options with "on" prefix (onshow, onhide)
    var clearArgs = Array.prototype.slice.call(arguments, 1);
    if (typeof o['on' + type] === 'function') {
      callbackResult = o['on' + type].apply(this, clearArgs);
    }


    //trigger on document
    // var args = Array.prototype.slice.call(arguments, 1);
    // args.unshift(this);
    // this.v.document.triggerHandler('njm_'+type, args);


    //trigger on element
    //todo make trigger on element option
    // if(o.$elem && o.$elem.length) o.$elem.triggerHandler('njm_'+type, args);
    return callbackResult;
  }
  _cbStuff = function (type) {
    var o = this.o;

    switch (type) {
      case 'shown':
        this._setFocusInPopup();

        // todo, preload for gallery
        // setTimeout(function() {
        //   if(njBox.a.gallery)that._preload();//start preload only after all animations is probably complete..
        // }, 500);
        break;
      case 'hidden':
        this.state = 'inited';
        break;
    }
  }

  //event emitter
  on = function (event, fct) {
    this._events = this._events || {};
    this._events[event] = this._events[event] || [];
    this._events[event].push(fct);
    return this;
  }
  off = function (event, fct) {
    this._events = this._events || {};
    if (event in this._events === false) return;
    this._events[event].splice(this._events[event].indexOf(fct), 1);
    return this;
  }
  trigger = function (event /* , args... */) {
    this._events = this._events || {};
    if (event in this._events === false) return;
    for (var i = 0; i < this._events[event].length; i++) {
      this._events[event][i].apply(this, Array.prototype.slice.call(arguments, 1));
    }
    return this;
  }
}
//global options (we should call it only once)
if (!njModal.g) njModal.g = getDefaultInfo();

export default njModal;