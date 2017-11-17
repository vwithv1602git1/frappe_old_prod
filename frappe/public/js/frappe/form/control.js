// Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
// MIT License. See license.txt

frappe.ui.form.make_control = function (opts) {
	var control_class_name = "Control" + opts.df.fieldtype.replace(/ /g, "");
	if(frappe.ui.form[control_class_name]) {
		return new frappe.ui.form[control_class_name](opts);
	} else {
		console.log("Invalid Control Name: " + opts.df.fieldtype);
	}
}

frappe.ui.form.Control = Class.extend({
	init: function(opts) {
		$.extend(this, opts);
		this.make();

		// if developer_mode=1, show fieldname as tooltip
		if(frappe.boot.user && frappe.boot.user.name==="Administrator" &&
			frappe.boot.developer_mode===1 && this.$wrapper) {
				this.$wrapper.attr("title", __(this.df.fieldname));
		}

		if(this.render_input) {
			this.refresh();
		}
	},
	make: function() {
		this.make_wrapper();
		this.$wrapper
			.attr("data-fieldtype", this.df.fieldtype)
			.attr("data-fieldname", this.df.fieldname);
		this.wrapper = this.$wrapper.get(0);
		this.wrapper.fieldobj = this; // reference for event handlers
	},

	make_wrapper: function() {
		this.$wrapper = $("<div class='frappe-control'></div>").appendTo(this.parent);

		// alias
		this.wrapper = this.$wrapper;
	},

	toggle: function(show) {
		this.df.hidden = show ? 0 : 1;
		this.refresh();
	},

	// returns "Read", "Write" or "None"
	// as strings based on permissions
	get_status: function(explain) {
		if(!this.doctype && !this.docname) {
			// like in case of a dialog box
			if (cint(this.df.hidden)) {
				if(explain) console.log("By Hidden: None");
				return "None";

			} else if (cint(this.df.hidden_due_to_dependency)) {
				if(explain) console.log("By Hidden Dependency: None");
				return "None";

			} else if (cint(this.df.read_only)) {
				if(explain) console.log("By Read Only: Read");
				return "Read";

			}

			return "Write";
		}

		var status = frappe.perm.get_field_display_status(this.df,
			frappe.model.get_doc(this.doctype, this.docname), this.perm || (this.frm && this.frm.perm), explain);

		// hide if no value
		if (this.doctype && status==="Read" && !this.only_input
			&& is_null(frappe.model.get_value(this.doctype, this.docname, this.df.fieldname))
			&& !in_list(["HTML", "Image"], this.df.fieldtype)) {
				if(explain) console.log("By Hide Read-only, null fields: None");
				status = "None";
		}

		return status;
	},
	refresh: function() {
		this.disp_status = this.get_status();
		this.$wrapper
			&& this.$wrapper.toggleClass("hide-control", this.disp_status=="None")
			&& this.$wrapper.trigger("refresh");
	},
	get_doc: function() {
		return this.doctype && this.docname
			&& locals[this.doctype] && locals[this.doctype][this.docname] || {};
	},
	get_model_value: function() {
		if(this.doc) {
			return this.doc[this.df.fieldname];
		}
	},
	set_value: function(value) {
		this.parse_validate_and_set_in_model(value);
	},
	parse_validate_and_set_in_model: function(value) {
		var me = this;
		if(this.inside_change_event) return;
		this.inside_change_event = true;
		if(this.parse) value = this.parse(value);

		var set = function(value) {
			me.set_model_value(value);
			me.inside_change_event = false;
			me.set_mandatory && me.set_mandatory(value);
		}

		this.validate ? this.validate(value, set) : set(value);
	},
	get_parsed_value: function() {
		var me = this;
		if(this.get_status()==='Write') {
			return this.get_value ?
				(this.parse ? this.parse(this.get_value()) : this.get_value()) :
				undefined;
		} else if(this.get_status()==='Read') {
			return this.value || undefined;
		} else {
			return undefined;
		}
	},
	set_model_value: function(value) {
		if(this.doctype && this.docname) {
			if(frappe.model.set_value(this.doctype, this.docname, this.df.fieldname,
				value, this.df.fieldtype)) {
				this.last_value = value;
			}
		} else {
			if(this.doc) {
				this.doc[this.df.fieldname] = value;
			}
			this.set_input(value);
		}
	},
	set_focus: function() {
		if(this.$input) {
			this.$input.get(0).focus();
			return true;
		}
	}
});

frappe.ui.form.ControlHTML = frappe.ui.form.Control.extend({
	make: function() {
		this._super();
		var me = this;
		this.disp_area = this.wrapper;
		this.$wrapper.on("refresh", function() {
			var content = me.get_content();
			if(content) me.$wrapper.html(content);
			return false;
		});
	},
	get_content: function() {
		return this.df.options || "";
	},
	html: function(html) {
		this.$wrapper.html(html || this.get_content());
	},
	set_value: function(html) {
		if(html.appendTo) {
			// jquery object
			html.appendTo(this.$wrapper.empty());
		} else {
			// html
			this.df.options = html;
			this.html(html);
		}
	}
});

frappe.ui.form.ControlHeading = frappe.ui.form.ControlHTML.extend({
	get_content: function() {
		return "<h4>" + __(this.df.label) + "</h4>";
	}
});

frappe.ui.form.ControlImage = frappe.ui.form.Control.extend({
	make: function() {
		this._super();
		var me = this;
		this.$wrapper.css({"margin": "0px"});
		this.$body = $("<div></div>").appendTo(this.$wrapper)
			.css({"margin-bottom": "10px"})
		this.$wrapper.on("refresh", function() {
				var doc = null;
				me.$body.empty();

				var doc = me.get_doc();
				if(doc && me.df.options && doc[me.df.options]) {
					me.$img = $("<img src='"+doc[me.df.options]+"' class='img-responsive'>")
						.appendTo(me.$body);
				} else {
					me.$buffer = $("<div class='missing-image'><i class='octicon octicon-circle-slash'></i></div>")
						.appendTo(me.$body)
				}
				return false;
			});
		$('<div class="clearfix"></div>').appendTo(this.$wrapper);
	}
});

