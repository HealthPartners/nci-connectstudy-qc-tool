const http = require('http');
const https = require('https');
const NodeCache = require( "node-cache" );
const localAppCache = new NodeCache( { stdTTL: 86400} ); // one day app cache data clearance
 
//localAppCache.flushAll(); //remove all the cache
const hostname = '127.0.0.1';
const port = 3000;

let conceptIdsRange = {};
let qcErrorCount = 0;
let qcMessage = [];

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
 * utility function to check if object is empty 
 */
function isEmptyObject( obj ) {
    var item;
    for ( item in obj ) {
        return false;
    }
    return true;
}

function qcReturnMessage() {
    return { 'errorCount' : qcErrorCount , 'message' : JSON.stringify(qcMessage.toString())};
}

/**
 * Start the QC Process
 * @param {*} req 
 * @param {*} res 
 * @param {*} inputData 
 */

function startQC(req, res, inputData) {
    //$('#qcResult').html("starting...");
    // Initialize the engine      
    var lookupMap = {
        "age": "934298480", "gender": "706256705", "race": "849518448", "racesh": "119643471",
        "ethsh": "538553381", "racehf": "684926335", "ethhf": "527823810", "sexkp": "678756255",
        "sexsh": "435027713", "memstatus": "477091792", "cmptype": "667474224",
        "wfhp": "481139103", "autover": "444699761", "outreach": "188797763", "mannual": "953614051",
        "duptype": "148197146", "updatetype": "793822265", "fnamemch": "147176963", "lnamemch": "557461333",
        "dobmch": "725929722", "pinmch": "711794630", "tokenmch": "679832994", "zipmch": "559534463",
        "sitemch": "570452130", "agemch": "629484663", "cstatusmch": "547895941", "sopMaxNum": "875549268",
        "preOptOut": "158291096", "notIntrstd": "196038514", "tooBusy": "873405723", "privacy": "517101990",
        "tooManyCtct": "347614743", "notCmpltAct": "535928798", "notJoinOth": "897366187", "notImptnt": "719451909",
        "noDesire": "377633816", "noLongTerm": "211023960", "tooMuchTime": "209509101", "noBio": "363026564",
        "lowPay": "405352246", "notElig": "755545718", "noGntc": "831137710", "tooSick": "496935183",
        "noInt": "491099823", "noLine": "836460125", "worry": "163534562", "infoOnline": "331787113",
        "noSurvey": "705732561", "noAccs": "381509125", "noGov": "497530905", "noTrust": "627995442",
        "noShare": "208102461", "noSecurity": "579618065", "insurance": "702433259", "employer": "771146804",
        "discrim": "163284008", "profit": "387198193", "othPriCon": "566047367", "covid": "400259098",
        "refuse": "260703126", "unable": "744197145", "noReason": "950040334"
    };
    let apiCallPromiseList = [];
    if(localAppCache.has('conceptIdsRange')){
        conceptIdsRange = localAppCache.get('conceptIdsRange');
    } else { 
    for (var key in lookupMap) {
        if (lookupMap.hasOwnProperty(key)) {
            apiCallPromiseList.push(
                new Promise(function (myResolve, myReject) {
                    // "Producing Code" 
                    var objTemp = {};
                    var temp = "";
                    var keys = "";
                    https.get("https://raw.githubusercontent.com/episphere/conceptGithubActions/master/jsons/" + lookupMap[key] + ".json", (resp) => {
                        let data = '';

                        // A chunk of data has been received.
                        resp.on('data', (chunk) => {
                            data += chunk;
                        });

                        // The whole response has been received. Print out the result.
                        resp.on('end', () => {
                            console.log(data);
                            result = JSON.parse(data);
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
                            if (!isEmptyObject(conceptIdsRange)) {
                                localAppCache.set('conceptIdsRange', conceptIdsRange)
                            }  
                            //myReject();  // when error
                        });

                        }).on("error", (err) => {
                        console.log("Error: " + err.message);
                    });
                })
            );

        }
    }
}

    //start the further process once all the promises resolved
    Promise.all(apiCallPromiseList).then(
        function (value) { 
            initiateProcess(req, res, inputData);
        },
        function (error) { /* code if some error */ }
    );


}


