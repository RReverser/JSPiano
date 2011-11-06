$(function () {
    var $piano = $('#piano'),
        $sounds = $('#sounds'),
        $usertext = $('#usertext'),
        keyX = 0,
        keyDX = 80,
        freqKey = {},
        audioDestination = new AudioTextStream(44100, 0.25);

    audioDestination.onnextsound = function (freq, longer) {
        var keyData = freqKey[freq];
        if (!keyData) return;
        var $key = $('#key-' + keyData.name), halfTone = $key.hasClass('halfTone');
        if(!$key.hasClass('active')) {
            $key.addClass('active')
                .css('backgroundColor', halfTone ? (keyData.subIndex ? '#444' : '#333') : (keyData.subIndex ? '#bbb' : '#ccc'))
                .animate({backgroundColor: halfTone ? '#000' : '#fff'}, (longer ? 2 : 1) * 250 + 50, 'linear', function() { $(this).removeClass('active') });
        }
    }

    $('#play').click(function () { audioDestination.setText($sounds.val()) });
    $('#stop').click(function () { audioDestination.setText('') });
    $('#clear').click(function () { $usertext.val('') });

    for (var keyName in AudioTextStream.charFreq) {
        $.each(AudioTextStream.charFreq[keyName], function (subIndex, freq) {
            freqKey[freq] = {
                name: keyName.replace('#', 'half'),
                subIndex: subIndex
            };
        });

        var halfTone = keyName.indexOf('#') >= 0;

        $('<div class="pianoKey" />')
            .data('keyName', keyName)
            .prop('id', 'key-' + keyName.replace('#', 'half'))
            .addClass(halfTone ? 'halfTone' : 'fullTone')
            .css('marginLeft', (keyX - (halfTone ? keyDX / 4 + 3 : 0)) + 'px')
            .append($('<span />').text(keyName))
            .appendTo($piano);

        if (keyName[0] != '#') {
            keyX += keyDX + 4;
        }
    }

    function userSound(event, keyName) {
        if (!(keyName in AudioTextStream.charFreq)) return;
        if (event.ctrlKey) return;
        if (event.altKey) keyName = '+' + keyName;
        if (!event.shiftKey) keyName = keyName.toLowerCase();
        audioDestination.setText(keyName, true);
        $usertext.val($usertext.val() + keyName);
        event.preventDefault();
    }

    $('.pianoKey').mousedown(function (event) {
        userSound(event, $(this).data('keyName'));
    });

    $(document).keydown(function (event) {
       if(event.target == $sounds[0] || event.target == $usertext[0]) return;
        userSound(event, String.fromCharCode(event.keyCode));
    });
});