const config = {};

config.logDir = './logs';
config.port = 5000;

config.source = {
    aet: 'IMEBRA',
    ip: '127.0.0.1',
    port: '9999'
};

config.target = {
    aet: 'CONQUESTSRV1',
    ip: '127.0.0.1',
    port: '5678'
};

module.exports = config;
