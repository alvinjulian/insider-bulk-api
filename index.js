const multer = require('multer');
const csv = require('fast-csv');
const fs = require('fs');
const express = require('express');
const { default: axios } = require('axios');
const app = express();
const { MongoClient } = require('mongodb');
const Bottleneck = require('bottleneck');

// Update with your config settings.
require('dotenv').config({path: '.env'});

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, __basedir + '/uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + file.originalname)
    } 
});

const csvFilter = function (req, file, cb) {
    if (file.mimetype.includes('csv')) {
        cb(null, true);
    } else {
        cb("Please only upload CSV file", false);
    }
}

function transformSingleIdentifier (data, callback) {
    let identifier = data[identifier];
        
    let transformedData = {
        "identifiers": {
            "custom": {
                "zenoti_user_code": identifier
            }
        }
    }

    return transformedData;
}

const upload = multer({ storage: storage, fileFilter: csvFilter });

app.post("/insider/bulk-delete", upload.single("file"), (req, res) => {
    let deleteUrl  = "https://unification.useinsider.com/api/user/v1/attribute/delete";

    if (req.body.partnername === undefined || req.body.partnername === null) {
        return res.status(400).send("Please enter a key!");
    }

    if (req.body.requesttoken === undefined || req.body.requesttoken === null) {
        return res.status(400).send("Please enter a request token!");
    }

    let partnerName = req.body.partnername;
    let requestToken = req.body.requesttoken;

    // Declare limiter for bottlenecking activity
    const limiter = new Bottleneck({
        maxConcurrent: 50,
        minTime: 25
    });

    let csvData = [];

    try {
        if (req.file === undefined) {
            return res.status(400).send("Please upload a CSV file!");
        }

        let filePath = __basedir + '/uploads/' + req.file.filename;

        fs.createReadStream(filePath)
            .pipe(csv.parse({headers: true, delimiter: ',', trim: true, skipLines: 0, skipEmptyLines: true, trimHeaders: true}))
            .on('data', (row) => {
                try {
                    var data = transformSingleIdentifier(row);

                    csvData.push(data);
                  } finally {
                    //   Then
                    csvData.forEach((line, index) => {
                        limiter.schedule(() => {
                            axios({
                                method: 'POST',
                                url: deleteUrl,
                                headers: {
                                    'X-PARTNER-NAME': partnerName,, 
                                    'X-REQUEST-TOKEN': requestToken,, 
                                    'Content-Type': 'application/json'
                                },
                                data: line
                            })
                            .then(response => {
                                if(response.status > 200 && response.status < 300){
                                    console.log(response.status.data)
                                }
                            })
                            .catch(error => {
                                console.log(error.response.status)
                                console.log(data)
                            })
                        })
                    })
                }
            })
            .on('end', () => {
                fs.unlinkSync(filePath);
                return res.status(200).send("File uploaded successfully!");
            });

    }
    catch (error) {
        console.log(error);
        return res.status(500).send("Error occured while trying to upload file!");
    }
});