frappe.ui.form.ControlInput = frappe.ui.form.Control.extend({
	horizontal: true,
	make: function() {
		// parent element
		this._super();
		this.set_input_areas();

		// set description
		this.set_max_width();
		this.setup_update_on_refresh();
	},
	make_wrapper: function() {
		if(this.only_input) {
			this.$wrapper = $('<div class="form-group frappe-control">').appendTo(this.parent);
		} else {
			this.$wrapper = $('<div class="frappe-control">\
				<div class="form-group">\
					<div class="clearfix">\
						<label class="control-label" style="padding-right: 0px;"></label>\
					</div>\
					<div class="control-input-wrapper">\
						<div class="control-input"></div>\
						<div class="control-value like-disabled-input" style="display: none;"></div>\
						<p class="help-box small text-muted hidden-xs"></p>\
					</div>\
				</div>\
			</div>').appendTo(this.parent);
		}
	},
	toggle_label: function(show) {
		this.$wrapper.find(".control-label").toggleClass("hide", !show);
	},
	toggle_description: function(show) {
		this.$wrapper.find(".help-box").toggleClass("hide", !show);
	},
	set_input_areas: function() {
		if(this.only_input) {
			this.input_area = this.wrapper;
		} else {
			this.label_area = this.label_span = this.$wrapper.find("label").get(0);
			this.input_area = this.$wrapper.find(".control-input").get(0);
			// keep a separate display area to rendered formatted values
			// like links, currencies, HTMLs etc.
			this.disp_area = this.$wrapper.find(".control-value").get(0);
		}
	},
	set_max_width: function() {
		if(this.horizontal) {
			this.$wrapper.addClass("input-max-width");
		}
	},

	// update input value, label, description
	// display (show/hide/read-only),
	// mandatory style on refresh
	setup_update_on_refresh: function() {
		var me = this;

		var make_input = function() {
			if(!me.has_input) {
				me.make_input();
				if(me.df.on_make) {
					me.df.on_make(me);
				}
			}
		}

		var update_input = function() {
			if(me.doctype && me.docname) {
				me.set_input(me.value);
			} else {
				me.set_input(me.value || null);
			}
		}

		this.$wrapper.on("refresh", function() {
			if(me.disp_status != "None") {
				// refresh value
				if(me.doctype && me.docname) {
					me.value = frappe.model.get_value(me.doctype, me.docname, me.df.fieldname);
				}

				if(me.disp_status=="Write") {
					me.disp_area && $(me.disp_area).toggle(false);
					$(me.input_area).toggle(true);
					me.$input && me.$input.prop("disabled", false);
					make_input();
					update_input();
				} else {
					if(me.only_input) {
						make_input();
						update_input();
					} else {
						$(me.input_area).toggle(false);
						if (me.disp_area) {
							me.set_disp_area();
							$(me.disp_area).toggle(true);
						}
					}
					me.$input && me.$input.prop("disabled", true);
				}

				me.set_description();
				me.set_label();
				me.set_mandatory(me.value);
				me.set_bold();
			}
			return false;
		});
	},

	set_disp_area: function() {
		let value = this.get_value();
		if(inList(["Currency", "Int", "Float"], this.df.fieldtype) && (this.value === 0 || value === 0)) {
			// to set the 0 value in readonly for currency, int, float field
			value = 0;
		} else {
			value = this.value || value;
		}
		this.disp_area && $(this.disp_area)
			.html(frappe.format(value, this.df, {no_icon:true, inline:true},
					this.doc || (this.frm && this.frm.doc)));
	},

	bind_change_event: function() {
		var me = this;

		this.$input && this.$input.on("change", this.change || function(e) {
			if(me.df.change || me.df.onchange) {
				// onchange event specified in df
				(me.df.change || me.df.onchange).apply(this, [e]);
				return;
			}
			if(me.doctype && me.docname && me.get_value) {
				me.parse_validate_and_set_in_model(me.get_value());
			} else {
				// inline
				var value = me.get_value();
				var parsed = me.parse ? me.parse(value) : value;
				var set_input = function(before, after) {
					if(before !== after) {
						me.set_input(after);
					}
					if(me.doc) {
						me.doc[me.df.fieldname] = value;
					}
					me.set_mandatory && me.set_mandatory(after);
					if(me.after_validate) {
						me.after_validate(after, me.$input);
					}
				}
				if(me.validate) {
					me.validate(parsed, function(validated) {
						set_input(value, validated);
					});
				} else {
					set_input(value, parsed);
				}
			}
		});
	},
	bind_focusout: function() {
		// on touchscreen devices, scroll to top
		// so that static navbar and page head don't overlap the input
		if (frappe.dom.is_touchscreen()) {
			var me = this;
			this.$input && this.$input.on("focusout", function() {
				if (frappe.dom.is_touchscreen()) {
					frappe.utils.scroll_to(me.$wrapper);
				}
			});
		}
	},
	set_label: function(label) {
		if(label) this.df.label = label;

		if(this.only_input || this.df.label==this._label)
			return;

		var icon = "";
		this.label_span.innerHTML = (icon ? '<i class="'+icon+'"></i> ' : "") +
			__(this.df.label)  || "&nbsp;";
		this._label = this.df.label;
	},
	set_description: function() {
		if(this.only_input || this.df.description===this._description)
			return;
		if(this.df.description) {
			this.$wrapper.find(".help-box").html(__(this.df.description));
		} else {
			this.set_empty_description();
		}
		this._description = this.df.description;
	},
	set_empty_description: function() {
		this.$wrapper.find(".help-box").html("");
	},
	set_mandatory: function(value) {
		this.$wrapper.toggleClass("has-error", (this.df.reqd && is_null(value)) ? true : false);
	},
	set_bold: function() {
		if(this.$input) {
			this.$input.toggleClass("bold", !!(this.df.bold || this.df.reqd));
		}
		if(this.disp_area) {
			$(this.disp_area).toggleClass("bold", !!(this.df.bold || this.df.reqd));
		}
	}
});

frappe.ui.form.ControlData = frappe.ui.form.ControlInput.extend({
	html_element: "input",
	input_type: "text",
	make_input: function() {
		if(this.$input) return;

		this.$input = $("<"+ this.html_element +">")
			.attr("type", this.input_type)
			.attr("autocomplete", "off")
			.addClass("input-with-feedback form-control")
			.prependTo(this.input_area)

		if (in_list(['Data', 'Link', 'Dynamic Link', 'Password', 'Select', 'Read Only', 'Attach', 'Attach Image'],
			this.df.fieldtype)) {
				this.$input.attr("maxlength", this.df.length || 140);
		}

		this.set_input_attributes();
		this.input = this.$input.get(0);
		this.has_input = true;
		this.bind_change_event();
		this.bind_focusout();

		// somehow this event does not bubble up to document
		// after v7, if you can debug, remove this
	},
	set_input_attributes: function() {
		this.$input
			.attr("data-fieldtype", this.df.fieldtype)
			.attr("data-fieldname", this.df.fieldname)
			.attr("placeholder", this.df.placeholder || "")
		if(this.doctype) {
			this.$input.attr("data-doctype", this.doctype);
		}
		if(this.df.input_css) {
			this.$input.css(this.df.input_css);
		}
		if(this.df.input_class) {
			this.$input.addClass(this.df.input_class);
		}
	},
	set_input: function(value) {
		this.last_value = this.value;
		this.value = value;
		this.$input && this.$input.val(this.format_for_input(value));
		this.set_disp_area();
		this.set_mandatory && this.set_mandatory(value);
	},
	get_value: function() {
		return this.$input ? this.$input.val() : undefined;
	},
	format_for_input: function(val) {
		return val==null ? "" : val;
	},
	validate: function(v, callback) {
		if(this.df.options == 'Phone') {
			if(v+''=='') {
				callback("");
				return;
			}
			v1 = ''
			// phone may start with + and must only have numbers later, '-' and ' ' are stripped
			v = v.replace(/ /g, '').replace(/-/g, '').replace(/\(/g, '').replace(/\)/g, '');

			// allow initial +,0,00
			if(v && v.substr(0,1)=='+') {
				v1 = '+'; v = v.substr(1);
			}
			if(v && v.substr(0,2)=='00') {
				v1 += '00'; v = v.substr(2);
			}
			if(v && v.substr(0,1)=='0') {
				v1 += '0'; v = v.substr(1);
			}
			v1 += cint(v) + '';
			callback(v1);
		} else if(this.df.options == 'Email') {
			if(v+''=='') {
				callback("");
				return;
			}

			var email_list = frappe.utils.split_emails(v);
			if (!email_list) {
				// invalid email
				callback("");

			} else {
				var invalid_email = false;
				email_list.forEach(function(email) {
					if (!validate_email(email)) {
						msgprint(__("Invalid Email: {0}", [email]));
						invalid_email = true;
					}
				});

				if (invalid_email) {
					// at least 1 invalid email
					callback("");
				} else {
					// all good
					callback(v);
				}
			}

		} else {
			callback(v);
		}
	}
});

