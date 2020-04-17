# dicomweb-proxy
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fknopkem%2Fdicomweb-proxy.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2Fknopkem%2Fdicomweb-proxy?ref=badge_shield)

A proxy to translate between dicomweb and traditional dicom dimse services

## Description
* A nodejs tool to easily connect a DICOMWEB capable DICOM viewer to a legacy PACS that only knows DIMSE services. Comes with preinstalled OHIF DICOM Web Viewer.

## Prerequisite

* nodejs 12 or newer

## Setup Instructions - npm

* install in empty directory
```npm install dicomweb-proxy```

* update config file located in:
```./node_modules/dicomweb-proxy/config```

* run:
```npx dicomweb-proxy```

## Setup Instructions - source

* clone repository and install dependencies 
```npm install```

* update config file located in:
```./config```

* run:
```npm start```

## What to modify
* (optional) change source port or AET 

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

* update port
```config.webserverPort = 5000;```

* open webbrowser and start viewing
e.g. ```http://localhost:5000```

## Optional: Authentication and Authorization
* you can enable keycloak authentication using the option:
```config.useKeycloakAuth```
* this requires a keycloak.json file in the root directory
* users will be redirected to keycloak server and every route is protected
* see https://codeburst.io/keycloak-and-express-7c71693d507a

## License
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fknopkem%2Fdicomweb-proxy.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Fknopkem%2Fdicomweb-proxy?ref=badge_large)
