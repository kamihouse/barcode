var barcode = function() {

	var video = null;
	var canvas = null;
	var ctx = null;	
	var localMediaStream = null;
	var height = 0;
	var width = 0;
	var start = 0;
	var end = 0;

	var upc = {
		'3211': '0',
		'2221': '1',
		'2122': '2',
		'1411': '3',
		'1132': '4',
		'1231': '5',
		'1114': '6',
		'1312': '7',
		'1213': '8',
		'3112': '9'
	};

	var config = {
		strokeColor: '#f00',
		start: 0.05,
		end: 0.95,
		threshold: 160
	}

	function snapshot() {
		ctx.drawImage(video, 0, 0, width, height);
		getPixels();		
		drawGraphics();
		document.querySelector('#barcode_img').src = canvas.toDataURL('image/webp');
	}

	function getPixels() {

		// grayscale values
 
		var pixels = [];
		var imgd = ctx.getImageData(start, height * 0.5, end - start, 1);
		var rgbpixels = imgd.data;
		for (var i = 0, ii = rgbpixels.length; i < ii; i = i + 4) {
			pixels.push(Math.round(rgbpixels[i] * 0.2126 + rgbpixels[i + 1] * 0.7152 + rgbpixels[ i + 2] * 0.0722));
		}

		// grayscale values normalized

		var min = Math.min.apply(null, pixels);
		var max = Math.max.apply(null, pixels);
		for (var i = 0, ii = pixels.length; i < ii; i++) {
			pixels[i] = Math.round((pixels[i] - min) / (max - min) * 255);
		}
		console.log(pixels);
		
		// binary values

		var values = [];
		for (var i = 0, ii = pixels.length; i < ii; i++) {
			if (pixels[i] > config.threshold) {
				values.push(1);
			} else {
				values.push(0);
			}
		}
		
		// bar widths

		var bars = [];
		var current = 0;
		var count = 0;
		for (var i = values.indexOf(0), ii = values.length; i < ii; i++) {
			if (values[i] == current) {
				count++;
			} else {
				bars.push(count);
				count = 1;
				current = values[i]
			}
		}
		bars.push(count);
		console.log(bars);

		if (bars.length > (3 + 24 + 5 + 24 + 3)) {

			// bars relative widths
			
			var ref = (bars[0] + bars[1] + bars[2]) / 3;

			var relative = [];
			var relativeRounded = [];
		
			for (var i = 0, ii = bars.length; i < ii; i++) {
				relative.push(Math.round(bars[i] / ref * 100) / 100);
				relativeRounded.push(Math.round(bars[i] / ref));
			}
			console.log(relative);
			console.log(relativeRounded);

			// parts

			var startSeq = relativeRounded.slice(0, 3).join('');
			var midSeq = relativeRounded.slice(27, 27 + 5).join('');
			relativeRounded = relativeRounded.slice(3, 3 + 24).concat(relativeRounded.slice(32, 32 + 24));

			if (startSeq == '111' && midSeq == '11111') {

				// detect digits

				digits = [];
				keys = [];
				for (var i = 0; i < 48; i = i + 4) {
					var key = relativeRounded.slice(i, i + 4).join('');					
					keys.push(key);
					if (upc[key]) {
						digits.push(upc[key]);					
					} else if (upc[key.split('').reverse().join('')]) {
						digits.push(upc[key.split('').reverse().join('')]);					
					} 
					else {
						digits.push('?');
					}
				}
				console.log(keys);
				console.log(digits.join(''));
				
			} else {
				console.log('reference sequence error');
				console.log(startSeq);
				console.log(midSeq);
			}

		} else {
			console.log('not enough bars detected');
		}

	}	

	function drawGraphics() {
		ctx.strokeStyle = config.strokeColor;
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.moveTo(start, height * 0.5);
		ctx.lineTo(end, height * 0.5);
		ctx.stroke();
	}

	function init(element) {

		$(element).html('<video id="barcode_video" autoplay></video><img id="barcode_img" src=""><canvas id="barcode_canvas" style="display: none;"></canvas>');

		window.URL = window.URL || window.webkitURL;
		navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

		video = document.querySelector('#barcode_video');
		video.addEventListener('click', snapshot, false);
		canvas = document.querySelector('#barcode_canvas');
		ctx = canvas.getContext('2d');

		if (navigator.getUserMedia) {
			navigator.getUserMedia({audio: false, video: true}, function(stream) {
				video.src = window.URL.createObjectURL(stream);
			});
		}

		video.addEventListener('canplay', function(e) {
			height = video.videoHeight;
			width = video.videoWidth;
			start = width * config.start;
			end = width * config.end;
			canvas.width = width;
			canvas.height = height;
			console.log('canplay event');
		}, false);

	}

	return {
		init: init
	};

}();
