# dicomweb-proxy

A proxy to translate between [DICOMWEB](https://www.dicomstandard.org/dicomweb) and traditional DICOM [DIMSE](https://dicom.nema.org/medical/dicom/current/output/chtml/part07/sect_7.5.html) services

## Description
* A nodejs tool to easily connect a DICOMWEB capable DICOM viewer to one or more legacy PACS that only know DIMSE services.  
Comes preinstalled with the popular [OHIF DICOM Web Viewer](https://github.com/OHIF/Viewers) (version 4.12.50).

## What is it for?

* if you want to view image data from one or more legacy PACS that does not understand DICOMWEB nor come with a web-viewer

## How does it work?

* the app should be installed within the hospital intranet and configured to connect via DIMSE networking to on or more PACS (peers)
* it hosts a default DICOMweb viewer (OHIF) which can be replaced
* the webserver exposes the default QIDO and WADOURI/WADORS API needed for the viewer and converts on the fly between the two protocols
* optionally: you can connect to a [DICOMWEB-WEBSOCKET-BRIDGE](https://github.com/knopkem/dicomweb-websocket-bridge) and expose the data to the public (handle with care!)

## Prerequisite

* nodejs 12 or newer

## Setup Instructions - npm

* install in empty directory:  
```npm init -y```  
```npm install dicomweb-proxy```

* update config file located in:  
```./node_modules/dicomweb-proxy/config```

* or better: create config override, see: [config](https://www.npmjs.com/package/config)

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
