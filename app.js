const express = require("express");
const config = require("config");
const winstonLib = require("winston");
const dimse = require("dicom-dimse-native");
const shell = require("shelljs");
const dict = require("dicom-data-dictionary");
const fs = require("fs");
const storage = require("node-persist");
const path = require("path");

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

const doFind = (queryLevel, query, defaults) => {
  // add query retrieve level
  const j = {
    tags: [
      {
        key: "00080052",
        value: queryLevel
      }
    ]
  };

  // set source and target from config
  j.source = config.get("source");
  j.target = config.get("target");

  // parse all include fields
  const includes = query.includefield;

  let tags = [];
  if (includes) {
    tags = includes.split(",");
  }
  tags.push(...defaults);

  // add parsed tags
  tags.forEach(element => {
    const tagName = findDicomName(element) || element;
    j.tags.push({ key: tagName, value: "" });
  });

  // add search params
  for (const propName in query) {
    if (query.hasOwnProperty(propName)) {
      const tag = findDicomName(propName);
      if (tag) {
        let v = query[propName];
        // patient name check
        if (tag === "00100010") {
          // min chars
          if (config.get("qidoMinChars") > v.length) {
            return [];
          }
          // auto append wildcard
          if (config.get("qidoAppendWildcard")) {
            v += "*";
          }
        }
        j.tags.push({ key: tag, value: v });
      }
    }
  }

  const offset = query.offset ? query.offset : 0;

  // run find scu and return json response
  return new Promise((resolve, reject) => {
    dimse.findScu(JSON.stringify(j), result => {
      try {
        const j = JSON.parse(result);
        if (j.code === 0) {
          resolve(JSON.parse(j.container).slice(offset));
        }
      } catch (error) {
        winston.error(error);
        winston.error(result);
        resolve([]);
      }
    });
  });
};

app.get("/rs/studies", async (req, res) => {
  // fix for OHIF viewer assuming a lot of tags
  const tags = [
    "00080005",
    "00080020",
    "00080030",
    "00080050",
    "00080054",
    "00080056",
    "00080061",
    "00080090",
    "00081190",
    "00100010",
    "00100020",
    "00100030",
    "00100040",
    "0020000D",
    "00200010",
    "00201206",
    "00201208"
  ];

  const json = await doFind("STUDY", req.query, tags);
  res.json(json);
});

app.get("/viewer/rs/studies/:studyInstanceUid/series", async (req, res) => {
  // fix for OHIF viewer assuming a lot of tags
  const tags = [
    "00080005",
    "00080054",
    "00080056",
    "00080060",
    "0008103E",
    "00081190",
    "0020000E",
    "00200011",
    "00201209"
  ];

  let query = req.query;
  query["StudyInstanceUID"] = req.params.studyInstanceUid;

  const json = await doFind("SERIES", query, tags);
  res.json(json);
});

app.get(
  "/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/metadata",
  async (req, res) => {
    // fix for OHIF viewer assuming a lot of tags
    const tags = ["00080016", "00080018"];

    let query = req.query;
    query["StudyInstanceUID"] = req.params.studyInstanceUid;
    query["SeriesInstanceUID"] = req.params.seriesInstanceUid;

    const json = await doFind("IMAGE", query, tags);
    res.json(json);
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

// request data from PACS via c-get or c-move
const fetchData = async (studyUid, seriesUid) => {
  // add query retrieve level and fetch whole study
  const j = {
    tags: [
      {
        key: "00080052",
        value: "SERIES"
      },
      {
        key: "0020000D",
        value: studyUid
      },
      {
        key: "0020000E",
        value: seriesUid
      }
    ]
  };

  // set source and target from config
  j.source = config.get("source");
  j.target = config.get("target");
  j.storagePath = config.get("storagePath");

  const scu = config.get("useCget") ? dimse.getScu : dimse.moveScu;

  const prom = new Promise((resolve, reject) => {
    try {
      scu(JSON.stringify(j), result => {
        try {
          const json = JSON.parse(result);
          if (json.code === 0 || json.code === 2) {
            storage.getItem(studyUid).then(item => {
              if (!item) {
                winston.info("stored", path.join(j.storagePath, studyUid));
                const cacheTime = config.get("keepCacheInMinutes");
                if (cacheTime >= 0) {
                  storage.setItem(studyUid, addMinutes(new Date(), cacheTime));
                }
              }
            });
            resolve(result);
          } else {
            winston.info(JSON.parse(result));
          }
        } catch (error) {
          reject(error, result);
        }
        lock.delete(seriesUid);
      });
    } catch (error) {
      reject(error);
    }
  });
  // store in lock
  lock.set(seriesUid, prom);
  return prom;
};

// helper to add minutes to date object
const addMinutes = (date, minutes) => {
  return new Date(date.getTime() + minutes * 60000);
};

// fetch and wait
const waitOrFetchData = (studyUid, seriesUid) => {
  // check if already locked and return promise
  if (lock.has(seriesUid)) {
    return lock.get(seriesUid);
  }
  return fetchData(studyUid, seriesUid);
};

// remove cached data if outdated
const clearCache = async (storagePath, currentUid) => {
  const currentDate = new Date();
  storage.forEach(item => {
    const dt = new Date(item.value);
    const directory = path.join(storagePath, item.key);
    if (dt.getTime() < currentDate.getTime() && item.key !== currentUid) {
      fs.rmdir(
        directory,
        {
          recursive: true
        },
        error => {
          if (error) {
            winston.error(error);
          } else {
            winston.info("deleted", directory);
            storage.rm(item.key); // not nice but seems to work
          }
        }
      );
    }
  });
};

app.get("/viewer/wadouri", async (req, res) => {
  const studyUid = req.query.studyUID;
  const seriesUid = req.query.seriesUID;
  const imageUid = req.query.objectUID;
  const storagePath = config.get("storagePath");
  const pathname = path.join(storagePath, studyUid, imageUid) + ".dcm";

  try {
    await fileExists(pathname);
  } catch (error) {
    await waitOrFetchData(studyUid, seriesUid);
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

  // clear data
  clearCache(storagePath, studyUid);
});

app.listen(config.get("port"), async () => {
  winston.info(`webserver running on port: ${config.get("port")}`);
  await storage.init();

  // if not using c-get, start our scp
  if (!config.get("useCget")) {
    let j = {};
    j.source = config.get("source");
    j.storagePath = config.get("storagePath");

    dimse.startScp(JSON.stringify(j), result => {
      try {
        winston.info(JSON.parse(result));
      } catch (error) {
        winston.error(error, result);
      }
    });
  }
});
