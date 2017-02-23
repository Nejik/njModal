/*!
 * njModal modal addon
 * nejikrofl@gmail.com
 * Copyright (c) 2015 N.J.
*/

if(window.njModal) njModal.addAddon('modal', {
	options: {
		tpl: {
				'alert'  : '<div class="njm-body">%content%</div><div class="njm-footer"><button data-njm-ok>%ok%</button></div>',
				'confirm': '<div class="njm-body">%content%</div><div class="njm-footer"><button data-njm-ok>%ok%</button><button data-njm-cancel>%cancel%</button></div>',
				'prompt' : '<div class="njm-body">%content%<br/><input class="njm-prompt-input" data-njm-prompt-input type="text" placeholder="%placeholder%" /></div><div class="njm-footer"><button data-njm-ok>%ok%</button><button data-njm-cancel>%cancel%</button></div>'
			},
		text: {
			ok: 'Ok',//text on 'ok' button when dialog modal(alert, prompt, confirm) or in any other custom type
			cancel: 'Cancel',//text on 'cancel' button when dialog modal(alert, prompt, confirm) or in any other custom type
			placeholder: ''//placeholder for prompt input
		},
		placeholder: ''//placeholder for input in prompt
	},
	proto: {
		_modal_init: function () {
			var o = this.o;

			if(o.type === 'alert' || o.type === 'confirm' || o.type === 'prompt') {
				o.modal = true;
			}

			this.on('keydown', function (e) {
				this._modal_keyboard(e);
			})

		},
		_insertContentModal: function (index, content, type) {
			var $ = this.$,
				o = this.o,
				that = this,

				slide = this.slides[index],
				tpl;

			function insertTpl() {
				tpl = tpl.replace('%ok%', o.text.ok).replace('%cancel%', o.text.cancel);
				if(type === 'prompt') tpl = tpl.replace('%placeholder%', o.placeholder || '');

				//set defaults
				for (var i = 0, l = variables_raw.length; i < l ;i++) {
					if(variables_defaults[i]) tpl = tpl.replace(variables_raw[i], variables_defaults[i]);
				}
				slide.v.body.html(tpl);

				that._insertArrows(index);//here we insert arrows, if they are set inside

				slide.status = 'loaded';

				that._cb('content_inserted', index);
			}

			if(o.tpl[type]) {//if custom type (tpl) exist
				tpl = o.tpl[type];

				var variables_raw = tpl.match(/%.+?%/g) || [],
					variables_defaults = [],
					variable;


				//find and remember all defaults from template
				for (var i = 0, l = variables_raw.length; i < l ;i++) {
					variable = variables_raw[i].match(/\s*=\s*.+%/);

					(variable) ? variables_defaults.push(variable[0].replace(/^\s*=\s*(?=.)/, '').slice(0,-1)) : variables_defaults.push('');
				}
				
				if(!content) {//if no content
					insertTpl();//set template as is, without content
				} else {//if content exist
					//if content just a string, replace any first variable in template with it
					if(typeof content === 'string' || typeof content === 'number') {
						if(variables_raw[0]) tpl = tpl.replace(variables_raw[0], content)

						insertTpl();

					//if content is object
					} else if($.isPlainObject(content)) {

						//replace all variables in template with content object
						for (var key in content) {
							if (content.hasOwnProperty(key)) {
								tpl = tpl.replace(RegExp('%'+key+'.*?%'), content[key])
							}
						}

						insertTpl();
					}
				}
				
				slide.v.modalOuter.addClass('njm-content njm-'+type);
				return;
			} else {
				this._error('njModal, seems that you need to add your custom tpl in o.tpl.', true);
			}
		},
		_modal_keyboard: function (e) {
			var $ = this.$,
				o = this.o,
				$el = $(document.activeElement);


			switch(e.which) {
			case 13://enter
				// if(o.enter) {
					// if(($el.attr('data-njm-ok') !== undefined || $el.attr('data-njm-cancel') !== undefined)) {
					// 	$el[0].blur();//fix for chrome. Case: we set in ok callback alert, and then when closing alert we using enter button, because we use event delegation and chrome don't loose focus from our button, our click event calls twice
					// 	$el[0].click();
					// } else 
					if($el.attr('data-njm-prompt-input') !== undefined) {
						$el[0].blur();
						$el.closest('.njm').find('[data-njm-ok]')[0].click();
					}
					e.preventDefault();
				// }
			break;
			}
			//left/right behavior only for predefined modal types
			if(o.type === 'alert' || o.type === 'confirm' || o.type === 'prompt') {
				switch(e.which) {
				case 37://left
					if($el.attr('data-njm-cancel') !== undefined) {
						$el.closest('.njm').find('[data-njm-ok]').focus();
					}
					e.preventDefault();
				break;
				case 39://right
					if($el.attr('data-njm-ok') !== undefined) {
						$el.closest('.njm').find('[data-njm-cancel]').focus();
					}
					e.preventDefault();
				break;
				}
			}
		}
	}
})

window.al = window.njAlert = function (content, ok, cancel) {
	return njModal({
		content: content,
		type: 'alert',
		onok: ok,
		oncancel: cancel
	})
}

window.cf = window.njConfirm = function (content, ok, cancel) {
	return njModal({
		content: content,
		type: 'confirm',
		onok: ok,
		oncancel: cancel
	})
}

window.pr = window.njPrompt = function (content, placeholder, ok, cancel) {//placeholder not required
	if(typeof placeholder === 'function') {
		cancel = ok;
		ok = placeholder;
		placeholder = '';
	}

	return njModal({
		content: content,
		placeholder: placeholder,
		type: 'prompt',
		onok: ok,
		oncancel: cancel
	})
}


