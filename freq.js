function Freq(value) {
    switch (typeof value) {
    case 'object':
        return value instanceof Freq ? value : Freq.base;

    case 'string':
        var cached = Freq[value];
        return cached instanceof Freq ? cached : Freq.base.addTones(Number(value) || 0);

    default:
        if (!(this instanceof Freq)) return new Freq(value);
        if (isNaN(value)) return Freq.base;
        this.value = Number(value);
    }
}

Freq.prototype = {
    addOctaves: function (octaves) {
        return Freq(this * Math.pow(2.00201022913774, octaves))
    },
    subOctaves: function (octaves) {
        return this.addOctaves(-octaves)
    },
    addTones: function (tones) {
        return this.addOctaves(tones / 6)
    },
    subTones: function (tones) {
        return this.addTones(-tones)
    },
    sharp: function () {
        return this.addTones(0.5)
    },
    flat: function () {
        return this.subTones(0.5)
    },
    asSample: function (pos, reverbFunc) {
        return pos === undefined ? Math.PI * this / Freq.maxRate : Math.sin(this.asSample() * pos) * (reverbFunc !== undefined ? reverbFunc(pos / Freq.maxRate) : 1)
    },
    toSampleData: function (buffer, pos, reverbFunc) {
        for (var i = 0; i < buffer.length; i++, pos++) {
            buffer[i] = this.asSample(pos, reverbFunc);
        }
        return buffer;
    },
    valueOf: function () {
        return this.value
    },
    toString: function () {
        return Number(this).toFixed(3)
    }
}

Freq.base = Freq(440);

(function() {
        
    var toneDiff = {
        'C': -4.5,
        'D': -3.5,
        'E': -2.5,
        'F': -2,
        'G': -1,
        'A': 0,
        'B': 0.5,
        'H': 1
    };

    for (var noteName in toneDiff) {
        this[noteName] = this.base.addTones(toneDiff[noteName]);
    }

}).call(Freq);

Freq.maxRate = Freq(22050);

function FreqCombo(/* Array(Freq || {Freq, Shift}, ...) */ items) {
    if (!(this instanceof FreqCombo)) {
        return new FreqCombo(items);
    }
    this.items = (items || []).map(function (item) {
        return {
            freq: Freq(item.freq || item),
            shift: Number(item.shift) || Number(item.delay) * 2 * Freq.maxRate || 0
        }
    });
}

FreqCombo.prototype = Object.create(Freq.prototype);

FreqCombo.prototype.addOctaves = function (octaves) {
    return new FreqCombo(
        this.items.map(function (item) {
            return {
                freq: item.freq.addOctaves(octaves),
                shift: item.shift
            }
        })
    )
}

FreqCombo.prototype.asSample = function (pos, reverbFunc) {
    return Math.min
           (
               1,
               Math.max
               (
                   -1,
                   this.items
                   .filter(function (item) { return pos >= item.shift })
                   .map(function (item) { return item.freq.asSample(pos - item.shift, reverbFunc) })
                   .reduce(function (sum, sample) { return sum + sample })
               )
           );
}

FreqCombo.prototype.valueOf = function () {
    return this.items
}

FreqCombo.prototype.toString = function () {
    return this.items.join(', ')
}

function AudioStream(/* void(Audio this, int start, int available) => this.audioCallback(Float32Array[available] soundData || null) */ readFn) {
    var audio = new Audio();
    audio.mozSetup(1, /* sampleRate = */ 2 * Freq.maxRate);

    var bufSize = 2 * Freq.maxRate; // buffer 1sec
    var tail, curPos = 0, writePos = 0;
    
    audio.writeAudio = function(soundData) {
        if(soundData == null) {
            this.dynamic.stop();
            return;
        }
        var written = this.mozWriteAudio(soundData);
        writePos += written;
        if (written < soundData.length) {
            // Not all the data was written, saving the tail.
            tail = soundData.subarray(written);
            return false;
        } else {
            tail = null;
            return true;
        }
    }
    
    function onTimer() {
        // Check if some data was not written in previous attempts.
        var available = audio.mozCurrentSampleOffset() + bufSize - writePos;
        
        // Check if we need add some data to the audio output.
        if (available > 0) {
            // Request some sound data from the callback function.
            var newAvailable = available - (tail ? tail.length : 0);
            if (tail && !audio.writeAudio(tail)) return;
            
            if (newAvailable > 0) {
                readFn.call(audio, curPos, newAvailable);
                curPos += newAvailable;
            }
        }
    }
    
    audio.dynamic = {
        timerId: 0,
        paused: false,
        start: function() { this.timerId = setInterval(onTimer, 500) },
        pause: function() { clearInterval(this.timerId); this.timerId = 0; this.paused = true; },
        stop: function() { this.pause(); this.paused = false; curPos = 0; tail = null }
    }

    return audio;
}