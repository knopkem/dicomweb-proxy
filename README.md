# dicomweb-proxy
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fknopkem%2Fdicomweb-proxy.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2Fknopkem%2Fdicomweb-proxy?ref=badge_shield)

A proxy to translate between dicomweb and traditional dicom dimse services

## Description
* A nodejs tool to easily connect a DICOMWEB capable DICOM viewer to a legacy PACS that only knows DIMSE services. Comes with preinstalled OHIF DICOM Web Viewer.

## How to use
* clone repository or intall via 
```npm i dicomweb-proxy```

* update config file:
** in config directory: modify default.js or create development.js (overrides default) 
** change to your desired target AET

```
config.target = {
  aet: "TARGET_AET",
  ip: "TARGET_IP",
  port: "TARGET_PORT"
};
```

* run server:
```npm start```

* open webbrowser and start viewing
e.g. ```http://localhost:5000```

## License
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fknopkem%2Fdicomweb-proxy.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Fknopkem%2Fdicomweb-proxy?ref=badge_large)