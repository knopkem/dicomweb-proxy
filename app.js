const express = require('express');
const config = require('config');
const winstonLib = require('winston');
const dimse = require('dicom-dimse-native');
const shell = require('shelljs');
const dict = require('dicom-data-dictionary');
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
app.use(express.static('public'));

function findDicomName(name) {
  for (const key of Object.keys(dict.standardDataElements)) {
    const value = dict.standardDataElements[key];
    if (value.name == name) {
      return key;
    }
  }
}

// prevents nodejs from exiting
process.on('uncaughtException', (err) => {
  winston.info('uncaught exception received');
  winston.error(err.stack);
});

app.get('/', (req, res) => {
});

app.get('/studies', (req, res) => {
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
      "key": "00080052", 
      "value": "STUDY",
      },
    ]
  };

  const includes = req.query.includefield;

  if (includes) {
    const tags = includes.split(','); 
    if (Array.isArray(tags)) {
      tags.forEach(element => {
        j.tags.push({"key": element, "value": ""});
      });
    }
  }

  for (const propName in req.query) {
    if (req.query.hasOwnProperty(propName)) {
      const tag = findDicomName(propName);
      if (tag) {
        j.tags.push({"key": tag, "value": req.query[propName]});
      }
    }
  }

  // console.log(j);
  dimse.findScu(JSON.stringify(j), (result) => {
        const json =  JSON.parse(result);
        // console.log("result: ", json);
        res.setHeader('Content-Type', 'application/json');
        res.json(json);
    });

});

app.listen(config.get('port'), () => {
  winston.info(`server listening on port: ${config.get('port')}`);
});
