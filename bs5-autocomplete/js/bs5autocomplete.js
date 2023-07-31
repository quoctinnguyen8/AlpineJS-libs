function _dispatchAlpineCustomEv(name, params) {
	let res = document.dispatchEvent(new CustomEvent(name, { detail: params }));
	return res;
}

String.prototype.removeAccents = function () {
	return this.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace("đ", "d")
		.replace("Đ", "d");
}

document.addEventListener("alpine:init", function () {
	/*
	 * selectedValue: string|array
	 * mapper: Định nghĩa mảng các key để chuyển đổi dữ liệu theo nguyên tắc
	 *		0	=>	value
	 *		1	=>	text
	 */
	Alpine.data("bs5autocomplete", (selectedValue, mapper) => ({
		_setting: {
			minCharsToFind: 2,
			placeholder: "Nhập ít nhất {num} ký tự để tìm kiếm",
			text: "-- Chọn một giá trị --", // Đặt text mặc định để không bị thay đổi layout quá nhiều
			title: '',
			style: {
				maxHeight: "300px",
				overflow: "auto",
			},
		},
		_exception: {
			IS_NOT_MULTIPLE_MODE: "Không thể gán nhiều giá trị khi không bật 'data-multiple'",
			INVALID_NAME: "Phải có attribute 'data-name'",
		},
		// dropdown dưới dạng JS object để dễ xử lý
		_dropdown: {},
		/**
		 * mảng chứa object với cấu trúc như sau
		 *		value				: number|string
		*		text				: string
		*		noAccentsText		: string
		*		selected			: bool
		*		show				: bool
		**/
		_data: [],

		// Input element nhận kết quả chọn
		_outputEle: {},
		_isMultiple: false,
		_uri: '',
		_name: '',
		// constructor
		init() {
			let dataset = this.$el.dataset;
			let inpSelector = dataset.select;
			let multiSelect = dataset.multiple;
			this._uri = dataset.uri;
			this._name = dataset.name;
			if (!this._name){
				throw this._exception.INVALID_NAME;
			}
			this._isMultiple = multiSelect && multiSelect == 'true' ? true : false;
			this._outputEle = document.querySelector(dataset.outputEle);
			this._dropdown = new bootstrap.Dropdown(this.$el);
			this._setting.placeholder = this._setting
				.placeholder
				.replace("{num}", this._setting.minCharsToFind);
			if (inpSelector) {
				// Lấy data từ thẻ select
				this.loadDataFormSelect(inpSelector);
			} else if (this._uri) {
				// Nhận data từ uri
				this.loadDataFromUri(this._uri, selectedValue);
			}
			this.addCustomEvent();
		},
		loadDataFormSelect(selector) {
			this._data = [];
			let options = Array.from(document.querySelector(selector).options);
			options.forEach((item) => {
				let strValue = item.value;
				let text = item.text;
				let noAccentsText = text.removeAccents();
				let dataItem = {
					value: strValue,
					text,
					noAccentsText,
					show: true,
					selected: item.selected
				};
				this._data.push(dataItem);
			});
			this.updateText();
		},
		loadDataFromUri(uri, selected) {
			this._data = [];
			fetch(uri)
				.then((res) => res.json())
				.then((json) => {
					if (json) {
						json.forEach((item) => {
							let strValue = item[mapper[0]].toString();
							let text = item[mapper[1]];
							let noAccentsText = text.removeAccents();
							let dataItem = {
								value: strValue,
								text,
								noAccentsText,
								show: true,
							};
							if (selected){
								if (typeof selected == "string" || typeof selected == "number") {
									dataItem.selected = strValue == selected;
								} else if (Array.isArray(selected)) {
									dataItem.selected = selected
									? selected.findIndex((s) => s == strValue) >= 0
									: false;
								}
							}
							this._data.push(dataItem);
						});
					}
				}).finally(() => {
					this.updateText();
				});
		},
		updateText() {
			let selecteds = this._data.filter((x) => x.selected);
			this._outputEle.value = selecteds.map((x) => x.value).join(",");

			if (!selecteds || selecteds.length == 0) {
				this._setting.text = "-- Chọn một giá trị --";
				this._setting.title = "Chọn một giá trị";
			} else if (selecteds.length == 1) {
				this._setting.text = selecteds[0].text;
				this._setting.title = selecteds[0].text;
			} else {
				this._setting.text = `${selecteds.length} giá trị được chọn`;
				this._setting.title = selecteds.map(t => t.text).join("\n");
			}
		},
		getValue() {
			let selected = this._data.filter((i) => i.selected == true);
			return selected.map(x => x.value);
		},
		setValue(...value) {
			if (!this._isMultiple && Array.isArray(value)){
				throw this._exception.IS_NOT_MULTIPLE_MODE;
			}
			for (let i = 0; i < this._data.length; i++) {
				const item = this._data[i];
				item.selected = value.findIndex(x => x == item.value) >= 0;
			}
			this.updateText();
		},
		toggleCheckbox(item) {
			if (!this._isMultiple) {
				for (let i = 0; i < this._data.length; i++) {
					if (this._data[i].selected && this._data[i] != item) {
						this._data[i].selected = false;
					}
				}
				this._dropdown.hide();
			}
			item.selected = !item.selected;
			this.updateText();
		},
		search(keyword) {
			if (keyword.length < this._setting.minCharsToFind) {
				for (let i = 0; i < this._data.length; i++) {
					this._data[i].show = true;
				}
			} else {
				keyword = keyword.toLowerCase();
				for (let i = 0; i < this._data.length; i++) {
					const item = this._data[i];
					if (item.text.toLowerCase().indexOf(keyword) >= 0 || item.noAccentsText.toLowerCase().indexOf(keyword) >= 0) {
						item.show = true;
					} else {
						item.show = false;
					}
				}
			}
		},
		addCustomEvent() {
			let evName, event;

			// set giá trị cho dropdown từ bên ngoài
			evName = `b5a.${this._name}.setValue`;
			event = new CustomEvent(evName);
			document.addEventListener(evName, (e) => {
				if (typeof e.detail == "string" || typeof e.detail == "number") {
					this.setValue(e.detail);
				} else{
					this.setValue(...e.detail);
				}
			});

			// reload data bằng url mới
			evName = `b5a.${this._name}.loadDataFromUri`;
			event = new CustomEvent(evName);
			document.addEventListener(evName, (e) => {
				let uri = e.detail.uri;
				let selected = e.detail.selected;
				if (!this._isMultiple && Array.isArray(selected)){
					throw this._exception.IS_NOT_MULTIPLE_MODE;
				}
				if (uri) {
					this._uri = uri;
					this.loadDataFromUri(this._uri, selected);
				}
			});
		}
	}));
});