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

app.get('/studies', (req, res) => {

  // add query retrieve level
  const j = {
    'tags' : [
      {
      'key': '00080052', 
      'value': 'STUDY',
      },
    ]
  };

  // set source and target from config
  j.source = config.get('source');
  j.target = config.get('target');

  // parse all include fields
  const includes = req.query.includefield;

  if (includes) {
    const tags = includes.split(','); 
    if (Array.isArray(tags)) {

      // fix for OHIF viewer assuming a lot of tags
      tags.push('00080005');
      tags.push('00080020');
      tags.push('00080030');
      tags.push('00080050');
      tags.push('00080054');
      tags.push('00080056');
      tags.push('00080061');
      tags.push('00080090');
      tags.push('00081190');
      tags.push('00100010');
      tags.push('00100020');
      tags.push('00100030');
      tags.push('00100040');
      tags.push('0020000D');
      tags.push('00200010');
      tags.push('00201206');
      tags.push('00201208');

      // add parsed tags
      tags.forEach(element => {
        // todo check if we need to convert to tag first
        j.tags.push({'key': element, 'value': ''});
      });
    }
  }

  // add search params
  for (const propName in req.query) {
    if (req.query.hasOwnProperty(propName)) {
      const tag = findDicomName(propName);
      if (tag) {
        j.tags.push({'key': tag, 'value': req.query[propName]});
      }
    }
  }

  // run find scu and return json response
  dimse.findScu(JSON.stringify(j), (result) => {
    try {
      const json =  JSON.parse(result);
      res.setHeader('Content-Type', 'application/json');
      res.json(json);
    } catch (error) {
      console.error(error);
      console.log(result);
    }
  });

});

app.listen(config.get('port'), () => {
  winston.info(`server listening on port: ${config.get('port')}`);
});
