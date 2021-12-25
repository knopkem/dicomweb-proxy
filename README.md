# dicomweb-proxy

A proxy to translate between dicomweb and traditional dicom dimse services

## Description
* A nodejs tool to easily connect a DICOMWEB capable DICOM viewer to a legacy PACS that only knows DIMSE services.  
Comes with preinstalled OHIF DICOM Web Viewer (version 4.9.21).

## What is it for?

* if you want to view image data from a legacy PACS that does not understand DICOMWEB nor comes with a web-viewer

## How does it work?

* the app should be installed within the hospital intranet and configured to connect via DIMSE networking to a PACS
* it hosts a default DICOMweb viewer (ohif) which can be replaced
* the webserver exposes the default QIDO and WADOURI API needed for the viewer
* optionally: you can connect to a DICOMWEB-WEBSOCKET-BRIDGE and expose the data to the public (handle with care!)

## Prerequisite

* nodejs 12 or newer

## Setup Instructions - npm

* install in empty directory:  
```npm init -y```  
```npm install dicomweb-proxy```

* update config file located in:  
```./node_modules/dicomweb-proxy/config```

* start proxy:  
```npx dicomweb-proxy```

## Setup Instructions - source

* clone repository and install dependencies:  
```npm install```

* update config file located in:  
```./config```

* start proxy:  
```npm start```

## What to modify
* (optional) change our port or AET 

```
config.source = {
  aet: "SOURCE_AET",
  ip: "SOURCE_IP",
  port: "SOURCE_PORT"
};
```

* change peer(s) to your PACS

```
config.peers = [{
  aet: "TARGET_AET",
  ip: "TARGET_IP",
  port: "TARGET_PORT"
}, { more peers here...}];
```

* in case your PACS does not support C-GET, switch to C-Move:  
```config.useCget = false;```

* update webserver port:  
```config.webserverPort = 5000;```

* open webbrowser and start viewing:  
e.g. ```http://localhost:5000```

## License
MIT