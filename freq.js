function Freq(value) {
    switch (typeof value) {
        case 'object':
            return value instanceof Freq ? value : Freq().with(value);

        case 'string':
            switch (value[value.length - 1]) {
                case "'": return Freq(value.substr(0, value.length - 1)).addOctaves(1);
                case "#": return Freq(value.substr(0, value.length - 1)).sharp();
            }
            
            var cached = Freq[value];
            return cached instanceof Freq ? cached : Freq(Number(value));

        case 'number':
            if (isNaN(value)) return Freq();
            if (!(this instanceof Freq)) return new Freq(value);
            this.value = value;
            return;
            
        default:
            if (!(this instanceof Freq)) return Freq.base || (Freq.base = new Freq);
            return;
    }
}

Freq.prototype = {
    value: 440,
    offset: 0,
    //volume: 1,
    maxPos: Infinity,
    with: function (props) {
        var result = new Freq(props.value > 0 ? props.value : this.value);
        result.offset = props.offset > 0 ? props.offset : this.offset;
        //result.volume = props.volume >= 0 ? props.volume : this.volume;
        //if (result.volume == this.volume)
        result.maxPos = this.maxPos;
        return result;
    },
    addOctaves: function (octaves) { return this.with({value: this * Math.pow(2.00201022913774, octaves)}) },
    subOctaves: function (octaves) { return this.addOctaves(-octaves) },
    addTones: function (tones) { return this.addOctaves(tones / 6) },
    subTones: function (tones) { return this.addTones(-tones) },
    sharp: function () { return this.addTones(0.5) },
    flat: function () { return this.subTones(0.5) },
    asSample: function (pos, tau) {
        pos -= this.offset;
        if (pos < 0 || pos >= this.maxPos) return 0;
        
        var reverbCoef = pos / (2 * Freq.maxRate) / tau, reverbKey = String(reverbCoef);
        
        var reverb = Freq.reverb[reverbKey] || (Freq.reverb[reverbKey] = /*this.volume * */Math.exp(-reverbCoef));
        if (reverb <= 0.005) this.maxPos = pos;
        
        var t = this * pos / Freq.maxRate;
        
        return reverb * (Freq.power[t] || (Freq.power[t] = Math.cos(Math.PI * t)));
    },
    toSampleData: function (buffer, pos, tau) {
        for (var i = 0; i < buffer.length; i++, pos++) {
            buffer[i] = this.asSample(pos, tau);
        }
        return buffer;
    },
    valueOf: function () { return this.value },
    toString: function () { return Number(this).toFixed(3) }
}

Freq.base = new Freq;
Freq.reverb = {};
Freq.power = {};

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
    
    for (var noteName in toneDiff) Freq[noteName] = Freq.base.addTones(toneDiff[noteName]);
})();

Freq.maxRate = Freq(22050);

function FreqMix(/* Freq[] */ items) {
    if (!(this instanceof FreqMix)) return new FreqMix(items);
    this.items = (items || []).map(Freq);
}

FreqMix.prototype = Object.create(Freq.prototype);

FreqMix.prototype.addOctaves = function (octaves) {
    return new FreqMix(this.items.map(function (item) { return item.addOctaves(octaves) }));
}

FreqMix.prototype.asSample = function (pos, tau) {
    pos -= this.offset;
    return Math.max
           (
               -1,
               Math.min
               (
                   1,
                   this.items
                   .map(function (item) { return item.asSample(pos, tau) })
                   .reduce(function (sum, sample) { return sum + sample }, 0)
                   * this.volume
               )
           );
}

FreqMix.prototype.valueOf = function () { return this.items }

FreqMix.prototype.toString = function () { return this.items.join(', ') }

function AudioStream(/* void(Audio this, int start, int available) => this.audioCallback(Float32Array[available] soundData || null) */ readFn) {
    var audio = new Audio();
    audio.mozSetup(1, /* sampleRate = */ 2 * Freq.maxRate);

    var bufSize = Freq.maxRate.value * 0.75; // buffer 250 msec
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
        
        // Check if we need addsome data to the audio output.
        if (available > 0) {
            // Request some sound data from the callback function.
            var newAvailable = available - (tail ? tail.length : 0);

            if ((!tail || audio.writeAudio(tail)) && newAvailable > 0) {
                readFn.call(audio, curPos, bufSize);
                curPos += bufSize;
            }
        }
    }
    
    audio.dynamic = {
        timerId: 0,
        paused: false,
        start: function() { this.timerId = setInterval(onTimer, 100) },
        pause: function() { clearInterval(this.timerId); this.timerId = 0; this.paused = true; },
        stop: function() { this.pause(); this.paused = false; curPos = 0; tail = null }
    }

    return audio;
}