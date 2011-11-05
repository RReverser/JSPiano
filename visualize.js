function Visualize(config) {
    var canvas = config.canvas,
        context = canvas.getContext('2d'),
        audio = config.audio,
        channels = audio.mozChannels,
        rate = audio.mozSampleRate,
        fbLength = audio.mozFrameBufferLength,
        fft = new FFT(fbLength / channels, rate),
        signal = new Float32Array(fft.bufferSize);

    context.scale(2 * canvas.width / fft.spectrum.length, -canvas.height);
    context.translate(0, -1);

    $.extend(this, config, {
        context: context,
        channels: channels,
        rate: rate,
        fbLength: fbLength,
        fft: fft,
        signal: signal
    });
}

Visualize.prototype.processAudio = function (event) {
    function partialAvg(array, from, len) {
        var sum = 0, to = Math.min(from + len, array.length);
        for (var i = from; i < to; i++) {
            sum += array[i];
        }
        return sum / Math.max(1, len);
    }

    var fb = event.frameBuffer,
        t = event.time,
        signal = this.signal,
        channels = this.channels,
        fft = this.fft,
        canvas = this.canvas,
        context = this.context;

    if (channels > 1) {
        for (var i = 0, signalStart = 0; i < signal.length; i++, signalStart += channels) {
            signal[i] = partialAvg(fb, signalStart, channels);
        }
    }
    else {
        signal.set(fb);
    }

    fft.process(signal, false);

    context.clearRect(0, 0, fft.spectrum.length, 1);

    var maxSpectrum = Math.sqrt(fft.sampleRate / 2);
    for (var i = 0; i < fft.spectrum.length / 2; i++) {
        context.fillRect(i, 0, 1, fft.spectrum[i] / maxSpectrum);
    }
}

// FFT from dsp.js, see below
var FFT = function (bufferSize, sampleRate) {
        this.bufferSize = bufferSize;
        this.sampleRate = sampleRate;
        this.spectrum = new Float32Array(bufferSize);
        this.real = new Float32Array(bufferSize);
        this.imag = new Float32Array(bufferSize);
        this.reverseTable = new Uint32Array(bufferSize);
        this.sinTable = new Float32Array(bufferSize);
        this.cosTable = new Float32Array(bufferSize);

        var limit = 1,
            bit = bufferSize >> 1;

        while (limit < bufferSize) {
            for (var i = 0; i < limit; i++) {
                this.reverseTable[i + limit] = this.reverseTable[i] + bit;
            }

            limit = limit << 1;
            bit = bit >> 1;
        }

        for (var i = 0; i < bufferSize; i++) {
            this.sinTable[i] = Math.sin(-Math.PI / i);
            this.cosTable[i] = Math.cos(-Math.PI / i);
        }
    };

FFT.prototype.process = function (buffer, backward) {
    var bufferSize = this.bufferSize,
        cosTable = this.cosTable,
        sinTable = this.sinTable,
        reverseTable = this.reverseTable,
        real = this.real,
        imag = this.imag,
        spectrum = this.spectrum;

    if (bufferSize !== buffer.length) {
        throw "Supplied buffer is not the same size as defined FFT. FFT Size: " + bufferSize + " Buffer Size: " + buffer.length;
    }

    for (var i = 0; i < bufferSize; i++) {
        real[i] = buffer[reverseTable[i]];
        imag[i] = 0;
    }

    var halfSize = 1,
        phaseShiftStepReal, phaseShiftStepImag, currentPhaseShiftReal, currentPhaseShiftImag, off, tr, ti, tmpReal, i;

    while (halfSize < bufferSize) {
        phaseShiftStepReal = cosTable[halfSize];
        phaseShiftStepImag = sinTable[halfSize];
        currentPhaseShiftReal = 1.0;
        currentPhaseShiftImag = 0.0;

        for (var fftStep = 0; fftStep < halfSize; fftStep++) {
            i = fftStep;

            while (i < bufferSize) {
                off = i + halfSize;
                tr = (currentPhaseShiftReal * real[off]) - (currentPhaseShiftImag * imag[off]);
                ti = (currentPhaseShiftReal * imag[off]) + (currentPhaseShiftImag * real[off]);

                real[off] = real[i] - tr;
                imag[off] = imag[i] - ti;
                real[i] += tr;
                imag[i] += ti;

                i += halfSize << 1;
            }

            tmpReal = currentPhaseShiftReal;
            currentPhaseShiftReal = (tmpReal * phaseShiftStepReal) - (currentPhaseShiftImag * phaseShiftStepImag);
            currentPhaseShiftImag = (tmpReal * phaseShiftStepImag) + (currentPhaseShiftImag * phaseShiftStepReal);
        }

        halfSize = halfSize << 1;
    }

    i = bufferSize;
    while (i--) {
        spectrum[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
        if(backward) { spectrum[i] /= bufferSize; }
    }
};