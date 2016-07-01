"use strict";


// optional: use limit analysis to specific country, etc.
const filter = "fb.type exists"; 

// country filter for regional microtargeting - combines wilfter above with a specific country
const country_filter = "(" + filter + ") and fb.author.country_code == \"US\"";

// fill in your tag below
const tag = "interaction.tag_tree.YOUR_TAG"; 

module.exports = {
    "app": {
        "format": "csv",
        "write_to_file": true
        //"log_level": "debug"
    },
    "index": {
        "default": {
            "id": "<RECORDING_ID>",
            "auth": {
                "username": "<USERNNAME>",
                "api_key": "<API_KEY>"
            }
        },
        "baseline": {
            "id": "<RECORDING_ID>",
            "auth": {
                "username": "<USERNNAME>",
                "api_key": "<API_KEY>"
            }
        }
    },

    "analysis": {
        "freqDist": [
        /**
         * Age Gender tornadoes
         */
            {
                "nested_baseline_age_gender":[
                    {
                        "id": "main",
                        "filter":filter,
                        "index": "default",
                        "target": tag,
                        "threshold": 200,
                        "child": {
                            "target": "fb.author.age",
                            "threshold": 6,
                            "child": {
                                "target": "fb.author.gender",
                                "threshold": 6
                            }
                        }
                    },
                    {
                        "id": "baseline",
                        "filter":filter,
                        "index": "baseline",
                        "target": "fb.author.age",
                        "threshold": 6,
                        "child": {
                            "target": "fb.author.gender",
                            "threshold": 6
                        }
                    }
                ]
            },
            /**
             * Geo baseline - region
             */           
            {
                "name": "index_geo_region",
                "filter": country_filter,
                "index": "default",
                "target": tag,
                "threshold": 200,
                "then": {
                    "target": "fb.author.region",
                    "threshold": 200
                }
            },
            {
                "name": "base_geo_region",
                "filter": country_filter,
                "index": "baseline",
                "target": "fb.author.region",
                "threshold": 200
            },
    
         /**
         * Geo baseline - country
         */
            
            {
                "name": "index_geo_country",
                "filter":filter,
                "index": "default",
                "target": tag,
                "threshold": 200,
                "then": {
                    "target": "fb.author.country",
                    "threshold": 200
                }
            },
            {
                "name": "base_geo_country",
                "filter":filter,
                "index": "baseline",
                "target": "fb.author.country",
                "threshold": 200
            }


        ],
        "timeSeries": [
        
        ]
    }
};