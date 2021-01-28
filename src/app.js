const express = require("express");
const config = require("config");
const shell = require("shelljs");
const fs = require("fs");
const path = require("path");
const session = require("express-session");
const { v4: uuidv4 } = require("uuid");
const utils = require("./utils.js");

const app = express();
const logger = utils.getLogger();

// init auth if enabled
if (config.get("useKeycloakAuth")) {
  const memoryStore = new session.MemoryStore();

  // session
  app.use(
    session({
      secret: uuidv4(),
      resave: false,
      saveUninitialized: true,
      store: memoryStore,
    })
  );
}

shell.mkdir("-p", config.get("logDir"));
shell.mkdir("-p", "./data");

app.use(express.static("public"));

// prevents nodejs from exiting
process.on("uncaughtException", (err) => {
  logger.info("uncaught exception received:");
  logger.info("------------------------------------------");
  logger.error(err.stack);
  logger.info("------------------------------------------");
});

//------------------------------------------------------------------

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
    "00201208",
  ];

  const json = await utils.doFind("STUDY", req.query, tags);
  res.json(json);
});

//------------------------------------------------------------------

app.get(
  "/rs/studies/:studyInstanceUid/metadata",

  async (req, res) => {
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
      "00201209",
    ];

    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid;

    const json = await utils.doFind("SERIES", query, tags);
    res.json(json);
  }
);

//------------------------------------------------------------------

app.get(
  "/rs/studies/:studyInstanceUid/series",

  async (req, res) => {
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
      "00201209",
    ];

    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid;

    const json = await utils.doFind("SERIES", query, tags);
    res.json(json);
  }
);

//------------------------------------------------------------------

app.get(
  "/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances",

  async (req, res) => {
    // fix for OHIF viewer assuming a lot of tags
    const tags = ["00080016", "00080018"];

    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid;
    query.SeriesInstanceUID = req.params.seriesInstanceUid;

    const json = await utils.doFind("IMAGE", query, tags);
    res.json(json);
  }
);

//------------------------------------------------------------------

app.get(
  "/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/metadata",

  async (req, res) => {
    // fix for OHIF viewer assuming a lot of tags
    const tags = ["00080016", "00080018"];

    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid;
    query.SeriesInstanceUID = req.params.seriesInstanceUid;

    const json = await utils.doFind("IMAGE", query, tags);
    res.json(json);
  }
);

//------------------------------------------------------------------

app.get("/wadouri", async (req, res) => {
  const studyUid = req.query.studyUID;
  const seriesUid = req.query.seriesUID;
  const imageUid = req.query.objectUID;
  const storagePath = config.get("storagePath");
  const pathname = path.join(storagePath, studyUid, imageUid);

  try {
    await utils.fileExists(pathname);
  } catch (error) {
    await utils.waitOrFetchData(studyUid, seriesUid);
  }
  // if the file is found, set Content-type and send data
  res.setHeader("Content-type", "application/dicom");

  // read file from file system
  fs.readFile(pathname, (err, data) => {
    if (err) {
      const msg = `Error getting the file: ${err}.`;
      logger.error(msg);
      res.statusCode = 500;
      res.end(msg);
    }
    res.end(data);
  });

  // clear data
  utils.clearCache(storagePath, studyUid, false);
});

//------------------------------------------------------------------

const port = config.get("webserverPort");
app.listen(port, async () => {
  logger.info(`webserver running on port: ${port}`);
  await utils.init();

  // if not using c-get, start our scp
  if (!config.get("useCget")) {
    utils.startScp();
  }

  utils.sendEcho();

  // clear data
  if (config.get("clearCacheOnStartup")) {
    const storagePath = config.get("storagePath");
    utils.clearCache(storagePath, "", true);
  }
});

//------------------------------------------------------------------
