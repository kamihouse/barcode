var barcode = function() {

	var video = null;
	var canvas = null;
	var ctx = null;	
	var canvasg = null;
	var ctxg = null;	
	var localMediaStream = null;
	var height = 0;
	var width = 0;
	var start = 0;
	var end = 0;
	var bars = [];

	var upc = {
		'0': [3, 2, 1, 1],
		'1': [2, 2, 2, 1],
		'2': [2, 1, 2, 2],
		'3': [1, 4, 1, 1],
		'4': [1, 1, 3, 2],
		'5': [1, 2, 3, 1],
		'6': [1, 1, 1, 4],
		'7': [1, 3, 1, 2],
		'8': [1, 2, 1, 3],
		'9': [3, 1, 1, 2]
	};

	var config = {
		strokeColor: '#f00',
		start: 0.1,
		end: 0.9,
		threshold: 160,
		quality: 0.45,
		delay: 100,
		video: '',
		canvas: '',
		canvasg: '', 
		result: ''
	}

	function writeResult(result) {
		$(config.result).html(result);		
	}

	function snapshot() {
		timerStart = new Date().getTime();
		ctx.drawImage(video, 0, 0, width, height);
		processImage();		
	}

	function processImage() {

		var pixels = [];
		var binary = [];
		var pixelbars = [];

		bars = [];

		// convert to grayscale
 
		var imgd = ctx.getImageData(start, height * 0.5, end - start, 1);
		var rgbpixels = imgd.data;

		for (var i = 0, ii = rgbpixels.length; i < ii; i = i + 4) {
			pixels.push(Math.round(rgbpixels[i] * 0.2126 + rgbpixels[i + 1] * 0.7152 + rgbpixels[ i + 2] * 0.0722));
		}

		// normalize and convert to binary

		var min = Math.min.apply(null, pixels);
		var max = Math.max.apply(null, pixels);

		for (var i = 0, ii = pixels.length; i < ii; i++) {
			if (Math.round((pixels[i] - min) / (max - min) * 255) > config.threshold) {				
				binary.push(1);
			} else {
				binary.push(0);
			}
		}
		
		// determine bar widths

		var current = binary[0];
		var count = 0;

		for (var i = 0, ii = binary.length; i < ii; i++) {
			if (binary[i] == current) {
				count++;
			} else {
				pixelbars.push(count);
				count = 1;
				current = binary[i]
			}
		}
		pixelbars.push(count);

		// quality check

		if (pixelbars.length < (3 + 24 + 5 + 24 + 3 + 1)) {
			return;
		}

		// find starting sequence

		var startIndex = 0;
		var minFactor = 0.5;
		var maxFactor = 1.5;

		for (var i = 3, ii = pixelbars.length; i < ii; i++) {
			var refLength = (pixelbars[i] + pixelbars[i-1] + pixelbars[i-2]) / 3;
			if (
				(pixelbars[i] > (minFactor * refLength) || pixelbars[i] < (maxFactor * refLength))
				&& (pixelbars[i-1] > (minFactor * refLength) || pixelbars[i-1] < (maxFactor * refLength))
				&& (pixelbars[i-2] > (minFactor * refLength) || pixelbars[i-2] < (maxFactor * refLength))
				&& (pixelbars[i-3] > 3 * refLength)
			) {
				startIndex = i - 2;
				break;
			}
		}

		if (startIndex == 0) {
			return;
		}

		pixelbars = pixelbars.slice(startIndex, startIndex + 3 + 24 + 5 + 24 + 3);

		// calculate relative widths

		var ref = (pixelbars[0] + pixelbars[1] + pixelbars[2]) / 3;
		
		for (var i = 0, ii = pixelbars.length; i < ii; i++) {
			bars.push(Math.round(pixelbars[i] / ref * 100) / 100);
		}

		// analyze pattern

		analyze();

	}	

	function normalize(input, total) {
		var sum = 0;
		var result = [];
		for (var i = 0, ii = input.length; i < ii; i++) {
			sum = sum + input[i];
		}
		for (var i = 0, ii = input.length; i < ii; i++) {
			result.push(input[i] / sum * total);
		}
		return result;
	}

	function isOdd(num) { 
		return num % 2;
	}

	function maxDistance(a, b) {
		var distance = 0;
		for (var i = 0, ii = a.length; i < ii; i++) {
			if (Math.abs(a[i] - b[i]) > distance) {
				distance = Math.abs(a[i] - b[i]);
			}
		}
		return distance;
	}

	function parityCheck(digit) {
		if (!isOdd(Math.round(digit[1] + digit[3]))) {
			return digit.reverse();
		} else {
			return digit;
		}
	}
	
	function analyze() {

		// determine parity first digit and reverse sequence if necessary

		var first = normalize(bars.slice(3, 3 + 4), 7);
		if (!isOdd(Math.round(first[1] + first[3]))) {
			bars = bars.reverse();
		}

		// split

		var digits = [
			normalize(bars.slice(3, 3 + 4), 7),
			normalize(bars.slice(7, 7 + 4), 7),
			normalize(bars.slice(11, 11 + 4), 7),
			normalize(bars.slice(15, 15 + 4), 7),
			normalize(bars.slice(19, 19 + 4), 7),
			normalize(bars.slice(23, 23 + 4), 7),
			normalize(bars.slice(32, 32 + 4), 7),
			normalize(bars.slice(36, 36 + 4), 7),
			normalize(bars.slice(40, 40 + 4), 7),
			normalize(bars.slice(44, 44 + 4), 7),
			normalize(bars.slice(48, 48 + 4), 7),
			normalize(bars.slice(52, 52 + 4), 7)
		]

		// determine parity and reverse if necessary

		for (var i = 0; i < 6; i++) {
			digits[i] = parityCheck(digits[i]);
		}		
				
		// identify digits
		
		var result = [];	
		var quality = 0;

		for (var i = 0, ii = digits.length; i < ii; i++) {

			var distance = 9;
			var bestKey = '';

			for (key in upc) {
				if (maxDistance(digits[i], upc[key]) < distance) {
					distance = maxDistance(digits[i], upc[key]);
					bestKey = key;
				}	
			}

			result.push(bestKey);
			if (distance > quality) {
				quality = distance;
			}
		
		}		

		// output

		if(quality < config.quality) {
			writeResult(result.join(''));
		}

	}

	function drawGraphics() {
		ctxg.strokeStyle = config.strokeColor;
		ctxg.lineWidth = 3;
		ctxg.beginPath();
		ctxg.moveTo(start, height * 0.5);
		ctxg.lineTo(end, height * 0.5);
		ctxg.stroke();
	}

	function init(videoElement, canvasElement, canvasElementG, resultElement) {

		config.video = videoElement;
		config.canvas = canvasElement;
		config.result = resultElement;
		config.canvasg = canvasElementG;

		window.URL = window.URL || window.webkitURL;
		navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

		video = document.querySelector(config.video);
		video.addEventListener('click', snapshot, false);
		canvas = document.querySelector(config.canvas);
		ctx = canvas.getContext('2d');
		canvasg = document.querySelector(config.canvasg);
		ctxg = canvasg.getContext('2d');

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
			canvasg.width = width;
			canvasg.height = height;
			setInterval(function(){snapshot()}, config.delay);
			drawGraphics();
		}, false);
	}

	return {
		init: init
	};

	// debugging utilities

	function drawBars(binary) {
		for (var i = 0, ii = binary.length; i < ii; i++) {
			if (binary[i] == 1) {
				ctxg.strokeStyle = '#fff';
			} else {
				ctxg.strokeStyle = '#000';
			}
			ctxg.lineWidth = 3;
			ctxg.beginPath();
			ctxg.moveTo(start + i, height * 0.5);
			ctxg.lineTo(start + i + 1, height * 0.5);
			ctxg.stroke();
		}
	}

}();
