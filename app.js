'use strict';

const Homey = require('homey');
const { ManagerSettings } = require('homey');


class onkyoApp extends Homey.App {

  onInit() {
    this.log('onkyoApp is running...');
    this.log(`ManagerSettings: -- ipAddress: ${ManagerSettings.get('ipAddressSet')} -- maxVolume:${ManagerSettings.get('maxVolumeSet')} -- volumeStep:${ManagerSettings.get('volumeStepSet')}`);
  }

}

module.exports = onkyoApp;
