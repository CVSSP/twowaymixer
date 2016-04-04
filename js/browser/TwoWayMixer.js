/* TwoWayMixer.js
 *
 * Written by Gerard Roma
 * Copyright (C) 2016 University of Surrey
 * All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the BSD license. See the LICENSE file for details.
 */

var drumsNetURL = "networks/drums_net.json";
var bassNetURL = "networks/bass_net.json";
var vocalsNetURL = "networks/vocals_net.json";

var TwoWayMixer = function(sampleRate, fftSize, nFFTs){
    var mixer = this;
    this.sampleRate = sampleRate;
    this.fftSize = fftSize;
    this.nFFTs = nFFTs;
    this.stft = new STFT(fftSize, fftSize, fftSize/2, this.sampleRate);
    this.context = new AudioContext();
    this.scriptNode = this.context.createScriptProcessor(nFFTs * fftSize, 1, 1);
    this.scriptNode.connect(this.context.destination);
    this.scriptNode.onaudioprocess = function(e){mixer.process(mixer,e)};
    this.ones = _.fill(Array(fftSize/2), 1.0);
    this.zeros = _.fill(Array(fftSize/2), 0.0);
    this.buffer = null;
    this.elapsed = 0;
    this.nets = {};
    this.prevMasks = [];
    this.nPrevMasks = 20;
    this.ui = new TwoWayMixerUI(this);
    this.source = this.context.createBufferSource();
    this.loadNets();
}

TwoWayMixer.prototype = {
    loadNets: function(){
        var mixer = this;
        $.getJSON(drumsNetURL, function (data) {
            var net = new convnetjs.Net(); 
            net.fromJSON(data);
            mixer.nets.drums = net;
            mixer.checkLoaded();
        });

        $.getJSON(bassNetURL, function (data) {
            var net = new convnetjs.Net(); 
            net.fromJSON(data);
            net["norm"] = data["norm"];
            mixer.nets.bass = net;
            mixer.checkLoaded();
        });

        $.getJSON(vocalsNetURL, function (data) {
            var net = new convnetjs.Net(); 
            net.fromJSON(data);
            net["norm"] = data["norm"];
            mixer.nets.vocals = net;
            mixer.checkLoaded();
        });
    },

    checkLoaded:function(){
        if(this.nets.drums &&
            this.nets.bass &&
            this.nets.vocals){
                this.ui.doneLoading();
            }
    },

    play: function(){
        if(this.source.PLAYING){this.source.stop()};
        this.source = this.context.createBufferSource();
        this.source.buffer = this.buffer;
        this.source.connect(this.scriptNode);
        this.source.PLAYING = true;
        this.source.onended = function(){this.source.PLAYING = false};
        this.source.start(0, this.elapsed);
        this.source.startTime = this.context.currentTime;
    },

    pause: function(){
          this.elapsed = this.context.currentTime - this.source.startTime;
          this.source.stop();
    },

    loadTrack: function(url, name){
        if(!(this.nets.drums && 
            this.nets.bass && 
            this.nets.vocals)){return}
        var request = new XMLHttpRequest();
        var mixer = this;
        request.open('GET', url , true);
        request.responseType = 'arraybuffer';
        request.onload = function () {
            var audioData = request.response;
            mixer.context.decodeAudioData(audioData, 
                function (buffer) {
                    mixer.buffer = buffer;
                    mixer.elapsed = 0;
                    mixer.ui.displayTrack(name);
                },
                function (e) {
                    console.log("Error decoding audio data" + e.err)
                });
        };
        request.send();
        return false;
    },
    normalizeMask: function(mask){
        var maskMax = _.max(mask);
        var maskMin = _.min(mask);
        return _.map(mask, function(element){return (element - maskMin)/ maskMax });
    },
    smoothMask: function(mask){
        this.prevMasks.push(mask);
        if(this.prevMasks.length > this.nPrevMasks) this.prevMasks.shift();

        var smoothed = new Float32Array(mask.length);
        for(var i = 0;i<mask.length;i++){
            var sum = 0;
            var div = 1.0 / this.prevMasks.length;
            for(var j = 0;j<this.prevMasks.length;j++){
                sum += this.prevMasks[j][i];
            }
            smoothed[i] = sum * div;
        }
        return smoothed;
    },

    poolMasks: function(predictions){  
        var newMask = this.ones.slice();
        var drumsLevel = this.ui.getDrums();
        var bassLevel = this.ui.getBass();
        var vocalsLevel = this.ui.getVocals();
        var thresholdLevel = this.ui.getThreshold();
        for (var i = 0; i < (this.fftSize/2); i++) {
            var maxMask= Math.max(
                predictions.drums[i], 
                predictions.vocals[i], 
                predictions.bass[i]
            );
            if(maxMask > thresholdLevel){
                if (maxMask == predictions.drums[i]) {
                    newMask[i] = drumsLevel;
                }
                else if (maxMask == predictions.bass[i]) {
                    newMask[i] = bassLevel;
                }
                else {
                    newMask[i] = vocalsLevel;
                }
            }
        }
        return newMask
    },

    getMask: function(real,imag){
        var mag = this.stft.magnitude(real, imag);
        var vol = new convnetjs.Vol(mag);
        var bassF, vocalsF, drumsF;
        var predictions = {vocals:this.zeros,drums:this.zeros,bass:this.zeros}
        var finalMask = this.ones.slice();
        var allInactive = true;
        if(this.ui.predictVocals()) {
            vocalsF = this.nets.vocals.forward(vol);
            predictions.vocals=this.normalizeMask(vocalsF.w);
            allInactive = false;
        }
        if(this.ui.predictDrums()) {
            drumsF = this.nets.drums.forward(vol);
            predictions.drums = this.normalizeMask(drumsF.w);
            allInactive = false;
        };
        if(this.ui.predictBass()) {
            bassF = this.nets.bass.forward(vol);
            predictions.bass = this.normalizeMask(bassF.w);
            allInactive = false;
        }
        if(!allInactive){
            finalMask = this.poolMasks(predictions);
        }
        debugger;
        finalMask = this.smoothMask(finalMask);
        return finalMask;
    },

    applyMaskFunc: function(mxr){
        var mixer = mxr;
        var hopSize = mixer.fftSize/2;
        return function(real, imag){
              var mask = mixer.getMask(real, imag);
              for (var i = 0; i < (hopSize); i++) {
                real[i] *= mask[i];
                imag[i] *= mask[i];
              }
              for (var i = mixer.fftSize/2; i < mixer.fftSize; i++) {
                 maskIdx = (mixer.fftSize/2) - (i - hopSize) -1;
                 real[i] *= mask[maskIdx];
                 imag[i] *= mask[maskIdx];
              }
              return {"real":real,"imag":imag}
        }
    },

    process: function(mixer, event){
        var channel = 0;
        var inputData = event.inputBuffer.getChannelData(channel);
        var outputData = event.outputBuffer.getChannelData(channel);
        var buf = new Float32Array(inputData.length); 
        for (var i=0; i < inputData.length;i++) buf[i] = inputData[i];
        var result = new Float32Array(inputData.length);
        for (var i=0; i < mixer.nFFTs;i++){
            result.set(mixer.stft.overlapAdd(
                inputData.slice(i * this.fftSize, (i+1) * mixer.fftSize), 
                mixer.applyMaskFunc(mixer)
                ), i * mixer.fftSize);
        }
        for (var sample = 0; sample < event.inputBuffer.length; sample++) {
            outputData[sample] = result[sample];
        }
    }
};