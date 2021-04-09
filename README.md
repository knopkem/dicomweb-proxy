# dicomweb-proxy

A proxy to translate between dicomweb and traditional dicom dimse services

## Description
* A nodejs tool to easily connect a DICOMWEB capable DICOM viewer to a legacy PACS that only knows DIMSE services.  
Comes with preinstalled OHIF DICOM Web Viewer (version 4.8.6).

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

* change target to your PACS

```
config.target = {
  aet: "TARGET_AET",
  ip: "TARGET_IP",
  port: "TARGET_PORT"
};
```

* in case your PACS does not support C-GET, switch to C-Move:  
```config.useCget = false;```

* update webserver port:  
```config.webserverPort = 5000;```

* open webbrowser and start viewing:  
e.g. ```http://localhost:5000```

## License
MIT