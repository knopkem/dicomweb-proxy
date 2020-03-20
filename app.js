const express = require("express");
const config = require("config");
const winstonLib = require("winston");
const dimse = require("dicom-dimse-native");
const shell = require("shelljs");
const dict = require("dicom-data-dictionary");
const fs = require("fs");

const lock = new Map();

require("winston-daily-rotate-file");

shell.mkdir("-p", config.get("logDir"));
shell.mkdir("-p", "./data");

const dailyRotateFile = new winstonLib.transports.DailyRotateFile({
  filename: `${config.get("logDir")}/app-%DATE%.log`, // last part is the filename suffix
  datePattern: "YYYY-MM-DD-HH",
  zippedArchive: true,
  maxSize: "20m",
  maxFiles: "14d"
});

const winston = new winstonLib.Logger({
  transports: [dailyRotateFile]
});

winston.add(winstonLib.transports.Console);

const app = express();
app.use(express.static("public"));

function findDicomName(name) {
  for (const key of Object.keys(dict.standardDataElements)) {
    const value = dict.standardDataElements[key];
    if (value.name == name) {
      return key;
    }
  }
}

// prevents nodejs from exiting
process.on("uncaughtException", err => {
  winston.info("uncaught exception received");
  winston.error(err.stack);
});

app.get("/rs/studies", (req, res) => {
  // add query retrieve level
  const j = {
    tags: [
      {
        key: "00080052",
        value: "STUDY"
      }
    ]
  };

  // set source and target from config
  j.source = config.get("source");
  j.target = config.get("target");

  // parse all include fields
  const includes = req.query.includefield;

  let tags = [];
  if (includes) {
    let tags = includes.split(",");
  }

  // fix for OHIF viewer assuming a lot of tags
  tags.push("00080005");
  tags.push("00080020");
  tags.push("00080030");
  tags.push("00080050");
  tags.push("00080054");
  tags.push("00080056");
  tags.push("00080061");
  tags.push("00080090");
  tags.push("00081190");
  tags.push("00100010");
  tags.push("00100020");
  tags.push("00100030");
  tags.push("00100040");
  tags.push("0020000D");
  tags.push("00200010");
  tags.push("00201206");
  tags.push("00201208");

  // add parsed tags
  tags.forEach(element => {
    // todo check if we need to convert to tag first
    j.tags.push({ key: element, value: "" });
  });

  // add search params
  for (const propName in req.query) {
    if (req.query.hasOwnProperty(propName)) {
      const tag = findDicomName(propName);
      if (tag) {
        j.tags.push({ key: tag, value: req.query[propName] });
      }
    }
  }

  // run find scu and return json response
  dimse.findScu(JSON.stringify(j), result => {
    try {
      const j = JSON.parse(result);
      if (j.code === 0) {
        res.json(JSON.parse(j.container));
      }
    } catch (error) {
      winston.error(error);
      winston.inso(result);
      res.json([]);
    }
  });
});

app.get("/viewer/rs/studies/:studyInstanceUid/series", (req, res) => {
  // add query retrieve level
  const j = {
    tags: [
      {
        key: "00080052",
        value: "SERIES"
      }
    ]
  };

  // set source and target from config
  j.source = config.get("source");
  j.target = config.get("target");

  // parse all include fields
  const includes = req.query.includefield;

  let tags = [];
  if (includes) {
    let tags = includes.split(",");
  }

  // fix for OHIF viewer assuming a lot of tags
  tags.push("00080005");
  tags.push("00080054");
  tags.push("00080056");
  tags.push("00080060");
  tags.push("0008103E");
  tags.push("00081190");
  tags.push("0020000E");
  tags.push("00200011");
  tags.push("00201209");

  // add parsed tags
  tags.forEach(element => {
    // todo check if we need to convert to tag first
    j.tags.push({ key: element, value: "" });
  });

  // add search params
  for (const propName in req.query) {
    if (req.query.hasOwnProperty(propName)) {
      const tag = findDicomName(propName);
      if (tag) {
        j.tags.push({ key: tag, value: req.query[propName] });
      }
    }
  }

  // add study uid
  j.tags.push({ key: "0020000D", value: req.params.studyInstanceUid });

  // run find scu and return json response
  dimse.findScu(JSON.stringify(j), result => {
    try {
      const j = JSON.parse(result);
      if (j.code === 0) {
        res.json(JSON.parse(j.container));
      }
    } catch (error) {
      winston.error(error);
      winston.info(result);
      res.json([]);
    }
  });
});