function initiateProcess(req, res, inputData){
    var path = req.url;
    var apiSelected =  0;
    if (path == "/getParticipantToken") {
        apiSelected = 0;
    } else if (path == "/submitParticipantsData") {
        apiSelected = 1;
    } else if (path == "/updateParticipantData") {
        apiSelected = 2;
    }
    processInputMessage(req, res, inputData, apiSelected);

    res.end(JSON.stringify(qcReturnMessage()));
}

/**
 * Help to get start the QC Process with input message
 */
function processInputMessage(req, res, inputData, apiSelected) {
    qcErrorCount = 0;
    qcMessage = [];
    var conceptIDs = Object.keys(conceptIdsRange);
    try {
        var objData = JSON.parse(inputData);
    } catch (exception) {
        qcErrorCount++;
        qcMessage.push(exception);
        return 1;
    }

    //check JSON object should has  data element
    var txt = "";
    if (isEmptyObject(objData)) {
        txt += '<span style="color:red">The JSON object is empty</span>' + "<br>";
        txt += '_____________________________________________' + "<br>";
        //$('#qcResult').html(txt);
        qcErrorCount++;
        qcMessage.pop();
        qcMessage.push(txt);
        return { error: true }
    } else {
        if (objData.hasOwnProperty('data')) {
            data = objData["data"];
        } else {
            txt += '<span style="color:red">The JSON object should has the "data" element</span>' + "<br>";
            txt += '_____________________________________________' + "<br>";
            //$('#qcResult').html(txt);
            qcErrorCount++;
            qcMessage.pop();
            qcMessage.push(txt);
            return { error: true }
        }
    }
    //check JSON object.data return type.    
    if (Array.isArray(data) && apiSelected == 2) {
        txt += '<span style="color:red">The data element should has an object type</span>' + "<br>";
        qcErrorCount++;
        qcMessage.pop();
        qcMessage.push(txt);
        //$('#qcResult').html(txt);
        return { error: true }
    } else if (!(Array.isArray(data)) && apiSelected <= 1) {
        txt += '<span style="color:red">The data element should has an array type</span>' + "<br>";
        qcErrorCount++;
        qcMessage.pop();
        qcMessage.push(txt);
        //$('#qcResult').html(txt);
        return { error: true }
    }
    //TODO  - validate object size based on apiSelected
    if (apiSelected == 0 && objData.data.length > 1000) {
        txt += '<span style="color:red">The maximum limit allowed for the GetParticipantToken API is 1000</span>' + "<br>";
        txt += '_____________________________________________' + "<br>";
        qcErrorCount++;
        qcMessage.pop();
        qcMessage.push(txt);
        //$('#qcResult').html(txt);
        return { error: true }
    } else if (apiSelected == 0 && objData.data.length == 0) {
        console.log("check array length " + objData.data.length);
        txt += '<span style="color:red">GetParticipantToken must only have the studyID element</span>' + "<br>";
        txt += '_____________________________________________' + "<br>";
        //$('#qcResult').html(txt);
        qcErrorCount++;
        qcMessage.pop();
        qcMessage.push(txt);
        return { error: true }
    } else if (apiSelected == 1 && objData.data.length > 500) {
        txt += '<span style="color:red">The maximum limit allowed for the submitParticipantsData API is 500</span>' + "<br>";
        txt += '_____________________________________________' + "<br>";
        //$('#qcResult').html(txt);
        qcErrorCount++;
        qcMessage.pop();
        qcMessage.push(txt);
        return { error: true }
    } else if (apiSelected == 1 && objData.data.length == 0) {
        txt += '<span style="color:red">JSON data array must have at least one record</span>' + "<br>";
        txt += '_____________________________________________' + "<br>";
        qcErrorCount++;
        qcMessage.pop();
        qcMessage.push(txt);
        //$('#qcResult').html(txt);
        return { error: true }
    } else if (apiSelected == 2 && (typeof objData.data !== 'object')) {
        console.log(typeof objData.data);
        txt += '<span style="color:red">The data element must be an object</span>' + "<br>";
        txt += '_____________________________________________' + "<br>";
        //$('#qcResult').html(txt);
        qcErrorCount++;
        qcMessage.pop();
        qcMessage.push(txt);
        return { error: true }
    } else if (apiSelected == 2 && isEmptyObject(objData.data)) {
        console.log("check " + isEmptyObject(objData.data));
        txt += '<span style="color:red">The data element must have token and state elements</span>' + "<br>";
        txt += '_____________________________________________' + "<br>";
        //$('#qcResult').html(txt);
        qcErrorCount++;
        qcMessage.pop();
        qcMessage.push(txt);
        return { error: true }
    }

    //below is to deal with individual persons {}  
    if (apiSelected <= 1) { // for 
        for (var j = 0; j < objData.data.length; j++) {
            if (typeof data[j] !== 'object') {
                txt += '<span style="color:red">The elements inside the data array must be objects</span>' + "<br>";
                //$('#qcResult').html(txt);
                qcErrorCount++;
                qcMessage.pop();
                qcMessage.push(txt);
                return { error: true }
            }

            keys = Object.keys(data[j]);
            //studyID is only for getParticpantToken(apiSelected=0)          
            studyidIncd = keys.includes('studyId');
            if ((!studyidIncd && apiSelected == 0) | (keys.length > 1 && apiSelected == 0)) {
                txt += '<span style="color:red">studyId is the only element that can be included in getParticipantToken</span>' + "<br>";
                qcErrorCount++;
                qcMessage.pop();
                qcMessage.push(txt);
            }
            //token is for submit/updateParticipantData(apiSelect is 1 or 2) 
            tokenIncd = keys.includes('token');
            if (!tokenIncd && apiSelected == 1) {
                txt += '<span style="color:red">Token should be included in the submitParticipantsData API</span>' + "<br>";
                qcErrorCount++;
                qcMessage.pop();
                qcMessage.push(txt);
            }
            //go through every element for individual person with in {}
            for (var i = 0; i < keys.length; i++) {
                var type = typeof data[j][keys[i]];
                if (keys[i] == 'studyId') {
                    if (type !== 'string') {
                        txt += '<span style="color:red">' + keys[i] + ": " + data[j][keys[i]] + ' should be a string</span>' + "<br>";
                        qcErrorCount++;
                        qcMessage.pop();
                        qcMessage.push(txt);
                    } else if (data[j][keys[i]].startsWith("0")) {
                        txt += '<span style="color:red">' + keys[i] + ': ' + data[j][keys[i]] + ' should not start with 0</span>' + "<br>";
                        qcErrorCount++;
                        qcMessage.pop();
                        qcMessage.push(txt);
                    } else {
                        txt += keys[i] + ": " + data[j][keys[i]] + ' is good to go' + "<br>";
                        qcMessage.pop();
                        qcMessage.push(txt);
                    }
                    // token and NCI version and Please specify 
                } else if (keys[i] == 'token' || keys[i] == '749475364' || keys[i] == '415693436') {//per Vijay request on Jun 18, 2021
                    // not allowed in getParticipantToken
                    if (apiSelected == 0) {
                        txt += '<span style="color:red">' + keys[i] + ': ' + data[j][keys[i]] + ' not a vaild value to send through getParticipantToken</span>' + "<br>";
                        qcErrorCount++;
                        qcMessage.pop();
                        qcMessage.push(txt);
                    } else if (type == 'string') {
                        txt += keys[i] + ': ' + data[j][keys[i]] + ' is good to go' + "<br>";
                        qcMessage.pop();
                        qcMessage.push(txt);
                    } else {
                        txt += '<span style="color:red">' + keys[i] + ': ' + data[j][keys[i]] + ' should be a string</span>' + "<br>";
                        qcErrorCount++;
                        qcMessage.pop();
                        qcMessage.push(txt);
                    }
                } else {//integer check
                    // not allowed in getParticipantToken
                    if (apiSelected == 0) {
                        txt += '<span style="color:red">' + keys[i] + ': ' + data[j][keys[i]] + ' not a vaild value to send through getParticipantToken</span>' + "<br>";
                        qcErrorCount++;
                        qcMessage.pop();
                        qcMessage.push(txt);
                    } else if (keys[i] == '158291096' || keys[i] == '875549268') {//per Vijay request on Jun 25, 2021
                        txt += '<span style="color:red">' + keys[i] + ': ' + data[j][keys[i]] + ' not a vaild value to send through submitParticipantsData. Only allowed through updateParticipantData</span>' + "<br>";
                        qcErrorCount++;
                        qcMessage.pop();
                        qcMessage.push(txt);
                    } else if (data[j][keys[i]] == undefined) {
                        txt += '<span style="color:red">' + keys[i] + ': ' + data[j][keys[i]] + ' missing</span>' + "<br>";
                        qcErrorCount++;
                        qcMessage.pop();
                        qcMessage.push(txt);
                    } else if (type !== 'number') {
                        txt += '<span style="color:red">' + keys[i] + ': ' + data[j][keys[i]] + ' should be an integer type</span>' + "<br>";
                        qcErrorCount++;
                        qcMessage.pop();
                        qcMessage.push(txt);
                    } else if (conceptIDs.indexOf(keys[i]) !== -1 && !(conceptIdsRange[keys[i]].includes(data[j][keys[i]]))) {
                        txt += '<span style="color:red">' + keys[i] + ':' + data[j][keys[i]] + ' out of range</span>' + "<br>";
                        qcErrorCount++;
                        qcMessage.pop();
                        qcMessage.push(txt);
                    } else {
                        txt += keys[i] + ':' + data[j][keys[i]] + ' is good to go' + "<br>";
                        qcMessage.pop();
                        qcMessage.push(txt);
                    }
                }
            }
            txt += '_____________________________________________' + "<br>";
            qcMessage.pop();
            qcMessage.push(txt);
        }
    }

    //TODO- ApiSlect 2 
    if (apiSelected == 2) {
        keys = Object.keys(data);
        if (keys.length > 2) {
            txt += '<span style="color:red">There are only 2 elements - token and state allowed inside the data element for the updateParticipantData API</span>' + "<br>";
            txt += '_____________________________________________' + "<br>";
            qcErrorCount++;
            qcMessage.pop();
            qcMessage.push(txt);
        } else if (!(keys.includes('token')) | !(keys.includes('state'))) {
            txt += '<span style="color:red">The data element must include both token and state elements</span>' + "<br>";
            txt += '_____________________________________________' + "<br>";
            qcErrorCount++;
            qcMessage.pop();
            qcMessage.push(txt);
        } else if (data['token']) {
            var type = typeof data['token'];
            if (type == 'string') {
                txt += 'Token: ' + data['token'] + ' is good to go' + "<br>";
                txt += '_____________________________________________' + "<br>";
                qcMessage.pop();
                qcMessage.push(txt);
            } else {
                txt += '<span style="color:red">Token: ' + data['token'] + ' should be a string</span>' + "<br>";
                txt += '_____________________________________________' + "<br>";
                qcErrorCount++;
                qcMessage.pop();
                qcMessage.push(txt);
            }
        }
        if ((typeof data['state'] == 'object' && Array.isArray(data['state'])) | (typeof data['state'] !== 'object')) {
            txt += '<span style="color:red">The state element must be an object</span>' + "<br>";
            txt += '_____________________________________________' + "<br>";
            qcErrorCount++;
            qcMessage.pop();
            qcMessage.push(txt);
            //$('#qcResult').html(txt);
            return { error: true }
        }
        if (typeof data['state'] == 'object' && !(Array.isArray(data['state']))) {
            if (isEmptyObject(objData.data['state'])) {
                txt += '<span style="color:red">The state element must have one at least one record</span>' + "<br>";
                txt += '_____________________________________________' + "<br>";
                //$('#qcResult').html(txt);
                qcErrorCount++;
                qcMessage.pop();
                qcMessage.push(txt);
                return { error: true }
            }
            txt += 'Below is data check for the state property:' + "<br>" + "<br>";
            qcMessage.pop();
            qcMessage.push(txt);
            var stateObj = data['state'];
            stateKeys = Object.keys(data['state']);
            for (var m = 0; m < stateKeys.length; m++) {
                var stateType = typeof data['state'][stateKeys[m]];
                if (stateKeys[m] == 'studyId') {
                    if (stateType !== 'string') {
                        txt += '<span style="color:red">' + stateKeys[m] + ": " + data['state'][stateKeys[m]] + ' should be a string</span>' + "<br>";
                        qcErrorCount++;
                        qcMessage.pop();
                        qcMessage.push(txt);
                    } else if (data['state'][stateKeys[m]].startsWith("0")) {
                        txt += '<span style="color:red">' + stateKeys[m] + ': ' + data['state'][stateKeys[m]] + ' should not start with 0</span>' + "<br>";
                        qcErrorCount++;
                        qcMessage.pop();
                        qcMessage.push(txt);
                    } else {
                        txt += stateKeys[m] + ": " + data['state'][stateKeys[m]] + ' is good to go' + "<br>";
                        qcMessage.pop();
                        qcMessage.push(txt);
                    }
                } else if (stateKeys[m] == '749475364' || stateKeys[m] == '415693436') {// NCI version or please specify. Per Vijay on Jun 18, 2021
                    if (stateType == 'string') {
                        txt += stateKeys[m] + ': ' + data['state'][stateKeys[m]] + ' is good to go' + "<br>";
                        qcMessage.pop();
                        qcMessage.push(txt);
                    } else {
                        txt += '<span style="color:red">' + stateKeys[m] + ': ' + data['state'][stateKeys[m]] + ' should be a string</span>' + "<br>";
                        qcErrorCount++;
                        qcMessage.pop();
                        qcMessage.push(txt);
                    }
                } else if (stateKeys[m] == 'token') {
                    txt += '<span style="color:red">"token" is not supposed to show up in "state"</span>' + "<br>";
                    qcErrorCount++;
                    qcMessage.pop();
                    qcMessage.push(txt);

                } else {//integer check
                    if (data['state'][stateKeys[m]] == undefined) {
                        txt += '<span style="color:red">' + stateKeys[m] + ': ' + data['state'][stateKeys[m]] + ' missing</span>' + "<br>";
                        qcErrorCount++;
                        qcMessage.pop();
                        qcMessage.push(txt);
                    } else if (stateType !== 'number') {
                        txt += '<span style="color:red">' + stateKeys[m] + ': ' + data['state'][stateKeys[m]] + ' should be an integer type</span>' + "<br>";
                        qcErrorCount++;
                        qcMessage.pop();
                        qcMessage.push(txt);
                    } else if (conceptIDs.indexOf(stateKeys[m]) !== -1 && !(conceptIdsRange[stateKeys[m]].includes(data['state'][stateKeys[m]]))) {
                        txt += '<span style="color:red">' + stateKeys[m] + ':' + data['state'][stateKeys[m]] + ' out of range</span>' + "<br>";
                        qcErrorCount++;
                        qcMessage.pop();
                        qcMessage.push(txt);
                    } else {
                        txt += stateKeys[m] + ':' + data['state'][stateKeys[m]] + ' is good to go' + "<br>";
                        qcMessage.pop();
                        qcMessage.push(txt);
                    }
                }
            }
        }
    }


    //$('#qcResult').html(txt);
    qcMessage.pop();
    qcMessage.push(txt);
    return 0;
     //res.end('Hello World');
}


const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
  
  let inputData = '';
  req.on('data', chunk => {
    inputData += chunk;
  })
  req.on('end', () => {
    console.log(inputData); 
    startQC(req, res, inputData);
  })
  
});


server.listen(port, null, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});