// A $( document ).ready() block.
$(document).ready(function () {
    $(".apiMenu").click(function () {
        $('.apiMenu').each(function (i, obj) {
            $(this).removeClass("w3-grey");
        });
        $("#apiSelected").val($(this).data('api-code'));
        $(this).addClass("w3-grey");
    });
});
let conceptIdsRange = {};
function startQC() {
    $('#qcResult').html("starting...");
    // Initialize the engine      
    var lookupMap = {
        "age": "934298480", "gender": "706256705", "race": "849518448", "racesh": "119643471",
        "ethsh": "538553381", "racehf": "684926335", "ethhf": "527823810", "sexkp": "678756255",
        "sexsh": "435027713", "memstatus": "477091792", "cmptype": "667474224",
        "wfhp": "481139103", "autover": "444699761", "outreach": "188797763", "mannual": "953614051",
        "duptype": "148197146", "updatetype": "793822265", "fnamemch": "147176963", "lnamemch": "557461333",
        "dobmch": "725929722", "pinmch": "711794630", "tokenmch": "679832994", "zipmch": "559534463",
        "sitemch": "570452130", "agemch": "629484663", "cstatusmch": "547895941"
    };
    let apiCallPromiseList = [];
    for (var key in lookupMap) {
        if (lookupMap.hasOwnProperty(key)) {
            apiCallPromiseList.push(
                new Promise(function (myResolve, myReject) {
                    // "Producing Code" 
                    var objTemp = {};
                    var temp = "";
                    var keys = "";
                    $.getJSON("https://raw.githubusercontent.com/episphere/conceptGithubActions/master/jsons/" + lookupMap[key] + ".json", function (result) {
                        objTemp = result["Format/Value"];
                        keys = Object.keys(objTemp);
                        console.log('Raw Json keys are ');
                        console.log(keys);
                        range = keys.forEach(deriveConceptId);
                        console.log('Processed Json keys are ');
                        console.log(keys);
                        console.log('Processed keys are in an array? ' + Array.isArray(keys));
                        temp = result["conceptId"];
                        console.log("json conceptId " + temp + " is " + typeof temp);
                        conceptIdsRange["" + temp + ""] = keys;
                        console.log("conceptIdsRange[" + temp + "]->" + conceptIdsRange["" + temp + ""]);
                        console.log("conceptIdsRange[" + temp + "] is an array? " + Array.isArray(conceptIdsRange["" + temp + ""]));
                        // conceptIdsRange[result["conceptId"]]=keys;                       
                        myResolve(); // when successful
                        //myReject();  // when error
                    });
                })
            );

        }
    }

    //start the further process once all the promises resolved
    Promise.all(apiCallPromiseList).then(
        function (value) { processInputMessage(); },
        function (error) { /* code if some error */ }
    );
}



/**
 * Derive the list of conceptIds for "format/value" from meta data json received 
 * @param {*} item 
 * @param {*} index 
 * @param {*} arr 
 */
function deriveConceptId(item, index, arr) {
    var pos = item.indexOf(".json");
    arr[index] = item.substring(0, pos);
    arr[index] = parseInt(arr[index]);
}


/**
 * Help to get start the QC Process with input message
 */
