const config = {};

// our SCP (only used if useCget is false
config.source = {
  aet: "DICOMWEB_PROXY",
  ip: "127.0.0.1",
  port: "8888"
};

// our target PACS
config.target = {
  aet: "CONQUESTSRV1",
  ip: "127.0.0.1",
  port: "5678"
};


/*
Supported Transfer Syntaxes:
1.2.840.10008.1.2       Implicit VR Endian: Default Transfer Syntax for DICOM    
1.2.840.10008.1.2.1     Explicit VR Little Endian    
1.2.840.10008.1.2.2     Explicit VR Big Endian   
1.2.840.10008.1.2.4.50  JPEG Baseline (Process 1) - Lossy JPEG 8-bit Image Compression
1.2.840.10008.1.2.4.51  JPEG Baseline (Processes 2 & 4) - Lossy JPEG 12-bit Image Compression
1.2.840.10008.1.2.4.70  JPEG Lossless, Nonhierarchical, First- Order Prediction
1.2.840.10008.1.2.4.80  JPEG-LS Lossless Image Compression   <-- recommended
1.2.840.10008.1.2.4.81  JPEG-LS Lossy (Near- Lossless) Image Compression
1.2.840.10008.1.2.5     RLE Lossless
*/

// transfer syntax (e.g. compression of dicom files) used for transmission via wado and proposed to pacs
config.transferSyntax = '1.2.840.10008.1.2.4.80';

// log directory
config.logDir = "./logs";

// cache directory
config.storagePath = "./data";

// webserver port
config.webserverPort = 5000;

// target PACS supports C-Get (if flase use C-Move instead)
config.useCget = true;

// how long before deleting cache, 0 for eternity
config.keepCacheInMinutes = 60;

// do not issue c-find if search contains less characters
config.qidoMinChars = 0;

// auto append * for patient name query
config.qidoAppendWildcard = true;

// enable verbose logging to std::out (contains DIMSE output)
config.verboseLogging = false;

module.exports = config;