frappe.ui.form.ControlReadOnly = frappe.ui.form.ControlData.extend({
	get_status: function(explain) {
		var status = this._super(explain);
		if(status==="Write")
			status = "Read";
		return;
	},
});


frappe.ui.form.ControlPassword = frappe.ui.form.ControlData.extend({
	input_type: "password"
});

frappe.ui.form.ControlInt = frappe.ui.form.ControlData.extend({
	make: function() {
		this._super();
		// $(this.label_area).addClass('pull-right');
		// $(this.disp_area).addClass('text-right');
	},
	make_input: function() {
		var me = this;
		this._super();
		this.$input
			// .addClass("text-right")
			.on("focus", function() {
				setTimeout(function() {
					if(!document.activeElement) return;
					me.validate(document.activeElement.value, function(val) {
						document.activeElement.value = val;
					});
					document.activeElement.select()
				}, 100);
				return false;
			})
	},
	parse: function(value) {
		return cint(value, null);
	},
	validate: function(value, callback) {
		return callback(value);
	}
});

frappe.ui.form.ControlFloat = frappe.ui.form.ControlInt.extend({
	parse: function(value) {
		return isNaN(parseFloat(value)) ? null : flt(value, this.get_precision());
	},

	format_for_input: function(value) {
		var number_format;
		if (this.df.fieldtype==="Float" && this.df.options && this.df.options.trim()) {
			number_format = this.get_number_format();
		}
		var formatted_value = format_number(parseFloat(value), number_format, this.get_precision());
		return isNaN(parseFloat(value)) ? "" : formatted_value;
	},

	// even a float field can be formatted based on currency format instead of float format
	get_number_format: function() {
		var currency = frappe.meta.get_field_currency(this.df, this.get_doc());
		return get_number_format(currency);
	},

	get_precision: function() {
		// round based on field precision or float precision, else don't round
		return this.df.precision || cint(frappe.boot.sysdefaults.float_precision, null);
	}
});

frappe.ui.form.ControlCurrency = frappe.ui.form.ControlFloat.extend({
	format_for_input: function(value) {
		var formatted_value = format_number(parseFloat(value), this.get_number_format(), this.get_precision());
		return isNaN(parseFloat(value)) ? "" : formatted_value;
	},

	get_precision: function() {
		// always round based on field precision or currency's precision
		// this method is also called in this.parse()
		if (!this.df.precision) {
			if(frappe.boot.sysdefaults.currency_precision) {
				this.df.precision = frappe.boot.sysdefaults.currency_precision;
			} else {
				this.df.precision = get_number_format_info(this.get_number_format()).precision;
			}
		}

		return this.df.precision;
	}
});

frappe.ui.form.ControlPercent = frappe.ui.form.ControlFloat;

frappe.ui.form.ControlDate = frappe.ui.form.ControlData.extend({
	make_input: function() {
		this._super();
		this.set_date_options();
		this.set_datepicker();
		this.set_t_for_today();
	},
	set_input: function(value) {
		this._super(value);
		if(value
			&& ((this.last_value && this.last_value !== this.value)
				|| (!this.datepicker.selectedDates.length))) {
			this.datepicker.selectDate(frappe.datetime.str_to_obj(value));
		}
	},
	set_date_options: function() {
		var me = this;
		var lang = frappe.boot.user.language;
		if(!$.fn.datepicker.language[lang]) {
			lang = 'en'
		}
		this.datepicker_options = {
			language: lang,
			autoClose: true,
			todayButton: new Date(),
			dateFormat: (frappe.boot.sysdefaults.date_format || 'yyyy-mm-dd'),
			onSelect: function(dateStr) {
				if(me.setting_date_flag) return;
				me.set_value(me.get_value());
				me.$input.trigger('change');
			},
			onShow: function() {
				$('.datepicker--button:visible').text(__('Today'));
			},
		};
	},
	set_datepicker: function() {
		this.$input.datepicker(this.datepicker_options);
		this.datepicker = this.$input.data('datepicker');
	},
	set_t_for_today: function() {
		var me = this;
		this.$input.on("keydown", function(e) {
			if(e.which===84) { // 84 === t
				me.set_value(frappe.datetime.str_to_user(frappe.datetime.nowdate()));
				return false;
			}
		});
	},
	parse: function(value) {
		if(value) {
			return dateutil.user_to_str(value);
		}
	},
	format_for_input: function(value) {
		if(value) {
			return dateutil.str_to_user(value);
		}
		return "";
	},
	validate: function(value, callback) {
		if(value && !dateutil.validate(value)) {
			msgprint (__("Date must be in format: {0}", [sys_defaults.date_format || "yyyy-mm-dd"]));
			callback("");
			return;
		}
		return callback(value);
	}
});

frappe.ui.form.ControlTime = frappe.ui.form.ControlData.extend({
	make_input: function() {
		var me = this;
		this._super();
		this.$input.datepicker({
			language: "en",
			timepicker: true,
			onlyTimepicker: true,
			timeFormat: "hh:ii:ss",
			onSelect: function(dateObj) {
				me.set_value(dateObj);
			},
			onShow: function() {
				$('.datepicker--button:visible').text(__('Now'));
			},
			todayButton: new Date()
		});
		this.datepicker = this.$input.data('datepicker');
		this.refresh();
	},
	set_input: function(value) {
		this._super(value);
		if(value
			&& ((this.last_value && this.last_value !== this.value)
				|| (!this.datepicker.selectedDates.length))) {

			this.datepicker.selectDate(moment(value, 'hh:mm:ss')._d);
		}
	},
});

frappe.ui.form.ControlDatetime = frappe.ui.form.ControlDate.extend({
	set_date_options: function() {
		this._super();
		this.datepicker_options.timepicker = true;
		this.datepicker_options.timeFormat = "hh:ii:ss";
		this.datepicker_options.onShow = function() {
			$('.datepicker--button:visible').text(__('Now'));
		};
	},
	parse: function(value) {
		if(value) {
			// parse and convert
			value = dateutil.convert_to_system_tz(dateutil.user_to_str(value));
		}
		return value;
	},
	format_for_input: function(value) {
		if(value) {
			// convert and format
			value = dateutil.str_to_user(dateutil.convert_to_user_tz(value));
		}
		return value || "";
	}
});

