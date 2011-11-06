function AudioCallbackStream(sampleRate, duration) {
    if(!sampleRate) return;

    this.audio = new Audio();
    this.audio.mozSetup(1, sampleRate);

    this.sampleRate = sampleRate;

    this.duration = duration;
    this.prebufferSize = Math.round(2 * sampleRate * duration);
    
    var tail = null,
        tailPosition,
        currentWritePosition = 0,
        stream = this;
        
    setInterval(function() {
        if(!stream.callback) return;
    
        var written;
        
        if (tail) {
            written = stream.audio.mozWriteAudio(tail.subarray(tailPosition));
            currentWritePosition += written;
            tailPosition += written;
            if (tailPosition < tail.length) return;
            tail = null;
        }

        var currentPosition = stream.audio.mozCurrentSampleOffset();
        var available = currentPosition + stream.prebufferSize - currentWritePosition;
        if (available > 0) {
            var soundData = new Float32Array(available);
            stream.callback.call(stream, soundData);

            written = stream.audio.mozWriteAudio(soundData);
            if (written < soundData.length) {
                tail = soundData;
                tailPosition = written;
            }
            currentWritePosition += written;
        }
    }, 100);
}
AudioCallbackStream.prototype.setCallback = function(readFn) {
    this.callback = readFn;
}

function AudioMonoStream(sampleRate, duration) {
    AudioCallbackStream.call(this, sampleRate, duration);
}
AudioMonoStream.prototype = new AudioCallbackStream;
AudioMonoStream.prototype.setFreqs = function(freqs, once) {
    this.freqs = freqs;
    this.freqIndex = 0;
    this.currentSoundSample = 0;
    var lastTime = Date.now();
    this.setCallback(!this.freqs.length ? null : function(soundData) {
        if(this.currentSoundSample < 0) return;
        
        var longer = this.freqs[this.freqIndex + 1] == this.freqs[this.freqIndex];

        this.onnextsound.call(this, this.freqs[this.freqIndex], longer);
        
        var k = 2 * Math.PI * this.freqs[this.freqIndex] / this.sampleRate;
        for (var i = 0, size = soundData.length; i < size; i++, this.currentSoundSample++) {
            var curPos = this.currentSoundSample < this.prebufferSize ? this.currentSoundSample / this.prebufferSize : 1;
            soundData[i] = 100 * Math.sin(k * this.currentSoundSample) * Math.cos(Math.PI / 2 * curPos * (longer ? 0.5 : 1));
        }

        var nowTime = Date.now();
        if (nowTime - lastTime >= (longer ? 2 : 1) * this.duration * 1000) {
            lastTime = nowTime;
            this.freqIndex = (this.freqIndex + (longer ? 2 : 1)) % this.freqs.length;
            this.currentSoundSample = once ? -1 : 0;
        }
    });
}
AudioMonoStream.prototype.onnextsound = function(){}

function AudioTextStream(sampleRate, duration) {
    AudioMonoStream.call(this, sampleRate, duration);
}
AudioTextStream.prototype = new AudioMonoStream;
AudioTextStream.charFreq = {
    'C': [261.63, 523.25],
    '#C': [277.18, 554.36],
    'D': [293.66, 587.32],
    '#D': [311.13, 622.26],
    'E': [329.63, 659.26],
    'F': [349.23, 698.46],
    '#F': [369.99, 739.98],
    'G': [392.00, 784.00],
    '#G': [415.30, 830.60],
    'A': [440.00, 880.00],
    '#A': [466.16, 932.32],
    'B': [493.88, 987.75]
};
AudioTextStream.prototype.setText = function(text, once) {
    var freqs = [],
        halfTone = false,
        higher = false;
        
    for (var i = 0; i < text.length; i++) {
        var c = text[i];
        
        if (c == '#') halfTone = true; else
        if (c == '+') higher = true; else {
            c = c.toUpperCase();
            var longer = c == text[i];
            c = (halfTone ? '#' : '') + c;
            if (c in AudioTextStream.charFreq) {
                var freq = AudioTextStream.charFreq[c][higher ? 1 : 0];
                freqs.push(freq);
                if (longer) freqs.push(freq);
            }
            if (c == 'P') freqs.push(0);
            higher = halfTone = false;
        }
    }
    
    this.setFreqs(freqs, once);
}