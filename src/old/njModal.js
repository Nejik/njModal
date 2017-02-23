 /*!
	* njModal - v0.7.1
	* nejikrofl@gmail.com
	* Copyright (c) 2014-2016 N.J.
 */
;(function(window, document, undefined){
'use strict';

//our common utils, instead of jQuery
var $ = window.jQuery || window.j;
if(!$) {
	console.error('njModal, requires jQuery or "j" library (https://github.com/Nejik/j)');
	return;
}


window.njModal = function(el, options) {//el can be a string, selector/dom/j/jQuery element
	if(!arguments.length) {
		console.error('njModal, arguments don\'t specified.');
		return;
	}
	var opts;

	if(!options && el) {//if we have only one argument
		if($.isPlainObject(el)) {//if this argument is plain object, it is options
			opts = el;
		} else {//if it's not options, it is dom/j/jQuery element or selector
			opts = {elem:el}
		}
	} else {//if we have two arguments
		opts = options;
		opts.elem = el;
	}

	opts = opts || {};

	if(!(this instanceof njModal)) {//when we call njModal not as a contructor, make instance and call it
		opts.iife = true;//flag that show self-invoked call, if iife, we will destroy it on hide

		if(opts.delegate) {//if we have delegate option, don't manually call .show method
			return new njModal(opts);
		} else {
			return new njModal(opts).show();
		}
	} else {
		this._init(opts);
		return this;
	}
};
//global settings/methods


njModal.instances = {length:0};
//array with all opened instances
njModal.opened = [];
//addons
njModal.a = {};
//global options
njModal.g = {};

njModal.autobind = function () {
	$(njModal.defaults.autobind).each(function () {
		if(this.njModal) return;
		new njModal({
			elem: $(this)
		})
	})
};
//return last opened instance
njModal.last = function () {return njModal.opened[njModal.opened.length - 1]};

njModal.addAddon = function (name, addon) {
	njModal.a[name] = true;

	if(addon.options) $.extend(true, njModal.defaults, addon.options);
	$.extend(njModal.prototype, addon.proto);
}

var proto = njModal.prototype;

proto._init = function (opts) {
	opts = opts || {};
	this.$ = $;
	var o = this.o = $.extend(true, {}, njModal.defaults, opts),
		that = this;


	this.slides = [];//list of all slides
	this.active = 0;

	//inner options, they destroyd after every hide
	this._o = {}
	//inner options, this settings alive throughout the life cycle of the plugin(until destroy)
	this._g = {
		canChange: true//flag, that shows we can change slide
	}
	this._handlers = {};//all callback functions we used in event listeners lives here

	this.v = {//object with cached variables
		document: $(document),
		window: $(window),
		html: $('html'),
		body: $('body'),
		overlay: $(o.templates.overlay),
		close: $(o.templates.close).attr('title', o.text.close)
		//... other will be added later in code
	};


	if(o.elem) {
		o.$elem = $(o.elem);
		if(!o.$elem.length) {//if we have no elements after query, don't do anything
			// don't use error here! because other code in concatenated file will fail
			this._error('njModal, wrong selector/element (o.elem)', true);
			return;
		} else if(o.$elem.length === 1) {//if we have one item, detect if it is gallery wrapper or solo item for popup
			if(o.$elem[0].njModal) {
				this._error('njModal, can\'t be initialized again on this element.', true);
				return;
			}

			$.extend(true, o, this._gatherData(o.$elem));//extend original options with gathered from element

			if (njModal.a.gallery) {
				if(o.selector) {//that means we in gallery mode and o.elem is a wrapper
					this._setEls(o.$elem.find(o.selector))
				} else if(o.delegate) {
					//we don't need to do anything here if delegate option is enabled, slides will be gathered in click handler
				} else {//that means it usual popup
					this._setEls(o.$elem)
				}
			} else {
				this._setEls(o.$elem)
			}

		} else {//if we have multiple elements, make gallery from them
			if (njModal.a.gallery) {
				this._setEls(o.$elem)
			} else {
				this._error('njModal, only one element is allowed without gallery addon', true);
				return;
			}
		}
	}


	if(!o.elem && !o.content && (o.type && !o.tpl[o.type])) {
		this._error('njModal, no elements or content for modal.', true);
		return;
	}

	this._makeSlides();

	if(o.$elem && o.$elem.length === 1) o.$elem[0].njModal = this; //prevent multiple initialization for gallery case new njModal({elem:'#wrapper',selector:'a'})

	//we should remember original option, because we have delegate mode, and slides can be changed in this mode
	this._g.originalLoop = o.loop;

	if(this.slides.length < 3 && o.loop && !o.delegate) {
		o.loop = false;
	}

	//find core
	this.v.container = $(o.container);
	if(!this.v.container.length) this.v.container = this.v.body;//in case if we have no container element, or wrong selector for container element
	//check if container not position static
	if(this.v.container[0] !== this.v.body[0] && this.v.container.css('position') === 'static') {
		this.v.container.css('position', 'relative');
		this._g.containerStatic = true;
	}

	//create core elements
	this.v.wrap = $(o.templates.wrap);
	if(!this.v.wrap.length) {
		this._error('njModal, smth wrong with o.templates.wrap.', true);
		return;
	}
	if(o['class']) this.v.wrap.addClass(o['class']);
	this.v.wrap[0].njModal = this;
	if(o.zindex) this.v.wrap.css('zIndex', o.zindex);


	this.v.slides = this.v.wrap.find('.njm-slides');
	if(o.imgclick) this.v.slides.addClass('njm-image-click');

	//if container custom element(not body), use forcely absolute position
	if(this.v.container[0] !== this.v.body[0]) o.position = 'absolute';
	if(o.position === 'absolute') this.v.wrap.css('position','absolute');


	this.v.ui = $(o.templates.ui).appendTo(this.v.wrap);
	this.v.ui_count = $(o.templates.count).appendTo(this.v.ui);
	this.v.ui_current = this.v.ui_count.find('[data-njm-current]').attr('title', o.text.current);
	this.v.ui_total = this.v.ui_count.find('[data-njm-total]').attr('title', o.text.total);


	this.v.ui_titleOuter = this.v.ui.find('.njm-ui-title-outer');
	this.v.ui_title = this.v.ui_titleOuter.find('[data-njm-title]');
	this.v.prev = $(o.templates.prev).attr('title', o.text.prev);
	this.v.next = $(o.templates.next).attr('title', o.text.next);


	//remember instance id in this set, for deleting it when destroy
	this._g.id = njModal.instances.length;
	//write instance to global set of all instances
	Array.prototype.push.call(njModal.instances, this);
	
	//add initial click handlers
	this._setClickHandlers();

	// initializing addons
	for (var key in njModal.a) {
		if (njModal.a.hasOwnProperty(key)) {
			this['_'+key+'_init']();
		}
	}

	if(o.modal) {
		o.out = false;
		o.close = false;
	}

	this._g.els2margin = $([this.v.ui_titleOuter[0], that.v.next[0], this.v.close[0]]).add(o.els2margin);

	this._o.inited = true;
	this._cb('inited');

	return this;
}
proto.show = function (index) {//we can use show(slide_index) instead of goTo
	if(njModal.a.gallery) this._gallery_showSetIndex(index);

	if(this._o === null) {
		this._error('njModal, you can\'t show, plugin destroyed...');
		return;
	}

	var o = this.o,
		that = this;

	if(njModal.a.gallery) this._gallery_showInit();

	if(!this.slides.length) {
		this._error('njModal, smth goes wrong, plugin don\'t create any slides', true);
		return;
	}
	if(this._o.state !== 'inited') {
		this._error('njModal, plugin not inited or not in inited state(probably plugin is already visible)');
		return;
	}

	if(this._cb('show') === false) return;//callback show (we can cancel showing popup, if show callback will return false)


	this.v.container.addClass('njm_open');
	if(o['class']) this.v.wrap.addClass(o['class']);

	this._scrollbar('hide');

	// insert outside close button
	if(o.close === 'outside' && !this._o.closeInserted) {
		this.v.ui.append(this.v.close);

		this._o.closeInserted = true;
	}

	//this method calculate show/hide animation durations
	this._calculateAnimations();

	//show overlay
	this._overlay('show');


	this._cb('ui');//calls before inserting slide to page, here we can do our custom manipulations
	if(njModal.a.gallery) this._insertArrows();//here we insert arrows, if they are set outside


	//set event handlers
	that._setEventsHandlers();

	//insert wrap
	this.v.container.append(this.v.wrap);

	//initial draw for first slide (and also 2 siblings if they are exist)
	this._drawSlide(this.active);

	this._ui_update();

	//all opened popups saved in global variable njModal.opened
	njModal.opened.push(this);

	//force repaint (we should do this for transitions working) p.s. now we not support modal animation on transitions, so, we don't need it
	// this.v.wrap[0].style.display = 'none';
	// this.v.wrap[0].clientHeight;
	// this.v.wrap[0].style.display = 'block';

	that._anim('show');

	return this;
}
proto.hide = function () {
	if(this._o.state !== 'shown') {
		this._error('njModal, hide, we can hide only showed modal (probably animation is still running).')
		return;
	}

	var o = this.o,
		that = this,
		h = this._handlers;

	if(this._cb('hide') === false) return;//callback hide

	this.v.ui.removeClass('njm-visible');

	//return focus to proper element, after hiding modal
	var last = njModal.last();//for proper focus handling
	if(last && last !== this) {
		last.v.wrap.focus();
	} else {
		if(this._o.clickedEl) $(this._o.clickedEl).focus();
	}

	that._preloader('hide', this.active)
	this._overlay('hide');

	//remove all listeners
	this.v.wrap	.off('click',   h.wrap_out)
				.off('resize',  h.wrap_resize)
				.off('scroll',  h.wrap_scroll)
				.off('keydown', h.wrap_keydown)

				.undelegate('[data-njm-close]', 'click',   h.wrap_close)
				.undelegate('[data-njm-ok]', 'click',   h.wrap_ok)
				.undelegate('[data-njm-cancel]', 'click',   h.wrap_cancel)
				
	delete h.wrap_out
	delete h.wrap_resize
	delete h.wrap_scroll
	delete h.wrap_keydown
	delete h.wrap_close
	delete h.wrap_ok
	delete h.wrap_cancel

	this.v.window	.off('resize', h.window_resize)
					.off('orientationchange', h.window_orientation)
	delete h.window_resize
	delete h.window_orientation


	this.v.container.off('resize', h.container_resize)
					.off('scroll', h.container_scroll)
	delete h.container_resize
	delete h.container_scroll

	this.slidesState = null;

	this._anim('hide');

	return this;
}
proto.position = function (index) {
	if(typeof index === 'string') index = parseInt(index);
	if(!this.v.wrap) return;//we can't set position of element, if there is no modal...

	var o = this.o,
		that = this;

	this._getEnvironmentValues();

	//position of global wrapper
	if(o.position === 'absolute') {
		//global wrap positioning
		if(this.v.container[0] !== this.v.body[0]) {
			var scrollTop = this._o.elScrollTop,
				scrollLeft = this._o.elScrollLeft;
		} else {
			var scrollTop = this._o.scrollTop,
				scrollLeft = this._o.scrollLeft;
		}

		if(scrollTop <= this._o.maxScrollTop) {
			this.v.wrap.css({'top':scrollTop + 'px','left':scrollLeft + 'px'})
			// this.v.overlay.css({'top':scrollTop + 'px','left':scrollLeft + 'px'})
		}

		//overlay positioning
		this.v.overlay.css({'width':'auto','height':'auto'});
		this.v.overlay[0].clientHeight;
		this.v.overlay.css({'width' : this.v.container[0].scrollWidth + 'px',
							'height' : this.v.container[0].scrollHeight + 'px'
							});
	}

	//set autoheight
	// requestAnimationFrame(function () {//don't remember why requestAnimationFrame here...
		that._setMaxHeight();


		// that._els2margin();
	// })

	this._cb('positioned');

	return this;
}
proto.destroy = function () {
	var o = this.o,
		that = this;

	if(!this._o.inited || this._o.state !== 'inited') {
		this._error('njModal, we can destroy only initialized && hidden modals.');
		return;
	}

	this._cb('destroy');

	if(o.delegate) {
		o.$elem.undelegate(o.delegate, 'click', this._handlers.delegate);
		delete this._handlers.delegate;
	} else {
		if(this.els && this.els.length) {
			if(o.selector && o.$elem && o.$elem.length === 1) {
				o.$elem.undelegate(o.selector, 'click', this._handlers.elsClick);
			} else {
				this.els.off('click', this._handlers.elsClick);
			}

			this.els.each(function (i, el) {
				el.njModal = null;//we can't use delete operator here, because ie fails when deleting on dom elements
			})

			if(o.clickels) {
				$(o.clickels).off('click', this._handlers.elsClick)
			}

			delete this._handlers.elsClick;
		}
	}

	if(this._g.containerStatic) {
		this.v.container[0].style.position = '';//reset to default
		delete this._g.containerStatic;
	}

	delete njModal.instances[this._g.id];
	njModal.instances.length--;

	this._cb('destroyed');

	return this;
}
proto._setEls = function (els) {//this method choose dom elements, from which we will create modal/gallery
	if(!els || !els.length) {
		this._error('njModal, no dom elements for modal window were found.');
		return;
	}

	var allowed = [];

	for (var i = 0, l = els.length; i < l ;i++) {
		if(!els[i].njModal) allowed.push(els[i]);
	}

	this.els = $(allowed);
}
proto._setMaxHeight = function (index) {
	var o = this.o,
		that = this;

	//set maxheight only for 3 active slides
	for (var i = 0, l = this.slidesState.length; i < l ;i++) {
		if(this.slidesState[i] !== null) {
			setMaxHeight(this.slidesState[i]);
		}
	}
	function setMaxHeight(index) {
		//autoheight
		if(
		   (o.autoheight === true && that.slides[index].type !== 'image') ||
		   ((o.autoheight === true || o.autoheight === 'image') && that.slides[index].type === 'image')
		   ) {
			if(!that._o.autoheightAdded) {
				(o.autoheight === true) ? that.v.slides.addClass('njm-autoheight-true') : that.v.slides.addClass('njm-autoheight-image')
				that._o.autoheightAdded = true
			}

			var 	v                = that.slides[index].v,
					modalMargin      = summ(v.modal,'margin'),
					modalPadding     = (summ(v.modal,'padding') + parseInt(v.modal.css('borderTopWidth')) + parseInt(v.modal.css('borderBottomWidth'))) || 0,

					bodyMargin       = summ(v.body,'margin'),
					bodyPadding      = (summ(v.body,'padding')  + parseInt(v.body.css('borderTopWidth')) + parseInt(v.body.css('borderBottomWidth'))) || 0,

					containerHeight  = that._o.elHeight || that._o.winHeight,

					height           = containerHeight,

					bodyBorderBox    =  v.body.css('boxSizing') === 'border-box';

			var headerHeight    = 0,
				footerHeight      = 0;

			(v.header && v.header.length) ? headerHeight = v.header[0].scrollHeight + (parseInt(v.header.css('borderTopWidth')) + parseInt(v.header.css('borderBottomWidth'))) || 0 : 0;
			(v.footer && v.footer.length) ? footerHeight = v.footer[0].scrollHeight + (parseInt(v.footer.css('borderTopWidth')) + parseInt(v.footer.css('borderBottomWidth'))) || 0 : 0;

			height = containerHeight - modalMargin - modalPadding - bodyMargin - headerHeight - footerHeight;

			if(!bodyBorderBox) height -= bodyPadding;
			v.body.css('maxHeight', height + 'px');


			if(that.slides[index].type === 'image') {
				var autoheightImg = containerHeight - modalMargin - modalPadding - bodyMargin - bodyPadding - headerHeight - footerHeight;

				v.$img.css('maxHeight', autoheightImg + 'px');
			}
		}

		function summ(el, prop) {
			return (parseInt(el.css(prop + 'Top')) + parseInt(el.css(prop + 'Bottom'))) || 0;
		}
	}
}
proto._els2margin = function (offmode) {//function that adds margin right to elements, when active slide hasvertical scrollbar(uses for ui elements and also can be used for fixed header on site)
	var o = this.o,
		that = this;

	if(offmode) {
		removemargin();
		return;
	}

	var sb = false,//have we scrollbar on active slide?
		el = that.slides[that.active].v.modalOuter[0];

	if(el.scrollHeight > el.clientHeight) sb = true;

	if(sb) {
		if(!that._o.elsMarginAdded) {
			that._o.elsMarginAdded = true;
			that._g.els2margin.each(function (i, el) {
				var $el = $(el),
					computedMargin = parseInt($el.css('marginRight')) + njModal.g.scrollbarSize;

				$el.css('marginRight', computedMargin+'px')
			})
		}
	} else if(that._o.elsMarginAdded) {
		removemargin();
	}

	function addMargin() {

	}
	function removemargin() {
		that._o.elsMarginAdded = false;
		// that._g.els2margin.css('marginRight', '0px');
		that._g.els2margin.each(function (i, el) {
			var $el = $(el),
				computedMargin = parseInt($el.css('marginRight')) - njModal.g.scrollbarSize;
			if(computedMargin < 0) computedMargin = 0;

			$el.css('marginRight', computedMargin+'px')
		})
	}
}
proto._drawSlide = function (index) {
	var o = this.o;

	this._setSlideState(index);

	//insert index slide
	if(!this.slides[index]) {
		this._error('njModal, we have no slide with this index - '+index, true);
		return;
	}

	this._insertContent(index);

	this.v.slides.append(this.slides[index].v.modalOuter);

	if(njModal.a.gallery) this._drawSiblings(index);
}
proto._setSlideState = function (index) {
	var o = this.o,
		prev = index - 1,
		next = index + 1;

	if(o.loop) {
		if(prev === -1) prev = this.slides.length - 1;
		if(next === this.slides.length) next = 0;
	}
	if(!this.slides[prev]) prev = null;
	if(!this.slides[next]) next = null;


	this.slidesState = [prev, index, next];
}
proto._insertContent = function (index) {
	var o = this.o,
		that = this,
		slide = this.slides[index],
		content = slide.content,
		type = slide.type,
		header = slide.header,
		footer = slide.footer;
	if((slide.status === 'loading' || slide.status === 'loaded')) {//don't render slide again if it is not selector type

		if(o.tpl && o.tpl[type]) {//if this is custom type
			return;//don't update
		} else if(type === 'selector') {
			insertFromSelector();//need to only update body of slide
			return;
		} else {
			return;
		}

	}

	if(!content) content = o._missedContent;
	if(!type) type = this._type(content);

	switch(type) {
	case 'image':
		var img = document.createElement('img'),
			$img = $(img),
			ready,
			loaded;

		slide.status = 'loading'
		slide.v.img = img;
		slide.v.$img = $img;

		slide._handlerError = function () {
			$img.off('error', slide._handlerError).off('abort', slide._handlerError);
			delete slide._handlerError;

			that._preloader('hide', index);

			slide.v.body.html(o.text.imageError.replace('%url%', content));

			that._cb('img_error', index);//img_ready, img_load callbacks
			rendered();

			slide.status = 'error';
		}
		$img.on('error', slide._handlerError).on('abort', slide._handlerError);


		// img.alt = slide.title || 'Slide '+index;
		if(slide.title) img.alt = slide.title;
		img.src = content;

		ready = img.width + img.height > 0;
		loaded = img.complete && img.width + img.height > 0;


		if(o.img === 'ready' && ready || o.img === 'load' && loaded) {
			checkShow(true);
		} else {
			this._preloader('show', index);

			slide._handlerImgReady = function () {
				$img.off('njm_ready', slide._handlerImgReady);
				checkShow('ready');
			}
			$img.on('njm_ready', slide._handlerImgReady)
			findImgSize(img);

			slide._handlerLoad = function () {
				$img.off('load', slide._handlerLoad);
				checkShow('load');
			}

			$img.on('load', slide._handlerLoad)
		}
	break;
	case 'text':
		slide.v.body.text(content);
		rendered();
	break;
	case 'html':
		slide.v.body.html(content);
		rendered();
	break;
	case 'selector':
		insertFromSelector(true);
	break;
	default:
		if(!njModal.a.modal) {
			this._error('njModal, seems that you use custom or wrong type('+type+') of slide, you need modal addon for using custom types.', true);
			return;
		} else {
			this._insertContentModal(index, slide.content, type);
			return;
		}
	break;


	// case 'ajax':
	//  slide.xhr = new(XMLHttpRequest || ActiveXObject)("Microsoft.XMLHTTP");

	//  slide.xhr.onreadystatechange = function () {
	//    console.log('ready state change')

	//    if(this.readyState === 4) {
	//      if(this.status == 200) {
	//        content = this.responseText;

	//        that._insertContent(index, content, 'html');
	//      } else {
	//        this.ajax_error();
	//      }
	//    }
	//  }

	//  slide.xhr.open("GET", content, true);
	//  slide.xhr.send(null);
	// break;
	}
	function insertFromSelector(firstRender) {
			// don't select element again, if element already selected, but we need to insert it again in slide
			if(slide.v.contentEl && slide.v.contentEl.length) {
					showAndInsert();
					return;
			}

			slide.v.contentEl = $(content);

			if(slide.v.contentEl.length) {
					showAndInsert();
			} else {
					slide.v.body.html(content);//if we don't find element with this selector
			}

			function showAndInsert() {
				that._o.slides_selector = that._o.slides_selector || [];//remember in inner settings that in this slides we have elements(because we don't want to cycle throught all slides on hide)
				that._o.slides_selector.push(index);

					//make element visible
					if(slide.v.contentEl.css('display') === 'none') {
							that._o.slides_selector_dn = that._o.slides_selector_dn || [];
							that._o.slides_selector_dn.push(index);
							slide.v.contentEl.css('display', 'block');
					}

					slide.v.body.append(slide.v.contentEl);
			}


			if(firstRender) rendered();
	}

	//helper function for image type
	function findImgSize(img) {
		var counter = 0,
			interval,
			njmSetInterval = function(delay) {
				if(interval) {
					clearInterval(interval);
				}

				interval = setInterval(function() {
					if(img.width > 0) {
						$img.triggerHandler('njm_ready');

						clearInterval(interval);
						return;
					}

					if(counter > 200) {
						clearInterval(interval);
					}

					counter++;
					if(counter === 5) {
						njmSetInterval(10);
					} else if(counter === 40) {
						njmSetInterval(50);
					} else if(counter === 100) {
						njmSetInterval(500);
					}
				}, delay);
			};

		njmSetInterval(1);
	}
	//helper function for image type
	function checkShow(ev) {
		if(that._o.state !== 'show' && that._o.state !== 'shown') return;
		that._cb('img_'+ev, index);//img_ready, img_load callbacks

		if(ev !== o.img && ev !== true) return;


		slide.status = 'loaded';
		that._preloader('hide', index);

		$img.attr('width','auto')//for IE <= 10
		.addClass('njm-imgShow');


		//insert content
		slide.v.body.append(img);

		rendered();


		//temporary remove this feature
		//if it is first slide, show image with show animation
		// if(that._o.goAnimAgain) {
		// 	console.log('trigger animagain')
		// 	//force repaint
		// 	that.v.wrap[0].style.display = 'none';
		// 	that.v.wrap[0].clientHeight;
		// 	that.v.wrap[0].style.display = 'block';

		// 	that._anim('show');

		// 	delete that._o.goAnimAgain;
		// }
	}

	function rendered() {
		//insert header
		if(header) {
			slide.v.header = $(o.templates.header);
			if(!slide.v.header.length) {
				that._error('njModal, error in o.templates.header.', true);
				return;
			}

			// because of custom templates, we need to check in what element we should insert header data
			var headerInput = (slide.v.header[0].getAttribute('data-njm-header') !== null) ? headerInput = slide.v.header : headerInput = slide.v.header.find('[data-njm-header]')
			headerInput.html(header);

			slide.v.modal.prepend(slide.v.header);
		}

		//insert footer
		if(footer) {
			slide.v.footer = $(o.templates.footer);
			if(!slide.v.footer.length) {
				that._error('njModal, error in o.templates.footer.', true);
				return;
			}

			// because of custom templates, we need to check in what element we should insert footer data
			var footerInput = (slide.v.footer[0].getAttribute('data-njm-footer') !== null) ? footerInput = slide.v.footer : footerInput = slide.v.footer.find('[data-njm-footer]')
			footerInput.html(footer);

			slide.v.modal.append(slide.v.footer);
		}

		if(njModal.a.gallery) that._insertArrows(index);//here we insert arrows, if they are set inside

		slide.status = 'loaded';

		//set proper classes
		// slide.v.modal.removeClass('njm-content njm-image');
		if(type === 'image') {
			slide.v.modalOuter.addClass('njm-image');
		} else {
			slide.v.modalOuter.addClass('njm-content njm-'+type);
		}

		that._cb('content_inserted', index);
	}
}
proto._preloader = function (type, index) {
	var o = this.o,
		that = this,
		slide = this.slides[index];

	switch(type) {
		case 'show':
			slide.preloader = true;
			slide.v.preloader = $(o.templates.preloader).attr('title', o.text.preloader);
			slide.v.modal.append(slide.v.preloader)
			// .addClass('njm-loading');

			// setTimeout(function(){
			//  slide.v.preloader.addClass('shown');
			// }, 0)

			// slide.v.preloader.on('click', function (e) {
			//  that.stopLoad();
			//  (e.stopPropagation) ? e.stopPropagation() : e.cancelBubble = true;
			// })

			//  // if(o.position === 'absolute_inner') {
			//  //  if(this.v.prependTo[0] === this.v.b[0]) {
			//  //    this.v.preloader.css('top', parseInt(this.v.preloader.css('top')) + this._o.scrollTop + 'px');
			//  //  } else {
			//  //    //fix strange bug in chrome
			//  //    if(this._o.elScrollTop) this.v.preloader.css('top', parseInt(this.v.preloader.css('top')) + this._o.elScrollTop + 'px');
			//  //  }
			//  // }
		break;

		case 'hide':
			if(!slide.preloader) return;
			// slide.v.modal.removeClass('njm-loading');

			// slide.v.preloader.removeClass('shown');

			// clearTimeout(slide.preloaderTimeout);
			// slide.preloaderTimeout = setTimeout(function(){
				// delete slide.preloaderTimeout;
				slide.v.preloader.remove();
				delete slide.v.preloader;
				delete slide.preloader;
			// }, that._getAnimTime(slide.v.preloader[0]))
		break;
	}
}

proto._type = function (content) {//detect content type
	var type = 'html';

	if(typeof content === 'object') {
		if((window.jQuery && content instanceof window.jQuery) || (window.j && content instanceof window.j)) {
			return 'selector';
		}
	} else
		if(/^[#.]\w/.test(content)) {
			return 'selector';
		} else if(/\.(png|jpg|jpeg|gif|tiff|bmp)(\?\S*)?$/i.test(content)) {
			return 'image';
	}


	return type;
}
proto._scrollbar = function (type) {
	var o = this.o;
	switch(type) {
	case 'hide':
		if(o.scrollbar === 'hide') {
			if(this.v.container[0] === this.v.body[0]) {//we can insert modal window in any custom element, that's why we need this if
				var sb = (document.documentElement.scrollHeight || document.body.scrollHeight) > document.documentElement.clientHeight;//check for scrollbar existance (we can have no scrollbar on simple short pages)


				//don't add padding to html tag if no scrollbar (simple short page) or popup already opened
				if(!this.v.container[0].njm_scrollbar && !this._o.scrollbarHidden && (sb || this.v.html.css('overflowY') === 'scroll' || this.v.body.css('overflowY') === 'scroll')) {
					this._o.scrollbarHidden = true;

					//existing of that variable means that other instance of popup hide scrollbar on this element
					this.v.html.addClass('njm_hideScrollbar');
					this.v.html.css('paddingRight', parseInt(this.v.html.css('paddingRight')) + njModal.g.scrollbarSize + 'px');
				}
			} else {
				var sb = (this.v.container[0].scrollHeight > this.v.container[0].clientHeight);//check for scrollbar existance on this element

				//don't add padding to html tag if no scrollbar (simple short page) or popup already opened
				if(!this._o.scrollbarHidden && (sb || this.v.container.css('overflowY') === 'scroll')) {

					//really i don't remember why we need this width..., so comment it now
					// this._o.containerOrigWidth = parseInt(this.v.container[0].style.width);
					this._o.scrollbarHidden = true;

					//existing of that variable means that other instance of popup hide scrollbar on this element
					this.v.container.css({'width': this.v.container[0].clientWidth + 'px'});

					this.v.container.addClass('njm_hideScrollbar');
					this.v.container.css('paddingRight', parseInt(this.v.container.css('paddingRight')) + njModal.g.scrollbarSize + 'px');
					
				}
			}

			if(this._o.scrollbarHidden) {
				//fixes case when we have 2 modals on one container, and after first close, first popup shows scrollbar
				//how many elements hides scrollbar on this element...
				(this.v.container[0].njm_scrollbar) ? this.v.container[0].njm_scrollbar++ : this.v.container[0].njm_scrollbar = 1;
			}
		}
	break;

	case 'show':
		if(this._o.scrollbarHidden) {
			if(--this.v.container[0].njm_scrollbar) {
				delete this._o.scrollbarHidden;
				return;
			} else {
				// ie 7 don't support delete on dom elements
				this.v.container[0].njm_scrollbar = null;
			}

			if(this.v.container[0] === this.v.body[0]) {
				this.v.html.removeClass('njm_hideScrollbar');
				var computedPadding = parseInt(this.v.html.css('paddingRight')) - njModal.g.scrollbarSize;

				if(computedPadding) {//if greater than 0
					this.v.html.css('paddingRight', computedPadding + 'px');
				} else {//if padding is 0, remove it from style attribute
					this.v.html[0].style.paddingRight = '';
				}
			} else {
				//really i don't remember why we need this width..., so comment it now
				// if(this._o.containerOrigWidth) {
				//  this.v.container.css({'width': this._o.containerOrigWidth + 'px'});
				//  delete this._o.containerOrigWidth;
				// } else {
				//  this.v.container[0].style.width = ''
				// }


				this.v.container.removeClass('njm_hideScrollbar');
				var computedPadding = parseInt(this.v.container.css('paddingRight')) - njModal.g.scrollbarSize;

				if(computedPadding) {//if greater than 0
					this.v.container.css('paddingRight', computedPadding + 'px');
				} else {//if padding is 0, remove it from style attribute
					this.v.container[0].style.paddingRight = ''
				}
			}

			delete this._o.scrollbarHidden;
		}
	break;
	}
}
proto._overlay = function (type) {
	var o = this.o,
		that = this;

	switch(type) {
	case 'show':
		if(this._o.overlayVisible) return;

		if(o.overlay === true || (o.overlay === 'one' && !njModal.opened.length)) {
			if(o.overlayassist) this.v.overlay[0].style.cssText = njModal.g.transitionDuration.css+':'+this._g.animShowDur+'ms';

			//insert overlay div
			if(o.position === 'absolute') this.v.overlay.css('position','absolute');
			this.v.container.append(this.v.overlay);

			// this.v.overlay[0].clientHeight;

			setTimeout(function(){//this prevent page from scrolling in chrome while background transition is working..., also needed as reflow
				that.v.overlay.addClass('njm-visible');
			}, 0)

			this._o.overlayVisible = true;
		}
	break;

	case 'hide':
		if(!this._o.overlayVisible) return;
		if(o.overlayassist) this.v.overlay[0].style.cssText = njModal.g.transitionDuration.css+':'+this._g.animHideDur+'ms';

		this.v.overlay.removeClass('njm-visible');

		setTimeout(function(){
			that.v.overlay.remove();
			if(o.overlayassist) that.v.overlay[0].style.cssText = '';
			delete that._o.overlayVisible;
		}, that._getAnimTime(that.v.overlay[0]))
	break;
	}
}

proto._calculateAnimations = function () {
	var o = this.o,
		that = this,
		animShow,
		animHide,
		animShowDur,
		animHideDur,
		tmp,
		appended = false;

	//get animation names
	if(o.anim) {
		tmp = o.anim.split(' ');
		animShow = tmp[0];
		(tmp[1]) ? animHide = tmp[1] : animHide = tmp[0];
	}

	//get animation durations from options
	o.duration = o.duration.toString();
	if(o.duration) {
		tmp = o.duration.split(' ');
		animShowDur = tmp[0];
		(tmp[1]) ? animHideDur = tmp[1] : animHideDur = tmp[0];
	}

	var div = document.createElement("div");
		div.style.cssText = 'visibility: hidden; position: absolute;';

	//check if we had numbers in anim duration or we should calculate it

	//detect animation duration for show animation
	if((!animShowDur || animShowDur === 'auto') && animShow) {
		div.className = (o.animclass || '') + ' ' + animShow;
		document.body.appendChild(div);
		appended = true;

		animShowDur = that._getAnimTime(div);
	} else {
		animShowDur = parseInt(animShowDur) || 0;
	}

	//detect animation duration for hide animation
	if((!animHideDur || animHideDur === 'auto') && animHide) {
		div.className = (o.animclass || '') + ' ' + animHide;
		if(!appended) {
			document.body.appendChild(div);
			appended = true;
		}

		animHideDur = that._getAnimTime(div);
	} else {
		animHideDur = parseInt(animHideDur) || 0;
	}

	if(appended) document.body.removeChild(div);

	this._g.animShow = animShow;
	this._g.animHide = animHide;
	this._g.animShowDur = animShowDur;
	this._g.animHideDur = animHideDur;
}
proto._anim = function (type, callback) {
	var o = this.o,
		that = this,
		modalOuter = this.slides[this.active].v.modalOuter,
		modal = this.slides[this.active].v.modal,
		animShow = this._g.animShow,
		animHide = this._g.animHide,
		animShowDur = this._g.animShowDur,
		animHideDur = this._g.animHideDur,
		tmp,
		showclasses = "",
		hideclasses= "";

	if(o.animclass) {
		showclasses += o.animclass;
		hideclasses += o.animclass;
	}
	showclasses += ' '+animShow;
	hideclasses += ' '+animHide;

	switch(type) {
	case 'show':
			if(animShow) {
				modalOuter.addClass('njm-animation njm-animation-show-'+animShow);
				modal.addClass(showclasses);

				setTimeout(shownCallback, animShowDur);
			} else {
				shownCallback();
			}
	break;

	case 'hide':
		if(animHide) {
			modalOuter.addClass('njm-animation njm-animation-hide-'+animHide);
			if(animHide === animShow) modal.addClass('njm-anim-reverse');
			modal.addClass(hideclasses);

			setTimeout(hiddenCallback, animHideDur)
		} else {
			hiddenCallback();
		}
	break;
	}
	function shownCallback() {
		modal.removeClass(showclasses);
		modalOuter.removeClass('njm-animation njm-animation-show-'+animShow);

		that._cb('shown');
	}
	function hiddenCallback() {
		modalOuter.removeClass('njm-animation njm-animation-hide-'+animHide);
		if(animHide === animShow) modal.removeClass('njm-anim-reverse');

		modal.removeClass(hideclasses);
		that._els2margin(true);

		that._cb('hidden');
	}
}

proto._makeSlides = function () {
	var o = this.o,
		that = this;

	//slides can be created from array in o.content
	if($.isArray(o.content) && o.content.length && njModal.a.gallery) {
		for (var i = 0, l = o.content.length; i < l ;i++) {
			this.slides.push({
				content: o.content[i].content,
				type: o.content[i].type,
				header: o.content[i].header,
				footer: o.content[i].footer,
				title: o.content[i].title,
				status: false
			})
			this._createDomForSlide(i);
		}
	} else if(this.els && this.els.length) {//or slides can be created from dom elements
		this._makeSlidesFromEls(this.els);
	} else if(!o.delegate) {//or slides can be created from options if no elements where provided
		this.slides.push({
			content: o.content,
			type: o.type || that._type(o.content),
			header: o.header,
			footer: o.footer,
			title: o.title,
			status: false
		})
		this._createDomForSlide(0);
	}
	that._cb('slidesCreated', this.slides)
}
proto._makeSlidesFromEls = function (els, add2els) {//els - any array
	var o = this.o,
		that = this,
		slideOptsOrig = {
			content: o.content || null,
			type: o.type || null,
			header: o.header || null,
			footer: o.footer || null,
			title: o.title || null,
			status: false
		};


	for (var i = 0, l = els.length; i < l ;i++) {

		if(els[i].njModal) continue;//don't add element, that already initialized as modal window

		els[i].njModal = that;

		var slideOpts = that._gatherData(els[i], true);
		slideOpts.el = els[i];

		var computedOpts = $.extend(true, {}, slideOptsOrig, slideOpts);
		computedOpts.type = computedOpts.type || that._type(computedOpts.content);


		that._createDomForSlide(that.slides.push(computedOpts) - 1);

		if(add2els) this.els = this.els.add(els[i]);//this flag used in addSlide method
	}
}
proto._createDomForSlide = function (index) {
	var o = this.o,
		that = this,
		slide = that.slides[index],
		header = slide.header,
		footer = slide.footer;


	slide.v = {};
	slide.v.modalOuter = $(o.templates.modal);
	slide.v.modalOuter[0].njModal = that;

	slide.v.modal = slide.v.modalOuter.find('.njm');
	slide.v.body = slide.v.modal.find('.njm-body');

	if(!slide.v.modal.length || !slide.v.body.length) {
		that._error('njModal, error in o.templates.modal.', true);
		return;
	}

	//create arrows
	if(that.o.arrows === 'inside') {
		slide.v.prev = $(that.o.templates.prev).attr('title', o.text.prev);
		slide.v.next = $(that.o.templates.next).attr('title', o.text.next);

		if(!slide.v.prev.length || !slide.v.next.length) {
			that._error('njModal, error in o.templates.prev or o.templates.next', true);
			return;
		}
	}

	//insert close button
	if(o.close === 'inside') slide.v.modal.append($(o.templates.close).attr('title', o.text.close));

	that._cb('slideCreated', index, slide)
}
proto._setClickHandlers = function () {//initial click handlers
	var o = this.o,
		that = this;

	if(!o.click || o.iife) return;
	
	if(this.els) {
		this._handlers.elsClick = this._clickHandler();
		this.els.off('click', this._handlers.elsClick).on('click', this._handlers.elsClick)
			
		if(o.clickels) {
			$(o.clickels).off('click', this._handlers.elsClick).on('click', this._handlers.elsClick)
		}
	}
}
proto._clickHandler = function() {
	//this method creates closure with modal instance
	var o = this.o,
		that = this;

	return function(e) {
		var el = this;
		
		if (e.originalEvent) e = e.originalEvent;//work with original event
		
		if('which' in e && (e.which !== 1 || e.which === 1 && e.ctrlKey && e.shiftKey)) return;//handle only left button click without key modificators
		(e.preventDefault) ? e.preventDefault() : e.returnValue = false;

		if(that._o.state !== 'inited') return;
		if($(el).closest('.njm-close-system, .njm-arrow').length) return;//don't remember why it here O_o


		that._o.clickedEvent = e;
		that._o.clickedEl = el;

		that.show();
	}
}

proto._setEventsHandlers = function () {//all other event handlers
	var o = this.o,
		that = this,
		h = this._handlers;
	
	h.container_resize = function () {

		that.position();
	}
	h.container_scroll = function () {

		that.position();
	}
	this.v.container.on('resize', h.container_resize)
					.on('scroll', h.container_scroll)


	h.wrap_out = function (e) {
		var $el = $(e.target),
			ui = $el.closest('.njm-ui'),
			popup = $el.closest('.njm'),
			prevent = ui.length || popup.length;

		if(!prevent) {
			e.preventDefault();
			if(!o.modal) {
				that.hide();
			} else {
				that.slides[that.active].v.modal.addClass('njm_pulse');

				setTimeout(function(){
					that.slides[that.active].v.modal.removeClass('njm_pulse');
				}, that._getAnimTime(that.slides[that.active].v.modal[0]))
			}
		}
	}
	h.wrap_resize = function () {

		that.position();
	}
	h.wrap_scroll = function (e) {
		that._o.wrapScrollTop = this.scrollTop;
		that._o.wrapScrollLeft = this.scrollLeft;

		that.position();
	}
	h.wrap_keydown = function (e) {
		switch(e.which) {
		case 27://esc
			if(o.esc) {
				if(that._cb('cancel') === false) return;
				that.hide();
			}

			e.preventDefault();
		break;
		}
		that._cb('keydown', e);
	}
	h.wrap_close = function (e) {
		that.hide();

		e.preventDefault();
		// e.stopPropagation();
	}
	h.wrap_ok = function (e) {
		e.preventDefault();

		if(that._cb('ok') === false) return;
		that.hide();
	}
	h.wrap_cancel = function (e) {
		e.preventDefault();

		if(that._cb('cancel') === false) return;
		that.hide();
	}
	


	this.v.wrap	.on('click', h.wrap_out)
				.on('resize', h.wrap_resize)
				.on('scroll', h.wrap_scroll)
				.on('keydown', h.wrap_keydown)
				.delegate('[data-njm-close]', 'click', h.wrap_close)
				.delegate('[data-njm-ok]', 'click', h.wrap_ok)
				.delegate('[data-njm-cancel]', 'click', h.wrap_cancel)

	h.window_resize = function (e) {

		that.position();
	}
	h.window_orientation = function (e) {

		that.position();
	}

	this.v.window	.on('resize', h.window_resize)
					.on('orientationchange', h.window_orientation)
	
	that._cb('setEventHandlers');
}

proto._ui_update = function (index) {
	var o = this.o,
		that = this,
		index = (typeof index === 'number') ? index : this.active,
		slide = this.slides[index];

	this.v.ui_current.html(index + 1 || '');//+1 because indexes are zero-based
	this.v.ui_total.html(that.slides.length || '');

	//show/hide slide counter
	if(that.slides.length === 1) {
		this.v.ui_count.addClass('njm-ui-count-hidden');
	} else {
		this.v.ui_count.removeClass('njm-ui-count-hidden');
	}

	this.v.ui_title.html(slide.title || '');

	if(slide.title) {
		this.v.ui_titleOuter.removeClass('njm-ui-title-hidden');
	} else {
		this.v.ui_titleOuter.addClass('njm-ui-title-hidden');
	}

	//add hide classes to arrows
	if(!o.loop) {
		var prev,
			next;

		if(o.arrows === 'outside') {
			prev = this.v.prev;
			next = this.v.next;
		} else if(o.arrows === 'inside') {
			prev = this.slides[this.active].v.prev;
			next = this.slides[this.active].v.next;
		}

		if(this.active === 0) {
			if(prev && prev.length) prev.addClass('njm-arrow-disabled');
		} else {
			if(prev && prev.length) prev.removeClass('njm-arrow-disabled');
		}

		//next arrow
		if(this.active === this.slides.length - 1) {
			if(next && next.length) next.addClass('njm-arrow-disabled');
		} else {
			if(next && next.length) next.removeClass('njm-arrow-disabled');
		}
	}

	that._els2margin();

	this._cb('ui_update');
}

proto._getEnvironmentValues = function () {
	var o = this.o,
		that = this;

	this._o.scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop;
	this._o.scrollLeft = window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft;

	//height of document
	// this._o.docHeight = Math.max(
	//               window.innerHeight, (
	//                          document.body.clientHeight
	//                          + parseInt(this.v.body.css('marginTop'))
	//                          + parseInt(this.v.body.css('marginBottom'))
	//                          + parseInt(this.v.body.css('paddingTop'))
	//                          + parseInt(this.v.body.css('paddingBottom'))
	//                          )
	//               );

	//width of document
	// this._o.docWidth = Math.max(window.innerWidth - njModal.g.scrollbarSize, document.body.scrollWidth);


	//window sizes
	// this._o.winWidth = (window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth);
	this._o.winHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;

	// if(this._o.scrollbarHidden) {
	//  this._o.winWidth -= njModal.g.scrollbarSize;
	// }

	//also if we insert popup into custom element, calculate element's width/height/scrollTop/scrollLeft
	if(this.v.container[0] !== this.v.body[0]) {
		this._o.elWidth = this.v.container[0].scrollWidth;
		this._o.elHeight = this.v.container[0].clientHeight;
		this._o.elScrollHeight = this.v.container[0].scrollHeight;
		this._o.elScrollTop = this.v.container[0].scrollTop;
		this._o.elScrollLeft = this.v.container[0].scrollLeft;

		if(!this._o.maxScrollTop) this._o.maxScrollTop = this._o.elScrollHeight - this._o.elHeight;
	}
}
proto._getAnimTime = function (el, property) {//get max animation or transition time

	return this._getMaxTransitionDuration(el, 'animation') || this._getMaxTransitionDuration(el, 'transition')
}
proto._getMaxTransitionDuration = function (el, property) {//method also can get animation duration
	var $el = $(el),
		dur,
		durArr,
		del,
		delArr,
		transitions = [];

	if(!$el.length) return 0;
	if(!property) return 0;

	dur = $el.css(property+'Duration');
	del = $el.css(property+'Delay');

	//make array with durations
	if (!dur || dur === undefined) dur = '0s';
	durArr = dur.split(', ');
	for (var i = 0, l = durArr.length; i < l ;i++) {
		durArr[i] = (durArr[i].indexOf("ms")>-1) ? parseFloat(durArr[i]) : parseFloat(durArr[i])*1000;
	}

	//make array with delays
	if (!del || del === undefined) del = '0s';
	delArr = del.split(', ');
	for (var i = 0, l = delArr.length; i < l ;i++) {
		delArr[i] = (delArr[i].indexOf("ms")>-1) ? parseFloat(delArr[i]) : parseFloat(delArr[i])*1000;
	}

	//make array with duration+delays
	for (var i = 0, l = durArr.length; i < l ;i++) {
		transitions[i] = durArr[i] + delArr[i]
	}

	return Math.max.apply(Math, transitions);
}

proto._gatherData = function (el, slide) {//slide - flag that shows we need info only for slide
	var o = this.o,
		$el = $(el),
		dataO = $el.data(),//data original
		dataMeta = {},//data processed

		numeric = ['zindex', 'timeout', 'start', 'idle'],//properties that we should transform from string to number
		initial = ['click', 'container', 'position', 'zindex', 'selector', 'delegate', 'class'],//properties that we can define only first time, on init gather data
		banned = ['elem', 'autobind', 'template', 'text', 'tpl'];//properties that we can't redefine via data attributes at all (title we handle separate)

	//if we have data-njm-options, use it
	if(dataO.njmOptions) {
		dataMeta = $.parseJSON(dataO.njmOptions);

		for (var key in dataMeta) {
			if (dataMeta.hasOwnProperty(key)) {
				dataMeta[key] = checkval(dataMeta[key]);
			}
		}
	} else {//get data from data attributes

		//first we try to get href from original attributes
		if($el[0].tagName.toLowerCase() === 'a') {
			var href = $el.attr('href');
			if(href && href !== '#' && href !== '#!' && !(/^(?:javascript)/i).test(href)) {//test href for real info, not placeholder
				dataMeta.content = href;
			}
		}

		//get title
		if(o.title_attr) {
			dataMeta.title = $el.attr(o.title_attr);
		}//if there will be data-njm-title attribute, title will be from data-njm-title

		for (var p in dataO) {//use only data properties with njm prefix
			if (dataO.hasOwnProperty(p) && /^njm[A-Z]+/.test(p) ) {
				var shortName = p.match(/^njm(.*)/)[1],
					shortNameLowerCase = shortName.charAt(0).toLowerCase() + shortName.slice(1);

				dataMeta[shortNameLowerCase] = checkval(dataO[p]);
			}
		}


	}


	function checkval(val) {//transform string to boolean
		if(val === 'true') {
			return true;
		} else if(val === 'false') {
			return false;
		} else {
			return val;
		}
	}




	//transform string to number
	for (var i = 0, l = numeric.length; i < l ;i++) {
		if(dataMeta[numeric[i]]) dataMeta[numeric[i]] = parseInt(dataMeta[numeric[i]]);
	}

	//delete options, that we can't redefine via data properties
	for (var i = 0, l = banned.length; i < l ;i++) {
		delete dataMeta[banned[i]];
	}


	//delete options, that we can only use on initial gather data
	if(this._o.inited) {
		for (var i = 0, l = initial.length; i < l ;i++) {
			delete dataMeta[initial[i]];
		}
	}

	if(slide) {
		var gatheredOptions = {};
		if(dataMeta.content) gatheredOptions.content = dataMeta.content;
		if(dataMeta.type) gatheredOptions.type = dataMeta.type;
		if(dataMeta.header) gatheredOptions.header = dataMeta.header;
		if(dataMeta.footer) gatheredOptions.footer = dataMeta.footer;
		if(dataMeta.title) gatheredOptions.title = dataMeta.title;

		return gatheredOptions;
	} else {
		return dataMeta;
	}
}
proto._clear = function () {
		var o = this.o,
				that = this;

		if(this.v.container && this.v.container.length && njModal.opened.length === 1) this.v.container.removeClass('njm_open');//remove only from last closing instance

		that._scrollbar('show');


		// we should return selector elements in dom before we detach modal from dom, because if not, all eventhandlers inside selector els will be detached
		//return original display for every element that was used in slides with type selector
		if(this._o.slides_selector_dn) {
				for (var i = 0, l = this._o.slides_selector_dn.length; i < l ;i++) {
						this.slides[that._o.slides_selector_dn[i]].v.contentEl.css('display', 'none');
				}
		}
		//return elements that were used for slides with type selector to dom
		if(this._o.slides_selector) {
				for (var i = 0, l = this._o.slides_selector.length; i < l ;i++) {
						this.v.body.append(this.slides[that._o.slides_selector[i]].v.contentEl);
				}
		}

		if(this.v.wrap && this.v.wrap.length) this.v.wrap.remove();

		//clear inline position
		for (var i = 0, l = that.slides.length; i < l ;i++) {
				that.slides[i].v.modalOuter[0].style.cssText = '';
		}

		njModal.opened.splice(_findOpenIndex(this), 1);

		function _findOpenIndex(instance) {
				var index = false;

				for (var i = 0, l = njModal.opened.length; i < l ;i++) {
						if(instance === njModal.opened[i]) {
								index = i;
								break;
						}
				}

				return index;
		}

		if(o.delegate) {//we should remove this info, because of delegate mode, it will be created again on next show
				if(that.els && that.els.length) that.els.each(function (i,el) {
						delete el.njModal;
				})
				delete that.els;
				that.slides = [];//list of all slides
		}

		this.active = 0;

		if(this.v.slides && this.v.slides.length) this.v.slides.empty();//we can't use innerHTML="" here, for IE(even 11) we need remove method

		this._o = {
				'inited': true,
				'state':'inited'
		}
}







proto._cb = function (type) {//cb - callback
	var o = this.o,
		that = this;

	if(type === 'inited' ||
		 type === 'show'   ||
		 type === 'shown'  ||
		 type === 'hide'   ||
		 type === 'hidden') {

		this._o.state = type;
	}

	//trigger all events
	var args = Array.prototype.slice.call(arguments, 1),
		clearArgs = Array.prototype.slice.call(arguments, 1),
		cbArgs = Array.prototype.slice.call(arguments, 1)
	args.unshift(this);
	cbArgs.unshift(type);


	if((type === 'ok' || type === 'cancel') && o.type === 'prompt') clearArgs.push(this.slides[this.active].v.modal.find('.njm-prompt-input')[0].value);


	if(typeof o['cb'] === 'function') {
		o['cb'].apply(this, cbArgs);
	}
	this.trigger.apply(this, ['cb'].concat(cbArgs));


	this.trigger.apply(this, arguments);

	this.v.document.triggerHandler('njm_'+type, args);
	if(o.$elem && o.$elem.length) o.$elem.triggerHandler('njm_'+type, args);


	if(typeof o['on'+type] === 'function') {
		var callbackResult = o['on'+type].apply(this, clearArgs);
	}

	switch(type) {
	case 'ui_update':
		// var sb = false;

		// console.log(this.slides[this.active].v.modalOuter[0].scrollHeight)
		// console.log(this.slides[this.active].v.modalOuter[0].scrollHeight > this.slides[this.active].v.modalOuter[0].clientHeight)


		// this._o.uiEls = $('.njm-ui-el, .njm-ui-title-outer, .njm-close-system');

		// if(sb) {

		// }
		// this._o.uiEls.each(function () {
		//  // console.log(this)
		// })

		// // record original position of ui elements
		// this._o.uiElsPos = [];

		// this._o.uiEls.each(function (i) {
		//  var $el = $(this);
		//  that._o.uiElsPos[i] = {
		//    top: parseInt($el.css('top')),
		//    bottom: parseInt($el.css('bottom')),
		//    left: parseInt($el.css('left')),
		//    right: parseInt($el.css('right'))
		//  }
		// })
	break;
	case 'show':

	break;
	case 'shown':
		// if(document.activeElement) document.activeElement.blur();//check for existances needed for ie... ofc. Oh lol, if focus on body and we call blur, ie9/10 switches windows like alt+tab Oo
		this.v.wrap.focus();
		this.v.close.focus();

		if(o.focus) {
			this.slides[this.active].v.modal.find(o.focus).first().focus();
		}

		this.v.ui.addClass('njm-visible');

		setTimeout(function() {
			if(njModal.a.gallery)that._preload();//start preload only after all animations is probably complete..
		}, 500);

		//temporary remove this feature
		// if(!this.slides[this.active].loaded) this._o.goAnimAgain = true;
		// if(o.img === 'load' && this.slides[this.active] !== 'loaded') this._o.goAnimAgain = true;
	break;
	case 'hide':

	break;
	case 'hidden':
		that._clear();//remove all stuff that was made by plugin

		if(o.iife) {
			that.destroy();
		}
	break;
	case 'destroyed':
		this._events = null;
		this._g = null;
		this._o = null;
		this._handlers = null;
		this.o = null;
		this.active = null;
		this.slides = null;
		this.slidesState = null;
		this.v = null;
		this.els = null;
	break;
	}

	return callbackResult;
}

//event emitter
proto.on = function (event, fct) {
	this._events = this._events || {};
	this._events[event] = this._events[event] || [];
	this._events[event].push(fct);
	return this;
}
proto.off = function (event, fct) {//because of indexOf, this method will not work in ie < 9
	this._events = this._events || {};
	if( event in this._events === false) return;
	// this._events[event].splice(this._events[event].indexOf(fct), 1);
	this._events[event].splice(this.$.inArray(this._events[event], fct), 1);
	return this;
}
proto.trigger = function (event /* , args... */) {
	this._events = this._events || {};
	if( event in this._events === false  ) return;
	for(var i = 0; i < this._events[event].length; i++){
		this._events[event][i].apply(this, Array.prototype.slice.call(arguments, 1));
	}
	return this;
}

proto._error = function (msg, clear) {
	if(!msg) return;

	if(clear) this._clear();

	console.error(msg);
	// throw new Error(msg);
}

proto._default = function () {
	//calculate scrollbar width
	var scrollDiv = document.createElement("div");
	scrollDiv.style.cssText = 'width: 99px; height: 99px; overflow: scroll; position: absolute; top: -99px;';
	document.body.appendChild(scrollDiv);
	njModal.g.scrollbarSize = (scrollDiv.offsetWidth - scrollDiv.clientWidth) || 0;
	document.body.removeChild(scrollDiv);
	//end calculate scrollbar width

	//detect features

	//ie8 and below
	njModal.g.oldIE = !!(document.all && !document.addEventListener);

	//touch interface
	njModal.g.touch = 'ontouchstart' in window;

	//detect css3 support
	var h = njModal.g;

	h.transition = styleSupport('transition');
	h.transitionDuration = styleSupport('transitionDuration');
	h.transform = styleSupport('transform');
	h.animation = styleSupport('animation');

	function styleSupport(prop) {
		var vendorProp, supportedProp,
			prefix, prefixes = ["Webkit", "Moz", "O", "ms"],
			capProp = prop.charAt(0).toUpperCase() + prop.slice(1),// Capitalize first character of the prop to test vendor prefix
			div = document.createElement("div");

			document.body.insertBefore(div, null);

		if (prop in div.style) {
			supportedProp = prop;// Browser supports standard CSS property name
			prefix = null;
		} else {
			for (var i = 0; i < prefixes.length; i++) {// Otherwise test support for vendor-prefixed property names
				vendorProp = prefixes[i] + capProp;

				if (vendorProp in div.style) {
					prefix = prefixes[i];
					break;
				} else {
					vendorProp = undefined;
				}

			}
		}

		var support = {
			js:  supportedProp || vendorProp,
			css: writePrefixes(prop, prefix)
		}

		if(prop === 'transform') {//detect transform3d
			if(div.style[support.js] !== undefined) {
				div.style[support.js] =  "translate3d(1px,1px,1px)";
				// var has3d = window.getComputedStyle(div)[support.js];
				var has3d = $(div).css(support.js);
			}
			support['3d'] = (has3d !== undefined && has3d.length > 0 && has3d !== "none");
		}

		document.body.removeChild(div);
		return support;
	}

	function writePrefixes(prop, prefix) {
		//make prop camelCase
		prop = prop.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

		if(prefix === null) {
			return prop;
		}

		switch(prefix) {
		case 'Webkit':
			return '-webkit-' + prop;
		break;
		case 'Moz':
			return '-moz-' + prop;
		break;
		case 'ms':
			return '-ms-' + prop;
		break;
		case 'O':
			return '-o-' + prop;
		break;
		}
	}
	//end of CSS3 support
	if(!h.animation.js) $('html').addClass('no-animation');
}
proto._default();

njModal.defaults = {
	elem:              '',//(selector || dom\jQuery element) dom element for triggering modal (it should be single elements, if plugin will found here few elements, instance of gallery will be created)
	container:         'body',//(selector) appends modal to specific element
	position:          'fixed',//(fixed || absolute), how popup will be positioned. For most cases fixed is good, but when we insert popup inside element, not document, absolute position sets automatically
	click:             true,//(boolean) should we set click handler on element?
	clickels:          '',//(selector || dom\jQuery element) additional elements that can trigger same modal window

	overlay:           true,//(one || boolean) should we show overlay? true - show overlay for every popup, one - overlay will be only one for first popup
	overlayassist:     true,//(boolean) if true, animation durations of modal will automatically sets to overlay
	scrollbar:         'hide',//(show || hide) should we hide scrollbar from page?
	els2margin:        '',//(selector || dom\jQuery element) for those elements we will add margin-right when modal shows, if active slide has horizontal scrollbar (can be useful for fixed headers)
	out:               true,//(boolean) click outside modal will close it
	esc:               true,//(boolean) close modal when esc button pressed?
	close:             'outside',//(inside || outside || boolean false) add close button inside or outside popup or don't add at all
	modal:             false,//(boolean)just shortcut for out: false, close: false and also adds fancy animation when somebody tries to close modal with bg click
	autoheight:        'image',//(boolean || image) should we set maximum height of modal? if image is selected, only images will be autoheighted


	focus:             'input, select, textarea, button',//(boolean false, selector) set focus to element, after modal is shown, if false, no autofocus elements inside, otherwise focus selected element

	//gallery
	// selector:          '',//(selector) child items selector, for gallery elements. Can be used o.selector OR o.delegate
	// delegate:          '',//(selector) child items selector, for gallery elements. Can be used o.selector OR o.delegate. If delegate used instead of selector, gallery items will be gathered dynamically before show

	// arrows:            'outside',//(inside || outside || boolean false) add navigation arrows inside or outside popup or don't add at all

	// title:             false,//(string || boolean false) title for first slide if we call it via js
	// title_attr:        'title',//(string || boolean false) attribute from which we gather title for slide (used in galleries)

	// start:             false,//(number) slide number, from which we should start
	// loop:              true,//(boolean), show first image when call next on last slide and vice versa. Requires three or more images. If there are less than 4 slides, option will be set to false automatically.
	// imgclick:          true,//(boolean) should we change slide if user clicks on image?
	// preload:           '3 3',//(boolean false || string) space separated string with 2 numbers, how much images we should preload before  and after active slide

	templates: {
		wrap:        '<div class="njm-wrap" tabindex="-1"><div class="njm-slides"></div></div>',
		overlay:     '<div class="njm-overlay"></div>',

		modal:       '<div class="njm-outer"><aside class="njm"><div class="njm-body"></div></aside></div>',
		header:      '<header class="njm-header" data-njm-header></header>',
		footer:      '<footer class="njm-footer" data-njm-footer></footer>',
		close:       '<button type="button" class="njm-close-system" data-njm-close>×</button>',
		preloader:   '<div class="njm-preloader"><div class="njm-preloader-inner"><div class="bar1"></div><div class="bar2"></div><div class="bar3"></div></div></div>',

		ui:          '<div class="njm-ui"><div class="njm-ui-title-outer"><div class="njm-ui-title-inner" data-njm-title></div></div></div>',
		count:       '<div class="njm-ui-count"><span data-njm-current></span> / <span data-njm-total></span></div>',
		prev:        '<button type="button" class="njm-arrow njm-prev" data-njm-prev></button>',
		next:        '<button type="button" class="njm-arrow njm-next" data-njm-next></button>'
	},

	content:           undefined,//(string) content for modal
	_missedContent:    'njModal plugin: meow, put some content here...',//this string uses, when slide have no content
	type:              '',//(html || selector || text || image) type of content, if selector used, whole element will be inserted in modal
	header:            undefined,//(html) html that will be added as modal header (for first slide)
	footer:            undefined,//(html) html that will be added as modal footer (for first slide)

	// we need quotes here because of ie8..
	'class':             false,//(string) classnames(separated with space) that will be added to modal wrapper, you can use it for styling
	zindex:            false,//(boolean false || number) zindex that will be set on modal, probably not a good idea to use this option, set it in css and use o.class instead

	anim:              'scale',//(false || string) name of animation, or string with space separated 2 names of show/hide animation
	animclass:         'animated',//(string) additional class that will be added to modal window during animation (can be used for animate.css or other css animation libraries)
	duration:          'auto',//(string || number || auto) duration of animations, or string with space separated 2 durations of show/hide animation. You can set 'auto 100' if you want to set only duration for hide. It should be used when problems with auto detection (but I have not seen this problem ^^)

	img:               'load',//(load || ready) we should wait until img will fully loaded or show as soon as size will be known (ready is useful for progressive images)
	text:              {
							preloader:    'Loading...',//title on preloader element

							imageError:   '<a href="%url%">This image</a> can not be loaded.',
							ajaxError:    'Smth goes wrong, ajax failed or ajax timeout (:',

							current:      'Current slide',
							total:        'Total slides',
							close:        'Close (Esc)',//title on close button
							prev:         'Previous (Left arrow key)',//prev slide button title
							next:         'Next (Right arrow key)'//next slide button title

						},
	autobind:          '[data-toggle~="modal"]'//(selector) selector that will be used for autobind (can be used only with changing global default properties) Set it after njModal.js is inserted njModal.defaults.autobind = '.myAutoBindSelector'
}
//autobind
$(function(){
	njModal.autobind();
})
})(window, document);
//jquery plugin