frappe.ui.form.ControlDateRange = frappe.ui.form.ControlData.extend({
	make_input: function() {
		var me = this;
		this._super();
		this.set_date_options();
		this.set_datepicker();
		this.refresh();
	},
	set_date_options: function() {
		var me = this;
		this.datepicker_options = {
			language: "en",
			range: true,
			autoClose: true,
			toggleSelected: false
		}
		this.datepicker_options.dateFormat =
			(frappe.boot.sysdefaults.date_format || 'yyyy-mm-dd');
		this.datepicker_options.onSelect = function(dateObj) {
			me.set_value(dateObj);
		}
	},
	set_datepicker: function() {
		this.$input.datepicker(this.datepicker_options);
		this.datepicker = this.$input.data('datepicker');
	},
	set_input: function(value, value2) {
		this.last_value = this.value;
		if (value && value2) {
			this.value = [value, value2];
		} else {
			this.value = value
		}
		if (this.value) {
			this.$input && this.$input.val(this.format_for_input(this.value[0], this.value[1]));
		} else {
			this.$input && this.$input.val("")
		}
		this.set_disp_area();
		this.set_mandatory && this.set_mandatory(value);
	},
	parse: function(value) {
		if(value && (value.indexOf(',') !== -1 || value.indexOf('to') !== -1)) {
			vals = value.split(/[( to )(,)]/)
			from_date = moment(dateutil.user_to_obj(vals[0])).format('YYYY-MM-DD');
			to_date = moment(dateutil.user_to_obj(vals[vals.length-1])).format('YYYY-MM-DD');
			return [from_date, to_date];
		}
	},
	format_for_input: function(value,value2) {
		if(value && value2) {
			value = dateutil.str_to_user(value);
			value2 = dateutil.str_to_user(value2);
			return value + " to " + value2
		}
		return "";
	},
	validate: function(value, callback) {
		return callback(value);
	}
});

frappe.ui.form.ControlText = frappe.ui.form.ControlData.extend({
	html_element: "textarea",
	horizontal: false,
	make_wrapper: function() {
		this._super();
		this.$wrapper.find(".like-disabled-input").addClass("for-description");
	},
	make_input: function() {
		this._super();
		this.$input.css({'height': '300px'})
	}
});

frappe.ui.form.ControlLongText = frappe.ui.form.ControlText;
frappe.ui.form.ControlSmallText = frappe.ui.form.ControlText.extend({
	make_input: function() {
		this._super();
		this.$input.css({'height': '150px'})
	}
});

frappe.ui.form.ControlCheck = frappe.ui.form.ControlData.extend({
	input_type: "checkbox",
	make_wrapper: function() {
		this.$wrapper = $('<div class="form-group frappe-control">\
			<div class="checkbox">\
				<label>\
					<span class="input-area"></span>\
					<span class="disp-area" style="display:none; margin-left: -20px;"></span>\
					<span class="label-area small"></span>\
				</label>\
				<p class="help-box small text-muted"></p>\
			</div>\
		</div>').appendTo(this.parent)
	},
	set_input_areas: function() {
		this.label_area = this.label_span = this.$wrapper.find(".label-area").get(0);
		this.input_area = this.$wrapper.find(".input-area").get(0);
		this.disp_area = this.$wrapper.find(".disp-area").get(0);
	},
	make_input: function() {
		this._super();
		this.$input.removeClass("form-control");
	},
	parse: function(value) {
		return this.input.checked ? 1 : 0;
	},
	validate: function(value, callback) {
		return callback(cint(value));
	},
	set_input: function(value) {
		if(this.input) {
			this.input.checked = (value ? 1 : 0);
		}
		this.last_value = value;
		this.set_mandatory(value);
		this.set_disp_area();
	},
	get_value: function() {
		if (!this.$input) {
			return;
		}

		return this.$input.prop("checked") ? 1 : 0;
	},
});

frappe.ui.form.ControlButton = frappe.ui.form.ControlData.extend({
	make_input: function() {
		var me = this;
		this.$input = $('<button class="btn btn-default btn-xs">')
			.prependTo(me.input_area)
			.on("click", function() {
				me.onclick();
			});
		this.input = this.$input.get(0);
		this.set_input_attributes();
		this.has_input = true;
		this.toggle_label(false);
	},
	onclick: function() {
		if(this.frm && this.frm.doc) {
			if(this.frm.script_manager.get_handlers(this.df.fieldname, this.doctype, this.docname).length) {
				this.frm.script_manager.trigger(this.df.fieldname, this.doctype, this.docname);
			} else {
				this.frm.runscript(this.df.options, this);
			}
		}
		else if(this.df.click) {
			this.df.click();
		}
	},
	set_input_areas: function() {
		this._super();
		$(this.disp_area).removeClass().addClass("hide");
	},
	set_empty_description: function() {
		this.$wrapper.find(".help-box").empty().toggle(false);
	},
	set_label: function() {
		$(this.label_span).html("&nbsp;");
		this.$input && this.$input.html((this.df.icon ?
			('<i class="'+this.df.icon+' fa-fw"></i> ') : "") + __(this.df.label));
	}
});