function processInputMessage() {
    //Assume all the initializtion is done at time point.
    console.log("Final :: " + JSON.stringify(conceptIdsRange));
    // start the engine   
    // objData eventually will be replaced by the real API data
    var conceptIDs = Object.keys(conceptIdsRange);

    console.log("conceptIds :: " + conceptIDs);
    var inputJSONObj = $("#inputJSON").val();
    var apiSelected = $("#apiSelected").val();
    console.log(inputJSONObj);
    try {
        var objData = JSON.parse(inputJSONObj);
    } catch (exception) {
        $('#qcResult').html(exception);
        return 1;
    }
    data = objData["data"];
    var txt = "";

    //TODO  - validate object size based on apiSelected
    if (apiSelected == 0 && objData.data.length > 1000) {
        txt += 'The maximum limit allowed for the GetParticipantToken API is 1000' + "<br>";
        txt += '_____________________________________________' + "<br>";
    } else if (apiSelected == 1 && objData.data.length > 500) {
        txt += 'The maximum limit allowed for the submitParticipantsData API is 500' + "<br>";
        txt += '_____________________________________________' + "<br>";
    } else if (apiSelected == 2 && objData.data.length > 1) {
        txt += 'The updateParticipantData API only allow one record' + "<br>";
        txt += '_____________________________________________' + "<br>";
    }
    //below is to deal with individual persons {}  
    if (apiSelected <= 1) { // for 
        for (var j = 0; j < objData.data.length; j++) {
            keys = Object.keys(data[j]);
            //studyID is only for getParticpantToken(apiSelected=0)          
            studyidIncd = keys.includes('studyId');
            //token is for submit/updateParticipantData(apiSelect is 1 or 2) 
            tokenIncd = keys.includes('token');
            if (!tokenIncd && apiSelected == 1) {
                txt += 'Token should be included in to the submitParticipantsData API' + "<br>";
            }
            //go through every element for individual person with in {}
            for (var i = 0; i < keys.length; i++) {
                var type = typeof data[j][keys[i]];
                if (keys[i] == 'studyId') {
                    if (type !== 'string') {
                        txt += keys[i] + ": " + data[j][keys[i]] + ' should be a string' + "<br>";
                    } else if (data[j][keys[i]].startsWith("0")) {
                        txt += keys[i] + ': ' + data[j][keys[i]] + ' should not start with 0' + "<br>";
                    } else {
                        txt += keys[i] + ": " + data[j][keys[i]] + ' is good to go' + "<br>";
                    }
                    // token and NCI version
                } else if (keys[i] == 'token' || keys[i] == '749475364') {
                    // not allowed in getParticipantToken
                    if (apiSelected == 0) {
                        txt += keys[i] + ': ' + data[j][keys[i]] + ' not a vaild value to send through getParticipantToken' + "<br>";
                    } else if (type == 'string') {
                        txt += keys[i] + ': ' + data[j][keys[i]] + ' is good to go' + "<br>";
                    } else {
                        txt += keys[i] + ': ' + data[j][keys[i]] + ' should be a string ' + "<br>";
                    }
                    //integer check
                } else {
                    // not allowed in getParticipantToken
                    if (apiSelected == 0) {
                        txt += keys[i] + ': ' + data[j][keys[i]] + ' not a vaild value to send through getParticipantToken' + "<br>";
                    } else if (data[j][keys[i]] == undefined) {
                        txt += keys[i] + ': ' + data[j][keys[i]] + ' missing' + "<br>";
                    } else if (type !== 'number') {
                        txt += keys[i] + ': ' + data[j][keys[i]] + ' should be an integer type' + "<br>";
                    } else if (conceptIDs.indexOf(keys[i]) !== -1 && !(conceptIdsRange[keys[i]].includes(data[j][keys[i]]))) {
                        txt += keys[i] + ':' + data[j][keys[i]] + ' out of range' + "<br>";
                    } else {
                        txt += keys[i] + ':' + data[j][keys[i]] + ' is good to go' + "<br>";
                    }
                }
            }
            txt += '_____________________________________________' + "<br>";
        }
    }

    //TODO- ApiSlect 2 
    if (apiSelected == 2) {
        keys = Object.keys(data);
        if (keys.length > 2) {
            txt += 'There are only 2 elements - token and state allowed inside the data element for the updateParticipantData API' + "<br>";
            txt += '_____________________________________________' + "<br>";
        } else if (!(keys.includes('token')) | !(keys.includes('state'))) {
            txt += 'The updateParticipantData API must include both token and state elements' + "<br>";
            txt += '_____________________________________________' + "<br>";
        } else if (data['token']) {
            var type = typeof data['token'];
            if (type == 'string') {
                txt += 'Token: ' + data['token'] + ' is good to go' + "<br>";
                txt += '_____________________________________________' + "<br>";
            } else {
                txt += 'Token: ' + data['token'] + ' should be an integer type' + "<br>";
                txt += '_____________________________________________' + "<br>";
            }
        }
        if (data['state']) {
            txt += 'Below is data check for the state property:' + "<br>" + "<br>";
            var stateObj = data['state'];
            stateKeys = Object.keys(data['state']);
            for (var m = 0; m < stateKeys.length; m++) {
                var stateType = typeof data['state'][stateKeys[m]];
                if (stateKeys[m] == 'studyId') {
                    if (stateType !== 'string') {
                        txt += stateKeys[m] + ": " + data['state'][stateKeys[m]] + ' should be a string' + "<br>";
                    } else if (data['state'][stateKeys[m]].startsWith("0")) {
                        txt += stateKeys[m] + ': ' + data['state'][stateKeys[m]] + ' should not start with 0' + "<br>";
                    } else {
                        txt += stateKeys[m] + ": " + data['state'][stateKeys[m]] + ' is good to go' + "<br>";
                    }
                } else if (stateKeys[m] == '749475364') {// NCI version
                    if (stateType == 'string') {
                        txt += stateKeys[m] + ': ' + data['state'][stateKeys[m]] + ' is good to go' + "<br>";
                    } else {
                        txt += stateKeys[m] + ': ' + data['state'][stateKeys[m]] + ' should be a string ' + "<br>";
                    }
                } else if (stateKeys[m] == 'token') {
                    txt += '"token" is not supposed to show up in "state"' + "<br>";

                } else {//integer check
                    if (data['state'][stateKeys[m]] == undefined) {
                        txt += stateKeys[m] + ': ' + data['state'][stateKeys[m]] + ' missing' + "<br>";
                    } else if (stateType !== 'number') {
                        txt += stateKeys[m] + ': ' + data['state'][stateKeys[m]] + ' should be an integer type' + "<br>";
                    } else if (conceptIDs.indexOf(stateKeys[m]) !== -1 && !(conceptIdsRange[stateKeys[m]].includes(data['state'][stateKeys[m]]))) {
                        txt += stateKeys[m] + ':' + data['state'][stateKeys[m]] + ' out of range' + "<br>";
                    } else {
                        txt += stateKeys[m] + ':' + data['state'][stateKeys[m]] + ' is good to go' + "<br>";
                    }
                }
            }
        }
    }


    $('#qcResult').html(txt);
    return 0;
}

