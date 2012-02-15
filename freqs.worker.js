importScripts('freq.js');

var freqs, volume, tau;

function init(maxRate, freqItems) {
    Freq.maxRate = Freq(maxRate);
    freqs = new FreqCombo(freqItems);
}

function audio(offset, bufSize) {
    var started = Date.now();
    
    var buffer = new Float32Array(bufSize);
    freqs.toSampleData(buffer, offset, function (t) { return volume/* * Math.exp(-t / tau)*/ });
    
    return [offset, buffer];
}

function set(name, value) {
    self[name] = value;
}

onmessage = function (event) {
    var result = self[event.data.type].apply(self, event.data.args);
    if(result !== undefined) {
        postMessage({type: 'callback', args: result});
    }
}