frappe.ui.form.ControlAttach = frappe.ui.form.ControlData.extend({
	make_input: function() {
		var me = this;
		this.$input = $('<button class="btn btn-default btn-sm btn-attach">')
			.html(__("Attach"))
			.prependTo(me.input_area)
			.on("click", function() {
				me.onclick();
			});
		this.$value = $('<div style="margin-top: 5px;">\
			<div class="ellipsis" style="display: inline-block; width: 90%;">\
				<i class="fa fa-paper-clip"></i> \
				<a class="attached-file" target="_blank"></a>\
			</div>\
			<a class="close">&times;</a></div>')
			.prependTo(me.input_area)
			.toggle(false);
		this.input = this.$input.get(0);
		this.set_input_attributes();
		this.has_input = true;

		this.$value.find(".close").on("click", function() {
			me.clear_attachment();
		})
	},
	clear_attachment: function() {
		var me = this;
		if(this.frm) {
			me.frm.attachments.remove_attachment_by_filename(me.value, function() {
				me.parse_validate_and_set_in_model(null);
				me.refresh();
				me.frm.save();
			});
		} else {
			this.dataurl = null;
			this.fileobj = null;
			this.set_input(null);
			this.refresh();
		}
	},
	onclick: function() {
		var me = this;
		if(this.doc) {
			var doc = this.doc.parent && frappe.model.get_doc(this.doc.parenttype, this.doc.parent) || this.doc;
			if (doc.__islocal) {
				frappe.msgprint(__("Please save the document before uploading."));
				return;
			}
		}
		if(!this.dialog) {
			this.dialog = new frappe.ui.Dialog({
				title: __(this.df.label || __("Upload")),
				fields: [
					{fieldtype:"HTML", fieldname:"upload_area"},
					{fieldtype:"HTML", fieldname:"or_attach", options: __("Or")},
					{fieldtype:"Select", fieldname:"select", label:__("Select from existing attachments") },
					{fieldtype:"Button", fieldname:"clear",
						label:__("Clear Attachment"), click: function() {
							me.clear_attachment();
							me.dialog.hide();
						}
					},
				]
			});
		}

		this.dialog.show();

		this.dialog.get_field("upload_area").$wrapper.empty();

		// select from existing attachments
		var attachments = this.frm && this.frm.attachments.get_attachments() || [];
		var select = this.dialog.get_field("select");
		if(attachments.length) {
			attachments = $.map(attachments, function(o) { return o.file_url; })
			select.df.options = [""].concat(attachments);
			select.toggle(true);
			this.dialog.get_field("or_attach").toggle(true);
			select.refresh();
		} else {
			this.dialog.get_field("or_attach").toggle(false);
			select.toggle(false);
		}
		select.$input.val("");

		// show button if attachment exists
		this.dialog.get_field('clear').$wrapper.toggle(this.get_model_value() ? true : false);

		this.set_upload_options();
		frappe.upload.make(this.upload_options);
	},

	set_upload_options: function() {
		var me = this;
		this.upload_options = {
			parent: this.dialog.get_field("upload_area").$wrapper,
			args: {},
			allow_multiple: 0,
			max_width: this.df.max_width,
			max_height: this.df.max_height,
			options: this.df.options,
			btn: this.dialog.set_primary_action(__("Upload")),
			on_no_attach: function() {
				// if no attachmemts,
				// check if something is selected
				var selected = me.dialog.get_field("select").get_value();
				if(selected) {
					me.parse_validate_and_set_in_model(selected);
					me.dialog.hide();
					me.frm.save();
				} else {
					msgprint(__("Please attach a file or set a URL"));
				}
			},
			callback: function(attachment, r) {
				me.on_upload_complete(attachment);
				me.dialog.hide();
			},
			onerror: function() {
				me.dialog.hide();
			}
		}

		if ("is_private" in this.df) {
			this.upload_options.is_private = this.df.is_private;
		}

		if(this.frm) {
			this.upload_options.args = {
				from_form: 1,
				doctype: this.frm.doctype,
				docname: this.frm.docname
			}
		} else {
			this.upload_options.on_attach = function(fileobj, dataurl) {
				me.dialog.hide();
				me.fileobj = fileobj;
				me.dataurl = dataurl;
				if(me.on_attach) {
					me.on_attach()
				}
				if(me.df.on_attach) {
					me.df.on_attach(fileobj, dataurl);
				}
				me.on_upload_complete();
			}
		}
	},

	set_input: function(value, dataurl) {
		this.value = value;
		if(this.value) {
			this.$input.toggle(false);
			if(this.value.indexOf(",")!==-1) {
				var parts = this.value.split(",");
				var filename = parts[0];
				var dataurl = parts[1];
			}
			this.$value.toggle(true).find(".attached-file")
				.html(filename || this.value)
				.attr("href", dataurl || this.value);
		} else {
			this.$input.toggle(true);
			this.$value.toggle(false);
		}
	},

	get_value: function() {
		if(this.frm) {
			return this.value;
		} else {
			return this.fileobj ? (this.fileobj.filename + "," + this.dataurl) : null;
		}
	},

	on_upload_complete: function(attachment) {
		if(this.frm) {
			this.parse_validate_and_set_in_model(attachment.file_url);
			this.refresh();
			this.frm.attachments.update_attachment(attachment);
			this.frm.save();
		} else {
			this.value = this.get_value();
			this.refresh();
		}
	},
});

frappe.ui.form.ControlAttachImage = frappe.ui.form.ControlAttach.extend({
	make: function() {
		var me = this;
		this._super();
		this.img_wrapper = $('<div style="margin: 7px 0px;">\
			<div class="missing-image attach-missing-image"><i class="octicon octicon-circle-slash"></i></div></div>')
			.appendTo(this.wrapper);
		this.img = $("<img class='img-responsive attach-image-display'>")
			.appendTo(this.img_wrapper).toggle(false);

		// propagate click to Attach button
		this.img_wrapper.find(".missing-image").on("click", function() { me.$input.click(); });
		this.img.on("click", function() { me.$input.click(); });

		this.$wrapper.on("refresh", function() {
			me.set_image();
			if(me.get_status()=="Read") {
				$(me.disp_area).toggle(false);
			}
		});
		this.set_image();
	},
	set_image: function() {
		if(this.get_value()) {
			$(this.img_wrapper).find(".missing-image").toggle(false);
			this.img.attr("src", this.dataurl ? this.dataurl : this.value).toggle(true);
		} else {
			$(this.img_wrapper).find(".missing-image").toggle(true);
			this.img.toggle(false);
		}
	}
});


frappe.ui.form.ControlSelect = frappe.ui.form.ControlData.extend({
	html_element: "select",
	make_input: function() {
		var me = this;
		this._super();
		this.set_options();
	},
	set_input: function(value) {
		// refresh options first - (new ones??)
		this.set_options(value || "");

		var input_value = null;
		if(this.$input) {
			var input_value = this.$input.val();
		}

		// not a possible option, repair
		if(this.doctype && this.docname) {
			// model value is not an option,
			// set the default option (displayed)
			var model_value = frappe.model.get_value(this.doctype, this.docname, this.df.fieldname);
			if(model_value == null && (input_value || "") != (model_value || "")) {
				this.set_model_value(input_value);
			} else {
				this.last_value = value;
			}
		} else {
			if(value !== input_value) {
				this.set_value(input_value);
			}
		}

		this._super(value);

	},
	set_options: function(value) {
		var options = this.df.options || [];
		if(typeof this.df.options==="string") {
			options = this.df.options.split("\n");
		}

		// nothing changed
		if(options.toString() === this.last_options) {
			return;
		}
		this.last_options = options.toString();

		if(this.$input) {
			var selected = this.$input.find(":selected").val();
			this.$input.empty().add_options(options || []);

			if(value===undefined && selected) {
				this.$input.val(selected);
			}
		}
	},
	get_file_attachment_list: function() {
		if(!this.frm) return;
		var fl = frappe.model.docinfo[this.frm.doctype][this.frm.docname];
		if(fl && fl.attachments) {
			this.set_description("");
			var options = [""];
			$.each(fl.attachments, function(i, f) {
				options.push(f.file_url)
			});
			return options;
		} else {
			this.set_description(__("Please attach a file first."))
			return [""];
		}
	}
});

