/* computeMask.js
 *
 * Written by Gerard Roma
 * Copyright (C) 2016 University of Surrey
 * All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the BSD license.  See the LICENSE file for details.
 */

var fs = require("fs");
var stftjs = require("../common/stft.js");
var dsp = require("../common/dsp.js");
var WavDecoder = require("wav-decoder");
var audioSamples;
var stft = new stftjs.stft(1024, 1024, 512, 44100);

var instrument = process.argv[2];
var songId = process.argv[3];
var dataset = require("msd100_" + instrument + ".json");
var destPath = "/path/to/data/";
var targetMag, otherMag, mask;
var maxFrames = 1000;
var frameSize = 513;

var sumArrays = function(arrays) {
    var num = arrays.length;
    var size = arrays[0].length;
    var result = new Float32Array(size);
    for (var i = 0; i < size; i++) {
        var resultSample = 0;
        for (var j = 0; j < num; j++) {
            resultSample = resultSample + arrays[j][i];
        }
        result[i] = resultSample;
    }
    return result;
};

var getFirstChannel = function(arr) {
    if (arr.length > 4) return arr;
    else return arr[0];
};


var analyzeTarget = function(doneFunc) {
    return function() {
        var filePath = dataset.base_path + dataset.mixes[songId].target_stems[0];
        var target = fs.readFileSync(filePath);
        WavDecoder.decode(target).then(function(audioData) {
            targetMag = stft.analyze(
                getFirstChannel(audioData.channelData),
                stft.magnitude,
                maxFrames);
            doneFunc();
        });
    }
};

var analyzeOther = function(doneFunc) {
    return function() {
        var other_stems = dataset.mixes[songId].other_stems;
        var other = new Array();
        for (var i = 0; i < other_stems.length; i++) {
            var filePath = dataset.base_path + other_stems[i];
            var buf = fs.readFileSync(filePath);
            WavDecoder.decode(buf).then(function(audioData) {
                var data = getFirstChannel(audioData.channelData);
                other.push(data);
                if (other.length == other_stems.length) {
                    mix = sumArrays(other);
                    otherMag = stft.analyze(
                        mix,
                        stft.magnitude,
                        maxFrames
                    );
                    doneFunc();
                }
            });
        }
    }
};

var computeMask = function(doneFunc) {
    return function() {
        mask = new Array();
        for (var i = 0; i < maxFrames; i++) {
            var maskFrame = new Array(frameSize);
            for (var j = 0; j < frameSize; j++) {
                maskFrame[j] = targetMag[i][j] / (targetMag[i][j] + otherMag[i][j] + Number.MIN_VALUE);
            }
            mask.push(maskFrame);
        }
        doneFunc();
    }
};

var storeMask = function() {
    return function() {
        var maskFilename = songId + "_" + instrument + "_mask.json"
        var jsonPath = destPath + instrument + "/" + maskFilename;
        var jsonS = JSON.stringify(mask);
        fs.writeFileSync(jsonPath, jsonS);
    }
};

process.on('uncaughtException', function (err) {
  console.log(err);
});

analyzeTarget(analyzeOther(computeMask(storeMask())))();