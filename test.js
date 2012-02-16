Freq.maxRate = Freq(4000);

addEventListener('load', function () {

    var canvas  = document.getElementById('wave'),
        context = canvas.getContext('2d'),
        worker  = new Worker('freqs.worker.js');

    context.scale(1, -canvas.height / 2);
    context.translate(0, -1);
    
    var spectrum = [
        '#FF00FF', // 5, Magenta, 300°
        '#0000FF', // 4, Blue,    240°
        '#00FFFF', // 3, Cyan,    180°
        '#00FF00', // 2, Green,   120°
        '#FFFF00', // 1, Yellow,   60°
        '#FF0000'  // 0, Red,       0°
    ],
    gradient = context.createLinearGradient(0, -1, 0, 1);

    [1, -1].forEach(function(k) {
        k /= 2 * (spectrum.length - 1);
        spectrum.forEach(function(color, i) {
            gradient.addColorStop(0.5 + k * i, color);
        });
    });

    context.fillStyle = gradient;

    worker.postMessage({type: 'init', args: [Number(Freq.maxRate)]});

    function onInputChange() {
        localStorage[this.id] = this.value;
        var scaled = this.value / (this.dataset.scaled || 1);
        worker.postMessage({type: 'set', args: [this.id, scaled]});
        document.getElementById(this.id + '-label').innerHTML = scaled.toFixed(2);
    }

    ['volume', 'tau'].forEach(function (id) {
        var input = document.getElementById(id);
        
        document.getElementById(id + '-min').innerHTML = input.min || 0;
        document.getElementById(id + '-max').innerHTML = input.max || 100;
        
        if (id in localStorage) input.value = localStorage[id];
        
        onInputChange.call(input);
        input.addEventListener('change', onInputChange);
    });

    var msgHandler = {
        audio: function (offset, buffer) {
            mozRequestAnimationFrame(function() {                            
                audioDestination.writeAudio(buffer);

                var imgData = context.getImageData(buffer.length, 0, canvas.width, canvas.height);
                context.putImageData(imgData, 0, 0);
                
                var offsetX = canvas.width - buffer.length;
                
                context.beginPath();
                context.moveTo(offsetX, 0);
                for (var i = 0, x = offsetX; i < buffer.length; i++, x++) context.lineTo(x, buffer[i]);
                context.fill();
            });
        },
        
        init: function () { document.title = document.title.replace('loading', 'ready') }
    };
    
    worker.onmessage = function (event) {
        var funcName = event.data.type;
        var handler = funcName in msgHandler ? msgHandler : console;
        handler[funcName].apply(handler, event.data.args);
    }

    var audioDestination = new AudioStream(function (start, available) {
        worker.postMessage({type: 'audio', args: [start, available]});
    });
    
    var piano = document.getElementById('piano'),
        sharpKeys = document.getElementById('sharpKeys'),
        notes = {
            "C"  : "Z", "C#" : "S",
            "D"  : "X", "D#" : "D",
            "E"  : "C", "E#" : null,
            "F"  : "V", "F#" : "G",
            "G"  : "B", "G#" : "H",
            "A"  : "N", "A#" : "J",
            "H"  : "M", "H#" : null,
            
            "C'" : "Q", "C#'": "2",
            "D'" : "W", "D#'": "3",
            "E'" : "E", "E#'": null,
            "F'" : "R", "F#'": "5",
            "G'" : "T", "G#'": "6",
            "A'" : "Y", "A#'": "7",
            "H'" : "U", "H#'": null
        },
        kbKeys = {};
    
    for (var note in notes) {
        var 
            isSharp   = note[1] == '#',
            isOctave2 = note[note.length - 1] == "'",
            freq      = Freq(note),
            kbKey     = notes[note],
            keyElem   = document.createElement('div'),
            parent    = isSharp ? sharpKeys : piano;

        //keyElem.id = keyId;
        keyElem.classList.add('pianoKey');
        if (isSharp) keyElem.classList.add('sharp');
        if (isOctave2) keyElem.classList.add('octave2');
        keyElem.innerHTML = note;
        keyElem.freq = freq;
        kbKey ? kbKeys[kbKey] = keyElem : keyElem.style.visibility = 'hidden';
        parent.appendChild(keyElem);
    }
    
    piano.addEventListener('click', function (event) {
        if (!event.target.classList.contains('pianoKey')) return;
        worker.postMessage({type: 'addFreq', args: [audioDestination.mozCurrentSampleOffset(), Number(event.target.freq)]});
    });
    
    function keyFromEvent(needActive, event) {
        if (event.ctrlKey || event.altKey || event.shiftKey) return;
        var keyElem = kbKeys[String.fromCharCode(event.keyCode)];
        if (!keyElem || keyElem.classList.contains('active') != needActive) return;
        keyElem.classList.toggle('active');
        return keyElem;
    }
    
    addEventListener('keydown', function (event) {
        var keyElem = keyFromEvent(false, event);
        if (keyElem) keyElem.click();
    });
    
    addEventListener('keyup', keyFromEvent.bind(this, true));
    
    audioDestination.dynamic.start();
});