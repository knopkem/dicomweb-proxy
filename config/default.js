const config = {};

// log directory
config.logDir = "./logs";

// webserver port
config.port = 5000;

// target PACS supports C-Get (if flase use C-Move instead)
config.useCget = true;

// our SCP (only used if useCget is false
config.source = {
  aet: "IMEBRA",
  ip: "127.0.0.1",
  port: "9999"
};

// our target PACS
config.target = {
  aet: "CONQUESTSRV1",
  ip: "127.0.0.1",
  port: "5678"
};

// cache directory
config.storagePath = "./data";

// how long before deleting cache, -1 for eternity
config.keepCacheInMinutes = 60;

// do not issue c-find if search contains less characters
config.qidoMinChars = 0;

module.exports = config;