// special features for link
// buttons
// autocomplete
// link validation
// custom queries
// add_fetches
frappe.ui.form.ControlLink = frappe.ui.form.ControlData.extend({
	make_input: function() {
		var me = this;
		// line-height: 1 is for Mozilla 51, shows extra padding otherwise
		$('<div class="link-field ui-front" style="position: relative; line-height: 1;">\
			<input type="text" class="input-with-feedback form-control">\
			<span class="link-btn">\
				<a class="btn-open no-decoration" title="' + __("Open Link") + '">\
					<i class="octicon octicon-arrow-right"></i></a>\
			</span>\
		</div>').prependTo(this.input_area);
		this.$input_area = $(this.input_area);
		this.$input = this.$input_area.find('input');
		this.$link = this.$input_area.find('.link-btn');
		this.$link_open = this.$link.find('.btn-open');
		this.set_input_attributes();
		this.$input.on("focus", function() {
			setTimeout(function() {
				if(me.$input.val() && me.get_options()) {
					me.$link.toggle(true);
					me.$link_open.attr('href', '#Form/' + me.get_options() + '/' + me.$input.val());
				}

				if(!me.$input.val()) {
					me.$input.val("").trigger("input");
				}
			}, 500);
		});
		this.$input.on("blur", function() {
			// if this disappears immediately, the user's click
			// does not register, hence timeout
			setTimeout(function() {
				me.$link.toggle(false);
			}, 500);
		});
		this.input = this.$input.get(0);
		this.has_input = true;
		this.translate_values = true;
		var me = this;
		this.setup_buttons();
		this.setup_awesomeplete();
		if(this.df.change) {
			this.$input.on("change", function() {
				me.df.change.apply(this);
			});
		}
	},
	get_options: function() {
		return this.df.options;
	},
	setup_buttons: function() {
		var me = this;

		if(this.only_input && !this.with_link_btn) {
			this.$input_area.find(".link-btn").remove();
		}
	},
	open_advanced_search: function() {
		var doctype = this.get_options();
		if(!doctype) return;
		new frappe.ui.form.LinkSelector({
			doctype: doctype,
			target: this,
			txt: this.get_value()
		});
		return false;
	},
	new_doc: function() {
		var doctype = this.get_options();
		var me = this;

		if(!doctype) return;

		// set values to fill in the new document
		if(this.df.get_route_options_for_new_doc) {
			frappe.route_options = this.df.get_route_options_for_new_doc(this);
		} else {
			frappe.route_options = {};
		}

		// partially entered name field
		frappe.route_options.name_field = this.get_value();

		// reference to calling link
		frappe._from_link = this;
		frappe._from_link_scrollY = $(document).scrollTop();

		frappe.ui.form.quick_entry(doctype, function(doc) {
			if(me.frm) {
				me.parse_validate_and_set_in_model(doc.name);
			} else {
				me.set_value(doc.name);
			}
		});

		return false;
	},
	setup_awesomeplete: function() {
		var me = this;
		this.$input.on("blur", function() {
			if(me.selected) {
				me.selected = false;
				return;
			}
			var value = me.get_value();
			if(me.doctype && me.docname) {
				if(value!==me.last_value) {
					me.parse_validate_and_set_in_model(value);
				}
			} else {
				me.set_mandatory(value);
			}
		});

		this.$input.cache = {};

		this.awesomplete = new Awesomplete(me.input, {
			minChars: 0,
			maxItems: 99,
			autoFirst: true,
			list: [],
			data: function (item, input) {
				return {
					label: item.label || item.value,
					value: item.value
				};
			},
			filter: function(item, input) {
				return true;
			},
			item: function (item, input) {
				d = this.get_item(item.value);
				if(!d.label) {	d.label = d.value; }

				var _label = (me.translate_values) ? __(d.label) : d.label;
				var html = "<strong>" + _label + "</strong>";
				if(d.description && d.value!==d.description) {
					html += '<br><span class="small">' + __(d.description) + '</span>';
				}
				return $('<li></li>')
					.data('item.autocomplete', d)
					.prop('aria-selected', 'false')
					.html('<a><p>' + html + '</p></a>')
					.get(0);
			},
			sort: function(a, b) {
				return 0;
			}
		});

		this.$input.on("input", function(e) {
			var doctype = me.get_options();
			if(!doctype) return;
			if (!me.$input.cache[doctype]) {
				me.$input.cache[doctype] = {};
			}

			var term = e.target.value;

			if (me.$input.cache[doctype][term]!=null) {
				// immediately show from cache
				me.awesomplete.list = me.$input.cache[doctype][term];
			}

			var args = {
				'txt': term,
				'doctype': doctype,
			};

			me.set_custom_query(args);

			frappe.call({
				type: "GET",
				method:'frappe.desk.search.search_link',
				no_spinner: true,
				args: args,
				callback: function(r) {
					if(!me.$input.is(":focus")) {
						return;
					}

					if(!me.df.only_select) {
						if(frappe.model.can_create(doctype)
							&& me.df.fieldtype !== "Dynamic Link") {
							// new item
							r.results.push({
								label: "<span class='text-primary link-option'>"
									+ "<i class='fa fa-plus' style='margin-right: 5px;'></i> "
									+ __("Create a new {0}", [__(me.df.options)])
									+ "</span>",
								value: "create_new__link_option",
								action: me.new_doc
							})
						};
						// advanced search
						r.results.push({
							label: "<span class='text-primary link-option'>"
								+ "<i class='fa fa-search' style='margin-right: 5px;'></i> "
								+ __("Advanced Search")
								+ "</span>",
							value: "advanced_search__link_option",
							action: me.open_advanced_search
						})
					}
					me.$input.cache[doctype][term] = r.results;
					me.awesomplete.list = me.$input.cache[doctype][term];
				}
			});
		});

		this.$input.on("awesomplete-open", function(e) {
			me.$wrapper.css({"z-index": 100});
			me.$wrapper.find('ul').css({"z-index": 100});
			me.autocomplete_open = true;
		});

		this.$input.on("awesomplete-close", function(e) {
			me.$wrapper.css({"z-index": 1});
			me.autocomplete_open = false;
		});

		this.$input.on("awesomplete-select", function(e) {
			var o = e.originalEvent;
			var item = me.awesomplete.get_item(o.text.value);

			me.autocomplete_open = false;

			// prevent selection on tab
			var TABKEY = 9;
			if(e.keyCode === TABKEY) {
				e.preventDefault();
				me.awesomplete.close();
				return false;
			}

			if(item.action) {
				item.value = "";
				item.action.apply(me);
			}

			// if remember_last_selected is checked in the doctype against the field,
			// then add this value
			// to defaults so you do not need to set it again
			// unless it is changed.
			if(me.df.remember_last_selected_value) {
				frappe.boot.user.last_selected_values[me.df.options] = item.value;
			}

			if(me.frm && me.frm.doc) {
				me.selected = true;
				me.parse_validate_and_set_in_model(item.value);
				setTimeout(function() {
					me.selected = false;
				}, 100);
			} else {
				me.$input.val(item.value);
				me.$input.trigger("change");
				me.set_mandatory(item.value);
			}
		});

		this.$input.on("awesomplete-selectcomplete", function(e) {
			var o = e.originalEvent;
			if(o.text.value.indexOf("__link_option") !== -1) {
				me.$input.val("");
			}
		});
	},
	set_custom_query: function(args) {
		var set_nulls = function(obj) {
			$.each(obj, function(key, value) {
				if(value!==undefined) {
					obj[key] = value;
				}
			});
			return obj;
		}
		if(this.get_query || this.df.get_query) {
			var get_query = this.get_query || this.df.get_query;
			if($.isPlainObject(get_query)) {
				var filters = null;
				if(get_query.filters) {
					// passed as {'filters': {'key':'value'}}
					filters = get_query.filters;
				} else if(get_query.query) {

					// passed as {'query': 'path.to.method'}
					args.query = get_query;
				} else {

					// dict is filters
					filters = get_query;
				}

				if (filters) {
					var filters = set_nulls(filters);

					// extend args for custom functions
					$.extend(args, filters);

					// add "filters" for standard query (search.py)
					args.filters = filters;
				}
			} else if(typeof(get_query)==="string") {
				args.query = get_query;
			} else {
				// get_query by function
				var q = (get_query)(this.frm && this.frm.doc || this.doc, this.doctype, this.docname);

				if (typeof(q)==="string") {
					// returns a string
					args.query = q;
				} else if($.isPlainObject(q)) {
					// returns a plain object with filters
					if(q.filters) {
						set_nulls(q.filters);
					}

					// turn off value translation
					if(q.translate_values !== undefined) {
						this.translate_values = q.translate_values;
					}

					// extend args for custom functions
					$.extend(args, q);

					// add "filters" for standard query (search.py)
					args.filters = q.filters;
				}
			}
		}
		if(this.df.filters) {
			set_nulls(this.df.filters);
			if(!args.filters) args.filters = {};
			$.extend(args.filters, this.df.filters);
		}
	},
	validate: function(value, callback) {
		// validate the value just entered
		var me = this;

		if(this.df.options=="[Select]") {
			callback(value);
			return;
		}

		if(this.frm) {
			this.frm.script_manager.validate_link_and_fetch(this.df, this.get_options(),
				this.docname, value, callback);
		}
	},
});

