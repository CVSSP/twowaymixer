/* trainModel.js
 *
 * Written by Gerard Roma
 * Copyright (C) 2016 University of Surrey
 * All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the BSD license.  See the LICENSE file for details.
 */

var fs = require("fs");
var convnetjs = require("../common/convnet.js");
var JSONStream = require('JSONStream');

var nIter = 10;
var ftrSize = 513;
var nFrames = 1000;
var nTrain = 90;

var instrument = process.argv[2];

var basePath = "/data/path/";
var ftrPath = basePath + "features/";
var masksPath = basePath +"masks/" + instrument+"/";
var netsPath = basePath +"/nets/";


var X = new Array();
var Y = new Array();
var network;

var defineNetwork = function(){
    var layer_defs = [];
    layer_defs.push({type:'input', out_sx:1, out_sy:1, out_depth:ftrSize});
    layer_defs.push({type:'fc', num_neurons:ftrSize, activation:'sigmoid'});
    layer_defs.push({type:'regression', num_neurons:ftrSize}); 
    var net = new convnetjs.Net();
    net.makeLayers(layer_defs);
    return net;
};


var collectTrainingData = function(){
    for(var i = 0;i < nTrain; i ++){
        features = require(ftrPath+i+".json");
        mask = require(masksPath + i + "_" + instrument + "_" + "mask.json");
        for(var j = 0;j < nFrames; j ++){
            X.push(new convnetjs.Vol(features[j]));
            Y.push(mask[j]);
        }
    }
}


var trainNN = function(net){
    var batchSize = 200;
    var N = X.length;
    var trainer = new convnetjs.Trainer(net, {method: 'adadelta', l2_decay: 0.001,
        batch_size: batchSize});
    for (var k = 0; k< nIter; k++){
            console.log("training... "+k);
            var startTime = new Date();
            var loss = 0.0;
            for (var i = 0; i< N; i++){
                var out = trainer.train(X[i], Y[i]);
                loss = loss + out.loss;
            }
            loss = loss / N;
            var endTime = new Date();
            console.log("elapsed " + (endTime - startTime)/1000.0);
            console.log(loss);
        }
        return net;
};

collectTrainingData();
network = defineNetwork();
network = trainNN(network);
var jsonS = JSON.stringify(network.toJSON());
fs.writeFileSync(netsPath+instrument+"_net.json",jsonS);
