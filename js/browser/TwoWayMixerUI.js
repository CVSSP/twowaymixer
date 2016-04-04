/* TwoWayMixerUI.js
 *
 * Written by Gerard Roma
 * Copyright (C) 2016 University of Surrey
 * All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the BSD license. See the LICENSE file for details.
 */

var TwoWayMixerUI = function(mixer){
    var ui = this;
    this.mixer = mixer;
    $(".fader").each(function(){
        $(this).slider({reversed : true})
    });
    $(".btn-group > .btn").click(function(e){ui.clickRadio(ui,e)});
    $("#track>li>a").click(function(e){ui.clickLink(ui,e)});
    $("#play_button").click(function(e){ui.clickPlay(ui,e)});
}

TwoWayMixerUI.prototype = {
    clickRadio: function(ui, event){
        $(event.currentTarget).addClass("active").siblings().removeClass("active");
    },
    clickLink: function(ui, event){
        ui.mixer.loadTrack(event.target.getAttribute('data-target'), $(event.target).text());
        event.stopPropagation();
        $("#track").dropdown('toggle');
    },
    clickPlay: function(ui, event){
        if($("#playback_icon").hasClass("glyphicon-play")){
            ui.mixer.play();
            $("#playback_icon").removeClass("glyphicon-play");
            $("#playback_icon").addClass("glyphicon-pause");
        }
        else{
            ui.mixer.pause();
            $("#playback_icon").removeClass("glyphicon-pause");
            $("#playback_icon").addClass("glyphicon-play");
        }
    },
    doneLoading: function(){
        $("#loading").empty();
    },
    displayTrack: function(name){
        $("#track_name").text(name);
        $("#play_button").removeClass("disabled");
    },
    getThreshold: function(){ return $("#threshold_slider").slider("getValue");},
    getVocals: function(){ return $("#vocals_slider").slider("getValue");},
    getBass: function(){ return $("#bass_slider").slider("getValue");},
    getDrums: function(){ return $("#drums_slider").slider("getValue");},
    predictVocals: function(){ return !$("#vocals_disabled").hasClass("active")},
    predictBass: function(){ return !$("#bass_disabled").hasClass("active")},
    predictDrums: function(){ return !$("#drums_disabled").hasClass("active")},
    drawArray: function(canvas, data) {
        // adapted from https://github.com/cwilso/Audio-Buffer-Draw
        canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
        var step = Math.ceil( data.length / canvas.width );
        var amp = canvas.height / 2;
        for(var i=0; i < canvas.width; i++){
            var min = 1.0;
            var max = -1.0;
            for (var j=0; j<step; j++) {
                var datum = data[(i * step) + j];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }
            canvas.getContext("2d").fillRect(
                i,(1 + min) * amp, 1, Math.max(1, (max - min) * amp)
            );
        }
    }
}