if(Awesomplete) {
	Awesomplete.prototype.get_item = function(value) {
		return this._list.find(function(item) {
			return item.value === value;
		});
	}
}

frappe.ui.form.ControlDynamicLink = frappe.ui.form.ControlLink.extend({
	get_options: function() {
		if(this.df.get_options) {
			return this.df.get_options();
		}
		if (this.docname==null && cur_dialog) {
			//for dialog box
			return cur_dialog.get_value(this.df.options)
		}
		if (cur_frm==null && cur_list){
			//for list page
			return cur_list.wrapper.find("input[data-fieldname*="+this.df.options+"]").val()
		}
		var options = frappe.model.get_value(this.df.parent, this.docname, this.df.options);
		// if(!options) {
		// 	msgprint(__("Please set {0} first",
		// 		[frappe.meta.get_docfield(this.df.parent, this.df.options, this.docname).label]));
		// }
		return options;
	},
});

frappe.ui.form.ControlCode = frappe.ui.form.ControlText.extend({
	make_input: function() {
		this._super();
		$(this.input_area).find("textarea")
			.allowTabs()
			.css({"height":"400px", "font-family": "Monaco, \"Courier New\", monospace"});
	}
});

frappe.ui.form.ControlTextEditor = frappe.ui.form.ControlCode.extend({
	make_input: function() {
		this.has_input = true;
		this.make_editor();
		this.hide_elements_on_mobile();
		this.setup_drag_drop();
		this.setup_image_dialog();
	},
	make_editor: function() {
		var me = this;
		this.editor = $("<div>").appendTo(this.input_area);

		// Note: while updating summernote, please make sure all 'p' blocks
		// in the summernote source code are replaced by 'div' blocks.
		// by default summernote, adds <p> blocks for new paragraphs, which adds
		// unexpected whitespaces, esp for email replies.

		this.editor.summernote({
			minHeight: 400,
			toolbar: [
				['magic', ['style']],
				['style', ['bold', 'italic', 'underline', 'clear']],
				['fontsize', ['fontsize']],
				['color', ['color']],
				['para', ['ul', 'ol', 'paragraph', 'hr']],
				//['height', ['height']],
				['media', ['link', 'picture', 'video', 'table']],
				['misc', ['fullscreen', 'codeview']]
			],
			keyMap: {
				pc: {
					'CTRL+ENTER': ''
				},
				mac: {
					'CMD+ENTER': ''
				}
			},
			prettifyHtml: true,
			dialogsInBody: true,
			callbacks: {
				onChange: function(value) {
					me.parse_validate_and_set_in_model(value);
				},
				onKeydown: function(e) {
					var key = frappe.ui.keys.get_key(e);
					// prevent 'New DocType (Ctrl + B)' shortcut in editor
					if(['ctrl+b', 'meta+b'].indexOf(key) !== -1) {
						e.stopPropagation();
					}
					if(key.indexOf('escape') !== -1) {
						if(me.note_editor.hasClass('fullscreen')) {
							// exit fullscreen on escape key
							me.note_editor
								.find('.note-btn.btn-fullscreen')
								.trigger('click');
						}
					}
				},
			},
			icons: {
				'align': 'fa fa-align',
				'alignCenter': 'fa fa-align-center',
				'alignJustify': 'fa fa-align-justify',
				'alignLeft': 'fa fa-align-left',
				'alignRight': 'fa fa-align-right',
				'indent': 'fa fa-indent',
				'outdent': 'fa fa-outdent',
				'arrowsAlt': 'fa fa-arrows-alt',
				'bold': 'fa fa-bold',
				'caret': 'caret',
				'circle': 'fa fa-circle',
				'close': 'fa fa-close',
				'code': 'fa fa-code',
				'eraser': 'fa fa-eraser',
				'font': 'fa fa-font',
				'frame': 'fa fa-frame',
				'italic': 'fa fa-italic',
				'link': 'fa fa-link',
				'unlink': 'fa fa-chain-broken',
				'magic': 'fa fa-magic',
				'menuCheck': 'fa fa-check',
				'minus': 'fa fa-minus',
				'orderedlist': 'fa fa-list-ol',
				'pencil': 'fa fa-pencil',
				'picture': 'fa fa-image',
				'question': 'fa fa-question',
				'redo': 'fa fa-redo',
				'square': 'fa fa-square',
				'strikethrough': 'fa fa-strikethrough',
				'subscript': 'fa fa-subscript',
				'superscript': 'fa fa-superscript',
				'table': 'fa fa-table',
				'textHeight': 'fa fa-text-height',
				'trash': 'fa fa-trash',
				'underline': 'fa fa-underline',
				'undo': 'fa fa-undo',
				'unorderedlist': 'fa fa-list-ul',
				'video': 'fa fa-video-camera'
			}
		});
		this.note_editor = $(this.input_area).find('.note-editor');
		// to fix <p> on enter
		this.set_input('<div><br></div>');
	},
	setup_drag_drop: function() {
		var me = this;
		this.note_editor.on('dragenter dragover', false)
			.on('drop', function(e) {
				var dataTransfer = e.originalEvent.dataTransfer;

				if (dataTransfer && dataTransfer.files && dataTransfer.files.length) {
					me.note_editor.focus();

					var files = [].slice.call(dataTransfer.files);

					files.forEach(file => {
						me.get_image(file, (url) => {
							me.editor.summernote('insertImage', url, file.name);
						});
					});
				}
				e.preventDefault();
				e.stopPropagation();
			});
	},
	get_image: function (fileobj, callback) {
		var freader = new FileReader(),
			me = this;

		freader.onload = function() {
			var dataurl = freader.result;
			// add filename to dataurl
			var parts = dataurl.split(",");
			parts[0] += ";filename=" + fileobj.name;
			dataurl = parts[0] + ',' + parts[1];
			callback(dataurl);
		}
		freader.readAsDataURL(fileobj);
	},
	hide_elements_on_mobile: function() {
		this.note_editor.find('.note-btn-underline,\
			.note-btn-italic, .note-fontsize,\
			.note-color, .note-height, .btn-codeview')
			.addClass('hidden-xs');
		if($('.toggle-sidebar').is(':visible')) {
			// disable tooltips on mobile
			this.note_editor.find('.note-btn')
				.attr('data-original-title', '');
		}
	},
	get_value: function() {
		return this.editor? this.editor.summernote('code'): '';
	},
	set_input: function(value) {
		if(value == null) value = "";
		value = frappe.dom.remove_script_and_style(value);
		if(value !== this.get_value()) {
			this.editor.summernote('code', value);
		}
		this.last_value = value;
	},
	set_focus: function() {
		return this.editor.summernote('focus');
	},
	set_upload_options: function() {
		var me = this;
		this.upload_options = {
			parent: this.image_dialog.get_field("upload_area").$wrapper,
			args: {},
			max_width: this.df.max_width,
			max_height: this.df.max_height,
			options: "Image",
			btn: this.image_dialog.set_primary_action(__("Insert")),
			on_no_attach: function() {
				// if no attachmemts,
				// check if something is selected
				var selected = me.image_dialog.get_field("select").get_value();
				if(selected) {
					me.editor.summernote('insertImage', selected);
					me.image_dialog.hide();
				} else {
					msgprint(__("Please attach a file or set a URL"));
				}
			},
			callback: function(attachment, r) {
				me.editor.summernote('insertImage', attachment.file_url, attachment.file_name);
				me.image_dialog.hide();
			},
			onerror: function() {
				me.image_dialog.hide();
			}
		}

		if ("is_private" in this.df) {
			this.upload_options.is_private = this.df.is_private;
		}

		if(this.frm) {
			this.upload_options.args = {
				from_form: 1,
				doctype: this.frm.doctype,
				docname: this.frm.docname
			}
		} else {
			this.upload_options.on_attach = function(fileobj, dataurl) {
				me.editor.summernote('insertImage', dataurl);
				me.image_dialog.hide();
				frappe.hide_progress();
			}
		}
	},

	setup_image_dialog: function() {
		this.note_editor.find('[data-original-title="Image"]').on('click', (e) => {
			if(!this.image_dialog) {
				this.image_dialog = new frappe.ui.Dialog({
					title: __("Image"),
					fields: [
						{fieldtype:"HTML", fieldname:"upload_area"},
						{fieldtype:"HTML", fieldname:"or_attach", options: __("Or")},
						{fieldtype:"Select", fieldname:"select", label:__("Select from existing attachments") },
					]
				});
			}

			this.image_dialog.show();
			this.image_dialog.get_field("upload_area").$wrapper.empty();

			// select from existing attachments
			var attachments = this.frm && this.frm.attachments.get_attachments() || [];
			var select = this.image_dialog.get_field("select");
			if(attachments.length) {
				attachments = $.map(attachments, function(o) { return o.file_url; })
				select.df.options = [""].concat(attachments);
				select.toggle(true);
				this.image_dialog.get_field("or_attach").toggle(true);
				select.refresh();
			} else {
				this.image_dialog.get_field("or_attach").toggle(false);
				select.toggle(false);
			}
			select.$input.val("");

			this.set_upload_options();
			frappe.upload.make(this.upload_options);
		});
	}
});

