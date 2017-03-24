"use strict";
process.env.NODE_ENV = 'test';

const _ = require('underscore');
const chai = require('chai');
const expect = chai.expect;
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

const queue = require('../../lib/queue');
const taskProcessor = require('../../lib/taskManager');
const taskHelper = require('../../lib/helpers/task');

describe.skip("Custom Nested", function(){

    it('2 level depth', function() {

        let config = {
            "freqDist": [
                {
                    "target": "fb.author.gender",
                    "threshold": 3,
                    "then": {
                        "target": "fb.type",
                        "threshold": 2
                    }
                }
            ]
        };

        let configTasks = taskProcessor.loadConfigTasks(config);

        return queue.queueRequest(configTasks[0]).then(function(result){

            expect(result[0]).to.have.all.keys(["male", "female", "unknown"]);

            expect(result[0]["male"]).to.be.an('array');
            expect(result[0]["male"]).to.have.length(2);

            expect(result[0]["female"]).to.be.an('array');
            expect(result[0]["female"]).to.have.length(2);

        });
    });


    it('3 level depth', function() {

        let config = {
            "freqDist": [
                {
                    "target": "fb.parent.author.gender",
                    "threshold": 2,
                    "then": {
                        "target": "fb.parent.author.age",
                        "threshold": 2,
                        "then": {
                            "target": "fb.type",
                            "threshold": 2
                        }
                    }
                }
            ]
        };

        let configTasks = taskProcessor.loadConfigTasks(config);

        return queue.queueRequest(configTasks[0]).then(function(result){

            result = taskHelper.compact(result);

            expect(result[0]).to.have.any.keys("male__18-24", "female__18-24",
                "female__25-34", "male__25-34", "female__35-44", "male__35-44");

            let firstKey = Object.keys(result[0])[0];

            expect(result[0][firstKey][0]).to.have.all.keys(["key", "interactions", "unique_authors"]);

        });
    });

});