app.get(
  "/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/metadata",
  (req, res) => {
    // add query retrieve level
    const j = {
      tags: [
        {
          key: "00080052",
          value: "IMAGE"
        }
      ]
    };

    // set source and target from config
    j.source = config.get("source");
    j.target = config.get("target");

    // parse all include fields
    const includes = req.query.includefield;

    let tags = [];
    if (includes) {
      let tags = includes.split(",");
    }

    // fix for OHIF viewer assuming a lot of tags
    tags.push("00080016");
    tags.push("00080018");

    // add parsed tags
    tags.forEach(element => {
      // todo check if we need to convert to tag first
      j.tags.push({ key: element, value: "" });
    });

    // add search params
    for (const propName in req.query) {
      if (req.query.hasOwnProperty(propName)) {
        const tag = findDicomName(propName);
        if (tag) {
          j.tags.push({ key: tag, value: req.query[propName] });
        }
      }
    }

    // add study and series uid
    j.tags.push({ key: "0020000D", value: req.params.studyInstanceUid });
    j.tags.push({ key: "0020000E", value: req.params.seriesInstanceUid });

    // run find scu and return json response
    dimse.findScu(JSON.stringify(j), result => {
      try {
        const j = JSON.parse(result);
        if (j.code === 0) {
          res.json(JSON.parse(j.container));
        }
      } catch (error) {
        winston.error(error);
        winston.info(result);
        res.json([]);
      }
    });
  }
);

const fileExists = pathname => {
  return new Promise((resolve, reject) => {
    fs.access(pathname, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

const fetchData = studyUid => {
  // add query retrieve level and fetch whole study
  const j = {
    tags: [
      {
        key: "00080052",
        value: "STUDY"
      },
      {
        key: "0020000D",
        value: studyUid
      }
    ]
  };

  // set source and target from config
  j.source = config.get("source");
  j.target = config.get("target");

  const prom = new Promise((resolve, reject) => {
    dimse.getScu(JSON.stringify(j), result => {
      try {
        const j = JSON.parse(result);
        if (j.code === 0) {
          resolve(result);
        }
      } catch (error) {
        reject(error);
      }
      lock.delete(studyUid);
    });
  });
  // store in lock
  lock.set(studyUid, prom);
  return prom;
};

const waitOrFetchData = studyUid => {
  // check if already locked and return promise
  if (lock.has(studyUid)) {
    return lock.get(studyUid);
  }
  return fetchData(studyUid);
};

app.get("/viewer/wadouri", async (req, res) => {
  const studyUid = req.query.studyUID;
  // const seriesUid = req.query.seriesUID;
  const imageUid = req.query.objectUID;
  const pathname = "./data/" + imageUid + ".dcm";

  try {
    await fileExists(pathname);
  } catch (error) {
    await waitOrFetchData(studyUid);
  }

  // read file from file system
  fs.readFile(pathname, (err, data) => {
    if (err) {
      res.statusCode = 500;
      return res.end(`Error getting the file: ${err}.`);
    }
    // if the file is found, set Content-type and send data
    res.setHeader("Content-type", "application/dicom");
    res.end(data);
  });
});

app.listen(config.get("port"), () => {
  winston.info(`server listening on port: ${config.get("port")}`);
});
