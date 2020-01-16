const express = require('express');
const config = require('config');
const winstonLib = require('winston');
const addon = require('dicom-dimse-native');
const shell = require('shelljs');
require('winston-daily-rotate-file');

shell.mkdir('-p', config.get('logDir'));

const dailyRotateFile = new (winstonLib.transports.DailyRotateFile)({
  filename: `${config.get('logDir')}/app-%DATE%.log`,  // last part is the filename suffix
  datePattern: 'YYYY-MM-DD-HH',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d'}
);

const winston = new (winstonLib.Logger)({
  transports: [
    dailyRotateFile,
  ],
});

winston.add(winstonLib.transports.Console);

const app = express();

// prevents nodejs from exiting
process.on('uncaughtException', (err) => {
  winston.info('uncaught exception received');
  winston.error(err.stack);
});


app.get('/', (req, res) => {
  winston.info('request received');

    const j = {
        "source": {
            "aet": "IMEBRA",
            "ip" : "127.0.0.1",
            "port": "9999"
        },
        "target": {
            "aet": "CONQUESTSRV1",
            "ip" : "127.0.0.1",
            "port": "5678"
        },
        "tags" : [
            {
                "key": "00100010", 
                "value": "",
            },
            {
                "key": "0020000D", 
                "value": "1.3.46.670589.11.0.1.1996082307380006",
            },
            {
                "key": "00080052", 
                "value": "STUDY",
            },
        ]
    };

    addon.findScu(JSON.stringify(j), (result) => {
        console.log("result: ", result);
    });

});

app.listen(config.get('port'), () => {
  winston.info(`server listening on port: ${config.get('port')}`);
});
