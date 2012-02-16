importScripts('freq.js');

var freqs;

function init(maxRateValue) {
    Freq.maxRate = Freq(maxRateValue);
    freqs = new FreqMix;
    return [];
}

function audio(offset, bufSize) {
    var started = Date.now();
    
    var buffer = new Float32Array(bufSize);
    freqs.toSampleData(buffer, offset, freqs.tau);
    
    return [offset, buffer];
}

function set(name, value) {
    freqs[name] = value;
}

function addFreq(offset, freqValue) {
    freqs.items.push(Freq({value: freqValue, offset: offset}));
}

onmessage = function (event) {
    var result = self[event.data.type].apply(self, event.data.args);
    if(result !== undefined) postMessage({type: event.data.type, args: result});
}