frappe.ui.form.ControlTable = frappe.ui.form.Control.extend({
	make: function() {
		this._super();

		// add title if prev field is not column / section heading or html
		this.grid = new frappe.ui.form.Grid({
			frm: this.frm,
			df: this.df,
			perm: this.perm || (this.frm && this.frm.perm) || this.df.perm,
			parent: this.wrapper
		})
		if(this.frm) {
			this.frm.grids[this.frm.grids.length] = this;
		}

		// description
		if(this.df.description) {
			$('<p class="text-muted small">' + __(this.df.description) + '</p>')
				.appendTo(this.wrapper);
		}

		var me = this;
		this.$wrapper.on("refresh", function() {
			me.grid.refresh();
			return false;
		});
	},
	get_parsed_value: function() {
		if(this.grid) {
			return this.grid.get_data();
		}
	}
});

frappe.ui.form.ControlSignature = frappe.ui.form.ControlData.extend({
	saving: false,
	loading: false,
	make: function() {
		var me = this;
		this._super();

		// make jSignature field
		this.$pad = $('<div class="signature-field"></div>')
		    .appendTo(me.wrapper)
		    .jSignature({height:300, width: "100%", "lineWidth": 0.8})
				.on('change', this.on_save_sign.bind(this));

		this.img_wrapper = $(`<div class="signature-display">
			<div class="missing-image attach-missing-image">
				<i class="octicon octicon-circle-slash"></i>
			</div></div>`)
			.appendTo(this.wrapper);
		this.img = $("<img class='img-responsive attach-image-display'>")
			.appendTo(this.img_wrapper).toggle(false);


		this.$btnWrapper = $(`<div class="signature-btn-row">
			<a href="#" type="button" class="signature-reset btn btn-default">
			<i class="glyphicon glyphicon-repeat"></i></a>`)
			.appendTo(this.$pad)
			.on("click", '.signature-reset', function() {
				me.on_reset_sign();
				return false;
			});
		// handle refresh by reloading the pad
		this.$wrapper.on("refresh", this.on_refresh.bind(this));
	},
	on_refresh: function(e) {
		// prevent to load the second time
		this.$wrapper.find(".control-input").toggle(false);
		this.set_editable(this.get_status()=="Write");
		this.load_pad();
		if(this.get_status()=="Read") {
				$(this.disp_area).toggle(false);
		}
	},
	set_image: function(value) {
		if(value) {
			$(this.img_wrapper).find(".missing-image").toggle(false);
			this.img.attr("src", value).toggle(true);
		} else {
			$(this.img_wrapper).find(".missing-image").toggle(true);
			this.img.toggle(false);
		}
	},
	load_pad: function() {
		// make sure not triggered during saving
		if (this.saving) return;
		// get value
		var value = this.get_value();
		// import data for pad
		if (this.$pad) {
			this.loading = true;
			// reset in all cases
			this.$pad.jSignature('reset');
			if (value) {
				// load the image to find out the size, because scaling will affect
				// stroke width
				try {
					this.$pad.jSignature('setData', value);
					this.set_image(value);
				}
				catch (e){
					console.log("Cannot set data for signature", value, e);
				}
			}

			this.loading = false;
		}
	},
	set_editable: function(editable) {
			this.$pad.toggle(editable);
			this.img_wrapper.toggle(!editable);
			this.$btnWrapper.toggle(editable);
			if (editable) {
					this.$btnWrapper.addClass('editing');
			}
			else {
					this.$btnWrapper.removeClass('editing');
			}
	},
	set_my_value: function(value) {
		if (this.saving || this.loading) return;
		this.saving = true;
		this.set_value(value);
		this.value = value;
		this.saving = false;
	},
	get_value: function() {
		return this.value? this.value: this.get_model_value();
	},
	// reset signature canvas
	on_reset_sign: function() {
		this.$pad.jSignature("reset");
		this.set_my_value("");
	},
	// save signature value to model and display
	on_save_sign: function() {
		if (this.saving || this.loading) return;
		var base64_img = this.$pad.jSignature("getData");
		this.set_my_value(base64_img);
		this.set_image(this.get_value());
	}
});

frappe.ui.form.fieldtype_icons = {
	"Date": "fa fa-calendar",
	"Time": "fa fa-time",
	"Datetime": "fa fa-time",
	"Code": "fa fa-code",
	"Select": "fa fa-flag"
};
