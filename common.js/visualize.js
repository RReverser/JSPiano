function Visualize(config) {
    var canvas = config.canvas,
        context = canvas.getContext('2d'),
        audio = config.audio,
        channels = audio.mozChannels,
        rate = audio.mozSampleRate,
        fbLength = audio.mozFrameBufferLength,
        fft = new FFT(fbLength / channels, rate),
        signal = new Float32Array(fft.bufferSize);

    context.scale(canvas.width / fft.spectrum.length * 4, -canvas.height);
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

Visualize.prototype.processAudio = function (fb) {
    function partialAvg(array, from, len) {
        var sum = 0, to = Math.min(from + len, array.length);
        for (var i = from; i < to; i++) {
            sum += array[i];
        }
        return sum / Math.max(1, len);
    }

    var signal = this.signal,
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
    
    return signal;
}