if (typeof module !== 'undefined' && module.exports) {
    var _ = require("lodash");
    var dsp = require("../lib/dsp.js");
}
else{
    var dsp = window;
}

var STFT = function (WINDOW_SIZE, FFT_SIZE, HOP_SIZE, SR) {
    this.WINDOW_SIZE = WINDOW_SIZE;
    this.FFT_SIZE = FFT_SIZE;
    this.HOP_SIZE = HOP_SIZE;
    this.SR = SR;
    this.window = new dsp.WindowFunction(dsp.DSP.HANN);
    this.fft = new dsp.FFT(FFT_SIZE, SR);
    this.prevBefore =  _.range(0, this.FFT_SIZE, 0); // previous unprocessed buffer 
    this.prevAfter =  _.range(0, this.FFT_SIZE, 0); // previous buffer after processing
};

STFT.prototype = {
    magnitude: function(real, imag){
            return _.map(real, function(val,k){
                return Math.sqrt(Math.pow(val,2)+Math.pow(imag[k],2));
            });
    },
    overlapAdd: function (array, process) {
        var obj = this;
        var overlapWindow = new Float32Array(this.FFT_SIZE);
        overlapWindow.set(
            this.prevBefore.slice(this.HOP_SIZE, this.FFT_SIZE)
        );
        overlapWindow.set(
            array.slice(0, this.HOP_SIZE), 
            this.HOP_SIZE
        );
        overlapWindow = this.window.process(overlapWindow);
        this.fft.forward(overlapWindow);
        var overlapProcessed = process(this.fft.real, this.fft.imag);
        overlapWindow = this.fft.inverse(overlapProcessed.real, overlapProcessed.imag);
        var currentWindow = array.slice(0, this.FFT_SIZE);
        currentWindow = this.window.process(currentWindow);
        this.fft.forward(currentWindow);
        var currentProcessed = process(this.fft.real, this.fft.imag);
        var currentResult = this.fft.inverse(currentProcessed.real, currentProcessed.imag);
        // return the result of the previous window plus overlap
        var result = new Float32Array(this.FFT_SIZE);
        result.set(this.prevAfter); 
        for(var i = 0; i < this.HOP_SIZE; i++){
            result[i+this.HOP_SIZE] += overlapWindow[i];
        }
        // store overlap for future
        this.prevAfter = currentResult;
        for(var i = 0; i < this.HOP_SIZE; i++){
            this.prevAfter[i] += overlapWindow[i+this.HOP_SIZE];
        }
        this.prevBefore = array;
        return result;
    },

    processSegment: function (array, process) {
        this.fft.forward(array);
        process(this.fft.real, this.fft.imag);
        return this.fft.inverse(this.fft.real, this.fft.imag);
    },

    analyze: function (array, process, maxHops) {
        var obj = this;
        var frames = new Array();
        var arrayHops = Math.floor(
            (array.length - this.FFT_SIZE) / parseFloat(this.HOP_SIZE)
        );
        var numHops = Math.min(arrayHops, maxHops);
        var size = Math.round(this.FFT_SIZE /2 ) + 1;
        _.times(numHops,function(n){ 
            var start = n*obj.HOP_SIZE;
            var end = start + obj.FFT_SIZE;
            obj.processSegment(array.slice(start,end),function(real, imag){
                var mag = obj.magnitude(real, imag);
                frames.push(mag.slice(0,size));
            });
         });
        return frames;
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        STFT:STFT
    }
}
