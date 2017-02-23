/*!
 * njModal gallery addon
 * nejikrofl@gmail.com
 * Copyright (c) 2016 N.J.
*/

// requestAnimationFrame polyfill by Erik Möller. fixes from Paul Irish and Tino Zijdel
// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
// http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating
// MIT license
(function() {
	var lastTime = 0;
	var vendors = ['ms', 'moz', 'webkit', 'o'];
	for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
		window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
		window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame']
									 || window[vendors[x]+'CancelRequestAnimationFrame'];
	}

	if (!window.requestAnimationFrame)
		window.requestAnimationFrame = function(callback, element) {
			var currTime = new Date().getTime();
			var timeToCall = Math.max(0, 16 - Math.abs(currTime - lastTime));
			var id = window.setTimeout(function() { callback(currTime + timeToCall); },
				timeToCall);
			lastTime = currTime + timeToCall;
			return id;
		};

	if (!window.cancelAnimationFrame)
		window.cancelAnimationFrame = function(id) {
			clearTimeout(id);
		};
}());


if(window.njModal) njModal.addAddon('gallery', {
	options: {
		selector:          '',//(selector) child items selector, for gallery elements. Can be used o.selector OR o.delegate
		delegate:          '',//(selector) child items selector, for gallery elements. Can be used o.selector OR o.delegate. If delegate used instead of selector, gallery items will be gathered dynamically before show
		arrows:            'outside',//(inside || outside || boolean false) add navigation arrows inside or outside popup or don't add at all

		// title:             false,//(string || boolean false) title for first slide if we call it via js
		title_attr:        'title',//(string || boolean false) attribute from which we gather title for slide (used in galleries)

		start:             false,//(number) slide number, from which we should start
		loop:              true,//(boolean), show first image when call next on last slide and vice versa. Requires three or more images. If there are less than 4 slides, option will be set to false automatically.
		imgclick:          true,//(boolean) should we change slide if user clicks on image?
		preload:           '3 3'//(boolean false || string) space separated string with 2 numbers, how much images we should preload before  and after active slide

	},
	proto: {
		_gallery_init: function () {
			var o = this.o,
          that = this,
					h = this._handlers;
			this.on('setEventHandlers', function(e) {
				h.wrap_prev = function (e) {
					//todo idle
					// that._idle();//clear hide ui timer
					that.prev();
					e.preventDefault();
				}
				h.wrap_next = function (e) {
					// that._idle();//clear hide ui timer
					that.next();
					e.preventDefault();
				}
				h.wrap_imageClick = function (e) {
					that.next();
				}
				
				this.v.wrap	.delegate('[data-njm-prev]', 'click', h.wrap_prev)
										.delegate('[data-njm-next]', 'click', h.wrap_next)
										.delegate('.njm-image-click .njm-body img', 'click', h.wrap_imageClick)
			})

			this.on('keydown', function (e) {
				var $ = this.$,
						o = this.o,
						$el = $(document.activeElement);
		
				switch(e.which) {
				// case 13://enter
				// 
				// 	e.preventDefault();
				// break;
	      case 37://left
					that.prev();
					e.preventDefault();
	      break;
	      case 39://right
					that.next();
					e.preventDefault();
	      break;
				}
			})
			
			this.on('hide', function() {
				this.v.wrap	.undelegate('[data-njm-prev]', 'click', h.wrap_prev)
										.undelegate('[data-njm-next]', 'click', h.wrap_next)
										.undelegate('.njm-image-click .njm-body img', 'click', h.wrap_imageClick)
										
				delete h.wrap_prev
				delete h.wrap_next
				delete h.wrap_imageClick
			})
		},
		_gallery_showSetIndex: function (index) {
			var o = this.o,
				that = this;

			if(typeof index !== 'undefined') {
				index = parseInt(index);//make number from (probably) string

				if(this._o.state === 'show' || this._o.state === 'shown') {
					this.goTo(index);//change slide only if it is not active index
					return this;
				} else if(index - 1 > 0 && index - 1 < this.slides.length) {
					this._o.start = index - 1;
				}
			}
		},
		_gallery_showInit: function (e) {
			var o = this.o,
				that = this;

				if(o.delegate) {
					//create slides dynamically
					that._setEls(o.$elem.find(o.delegate));

					that._makeSlides();

					//return loop option(it may be disabled if we had less than 3 slides)
					if(that._g.originalLoop) {
						if(that.slides.length >= 3) {
							this.v.prev.removeClass('njm-arrow-disabled');
							this.v.next.removeClass('njm-arrow-disabled');
							o.loop = true;
						} else {
							o.loop = false;
						}
					}
				}

				// find clicked element index and start slides from this index
				if(that.els && that.els.length) that.els.each(function (i, el) {
					if(that._o.clickedEl === el) {
						that._o.start = i;
						return;
					}
				})

				if(typeof that._o.start === 'number') this.active = that._o.start;//start from internal option (in internal option, start can be setted from click handler, or from index argument of show method)

				o.start -= 1;//make index and number from o.start option

				if(o.start || o.start === 0) {//start from public option
					if(typeof o.start === 'number' && this.slides[o.start]) {//check if index is a number and slide with such index exist
						this.active = o.start;
					}
				}
		},
		_setClickHandlers: function () {//initial click handlers, replace original method
    	var $ = this.$,
				o = this.o,
    		that = this;

    	if(!o.click || o.iife) return;

    	if(o.delegate) {
    		if(o.$elem.length) {
    			this._handlers.delegate = this._clickHandler();

    			o.$elem.off('click', this._handlers.delegate).delegate(o.delegate, 'click', this._handlers.delegate)
    		} else {
    			this._error('njModal, smth wrong with o.elem (delegate mode is active, but we have no o.elem)', true);
    			return;
    		}
    	} else {
    		if(this.els) {
    			this._handlers.elsClick = this._clickHandler();

    			if(o.selector && o.$elem && o.$elem.length === 1) {
    				o.$elem.off('click', this._handlers.elsClick).delegate(o.selector, 'click', this._handlers.elsClick)
    			} else {
    				this.els.off('click', this._handlers.elsClick).on('click', this._handlers.elsClick)

    				if(o.clickels) {
    					$(o.clickels).off('click', this._handlers.elsClick).on('click', this._handlers.elsClick)
    				}
    			}
    		}
    	}
    },
		_insertArrows: function (index) {
			var o = this.o,
				that = this;

			if(this.slides.length < 2) return;

			if(o.arrows === 'outside' && !this._o.arrowsInserted) {
				this.v.ui.append(this.v.prev);
				this.v.ui.append(this.v.next);

				this._o.arrowsInserted = true;
			} else if(o.arrows === 'inside' && typeof index === 'number') {
				this.slides[index].v.modal.append(this.slides[index].v.prev);
				this.slides[index].v.modal.append(this.slides[index].v.next);
			}
		},
		_drawSiblings: function () {
				var o = this.o;

				//draw prev slide
				if(typeof this.slidesState[0] === 'number') {
					//insert content into prev slide
					this._insertContent(this.slidesState[0]);
					//position prev slide
					this.slides[this.slidesState[0]].v.modalOuter[0].style.cssText = this._moveSlide(-110,'%');
					//insert prev slide on page
					this.v.slides.prepend(this.slides[this.slidesState[0]].v.modalOuter);
				}

				//draw next slide
				if(typeof this.slidesState[2] === 'number') {
					//insert content intonext  slide
					this._insertContent(this.slidesState[2]);
					//position prev slide
					this.slides[this.slidesState[2]].v.modalOuter[0].style.cssText = this._moveSlide(110,'%');
					//insert next slide on page
					this.v.slides.append(this.slides[this.slidesState[2]].v.modalOuter);
				}
				this.position();//in position we also set autoheight

				this._preload();

		},
		_preload: function () {
			var o = this.o,
				that = this;

			if(!o.preload || this._o.state !== 'shown') return;//we should start preloading only after show animation is finished

			var temp  = o.preload.split(' '),
				prev = temp[0],
				next = temp[1],
				i,
				index,
				maxIndex = this.slides.length - 1;

			//preload before
			for(i = 1; i <= prev; i++) {
				index = this.active - i;
				if(index < 0) break;
				preload.call(this, index);
			}
			//preload after
			for(i = 1; i <= prev; i++) {
				index = this.active + i;
				if(index > maxIndex) break;
				preload.call(this, index);
			}

			function preload(index) {
				var slide = this.slides[index],
					content = slide.content;

				if(slide.status !== 'loading' && slide.status !== 'loaded' && slide.type === 'image') document.createElement('img').src = content;
			}
		},
		_slide: function (index, dir) {

				if(this.slides.length === 1 || index === this.active || !this._g.canChange) return;

				var o = this.o,
					that = this;

				if(!this.slides[index]) {
					if(o.loop) {
						if(dir === 'next' && index === this.slides.length) {
							index = 0;
						} else if(dir === 'prev' && index === -1) {
							index = this.slides.length - 1;
						} else {
							return;
						}
					} else {
						return;
					}
				}


				// that._idle(true);

				this._o.direction = dir;


				this._g.canChange = false;//we can't change slide during changing
				this.slidesState_before = this.slidesState.slice();//copy current state
				this._cb('change', index);

				this.active = index;
				this._setSlideState(index);

				this._ui_update();

				switch(dir) {
				case 'prev':
					this.slides[this.slidesState_before[0]].v.body[0].style.verticalAlign = 'middle';//hack for FireFox at least 42.0. When we changing max-height on image it not trigger changing width on parent inline-block element, this hack triggers it

					this.slides[this.slidesState_before[1]].v.modalOuter[0].style.cssText = this._moveSlide(110,'%');
					this.slides[this.slidesState_before[0]].v.modalOuter[0].style.cssText = this._moveSlide(0,'%');
				break;
				case 'next':
					this.slides[this.slidesState_before[2]].v.body[0].style.verticalAlign = 'middle';//hack for FireFox at least 42.0. When we changing max-height on image it not trigger changing width on parent inline-block element, this hack triggers it

					this.slides[this.slidesState_before[1]].v.modalOuter[0].style.cssText = this._moveSlide(-110,'%');
					this.slides[this.slidesState_before[2]].v.modalOuter[0].style.cssText = this._moveSlide(0,'%');
				break;
				}

				setTimeout(function() {
					if(that._o.state !== 'shown') {
						that._g.canChange = true;
						return;//case when we hide modal when slide is changing
					}
					//remove slide that was active before changing
					removeSlide(that.slidesState_before[1]);

					//remove third slide
					var ss2d = (dir === 'prev') ? that.slidesState_before[2] : that.slidesState_before[0];
					if(that.slides[ss2d]) removeSlide(ss2d);//we should check if such slide exist, because it can be null, when o.curcular is false

					delete that.slidesState_before;

					that._drawSiblings();
					that._g.canChange = true;
					that._cb('changed', that.active);
					// that.v.wrap.focus();//ie fix, after change ie somewhy change focus...

				}, this._getAnimTime(this.slides[this.slidesState[1]].v.modalOuter));

				function removeSlide(index) {
					that.slides[index].v.modalOuter.remove();
					that.slides[index].v.modalOuter[0].style.cssText = '';
				}

		},
		_moveSlide: function (value, unit) {
			unit = unit || 'px';

			//detect swipe property
			if(njModal.g.transform['3d']) {
				return njModal.g.transform.css+': translate3d('+(value+unit)+',0,0)';
			} else if(njModal.g.transform['css']) {
				return njModal.g.transform.css+': translateX('+(value+unit)+')';
			} else {
				return 'left:'+(value+unit);
			}
		},
		next: function () {
			this._slide(this.active + 1, 'next');

			return this;
		},
		prev: function () {
			this._slide(this.active - 1, 'prev');

			return this;
		},
		goTo: function (index) {
			index = index - 1;
			if( (this._o.state !== 'show' && this._o.state !== 'shown' )
				|| typeof index !== 'number'
				|| index === this.active
				|| index < 0
				|| index > this.slides.length - 1
				 ) {
				return this;
			}

			var dir = (index > this.active) ? 'next' : 'prev';


			//the most desired cases when we should call prev/next slides :)
			if(dir === 'next' && index === this.active + 1) {
				this.next();
			} else if(dir === 'prev' && index === this.active - 1) {
				this.prev();
			}

			//if it is not simple prev/next, so we need to recreate slides
			else {
				//remove siblings
				this.slides[this.slidesState[0]].v.modalOuter.remove();
				this.slides[this.slidesState[2]].v.modalOuter.remove();
				//clear position of siblings
				this.slides[this.slidesState[0]].v.modalOuter[0].style.cssText = '';
				this.slides[this.slidesState[2]].v.modalOuter[0].style.cssText = '';

				switch(dir) {
				case 'next':
					// set new slide
					this.slidesState[0] = null;
					this.slidesState[2] = index;

					this._insertContent(index);
					this.v.slides.append(this.slides[index].v.modalOuter);
					this.slides[this.slidesState[2]].v.modalOuter[0].style.cssText = this._moveSlide(110,'%');

					this._slide(index, 'next');
				break;
				case 'prev':
					// set new slide
					this.slidesState[0] = index;
					this.slidesState[2] = null;

					this._insertContent(index);
					this.v.slides.append(this.slides[index].v.modalOuter);
					this.slides[this.slidesState[0]].v.modalOuter[0].style.cssText = this._moveSlide(-110,'%');

					this._slide(index, 'prev');
				break;
				}
			}

			return this;
		},
		addSlide: function (el, type) {//el - dom element or object with slide options, multiple - flag that show in element we have array with objects
				if(this._o.state === 'show' || this._o.state === 'shown') {
					this._error('njModal, you can add slides only when modal is hidden.');
					return;
				}
				if(!el) return this;
				var $ = this.$,
					o = this.o,
					that = this,
					el = $(el);



				if(el.length) {//array or array-like object
					if(type === 'dom' || el[0].tagName) {//array with dom elements
						//create slide objects from elements
						this._makeSlidesFromEls(el, true);

					} else if(type === 'objects' || $.isPlainObject(el[0])) {//array with slide objects
						for (var i = 0, l = el.length; i < l ;i++) {
							addSlide.call(this, el[i]);
						}
					}

					this._setClickHandlers();

				} else if(type === 'dom' || el.tagName) {
					if(el.njModal) return this;//don't add element, that already initialized as modal window
					//create slide object from element
					this._makeSlidesFromEls([el], true);

					//update click handlers
					this._setClickHandlers();
				} else if(type === 'object' || $.isPlainObject(el)) {
					addSlide.call(this, el)
				} else {
					return this;
				}

				function addSlide(obj) {
					that._createDomForSlide(this.slides.push({
						el: obj.el || undefined,
						content: obj.content,
						type: obj.type || this._type(obj.content),
						header: obj.header,
						footer: obj.footer,
						title: obj.title,
						status: false
					}) - 1);
				}

				//other stuff
				//return loop option(it may be disabled if we had less than 3 slides)
				if(this.slides.length >= 3 && this._g.originalLoop) {
					this.v.prev.removeClass('njm-arrow-disabled');
					this.v.next.removeClass('njm-arrow-disabled');
					o.loop = true;
				}

				return this;
		}
	}
})
